import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  characterCastTable,
  charactersTable,
  db,
  locationsTable,
  operationsTable,
  sessionsTable,
  showBooksTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeEntityHistory } from "../lib/entity-history.js";
import { canManageShowBook, canViewShowBook } from "../lib/show-responsibility.js";
import { resolveCharacterForDate } from "../services/character-rotation.js";
import { operationalDate } from "../lib/operational-date.js";
import { listAreaLocalScopes, canSupervisorAccessPerson } from "../services/area-local-scope.js";

const router: IRouter = Router();
const WRITERS = new Set(["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]);

function canWriteReference(role: string) { return WRITERS.has(role); }

async function canAccessCharacter(actor: NonNullable<Express.Request["user"]>, character: typeof charactersTable.$inferSelect) {
  if (actor.role === "ADMIN" || actor.role === "DIR") return true;
  if (WRITERS.has(actor.role)) {
    return (await listAreaLocalScopes(actor.sub, actor.organizationId)).some((scope) => scope.locationId === character.locationId);
  }
  const [own] = await db.select({ id: characterCastTable.id }).from(characterCastTable)
    .where(and(eq(characterCastTable.characterId, character.id), eq(characterCastTable.personId, actor.sub), eq(characterCastTable.active, true))).limit(1);
  return Boolean(own);
}

async function canWriteAtLocation(actor: NonNullable<Express.Request["user"]>, locationId: string) {
  return actor.role === "ADMIN" || (WRITERS.has(actor.role) &&
    (await listAreaLocalScopes(actor.sub, actor.organizationId)).some((scope) => scope.locationId === locationId));
}

async function locationInOrg(locationId: string, organizationId: string) {
  const [location] = await db.select().from(locationsTable).where(and(
    eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId),
  )).limit(1);
  return location ?? null;
}

async function characterInOrg(characterId: string, organizationId: string) {
  const [row] = await db.select({ character: charactersTable })
    .from(charactersTable).innerJoin(locationsTable, eq(charactersTable.locationId, locationsTable.id))
    .where(and(eq(charactersTable.id, characterId), eq(locationsTable.organizationId, organizationId))).limit(1);
  return row?.character ?? null;
}

async function showInOrg(showId: string, organizationId: string) {
  const [show] = await db.select({ show: showBooksTable })
    .from(showBooksTable).innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
    .where(and(eq(showBooksTable.id, showId), eq(operationsTable.organizationId, organizationId))).limit(1);
  return show?.show ?? null;
}

router.get("/characters", requireAuth, requireOrganization, async (req, res) => {
  const locationId = req.query.locationId as string | undefined;
  const includeInactive = req.query.includeInactive === "true";
  if (locationId && !(await locationInOrg(locationId, req.user!.organizationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const conditions = [eq(locationsTable.organizationId, req.user!.organizationId)];
  if (locationId) conditions.push(eq(charactersTable.locationId, locationId));
  if (!includeInactive) conditions.push(eq(charactersTable.active, true));
  const characters = await db.select({ character: charactersTable, locationName: locationsTable.name })
    .from(charactersTable).innerJoin(locationsTable, eq(charactersTable.locationId, locationsTable.id))
    .where(and(...conditions)).orderBy(charactersTable.name);
  const visible = [];
  for (const row of characters) {
    if (await canAccessCharacter(req.user!, row.character)) visible.push({ ...row.character, locationName: row.locationName });
  }
  res.json({ characters: visible });
});

router.post("/characters", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, locationId, mode } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || !locationId || !["titular", "rodizio"].includes(mode)) { res.status(400).json({ error: "name, locationId e mode válidos são obrigatórios" }); return; }
  if (!(await locationInOrg(locationId, req.user!.organizationId))) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canWriteAtLocation(req.user!, locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const character = await db.transaction(async (tx) => {
      const [created] = await tx.insert(charactersTable).values({ name: name.trim(), locationId, mode, active: true }).returning();
      if (!created) throw new Error("Personagem não criado");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "character.created", title: "Personagem criado", narrative: "Personagem operacional criado.", entityType: "character", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ character });
  } catch (error) { res.status(409).json({ error: "Não foi possível criar o personagem" }); }
});

router.patch("/characters/:id", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const before = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, before))) { res.status(403).json({ error: "Forbidden" }); return; }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body?.mode !== undefined && !["titular", "rodizio"].includes(req.body.mode)) { res.status(400).json({ error: "mode inválido" }); return; }
  if (typeof req.body?.name === "string" && req.body.name.trim()) update.name = req.body.name.trim();
  if (req.body?.mode && ["titular", "rodizio"].includes(req.body.mode)) update.mode = req.body.mode;
  if (typeof req.body?.active === "boolean") update.active = req.body.active;
  if (req.body?.locationId) {
    if (!(await canWriteAtLocation(req.user!, req.body.locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!(await locationInOrg(req.body.locationId, req.user!.organizationId))) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
    update.locationId = req.body.locationId;
  }
  const character = await db.transaction(async (tx) => {
    const [next] = await tx.update(charactersTable).set(update).where(eq(charactersTable.id, before.id)).returning();
    if (!next) throw new Error("Personagem não encontrado");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "character.updated", title: "Personagem alterado", narrative: "Personagem operacional alterado.", entityType: "character", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ character });
});

