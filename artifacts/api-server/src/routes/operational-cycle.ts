import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import {
  areasTable, dailyBookAssignmentsTable, dailyBookCheckInVacanciesTable,
  dailyBooksTable, dayCheckInsTable, db, folgasTable, leaveRegimesTable, leaveRequestsTable,
  locationsTable, operationsTable, scalesTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { canSupervisorAccessPerson, listAreaLocalScopes } from "../services/area-local-scope.js";
import { montarEscalaDoDia } from "../services/escala-dia.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { protectShiftCheckIns } from "../middlewares/shift-checkin-legacy.js";

const router: IRouter = Router();
router.use("/day-checkins", requireAuth, requireOrganization, protectShiftCheckIns);
const isAdmin = (role: string) => role === "ADMIN";
const isDirector = (role: string) => role === "DIR" || role === "DIRECTOR";
const isSupervisor = (role: string) => role === "SUPERVISOR_A" || role === "SUPERVISOR_B" || role === "SUP";
const canReadManagement = (role: string) => isAdmin(role) || isDirector(role) || isSupervisor(role);
const dateBefore = (date: string) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

async function ownsPerson(actor: { role: string; sub: string; organizationId: string }, personId: string) {
  if (isAdmin(actor.role) || isDirector(actor.role)) return true;
  if (isSupervisor(actor.role)) return canSupervisorAccessPerson({ supervisorId: actor.sub, organizationId: actor.organizationId, personId });
  return actor.sub === personId;
}
async function assertLocationScope(actor: { role: string; sub: string; organizationId: string }, locationId: string) {
  // Código que não é de local (ex.: o "snowland" da amostra) é recusado antes de chegar ao banco.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId)) return false;
  const [location] = await db.select({ id: locationsTable.id }).from(locationsTable).where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false))).limit(1);
  if (!location) return false;
  if (isAdmin(actor.role) || isDirector(actor.role)) return true;
  if (!isSupervisor(actor.role)) return false;
  return (await listAreaLocalScopes(actor.sub, actor.organizationId)).some((scope) => scope.locationId === locationId);
}
async function currentRegime(organizationId: string, date: string) {
  const [regime] = await db.select().from(leaveRegimesTable).where(and(eq(leaveRegimesTable.organizationId, organizationId), eq(leaveRegimesTable.active, true), lte(leaveRegimesTable.effectiveFrom, date), or(isNull(leaveRegimesTable.effectiveTo), gte(leaveRegimesTable.effectiveTo, date)))).orderBy(desc(leaveRegimesTable.effectiveFrom), desc(leaveRegimesTable.createdAt)).limit(1);
  return regime ?? null;
}
async function record(input: Parameters<typeof writeHistoryEvent>[0], tx: unknown) { await writeHistoryEvent(input, tx as HistoryExecutor); }

