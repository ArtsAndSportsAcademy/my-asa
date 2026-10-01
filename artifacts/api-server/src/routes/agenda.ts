import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, or, isNull, ne, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  agendaEventsTable, agendaEventParticipantsTable, usersTable, operationsTable, userRolesTable,
  areasTable, locationsTable, areaLocalSupervisorsTable, scalesTable, scaleAllocationsTable,
  dailyBooksTable, dailyBookAssignmentsTable, dailyBookPositionsTable, dailyBookBlocksTable,
  dailyBookScenesTable, folgasTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { notifyMany } from "../services/notificationService.js";
import { normalizeReason } from "../lib/reason.js";
import { hasOperationAccess } from "../lib/authorization.service.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";

const router: IRouter = Router();

const VALID_TYPES = ["SHOW", "REHEARSAL", "MEETING", "OPERATIONAL_BLOCK", "COLLECTIVE_VACATION", "EVENTO", "EXTERNAL_SHOW", "TRAINING", "OTHER"] as const;
const MANAGER_ROLES = ["ADMIN", "DIR", "DIRECTOR", "SUPERVISOR_A", "SUPERVISOR_B"] as const;
const ORG_MANAGER_ROLES = new Set(["ADMIN", "DIR", "DIRECTOR"]);

function isManager(role: string): boolean {
  return (MANAGER_ROLES as readonly string[]).includes(role);
}

async function assertOperationAccess(
  req: any,
  res: any,
  operationId: string,
  supervisorOnly = false,
): Promise<boolean> {
  const allowed = await hasOperationAccess({
    userId: req.user.sub,
    organizationId: req.user.organizationId,
    operationId,
    supervisorOnly,
  });
  if (!allowed) {
    res.status(403).json({ error: "Forbidden", message: "Operação fora do escopo do usuário" });
    return false;
  }
  return true;
}

async function getEventOrFail(id: string, res: any, organizationId?: string) {
  const rows = await db
    .select({ event: agendaEventsTable })
    .from(agendaEventsTable)
    .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
    .where(and(eq(agendaEventsTable.id, id), organizationId ? eq(operationsTable.organizationId, organizationId) : undefined))
    .limit(1);
  const event = rows[0]?.event;
  if (!event) {
    res.status(404).json({ error: "Evento não encontrado" });
    return null;
  }
  return event;
}

// Retorna os IDs de participantes de um evento.
async function getParticipantIds(eventId: string, executor: any = db): Promise<string[]> {
  const rows: Array<{ userId: string }> = await executor
    .select({ userId: agendaEventParticipantsTable.userId })
    .from(agendaEventParticipantsTable)
    .where(eq(agendaEventParticipantsTable.eventId, eventId));
  return rows.map((r) => r.userId);
}

async function getParticipantDetails(eventId: string) {
  return db.select({ id: usersTable.id, name: usersTable.name, response: agendaEventParticipantsTable.response,
    respondedAt: agendaEventParticipantsTable.respondedAt, responseNote: agendaEventParticipantsTable.responseNote })
    .from(agendaEventParticipantsTable).innerJoin(usersTable, eq(agendaEventParticipantsTable.userId, usersTable.id))
    .where(eq(agendaEventParticipantsTable.eventId, eventId)).orderBy(asc(usersTable.name));
}

// Substitui o conjunto de participantes de um evento (delete-all + insert).
// Valida que cada usuário pertence à MESMA organização do evento (evita injeção cross-org).
async function setParticipants(eventId: string, operationId: string, userIds: string[], executor: any = db): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === "string" && id.length > 0)));
  const [op] = await executor
    .select({ organizationId: operationsTable.organizationId })
    .from(operationsTable)
    .where(eq(operationsTable.id, operationId))
    .limit(1);
  if (!op) return;
  const validIds: string[] = [];
  if (unique.length === 0) {
    await executor.delete(agendaEventParticipantsTable).where(eq(agendaEventParticipantsTable.eventId, eventId));
    return;
  }
  const validUsers: Array<{ id: string }> = await executor
    .select({ id: userRolesTable.userId })
    .from(userRolesTable)
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(
      inArray(userRolesTable.userId, unique),
      eq(userRolesTable.operationId, operationId),
      eq(userRolesTable.active, true),
      eq(usersTable.organizationId, op.organizationId),
      eq(usersTable.status, "ACTIVE"),
    ));
  validIds.push(...validUsers.map((u) => u.id));
  const existing: Array<{ userId: string }> = await executor.select({ userId: agendaEventParticipantsTable.userId })
    .from(agendaEventParticipantsTable).where(eq(agendaEventParticipantsTable.eventId, eventId));
  const validSet = new Set(validIds);
  const existingSet = new Set(existing.map((row) => row.userId));
  for (const row of existing) {
    if (!validSet.has(row.userId)) {
      await executor.delete(agendaEventParticipantsTable).where(and(eq(agendaEventParticipantsTable.eventId, eventId), eq(agendaEventParticipantsTable.userId, row.userId)));
    }
  }
  const added = validIds.filter((userId) => !existingSet.has(userId));
  if (added.length) await executor.insert(agendaEventParticipantsTable).values(added.map((userId) => ({ eventId, userId })));
}

