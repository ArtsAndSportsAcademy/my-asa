import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { historyEventsTable, locationsTable, operationLocationsTable, operationsTable, userRolesTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { sendNotification } from "../services/notificationService.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { normalizeReason, requireReason } from "../lib/reason.js";
import { LOG_DOMAIN } from "@workspace/shared";
import {
  OPERATION_STATUSES,
  canTransitionOperation,
  getOperationInOrganization,
  getOperationReadiness,
  getOperationsReadiness,
  isDuplicateOperationError,
  isOperationStatus,
  operationNameExists,
  type OperationStatus,
} from "../services/operation-lifecycle.js";

const router: IRouter = Router();

const STATUS_PT: Record<OperationStatus, string> = { DRAFT: "em configuração", ACTIVE: "ativa", PAUSED: "pausada", ARCHIVED: "encerrada" };
const CAMPO_PT: Record<string, string> = { name: "nome", description: "descrição", clientName: "empreendimento", locations: "locais", startDate: "início", endDate: "fim", color: "cor", icon: "ícone", localCoordinatorId: "coordenação local", healthThresholds: "limites de saúde", lateThresholdMinutes: "tolerância de atraso", timezone: "fuso horário" };
const PAPEL_ORDEM = ["ADMIN", "DIR", "DIRECTOR", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER", "TRAINER"];

/** Administração, Direção e Supervisão da casa (menos quem agiu): quem precisa saber que uma operação mudou de situação. */
async function gestoresParaAvisar(organizationId: string, exceto: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRolesTable.userId })
    .from(userRolesTable)
    .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(
      eq(operationsTable.organizationId, organizationId),
      eq(userRolesTable.active, true),
      inArray(userRolesTable.role, ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"] as any),
      eq(usersTable.status, "ACTIVE"),
      ne(userRolesTable.userId, exceto),
    ));
  return rows.map((row) => row.userId);
}

/**
 * Ao ativar uma operação, toda pessoa ativa da casa que já tem perfil ganha o mesmo perfil nela (o perfil é gravado
 * em cada operação ativa). Devolve quantas ganharam. Roda na mesma transação da ativação.
 */
async function darAcessoAosExistentes(tx: any, organizationId: string, operationId: string): Promise<number> {
  const papeis: { userId: string; role: string; operationId: string | null; groupId: string | null }[] = await tx
    .select({ userId: userRolesTable.userId, role: userRolesTable.role, operationId: userRolesTable.operationId, groupId: userRolesTable.groupId })
    .from(userRolesTable)
    .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(operationsTable.organizationId, organizationId), eq(userRolesTable.active, true), eq(usersTable.status, "ACTIVE")));
  const porPessoa = new Map<string, typeof papeis>();
  for (const papel of papeis) porPessoa.set(papel.userId, [...(porPessoa.get(papel.userId) ?? []), papel]);
  let concedidos = 0;
  for (const [userId, dela] of porPessoa) {
    const principal = [...dela].sort((a, b) => PAPEL_ORDEM.indexOf(a.role) - PAPEL_ORDEM.indexOf(b.role))[0]!;
    if (dela.some((papel) => papel.operationId === operationId && papel.role === principal.role && !papel.groupId)) continue;
    await tx.insert(userRolesTable).values({ userId, operationId, role: principal.role as any, active: true });
    concedidos += 1;
  }
  return concedidos;
}

/** Aviso ao sino; falhar em avisar nunca desfaz a mudança já gravada. */
async function avisar(userIds: string[], title: string, message: string, operationId: string, type = "operation.status") {
  await Promise.allSettled(userIds.map((userId) => sendNotification({
    userId, type, title, message, category: "system", priority: "NORMAL",
    entityType: "operation", entityId: operationId, actionUrl: "/operacoes",
  })));
}

/**
 * Visão da tela de Operações: cada operação com situação, locais ligados, quantas pessoas têm acesso e o
 * checklist de ativação — numa chamada só. Administração e Direção leem; só a Administração escreve.
 */
