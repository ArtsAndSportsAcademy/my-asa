/**
 * Solicitações (tela nova, 01/10/2026) — pedidos do Elenco que não são folga:
 * - Horário na escala (peruca, gravar vídeo…): aprovado, vira bloco da Escala do dia (escala-dia.ts).
 * - Troca com colega: o colega aceita primeiro; depois a Supervisão decide.
 * - Mudança de horário, restrição (saúde/física) e outro assunto.
 * A folga continua em leave_requests (tela Folgas); a tela de Solicitações só a mostra e pede por lá.
 *
 * Quem decide: a Supervisão da área da pessoa (área + local, mesma regra das Folgas) ou a
 * Administração. Direção acompanha, sem decidir e sem ler o detalhe de restrição de saúde.
 * Recusar exige motivo. Ninguém decide o próprio pedido. Toda escrita entra no Registro na mesma
 * transação, e os avisos vão pela fila durável (outbox).
 */
import { Router, type IRouter } from "express";
import { aliasedTable, and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, locationsTable, operationsTable, requestDecisionsTable,
  requestsTable, restrictionsTable, userRolesTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { canSupervisorAccessPerson, listAreaLocalScopes } from "../services/area-local-scope.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { enqueueNotification } from "../services/undo.js";
import type { CreateNotificationInput } from "../services/notificationService.js";
import { operationalDate } from "../lib/operational-date.js";

const router: IRouter = Router();
const ROTA = "/solicitacoes";

export const TIPOS = ["ESCALA_SLOT", "SWAP", "SCHEDULE_CHANGE", "HEALTH_RESTRICTION", "PHYSICAL_RESTRICTION", "OTHER"] as const;
type Tipo = (typeof TIPOS)[number];
const NOME_TIPO: Record<Tipo, string> = {
  ESCALA_SLOT: "horário na escala", SWAP: "troca com colega", SCHEDULE_CHANGE: "mudança de horário",
  HEALTH_RESTRICTION: "restrição de saúde", PHYSICAL_RESTRICTION: "restrição física", OTHER: "outro assunto",
};
const ABERTOS = ["WAITING_PEER", "PENDING"] as const;
const RESTRICAO = new Set<string>(["HEALTH_RESTRICTION", "PHYSICAL_RESTRICTION"]);

const isAdmin = (role: string) => role === "ADMIN";
const isDirector = (role: string) => role === "DIR" || role === "DIRECTOR";
const isSupervisor = (role: string) => role === "SUPERVISOR_A" || role === "SUPERVISOR_B" || role === "SUP";
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, max = 600) => typeof v === "string" ? v.trim().slice(0, max) : "";
const hhmm = (v: string | null) => v ? v.slice(0, 5) : null;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const curta = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m! - 1]}`; };

type Ator = { sub: string; role: string; organizationId: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const registrar = (tx: Tx, input: Parameters<typeof writeHistoryEvent>[0]) => writeHistoryEvent(input, tx as unknown as HistoryExecutor);
const avisar = (tx: Tx, input: Omit<CreateNotificationInput, "category">, chave: string) => enqueueNotification(tx as never, { ...input, actionUrl: ROTA, category: "approval" }, new Date(), { deduplicationKey: chave });

/** Quem decide pelos pedidos de uma pessoa: a Supervisão da área (no local do pedido, se houver); sem ninguém, a Administração. */
async function decisores(tx: Tx, organizationId: string, areaId: string | null, locationId: string | null, menos: string) {
  let ids: string[] = [];
  if (areaId) {
    const rows = await tx.select({ id: areaLocalSupervisorsTable.supervisorId, locationId: areaLocalSupervisorsTable.locationId }).from(areaLocalSupervisorsTable)
      .where(and(eq(areaLocalSupervisorsTable.areaId, areaId), eq(areaLocalSupervisorsTable.active, true)));
    const noLocal = locationId ? rows.filter((r) => r.locationId === locationId) : [];
    ids = [...new Set((noLocal.length ? noLocal : rows).map((r) => r.id))];
  }
  if (!ids.length) {
    const admins = await tx.select({ id: usersTable.id }).from(userRolesTable).innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(eq(usersTable.organizationId, organizationId), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true), eq(usersTable.status, "ACTIVE")));
    ids = [...new Set(admins.map((a) => a.id))];
  }
  return ids.filter((id) => id !== menos);
}

async function podeDecidir(ator: Ator, pedido: { requesterId: string }) {
  if (pedido.requesterId === ator.sub) return false;
  if (isAdmin(ator.role)) return true;
  return isSupervisor(ator.role) && canSupervisorAccessPerson({ supervisorId: ator.sub, organizationId: ator.organizationId, personId: pedido.requesterId });
}

const colega = aliasedTable(usersTable, "colega");
const decisor = aliasedTable(usersTable, "decisor");
function selecao() {
  return db.select({
    r: requestsTable, nome: usersTable.name, nomeCompleto: usersTable.fullName, area: areasTable.name, local: locationsTable.name,
    colegaNome: colega.name, decisorNome: decisor.name,
  }).from(requestsTable)
    .innerJoin(usersTable, eq(requestsTable.requesterId, usersTable.id))
    .leftJoin(areasTable, eq(requestsTable.areaId, areasTable.id))
    .leftJoin(locationsTable, eq(requestsTable.locationId, locationsTable.id))
    .leftJoin(colega, eq(requestsTable.peerId, colega.id))
    .leftJoin(decisor, eq(requestsTable.decidedBy, decisor.id));
}
type Linha = { r: typeof requestsTable.$inferSelect; nome: string | null; nomeCompleto: string | null; area: string | null; local: string | null; colegaNome: string | null; decisorNome: string | null };

async function projetar(ator: Ator, l: Linha) {
  const r = l.r, datas = [...r.targetDates].sort();
  const meu = r.requesterId === ator.sub, souColega = r.peerId === ator.sub;
  // Direção acompanha sem ler o detalhe de saúde (doc 12); o colega da troca lê só o que é dele.
  const oculto = RESTRICAO.has(r.type) && isDirector(ator.role) && !meu;
  return {
    id: r.id, tipo: r.type, estado: r.status,
    pessoa: { id: r.requesterId, nome: l.nome ?? l.nomeCompleto }, area: l.area, local: l.local, localId: r.locationId,
    colega: r.peerId ? { id: r.peerId, nome: l.colegaNome } : null,
    data: datas[0] ?? null, ate: datas.length > 1 ? datas[datas.length - 1]! : null,
    inicio: hhmm(r.startTime), fim: hhmm(r.endTime), assunto: r.subject,
    motivo: oculto ? null : r.reason, oculto,
    decisao: r.decidedAt ? { por: l.decisorNome, em: r.decidedAt, motivo: r.decisionReason } : null,
    colegaRespondeuEm: r.peerRespondedAt, criadoEm: r.createdAt,
    pode: {
      cancelar: meu && (ABERTOS as readonly string[]).includes(r.status),
      responderColega: souColega && r.status === "WAITING_PEER",
      decidir: r.status === "PENDING" && await podeDecidir(ator, r),
    },
  };
}

// ─── Lista ────────────────────────────────────────────────────────────────────

router.get("/solicitacoes", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user! as Ator;
  // Abertos sempre; encerrados dos últimos 120 dias.
  const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const recorte = or(inArray(requestsTable.status, [...ABERTOS]), gte(requestsTable.updatedAt, desde));
  const daOrg = eq(requestsTable.organizationId, ator.organizationId);
  let escopo;
  if (isAdmin(ator.role) || isDirector(ator.role)) escopo = daOrg;
  else if (isSupervisor(ator.role)) {
    const areas = [...new Set((await listAreaLocalScopes(ator.sub, ator.organizationId)).map((s) => s.areaId))];
    escopo = and(daOrg, or(eq(requestsTable.requesterId, ator.sub), eq(requestsTable.peerId, ator.sub), areas.length ? inArray(requestsTable.areaId, areas) : sql`false`));
  } else escopo = and(daOrg, or(eq(requestsTable.requesterId, ator.sub), eq(requestsTable.peerId, ator.sub)));
  const linhas: Linha[] = await selecao().where(and(escopo, recorte)).orderBy(desc(requestsTable.createdAt)).limit(300);
  const pedidos = [];
  for (const l of linhas) {
    // O colega só vê a troca enquanto ela depende dele ou depois que ele respondeu — nunca um pedido cancelado antes.
    if (l.r.peerId === ator.sub && l.r.requesterId !== ator.sub && !isAdmin(ator.role) && l.r.status === "CANCELLED" && !l.r.peerRespondedAt) continue;
    pedidos.push(await projetar(ator, l));
  }
  res.json({ pedidos, podeDecidir: isAdmin(ator.role) || isSupervisor(ator.role) });
});

/** Colegas para a troca: pessoas ativas da organização (só nome e área). */
router.get("/solicitacoes/colegas", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user! as Ator;
  const rows = await db.select({ id: usersTable.id, nome: usersTable.name, area: areasTable.name }).from(usersTable)
    .leftJoin(areasTable, eq(usersTable.areaId, areasTable.id))
    .where(and(eq(usersTable.organizationId, ator.organizationId), eq(usersTable.status, "ACTIVE"), eq(usersTable.personStatus, "ACTIVE")))
    .orderBy(usersTable.name);
  res.json({ colegas: rows.filter((r) => r.id !== ator.sub) });
});

// ─── Novo pedido ──────────────────────────────────────────────────────────────

router.post("/solicitacoes", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user! as Ator, b = (req.body ?? {}) as Record<string, unknown>;
  if (isDirector(ator.role)) { res.status(403).json({ error: "Forbidden", message: "A Direção acompanha os pedidos, sem abrir pedido." }); return; }
  const tipo = b.tipo as Tipo;
  if (!TIPOS.includes(tipo)) { res.status(400).json({ error: "Bad Request", message: "Escolha o tipo do pedido." }); return; }
  const data = texto(b.data, 10), ate = texto(b.ate, 10), inicio = texto(b.inicio, 5), fim = texto(b.fim, 5);
  const assunto = texto(b.assunto, 120), motivo = texto(b.motivo), colegaId = texto(b.colegaId, 36);
  const erro = (message: string) => { res.status(400).json({ error: "Bad Request", message }); };
  if (data && !DATA.test(data)) return erro("Data inválida.");
  if (ate && !DATA.test(ate)) return erro("Data final inválida.");
  if ((inicio && !HORA.test(inicio)) || (fim && !HORA.test(fim))) return erro("Horário inválido.");
  if (inicio && fim && fim <= inicio) return erro("O horário final precisa ser depois do inicial.");
  if (data && data < operationalDate()) return erro("Escolha hoje ou uma data futura.");
  if (tipo === "ESCALA_SLOT" && (!data || !inicio || !fim || !assunto)) return erro("Diga o dia, o horário e para quê (ex.: peruca).");
  if (tipo === "SWAP" && (!data || !colegaId || !motivo)) return erro("Diga o dia, com quem é a troca e o que vocês querem trocar.");
  if (tipo === "SCHEDULE_CHANGE" && (!data || !motivo)) return erro("Diga o dia e o horário de que você precisa.");
  if (RESTRICAO.has(tipo) && (!data || !ate || ate < data || !motivo)) return erro("Diga de quando até quando e o que você não pode fazer.");
  if (tipo === "OTHER" && (!assunto || !motivo)) return erro("Diga o assunto e conte o pedido.");
  if (tipo === "SWAP" && (!UUID.test(colegaId) || colegaId === ator.sub)) return erro("Escolha a colega da troca.");

  const [eu] = await db.select({ id: usersTable.id, nome: usersTable.name, areaId: usersTable.areaId, localPadrao: usersTable.defaultLocationId }).from(usersTable)
    .where(and(eq(usersTable.id, ator.sub), eq(usersTable.organizationId, ator.organizationId))).limit(1);
  if (!eu) { res.status(404).json({ error: "Not Found" }); return; }
  let localId: string | null = texto(b.localId, 36) || eu.localPadrao || null;
  if (localId) {
    const [local] = UUID.test(localId) ? await db.select({ id: locationsTable.id }).from(locationsTable)
      .where(and(eq(locationsTable.id, localId), eq(locationsTable.organizationId, ator.organizationId), eq(locationsTable.closed, false))).limit(1) : [];
    if (!local) return erro("Local inválido.");
  }
  if (tipo === "ESCALA_SLOT" && !localId) return erro("Escolha em qual local é o horário.");
  if (tipo === "SWAP") {
    const [c] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, colegaId), eq(usersTable.organizationId, ator.organizationId), eq(usersTable.status, "ACTIVE"))).limit(1);
    if (!c) return erro("Essa colega não está ativa.");
  }

  const pedido = await db.transaction(async (tx) => {
    const [papel] = await tx.select({ operationId: userRolesTable.operationId }).from(userRolesTable).where(and(eq(userRolesTable.userId, ator.sub), eq(userRolesTable.active, true))).limit(1);
    const [primeira] = papel ? [papel] : await tx.select({ operationId: operationsTable.id }).from(operationsTable).where(eq(operationsTable.organizationId, ator.organizationId)).orderBy(operationsTable.createdAt).limit(1);
    if (!primeira?.operationId) throw new Error("A organização não tem operação.");
    const [criado] = await tx.insert(requestsTable).values({
      requesterId: ator.sub, operationId: primeira.operationId, organizationId: ator.organizationId, areaId: eu.areaId, locationId: localId,
      type: tipo, status: tipo === "SWAP" ? "WAITING_PEER" : "PENDING",
      targetDates: data ? (ate && ate !== data ? [data, ate] : [data]) : [],
      startTime: inicio || null, endTime: fim || null, subject: assunto || null, reason: motivo || null, peerId: tipo === "SWAP" ? colegaId : null,
    }).returning();
    const quando = data ? ` para ${curta(data)}${ate && ate !== data ? ` a ${curta(ate)}` : ""}${inicio ? `, ${inicio}${fim ? `–${fim}` : ""}` : ""}` : "";
    await registrar(tx, {
      category: "REQUEST", action: "solicitacao.criada", title: `Pedido de ${NOME_TIPO[tipo]}`,
      narrative: `${eu.nome} pediu ${NOME_TIPO[tipo]}${assunto ? ` (${assunto})` : ""}${quando}.`,
      entityType: "request", entityId: criado!.id, actorId: ator.sub, orgId: ator.organizationId, operationId: criado!.operationId,
      beforeState: null, afterState: { ...criado!, reason: RESTRICAO.has(tipo) ? "[detalhe de saúde]" : criado!.reason },
    });
    if (tipo === "SWAP") await avisar(tx, { userId: colegaId, type: "request.swap_peer", title: "Pedido de troca", message: `${eu.nome} quer trocar com você${quando}. Abra para aceitar ou não.`, priority: "IMPORTANT", entityType: "request", entityId: criado!.id }, `sol:${criado!.id}:colega`);
    else for (const id of await decisores(tx, ator.organizationId, eu.areaId, localId, ator.sub)) {
      await avisar(tx, { userId: id, type: "request.new", title: "Pedido novo", message: `${eu.nome} pediu ${NOME_TIPO[tipo]}${quando}.`, priority: "NORMAL", entityType: "request", entityId: criado!.id }, `sol:${criado!.id}:novo:${id}`);
    }
    return criado!;
  });
  const [linha] = await selecao().where(eq(requestsTable.id, pedido.id));
  res.status(201).json({ pedido: await projetar(ator, linha!) });
});

// ─── Ações sobre um pedido ────────────────────────────────────────────────────

async function travar(tx: Tx, id: string, organizationId: string) {
  if (!UUID.test(id)) return null;
  const [r] = await tx.select().from(requestsTable).where(and(eq(requestsTable.id, id), eq(requestsTable.organizationId, organizationId))).for("update").limit(1);
  return r ?? null;
}
class Recusa extends Error { constructor(public status: number, message: string) { super(message); } }
async function responder(res: import("express").Response, ator: Ator, id: string, fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(fn);
    const [linha] = await selecao().where(eq(requestsTable.id, id));
    res.json({ pedido: await projetar(ator, linha!) });
  } catch (e) {
    if (e instanceof Recusa) { res.status(e.status).json({ error: e.status === 409 ? "Conflict" : e.status === 403 ? "Forbidden" : e.status === 404 ? "Not Found" : "Bad Request", message: e.message }); return; }
    throw e;
  }
}
const idDe = (req: import("express").Request) => String(req.params.id ?? "");

/** O colega aceita (vai para a Supervisão) ou não (a troca acaba). */
router.post("/solicitacoes/:id/colega", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user! as Ator, id = idDe(req), aceita = req.body?.aceita === true, motivo = texto(req.body?.motivo);
  await responder(res, ator, id, async (tx) => {
    const r = await travar(tx, id, ator.organizationId);
    if (!r) throw new Recusa(404, "Pedido não encontrado.");
    if (r.peerId !== ator.sub) throw new Recusa(403, "Só a colega da troca responde.");
    if (r.status !== "WAITING_PEER") throw new Recusa(409, "Esta troca já foi respondida ou cancelada.");
    if (!aceita && !motivo) throw new Recusa(400, "Conte por que não dá para trocar.");
    const agora = new Date();
    const [depois] = await tx.update(requestsTable).set(aceita
      ? { status: "PENDING", peerRespondedAt: agora, updatedAt: agora }
      : { status: "DENIED", peerRespondedAt: agora, decidedBy: ator.sub, decidedAt: agora, decisionReason: motivo, updatedAt: agora }).where(eq(requestsTable.id, r.id)).returning();
    const [eu] = await tx.select({ nome: usersTable.name }).from(usersTable).where(eq(usersTable.id, ator.sub));
    await registrar(tx, {
      category: "REQUEST", action: aceita ? "solicitacao.colega_aceitou" : "solicitacao.colega_recusou", title: aceita ? "Colega aceitou a troca" : "Colega não aceitou a troca",
      narrative: aceita ? `${eu?.nome} aceitou a troca. O pedido foi para a Supervisão.` : `${eu?.nome} não aceitou a troca. Motivo: ${motivo}`,
      entityType: "request", entityId: r.id, actorId: ator.sub, orgId: ator.organizationId, operationId: r.operationId, beforeState: r, afterState: depois!,
    });
    if (aceita) for (const uid of await decisores(tx, ator.organizationId, r.areaId, r.locationId, r.requesterId)) {
      await avisar(tx, { userId: uid, type: "request.new", title: "Troca para decidir", message: `Troca combinada entre duas pessoas, ${r.targetDates[0] ? curta(r.targetDates[0]) : ""}. Falta a sua decisão.`, priority: "NORMAL", entityType: "request", entityId: r.id }, `sol:${r.id}:novo:${uid}`);
    }
    await avisar(tx, { userId: r.requesterId, type: aceita ? "request.swap_accepted" : "request.denied", title: aceita ? "Troca aceita pela colega" : "Troca não aceita", message: aceita ? `${eu?.nome} aceitou. Agora falta a Supervisão.` : `${eu?.nome} não aceitou a troca: ${motivo}`, priority: aceita ? "NORMAL" : "IMPORTANT", entityType: "request", entityId: r.id }, `sol:${r.id}:colega-resposta`);
  });
});

/** Supervisão da área ou Administração decide. Recusar exige motivo; no horário, pode aprovar em outro horário (com motivo). */
router.post("/solicitacoes/:id/decisao", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user! as Ator, id = idDe(req), b = (req.body ?? {}) as Record<string, unknown>;
  const decisao = b.decisao === "APPROVED" || b.decisao === "DENIED" ? b.decisao : null;
  const motivo = texto(b.motivo), inicio = texto(b.inicio, 5), fim = texto(b.fim, 5);
  if (!decisao) { res.status(400).json({ error: "Bad Request", message: "Aprovar ou recusar?" }); return; }
  await responder(res, ator, id, async (tx) => {
    const r = await travar(tx, id, ator.organizationId);
    if (!r) throw new Recusa(404, "Pedido não encontrado.");
    if (!(await podeDecidir(ator, r))) throw new Recusa(403, r.requesterId === ator.sub ? "O seu próprio pedido é decidido por outra pessoa." : "Este pedido é de outra área.");
    if (r.status !== "PENDING") throw new Recusa(409, r.status === "WAITING_PEER" ? "A colega ainda não respondeu a troca." : "Este pedido já foi decidido ou cancelado.");
    if (decisao === "DENIED" && !motivo) throw new Recusa(400, "Recusar exige motivo.");
    const mudouHorario = r.type === "ESCALA_SLOT" && decisao === "APPROVED" && Boolean(inicio || fim) && (inicio !== hhmm(r.startTime) || fim !== hhmm(r.endTime));
    if (mudouHorario) {
      if (!HORA.test(inicio) || !HORA.test(fim) || fim <= inicio) throw new Recusa(400, "Horário novo inválido.");
      if (!motivo) throw new Recusa(400, "Aprovar em outro horário exige motivo.");
    }
    const agora = new Date();
    const [depois] = await tx.update(requestsTable).set({
      status: decisao, decidedBy: ator.sub, decidedAt: agora, decisionReason: motivo || null, updatedAt: agora,
      ...(mudouHorario ? { startTime: inicio, endTime: fim } : {}),
    }).where(eq(requestsTable.id, r.id)).returning();
    await tx.insert(requestDecisionsTable).values({ requestId: r.id, supervisorId: ator.sub, decision: decisao, reason: motivo || null, alternativeDetails: mudouHorario ? `Horário: ${hhmm(r.startTime)}–${hhmm(r.endTime)} → ${inicio}–${fim}` : null });
    if (decisao === "APPROVED" && RESTRICAO.has(r.type)) {
      const datas = [...r.targetDates].sort();
      await tx.insert(restrictionsTable).values({ userId: r.requesterId, type: r.type === "HEALTH_RESTRICTION" ? "HEALTH" : "PHYSICAL", periodStart: datas[0]!, periodEnd: datas[datas.length - 1]!, status: "ACTIVE", notes: `Pedido ${r.id}`, createdBy: ator.sub });
    }
    const [eu] = await tx.select({ nome: usersTable.name }).from(usersTable).where(eq(usersTable.id, ator.sub));
    const tipo = NOME_TIPO[r.type as Tipo] ?? "pedido";
    await registrar(tx, {
      category: "REQUEST", action: decisao === "APPROVED" ? "solicitacao.aprovada" : "solicitacao.recusada",
      title: decisao === "APPROVED" ? `Pedido de ${tipo} aprovado` : `Pedido de ${tipo} recusado`,
      narrative: `${eu?.nome} ${decisao === "APPROVED" ? "aprovou" : "recusou"} o pedido${mudouHorario ? ` em outro horário (${inicio}–${fim})` : ""}.${motivo ? ` Motivo: ${motivo}` : ""}`,
      entityType: "request", entityId: r.id, actorId: ator.sub, orgId: ator.organizationId, operationId: r.operationId,
      beforeState: { status: r.status, inicio: hhmm(r.startTime), fim: hhmm(r.endTime) }, afterState: { status: depois!.status, inicio: hhmm(depois!.startTime), fim: hhmm(depois!.endTime) },
      metadata: motivo ? { reason: motivo } : undefined,
    });
    const dia = r.targetDates[0] ? ` de ${curta(r.targetDates[0])}` : "";
    const msg = decisao === "APPROVED"
      ? `Seu pedido de ${tipo}${dia} foi aprovado${mudouHorario ? `, das ${inicio} às ${fim}` : ""}.${r.type === "ESCALA_SLOT" ? " Já está na sua escala." : ""}`
      : `Seu pedido de ${tipo}${dia} foi recusado: ${motivo}`;
    await avisar(tx, { userId: r.requesterId, type: decisao === "APPROVED" ? "request.approved" : "request.denied", title: decisao === "APPROVED" ? "Pedido aprovado" : "Pedido recusado", message: msg, priority: decisao === "APPROVED" ? "NORMAL" : "IMPORTANT", entityType: "request", entityId: r.id }, `sol:${r.id}:decisao`);
    if (r.type === "SWAP" && r.peerId) await avisar(tx, { userId: r.peerId, type: decisao === "APPROVED" ? "request.approved" : "request.denied", title: decisao === "APPROVED" ? "Troca aprovada" : "Troca recusada", message: decisao === "APPROVED" ? `A troca${dia} foi aprovada.` : `A troca${dia} foi recusada: ${motivo}`, priority: "NORMAL", entityType: "request", entityId: r.id }, `sol:${r.id}:decisao-colega`);
  });
});

/** A própria pessoa desiste enquanto o pedido não foi decidido. */
router.post("/solicitacoes/:id/cancelar", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user! as Ator, id = idDe(req);
  await responder(res, ator, id, async (tx) => {
    const r = await travar(tx, id, ator.organizationId);
    if (!r) throw new Recusa(404, "Pedido não encontrado.");
    if (r.requesterId !== ator.sub) throw new Recusa(403, "Só quem pediu pode cancelar.");
    if (!(ABERTOS as readonly string[]).includes(r.status)) throw new Recusa(409, "Este pedido já foi decidido.");
    const agora = new Date();
    const [depois] = await tx.update(requestsTable).set({ status: "CANCELLED", updatedAt: agora }).where(eq(requestsTable.id, r.id)).returning();
    await registrar(tx, {
      category: "REQUEST", action: "solicitacao.cancelada", title: "Pedido cancelado", narrative: "A pessoa desistiu do pedido antes da decisão.",
      entityType: "request", entityId: r.id, actorId: ator.sub, orgId: ator.organizationId, operationId: r.operationId, beforeState: { status: r.status }, afterState: { status: depois!.status },
    });
  });
});

export default router;
