import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db, shiftsTable, organizationsTable, operationsTable, scalesTable, locationsTable, usersTable, operationalCheckInsTable, dayCheckInsTable, dailyBookAssignmentsTable, dailyBookCheckInVacanciesTable, areaLocalSupervisorsTable, dailyBooksTable, showBooksTable, type ShiftActivitySnapshot } from "@workspace/db";
import { operationalDate, shiftOperationalDate, OPERATIONAL_TIME_ZONE } from "../lib/operational-date.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { comoPublicada, montarEscalaDoDia, escalaPublicada } from "./escala-dia.js";
import { listAreaLocalScopes } from "./area-local-scope.js";
import { enqueueNotification } from "./undo.js";
import { assignActivityToShift, shiftCheckInWindow, validateShiftSchedule, type ShiftScheduleInput } from "./checkin-shift-schedule.js";

type Exec = Pick<typeof db, "select" | "insert" | "update" | "execute">;
export type ShiftActor = { sub: string; organizationId: string; role: string };
export const shiftManager = (role: string) => ["ADMIN", "DIR", "DIRECTOR", "SUPERVISOR_A", "SUPERVISOR_B", "SUP"].includes(role);
export const shiftSupervisor = (role: string) => ["SUPERVISOR_A", "SUPERVISOR_B", "SUP"].includes(role);
export class ShiftError extends Error { constructor(public status: number, message: string) { super(message); } }
export function validShiftDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}

export async function shiftsForDate(orgId: string, date: string, executor: Exec = db) {
  return executor.select().from(shiftsTable).where(and(eq(shiftsTable.organizationId, orgId), eq(shiftsTable.active, true), lte(shiftsTable.effectiveFrom, date), or(isNull(shiftsTable.effectiveTo), gte(shiftsTable.effectiveTo, date)))).orderBy(asc(shiftsTable.startTime));
}

export async function configureShifts(actor: ShiftActor, input: readonly ShiftScheduleInput[], now = new Date()) {
  if (actor.role !== "ADMIN") throw new ShiftError(403, "Somente a Administração configura turnos.");
  const validated = validateShiftSchedule(input);
  const today = operationalDate(now), effectiveFrom = shiftOperationalDate(today, 1);
  return db.transaction(async tx => {
    await tx.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.id, actor.organizationId)).for("update");
    const before = await shiftsForDate(actor.organizationId, effectiveFrom, tx);
    // Substituições do agendamento de amanhã são lógicas; versões antigas continuam legíveis.
    await tx.update(shiftsTable).set({ active: false, updatedAt: now }).where(and(eq(shiftsTable.organizationId, actor.organizationId), eq(shiftsTable.active, true), gte(shiftsTable.effectiveFrom, effectiveFrom)));
    await tx.update(shiftsTable).set({ effectiveTo: today, updatedAt: now }).where(and(eq(shiftsTable.organizationId, actor.organizationId), eq(shiftsTable.active, true), lte(shiftsTable.effectiveFrom, today), or(isNull(shiftsTable.effectiveTo), gte(shiftsTable.effectiveTo, effectiveFrom))));
    const shifts = await tx.insert(shiftsTable).values(validated.shifts.map(shift => ({ ...shift, organizationId: actor.organizationId, effectiveFrom }))).returning();
    await writeHistoryEvent({ category: "CHECK_IN", action: "checkin.shifts_configured", title: "Turnos configurados", narrative: `Configuração global com vigência em ${effectiveFrom}.`, entityType: "shift", entityId: shifts[0]!.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: { shifts: before }, afterState: { shifts }, metadata: { effectiveFrom, gaps: validated.gaps } }, tx);
    return { shifts, effectiveFrom, gaps: validated.gaps };
  });
}

/** Converte data/minutos civis usando o fuso da operação, sem depender do TZ do servidor. */
export function shiftInstant(date: string, minute: number): Date {
  const target = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: OPERATIONAL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const p = (key: string) => parts.find(part => part.type === key)!.value;
    const localAsUtc = Date.parse(`${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}Z`);
    instant += target - localAsUtc;
  }
  return new Date(instant);
}

export type ShiftPlan = {
  shiftId: string; shiftName: string; startTime: string; endTime: string; date: string;
  userId: string; userName: string; areaId: string | null; operationId: string;
  lateThresholdMinutes: number; activities: ShiftActivitySnapshot[];
  opensAt: Date; firstActivityAt: Date; closesAt: Date; extended: boolean;
};