router.delete("/characters/:id", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const before = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, before))) { res.status(403).json({ error: "Forbidden" }); return; }
  const character = await db.transaction(async (tx) => {
    const [next] = await tx.update(charactersTable).set({ active: false, updatedAt: new Date() }).where(eq(charactersTable.id, before.id)).returning();
    if (!next) throw new Error("Personagem não encontrado");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "character.deactivated", title: "Personagem desativado", narrative: "Personagem mantido no histórico e desativado.", entityType: "character", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ character });
});

router.get("/characters/:id/cast", requireAuth, requireOrganization, async (req, res) => {
  const character = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!character) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, character))) { res.status(403).json({ error: "Forbidden" }); return; }
  const cast = await db.select({ cast: characterCastTable, personName: usersTable.name }).from(characterCastTable)
    .innerJoin(usersTable, eq(characterCastTable.personId, usersTable.id))
    .where(and(eq(characterCastTable.characterId, character.id), eq(usersTable.organizationId, req.user!.organizationId), eq(characterCastTable.active, true)))
    .orderBy(characterCastTable.order);
  res.json({ cast: cast.filter((row) => ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"].includes(req.user!.role) || row.cast.personId === req.user!.sub).map((row) => ({ ...row.cast, personName: row.personName })) });
});

router.post("/characters/:id/cast", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const character = await characterInOrg(req.params.id as string, req.user!.organizationId);
  const { personId, order, timesDone = 0 } = req.body ?? {};
  if (!character) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, character))) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!personId || !Number.isInteger(order) || order < 0 || !Number.isInteger(timesDone) || timesDone < 0) { res.status(400).json({ error: "personId, order e timesDone válidos são obrigatórios" }); return; }
  const [person] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, personId), eq(usersTable.organizationId, req.user!.organizationId))).limit(1);
  if (!person) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (req.user!.role !== "ADMIN" && !(await canSupervisorAccessPerson({ supervisorId: req.user!.sub, organizationId: req.user!.organizationId, personId }))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const cast = await db.transaction(async (tx) => {
      const [created] = await tx.insert(characterCastTable).values({ characterId: character.id, personId, order, timesDone, active: true }).returning();
      if (!created) throw new Error("Elenco não criado");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "character_cast.created", title: "Elenco de personagem criado", narrative: "Pessoa adicionada à fila do personagem.", entityType: "character_cast", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ cast });
  } catch (error) { res.status(409).json({ error: "Pessoa ou ordem já usada na fila" }); }
});

/**
 * A fila é uma decisão única: ao mover uma pessoa, todas as posições precisam
 * mudar juntas. Atualizar uma linha por vez violaria a unicidade da ordem e
 * deixaria o rodízio em estado intermediário. Esta rota desloca primeiro as
 * ordens ativas e então grava a nova sequência dentro da mesma transação.
 */
