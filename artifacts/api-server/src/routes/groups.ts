import { Router, type IRouter } from "express";
import { eq, and, or, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  userRolesTable,
  operationsTable,
  operationalGroupsTable,
  groupOperationsTable,
} from "@workspace/db";
import type { OperationalGroup } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";

const router: IRouter = Router();

const GROUP_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
type GroupStatus = typeof GROUP_STATUSES[number];

const GROUP_SCOPES = ["OPERATION", "MULTI", "ALL"] as const;
type GroupScope = typeof GROUP_SCOPES[number];

async function getActiveSupervisorsForGroup(groupId: string) {
  return db.query.userRolesTable.findMany({
    where: and(
      eq(userRolesTable.groupId, groupId),
      eq(userRolesTable.active, true),
      or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
    ),
  });
}

/** Operações onde o usuário é supervisor (SUPERVISOR_A/B) ativo. */
export async function supervisedOperationIds(userId: string): Promise<string[]> {
  const rows = await db.query.userRolesTable.findMany({
    where: and(
      eq(userRolesTable.userId, userId),
      eq(userRolesTable.active, true),
      or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
    ),
  });
  return [...new Set(rows.map((r) => r.operationId))];
}

/** Operações que um grupo cobre: OPERATION→a operação dona; MULTI→tabela de cobertura; ALL→todas da org. */
export async function groupCoveredOperationIds(group: OperationalGroup, organizationId: string): Promise<string[]> {
  if (group.scope === "ALL") {
    const ops = await db.query.operationsTable.findMany({
      where: eq(operationsTable.organizationId, organizationId),
    });
    return ops.map((o) => o.id);
  }
  if (group.scope === "MULTI") {
    const rows = await db.query.groupOperationsTable.findMany({
      where: eq(groupOperationsTable.groupId, group.id),
    });
    return rows.map((r) => r.operationId);
  }
  return group.operationId ? [group.operationId] : [];
}

/**
 * Membros ativos (role=MEMBER) de um grupo, com nome e foto.
 * Se `restrictOperationIds` for informado, retorna apenas membros cuja
 * operação "home" (user_roles.operationId) esteja nessa lista — usado para
 * evitar vazamento entre operações em grupos amplos (MULTI/ALL).
 */
export async function loadGroupMembers(groupId: string, restrictOperationIds?: string[]) {
  const conditions = [
    eq(userRolesTable.groupId, groupId),
    eq(userRolesTable.role, "MEMBER"),
    eq(userRolesTable.active, true),
  ];
  if (restrictOperationIds) {
    if (restrictOperationIds.length === 0) return [];
    conditions.push(inArray(userRolesTable.operationId, restrictOperationIds));
  }
  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name, photoUrl: usersTable.photoUrl })
    .from(userRolesTable)
    .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(and(...conditions));
  const map = new Map<string, { id: string; name: string; photoUrl: string | null }>();
  for (const r of rows) map.set(r.id, r);
  return [...map.values()];
}

/** Acrescenta a lista de operações cobertas ao grupo (para o cliente). */
export async function serializeGroup(group: OperationalGroup, organizationId: string) {
  const operationIds = await groupCoveredOperationIds(group, organizationId);
  return { ...group, operationIds };
}

/** Pode gerenciar (criar/editar/status/membros)? Admin tudo; supervisor só grupos OPERATION da sua operação. */
function canManageGroup(group: OperationalGroup, role: string, supOps: string[]): boolean {
  if (role === "ADMIN") return true;
  if (
    (role === "SUPERVISOR_A" || role === "SUPERVISOR_B") &&
    group.scope === "OPERATION" &&
    group.operationId &&
    supOps.includes(group.operationId)
  ) {
    return true;
  }
  return false;
}

/** Carrega um grupo garantindo que pertence à organização do usuário. */
async function loadGroupInOrg(id: string, organizationId: string): Promise<OperationalGroup | null> {
  const group = await db.query.operationalGroupsTable.findFirst({
    where: eq(operationalGroupsTable.id, id),
  });
  if (!group) return null;
  if (group.organizationId) {
    return group.organizationId === organizationId ? group : null;
  }
  if (group.operationId) {
    const op = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, group.operationId), eq(operationsTable.organizationId, organizationId)),
    });
    return op ? group : null;
  }
  return null;
}

