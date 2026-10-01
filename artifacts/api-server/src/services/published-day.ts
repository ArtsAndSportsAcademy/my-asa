import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, scalesTable, scaleAllocationsTable, operationsTable, usersTable } from "@workspace/db";
import { resolveScaleAllocations } from "./scale-merge.js";

/** Reuses the accepted scale composition (books, activities and Agenda), without modifying it. */
export async function publishedDay(date: string, organizationId?: string) {
  const scales = await db.select({ scale: scalesTable, organizationId: operationsTable.organizationId }).from(scalesTable).innerJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id))
    .where(and(organizationId ? eq(operationsTable.organizationId, organizationId) : undefined, eq(operationsTable.status, "ACTIVE"), inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), lte(scalesTable.periodStart, date), gte(scalesTable.periodEnd, date)));
  const result = [];
  for (const scope of scales) {
    const [composed, inactive] = await Promise.all([
      resolveScaleAllocations({ ...scope.scale, periodStart: date, periodEnd: date }),
      db.select({ id: scaleAllocationsTable.id }).from(scaleAllocationsTable).where(and(eq(scaleAllocationsTable.scaleId, scope.scale.id), eq(scaleAllocationsTable.active, false))),
    ]);
    const disabled = new Set(inactive.map(row => row.id));
    const ids = [...new Set(composed.map(row => row.userId).filter((id): id is string => Boolean(id)))];
    const people = ids.length ? await db.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable).where(and(eq(usersTable.organizationId, scope.organizationId), inArray(usersTable.id, ids))) : [];
    const validPeople = new Map(people.map(person => [person.id, person]));
    const entries = composed.filter(row => !disabled.has(row.id) && (row.manualDate ?? row.eventDate) === date && (!row.userId || validPeople.has(row.userId)))
      .filter(row => !scope.scale.areaId || !row.userId || validPeople.get(row.userId)?.areaId === scope.scale.areaId)
      .map(row => ({ id: row.id, personId: row.userId, name: row.userName ?? "Lacuna", label: row.manualLabel ?? row.eventTitle ?? scope.scale.title, scale: scope.scale.title, startTime: row.startTime ?? row.eventStartTime, endTime: row.endTime ?? row.eventEndTime, status: row.status }));
    result.push({ ...scope, entries });
  }
  return result;
}
