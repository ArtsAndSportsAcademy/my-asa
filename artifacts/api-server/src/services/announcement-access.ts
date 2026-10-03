import { and, eq, inArray } from "drizzle-orm";
import {
  announcementRecipientsTable,
  areaLocalSupervisorsTable,
  areasTable,
  db,
  scaleAllocationsTable,
  scalesTable,
  usersTable,
} from "@workspace/db";

export type AnnouncementActor = { userId: string; organizationId: string; role: string };
// id e authorId são opcionais para quem chama sem eles; sem id, um aviso PEOPLE é negado (falha fechada).
export type AnnouncementScopeRecord = { scope: "HOUSE" | "AREA" | "LOCATION" | "PEOPLE"; areaId: string | null; locationId: string | null; id?: string; authorId?: string };

function isAdmin(role: string) { return ["ADMIN", "ADM"].includes(role.toUpperCase()); }
function isDirection(role: string) { return ["DIRECTOR", "DIR", "DIRECTION"].includes(role.toUpperCase()); }
function isSupervisor(role: string) { const normalized = role.toUpperCase(); return normalized.startsWith("SUPERVISOR") || normalized === "SUP"; }

// The optional executor lets callers revalidate access inside the transaction
// that records a consequential action.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canReadAnnouncement(actor: AnnouncementActor, post: AnnouncementScopeRecord, executor: any = db): Promise<boolean> {
  if (isAdmin(actor.role) || isDirection(actor.role) || post.scope === "HOUSE") return true;
  // Quem publicou sempre vê o próprio aviso (a Supervisão publica para qualquer destino desde 02/10).
  if (post.authorId && post.authorId === actor.userId) return true;

  if (post.scope === "PEOPLE") {
    if (!post.id) return false;
    const [recipient] = await executor.select({ id: announcementRecipientsTable.id })
      .from(announcementRecipientsTable)
      .where(and(eq(announcementRecipientsTable.announcementId, post.id), eq(announcementRecipientsTable.userId, actor.userId)))
      .for("share")
      .limit(1);
    return Boolean(recipient);
  }

  if (post.scope === "AREA") {
    if (!post.areaId) return false;
    const [user] = await executor.select({ areaId: usersTable.areaId })
      .from(usersTable)
      .where(and(eq(usersTable.id, actor.userId), eq(usersTable.organizationId, actor.organizationId)))
      .for("share")
      .limit(1);
    return user?.areaId === post.areaId;
  }

  if (!post.locationId) return false;
  if (isSupervisor(actor.role)) {
    const [assignment] = await executor.select({ id: areaLocalSupervisorsTable.id })
      .from(areaLocalSupervisorsTable)
      .innerJoin(areasTable, eq(areaLocalSupervisorsTable.areaId, areasTable.id))
      .where(and(
        eq(areaLocalSupervisorsTable.supervisorId, actor.userId),
        eq(areaLocalSupervisorsTable.locationId, post.locationId),
        eq(areaLocalSupervisorsTable.active, true),
        eq(areasTable.organizationId, actor.organizationId),
      ))
      .for("share")
      .limit(1);
    return Boolean(assignment);
  }

  const [allocation] = await executor.select({ id: scaleAllocationsTable.id })
    .from(scaleAllocationsTable)
    .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
    .where(and(
      eq(scaleAllocationsTable.userId, actor.userId),
      eq(scaleAllocationsTable.active, true),
      eq(scalesTable.locationId, post.locationId),
      inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
    ))
    .for("share")
    .limit(1);
  return Boolean(allocation);
}