router.put("/characters/:id/cast-order", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const character = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!character) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, character))) { res.status(403).json({ error: "Forbidden" }); return; }
  const rawQueue = req.body?.queue;
  const castIds = req.body?.castIds;
  const isFullQueue = Array.isArray(rawQueue);
  if (!isFullQueue && (!Array.isArray(castIds) || castIds.some((id) => typeof id !== "string") || new Set(castIds).size !== castIds.length)) {
    res.status(400).json({ error: "castIds deve ser uma lista sem repetições" }); return;
  }
  if (isFullQueue && (rawQueue.some((entry) => !entry || typeof entry.personId !== "string" || !Number.isInteger(entry.timesDone) || entry.timesDone < 0) || new Set(rawQueue.map((entry) => entry.personId)).size !== rawQueue.length)) {
    res.status(400).json({ error: "queue deve conter pessoas únicas e contagens válidas" }); return;
  }
  const before = await db.select().from(characterCastTable).where(and(
    eq(characterCastTable.characterId, character.id),
    eq(characterCastTable.active, true),
  )).orderBy(characterCastTable.order);
  if (!isFullQueue && (before.length !== castIds.length || before.some((entry) => !castIds.includes(entry.id)))) {
    res.status(400).json({ error: "A fila precisa conter exatamente as pessoas ativas do personagem" }); return;
  }
  const requestedPeople = isFullQueue ? rawQueue.map((entry) => entry.personId) : before.map((entry) => entry.personId);
  const peopleInOrg = requestedPeople.length ? await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, req.user!.organizationId), inArray(usersTable.id, requestedPeople))) : [];
  if (peopleInOrg.length !== requestedPeople.length) { res.status(403).json({ error: "Forbidden", message: "Pessoa fora do escopo" }); return; }
  if (req.user!.role !== "ADMIN") {
    const allowed = await Promise.all(before.map((entry) => canSupervisorAccessPerson({
      supervisorId: req.user!.sub, organizationId: req.user!.organizationId, personId: entry.personId,
    })));
    if (allowed.some((value) => !value)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  const desired = isFullQueue ? rawQueue : castIds.map((id: string) => {
    const entry = before.find((candidate) => candidate.id === id)!;
    return { id: entry.id, personId: entry.personId, timesDone: entry.timesDone };
  });
  const unchanged = before.length === desired.length && before.every((entry, order) =>
    entry.id === desired[order]?.id && entry.personId === desired[order]?.personId && entry.timesDone === desired[order]?.timesDone,
  );
  // Abrir e salvar sem tocar não é alteração: não desloca a fila nem cria Registro.
  if (unchanged) { res.json({ cast: before, unchanged: true }); return; }
  try {
    const cast = await db.transaction(async (tx) => {
      // Libera todas as posições antes de atribuir a nova ordem 0..n.
      await tx.update(characterCastTable).set({
        order: sql`${characterCastTable.order} + 100000`, updatedAt: new Date(),
      }).where(and(eq(characterCastTable.characterId, character.id), eq(characterCastTable.active, true)));
      const desiredExistingIds = new Set(desired.map((entry: { id?: string }) => entry.id).filter(Boolean));
      for (const entry of before) {
        if (!desiredExistingIds.has(entry.id)) {
          await tx.update(characterCastTable).set({ active: false, updatedAt: new Date() }).where(eq(characterCastTable.id, entry.id));
        }
      }
      for (const [order, entry] of desired.entries()) {
        if (entry.id && before.some((candidate) => candidate.id === entry.id)) {
          await tx.update(characterCastTable).set({ order, timesDone: entry.timesDone, updatedAt: new Date() }).where(eq(characterCastTable.id, entry.id));
        } else {
          await tx.insert(characterCastTable).values({ characterId: character.id, personId: entry.personId, order, timesDone: entry.timesDone, active: true });
        }
      }
      const after = await tx.select().from(characterCastTable).where(and(
        eq(characterCastTable.characterId, character.id), eq(characterCastTable.active, true),
      )).orderBy(characterCastTable.order);
      await writeEntityHistory(req, {
        category: "OPERATIONAL_CHANGE", action: "character_cast.reordered", title: "Fila de personagem reordenada",
        narrative: "A ordem da fila do personagem foi alterada.", entityType: "character", entityId: character.id,
        actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: { fila: before }, afterState: { fila: after },
      }, tx as any);
      return after;
    });
    res.json({ cast });
  } catch { res.status(409).json({ error: "Não foi possível reordenar a fila" }); }
});

