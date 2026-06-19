import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import { agendaEventsTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();

const VALID_TYPES = ["SHOW", "REHEARSAL", "MEETING", "OPERATIONAL_BLOCK", "COLLECTIVE_VACATION"] as const;
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] as const;

function isManager(role: string): boolean {
  return (MANAGER_ROLES as readonly string[]).includes(role);
}

async function getEventOrFail(id: string, res: any) {
  const [event] = await db
    .select()
    .from(agendaEventsTable)
    .where(eq(agendaEventsTable.id, id))
    .limit(1);
  if (!event) {
    res.status(404).json({ error: "Evento não encontrado" });
    return null;
  }
  return event;
}

// ─── GET /agenda/events ───────────────────────────────────────────────────────
// ADMIN/SUPERVISOR: tudo da operação
// MEMBER/CAPITÃO: apenas CONFIRMED + visibility=OPERATION

router.get("/agenda/events", requireAuth, requireOrganization, async (req, res) => {
  const { operationId, type, status, from, to } = req.query as Record<string, string | undefined>;
  const userRole = req.user!.role;
  const isMgr = isManager(userRole);

  try {
    const conditions: ReturnType<typeof eq>[] = [];

    if (operationId) conditions.push(eq(agendaEventsTable.operationId, operationId));
    if (type) conditions.push(eq(agendaEventsTable.type, type as any));
    if (from) conditions.push(gte(agendaEventsTable.date, from));
    if (to) conditions.push(lte(agendaEventsTable.date, to));

    if (isMgr) {
      // Managers podem filtrar por status livremente
      if (status) conditions.push(eq(agendaEventsTable.status, status as any));
    } else {
      // MEMBER / CAPITÃO: somente CONFIRMED + OPERATION
      conditions.push(eq(agendaEventsTable.status, "CONFIRMED"));
      conditions.push(eq(agendaEventsTable.visibility, "OPERATION"));
    }

    const events =
      conditions.length > 0
        ? await db.select().from(agendaEventsTable).where(and(...conditions))
        : await db.select().from(agendaEventsTable);

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar eventos" });
  }
});

// ─── POST /agenda/events ──────────────────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.post("/agenda/events", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem criar eventos" });
    return;
  }

  const { operationId, showBookId, groupId, type, title, date, endDate, startTime, endTime, location, notes, visibility } =
    req.body;
  if (!operationId || !type || !title || !date) {
    res.status(400).json({ error: "operationId, type, title e date são obrigatórios" });
    return;
  }
  if (!VALID_TYPES.includes(type as any)) {
    res.status(400).json({ error: `type inválido. Valores: ${VALID_TYPES.join(", ")}` });
    return;
  }
  const userId = req.user!.sub;
  try {
    const [event] = await db
      .insert(agendaEventsTable)
      .values({
        operationId,
        showBookId: showBookId ?? null,
        groupId: groupId ?? null,
        type,
        title,
        date,
        endDate: endDate ?? null,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        location: location ?? null,
        notes: notes ?? null,
        status: "DRAFT",
        visibility: (visibility === "MANAGEMENT" ? "MANAGEMENT" : "OPERATION") as any,
        createdBy: userId,
      })
      .returning();
    eventBus.emit("agenda.event.created", { eventId: event!.id, operationId, type, date });
    const log = requestLogger("agenda", req.requestId, req.correlationId);
    log.info({ eventId: event!.id, type, date }, "Evento de agenda criado");
    res.status(201).json({ event });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar evento" });
  }
});

// ─── GET /agenda/events/:id ───────────────────────────────────────────────────

router.get("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const userRole = req.user!.role;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    // MEMBER só vê se o evento for CONFIRMED + OPERATION
    if (!isManager(userRole)) {
      if (event.status !== "CONFIRMED" || event.visibility !== "OPERATION") {
        res.status(404).json({ error: "Evento não encontrado" });
        return;
      }
    }
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar evento" });
  }
});

// ─── PATCH /agenda/events/:id ─────────────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.patch("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem editar eventos" });
    return;
  }

  const id = req.params.id as string;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (["CANCELLED", "COMPLETED"].includes(event.status)) {
      res.status(409).json({ error: "Evento em estado terminal — não pode ser alterado" });
      return;
    }
    const { title, date, endDate, startTime, endTime, location, notes, showBookId, groupId, visibility } = req.body;
    const changedFields: string[] = [];
    if (title !== undefined && title !== event.title) changedFields.push("title");
    if (date !== undefined && date !== event.date) changedFields.push("date");
    if (visibility !== undefined && visibility !== event.visibility) changedFields.push("visibility");
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (date !== undefined) updates.date = date;
    if (endDate !== undefined) updates.endDate = endDate;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (location !== undefined) updates.location = location;
    if (notes !== undefined) updates.notes = notes;
    if (showBookId !== undefined) updates.showBookId = showBookId;
    if (groupId !== undefined) updates.groupId = groupId;
    if (visibility !== undefined) updates.visibility = visibility === "MANAGEMENT" ? "MANAGEMENT" : "OPERATION";
    const [updated] = await db
      .update(agendaEventsTable)
      .set(updates as any)
      .where(eq(agendaEventsTable.id, id))
      .returning();
    if (changedFields.length > 0) {
      eventBus.emit("agenda.event.changed", { eventId: id, changedFields });
    }
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar evento" });
  }
});

