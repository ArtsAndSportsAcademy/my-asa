import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  supervisorRequestsTable,
  usersTable,
  operationsTable,
  agendaEventsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { LOG_DOMAIN } from "@workspace/shared";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── GET /supervisor-requests — listar (enviadas e recebidas) ─────────────────

router.get("/supervisor-requests", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.SUPERVISOR_REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores têm acesso" });
    return;
  }

  const { direction } = req.query as { direction?: string };

  try {
    const filterCondition = direction === "sent"
      ? eq(supervisorRequestsTable.requestorId, user.sub)
      : direction === "received"
        ? eq(supervisorRequestsTable.targetSupervisorId, user.sub)
        : or(
            eq(supervisorRequestsTable.requestorId, user.sub),
            eq(supervisorRequestsTable.targetSupervisorId, user.sub),
          );

    const rows = await db
      .select({
        id: supervisorRequestsTable.id,
        requestorId: supervisorRequestsTable.requestorId,
        requestorName: usersTable.name,
        targetSupervisorId: supervisorRequestsTable.targetSupervisorId,
        targetOperationId: supervisorRequestsTable.targetOperationId,
        targetOperationName: operationsTable.name,
        requestorOperationId: supervisorRequestsTable.requestorOperationId,
        memberId: supervisorRequestsTable.memberId,
        agendaEventId: supervisorRequestsTable.agendaEventId,
        reason: supervisorRequestsTable.reason,
        status: supervisorRequestsTable.status,
        responseReason: supervisorRequestsTable.responseReason,
        respondedAt: supervisorRequestsTable.respondedAt,
        createdAt: supervisorRequestsTable.createdAt,
      })
      .from(supervisorRequestsTable)
      .innerJoin(usersTable, eq(supervisorRequestsTable.requestorId, usersTable.id))
      .innerJoin(operationsTable, eq(supervisorRequestsTable.targetOperationId, operationsTable.id))
      .where(filterCondition!)
      .orderBy(desc(supervisorRequestsTable.createdAt));

    log.info({ count: rows.length }, "supervisor-requests listadas");
    res.json({ requests: rows });
  } catch (err) {
    log.error({ err }, "erro ao listar supervisor-requests");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /supervisor-requests — criar solicitação ────────────────────────────

router.post("/supervisor-requests", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.SUPERVISOR_REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem criar solicitações" });
    return;
  }

  const {
    requestorOperationId,
    targetSupervisorId,
    targetOperationId,
    memberId,
    agendaEventId,
    reason,
  } = req.body as {
    requestorOperationId: string;
    targetSupervisorId?: string;
    targetOperationId: string;
    memberId: string;
    agendaEventId?: string;
    reason: string;
  };

  if (!requestorOperationId || !targetOperationId || !memberId || !reason) {
    res.status(400).json({ error: "Bad Request", message: "requestorOperationId, targetOperationId, memberId e reason são obrigatórios" });
    return;
  }

  try {
    const [member] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, memberId))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Membro não encontrado" });
      return;
    }

    const [targetOp] = await db
      .select({ name: operationsTable.name })
      .from(operationsTable)
      .where(eq(operationsTable.id, targetOperationId))
      .limit(1);

    const [requestorOp] = await db
      .select({ name: operationsTable.name })
      .from(operationsTable)
      .where(eq(operationsTable.id, requestorOperationId))
      .limit(1);

    const [request] = await db
      .insert(supervisorRequestsTable)
      .values({
        requestorId: user.sub,
        requestorOperationId,
        targetSupervisorId: targetSupervisorId ?? null,
        targetOperationId,
        memberId,
        agendaEventId: agendaEventId ?? null,
        reason,
        status: "PENDING",
      })
      .returning();

    writeHistoryEvent({
      category: "SUPERVISOR_REQUEST",
      action: "supervisor_request.created",
      title: "Solicitação entre supervisores criada",
      narrative: `Supervisor solicitou uso do membro ${member.name} (de ${targetOp?.name ?? targetOperationId}) para ${requestorOp?.name ?? requestorOperationId}. Motivo: ${reason}`,
      entityType: "supervisor_request",
      entityId: request!.id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ requestId: request!.id, memberId, targetOperationId }, "supervisor-request criada");
    res.status(201).json({ request: { ...request, memberName: member.name } });
  } catch (err) {
    log.error({ err }, "erro ao criar supervisor-request");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /supervisor-requests/:id/respond — responder solicitação ────────────

router.post("/supervisor-requests/:id/respond", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.SUPERVISOR_REQUESTS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem responder solicitações" });
    return;
  }

  const { decision, responseReason } = req.body as {
    decision: "APPROVED" | "DENIED";
    responseReason?: string;
  };

  if (!decision || !["APPROVED", "DENIED"].includes(decision)) {
    res.status(400).json({ error: "Bad Request", message: "decision deve ser APPROVED ou DENIED" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(supervisorRequestsTable)
      .where(eq(supervisorRequestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Solicitação não encontrada" });
      return;
    }

    if (existing.status !== "PENDING") {
      res.status(409).json({ error: "Solicitação já foi respondida" });
      return;
    }

    if (existing.targetSupervisorId && existing.targetSupervisorId !== user.sub && user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden", message: "Esta solicitação não é endereçada a você" });
      return;
    }

    const [updated] = await db
      .update(supervisorRequestsTable)
      .set({
        status: decision,
        responseReason: responseReason ?? null,
        respondedAt: new Date(),
        respondedBy: user.sub,
      })
      .where(eq(supervisorRequestsTable.id, id))
      .returning();

    const label = decision === "APPROVED" ? "aprovou" : "negou";
    writeHistoryEvent({
      category: "SUPERVISOR_REQUEST",
      action: `supervisor_request.${decision.toLowerCase()}`,
      title: `Solicitação entre supervisores ${label}`,
      narrative: `Supervisor ${label} a solicitação de uso de membro.${responseReason ? ` Motivo: ${responseReason}` : ""}`,
      entityType: "supervisor_request",
      entityId: id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ requestId: id, decision, respondedBy: user.sub }, "supervisor-request respondida");
    res.json({ request: updated });
  } catch (err) {
    log.error({ err }, "erro ao responder supervisor-request");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