/** Uma ocorrência global por pessoa/data/turno, mesmo que haja vários locais. */
export async function shiftPlans(orgId: string, date: string): Promise<ShiftPlan[]> {
  const shifts = await shiftsForDate(orgId, date);
  if (!shifts.length) return [];
  const plans = new Map<string, Omit<ShiftPlan, "opensAt" | "firstActivityAt" | "closesAt" | "extended">>();
  for (const activityDate of [date, shiftOperationalDate(date, 1)]) {
    const places = await db.selectDistinct({ id: locationsTable.id }).from(scalesTable)
      .innerJoin(locationsTable, eq(scalesTable.locationId, locationsTable.id))
      .where(and(eq(locationsTable.organizationId, orgId), eq(locationsTable.closed, false), inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), lte(scalesTable.periodStart, activityDate), gte(scalesTable.periodEnd, activityDate)));
    for (const place of places) {
      const aoVivo = await montarEscalaDoDia(orgId, place.id, activityDate, { publishedOnly: true });
      if (!aoVivo?.escala || !escalaPublicada(aoVivo.escala.status)) continue;
      // Quem faz check-in é quem está na versão publicada: troca feita depois só vale quando a Administração republica.
      const day = await comoPublicada(aoVivo);
      const escalaId = aoVivo.escala.id;
      const [scale] = await db.select({ operationId: scalesTable.operationId, threshold: operationsTable.lateThresholdMinutes }).from(scalesTable).innerJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id)).where(and(eq(scalesTable.id, escalaId), eq(operationsTable.organizationId, orgId)));
      if (!scale) continue;
      for (const block of day.blocos) {
        const assignment = assignActivityToShift(shifts, block.inicio.slice(0, 5));
        const occurrenceDate = shiftOperationalDate(activityDate, assignment.startDayOffset);
        if (occurrenceDate !== date) continue;
        const shift = shifts[assignment.shiftIndex]!;
        for (const userId of block.pessoaIds) {
          const person = day.pessoas.find(p => p.id === userId);
          if (!person) continue;
          const key = `${userId}:${shift.id}`;
          let plan = plans.get(key);
          if (!plan) {
            plan = { shiftId: shift.id, shiftName: shift.name, startTime: shift.startTime, endTime: shift.endTime, date, userId, userName: person.name, areaId: person.areaId, operationId: scale.operationId, lateThresholdMinutes: scale.threshold, activities: [] };
            plans.set(key, plan);
          }
          plan.activities.push({ key: block.key, scaleId: escalaId, locationId: place.id, locationName: day.location.name, label: block.rotulo, date: activityDate, startTime: block.inicio.slice(0, 5), endTime: block.fim?.slice(0, 5) ?? null, dailyBookId: block.dailyBookId });
        }
      }
    }
  }
  const result: ShiftPlan[] = [];
  for (const plan of plans.values()) {
    plan.activities.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
    // Um bloco sem fim explícito não autoriza inventar uma duração: cobre até
    // o encerramento configurado. Intervalo sem turno exige corrigir o horário.
    const index = shifts.findIndex(s => s.id === plan.shiftId);
    const timed = plan.activities.map(a => {
      if (!a.endTime && assignActivityToShift(shifts, a.startTime).inGap) {
        throw new ShiftError(409, "Atividade no intervalo sem turno precisa de horário de fim na Escala.");
      }
      return { startTime: a.startTime, endTime: a.endTime ?? plan.endTime };
    });
    const window = shiftCheckInWindow(shifts, index, timed)!;
    result.push({ ...plan, opensAt: shiftInstant(date, window.opensAtMinute), firstActivityAt: shiftInstant(date, window.firstActivityMinute), closesAt: shiftInstant(date, window.closesAtMinute), extended: window.extended });
  }
  return result;
}

export async function visibleShiftPlans(actor: ShiftActor, plans: ShiftPlan[]) {
  if (["ADMIN", "DIR", "DIRECTOR"].includes(actor.role)) return plans;
  if (!shiftSupervisor(actor.role)) return plans.filter(plan => plan.userId === actor.sub);
  const scopes = await listAreaLocalScopes(actor.sub, actor.organizationId);
  return plans.filter(plan => scopes.some(s => s.areaId === plan.areaId && plan.activities.some(a => a.locationId === s.locationId)));
}

