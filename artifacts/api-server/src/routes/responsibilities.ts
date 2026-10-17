import { Router, type IRouter, type RequestHandler } from "express";
import { eq, and, inArray, or, isNull, not, desc, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  responsibilitiesTable,
  responsibilityAssignmentsTable,
  usersTable,
  userRolesTable,
  operationsTable,
  areasTable,
  responsibilityRequestRecipientsTable,
  responsibilityRequestsTable,
  responsibilityRoutinesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { sendNotification, notifyMany } from "../services/notificationService.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { aceitarPedido, cancelarPedido, criarPedido, recusarPedido } from "../services/responsibility-requests.js";
import { TarefaError, type Ator } from "../services/task-steps.js";
import { atualizarItem, criarItem, desmarcarItem, marcarItem, removerItem, restaurarItem } from "../services/responsibility-routines.js";
import { processNotificationOutbox } from "../services/notification-outbox.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const MANAGER_ROLES = ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"];
const SUPERVISOR_ROLES = ["SUPERVISOR_A", "SUPERVISOR_B"];
const DEFINITION_ROLES = ["ADMIN", "DIR"];

async function mayAccessResponsibility(user: { sub: string; role: string; organizationId: string }, responsibility: { areaId: string | null; assignments?: { memberId: string; active?: boolean }[] }) {
  if (DEFINITION_ROLES.includes(user.role)) return true;
  if (SUPERVISOR_ROLES.includes(user.role)) {
    if (!responsibility.areaId) return false;
    const scopes = await listAreaLocalScopes(user.sub, user.organizationId);
    return scopes.some((scope) => scope.areaId === responsibility.areaId);
  }
  return responsibility.assignments?.some((assignment) => assignment.memberId === user.sub && assignment.active !== false) ?? false;
}

// ─── Helper: build full responsibility detail ──────────────────────────────────

async function buildResponsibilityDetail(id: string) {
  const [resp] = await db
    .select({
      id: responsibilitiesTable.id,
      orgId: responsibilitiesTable.orgId,
      operationId: responsibilitiesTable.operationId,
      areaId: responsibilitiesTable.areaId,
      areaName: areasTable.name,
      ownerId: responsibilitiesTable.ownerId,
      title: responsibilitiesTable.title,
      description: responsibilitiesTable.description,
      category: responsibilitiesTable.category,
      active: responsibilitiesTable.active,
      createdAt: responsibilitiesTable.createdAt,
      updatedAt: responsibilitiesTable.updatedAt,
      operationName: operationsTable.name,
      ownerName: usersTable.name,
    })
    .from(responsibilitiesTable)
    .leftJoin(operationsTable, eq(responsibilitiesTable.operationId, operationsTable.id))
    .leftJoin(usersTable, eq(responsibilitiesTable.ownerId, usersTable.id))
    .leftJoin(areasTable, eq(responsibilitiesTable.areaId, areasTable.id))
    .where(eq(responsibilitiesTable.id, id));

  if (!resp) return null;

  const assignments = await db
    .select({
      id: responsibilityAssignmentsTable.id,
      responsibilityId: responsibilityAssignmentsTable.responsibilityId,
      memberId: responsibilityAssignmentsTable.memberId,
      role: responsibilityAssignmentsTable.role,
      substituteMemberId: responsibilityAssignmentsTable.substituteMemberId,
      startsAt: responsibilityAssignmentsTable.startsAt,
      endsAt: responsibilityAssignmentsTable.endsAt,
      active: responsibilityAssignmentsTable.active,
      createdAt: responsibilityAssignmentsTable.createdAt,
      memberName: usersTable.name,
    })
    .from(responsibilityAssignmentsTable)
    .innerJoin(usersTable, eq(responsibilityAssignmentsTable.memberId, usersTable.id))
    .where(eq(responsibilityAssignmentsTable.responsibilityId, id))
    .orderBy(asc(responsibilityAssignmentsTable.role));

  // Resolve substitute names
  const subIds = assignments.map((a) => a.substituteMemberId).filter(Boolean) as string[];
  const subNames: Record<string, string> = {};
  if (subIds.length > 0) {
    const subs = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, subIds));
    for (const s of subs) subNames[s.id] = s.name;
  }

  return {
    ...resp,
    assignments: assignments.map((a) => ({
      ...a,
      substituteName: a.substituteMemberId ? (subNames[a.substituteMemberId] ?? null) : null,
    })),
  };
}

// ─── GET /responsibilities ────────────────────────────────────────────────────