router.patch("/characters/:id/cast/:castId", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const character = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!character) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, character))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [before] = await db.select().from(characterCastTable).where(and(eq(characterCastTable.id, req.params.castId as string), eq(characterCastTable.characterId, character.id))).limit(1);
  if (!before) { res.status(404).json({ error: "Elenco não encontrado" }); return; }
  if (req.user!.role !== "ADMIN" && !(await canSupervisorAccessPerson({ supervisorId: req.user!.sub, organizationId: req.user!.organizationId, personId: before.personId }))) { res.status(403).json({ error: "Forbidden" }); return; }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (["order", "timesDone"].some((key) => req.body?.[key] !== undefined && (!Number.isInteger(req.body[key]) || req.body[key] < 0))) { res.status(400).json({ error: "order e timesDone devem ser inteiros não negativos" }); return; }
  if (Number.isInteger(req.body?.order) && req.body.order >= 0) update.order = req.body.order;
  if (Number.isInteger(req.body?.timesDone) && req.body.timesDone >= 0) update.timesDone = req.body.timesDone;
  if (typeof req.body?.active === "boolean") update.active = req.body.active;
  try {
    const cast = await db.transaction(async (tx) => {
      const [next] = await tx.update(characterCastTable).set(update).where(eq(characterCastTable.id, before.id)).returning();
      if (!next) throw new Error("Elenco não encontrado");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "character_cast.updated", title: "Elenco de personagem alterado", narrative: "Fila do personagem alterada.", entityType: "character_cast", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
      return next;
    });
    res.json({ cast });
  } catch { res.status(409).json({ error: "Pessoa ou ordem já usada na fila" }); }
});

router.delete("/characters/:id/cast/:castId", requireAuth, requireOrganization, async (req, res) => {
  if (!canWriteReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const character = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!character) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canAccessCharacter(req.user!, character))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [before] = await db.select().from(characterCastTable).where(and(eq(characterCastTable.id, req.params.castId as string), eq(characterCastTable.characterId, character.id))).limit(1);
  if (!before) { res.status(404).json({ error: "Elenco não encontrado" }); return; }
  if (req.user!.role !== "ADMIN" && !(await canSupervisorAccessPerson({ supervisorId: req.user!.sub, organizationId: req.user!.organizationId, personId: before.personId }))) { res.status(403).json({ error: "Forbidden" }); return; }
  const cast = await db.transaction(async (tx) => {
    const [next] = await tx.update(characterCastTable).set({ active: false, updatedAt: new Date() }).where(eq(characterCastTable.id, before.id)).returning();
    if (!next) throw new Error("Elenco não encontrado");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "character_cast.deactivated", title: "Elenco de personagem desativado", narrative: "Pessoa removida da fila sem apagar histórico.", entityType: "character_cast", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ cast });
});

router.get("/characters/:id/resolve", requireAuth, requireOrganization, async (req, res) => {
  const operationId = req.query.operationId as string | undefined;
  const date = (req.query.date as string | undefined) ?? operationalDate();
  const character = await characterInOrg(req.params.id as string, req.user!.organizationId);
  if (!character || !(await canAccessCharacter(req.user!, character))) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!operationId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: "operationId e date (YYYY-MM-DD) são obrigatórios" }); return; }
  const [operation] = await db.select({ id: operationsTable.id }).from(operationsTable).where(and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, req.user!.organizationId))).limit(1);
  if (!operation) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!["ADMIN", "DIR"].includes(req.user!.role) && !req.user!.operationIds.includes(operationId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await resolveCharacterForDate({ characterId: req.params.id as string, operationId, date });
  if (!result) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"].includes(req.user!.role)) {
    result.cast = result.cast.filter((member) => member.personId === req.user!.sub);
    if (result.selected?.personId !== req.user!.sub) result.selected = null;
  }
  res.json(result);
});

