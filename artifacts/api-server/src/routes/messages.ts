import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, isNull, lte, gte, or, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  messageThreadsTable,
  messageThreadParticipantsTable,
  messagesTable,
  usersTable,
  userRolesTable,
  delegationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN";

const router: IRouter = Router();

// ─── Permission matrix (MSG-D03) ──────────────────────────────────────────────
const ALLOWED_TARGETS: Record<RoleValue, RoleValue[]> = {
  MEMBER:       ["SUPERVISOR_A", "SUPERVISOR_B"],
  // note: MEMBER com OPERATIONAL_MESSAGES ganha acesso estendido — ver hasOperationalMessagesDelegation
  SUPERVISOR_A: ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
  SUPERVISOR_B: ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
  ADMIN:        ["SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
};

async function getUserRole(userId: string): Promise<RoleValue | null> {
  const [row] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)))
    .limit(1);
  return (row?.role as RoleValue) ?? null;
}

// ─── T006: verifica se MEMBER tem delegação ativa com OPERATIONAL_MESSAGES ────

async function hasOperationalMessagesDelegation(userId: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .select({ responsibilities: delegationsTable.responsibilities })
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.delegateeId, userId),
        isNull(delegationsTable.revokedAt),
        lte(delegationsTable.validFrom, now),
        gte(delegationsTable.validUntil, now),
      )
    );
  return rows.some((r) => (r.responsibilities as string[]).includes("OPERATIONAL_MESSAGES"));
}

// ─── GET /messages/recipients ─────────────────────────────────────────────────

router.get(
  "/messages/recipients",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;

      const senderRole = await getUserRole(userId);
      if (!senderRole) { res.status(403).json({ error: "Papel não encontrado" }); return; }

      const allowed = ALLOWED_TARGETS[senderRole];
      if (!allowed || allowed.length === 0) { res.json({ recipients: [] }); return; }

      const members = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: userRolesTable.role,
        })
        .from(userRolesTable)
        .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
        .where(
          and(
            eq(userRolesTable.active, true),
            inArray(userRolesTable.role, allowed as readonly RoleValue[]),
          )
        );

      const seen = new Set<string>();
      const recipients = members.filter((m) => {
        if (m.id === userId) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      res.json({ recipients });
    } catch {
      res.status(500).json({ error: "Erro ao buscar destinatários" });
    }
  }
);

// ─── POST /messages/threads ───────────────────────────────────────────────────

router.post(
  "/messages/threads",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const {
        title,
        participantIds,
        contextType,
        contextId,
        contextTitle,
      } = req.body as {
        title: string;
        participantIds: string[];
        contextType?: string;
        contextId?: string;
        contextTitle?: string;
      };

      if (!title?.trim()) { res.status(400).json({ error: "title é obrigatório" }); return; }
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        res.status(400).json({ error: "participantIds é obrigatório" });
        return;
      }

      const senderRole = await getUserRole(userId);
      if (!senderRole) { res.status(403).json({ error: "Papel não encontrado" }); return; }

      let allowed = [...ALLOWED_TARGETS[senderRole]];
      if (senderRole === "MEMBER") {
        const isCapitao = await hasOperationalMessagesDelegation(userId);
        if (isCapitao) allowed = ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"];
      }

      const targetRoles = await db
        .select({ userId: userRolesTable.userId, role: userRolesTable.role })
        .from(userRolesTable)
        .where(
          and(
            inArray(userRolesTable.userId, participantIds),
            eq(userRolesTable.active, true),
          )
        );

      const targetRoleMap = new Map<string, string>();
      for (const t of targetRoles) targetRoleMap.set(t.userId, t.role);

      for (const pid of participantIds) {
        const role = targetRoleMap.get(pid) as RoleValue | undefined;
        if (!role || !allowed.includes(role)) {
          res.status(403).json({ error: `Não é permitido enviar mensagem para o usuário ${pid}` });
          return;
        }
      }

      const [thread] = await db
        .insert(messageThreadsTable)
        .values({
          orgId,
          title: title.trim(),
          contextType: contextType ?? "DIRECT",
          contextId,
          contextTitle,
          createdBy: userId,
          status: "OPEN",
        })
        .returning();

      const allParticipants: Array<{
        threadId: string;
        userId: string;
        role: "INITIATOR" | "PARTICIPANT";
      }> = [
        { threadId: thread.id, userId, role: "INITIATOR" },
        ...participantIds.map((pid) => ({ threadId: thread.id, userId: pid, role: "PARTICIPANT" as const })),
      ];
      await db.insert(messageThreadParticipantsTable).values(allParticipants);

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;

      writeHistoryEvent({
        category: "MESSAGE",
        action: "thread_created",
        title: `Conversa criada: ${thread.title}`,
        narrative: `${senderName ?? userId} iniciou uma conversa${contextTitle ? ` sobre "${contextTitle}"` : ""}.`,
        entityType: "message_thread",
        entityId: thread.id,
        actorId: userId,
        actorName: senderName,
        orgId,
        metadata: { contextType: thread.contextType, participantCount: participantIds.length },
      }).catch(() => {});

      res.status(201).json({ thread });
    } catch {
      res.status(500).json({ error: "Erro ao criar conversa" });
    }
  }
);