async function canManageEvent(req: any, event: typeof agendaEventsTable.$inferSelect): Promise<boolean> {
  if (ORG_MANAGER_ROLES.has(req.user.role)) return true;
  if (!req.user.role.startsWith("SUPERVISOR")) return false;
  const operationAllowed = await hasOperationAccess({
    userId: req.user.sub,
    organizationId: req.user.organizationId,
    operationId: event.operationId,
    supervisorOnly: true,
  });
  if (!operationAllowed) return false;
  if (!event.areaId) return false;
  const scopes = await listAreaLocalScopes(req.user.sub, req.user.organizationId);
  return scopes.some((scope) => scope.areaId === event.areaId && (!event.locationId || scope.locationId === event.locationId));
}

function inDateWindow(date: string | null | undefined, from: string, to: string) {
  return Boolean(date && date >= from && date <= to);
}

router.get("/agenda/journey", requireAuth, requireOrganization, async (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : new Date().toISOString().slice(0, 10);
  const to = typeof req.query.to === "string" ? req.query.to : from;
  const requestedPersonId = typeof req.query.personId === "string" ? req.query.personId : req.user!.sub;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || to > "9999-12-31") {
    res.status(400).json({ error: "Informe um intervalo de datas válido" });
    return;
  }

  try {
    const isOrgManager = ORG_MANAGER_ROLES.has(req.user!.role);
    const [person] = await db.select({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId })
      .from(usersTable)
      .where(and(eq(usersTable.id, requestedPersonId), eq(usersTable.organizationId, req.user!.organizationId), eq(usersTable.status, "ACTIVE")))
      .limit(1);
    if (!person) { res.status(404).json({ error: "Pessoa não encontrada" }); return; }
    if (!isOrgManager && req.user!.role.startsWith("SUPERVISOR")) {
      const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
      if (!person.areaId || !scopes.some((scope) => scope.areaId === person.areaId)) {
        res.status(403).json({ error: "Pessoa fora da sua área" });
        return;
      }
    } else if (!isOrgManager && requestedPersonId !== req.user!.sub) {
      res.status(403).json({ error: "Você só pode consultar sua própria jornada" });
      return;
    }

    const events: Array<Record<string, unknown>> = [];
    const operationIds = (await db.select({ id: operationsTable.id }).from(operationsTable)
      .where(eq(operationsTable.organizationId, req.user!.organizationId))).map((operation) => operation.id);
    if (operationIds.length) {
      const [allocations, leaves, books, invited] = await Promise.all([
        db.select({
          id: scaleAllocationsTable.id, date: scaleAllocationsTable.manualDate, label: scaleAllocationsTable.manualLabel,
          startTime: scaleAllocationsTable.startTime, endTime: scaleAllocationsTable.endTime,
          status: scaleAllocationsTable.status, eventDate: agendaEventsTable.date, eventTitle: agendaEventsTable.title,
          eventStart: agendaEventsTable.startTime, eventEnd: agendaEventsTable.endTime, scaleStart: scalesTable.periodStart,
          operationName: operationsTable.name,
        }).from(scaleAllocationsTable)
          .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
          .innerJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id))
          .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
          .where(and(
            eq(scaleAllocationsTable.userId, requestedPersonId), eq(scaleAllocationsTable.active, true),
            inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
            inArray(scalesTable.operationId, operationIds), lte(scalesTable.periodStart, to), gte(scalesTable.periodEnd, from),
          )),
        db.select().from(folgasTable).where(and(
          eq(folgasTable.userId, requestedPersonId), eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, to), gte(folgasTable.endDate, from),
        )),
        db.select({
          assignmentId: dailyBookAssignmentsTable.id, eventId: agendaEventsTable.id, title: agendaEventsTable.title,
          date: agendaEventsTable.date, startTime: dailyBookBlocksTable.startTime, endTime: dailyBookBlocksTable.endTime,
          status: dailyBooksTable.status, operationName: operationsTable.name, positionName: dailyBookPositionsTable.name,
          blockName: dailyBookBlocksTable.name,
        }).from(dailyBookAssignmentsTable)
          .innerJoin(dailyBooksTable, eq(dailyBookAssignmentsTable.dailyBookId, dailyBooksTable.id))
          .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
          .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
          .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
          .leftJoin(dailyBookBlocksTable, eq(dailyBookPositionsTable.blockId, dailyBookBlocksTable.id))
          .leftJoin(dailyBookScenesTable, eq(dailyBookBlocksTable.sceneId, dailyBookScenesTable.id))
          .where(and(
            eq(dailyBookAssignmentsTable.userId, requestedPersonId),
            ne(dailyBookAssignmentsTable.status, "REMOVED"), isNull(dailyBookAssignmentsTable.supersededAt),
            inArray(dailyBooksTable.status, ["PUBLISHED", "REPUBLISHED"]),
            inArray(agendaEventsTable.operationId, operationIds), gte(agendaEventsTable.date, from), lte(agendaEventsTable.date, to),
            eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
            or(isNull(dailyBookBlocksTable.id), eq(dailyBookBlocksTable.isRemoved, false)),
            or(isNull(dailyBookBlocksTable.id), isNull(dailyBookBlocksTable.supersededAt)),
            or(isNull(dailyBookScenesTable.id), eq(dailyBookScenesTable.isRemoved, false)),
            or(isNull(dailyBookScenesTable.id), isNull(dailyBookScenesTable.supersededAt)),
          )),
        db.select({ event: agendaEventsTable, response: agendaEventParticipantsTable.response })
          .from(agendaEventParticipantsTable).innerJoin(agendaEventsTable, eq(agendaEventParticipantsTable.eventId, agendaEventsTable.id))
          .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
          .where(and(eq(agendaEventParticipantsTable.userId, requestedPersonId),
            inArray(agendaEventsTable.status, ["CONFIRMED", "PROPOSED", "REJECTED"]),
            gte(agendaEventsTable.date, from), lte(agendaEventsTable.date, to),
            eq(operationsTable.organizationId, req.user!.organizationId))),
      ]);

      for (const row of allocations) {
        const date = row.date ?? row.eventDate ?? row.scaleStart;
        if (!inDateWindow(date, from, to)) continue;
        events.push({
          id: `scale:${row.id}`, source: "SCALE", sourceId: row.id, title: row.label ?? row.eventTitle ?? "Compromisso de escala",
          date, startTime: row.startTime ?? row.eventStart, endTime: row.endTime ?? row.eventEnd, status: row.status,
          operationName: row.operationName,
        });
      }
      for (const row of leaves) events.push({
        id: `leave:${row.id}`, source: "LEAVE", sourceId: row.id, title: row.type === "DAY_OFF" ? "Folga" : row.type,
        date: row.startDate, endDate: row.endDate, startTime: null, endTime: null, status: row.status, notes: row.notes,
      });
      for (const row of books) events.push({
        id: `book:${row.assignmentId}`, source: "DAILY_BOOK", sourceId: row.eventId,
        title: row.title, date: row.date, startTime: row.startTime, endTime: row.endTime,
        status: row.status, operationName: row.operationName, detail: [row.blockName, row.positionName].filter(Boolean).join(" · "),
      });
      for (const row of invited) events.push({
        id: `agenda:${row.event.id}`, source: "AGENDA", sourceId: row.event.id, title: row.event.title,
        date: row.event.date, startTime: row.event.startTime, endTime: row.event.endTime,
        status: row.event.status, type: row.event.type, response: row.response, location: row.event.location,
        reason: row.event.reason, alternativeDetails: row.event.alternativeDetails,
        alternativeDate: row.event.alternativeDate, alternativeStartTime: row.event.alternativeStartTime,
        alternativeEndTime: row.event.alternativeEndTime,
      });
    }
    events.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")));
    res.json({ person: { id: person.id, name: person.name, areaId: person.areaId }, from, to, events });
  } catch (err) {
    requestLogger("agenda", req.requestId, req.correlationId).error({ err }, "Falha ao compor jornada da Agenda");
    res.status(500).json({ error: "Não foi possível carregar a jornada" });
  }
});

