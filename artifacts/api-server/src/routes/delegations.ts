import { Router, type IRouter } from "express";
import { eq, and, isNull, isNotNull, or, lte, gte, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { delegationsTable, usersTable, operationsTable } from "@workspace/db";
import type { DelegatedResponsibility } from "@workspace/db/schema";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();
const SUPERVISOR_ROLES = ["SUPERVISOR_A", "SUPERVISOR_B"];
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

const ALL_RESPONSIBILITIES: DelegatedResponsibility[] = [
  "CHECK_INS",
  "REQUESTS",
  "TASK_APPROVALS",
  "DAILY_BOOK",
  "NOTICES",
  "OPERATIONAL_MESSAGES",
  "SCALES",
];

const RESPONSIBILITY_LABELS: Record<DelegatedResponsibility, string> = {
  CHECK_INS: "Check-ins",
  REQUESTS: "Solicitações",
  TASK_APPROVALS: "Aprovação de Tarefas",
  DAILY_BOOK: "Livro do Dia",
  NOTICES: "Avisos",
  OPERATIONAL_MESSAGES: "Mensagens Operacionais",
  SCALES: "Escalas",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fromDateStr(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

function resolveStatus(validFrom: Date, validUntil: Date, revokedAt: Date | null): string {
  if (revokedAt !== null) return "CANCELLED";
  const now = new Date();
  if (validUntil < now) return "EXPIRED";
  if (validFrom <= now) return "ACTIVE";
  return "PENDING";
}

function validateResponsibilities(r: unknown): DelegatedResponsibility[] | null {
  if (!Array.isArray(r) || r.length === 0) return null;
  for (const item of r) {
    if (!ALL_RESPONSIBILITIES.includes(item as DelegatedResponsibility)) return null;
  }
  return r as DelegatedResponsibility[];
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
    const whereClause = user.role === "ADMIN"
      ? undefined
      : eq(delegationsTable.delegatorId, user.sub);

    const rows = await db
      .select({
        id: delegationsTable.id,
        delegatorId: delegationsTable.delegatorId,
        delegateeId: delegationsTable.delegateeId,
        operationId: delegationsTable.operationId,
        operationName: operationsTable.name,
        validFrom: delegationsTable.validFrom,
        validUntil: delegationsTable.validUntil,
        revokedAt: delegationsTable.revokedAt,
        reason: delegationsTable.reason,
        responsibilities: delegationsTable.responsibilities,
        createdAt: delegationsTable.createdAt,
      })
      .from(delegationsTable)
      .innerJoin(operationsTable, eq(delegationsTable.operationId, operationsTable.id))
      .where(whereClause)
      .orderBy(desc(delegationsTable.createdAt));

    const userIds = [...new Set(rows.flatMap((r) => [r.delegatorId, r.delegateeId]))];
    const nameRows = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
          .where(eq(usersTable.id, userIds[0]!))
      : [];

    const allNameRows = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
      : [];
    const nameMap: Record<string, string> = {};
    for (const u of allNameRows) {
      if (userIds.includes(u.id)) nameMap[u.id] = u.name;
    }

    const delegations = rows.map((r) => ({
      id: r.id,
      supervisorId: r.delegatorId,
      supervisorName: nameMap[r.delegatorId] ?? r.delegatorId,
      delegateId: r.delegateeId,
      delegateeName: nameMap[r.delegateeId] ?? r.delegateeId,
      operationId: r.operationId,
      operationName: r.operationName,
      startDate: toDateStr(r.validFrom),
      endDate: toDateStr(r.validUntil),
      reason: r.reason ?? null,
      responsibilities: r.responsibilities as DelegatedResponsibility[],
      status: resolveStatus(r.validFrom, r.validUntil, r.revokedAt),
      createdAt: r.createdAt,
    }));

    log.info({ count: delegations.length }, "delegações listadas");
    res.json({ delegations });
  } catch (err) {
    log.error({ err }, "erro ao listar delegações");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /delegations/my-active ───────────────────────────────────────────────

router.get("/delegations/my-active", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.DELEGATIONS, req.requestId, req.correlationId);
  const userId = req.user!.sub;
  const now = new Date();

  try {
    const rows = await db
      .select({
        id: delegationsTable.id,
        delegatorId: delegationsTable.delegatorId,
        operationId: delegationsTable.operationId,
        operationName: operationsTable.name,
        validFrom: delegationsTable.validFrom,
        validUntil: delegationsTable.validUntil,
        responsibilities: delegationsTable.responsibilities,
        reason: delegationsTable.reason,
      })
      .from(delegationsTable)
      .innerJoin(operationsTable, eq(delegationsTable.operationId, operationsTable.id))
      .where(
        and(
          eq(delegationsTable.delegateeId, userId),
          isNull(delegationsTable.revokedAt),
          lte(delegationsTable.validFrom, now),
          gte(delegationsTable.validUntil, now),
        ),
      );

    const supervisorIds = [...new Set(rows.map((r) => r.delegatorId))];
    const nameRows = supervisorIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
      : [];
    const nameMap: Record<string, string> = {};
    for (const u of nameRows) {
      if (supervisorIds.includes(u.id)) nameMap[u.id] = u.name;
    }

    const delegations = rows.map((r) => ({
      delegationId: r.id,
      supervisorId: r.delegatorId,
      supervisorName: nameMap[r.delegatorId] ?? r.delegatorId,
      operationId: r.operationId,
      operationName: r.operationName,
      startDate: toDateStr(r.validFrom),
      endDate: toDateStr(r.validUntil),
      responsibilities: r.responsibilities as DelegatedResponsibility[],
      reason: r.reason ?? null,
    }));

    res.json({ delegations });
  } catch (err) {
    log.error({ err }, "erro ao buscar delegações ativas");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /delegations ────────────────────────────────────────────────────────

router.post("/delegations", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.DELEGATIONS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!SUPERVISOR_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem criar delegações" });
    return;
  }

  const { delegateId, operationId, startDate, endDate, reason, responsibilities } = req.body as {
    delegateId: string;
    operationId: string;
    startDate: string;
    endDate: string;
    reason?: string;
    responsibilities: string[];
  };

  if (!delegateId || !operationId || !startDate || !endDate) {
    res.status(400).json({ error: "Bad Request", message: "delegateId, operationId, startDate e endDate são obrigatórios" });
    return;
  }

  const validResponsibilities = validateResponsibilities(responsibilities);
  if (!validResponsibilities) {
    res.status(400).json({
      error: "Bad Request",
      message: `responsibilities deve ser um array não vazio com valores válidos: ${ALL_RESPONSIBILITIES.join(", ")}`,
    });
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
    const [delegation] = await db
      .insert(delegationsTable)
      .values({
        delegatorId: user.sub,
        delegateeId: delegateId,
        operationId,
        validFrom: fromDateStr(startDate),
        validUntil: fromDateStr(endDate),
        reason: reason ?? null,
        responsibilities: validResponsibilities,
      })
      .returning();

    const responsibilityLabels = validResponsibilities
      .map((r) => RESPONSIBILITY_LABELS[r])
      .join(", ");

    writeHistoryEvent({
      category: "DELEGATION",
      action: "delegation.created",
      title: "Delegação criada",
      narrative: `Supervisor delegou responsabilidades: ${responsibilityLabels}.`,
      entityType: "delegation",
      entityId: delegation!.id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ delegationId: delegation!.id, responsibilities: validResponsibilities }, "delegação criada");
    res.status(201).json({
      delegation: {
        id: delegation!.id,
        supervisorId: delegation!.delegatorId,
        delegateId: delegation!.delegateeId,
        operationId: delegation!.operationId,
        startDate: toDateStr(delegation!.validFrom),
        endDate: toDateStr(delegation!.validUntil),
        reason: delegation!.reason ?? null,
        responsibilities: delegation!.responsibilities,
        status: resolveStatus(delegation!.validFrom, delegation!.validUntil, delegation!.revokedAt),
        createdAt: delegation!.createdAt,
      },
    });
  } catch (err) {
    log.error({ err }, "erro ao criar delegação");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── PATCH /delegations/:id/cancel ───────────────────────────────────────────

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
    if (existing.delegatorId !== user.sub && user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden", message: "Apenas o supervisor titular pode cancelar" });
      return;
    }
    if (existing.revokedAt !== null) {
      res.status(409).json({ error: "Conflict", message: "Delegação já foi cancelada" });
      return;
    }
    const now = new Date();
    if (existing.validUntil < now) {
      res.status(409).json({ error: "Conflict", message: "Delegação já expirou" });
      return;
    }

    const [updated] = await db
      .update(delegationsTable)
      .set({ revokedAt: now })
      .where(eq(delegationsTable.id, id))
      .returning();

    writeHistoryEvent({
      category: "DELEGATION",
      action: "delegation.cancelled",
      title: "Delegação cancelada",
      narrative: `Delegação de responsabilidades cancelada.`,
      entityType: "delegation",
      entityId: id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ delegationId: id }, "delegação cancelada");
    res.json({
      delegation: {
        id: updated!.id,
        supervisorId: updated!.delegatorId,
        delegateId: updated!.delegateeId,
        operationId: updated!.operationId,
        startDate: toDateStr(updated!.validFrom),
        endDate: toDateStr(updated!.validUntil),
        reason: updated!.reason ?? null,
        responsibilities: updated!.responsibilities,
        status: "CANCELLED",
        createdAt: updated!.createdAt,
      },
    });
  } catch (err) {
    log.error({ err }, "erro ao cancelar delegação");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
