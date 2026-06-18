import { Router, type IRouter } from "express";
import { eq, and, or, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, userRolesTable, operationsTable, operationalGroupsTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";

const router: IRouter = Router();

const GROUP_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
type GroupStatus = typeof GROUP_STATUSES[number];

async function getActiveSupervisorsForGroup(groupId: string) {
  return db.query.userRolesTable.findMany({
    where: and(
      eq(userRolesTable.groupId, groupId),
      eq(userRolesTable.active, true),
      or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
    ),
  });
}

router.get("/operational-groups/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  try {
    const group = await db.query.operationalGroupsTable.findFirst({
      where: eq(operationalGroupsTable.id, id),
    });
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado" });
      return;
    }

    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, group.operationId), eq(operationsTable.organizationId, organizationId)),
    });
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado nesta organização" });
      return;
    }

    if (role !== "ADMIN") {
      const myRole = await db.query.userRolesTable.findFirst({
        where: and(
          eq(userRolesTable.userId, sub),
          eq(userRolesTable.groupId, group.id),
          eq(userRolesTable.active, true),
        ),
      });
      if (!myRole) {
        res.status(403).json({ error: "FORBIDDEN", message: "Grupo fora do escopo" });
        return;
      }
    }

    res.json({ group });
  } catch (err) {
    log.error({ err }, "Error getting group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { name, operationId, status } = req.body;

  if (!name?.trim() || !operationId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name e operationId são obrigatórios" });
    return;
  }

  const resolvedStatus: GroupStatus = GROUP_STATUSES.includes(status) ? status : "ACTIVE";

  try {
    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, req.user!.organizationId)),
    });
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada" });
      return;
    }

    if (resolvedStatus === "ACTIVE" && operation.status !== "ACTIVE") {
      res.status(422).json({
        error: "UNPROCESSABLE",
        message: "Grupo ativo requer uma operação ativa. A operação atual está " + operation.status,
      });
      return;
    }

    const [group] = await db
      .insert(operationalGroupsTable)
      .values({
        operationId,
        name: (name as string).trim(),
        status: resolvedStatus,
      })
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "GROUP_CREATED",
      targetResource: `group:${group!.id}`,
      metadata: { name, operationId, status: resolvedStatus },
    });

    log.info({ groupId: group!.id }, "Group created");
    res.status(201).json({ group });
  } catch (err) {
    log.error({ err }, "Error creating group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operational-groups/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { name } = req.body;

  try {
    const group = await db.query.operationalGroupsTable.findFirst({
      where: eq(operationalGroupsTable.id, id),
    });
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    const updates: Partial<{ name: string; updatedAt: Date }> = { updatedAt: new Date() };
    if (name?.trim()) updates.name = (name as string).trim();

    const [updated] = await db
      .update(operationalGroupsTable)
      .set(updates)
      .where(eq(operationalGroupsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "GROUP_UPDATED",
      targetResource: `group:${id}`,
    });

    res.json({ group: updated });
  } catch (err) {
    log.error({ err }, "Error updating group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operational-groups/:id/status", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { status } = req.body;

  if (!GROUP_STATUSES.includes(status)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `status deve ser: ${GROUP_STATUSES.join(", ")}` });
    return;
  }

  try {
    const group = await db.query.operationalGroupsTable.findFirst({
      where: eq(operationalGroupsTable.id, id),
    });
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    if (status === "ACTIVE") {
      const operation = await db.query.operationsTable.findFirst({
        where: eq(operationsTable.id, group.operationId),
      });
      if (operation?.status !== "ACTIVE") {
        res.status(422).json({
          error: "UNPROCESSABLE",
          message: "Grupo ativo requer uma operação ativa. A operação está " + (operation?.status ?? "não encontrada"),
        });
        return;
      }
    }

    const [updated] = await db
      .update(operationalGroupsTable)
      .set({ status: status as GroupStatus, updatedAt: new Date() })
      .where(eq(operationalGroupsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "GROUP_UPDATED",
      targetResource: `group:${id}`,
      metadata: { from: group.status, to: status },
    });

    res.json({ group: updated });
  } catch (err) {
    log.error({ err }, "Error updating group status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups/:id/members", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "userId é obrigatório" });
    return;
  }

  try {
    const group = await db.query.operationalGroupsTable.findFirst({
      where: eq(operationalGroupsTable.id, id),
    });
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado" });
      return;
    }

    const targetUser = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, userId), eq(usersTable.organizationId, req.user!.organizationId)),
    });
    if (!targetUser) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado na organização" });
      return;
    }

    const existing = await db.query.userRolesTable.findFirst({
      where: and(
        eq(userRolesTable.userId, userId),
        eq(userRolesTable.groupId, group.id),
        eq(userRolesTable.role, "MEMBER"),
        eq(userRolesTable.active, true),
      ),
    });
    if (existing) {
      res.status(409).json({ error: "CONFLICT", message: "Usuário já é membro deste grupo" });
      return;
    }

    const [newRole] = await db
      .insert(userRolesTable)
      .values({ userId, operationId: group.operationId, groupId: group.id, role: "MEMBER", active: true })
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "MEMBER_ADDED",
      targetResource: `group:${group.id}:user:${userId}`,
    });

    log.info({ groupId: group.id, userId }, "Member added to group");
    res.status(201).json({ role: newRole });
  } catch (err) {
    log.error({ err }, "Error adding member");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.delete("/operational-groups/:id/members/:userId", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const userId = req.params.userId as string;

  try {
    const roleRecord = await db.query.userRolesTable.findFirst({
      where: and(
        eq(userRolesTable.userId, userId),
        eq(userRolesTable.groupId, id),
        eq(userRolesTable.role, "MEMBER"),
        eq(userRolesTable.active, true),
      ),
    });
    if (!roleRecord) {
      res.status(404).json({ error: "NOT_FOUND", message: "Membro não encontrado no grupo" });
      return;
    }

    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, roleRecord.id));

    await recordAudit({
      actorId: req.user!.sub,
      action: "MEMBER_REMOVED",
      targetResource: `group:${id}:user:${userId}`,
    });

    log.info({ groupId: id, userId }, "Member removed from group");
    res.status(204).send();
  } catch (err) {
    log.error({ err }, "Error removing member");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups/:id/supervisors", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "userId é obrigatório" });
    return;
  }

  try {
    const group = await db.query.operationalGroupsTable.findFirst({
      where: eq(operationalGroupsTable.id, id),
    });
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado" });
      return;
    }

    const targetUser = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, userId), eq(usersTable.organizationId, req.user!.organizationId)),
    });
    if (!targetUser) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado na organização" });
      return;
    }

    const existing = await db.query.userRolesTable.findFirst({
      where: and(
        eq(userRolesTable.userId, userId),
        eq(userRolesTable.groupId, group.id),
        or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
        eq(userRolesTable.active, true),
      ),
    });
    if (existing) {
      res.status(409).json({ error: "CONFLICT", message: "Usuário já é supervisor deste grupo" });
      return;
    }

    const [newRole] = await db
      .insert(userRolesTable)
      .values({ userId, operationId: group.operationId, groupId: group.id, role: "SUPERVISOR_A", active: true })
      .returning();

    if (!group.supervisorId) {
      await db.update(operationalGroupsTable).set({ supervisorId: userId }).where(eq(operationalGroupsTable.id, group.id));
    }

    await recordAudit({
      actorId: req.user!.sub,
      action: "ROLE_ASSIGNED",
      targetResource: `group:${group.id}:supervisor:${userId}`,
    });

    log.info({ groupId: group.id, userId }, "Supervisor added to group");
    res.status(201).json({ role: newRole });
  } catch (err) {
    log.error({ err }, "Error adding supervisor");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.delete("/operational-groups/:id/supervisors/:userId", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const userId = req.params.userId as string;

  try {
    const roleRecord = await db.query.userRolesTable.findFirst({
      where: and(
        eq(userRolesTable.userId, userId),
        eq(userRolesTable.groupId, id),
        or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
        eq(userRolesTable.active, true),
      ),
    });
    if (!roleRecord) {
      res.status(404).json({ error: "NOT_FOUND", message: "Supervisor não encontrado no grupo" });
      return;
    }

    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, roleRecord.id));

    const remaining = await getActiveSupervisorsForGroup(id);
    if (remaining.length === 0) {
      await db
        .update(operationalGroupsTable)
        .set({ supervisorId: null, updatedAt: new Date() })
        .where(eq(operationalGroupsTable.id, id));
    } else if (remaining[0]) {
      await db
        .update(operationalGroupsTable)
        .set({ supervisorId: remaining[0].userId, updatedAt: new Date() })
        .where(eq(operationalGroupsTable.id, id));
    }

    await recordAudit({
      actorId: req.user!.sub,
      action: "ROLE_REMOVED",
      targetResource: `group:${id}:supervisor:${userId}`,
    });

    log.info({ groupId: id, userId, remainingSupervisors: remaining.length }, "Supervisor removed from group");

    const response: Record<string, unknown> = { success: true };
    if (remaining.length === 0) {
      response.warning = "Grupo ficou sem supervisor ativo";
    }

    res.json(response);
  } catch (err) {
    log.error({ err }, "Error removing supervisor");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
