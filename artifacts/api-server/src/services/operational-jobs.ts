import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, scalesTable, scaleAllocationsTable, allocationExceptionsTable, operationsTable, agendaEventsTable, dayCheckInsTable, locationsTable, operationalCheckInsTable, leaveRequestsTable, notificationOutboxTable } from "@workspace/db";
import { APP_ROUTES } from "../lib/app-routes.js";
import { escalaPublicada, montarEscalaDoDia } from "./escala-dia.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { operationalDate, OPERATIONAL_TIME_ZONE } from "../lib/operational-date.js";
import { enqueueNotification, databaseNow } from "./undo.js";
import { processNotificationOutbox } from "./notification-outbox.js";
import { eventBus } from "../lib/event-bus.js";
import { emParalelo, lembrarPorChave } from "../lib/em-paralelo.js";
import { publishedDay } from "./published-day.js";
import { reconcileDueCheckIns } from "./checkin-reconcile.js";
import { regrasDaOrganizacao } from "./regras-casa.js";
import { shiftPlans, shiftsForDate } from "./shift-checkins.js";
import { administradores, periodoLegivel, prazoAdminAberto, supervisoresDaArea } from "./folga-roteamento.js";
import { lerConfigFolga } from "./folga-config.js";
import { enqueueTaskReminders } from "./task-reminders.js";
import { voltarRotinas } from "./responsibility-routines.js";

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
  const escopos = await publishedDay(date, organizationId);
  const comTurno = await emParalelo(escopos, async (scope) => (await shiftsForDate(scope.organizationId, date)).length > 0);
  escopos.forEach((scope, i) => { if (!comTurno[i]) for (const entry of scope.entries) rows.set(entry.id, entry); });
  const devidos = [...rows.values()].filter((entry) => {
    const start = entry.startTime?.slice(0, 5);
    if (!entry.personId || entry.status === "OPEN" || !start || start > clock) return false;
    // Only within the current shift interval; a restart must not send yesterday's or completed shifts.
    const end = entry.endTime?.slice(0, 5);
    return !(end && clock >= end);
  });
  // Cada aviso é uma transação curta com chave própria (um por entrada, por dia e por horário): não dependem um do outro.
  await emParalelo(devidos, (entry) => {
    const start = entry.startTime!.slice(0, 5);
    return db.transaction(tx => enqueueNotification(tx, { userId: entry.personId!, type: "checkin.shift_reminder", title: "Check-in do turno", message: "Seu turno começou. Registre o check-in no My ASA.", category: "schedule", entityType: "scale_entry", entityId: entry.id, actionUrl: APP_ROUTES.checkIn }, now, { deduplicationKey: `shift-checkin:${entry.id}:${date}:${start}` }));
  });
  return { enqueued: devidos.length };
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
  // Os locais não dependem um do outro: monta poucos por vez (o pooler é compartilhado). Por organização, a pergunta
  // "tem turno?" e a antecedência do lembrete são lidas uma vez só, mesmo com vários locais montando ao mesmo tempo.
  const temTurno = lembrarPorChave((orgId: string) => shiftsForDate(orgId, date));
  const antecedencia = lembrarPorChave(async (orgId: string) => (await regrasDaOrganizacao(orgId)).lembreteCheckinMin);
  const porLocal = await emParalelo(locations, async (location) => {
    if ((await temTurno(location.organizationId)).length) return 0;
    // A Administração define a antecedência do lembrete nas regras da casa (15, 30 ou 60 min).
    const antes = await antecedencia(location.organizationId);
    const day = await montarEscalaDoDia(location.organizationId, location.id, date);
    if (!day?.escala || !escalaPublicada(day.escala.status)) return 0;
    const primeiro = new Map<string, { inicio: string; fim: string | null; rotulo: string }>();
    for (const bloco of [...day.blocos].sort((a, b) => a.inicio.localeCompare(b.inicio))) for (const pessoa of bloco.pessoaIds) if (!primeiro.has(pessoa)) primeiro.set(pessoa, bloco);
    const feitos = new Set((await db.select({ userId: dayCheckInsTable.userId }).from(dayCheckInsTable)
      .where(and(eq(dayCheckInsTable.scaleId, day.escala.id), inArray(dayCheckInsTable.status, ["CHECKED_IN", "LATE"])))).map((row) => row.userId));
    const devidos = [...primeiro].filter(([pessoa, bloco]) => {
      const inicio = toMinutes(bloco.inicio);
      const fim = bloco.fim ? toMinutes(bloco.fim) : inicio + 60;
      return !(feitos.has(pessoa) || clock < inicio - antes || clock >= fim);
    });
    // Um aviso por pessoa por dia (a chave garante): repetir a tentativa no minuto seguinte não duplica.
    await emParalelo(devidos, ([pessoa, bloco]) => db.transaction((tx) => enqueueNotification(tx, {
      userId: pessoa, type: "checkin.shift_reminder", category: "schedule", title: "Check-in do dia",
      message: `Seu dia em ${day.location.name} começa às ${bloco.inicio} (${bloco.rotulo}). Registre o check-in no My ASA.`,
      entityType: "scale", entityId: day.escala!.id, actionUrl: APP_ROUTES.checkIn,
    }, now, { deduplicationKey: `escala-checkin:${day.escala!.id}:${date}:${pessoa}` })));
    return devidos.length;
  });
  let enqueued = porLocal.reduce((soma, n) => soma + n, 0);
  const porOrganizacao = await emParalelo([...new Set(locations.map(location => location.organizationId))], async (orgId) => {
    if (!(await temTurno(orgId)).length) return 0;
    const before = await antecedencia(orgId);
    const plans = await shiftPlans(orgId, date);
    const answered = await db.select({ userId: operationalCheckInsTable.userId, shiftId: operationalCheckInsTable.shiftId }).from(operationalCheckInsTable)
      .where(and(eq(operationalCheckInsTable.orgId, orgId), eq(operationalCheckInsTable.date, date)));
    const devidos = plans.filter((plan) => !(now.getTime() < plan.firstActivityAt.getTime() - before * 60_000 || now.getTime() > plan.firstActivityAt.getTime() + 15 * 60_000 || answered.some(row => row.userId === plan.userId && row.shiftId === plan.shiftId)));
    await emParalelo(devidos, (plan) => db.transaction(tx => enqueueNotification(tx, {
      userId: plan.userId, type: "checkin.shift_reminder", category: "schedule", title: `Check-in do turno ${plan.shiftName}`,
      message: `Sua primeira atividade começa às ${new Intl.DateTimeFormat("pt-BR", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(plan.firstActivityAt)}. Registre o check-in do turno no My ASA.`,
      entityType: "shift", entityId: plan.shiftId, actionUrl: APP_ROUTES.checkIn,
    }, now, { deduplicationKey: `turno-checkin:${plan.shiftId}:${date}:${plan.userId}` })));
    return devidos.length;
  });
  enqueued += porOrganizacao.reduce((soma, n) => soma + n, 0);
  return { enqueued, date };
}
let running = false;
let enabled = false;
let active: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastCheckInReconcileAt = 0;
/** Lembretes de tarefa e a volta da lista fixa: de 10 em 10 minutos bastam (o aviso já é único por dia). */
let lastTaskRemindersAt = 0;
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
        if (Date.now() - lastTaskRemindersAt >= 600_000) {
          await enqueueTaskReminders(new Date(), options.organizationId);
          await voltarRotinas(new Date(), options.organizationId);
          lastTaskRemindersAt = Date.now();
        }
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
  resultado.folgas = await avisarPrazoDaFolgaAberto(now, organizationId);
  resultado.lembretesDeFolga = await lembrarRespostasDeFolga(now, organizationId);
  // Pelo agendador do Supabase (todo minuto) isto só roda nos minutos múltiplos de 10: a chave de deduplicação já garante
  // um aviso por acontecimento, e assim o ciclo não faz escritas à toa nem atrasa o check-in.
  const aCadaDezMinutos = now.getMinutes() % 10 === 0;
  resultado.tarefas = aCadaDezMinutos ? await enqueueTaskReminders(now, organizationId) : { pulado: true };
  resultado.listaFixa = aCadaDezMinutos ? await voltarRotinas(now, organizationId) : { pulado: true };
  // Avisos que nasceram neste ciclo (lembretes, publicação) já saem agora, sem esperar o próximo minuto.
  resultado.avisosDepois = await processNotificationOutbox();
  return resultado;
}
export async function stopOperationalScheduler() { enabled = false; if (timer) clearTimeout(timer); timer = undefined; await active; }

