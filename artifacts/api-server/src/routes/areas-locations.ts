import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  locationsTable,
  operationLocationsTable,
  operationsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { requireReason } from "../lib/reason.js";
import { writeEntityHistory } from "../lib/entity-history.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { listReadableLocations } from "../services/location-directory.js";

const router: IRouter = Router();
const SUPERVISOR_ROLES = new Set(["SUPERVISOR_A", "SUPERVISOR_B"]);

function mayReadReference(role: string) { return role === "ADMIN" || role === "DIR" || SUPERVISOR_ROLES.has(role); }

async function areaInOrg(id: string, organizationId: string) {
  const [area] = await db.select().from(areasTable).where(and(eq(areasTable.id, id), eq(areasTable.organizationId, organizationId))).limit(1);
  return area ?? null;
}
async function locationInOrg(id: string, organizationId: string) {
  const [location] = await db.select().from(locationsTable).where(and(eq(locationsTable.id, id), eq(locationsTable.organizationId, organizationId))).limit(1);
  return location ?? null;
}

router.get("/areas", requireAuth, requireOrganization, async (req, res) => {
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const includeInactive = req.query.includeInactive === "true";
  let areas = await db.select().from(areasTable).where(and(
    eq(areasTable.organizationId, req.user!.organizationId),
    includeInactive ? undefined : eq(areasTable.active, true),
  )).orderBy(areasTable.name);
  if (SUPERVISOR_ROLES.has(req.user!.role)) {
    const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
    const ids = new Set(scopes.map((scope) => scope.areaId));
    areas = areas.filter((area) => ids.has(area.id));
  }
  res.json({ areas });
});

router.post("/areas", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) { res.status(400).json({ error: "name é obrigatório" }); return; }
  try {
    const area = await db.transaction(async (tx) => {
      const [created] = await tx.insert(areasTable).values({ organizationId: req.user!.organizationId, name, active: true }).returning();
      if (!created) throw new Error("Área não criada");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area.created", title: "Área criada", narrative: "Área operacional criada.", entityType: "area", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ area });
  } catch { res.status(409).json({ error: "Já existe uma área ativa com este nome" }); }
});

router.patch("/areas/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await areaInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : before.name;
  if (!name) { res.status(400).json({ error: "name não pode ser vazio" }); return; }
  try {
    const area = await db.transaction(async (tx) => {
      const [next] = await tx.update(areasTable).set({ name, active: typeof req.body?.active === "boolean" ? req.body.active : before.active, updatedAt: new Date() }).where(eq(areasTable.id, before.id)).returning();
      if (!next) throw new Error("Área não encontrada");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area.updated", title: "Área alterada", narrative: "Área operacional alterada.", entityType: "area", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
      return next;
    });
    res.json({ area });
  } catch { res.status(409).json({ error: "Já existe uma área ativa com este nome" }); }
});

router.delete("/areas/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await areaInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  const area = await db.transaction(async (tx) => {
    const [next] = await tx.update(areasTable).set({ active: false, updatedAt: new Date() }).where(eq(areasTable.id, before.id)).returning();
    if (!next) throw new Error("Área não encontrada");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area.deactivated", title: "Área desativada", narrative: "Área preservada no histórico e desativada.", entityType: "area", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ area });
});

router.get("/areas/:id/local-supervisors", requireAuth, requireOrganization, async (req, res) => {
  const area = await areaInOrg(req.params.id as string, req.user!.organizationId);
  if (!area) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  if (SUPERVISOR_ROLES.has(req.user!.role)) {
    const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
    if (!scopes.some((scope) => scope.areaId === area.id)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  const rows = await db.select({ mapping: areaLocalSupervisorsTable, locationName: locationsTable.name, supervisorName: usersTable.name })
    .from(areaLocalSupervisorsTable)
    .innerJoin(locationsTable, eq(areaLocalSupervisorsTable.locationId, locationsTable.id))
    .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
    .where(and(eq(areaLocalSupervisorsTable.areaId, area.id), eq(areaLocalSupervisorsTable.active, true)));
  res.json({ supervisors: rows.map((row) => ({ ...row.mapping, locationName: row.locationName, supervisorName: row.supervisorName })) });
});

router.put("/areas/:id/locations/:locationId/supervisor", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const area = await areaInOrg(req.params.id as string, req.user!.organizationId);
  const location = await locationInOrg(req.params.locationId as string, req.user!.organizationId);
  const supervisorId = req.body?.supervisorId as string | undefined;
  if (!area || !location) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!supervisorId) { res.status(400).json({ error: "supervisorId é obrigatório" }); return; }
  const [[supervisor], [activeRole]] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, supervisorId), eq(usersTable.status, "ACTIVE"), eq(usersTable.organizationId, req.user!.organizationId))).limit(1),
    db.select({ id: userRolesTable.id }).from(userRolesTable).innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id)).where(and(eq(operationsTable.organizationId, req.user!.organizationId), eq(userRolesTable.userId, supervisorId), eq(userRolesTable.active, true), inArray(userRolesTable.role, ["SUPERVISOR_A", "SUPERVISOR_B"] as any))).limit(1),
  ]);
  if (!supervisor || !activeRole) { res.status(400).json({ error: "supervisorId precisa ser supervisor ativo da organização" }); return; }
  const mapping = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(areaLocalSupervisorsTable).where(and(eq(areaLocalSupervisorsTable.areaId, area.id), eq(areaLocalSupervisorsTable.locationId, location.id), eq(areaLocalSupervisorsTable.active, true))).limit(1);
    if (before) await tx.update(areaLocalSupervisorsTable).set({ active: false, updatedAt: new Date() }).where(eq(areaLocalSupervisorsTable.id, before.id));
    const [created] = await tx.insert(areaLocalSupervisorsTable).values({ areaId: area.id, locationId: location.id, supervisorId, active: true }).returning();
    if (!created) throw new Error("Supervisão não atribuída");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area_local_supervisor.assigned", title: "Supervisão por área e local atribuída", narrative: "Supervisor atribuído à combinação de área e local.", entityType: "area_local_supervisor", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before ?? null, afterState: created }, tx as any);
    return created;
  });
  res.status(201).json({ mapping });
});