// Regime versionado: uma regra futura nunca muda a leitura de um dia já publicado.
router.get("/leave-regimes/current", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  if (!canReadManagement(actor.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const date = typeof req.query.date === "string" ? req.query.date : operationalDate();
  res.json({ regime: await currentRegime(actor.organizationId, date) });
});
router.get("/leave-regimes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  if (!isAdmin(actor.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const regimes = await db.select().from(leaveRegimesTable).where(eq(leaveRegimesTable.organizationId, actor.organizationId)).orderBy(desc(leaveRegimesTable.effectiveFrom));
  res.json({ regimes });
});
router.post("/leave-regimes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!; const body = req.body as Record<string, unknown>;
  if (!isAdmin(actor.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const effectiveFrom = typeof body.effectiveFrom === "string" ? body.effectiveFrom : "";
  const effectiveTo = typeof body.effectiveTo === "string" ? body.effectiveTo : null;
  const weeklyDays = Number(body.weeklyDays), weekStartsOn = Number(body.weekStartsOn);
  if (!effectiveFrom || !Number.isInteger(weeklyDays) || weeklyDays < 0 || weeklyDays > 7 || !Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6 || (effectiveTo && effectiveTo < effectiveFrom)) { res.status(400).json({ error: "Bad Request", message: "Regime de folgas inválido." }); return; }
  const regime = await db.transaction(async (tx) => {
    const [previous] = await tx.select().from(leaveRegimesTable).where(and(eq(leaveRegimesTable.organizationId, actor.organizationId), eq(leaveRegimesTable.active, true), lte(leaveRegimesTable.effectiveFrom, effectiveFrom), or(isNull(leaveRegimesTable.effectiveTo), gte(leaveRegimesTable.effectiveTo, effectiveFrom)))).orderBy(desc(leaveRegimesTable.effectiveFrom)).limit(1);
    if (previous && previous.effectiveFrom < effectiveFrom) await tx.update(leaveRegimesTable).set({ effectiveTo: dateBefore(effectiveFrom), endedAt: new Date() }).where(eq(leaveRegimesTable.id, previous.id));
    const [created] = await tx.insert(leaveRegimesTable).values({ organizationId: actor.organizationId, effectiveFrom, effectiveTo, weeklyDays, weekStartsOn, recessRules: (body.recessRules && typeof body.recessRules === "object" ? body.recessRules : {}) as Record<string, unknown>, createdBy: actor.sub }).returning();
    await record({ category: "ABSENCE", action: "leave.regime_created", title: "Regime de folgas configurado", narrative: `Regime com ${weeklyDays} folga(s) por semana a partir de ${effectiveFrom}.`, entityType: "leave_regime", entityId: created.id, actorId: actor.sub, beforeState: previous ?? null, afterState: created }, tx);
    return created;
  });
  res.status(201).json({ regime });
});

router.get("/leave-requests", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, from = typeof req.query.from === "string" ? req.query.from : operationalDate(), to = typeof req.query.to === "string" ? req.query.to : from;
  const rows = await db.select({ request: leaveRequestsTable, userName: usersTable.name, fullName: usersTable.fullName, areaName: areasTable.name }).from(leaveRequestsTable).innerJoin(usersTable, eq(leaveRequestsTable.userId, usersTable.id)).leftJoin(areasTable, eq(leaveRequestsTable.areaId, areasTable.id)).where(and(eq(leaveRequestsTable.organizationId, actor.organizationId), lte(leaveRequestsTable.startDate, to), gte(leaveRequestsTable.endDate, from))).orderBy(desc(leaveRequestsTable.createdAt));
  const visible = [] as typeof rows;
  for (const row of rows) if (await ownsPerson(actor, row.request.userId)) visible.push(row);
  res.json({ requests: visible.map((row) => ({ ...row.request, userName: row.userName ?? row.fullName, areaName: row.areaName })) });
});
router.post("/leave-requests", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const userId = isAdmin(actor.role) && typeof body.userId === "string" ? body.userId : actor.sub;
  const startDate = typeof body.startDate === "string" ? body.startDate : "", endDate = typeof body.endDate === "string" ? body.endDate : "", reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!startDate || !endDate || endDate < startDate || !reason) { res.status(400).json({ error: "Bad Request", message: "Informe período e motivo do pedido." }); return; }
  const [person] = await db.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId))).limit(1);
  if (!person) { res.status(404).json({ error: "Not Found" }); return; }
  const request = await db.transaction(async (tx) => { const [created] = await tx.insert(leaveRequestsTable).values({ organizationId: actor.organizationId, userId, areaId: person.areaId, startDate, endDate, reason }).returning(); await record({ category: "ABSENCE", action: "leave.requested", title: "Folga solicitada", narrative: `Pedido de folga de ${startDate} a ${endDate}.`, entityType: "leave_request", entityId: created.id, actorId: actor.sub, beforeState: null, afterState: created }, tx); return created; });
  res.status(201).json({ request });
});