router.get("/operations/overview", requireAuth, requireOrganization, requireRole("ADMIN", "DIR", "DIRECTOR"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  try {
    const organizationId = req.user!.organizationId;
    const [operations, links, locations] = await Promise.all([
      db.query.operationsTable.findMany({ where: eq(operationsTable.organizationId, organizationId) }),
      db
        .select({ operationId: operationLocationsTable.operationId, locationId: operationLocationsTable.locationId })
        .from(operationLocationsTable)
        .innerJoin(operationsTable, eq(operationLocationsTable.operationId, operationsTable.id))
        .where(and(eq(operationsTable.organizationId, organizationId), eq(operationLocationsTable.active, true))),
      db
        .select({ id: locationsTable.id, name: locationsTable.name, closed: locationsTable.closed })
        .from(locationsTable)
        .where(eq(locationsTable.organizationId, organizationId))
        .orderBy(locationsTable.name),
    ]);
    const donoDoLocal = new Map<string, string>();
    for (const link of links) donoDoLocal.set(link.locationId, link.operationId);

    const prontidao = await getOperationsReadiness(operations);
    // Motivo escrito do encerramento: o evento mais recente de cada operação encerrada, numa consulta só.
    const encerradas = operations.filter((operation) => operation.status === "ARCHIVED").map((operation) => operation.id);
    const eventos = encerradas.length
      ? await db.select({ entityId: historyEventsTable.entityId, metadata: historyEventsTable.metadata }).from(historyEventsTable)
          .where(and(eq(historyEventsTable.entityType, "operation"), inArray(historyEventsTable.entityId, encerradas), eq(historyEventsTable.action, "operation.status.archived")))
          .orderBy(desc(historyEventsTable.createdAt))
      : [];
    const itens = operations.map((operation) => {
      const reason = eventos.find((evento) => evento.entityId === operation.id)?.metadata?.["reason"];
      const dados = prontidao.get(operation.id)!;
      return {
        id: operation.id,
        name: operation.name,
        description: operation.description,
        clientName: operation.clientName,
        color: operation.color,
        icon: operation.icon,
        status: operation.status,
        archivedAt: operation.archivedAt,
        activatedAt: operation.activatedAt,
        modulesReviewedAt: operation.modulesReviewedAt,
        archivedReason: typeof reason === "string" ? reason : null,
        peopleCount: dados.accessCount,
        locationIds: links.filter((link) => link.operationId === operation.id).map((link) => link.locationId),
        readiness: dados.readiness,
      };
    });
    itens.sort((a, b) => Number(a.status === "ARCHIVED") - Number(b.status === "ARCHIVED") || a.name.localeCompare(b.name, "pt-BR"));
    res.json({
      canManage: req.user!.role === "ADMIN",
      operations: itens,
      locations: locations.map((location) => ({ ...location, operationId: donoDoLocal.get(location.id) ?? null })),
    });
  } catch (err) {
    log.error({ err }, "Error building operations overview");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui carregar as operações agora." });
  }
});

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

    const operation = await db.transaction(async (tx) => {
      const [created] = await tx
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
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: "operation.created",
        title: "Operação criada",
        narrative: `Operação \"${created!.name}\" criada como rascunho.`,
        entityType: "operation",
        entityId: created!.id,
        actorId: req.user!.sub,
        operationId: created!.id,
        orgId: req.user!.organizationId,
        afterState: { name: created!.name, status: created!.status },
      }, tx as any);
      return created!;
    });

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_CREATED",
      targetResource: `operation:${operation.id}`,
      metadata: { name, status: "DRAFT" },
    });

    log.info({ operationId: operation.id }, "Operation created");
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
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada." });
      return;
    }
    if (operation.status === "ARCHIVED") {
      res.status(409).json({ error: "OPERATION_ARCHIVED", message: "Esta operação está encerrada. Reabra-a antes de editar." });
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

    const updated = await db.transaction(async (tx) => {
      const [persisted] = await tx
        .update(operationsTable)
        .set(updates as any)
        .where(eq(operationsTable.id, id))
        .returning();
      const changed = Object.keys(updates).filter((key) => key !== "updatedAt");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: "operation.updated",
        title: "Operação atualizada",
        narrative: `Campos atualizados: ${changed.map((key) => CAMPO_PT[key] ?? key).join(", ") || "nenhum"}.`,
        entityType: "operation",
        entityId: id,
        actorId: req.user!.sub,
        operationId: id,
        orgId: req.user!.organizationId,
        beforeState: { name: operation.name, description: operation.description, clientName: operation.clientName, color: operation.color, lateThresholdMinutes: operation.lateThresholdMinutes, timezone: operation.timezone },
        afterState: { name: persisted!.name, description: persisted!.description, clientName: persisted!.clientName, color: persisted!.color, lateThresholdMinutes: persisted!.lateThresholdMinutes, timezone: persisted!.timezone },
        metadata: { changedFields: changed },
      }, tx as any);
      return persisted!;
    });

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { changedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
    });

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
  const { status, reason } = req.body as { status?: string; reason?: string };

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
    const isReopening = operation.status === "ARCHIVED" && targetStatus !== "ARCHIVED";
    const isClosing = targetStatus === "ARCHIVED" && operation.status !== "ARCHIVED";
    const statusReason = isReopening
      ? requireReason(res, reason, "reabrir uma operação encerrada")
      : isClosing
        ? requireReason(res, reason, "encerrar uma operação")
        : normalizeReason(reason);
    if ((isReopening || isClosing) && !statusReason) return;

    if (!canTransitionOperation(operation.status, targetStatus)) {
      res.status(409).json({
        error: "INVALID_OPERATION_TRANSITION",
        message: `Não é possível alterar a operação de ${operation.status} para ${targetStatus}.`,
      });
      return;
    }

    // A casa não fica sem operação ativa: o perfil de cada pessoa é gravado em cada operação ativa.
    if (operation.status === "ACTIVE" && targetStatus !== "ACTIVE") {
      const [outra] = await db.select({ id: operationsTable.id }).from(operationsTable)
        .where(and(eq(operationsTable.organizationId, req.user!.organizationId), eq(operationsTable.status, "ACTIVE"), ne(operationsTable.id, id))).limit(1);
      if (!outra) {
        res.status(409).json({
          error: "LAST_ACTIVE_OPERATION",
          message: `"${operation.name}" é a única operação ativa. Ative outra antes de ${targetStatus === "ARCHIVED" ? "encerrar" : "pausar"} esta, senão a casa fica sem escala nem acessos.`,
        });
        return;
      }
    }

    if (targetStatus === "ACTIVE") {
      const readiness = await getOperationReadiness(operation);
      if (!readiness.ready) {
        res.status(409).json({
          error: "OPERATION_NOT_READY",
          message: "A operação ainda não está pronta para ativar. Veja o que falta no checklist.",
          readiness,
        });
        return;
      }
    }

    const now = new Date();
    const isActivation = targetStatus === "ACTIVE" && operation.status !== "ACTIVE";
    const updated = await db.transaction(async (tx) => {
      const [persisted] = await tx
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
      const acessoDado = isActivation ? await darAcessoAosExistentes(tx, req.user!.organizationId, id) : 0;
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: `operation.status.${targetStatus.toLowerCase()}`,
        title: isClosing ? "Operação encerrada" : isReopening ? "Operação reaberta" : "Situação da operação alterada",
        narrative: `Operação "${operation.name}": de ${STATUS_PT[operation.status]} para ${STATUS_PT[targetStatus]}${statusReason ? `. Motivo: ${statusReason}` : ""}${acessoDado ? `. ${acessoDado} ${acessoDado === 1 ? "pessoa ganhou" : "pessoas ganharam"} acesso automático.` : "."}`,
        entityType: "operation",
        entityId: id,
        actorId: req.user!.sub,
        operationId: id,
        orgId: req.user!.organizationId,
        metadata: { reason: statusReason, fromStatus: operation.status, toStatus: targetStatus },
        beforeState: { status: operation.status },
        afterState: { status: persisted!.status },
      }, tx as any);
      return persisted!;
    });

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { from: operation.status, to: targetStatus, reason: statusReason },
    });

    log.info({ operationId: id, from: operation.status, to: targetStatus }, "Operation status changed");
    // Quem mais da Administração e da Direção precisa saber, sem abrir a tela: um aviso por mudança.
    if (operation.status !== targetStatus) {
      const quem = (await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.user!.sub) }))?.fullName ?? "A Administração";
      const verbo = isClosing ? "encerrou" : isReopening ? "reabriu" : targetStatus === "ACTIVE" ? "ativou" : targetStatus === "PAUSED" ? "pausou" : "mudou";
      await avisar(
        await gestoresParaAvisar(req.user!.organizationId, req.user!.sub),
        `Operação ${STATUS_PT[targetStatus]}: ${operation.name}`,
        `${quem} ${verbo} a operação ${operation.name}${statusReason ? `. Motivo: ${statusReason}` : "."}`,
        id,
      );
    }
    res.json({ operation: updated });
  } catch (err) {
    log.error({ err }, "Error updating operation status");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui mudar a situação da operação agora. Nada foi alterado; tente de novo." });
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
    const updated = await db.transaction(async (tx) => {
      const [persisted] = await tx
        .update(operationsTable)
        .set({
          modulesReviewedAt: req.body.reviewed ? now : null,
          modulesReviewedBy: req.body.reviewed ? req.user!.sub : null,
          updatedAt: now,
        })
        .where(eq(operationsTable.id, id))
        .returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: "operation.setup_reviewed",
        title: req.body.reviewed ? "Módulos da operação revisados" : "Revisão dos módulos desmarcada",
        narrative: req.body.reviewed
          ? "Administração confirmou a revisão dos módulos da operação."
          : "Administração retirou a confirmação de revisão dos módulos.",
        entityType: "operation",
        entityId: id,
        actorId: req.user!.sub,
        operationId: id,
        orgId: req.user!.organizationId,
        beforeState: { reviewed: Boolean(operation.modulesReviewedAt) },
        afterState: { reviewed: Boolean(persisted!.modulesReviewedAt) },
      }, tx as any);
      return persisted!;
    });

    await recordAudit({
      actorId: req.user!.sub,
      action: "OPERATION_UPDATED",
      targetResource: `operation:${id}`,
      metadata: { relatedModulesReviewed: req.body.reviewed },
    });

    res.json({ operation: updated, readiness: await getOperationReadiness(updated!) });
  },
);

