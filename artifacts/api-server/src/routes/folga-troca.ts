/**
 * Troca de folga com colega (Etapa 3). Só existe quando o colega JÁ está de folga no dia pedido:
 * quem pediu fica com o dia pedido e o colega fica com um dia de folga dela (o "dia devolvido"). A
 * Supervisão propõe, o colega aceita ou recusa (recusa pede motivo e volta para a Supervisão). Quando o
 * colega trabalha naquele dia não é troca, é cobertura, e a análise do dia só mostra quem pode cobrir.
 *
 * "Esperando o colega" é derivado: peer_id preenchido e peer_accepted nulo; o status do pedido continua
 * PENDING. A troca é de um dia por vez. Aplicada numa transação só, com Registro e avisos.
 */
import { Router, type IRouter } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, folgasTable, leaveRequestsTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { enqueueNotification } from "../services/undo.js";
import { avisarRepublicacaoFolgas } from "../services/folgas-publicadas.js";
import { barreiraDeDecisao } from "../services/folga-decisao.js";
import { operacaoDaPessoa, supervisoresDaArea } from "../services/folga-roteamento.js";
import { cancelAndSplit } from "./folgas.js";

const router: IRouter = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const dia = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const idDaRota = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor) ?? "";
const registrar = (tx: Tx, input: Parameters<typeof writeHistoryEvent>[0]) => writeHistoryEvent(input, tx as unknown as HistoryExecutor);

async function pedidoDaOrganizacao(id: string, organizationId: string) {
  if (!UUID.test(id)) return null;
  const [pedido] = await db.select().from(leaveRequestsTable).where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.organizationId, organizationId))).limit(1);
  return pedido ?? null;
}

/** A folga ativa de uma pessoa que cobre o dia (do tipo folga mesmo, não recesso nem afastamento). */
async function folgaDoDia(tx: Tx | typeof db, userId: string, date: string) {
  const [f] = await tx.select().from(folgasTable).where(and(
    eq(folgasTable.userId, userId), eq(folgasTable.status, "ACTIVE"), eq(folgasTable.type, "DAY_OFF"), lte(folgasTable.startDate, date), gte(folgasTable.endDate, date),
  )).limit(1);
  return f ?? null;
}
const temFolgaNoDia = async (tx: Tx | typeof db, userId: string, date: string) => {
  const [f] = await tx.select({ id: folgasTable.id }).from(folgasTable).where(and(eq(folgasTable.userId, userId), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, date), gte(folgasTable.endDate, date))).limit(1);
  return Boolean(f);
};

async function avisar(tx: Tx, userId: string, chave: string, type: string, title: string, message: string, requestId: string) {
  await enqueueNotification(tx as never, { userId, type, title, message, category: "absence", entityType: "leave_request", entityId: requestId, actionUrl: "/folgas" }, new Date(), { deduplicationKey: `folga:${requestId}:${chave}:${userId}` });
}

// ─── Propor a troca ──────────────────────────────────────────────────────────

router.post("/leave-requests/:id/troca", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!, body = req.body as Record<string, unknown>;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  const barreira = await barreiraDeDecisao(ator, pedido);
  if (barreira) { res.status(barreira.status).json({ message: barreira.message }); return; }
  const peerId = typeof body.peerId === "string" ? body.peerId : "", devolvido = typeof body.diaDevolvido === "string" ? body.diaDevolvido : "";
  if (!UUID.test(peerId) || !DATA.test(devolvido)) { res.status(400).json({ message: "Escolha o colega e o dia de folga que ele fica." }); return; }
  if (pedido.startDate !== pedido.endDate) { res.status(400).json({ message: "A troca é de um dia por vez. Peça a troca de cada dia separadamente." }); return; }
  if (pedido.peerId && pedido.peerAccepted === null) { res.status(409).json({ message: "Já há uma troca esperando o colega responder. Retire a proposta antes de propor outra." }); return; }
  if (pedido.alternativeDates?.length && pedido.alternativeAccepted === null) { res.status(409).json({ message: "Há uma proposta de dias esperando a resposta de quem pediu. Retire-a antes de propor uma troca." }); return; }
  if (peerId === pedido.userId) { res.status(400).json({ message: "O colega precisa ser outra pessoa." }); return; }
  const [colega] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
    .where(and(eq(usersTable.id, peerId), eq(usersTable.organizationId, ator.organizationId), eq(usersTable.status, "ACTIVE"))).limit(1);
  if (!colega) { res.status(400).json({ message: "Colega não encontrado." }); return; }
  const [pessoa] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, pedido.userId)).limit(1);
  const pedidoDia = pedido.startDate;
  if (!(await folgaDoDia(db, peerId, pedidoDia))) { res.status(400).json({ message: `${colega.name} não está de folga em ${dia(pedidoDia)}: nesse caso não é troca, é cobertura.` }); return; }
  if (devolvido === pedidoDia || !(await folgaDoDia(db, pedido.userId, devolvido))) { res.status(400).json({ message: `${dia(devolvido)} não é uma folga de ${pessoa?.name ?? "quem pediu"}: o dia que o colega recebe precisa ser uma folga dela.` }); return; }
  if (await temFolgaNoDia(db, peerId, devolvido)) { res.status(400).json({ message: `${colega.name} já está de folga em ${dia(devolvido)}.` }); return; }

  const salvo = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({
      peerId, peerProposedBy: ator.sub, peerAccepted: null, peerRespondedAt: null, peerReason: null, swapReturnDate: devolvido, updatedAt: new Date(),
    }).where(and(eq(leaveRequestsTable.id, pedido.id), eq(leaveRequestsTable.status, "PENDING"))).returning();
    if (!saved) return null;
    await registrar(tx, { category: "ABSENCE", action: "leave.swap_proposed", title: "Troca de folga proposta", narrative: `Troca com ${colega.name}: ${dia(pedidoDia)} para ${pessoa?.name ?? "quem pediu"}, ${dia(devolvido)} para ${colega.name}.`, entityType: "leave_request", entityId: pedido.id, actorId: ator.sub, orgId: ator.organizationId, beforeState: pedido, afterState: saved, metadata: { peerId, diaPedido: pedidoDia, diaDevolvido: devolvido } });
    await avisar(tx, peerId, `troca_proposta:${devolvido}`, "leave.swap_proposed", "Pedido de troca de folga",
      `${pessoa?.name ?? "Uma colega"} quer folgar em ${dia(pedidoDia)} e você já está de folga nesse dia. Se você aceitar, trabalha em ${dia(pedidoDia)} e fica com a folga de ${dia(devolvido)}.`, pedido.id);
    return saved;
  });
  if (!salvo) { res.status(409).json({ message: "Este pedido já foi decidido ou retirado." }); return; }
  res.json({ request: salvo });
});

