import { and, count, eq, inArray } from "drizzle-orm";
import {
  characterCastTable,
  charactersTable,
  db,
  isSchedulableMember,
  rotationDailyAdvancesTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import { getUnavailableUserIds } from "./line-resolver.js";

export async function resolveCharacterForDate(input: {
  characterId: string;
  operationId: string;
  date: string;
}) {
  const [character] = await db.select().from(charactersTable).where(and(
    eq(charactersTable.id, input.characterId),
    eq(charactersTable.active, true),
  )).limit(1);
  if (!character) return null;

  const cast = await db
    .select({
      castId: characterCastTable.id,
      personId: characterCastTable.personId,
      order: characterCastTable.order,
      timesDone: characterCastTable.timesDone,
      name: usersTable.name,
      specialization: usersTable.specialization,
      status: usersTable.status,
      personStatus: usersTable.personStatus,
    })
    .from(characterCastTable)
    .innerJoin(usersTable, eq(characterCastTable.personId, usersTable.id))
    .where(and(eq(characterCastTable.characterId, character.id), eq(characterCastTable.active, true)))
    .orderBy(characterCastTable.order, characterCastTable.id);

  const ids = cast.map((member) => member.personId);
  const [unavailable, adminRows, ledger] = await Promise.all([
    getUnavailableUserIds(input.operationId, input.date),
    ids.length > 0
      ? db.select({ userId: userRolesTable.userId }).from(userRolesTable).where(and(
        inArray(userRolesTable.userId, ids), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true),
      ))
      : Promise.resolve([] as { userId: string }[]),
    ids.length > 0
      ? db.select({ userId: rotationDailyAdvancesTable.userId, total: count() })
        .from(rotationDailyAdvancesTable)
        .where(and(eq(rotationDailyAdvancesTable.characterId, character.id), inArray(rotationDailyAdvancesTable.userId, ids)))
        .groupBy(rotationDailyAdvancesTable.userId)
      : Promise.resolve([] as { userId: string; total: number }[]),
  ]);
  const adminIds = new Set(adminRows.map((row) => row.userId));
  const ledgerCounts = new Map(ledger.map((row) => [row.userId, Number(row.total)]));
  const candidates = cast.map((member) => ({
    ...member,
    currentCount: Math.max(member.timesDone, ledgerCounts.get(member.personId) ?? 0),
    available: member.status === "ACTIVE" && member.personStatus === "ACTIVE" && !unavailable.has(member.personId) && isSchedulableMember({
      isAdmin: adminIds.has(member.personId), specialization: member.specialization,
    }),
  }));

  const available = candidates.filter((member) => member.available);
  const chosen = character.mode === "titular"
    ? available.find((member) => member.order === 0) ?? available[0] ?? null
    : [...available].sort((a, b) => (a.currentCount - b.currentCount) || (a.order - b.order))[0] ?? null;

  return {
    character,
    selected: chosen ? {
      personId: chosen.personId, name: chosen.name, order: chosen.order,
      timesDone: chosen.timesDone, currentCount: chosen.currentCount,
    } : null,
    cast: candidates.map(({ castId: _castId, specialization: _specialization, ...member }) => member),
  };
}
