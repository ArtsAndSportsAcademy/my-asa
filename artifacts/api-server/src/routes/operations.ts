import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { operationsTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { LOG_DOMAIN } from "@workspace/shared";
import {
  OPERATION_STATUSES,
  canTransitionOperation,
  getOperationInOrganization,
  getOperationReadiness,
  isDuplicateOperationError,
  isOperationStatus,
  operationNameExists,
  type OperationStatus,
} from "../services/operation-lifecycle.js";

const router: IRouter = Router();

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

    if (role !== "ADMIN" && (operation.status !== "ACTIVE" || !operationIds.includes(operation.id))) {
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
    localCoordinatorId, healthThresholds,
  } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name é obrigatório" });
    return;
  }

  if (startDate && endDate && endDate < startDate) {
    res.status(400).json({ error: "BAD_REQUEST", message: "A data final não pode ser anterior à data inicial" });
    return;
  }

  try {
    if (await operationNameExists(req.user!.organizationId, name)) {
      res.status(409).json({
        error: "DUPLICATE_OPERATION",
        message: "Já existe uma operação com este nome.",
      });
      return;
    }

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
        status: "DRAFT",
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
      metadata: { name, status: "DRAFT" },
    });

    log.info({ operationId: operation!.id }, "Operation created");
    res.status(201).json({ operation });
  } catch (err) {
    if (isDuplicateOperationError(err)) {
      res.status(409).json({
        error: "DUPLICATE_OPERATION",
        message: "Já existe uma operação com este nome.",
      });
      return;
    }
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
    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ error: "BAD_REQUEST", message: "name é obrigatório" });
        return;
      }
      if (await operationNameExists(req.user!.organizationId, name, id)) {
        res.status(409).json({
          error: "DUPLICATE_OPERATION",
          message: "Já existe uma operação com este nome.",
        });
        return;
      }
      updates["name"] = name.trim();
    }
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
    if (isDuplicateOperationError(err)) {
      res.status(409).json({
        error: "DUPLICATE_OPERATION",
        message: "Já existe uma operação com este nome.",
      });
      return;
    }
    log.error({ err }, "Error updating operation");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/operations/:id/status", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { status } = req.body;

  if (!isOperationStatus(status)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `status deve ser: ${OPERATION_STATUSES.join(", ")}` });
    return;
  }

  try {
    const operation = await getOperationInOrganization(id, req.user!.organizationId);
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    const targetStatus: OperationStatus = status;
    if (!canTransitionOperation(operation.status, targetStatus)) {
      res.status(409).json({
        error: "INVALID_OPERATION_TRANSITION",
        message: `Não é possível alterar a operação de ${operation.status} para ${targetStatus}.`,
      });
      return;
    }

    if (targetStatus === "ACTIVE") {
      const readiness = await getOperationReadiness(operation);
      if (!readiness.ready) {
        res.status(409).json({
          error: "OPERATION_NOT_READY",
          message: "Conclua a configuração da operação antes de ativá-la.",
          readiness,
        });
        return;
      }
    }

    const now = new Date();
    const isActivation = targetStatus === "ACTIVE" && operation.status !== "ACTIVE";
    const [updated] = await db
      .update(operationsTable)
      .set({
        status: targetStatus,
        archivedAt: targetStatus === "ARCHIVED" ? now : null,
        archivedBy: targetStatus === "ARCHIVED" ? req.user!.sub : null,
        activatedAt: isActivation ? now : operation.activatedAt,
        activatedBy: isActivation ? req.user!.sub : operation.activatedBy,
        updatedAt: now,
      })
      .where(eq(operationsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { from: operation.status, to: targetStatus },
    });

    void writeHistoryEvent({
      category: "OPERATIONAL_CHANGE",
      action: `operation.status.${targetStatus.toLowerCase()}`,
      title: "Situação da operação alterada",
      narrative: `Situação alterada de ${operation.status} para ${targetStatus}`,
      entityType: "operation",
      entityId: id,
      actorId: req.user!.sub,
      operationId: id,
      orgId: req.user!.organizationId,
    });

    log.info({ operationId: id, from: operation.status, to: targetStatus }, "Operation status changed");
    res.json({ operation: updated });
  } catch (err) {
    log.error({ err }, "Error updating operation status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.get(
  "/operations/:id/readiness",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = req.params.id as string;
    const operation = await getOperationInOrganization(id, req.user!.organizationId);
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada" });
      return;
    }
    res.json({ readiness: await getOperationReadiness(operation) });
  },
);

router.patch(
  "/operations/:id/setup-review",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = req.params.id as string;
    const operation = await getOperationInOrganization(id, req.user!.organizationId);
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada" });
      return;
    }
    if (typeof req.body?.reviewed !== "boolean") {
      res.status(400).json({ error: "BAD_REQUEST", message: "reviewed deve ser verdadeiro ou falso" });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(operationsTable)
      .set({
        modulesReviewedAt: req.body.reviewed ? now : null,
        modulesReviewedBy: req.body.reviewed ? req.user!.sub : null,
        updatedAt: now,
      })
      .where(eq(operationsTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { relatedModulesReviewed: req.body.reviewed },
    });

    res.json({ operation: updated, readiness: await getOperationReadiness(updated!) });
  },
);

export default router;
