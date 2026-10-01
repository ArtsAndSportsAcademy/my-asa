import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, announcementCommentsTable, announcementReadsTable, announcementsTable, areaLocalSupervisorsTable, areasTable, locationsTable, scaleAllocationsTable, scalesTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { normalizeReason, requireReason } from "../lib/reason.js";
import { canReadAnnouncement } from "../services/announcement-access.js";
import { confirmAnnouncementRead } from "../services/announcement-confirmation.js";
import { listCommunicationPeople } from "../services/communication-directory.js";

const router: IRouter = Router();
type Scope = "HOUSE" | "AREA" | "LOCATION";
type Kind = "NOTICE" | "RECOGNITION";

function role(req: any) { return String(req.user?.role ?? "MEMBER").toUpperCase(); }
function isAdmin(req: any) { return ["ADMIN", "ADM"].includes(role(req)); }
function isDirection(req: any) { return ["DIRECTOR", "DIR", "DIRECTION"].includes(role(req)); }
function isSupervisor(req: any) { return role(req).startsWith("SUPERVISOR") || role(req) === "SUP"; }

async function ownArea(userId: string) {
  const [row] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.areaId ?? null;
}

router.get("/communication/mural", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const rows = await db.select({
      id: announcementsTable.id, type: announcementsTable.type, scope: announcementsTable.scope, title: announcementsTable.title, body: announcementsTable.body,
      reason: announcementsTable.reason, requiresConfirmation: announcementsTable.requiresConfirmation, recipientId: announcementsTable.recipientId, publishedAt: announcementsTable.publishedAt,
      areaId: announcementsTable.areaId, locationId: announcementsTable.locationId, authorName: usersTable.name, areaName: areasTable.name, locationName: locationsTable.name,
    }).from(announcementsTable).innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
      .leftJoin(areasTable, eq(announcementsTable.areaId, areasTable.id)).leftJoin(locationsTable, eq(announcementsTable.locationId, locationsTable.id))
      .where(and(eq(announcementsTable.orgId, req.user!.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt))).orderBy(desc(announcementsTable.publishedAt));
    const visible: typeof rows = [];
    for (const post of rows) if (await canReadAnnouncement({ userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, post)) visible.push(post);
    const ids = visible.map(post => post.id);
    const mine = ids.length ? await db.select().from(announcementReadsTable).where(and(inArray(announcementReadsTable.announcementId, ids), eq(announcementReadsTable.userId, req.user!.sub))) : [];
    const reads = new Map(mine.map(read => [read.announcementId, read]));
    const comments = ids.length ? await db.select({ announcementId: announcementCommentsTable.announcementId, count: sql<number>`count(*)::int` }).from(announcementCommentsTable).where(and(inArray(announcementCommentsTable.announcementId, ids), eq(announcementCommentsTable.active, true))).groupBy(announcementCommentsTable.announcementId) : [];
    const commentCounts = new Map(comments.map(comment => [comment.announcementId, comment.count]));
    res.json({ posts: visible.map(post => ({ ...post, mine: reads.get(post.id) ?? null, commentCount: commentCounts.get(post.id) ?? 0 })) });
  } catch (error) { console.error("[communication] GET mural", error); res.status(500).json({ error: "Não consegui carregar o Mural" }); }
});

router.get("/communication/people", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    // The product explicitly permits recognition and direct messaging between any
    // two colleagues. This endpoint deliberately contains only the directory data
    // needed to choose a recipient: display name and area, never contact details.
    const people = await listCommunicationPeople(req.user!.organizationId!);
    res.json({ people });
  } catch { res.status(500).json({ error: "Não consegui listar as pessoas" }); }
});

