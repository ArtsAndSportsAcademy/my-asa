/**
 * POST /leave-requests/:id/desfazer — a gerência desfaz uma folga que entrou como PRIORIDADE (pedido feito
 * antes de o mapa do mês ser publicado), com o motivo escrito. A pessoa é avisada com o motivo, a folga
 * volta a ser dia de trabalho e o pedido fica recusado, com o porquê. Só vale para folga que entrou como
 * prioridade; folga publicada ou decidida pela Supervisão se mexe no mapa.
 */
import { Router, type IRouter } from "express";
import { and, asc, eq, gte, like } from "drizzle-orm";
import { areasTable, db, folgasTable, leaveRequestsTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { avisarRepublicacaoFolgas } from "../services/folgas-publicadas.js";
import { MARCA_DE_PRIORIDADE, avisarFolga, idDaRota, isAdmin, isDirector, isSupervisor, pedidoDaOrganizacao, registrar } from "../services/folga-comum.js";
import { canSupervisorAccessPerson } from "../services/area-local-scope.js";
import { operacaoDaPessoa, periodoLegivel } from "../services/folga-roteamento.js";
import { operationalDate } from "../lib/operational-date.js";

const router: IRouter = Router();

/**
 * GET /leave-requests/prioridades — as folgas que entraram como prioridade e ainda não começaram, de qualquer
 * mês, para a gerência poder desfazer. A tela de Folgas carrega só o mês aberto; sem esta lista, uma prioridade
 * de março só apareceria para quem abrisse março.
 */
router.get("/leave-requests/prioridades", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!;
  if (!isAdmin(ator.role) && !isDirector(ator.role) && !isSupervisor(ator.role)) {
    res.status(403).json({ error: "Forbidden", message: "Só quem gerencia vê as folgas que entraram como prioridade." }); return;
  }
  const linhas = await db.select({ id: leaveRequestsTable.id, userId: leaveRequestsTable.userId, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate, nome: usersTable.name, area: areasTable.name })
    .from(leaveRequestsTable).innerJoin(usersTable, eq(leaveRequestsTable.userId, usersTable.id)).leftJoin(areasTable, eq(leaveRequestsTable.areaId, areasTable.id))
    .where(and(eq(leaveRequestsTable.organizationId, ator.organizationId), eq(leaveRequestsTable.status, "APPROVED"), like(leaveRequestsTable.decisionReason, `${MARCA_DE_PRIORIDADE}%`), gte(leaveRequestsTable.startDate, operationalDate())))
    .orderBy(asc(leaveRequestsTable.startDate)).limit(100);
  const pedidos = [];
  for (const l of linhas) {
    if (isSupervisor(ator.role) && !(await canSupervisorAccessPerson({ supervisorId: ator.sub, organizationId: ator.organizationId, personId: l.userId }))) continue;
    pedidos.push({ id: l.id, userName: l.nome, areaName: l.area, startDate: l.startDate, endDate: l.endDate });
  }
  res.json({ pedidos });
});

router.post("/leave-requests/:id/desfazer", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!, body = req.body as Record<string, unknown>;
  const pedido = await pedidoDaOrganizacao(idDaRota(req.params.id), ator.organizationId);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  // Prioridade é folga que ainda não passou pela Supervisão (o mapa nem foi publicado): a Administração e a Supervisão da
  // área desfazem a qualquer momento, sem esperar o prazo que vale para pedido já publicado. Ninguém desfaz a própria.
  const dono = isAdmin(ator.role) || (isSupervisor(ator.role) && await canSupervisorAccessPerson({ supervisorId: ator.sub, organizationId: ator.organizationId, personId: pedido.userId }));
  if (!dono) { res.status(403).json({ message: "Só a Supervisão da área da pessoa ou a Administração desfazem esta folga." }); return; }
  if (pedido.userId === ator.sub) { res.status(403).json({ message: "Ninguém desfaz a própria folga de prioridade." }); return; }
  if (pedido.status !== "APPROVED" || !pedido.decisionReason?.startsWith(MARCA_DE_PRIORIDADE)) {
    res.status(409).json({ message: "Só dá para desfazer por aqui uma folga que entrou como prioridade. As outras se mexem no mapa do mês." }); return;
  }
  if (pedido.startDate < operationalDate()) { res.status(409).json({ message: "Esta folga já começou; não dá para desfazer." }); return; }
  const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 600) : "";
  if (motivo.length < 2) { res.status(400).json({ message: "Desfazer pede o motivo: a pessoa vai ler." }); return; }

  const salvo = await db.transaction(async (tx) => {
    const [saved] = await tx.update(leaveRequestsTable).set({ status: "DENIED", decidedBy: ator.sub, decisionReason: `Desfeita pela gerência: ${motivo}`, decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(leaveRequestsTable.id, pedido.id), eq(leaveRequestsTable.status, "APPROVED"))).returning();
    if (!saved) return null;
    const folgas = await tx.update(folgasTable).set({ status: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(folgasTable.userId, pedido.userId), eq(folgasTable.notes, `Pedido ${pedido.id}`), eq(folgasTable.status, "ACTIVE"))).returning();
    const operationId = await operacaoDaPessoa(tx, pedido.userId, ator.organizationId);
    const [pessoa] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, pedido.userId)).limit(1);
    const eventId = await registrar(tx, { category: "ABSENCE", action: "leave.priority_undone", title: "Folga de prioridade desfeita", narrative: motivo, entityType: "leave_request", entityId: pedido.id, actorId: ator.sub, orgId: ator.organizationId, operationId: operationId ?? undefined, beforeState: pedido, afterState: saved, metadata: { motivo, folgasCanceladas: folgas.length } });
    if (operationId) await avisarRepublicacaoFolgas(tx, ator.organizationId, operationId, pedido.startDate, pedido.endDate, eventId);
    await avisarFolga(tx, pedido.userId, "prioridade_desfeita", "leave.priority_undone", "Sua folga foi desfeita",
      `${pessoa?.name ? `${pessoa.name}, a` : "A"} folga de ${periodoLegivel(pedido.startDate, pedido.endDate)} foi desfeita pela gerência: ${motivo}`, pedido.id);
    return saved;
  });
  if (!salvo) { res.status(409).json({ message: "Esta folga já foi mexida por outra pessoa." }); return; }
  res.json({ request: salvo });
});

export default router;
