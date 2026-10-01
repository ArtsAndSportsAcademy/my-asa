import { and, eq, isNull } from "drizzle-orm";
import { announcementReadsTable, announcementsTable, db } from "@workspace/db";
import { canReadAnnouncement, type AnnouncementActor } from "./announcement-access.js";
import { announcementConfirmationVersion } from "./announcement-version.js";
export { announcementConfirmationVersion } from "./announcement-version.js";

export type AnnouncementConfirmationResult =
  | { status: "confirmed"; post: typeof announcementsTable.$inferSelect; read: typeof announcementReadsTable.$inferSelect }
  | { status: "unavailable" }
  | { status: "stale" };

export async function confirmAnnouncementRead(
  actor: AnnouncementActor,
  announcementId: string,
  executor: Pick<typeof db, "select" | "insert"> = db,
  expectedVersion?: string,
): Promise<AnnouncementConfirmationResult> {
  const [post] = await executor.select().from(announcementsTable).where(and(
    eq(announcementsTable.id, announcementId),
    eq(announcementsTable.orgId, actor.organizationId),
    eq(announcementsTable.active, true),
    isNull(announcementsTable.cancelledAt),
    eq(announcementsTable.requiresConfirmation, true),
  )).for("share").limit(1);
  if (!post || !(await canReadAnnouncement(actor, post, executor))) return { status: "unavailable" };
  // Check the exact preview under the row lock, before creating any read record.
  if (expectedVersion !== undefined && announcementConfirmationVersion(post) !== expectedVersion) return { status: "stale" };

  const now = new Date();
  const [read] = await executor.insert(announcementReadsTable).values({
    announcementId: post.id,
    userId: actor.userId,
    readAt: now,
    confirmedAt: now,
  }).onConflictDoUpdate({
    target: [announcementReadsTable.announcementId, announcementReadsTable.userId],
    set: { readAt: now, confirmedAt: now },
  }).returning();
  if (!read) throw new Error("Não foi possível registrar o ciente");
  return { status: "confirmed", post, read };
}
