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
import { notifyMany } from "../services/notificationService.js";

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN" | "DIRECTOR" | "DIR";

const router: IRouter = Router();

// ─── Permission matrix (MSG-D03) ──────────────────────────────────────────────
const ALLOWED_TARGETS: Record<RoleValue, RoleValue[]> = {
  MEMBER:       ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
  // note: MEMBER com OPERATIONAL_MESSAGES ganha acesso estendido — ver hasOperationalMessagesDelegation
  SUPERVISOR_A: ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
  SUPERVISOR_B: ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
  ADMIN:        ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN"],
  DIRECTOR:     ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN", "DIRECTOR", "DIR"],
  DIR:          ["MEMBER", "SUPERVISOR_A", "SUPERVISOR_B", "ADMIN", "DIRECTOR", "DIR"],
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
        or(isNull(delegationsTable.validUntil), gte(delegationsTable.validUntil, now)),
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

      // Conversa direta é uma exceção consciente à hierarquia operacional:
      // qualquer pessoa pode falar com qualquer colega da mesma organização.
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
            eq(usersTable.organizationId, req.user!.organizationId),
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

      const targets = await db.select({ id: usersTable.id }).from(usersTable).where(and(inArray(usersTable.id, participantIds), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
      if (new Set(targets.map((target) => target.id)).size !== new Set(participantIds).size) { res.status(403).json({ error: "Destinatário fora da organização ou inativo" }); return; }

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;
      const thread = await db.transaction(async (tx) => {
        const [created] = await tx
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
          { threadId: created!.id, userId, role: "INITIATOR" },
          ...participantIds.map((pid) => ({ threadId: created!.id, userId: pid, role: "PARTICIPANT" as const })),
        ];
        await tx.insert(messageThreadParticipantsTable).values(allParticipants);
        await writeHistoryEvent({
          category: "MESSAGE",
          action: "thread_created",
          title: `Conversa criada: ${created!.title}`,
          narrative: `${senderName ?? userId} iniciou uma conversa${contextTitle ? ` sobre "${contextTitle}"` : ""}.`,
          entityType: "message_thread",
          entityId: created!.id,
          actorId: userId,
          actorName: senderName,
          orgId,
          afterState: { status: created!.status, participantIds },
          metadata: { contextType: created!.contextType, participantCount: participantIds.length },
        }, tx as any);
        return created!;
      });

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

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;

      const result = await db.transaction(async (tx) => {
        const [thread] = await tx.select({ status: messageThreadsTable.status })
          .from(messageThreadsTable).where(eq(messageThreadsTable.id, threadId)).for("update");
        if (!thread) return { status: "not_found" as const };
        if (thread.status === "CLOSED") return { status: "closed" as const };
        const [created] = await tx.insert(messagesTable).values({
          threadId,
          senderId: userId,
          senderName: senderName ?? null,
          content: content.trim(),
        })
        .returning();
        await writeHistoryEvent({ category: "MESSAGE", action: "message_sent", title: "Mensagem enviada", narrative: content.trim().slice(0, 120), entityType: "message", entityId: created!.id, actorId: userId, actorName: senderName, orgId: req.user!.organizationId, afterState: created }, tx as any);
        return { status: "created" as const, message: created! };
      });

      if (result.status === "not_found") { res.status(404).json({ error: "Conversa não encontrada" }); return; }
      if (result.status === "closed") { res.status(400).json({ error: "Esta conversa está encerrada" }); return; }
      const message = result.message;

      await db
        .update(messageThreadParticipantsTable)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      // notify other thread participants
      (async () => {
        const participants = await db
          .select({ userId: messageThreadParticipantsTable.userId })
          .from(messageThreadParticipantsTable)
          .where(eq(messageThreadParticipantsTable.threadId, threadId));
        const otherUserIds = participants
          .map((p) => p.userId)
          .filter((uid) => uid !== userId);
        await notifyMany(otherUserIds, {
          type: "message.new",
          title: "Nova mensagem",
          message: `${senderName ?? "Alguém"}: ${content.trim().slice(0, 80)}${content.trim().length > 80 ? "…" : ""}`,
          priority: "NORMAL",
          category: "message",
          entityType: "thread",
          entityId: threadId,
          actionUrl: `/(tabs)/mensagens`,
        });
      })().catch(() => {});

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

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;
      const updated = await db.transaction(async (tx) => {
        const [persisted] = await tx
          .update(messageThreadsTable)
          .set({ status: "CLOSED", closedAt: new Date() })
          .where(eq(messageThreadsTable.id, threadId))
          .returning();
        await writeHistoryEvent({
          category: "MESSAGE",
          action: "thread_closed",
          title: `Conversa encerrada: ${thread.title}`,
          narrative: `${senderName ?? userId} encerrou a conversa.`,
          entityType: "message_thread",
          entityId: threadId,
          actorId: userId,
          actorName: senderName,
          orgId: thread.orgId ?? undefined,
          beforeState: { status: thread.status },
          afterState: { status: persisted!.status },
        }, tx as any);
        return persisted!;
      });

      res.json({ thread: updated });
    } catch {
      res.status(500).json({ error: "Erro ao encerrar conversa" });
    }
  }
);

export default router;
