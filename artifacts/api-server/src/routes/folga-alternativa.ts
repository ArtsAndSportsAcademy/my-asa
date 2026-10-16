/**
 * Mediação do pedido de folga (Etapa 3): quando só parte dos dias pedidos dá, a Supervisão propõe à
 * pessoa só os dias que dão. A pessoa aceita (só esses dias viram folga) ou recusa (o pedido volta para a
 * Supervisão decidir). A Supervisão pode retirar a proposta que ficou sem resposta.
 *
 * "Esperando a pessoa" é derivado: alternative_dates preenchido e alternative_accepted nulo; o status
 * do pedido continua PENDING.
 */
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, leaveRequestsTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { avisarRepublicacaoFolgas } from "../services/folgas-publicadas.js";
import { barreiraDeDecisao } from "../services/folga-decisao.js";
import { DATA, UUID, avisarFolga as avisar, dia, esperandoColega, esperandoPessoa, idDaRota, pedidoDaOrganizacao, registrar, type Tx } from "../services/folga-comum.js";
import { operacaoDaPessoa, supervisoresDaArea } from "../services/folga-roteamento.js";
import { aplicarFolgaDoPedido } from "./operational-cycle.js";

const router: IRouter = Router();
function diasDoPeriodo(inicio: string, fim: string) {
  const dias: string[] = [];
  for (let t = new Date(`${inicio}T12:00:00Z`); t <= new Date(`${fim}T12:00:00Z`) && dias.length < 400; t.setUTCDate(t.getUTCDate() + 1)) dias.push(t.toISOString().slice(0, 10));
  return dias;
}
/** Dias soltos viram trechos seguidos, para gravar menos linhas de folga. */
function emTrechos(dias: string[]) {
  const trechos: { de: string; ate: string }[] = [];
  for (const d of [...dias].sort()) {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && diasDoPeriodo(ultimo.ate, d).length === 2) ultimo.ate = d; else trechos.push({ de: d, ate: d });
  }
  return trechos;
}

// ─── Propor só os dias que dão ───────────────────────────────────────────────

router.post("/leave-requests/:id/alternativa", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!, body = req.body as Record<string, unknown>;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  const barreira = await barreiraDeDecisao(ator, pedido);
  if (barreira) { res.status(barreira.status).json({ message: barreira.message }); return; }
  const doPedido = diasDoPeriodo(pedido.startDate, pedido.endDate);
  const propostos = [...new Set((Array.isArray(body.dias) ? body.dias : []).filter((d): d is string => typeof d === "string" && DATA.test(d)))].sort();
  if (!propostos.length) { res.status(400).json({ message: "Escolha pelo menos um dia para propor." }); return; }
  if (propostos.some((d) => !doPedido.includes(d))) { res.status(400).json({ message: "Só dá para propor dias que estão no pedido." }); return; }
  if (propostos.length === doPedido.length) { res.status(400).json({ message: "Propor todos os dias do pedido é o mesmo que aprová-lo: use Aprovar." }); return; }
  if (esperandoPessoa(pedido)) { res.status(409).json({ message: "Já há uma proposta esperando a resposta da pessoa. Retire-a antes de propor outra." }); return; }
  if (esperandoColega(pedido)) { res.status(409).json({ message: "Há uma troca esperando o colega responder. Retire-a antes de propor outros dias." }); return; }

  const salvo = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({
      alternativeDates: propostos, alternativeProposedBy: ator.sub, alternativeAccepted: null, alternativeRespondedAt: null, alternativeReason: null, updatedAt: new Date(),
    }).where(and(eq(leaveRequestsTable.id, pedido.id), eq(leaveRequestsTable.status, "PENDING"))).returning();
    if (!saved) return null;
    await registrar(tx, { category: "ABSENCE", action: "leave.alternative_proposed", title: "Proposta de dias de folga", narrative: `Proposta de folga só em ${propostos.map(dia).join(", ")}.`, entityType: "leave_request", entityId: pedido.id, actorId: ator.sub, orgId: ator.organizationId, beforeState: pedido, afterState: saved, metadata: { dias: propostos } });
    await avisar(tx, pedido.userId, `alternativa_proposta:${propostos.join(",")}`, "leave.alternative_proposed", "Proposta para o seu pedido de folga",
      `Nem todos os dias do seu pedido deram. A Supervisão propõe você folgar em ${propostos.map(dia).join(", ")}. Aceite ou recuse em Minhas folgas.`, pedido.id);
    return saved;
  });
  if (!salvo) { res.status(409).json({ message: "Este pedido já foi decidido ou retirado." }); return; }
  res.json({ request: salvo });
});

// ─── Resposta de quem pediu ──────────────────────────────────────────────────