// ─── Resposta do colega ──────────────────────────────────────────────────────

router.post("/leave-requests/:id/troca/resposta", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!, body = req.body as Record<string, unknown>;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Troca não encontrada." }); return; }
  if (!pedido.peerId) { res.status(409).json({ message: "Esta troca não está mais esperando resposta." }); return; }
  if (pedido.peerId !== ator.sub) { res.status(403).json({ message: "Só o colega escolhido responde a esta troca." }); return; }
  if (typeof body.aceita !== "boolean") { res.status(400).json({ message: "Aceita ou recusa?" }); return; }
  const aceita = body.aceita, motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 600) : "";
  if (!aceita && !motivo) { res.status(400).json({ message: "Recusar a troca pede o motivo: a Supervisão vai ler." }); return; }

  type Resultado = { status: number; message: string } | { ok: true; request: typeof pedido };
  const resultado: Resultado = await db.transaction(async (tx): Promise<Resultado> => {
    const [atual] = await tx.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, pedido.id)).for("update").limit(1);
    if (!atual || atual.status !== "PENDING" || atual.peerId !== ator.sub || atual.peerAccepted !== null || !atual.swapReturnDate) return { status: 409, message: "Esta troca não está mais esperando resposta." };
    const pedidoDia = atual.startDate, devolvido = atual.swapReturnDate;
    const [pessoa] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, atual.userId)).limit(1);
    const [colega] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ator.sub)).limit(1);
    const quemAvisar = [...new Set([atual.peerProposedBy, ...(await supervisoresDaArea(tx, atual.areaId))].filter((id): id is string => Boolean(id)))].filter((id) => id !== ator.sub);

    const recusar = async (porque: string, conflito: boolean): Promise<Resultado> => {
      const [saved] = await tx.update(leaveRequestsTable).set({ peerAccepted: false, peerRespondedAt: new Date(), peerReason: porque, updatedAt: new Date() }).where(eq(leaveRequestsTable.id, atual.id)).returning();
      await registrar(tx, { category: "ABSENCE", action: "leave.swap_refused", title: conflito ? "Troca de folga não pôde ser aplicada" : "Troca de folga recusada", narrative: porque, entityType: "leave_request", entityId: atual.id, actorId: ator.sub, orgId: ator.organizationId, beforeState: atual, afterState: saved, metadata: { motivo: porque, conflito } });
      for (const id of quemAvisar) await avisar(tx, id, "troca_recusada", "leave.swap_refused", conflito ? "A troca de folga não pôde ser feita" : "Troca de folga recusada",
        conflito ? `${colega?.name ?? "O colega"} aceitou, mas a folga mudou desde a proposta. Proponha a troca de novo.` : `${colega?.name ?? "O colega"} recusou a troca de ${dia(pedidoDia)}: ${porque}. O pedido voltou para você decidir.`, atual.id);
      return conflito ? { status: 409, message: "A folga mudou desde a proposta, então a troca não foi feita. A Supervisão precisa propor de novo." } : { ok: true, request: saved! };
    };
    if (!aceita) return recusar(motivo, false);

    // Aceitar: confere que o mapa ainda é o de quando a troca foi proposta.
    const folgaColega = await folgaDoDia(tx, ator.sub, pedidoDia), folgaPessoa = await folgaDoDia(tx, atual.userId, devolvido);
    if (!folgaColega || !folgaPessoa || (await temFolgaNoDia(tx, atual.userId, pedidoDia)) || (await temFolgaNoDia(tx, ator.sub, devolvido))) return recusar("A folga mudou antes da resposta.", true);
    const operacaoPessoa = await operacaoDaPessoa(tx, atual.userId, ator.organizationId), operacaoColega = await operacaoDaPessoa(tx, ator.sub, ator.organizationId);
    if (!operacaoPessoa || !operacaoColega) return { status: 409, message: "Uma das pessoas não tem operação ativa para registrar a folga." };

    await cancelAndSplit(folgaPessoa, devolvido, atual.peerProposedBy ?? ator.sub, tx);
    await cancelAndSplit(folgaColega, pedidoDia, atual.peerProposedBy ?? ator.sub, tx);
    const nota = `Troca do pedido ${atual.id}`;
    await tx.insert(folgasTable).values([
      { userId: atual.userId, operationId: operacaoPessoa, type: "DAY_OFF", startDate: pedidoDia, endDate: pedidoDia, status: "ACTIVE", origem: "SOLICITACAO", createdBy: atual.peerProposedBy ?? ator.sub, notes: nota },
      { userId: ator.sub, operationId: operacaoColega, type: "DAY_OFF", startDate: devolvido, endDate: devolvido, status: "ACTIVE", origem: "SOLICITACAO", createdBy: atual.peerProposedBy ?? ator.sub, notes: nota },
    ]);
    const razao = `Troca com ${colega?.name ?? "o colega"}: ${pessoa?.name ?? "quem pediu"} folga em ${dia(pedidoDia)} e ${colega?.name ?? "o colega"} folga em ${dia(devolvido)}.`;
    const [saved] = await tx.update(leaveRequestsTable).set({ status: "APPROVED", decidedBy: atual.peerProposedBy ?? ator.sub, decisionReason: razao, decidedAt: new Date(), peerAccepted: true, peerRespondedAt: new Date(), updatedAt: new Date() }).where(eq(leaveRequestsTable.id, atual.id)).returning();
    const eventId = await registrar(tx, { category: "ABSENCE", action: "leave.swapped", title: "Folga trocada com colega", narrative: razao, entityType: "leave_request", entityId: atual.id, actorId: ator.sub, orgId: ator.organizationId, operationId: operacaoPessoa, beforeState: atual, afterState: saved, metadata: { peerId: ator.sub, diaPedido: pedidoDia, diaDevolvido: devolvido } });
    await avisarRepublicacaoFolgas(tx, ator.organizationId, operacaoPessoa, pedidoDia < devolvido ? pedidoDia : devolvido, pedidoDia < devolvido ? devolvido : pedidoDia, eventId);
    await avisar(tx, atual.userId, "troca_feita", "leave.swapped", "Sua troca de folga foi feita", `${colega?.name ?? "O colega"} aceitou: você folga em ${dia(pedidoDia)} e devolve a folga de ${dia(devolvido)}. A folga aparece no calendário quando a Administração publicar o mês.`, atual.id);
    for (const id of quemAvisar.filter((x) => x !== atual.userId)) await avisar(tx, id, "troca_feita", "leave.swapped", "Troca de folga feita", `${colega?.name ?? "O colega"} aceitou a troca de ${dia(pedidoDia)}.`, atual.id);
    return { ok: true, request: saved! };
  });
  if ("ok" in resultado) { res.json({ request: resultado.request }); return; }
  res.status(resultado.status).json({ message: resultado.message });
});

