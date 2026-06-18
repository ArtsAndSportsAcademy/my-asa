import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import { agendaEventsTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";

const router: IRouter = Router();

const VALID_TYPES = ["SHOW", "REHEARSAL", "MEETING", "OPERATIONAL_BLOCK", "COLLECTIVE_VACATION"] as const;

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

router.get("/agenda/events", requireAuth, requireOrganization, async (req, res) => {
  const { operationId, type, status, from, to } = req.query as Record<string, string | undefined>;
  try {
    const conditions: ReturnType<typeof eq>[] = [];
    if (operationId) conditions.push(eq(agendaEventsTable.operationId, operationId));
    if (type) conditions.push(eq(agendaEventsTable.type, type as any));
    if (status) conditions.push(eq(agendaEventsTable.status, status as any));
    if (from) conditions.push(gte(agendaEventsTable.date, from));
    if (to) conditions.push(lte(agendaEventsTable.date, to));
    const events =
      conditions.length > 0
        ? await db.select().from(agendaEventsTable).where(and(...conditions))
        : await db.select().from(agendaEventsTable);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar eventos" });
  }
});

router.post("/agenda/events", requireAuth, requireOrganization, async (req, res) => {
  const { operationId, showBookId, groupId, type, title, date, endDate, startTime, endTime, location, notes } =
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

router.get("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar evento" });
  }
});

router.patch("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const event = await getEventOrFail(id, res);
    if (!event) return;
    if (["CANCELLED", "COMPLETED"].includes(event.status)) {
      res.status(409).json({ error: "Evento em estado terminal — não pode ser alterado" });
      return;
    }
    const { title, date, endDate, startTime, endTime, location, notes, showBookId, groupId } = req.body;
    const changedFields: string[] = [];
    if (title !== undefined && title !== event.title) changedFields.push("title");
    if (date !== undefined && date !== event.date) changedFields.push("date");
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

router.post("/agenda/events/:id/confirm", requireAuth, requireOrganization, async (req, res) => {
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

router.post("/agenda/events/:id/suspend", requireAuth, requireOrganization, async (req, res) => {
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
    const log = requestLogger("agenda", req.requestId, req.correlationId);
    log.info({ eventId: id, reason }, "Evento suspenso");
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao suspender evento" });
  }
});

router.post("/agenda/events/:id/cancel", requireAuth, requireOrganization, async (req, res) => {
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
    const log = requestLogger("agenda", req.requestId, req.correlationId);
    log.info({ eventId: id, reason }, "Evento cancelado");
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao cancelar evento" });
  }
});

router.post("/agenda/events/:id/complete", requireAuth, requireOrganization, async (req, res) => {
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

router.delete("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
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