router.get("/show-books/:showId/sessions", requireAuth, requireOrganization, async (req, res) => {
  const show = await showInOrg(req.params.showId as string, req.user!.organizationId);
  if (!show) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canViewShowBook(req.user!, show, show.operationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  // A ficha precisa exibir sessões desativadas para que a supervisão possa
  // reativá-las; as rotinas operacionais continuam filtrando `active = true`.
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.showId, show.id)).orderBy(sessionsTable.startTime);
  res.json({ sessions });
});

router.post("/show-books/:showId/sessions", requireAuth, requireOrganization, async (req, res) => {
  const show = await showInOrg(req.params.showId as string, req.user!.organizationId);
  const { startTime, endTime, callTime = null, validFrom = null, validTo = null } = req.body ?? {};
  if (!show) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canManageShowBook(req.user!, show, show.operationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!startTime || !endTime) { res.status(400).json({ error: "startTime e endTime são obrigatórios" }); return; }
  try {
    const session = await db.transaction(async (tx) => {
      const [created] = await tx.insert(sessionsTable).values({ showId: show.id, startTime, endTime, callTime, validFrom, validTo, active: true } as any).returning();
      if (!created) throw new Error("Sessão não criada");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "session.created", title: "Sessão criada", narrative: "Sessão do show criada.", entityType: "session", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, operationId: show.operationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ session });
  } catch { res.status(400).json({ error: "Fim da sessão deve ser posterior ao início e o horário não pode duplicar" }); }
});

router.patch("/show-books/:showId/sessions/:sessionId", requireAuth, requireOrganization, async (req, res) => {
  const show = await showInOrg(req.params.showId as string, req.user!.organizationId);
  if (!show) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canManageShowBook(req.user!, show, show.operationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [before] = await db.select().from(sessionsTable).where(and(eq(sessionsTable.id, req.params.sessionId as string), eq(sessionsTable.showId, show.id))).limit(1);
  if (!before) { res.status(404).json({ error: "Sessão não encontrada" }); return; }
  const update = { startTime: req.body?.startTime ?? before.startTime, endTime: req.body?.endTime ?? before.endTime, callTime: req.body?.callTime === undefined ? before.callTime : req.body.callTime, validFrom: req.body?.validFrom === undefined ? (before as any).validFrom : req.body.validFrom || null, validTo: req.body?.validTo === undefined ? (before as any).validTo : req.body.validTo || null, active: typeof req.body?.active === "boolean" ? req.body.active : before.active, updatedAt: new Date() };
  try {
    const session = await db.transaction(async (tx) => {
      const [next] = await tx.update(sessionsTable).set(update as any).where(eq(sessionsTable.id, before.id)).returning();
      if (!next) throw new Error("Sessão não encontrada");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "session.updated", title: "Sessão alterada", narrative: "Sessão do show alterada.", entityType: "session", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, operationId: show.operationId, beforeState: before, afterState: next }, tx as any);
      return next;
    });
    res.json({ session });
  } catch { res.status(400).json({ error: "Fim da sessão deve ser posterior ao início e o horário não pode duplicar" }); }
});

router.delete("/show-books/:showId/sessions/:sessionId", requireAuth, requireOrganization, async (req, res) => {
  const show = await showInOrg(req.params.showId as string, req.user!.organizationId);
  if (!show) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canManageShowBook(req.user!, show, show.operationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [before] = await db.select().from(sessionsTable).where(and(eq(sessionsTable.id, req.params.sessionId as string), eq(sessionsTable.showId, show.id))).limit(1);
  if (!before) { res.status(404).json({ error: "Sessão não encontrada" }); return; }
  const session = await db.transaction(async (tx) => {
    const [next] = await tx.update(sessionsTable).set({ active: false, updatedAt: new Date() }).where(eq(sessionsTable.id, before.id)).returning();
    if (!next) throw new Error("Sessão não encontrada");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "session.deactivated", title: "Sessão desativada", narrative: "Sessão mantida no histórico e desativada.", entityType: "session", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, operationId: show.operationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ session });
});

export default router;