router.get("/responsibilities", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const { category, operationId, areaId, unassigned, memberId } = req.query as Record<string, string>;

    const isManager = MANAGER_ROLES.includes(user.role);

    const conditions = [
      eq(responsibilitiesTable.orgId, user.organizationId),
      eq(responsibilitiesTable.active, true),
    ];
    if (category) conditions.push(eq(responsibilitiesTable.category, category));
    if (operationId) conditions.push(eq(responsibilitiesTable.operationId, operationId));
    if (areaId) conditions.push(eq(responsibilitiesTable.areaId, areaId));
    if (SUPERVISOR_ROLES.includes(user.role)) {
      const scopes = await listAreaLocalScopes(user.sub, user.organizationId);
      const scopedAreaIds = [...new Set(scopes.map((scope) => scope.areaId))];
      if (!scopedAreaIds.length) { res.json({ responsibilities: [] }); return; }
      conditions.push(inArray(responsibilitiesTable.areaId, scopedAreaIds));
    }

    const responsibilities = await db
      .select({
        id: responsibilitiesTable.id,
        orgId: responsibilitiesTable.orgId,
        operationId: responsibilitiesTable.operationId,
        areaId: responsibilitiesTable.areaId,
        areaName: areasTable.name,
        ownerId: responsibilitiesTable.ownerId,
        title: responsibilitiesTable.title,
        description: responsibilitiesTable.description,
        category: responsibilitiesTable.category,
        active: responsibilitiesTable.active,
        createdAt: responsibilitiesTable.createdAt,
        updatedAt: responsibilitiesTable.updatedAt,
        operationName: operationsTable.name,
        ownerName: usersTable.name,
      })
      .from(responsibilitiesTable)
      .leftJoin(operationsTable, eq(responsibilitiesTable.operationId, operationsTable.id))
      .leftJoin(usersTable, eq(responsibilitiesTable.ownerId, usersTable.id))
      .leftJoin(areasTable, eq(responsibilitiesTable.areaId, areasTable.id))
      .where(and(...conditions))
      .orderBy(asc(responsibilitiesTable.category), asc(responsibilitiesTable.title));

    if (responsibilities.length === 0) { res.json({ responsibilities: [] }); return; }

    const respIds = responsibilities.map((r) => r.id);

    // Fetch active assignments for all
    const allAssignments = await db
      .select({
        id: responsibilityAssignmentsTable.id,
        responsibilityId: responsibilityAssignmentsTable.responsibilityId,
        memberId: responsibilityAssignmentsTable.memberId,
        role: responsibilityAssignmentsTable.role,
        substituteMemberId: responsibilityAssignmentsTable.substituteMemberId,
        startsAt: responsibilityAssignmentsTable.startsAt,
        endsAt: responsibilityAssignmentsTable.endsAt,
        active: responsibilityAssignmentsTable.active,
        memberName: usersTable.name,
      })
      .from(responsibilityAssignmentsTable)
      .innerJoin(usersTable, eq(responsibilityAssignmentsTable.memberId, usersTable.id))
      .where(
        and(
          inArray(responsibilityAssignmentsTable.responsibilityId, respIds),
          eq(responsibilityAssignmentsTable.active, true),
        )
      )
      .orderBy(asc(responsibilityAssignmentsTable.role));

    // Group assignments by responsibilityId
    const assignMap = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      const existing = assignMap.get(a.responsibilityId) ?? [];
      existing.push(a);
      assignMap.set(a.responsibilityId, existing);
    }

    let enriched = responsibilities.map((r) => ({
      ...r,
      assignments: assignMap.get(r.id) ?? [],
    }));

    // Filter: unassigned (no active assignments)
    if (unassigned === "true") {
      enriched = enriched.filter((r) => r.assignments.length === 0);
    }

    // Filter: by memberId
    if (memberId) {
      enriched = enriched.filter((r) =>
        r.assignments.some((a) => a.memberId === memberId)
      );
    }

    // MEMBER: only see responsibilities they are assigned to
    if (user.role === "MEMBER" || user.role === "TRAINER") {
      enriched = enriched.filter((r) =>
        r.assignments.some((a) => a.memberId === user.sub)
      );
    }

    res.json({ responsibilities: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar responsabilidades" });
  }
});

// ─── Pedidos às responsabilidades ─────────────────────────────────────────────

function ator(user: NonNullable<Express.Request["user"]>): Ator {
  return { id: user.sub, organizationId: user.organizationId, role: user.role, gestor: DEFINITION_ROLES.includes(user.role) };
}
/** A frase da regra quando houve recusa por regra; erro do servidor em qualquer outro caso. */
function erroDePedido(res: import("express").Response, err: unknown, quando: string) {
  if (err instanceof TarefaError) {
    res.status(err.status).json({ error: err.status === 403 ? "Forbidden" : err.status === 404 ? "Not Found" : err.status === 409 ? "Conflict" : "Bad Request", message: err.message });
    return;
  }
  logger.error({ err }, quando);
  res.status(500).json({ error: "Internal Server Error" });
}