/**
 * Pedido de folga que a Supervisão da área não respondeu e cujo prazo da Administração abriu:
 * a Administração recebe um aviso por pedido. A chave de deduplicação garante uma vez só, mesmo
 * que o ciclo rode a cada minuto.
 */
export async function avisarPrazoDaFolgaAberto(now = new Date(), organizationId?: string) {
  const hoje = operationalDate(now);
  const pendentes = await db.select({ id: leaveRequestsTable.id, organizationId: leaveRequestsTable.organizationId, userId: leaveRequestsTable.userId, areaId: leaveRequestsTable.areaId, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate })
    .from(leaveRequestsTable).where(and(eq(leaveRequestsTable.status, "PENDING"), gte(leaveRequestsTable.startDate, hoje), ...(organizationId ? [eq(leaveRequestsTable.organizationId, organizationId)] : [])));
  let avisados = 0;
  for (const pedido of pendentes) {
    const { prazoSupervisaoDias } = await lerConfigFolga(pedido.organizationId);
    if (!prazoAdminAberto(pedido.startDate, hoje, prazoSupervisaoDias)) continue;
    await db.transaction(async (tx) => {
      // Sem Supervisão na área, a Administração já foi avisada quando o pedido chegou.
      if (!(await supervisoresDaArea(tx, pedido.areaId, pedido.userId)).length) return;
      for (const adminId of (await administradores(tx, pedido.organizationId)).filter((id) => id !== pedido.userId)) {
        const [ja] = await tx.select({ id: notificationOutboxTable.id }).from(notificationOutboxTable).where(eq(notificationOutboxTable.deduplicationKey, `folga:${pedido.id}:prazo:${adminId}`)).limit(1);
        if (ja) continue;
        await enqueueNotification(tx, { userId: adminId, type: "leave.deadline_open", title: "Pedido de folga esperando decisão", message: `O pedido de folga de ${periodoLegivel(pedido.startDate, pedido.endDate)} está esperando decisão da Supervisão da área e a data está perto. A partir de agora você também pode decidir.`, category: "absence", entityType: "leave_request", entityId: pedido.id, actionUrl: "/solicitacoes" }, new Date(), { deduplicationKey: `folga:${pedido.id}:prazo:${adminId}` });
        avisados++;
      }
    });
  }
  return { avisados };
}

