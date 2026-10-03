import { and, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { db, scalesTable, scaleAllocationsTable, allocationExceptionsTable, operationsTable, agendaEventsTable, dayCheckInsTable, locationsTable, operationalCheckInsTable } from "@workspace/db";
import { APP_ROUTES } from "../lib/app-routes.js";
import { escalaPublicada, montarEscalaDoDia } from "./escala-dia.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { operationalDate, OPERATIONAL_TIME_ZONE } from "../lib/operational-date.js";
import { enqueueNotification, databaseNow } from "./undo.js";
import { processNotificationOutbox } from "./notification-outbox.js";
import { eventBus } from "../lib/event-bus.js";
import { publishedDay } from "./published-day.js";
import { reconcileDueCheckIns } from "./checkin-reconcile.js";
import { regrasDaOrganizacao } from "./regras-casa.js";
import { shiftPlans, shiftsForDate } from "./shift-checkins.js";

/** A timing conflict is an alert, never a publication blocker. Empty seats / missing coverage are pending. */
export async function autoPublishScales(organizationId?: string) {
  const due = await db.select({ id: scalesTable.id }).from(scalesTable).innerJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id)).where(and(organizationId ? eq(operationsTable.organizationId, organizationId) : undefined, eq(scalesTable.status, "DRAFT"), lte(scalesTable.publishDeadline, sql`clock_timestamp()`)));
  const published: string[] = [], pending: string[] = [];
  for (const item of due) {
    const result = await db.transaction(async tx => {
      const [scale] = await tx.select().from(scalesTable).where(eq(scalesTable.id, item.id)).for("update");
      const now = await databaseNow(tx);
      if (!scale || scale.status !== "DRAFT" || !scale.publishDeadline || scale.publishDeadline > now) return null;
      const [operation] = await tx.select().from(operationsTable).where(eq(operationsTable.id, scale.operationId));
      if (operation?.status !== "ACTIVE") return "pending";
      const all = await tx.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scale.id));
      const allocations = all.filter(row => row.active);
      const exceptions = await tx.select().from(allocationExceptionsTable).where(eq(allocationExceptionsTable.scaleId, scale.id));
      if (!allocations.length || allocations.some(row => row.status === "OPEN" || !row.userId) || exceptions.some(row => row.active && !row.resolvedAt && row.type !== "CONFLICT")) return "pending";
      const [next] = await tx.update(scalesTable).set({ status: "PUBLISHED", publishedAt: now, publishedBy: null, version: scale.version + 1, updatedAt: now }).where(eq(scalesTable.id, scale.id)).returning();
      await writeHistoryEvent({ category: "SCALE", action: "published", title: "Escala publicada automaticamente", narrative: "O prazo configurado chegou e não há pendência de cobertura. Conflitos de horário continuam como alertas.", actorType: "DETERMINISTIC_ENGINE", orgId: operation!.organizationId, operationId: scale.operationId, entityType: "scale", entityId: scale.id, beforeState: { scale, allocations: all, exceptions }, afterState: { scale: next, allocations: all, exceptions }, metadata: { automatic: true, publishDeadline: scale.publishDeadline } }, tx);
      for (const userId of new Set(allocations.map(row => row.userId!))) await enqueueNotification(tx, { userId, type: "scale.published", title: "Escala mudou", message: "Sua escala foi publicada. Consulte o dia no My ASA.", category: "schedule", priority: "NORMAL", entityType: "scale", entityId: scale.id, actionUrl: "/membro/escala" }, now, { deduplicationKey: `auto-publish:${scale.id}:${next!.version}:${userId}` });
      return "published";
    });
    if (result === "published") { published.push(item.id); const [scale] = await db.select().from(scalesTable).where(eq(scalesTable.id, item.id)); eventBus.emit("scale.published", { scaleId: item.id, operationId: scale!.operationId }); }
    if (result === "pending") pending.push(item.id);
  }
  return { published, pending };
}
export async function enqueueShiftReminders(now = new Date(), organizationId?: string) {
  const date = operationalDate(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const rows = new Map<string, Awaited<ReturnType<typeof publishedDay>>[number]["entries"][number]>();
  for (const scope of await publishedDay(date, organizationId)) {
    if ((await shiftsForDate(scope.organizationId, date)).length) continue;
    for (const entry of scope.entries) rows.set(entry.id, entry);
  }
  let enqueued = 0;
  for (const entry of rows.values()) {
    const start = entry.startTime?.slice(0, 5);
    if (!entry.personId || entry.status === "OPEN" || !start || start > clock) continue;
    // Only within the current shift interval; a restart must not send yesterday's or completed shifts.
    const end = entry.endTime?.slice(0, 5);
    if (end && clock >= end) continue;
    await db.transaction(tx => enqueueNotification(tx, { userId: entry.personId!, type: "checkin.shift_reminder", title: "Check-in do turno", message: "Seu turno começou. Registre o check-in no My ASA.", category: "schedule", entityType: "scale_entry", entityId: entry.id, actionUrl: APP_ROUTES.checkIn }, now, { deduplicationKey: `shift-checkin:${entry.id}:${date}:${start}` }));
    enqueued++;
  }
  return { enqueued };
}

/** Minutos do relógio no fuso da operação. */
function clockMinutes(now: Date) {
  const [hour, minute] = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number);
  return hour! * 60 + minute!;
}
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h! * 60 + (m ?? 0); };