// A lista para escolher a quem pedir: todas as pessoas veem os nomes (não os donos), para qualquer uma poder pedir.
router.get("/responsibilities/pickable", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const rows = await db.select({ id: responsibilitiesTable.id, title: responsibilitiesTable.title, description: responsibilitiesTable.description, areaName: areasTable.name })
      .from(responsibilitiesTable).leftJoin(areasTable, eq(areasTable.id, responsibilitiesTable.areaId))
      .where(and(eq(responsibilitiesTable.orgId, user.organizationId), eq(responsibilitiesTable.active, true))).orderBy(asc(responsibilitiesTable.title));
    const comDono = new Set((rows.length ? await db.select({ id: responsibilityAssignmentsTable.responsibilityId }).from(responsibilityAssignmentsTable)
      .where(and(inArray(responsibilityAssignmentsTable.responsibilityId, rows.map((row) => row.id)), eq(responsibilityAssignmentsTable.active, true), inArray(responsibilityAssignmentsTable.role, ["PRIMARY", "SECONDARY"]))) : []).map((row) => row.id));
    res.json({ responsibilities: rows.map((row) => ({ ...row, semDono: !comDono.has(row.id) })) });
  } catch (err) { erroDePedido(res, err, "Erro ao listar responsabilidades para pedir"); }
});

router.post("/responsibilities/:id/requests", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const request = await db.transaction((tx) => criarPedido(tx, ator(user), { responsibilityId: String(req.params.id), title: req.body?.title, details: req.body?.details, dueDate: req.body?.dueDate }));
    void processNotificationOutbox().catch((err) => logger.warn({ err }, "Falha ao entregar os avisos do pedido"));
    res.status(201).json({ request });
  } catch (err) { erroDePedido(res, err, "Erro ao criar pedido"); }
});

/** Pedidos de uma responsabilidade, com quem recebeu e o que cada um respondeu. */
async function pedidosComGente(where: SQL<unknown>) {
  const pedidos = await db.select({
    id: responsibilityRequestsTable.id, responsibilityId: responsibilityRequestsTable.responsibilityId, responsibilityTitle: responsibilitiesTable.title,
    requesterId: responsibilityRequestsTable.requesterId, title: responsibilityRequestsTable.title, details: responsibilityRequestsTable.details,
    dueDate: responsibilityRequestsTable.dueDate, status: responsibilityRequestsTable.status, acceptedById: responsibilityRequestsTable.acceptedById,
    acceptedAt: responsibilityRequestsTable.acceptedAt, taskId: responsibilityRequestsTable.taskId, semDono: responsibilityRequestsTable.semDono, createdAt: responsibilityRequestsTable.createdAt,
  }).from(responsibilityRequestsTable).innerJoin(responsibilitiesTable, eq(responsibilitiesTable.id, responsibilityRequestsTable.responsibilityId)).where(where).orderBy(desc(responsibilityRequestsTable.createdAt)).limit(200);
  if (!pedidos.length) return [];
  const destinatarios = await db.select().from(responsibilityRequestRecipientsTable).where(inArray(responsibilityRequestRecipientsTable.requestId, pedidos.map((pedido) => pedido.id)));
  const ids = [...new Set([...pedidos.flatMap((pedido) => [pedido.requesterId, pedido.acceptedById]), ...destinatarios.map((linha) => linha.userId)].filter((id): id is string => Boolean(id)))];
  const nomes = new Map((await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, ids))).map((pessoa) => [pessoa.id, pessoa.name]));
  return pedidos.map((pedido) => ({
    ...pedido, requesterName: nomes.get(pedido.requesterId) ?? null, acceptedByName: pedido.acceptedById ? nomes.get(pedido.acceptedById) ?? null : null,
    recipients: destinatarios.filter((linha) => linha.requestId === pedido.id).map((linha) => ({ userId: linha.userId, name: nomes.get(linha.userId) ?? null, declinedAt: linha.declinedAt, declineReason: linha.declineReason })),
  }));
}

