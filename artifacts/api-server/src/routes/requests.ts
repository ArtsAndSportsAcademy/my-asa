import { Router, type IRouter } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  requestsTable,
  requestDecisionsTable,
  usersTable,
  operationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { isActiveDelegate } from "../lib/delegation-check.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helper: nome do ator ─────────────────────────────────────────────────────

async function getActorName(userId: string): Promise<string> {
  const [row] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return row?.name ?? userId;
}

// ─── GET /requests — listar (baseado em papel) ────────────────────────────────

router.get("/requests", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId, status } = req.query as Record<string, string>;

  try {
    const conditions: SQL<unknown>[] = [];

    if (user.role === "ADMIN") {
      conditions.push(eq(operationsTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(requestsTable.operationId, operationId));
    } else if (MANAGER_ROLES.includes(user.role)) {
      if (!operationId) {
        res.status(400).json({ error: "Bad Request", message: "operationId é obrigatório para supervisores" });
        return;
      }
      conditions.push(eq(requestsTable.operationId, operationId));
    } else {
      conditions.push(eq(requestsTable.requesterId, user.sub));
    }

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(requestsTable.status, statuses[0] as any));
      } else if (statuses.length > 1) {
        conditions.push(inArray(requestsTable.status, statuses as any[]));
      }
    }

    const requests = await db
      .select({
        id: requestsTable.id,
        requesterId: requestsTable.requesterId,
        requesterName: usersTable.name,
        operationId: requestsTable.operationId,
        operationName: operationsTable.name,
        type: requestsTable.type,
        status: requestsTable.status,
        targetDates: requestsTable.targetDates,
        reason: requestsTable.reason,
        createdAt: requestsTable.createdAt,
        updatedAt: requestsTable.updatedAt,
      })
      .from(requestsTable)
      .innerJoin(usersTable, eq(requestsTable.requesterId, usersTable.id))
      .innerJoin(operationsTable, eq(requestsTable.operationId, operationsTable.id))
      .where(and(...conditions))
      .orderBy(desc(requestsTable.createdAt));

    log.info({ count: requests.length, role: user.role }, "requests listed");
    res.json({ requests });
  } catch (err) {
    log.error({ err }, "Error listing requests");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /requests/pending — pendentes para gestores ─────────────────────────

router.get("/requests/pending", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId } = req.query as Record<string, string>;

  if (!MANAGER_ROLES.includes(user.role)) {
    if (!operationId || !(await isActiveDelegate(user.sub, operationId))) {
      res.status(403).json({ error: "Forbidden", message: "Acesso restrito a gestores" });
      return;
    }
  }

  try {
    const conditions: SQL<unknown>[] = [
      inArray(requestsTable.status, ["PENDING", "ALTERNATIVE_PROPOSED"]),
    ];

    if (user.role === "ADMIN") {
      conditions.push(eq(operationsTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(requestsTable.operationId, operationId));
    } else {
      if (!operationId) {
        res.status(400).json({ error: "Bad Request", message: "operationId é obrigatório para supervisores" });
        return;
      }
      conditions.push(eq(requestsTable.operationId, operationId));
    }

    const requests = await db
      .select({
        id: requestsTable.id,
        requesterId: requestsTable.requesterId,
        requesterName: usersTable.name,
        operationId: requestsTable.operationId,
        operationName: operationsTable.name,
        type: requestsTable.type,
        status: requestsTable.status,
        targetDates: requestsTable.targetDates,
        reason: requestsTable.reason,
        createdAt: requestsTable.createdAt,
        updatedAt: requestsTable.updatedAt,
      })
      .from(requestsTable)
      .innerJoin(usersTable, eq(requestsTable.requesterId, usersTable.id))
      .innerJoin(operationsTable, eq(requestsTable.operationId, operationsTable.id))
      .where(and(...conditions))
      .orderBy(desc(requestsTable.createdAt));

    log.info({ count: requests.length }, "pending requests listed");
    res.json({ requests });
  } catch (err) {
    log.error({ err }, "Error listing pending requests");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /requests/:id — detalhe com histórico de decisões ───────────────────

router.get("/requests/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [request] = await db
      .select({
        id: requestsTable.id,
        requesterId: requestsTable.requesterId,
        requesterName: usersTable.name,
        operationId: requestsTable.operationId,
        operationName: operationsTable.name,
        type: requestsTable.type,
        status: requestsTable.status,
        targetDates: requestsTable.targetDates,
        reason: requestsTable.reason,
        createdAt: requestsTable.createdAt,
        updatedAt: requestsTable.updatedAt,
      })
      .from(requestsTable)
      .innerJoin(usersTable, eq(requestsTable.requesterId, usersTable.id))
      .innerJoin(operationsTable, eq(requestsTable.operationId, operationsTable.id))
      .where(eq(requestsTable.id, id))
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "Not Found", message: "Solicitação não encontrada" });
      return;
    }

    // Access control
    const isMember = !MANAGER_ROLES.includes(user.role);
    if (isMember && request.requesterId !== user.sub) {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado" });
      return;
    }
    if (!isMember && user.role !== "ADMIN") {
      // Supervisor — future: validate operation membership. For now, trust org scope via token.
    }

    // Decisions with supervisor name
    const supervisorsAlias = usersTable;
    const decisions = await db
      .select({
        id: requestDecisionsTable.id,
        requestId: requestDecisionsTable.requestId,
        supervisorId: requestDecisionsTable.supervisorId,
        supervisorName: usersTable.name,
        decision: requestDecisionsTable.decision,
        reason: requestDecisionsTable.reason,
        alternativeDetails: requestDecisionsTable.alternativeDetails,
        deadline: requestDecisionsTable.deadline,
        createdAt: requestDecisionsTable.createdAt,
      })
      .from(requestDecisionsTable)
      .innerJoin(usersTable, eq(requestDecisionsTable.supervisorId, usersTable.id))
      .where(eq(requestDecisionsTable.requestId, id))
      .orderBy(desc(requestDecisionsTable.createdAt));

    log.info({ requestId: id }, "request detail fetched");
    res.json({ request: { ...request, decisions } });
  } catch (err) {
    log.error({ err }, "Error fetching request");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /requests — membro cria solicitação ────────────────────────────────

router.post("/requests", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { type, operationId, targetDates, reason } = req.body as {
    type: string;
    operationId: string;
    targetDates: string[];
    reason?: string;
  };

  if (!type || !operationId || !targetDates?.length) {
    res.status(400).json({ error: "Bad Request", message: "type, operationId e targetDates são obrigatórios" });
    return;
  }

  try {
    const [newRequest] = await db
      .insert(requestsTable)
      .values({
        requesterId: user.sub,
        operationId,
        type: type as any,
        status: "PENDING",
        targetDates,
        reason: reason ?? null,
      })
      .returning();

    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "REQUEST",
      action: "request.created",
      title: `Solicitação criada: ${type}`,
      narrative: `${actorName} criou uma solicitação do tipo ${type} para ${targetDates.join(", ")}.`,
      entityType: "request",
      entityId: newRequest.id,
      actorId: user.sub,
      actorName,
      operationId,
      orgId: user.organizationId,
    });

    log.info({ requestId: newRequest.id, type, requesterId: user.sub }, "request created");
    res.status(201).json({ request: newRequest });
  } catch (err) {
    log.error({ err }, "Error creating request");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /requests/:id — membro responde a alternativa proposta ─────────────

router.patch("/requests/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };
  const { status } = req.body as { status: string };

  const allowed = ["ALTERNATIVE_ACCEPTED", "ALTERNATIVE_REJECTED"];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ error: "Bad Request", message: "status deve ser ALTERNATIVE_ACCEPTED ou ALTERNATIVE_REJECTED" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Solicitação não encontrada" });
      return;
    }

    if (existing.requesterId !== user.sub) {
      res.status(403).json({ error: "Forbidden", message: "Apenas o solicitante pode responder" });
      return;
    }

    if (existing.status !== "ALTERNATIVE_PROPOSED") {
      res.status(422).json({ error: "Unprocessable", message: "Solicitação não está aguardando resposta de alternativa" });
      return;
    }

    const [updated] = await db
      .update(requestsTable)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(requestsTable.id, id))
      .returning();

    const actorName = await getActorName(user.sub);
    const action = status === "ALTERNATIVE_ACCEPTED" ? "request.alternative_accepted" : "request.alternative_rejected";
    const label = status === "ALTERNATIVE_ACCEPTED" ? "aceitou" : "rejeitou";
    await writeHistoryEvent({
      category: "REQUEST",
      action,
      title: `Alternativa ${label}`,
      narrative: `${actorName} ${label} a alternativa proposta para a solicitação.`,
      entityType: "request",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: existing.operationId,
      orgId: user.organizationId,
    });

    log.info({ requestId: id, status }, "request alternative responded");
    res.json({ request: updated });
  } catch (err) {
    log.error({ err }, "Error updating request");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /requests/:id/decision — supervisor decide ─────────────────────────

router.post("/requests/:id/decision", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };
  const { decision, reason, alternativeDetails, deadline } = req.body as {
    decision: string;
    reason?: string;
    alternativeDetails?: string;
    deadline?: string;
  };

  const validDecisions = ["APPROVED", "DENIED", "ALTERNATIVE_PROPOSED"];
  if (!decision || !validDecisions.includes(decision)) {
    res.status(400).json({ error: "Bad Request", message: "decision deve ser APPROVED, DENIED ou ALTERNATIVE_PROPOSED" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Solicitação não encontrada" });
      return;
    }

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await isActiveDelegate(user.sub, existing.operationId))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas gestores podem decidir solicitações" });
        return;
      }
    }

    const activeStatuses = ["PENDING", "ALTERNATIVE_REJECTED"];
    if (!activeStatuses.includes(existing.status)) {
      res.status(422).json({ error: "Unprocessable", message: "Solicitação não está em estado que aceita decisão" });
      return;
    }

    const statusMap: Record<string, string> = {
      APPROVED: "APPROVED",
      DENIED: "DENIED",
      ALTERNATIVE_PROPOSED: "ALTERNATIVE_PROPOSED",
    };
    const newStatus = statusMap[decision];

    const [decisionRecord] = await db
      .insert(requestDecisionsTable)
      .values({
        requestId: id,
        supervisorId: user.sub,
        decision: decision as any,
        reason: reason ?? null,
        alternativeDetails: alternativeDetails ?? null,
        deadline: deadline ? new Date(deadline) : null,
      })
      .returning();

    await db
      .update(requestsTable)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(eq(requestsTable.id, id));

    const actorName = await getActorName(user.sub);
    const actionMap: Record<string, string> = {
      APPROVED: "request.approved",
      DENIED: "request.denied",
      ALTERNATIVE_PROPOSED: "request.alternative_proposed",
    };
    const labelMap: Record<string, string> = {
      APPROVED: "aprovou",
      DENIED: "negou",
      ALTERNATIVE_PROPOSED: "propôs uma alternativa para",
    };
    await writeHistoryEvent({
      category: "REQUEST",
      action: actionMap[decision],
      title: `Solicitação ${labelMap[decision]}`,
      narrative: `${actorName} ${labelMap[decision]} a solicitação.${reason ? ` Motivo: ${reason}` : ""}`,
      entityType: "request",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: existing.operationId,
      orgId: user.organizationId,
    });

    log.info({ requestId: id, decision, supervisorId: user.sub }, "request decision recorded");
    res.status(201).json({ decision: decisionRecord });
  } catch (err) {
    log.error({ err }, "Error recording decision");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