type CheckInRow = typeof operationalCheckInsTable.$inferSelect;
export function displayedShiftState(row: CheckInRow | undefined, closesAt: Date, now: Date) {
  const state = row?.shiftState ?? "EXPECTED";
  if (now >= closesAt && state === "EXPECTED") return "NO_RESPONSE";
  if (now >= closesAt && state === "LATE") return "LATE_UNCONFIRMED";
  return state;
}

/** Compatibilidade só como projeção: uma resposta por turno cobre todos os blocos. */
async function projectShift(tx: Exec, plan: ShiftPlan, row: CheckInRow, actorId?: string) {
  for (const activity of plan.activities) {
    const reason = row.status === "ABSENT" ? [row.reasonCode, row.excuseReason].filter(Boolean).join(" · ") : row.excuseReason;
    const [projected] = await tx.insert(dayCheckInsTable).values({ scaleId: activity.scaleId, sourceKey: activity.key, userId: plan.userId, status: row.status, checkedInAt: row.checkedInAt, etaMinutes: row.etaMinutes, reason, registeredBy: actorId ?? null }).onConflictDoUpdate({ target: [dayCheckInsTable.scaleId, dayCheckInsTable.sourceKey, dayCheckInsTable.userId], set: { status: row.status, checkedInAt: row.checkedInAt, etaMinutes: row.etaMinutes, reason, registeredBy: actorId ?? null, updatedAt: new Date() } }).returning();
    if (!activity.dailyBookId) continue;
    const assignments = await tx.select().from(dailyBookAssignmentsTable).where(and(eq(dailyBookAssignmentsTable.dailyBookId, activity.dailyBookId), eq(dailyBookAssignmentsTable.userId, plan.userId), inArray(dailyBookAssignmentsTable.status, ["ASSIGNED", "AT_RISK"])));
    for (const assignment of assignments) {
      const [vacancy] = await tx.select().from(dailyBookCheckInVacanciesTable).where(and(eq(dailyBookCheckInVacanciesTable.assignmentId, assignment.id), eq(dailyBookCheckInVacanciesTable.active, true)));
      if (row.shiftState === "ABSENT") {
        await tx.update(dailyBookAssignmentsTable).set({ status: "AT_RISK", updatedAt: new Date() }).where(eq(dailyBookAssignmentsTable.id, assignment.id));
        if (!vacancy) await tx.insert(dailyBookCheckInVacanciesTable).values({ dailyBookId: activity.dailyBookId, assignmentId: assignment.id, checkInId: projected!.id });
      } else if (row.shiftState === "ARRIVED" && vacancy?.checkInId === projected!.id) {
        await tx.update(dailyBookCheckInVacanciesTable).set({ active: false, resolvedBy: actorId ?? null, resolvedAt: new Date() }).where(eq(dailyBookCheckInVacanciesTable.id, vacancy.id));
        await tx.update(dailyBookAssignmentsTable).set({ status: "ASSIGNED", updatedAt: new Date() }).where(eq(dailyBookAssignmentsTable.id, assignment.id));
      }
    }
  }
}

