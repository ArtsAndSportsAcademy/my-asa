import { db } from "@workspace/db";
import { usersTable, userRolesTable, isSchedulableMember } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

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