// ─── POST /agenda/events/:id/confirm ─────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.post("/agenda/events/:id/confirm", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem confirmar eventos" });
    return;
  }

  const id = req.params.id as string;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (!["DRAFT", "SUSPENDED"].includes(event.status)) {
      res.status(409).json({ error: `Evento ${event.status} não pode ser confirmado` });
      return;
    }
    const userId = req.user!.sub;
    const [updated] = await db
      .update(agendaEventsTable)
      .set({ status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date(), updatedAt: new Date() })
      .where(eq(agendaEventsTable.id, id))
      .returning();
    eventBus.emit("agenda.event.confirmed", { eventId: id });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao confirmar evento" });
  }
});

// ─── POST /agenda/events/:id/suspend ─────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.post("/agenda/events/:id/suspend", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem suspender eventos" });
    return;
  }

  const id = req.params.id as string;
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório para suspensão" }); return; }
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (event.status !== "CONFIRMED") {
      res.status(409).json({ error: "Somente eventos CONFIRMADOS podem ser suspensos" });
      return;
    }
    const userId = req.user!.sub;
    const [updated] = await db
      .update(agendaEventsTable)
      .set({ status: "SUSPENDED", reason, suspendedBy: userId, suspendedAt: new Date(), updatedAt: new Date() })
      .where(eq(agendaEventsTable.id, id))
      .returning();
    eventBus.emit("agenda.event.changed", { eventId: id, changedFields: ["status", "reason"] });
    writeHistoryEvent({
      category: "AGENDA", action: "suspended",
      title: "Evento de agenda suspenso",
      narrative: `Evento suspenso. Motivo: ${reason}`,
      entityType: "agenda_event", entityId: id,
      actorId: userId, actorType: "HUMAN",
      operationId: updated?.operationId ?? undefined,
      metadata: { reason },
    }).catch(() => {});
    const log = requestLogger("agenda", req.requestId, req.correlationId);
    log.info({ eventId: id, reason }, "Evento suspenso");
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao suspender evento" });
  }
});

// ─── POST /agenda/events/:id/cancel ──────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.post("/agenda/events/:id/cancel", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem cancelar eventos" });
    return;
  }

  const id = req.params.id as string;
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório para cancelamento" }); return; }
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (["CANCELLED", "COMPLETED"].includes(event.status)) {
      res.status(409).json({ error: "Evento já está em estado terminal" });
      return;
    }
    const userId = req.user!.sub;
    const [updated] = await db
      .update(agendaEventsTable)
      .set({ status: "CANCELLED", reason, canceledBy: userId, canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(agendaEventsTable.id, id))
      .returning();
    eventBus.emit("agenda.event.cancelled", {
      eventId: id,
      operationId: event.operationId,
      affectedAllocationIds: [],
    });
    writeHistoryEvent({
      category: "AGENDA", action: "cancelled",
      title: "Evento de agenda cancelado",
      narrative: `Evento cancelado. Motivo: ${reason}`,
      entityType: "agenda_event", entityId: id,
      actorId: userId, actorType: "HUMAN",
      operationId: event.operationId,
      metadata: { reason },
    }).catch(() => {});
    const log = requestLogger("agenda", req.requestId, req.correlationId);
    log.info({ eventId: id, reason }, "Evento cancelado");
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao cancelar evento" });
  }
});

// ─── POST /agenda/events/:id/complete ────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.post("/agenda/events/:id/complete", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem concluir eventos" });
    return;
  }

  const id = req.params.id as string;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (event.status !== "CONFIRMED") {
      res.status(409).json({ error: "Somente eventos CONFIRMADOS podem ser marcados como realizados" });
      return;
    }
    const [updated] = await db
      .update(agendaEventsTable)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(agendaEventsTable.id, id))
      .returning();
    eventBus.emit("agenda.event.completed", { eventId: id });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao concluir evento" });
  }
});

// ─── DELETE /agenda/events/:id ────────────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.delete("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) {
    res.status(403).json({ error: "Apenas administradores e supervisores podem excluir eventos" });
    return;
  }

  const id = req.params.id as string;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (event.status !== "DRAFT") {
      res.status(409).json({ error: "Somente eventos RASCUNHO podem ser deletados" });
      return;
    }
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar evento" });
  }
});

export default router;