// ─── Retirar a proposta (colega que não responde) ────────────────────────────

router.post("/leave-requests/:id/troca/retirar", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  const barreira = await barreiraDeDecisao(ator, pedido);
  if (barreira) { res.status(barreira.status).json({ message: barreira.message }); return; }
  if (!pedido.peerId || pedido.peerAccepted !== null) { res.status(409).json({ message: "Não há troca esperando resposta." }); return; }
  const colegaId = pedido.peerId;
  const salvo = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({ peerId: null, peerProposedBy: null, peerAccepted: null, peerRespondedAt: null, peerReason: null, swapReturnDate: null, updatedAt: new Date() })
      .where(and(eq(leaveRequestsTable.id, pedido.id), eq(leaveRequestsTable.status, "PENDING"), eq(leaveRequestsTable.peerId, colegaId))).returning();
    if (!saved) return null;
    await registrar(tx, { category: "ABSENCE", action: "leave.swap_withdrawn", title: "Proposta de troca retirada", narrative: "A Supervisão retirou a proposta de troca antes de o colega responder.", entityType: "leave_request", entityId: pedido.id, actorId: ator.sub, orgId: ator.organizationId, beforeState: pedido, afterState: saved });
    await avisar(tx, colegaId, "troca_retirada", "leave.swap_withdrawn", "Pedido de troca retirado", "A proposta de troca de folga que esperava por você foi retirada. Não precisa mais responder.", pedido.id);
    return saved;
  });
  if (!salvo) { res.status(409).json({ message: "Esta troca não está mais esperando resposta." }); return; }
  res.json({ request: salvo });
});

export default router;
