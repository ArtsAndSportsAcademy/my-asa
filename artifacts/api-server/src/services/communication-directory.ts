import { and, eq, ilike, or } from "drizzle-orm";
import { db, areasTable, usersTable } from "@workspace/db";

export function listCommunicationPeople(organizationId: string, query?: string, limit?: number) {
  const filters = [eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE")];
  const term = query?.trim().slice(0, 120);
  if (term) {
    const escaped = term.replace(/[\\%_]/g, "\\$&");
    filters.push(or(ilike(usersTable.name, `%${escaped}%`), ilike(areasTable.name, `%${escaped}%`))!);
  }
  const people = db.select({ id: usersTable.id, name: usersTable.name, areaName: areasTable.name })
    .from(usersTable)
    .leftJoin(areasTable, eq(usersTable.areaId, areasTable.id))
    .where(and(...filters))
    .orderBy(usersTable.name);
  return limit ? people.limit(Math.min(Math.max(Math.floor(limit), 1), 20)) : people;
}
