import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import {
  historyEventsTable,
  historyRelationsTable,
  historyNarrativesTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, or, isNull, inArray, ilike, like, type SQL } from "drizzle-orm";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { semSegredos } from "../lib/history-helper.js";

const router = Router();

/**
 * Registro de auditoria: só Administração e Direção (12-seguranca-antes-do-lancamento.md —
 * "contém o antes de tudo, é o dado mais sensível do sistema"). Sempre recortado pela organização
 * de quem pede; eventos antigos sem org_id entram pelo ator da organização.
 */
const REGISTRO_ROLES = ["ADMIN", "DIR"] as const;

function daOrganizacao(organizationId: string): SQL {
  return or(
    eq(historyEventsTable.orgId, organizationId),
    and(isNull(historyEventsTable.orgId), inArray(historyEventsTable.actorId, db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.organizationId, organizationId)))),
  )!;
}

/** Segredos nunca saem, mesmo de linhas antigas gravadas antes do filtro na escrita. */
function paraLeitura<T extends { beforeState: unknown; afterState: unknown; metadata: unknown }>(event: T): T {
  return {
    ...event,
    beforeState: semSegredos(event.beforeState as Record<string, unknown> | null),
    afterState: semSegredos(event.afterState as Record<string, unknown> | null),
    metadata: semSegredos(event.metadata as Record<string, unknown> | null) ?? {},
  };
}

// ─── GET /history ─────────────────────────────────────────────────────────────
// Filtros: category, entityType, entityId, actorId, action (prefixo), q (texto), dateFrom, dateTo

router.get(
  "/history",
  requireAuth,
  requireOrganization,
  requireRole(...REGISTRO_ROLES),
  async (req, res): Promise<void> => {
    try {
      const {
        category,
        entityType,
        entityId,
        actorId,
        action,
        q,
        operationId,
        groupId,
        dateFrom,
        dateTo,
        limit = "50",
        offset = "0",
      } = req.query as Record<string, string>;

      const conds: SQL[] = [daOrganizacao(req.user!.organizationId)];
      if (category)    conds.push(eq(historyEventsTable.category, category));
      if (entityType) {
        const tipos = entityType.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30);
        conds.push(tipos.length > 1 ? inArray(historyEventsTable.entityType, tipos) : eq(historyEventsTable.entityType, tipos[0] ?? ""));
      }
      if (entityId)    conds.push(eq(historyEventsTable.entityId, entityId));
      if (actorId)     conds.push(eq(historyEventsTable.actorId, actorId));
      if (action)      conds.push(like(historyEventsTable.action, `${action.replace(/[%_]/g, "")}%`));
      if (operationId) conds.push(eq(historyEventsTable.operationId, operationId));
      if (groupId)     conds.push(eq(historyEventsTable.groupId, groupId));
      if (dateFrom && !Number.isNaN(Date.parse(dateFrom))) conds.push(gte(historyEventsTable.occurredAt, new Date(dateFrom)));
      if (dateTo && !Number.isNaN(Date.parse(dateTo)))     conds.push(lte(historyEventsTable.occurredAt, new Date(dateTo)));
      if (q?.trim()) {
        const termo = `%${q.trim().replace(/[%_]/g, "")}%`;
        conds.push(or(ilike(historyEventsTable.title, termo), ilike(historyEventsTable.narrative, termo), ilike(historyEventsTable.actorName, termo))!);
      }

      const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const events = await db
        .select()
        .from(historyEventsTable)
        .where(and(...conds))
        .orderBy(desc(historyEventsTable.occurredAt))
        .limit(pageSize + 1)
        .offset(Math.max(Number(offset) || 0, 0));

      const pagina = events.slice(0, pageSize).map(paraLeitura);
      res.json({ events: pagina, count: pagina.length, hasMore: events.length > pageSize });
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
      .limit(Math.min(Number(limit) || 30, 100))
      .offset(Math.max(Number(offset) || 0, 0));

    res.json({ events: events.map(paraLeitura) });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar histórico pessoal" });
  }
});

// ─── GET /history/narratives ──────────────────────────────────────────────────
// NOTE: must be declared BEFORE /history/:eventId to avoid param conflict

router.get(
  "/history/narratives",
  requireAuth,
  requireOrganization,
  requireRole(...REGISTRO_ROLES),
  async (req, res): Promise<void> => {
    try {
      const {
        status,
        operationId,
        limit = "50",
        offset = "0",
      } = req.query as Record<string, string>;

      const conds: SQL[] = [eq(historyNarrativesTable.orgId, req.user!.organizationId)];
      if (status)      conds.push(eq(historyNarrativesTable.status, status));
      if (operationId) conds.push(eq(historyNarrativesTable.operationId, operationId));

      const narratives = await db
        .select()
        .from(historyNarrativesTable)
        .where(and(...conds))
        .orderBy(desc(historyNarrativesTable.createdAt))
        .limit(Math.min(Number(limit) || 50, 200))
        .offset(Math.max(Number(offset) || 0, 0));

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
  requireOrganization,
  requireRole("ADMIN"),
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
          orgId: req.user!.organizationId,
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
  requireOrganization,
  requireRole(...REGISTRO_ROLES),
  async (req, res): Promise<void> => {
    try {
      const narrativeId = String(req.params.narrativeId);

      const [narrative] = await db
        .select()
        .from(historyNarrativesTable)
        .where(and(eq(historyNarrativesTable.id, narrativeId), eq(historyNarrativesTable.orgId, req.user!.organizationId)));

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
                daOrganizacao(req.user!.organizationId),
                eq(historyEventsTable.operationId, narrative.operationId),
                gte(historyEventsTable.occurredAt, sevenDaysBefore),
                lte(historyEventsTable.occurredAt, sevenDaysAfter)
              )
            )
            .orderBy(historyEventsTable.occurredAt)
            .limit(100)
        : [];

      res.json({ narrative, events: events.map(paraLeitura) });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar narrativa" });
    }
  }
);

// ─── PATCH /history/narratives/:narrativeId ──────────────────────────────────

router.patch(
  "/history/narratives/:narrativeId",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    try {
      const narrativeId = String(req.params.narrativeId);

      const [existing] = await db
        .select({ id: historyNarrativesTable.id })
        .from(historyNarrativesTable)
        .where(and(eq(historyNarrativesTable.id, narrativeId), eq(historyNarrativesTable.orgId, req.user!.organizationId)));

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
  requireOrganization,
  requireRole(...REGISTRO_ROLES),
  async (req, res): Promise<void> => {
    try {
      const eventId = String(req.params.eventId);
      if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
        res.status(404).json({ error: "Evento não encontrado" });
        return;
      }

      const [event] = await db
        .select()
        .from(historyEventsTable)
        .where(and(eq(historyEventsTable.id, eventId), daOrganizacao(req.user!.organizationId)));

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
            .where(and(inArray(historyEventsTable.id, linkedIds.slice(0, 20)), daOrganizacao(req.user!.organizationId)))
            .limit(20)
        : [];

      res.json({ event: paraLeitura(event), outgoing, incoming, linkedEvents: linkedEvents.map(paraLeitura) });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar evento de histórico" });
    }
  }
);

export default router;