/** Calendário de grupo: gestão registra uma folga já decidida, sem simular um pedido do Elenco. */
router.post("/leave-calendar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!canReadManagement(actor.role) || isDirector(actor.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!userId || !startDate || !endDate || endDate < startDate || !reason) { res.status(400).json({ error: "Bad Request", message: "Informe pessoa, período e motivo." }); return; }
  if (!(await ownsPerson(actor, userId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [person] = await db.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId))).limit(1);
  if (!person) { res.status(404).json({ error: "Not Found" }); return; }
  const request = await db.transaction(async (tx) => {
    const [operation] = await tx.select({ id: operationsTable.id }).from(operationsTable)
      .where(eq(operationsTable.organizationId, actor.organizationId)).orderBy(asc(operationsTable.createdAt)).limit(1);
    if (!operation) throw new Error("A organização não possui operação para registrar a folga.");
    const [created] = await tx.insert(leaveRequestsTable).values({
      organizationId: actor.organizationId, userId, areaId: person.areaId, startDate, endDate, reason,
      status: "APPROVED", decidedBy: actor.sub, decisionReason: reason, decidedAt: new Date(),
    }).returning();
    await tx.insert(folgasTable).values({ userId, operationId: operation.id, type: "DAY_OFF", startDate, endDate, status: "ACTIVE", origem: "MANUAL", createdBy: actor.sub, notes: `Calendário ${created.id}` });
    await record({ category: "ABSENCE", action: "leave.calendar_set", title: "Folga colocada no calendário", narrative: reason, entityType: "leave_request", entityId: created.id, actorId: actor.sub, beforeState: null, afterState: created, metadata: { reason } }, tx);
    return created;
  });
  res.status(201).json({ request });
});
router.patch("/leave-requests/:id", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const status = body.status === "APPROVED" || body.status === "DENIED" ? body.status : null, decisionReason = typeof body.decisionReason === "string" ? body.decisionReason.trim() : "";
  if (!status || !decisionReason) { res.status(400).json({ error: "Bad Request", message: "A decisão exige motivo." }); return; }
  const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [request] = await db.select().from(leaveRequestsTable).where(and(eq(leaveRequestsTable.id, requestId), eq(leaveRequestsTable.organizationId, actor.organizationId))).limit(1);
  if (!request) { res.status(404).json({ error: "Not Found" }); return; }
  if (!isAdmin(actor.role) && (!isSupervisor(actor.role) || !(await canSupervisorAccessPerson({ supervisorId: actor.sub, organizationId: actor.organizationId, personId: request.userId })))) { res.status(403).json({ error: "Forbidden" }); return; }
  if (request.status !== "PENDING") { res.status(409).json({ error: "Conflict", message: "Este pedido já foi decidido." }); return; }
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({ status, decidedBy: actor.sub, decisionReason, decidedAt: new Date(), updatedAt: new Date() }).where(eq(leaveRequestsTable.id, request.id)).returning();
    if (status === "APPROVED") { const [operation] = await tx.select({ id: operationsTable.id }).from(operationsTable).where(eq(operationsTable.organizationId, actor.organizationId)).orderBy(asc(operationsTable.createdAt)).limit(1); if (!operation) throw new Error("A organização não possui operação para materializar a folga."); await tx.insert(folgasTable).values({ userId: request.userId, operationId: operation.id, type: "DAY_OFF", startDate: request.startDate, endDate: request.endDate, status: "ACTIVE", origem: "SOLICITACAO", createdBy: actor.sub, notes: `Pedido ${request.id}` }); }
    await record({ category: "ABSENCE", action: status === "APPROVED" ? "leave.approved" : "leave.denied", title: status === "APPROVED" ? "Folga aprovada" : "Folga negada", narrative: decisionReason, entityType: "leave_request", entityId: request.id, actorId: actor.sub, beforeState: request, afterState: saved, metadata: { reason: decisionReason } }, tx); return saved;
  });
  res.json({ request: updated });
});

// ─── Check-in por bloco e posição em risco no Livro do Dia ───────────────────

/** Elenco consulta apenas os próprios blocos publicados, inclusive quando atua em mais de um local. */
router.get("/day-checkins/mine", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, date = typeof req.query.date === "string" ? req.query.date : operationalDate();
  const scales = await db.select({ scale: scalesTable, locationName: locationsTable.name }).from(scalesTable).innerJoin(locationsTable, eq(scalesTable.locationId, locationsTable.id)).where(and(eq(locationsTable.organizationId, actor.organizationId), lte(scalesTable.periodStart, date), gte(scalesTable.periodEnd, date), or(eq(scalesTable.status, "PUBLISHED"), eq(scalesTable.status, "REPUBLISHED"))));
  const blocks: any[] = [];
  const checkIns: unknown[] = [];
  for (const row of scales) {
    if (!row.scale.locationId) continue;
    const dia = await montarEscalaDoDia(actor.organizationId, row.scale.locationId, date);
    if (!dia?.escala) continue;
    for (const block of dia.blocos.filter((item) => item.pessoaIds.includes(actor.sub))) blocks.push({ location: dia.location, scaleId: dia.escala.id, block });
    checkIns.push(...await db.select().from(dayCheckInsTable).where(and(eq(dayCheckInsTable.scaleId, dia.escala.id), eq(dayCheckInsTable.userId, actor.sub))));
  }
  res.json({ date, blocks, checkIns });
});

