import { Router } from "express";
import { db } from "@workspace/db";
import {
  historyEventsTable,
  historyRelationsTable,
  historyNarrativesTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";

const router = Router();

// ─── GET /history ─────────────────────────────────────────────────────────────
// Admin/supervisor: full history with filters
// Filters: category, entityType, actorId, operationId, groupId, dateFrom, dateTo

router.get(
  "/history",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res): Promise<void> => {
    try {
      const {
        category,
        entityType,
        actorId,
        operationId,
        groupId,
        dateFrom,
        dateTo,
        limit = "50",
        offset = "0",
      } = req.query as Record<string, string>;

      const conds: ReturnType<typeof eq>[] = [];
      if (category)    conds.push(eq(historyEventsTable.category, category));
      if (entityType)  conds.push(eq(historyEventsTable.entityType, entityType));
      if (actorId)     conds.push(eq(historyEventsTable.actorId, actorId));
      if (operationId) conds.push(eq(historyEventsTable.operationId, operationId));
      if (groupId)     conds.push(eq(historyEventsTable.groupId, groupId));
      if (dateFrom)    conds.push(gte(historyEventsTable.occurredAt, new Date(dateFrom)));
      if (dateTo)      conds.push(lte(historyEventsTable.occurredAt, new Date(dateTo)));

      const events = await db
        .select()
        .from(historyEventsTable)
        .where(conds.length ? and(...(conds as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined)
        .orderBy(desc(historyEventsTable.occurredAt))
        .limit(Math.min(Number(limit), 200))
        .offset(Number(offset));

      res.json({ events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar histórico" });
    }
  }
);

// ─── GET /my-history ─────────────────────────────────────────────────────────
// Authenticated member: personal history (actions the user performed)

router.get("/my-history", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const { limit = "30", offset = "0" } = req.query as Record<string, string>;

    const events = await db
      .select()
      .from(historyEventsTable)
      .where(eq(historyEventsTable.actorId, userId))
      .orderBy(desc(historyEventsTable.occurredAt))
      .limit(Math.min(Number(limit), 100))
      .offset(Number(offset));

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar histórico pessoal" });
  }
});

// ─── GET /history/narratives ──────────────────────────────────────────────────
// NOTE: must be declared BEFORE /history/:eventId to avoid param conflict

router.get(
  "/history/narratives",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res): Promise<void> => {
    try {
      const {
        status,
        operationId,
        limit = "50",
        offset = "0",
      } = req.query as Record<string, string>;

      const conds: ReturnType<typeof eq>[] = [];
      if (status)      conds.push(eq(historyNarrativesTable.status, status));
      if (operationId) conds.push(eq(historyNarrativesTable.operationId, operationId));

      const narratives = await db
        .select()
        .from(historyNarrativesTable)
        .where(conds.length ? and(...(conds as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined)
        .orderBy(desc(historyNarrativesTable.createdAt))
        .limit(Math.min(Number(limit), 200))
        .offset(Number(offset));

      res.json({ narratives });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar narrativas" });
    }
  }
);

// ─── POST /history/narratives ─────────────────────────────────────────────────

router.post(
  "/history/narratives",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const {
        title,
        category = "OPERATIONAL_CHANGE",
        operationId,
        cause,
        decision,
        impact,
        resolution,
      } = req.body as {
        title?: string;
        category?: string;
        operationId?: string;
        cause?: string;
        decision?: string;
        impact?: string;
        resolution?: string;
      };

      if (!title) {
        res.status(400).json({ error: "title é obrigatório" });
        return;
      }

      const [narrative] = await db
        .insert(historyNarrativesTable)
        .values({
          title,
          category,
          operationId,
          cause: cause ?? null,
          decision: decision ?? null,
          impact: impact ?? null,
          resolution: resolution ?? null,
          status: "OPEN",
          createdBy: userId,
        })
        .returning();

      res.status(201).json({ narrative });
    } catch (err) {
      res.status(500).json({ error: "Erro ao criar narrativa" });
    }
  }
);

// ─── GET /history/narratives/:narrativeId ────────────────────────────────────

router.get(
  "/history/narratives/:narrativeId",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res): Promise<void> => {
    try {
      const narrativeId = String(req.params.narrativeId);

      const [narrative] = await db
        .select()
        .from(historyNarrativesTable)
        .where(eq(historyNarrativesTable.id, narrativeId));

      if (!narrative) {
        res.status(404).json({ error: "Narrativa não encontrada" });
        return;
      }

      // Find contextually related events (same operation, broad 14-day window)
      const sevenDaysBefore = new Date(narrative.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysAfter  = new Date(narrative.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      const events = narrative.operationId
        ? await db
            .select()
            .from(historyEventsTable)
            .where(
              and(
                eq(historyEventsTable.operationId, narrative.operationId),
                gte(historyEventsTable.occurredAt, sevenDaysBefore),
                lte(historyEventsTable.occurredAt, sevenDaysAfter)
              )
            )
            .orderBy(historyEventsTable.occurredAt)
            .limit(100)
        : [];

      res.json({ narrative, events });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar narrativa" });
    }
  }
);

// ─── PATCH /history/narratives/:narrativeId ──────────────────────────────────

router.patch(
  "/history/narratives/:narrativeId",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res): Promise<void> => {
    try {
      const narrativeId = String(req.params.narrativeId);

      const [existing] = await db
        .select({ id: historyNarrativesTable.id })
        .from(historyNarrativesTable)
        .where(eq(historyNarrativesTable.id, narrativeId));

      if (!existing) {
        res.status(404).json({ error: "Narrativa não encontrada" });
        return;
      }

      const { title, cause, decision, impact, resolution, status } = req.body as Record<string, string>;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (title      !== undefined) updates.title      = title;
      if (cause      !== undefined) updates.cause      = cause;
      if (decision   !== undefined) updates.decision   = decision;
      if (impact     !== undefined) updates.impact     = impact;
      if (resolution !== undefined) updates.resolution = resolution;
      if (status     !== undefined) updates.status     = status;

      const [updated] = await db
        .update(historyNarrativesTable)
        .set(updates as any)
        .where(eq(historyNarrativesTable.id, narrativeId))
        .returning();

      res.json({ narrative: updated });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar narrativa" });
    }
  }
);

// ─── GET /history/:eventId ───────────────────────────────────────────────────

router.get(
  "/history/:eventId",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res): Promise<void> => {
    try {
      const eventId = String(req.params.eventId);

      const [event] = await db
        .select()
        .from(historyEventsTable)
        .where(eq(historyEventsTable.id, eventId));

      if (!event) {
        res.status(404).json({ error: "Evento não encontrado" });
        return;
      }

      // All relations where this event is source or target
      const outgoing = await db
        .select()
        .from(historyRelationsTable)
        .where(eq(historyRelationsTable.sourceEventId, eventId));

      const incoming = await db
        .select()
        .from(historyRelationsTable)
        .where(eq(historyRelationsTable.targetEventId, eventId));

      // Linked event ids
      const linkedIds = [
        ...outgoing.map((r) => r.targetEventId),
        ...incoming.map((r) => r.sourceEventId),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      const linkedEvents = linkedIds.length
        ? await db
            .select()
            .from(historyEventsTable)
            .where(eq(historyEventsTable.id, linkedIds[0]!))
            .limit(20)
        : [];

      res.json({ event, outgoing, incoming, linkedEvents });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar evento de histórico" });
    }
  }
);

export default router;