// ─── GET /agenda/events ───────────────────────────────────────────────────────
// ADMIN/SUPERVISOR: tudo da operação
// MEMBER/CAPITÃO: apenas CONFIRMED + visibility=OPERATION

router.get("/agenda/events", requireAuth, requireOrganization, async (req, res) => {
  const { operationId, type, status, from, to } = req.query as Record<string, string | undefined>;
  const userRole = req.user!.role;
  const isMgr = isManager(userRole);

  try {
    const conditions: ReturnType<typeof eq>[] = [];

    const organizationOperations = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(eq(operationsTable.organizationId, req.user!.organizationId));
    const organizationOperationIds = organizationOperations.map((operation) => operation.id);
    const visibleOperationIds = organizationOperationIds.filter((operationId) =>
      ORG_MANAGER_ROLES.has(req.user!.role) || req.user!.operationIds.includes(operationId)
    );
    if (visibleOperationIds.length === 0) {
      res.json({ events: [] });
      return;
    }
    conditions.push(inArray(agendaEventsTable.operationId, visibleOperationIds));

    if (operationId) conditions.push(eq(agendaEventsTable.operationId, operationId));
    if (type) conditions.push(eq(agendaEventsTable.type, type as any));
    if (from) conditions.push(gte(agendaEventsTable.date, from));
    if (to) conditions.push(lte(agendaEventsTable.date, to));

    if (isMgr) {
      // Managers podem filtrar por status livremente
      if (status) conditions.push(eq(agendaEventsTable.status, status as any));
      if (req.user!.role.startsWith("SUPERVISOR")) {
        const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
        const scopeConditions = scopes.map((scope) => and(
          eq(agendaEventsTable.areaId, scope.areaId),
          or(eq(agendaEventsTable.locationId, scope.locationId), isNull(agendaEventsTable.locationId)),
        ));
        conditions.push(scopeConditions.length ? or(...scopeConditions)! : eq(agendaEventsTable.id, "00000000-0000-0000-0000-000000000000"));
      }
    } else {
      const participantRows = await db.select({ eventId: agendaEventParticipantsTable.eventId })
        .from(agendaEventParticipantsTable)
        .where(eq(agendaEventParticipantsTable.userId, req.user!.sub));
      const visibleIds = participantRows.map((row) => row.eventId);
      conditions.push(or(
        and(eq(agendaEventsTable.createdBy, req.user!.sub), inArray(agendaEventsTable.status, ["PROPOSED", "REJECTED", "CONFIRMED"])),
        and(
          eq(agendaEventsTable.status, "CONFIRMED"),
          eq(agendaEventsTable.visibility, "OPERATION"),
          visibleIds.length ? inArray(agendaEventsTable.id, visibleIds) : eq(agendaEventsTable.id, "00000000-0000-0000-0000-000000000000"),
        ),
      )!);
    }

    const events =
      conditions.length > 0
        ? await db.select().from(agendaEventsTable).where(and(...conditions))
        : await db.select().from(agendaEventsTable);

    // Anexa participantIds (somente para gestores; membros não recebem essa lista).
    let eventsOut: unknown[] = events;
    if (isMgr && events.length > 0) {
      const eventIds = events.map((e) => e.id);
      const partRows = await db
        .select({ eventId: agendaEventParticipantsTable.eventId, userId: agendaEventParticipantsTable.userId })
        .from(agendaEventParticipantsTable)
        .where(inArray(agendaEventParticipantsTable.eventId, eventIds));
      const partMap: Record<string, string[]> = {};
      for (const r of partRows) {
        (partMap[r.eventId] ??= []).push(r.userId);
      }
      eventsOut = await Promise.all(events.map(async (e) => ({ ...e, participantIds: partMap[e.id] ?? [], participants: await getParticipantDetails(e.id) })));
    } else if (events.length > 0) {
      const responses = await db.select({ eventId: agendaEventParticipantsTable.eventId, response: agendaEventParticipantsTable.response })
        .from(agendaEventParticipantsTable)
        .where(and(inArray(agendaEventParticipantsTable.eventId, events.map((e) => e.id)), eq(agendaEventParticipantsTable.userId, req.user!.sub)));
      const responseMap = new Map(responses.map((row) => [row.eventId, row.response]));
      eventsOut = events.map((e) => ({ ...e, myResponse: responseMap.get(e.id) ?? null }));
    }

    res.json({ events: eventsOut });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar eventos" });
  }
});

