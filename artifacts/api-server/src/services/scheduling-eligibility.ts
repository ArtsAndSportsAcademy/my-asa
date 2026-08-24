import { db } from "@workspace/db";
import {
  usersTable, userRolesTable, operationsTable, operationalGroupsTable,
  groupOperationsTable, teamMembershipsTable, isSchedulableMember,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export interface SchedulableOperationMember {
  id: string;
  name: string;
  status: "ACTIVE";
  specialization: string | null;
  teamIds: string[];
  primaryTeamId: string | null;
}

/** Resolve o elenco pela Equipe da ASA; papéis ficam restritos a acesso. */
export async function loadSchedulableOperationMembers(
  operationId: string,
  teamId?: string,
): Promise<SchedulableOperationMember[]> {
  const operation = await db.query.operationsTable.findFirst({
    where: eq(operationsTable.id, operationId),
  });
  if (!operation) return [];

  const memberships = await db
    .select({
      userId: usersTable.id, name: usersTable.name,
      personStatus: usersTable.personStatus, specialization: usersTable.specialization,
      teamId: teamMembershipsTable.teamId, isPrimary: teamMembershipsTable.isPrimary,
      startsAt: teamMembershipsTable.startsAt, endsAt: teamMembershipsTable.endsAt,
      teamStatus: operationalGroupsTable.status, teamScope: operationalGroupsTable.scope,
      ownerOperationId: operationalGroupsTable.operationId,
      coveredOperationId: groupOperationsTable.operationId,
    })
    .from(teamMembershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, teamMembershipsTable.userId))
    .innerJoin(operationalGroupsTable, eq(operationalGroupsTable.id, teamMembershipsTable.teamId))
    .leftJoin(groupOperationsTable, eq(groupOperationsTable.groupId, operationalGroupsTable.id))
    .where(and(
      eq(teamMembershipsTable.active, true),
      eq(usersTable.organizationId, operation.organizationId),
      ...(teamId ? [eq(teamMembershipsTable.teamId, teamId)] : []),
    ));

  const now = new Date();
  const covered = memberships.filter((row) => {
    if (row.personStatus !== "ACTIVE" || row.teamStatus !== "ACTIVE") return false;
    if (row.startsAt > now || (row.endsAt && row.endsAt < now)) return false;
    if (row.teamScope === "ALL") return true;
    if (row.teamScope === "MULTI") return row.coveredOperationId === operationId;
    return row.ownerOperationId === operationId;
  });
  if (covered.length === 0) return [];

  const userIds = [...new Set(covered.map((row) => row.userId))];
  const adminRows = await db.select({ userId: userRolesTable.userId })
    .from(userRolesTable)
    .where(and(inArray(userRolesTable.userId, userIds), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true)));
  const admins = new Set(adminRows.map((row) => row.userId));
  const result = new Map<string, SchedulableOperationMember>();

  for (const row of covered) {
    if (!isSchedulableMember({ isAdmin: admins.has(row.userId), specialization: row.specialization })) continue;
    const member = result.get(row.userId) ?? {
      id: row.userId, name: row.name, status: "ACTIVE", specialization: row.specialization,
      teamIds: [], primaryTeamId: null,
    };
    if (!member.teamIds.includes(row.teamId)) member.teamIds.push(row.teamId);
    if (row.isPrimary) member.primaryTeamId = row.teamId;
    result.set(row.userId, member);
  }
  return [...result.values()];
}

/**
 * Dado um conjunto de userIds, retorna os que NÃO são escaláveis — administradores
 * (papel ADMIN ativo) ou membros especiais (specialization preenchida e != PERFORMER).
 * Esses não fazem parte do elenco escalável e não devem aparecer em escalas/folgas.
 * Usar como filtro de EXIBIÇÃO (não apaga dados gravados).
 */
export async function getNonSchedulableUserIds(userIds: (string | null | undefined)[]): Promise<Set<string>> {
  const result = new Set<string>();
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return result;

  const uRows = await db
    .select({ id: usersTable.id, specialization: usersTable.specialization })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  const specMap = new Map(uRows.map((u) => [u.id, u.specialization]));

  const adminRows = await db
    .select({ userId: userRolesTable.userId })
    .from(userRolesTable)
    .where(and(
      inArray(userRolesTable.userId, ids),
      eq(userRolesTable.role, "ADMIN"),
      eq(userRolesTable.active, true),
    ));
  const adminSet = new Set(adminRows.map((r) => r.userId));

  for (const id of ids) {
    if (!isSchedulableMember({ isAdmin: adminSet.has(id), specialization: specMap.get(id) ?? null })) {
      result.add(id);
    }
  }
  return result;
}
