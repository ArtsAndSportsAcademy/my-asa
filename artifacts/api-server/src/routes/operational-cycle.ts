import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookCheckInVacanciesTable,
  dailyBooksTable, dayCheckInsTable, db, folgasTable, leaveRegimesTable, leaveRequestsTable,
  locationsTable, operationsTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { canSupervisorAccessPerson, listAreaLocalScopes } from "../services/area-local-scope.js";
import { comoPublicada, montarEscalaDoDia, operationForLocation } from "../services/escala-dia.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { enqueueNotification } from "../services/undo.js";
import { avisarRepublicacaoFolgas, ultimoRetratoFolgas } from "../services/folgas-publicadas.js";
import { operationalDate } from "../lib/operational-date.js";
import { administradores, diaEmQueOPrazoAbre, mesDeFolgasPublicadoNoPeriodo, operacaoDaPessoa, periodoLegivel, prazoAdminAberto, supervisoresDaArea } from "../services/folga-roteamento.js";
import { fraseDoLimite, lerConfigFolga, limitesExcedidos } from "../services/folga-config.js";
import { barreiraDeDecisao } from "../services/folga-decisao.js";
import { MARCA_DE_PRIORIDADE } from "../services/folga-comum.js";
import { analisarPedidoDeFolga } from "../services/analise-folga.js";
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