// ─── POST /agenda/events ──────────────────────────────────────────────────────
// Somente ADMIN / SUPERVISOR

router.post("/agenda/events/:id/decision", requireAuth, requireOrganization, async (req, res) => {
  if (!isManager(req.user!.role)) { res.status(403).json({ error: "Você não pode decidir propostas" }); return; }
  const id = req.params.id as string;
  const decision = req.body?.decision;
  if (decision !== "ACCEPT" && decision !== "REJECT") { res.status(400).json({ error: "decision deve ser ACCEPT ou REJECT" }); return; }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const alternativeDetails = typeof req.body?.alternativeDetails === "string" ? req.body.alternativeDetails.trim() : "";
  if (decision === "REJECT" && (!reason || !alternativeDetails)) {
    res.status(400).json({ error: "Negar exige um motivo e uma alternativa" }); return;
  }
  try {
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (!(await canManageEvent(req, event))) { res.status(403).json({ error: "Proposta fora do seu escopo" }); return; }
    if (event.status !== "PROPOSED") { res.status(409).json({ error: "Esta proposta já foi respondida" }); return; }
    const status = decision === "ACCEPT" ? "CONFIRMED" : "REJECTED";
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(agendaEventsTable).set({
        status, reason: decision === "REJECT" ? reason : null,
        alternativeDetails: decision === "REJECT" ? alternativeDetails : null,
        alternativeDate: decision === "REJECT" ? req.body?.alternativeDate ?? null : null,
        alternativeStartTime: decision === "REJECT" ? req.body?.alternativeStartTime ?? null : null,
        alternativeEndTime: decision === "REJECT" ? req.body?.alternativeEndTime ?? null : null,
        confirmedBy: decision === "ACCEPT" ? req.user!.sub : null,
        confirmedAt: decision === "ACCEPT" ? new Date() : null,
        updatedAt: new Date(),
      }).where(and(eq(agendaEventsTable.id, id), eq(agendaEventsTable.status, "PROPOSED"))).returning();
      if (!row) throw new Error("Proposta alterada em paralelo");
      await writeHistoryEvent({
        category: "AGENDA", action: decision === "ACCEPT" ? "proposal_accepted" : "proposal_rejected",
        title: decision === "ACCEPT" ? "Proposta de agenda aceita" : "Proposta de agenda negada",
        narrative: decision === "ACCEPT" ? `Proposta ${row.title} aceita.` : `Proposta ${row.title} negada. Motivo: ${reason}. Alternativa: ${alternativeDetails}.`,
        entityType: "agenda_event", entityId: id, actorId: req.user!.sub, operationId: row.operationId,
        orgId: req.user!.organizationId, beforeState: event, afterState: row,
        metadata: { decision, reason: reason || null, alternativeDetails: alternativeDetails || null },
      }, tx as any);
      return [row] as const;
    });
    eventBus.emit("agenda.event.changed", { eventId: id, changedFields: ["status"] });
    const notifyIds = decision === "ACCEPT" ? await getParticipantIds(id) : [event.createdBy];
    const recipients = [...new Set(notifyIds.filter((recipientId) => recipientId !== req.user!.sub))];
    if (recipients.length) void notifyMany(recipients, {
      type: decision === "ACCEPT" ? "agenda.meeting.confirmed" : "agenda.meeting.rejected",
      title: decision === "ACCEPT" ? `Reunião confirmada: ${updated.title}` : `Proposta respondida: ${updated.title}`,
      message: decision === "ACCEPT"
        ? `A reunião foi confirmada para ${updated.date}, das ${updated.startTime} às ${updated.endTime}.`
        : `A proposta não foi aprovada. Motivo: ${reason}. Alternativa: ${alternativeDetails}.`,
      priority: "NORMAL", category: "approval", entityType: "agenda_event", entityId: updated.id, actionUrl: "/agenda",
    }).catch((err) => requestLogger("agenda", req.requestId, req.correlationId).warn({ err }, "Falha ao notificar decisão de proposta"));
    res.json({ event: updated, participants: await getParticipantDetails(id) });
  } catch (err) {
    requestLogger("agenda", req.requestId, req.correlationId).error({ err }, "Falha ao decidir proposta");
    res.status(409).json({ error: "A proposta mudou antes da decisão. Atualize e tente novamente." });
  }
});

