import { Router, type IRouter } from "express";
import { eq, and, inArray, not, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { delegationsTable, usersTable, operationsTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();
const SUPERVISOR_ROLES = ["SUPERVISOR_A", "SUPERVISOR_B"];
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helper: status computado por data ───────────────────────────────────────

function resolveStatus(startDate: string, endDate: string, storedStatus: string): string {
  if (storedStatus === "CANCELLED") return "CANCELLED";
  const today = new Date().toISOString().slice(0, 10);
  if (endDate < today) return "EXPIRED";
  if (startDate <= today) return "ACTIVE";
  return "PENDING";
}

// ─── GET /delegations — listar ────────────────────────────────────────────────

router.get("/delegations", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.DELEGATIONS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const rows = await db
      .select({
        id: delegationsTable.id,
        supervisorId: delegationsTable.supervisorId,
        delegateId: delegationsTable.delegateId,
        operationId: delegationsTable.operationId,
        operationName: operationsTable.name,
        startDate: delegationsTable.startDate,
        endDate: delegationsTable.endDate,
        reason: delegationsTable.reason,
        status: delegationsTable.status,
        createdAt: delegationsTable.createdAt,
      })
      .from(delegationsTable)
      .innerJoin(operationsTable, eq(delegationsTable.operationId, operationsTable.id))
      .where(
        user.role === "ADMIN"
          ? eq(delegationsTable.organizationId, user.organizationId)
          : eq(delegationsTable.supervisorId, user.sub),
      )
      .orderBy(desc(delegationsTable.createdAt));

    const userIds = [...new Set(rows.flatMap((r) => [r.supervisorId, r.delegateId]))];
    const nameRows = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const nameMap: Record<string, string> = Object.fromEntries(nameRows.map((u) => [u.id, u.name]));

    const delegations = rows.map((r) => ({
      delegationId: r.id,
      supervisorId: r.supervisorId,
      supervisorName: nameMap[r.supervisorId] ?? r.supervisorId,
      delegateId: r.delegateId,
      delegateName: nameMap[r.delegateId] ?? r.delegateId,
      operationId: r.operationId,
      operationName: r.operationName,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason ?? null,
      status: resolveStatus(r.startDate, r.endDate, r.status),
      createdAt: r.createdAt,
    }));

    log.info({ count: delegations.length }, "delegações listadas");
    res.json({ delegations });
  } catch (err) {
    log.error({ err }, "erro ao listar delegações");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /delegations/my-active — delegado verifica próprias delegações ────────

router.get("/delegations/my-active", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.DELEGATIONS, req.requestId, req.correlationId);
  const userId = req.user!.sub;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const rows = await db
      .select({
        id: delegationsTable.id,
        supervisorId: delegationsTable.supervisorId,
        operationId: delegationsTable.operationId,
        operationName: operationsTable.name,
        startDate: delegationsTable.startDate,
        endDate: delegationsTable.endDate,
      })
      .from(delegationsTable)
      .innerJoin(operationsTable, eq(delegationsTable.operationId, operationsTable.id))
      .where(
        and(
          eq(delegationsTable.delegateId, userId),
          not(inArray(delegationsTable.status, ["CANCELLED", "EXPIRED"])),
        ),
      );

    const active = rows.filter((r) => r.startDate <= today && r.endDate >= today);

    const supervisorIds = [...new Set(active.map((r) => r.supervisorId))];
    const nameRows = supervisorIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, supervisorIds))
      : [];
    const nameMap: Record<string, string> = Object.fromEntries(nameRows.map((u) => [u.id, u.name]));

    const delegations = active.map((r) => ({
      delegationId: r.id,
      supervisorId: r.supervisorId,
      supervisorName: nameMap[r.supervisorId] ?? r.supervisorId,
      operationId: r.operationId,
      operationName: r.operationName,
      startDate: r.startDate,
      endDate: r.endDate,
    }));

    res.json({ delegations });
  } catch (err) {
    log.error({ err }, "erro ao buscar delegações ativas");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /delegations — supervisor cria delegação ────────────────────────────

router.post("/delegations", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.DELEGATIONS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!SUPERVISOR_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem criar delegações" });
    return;
  }

  const { delegateId, operationId, startDate, endDate, reason } = req.body as {
    delegateId: string;
    operationId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  };

  if (!delegateId || !operationId || !startDate || !endDate) {
    res.status(400).json({ error: "Bad Request", message: "delegateId, operationId, startDate e endDate são obrigatórios" });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: "Bad Request", message: "endDate deve ser igual ou posterior a startDate" });
    return;
  }
  if (delegateId === user.sub) {
    res.status(400).json({ error: "Bad Request", message: "Supervisor não pode se auto-delegar" });
    return;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const initialStatus: "EXPIRED" | "ACTIVE" | "PENDING" =
      endDate < today ? "EXPIRED" : startDate <= today ? "ACTIVE" : "PENDING";

    const [delegation] = await db
      .insert(delegationsTable)
      .values({
        organizationId: user.organizationId,
        supervisorId: user.sub,
        delegateId,
        operationId,
        startDate,
        endDate,
        reason: reason ?? null,
        status: initialStatus,
      })
      .returning();

    writeHistoryEvent({
      category: "DELEGATION",
      action: "delegation.created",
      title: "Delegação criada",
      narrative: `Supervisor delegou temporariamente responsabilidades operacionais.`,
      entityType: "delegation",
      entityId: delegation!.id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ delegationId: delegation!.id, status: initialStatus }, "delegação criada");
    res.status(201).json({ delegation });
  } catch (err) {
    log.error({ err }, "erro ao criar delegação");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── PATCH /delegations/:id/cancel — supervisor cancela delegação ─────────────

router.patch("/delegations/:id/cancel", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.DELEGATIONS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(delegationsTable)
      .where(eq(delegationsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Delegação não encontrada" });
      return;
    }
    if (existing.supervisorId !== user.sub && user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden", message: "Apenas o supervisor titular pode cancelar" });
      return;
    }
    if (["CANCELLED", "EXPIRED"].includes(existing.status)) {
      res.status(409).json({ error: "Conflict", message: `Delegação já está ${existing.status}` });
      return;
    }

    const [updated] = await db
      .update(delegationsTable)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(delegationsTable.id, id))
      .returning();

    writeHistoryEvent({
      category: "DELEGATION",
      action: "delegation.cancelled",
      title: "Delegação cancelada",
      narrative: `Delegação temporária cancelada.`,
      entityType: "delegation",
      entityId: id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ delegationId: id }, "delegação cancelada");
    res.json({ delegation: updated });
  } catch (err) {
    log.error({ err }, "erro ao cancelar delegação");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