router.get("/responsibilities/:id/requests", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const [responsabilidade] = await db.select({ id: responsibilitiesTable.id, areaId: responsibilitiesTable.areaId }).from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, id), eq(responsibilitiesTable.orgId, user.organizationId))).limit(1);
    if (!responsabilidade) { res.status(404).json({ error: "Not Found", message: "Responsabilidade não encontrada." }); return; }
    const assignments = await db.select({ memberId: responsibilityAssignmentsTable.memberId, active: responsibilityAssignmentsTable.active }).from(responsibilityAssignmentsTable).where(eq(responsibilityAssignmentsTable.responsibilityId, id));
    const [recebeu] = await db.select({ userId: responsibilityRequestRecipientsTable.userId }).from(responsibilityRequestRecipientsTable)
      .innerJoin(responsibilityRequestsTable, eq(responsibilityRequestsTable.id, responsibilityRequestRecipientsTable.requestId))
      .where(and(eq(responsibilityRequestsTable.responsibilityId, id), eq(responsibilityRequestRecipientsTable.userId, user.sub))).limit(1);
    const cuida = await mayAccessResponsibility(user, { areaId: responsabilidade.areaId, assignments });
    if (!recebeu && !cuida) {
      res.status(403).json({ error: "Forbidden", message: "Só quem cuida desta responsabilidade, a Administração e a Direção veem os pedidos dela." });
      return;
    }
    // Quem só recebeu algum pedido (substituta, ou quem já saiu da responsabilidade) vê os que chegaram para ela, não todos.
    const soOsMeus = !cuida ? [inArray(responsibilityRequestsTable.id, db.select({ id: responsibilityRequestRecipientsTable.requestId }).from(responsibilityRequestRecipientsTable).where(eq(responsibilityRequestRecipientsTable.userId, user.sub)))] : [];
    res.json({ requests: await pedidosComGente(and(eq(responsibilityRequestsTable.responsibilityId, id), eq(responsibilityRequestsTable.orgId, user.organizationId), ...soOsMeus)!) });
  } catch (err) { erroDePedido(res, err, "Erro ao listar pedidos"); }
});

// Os pedidos que a própria pessoa fez, para acompanhar (não depende de ver a caixa da responsabilidade).
router.get("/responsibility-requests/mine", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    res.json({ requests: await pedidosComGente(and(eq(responsibilityRequestsTable.requesterId, user.sub), eq(responsibilityRequestsTable.orgId, user.organizationId))!) });
  } catch (err) { erroDePedido(res, err, "Erro ao listar meus pedidos"); }
});

// Os pedidos que chegaram para a pessoa e ainda esperam resposta (o que ela precisa aceitar ou recusar).
router.get("/responsibility-requests/inbox", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const doMeu = db.select({ id: responsibilityRequestRecipientsTable.requestId }).from(responsibilityRequestRecipientsTable).where(and(eq(responsibilityRequestRecipientsTable.userId, user.sub), isNull(responsibilityRequestRecipientsTable.declinedAt)));
    res.json({ requests: await pedidosComGente(and(eq(responsibilityRequestsTable.orgId, user.organizationId), eq(responsibilityRequestsTable.status, "OPEN"), inArray(responsibilityRequestsTable.id, doMeu))!) });
  } catch (err) { erroDePedido(res, err, "Erro ao listar a caixa de pedidos"); }
});

router.post("/responsibility-requests/:id/accept", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const resultado = await db.transaction((tx) => aceitarPedido(tx, ator(user), String(req.params.id), { dueDate: req.body?.dueDate }));
    void processNotificationOutbox().catch((err) => logger.warn({ err }, "Falha ao entregar os avisos do pedido"));
    res.json({ request: resultado.request, task: resultado.task });
  } catch (err) { erroDePedido(res, err, "Erro ao aceitar pedido"); }
});

router.post("/responsibility-requests/:id/decline", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const request = await db.transaction((tx) => recusarPedido(tx, ator(user), String(req.params.id), req.body?.reason));
    void processNotificationOutbox().catch((err) => logger.warn({ err }, "Falha ao entregar os avisos do pedido"));
    res.json({ request });
  } catch (err) { erroDePedido(res, err, "Erro ao recusar pedido"); }
});

router.post("/responsibility-requests/:id/cancel", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const request = await db.transaction((tx) => cancelarPedido(tx, ator(user), String(req.params.id), req.body?.reason));
    void processNotificationOutbox().catch((err) => logger.warn({ err }, "Falha ao entregar os avisos do pedido"));
    res.json({ request });
  } catch (err) { erroDePedido(res, err, "Erro ao cancelar pedido"); }
});

// ─── Lista fixa da responsabilidade ────────────────────────────────────────────