router.post("/agenda/events/:id/respond", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const response = req.body?.response;
  const responseNote = typeof req.body?.responseNote === "string" ? req.body.responseNote.trim() : "";
  if (response !== "ACCEPTED" && response !== "DECLINED") { res.status(400).json({ error: "response deve ser ACCEPTED ou DECLINED" }); return; }
  try {
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (event.type !== "MEETING" || event.status !== "CONFIRMED") { res.status(409).json({ error: "Este compromisso não aceita resposta individual" }); return; }
    const [participant] = await db.select().from(agendaEventParticipantsTable)
      .where(and(eq(agendaEventParticipantsTable.eventId, id), eq(agendaEventParticipantsTable.userId, req.user!.sub))).limit(1);
    if (!participant) { res.status(403).json({ error: "Você não foi convidada para este compromisso" }); return; }
    if (participant.response === "CALLED") { res.status(409).json({ error: "Convocação não pode ser recusada por esta tela" }); return; }
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(agendaEventParticipantsTable).set({ response, responseNote: responseNote || null, respondedAt: new Date() })
        .where(and(eq(agendaEventParticipantsTable.id, participant.id), eq(agendaEventParticipantsTable.response, "PENDING"))).returning();
      if (!updated) throw new Error("Convite já respondido");
      await writeHistoryEvent({
        category: "AGENDA", action: "invitation_responded", title: "Convite de agenda respondido",
        narrative: `${response === "ACCEPTED" ? "Aceitou" : "Recusou"} o convite ${event.title}.`,
        entityType: "agenda_event", entityId: id, actorId: req.user!.sub, operationId: event.operationId,
        orgId: req.user!.organizationId, beforeState: participant, afterState: updated,
        metadata: { response, responseNote: responseNote || null },
      }, tx as any);
    });
    if (event.createdBy !== req.user!.sub) void notifyMany([event.createdBy], {
      type: "agenda.meeting.response", title: `Resposta ao convite: ${event.title}`,
      message: `${response === "ACCEPTED" ? "Uma pessoa aceitou" : "Uma pessoa recusou"} o convite para ${event.date}.`,
      priority: "LOW", category: "approval", entityType: "agenda_event", entityId: event.id, actionUrl: "/agenda",
    }).catch((err) => requestLogger("agenda", req.requestId, req.correlationId).warn({ err }, "Falha ao notificar resposta de convite"));
    res.json({ success: true, response });
  } catch (err) {
    res.status(409).json({ error: "O convite já foi respondido. Atualize a agenda." });
  }
});