/** Um pedido de folga chega à Supervisão da área e à Administração, sem duplicar destinatários. */
async function avisarGestaoDaFolga(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], organizationId: string, areaId: string | null, requesterId: string, requestId: string, title: string, message: string, event: string) {
  // Quem decide primeiro é a Supervisão da área; a Administração só é avisada quando a área não tem
  // Supervisão (ou quando quem pediu é a própria Supervisão), e depois, pelo prazo aberto.
  let destinatarios = (await supervisoresDaArea(tx, areaId)).filter((id) => id !== requesterId);
  if (!destinatarios.length) destinatarios = (await administradores(tx, organizationId)).filter((id) => id !== requesterId);
  for (const id of destinatarios) await enqueueNotification(tx as never, {
    userId: id, type: event, title, message, category: "absence", entityType: "leave_request", entityId: requestId, actionUrl: "/solicitacoes",
  }, new Date(), { deduplicationKey: `folga:${requestId}:${event}:${id}` });
}

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
  // O colega de uma troca vê o pedido enquanto a troca depende dele (ou depois de resolvida), nunca um pedido cancelado.
  const ehColegaDaTroca = (row: (typeof rows)[number]) => row.request.peerId === actor.sub && row.request.userId !== actor.sub && !isAdmin(actor.role) && row.request.status !== "CANCELLED";
  for (const row of rows) if ((await ownsPerson(actor, row.request.userId)) || ehColegaDaTroca(row)) visible.push(row);
  // Quem decide precisa saber, antes de aprovar, se a pessoa já tem folga marcada naqueles dias.
  const pendentes = visible.filter((row) => row.request.status === "PENDING");
  const jaMarcada = new Set<string>();
  if ((isAdmin(actor.role) || isSupervisor(actor.role)) && pendentes.length) {
    const folgas = await db.select({ userId: folgasTable.userId, startDate: folgasTable.startDate, endDate: folgasTable.endDate }).from(folgasTable).where(and(
      inArray(folgasTable.userId, [...new Set(pendentes.map((row) => row.request.userId))]), eq(folgasTable.status, "ACTIVE"),
      lte(folgasTable.startDate, pendentes.reduce((max, row) => (row.request.endDate > max ? row.request.endDate : max), "0000-00-00")),
      gte(folgasTable.endDate, pendentes.reduce((min, row) => (row.request.startDate < min ? row.request.startDate : min), "9999-99-99")),
    ));
    for (const row of pendentes) if (folgas.some((f) => f.userId === row.request.userId && f.startDate <= row.request.endDate && f.endDate >= row.request.startDate)) jaMarcada.add(row.request.id);
  }
  // Com quem está cada pedido em aberto: a Supervisão da área, ou a Administração quando a área não tem Supervisão.
  const { prazoSupervisaoDias } = await lerConfigFolga(actor.organizationId);
  const supervisaoPorArea = new Map<string, string[]>();
  const temSupervisao = async (areaId: string | null, quemPediu: string) => {
    if (!areaId) return false;
    if (!supervisaoPorArea.has(areaId)) supervisaoPorArea.set(areaId, await supervisoresDaArea(db, areaId));
    // Quem pediu a própria folga não conta como Supervisão do próprio pedido.
    return supervisaoPorArea.get(areaId)!.some((id) => id !== quemPediu);
  };
  const hoje = operationalDate();
  const destinoDe = async (request: (typeof visible)[number]["request"]) => {
    if (request.status !== "PENDING") return null;
    const comSupervisao = await temSupervisao(request.areaId, request.userId);
    const abreEm = comSupervisao ? diaEmQueOPrazoAbre(request.startDate, prazoSupervisaoDias) : null;
    const adminPodeAgora = !comSupervisao || prazoAdminAberto(request.startDate, hoje, prazoSupervisaoDias);
    return { quem: comSupervisao ? "SUPERVISAO" : "ADMINISTRACAO", area: null, adminPodeDecidirEm: abreEm, adminPodeAgora };
  };
  const idsDeColega = [...new Set(visible.map((row) => row.request.peerId).filter((id): id is string => Boolean(id)))];
  const nomesDeColega = new Map<string, string>(idsDeColega.length ? (await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, idsDeColega))).map((u) => [u.id, u.name] as [string, string]) : []);
  const saida = [];
  for (const row of visible) {
    const destino = await destinoDe(row.request);
    const souSoOColega = row.request.peerId === actor.sub && !(await ownsPerson(actor, row.request.userId));
    const troca = row.request.peerId ? {
      colegaId: row.request.peerId, colegaNome: nomesDeColega.get(row.request.peerId) ?? null, diaDevolvido: row.request.swapReturnDate,
      estado: row.request.peerAccepted === null ? "ESPERANDO" : row.request.peerAccepted ? "ACEITA" : "RECUSADA",
      motivoRecusa: row.request.peerReason, souEu: row.request.peerId === actor.sub,
    } : null;
    const alternativa = row.request.alternativeDates?.length ? {
      dias: row.request.alternativeDates, souEu: row.request.userId === actor.sub,
      estado: row.request.alternativeAccepted === null ? "ESPERANDO" : row.request.alternativeAccepted ? "ACEITA" : "RECUSADA", motivoRecusa: row.request.alternativeReason,
    } : null;
    saida.push({ ...row.request, ...(souSoOColega ? { reason: null } : {}), userName: row.userName ?? row.fullName, areaName: row.areaName, ...(jaMarcada.has(row.request.id) ? { jaTemFolga: true } : {}), ...(destino ? { destino: { ...destino, area: row.areaName } } : {}), ...(troca ? { troca } : {}), ...(alternativa ? { alternativa } : {}) });
  }
  res.json({ requests: saida });
});
router.post("/leave-requests", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const userId = isAdmin(actor.role) && typeof body.userId === "string" ? body.userId : actor.sub;
  const startDate = typeof body.startDate === "string" ? body.startDate : "", endDate = typeof body.endDate === "string" ? body.endDate : "", reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (startDate && endDate && endDate < startDate) { res.status(400).json({ error: "Bad Request", message: "O último dia da folga não pode vir antes do primeiro." }); return; }
  if (!startDate || !endDate || !reason) { res.status(400).json({ error: "Bad Request", message: "Informe período e motivo do pedido." }); return; }
  if (startDate < operationalDate()) { res.status(400).json({ error: "Bad Request", message: "Escolha hoje ou uma data futura: folga que já passou não se pede." }); return; }
  const [person] = await db.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId))).limit(1);
  if (!person) { res.status(404).json({ error: "Not Found" }); return; }
  const operationId = await operacaoDaPessoa(db, userId, actor.organizationId);
  // Mês de folgas ainda não publicado: o pedido da pessoa entra como prioridade. A gerência desfaz com motivo se houver algo especial.
  const prioridade = operationId ? !(await mesDeFolgasPublicadoNoPeriodo(operationId, startDate, endDate)) : false;
  const request = await db.transaction(async (tx) => {
    const [created] = await tx.insert(leaveRequestsTable).values(prioridade
      ? { organizationId: actor.organizationId, userId, areaId: person.areaId, startDate, endDate, reason, status: "APPROVED", decidedBy: actor.sub, decisionReason: `${MARCA_DE_PRIORIDADE}: o mapa do mês ainda não foi publicado, então ninguém precisou decidir.`, decidedAt: new Date() }
      : { organizationId: actor.organizationId, userId, areaId: person.areaId, startDate, endDate, reason }).returning();
    if (prioridade && operationId) {
      await aplicarFolgaDoPedido(tx, created!, operationId, actor.sub);
      await record({ category: "ABSENCE", action: "leave.priority", title: "Folga entrou como prioridade", narrative: `Pedido de folga de ${periodoLegivel(startDate, endDate)}, antes de o mapa do mês ser publicado.`, entityType: "leave_request", entityId: created!.id, actorId: actor.sub, orgId: actor.organizationId, operationId, beforeState: null, afterState: created, metadata: { reason } }, tx);
      await avisarGestaoDaFolga(tx, actor.organizationId, person.areaId, userId, created!.id, "Folga entrou como prioridade", `Um pedido de folga de ${periodoLegivel(startDate, endDate)} entrou como prioridade, porque o mapa do mês ainda não foi publicado. Se houver algo especial nesse dia, você pode desfazer, com motivo.`, "leave.priority");
      await enqueueNotification(tx as never, { userId, type: "leave.priority", title: "Sua folga foi registrada", message: `Seu pedido de ${periodoLegivel(startDate, endDate)} entrou como prioridade. A gerência pode ajustar se houver algo especial nesse dia.`, category: "absence", entityType: "leave_request", entityId: created!.id, actionUrl: "/solicitacoes" }, new Date(), { deduplicationKey: `folga:${created!.id}:prioridade:pessoa` });
      return created!;
    }
    await record({ category: "ABSENCE", action: "leave.requested", title: "Folga solicitada", narrative: `Pedido de folga de ${periodoLegivel(startDate, endDate)}.`, entityType: "leave_request", entityId: created!.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: null, afterState: created }, tx);
    await avisarGestaoDaFolga(tx, actor.organizationId, person.areaId, userId, created!.id, "Pedido de folga", `Há um pedido de folga de ${periodoLegivel(startDate, endDate)} para decidir.`, "leave.requested");
    return created!;
  });
  res.status(201).json({ request, ...(prioridade ? { entrouComoPrioridade: true } : {}) });
});