// ─── GET /messages/threads ────────────────────────────────────────────────────

router.get(
  "/messages/threads",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;

      const participations = await db
        .select({
          threadId: messageThreadParticipantsTable.threadId,
          lastReadAt: messageThreadParticipantsTable.lastReadAt,
          role: messageThreadParticipantsTable.role,
        })
        .from(messageThreadParticipantsTable)
        .where(eq(messageThreadParticipantsTable.userId, userId));

      if (participations.length === 0) { res.json({ threads: [] }); return; }

      const threadIds = participations.map((p) => p.threadId);
      const roleMap = new Map(participations.map((p) => [p.threadId, p.role]));

      const threads = await db
        .select()
        .from(messageThreadsTable)
        .where(inArray(messageThreadsTable.id, threadIds))
        .orderBy(desc(messageThreadsTable.createdAt));

      // Fetch unread counts for all threads in a single query
      const unreadRows = await db
        .select({
          threadId: messagesTable.threadId,
          count: sql<number>`count(*)::int`,
        })
        .from(messagesTable)
        .innerJoin(
          messageThreadParticipantsTable,
          and(
            eq(messageThreadParticipantsTable.threadId, messagesTable.threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        )
        .where(
          and(
            inArray(messagesTable.threadId, threadIds),
            or(
              isNull(messageThreadParticipantsTable.lastReadAt),
              gt(messagesTable.createdAt, messageThreadParticipantsTable.lastReadAt),
            )
          )
        )
        .groupBy(messagesTable.threadId);

      const unreadMap = new Map(unreadRows.map((u) => [u.threadId, u.count]));

      const enriched = await Promise.all(
        threads.map(async (t) => {
          const [lastMsg] = await db
            .select({
              id: messagesTable.id,
              content: messagesTable.content,
              senderName: messagesTable.senderName,
              createdAt: messagesTable.createdAt,
            })
            .from(messagesTable)
            .where(eq(messagesTable.threadId, t.id))
            .orderBy(desc(messagesTable.createdAt))
            .limit(1);

          const others = await db
            .select({
              userId: messageThreadParticipantsTable.userId,
              name: usersTable.name,
              role: messageThreadParticipantsTable.role,
            })
            .from(messageThreadParticipantsTable)
            .innerJoin(usersTable, eq(messageThreadParticipantsTable.userId, usersTable.id))
            .where(eq(messageThreadParticipantsTable.threadId, t.id));

          return {
            ...t,
            myRole: roleMap.get(t.id),
            lastMessage: lastMsg ?? null,
            participants: others,
            unreadCount: unreadMap.get(t.id) ?? 0,
          };
        })
      );

      res.json({ threads: enriched });
    } catch {
      res.status(500).json({ error: "Erro ao listar conversas" });
    }
  }
);

// ─── GET /messages/threads/:threadId ─────────────────────────────────────────