router.post("/communication/mural", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const { type = "NOTICE", scope = "HOUSE", areaId = null, locationId = null, recipientId = null, title = null, body, reason = null, requiresConfirmation = false } = req.body as { type?: Kind; scope?: Scope; areaId?: string | null; locationId?: string | null; recipientId?: string | null; title?: string | null; body?: string; reason?: string | null; requiresConfirmation?: boolean };
    if (!body?.trim()) { res.status(400).json({ error: "Escreva a publicação" }); return; }
    if (!["NOTICE", "RECOGNITION"].includes(type) || !["HOUSE", "AREA", "LOCATION"].includes(scope)) { res.status(400).json({ error: "Publicação inválida" }); return; }
    if (scope === "AREA" && !areaId || scope === "LOCATION" && !locationId) { res.status(400).json({ error: "Complete o destino da publicação" }); return; }
    if (type === "RECOGNITION") {
      const required = requireReason(res, reason, "publicar um reconhecimento"); if (!required) return;
      const [recipient] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, recipientId!), eq(usersTable.organizationId, req.user!.organizationId))).limit(1);
      if (!recipient) { res.status(404).json({ error: "Pessoa não encontrada" }); return; }
    } else if (isSupervisor(req)) {
      const area = await ownArea(req.user!.sub);
      if (scope !== "AREA" || area !== areaId) { res.status(403).json({ error: "Supervisão publica aviso apenas para a própria área" }); return; }
    } else if (!isAdmin(req) && !isDirection(req)) { res.status(403).json({ error: "Sem permissão para publicar aviso" }); return; }
    const [post] = await db.transaction(async tx => {
      const [created] = await tx.insert(announcementsTable).values({ orgId: req.user!.organizationId, authorId: req.user!.sub, type, scope, areaId, locationId, recipientId, title: title?.trim() || null, body: body.trim(), reason: type === "RECOGNITION" ? normalizeReason(reason) : null, requiresConfirmation: type === "NOTICE" && Boolean(requiresConfirmation) }).returning();
      await writeHistoryEvent({ category: "NOTICE", action: type === "RECOGNITION" ? "mural.recognition_created" : "mural.notice_created", title: type === "RECOGNITION" ? "Reconhecimento publicado" : "Aviso publicado", narrative: created!.title ?? created!.body.slice(0, 120), entityType: "announcement", entityId: created!.id, actorId: req.user!.sub, orgId: req.user!.organizationId, afterState: created, metadata: { reason: created!.reason } }, tx as any);
      return [created] as const;
    });
    res.status(201).json({ post });
  } catch (error) { console.error("[communication] POST mural", error); res.status(500).json({ error: "Não consegui publicar agora" }); }
});

async function loadAccessiblePost(req: any, id: string) {
  const [post] = await db.select().from(announcementsTable).where(and(eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt))).limit(1);
  return post && await canReadAnnouncement({ userId: req.user.sub, organizationId: req.user.organizationId, role: req.user.role }, post) ? post : null;
}

router.post("/communication/mural/:id/ack", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const result = await db.transaction(async tx => {
      const confirmation = await confirmAnnouncementRead({ userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, String(req.params.id), tx);
      if (confirmation.status !== "confirmed") return confirmation;
      await writeHistoryEvent({ category: "NOTICE", action: "mural.acknowledged", title: "Ciente registrado", narrative: confirmation.post.title ?? confirmation.post.body.slice(0, 120), entityType: "announcement", entityId: confirmation.post.id, actorId: req.user!.sub, orgId: req.user!.organizationId, afterState: confirmation.read }, tx as any);
      return confirmation;
    });
    if (result.status === "unavailable") { res.status(404).json({ error: "Aviso não encontrado" }); return; }
    if (result.status === "stale") { res.status(409).json({ error: "O aviso mudou. Abra-o novamente antes de confirmar." }); return; }
    res.json({ read: result.read });
  } catch { res.status(500).json({ error: "Não consegui confirmar agora" }); }
});

router.post("/communication/mural/:id/react", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const reaction = String(req.body?.reaction ?? "").trim().slice(0, 12);
    if (!reaction) { res.status(400).json({ error: "Reação inválida" }); return; }
    const result = await db.transaction(async tx => {
      const [post] = await tx.select().from(announcementsTable).where(and(
        eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user!.organizationId),
        eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt),
      )).for("update").limit(1);
      if (!post || !(await canReadAnnouncement(
        { userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, post, tx,
      ))) return { status: "unavailable" as const };
      const now = new Date();
      const [read] = await tx.insert(announcementReadsTable).values({
        announcementId: post.id, userId: req.user!.sub, readAt: now, reaction, reactedAt: now,
      }).onConflictDoUpdate({
        target: [announcementReadsTable.announcementId, announcementReadsTable.userId],
        set: { readAt: now, reaction, reactedAt: now },
      }).returning();
      return { status: "saved" as const, read };
    });
    if (result.status === "unavailable") { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    res.json({ read: result.read });
  } catch { res.status(500).json({ error: "Não consegui reagir agora" }); }
});