/** Calendário de grupo: gestão registra uma folga já decidida, sem simular um pedido do Elenco. */
router.post("/leave-calendar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const userIds = [...new Set(Array.isArray(body.userIds) ? body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0) : typeof body.userId === "string" ? [body.userId] : [])];
  const targetOperationId = typeof body.operationId === "string" ? body.operationId : null;
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!canReadManagement(actor.role) || isDirector(actor.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!userIds.length || !startDate || !endDate || endDate < startDate || !reason) { res.status(400).json({ error: "Bad Request", message: "Informe pessoas, período e motivo." }); return; }
  for (const userId of userIds) if (!(await ownsPerson(actor, userId))) { res.status(403).json({ message: "Você não pode definir folga para uma das pessoas escolhidas." }); return; }
  const people = await db.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable)
    .where(and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, actor.organizationId)));
  if (people.length !== userIds.length) { res.status(404).json({ message: "Uma das pessoas escolhidas não foi encontrada." }); return; }
  const roles = await db.select({ userId: userRolesTable.userId, operationId: userRolesTable.operationId }).from(userRolesTable)
    .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
    .where(and(inArray(userRolesTable.userId, userIds), eq(userRolesTable.active, true), eq(operationsTable.organizationId, actor.organizationId), ...(targetOperationId ? [eq(userRolesTable.operationId, targetOperationId)] : [])));
  if (people.some((person) => !roles.some((role) => role.userId === person.id))) { res.status(400).json({ message: "Uma das pessoas não tem operação ativa para registrar a folga." }); return; }
  const requests = await db.transaction(async (tx) => {
    const createdRequests = [];
    const operationsToNotify = new Map<string, string>();
    for (const person of people) {
      const operationId = roles.find((role) => role.userId === person.id)!.operationId;
      const [created] = await tx.insert(leaveRequestsTable).values({
        organizationId: actor.organizationId, userId: person.id, areaId: person.areaId, startDate, endDate, reason,
        status: "APPROVED", decidedBy: actor.sub, decisionReason: reason, decidedAt: new Date(),
      }).returning();
      await tx.insert(folgasTable).values({ userId: person.id, operationId, type: "DAY_OFF", startDate, endDate, status: "ACTIVE", origem: "MANUAL", createdBy: actor.sub, notes: `Calendário ${created!.id}` });
      const eventId = await writeHistoryEvent({ category: "ABSENCE", action: "leave.calendar_set", title: "Folga colocada no calendário", narrative: reason, entityType: "leave_request", entityId: created!.id, actorId: actor.sub, orgId: actor.organizationId, operationId, beforeState: null, afterState: created, metadata: { reason, totalPessoas: people.length } }, tx as HistoryExecutor);
      if (!operationsToNotify.has(operationId)) operationsToNotify.set(operationId, eventId);
      createdRequests.push(created!);
    }
    for (const [operationId, eventId] of operationsToNotify) await avisarRepublicacaoFolgas(tx, actor.organizationId, operationId, startDate, endDate, eventId);
    return createdRequests;
  });
  res.status(201).json({ request: requests[0], requests });
});
type TxFolga = Parameters<Parameters<typeof db.transaction>[0]>[0];
/**
 * Grava a folga de um pedido aprovado (ou entrado como prioridade). Não empilha uma segunda folga
 * por cima de dia que já tem folga: devolve a frase que avisa quem decidiu, ou "" quando nada coincidiu.
 */