router.get("/day-checkins", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, locationId = typeof req.query.locationId === "string" ? req.query.locationId : "", date = typeof req.query.date === "string" ? req.query.date : operationalDate();
  if (!locationId || !(await assertLocationScope(actor, locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const dia = await montarEscalaDoDia(actor.organizationId, locationId, date);
  if (!dia?.escala) { res.json({ date, blocks: [], checkIns: [] }); return; }
  const all = await db.select().from(dayCheckInsTable).where(eq(dayCheckInsTable.scaleId, dia.escala.id));
  const allowed = isSupervisor(actor.role) ? new Set((await listAreaLocalScopes(actor.sub, actor.organizationId)).filter((scope) => scope.locationId === locationId).map((scope) => scope.areaId)) : null;
  const visiblePeople = new Set(dia.pessoas.filter((person) => !allowed || (person.areaId && allowed.has(person.areaId))).map((person) => person.id));
  // scaleId em cada bloco: é com ele que a tela registra a presença (POST /day-checkins).
  res.json({ date, blocks: dia.blocos.map((block) => ({ ...block, scaleId: dia.escala!.id, pessoaIds: block.pessoaIds.filter((id) => visiblePeople.has(id)) })), checkIns: all.filter((checkin) => visiblePeople.has(checkin.userId)) });
});

async function setAssignmentRisk(tx: Pick<typeof db, "select" | "insert" | "update">, dailyBookId: string, userId: string, checkInId: string, risk: boolean, actorId: string) {
  const assignments = await tx.select().from(dailyBookAssignmentsTable).where(and(eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId), eq(dailyBookAssignmentsTable.userId, userId), ne(dailyBookAssignmentsTable.status, "REMOVED")));
  for (const assignment of assignments) {
    if (risk) {
      await tx.update(dailyBookAssignmentsTable).set({ status: "AT_RISK", updatedAt: new Date() }).where(eq(dailyBookAssignmentsTable.id, assignment.id));
      const [open] = await tx.select({ id: dailyBookCheckInVacanciesTable.id }).from(dailyBookCheckInVacanciesTable).where(and(eq(dailyBookCheckInVacanciesTable.assignmentId, assignment.id), eq(dailyBookCheckInVacanciesTable.active, true))).limit(1);
      if (!open) await tx.insert(dailyBookCheckInVacanciesTable).values({ dailyBookId, assignmentId: assignment.id, checkInId });
    } else {
      await tx.update(dailyBookAssignmentsTable).set({ status: "ASSIGNED", updatedAt: new Date() }).where(eq(dailyBookAssignmentsTable.id, assignment.id));
      await tx.update(dailyBookCheckInVacanciesTable).set({ active: false, resolvedBy: actorId, resolvedAt: new Date() }).where(and(eq(dailyBookCheckInVacanciesTable.assignmentId, assignment.id), eq(dailyBookCheckInVacanciesTable.active, true)));
    }
  }
}

router.post("/day-checkins", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const scaleId = typeof body.scaleId === "string" ? body.scaleId : "", sourceKey = typeof body.sourceKey === "string" ? body.sourceKey : "", userId = typeof body.userId === "string" ? body.userId : actor.sub;
  const status = ["CHECKED_IN", "LATE", "ABSENT", "EXCUSED"].includes(String(body.status)) ? String(body.status) as "CHECKED_IN" | "LATE" | "ABSENT" | "EXCUSED" : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : null, etaMinutes = body.etaMinutes === undefined ? null : Number(body.etaMinutes);
  if (!scaleId || !sourceKey || !status || ((status === "ABSENT" || status === "EXCUSED") && !reason) || (etaMinutes !== null && (!Number.isInteger(etaMinutes) || etaMinutes < 0))) { res.status(400).json({ error: "Bad Request", message: "Check-in inválido; falta ou dispensa exige motivo." }); return; }
  if (!isAdmin(actor.role) && !isSupervisor(actor.role) && (userId !== actor.sub || (status !== "CHECKED_IN" && status !== "LATE"))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [scaleRow] = await db.select({ scale: scalesTable }).from(scalesTable).innerJoin(locationsTable, eq(scalesTable.locationId, locationsTable.id)).where(and(eq(scalesTable.id, scaleId), eq(locationsTable.organizationId, actor.organizationId))).limit(1);
  const scale = scaleRow?.scale;
  const locationAllowed = isAdmin(actor.role) || isSupervisor(actor.role) ? await assertLocationScope(actor, scale?.locationId ?? "") : userId === actor.sub;
  if (!scale || !scale.locationId || !locationAllowed || !(await ownsPerson(actor, userId))) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!canReadManagement(actor.role) && !["PUBLISHED", "REPUBLISHED"].includes(scale.status)) { res.status(403).json({ error: "Forbidden", message: "O Elenco só registra presença em escala publicada." }); return; }
  const date = typeof body.date === "string" ? body.date : scale.periodStart;
  const dia = await montarEscalaDoDia(actor.organizationId, scale.locationId, date);
  const block = dia?.blocos.find((item) => item.key === sourceKey && item.pessoaIds.includes(userId));
  if (!block) { res.status(400).json({ error: "Bad Request", message: "A pessoa não está convocada neste bloco." }); return; }
  const checkIn = await db.transaction(async (tx) => {
    const [saved] = await tx.insert(dayCheckInsTable).values({ scaleId, sourceKey, userId, status, reason, etaMinutes, checkedInAt: status === "CHECKED_IN" ? new Date() : null, registeredBy: actor.sub }).onConflictDoUpdate({ target: [dayCheckInsTable.scaleId, dayCheckInsTable.sourceKey, dayCheckInsTable.userId], set: { status, reason, etaMinutes, checkedInAt: status === "CHECKED_IN" ? new Date() : null, registeredBy: actor.sub, updatedAt: new Date() } }).returning();
    if (block.dailyBookId) await setAssignmentRisk(tx, block.dailyBookId, userId, saved.id, status === "ABSENT" || status === "EXCUSED", actor.sub);
    await record({ category: "CHECK_IN", action: `checkin.${status.toLowerCase()}`, title: "Check-in atualizado", narrative: `Check-in ${status} no bloco ${block.rotulo}.`, entityType: "day_checkin", entityId: saved.id, actorId: actor.sub, beforeState: null, afterState: saved, metadata: reason ? { reason } : {} }, tx);
    return saved;
  });
  res.json({ checkIn, vacancy: status === "ABSENT" || status === "EXCUSED" });
});