router.post("/leave-requests/:id/alternativa/resposta", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!, body = req.body as Record<string, unknown>;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Proposta não encontrada." }); return; }
  if (!pedido.alternativeDates?.length) { res.status(409).json({ message: "Esta proposta não está mais esperando resposta." }); return; }
  if (pedido.userId !== ator.sub) { res.status(403).json({ message: "Só quem pediu a folga responde a esta proposta." }); return; }
  if (typeof body.aceita !== "boolean") { res.status(400).json({ message: "Aceita ou recusa?" }); return; }
  const aceita = body.aceita, motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 600) : "";

  type Resultado = { status: number; message: string } | { ok: true; request: typeof pedido };
  const resultado: Resultado = await db.transaction(async (tx): Promise<Resultado> => {
    const [atual] = await tx.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, pedido.id)).for("update").limit(1);
    if (!atual || atual.status !== "PENDING" || !esperandoPessoa(atual) || !atual.alternativeDates) return { status: 409, message: "Esta proposta não está mais esperando resposta." };
    const propostos = atual.alternativeDates, quemPropos = atual.alternativeProposedBy ?? ator.sub;
    const [pessoa] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, atual.userId)).limit(1);
    const avisados = [...new Set([quemPropos, ...(await supervisoresDaArea(tx, atual.areaId))])].filter((id) => id !== ator.sub);

    if (!aceita) {
      const [saved] = await tx.update(leaveRequestsTable).set({ alternativeAccepted: false, alternativeRespondedAt: new Date(), alternativeReason: motivo || null, updatedAt: new Date() }).where(eq(leaveRequestsTable.id, atual.id)).returning();
      await registrar(tx, { category: "ABSENCE", action: "leave.alternative_refused", title: "Proposta de dias de folga recusada", narrative: motivo || "Recusada sem motivo escrito.", entityType: "leave_request", entityId: atual.id, actorId: ator.sub, orgId: ator.organizationId, beforeState: atual, afterState: saved, metadata: motivo ? { motivo } : undefined });
      for (const id of avisados) await avisar(tx, id, "alternativa_recusada", "leave.alternative_refused", "Proposta de folga recusada",
        `${pessoa?.name ?? "A pessoa"} não aceitou folgar só em ${propostos.map(dia).join(", ")}${motivo ? `: ${motivo}` : ""}. O pedido voltou para você decidir.`, atual.id);
      return { ok: true, request: saved! };
    }

    const operationId = await operacaoDaPessoa(tx, atual.userId, ator.organizationId);
    if (!operationId) return { status: 409, message: "A pessoa não tem operação ativa para registrar a folga." };
    for (const trecho of emTrechos(propostos)) await aplicarFolgaDoPedido(tx, { id: atual.id, userId: atual.userId, startDate: trecho.de, endDate: trecho.ate }, operationId, quemPropos);
    const razao = `Aprovada só em ${propostos.map(dia).join(", ")}: os outros dias do pedido não foram concedidos.`;
    const [saved] = await tx.update(leaveRequestsTable).set({ status: "APPROVED", decidedBy: quemPropos, decisionReason: razao, decidedAt: new Date(), alternativeAccepted: true, alternativeRespondedAt: new Date(), updatedAt: new Date() }).where(eq(leaveRequestsTable.id, atual.id)).returning();
    const eventId = await registrar(tx, { category: "ABSENCE", action: "leave.alternative_accepted", title: "Folga aprovada só nos dias propostos", narrative: razao, entityType: "leave_request", entityId: atual.id, actorId: ator.sub, orgId: ator.organizationId, operationId, beforeState: atual, afterState: saved, metadata: { dias: propostos } });
    await avisarRepublicacaoFolgas(tx, ator.organizationId, operationId, propostos[0]!, propostos[propostos.length - 1]!, eventId);
    for (const id of avisados) await avisar(tx, id, "alternativa_aceita", "leave.alternative_accepted", "Proposta de folga aceita", `${pessoa?.name ?? "A pessoa"} aceitou folgar em ${propostos.map(dia).join(", ")}.`, atual.id);
    return { ok: true, request: saved! };
  });
  if ("ok" in resultado) { res.json({ request: resultado.request }); return; }
  res.status(resultado.status).json({ message: resultado.message });
});

// ─── Retirar a proposta ──────────────────────────────────────────────────────

router.post("/leave-requests/:id/alternativa/retirar", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  const barreira = await barreiraDeDecisao(ator, pedido);
  if (barreira) { res.status(barreira.status).json({ message: barreira.message }); return; }
  if (!esperandoPessoa(pedido)) { res.status(409).json({ message: "Não há proposta esperando resposta." }); return; }
  const salvo = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({ alternativeDates: null, alternativeProposedBy: null, alternativeAccepted: null, alternativeRespondedAt: null, alternativeReason: null, updatedAt: new Date() })
      .where(and(eq(leaveRequestsTable.id, pedido.id), eq(leaveRequestsTable.status, "PENDING"))).returning();
    if (!saved) return null;
    await registrar(tx, { category: "ABSENCE", action: "leave.alternative_withdrawn", title: "Proposta de dias retirada", narrative: "A Supervisão retirou a proposta antes de a pessoa responder.", entityType: "leave_request", entityId: pedido.id, actorId: ator.sub, orgId: ator.organizationId, beforeState: pedido, afterState: saved });
    await avisar(tx, pedido.userId, "alternativa_retirada", "leave.alternative_withdrawn", "Proposta retirada", "A proposta de dias para o seu pedido de folga foi retirada. Não precisa mais responder; seu pedido segue com a Supervisão.", pedido.id);
    return saved;
  });
  if (!salvo) { res.status(409).json({ message: "Esta proposta não está mais esperando resposta." }); return; }
  res.json({ request: salvo });
});

export default router;