export async function aplicarFolgaDoPedido(tx: TxFolga, pedido: { id: string; userId: string; startDate: string; endDate: string }, operationId: string, criadaPor: string): Promise<string> {
  let aviso = "";
  // Folga já marcada nos mesmos dias (grupo, mapa, calendário): aprovar vale, mas não empilha uma
  // segunda folga por cima — o mapa contaria dois dias de folga onde há um. Quem aprovou fica sabendo.
  const existentes = await tx.select({ startDate: folgasTable.startDate, endDate: folgasTable.endDate }).from(folgasTable).where(and(
    eq(folgasTable.userId, pedido.userId), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, pedido.endDate), gte(folgasTable.endDate, pedido.startDate),
  ));
  const dias: string[] = [];
  for (let t = new Date(`${pedido.startDate}T12:00:00Z`); t <= new Date(`${pedido.endDate}T12:00:00Z`) && dias.length < 400; t.setUTCDate(t.getUTCDate() + 1)) dias.push(t.toISOString().slice(0, 10));
  const semFolga = dias.filter((d) => !existentes.some((f) => f.startDate <= d && f.endDate >= d));
  if (existentes.length) aviso = semFolga.length ? `Aprovada. Parte desses dias já tinha folga marcada (${dias.length - semFolga.length} de ${dias.length}).` : "Aprovada. Esses dias já tinham folga marcada; nada foi duplicado.";
  // Só os dias que ainda não tinham folga, em trechos seguidos.
  const trechos: { de: string; ate: string }[] = [];
  for (const d of semFolga) {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && dias[dias.indexOf(ultimo.ate) + 1] === d) ultimo.ate = d; else trechos.push({ de: d, ate: d });
  }
  for (const trecho of trechos) await tx.insert(folgasTable).values({ userId: pedido.userId, operationId, type: "DAY_OFF", startDate: trecho.de, endDate: trecho.ate, status: "ACTIVE", origem: "SOLICITACAO", createdBy: criadaPor, notes: `Pedido ${pedido.id}` });
  return aviso;
}

