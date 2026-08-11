import { Router, type IRouter } from "express";
import { eq, and, or, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  userRolesTable,
  operationsTable,
  operationalGroupsTable,
  groupOperationsTable,
  teamMembershipsTable,
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
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      photoUrl: usersTable.photoUrl,
      isPrimary: teamMembershipsTable.isPrimary,
      startsAt: teamMembershipsTable.startsAt,
    })
    .from(teamMembershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, teamMembershipsTable.userId))
    .where(and(eq(teamMembershipsTable.teamId, groupId), eq(teamMembershipsTable.active, true)));

  let allowedUserIds: Set<string> | null = null;
  if (restrictOperationIds) {
    if (restrictOperationIds.length === 0) return [];
    const roleRows = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .where(and(eq(userRolesTable.active, true), inArray(userRolesTable.operationId, restrictOperationIds)));
    allowedUserIds = new Set(roleRows.map((row) => row.userId));
  }
  const map = new Map<string, typeof rows[number]>();
  for (const r of rows) map.set(r.id, r);
  return [...map.values()].filter((member) => !allowedUserIds || allowedUserIds.has(member.id));
}

/**
 * Supervisores ativos (role=SUPERVISOR_A/B) de um grupo, com nome e foto.
 * Usado no detalhe do grupo para listar/remover os supervisores atuais.
 * Se `restrictOperationIds` for informado, retorna apenas supervisores cuja
 * operação (user_roles.operationId) esteja nessa lista — evita vazamento entre
 * operações em grupos amplos (MULTI/ALL) para callers não-admin.
 */
export async function loadGroupSupervisors(groupId: string, restrictOperationIds?: string[]) {
  const conditions = [
    eq(userRolesTable.groupId, groupId),
    eq(userRolesTable.active, true),
    or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
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
export async function loadGroupInOrg(id: string, organizationId: string): Promise<OperationalGroup | null> {
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

// ── Cores reutilizáveis (HTTP + ASA) ─────────────────────────────────────────
// Encapsulam permissão + validação + mutação para que as rotas HTTP e a ASA
// compartilhem exatamente a mesma lógica (evita drift de regras de escopo).

export type GroupActor = { role: string; userId: string; organizationId: string };

export class GroupActionError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GroupActionError";
    this.status = status;
    this.code = code;
  }
}

/** Cria grupo. ADMIN: qualquer escopo. SUPERVISOR: só OPERATION da própria operação. */
export async function createGroupCore(
  actor: GroupActor,
  input: { name?: string; description?: string | null; color?: string; icon?: string; scope?: string; operationId?: string | null; operationIds?: string[]; status?: string },
): Promise<OperationalGroup> {
  const { role, userId: sub, organizationId } = actor;
  const name = input.name;
  const scope: GroupScope = GROUP_SCOPES.includes(input.scope as GroupScope) ? (input.scope as GroupScope) : "OPERATION";
  const operationId = input.operationId ?? undefined;
  const operationIds: string[] = Array.isArray(input.operationIds) ? input.operationIds : [];

  if (!name?.trim()) throw new GroupActionError(400, "BAD_REQUEST", "name é obrigatório");

  const isAdmin = role === "ADMIN";
  const isSupervisor = role === "SUPERVISOR_A" || role === "SUPERVISOR_B";
  if (!isAdmin && !isSupervisor) throw new GroupActionError(403, "FORBIDDEN", "Sem permissão para criar grupos");
  if (scope !== "OPERATION" && !isAdmin) throw new GroupActionError(403, "FORBIDDEN", "Apenas o Admin pode criar grupos amplos");

  const resolvedStatus: GroupStatus = GROUP_STATUSES.includes(input.status as GroupStatus) ? (input.status as GroupStatus) : "ACTIVE";

  if (scope === "OPERATION") {
    if (!operationId) throw new GroupActionError(400, "BAD_REQUEST", "operationId é obrigatório para grupos de operação");
    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, organizationId)),
    });
    if (!operation) throw new GroupActionError(404, "NOT_FOUND", "Operação não encontrada");
    if (isSupervisor) {
      const supOps = await supervisedOperationIds(sub);
      if (!supOps.includes(operationId)) throw new GroupActionError(403, "FORBIDDEN", "Você não supervisiona esta operação");
    }
    if (resolvedStatus === "ACTIVE" && operation.status !== "ACTIVE") {
      throw new GroupActionError(422, "UNPROCESSABLE", "Grupo ativo requer uma operação ativa. A operação atual está " + operation.status);
    }
    const [group] = await db
      .insert(operationalGroupsTable)
      .values({
        organizationId,
        operationId,
        scope: "OPERATION",
        name: name.trim(),
        description: input.description?.trim() || null,
        color: input.color || "#6D4AFF",
        icon: input.icon || "users",
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
    return group!;
  }

  if (scope === "MULTI") {
    const uniqueOps = [...new Set(operationIds.filter(Boolean))];
    if (uniqueOps.length < 1) throw new GroupActionError(400, "BAD_REQUEST", "Selecione ao menos uma operação para o grupo de várias operações");
    const validOps = await db.query.operationsTable.findMany({
      where: and(eq(operationsTable.organizationId, organizationId), inArray(operationsTable.id, uniqueOps)),
    });
    if (validOps.length !== uniqueOps.length) throw new GroupActionError(404, "NOT_FOUND", "Uma ou mais operações não foram encontradas nesta organização");
    const [group] = await db
      .insert(operationalGroupsTable)
      .values({ organizationId, operationId: null, scope: "MULTI", name: name.trim(), description: input.description?.trim() || null, color: input.color || "#6D4AFF", icon: input.icon || "users", status: resolvedStatus })
      .returning();
    await db.insert(groupOperationsTable).values(uniqueOps.map((opId) => ({ groupId: group!.id, operationId: opId })));
    await recordAudit({
      actorId: sub,
      action: "GROUP_CREATED",
      targetResource: `group:${group!.id}`,
      metadata: { name, scope, operationIds: uniqueOps, status: resolvedStatus },
    });
    return group!;
  }

  // scope === "ALL"
  const [group] = await db
    .insert(operationalGroupsTable)
    .values({ organizationId, operationId: null, scope: "ALL", name: name.trim(), description: input.description?.trim() || null, color: input.color || "#6D4AFF", icon: input.icon || "users", status: resolvedStatus })
    .returning();
  await recordAudit({
    actorId: sub,
    action: "GROUP_CREATED",
    targetResource: `group:${group!.id}`,
    metadata: { name, scope, status: resolvedStatus },
  });
  return group!;
}