router.post("/agenda/events", requireAuth, requireOrganization, async (req, res) => {
  const role = req.user!.role;
  const isOrgManager = ORG_MANAGER_ROLES.has(role);
  const isSupervisor = role.startsWith("SUPERVISOR");
  const isMemberProposal = !isManager(role);
  if (!isOrgManager && !isSupervisor && !isMemberProposal) {
    res.status(403).json({ error: "Você não pode criar compromissos nesta agenda" });
    return;
  }

  const { operationId, showBookId, groupId, areaId, locationId, type, title, date, endDate, startTime, endTime, location, notes, visibility, participantIds } =
    req.body;
  if (!operationId || !type || !title || !date) {
    res.status(400).json({ error: "operationId, type, title e date são obrigatórios" });
    return;
  }
  if (!(["MEETING", "REHEARSAL"] as string[]).includes(type)) {
    res.status(400).json({ error: "A Agenda do Grupo D aceita reuniões e ensaios avulsos" });
    return;
  }
  if (!startTime || !endTime || endTime <= startTime) {
    res.status(400).json({ error: "Informe um horário válido de início e fim" });
    return;
  }
  if (areaId) {
    const [area] = await db.select({ id: areasTable.id }).from(areasTable)
      .where(and(eq(areasTable.id, areaId), eq(areasTable.organizationId, req.user!.organizationId), eq(areasTable.active, true))).limit(1);
    if (!area) { res.status(400).json({ error: "A área precisa estar ativa nesta organização" }); return; }
  }
  if (locationId) {
    const [locationRow] = await db.select({ id: locationsTable.id }).from(locationsTable)
      .where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, req.user!.organizationId), eq(locationsTable.closed, false))).limit(1);
    if (!locationRow) { res.status(400).json({ error: "O local precisa estar ativo nesta organização" }); return; }
  }
  if (isOrgManager) {
    const [operation] = await db.select({ id: operationsTable.id }).from(operationsTable)
      .where(and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, req.user!.organizationId))).limit(1);
    if (!operation) { res.status(404).json({ error: "Operação não encontrada" }); return; }
  } else if (isSupervisor) {
    if (!(await assertOperationAccess(req, res, operationId, true))) return;
    const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
    if (!areaId || !locationId || !scopes.some((scope) => scope.areaId === areaId && scope.locationId === locationId)) {
      res.status(403).json({ error: "Escolha uma combinação de área e local do seu escopo" });
      return;
    }
  } else {
    if (type !== "MEETING" || !req.user!.operationIds.includes(operationId)) {
      res.status(403).json({ error: "Elenco pode propor apenas reuniões em suas operações" });
      return;
    }
    const [person] = await db.select({ areaId: usersTable.areaId }).from(usersTable)
      .where(and(eq(usersTable.id, req.user!.sub), eq(usersTable.organizationId, req.user!.organizationId))).limit(1);
    if (!person?.areaId || areaId !== person.areaId) {
      res.status(403).json({ error: "A proposta precisa ficar na sua área" });
      return;
    }
  }
  if (!VALID_TYPES.includes(type as any)) {
    res.status(400).json({ error: `type inválido. Valores: ${VALID_TYPES.join(", ")}` });
    return;
  }
  const userId = req.user!.sub;
  const people = Array.isArray(participantIds) ? [...new Set(participantIds.filter((id: unknown): id is string => typeof id === "string"))] : [];
  if (isMemberProposal && !people.includes(userId)) people.push(userId);
  if (type === "REHEARSAL" && people.length === 0) {
    res.status(400).json({ error: "Ensaio precisa ter pelo menos uma pessoa convocada" }); return;
  }
  if (people.length) {
    const memberships = await db.select({ userId: userRolesTable.userId, areaId: usersTable.areaId })
      .from(userRolesTable).innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(inArray(userRolesTable.userId, people), eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true), eq(usersTable.organizationId, req.user!.organizationId), eq(usersTable.status, "ACTIVE")));
    if (new Set(memberships.map((row) => row.userId)).size !== people.length) {
      res.status(400).json({ error: "Todas as pessoas precisam pertencer à operação escolhida" }); return;
    }
    if (isSupervisor) {
      const scope = await listAreaLocalScopes(userId, req.user!.organizationId);
      const scopedAreas = new Set(scope.map((row) => row.areaId));
      if (memberships.some((row) => !row.areaId || !scopedAreas.has(row.areaId))) {
        res.status(403).json({ error: "Você só pode convocar ou convidar pessoas da sua área" }); return;
      }
    }
  }
  try {
    const event = await db.transaction(async (tx) => {
      const [created] = await tx.insert(agendaEventsTable).values({
        operationId, showBookId: showBookId ?? null, groupId: groupId ?? null,
        areaId: areaId ?? null, locationId: locationId ?? null, type, title, date,
        endDate: endDate ?? null, startTime: startTime ?? null, endTime: endTime ?? null,
        location: location ?? null, notes: notes ?? null, status: isMemberProposal ? "PROPOSED" : "DRAFT",
        visibility: (visibility === "MANAGEMENT" ? "MANAGEMENT" : "OPERATION") as any, createdBy: userId,
      }).returning();
      if (!created) throw new Error("Não foi possível criar o evento");
      if (people.length) {
        await setParticipants(created.id, operationId, people, tx);
        if (type === "REHEARSAL") await tx.update(agendaEventParticipantsTable)
          .set({ response: "CALLED", respondedAt: new Date() })
          .where(eq(agendaEventParticipantsTable.eventId, created.id));
      }
      await writeHistoryEvent({
        category: "AGENDA", action: "created", title: "Evento de agenda criado",
        narrative: `Evento ${created.title} criado para ${created.date}.`, entityType: "agenda_event", entityId: created.id,
        actorId: userId, operationId, orgId: req.user!.organizationId, beforeState: null, afterState: created,
        metadata: { reason: normalizeReason(req.body?.reason) },
      }, tx as any);
      return created;
    });
    eventBus.emit("agenda.event.created", { eventId: event!.id, operationId, type, date });
    if (isMemberProposal && areaId) {
      const supervisors = await db.select({ id: areaLocalSupervisorsTable.supervisorId })
        .from(areaLocalSupervisorsTable).innerJoin(areasTable, eq(areaLocalSupervisorsTable.areaId, areasTable.id))
        .where(and(eq(areaLocalSupervisorsTable.areaId, areaId), eq(areaLocalSupervisorsTable.active, true), eq(areasTable.organizationId, req.user!.organizationId)));
      const supervisorIds = [...new Set(supervisors.map((row) => row.id).filter((id) => id !== userId))];
      if (supervisorIds.length) void notifyMany(supervisorIds, {
        type: "agenda.meeting.proposed", title: `Nova proposta de reunião: ${event!.title}`,
        message: `Uma pessoa do elenco propôs ${event!.date} das ${event!.startTime} às ${event!.endTime}. Revise a proposta na Agenda.`,
        priority: "NORMAL", category: "approval", entityType: "agenda_event", entityId: event!.id,
        actionUrl: "/agenda",
      }).catch((err) => requestLogger("agenda", req.requestId, req.correlationId).warn({ err }, "Falha ao notificar proposta"));
    }
    const log = requestLogger("agenda", req.requestId, req.correlationId);
    log.info({ eventId: event!.id, type, date }, "Evento de agenda criado");
    const persistedParticipantIds = await getParticipantIds(event.id);
    res.status(201).json({ event: { ...event, participantIds: persistedParticipantIds } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar evento" });
  }
});

// ─── GET /agenda/events/:id ───────────────────────────────────────────────────