/** Aprovar não exige recado (recusar exige), mas a tabela só aceita decisão com texto: este é o texto. */
const SEM_RECADO = "Aprovada sem observação.";
router.patch("/leave-requests/:id", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!, body = req.body as Record<string, unknown>;
  const status = body.status === "APPROVED" || body.status === "DENIED" ? body.status : null, decisionReason = typeof body.decisionReason === "string" ? body.decisionReason.trim() : "";
  if (!status) { res.status(400).json({ error: "Bad Request", message: "Aprovar ou recusar?" }); return; }
  if (status === "DENIED" && !decisionReason) { res.status(400).json({ error: "Bad Request", message: "Recusar exige motivo." }); return; }
  const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [request] = await db.select().from(leaveRequestsTable).where(and(eq(leaveRequestsTable.id, requestId), eq(leaveRequestsTable.organizationId, actor.organizationId))).limit(1);
  if (!request) { res.status(404).json({ error: "Not Found" }); return; }
  const barreira = await barreiraDeDecisao(actor, request);
  if (barreira) { res.status(barreira.status).json({ error: barreira.status === 403 ? "Forbidden" : "Conflict", message: barreira.message }); return; }
  // A folga vence a escala só com motivo escrito: decidir no lugar da Supervisão, ou aprovar dia que fica sem cobertura, pede o porquê.
  if (!decisionReason) {
    if (isAdmin(actor.role) && (await supervisoresDaArea(db, request.areaId, request.userId)).length > 0) {
      res.status(400).json({ error: "Bad Request", message: "A Supervisão da área não respondeu: escreva por que a Administração está decidindo por ela." }); return;
    }
    if (status === "APPROVED") {
      const analise = await analisarPedidoDeFolga({ organizationId: actor.organizationId, userId: request.userId, startDate: request.startDate, endDate: request.endDate });
      if (analise.dias.some((d) => !d.resultado.da)) {
        res.status(400).json({ error: "Bad Request", message: "Há dia deste pedido que fica sem cobertura. Escreva o motivo de aprovar mesmo assim: a folga só vence a escala com o porquê escrito." }); return;
      }
      // Limite de folgas por dia no modo "exige motivo": passar do limite só com o porquê escrito.
      const diasDoPedido: string[] = [];
      for (let t = new Date(`${request.startDate}T12:00:00Z`); t <= new Date(`${request.endDate}T12:00:00Z`) && diasDoPedido.length < 62; t.setUTCDate(t.getUTCDate() + 1)) diasDoPedido.push(t.toISOString().slice(0, 10));
      const passou = (await limitesExcedidos({ organizationId: actor.organizationId, pessoas: [{ id: request.userId, areaId: request.areaId }], dates: diasDoPedido })).filter((e) => e.modo === "EXIGE_MOTIVO");
      if (passou.length) {
        res.status(400).json({ error: "Bad Request", message: `${fraseDoLimite(passou[0]!)} Escreva o motivo de aprovar mesmo assim: o limite foi combinado como "exige motivo".` }); return;
      }
    }
  }
  if (request.alternativeDates?.length && request.alternativeAccepted === null) {
    res.status(409).json({ error: "Conflict", message: "Esperando a resposta de quem pediu sobre a proposta de dias. Retire a proposta para decidir de outro jeito." }); return;
  }
  if (request.peerId && request.peerAccepted === null) {
    const [colega] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, request.peerId)).limit(1);
    res.status(409).json({ error: "Conflict", message: `Esperando a resposta de ${colega?.name ?? "o colega"} sobre a troca. Retire a proposta para decidir de outro jeito.` }); return;
  }
  let aviso = "";
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({ status, decidedBy: actor.sub, decisionReason: decisionReason || SEM_RECADO, decidedAt: new Date(), updatedAt: new Date() }).where(and(eq(leaveRequestsTable.id, request.id), eq(leaveRequestsTable.status, "PENDING"))).returning();
    if (!saved) return null;
    let operationId: string | undefined;
    if (status === "APPROVED") { const [operation] = await tx.select({ id: userRolesTable.operationId }).from(userRolesTable).innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id)).where(and(eq(userRolesTable.userId, request.userId), eq(userRolesTable.active, true), eq(operationsTable.organizationId, actor.organizationId))).limit(1); if (!operation) throw new Error("A pessoa não possui operação ativa para registrar a folga."); operationId = operation.id;
      aviso = await aplicarFolgaDoPedido(tx, request, operationId, actor.sub);
    }
    const eventId = await writeHistoryEvent({ category: "ABSENCE", action: status === "APPROVED" ? "leave.approved" : "leave.denied", title: status === "APPROVED" ? "Folga aprovada" : "Folga negada", narrative: decisionReason || SEM_RECADO, entityType: "leave_request", entityId: request.id, actorId: actor.sub, orgId: actor.organizationId, operationId, beforeState: request, afterState: saved, metadata: decisionReason ? { reason: decisionReason } : undefined }, tx as HistoryExecutor);
    if (operationId) await avisarRepublicacaoFolgas(tx, actor.organizationId, operationId, request.startDate, request.endDate, eventId);
    if (request.userId !== actor.sub) await enqueueNotification(tx as never, {
      userId: request.userId, type: status === "APPROVED" ? "leave.approved" : "leave.denied",
      title: status === "APPROVED" ? "Folga aprovada" : "Folga recusada",
      message: `Seu pedido de ${periodoLegivel(request.startDate, request.endDate)} foi ${status === "APPROVED" ? "aprovado" : "recusado"}${decisionReason ? `: ${decisionReason}` : ""}${status === "APPROVED" ? ". A folga aparece no calendário quando a Administração publicar o mês." : ""}`,
      category: "absence", entityType: "leave_request", entityId: request.id, actionUrl: "/solicitacoes",
    }, new Date(), { deduplicationKey: `folga:${request.id}:decisao` });
    return saved;
  });
  if (!updated) { res.status(409).json({ message: "Este pedido já foi decidido ou retirado." }); return; }
  res.json({ request: updated, ...(aviso ? { aviso } : {}) });
});