/**
 * Lembrete de check-in na Escala do dia (tela 15): um por pessoa por dia, a partir de 30 min antes do
 * primeiro bloco dela — antes do limite em que a conciliação marca falta nos blocos de show (15 min antes).
 * Só vai para quem ainda não fez check-in em nenhum bloco do dia. Escala precisa estar publicada.
 */
export async function enqueueEscalaReminders(now = new Date(), organizationId?: string) {
  const date = operationalDate(now);
  const clock = clockMinutes(now);
  const locations = await db.select({ id: locationsTable.id, organizationId: locationsTable.organizationId }).from(locationsTable)
    .where(and(eq(locationsTable.closed, false), organizationId ? eq(locationsTable.organizationId, organizationId) : undefined));
  let enqueued = 0;
  const antecedencia = new Map<string, number>();
  for (const location of locations) {
    if ((await shiftsForDate(location.organizationId, date)).length) continue;
    // A Administração define a antecedência do lembrete nas regras da casa (15, 30 ou 60 min).
    if (!antecedencia.has(location.organizationId)) antecedencia.set(location.organizationId, (await regrasDaOrganizacao(location.organizationId)).lembreteCheckinMin);
    const antes = antecedencia.get(location.organizationId)!;
    const day = await montarEscalaDoDia(location.organizationId, location.id, date);
    if (!day?.escala || !escalaPublicada(day.escala.status)) continue;
    const primeiro = new Map<string, { inicio: string; fim: string | null; rotulo: string }>();
    for (const bloco of [...day.blocos].sort((a, b) => a.inicio.localeCompare(b.inicio))) for (const pessoa of bloco.pessoaIds) if (!primeiro.has(pessoa)) primeiro.set(pessoa, bloco);
    const feitos = new Set((await db.select({ userId: dayCheckInsTable.userId }).from(dayCheckInsTable)
      .where(and(eq(dayCheckInsTable.scaleId, day.escala.id), inArray(dayCheckInsTable.status, ["CHECKED_IN", "LATE"])))).map((row) => row.userId));
    for (const [pessoa, bloco] of primeiro) {
      const inicio = toMinutes(bloco.inicio);
      const fim = bloco.fim ? toMinutes(bloco.fim) : inicio + 60;
      if (feitos.has(pessoa) || clock < inicio - antes || clock >= fim) continue;
      await db.transaction((tx) => enqueueNotification(tx, {
        userId: pessoa, type: "checkin.shift_reminder", category: "schedule", title: "Check-in do dia",
        message: `Seu dia em ${day.location.name} começa às ${bloco.inicio} (${bloco.rotulo}). Registre o check-in no My ASA.`,
        entityType: "scale", entityId: day.escala!.id, actionUrl: APP_ROUTES.checkIn,
      }, now, { deduplicationKey: `escala-checkin:${day.escala!.id}:${date}:${pessoa}` }));
      enqueued++;
    }
  }
  for (const orgId of new Set(locations.map(location => location.organizationId))) {
    if (!(await shiftsForDate(orgId, date)).length) continue;
    const before = (await regrasDaOrganizacao(orgId)).lembreteCheckinMin;
    const plans = await shiftPlans(orgId, date);
    const answered = await db.select({ userId: operationalCheckInsTable.userId, shiftId: operationalCheckInsTable.shiftId }).from(operationalCheckInsTable)
      .where(and(eq(operationalCheckInsTable.orgId, orgId), eq(operationalCheckInsTable.date, date)));
    for (const plan of plans) {
      if (now.getTime() < plan.firstActivityAt.getTime() - before * 60_000 || now.getTime() > plan.firstActivityAt.getTime() + 15 * 60_000 || answered.some(row => row.userId === plan.userId && row.shiftId === plan.shiftId)) continue;
      await db.transaction(tx => enqueueNotification(tx, {
        userId: plan.userId, type: "checkin.shift_reminder", category: "schedule", title: `Check-in do turno ${plan.shiftName}`,
        message: `Sua primeira atividade começa às ${new Intl.DateTimeFormat("pt-BR", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(plan.firstActivityAt)}. Registre o check-in do turno no My ASA.`,
        entityType: "shift", entityId: plan.shiftId, actionUrl: APP_ROUTES.checkIn,
      }, now, { deduplicationKey: `turno-checkin:${plan.shiftId}:${date}:${plan.userId}` }));
      enqueued++;
    }
  }
  return { enqueued, date };
}
let running = false;
let enabled = false;
let active: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastCheckInReconcileAt = 0;
export function startOperationalScheduler(options: { organizationId?: string; deliver?: Parameters<typeof processNotificationOutbox>[0] } = {}) {
  if (timer) return;
  enabled = true;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await autoPublishScales(options.organizationId);
      await processNotificationOutbox(options.deliver);
      await enqueueShiftReminders(new Date(), options.organizationId);
      // O ciclo operacional é curto para entrega de notificações; presença só
      // precisa ser conferida por minuto, nunca uma consulta por segundo.
      if (Date.now() - lastCheckInReconcileAt >= 60_000) {
        await enqueueEscalaReminders(new Date(), options.organizationId);
        await reconcileDueCheckIns(new Date(), options.organizationId);
        lastCheckInReconcileAt = Date.now();
      }
    } catch (error) { console.error("[operational-jobs] falha no ciclo", (error as Error).name); }
    finally { running = false; if (enabled) { timer = setTimeout(() => { active = run(); }, 1000); timer.unref(); } }
  };
  timer = setTimeout(() => { active = run(); }, 0);
}
/**
 * Um ciclo completo, para quem não tem processo sempre ligado (Vercel): o agendador do Supabase
 * (pg_cron) chama POST /api/internal/ciclo a cada minuto, e cada chamada roda isto uma vez.
 */
export async function rodarCicloOperacional(now = new Date(), organizationId?: string) {
  const resultado: Record<string, unknown> = {};
  await autoPublishScales(organizationId);
  resultado.avisos = await processNotificationOutbox();
  await enqueueShiftReminders(now, organizationId);
  resultado.lembretes = await enqueueEscalaReminders(now, organizationId);
  await reconcileDueCheckIns(now, organizationId);
  // Avisos que nasceram neste ciclo (lembretes, publicação) já saem agora, sem esperar o próximo minuto.
  resultado.avisosDepois = await processNotificationOutbox();
  return resultado;
}
export async function stopOperationalScheduler() { enabled = false; if (timer) clearTimeout(timer); timer = undefined; await active; }