router.get(
  "/messages/threads/:threadId",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);

      const [participation] = await db
        .select()
        .from(messageThreadParticipantsTable)
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      if (!participation) { res.status(403).json({ error: "Sem acesso a esta conversa" }); return; }

      const [thread] = await db
        .select()
        .from(messageThreadsTable)
        .where(eq(messageThreadsTable.id, threadId));

      if (!thread) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

      const messages = await db
        .select({
          id: messagesTable.id,
          content: messagesTable.content,
          senderId: messagesTable.senderId,
          senderName: messagesTable.senderName,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .where(eq(messagesTable.threadId, threadId))
        .orderBy(messagesTable.createdAt);

      const participants = await db
        .select({
          userId: messageThreadParticipantsTable.userId,
          name: usersTable.name,
          role: messageThreadParticipantsTable.role,
          lastReadAt: messageThreadParticipantsTable.lastReadAt,
        })
        .from(messageThreadParticipantsTable)
        .innerJoin(usersTable, eq(messageThreadParticipantsTable.userId, usersTable.id))
        .where(eq(messageThreadParticipantsTable.threadId, threadId));

      await db
        .update(messageThreadParticipantsTable)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      res.json({ thread, messages, participants });
    } catch {
      res.status(500).json({ error: "Erro ao buscar conversa" });
    }
  }
);

// ─── POST /messages/threads/:threadId/messages ────────────────────────────────

router.post(
  "/messages/threads/:threadId/messages",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);
      const { content } = req.body as { content: string };

      if (!content?.trim()) { res.status(400).json({ error: "content é obrigatório" }); return; }

      const [participation] = await db
        .select()
        .from(messageThreadParticipantsTable)
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      if (!participation) { res.status(403).json({ error: "Sem acesso a esta conversa" }); return; }

      const [thread] = await db
        .select({ status: messageThreadsTable.status })
        .from(messageThreadsTable)
        .where(eq(messageThreadsTable.id, threadId));

      if (!thread) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
      if (thread.status === "CLOSED") { res.status(400).json({ error: "Esta conversa está encerrada" }); return; }

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;

      const [message] = await db
        .insert(messagesTable)
        .values({
          threadId,
          senderId: userId,
          senderName: senderName ?? null,
          content: content.trim(),
        })
        .returning();

      await db
        .update(messageThreadParticipantsTable)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      res.status(201).json({ message });
    } catch {
      res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
);

// ─── PATCH /messages/threads/:threadId/read ───────────────────────────────────

router.patch(
  "/messages/threads/:threadId/read",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);

      await db
        .update(messageThreadParticipantsTable)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erro ao marcar como lido" });
    }
  }
);

// ─── PATCH /messages/threads/:threadId/close ─────────────────────────────────

router.patch(
  "/messages/threads/:threadId/close",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);

      const senderRole = await getUserRole(userId);
      if (!senderRole) { res.status(403).json({ error: "Papel não encontrado" }); return; }
      if (senderRole === "MEMBER") {
        const isCapitao = await hasOperationalMessagesDelegation(userId);
        if (!isCapitao) {
          res.status(403).json({ error: "Apenas Admin, Supervisor ou Capitão delegado pode encerrar conversas" });
          return;
        }
      }

      const [thread] = await db
        .select()
        .from(messageThreadsTable)
        .where(eq(messageThreadsTable.id, threadId));

      if (!thread) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
      if (thread.status === "CLOSED") { res.status(400).json({ error: "Conversa já encerrada" }); return; }

      const [updated] = await db
        .update(messageThreadsTable)
        .set({ status: "CLOSED", closedAt: new Date() })
        .where(eq(messageThreadsTable.id, threadId))
        .returning();

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;

      writeHistoryEvent({
        category: "MESSAGE",
        action: "thread_closed",
        title: `Conversa encerrada: ${thread.title}`,
        narrative: `${senderName ?? userId} encerrou a conversa.`,
        entityType: "message_thread",
        entityId: threadId,
        actorId: userId,
        actorName: senderName,
        orgId: thread.orgId ?? undefined,
      }).catch(() => {});

      res.json({ thread: updated });
    } catch {
      res.status(500).json({ error: "Erro ao encerrar conversa" });
    }
  }
);

export default router;
