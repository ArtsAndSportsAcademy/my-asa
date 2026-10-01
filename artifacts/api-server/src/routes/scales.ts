import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, isNotNull, inArray, or, isNull, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scalesTable,
  scaleAllocationsTable,
  allocationCandidatesTable,
  allocationExceptionsTable,
  agendaEventsTable,
  showBooksTable,
  showBookRolesTable,
  usersTable,
  folgasTable,
  responsibilitiesTable,
  responsibilityAssignmentsTable,
  operationsTable,
  userRolesTable,
  areasTable,
  locationsTable,
  webPushSubscriptionsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { runCoverageEngine, persistEngineResult } from "../services/coverage-engine.js";
import { resolveScaleAllocations, resolveUserRecurringAllocations } from "../services/scale-merge.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { notifyMany } from "../services/notificationService.js";
import { getActiveOperationInOrganization } from "../services/operation-lifecycle.js";
import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";
import {
  detectAndPersistScheduleConflicts,
  type PublicScheduleConflict,
} from "../services/schedule-conflicts.js";
import {
  readBaseSnapshot,
  requireExpectedVersion,
  respondWithVersionConflict,
  VersionConflictError,
  VersionedResourceNotFoundError,
  type VersionedSnapshot,
} from "../lib/versioning.js";
import { enqueueNotification, databaseNow } from "../services/undo.js";
import { hasScaleAuthority } from "../services/scale-access.js";

const router: IRouter = Router();
// ADMIN tem autoridade global; supervisores são validados por Operação abaixo.
const MANAGER_ROLES = ["ADMIN"];

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getScaleOrFail(id: string, organizationId: string, res: any) {
  const [row] = await db
    .select({ scale: scalesTable })
    .from(scalesTable)
    .innerJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id))
    .where(and(
      eq(scalesTable.id, id),
      eq(operationsTable.organizationId, organizationId),
      eq(operationsTable.status, "ACTIVE"),
    ))
    .limit(1);
  const scale = row?.scale;
  if (!scale) {
    res.status(404).json({ error: "Escala não encontrada" });
    return null;
  }
  return scale;
}

async function buildScaleSummary(scale: typeof scalesTable.$inferSelect) {
  const [totalAllocations, exceptions] = await Promise.all([
    db.select().from(scaleAllocationsTable).where(and(eq(scaleAllocationsTable.scaleId, scale.id), eq(scaleAllocationsTable.active, true))),
    db.select().from(allocationExceptionsTable).where(and(eq(allocationExceptionsTable.scaleId, scale.id), eq(allocationExceptionsTable.active, true))),
  ]);

  return {
    ...scale,
    totalAllocations: totalAllocations.length,
    assignedCount: totalAllocations.filter((a) => a.status === "ASSIGNED").length,
    openCount: totalAllocations.filter((a) => a.status === "OPEN").length,
    conflictCount: totalAllocations.filter((a) => a.status === "CONFLICT").length,
    exceptionCount: exceptions.filter((e) => !e.resolvedAt).length,
  };
}

async function buildScaleVersionSnapshot(scaleId: string, dbLike: typeof db = db): Promise<VersionedSnapshot> {
  const [scale] = await dbLike.select().from(scalesTable).where(eq(scalesTable.id, scaleId)).limit(1);
  const allocations = await dbLike.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId));
  const exceptions = await dbLike.select().from(allocationExceptionsTable).where(eq(allocationExceptionsTable.scaleId, scaleId));
  return { scale: scale ?? null, allocations, exceptions };
}

async function mutateScale<T>(
  scaleId: string,
  expectedVersion: number,
  mutate: (tx: typeof db, claimedScale: typeof scalesTable.$inferSelect) => Promise<T>,
  afterMutate?: (
    tx: typeof db,
    claimedScale: typeof scalesTable.$inferSelect,
    result: T,
  ) => Promise<void>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [claimedScale] = await tx
      .update(scalesTable)
      .set({ version: expectedVersion + 1, updatedAt: new Date() })
      .where(and(eq(scalesTable.id, scaleId), eq(scalesTable.version, expectedVersion)))
      .returning();
    if (!claimedScale) throw new VersionConflictError("Escala");
    const typedTx = tx as unknown as typeof db;
    const wasPublished = ["PUBLISHED", "REPUBLISHED"].includes(claimedScale.status);
    const previousEntries = wasPublished ? await tx.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId)).orderBy(scaleAllocationsTable.id) : [];
    const result = await mutate(typedTx, claimedScale);
    if (afterMutate) await afterMutate(typedTx, claimedScale, result);
    if (wasPublished) {
      const [current] = await tx.select().from(scalesTable).where(eq(scalesTable.id, scaleId));
      const entries = await tx.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId)).orderBy(scaleAllocationsTable.id);
      if (current && ["PUBLISHED", "REPUBLISHED"].includes(current.status) && JSON.stringify(entries) !== JSON.stringify(previousEntries)) {
        const recipients = [...new Set([...previousEntries, ...entries].filter(row => row.active && row.userId).map(row => row.userId!))];
        if (recipients.length) {
          const subscriptions = await tx.select({ userId: webPushSubscriptionsTable.userId }).from(webPushSubscriptionsTable).where(and(inArray(webPushSubscriptionsTable.userId, recipients), eq(webPushSubscriptionsTable.active, true)));
          const now = await databaseNow(tx);
          for (const userId of new Set(subscriptions.map(row => row.userId))) await enqueueNotification(tx, { userId, type: "scale.changed", title: "Escala mudou", message: "Sua escala foi alterada. Consulte o My ASA.", category: "schedule", entityType: "scale", entityId: scaleId, actionUrl: "/membro/escala", webOnly: true }, now, { deduplicationKey: `scale-change:${scaleId}:${current.version}:${userId}` });
        }
      }
    }
    return result;
  });
}

async function respondScaleVersionConflict(req: any, res: any, scaleId: string, expectedVersion: number): Promise<void> {
  const [currentScale] = await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId)).limit(1);
  if (!currentScale) {
    res.status(404).json({ error: "Escala não encontrada" });
    return;
  }
  respondWithVersionConflict(
    res,
    "Escala",
    expectedVersion,
    currentScale.version,
    await buildScaleVersionSnapshot(scaleId),
    readBaseSnapshot(req),
  );
}

