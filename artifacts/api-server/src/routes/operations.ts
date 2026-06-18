import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { operationsTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";

const router: IRouter = Router();

const OPERATION_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
type OperationStatus = typeof OPERATION_STATUSES[number];

router.get("/operations/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { role, operationIds, organizationId } = req.user!;
  const id = req.params.id as string;

  try {
    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, id), eq(operationsTable.organizationId, organizationId)),
    });
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada" });
      return;
    }

    if (role !== "ADMIN" && !operationIds.includes(operation.id)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Operação fora do escopo" });
      return;
    }

    res.json({ operation });
  } catch (err) {
    log.error({ err }, "Error getting operation");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/operations", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const { name, status, healthThresholds } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name é obrigatório" });
    return;
  }

  const resolvedStatus: OperationStatus = OPERATION_STATUSES.includes(status) ? status : "DRAFT";

  try {
    const [operation] = await db
      .insert(operationsTable)
      .values({
        organizationId: req.user!.organizationId,
        name: (name as string).trim(),
        status: resolvedStatus,
        healthThresholds: healthThresholds ?? {
          scalePublishedDaysAhead: 7,
          dailyBookPublishedHoursAhead: 24,
          openPositionThreshold: 0,
        },
      })
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_CREATED",
      targetResource: `operation:${operation!.id}`,
      metadata: { name, status: resolvedStatus },
    });

    log.info({ operationId: operation!.id }, "Operation created");
    res.status(201).json({ operation });
  } catch (err) {
    log.error({ err }, "Error creating operation");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operations/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { name, healthThresholds } = req.body;

  try {
    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, id), eq(operationsTable.organizationId, req.user!.organizationId)),
    });
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    const updates: Partial<{ name: string; healthThresholds: unknown; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (name?.trim()) updates.name = (name as string).trim();
    if (healthThresholds !== undefined) updates.healthThresholds = healthThresholds;

    const [updated] = await db
      .update(operationsTable)
      .set(updates)
      .where(eq(operationsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
    });

    res.json({ operation: updated });
  } catch (err) {
    log.error({ err }, "Error updating operation");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operations/:id/status", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { status } = req.body;

  if (!OPERATION_STATUSES.includes(status)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `status deve ser: ${OPERATION_STATUSES.join(", ")}` });
    return;
  }

  try {
    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, id), eq(operationsTable.organizationId, req.user!.organizationId)),
    });
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    const [updated] = await db
      .update(operationsTable)
      .set({ status: status as OperationStatus, updatedAt: new Date() })
      .where(eq(operationsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { from: operation.status, to: status },
    });

    log.info({ operationId: id, from: operation.status, to: status }, "Operation status changed");
    res.json({ operation: updated });
  } catch (err) {
    log.error({ err }, "Error updating operation status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
