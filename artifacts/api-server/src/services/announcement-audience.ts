import { and, eq, inArray, ne } from "drizzle-orm";
import {
  announcementReadsTable,
  announcementRecipientsTable,
  areaLocalSupervisorsTable,
  db,
  scaleAllocationsTable,
  scalesTable,
  usersTable,
} from "@workspace/db";

// Público de um aviso (desenho 22: "41 de 58 deram ciente" e "quem falta").
// É a mesma regra de leitura de announcement-access, vista do lado de quem recebe:
// a casa toda, as pessoas da área, quem está escalado no local (e a supervisão
// designada para ele) ou as pessoas escolhidas. Quem publicou não conta.
export type AudiencePost = { id: string; orgId: string; authorId: string; scope: "HOUSE" | "AREA" | "LOCATION" | "PEOPLE"; areaId: string | null; locationId: string | null };
export type AudienceSummary = { total: number; confirmados: number; faltam: { id: string; name: string }[] };

async function audienceIds(post: AudiencePost): Promise<string[]> {
  const active = and(eq(usersTable.organizationId, post.orgId), eq(usersTable.status, "ACTIVE"), ne(usersTable.id, post.authorId));
  if (post.scope === "HOUSE") return (await db.select({ id: usersTable.id }).from(usersTable).where(active)).map((row) => row.id);
  if (post.scope === "AREA") {
    if (!post.areaId) return [];
    return (await db.select({ id: usersTable.id }).from(usersTable).where(and(active, eq(usersTable.areaId, post.areaId)))).map((row) => row.id);
  }
  if (post.scope === "PEOPLE") {
    const rows = await db.select({ id: usersTable.id }).from(announcementRecipientsTable)
      .innerJoin(usersTable, eq(announcementRecipientsTable.userId, usersTable.id))
      .where(and(eq(announcementRecipientsTable.announcementId, post.id), active));
    return rows.map((row) => row.id);
  }
  if (!post.locationId) return [];
  const [allocated, supervisors] = await Promise.all([
    db.selectDistinct({ id: usersTable.id }).from(scaleAllocationsTable)
      .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
      .innerJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
      .where(and(active, eq(scaleAllocationsTable.active, true), eq(scalesTable.locationId, post.locationId), inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]))),
    db.selectDistinct({ id: usersTable.id }).from(areaLocalSupervisorsTable)
      .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
      .where(and(active, eq(areaLocalSupervisorsTable.locationId, post.locationId), eq(areaLocalSupervisorsTable.active, true))),
  ]);
  return [...new Set([...allocated, ...supervisors].map((row) => row.id))];
}

export async function announcementAudience(post: AudiencePost): Promise<AudienceSummary> {
  const ids = await audienceIds(post);
  if (!ids.length) return { total: 0, confirmados: 0, faltam: [] };
  const [people, confirmed] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, ids)).orderBy(usersTable.name),
    db.select({ userId: announcementReadsTable.userId, confirmedAt: announcementReadsTable.confirmedAt }).from(announcementReadsTable)
      .where(and(eq(announcementReadsTable.announcementId, post.id), inArray(announcementReadsTable.userId, ids))),
  ]);
  const done = new Set(confirmed.filter((row) => row.confirmedAt).map((row) => row.userId));
  return { total: ids.length, confirmados: done.size, faltam: people.filter((person) => !done.has(person.id)) };
}