async function respondScaleMutationError(err: unknown, req: any, res: any, scaleId: string, expectedVersion: number): Promise<boolean> {
  if (err instanceof VersionConflictError) {
    await respondScaleVersionConflict(req, res, scaleId, expectedVersion);
    return true;
  }
  if (err instanceof VersionedResourceNotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
}

/**
 * Alertas não podem desfazer uma gravação da Escala. Falhas no detector também
 * ficam isoladas do caminho de salvamento: a Escala continua salva e pode ser
 * consultada novamente pela rota de conflitos.
 */
async function detectScaleConflicts(
  entries: Array<{ userId: string | null; date: string | null }>,
): Promise<PublicScheduleConflict[]> {
  const conflicts = new Map<string, PublicScheduleConflict>();
  for (const entry of entries) {
    if (!entry.userId || !entry.date) continue;
    try {
      const detected = await detectAndPersistScheduleConflicts(entry.userId, entry.date);
      for (const conflict of detected) conflicts.set(conflict.id, conflict);
    } catch (error) {
      requestLogger("scale", "conflict-detector", "conflict-detector").warn({ err: error }, "detector de conflito indisponível após gravação");
    }
  }
  return [...conflicts.values()];
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/scales — list scales
router.get("/scales", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const { operationId, groupId, status, from, to } = req.query as Record<string, string | undefined>;
  const user = req.user!;

  try {
    if (!["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"].includes(user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Acesso restrito à gestão de Escalas" });
      return;
    }

    const organizationOperations = await db.query.operationsTable.findMany({
      where: and(
        eq(operationsTable.organizationId, user.organizationId),
        eq(operationsTable.status, "ACTIVE"),
      ),
    });
    const allowedOperationIds = ["ADMIN", "DIR"].includes(user.role)
      ? organizationOperations.map((operation) => operation.id)
      : (await Promise.all(
          organizationOperations.map(async (operation) => ({
            id: operation.id,
            allowed: await hasScaleAuthority(user.sub, operation.id, undefined, undefined, undefined, true),
          })),
        )).filter((operation) => operation.allowed).map((operation) => operation.id);

    if (operationId && !allowedOperationIds.includes(operationId)) {
      res.status(403).json({ error: "Forbidden", message: "Operação fora do escopo de Escalas" });
      return;
    }
    if (allowedOperationIds.length === 0) {
      res.json({ scales: [] });
      return;
    }

    const conditions = [inArray(scalesTable.operationId, allowedOperationIds)];
    if (operationId) conditions.push(eq(scalesTable.operationId, operationId));
    if (groupId) conditions.push(eq(scalesTable.groupId, groupId));
    if (status) conditions.push(eq(scalesTable.status, status as any));
    else conditions.push(ne(scalesTable.status, "ARCHIVED"));
    if (from) conditions.push(gte(scalesTable.periodStart, from));
    if (to) conditions.push(lte(scalesTable.periodEnd, to));

    const scales = await db
      .select()
      .from(scalesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(scalesTable.createdAt));

    const visibleScales = [];
    for (const scale of scales) {
      if (["ADMIN", "DIR"].includes(user.role) || await hasScaleAuthority(user.sub, scale.operationId, scale.groupId, scale.areaId, scale.locationId)) visibleScales.push(scale);
    }
    const summaries = await Promise.all(visibleScales.map(buildScaleSummary));
    res.json({ scales: summaries });
  } catch (err) {
    log.error({ err }, "erro ao listar escalas");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/generate — cria escala operacional
// agendaEventId e showBookId são completamente opcionais.
// Requer: operationId + (agendaEventId OU (periodStart + periodEnd))
router.post("/scales/generate", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const user = req.user!;
  const userId = user.sub;
  const { agendaEventId, showBookId, operationId, groupId, areaId, locationId, title, periodStart: bodyPeriodStart, periodEnd: bodyPeriodEnd } = req.body;

  if (!operationId) {
    res.status(400).json({ error: "operationId é obrigatório" });
    return;
  }
  if (!agendaEventId && (!bodyPeriodStart || !bodyPeriodEnd)) {
    res.status(400).json({ error: "Informe um evento da agenda OU um período (periodStart + periodEnd)" });
    return;
  }
  if ((areaId && !locationId) || (!areaId && locationId)) {
    res.status(400).json({ error: "areaId e locationId devem ser informados juntos" });
    return;
  }

  if (!MANAGER_ROLES.includes(user.role)) {
    if (!(await hasScaleAuthority(userId, operationId, groupId, areaId, locationId))) {
      res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas podem gerar escalas" });
      return;
    }
  }

  try {
    // Derivar período: evento tem prioridade se fornecido
    const operation = await getActiveOperationInOrganization(operationId, user.organizationId);
    if (!operation) {
      res.status(409).json({
        error: "OPERATION_NOT_ACTIVE",
        message: "A operação não existe, está em configuração ou foi arquivada.",
      });
      return;
    }

    if (areaId && locationId) {
      const [[area], [location]] = await Promise.all([
        db.select({ id: areasTable.id }).from(areasTable).where(and(eq(areasTable.id, areaId), eq(areasTable.organizationId, user.organizationId), eq(areasTable.active, true))).limit(1),
        db.select({ id: locationsTable.id }).from(locationsTable).where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, user.organizationId), eq(locationsTable.closed, false))).limit(1),
      ]);
      if (!area || !location) { res.status(403).json({ error: "Área ou local fora do escopo ativo" }); return; }
    }

    let periodStart: string = bodyPeriodStart ?? "";
    let periodEnd: string = bodyPeriodEnd ?? "";
    let autoTitle = title;

    if (agendaEventId) {
      const [event] = await db
        .select()
        .from(agendaEventsTable)
        .where(eq(agendaEventsTable.id, agendaEventId))
        .limit(1);
      if (!event) {
        res.status(404).json({ error: "Evento de agenda não encontrado" });
        return;
      }
      if (event.operationId !== operationId) {
        res.status(409).json({
          error: "OPERATION_CONTEXT_MISMATCH",
          message: "O evento selecionado pertence a outra operação.",
        });
        return;
      }
      periodStart = event.date;
      periodEnd = (event as any).endDate ?? event.date;
      if (!autoTitle) autoTitle = `Escala — ${event.title}`;
    }

    if (showBookId) {
      const showBook = await db.query.showBooksTable.findFirst({
        where: and(
          eq(showBooksTable.id, showBookId),
          eq(showBooksTable.operationId, operationId),
        ),
      });
      if (!showBook) {
        res.status(409).json({
          error: "OPERATION_CONTEXT_MISMATCH",
          message: "O Livro do Show selecionado não pertence a esta operação.",
        });
        return;
      }
    }

    if (!autoTitle) {
      autoTitle = `Escala Operacional ${periodStart}${periodEnd !== periodStart ? ` a ${periodEnd}` : ""}`;
    }

    const { scale, engineResult } = await db.transaction(async (tx) => {
      // Criar escala (agendaEventId e showBookId são nullable)
      const [createdScale] = await tx.insert(scalesTable).values({
        operationId, groupId: groupId ?? null, areaId: areaId ?? null, locationId: locationId ?? null, agendaEventId: agendaEventId ?? null,
        showBookId: showBookId ?? null, title: autoTitle, periodStart, periodEnd,
        status: "DRAFT", generatedAt: new Date(), generatedBy: userId, createdBy: userId,
      }).returning();
      if (!createdScale) throw new Error("Falha ao criar escala");

      let result = { totalPositions: 0, assignedPositions: 0, openPositions: 0, conflictPositions: 0 };
      if (showBookId && agendaEventId) {
        const fullResult = await runCoverageEngine(agendaEventId, showBookId, operationId, groupId);
        await persistEngineResult(createdScale.id, agendaEventId, fullResult, tx as any);
        result = {
          totalPositions: fullResult.totalPositions,
          assignedPositions: fullResult.assignedPositions,
          openPositions: fullResult.openPositions,
          conflictPositions: fullResult.conflictPositions,
        };
      }
      await writeHistoryEvent({
        category: "SCALE", action: "generated", title: "Escala gerada",
        narrative: `A Escala ${createdScale.title} foi gerada.`, entityType: "scale", entityId: createdScale.id,
        actorId: userId, actorType: "HUMAN", operationId, orgId: req.user!.organizationId,
        beforeState: null, afterState: { scale: createdScale, engine: result },
        metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return { scale: createdScale, engineResult: result };
    });

    eventBus.emit("scale.generated", {
      scaleId: scale.id,
      operationId,
      agendaEventId: agendaEventId ?? null,
      assignedPositions: engineResult.assignedPositions,
      openPositions: engineResult.openPositions,
    });

    const summary = await buildScaleSummary(scale);
    res.status(201).json({
      scale: summary,
      engine: engineResult,
    });
  } catch (err) {
    log.error({ err }, "erro ao gerar escala");
    res.status(500).json({ error: "Erro ao gerar escala" });
  }
});

// GET /api/scales/my-allocations — todas as operações do utilizador
router.get("/scales/my-allocations", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const userId = req.user!.sub;

  try {
    const [rows, userOps] = await Promise.all([
      db
        .select({
          id: scaleAllocationsTable.id,
          scaleId: scaleAllocationsTable.scaleId,
          agendaEventId: scaleAllocationsTable.agendaEventId,
          positionId: scaleAllocationsTable.positionId,
          status: scaleAllocationsTable.status,
          positionName: showBookRolesTable.name,
          eventTitle: agendaEventsTable.title,
          eventDate: agendaEventsTable.date,
          eventStartTime: agendaEventsTable.startTime,
          eventEndTime: agendaEventsTable.endTime,
          eventLocation: agendaEventsTable.location,
          eventType: agendaEventsTable.type,
          scaleTitle: scalesTable.title,
          scaleStatus: scalesTable.status,
          operationId: scalesTable.operationId,
          operationName: operationsTable.name,
          manualDate: scaleAllocationsTable.manualDate,
          manualLabel: scaleAllocationsTable.manualLabel,
          manualStartTime: scaleAllocationsTable.startTime,
          manualEndTime: scaleAllocationsTable.endTime,
        })
        .from(scaleAllocationsTable)
        .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
        .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
        .leftJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .leftJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id))
        .where(and(eq(scaleAllocationsTable.userId, userId), eq(scaleAllocationsTable.active, true))),
      db
        .select({ operationId: userRolesTable.operationId })
        .from(userRolesTable)
        .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true))),
    ]);

    // Coalesce manual-entry fields (old MyASA model) over engine/agenda fields.
    const realAllocations = rows.map((r) => ({
      id: r.id,
      scaleId: r.scaleId,
      agendaEventId: r.agendaEventId,
      positionId: r.positionId,
      status: r.status,
      positionName: r.positionName,
      eventTitle: r.eventTitle ?? r.manualLabel,
      eventDate: r.eventDate ?? r.manualDate,
      eventStartTime: r.eventStartTime ?? r.manualStartTime,
      eventEndTime: r.eventEndTime ?? r.manualEndTime,
      eventLocation: r.eventLocation,
      eventType: r.eventType,
      scaleTitle: r.scaleTitle,
      scaleStatus: r.scaleStatus,
      operationId: r.operationId,
      operationName: r.operationName,
    }));

    // Atividades recorrentes: janela de 7 dias atrás até 90 dias à frente.
    const operationalToday = operationalDate();
    const periodStart = shiftOperationalDate(operationalToday, -7);
    const periodEnd = shiftOperationalDate(operationalToday, 90);
    const operationIds = [...new Set(userOps.map((r) => r.operationId).filter((id): id is string => !!id))];

    const recurringRows = await resolveUserRecurringAllocations(
      userId,
      operationIds,
      periodStart,
      periodEnd,
    );

    const allocations = [...realAllocations, ...recurringRows].sort(
      (a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""),
    );

    res.json({ allocations });
  } catch (err) {
    log.error({ err }, "erro ao buscar minhas alocações");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/suggestions?operationId=&date=YYYY-MM-DD
// Rota plana (per task spec): encontra a escala activa para a operação e devolve sugestões.
// DEVE vir antes de /scales/:id para não ser capturada com id="suggestions".
router.get("/scales/suggestions", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId, date } = req.query as { operationId?: string; date?: string };

  if (!operationId || !date) {
    res.status(400).json({ error: "operationId e date são obrigatórios" });
    return;
  }

  try {
    const [scale] = await db
      .select()
      .from(scalesTable)
      .where(
        and(
          eq(scalesTable.operationId, operationId),
          lte(scalesTable.periodStart, date),
          gte(scalesTable.periodEnd, date)
        )
      )
      .orderBy(desc(scalesTable.createdAt))
      .limit(1);

    if (!scale) {
      res.json({ suggestions: [] });
      return;
    }

    const suggestions = await computeScaleSuggestions(scale, date, user.organizationId);
    res.json({ suggestions });
  } catch (err) {
    log.error({ err }, "erro ao calcular sugestões de escala (plana)");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/:id — get scale with allocations
router.get("/scales/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    const [allocations, exceptions] = await Promise.all([
      db
        .select({
          id: scaleAllocationsTable.id,
          scaleId: scaleAllocationsTable.scaleId,
          agendaEventId: scaleAllocationsTable.agendaEventId,
          positionId: scaleAllocationsTable.positionId,
          userId: scaleAllocationsTable.userId,
          status: scaleAllocationsTable.status,
          overriddenBy: scaleAllocationsTable.overriddenBy,
          overrideReason: scaleAllocationsTable.overrideReason,
          notes: scaleAllocationsTable.notes,
          createdAt: scaleAllocationsTable.createdAt,
          updatedAt: scaleAllocationsTable.updatedAt,
          positionName: showBookRolesTable.name,
          userName: usersTable.name,
        })
        .from(scaleAllocationsTable)
        .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
        .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
        .where(and(eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.active, true))),
      db
        .select()
        .from(allocationExceptionsTable)
        .where(and(eq(allocationExceptionsTable.scaleId, id), eq(allocationExceptionsTable.active, true)))
        .orderBy(allocationExceptionsTable.createdAt),
    ]);

    res.json({
      scale: { ...scale, allocations, exceptions },
      currentSnapshot: await buildScaleVersionSnapshot(id),
    });
  } catch (err) {
    log.error({ err }, "erro ao buscar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/:id/regenerate — regenerate scale (keep same scale, replace allocations)
router.post("/scales/:id/regenerate", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas podem regenerar escalas" });
        return;
      }
    }

    if (!["DRAFT"].includes(scale.status)) {
      res.status(409).json({ error: "Apenas escalas em Rascunho podem ser regeradas" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    // Determinar pares (evento, show book) a processar:
    // - escala de show: o próprio agendaEventId/showBookId da escala
    // - escala por período (modelo antigo): eventos da agenda no período da
    //   semana que possuam show book vinculado.
    const targets: { agendaEventId: string; showBookId: string }[] = [];
    if (scale.agendaEventId) {
      // Escala de show/evento: só roda o motor se houver show book vinculado;
      // caso contrário não há posições a gerar (fluxo manual).
      if (scale.showBookId) {
        targets.push({ agendaEventId: scale.agendaEventId, showBookId: scale.showBookId });
      }
    } else {
      const events = await db
        .select({
          id: agendaEventsTable.id,
          showBookId: agendaEventsTable.showBookId,
        })
        .from(agendaEventsTable)
        .where(
          and(
            eq(agendaEventsTable.operationId, scale.operationId),
            isNotNull(agendaEventsTable.showBookId),
            gte(agendaEventsTable.date, scale.periodStart),
            lte(agendaEventsTable.date, scale.periodEnd)
          )
        );
      for (const e of events) {
        if (e.showBookId) targets.push({ agendaEventId: e.id, showBookId: e.showBookId });
      }
    }

    let engineResult = {
      totalPositions: 0,
      assignedPositions: 0,
      openPositions: 0,
      conflictPositions: 0,
    };

    const engineResults: { target: { agendaEventId: string; showBookId: string }; result: Awaited<ReturnType<typeof runCoverageEngine>> }[] = [];
    for (const t of targets) {
      const fullResult = await runCoverageEngine(
        t.agendaEventId,
        t.showBookId,
        scale.operationId,
        scale.groupId ?? undefined
      );
      engineResults.push({ target: t, result: fullResult });
      engineResult.totalPositions += fullResult.totalPositions;
      engineResult.assignedPositions += fullResult.assignedPositions;
      engineResult.openPositions += fullResult.openPositions;
      engineResult.conflictPositions += fullResult.conflictPositions;
    }

    // Replacing generated children and advancing the parent version happen in
    // one transaction. Other editors cannot observe the intermediate state.
    const updatedScale = await db.transaction(async (tx) => {
      const [claimedScale] = await tx
        .update(scalesTable)
        .set({ version: expectedVersion! + 1, updatedAt: new Date() })
        .where(and(eq(scalesTable.id, id), eq(scalesTable.version, expectedVersion!)))
        .returning();
      if (!claimedScale) throw new VersionConflictError("Escala");

      // Nada é apagado: a geração anterior fica desativada, preservada no histórico
      // (mesmo padrão de "entrada manual arquivada" já usado nesta rota).
      await tx.update(scaleAllocationsTable).set({ active: false, updatedAt: new Date() }).where(
        and(eq(scaleAllocationsTable.scaleId, id), isNotNull(scaleAllocationsTable.agendaEventId), eq(scaleAllocationsTable.active, true)),
      );
      await tx.update(allocationExceptionsTable).set({ active: false, updatedAt: new Date() }).where(and(eq(allocationExceptionsTable.scaleId, id), eq(allocationExceptionsTable.active, true)));
      for (const item of engineResults) {
        await persistEngineResult(id, item.target.agendaEventId, item.result, tx as unknown as typeof db);
      }
      const [updated] = await tx
        .update(scalesTable)
        .set({ generatedAt: new Date(), generatedBy: userId })
        .where(eq(scalesTable.id, id))
        .returning();
      await writeHistoryEvent({
        category: "SCALE",
        action: "regenerated",
        title: "Escala regenerada",
        narrative: "A Escala foi regenerada.",
        entityType: "scale",
        entityId: id,
        actorId: userId,
        actorType: "HUMAN",
        operationId: scale.operationId,
        orgId: req.user!.organizationId,
        beforeState: beforeSnapshot,
        afterState: await buildScaleVersionSnapshot(id, tx as any),
      }, tx as any);
      return updated!;
    });

    eventBus.emit("scale.regenerated", { scaleId: id, operationId: scale.operationId });

    const summary = await buildScaleSummary(updatedScale);
    res.json({
      scale: summary,
      engine: {
        totalPositions: engineResult.totalPositions,
        assignedPositions: engineResult.assignedPositions,
        openPositions: engineResult.openPositions,
        conflictPositions: engineResult.conflictPositions,
      },
    });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao regenerar escala");
    res.status(500).json({ error: "Erro ao regenerar escala" });
  }
});

// PATCH /api/scales/:id — update scale metadata
router.patch("/scales/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const { title, publishDeadline } = req.body as { title?: string; publishDeadline?: string | null };
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(user.sub, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    const patch: Partial<typeof scalesTable.$inferInsert> = { updatedAt: new Date() };
    if (title !== undefined) patch.title = title ?? scale.title;
    if (publishDeadline !== undefined) {
      patch.publishDeadline = publishDeadline ? new Date(publishDeadline) : null;
    }

    const updated = await mutateScale(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(scalesTable)
        .set(patch)
        .where(eq(scalesTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedScale, next) => {
      await writeHistoryEvent({
        category: "SCALE", action: "updated", title: "Escala alterada",
        narrative: "Metadados da Escala alterados.", entityType: "scale", entityId: id,
        actorId: user.sub, actorType: "HUMAN", operationId: scale.operationId,
        orgId: req.user!.organizationId, beforeState: beforeSnapshot,
        afterState: { scale: next, snapshot: await buildScaleVersionSnapshot(id, tx) },
      }, tx as any);
    });

    eventBus.emit("scale.updated", { scaleId: id });
    res.json({ scale: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao atualizar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/:id/publish — publish scale
router.post("/scales/:id/publish", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }

    if (!["DRAFT"].includes(scale.status)) {
      res.status(409).json({ error: "Apenas escalas em Rascunho podem ser publicadas" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    const updated = await mutateScale(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(scalesTable)
        .set({ status: "PUBLISHED", publishedAt: new Date(), publishedBy: userId })
        .where(eq(scalesTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedScale, next) => {
      await writeHistoryEvent({
        category: "SCALE", action: "published",
        title: "Escala publicada",
        narrative: "Escala publicada e disponível para os membros.",
        entityType: "scale", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: scale.operationId,
        orgId: req.user!.organizationId, beforeState: beforeSnapshot,
        afterState: { scale: next, snapshot: await buildScaleVersionSnapshot(id, tx) },
      }, tx as any);
    });

    eventBus.emit("scale.published", { scaleId: id, operationId: scale.operationId });
    // notify allocated members
    db.select({ userId: scaleAllocationsTable.userId })
      .from(scaleAllocationsTable)
      .where(and(eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.status, "ASSIGNED"), eq(scaleAllocationsTable.active, true)))
      .then((rows) => {
        const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
        notifyMany(userIds, {
          type: "scale.published",
          title: "Escala publicada",
          message: `Você foi escalonado em ${scale.title ?? "uma nova escala"}.`,
          priority: "NORMAL",
          category: "schedule",
          entityType: "scale",
          entityId: id,
          actionUrl: `/(tabs)/scale`,
        });
      })
      .catch(() => {});
    res.json({ scale: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao publicar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/:id/republish — republish scale
router.post("/scales/:id/republish", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }

    if (!["PUBLISHED", "REPUBLISHED"].includes(scale.status)) {
      res.status(409).json({ error: "Apenas escalas publicadas podem ser republicadas" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    const updated = await mutateScale(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(scalesTable)
        .set({ status: "REPUBLISHED", republishedAt: new Date(), republishedBy: userId })
        .where(eq(scalesTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedScale, next) => {
      await writeHistoryEvent({
        category: "SCALE", action: "republished",
        title: "Escala republicada",
        narrative: "Escala republicada com alterações.",
        entityType: "scale", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: scale.operationId,
        orgId: req.user!.organizationId, beforeState: beforeSnapshot,
        afterState: { scale: next, snapshot: await buildScaleVersionSnapshot(id, tx) },
      }, tx as any);
    });

    eventBus.emit("scale.republished", { scaleId: id, operationId: scale.operationId });
    // notify allocated members of change
    db.select({ userId: scaleAllocationsTable.userId })
      .from(scaleAllocationsTable)
      .where(and(eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.status, "ASSIGNED"), eq(scaleAllocationsTable.active, true)))
      .then((rows) => {
        const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
        notifyMany(userIds, {
          type: "scale.republished",
          title: "Escala atualizada",
          message: `A escala ${scale.title ?? ""} foi republicada com alterações. Verifique as mudanças.`,
          priority: "IMPORTANT",
          category: "schedule",
          entityType: "scale",
          entityId: id,
          actionUrl: `/(tabs)/scale`,
        });
      })
      .catch(() => {});
    res.json({ scale: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao republicar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/:id/archive — archive scale
router.post("/scales/:id/archive", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const userId = req.user!.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    const updated = await mutateScale(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(scalesTable)
        .set({ status: "ARCHIVED", archivedAt: new Date(), archivedBy: userId })
        .where(eq(scalesTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedScale, next) => {
      await writeHistoryEvent({
        category: "SCALE", action: "archived", title: "Escala arquivada",
        narrative: "Escala arquivada.", entityType: "scale", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: scale.operationId,
        orgId: req.user!.organizationId, beforeState: beforeSnapshot,
        afterState: { scale: next, snapshot: await buildScaleVersionSnapshot(id, tx) },
      }, tx as any);
    });

    res.json({ scale: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao arquivar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/:id/allocations — get allocations with candidates
router.get("/scales/:id/allocations", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    const allocations = await resolveScaleAllocations(scale);
    res.json({ allocations });
  } catch (err) {
    log.error({ err }, "erro ao buscar alocações");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/:id/entries — criar entrada manual (sem evento de agenda)
router.post("/scales/:id/entries", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;
  const { memberId, date, label, startTime, endTime, notes } = req.body;

  if (!memberId || !date || !label) {
    res.status(400).json({ error: "memberId, date e label são obrigatórios" });
    return;
  }

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    const entry = await mutateScale(id, expectedVersion, async (tx) => {
      const [nextEntry] = await tx
        .insert(scaleAllocationsTable)
        .values({
          scaleId: id,
          agendaEventId: null,
          userId: memberId,
          status: "MANUAL_OVERRIDE",
          manualDate: date,
          manualLabel: label,
          startTime: startTime ?? null,
          endTime: endTime ?? null,
          notes: notes ?? null,
          overriddenBy: userId,
          overrideReason: "Entrada manual",
        })
        .returning();
      return nextEntry!;
    }, async (tx, _claimedScale, nextEntry) => {
      await writeHistoryEvent({
        category: "SCALE", action: "manual_entry_added",
        title: "Entrada manual adicionada à Escala",
        narrative: "Entrada manual adicionada à Escala.",
        entityType: "scale", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: scale.operationId,
        orgId: req.user!.organizationId, beforeState: beforeSnapshot,
        afterState: { entry: nextEntry, snapshot: await buildScaleVersionSnapshot(id, tx) },
      }, tx as any);
    });

    const conflicts = await detectScaleConflicts([{ userId: memberId, date }]);
    res.status(201).json({
      entry,
      version: expectedVersion + 1,
      conflicts,
      alerts: conflicts.filter((conflict) => conflict.state === "aberto"),
    });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao criar entrada manual");
    res.status(500).json({ error: "Erro ao criar entrada" });
  }
});

// DELETE /api/scales/:id/entries/:entryId — remover entrada manual
router.delete("/scales/:id/entries/:entryId", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const entryId = req.params["entryId"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    await mutateScale(id, expectedVersion, async (tx) => {
      await tx
        .update(scaleAllocationsTable)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(scaleAllocationsTable.id, entryId), eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.active, true)));
      const afterSnapshot = await buildScaleVersionSnapshot(id, tx as any);
      await writeHistoryEvent({
        category: "SCALE",
        action: "entry_archived",
        title: "Entrada manual arquivada na Escala",
        narrative: "Entrada manual arquivada sem apagar a Escala ou seu histórico.",
        entityType: "scale_allocation",
        entityId: entryId,
        actorId: userId,
        actorType: "HUMAN",
        operationId: scale.operationId,
        beforeState: beforeSnapshot,
        afterState: afterSnapshot,
      }, tx as any);
      return true;
    });

    res.json({ ok: true, version: expectedVersion + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao remover entrada");
    res.status(500).json({ error: "Erro ao remover entrada" });
  }
});

// PATCH /api/scales/:id/allocations/:allocationId — manual override
router.patch("/scales/:id/allocations/:allocationId", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string; const allocationId = req.params["allocationId"] as string;
  const userId = req.user!.sub;
  const { userId: newUserId, reason, notes } = req.body;
  let expectedVersion: number | null = null;

  if (!newUserId || !reason) {
    res.status(400).json({ error: "userId e reason são obrigatórios para override" });
    return;
  }

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;
    if (req.user!.role !== "ADMIN" && !(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    const updated = await mutateScale(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(scaleAllocationsTable)
        .set({
          userId: newUserId,
          status: "MANUAL_OVERRIDE",
          overriddenBy: userId,
          overrideReason: reason,
          notes: notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(scaleAllocationsTable.id, allocationId), eq(scaleAllocationsTable.scaleId, id)))
        .returning();
      if (!next) throw new VersionedResourceNotFoundError("Alocação");

      await tx.insert(allocationExceptionsTable).values({
        scaleId: id,
        agendaEventId: next.agendaEventId,
        positionId: next.positionId ?? null,
        type: "SUPERVISOR_OVERRIDE",
        reason: `Override manual pelo supervisor: ${reason}`,
        impact: "Alocação substituída manualmente",
        candidatesAnalyzed: [],
      });
      return next;
    });
    const afterSnapshot = await buildScaleVersionSnapshot(id);

    // Re-fetch with joins to return userName + positionName
    const [enriched] = await db
      .select({
        id: scaleAllocationsTable.id,
        scaleId: scaleAllocationsTable.scaleId,
        agendaEventId: scaleAllocationsTable.agendaEventId,
        positionId: scaleAllocationsTable.positionId,
        positionName: showBookRolesTable.name,
        userId: scaleAllocationsTable.userId,
        userName: usersTable.name,
        status: scaleAllocationsTable.status,
        overrideReason: scaleAllocationsTable.overrideReason,
        notes: scaleAllocationsTable.notes,
        createdAt: scaleAllocationsTable.createdAt,
        updatedAt: scaleAllocationsTable.updatedAt,
      })
      .from(scaleAllocationsTable)
      .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
      .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
      .where(eq(scaleAllocationsTable.id, allocationId));

    eventBus.emit("scale.allocation.overridden", { scaleId: id, allocationId, overriddenBy: userId });
    await writeHistoryEvent({
      category: "SCALE",
      action: "allocation_overridden",
      title: "Alocação substituída manualmente",
      narrative: "Uma alocação da Escala foi substituída manualmente.",
      entityType: "scale",
      entityId: id,
      actorId: userId,
      actorType: "HUMAN",
      operationId: scale.operationId,
      beforeState: beforeSnapshot,
      afterState: afterSnapshot,
    });
    res.json({ allocation: enriched ?? updated, version: expectedVersion + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao fazer override de alocação");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/:id/exceptions — list exceptions
router.get("/scales/:id/exceptions", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    const exceptions = await db
      .select({
        id: allocationExceptionsTable.id,
        scaleId: allocationExceptionsTable.scaleId,
        agendaEventId: allocationExceptionsTable.agendaEventId,
        positionId: allocationExceptionsTable.positionId,
        type: allocationExceptionsTable.type,
        reason: allocationExceptionsTable.reason,
        impact: allocationExceptionsTable.impact,
        candidatesAnalyzed: allocationExceptionsTable.candidatesAnalyzed,
        resolvedBy: allocationExceptionsTable.resolvedBy,
        resolvedAt: allocationExceptionsTable.resolvedAt,
        createdAt: allocationExceptionsTable.createdAt,
        positionName: showBookRolesTable.name,
      })
      .from(allocationExceptionsTable)
      .leftJoin(showBookRolesTable, eq(allocationExceptionsTable.positionId, showBookRolesTable.id))
      .where(and(eq(allocationExceptionsTable.scaleId, id), eq(allocationExceptionsTable.active, true)))
      .orderBy(allocationExceptionsTable.createdAt);

    res.json({ exceptions });
  } catch (err) {
    log.error({ err }, "erro ao buscar exceções");
    res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /api/scales/:id/exceptions/:exceptionId/resolve — resolve exception
router.patch(
  "/scales/:id/exceptions/:exceptionId/resolve",
  requireAuth,
  requireOrganization,
  async (req, res) => {
    const log = requestLogger("scale", req.requestId, req.correlationId);
    const id = req.params["id"] as string; const exceptionId = req.params["exceptionId"] as string;
    const userId = req.user!.sub;
    let expectedVersion: number | null = null;

    try {
      const scale = await getScaleOrFail(id, req.user!.organizationId, res);
      if (!scale) return;
      if (req.user!.role !== "ADMIN" && !(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      expectedVersion = requireExpectedVersion(req, res, "a Escala");
      if (expectedVersion === null) return;
      const beforeSnapshot = await buildScaleVersionSnapshot(id);

      const updated = await mutateScale(id, expectedVersion, async (tx) => {
        const [next] = await tx
          .update(allocationExceptionsTable)
          .set({ resolvedBy: userId, resolvedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(allocationExceptionsTable.id, exceptionId),
              eq(allocationExceptionsTable.scaleId, id)
            )
          )
          .returning();
        if (!next) throw new VersionedResourceNotFoundError("Exceção");
        return next;
      }, async (tx, _claimedScale, next) => {
        await writeHistoryEvent({
          category: "SCALE", action: "exception_resolved",
          title: "Exceção da Escala resolvida",
          narrative: "Exceção da Escala marcada como resolvida.",
          entityType: "scale", entityId: id, actorId: userId,
          actorType: "HUMAN", operationId: scale.operationId,
          orgId: req.user!.organizationId, beforeState: beforeSnapshot,
          afterState: { exception: next, snapshot: await buildScaleVersionSnapshot(id, tx) },
        }, tx as any);
      });

      res.json({ exception: updated, version: expectedVersion + 1 });
    } catch (err) {
      if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
      log.error({ err }, "erro ao resolver exceção");
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// DELETE /api/scales/:id — apagar escala em rascunho
router.delete("/scales/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    if (scale.status !== "DRAFT") {
      res.status(409).json({ error: "Apenas escalas em Rascunho podem ser apagadas" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;

    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    // Nada é apagado: alocações, candidatos e exceções ficam desativados e preservados.
    await db.transaction(async (tx) => {
      await tx.update(allocationExceptionsTable).set({ active: false, updatedAt: new Date() })
        .where(and(eq(allocationExceptionsTable.scaleId, id), eq(allocationExceptionsTable.active, true)));
      await tx.update(scaleAllocationsTable).set({ active: false, updatedAt: new Date() })
        .where(and(eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.active, true)));
      await tx.update(allocationCandidatesTable).set({ active: false })
        .where(and(eq(allocationCandidatesTable.scaleId, id), eq(allocationCandidatesTable.active, true)));
      const archived = await tx.update(scalesTable)
        .set({ status: "ARCHIVED", archivedAt: new Date(), archivedBy: userId, version: expectedVersion! + 1, updatedAt: new Date() })
        .where(and(eq(scalesTable.id, id), eq(scalesTable.version, expectedVersion!)))
        .returning({ id: scalesTable.id });
      if (archived.length === 0) throw new VersionConflictError("Escala");
      await writeHistoryEvent({
        category: "SCALE", action: "archived", title: "Escala arquivada",
        narrative: "Escala arquivada sem apagar entradas ou histórico.", entityType: "scale", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: scale.operationId, orgId: req.user!.organizationId,
        beforeState: beforeSnapshot, afterState: { scale: { ...scale, status: "ARCHIVED", version: expectedVersion! + 1 }, allocations: [], exceptions: [] },
        metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
    });

    eventBus.emit("scale.archived", { scaleId: id });
    res.json({ ok: true });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao apagar escala");
    res.status(500).json({ error: "Erro ao apagar escala" });
  }
});

// POST /api/scales/:id/duplicate-previous — copiar entradas manuais da semana anterior
router.post("/scales/:id/duplicate-previous", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasScaleAuthority(userId, scale.operationId, scale.groupId, scale.areaId, scale.locationId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "a Escala");
    if (expectedVersion === null) return;
    const beforeSnapshot = await buildScaleVersionSnapshot(id);

    // Compute previous week's period (shift -7 days)
    const prevStart = shiftOperationalDate(scale.periodStart, -7);
    const prevEnd = shiftOperationalDate(scale.periodEnd, -7);

    // Find previous-week scale for same operation
    const [prevScale] = await db
      .select()
      .from(scalesTable)
      .where(
        and(
          eq(scalesTable.operationId, scale.operationId),
          eq(scalesTable.periodStart, prevStart),
          eq(scalesTable.periodEnd, prevEnd),
        )
      )
      .orderBy(desc(scalesTable.createdAt))
      .limit(1);

    if (!prevScale) {
      res.status(404).json({ error: "Não há escala da semana anterior para esta operação" });
      return;
    }

    // Copy manual entries (those with manualDate) shifted +7 days
    const prevEntries = await db
      .select()
      .from(scaleAllocationsTable)
      .where(
        and(
          eq(scaleAllocationsTable.scaleId, prevScale.id),
          eq(scaleAllocationsTable.status, "MANUAL_OVERRIDE"),
          eq(scaleAllocationsTable.active, true),
        )
      );

    const toCopy = prevEntries.filter((e) => e.manualDate);
    const copied = await mutateScale(id, expectedVersion, async (tx) => {
      if (toCopy.length > 0) {
        await tx.insert(scaleAllocationsTable).values(
          toCopy.map((e) => ({
            scaleId: id,
            agendaEventId: null,
            userId: e.userId,
            status: "MANUAL_OVERRIDE" as const,
            manualDate: shiftOperationalDate(e.manualDate!, 7),
            manualLabel: e.manualLabel,
            startTime: e.startTime,
            endTime: e.endTime,
            notes: e.notes,
            overriddenBy: userId,
            overrideReason: "Duplicada da semana anterior",
          }))
        );
      }
      return toCopy.length;
    }, async (tx, _claimedScale, copiedCount) => {
      await writeHistoryEvent({
        category: "SCALE", action: "duplicated",
        title: "Escala duplicada da semana anterior",
        narrative: `${copiedCount} entrada(s) copiada(s) da semana anterior.`,
        entityType: "scale", entityId: id, actorId: userId,
        actorType: "HUMAN", operationId: scale.operationId,
        orgId: req.user!.organizationId, beforeState: beforeSnapshot,
        afterState: { copied: copiedCount, snapshot: await buildScaleVersionSnapshot(id, tx) },
      }, tx as any);
    });

    res.json({ ok: true, copied, version: expectedVersion + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondScaleMutationError(err, req, res, id, expectedVersion)) return;
    log.error({ err }, "erro ao duplicar semana anterior");
    res.status(500).json({ error: "Erro ao duplicar semana anterior" });
  }
});

// ─── Sugestões: helper partilhado ─────────────────────────────────────────────
function _hhmmToMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}
function _minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

async function computeScaleSuggestions(
  scale: { id: string; operationId: string },
  date: string,
  orgId: string
) {
  const allAllocations = await resolveScaleAllocations(scale as any);

  const dayAllocs = allAllocations.filter((a: any) => (a.manualDate ?? a.eventDate) === date);

  const dayFolgas = await db
    .select({ userId: folgasTable.userId })
    .from(folgasTable)
    .where(
      and(
        eq(folgasTable.operationId, scale.operationId),
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, date),
        gte(folgasTable.endDate, date)
      )
    );
  const unavailableIds = new Set(dayFolgas.map((f: any) => f.userId as string));

  const byMember = new Map<string, { userId: string; userName: string; entries: any[] }>();
  for (const a of dayAllocs) {
    if (!a.userId || unavailableIds.has(a.userId)) continue;
    if (!byMember.has(a.userId)) {
      byMember.set(a.userId, { userId: a.userId, userName: (a as any).userName ?? "", entries: [] });
    }
    byMember.get(a.userId)!.entries.push(a);
  }

  const MIN_GAP = 60;
  const membersWithGaps: Array<{ userId: string; userName: string; freeGaps: Array<{ start: string; end: string }> }> = [];

  for (const [userId, member] of byMember) {
    const ivs: { s: number; e: number }[] = [];
    let ok = true;
    for (const entry of member.entries) {
      const s = _hhmmToMin((entry as any).startTime ?? (entry as any).eventStartTime);
      const e = _hhmmToMin((entry as any).endTime ?? (entry as any).eventEndTime);
      if (s == null || e == null) { ok = false; break; }
      if (e > s) ivs.push({ s, e });
    }
    if (!ok || ivs.length === 0) continue;

    ivs.sort((a, b) => a.s - b.s);
    const merged: { s: number; e: number }[] = [];
    for (const iv of ivs) {
      const last = merged[merged.length - 1];
      if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e);
      else merged.push({ ...iv });
    }

    const gaps: Array<{ start: string; end: string }> = [];
    for (let i = 1; i < merged.length; i++) {
      const gs = merged[i - 1]!.e;
      const ge = merged[i]!.s;
      if (ge - gs >= MIN_GAP) gaps.push({ start: _minToHHMM(gs), end: _minToHHMM(ge) });
    }
    if (gaps.length > 0) membersWithGaps.push({ userId, userName: member.userName, freeGaps: gaps });
  }

  if (membersWithGaps.length === 0) return [];

  const userIds = membersWithGaps.map((m) => m.userId);
  const assignments = await db
    .select({
      memberId: responsibilityAssignmentsTable.memberId,
      responsibilityId: responsibilityAssignmentsTable.responsibilityId,
      title: responsibilitiesTable.title,
      description: responsibilitiesTable.description,
      category: responsibilitiesTable.category,
    })
    .from(responsibilityAssignmentsTable)
    .innerJoin(responsibilitiesTable, eq(responsibilityAssignmentsTable.responsibilityId, responsibilitiesTable.id))
    .where(
      and(
        inArray(responsibilityAssignmentsTable.memberId, userIds),
        eq(responsibilityAssignmentsTable.active, true),
        eq(responsibilitiesTable.active, true),
        // Escopo: org do utilizador + responsabilidades da operação ou globais (operationId IS NULL)
        eq(responsibilitiesTable.orgId, orgId),
        or(
          eq(responsibilitiesTable.operationId, scale.operationId),
          isNull(responsibilitiesTable.operationId)
        )!
      )
    );

  const respByMember = new Map<string, Array<{ id: string; title: string; description: string | null; category: string }>>();
  for (const a of assignments) {
    if (!respByMember.has(a.memberId)) respByMember.set(a.memberId, []);
    respByMember.get(a.memberId)!.push({
      id: a.responsibilityId,
      title: a.title,
      description: a.description,
      category: a.category,
    });
  }

  return membersWithGaps.map((m) => ({
    userId: m.userId,
    userName: m.userName,
    freeGaps: m.freeGaps,
    responsibilities: respByMember.get(m.userId) ?? [],
  }));
}

// GET /api/scales/:id/suggestions?date=YYYY-MM-DD
// Retorna membros com tempo livre e as suas responsabilidades activas para a data indicada.
// Membros indisponíveis (folga ACTIVE) são excluídos pelo servidor.
router.get("/scales/:id/suggestions", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const user = req.user!;
  const id = req.params["id"] as string;
  const { date } = req.query as { date?: string };

  if (!date) {
    res.status(400).json({ error: "date é obrigatório" });
    return;
  }

  try {
    const scale = await getScaleOrFail(id, req.user!.organizationId, res);
    if (!scale) return;

    const suggestions = await computeScaleSuggestions(scale, date, user.organizationId);
    res.json({ suggestions });
  } catch (err) {
    log.error({ err }, "erro ao calcular sugestões de escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
