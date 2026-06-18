import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  deliveriesTable,
  deliveryAssignmentsTable,
  usersTable,
  userRolesTable,
  operationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN";
const MANAGER_ROLES: RoleValue[] = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserRole(userId: string): Promise<RoleValue | null> {
  const [row] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)))
    .limit(1);
  return (row?.role as RoleValue) ?? null;
}

async function getOperationIdForOrg(organizationId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: operationsTable.id })
    .from(operationsTable)
    .where(eq(operationsTable.organizationId, organizationId))
    .limit(1);
  return row?.id ?? null;
}

// ─── POST /deliveries — Criar entrega ─────────────────────────────────────────

router.post(
  "/deliveries",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;

      const role = await getUserRole(userId);
      if (!role || !MANAGER_ROLES.includes(role)) {
        res.status(403).json({ error: "Sem permissão para criar entregas" });
        return;
      }

      const operationId = await getOperationIdForOrg(orgId);
      if (!operationId) {
        res.status(400).json({ error: "Operação não encontrada para esta organização" });
        return;
      }

      const { title, description, type, content, contentRef, checklistItems, dueDate, maxDueDate } = req.body;

      if (!title || !type || !dueDate || !maxDueDate) {
        res.status(400).json({ error: "Campos obrigatórios: title, type, dueDate, maxDueDate" });
        return;
      }

      const [delivery] = await db
        .insert(deliveriesTable)
        .values({
          creatorId: userId,
          operationId,
          title,
          description: description ?? null,
          type,
          content: content ?? {},
          contentRef: contentRef ?? null,
          checklistItems: checklistItems ?? null,
          dueDate,
          maxDueDate,
          status: "DRAFT",
        })
        .returning();

      writeHistoryEvent({
        category: "DELIVERY",
        action: "delivery.created",
        title: `Entrega criada: ${delivery.title}`,
        narrative: `Entrega do tipo ${delivery.type} criada por ${userId}.`,
        entityType: "delivery",
        entityId: delivery.id,
        actorId: userId,
        orgId,
        operationId,
      }).catch(() => {});

      res.status(201).json({ delivery });
    } catch (err) {
      console.error("[deliveries] POST /deliveries", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET /deliveries — Listar (admin/sup) ─────────────────────────────────────

router.get(
  "/deliveries",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const role = await getUserRole(userId);
      if (!role || !MANAGER_ROLES.includes(role)) {
        res.status(403).json({ error: "Sem permissão" });
        return;
      }

      const orgId = req.user!.organizationId;
      const operationId = await getOperationIdForOrg(orgId);
      if (!operationId) { res.json({ deliveries: [] }); return; }

      const rows = await db
        .select({
          id: deliveriesTable.id,
          title: deliveriesTable.title,
          description: deliveriesTable.description,
          type: deliveriesTable.type,
          status: deliveriesTable.status,
          dueDate: deliveriesTable.dueDate,
          maxDueDate: deliveriesTable.maxDueDate,
          publishedAt: deliveriesTable.publishedAt,
          cancelledAt: deliveriesTable.cancelledAt,
          createdAt: deliveriesTable.createdAt,
          contentRef: deliveriesTable.contentRef,
          creatorId: deliveriesTable.creatorId,
        })
        .from(deliveriesTable)
        .where(eq(deliveriesTable.operationId, operationId))
        .orderBy(desc(deliveriesTable.createdAt));

      res.json({ deliveries: rows });
    } catch (err) {
      console.error("[deliveries] GET /deliveries", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET /deliveries/my — Minhas entregas (member/sup/admin) ──────────────────

router.get(
  "/deliveries/my",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;

      const assignments = await db
        .select({
          id: deliveryAssignmentsTable.id,
          deliveryId: deliveryAssignmentsTable.deliveryId,
          status: deliveryAssignmentsTable.status,
          receivedAt: deliveryAssignmentsTable.receivedAt,
          viewedAt: deliveryAssignmentsTable.viewedAt,
          completedAt: deliveryAssignmentsTable.completedAt,
          expiredAt: deliveryAssignmentsTable.expiredAt,
          checklistProgress: deliveryAssignmentsTable.checklistProgress,
          deliveryTitle: deliveriesTable.title,
          deliveryType: deliveriesTable.type,
          deliveryDescription: deliveriesTable.description,
          deliveryDueDate: deliveriesTable.dueDate,
          deliveryMaxDueDate: deliveriesTable.maxDueDate,
          deliveryStatus: deliveriesTable.status,
          deliveryChecklistItems: deliveriesTable.checklistItems,
          deliveryContentRef: deliveriesTable.contentRef,
          deliveryPublishedAt: deliveriesTable.publishedAt,
        })
        .from(deliveryAssignmentsTable)
        .innerJoin(deliveriesTable, eq(deliveryAssignmentsTable.deliveryId, deliveriesTable.id))
        .where(eq(deliveryAssignmentsTable.userId, userId))
        .orderBy(desc(deliveriesTable.publishedAt));

      res.json({ assignments });
    } catch (err) {
      console.error("[deliveries] GET /deliveries/my", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET /deliveries/:id — Detalhe + progresso ────────────────────────────────

router.get(
  "/deliveries/:id",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const deliveryId = String(req.params.id);

      const [delivery] = await db
        .select()
        .from(deliveriesTable)
        .where(eq(deliveriesTable.id, deliveryId))
        .limit(1);

      if (!delivery) { res.status(404).json({ error: "Entrega não encontrada" }); return; }

      const role = await getUserRole(userId);
      const isManager = role && MANAGER_ROLES.includes(role);

      // Members can only see their own assignments
      const assignmentRows = await db
        .select({
          id: deliveryAssignmentsTable.id,
          userId: deliveryAssignmentsTable.userId,
          status: deliveryAssignmentsTable.status,
          receivedAt: deliveryAssignmentsTable.receivedAt,
          viewedAt: deliveryAssignmentsTable.viewedAt,
          completedAt: deliveryAssignmentsTable.completedAt,
          expiredAt: deliveryAssignmentsTable.expiredAt,
          checklistProgress: deliveryAssignmentsTable.checklistProgress,
          userName: usersTable.name,
          userEmail: usersTable.email,
        })
        .from(deliveryAssignmentsTable)
        .innerJoin(usersTable, eq(deliveryAssignmentsTable.userId, usersTable.id))
        .where(
          isManager
            ? eq(deliveryAssignmentsTable.deliveryId, deliveryId)
            : and(
                eq(deliveryAssignmentsTable.deliveryId, deliveryId),
                eq(deliveryAssignmentsTable.userId, userId)
              )
        );

      res.json({ delivery, assignments: assignmentRows });
    } catch (err) {
      console.error("[deliveries] GET /deliveries/:id", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── POST /deliveries/:id/publish — Publicar ──────────────────────────────────

router.post(
  "/deliveries/:id/publish",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const deliveryId = String(req.params.id);

      const role = await getUserRole(userId);
      if (!role || !MANAGER_ROLES.includes(role)) {
        res.status(403).json({ error: "Sem permissão" });
        return;
      }

      const [delivery] = await db
        .select()
        .from(deliveriesTable)
        .where(eq(deliveriesTable.id, deliveryId))
        .limit(1);

      if (!delivery) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
      if (delivery.status !== "DRAFT") {
        res.status(400).json({ error: "Apenas entregas DRAFT podem ser publicadas" });
        return;
      }

      const { targetUserIds } = req.body as { targetUserIds?: string[] };
      if (!targetUserIds || targetUserIds.length === 0) {
        res.status(400).json({ error: "Informe ao menos um destinatário (targetUserIds)" });
        return;
      }

      const now = new Date();

      // Update delivery status
      const [updated] = await db
        .update(deliveriesTable)
        .set({ status: "PUBLISHED", publishedAt: now, updatedAt: now })
        .where(eq(deliveriesTable.id, deliveryId))
        .returning();

      // Create assignments for each target user
      await db.insert(deliveryAssignmentsTable).values(
        targetUserIds.map((uid) => ({
          deliveryId,
          userId: uid,
          status: "PUBLISHED" as const,
        }))
      ).onConflictDoNothing();

      writeHistoryEvent({
        category: "DELIVERY",
        action: "delivery.published",
        title: `Entrega publicada: ${delivery.title}`,
        narrative: `Entrega publicada para ${targetUserIds.length} destinatário(s).`,
        entityType: "delivery",
        entityId: deliveryId,
        actorId: userId,
        orgId,
        operationId: delivery.operationId,
        metadata: { recipientCount: targetUserIds.length },
      }).catch(() => {});

      res.json({ delivery: updated });
    } catch (err) {
      console.error("[deliveries] POST /deliveries/:id/publish", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── PATCH /deliveries/:id/cancel — Cancelar ─────────────────────────────────

router.patch(
  "/deliveries/:id/cancel",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const deliveryId = String(req.params.id);

      const role = await getUserRole(userId);
      if (!role || !MANAGER_ROLES.includes(role)) {
        res.status(403).json({ error: "Sem permissão" });
        return;
      }

      const [delivery] = await db
        .select()
        .from(deliveriesTable)
        .where(eq(deliveriesTable.id, deliveryId))
        .limit(1);

      if (!delivery) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
      if (delivery.status === "CANCELLED") {
        res.status(400).json({ error: "Entrega já está cancelada" });
        return;
      }

      const now = new Date();
      const [updated] = await db
        .update(deliveriesTable)
        .set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
        .where(eq(deliveriesTable.id, deliveryId))
        .returning();

      writeHistoryEvent({
        category: "DELIVERY",
        action: "delivery.cancelled",
        title: `Entrega cancelada: ${delivery.title}`,
        narrative: `Entrega cancelada por ${userId}.`,
        entityType: "delivery",
        entityId: deliveryId,
        actorId: userId,
        orgId,
        operationId: delivery.operationId,
      }).catch(() => {});

      res.json({ delivery: updated });
    } catch (err) {
      console.error("[deliveries] PATCH /deliveries/:id/cancel", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── POST /deliveries/:id/receive — Marcar como recebida ─────────────────────

router.post(
  "/deliveries/:id/receive",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const deliveryId = String(req.params.id);

      const [assignment] = await db
        .select()
        .from(deliveryAssignmentsTable)
        .where(
          and(
            eq(deliveryAssignmentsTable.deliveryId, deliveryId),
            eq(deliveryAssignmentsTable.userId, userId)
          )
        )
        .limit(1);

      if (!assignment) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }
      if (assignment.status !== "PUBLISHED") {
        res.json({ assignment }); return;
      }

      const now = new Date();
      const [updated] = await db
        .update(deliveryAssignmentsTable)
        .set({ status: "RECEIVED", receivedAt: now, updatedAt: now })
        .where(eq(deliveryAssignmentsTable.id, assignment.id))
        .returning();

      writeHistoryEvent({
        category: "DELIVERY",
        action: "delivery.received",
        title: `Entrega recebida`,
        narrative: `Usuário ${userId} recebeu a entrega ${deliveryId}.`,
        entityType: "delivery_assignment",
        entityId: assignment.id,
        actorId: userId,
        orgId,
      }).catch(() => {});

      res.json({ assignment: updated });
    } catch (err) {
      console.error("[deliveries] POST /deliveries/:id/receive", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── POST /deliveries/:id/view — Marcar como visualizada ─────────────────────

router.post(
  "/deliveries/:id/view",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const deliveryId = String(req.params.id);

      const [assignment] = await db
        .select()
        .from(deliveryAssignmentsTable)
        .where(
          and(
            eq(deliveryAssignmentsTable.deliveryId, deliveryId),
            eq(deliveryAssignmentsTable.userId, userId)
          )
        )
        .limit(1);

      if (!assignment) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }
      if (assignment.status === "VIEWED" || assignment.status === "COMPLETED") {
        res.json({ assignment }); return;
      }

      const now = new Date();
      const [updated] = await db
        .update(deliveryAssignmentsTable)
        .set({ status: "VIEWED", viewedAt: now, updatedAt: now })
        .where(eq(deliveryAssignmentsTable.id, assignment.id))
        .returning();

      writeHistoryEvent({
        category: "DELIVERY",
        action: "delivery.viewed",
        title: `Entrega visualizada`,
        narrative: `Usuário ${userId} visualizou a entrega ${deliveryId}.`,
        entityType: "delivery_assignment",
        entityId: assignment.id,
        actorId: userId,
        orgId,
      }).catch(() => {});

      res.json({ assignment: updated });
    } catch (err) {
      console.error("[deliveries] POST /deliveries/:id/view", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── POST /deliveries/:id/complete — Concluir ────────────────────────────────

router.post(
  "/deliveries/:id/complete",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const deliveryId = String(req.params.id);

      const [assignment] = await db
        .select()
        .from(deliveryAssignmentsTable)
        .where(
          and(
            eq(deliveryAssignmentsTable.deliveryId, deliveryId),
            eq(deliveryAssignmentsTable.userId, userId)
          )
        )
        .limit(1);

      if (!assignment) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }
      if (assignment.status === "COMPLETED") {
        res.json({ assignment }); return;
      }

      const now = new Date();
      const [updated] = await db
        .update(deliveryAssignmentsTable)
        .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
        .where(eq(deliveryAssignmentsTable.id, assignment.id))
        .returning();

      writeHistoryEvent({
        category: "DELIVERY",
        action: "delivery.completed",
        title: `Entrega concluída`,
        narrative: `Usuário ${userId} concluiu a entrega ${deliveryId}.`,
        entityType: "delivery_assignment",
        entityId: assignment.id,
        actorId: userId,
        orgId,
        metadata: { completedAt: now.toISOString() },
      }).catch(() => {});

      res.json({ assignment: updated });
    } catch (err) {
      console.error("[deliveries] POST /deliveries/:id/complete", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── PATCH /deliveries/:id/checklist — Atualizar progresso checklist ──────────

router.patch(
  "/deliveries/:id/checklist",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const deliveryId = String(req.params.id);
      const { progress } = req.body as { progress: Record<string, boolean> };

      if (!progress || typeof progress !== "object") {
        res.status(400).json({ error: "Campo progress obrigatório (objeto {itemId: boolean})" });
        return;
      }

      const [assignment] = await db
        .select()
        .from(deliveryAssignmentsTable)
        .where(
          and(
            eq(deliveryAssignmentsTable.deliveryId, deliveryId),
            eq(deliveryAssignmentsTable.userId, userId)
          )
        )
        .limit(1);

      if (!assignment) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }

      const merged = { ...(assignment.checklistProgress ?? {}), ...progress };

      const now = new Date();
      const [updated] = await db
        .update(deliveryAssignmentsTable)
        .set({ checklistProgress: merged, updatedAt: now })
        .where(eq(deliveryAssignmentsTable.id, assignment.id))
        .returning();

      res.json({ assignment: updated });
    } catch (err) {
      console.error("[deliveries] PATCH /deliveries/:id/checklist", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET /deliveries/:id/members — Listar membros da org para atribuição ──────

router.get(
  "/deliveries/members",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;

      const role = await getUserRole(userId);
      if (!role || !MANAGER_ROLES.includes(role)) {
        res.status(403).json({ error: "Sem permissão" });
        return;
      }

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
            eq(usersTable.organizationId, orgId),
            eq(userRolesTable.active, true)
          )
        )
        .orderBy(usersTable.name);

      res.json({ members });
    } catch (err) {
      console.error("[deliveries] GET /deliveries/members", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

export default router;
