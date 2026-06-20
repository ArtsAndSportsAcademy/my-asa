import { Router, type IRouter } from "express";
import { eq, and, inArray, gte, lte, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scalesTable,
  scaleAllocationsTable,
  allocationCandidatesTable,
  allocationExceptionsTable,
  agendaEventsTable,
  showBookRolesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { runCoverageEngine, persistEngineResult } from "../services/coverage-engine.js";
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

// POST /api/scales/generate — generate scale (showBookId opcional: apenas shows com posições)
router.post("/scales/generate", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  const user = req.user!;
  const userId = user.sub;
  const { agendaEventId, showBookId, operationId, groupId, title } = req.body;

  if (!agendaEventId || !operationId) {
    res.status(400).json({ error: "agendaEventId e operationId são obrigatórios" });
    return;
  }

  if (!MANAGER_ROLES.includes(user.role)) {
    if (!(await hasActiveResponsibility(userId, operationId, "SCALES"))) {
      res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas podem gerar escalas" });
      return;
    }
  }

  try {
    // Fetch event for period dates
    const [event] = await db
      .select()
      .from(agendaEventsTable)
      .where(eq(agendaEventsTable.id, agendaEventId))
      .limit(1);
    if (!event) {
      res.status(404).json({ error: "Evento de agenda não encontrado" });
      return;
    }

    const periodStart = event.date;
    const periodEnd = event.endDate ?? event.date;

    // Create scale
    const [scale] = await db
      .insert(scalesTable)
      .values({
        operationId,
        groupId: groupId ?? null,
        agendaEventId,
        showBookId,
        title: title ?? `Escala — ${event.title}`,
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

    // Run coverage engine only when show book is provided (shows com posições/personagens)
    let engineResult = {
      totalPositions: 0,
      assignedPositions: 0,
      openPositions: 0,
      conflictPositions: 0,
    };

    if (showBookId) {
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
      agendaEventId,
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

    const allocations = await db
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
      })
      .from(scaleAllocationsTable)
      .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
      .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
      .leftJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
      .where(and(...conditions))
      .orderBy(agendaEventsTable.date);

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
    if (!scale.agendaEventId) {
      res.status(400).json({ error: "Escala não possui agendaEventId para regenerar" });
      return;
    }

    // Delete existing allocations (cascade deletes candidates + exceptions)
    await db
      .delete(scaleAllocationsTable)
      .where(eq(scaleAllocationsTable.scaleId, id));
    await db
      .delete(allocationExceptionsTable)
      .where(eq(allocationExceptionsTable.scaleId, id));

    // Rerun engine only if show book is linked (escalas de show com posições)
    let engineResult = {
      totalPositions: 0,
      assignedPositions: 0,
      openPositions: 0,
      conflictPositions: 0,
    };

    if (scale.showBookId) {
      const fullResult = await runCoverageEngine(
        scale.agendaEventId,
        scale.showBookId,
        scale.operationId,
        scale.groupId ?? undefined
      );
      await persistEngineResult(id, scale.agendaEventId, fullResult);
      engineResult = {
        totalPositions: fullResult.totalPositions,
        assignedPositions: fullResult.assignedPositions,
        openPositions: fullResult.openPositions,
        conflictPositions: fullResult.conflictPositions,
      };
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
  const { title } = req.body;

  try {
    const scale = await getScaleOrFail(id, res);
    if (!scale) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      if (!(await hasActiveResponsibility(user.sub, scale.operationId, "SCALES"))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Escalas" });
        return;
      }
    }

    const [updated] = await db
      .update(scalesTable)
      .set({ title: title ?? scale.title, updatedAt: new Date() })
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
        positionName: showBookRolesTable.name,
        userName: usersTable.name,
      })
      .from(scaleAllocationsTable)
      .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
      .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
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

    const candidateMap: Record<string, typeof candidates> = {};
    candidates.forEach((c) => {
      if (!candidateMap[c.allocationId]) candidateMap[c.allocationId] = [];
      candidateMap[c.allocationId]!.push(c);
    });

    const allocationsWithCandidates = allocations.map((a) => ({
      ...a,
      candidates: (candidateMap[a.id] ?? []).sort((x, y) => x.rank - y.rank),
    }));

    res.json({ allocations: allocationsWithCandidates });
  } catch (err) {
    log.error({ err }, "erro ao buscar alocações");
    res.status(500).json({ error: "Erro interno" });
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

export default router;