router.get("/locations", requireAuth, requireOrganization, async (req, res) => {
  const locations = await listReadableLocations(req.user!.organizationId, req.user!.sub, req.user!.role, undefined, undefined, req.query.includeClosed === "true");
  if (!locations) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ locations });
});

router.post("/locations", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" && req.body.type.trim() ? req.body.type.trim() : "parque";
  if (!name) { res.status(400).json({ error: "name é obrigatório" }); return; }
  try {
    const location = await db.transaction(async (tx) => {
      const [created] = await tx.insert(locationsTable).values({ organizationId: req.user!.organizationId, name, type, closed: false }).returning();
      if (!created) throw new Error("Local não criado");
      // Local novo já entra nas operações ativas: a Escala do local precisa da operação dona.
      const ativas = await tx.select({ id: operationsTable.id }).from(operationsTable).where(and(eq(operationsTable.organizationId, req.user!.organizationId), eq(operationsTable.status, "ACTIVE")));
      if (ativas.length) await tx.insert(operationLocationsTable).values(ativas.map((op) => ({ operationId: op.id, locationId: created.id, active: true })));
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "location.created", title: "Local criado", narrative: "Local operacional criado.", entityType: "location", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ location });
  } catch { res.status(409).json({ error: "Já existe um local com este nome" }); }
});

router.patch("/locations/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await locationInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  const reopening = before.closed && req.body?.closed === false;
  const reason = reopening ? requireReason(res, req.body?.reason, "reabrir local") : null;
  if (reopening && !reason) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : before.name;
  if (!name) { res.status(400).json({ error: "name não pode ser vazio" }); return; }
  try {
    const location = await db.transaction(async (tx) => {
      const [next] = await tx.update(locationsTable).set({ name, type: typeof req.body?.type === "string" && req.body.type.trim() ? req.body.type.trim() : before.type, closed: typeof req.body?.closed === "boolean" ? req.body.closed : before.closed, closedReason: reopening ? null : (typeof req.body?.closedReason === "string" ? req.body.closedReason.trim() || null : before.closedReason), updatedAt: new Date() }).where(eq(locationsTable.id, before.id)).returning();
      if (!next) throw new Error("Local não encontrado");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: reopening ? "location.reopened" : "location.updated", title: reopening ? "Local reaberto" : "Local alterado", narrative: reopening ? "Local reaberto com motivo." : "Local operacional alterado.", entityType: "location", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next, metadata: reason ? { reason } : {} }, tx as any);
      return next;
    });
    res.json({ location });
  } catch { res.status(409).json({ error: "Já existe um local com este nome" }); }
});

router.delete("/locations/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await locationInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  const location = await db.transaction(async (tx) => {
    const [next] = await tx.update(locationsTable).set({ closed: true, closedReason: typeof req.body?.reason === "string" ? req.body.reason.trim() || before.closedReason : before.closedReason, updatedAt: new Date() }).where(eq(locationsTable.id, before.id)).returning();
    if (!next) throw new Error("Local não encontrado");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "location.closed", title: "Local encerrado", narrative: "Local preservado no histórico e encerrado.", entityType: "location", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ location });
});

