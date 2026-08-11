import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { operationsTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { LOG_DOMAIN } from "@workspace/shared";

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
  const {
    name, description, clientName, locations, startDate, endDate, color, icon,
    localCoordinatorId, status, healthThresholds,
  } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name é obrigatório" });
    return;
  }

  const resolvedStatus: OperationStatus = OPERATION_STATUSES.includes(status) ? status : "DRAFT";

  if (startDate && endDate && endDate < startDate) {
    res.status(400).json({ error: "BAD_REQUEST", message: "A data final não pode ser anterior à data inicial" });
    return;
  }

  try {
    const [operation] = await db
      .insert(operationsTable)
      .values({
        organizationId: req.user!.organizationId,
        name: (name as string).trim(),
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        clientName: typeof clientName === "string" && clientName.trim() ? clientName.trim() : null,
        locations: Array.isArray(locations) ? locations.map(String).map((v) => v.trim()).filter(Boolean) : [],
        startDate: startDate || null,
        endDate: endDate || null,
        color: typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#6D4AFF",
        icon: typeof icon === "string" && icon.trim() ? icon.trim() : "sparkles",
        localCoordinatorId: localCoordinatorId || null,
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
  const log = requestLogger(LOG_DOMAIN.ORGANIZATION, req.requestId, req.correlationId);
  const id = req.params.id as string;
  const {
    name, description, clientName, locations, startDate, endDate, color, icon,
    localCoordinatorId, healthThresholds, lateThresholdMinutes, timezone,
  } = req.body as {
    name?: string;
    description?: string | null;
    clientName?: string | null;
    locations?: string[];
    startDate?: string | null;
    endDate?: string | null;
    color?: string;
    icon?: string;
    localCoordinatorId?: string | null;
    healthThresholds?: unknown;
    lateThresholdMinutes?: number;
    timezone?: string;
  };

  try {
    const operation = await db.query.operationsTable.findFirst({
      where: and(eq(operationsTable.id, id), eq(operationsTable.organizationId, req.user!.organizationId)),
    });
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name?.trim()) updates["name"] = (name as string).trim();
    if (description !== undefined) updates["description"] = description?.trim() || null;
    if (clientName !== undefined) updates["clientName"] = clientName?.trim() || null;
    if (locations !== undefined) {
      if (!Array.isArray(locations)) {
        res.status(400).json({ error: "BAD_REQUEST", message: "locations deve ser uma lista" });
        return;
      }
      updates["locations"] = locations.map(String).map((v) => v.trim()).filter(Boolean);
    }
    const resolvedStartDate = startDate !== undefined ? startDate : operation.startDate;
    const resolvedEndDate = endDate !== undefined ? endDate : operation.endDate;
    if (resolvedStartDate && resolvedEndDate && resolvedEndDate < resolvedStartDate) {
      res.status(400).json({ error: "BAD_REQUEST", message: "A data final não pode ser anterior à data inicial" });
      return;
    }
    if (startDate !== undefined) updates["startDate"] = startDate || null;
    if (endDate !== undefined) updates["endDate"] = endDate || null;
    if (color !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Cor inválida" });
        return;
      }
      updates["color"] = color;
    }
    if (icon !== undefined) updates["icon"] = icon.trim() || "sparkles";
    if (localCoordinatorId !== undefined) updates["localCoordinatorId"] = localCoordinatorId || null;
    if (healthThresholds !== undefined) updates["healthThresholds"] = healthThresholds;
    if (typeof lateThresholdMinutes === "number" && lateThresholdMinutes >= 0) {
      updates["lateThresholdMinutes"] = lateThresholdMinutes;
    }
    if (timezone?.trim()) updates["timezone"] = timezone.trim();

    const [updated] = await db
      .update(operationsTable)
      .set(updates as any)
      .where(eq(operationsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { changedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
    });

    // Histórico: tolerância de atraso alterada
    if (typeof lateThresholdMinutes === "number" && lateThresholdMinutes !== operation.lateThresholdMinutes) {
      void writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: "operation.config.threshold_updated",
        title: "Tolerância de atraso alterada",
        narrative: `Tolerância de atraso atualizada de ${operation.lateThresholdMinutes} min para ${lateThresholdMinutes} min`,
        entityType: "operation",
        entityId: id,
        actorId: req.user!.sub,
        operationId: id,
        orgId: req.user!.organizationId,
      });
    }

    // Histórico: fuso horário alterado
    if (timezone?.trim() && timezone.trim() !== operation.timezone) {
      void writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: "operation.config.timezone_updated",
        title: "Fuso horário alterado",
        narrative: `Fuso horário atualizado de "${operation.timezone}" para "${timezone.trim()}"`,
        entityType: "operation",
        entityId: id,
        actorId: req.user!.sub,
        operationId: id,
        orgId: req.user!.organizationId,
      });
    }

    log.info({ operationId: id }, "Operation updated");
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

    const now = new Date();
    const [updated] = await db
      .update(operationsTable)
      .set({
        status: status as OperationStatus,
        archivedAt: status === "ARCHIVED" ? now : null,
        archivedBy: status === "ARCHIVED" ? req.user!.sub : null,
        updatedAt: now,
      })
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