/**
 * Lembrete de resposta (Babi, 16/10/2026): troca de folga esperando o colega, ou proposta de dias esperando a
 * pessoa que pediu. Depois de `lembreteRespostaHoras` sem resposta (padrão 24; 0 desliga) a pessoa que precisa
 * responder ganha UM lembrete no sino. A chave de deduplicação garante uma vez só, mesmo que o ciclo rode a cada
 * minuto. Quem propôs não é avisado de novo: o assunto também se resolve pessoalmente.
 */
export async function lembrarRespostasDeFolga(now = new Date(), organizationId?: string) {
  const hoje = operationalDate(now);
  const esperando = await db.select({
    id: leaveRequestsTable.id, organizationId: leaveRequestsTable.organizationId, userId: leaveRequestsTable.userId,
    startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate, updatedAt: leaveRequestsTable.updatedAt,
    peerId: leaveRequestsTable.peerId, peerAccepted: leaveRequestsTable.peerAccepted,
    alternativeDates: leaveRequestsTable.alternativeDates, alternativeAccepted: leaveRequestsTable.alternativeAccepted,
  }).from(leaveRequestsTable).where(and(eq(leaveRequestsTable.status, "PENDING"), gte(leaveRequestsTable.endDate, hoje), ...(organizationId ? [eq(leaveRequestsTable.organizationId, organizationId)] : [])));
  const horasPorOrganizacao = new Map<string, number>();
  let lembrados = 0;
  for (const pedido of esperando) {
    const trocaEsperando = Boolean(pedido.peerId) && pedido.peerAccepted === null;
    const diasEsperando = Boolean(pedido.alternativeDates?.length) && pedido.alternativeAccepted === null;
    if (!trocaEsperando && !diasEsperando) continue;
    if (!horasPorOrganizacao.has(pedido.organizationId)) horasPorOrganizacao.set(pedido.organizationId, (await lerConfigFolga(pedido.organizationId)).lembreteRespostaHoras);
    const horas = horasPorOrganizacao.get(pedido.organizationId)!;
    if (horas <= 0 || now.getTime() - pedido.updatedAt.getTime() < horas * 3_600_000) continue;
    const destinoId = trocaEsperando ? pedido.peerId! : pedido.userId;
    const chave = `folga:${pedido.id}:lembrete:${trocaEsperando ? "troca" : "dias"}:${destinoId}`;
    await db.transaction(async (tx) => {
      const [ja] = await tx.select({ id: notificationOutboxTable.id }).from(notificationOutboxTable).where(eq(notificationOutboxTable.deduplicationKey, chave)).limit(1);
      if (ja) return;
      await enqueueNotification(tx, trocaEsperando
        ? { userId: destinoId, type: "leave.reminder", title: "Falta a sua resposta sobre a troca de folga", message: `Uma proposta de troca de folga (${periodoLegivel(pedido.startDate, pedido.endDate)}) espera a sua resposta. Aceite ou recuse com o motivo em Folgas.`, priority: "NORMAL", category: "absence", entityType: "leave_request", entityId: pedido.id, actionUrl: "/folgas" }
        : { userId: destinoId, type: "leave.reminder", title: "Falta a sua resposta sobre os dias propostos", message: `A Supervisão propôs outros dias para o seu pedido de ${periodoLegivel(pedido.startDate, pedido.endDate)}. Aceite ou recuse com o motivo em Solicitações.`, priority: "NORMAL", category: "absence", entityType: "leave_request", entityId: pedido.id, actionUrl: "/solicitacoes" },
      now, { deduplicationKey: chave });
      lembrados++;
    });
  }
  return { lembrados };
}