/** Quem vê a lista (cuida, acompanha, Supervisão da área, Administração, Direção) e quem mexe nela (todos, menos quem só acompanha). */
async function acessoALista(user: NonNullable<Express.Request["user"]>, responsibilityId: string) {
  const [responsabilidade] = await db.select({ id: responsibilitiesTable.id, areaId: responsibilitiesTable.areaId }).from(responsibilitiesTable)
    .where(and(eq(responsibilitiesTable.id, responsibilityId), eq(responsibilitiesTable.orgId, user.organizationId), eq(responsibilitiesTable.active, true))).limit(1);
  if (!responsabilidade) throw new TarefaError(404, "Responsabilidade não encontrada.");
  const assignments = await db.select({ memberId: responsibilityAssignmentsTable.memberId, role: responsibilityAssignmentsTable.role, active: responsibilityAssignmentsTable.active })
    .from(responsibilityAssignmentsTable).where(eq(responsibilityAssignmentsTable.responsibilityId, responsibilityId));
  const podeVer = await mayAccessResponsibility(user, { areaId: responsabilidade.areaId, assignments });
  if (!podeVer) throw new TarefaError(403, "Só quem cuida desta responsabilidade, a Administração e a Direção veem a lista fixa dela.");
  const soAcompanha = !DEFINITION_ROLES.includes(user.role) && !SUPERVISOR_ROLES.includes(user.role)
    && !assignments.some((linha) => linha.memberId === user.sub && linha.active && linha.role !== "VIEWER");
  return { soAcompanha };
}
async function paraMexer(user: NonNullable<Express.Request["user"]>, responsibilityId: string) {
  const { soAcompanha } = await acessoALista(user, responsibilityId);
  if (soAcompanha) throw new TarefaError(403, "Quem só acompanha esta responsabilidade vê a lista, mas não marca nem edita os itens.");
}

router.get("/responsibilities/:id/routines", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    await acessoALista(user, id);
    const incluirRemovidos = req.query.removidos === "1";
    const itens = await db.select({ item: responsibilityRoutinesTable, ownerName: usersTable.name }).from(responsibilityRoutinesTable)
      .innerJoin(usersTable, eq(usersTable.id, responsibilityRoutinesTable.ownerId))
      .where(and(eq(responsibilityRoutinesTable.responsibilityId, id), ...(incluirRemovidos ? [] : [eq(responsibilityRoutinesTable.active, true)]))).orderBy(asc(responsibilityRoutinesTable.createdAt));
    res.json({ routines: itens.map((linha) => ({ ...linha.item, ownerName: linha.ownerName })) });
  } catch (err) { erroDePedido(res, err, "Erro ao listar a lista fixa"); }
});

router.post("/responsibilities/:id/routines", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    await paraMexer(user, String(req.params.id));
    const routine = await db.transaction((tx) => criarItem(tx, ator(user), String(req.params.id), req.body ?? {}));
    res.status(201).json({ routine });
  } catch (err) { erroDePedido(res, err, "Erro ao criar item da lista fixa"); }
});

router.patch("/responsibilities/:id/routines/:routineId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    await paraMexer(user, String(req.params.id));
    const routine = await db.transaction((tx) => atualizarItem(tx, ator(user), String(req.params.id), String(req.params.routineId), req.body ?? {}));
    res.json({ routine });
  } catch (err) { erroDePedido(res, err, "Erro ao atualizar item da lista fixa"); }
});

// Um registro por caminho, com o texto da rota escrito por extenso (a matriz de permissões lê as rotas do código-fonte).
const mexerNoItem = (acao: typeof marcarItem): RequestHandler => async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    await paraMexer(user, String(req.params.id));
    const routine = await db.transaction((tx) => acao(tx, ator(user), String(req.params.id), String(req.params.routineId)));
    res.json({ routine });
  } catch (err) { erroDePedido(res, err, "Erro ao mexer no item da lista fixa"); }
};
router.post("/responsibilities/:id/routines/:routineId/check", requireAuth, requireOrganization, mexerNoItem(marcarItem));
router.post("/responsibilities/:id/routines/:routineId/uncheck", requireAuth, requireOrganization, mexerNoItem(desmarcarItem));
router.post("/responsibilities/:id/routines/:routineId/restore", requireAuth, requireOrganization, mexerNoItem(restaurarItem));

router.delete("/responsibilities/:id/routines/:routineId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    await paraMexer(user, String(req.params.id));
    const routine = await db.transaction((tx) => removerItem(tx, ator(user), String(req.params.id), String(req.params.routineId), req.body?.reason));
    res.json({ routine });
  } catch (err) { erroDePedido(res, err, "Erro ao tirar item da lista fixa"); }
});

// ─── GET /responsibilities/:id ────────────────────────────────────────────────