/** Carrega grupo na org e garante que o ator pode gerenciá-lo (admin tudo; supervisor só OPERATION da sua operação). */
async function loadManageableGroup(actor: GroupActor, id: string): Promise<OperationalGroup> {
  const group = await loadGroupInOrg(id, actor.organizationId);
  if (!group) throw new GroupActionError(404, "NOT_FOUND", "Grupo não encontrado");
  const supOps = actor.role === "ADMIN" ? [] : await supervisedOperationIds(actor.userId);
  if (!canManageGroup(group, actor.role, supOps)) {
    throw new GroupActionError(403, "FORBIDDEN", "Sem permissão para gerenciar este grupo");
  }
  return group;
}

/** Renomeia um grupo. name vazio = no-op (mantém compatibilidade do PATCH HTTP). */
export async function renameGroupCore(actor: GroupActor, id: string, name?: string, description?: string | null, color?: string, icon?: string): Promise<OperationalGroup> {
  await loadManageableGroup(actor, id);
  const updates: Partial<{ name: string; description: string | null; color: string; icon: string; updatedAt: Date }> = { updatedAt: new Date() };
  if (name?.trim()) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (color) updates.color = color;
  if (icon) updates.icon = icon;
  const [updated] = await db
    .update(operationalGroupsTable)
    .set(updates)
    .where(eq(operationalGroupsTable.id, id))
    .returning();
  await recordAudit({ actorId: actor.userId, action: "GROUP_UPDATED", targetResource: `group:${id}` });
  return updated!;
}

