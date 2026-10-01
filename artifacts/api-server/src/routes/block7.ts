import { Router } from "express";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, pwaInstallationsTable, webPushSubscriptionsTable, usersTable, scalesTable, scaleAllocationsTable, operationsTable, agendaEventsTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { UndoError, undoAction } from "../services/undo.js";
import { directoryPeople, globalSearch, searchDate } from "../services/global-search.js";
import { validPushEndpoint, webPushConfigured } from "../services/web-push.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { hasScaleAuthority } from "../services/scale-access.js";
import { publishedDay } from "../services/published-day.js";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.post("/actions/:id/undo", requireAuth, requireOrganization, async (req, res) => {
  try { res.json(await undoAction(req.params.id as string, req.user!.sub, req.user!.organizationId)); }
  catch (error) { res.status(error instanceof UndoError ? error.status : 500).json({ error: error instanceof UndoError ? error.message : "Falha ao desfazer; nenhuma alteração persistiu." }); }
});
router.get("/search", requireAuth, requireOrganization, async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (query.length > 200) { res.status(400).json({ error: "Busca limitada a 200 caracteres" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  try { res.json(await globalSearch(req.user!, query)); }
  catch (error) { console.error("[search] falha", (error as Error).name); res.status(500).json({ error: "Falha na busca" }); }
});
router.get("/directory/people/:id", requireAuth, requireOrganization, async (req, res) => {
  const person = (await directoryPeople(req.user!)).find(row => row.id === req.params.id);
  if (!person) { res.status(403).json({ error: "Pessoa fora do seu diretório" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ person });
});
router.get("/web-push/config", requireAuth, requireOrganization, (_req, res) => res.json({ configured: webPushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));
router.post("/pwa/installations", requireAuth, requireOrganization, async (req, res) => {
  const { installationId, displayMode } = req.body ?? {};
  if (typeof installationId !== "string" || !UUID.test(installationId) || !["standalone", "fullscreen"].includes(displayMode)) { res.status(400).json({ error: "Registre somente abertura instalada, com installationId UUID" }); return; }
  const row = await db.transaction(async tx => {
    const [before] = await tx.select().from(pwaInstallationsTable).where(and(eq(pwaInstallationsTable.userId, req.user!.sub), eq(pwaInstallationsTable.installationId, installationId)));
    const [after] = await tx.insert(pwaInstallationsTable).values({ userId: req.user!.sub, installationId }).onConflictDoUpdate({ target: [pwaInstallationsTable.userId, pwaInstallationsTable.installationId], set: { lastSeenAt: new Date() } }).returning();
    if (!before) await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "pwa.installed", title: "App instalado", narrative: "Primeira abertura em modo instalado informada pelo navegador.", entityType: "pwa_installation", entityId: after!.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: { installationId, installedAt: after!.installedAt } }, tx);
    return after;
  });
  res.status(201).json({ installation: row });
});
router.get("/pwa/installations", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const rows = await db.select({ id: usersTable.id, name: usersTable.name, installedAt: pwaInstallationsTable.installedAt, lastSeenAt: pwaInstallationsTable.lastSeenAt }).from(usersTable).leftJoin(pwaInstallationsTable, eq(usersTable.id, pwaInstallationsTable.userId)).where(and(eq(usersTable.organizationId, req.user!.organizationId), eq(usersTable.status, "ACTIVE")));
  const people = new Map<string, { id: string; name: string; installed: boolean; lastSeenAt: Date | null }>();
  for (const row of rows) { const old = people.get(row.id); people.set(row.id, { id: row.id, name: row.name, installed: Boolean(row.installedAt) || old?.installed === true, lastSeenAt: !old?.lastSeenAt || (row.lastSeenAt && row.lastSeenAt > old.lastSeenAt) ? row.lastSeenAt : old.lastSeenAt }); }
  res.json({ people: [...people.values()] });
});
router.post("/web-push/subscriptions", requireAuth, requireOrganization, async (req, res) => {
  const { endpoint, keys, installationId } = req.body ?? {};
  if (typeof installationId !== "string" || !UUID.test(installationId) || typeof endpoint !== "string" || !validPushEndpoint(endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || !/^[A-Za-z0-9_-]+$/.test(keys.p256dh) || Buffer.from(keys.p256dh, "base64url").length !== 65 || !/^[A-Za-z0-9_-]+$/.test(keys.auth) || Buffer.from(keys.auth, "base64url").length !== 16) { res.status(400).json({ error: "Inscrição Web Push inválida ou serviço não suportado" }); return; }
  const [installation] = await db.select().from(pwaInstallationsTable).where(and(eq(pwaInstallationsTable.userId, req.user!.sub), eq(pwaInstallationsTable.installationId, installationId ?? "00000000-0000-0000-0000-000000000000")));
  if (!installation) { res.status(409).json({ error: "Instale e abra o app antes de ativar notificações" }); return; }
  const [existing] = await db.select().from(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.endpoint, endpoint));
  if (existing && existing.userId !== req.user!.sub) { res.status(409).json({ error: "Este navegador está inscrito em outra conta. Remova a inscrição anterior." }); return; }
  const subscription = await db.transaction(async tx => {
    const [row] = await tx.insert(webPushSubscriptionsTable).values({ userId: req.user!.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth }).onConflictDoUpdate({ target: webPushSubscriptionsTable.endpoint, set: { p256dh: keys.p256dh, auth: keys.auth, active: true, updatedAt: new Date() }, setWhere: eq(webPushSubscriptionsTable.userId, req.user!.sub) }).returning();
    if (!row) return null; // Another account may have claimed the endpoint concurrently.
    await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "web_push.subscribed", title: "Notificações do navegador ativadas", narrative: "Inscrição Web Push registrada separadamente dos tokens móveis.", entityType: "web_push_subscription", entityId: row!.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: existing ? { active: existing.active } : null, afterState: { active: true } }, tx);
    return { id: row!.id, active: row!.active };
  });
  if (!subscription) { res.status(409).json({ error: "Este navegador foi inscrito em outra conta." }); return; }
  res.status(201).json({ subscription });
});
router.delete("/web-push/subscriptions/:id", requireAuth, requireOrganization, async (req, res) => {
  await db.transaction(async tx => {
    const [before] = await tx.select().from(webPushSubscriptionsTable).where(and(eq(webPushSubscriptionsTable.id, req.params.id as string), eq(webPushSubscriptionsTable.userId, req.user!.sub))).for("update");
    if (!before) { res.status(403).json({ error: "Inscrição fora da sua conta" }); return; }
    await tx.update(webPushSubscriptionsTable).set({ active: false, updatedAt: new Date() }).where(eq(webPushSubscriptionsTable.id, before.id));
    await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "web_push.unsubscribed", title: "Notificações do navegador desativadas", narrative: "Inscrição desativada sem exclusão física.", entityType: "web_push_subscription", entityId: before.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: { active: before.active }, afterState: { active: false } }, tx);
  });
  if (!res.headersSent) res.sendStatus(204);
});
router.get("/scales/print-day", requireAuth, requireOrganization, async (req, res) => {
  const date = searchDate(String(req.query.date ?? "hoje"));
  if (!date) { res.status(400).json({ error: "Data inválida" }); return; }
  const actor = req.user!;
  const entries = new Map<string, { id: string; personId: string | null; name: string; label: string; scale: string; startTime: string | null; endTime: string | null }>();
  for (const { scale, entries: rows } of await publishedDay(date, actor.organizationId)) {
    const manager = ["ADMIN", "DIR"].includes(actor.role) || await hasScaleAuthority(actor.sub, scale.operationId, scale.groupId, scale.areaId, scale.locationId);
    if (!manager && !actor.operationIds.includes(scale.operationId)) continue;
    for (const { status: _status, ...row } of rows) if (manager || row.personId === actor.sub) entries.set(row.id, row);
  }
  const sorted = [...entries.values()].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.name.localeCompare(b.name, "pt-BR"));
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ date, entries: sorted });
});
export default router;