async function notifyShiftAbsence(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], plan: ShiftPlan, checkInId: string, orgId: string, now: Date) {
  const recipients = new Set<string>();
  if (plan.areaId) {
    const locations = [...new Set(plan.activities.map(activity => activity.locationId))];
    const supervisors = await tx.select({ id: areaLocalSupervisorsTable.supervisorId }).from(areaLocalSupervisorsTable)
      .innerJoin(usersTable, eq(usersTable.id, areaLocalSupervisorsTable.supervisorId))
      .where(and(eq(areaLocalSupervisorsTable.areaId, plan.areaId), inArray(areaLocalSupervisorsTable.locationId, locations), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
    for (const supervisor of supervisors) recipients.add(supervisor.id);
  }
  const dailyBookIds = [...new Set(plan.activities.map(activity => activity.dailyBookId).filter((id): id is string => !!id))];
  if (dailyBookIds.length) {
    const responsible = await tx.select({ id: showBooksTable.responsibleId }).from(dailyBooksTable)
      .innerJoin(showBooksTable, eq(showBooksTable.id, dailyBooksTable.showBookId))
      .innerJoin(usersTable, eq(usersTable.id, showBooksTable.responsibleId))
      .where(and(inArray(dailyBooksTable.id, dailyBookIds), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
    for (const owner of responsible) if (owner.id) recipients.add(owner.id);
  }
  // Blocos manuais não têm Livro do Show: quem publicou (ou criou) a Escala
  // é o responsável operacional disponível para receber o aviso.
  const manualScaleIds = [...new Set(plan.activities.filter(activity => !activity.dailyBookId).map(activity => activity.scaleId))];
  if (manualScaleIds.length) {
    const publishers = await tx.select({ publishedBy: scalesTable.publishedBy, createdBy: scalesTable.createdBy }).from(scalesTable)
      .innerJoin(operationsTable, eq(operationsTable.id, scalesTable.operationId))
      .where(and(inArray(scalesTable.id, manualScaleIds), eq(operationsTable.organizationId, orgId)));
    for (const publisher of publishers) recipients.add(publisher.publishedBy ?? publisher.createdBy);
  }
  recipients.delete(plan.userId);
  if (!recipients.size) return;
  const activeRecipients = await tx.select({ id: usersTable.id }).from(usersTable).where(and(inArray(usersTable.id, [...recipients]), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
  for (const { id: userId } of activeRecipients) await enqueueNotification(tx, {
    userId, type: "checkin.shift_absence", title: "Falta avisada no turno",
    message: `${plan.userName} avisou falta no turno ${plan.shiftName}. Confira a cobertura na Escala.`,
    priority: "IMPORTANT", category: "absence", entityType: "check_in", entityId: checkInId, actionUrl: "/escalas",
  }, now, { deduplicationKey: `shift-absence:${checkInId}:${userId}` });
}

export async function answerShift(actor: ShiftActor, input: { date: string; shiftId: string; userId: string; action: "READY" | "LATE" | "ABSENT" | "ARRIVED"; etaMinutes?: number; reasonCode?: string; reason?: string }, now = new Date()) {
  if (["DIR", "DIRECTOR"].includes(actor.role)) throw new ShiftError(403, "A Direção tem acesso de leitura.");
  if (!shiftManager(actor.role) && input.userId !== actor.sub) throw new ShiftError(403, "Registre somente seu check-in.");
  if (input.action === "LATE" && (!Number.isInteger(input.etaMinutes) || input.etaMinutes! < 1 || input.etaMinutes! > 1440)) throw new ShiftError(400, "Informe a previsão em minutos (1 a 1440).");
  if (input.action === "ABSENT" && (!["ILLNESS", "PERSONAL", "TRANSPORT", "OTHER"].includes(input.reasonCode ?? "") || (input.reasonCode === "OTHER" && !input.reason?.trim()))) throw new ShiftError(400, "Escolha o motivo; outro motivo exige uma descrição.");
  if ((input.reason?.length ?? 0) > 2000) throw new ShiftError(400, "Use até 2000 caracteres no motivo.");
  return db.transaction(async tx => {
    // Serializa duas respostas concorrentes da pessoa, mesmo em locais diferentes.
    const [person] = await tx.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, input.userId), eq(usersTable.organizationId, actor.organizationId))).for("update");
    if (!person) throw new ShiftError(404, "Pessoa não encontrada.");
    const plans = await visibleShiftPlans(actor, await shiftPlans(actor.organizationId, input.date));
    const plan = plans.find(p => p.userId === input.userId && p.shiftId === input.shiftId);
    if (!plan) throw new ShiftError(403, "Não há atividade publicada neste turno dentro do seu acesso.");
    if (now < plan.opensAt || now >= plan.closesAt) throw new ShiftError(409, "O check-in está fora da janela deste turno.");
    const [before] = await tx.select().from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.userId, input.userId), eq(operationalCheckInsTable.date, input.date), eq(operationalCheckInsTable.shiftId, input.shiftId)));
    if (before?.shiftState === "ARRIVED" || before?.shiftState === "ABSENT" || before?.closedAt) throw new ShiftError(409, "Este check-in já foi concluído.");
    if (input.action === "ARRIVED" && before?.shiftState !== "LATE") throw new ShiftError(409, "Não há aviso de atraso aguardando chegada.");
    const arrived = input.action === "READY" || input.action === "ARRIVED";
    const lateArrival = arrived && now.getTime() > plan.firstActivityAt.getTime() + plan.lateThresholdMinutes * 60_000;
    const shiftState = arrived ? "ARRIVED" as const : input.action === "ABSENT" ? "ABSENT" as const : "LATE" as const;
    const values = { orgId: actor.organizationId, operationId: plan.operationId, userId: input.userId, date: input.date, shiftId: input.shiftId, shiftState, status: arrived ? (lateArrival ? "LATE" as const : "CHECKED_IN" as const) : input.action === "ABSENT" ? "ABSENT" as const : "LATE" as const, checkedInAt: arrived ? now : null, registeredBy: actor.sub, etaMinutes: input.action === "LATE" ? input.etaMinutes : before?.etaMinutes ?? null, reasonCode: input.reasonCode ?? before?.reasonCode ?? null, excuseReason: input.reason?.trim() || before?.excuseReason || null, reportedAt: before?.reportedAt ?? now, lateArrival, opensAt: plan.opensAt, firstActivityAt: plan.firstActivityAt, closesAt: plan.closesAt, activities: plan.activities, updatedAt: now };
    const [saved] = await tx.insert(operationalCheckInsTable).values(values).onConflictDoUpdate({ target: [operationalCheckInsTable.userId, operationalCheckInsTable.date, operationalCheckInsTable.shiftId], set: values }).returning();
    await projectShift(tx, plan, saved!, actor.sub);
    if (shiftState === "ABSENT") await notifyShiftAbsence(tx, plan, saved!.id, actor.organizationId, now);
    await writeHistoryEvent({ category: "CHECK_IN", action: `checkin.shift_${shiftState.toLowerCase()}`, title: "Check-in do turno", narrative: `${plan.userName}: ${shiftState} no turno ${plan.shiftName}.`, entityType: "check_in", entityId: saved!.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: before ?? null, afterState: saved! }, tx);
    return saved!;
  });
}

