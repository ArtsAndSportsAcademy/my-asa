import { Router, type IRouter } from "express";
import { eq, and, inArray, gte, lte, desc, isNotNull, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scalesTable,
  scaleAllocationsTable,
  allocationCandidatesTable,
  allocationExceptionsTable,
  agendaEventsTable,
  agendaEventParticipantsTable,
  showBookRolesTable,
  showBooksTable,
  dailyBooksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { runCoverageEngine, persistEngineResult } from "../services/coverage-engine.js";
import { getNonSchedulableUserIds } from "../services/scheduling-eligibility.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { hasActiveResponsibility } from "../lib/delegation-check.js";
import { notifyMany } from "../services/notificationService.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getScaleOrFail(id: string, res: any) {
  const [scale] = await db
    .select()
    .from(scalesTable)
    .where(eq(scalesTable.id, id))
    .limit(1);
  if (!scale) {
    res.status(404).json({ error: "Escala não encontrada" });
    return null;
  }
  return scale;
}

async function buildScaleSummary(scale: typeof scalesTable.$inferSelect) {
  const [totalAllocations, exceptions] = await Promise.all([
    db.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scale.id)),
    db.select().from(allocationExceptionsTable).where(eq(allocationExceptionsTable.scaleId, scale.id)),
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

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/scales — list scales
router.get("/scales", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const { operationId, groupId, status, from, to } = req.query as Record<string, string | undefined>;

  try {
    const conditions = [];
    if (operationId) conditions.push(eq(scalesTable.operationId, operationId));
    if (groupId) conditions.push(eq(scalesTable.groupId, groupId));
    if (status) conditions.push(eq(scalesTable.status, status as any));
    if (from) conditions.push(gte(scalesTable.periodStart, from));
    if (to) conditions.push(lte(scalesTable.periodEnd, to));

    const scales = await db
      .select()
      .from(scalesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(scalesTable.createdAt));

    const summaries = await Promise.all(scales.map(buildScaleSummary));
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
  const { agendaEventId, showBookId, operationId, groupId, title, periodStart: bodyPeriodStart, periodEnd: bodyPeriodEnd } = req.body;

  if (!operationId) {
    res.status(400).json({ error: "operationId é obrigatório" });
    return;
  }
  if (!agendaEventId && (!bodyPeriodStart || !bodyPeriodEnd)) {
    res.status(400).json({ error: "Informe um evento da agenda OU um período (periodStart + periodEnd)" });
    return;
  }

  if (!MANAGER_ROLES.includes(user.role)) {
    if (!(await hasActiveResponsibility(userId, operationId, "SCALES"))) {
      res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas podem gerar escalas" });
      return;
    }
  }

  try {
    // Derivar período: evento tem prioridade se fornecido
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
      periodStart = event.date;
      periodEnd = (event as any).endDate ?? event.date;
      if (!autoTitle) autoTitle = `Escala — ${event.title}`;
    }

    if (!autoTitle) {
      autoTitle = `Escala Operacional ${periodStart}${periodEnd !== periodStart ? ` a ${periodEnd}` : ""}`;
    }

    // Criar escala (agendaEventId e showBookId são nullable)
    const [scale] = await db
      .insert(scalesTable)
      .values({
        operationId,
        groupId: groupId ?? null,
        agendaEventId: agendaEventId ?? null,
        showBookId: showBookId ?? null,
        title: autoTitle,
        periodStart,
        periodEnd,
        status: "DRAFT",
        generatedAt: new Date(),
        generatedBy: userId,
        createdBy: userId,
      })
      .returning();

    if (!scale) {
      res.status(500).json({ error: "Falha ao criar escala" });
      return;
    }

    // Motor de cobertura: apenas quando há show book E evento (escalas de show/casting)
    let engineResult = {
      totalPositions: 0,
      assignedPositions: 0,
      openPositions: 0,
      conflictPositions: 0,
    };

    if (showBookId && agendaEventId) {
      const fullResult = await runCoverageEngine(agendaEventId, showBookId, operationId, groupId);
      await persistEngineResult(scale.id, agendaEventId, fullResult);
      engineResult = {
        totalPositions: fullResult.totalPositions,
        assignedPositions: fullResult.assignedPositions,
        openPositions: fullResult.openPositions,
        conflictPositions: fullResult.conflictPositions,
      };
    }

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

// GET /api/scales/my-allocations — mobile: my allocations
router.get("/scales/my-allocations", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const userId = req.user!.sub;
  const { operationId } = req.query as Record<string, string | undefined>;

  try {
    const conditions = [eq(scaleAllocationsTable.userId, userId)];

    const rows = await db
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
        manualDate: scaleAllocationsTable.manualDate,
        manualLabel: scaleAllocationsTable.manualLabel,
        manualStartTime: scaleAllocationsTable.startTime,
        manualEndTime: scaleAllocationsTable.endTime,
      })
      .from(scaleAllocationsTable)
      .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
      .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
      .leftJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
      .where(and(...conditions));

    // Coalesce manual-entry fields (old MyASA model) over engine/agenda fields.
    const allocations = rows
      .map((r) => ({
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
      }))
      .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));

    res.json({ allocations });
  } catch (err) {
    log.error({ err }, "erro ao buscar minhas alocações");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/:id — get scale with allocations
router.get("/scales/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;

  try {
    const scale = await getScaleOrFail(id, res);
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
        .where(eq(scaleAllocationsTable.scaleId, id)),
      db
        .select()
        .from(allocationExceptionsTable)
        .where(eq(allocationExceptionsTable.scaleId, id))
        .orderBy(allocationExceptionsTable.createdAt),
    ]);

    res.json({ scale: { ...scale, allocations, exceptions } });
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas podem regenerar escalas" });
        return;
      }
    }

    if (!["DRAFT"].includes(scale.status)) {
      res.status(409).json({ error: "Apenas escalas em Rascunho podem ser regeradas" });
      return;
    }

    // Auto-gerar é um auxílio OPCIONAL sobre um fluxo majoritariamente manual:
    // só remove alocações geradas pelo motor (agendaEventId != null), preservando
    // as entradas manuais (manualDate/manualLabel, agendaEventId == null).
    await db
      .delete(scaleAllocationsTable)
      .where(
        and(
          eq(scaleAllocationsTable.scaleId, id),
          isNotNull(scaleAllocationsTable.agendaEventId)
        )
      );
    await db
      .delete(allocationExceptionsTable)
      .where(eq(allocationExceptionsTable.scaleId, id));

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

    for (const t of targets) {
      const fullResult = await runCoverageEngine(
        t.agendaEventId,
        t.showBookId,
        scale.operationId,
        scale.groupId ?? undefined
      );
      await persistEngineResult(id, t.agendaEventId, fullResult);
      engineResult.totalPositions += fullResult.totalPositions;
      engineResult.assignedPositions += fullResult.assignedPositions;
      engineResult.openPositions += fullResult.openPositions;
      engineResult.conflictPositions += fullResult.conflictPositions;
    }

    // Update generatedAt
    await db
      .update(scalesTable)
      .set({ generatedAt: new Date(), generatedBy: userId, updatedAt: new Date() })
      .where(eq(scalesTable.id, id));

    eventBus.emit("scale.regenerated", { scaleId: id, operationId: scale.operationId });

    const summary = await buildScaleSummary(scale);
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(user.sub, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }

    const patch: Partial<typeof scalesTable.$inferInsert> = { updatedAt: new Date() };
    if (title !== undefined) patch.title = title ?? scale.title;
    if (publishDeadline !== undefined) {
      patch.publishDeadline = publishDeadline ? new Date(publishDeadline) : null;
    }

    const [updated] = await db
      .update(scalesTable)
      .set(patch)
      .where(eq(scalesTable.id, id))
      .returning();

    eventBus.emit("scale.updated", { scaleId: id });
    res.json({ scale: updated });
  } catch (err) {
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }

    if (!["DRAFT"].includes(scale.status)) {
      res.status(409).json({ error: "Apenas escalas em Rascunho podem ser publicadas" });
      return;
    }

    const [updated] = await db
      .update(scalesTable)
      .set({ status: "PUBLISHED", publishedAt: new Date(), publishedBy: userId, updatedAt: new Date() })
      .where(eq(scalesTable.id, id))
      .returning();

    eventBus.emit("scale.published", { scaleId: id, operationId: scale.operationId });
    writeHistoryEvent({
      category: "SCALE", action: "published",
      title: "Escala publicada",
      narrative: "Escala publicada e disponível para os membros.",
      entityType: "scale", entityId: id,
      actorId: userId, actorType: "HUMAN",
      operationId: scale.operationId,
    }).catch(() => {});
    // notify allocated members
    db.select({ userId: scaleAllocationsTable.userId })
      .from(scaleAllocationsTable)
      .where(and(eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.status, "ASSIGNED")))
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }

    if (!["PUBLISHED", "REPUBLISHED"].includes(scale.status)) {
      res.status(409).json({ error: "Apenas escalas publicadas podem ser republicadas" });
      return;
    }

    const [updated] = await db
      .update(scalesTable)
      .set({ status: "REPUBLISHED", republishedAt: new Date(), republishedBy: userId, updatedAt: new Date() })
      .where(eq(scalesTable.id, id))
      .returning();

    eventBus.emit("scale.republished", { scaleId: id, operationId: scale.operationId });
    writeHistoryEvent({
      category: "SCALE", action: "republished",
      title: "Escala republicada",
      narrative: "Escala republicada com alterações.",
      entityType: "scale", entityId: id,
      actorId: userId, actorType: "HUMAN",
      operationId: scale.operationId,
    }).catch(() => {});
    // notify allocated members of change
    db.select({ userId: scaleAllocationsTable.userId })
      .from(scaleAllocationsTable)
      .where(and(eq(scaleAllocationsTable.scaleId, id), eq(scaleAllocationsTable.status, "ASSIGNED")))
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
    log.error({ err }, "erro ao republicar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/scales/:id/archive — archive scale
router.post("/scales/:id/archive", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;
  const userId = req.user!.sub;

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    const [updated] = await db
      .update(scalesTable)
      .set({ status: "ARCHIVED", archivedAt: new Date(), archivedBy: userId, updatedAt: new Date() })
      .where(eq(scalesTable.id, id))
      .returning();

    res.json({ scale: updated });
  } catch (err) {
    log.error({ err }, "erro ao arquivar escala");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/:id/allocations — get allocations with candidates
router.get("/scales/:id/allocations", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    const allocations = await db
      .select({
        id: scaleAllocationsTable.id,
        agendaEventId: scaleAllocationsTable.agendaEventId,
        positionId: scaleAllocationsTable.positionId,
        userId: scaleAllocationsTable.userId,
        status: scaleAllocationsTable.status,
        overrideReason: scaleAllocationsTable.overrideReason,
        notes: scaleAllocationsTable.notes,
        manualDate: scaleAllocationsTable.manualDate,
        manualLabel: scaleAllocationsTable.manualLabel,
        startTime: scaleAllocationsTable.startTime,
        endTime: scaleAllocationsTable.endTime,
        positionName: showBookRolesTable.name,
        userName: usersTable.name,
        eventDate: agendaEventsTable.date,
        eventTitle: agendaEventsTable.title,
        eventStartTime: agendaEventsTable.startTime,
        eventEndTime: agendaEventsTable.endTime,
      })
      .from(scaleAllocationsTable)
      .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
      .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
      .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
      .where(eq(scaleAllocationsTable.scaleId, id));

    // Fetch candidates per allocation
    const allocationIds = allocations.map((a) => a.id);
    const candidates =
      allocationIds.length > 0
        ? await db
            .select({
              id: allocationCandidatesTable.id,
              allocationId: allocationCandidatesTable.allocationId,
              userId: allocationCandidatesTable.userId,
              rank: allocationCandidatesTable.rank,
              eligible: allocationCandidatesTable.eligible,
              compatible: allocationCandidatesTable.compatible,
              priorityScore: allocationCandidatesTable.priorityScore,
              rejectionReason: allocationCandidatesTable.rejectionReason,
              candidateData: allocationCandidatesTable.candidateData,
              userName: usersTable.name,
            })
            .from(allocationCandidatesTable)
            .leftJoin(usersTable, eq(allocationCandidatesTable.userId, usersTable.id))
            .where(inArray(allocationCandidatesTable.allocationId, allocationIds))
        : [];

    // Administradores e membros especiais não fazem parte do elenco escalável.
    // Mesmo que existam alocações/candidatos gravados para eles (legado), deixam de
    // ser exibidos (filtro de exibição, sem apagar dados).
    const nonSchedulable = await getNonSchedulableUserIds([
      ...allocations.map((a) => a.userId),
      ...candidates.map((c) => c.userId),
    ]);

    const candidateMap: Record<string, typeof candidates> = {};
    candidates.forEach((c) => {
      if (c.userId && nonSchedulable.has(c.userId)) return;
      if (!candidateMap[c.allocationId]) candidateMap[c.allocationId] = [];
      candidateMap[c.allocationId]!.push(c);
    });

    const allocationsWithCandidates = allocations
      .filter((a) => !(a.userId && nonSchedulable.has(a.userId)))
      .map((a) => ({
        ...a,
        candidates: (candidateMap[a.id] ?? []).sort((x, y) => x.rank - y.rank),
      }));

    // Células virtuais: participantes escolhidos diretamente no evento da agenda.
    // Aparecem automaticamente na escala (composição em tempo de leitura, sem cópia/sync).
    const agendaParticipants = await db
      .select({
        eventId: agendaEventsTable.id,
        eventDate: agendaEventsTable.date,
        eventTitle: agendaEventsTable.title,
        eventStartTime: agendaEventsTable.startTime,
        eventEndTime: agendaEventsTable.endTime,
        userId: agendaEventParticipantsTable.userId,
        userName: usersTable.name,
      })
      .from(agendaEventParticipantsTable)
      .innerJoin(agendaEventsTable, eq(agendaEventParticipantsTable.eventId, agendaEventsTable.id))
      .leftJoin(usersTable, eq(agendaEventParticipantsTable.userId, usersTable.id))
      .where(
        and(
          eq(agendaEventsTable.operationId, scale.operationId),
          gte(agendaEventsTable.date, scale.periodStart),
          lte(agendaEventsTable.date, scale.periodEnd),
          ne(agendaEventsTable.status, "CANCELLED"),
        ),
      );

    const virtualRows = agendaParticipants.map((p) => ({
      id: `agp:${p.eventId}:${p.userId}`,
      agendaEventId: p.eventId,
      positionId: null,
      userId: p.userId,
      status: "AGENDA_PARTICIPANT",
      overrideReason: null,
      notes: null,
      manualDate: p.eventDate,
      manualLabel: p.eventTitle,
      startTime: p.eventStartTime,
      endTime: p.eventEndTime,
      positionName: null,
      userName: p.userName,
      eventDate: p.eventDate,
      eventTitle: p.eventTitle,
      eventStartTime: p.eventStartTime,
      eventEndTime: p.eventEndTime,
      isAgendaParticipant: true,
      candidates: [] as [],
    }));

    // Células virtuais: cast do LIVRO DO DIA publicado. Quem foi colocado num show
    // (no Livro do Dia) aparece automaticamente na escala desse dia, com o bloco do
    // show. Composição em tempo de leitura — sem cópia/sync e sem mudar o esquema.
    const dailyBookCast = await db
      .select({
        dailyBookId: dailyBooksTable.id,
        roleId: dailyBookPositionsTable.sourceRoleId,
        positionName: dailyBookPositionsTable.name,
        userId: dailyBookAssignmentsTable.userId,
        userName: usersTable.name,
        eventDate: agendaEventsTable.date,
        eventTitle: agendaEventsTable.title,
        eventStartTime: agendaEventsTable.startTime,
        eventEndTime: agendaEventsTable.endTime,
        showTitle: showBooksTable.title,
      })
      .from(dailyBookAssignmentsTable)
      .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
      .innerJoin(dailyBooksTable, eq(dailyBookAssignmentsTable.dailyBookId, dailyBooksTable.id))
      .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
      .leftJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
      .leftJoin(usersTable, eq(dailyBookAssignmentsTable.userId, usersTable.id))
      .where(
        and(
          eq(agendaEventsTable.operationId, scale.operationId),
          gte(agendaEventsTable.date, scale.periodStart),
          lte(agendaEventsTable.date, scale.periodEnd),
          inArray(dailyBooksTable.status, ["PUBLISHED", "REPUBLISHED"]),
          inArray(dailyBookAssignmentsTable.status, ["ASSIGNED", "AT_RISK"]),
          eq(dailyBookPositionsTable.isRemoved, false),
          isNotNull(dailyBookAssignmentsTable.userId),
        ),
      );

    // Dedup: se já existe uma alocação REAL para o mesmo (pessoa + data + papel),
    // não duplicar com o bloco virtual do Livro do Dia.
    const realKeys = new Set(
      allocationsWithCandidates.map(
        (a) => `${a.userId}|${a.manualDate ?? a.eventDate}|${a.positionId ?? ""}`,
      ),
    );
    const castNonSchedulable = await getNonSchedulableUserIds(
      dailyBookCast.map((c) => c.userId).filter((u): u is string => !!u),
    );

    const dailyBookRows = dailyBookCast
      .filter((c) => !!c.userId && !castNonSchedulable.has(c.userId))
      .filter((c) => !realKeys.has(`${c.userId}|${c.eventDate}|${c.roleId ?? ""}`))
      .map((c) => ({
        id: `db:${c.dailyBookId}:${c.userId}:${c.roleId ?? "x"}`,
        agendaEventId: null,
        positionId: c.roleId,
        userId: c.userId,
        status: "ASSIGNED",
        overrideReason: null,
        notes: null,
        manualDate: c.eventDate,
        manualLabel: c.showTitle ?? c.eventTitle ?? "SHOW",
        startTime: c.eventStartTime,
        endTime: c.eventEndTime,
        positionName: c.positionName,
        userName: c.userName,
        eventDate: c.eventDate,
        eventTitle: c.eventTitle,
        eventStartTime: c.eventStartTime,
        eventEndTime: c.eventEndTime,
        isDailyBookParticipant: true,
        candidates: [] as [],
      }));

    res.json({ allocations: [...allocationsWithCandidates, ...virtualRows, ...dailyBookRows] });
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
  const { memberId, date, label, startTime, endTime, notes } = req.body;

  if (!memberId || !date || !label) {
    res.status(400).json({ error: "memberId, date e label são obrigatórios" });
    return;
  }

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const [entry] = await db
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

    // Update scale totals
    await db.update(scalesTable).set({ updatedAt: new Date() }).where(eq(scalesTable.id, id));

    res.status(201).json({ entry });
  } catch (err) {
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    await db
      .delete(scaleAllocationsTable)
      .where(and(eq(scaleAllocationsTable.id, entryId), eq(scaleAllocationsTable.scaleId, id)));

    res.json({ ok: true });
  } catch (err) {
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

  if (!newUserId || !reason) {
    res.status(400).json({ error: "userId e reason são obrigatórios para override" });
    return;
  }

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;
    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }

    const [updated] = await db
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

    if (!updated) {
      res.status(404).json({ error: "Alocação não encontrada" });
      return;
    }

    // Register supervisor override exception
    await db.insert(allocationExceptionsTable).values({
      scaleId: id,
      agendaEventId: updated.agendaEventId,
      positionId: updated.positionId ?? null,
      type: "SUPERVISOR_OVERRIDE",
      reason: `Override manual pelo supervisor: ${reason}`,
      impact: "Alocação substituída manualmente",
      candidatesAnalyzed: [],
    });

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
    res.json({ allocation: enriched ?? updated });
  } catch (err) {
    log.error({ err }, "erro ao fazer override de alocação");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/scales/:id/exceptions — list exceptions
router.get("/scales/:id/exceptions", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const id = req.params["id"] as string;

  try {
    const scale = await getScaleOrFail(id, res);
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
      .where(eq(allocationExceptionsTable.scaleId, id))
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

    try {
      const scale = await getScaleOrFail(id, res);
      if (!scale) return;

      const [updated] = await db
        .update(allocationExceptionsTable)
        .set({ resolvedBy: userId, resolvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(allocationExceptionsTable.id, exceptionId),
            eq(allocationExceptionsTable.scaleId, id)
          )
        )
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Exceção não encontrada" });
        return;
      }

      res.json({ exception: updated });
    } catch (err) {
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    if (scale.status !== "DRAFT") {
      res.status(409).json({ error: "Apenas escalas em Rascunho podem ser apagadas" });
      return;
    }

    // Cascade deletes allocations/candidates/exceptions via FK onDelete: cascade
    await db.delete(allocationExceptionsTable).where(eq(allocationExceptionsTable.scaleId, id));
    await db.delete(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, id));
    await db.delete(scalesTable).where(eq(scalesTable.id, id));

    eventBus.emit("scale.deleted", { scaleId: id, operationId: scale.operationId });
    res.json({ ok: true });
  } catch (err) {
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

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(userId, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    if (scale.status === "ARCHIVED") {
      res.status(409).json({ error: "Escala arquivada não pode ser modificada" });
      return;
    }

    // Compute previous week's period (shift -7 days)
    const shiftDays = (d: string, days: number): string => {
      const dt = new Date(d + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().slice(0, 10);
    };
    const prevStart = shiftDays(scale.periodStart, -7);
    const prevEnd = shiftDays(scale.periodEnd, -7);

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
        )
      );

    const toCopy = prevEntries.filter((e) => e.manualDate);
    let copied = 0;
    if (toCopy.length > 0) {
      await db.insert(scaleAllocationsTable).values(
        toCopy.map((e) => ({
          scaleId: id,
          agendaEventId: null,
          userId: e.userId,
          status: "MANUAL_OVERRIDE" as const,
          manualDate: shiftDays(e.manualDate!, 7),
          manualLabel: e.manualLabel,
          startTime: e.startTime,
          endTime: e.endTime,
          notes: e.notes,
          overriddenBy: userId,
          overrideReason: "Duplicada da semana anterior",
        }))
      );
      copied = toCopy.length;
    }

    await db.update(scalesTable).set({ updatedAt: new Date() }).where(eq(scalesTable.id, id));

    writeHistoryEvent({
      category: "SCALE", action: "duplicated",
      title: "Escala duplicada da semana anterior",
      narrative: `${copied} entrada(s) copiada(s) da semana anterior.`,
      entityType: "scale", entityId: id,
      actorId: userId, actorType: "HUMAN",
      operationId: scale.operationId,
    }).catch(() => {});

    res.json({ ok: true, copied });
  } catch (err) {
    log.error({ err }, "erro ao duplicar semana anterior");
    res.status(500).json({ error: "Erro ao duplicar semana anterior" });
  }
});

export default router;