router.get("/responsibilities/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const id = String(req.params.id);

    const detail = await buildResponsibilityDetail(id);
    if (!detail || detail.orgId !== user.organizationId) {
      res.status(404).json({ error: "Responsabilidade não encontrada" });
      return;
    }

    if (!(await mayAccessResponsibility(user, detail))) { res.status(403).json({ error: "Acesso não autorizado" }); return; }

    res.json({ responsibility: detail });
  } catch {
    res.status(500).json({ error: "Erro ao buscar responsabilidade" });
  }
});

// ─── POST /responsibilities ───────────────────────────────────────────────────

router.post("/responsibilities", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (!DEFINITION_ROLES.includes(user.role)) { res.status(403).json({ error: "Sem permissão para definir responsabilidades" }); return; }

    const { title, description, category, operationId, areaId } = req.body as {
      title: string;
      description?: string;
      category?: string;
      operationId?: string;
      areaId?: string;
    };

    if (!title?.trim()) { res.status(400).json({ error: "title é obrigatório" }); return; }

    if (operationId) {
      const [operation] = await db.select({ id: operationsTable.id }).from(operationsTable)
        .where(and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, user.organizationId)));
      if (!operation) { res.status(404).json({ error: "Operação não encontrada" }); return; }
    }
    if (!areaId) { res.status(400).json({ error: "areaId é obrigatório" }); return; }
    const [area] = await db.select({ id: areasTable.id }).from(areasTable)
      .where(and(eq(areasTable.id, areaId), eq(areasTable.organizationId, user.organizationId), eq(areasTable.active, true)));
    if (!area) { res.status(404).json({ error: "Área não encontrada" }); return; }

    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(responsibilitiesTable).values({
        orgId: user.organizationId,
        operationId: operationId ?? null,
        areaId,
        ownerId: user.sub,
        title: title.trim(),
        description: description?.trim() ?? null,
        category: category?.trim() || "OPERAÇÃO",
        active: true,
      }).returning();
      if (!row) throw new Error("Não foi possível criar responsabilidade");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "responsibility.created", title: "Responsabilidade criada",
        narrative: `Responsabilidade ${row.title} criada.`, entityType: "responsibility", entityId: row.id,
        actorId: user.sub, orgId: user.organizationId, operationId: row.operationId ?? undefined,
        beforeState: null, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    res.status(201).json({ responsibility: created });
  } catch {
    res.status(500).json({ error: "Erro ao criar responsabilidade" });
  }
});

// ─── PATCH /responsibilities/:id ──────────────────────────────────────────────

router.patch("/responsibilities/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (!DEFINITION_ROLES.includes(user.role)) { res.status(403).json({ error: "Sem permissão para editar responsabilidades" }); return; }

    const id = String(req.params.id);
    const { title, description, category, operationId, areaId, ownerId, active } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      operationId?: string | null;
      areaId?: string;
      ownerId?: string;
      active?: boolean;
    };

    const [existing] = await db
      .select()
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, id), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!existing) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    if (areaId) {
      const [area] = await db.select({ id: areasTable.id }).from(areasTable)
        .where(and(eq(areasTable.id, areaId), eq(areasTable.organizationId, user.organizationId), eq(areasTable.active, true)));
      if (!area) { res.status(404).json({ error: "Área não encontrada" }); return; }
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(responsibilitiesTable).set({
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(category !== undefined && { category: category.trim() }),
        ...(operationId !== undefined && { operationId: operationId ?? null }),
        ...(areaId !== undefined && { areaId }),
        ...(ownerId !== undefined && { ownerId }),
        ...(active !== undefined && { active }),
        updatedAt: new Date(),
      }).where(eq(responsibilitiesTable.id, id)).returning();
      if (!row) throw new Error("Responsabilidade não encontrada");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "responsibility.updated", title: "Responsabilidade atualizada",
        narrative: `Responsabilidade ${row.title} atualizada.`, entityType: "responsibility", entityId: row.id,
        actorId: user.sub, orgId: user.organizationId, operationId: row.operationId ?? undefined,
        beforeState: existing, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    res.json({ responsibility: updated });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar responsabilidade" });
  }
});

// ─── DELETE /responsibilities/:id ─────────────────────────────────────────────