/** Fecha sem resposta e atraso sem chegada, sem convertê-los em falta. */
export async function reconcileShiftCheckIns(now = new Date(), organizationId?: string) {
  const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(organizationId ? eq(organizationsTable.id, organizationId) : undefined);
  let closed = 0;
  for (const org of orgs) {
    // O aviso de atraso já gravado deve fechar mesmo se a escala publicada
    // for retirada depois do aviso; não depende da convocação ao vivo.
    const pending = await db.select().from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.orgId, org.id), isNotNull(operationalCheckInsTable.shiftId), isNull(operationalCheckInsTable.closedAt), lte(operationalCheckInsTable.closesAt, now)));
    for (const record of pending) {
      await db.transaction(async tx => {
        await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, record.userId)).for("update");
        const [before] = await tx.select().from(operationalCheckInsTable).where(eq(operationalCheckInsTable.id, record.id));
        if (!before || before.closedAt || !before.closesAt || before.closesAt > now) return;
        const state = displayedShiftState(before, before.closesAt, now);
        const [saved] = await tx.update(operationalCheckInsTable).set({ shiftState: state, closedAt: now, updatedAt: now }).where(eq(operationalCheckInsTable.id, before.id)).returning();
        await writeHistoryEvent({ category: "CHECK_IN", action: "checkin.shift_closed", title: "Turno encerrado", narrative: `${state}.`, entityType: "check_in", entityId: before.id, actorType: "DETERMINISTIC_ENGINE", orgId: org.id, beforeState: before, afterState: saved! }, tx);
        closed++;
      });
    }
    for (const date of [shiftOperationalDate(operationalDate(now), -1), operationalDate(now)]) {
      for (const plan of await shiftPlans(org.id, date)) {
        if (now < plan.closesAt) continue;
        await db.transaction(async tx => {
          await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, plan.userId)).for("update");
          const [before] = await tx.select().from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.userId, plan.userId), eq(operationalCheckInsTable.date, date), eq(operationalCheckInsTable.shiftId, plan.shiftId)));
          if (before?.closedAt) return;
          const state = displayedShiftState(before, plan.closesAt, now);
          const values = { orgId: org.id, operationId: plan.operationId, userId: plan.userId, date, shiftId: plan.shiftId, shiftState: state, status: before?.status ?? "EXPECTED" as const, closedAt: now, opensAt: plan.opensAt, firstActivityAt: plan.firstActivityAt, closesAt: plan.closesAt, activities: plan.activities, updatedAt: now };
          const [saved] = await tx.insert(operationalCheckInsTable).values(values).onConflictDoUpdate({ target: [operationalCheckInsTable.userId, operationalCheckInsTable.date, operationalCheckInsTable.shiftId], set: values }).returning();
          await writeHistoryEvent({ category: "CHECK_IN", action: "checkin.shift_closed", title: "Turno encerrado", narrative: `${plan.shiftName}: ${state}.`, entityType: "check_in", entityId: saved!.id, actorType: "DETERMINISTIC_ENGINE", orgId: org.id, beforeState: before ?? null, afterState: saved! }, tx);
          closed++;
        });
      }
    }
  }
  return { closed };
}
