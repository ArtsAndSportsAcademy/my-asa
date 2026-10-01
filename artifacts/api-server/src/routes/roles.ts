import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, userRolesTable, operationsTable, operationalGroupsTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";
import { requireReason } from "../lib/reason.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();

router.get("/users/:id/roles", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { role: requesterRole, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  if ((requesterRole === "MEMBER" || requesterRole === "TRAINER") && id !== sub) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  try {
    const targetUser = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, id), eq(usersTable.organizationId, organizationId)),
    });
    if (!targetUser) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }

    const roles = await db.query.userRolesTable.findMany({
      where: and(eq(userRolesTable.userId, id), eq(userRolesTable.active, true)),
    });
    res.json({ roles });
  } catch (err) {
    log.error({ err }, "Error getting user roles");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/users/:id/roles", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { operationId, groupId, role, reason } = req.body as {
    operationId?: string;
    groupId?: string;
    role?: string;
    reason?: string;
  };
  const VALID_ROLES = ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER", "TRAINER"] as const;

  if (!operationId || !role) {
    res.status(400).json({ error: "BAD_REQUEST", message: "operationId e role são obrigatórios" });
    return;
  }
  if (!role || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    res.status(400).json({ error: "BAD_REQUEST", message: `role deve ser: ${VALID_ROLES.join(", ")}` });
    return;
  }
  const roleValue = role as (typeof VALID_ROLES)[number];
  const roleReason = requireReason(res, reason, "trocar perfil de acesso");
  if (!roleReason) return;

  try {
    const [targetUser, operation] = await Promise.all([
      db.query.usersTable.findFirst({
        where: and(eq(usersTable.id, id), eq(usersTable.organizationId, req.user!.organizationId)),
      }),
      db.query.operationsTable.findFirst({
        where: and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, req.user!.organizationId)),
      }),
    ]);

    if (!targetUser) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada" });
      return;
    }

    if (groupId) {
      const group = await db.query.operationalGroupsTable.findFirst({
        where: and(eq(operationalGroupsTable.id, groupId), eq(operationalGroupsTable.operationId, operationId)),
      });
      if (!group) {
        res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado nessa operação" });
        return;
      }
    }

    const existingRole = await db.query.userRolesTable.findFirst({
      where: and(
        eq(userRolesTable.userId, id),
        eq(userRolesTable.operationId, operationId),
        groupId ? eq(userRolesTable.groupId, groupId) : eq(userRolesTable.role, roleValue),
        eq(userRolesTable.active, true),
      ),
    });
    if (existingRole) {
      res.status(409).json({ error: "CONFLICT", message: "Papel já atribuído" });
      return;
    }

    const [newRole] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(userRolesTable).values({
        userId: id, operationId, groupId: groupId ?? null, role: roleValue, active: true,
      }).returning();
      if (!created) throw new Error("Não foi possível atribuir o perfil");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "role.assigned", title: "Perfil de acesso atribuído",
        narrative: `Perfil ${role} atribuído à pessoa. Motivo: ${roleReason}`,
        entityType: "user_role", entityId: created.id, actorId: req.user!.sub,
        orgId: req.user!.organizationId, operationId, beforeState: null, afterState: created,
        metadata: { reason: roleReason, calculatedReflection: `Perfil ${role} atribuído à pessoa.` },
      }, tx as any);
      return [created] as const;
    });

    log.info({ userId: id, role }, "Role assigned");
    res.status(201).json({ role: newRole });
  } catch (err) {
    log.error({ err }, "Error assigning role");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.delete("/users/:id/roles/:roleId", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const roleId = req.params.roleId as string;
  const reason = req.body?.reason as string | undefined;

  try {
    const roleRecord = await db.query.userRolesTable.findFirst({
      where: and(
        eq(userRolesTable.id, roleId),
        eq(userRolesTable.userId, id),
        eq(userRolesTable.active, true),
      ),
    });
    if (!roleRecord) {
      res.status(404).json({ error: "NOT_FOUND", message: "Papel não encontrado" });
      return;
    }

    const roleReason = requireReason(res, reason, "trocar perfil de acesso");
    if (!roleReason) return;

    if (roleRecord.role === "ADMIN") {
      const orgUsers = await db.query.usersTable.findMany({
        where: eq(usersTable.organizationId, req.user!.organizationId),
      });
      const orgUserIds = orgUsers.map((u) => u.id);

      const adminRoles = await db.query.userRolesTable.findMany({
        where: and(
          inArray(userRolesTable.userId, orgUserIds),
          eq(userRolesTable.role, "ADMIN"),
          eq(userRolesTable.active, true),
        ),
      });

      if (adminRoles.length <= 1) {
        res.status(409).json({
          error: "CONFLICT",
          message: "Não é possível remover o último administrador ativo da organização",
        });
        return;
      }
    }

    await db.transaction(async (tx) => {
      const [updated] = await tx.update(userRolesTable)
        .set({ active: false })
        .where(and(eq(userRolesTable.id, roleId), eq(userRolesTable.active, true)))
        .returning();
      if (!updated) throw new Error("Papel já foi removido");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "role.removed", title: "Perfil de acesso removido",
        narrative: `Perfil ${roleRecord.role} removido da pessoa. Motivo: ${roleReason}`,
        entityType: "user_role", entityId: roleId, actorId: req.user!.sub,
        orgId: req.user!.organizationId, operationId: roleRecord.operationId,
        beforeState: roleRecord, afterState: updated,
        metadata: { reason: roleReason, calculatedReflection: `Perfil ${roleRecord.role} removido da pessoa.` },
      }, tx as any);
    });

    log.info({ userId: id, roleId }, "Role removed");
    res.status(204).send();
  } catch (err) {
    log.error({ err }, "Error removing role");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