router.post("/communication/mural/:id/comments", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const body = String(req.body?.body ?? "").trim();
    if (!body) { res.status(400).json({ error: "Escreva um comentário" }); return; }
    const result = await db.transaction(async tx => {
      const [post] = await tx.select().from(announcementsTable).where(and(
        eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user!.organizationId),
        eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt),
      )).for("update").limit(1);
      if (!post || !(await canReadAnnouncement(
        { userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, post, tx,
      ))) return { status: "unavailable" as const };
      const [comment] = await tx.insert(announcementCommentsTable).values({
        announcementId: post.id, authorId: req.user!.sub, body,
      }).returning();
      if (!comment) throw new Error("Não foi possível publicar o comentário");
      await writeHistoryEvent({
        category: "NOTICE", action: "mural.comment_created", title: "Comentário no Mural",
        narrative: body.slice(0, 120), entityType: "announcement_comment", entityId: comment.id,
        actorId: req.user!.sub, orgId: req.user!.organizationId, afterState: comment,
      }, tx as any);
      return { status: "created" as const, comment };
    });
    if (result.status === "unavailable") { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    res.status(201).json({ comment: result.comment });
  } catch { res.status(500).json({ error: "Não consegui comentar agora" }); }
});

// Comments are loaded only after the parent post has passed the same server-side
// audience check as the feed. A count alone is not enough: the thread needs to be
// readable in the product as well.
router.get("/communication/mural/:id/comments", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const post = await loadAccessiblePost(req, String(req.params.id));
    if (!post) { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    const comments = await db.select({ id: announcementCommentsTable.id, body: announcementCommentsTable.body, createdAt: announcementCommentsTable.createdAt, authorName: usersTable.name })
      .from(announcementCommentsTable).innerJoin(usersTable, eq(announcementCommentsTable.authorId, usersTable.id))
      .where(and(eq(announcementCommentsTable.announcementId, post.id), eq(announcementCommentsTable.active, true)))
      .orderBy(announcementCommentsTable.createdAt);
    res.json({ comments });
  } catch { res.status(500).json({ error: "Não consegui carregar os comentários" }); }
});

// Published notices can be cancelled only with the same single-step reason that
// confirms the operation elsewhere in My ASA. Recognitions are permanent posts,
// not institutional notices, so they do not use this route.
router.post("/communication/mural/:id/cancel", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const reason = requireReason(res, req.body?.reason, "cancelar um aviso publicado");
    if (!reason) return;
    const [post] = await db.select().from(announcementsTable)
      .where(and(eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user!.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt))).limit(1);
    if (!post || post.type !== "NOTICE") { res.status(404).json({ error: "Aviso não encontrado" }); return; }
    const allowed = isAdmin(req) || isDirection(req) || post.authorId === req.user!.sub || (isSupervisor(req) && post.areaId === await ownArea(req.user!.sub));
    if (!allowed) { res.status(403).json({ error: "Sem permissão para cancelar este aviso" }); return; }
    const [cancelled] = await db.transaction(async tx => {
      const [updated] = await tx.update(announcementsTable).set({ cancelledAt: new Date(), cancellationReason: normalizeReason(reason), updatedAt: new Date() })
        .where(and(eq(announcementsTable.id, id), isNull(announcementsTable.cancelledAt))).returning();
      if (!updated) throw new Error("Aviso já foi cancelado");
      await writeHistoryEvent({ category: "NOTICE", action: "mural.notice_cancelled", title: "Aviso cancelado", narrative: updated.title ?? updated.body.slice(0, 120), entityType: "announcement", entityId: id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: post, afterState: updated, metadata: { reason: normalizeReason(reason) } }, tx as any);
      return [updated] as const;
    });
    res.json({ post: cancelled });
  } catch (error) { console.error("[communication] POST mural cancel", error); res.status(500).json({ error: "Não consegui cancelar agora" }); }
});

export default router;