router.get("/operational-groups/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  try {
    const group = await loadGroupInOrg(id, organizationId);
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado" });
      return;
    }

    // ADMIN vê todos os membros; supervisor/membro só veem membros das
    // operações que supervisionam (evita vazamento entre operações em grupos amplos).
    let memberRestriction: string[] | undefined;
    if (role !== "ADMIN") {
      const supOps = await supervisedOperationIds(sub);
      const covered = await groupCoveredOperationIds(group, organizationId);
      const supervisorSees = covered.some((opId) => supOps.includes(opId));
      const isMember = await db.query.userRolesTable.findFirst({
        where: and(
          eq(userRolesTable.userId, sub),
          eq(userRolesTable.groupId, group.id),
          eq(userRolesTable.active, true),
        ),
      });
      if (!supervisorSees && !isMember) {
        res.status(403).json({ error: "FORBIDDEN", message: "Grupo fora do escopo" });
        return;
      }
      // Restringe a visão de membros às operações supervisionadas que o grupo cobre.
      memberRestriction = covered.filter((opId) => supOps.includes(opId));
    }

    const serialized = await serializeGroup(group, organizationId);
    const members = await loadGroupMembers(group.id, memberRestriction);
    res.json({ group: { ...serialized, members } });
  } catch (err) {
    log.error({ err }, "Error getting group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const { name, operationId, status } = req.body;
  const operationIds: string[] = Array.isArray(req.body.operationIds) ? req.body.operationIds : [];
  const scope: GroupScope = GROUP_SCOPES.includes(req.body.scope) ? req.body.scope : "OPERATION";

  if (!name?.trim()) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name é obrigatório" });
    return;
  }

  const isAdmin = role === "ADMIN";
  const isSupervisor = role === "SUPERVISOR_A" || role === "SUPERVISOR_B";
  if (!isAdmin && !isSupervisor) {
    res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para criar grupos" });
    return;
  }

  if (scope !== "OPERATION" && !isAdmin) {
    res.status(403).json({ error: "FORBIDDEN", message: "Apenas o Admin pode criar grupos amplos" });
    return;
  }

  const resolvedStatus: GroupStatus = GROUP_STATUSES.includes(status) ? status : "ACTIVE";

  try {
    if (scope === "OPERATION") {
      if (!operationId) {
        res.status(400).json({ error: "BAD_REQUEST", message: "operationId é obrigatório para grupos de operação" });
        return;
      }
      const operation = await db.query.operationsTable.findFirst({
        where: and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, organizationId)),
      });
      if (!operation) {
        res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada" });
        return;
      }
      if (isSupervisor) {
        const supOps = await supervisedOperationIds(sub);
        if (!supOps.includes(operationId)) {
          res.status(403).json({ error: "FORBIDDEN", message: "Você não supervisiona esta operação" });
          return;
        }
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
          organizationId,
          operationId,
          scope: "OPERATION",
          name: (name as string).trim(),
          status: resolvedStatus,
          supervisorId: isSupervisor ? sub : undefined,
        })
        .returning();

      await recordAudit({
        actorId: sub,
        action: "GROUP_CREATED",
        targetResource: `group:${group!.id}`,
        metadata: { name, operationId, scope, status: resolvedStatus },
      });
      log.info({ groupId: group!.id, scope }, "Operation group created");
      res.status(201).json({ group: await serializeGroup(group!, organizationId) });
      return;
    }

    // Grupos amplos (apenas Admin): MULTI ou ALL.
    if (scope === "MULTI") {
      const uniqueOps = [...new Set(operationIds.filter(Boolean))];
      if (uniqueOps.length < 1) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Selecione ao menos uma operação para o grupo de várias operações" });
        return;
      }
      const validOps = await db.query.operationsTable.findMany({
        where: and(
          eq(operationsTable.organizationId, organizationId),
          inArray(operationsTable.id, uniqueOps),
        ),
      });
      if (validOps.length !== uniqueOps.length) {
        res.status(404).json({ error: "NOT_FOUND", message: "Uma ou mais operações não foram encontradas nesta organização" });
        return;
      }

      const [group] = await db
        .insert(operationalGroupsTable)
        .values({
          organizationId,
          operationId: null,
          scope: "MULTI",
          name: (name as string).trim(),
          status: resolvedStatus,
        })
        .returning();

      await db.insert(groupOperationsTable).values(
        uniqueOps.map((opId) => ({ groupId: group!.id, operationId: opId })),
      );

      await recordAudit({
        actorId: sub,
        action: "GROUP_CREATED",
        targetResource: `group:${group!.id}`,
        metadata: { name, scope, operationIds: uniqueOps, status: resolvedStatus },
      });
      log.info({ groupId: group!.id, scope }, "Multi-operation group created");
      res.status(201).json({ group: await serializeGroup(group!, organizationId) });
      return;
    }

    // scope === "ALL"
    const [group] = await db
      .insert(operationalGroupsTable)
      .values({
        organizationId,
        operationId: null,
        scope: "ALL",
        name: (name as string).trim(),
        status: resolvedStatus,
      })
      .returning();

    await recordAudit({
      actorId: sub,
      action: "GROUP_CREATED",
      targetResource: `group:${group!.id}`,
      metadata: { name, scope, status: resolvedStatus },
    });
    log.info({ groupId: group!.id, scope }, "All-operations group created");
    res.status(201).json({ group: await serializeGroup(group!, organizationId) });
  } catch (err) {
    log.error({ err }, "Error creating group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operational-groups/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;
  const { name } = req.body;

  try {
    const group = await loadGroupInOrg(id, organizationId);
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const supOps = role === "ADMIN" ? [] : await supervisedOperationIds(sub);
    if (!canManageGroup(group, role, supOps)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para editar este grupo" });
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
      actorId: sub,
      action: "GROUP_UPDATED",
      targetResource: `group:${id}`,
    });

    res.json({ group: await serializeGroup(updated!, organizationId) });
  } catch (err) {
    log.error({ err }, "Error updating group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operational-groups/:id/status", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;
  const { status } = req.body;

  if (!GROUP_STATUSES.includes(status)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `status deve ser: ${GROUP_STATUSES.join(", ")}` });
    return;
  }

  try {
    const group = await loadGroupInOrg(id, organizationId);
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const supOps = role === "ADMIN" ? [] : await supervisedOperationIds(sub);
    if (!canManageGroup(group, role, supOps)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para alterar este grupo" });
      return;
    }

    if (status === "ACTIVE" && group.scope === "OPERATION" && group.operationId) {
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
      actorId: sub,
      action: "GROUP_UPDATED",
      targetResource: `group:${id}`,
      metadata: { from: group.status, to: status },
    });

    res.json({ group: await serializeGroup(updated!, organizationId) });
  } catch (err) {
    log.error({ err }, "Error updating group status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups/:id/members", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "userId é obrigatório" });
    return;
  }

  try {
    const group = await loadGroupInOrg(id, organizationId);
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado" });
      return;
    }
    const supOps = role === "ADMIN" ? [] : await supervisedOperationIds(sub);
    if (!canManageGroup(group, role, supOps)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para gerenciar membros deste grupo" });
      return;
    }

    const targetUser = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, userId), eq(usersTable.organizationId, organizationId)),
    });
    if (!targetUser) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado na organização" });
      return;
    }

    // Define a operação "home" da associação (user_roles.operation_id é obrigatório).
    const covered = await groupCoveredOperationIds(group, organizationId);
    const targetRoles = await db.query.userRolesTable.findMany({
      where: and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)),
    });
    const targetOps = [...new Set(targetRoles.map((r) => r.operationId))];

    let membershipOperationId: string | undefined;
    if (group.scope === "OPERATION") {
      if (!group.operationId || !targetOps.includes(group.operationId)) {
        res.status(422).json({ error: "UNPROCESSABLE", message: "Este usuário não pertence à operação do grupo" });
        return;
      }
      membershipOperationId = group.operationId;
    } else {
      // Grupos amplos (MULTI/ALL): o membro DEVE pertencer a uma operação coberta pelo grupo.
      membershipOperationId = targetOps.find((opId) => covered.includes(opId));
      if (!membershipOperationId) {
        res.status(422).json({
          error: "UNPROCESSABLE",
          message: "Este usuário não pertence a nenhuma operação coberta por este grupo",
        });
        return;
      }
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
      .values({ userId, operationId: membershipOperationId, groupId: group.id, role: "MEMBER", active: true })
      .returning();

    await recordAudit({
      actorId: sub,
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

router.delete("/operational-groups/:id/members/:userId", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;
  const userId = req.params.userId as string;

  try {
    const group = await loadGroupInOrg(id, organizationId);
    if (!group) {
      res.status(404).json({ error: "NOT_FOUND", message: "Grupo não encontrado" });
      return;
    }
    const supOps = role === "ADMIN" ? [] : await supervisedOperationIds(sub);
    if (!canManageGroup(group, role, supOps)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Sem permissão para gerenciar membros deste grupo" });
      return;
    }

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
      actorId: sub,
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
    const group = await loadGroupInOrg(id, req.user!.organizationId);
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

    // Operação da associação: a operação dona (OPERATION) ou uma operação coberta (amplo).
    const covered = await groupCoveredOperationIds(group, req.user!.organizationId);
    const supervisorOperationId = group.operationId ?? covered[0];
    if (!supervisorOperationId) {
      res.status(422).json({ error: "UNPROCESSABLE", message: "Grupo sem operação para associar o supervisor" });
      return;
    }

    const [newRole] = await db
      .insert(userRolesTable)
      .values({ userId, operationId: supervisorOperationId, groupId: group.id, role: "SUPERVISOR_A", active: true })
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