router.get("/operations/:operationId/locations", requireAuth, requireOrganization, async (req, res) => {
  const [operation] = await db.select().from(operationsTable).where(and(eq(operationsTable.id, req.params.operationId as string), eq(operationsTable.organizationId, req.user!.organizationId))).limit(1);
  if (!operation) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db.select({ location: locationsTable }).from(operationLocationsTable).innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id)).where(and(eq(operationLocationsTable.operationId, operation.id), eq(operationLocationsTable.active, true), eq(locationsTable.closed, false)));
  res.json({ locations: rows.map((row) => row.location) });
});

router.put("/operations/:operationId/locations", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const [operation] = await db.select().from(operationsTable).where(and(eq(operationsTable.id, req.params.operationId as string), eq(operationsTable.organizationId, req.user!.organizationId))).limit(1);
  const locationIds: string[] | null = Array.isArray(req.body?.locationIds) && req.body.locationIds.every((id: unknown) => typeof id === "string") ? [...new Set<string>(req.body.locationIds)] : null;
  if (!operation) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!locationIds) { res.status(400).json({ error: "locationIds é obrigatório" }); return; }
  const locations = locationIds.length === 0 ? [] : await db.select({ id: locationsTable.id }).from(locationsTable).where(and(inArray(locationsTable.id, locationIds), eq(locationsTable.organizationId, req.user!.organizationId), eq(locationsTable.closed, false)));
  if (locations.length !== new Set(locationIds).size) { res.status(400).json({ error: "Todos os locais devem existir, pertencer à organização e estar abertos" }); return; }
  const mappings = await db.transaction(async (tx) => {
    const before = await tx.select().from(operationLocationsTable).where(and(eq(operationLocationsTable.operationId, operation.id), eq(operationLocationsTable.active, true)));
    if (before.length > 0) await tx.update(operationLocationsTable).set({ active: false, updatedAt: new Date() }).where(and(eq(operationLocationsTable.operationId, operation.id), eq(operationLocationsTable.active, true)));
    const created = locationIds.length > 0 ? await tx.insert(operationLocationsTable).values(locationIds.map((locationId: string) => ({ operationId: operation.id, locationId, active: true }))).returning() : [];
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "operation_locations.updated", title: "Locais da operação atualizados", narrative: "Vínculos de locais da operação atualizados sem apagar histórico.", entityType: "operation", entityId: operation.id, actorId: req.user!.sub, orgId: req.user!.organizationId, operationId: operation.id, beforeState: { locations: before }, afterState: { locations: created } }, tx as any);
    return created;
  });
  res.json({ locations: mappings });
});

// Pessoa pertence à ASA e a uma área. O local é definido pela Programação e
// pela Escala em cada dia; esta rota conserva o caminho legado só para área.
router.put("/users/:id/operational-scope", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const [before] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.params.id as string), eq(usersTable.organizationId, req.user!.organizationId))).limit(1);
  if (!before) { res.status(403).json({ error: "Forbidden" }); return; }
  const { areaId } = req.body ?? {};
  if (typeof areaId !== "string") { res.status(400).json({ error: "areaId é obrigatório" }); return; }
  const area = await areaInOrg(areaId, req.user!.organizationId);
  if (!area?.active) { res.status(403).json({ error: "Área fora do escopo ativo" }); return; }
  const scope = await db.transaction(async (tx) => {
    const [next] = await tx.update(usersTable).set({ areaId, updatedAt: new Date() }).where(eq(usersTable.id, before.id)).returning();
    if (!next) throw new Error("Pessoa não encontrada");
    const previous = { personId: before.id, areaId: before.areaId };
    const current = { personId: next.id, areaId: next.areaId };
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "person.area_updated", title: "Área da pessoa alterada", narrative: "Área da pessoa atualizada.", entityType: "person", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: previous, afterState: current }, tx);
    return current;
  });
  res.json({ scope });
});

router.delete("/areas/:id/locations/:locationId/supervisor", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const area = await areaInOrg(req.params.id as string, req.user!.organizationId);
  const location = await locationInOrg(req.params.locationId as string, req.user!.organizationId);
  if (!area || !location) { res.status(403).json({ error: "Forbidden" }); return; }
  const mapping = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(areaLocalSupervisorsTable).where(and(eq(areaLocalSupervisorsTable.areaId, area.id), eq(areaLocalSupervisorsTable.locationId, location.id), eq(areaLocalSupervisorsTable.active, true))).limit(1);
    if (!before) return null;
    const [next] = await tx.update(areaLocalSupervisorsTable).set({ active: false, updatedAt: new Date() }).where(eq(areaLocalSupervisorsTable.id, before.id)).returning();
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area_local_supervisor.revoked", title: "Supervisão revogada", narrative: "Atribuição desativada sem apagar o histórico.", entityType: "area_local_supervisor", entityId: before.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next! }, tx);
    return next;
  });
  res.json({ mapping });
});

export default router;