/**
 * Dá acesso a várias pessoas de uma vez: cada uma ganha, nesta operação, o mesmo perfil que já tem na casa
 * (Elenco continua Elenco, Supervisão continua Supervisão). Quem ainda não tem perfil nenhum fica de fora, com o porquê.
 */
router.post("/operations/:id/access", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const userIds: string[] | null = Array.isArray(req.body?.userIds) && req.body.userIds.every((v: unknown) => typeof v === "string")
    ? [...new Set<string>(req.body.userIds)] : null;
  if (!userIds || userIds.length === 0) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Marque pelo menos uma pessoa." });
    return;
  }
  try {
    const organizationId = req.user!.organizationId;
    const operation = await getOperationInOrganization(id, organizationId);
    if (!operation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada." });
      return;
    }
    if (operation.status === "ARCHIVED") {
      res.status(409).json({ error: "OPERATION_ARCHIVED", message: "Esta operação está encerrada. Reabra-a antes de dar acesso." });
      return;
    }

    const pessoas = await db.select({ id: usersTable.id, nome: usersTable.fullName, status: usersTable.status })
      .from(usersTable).where(and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, organizationId)));
    const ativas = pessoas.filter((pessoa) => pessoa.status === "ACTIVE");
    if (ativas.length !== userIds.length) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Só pessoas ativas desta casa podem receber acesso. Atualize a lista e tente de novo." });
      return;
    }

    const resultado = await db.transaction(async (tx) => {
      const papeis = await tx.select({ userId: userRolesTable.userId, role: userRolesTable.role, operationId: userRolesTable.operationId, groupId: userRolesTable.groupId })
        .from(userRolesTable)
        .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
        .where(and(inArray(userRolesTable.userId, userIds), eq(userRolesTable.active, true), eq(operationsTable.organizationId, organizationId)));
      const liberadas: string[] = [], jaTinham: string[] = [], semPerfil: string[] = [];
      for (const pessoa of ativas) {
        const dela = papeis.filter((papel) => papel.userId === pessoa.id);
        const principal = [...dela].sort((a, b) => PAPEL_ORDEM.indexOf(a.role) - PAPEL_ORDEM.indexOf(b.role))[0];
        if (!principal) { semPerfil.push(pessoa.nome ?? "Pessoa"); continue; }
        if (dela.some((papel) => papel.operationId === id && papel.role === principal.role && !papel.groupId)) { jaTinham.push(pessoa.nome ?? "Pessoa"); continue; }
        await tx.insert(userRolesTable).values({ userId: pessoa.id, operationId: id, role: principal.role, active: true });
        liberadas.push(pessoa.id);
      }
      if (liberadas.length) {
        await writeHistoryEvent({
          category: "OPERATIONAL_CHANGE",
          action: "operation.access_granted",
          title: "Acesso à operação concedido",
          narrative: `${liberadas.length} ${liberadas.length === 1 ? "pessoa ganhou" : "pessoas ganharam"} acesso à operação "${operation.name}".`,
          entityType: "operation",
          entityId: id,
          actorId: req.user!.sub,
          operationId: id,
          orgId: organizationId,
          metadata: { userIds: liberadas },
        }, tx as any);
      }
      return { liberadas, jaTinham, semPerfil };
    });

    await recordAudit({ actorId: req.user!.sub, action: "OPERATION_UPDATED", targetResource: `operation:${id}`, metadata: { accessGranted: resultado.liberadas } });
    // Só quem já pode usar a operação precisa ser avisada: numa operação em configuração ela ainda nem aparece.
    if (operation.status === "ACTIVE") {
      await avisar(resultado.liberadas, `Você agora tem acesso a ${operation.name}`, `A Administração liberou o seu acesso à operação ${operation.name}. Ela já aparece nas suas telas.`, id, "operation.access");
    }
    log.info({ operationId: id, granted: resultado.liberadas.length }, "Operation access granted");
    res.json(resultado);
  } catch (err) {
    log.error({ err }, "Error granting operation access");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui dar o acesso agora. Nada foi alterado; tente de novo." });
  }
});

export default router;