router.delete("/responsibilities/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (!DEFINITION_ROLES.includes(user.role)) { res.status(403).json({ error: "Sem permissão para desativar responsabilidades" }); return; }

    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, id), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!existing) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    await db.transaction(async (tx) => {
      const [updated] = await tx.update(responsibilitiesTable)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(responsibilitiesTable.id, id), eq(responsibilitiesTable.active, true)))
        .returning();
      if (!updated) throw new Error("Responsabilidade já está inativa");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "responsibility.deactivated", title: "Responsabilidade desativada",
        narrative: `Responsabilidade ${existing.title} desativada.`, entityType: "responsibility", entityId: id,
        actorId: user.sub, orgId: user.organizationId, operationId: existing.operationId ?? undefined,
        beforeState: existing, afterState: updated, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover responsabilidade" });
  }
});

// ─── POST /responsibilities/:id/assignments ───────────────────────────────────

router.post("/responsibilities/:id/assignments", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (!DEFINITION_ROLES.includes(user.role)) { res.status(403).json({ error: "Sem permissão para atribuir responsabilidades" }); return; }

    const respId = String(req.params.id);
    const { memberId, role, substituteMemberId, startsAt, endsAt } = req.body as {
      memberId: string;
      role?: "PRIMARY" | "SECONDARY" | "VIEWER";
      substituteMemberId?: string;
      startsAt?: string;
      endsAt?: string;
    };

    if (!memberId) { res.status(400).json({ error: "memberId é obrigatório" }); return; }

    const [resp] = await db
      .select()
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, respId), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!resp) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    const requestedRole = role ?? "PRIMARY";
    if (requestedRole === "PRIMARY") {
      const [currentPrimary] = await db
        .select({ id: responsibilityAssignmentsTable.id })
        .from(responsibilityAssignmentsTable)
        .where(and(
          eq(responsibilityAssignmentsTable.responsibilityId, respId),
          eq(responsibilityAssignmentsTable.role, "PRIMARY"),
          eq(responsibilityAssignmentsTable.active, true),
        ))
        .limit(1);
      if (currentPrimary) {
        res.status(409).json({ error: "Esta responsabilidade ja possui uma pessoa principal. Adicione como auxiliar ou somente leitura." });
        return;
      }
    }

    // Get member name for notification
    const [member] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
      .where(and(eq(usersTable.id, memberId), eq(usersTable.organizationId, user.organizationId)));
    if (!member) { res.status(404).json({ error: "Membro não encontrado" }); return; }

    const [assignment] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(responsibilityAssignmentsTable).values({
        responsibilityId: respId,
        memberId,
        role: requestedRole,
        substituteMemberId: substituteMemberId ?? null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        active: true,
      }).returning();
      if (!row) throw new Error("Não foi possível atribuir responsabilidade");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "responsibility.assignment_created", title: "Responsabilidade atribuída",
        narrative: `Responsabilidade ${resp.title} atribuída a ${member.name}.`, entityType: "responsibility_assignment", entityId: row.id,
        actorId: user.sub, orgId: user.organizationId, operationId: resp.operationId ?? undefined,
        beforeState: null, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    // Notify assigned member
    sendNotification({
      userId: memberId,
      type: "responsibility.assigned",
      title: "Nova responsabilidade atribuída",
      message: `Você é agora responsável por: ${resp.title}`,
      priority: "IMPORTANT",
      category: "responsibility",
      entityType: "responsibility",
      entityId: respId,
    }).catch(() => {});

    res.status(201).json({ assignment: { ...assignment, memberName: member?.name ?? null } });
  } catch {
    res.status(500).json({ error: "Erro ao atribuir responsabilidade" });
  }
});

// ─── PATCH /responsibilities/:id/assignments/:assignmentId ────────────────────