/** Altera o status de um grupo (ACTIVE/INACTIVE/ARCHIVED). "Remover" = ARCHIVED. */
export async function setGroupStatusCore(actor: GroupActor, id: string, status: string): Promise<OperationalGroup> {
  if (!GROUP_STATUSES.includes(status as GroupStatus)) {
    throw new GroupActionError(400, "BAD_REQUEST", `status deve ser: ${GROUP_STATUSES.join(", ")}`);
  }
  const group = await loadManageableGroup(actor, id);
  if (status === "ACTIVE" && group.scope === "OPERATION" && group.operationId) {
    const operation = await db.query.operationsTable.findFirst({ where: eq(operationsTable.id, group.operationId) });
    if (operation?.status !== "ACTIVE") {
      throw new GroupActionError(422, "UNPROCESSABLE", "Grupo ativo requer uma operação ativa. A operação está " + (operation?.status ?? "não encontrada"));
    }
  }
  const [updated] = await db
    .update(operationalGroupsTable)
    .set({ status: status as GroupStatus, updatedAt: new Date() })
    .where(eq(operationalGroupsTable.id, id))
    .returning();
  await recordAudit({
    actorId: actor.userId,
    action: "GROUP_UPDATED",
    targetResource: `group:${id}`,
    metadata: { from: group.status, to: status },
  });
  return updated!;
}

/** Adiciona um membro ao grupo, validando a operação coberta. */
export async function addGroupMemberCore(actor: GroupActor, id: string, userId: string, isPrimary = false) {
  if (!userId) throw new GroupActionError(400, "BAD_REQUEST", "userId é obrigatório");
  const group = await loadManageableGroup(actor, id);

  const targetUser = await db.query.usersTable.findFirst({
    where: and(eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId)),
  });
  if (!targetUser) throw new GroupActionError(404, "NOT_FOUND", "Usuário não encontrado na organização");

  const covered = await groupCoveredOperationIds(group, actor.organizationId);
  const targetRoles = await db.query.userRolesTable.findMany({
    where: and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)),
  });
  const targetOps = [...new Set(targetRoles.map((r) => r.operationId))];

  let membershipOperationId: string | undefined;
  if (group.scope === "OPERATION") {
    if (!group.operationId || !targetOps.includes(group.operationId)) {
      throw new GroupActionError(422, "UNPROCESSABLE", "Este usuário não pertence à operação do grupo");
    }
    membershipOperationId = group.operationId;
  } else {
    membershipOperationId = targetOps.find((opId) => covered.includes(opId));
    if (!membershipOperationId) {
      throw new GroupActionError(422, "UNPROCESSABLE", "Este usuário não pertence a nenhuma operação coberta por este grupo");
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
  if (existing) throw new GroupActionError(409, "CONFLICT", "Usuário já é membro deste grupo");

  const existingMembership = await db.query.teamMembershipsTable.findFirst({
    where: and(eq(teamMembershipsTable.userId, userId), eq(teamMembershipsTable.teamId, group.id), eq(teamMembershipsTable.active, true)),
  });
  if (existingMembership) throw new GroupActionError(409, "CONFLICT", "Pessoa ja pertence a esta equipe");

  const activeMemberships = await db.query.teamMembershipsTable.findMany({
    where: and(eq(teamMembershipsTable.userId, userId), eq(teamMembershipsTable.active, true)),
  });
  const shouldBePrimary = isPrimary || activeMemberships.length === 0;
  if (shouldBePrimary) {
    await db.update(teamMembershipsTable)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(teamMembershipsTable.userId, userId), eq(teamMembershipsTable.active, true)));
  }
  await db.insert(teamMembershipsTable).values({
    teamId: group.id,
    userId,
    isPrimary: shouldBePrimary,
    assignedBy: actor.userId,
  });

  const [newRole] = await db
    .insert(userRolesTable)
    .values({ userId, operationId: membershipOperationId, groupId: group.id, role: "MEMBER", active: true })
    .returning();
  await recordAudit({ actorId: actor.userId, action: "MEMBER_ADDED", targetResource: `group:${group.id}:user:${userId}` });
  return { role: newRole!, group };
}