router.get("/agenda/events/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const userRole = req.user!.role;
  try {
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (ORG_MANAGER_ROLES.has(userRole)) {
      // Direção e Administração consultam a agenda da organização inteira.
    } else if (userRole.startsWith("SUPERVISOR")) {
      if (!(await canManageEvent(req, event))) { res.status(404).json({ error: "Evento não encontrado" }); return; }
    } else {
      if (!(await assertOperationAccess(req, res, event.operationId, false))) return;
      if (event.status !== "CONFIRMED" || event.visibility !== "OPERATION") {
        res.status(404).json({ error: "Evento não encontrado" });
        return;
      }
      const [participant] = await db.select({ id: agendaEventParticipantsTable.id }).from(agendaEventParticipantsTable)
        .where(and(eq(agendaEventParticipantsTable.eventId, id), eq(agendaEventParticipantsTable.userId, req.user!.sub))).limit(1);
      if (!participant) { res.status(404).json({ error: "Evento não encontrado" }); return; }
    }
    // participantIds somente para gestores.
    if (isManager(userRole)) {
      const participantIds = await getParticipantIds(event.id);
      res.json({ event: { ...event, participantIds } });
    } else {
      res.json({ event });
    }
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
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (!(await canManageEvent(req, event))) { res.status(403).json({ error: "Evento fora do seu escopo" }); return; }
    if (["CANCELLED", "COMPLETED"].includes(event.status)) {
      res.status(409).json({ error: "Evento em estado terminal — não pode ser alterado" });
      return;
    }
    const { title, date, endDate, startTime, endTime, location, notes, showBookId, groupId, visibility, participantIds } = req.body;
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
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(agendaEventsTable).set(updates as any)
        .where(eq(agendaEventsTable.id, id)).returning();
      if (!row) throw new Error("Evento não encontrado");
      if (Array.isArray(participantIds)) await setParticipants(id, event.operationId, participantIds, tx);
      await writeHistoryEvent({
        category: "AGENDA", action: "updated", title: "Evento de agenda atualizado",
        narrative: `Evento ${row.title} atualizado.`, entityType: "agenda_event", entityId: id,
        actorId: req.user!.sub, operationId: row.operationId, orgId: req.user!.organizationId,
        beforeState: event, afterState: row, metadata: { reason: normalizeReason(req.body?.reason), changedFields },
      }, tx as any);
      return [row] as const;
    });
    if (changedFields.length > 0) {
      eventBus.emit("agenda.event.changed", { eventId: id, changedFields });
    }
    const finalParticipantIds = await getParticipantIds(id);
    res.json({ event: { ...updated, participantIds: finalParticipantIds } });
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
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (!(await canManageEvent(req, event))) { res.status(403).json({ error: "Evento fora do seu escopo" }); return; }
    if (!["DRAFT", "SUSPENDED"].includes(event.status)) {
      res.status(409).json({ error: `Evento ${event.status} não pode ser confirmado` });
      return;
    }
    const userId = req.user!.sub;
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(agendaEventsTable)
        .set({ status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(agendaEventsTable.id, id)).returning();
      if (!row) throw new Error("Evento não encontrado");
      await writeHistoryEvent({
        category: "AGENDA", action: "confirmed", title: "Evento de agenda confirmado",
        narrative: `Evento ${row.title} confirmado.`, entityType: "agenda_event", entityId: id,
        actorId: userId, operationId: row.operationId, orgId: req.user!.organizationId,
        beforeState: event, afterState: row, metadata: { reason: normalizeReason(req.body?.reason) },
      }, tx as any);
      return [row] as const;
    });
    eventBus.emit("agenda.event.confirmed", { eventId: id });

    // Notify only the people attached to this event.
    if (updated) {
      (async () => {
        try {
          const participants = await getParticipantIds(updated.id);
          const recipients = [...new Set(participants.filter((recipientId) => recipientId !== req.user!.sub))];
          if (!recipients.length) return;
          await notifyMany(recipients, {
            type: updated.type === "REHEARSAL" ? "agenda.rehearsal.confirmed" : "agenda.meeting.confirmed",
            title: `${updated.type === "REHEARSAL" ? "Ensaio" : "Reunião"} confirmado: ${updated.title}`,
            message: `${updated.type === "REHEARSAL" ? "O ensaio foi confirmado" : "A reunião foi confirmada"} para ${updated.date}, das ${updated.startTime} às ${updated.endTime}.`,
            priority: "NORMAL",
            category: updated.type === "REHEARSAL" ? "rehearsal" : "approval",
            entityType: "agenda_event",
            entityId: updated.id,
            actionUrl: "/agenda",
          });
        } catch { /* non-critical */ }
      })();
    }

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
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (!(await canManageEvent(req, event))) { res.status(403).json({ error: "Evento fora do seu escopo" }); return; }
    if (event.status !== "CONFIRMED") {
      res.status(409).json({ error: "Somente eventos CONFIRMADOS podem ser suspensos" });
      return;
    }
    const userId = req.user!.sub;
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(agendaEventsTable)
        .set({ status: "SUSPENDED", reason, suspendedBy: userId, suspendedAt: new Date(), updatedAt: new Date() })
        .where(eq(agendaEventsTable.id, id)).returning();
      if (!row) throw new Error("Evento não encontrado");
      await writeHistoryEvent({
        category: "AGENDA", action: "suspended", title: "Evento de agenda suspenso",
        narrative: `Evento suspenso. Motivo: ${reason}`, entityType: "agenda_event", entityId: id,
        actorId: userId, operationId: row.operationId, orgId: req.user!.organizationId,
        beforeState: event, afterState: row, metadata: { reason },
      }, tx as any);
      return [row] as const;
    });
    eventBus.emit("agenda.event.changed", { eventId: id, changedFields: ["status", "reason"] });
    // Notify org members for REHEARSAL events (fire-and-forget)
    if (updated?.type === "REHEARSAL") {
      (async () => {
        try {
          const [op] = await db.select({ organizationId: operationsTable.organizationId })
            .from(operationsTable).where(eq(operationsTable.id, updated.operationId)).limit(1);
          if (op) {
            const members = await db.select({ id: usersTable.id }).from(usersTable)
              .where(eq(usersTable.organizationId, op.organizationId));
            const memberIds = members.map((m) => m.id).filter((id) => id !== userId);
            await notifyMany(memberIds, {
              type: "agenda.rehearsal.suspended",
              title: `Ensaio suspenso: ${updated.title}`,
              message: `O ensaio de ${updated.date} foi suspenso. Motivo: ${reason}`,
              priority: "IMPORTANT",
              category: "rehearsal",
              entityType: "agenda_event",
              entityId: updated.id,
              actionUrl: "/(tabs)/agenda",
            });
          }
        } catch { /* non-critical */ }
      })();
    }

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
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (!(await canManageEvent(req, event))) { res.status(403).json({ error: "Evento fora do seu escopo" }); return; }
    if (["CANCELLED", "COMPLETED"].includes(event.status)) {
      res.status(409).json({ error: "Evento já está em estado terminal" });
      return;
    }
    const userId = req.user!.sub;
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(agendaEventsTable)
        .set({ status: "CANCELLED", reason, canceledBy: userId, canceledAt: new Date(), updatedAt: new Date() })
        .where(eq(agendaEventsTable.id, id)).returning();
      if (!row) throw new Error("Evento não encontrado");
      await writeHistoryEvent({
        category: "AGENDA", action: "cancelled", title: "Evento de agenda cancelado",
        narrative: `Evento cancelado. Motivo: ${reason}`, entityType: "agenda_event", entityId: id,
        actorId: userId, operationId: row.operationId, orgId: req.user!.organizationId,
        beforeState: event, afterState: row, metadata: { reason },
      }, tx as any);
      return [row] as const;
    });
    eventBus.emit("agenda.event.cancelled", {
      eventId: id,
      operationId: event.operationId,
      affectedAllocationIds: [],
    });
    // Notify org members for REHEARSAL events (fire-and-forget)
    if (event.type === "REHEARSAL") {
      (async () => {
        try {
          const [op] = await db.select({ organizationId: operationsTable.organizationId })
            .from(operationsTable).where(eq(operationsTable.id, event.operationId)).limit(1);
          if (op) {
            const members = await db.select({ id: usersTable.id }).from(usersTable)
              .where(eq(usersTable.organizationId, op.organizationId));
            const memberIds = members.map((m) => m.id).filter((id) => id !== userId);
            await notifyMany(memberIds, {
              type: "agenda.rehearsal.cancelled",
              title: `Ensaio cancelado: ${event.title}`,
              message: `O ensaio de ${event.date} foi cancelado. Motivo: ${reason}`,
              priority: "CRITICAL",
              category: "rehearsal",
              entityType: "agenda_event",
              entityId: id,
              actionUrl: "/(tabs)/agenda",
            });
          }
        } catch { /* non-critical */ }
      })();
    }

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
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (!(await canManageEvent(req, event))) { res.status(403).json({ error: "Evento fora do seu escopo" }); return; }
    if (event.status !== "CONFIRMED") {
      res.status(409).json({ error: "Somente eventos CONFIRMADOS podem ser marcados como realizados" });
      return;
    }
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(agendaEventsTable)
        .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(agendaEventsTable.id, id)).returning();
      if (!row) throw new Error("Evento não encontrado");
      await writeHistoryEvent({
        category: "AGENDA", action: "completed", title: "Evento de agenda concluído",
        narrative: `Evento ${row.title} concluído.`, entityType: "agenda_event", entityId: id,
        actorId: req.user!.sub, operationId: row.operationId, orgId: req.user!.organizationId,
        beforeState: event, afterState: row, metadata: { reason: normalizeReason(req.body?.reason) },
      }, tx as any);
      return [row] as const;
    });
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
    const event = await getEventOrFail(id, res, req.user!.organizationId);
    if (!event) return;
    if (event.status !== "DRAFT") {
      res.status(409).json({ error: "Somente eventos RASCUNHO podem ser deletados" });
      return;
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      res.status(400).json({ error: "REASON_REQUIRED", message: "Motivo obrigatório para encerrar o evento." });
      return;
    }
    await db.transaction(async (tx) => {
      const [cancelled] = await tx.update(agendaEventsTable)
        .set({ status: "CANCELLED", reason, canceledBy: req.user!.sub, canceledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(agendaEventsTable.id, id), eq(agendaEventsTable.status, "DRAFT")))
        .returning();
      if (!cancelled) throw new Error("Evento foi alterado antes do encerramento");
      await writeHistoryEvent({
        category: "AGENDA", action: "cancelled", title: "Evento de agenda encerrado",
        narrative: `Evento encerrado. Motivo: ${reason}`, entityType: "agenda_event", entityId: id,
        actorId: req.user!.sub, operationId: cancelled.operationId, orgId: req.user!.organizationId,
        beforeState: event, afterState: cancelled, metadata: { reason },
      }, tx as any);
    });
    res.json({ success: true, status: "CANCELLED" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar evento" });
  }
});

export default router;