router.patch("/responsibilities/:id/assignments/:assignmentId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (!DEFINITION_ROLES.includes(user.role)) { res.status(403).json({ error: "Sem permissão para editar atribuições" }); return; }

    const assignmentId = req.params["assignmentId"] as string;
    const { substituteMemberId, active, endsAt } = req.body as {
      substituteMemberId?: string | null;
      active?: boolean;
      endsAt?: string | null;
    };

    const [existing] = await db
      .select()
      .from(responsibilityAssignmentsTable)
      .where(eq(responsibilityAssignmentsTable.id, assignmentId));
    if (!existing) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }
    const [responsibility] = await db.select({ orgId: responsibilitiesTable.orgId, operationId: responsibilitiesTable.operationId })
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, existing.responsibilityId), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!responsibility) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }

    const setVals: Record<string, unknown> = { updatedAt: new Date() };
    if (substituteMemberId !== undefined) setVals.substituteMemberId = substituteMemberId ?? null;
    if (active !== undefined) setVals.active = active;
    if (endsAt !== undefined) setVals.endsAt = endsAt ? new Date(endsAt) : null;
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(responsibilityAssignmentsTable)
        .set(setVals as never)
        .where(and(eq(responsibilityAssignmentsTable.id, assignmentId), eq(responsibilityAssignmentsTable.active, true)))
        .returning();
      if (!row) throw new Error("Atribuição não encontrada");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "responsibility.assignment_updated", title: "Atribuição atualizada",
        narrative: "Atribuição de responsabilidade atualizada.", entityType: "responsibility_assignment", entityId: assignmentId,
        actorId: user.sub, orgId: user.organizationId, operationId: responsibility.operationId ?? undefined,
        beforeState: existing, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    // If inactivated, notify member and check if now uncovered
    if (active === false) {
      sendNotification({
        userId: existing.memberId,
        type: "responsibility.unassigned",
        title: "Responsabilidade removida",
        message: "Uma responsabilidade foi removida da sua lista.",
        priority: "IMPORTANT",
        category: "responsibility",
        entityType: "responsibility",
        entityId: existing.responsibilityId,
      }).catch(() => {});

      // Check if uncovered — notify managers
      const remaining = await db
        .select({ id: responsibilityAssignmentsTable.id })
        .from(responsibilityAssignmentsTable)
        .where(
          and(
            eq(responsibilityAssignmentsTable.responsibilityId, existing.responsibilityId),
            eq(responsibilityAssignmentsTable.active, true),
            not(eq(responsibilityAssignmentsTable.id, assignmentId)),
          )
        );

      if (remaining.length === 0) {
        const [resp] = await db
          .select({ title: responsibilitiesTable.title, orgId: responsibilitiesTable.orgId })
          .from(responsibilitiesTable)
          .where(eq(responsibilitiesTable.id, existing.responsibilityId));

        if (resp) {
          // Managers scoped to this org via operationsTable
          const managers = await db
            .select({ userId: userRolesTable.userId })
            .from(userRolesTable)
            .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
            .where(
              and(
                eq(operationsTable.organizationId, resp.orgId),
                inArray(userRolesTable.role, ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] as any),
                eq(userRolesTable.active, true),
              )
            );
          const managerIds = [...new Set(managers.map((m) => m.userId))];
          notifyMany(managerIds, {
            type: "responsibility.uncovered",
            title: "Responsabilidade sem responsável",
            message: `A responsabilidade "${resp.title}" ficou sem responsável.`,
            priority: "IMPORTANT",
            category: "responsibility",
            entityType: "responsibility",
            entityId: existing.responsibilityId,
          }).catch(() => {});
        }
      }
    }

    // If substitute set, notify them
    if (substituteMemberId && substituteMemberId !== existing.substituteMemberId) {
      const [resp] = await db
        .select({ title: responsibilitiesTable.title })
        .from(responsibilitiesTable)
        .where(eq(responsibilitiesTable.id, existing.responsibilityId));
      sendNotification({
        userId: substituteMemberId,
        type: "responsibility.substitute_activated",
        title: "Substituição ativada",
        message: `Você foi definido como substituto em: ${resp?.title ?? "responsabilidade"}`,
        priority: "IMPORTANT",
        category: "responsibility",
        entityType: "responsibility",
        entityId: existing.responsibilityId,
      }).catch(() => {});
    }

    res.json({ assignment: updated });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar atribuição" });
  }
});

// ─── DELETE /responsibilities/:id/assignments/:assignmentId ──────────────────

router.delete("/responsibilities/:id/assignments/:assignmentId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (!DEFINITION_ROLES.includes(user.role)) { res.status(403).json({ error: "Sem permissão para remover atribuições" }); return; }

    const assignmentId = req.params["assignmentId"] as string;
    const respId = req.params["id"] as string;

    const [existing] = await db.select().from(responsibilityAssignmentsTable)
      .where(and(eq(responsibilityAssignmentsTable.id, assignmentId), eq(responsibilityAssignmentsTable.responsibilityId, respId), eq(responsibilityAssignmentsTable.active, true)));
    if (!existing) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }
    const [resp] = await db.select().from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, respId), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!resp) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(responsibilityAssignmentsTable)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(responsibilityAssignmentsTable.id, assignmentId), eq(responsibilityAssignmentsTable.active, true)))
        .returning();
      if (!updated) throw new Error("Atribuição já está inativa");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "responsibility.assignment_deactivated", title: "Atribuição desativada",
        narrative: `Atribuição da responsabilidade ${resp.title} desativada.`, entityType: "responsibility_assignment", entityId: assignmentId,
        actorId: user.sub, orgId: user.organizationId, operationId: resp.operationId ?? undefined,
        beforeState: existing, afterState: updated, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover atribuição" });
  }
});

export default router;