/** Remove (desativa) um membro do grupo. */
export async function removeGroupMemberCore(actor: GroupActor, id: string, userId: string): Promise<OperationalGroup> {
  const group = await loadManageableGroup(actor, id);
  const roleRecord = await db.query.userRolesTable.findFirst({
    where: and(
      eq(userRolesTable.userId, userId),
      eq(userRolesTable.groupId, id),
      eq(userRolesTable.role, "MEMBER"),
      eq(userRolesTable.active, true),
    ),
  });
  if (!roleRecord) throw new GroupActionError(404, "NOT_FOUND", "Membro não encontrado no grupo");
  await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, roleRecord.id));
  await db.update(teamMembershipsTable)
    .set({ active: false, isPrimary: false, endsAt: new Date(), updatedAt: new Date() })
    .where(and(eq(teamMembershipsTable.teamId, id), eq(teamMembershipsTable.userId, userId), eq(teamMembershipsTable.active, true)));
  await recordAudit({ actorId: actor.userId, action: "MEMBER_REMOVED", targetResource: `group:${id}:user:${userId}` });
  return group;
}

/**
 * Lista usuários da organização que já são supervisores (role SUPERVISOR_A/B ativo),
 * para o admin escolher ao adicionar um supervisor a um grupo. Registrado ANTES de
 * "/operational-groups/:id" para não ser capturado como um id.
 */
router.get("/operational-groups/eligible-supervisors", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { organizationId } = req.user!;

  try {
    const rows = await db
      .select({ id: usersTable.id, name: usersTable.name, photoUrl: usersTable.photoUrl })
      .from(userRolesTable)
      .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
      .where(
        and(
          eq(usersTable.organizationId, organizationId),
          eq(usersTable.status, "ACTIVE"),
          eq(userRolesTable.active, true),
          or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
        ),
      );
    const map = new Map<string, { id: string; name: string; photoUrl: string | null }>();
    for (const r of rows) map.set(r.id, r);
    res.json({ supervisors: [...map.values()] });
  } catch (err) {
    log.error({ err }, "Error listing eligible supervisors");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

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
    const supervisors = await loadGroupSupervisors(group.id, memberRestriction);
    res.json({ group: { ...serialized, members, supervisors } });
  } catch (err) {
    log.error({ err }, "Error getting group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;

  try {
    const group = await createGroupCore(
      { role, userId: sub, organizationId },
      {
        name: req.body.name,
        scope: req.body.scope,
        operationId: req.body.operationId,
        operationIds: Array.isArray(req.body.operationIds) ? req.body.operationIds : [],
        status: req.body.status,
        description: req.body.description,
        color: req.body.color,
        icon: req.body.icon,
      },
    );
    log.info({ groupId: group.id, scope: group.scope }, "Group created");
    res.status(201).json({ group: await serializeGroup(group, organizationId) });
  } catch (err) {
    if (err instanceof GroupActionError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    log.error({ err }, "Error creating group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operational-groups/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  try {
    const updated = await renameGroupCore(
      { role, userId: sub, organizationId },
      id,
      req.body.name,
      req.body.description,
      req.body.color,
      req.body.icon,
    );
    res.json({ group: await serializeGroup(updated, organizationId) });
  } catch (err) {
    if (err instanceof GroupActionError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    log.error({ err }, "Error updating group");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operational-groups/:id/status", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  try {
    const updated = await setGroupStatusCore({ role, userId: sub, organizationId }, id, req.body.status);
    res.json({ group: await serializeGroup(updated, organizationId) });
  } catch (err) {
    if (err instanceof GroupActionError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    log.error({ err }, "Error updating group status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operational-groups/:id/members", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  try {
    const { role: newRole } = await addGroupMemberCore(
      { role, userId: sub, organizationId },
      id,
      req.body.userId,
      req.body.isPrimary === true,
    );
    log.info({ groupId: id, userId: req.body.userId }, "Member added to group");
    res.status(201).json({ role: newRole });
  } catch (err) {
    if (err instanceof GroupActionError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
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
    await removeGroupMemberCore({ role, userId: sub, organizationId }, id, userId);
    log.info({ groupId: id, userId }, "Member removed from group");
    res.status(204).send();
  } catch (err) {
    if (err instanceof GroupActionError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
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
