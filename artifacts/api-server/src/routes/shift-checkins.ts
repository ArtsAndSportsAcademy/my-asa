import { Router, type IRouter } from "express";
import { and, asc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db, operationalCheckInsTable, shiftsTable, usersTable, areaLocalSupervisorsTable, locationsTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";
import { answerShift, configureShifts, displayedShiftState, ShiftError, shiftManager, shiftPlans, shiftsForDate, validShiftDate, visibleShiftPlans } from "../services/shift-checkins.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { validateShiftSchedule } from "../services/checkin-shift-schedule.js";

const router: IRouter = Router();
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

router.get("/shift-checkins/contact", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  const [person] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(and(eq(usersTable.id, actor.sub), eq(usersTable.organizationId, actor.organizationId)));
  if (!person?.areaId) { res.json({ contacts: [] }); return; }
  const supervisors = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, privacy: usersTable.privacidade, visibility: usersTable.contactVisibility }).from(areaLocalSupervisorsTable)
    .innerJoin(usersTable, eq(usersTable.id, areaLocalSupervisorsTable.supervisorId))
    .innerJoin(locationsTable, eq(locationsTable.id, areaLocalSupervisorsTable.locationId))
    .where(and(eq(areaLocalSupervisorsTable.areaId, person.areaId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.organizationId, actor.organizationId), eq(usersTable.status, "ACTIVE"), eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false)));
  const seen = new Set<string>();
  const contacts = supervisors.filter(s => {
    if (!s.phone || seen.has(s.id) || !s.visibility.phone || !["grupo", "asa"].includes(s.privacy.tel)) return false;
    seen.add(s.id); return true;
  }).map(({ name, phone }) => ({ name, phone }));
  res.json({ contacts });
});