/** A pessoa pode retirar o próprio pedido enquanto ninguém decidiu. O Registro guarda a retirada. */
router.post("/leave-requests/:id/cancelar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(leaveRequestsTable).where(and(eq(leaveRequestsTable.id, requestId), eq(leaveRequestsTable.organizationId, actor.organizationId))).for("update").limit(1);
    if (!before) return { status: 404, message: "Pedido não encontrado." };
    if (before.userId !== actor.sub) return { status: 403, message: "Só quem pediu pode retirar a solicitação." };
    if (before.status !== "PENDING") return { status: 409, message: "Este pedido já foi decidido e não pode ser retirado aqui." };
    const [after] = await tx.update(leaveRequestsTable).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(leaveRequestsTable.id, requestId)).returning();
    await record({ category: "ABSENCE", action: "leave.cancelled", title: "Pedido de folga retirado", narrative: "A pessoa retirou o pedido antes da decisão.", entityType: "leave_request", entityId: requestId, actorId: actor.sub, orgId: actor.organizationId, beforeState: before, afterState: after }, tx);
    await avisarGestaoDaFolga(tx, actor.organizationId, before.areaId, actor.sub, requestId, "Pedido de folga retirado", `O pedido de ${periodoLegivel(before.startDate, before.endDate)} foi retirado antes da decisão.`, "leave.cancelled");
    return { status: 200, request: after };
  });
  if (result.status !== 200) { res.status(result.status).json({ message: result.message }); return; }
  res.json({ request: result.request });
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
    const aoVivo = await montarEscalaDoDia(actor.organizationId, row.scale.locationId, date);
    if (!aoVivo?.escala) continue;
    const dia = await comoPublicada(aoVivo);
    // `aoVivo.escala` já foi conferido acima; `comoPublicada` devolve o mesmo dia, mas o tipo não
    // carrega essa garantia — guardar o id aqui evita repetir a checagem em cada linha abaixo.
    const escalaId = aoVivo.escala.id;
    const operationId = await operationForLocation(row.scale.locationId);
    const retrato = operationId ? await ultimoRetratoFolgas(operationId, Number(date.slice(0, 4)), Number(date.slice(5, 7))) : null;
    const deFolga = retrato?.folgas?.some((item) => item.userId === actor.sub && item.startDate <= date && item.endDate >= date) ?? false;
    const chamada = dia.pessoas.find((person) => person.id === actor.sub)?.chamadaNaFolga?.motivo;
    for (const block of dia.blocos.filter((item) => item.pessoaIds.includes(actor.sub) && (!deFolga || chamada))) blocks.push({ location: dia.location, scaleId: escalaId, block });
    checkIns.push(...await db.select().from(dayCheckInsTable).where(and(eq(dayCheckInsTable.scaleId, escalaId), eq(dayCheckInsTable.userId, actor.sub))));
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
  // Só os Livros do dia consultado (a data do Livro é a do show na Agenda) e que não foram cancelados:
  // sem isso, vaga aberta de um dia que já passou continuava aparecendo como "posição em risco" para sempre.
  const booksInScope = locationIds.length ? await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable)
    .innerJoin(scalesTable, eq(dailyBooksTable.scaleId, scalesTable.id))
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .where(and(inArray(scalesTable.locationId, locationIds), eq(agendaEventsTable.date, date), ne(dailyBooksTable.status, "CANCELLED"))) : [];
  const bookIds = booksInScope.map((book) => book.id);
  if (bookIds.length) {
    const rows = await db.select({ id: dailyBookCheckInVacanciesTable.id, areaId: usersTable.areaId }).from(dailyBookCheckInVacanciesTable)
      .innerJoin(dailyBookAssignmentsTable, eq(dailyBookCheckInVacanciesTable.assignmentId, dailyBookAssignmentsTable.id))
      .leftJoin(usersTable, eq(dailyBookAssignmentsTable.userId, usersTable.id))
      .where(and(eq(dailyBookCheckInVacanciesTable.active, true), inArray(dailyBookCheckInVacanciesTable.dailyBookId, bookIds)));
    const allowedAreaIds = isSupervisor(actor.role) ? new Set(scopes.map((scope) => scope.areaId)) : null;
    vacant = rows.filter((row) => !allowedAreaIds || (row.areaId && allowedAreaIds.has(row.areaId))).length;
  }
  // Quem está de folga no dia: as folgas marcadas (mapa do mês, grupos, "Definir folga") e os pedidos aprovados, sem contar a
  // mesma pessoa duas vezes. Antes só entravam os pedidos aprovados, e o Painel dizia "0" com gente de folga marcada.
  const leaveRows = await db.select({ userId: leaveRequestsTable.userId, areaId: leaveRequestsTable.areaId }).from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, actor.organizationId), eq(leaveRequestsTable.status, "APPROVED"), lte(leaveRequestsTable.startDate, date), gte(leaveRequestsTable.endDate, date)));
  const folgaRows = await db.select({ userId: folgasTable.userId, areaId: usersTable.areaId }).from(folgasTable)
    .innerJoin(usersTable, eq(folgasTable.userId, usersTable.id))
    .where(and(eq(usersTable.organizationId, actor.organizationId), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, date), gte(folgasTable.endDate, date)));
  const deFolga = [...leaveRows, ...folgaRows].filter((row) => !isSupervisor(actor.role) || (row.areaId && scopes.some((scope) => scope.areaId === row.areaId)));
  const scopedLeaves = [...new Set(deFolga.map((row) => row.userId))];
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