/** Job ou ação da Supervisão: passado o limite, a posição fica em risco sem apagar a convocação. */
router.post("/day-checkins/reconcile", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, { locationId, date = operationalDate() } = req.body as { locationId?: string; date?: string };
  if (!locationId || !canReadManagement(actor.role) || !(await assertLocationScope(actor, locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const dia = await montarEscalaDoDia(actor.organizationId, locationId, date);
  if (!dia?.escala) { res.json({ marked: 0 }); return; }
  const now = new Date(); let marked = 0;
  for (const block of dia.blocos.filter((item) => item.dailyBookId)) {
    const [hour, minute] = block.inicio.split(":").map(Number); const deadline = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`); deadline.setMinutes(deadline.getMinutes() - 15);
    if (now < deadline) continue;
    const existing = await db.select().from(dayCheckInsTable).where(and(eq(dayCheckInsTable.scaleId, dia.escala.id), eq(dayCheckInsTable.sourceKey, block.key)));
    for (const userId of block.pessoaIds.filter((id) => !existing.some((row) => row.userId === id && (row.status === "CHECKED_IN" || row.status === "LATE")))) {
      const saved = await db.transaction(async (tx) => {
        const [created] = await tx.insert(dayCheckInsTable).values({ scaleId: dia.escala!.id, sourceKey: block.key, userId, status: "ABSENT", reason: "Sem check-in até o horário limite", registeredBy: actor.sub }).onConflictDoNothing().returning();
        if (!created) return null;
        await setAssignmentRisk(tx, block.dailyBookId!, userId, created.id, true, actor.sub);
        await record({ category: "CHECK_IN", action: "checkin.deadline_missed", title: "Check-in não realizado", narrative: `Sem check-in até o limite do bloco ${block.rotulo}.`, entityType: "day_checkin", entityId: created.id, actorId: actor.sub, beforeState: null, afterState: created, metadata: { reason: created.reason } }, tx);
        return created;
      });
      if (saved) marked++;
    }
  }
  res.json({ marked });
});

// ─── Painel: contagens derivadas; nunca devolve motivo ou ocorrência nominal ──

router.get("/panel-indicators", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  if (!canReadManagement(actor.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const date = typeof req.query.date === "string" ? req.query.date : operationalDate();
  const locations = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false)));
  const scopes = isSupervisor(actor.role) ? await listAreaLocalScopes(actor.sub, actor.organizationId) : [];
  const allowedLocations = isSupervisor(actor.role) ? locations.filter((location) => scopes.some((scope) => scope.locationId === location.id)) : locations;
  let expected = 0, checkedIn = 0, late = 0, absent = 0, vacant = 0, draftScales = 0;
  for (const location of allowedLocations) {
    const dia = await montarEscalaDoDia(actor.organizationId, location.id, date);
    if (!dia?.escala) continue;
    if (dia.escala.status === "DRAFT") draftScales++;
    const allowedAreas = isSupervisor(actor.role) ? new Set(scopes.filter((scope) => scope.locationId === location.id).map((scope) => scope.areaId)) : null;
    const eligible = new Set(dia.pessoas.filter((person) => !allowedAreas || (person.areaId && allowedAreas.has(person.areaId))).map((person) => person.id));
    const invited = [...new Set(dia.blocos.flatMap((block) => block.pessoaIds).filter((id) => eligible.has(id)))];
    expected += invited.length;
    const rows = await db.select().from(dayCheckInsTable).where(eq(dayCheckInsTable.scaleId, dia.escala.id));
    for (const row of rows.filter((row) => eligible.has(row.userId))) {
      if (row.status === "CHECKED_IN") checkedIn++;
      else if (row.status === "LATE") late++;
      else if (row.status === "ABSENT" || row.status === "EXCUSED") absent++;
    }
  }
  // Vagas não podem escapar do recorte: o Livro aponta para a Escala do local,
  // e a designação aponta para a área da pessoa. O Painel só devolve a contagem.
  const locationIds = allowedLocations.map((location) => location.id);
  const booksInScope = locationIds.length ? await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable)
    .innerJoin(scalesTable, eq(dailyBooksTable.scaleId, scalesTable.id))
    .where(inArray(scalesTable.locationId, locationIds)) : [];
  const bookIds = booksInScope.map((book) => book.id);
  if (bookIds.length) {
    const rows = await db.select({ id: dailyBookCheckInVacanciesTable.id, areaId: usersTable.areaId }).from(dailyBookCheckInVacanciesTable)
      .innerJoin(dailyBookAssignmentsTable, eq(dailyBookCheckInVacanciesTable.assignmentId, dailyBookAssignmentsTable.id))
      .leftJoin(usersTable, eq(dailyBookAssignmentsTable.userId, usersTable.id))
      .where(and(eq(dailyBookCheckInVacanciesTable.active, true), inArray(dailyBookCheckInVacanciesTable.dailyBookId, bookIds)));
    const allowedAreaIds = isSupervisor(actor.role) ? new Set(scopes.map((scope) => scope.areaId)) : null;
    vacant = rows.filter((row) => !allowedAreaIds || (row.areaId && allowedAreaIds.has(row.areaId))).length;
  }
  const leaveRows = await db.select({ id: leaveRequestsTable.id, areaId: leaveRequestsTable.areaId }).from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, actor.organizationId), eq(leaveRequestsTable.status, "APPROVED"), lte(leaveRequestsTable.startDate, date), gte(leaveRequestsTable.endDate, date)));
  const scopedLeaves = isSupervisor(actor.role) ? leaveRows.filter((row) => row.areaId && scopes.some((scope) => scope.areaId === row.areaId)) : leaveRows;
  res.json({
    date,
    scope: isSupervisor(actor.role) ? "area" : "organization",
    coverage: { expected, checkedIn, pct: expected ? Math.round((checkedIn / expected) * 100) : 100 },
    checkIns: { checkedIn, late, absent },
    leaves: { approved: scopedLeaves.length },
    vacancies: { open: vacant },
    scales: { drafts: draftScales },
  });
});

export default router;