router.get("/shift-checkins/configuration", requireAuth, requireOrganization, async (req, res) => {
  const today = operationalDate();
  const current = await shiftsForDate(req.user!.organizationId, today);
  const next = await shiftsForDate(req.user!.organizationId, shiftOperationalDate(today, 1));
  res.json({ current, next, effectiveFrom: shiftOperationalDate(today, 1), gaps: next.length ? validateShiftSchedule(next).gaps : [] });
});
router.put("/shift-checkins/configuration", requireAuth, requireOrganization, async (req, res, next) => {
  if (req.user!.role !== "ADMIN") { res.status(403).json({ message: "Somente a Administração configura turnos." }); return; }
  const shifts: unknown = req.body?.shifts;
  if (!Array.isArray(shifts) || !shifts.every(s => s && typeof s.name === "string" && typeof s.startTime === "string" && typeof s.endTime === "string")) { res.status(400).json({ message: "Informe de 1 a 3 turnos com nome e horários." }); return; }
  try {
    try { validateShiftSchedule(shifts); } catch (error) { throw new ShiftError(400, (error as Error).message); }
    res.json(await configureShifts(req.user!, shifts));
  } catch (error) { if (error instanceof ShiftError) res.status(error.status).json({ message: error.message }); else next(error); }
});
router.get("/shift-checkins", requireAuth, requireOrganization, async (req, res, next) => {
  try {
  const actor = req.user!, date = typeof req.query.date === "string" ? req.query.date : operationalDate();
  if (!validShiftDate(date)) { res.status(400).json({ message: "Data inválida." }); return; }
  const now = new Date();
  const previous = shiftOperationalDate(date, -1);
  const beginning = new Date(`${date}T00:00:00-03:00`);
  const prior = (await shiftPlans(actor.organizationId, previous)).filter(plan => plan.closesAt > beginning);
  const plans = await visibleShiftPlans(actor, [...prior, ...await shiftPlans(actor.organizationId, date)]);
  const scopes = ["SUPERVISOR_A", "SUPERVISOR_B", "SUP"].includes(actor.role) ? await listAreaLocalScopes(actor.sub, actor.organizationId) : [];
  const records = await db.select().from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.orgId, actor.organizationId), gte(operationalCheckInsTable.date, previous), lte(operationalCheckInsTable.date, date), isNotNull(operationalCheckInsTable.shiftId)));
  const items = plans.map(plan => {
    const checkIn = records.find(row => row.userId === plan.userId && row.shiftId === plan.shiftId && row.date === plan.date);
    const activities = scopes.length ? plan.activities.filter(activity => scopes.some(scope => scope.areaId === plan.areaId && scope.locationId === activity.locationId)) : plan.activities;
    return { ...plan, activities, checkIn: checkIn ? { ...checkIn, activities } : null, state: displayedShiftState(checkIn, plan.closesAt, now), canAnswer: now >= plan.opensAt && now < plan.closesAt && !["DIR", "DIRECTOR"].includes(actor.role) && (!checkIn || ["EXPECTED", "LATE"].includes(checkIn.shiftState!)) };
  });
  const summary = [...new Map(items.map(item => [`${item.date}:${item.shiftId}`, item])).values()].map(shift => ({
    date: shift.date, shiftId: shift.shiftId, shiftName: shift.shiftName, startTime: shift.startTime, endTime: shift.endTime,
    counts: Object.fromEntries(["EXPECTED", "ARRIVED", "LATE", "ABSENT", "NO_RESPONSE", "LATE_UNCONFIRMED"].map(state => [state, items.filter(item => item.shiftId === shift.shiftId && item.date === shift.date && item.state === state).length])),
  }));
  res.json({ date, configured: (await shiftsForDate(actor.organizationId, date)).length > 0, items: ["DIR", "DIRECTOR"].includes(actor.role) ? [] : items, summary });
  } catch (error) { if (error instanceof ShiftError) res.status(error.status).json({ message: error.message }); else next(error); }
});
router.post("/shift-checkins", requireAuth, requireOrganization, async (req, res, next) => {
  const body = req.body;
  if (!body || typeof body.date !== "string" || !validShiftDate(body.date) || !uuid(body.shiftId) || (body.userId !== undefined && !uuid(body.userId)) || !["READY", "LATE", "ABSENT", "ARRIVED"].includes(body.action) || (body.reason !== undefined && typeof body.reason !== "string") || (body.reasonCode !== undefined && typeof body.reasonCode !== "string")) { res.status(400).json({ message: "Dados do check-in inválidos." }); return; }
  try { res.json({ checkIn: await answerShift(req.user!, { date: body.date, shiftId: body.shiftId, userId: body.userId ?? req.user!.sub, action: body.action, etaMinutes: body.etaMinutes, reasonCode: body.reasonCode, reason: body.reason }) }); }
  catch (error) { if (error instanceof ShiftError) res.status(error.status).json({ message: error.message }); else next(error); }
});
router.get("/shift-checkins/history", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, today = operationalDate();
  const from = typeof req.query.from === "string" ? req.query.from : today.slice(0, 8) + "01";
  const to = typeof req.query.to === "string" ? req.query.to : today;
  if (!validShiftDate(from) || !validShiftDate(to) || from > to || Date.parse(to) - Date.parse(from) > 92 * 86400000) { res.status(400).json({ message: "Consulte um período de até 93 dias." }); return; }
  const rows = await db.select({ checkIn: operationalCheckInsTable, name: usersTable.name, areaId: usersTable.areaId, shiftName: shiftsTable.name }).from(operationalCheckInsTable).innerJoin(usersTable, eq(usersTable.id, operationalCheckInsTable.userId)).innerJoin(shiftsTable, eq(shiftsTable.id, operationalCheckInsTable.shiftId)).where(and(eq(operationalCheckInsTable.orgId, actor.organizationId), gte(operationalCheckInsTable.date, from), lte(operationalCheckInsTable.date, to))).orderBy(asc(operationalCheckInsTable.date));
  const scopes = shiftManager(actor.role) && !["ADMIN", "DIR", "DIRECTOR"].includes(actor.role) ? await listAreaLocalScopes(actor.sub, actor.organizationId) : [];
  const visible = rows.filter(row => ["ADMIN", "DIR", "DIRECTOR"].includes(actor.role) || row.checkIn.userId === actor.sub || scopes.some(scope => scope.areaId === row.areaId && row.checkIn.activities.some(activity => activity.locationId === scope.locationId)));
  if (["DIR", "DIRECTOR"].includes(actor.role)) {
    const dates = [...new Set(visible.map(row => row.checkIn.date))];
    const aggregate = dates.map(date => ({ date, counts: Object.fromEntries(["ARRIVED", "LATE", "ABSENT", "NO_RESPONSE", "LATE_UNCONFIRMED"].map(state => [state, visible.filter(row => row.checkIn.date === date && row.checkIn.shiftState === state).length])) }));
    res.json({ records: [], aggregate }); return;
  }
  res.json({ records: visible.map(row => ({ ...row, checkIn: { ...row.checkIn, activities: actor.role === "ADMIN" || row.checkIn.userId === actor.sub ? row.checkIn.activities : row.checkIn.activities.filter(activity => scopes.some(scope => scope.areaId === row.areaId && scope.locationId === activity.locationId)) } })) });
});

export default router;
