import { and, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import {
  db,
  agendaEventsTable,
  agendaEventParticipantsTable,
  dailyBookAssignmentsTable,
  dailyBooksTable,
  operationsTable,
  recurringActivitiesTable,
  recurringActivityAssigneesTable,
  recurringActivitySchedulesTable,
  scaleAllocationsTable,
  scalesTable,
  sessionsTable,
  showBooksTable,
  teamMembershipsTable,
  usersTable,
  historyEventsTable,
  scheduleConflictsTable,
  type ScheduleConflict,
} from "@workspace/db";
import { normalizeReason } from "../lib/reason.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

export type ScheduleSourceType = "sessao" | "agenda" | "escala" | "atividade";
export type ScheduleConflictSeverity = "leve" | "grave";
export type ScheduleConflictState = "aberto" | "ciente" | "resolvido";

export interface ScheduleCommitment {
  userId: string;
  organizationId: string;
  date: string;
  sourceType: ScheduleSourceType;
  sourceId: string;
  label: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

export interface DetectedScheduleConflict {
  userId: string;
  organizationId: string;
  date: string;
  first: ScheduleCommitment;
  second: ScheduleCommitment;
  overlapMinutes: number;
  severity: ScheduleConflictSeverity;
}

/** Mesmo formato devolvido às telas quando a montagem ainda é uma prévia. */
export interface ProspectiveScheduleConflict {
  id: string;
  userId: string;
  personId: string;
  organizationId: string;
  date: string;
  first: PublicScheduleConflict["first"];
  second: PublicScheduleConflict["second"];
  overlapMinutes: number;
  severity: ScheduleConflictSeverity;
  state: ScheduleConflictState;
  alerting: boolean;
}

export interface PublicScheduleConflict {
  id: string;
  userId: string;
  personId: string;
  organizationId: string;
  date: string;
  first: {
    sourceType: ScheduleSourceType;
    sourceId: string;
    label: string;
    startTime: string;
    endTime: string;
  };
  second: {
    sourceType: ScheduleSourceType;
    sourceId: string;
    label: string;
    startTime: string;
    endTime: string;
  };
  overlapMinutes: number;
  severity: ScheduleConflictSeverity;
  state: ScheduleConflictState;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  acknowledgementReason: string | null;
  alerting: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ScheduleConflictReasonRequiredError extends Error {
  constructor() {
    super("Motivo obrigatório para reconhecer um conflito de horário.");
    this.name = "ScheduleConflictReasonRequiredError";
  }
}

export class ScheduleConflictNotFoundError extends Error {
  constructor() {
    super("Conflito de horário não encontrado.");
    this.name = "ScheduleConflictNotFoundError";
  }
}

export class ScheduleConflictAlreadyAcknowledgedError extends Error {
  constructor() {
    super("Este conflito já foi marcado como ciente.");
    this.name = "ScheduleConflictAlreadyAcknowledgedError";
  }
}

export class ScheduleConflictNotActiveError extends Error {
  constructor() {
    super("Somente um conflito ainda ativo pode ser reconhecido.");
    this.name = "ScheduleConflictNotActiveError";
  }
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function canonicalTime(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) throw new Error(`Horário inválido: ${value}`);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
}

function dateWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function sourceKey(commitment: Pick<ScheduleCommitment, "sourceType" | "sourceId">): string {
  return `${commitment.sourceType}:${commitment.sourceId}`;
}

function pairKey(conflict: Pick<DetectedScheduleConflict, "userId" | "date" | "first" | "second">): string {
  return [
    conflict.userId,
    conflict.date,
    sourceKey(conflict.first),
    sourceKey(conflict.second),
  ].join("|");
}

function orderPair(a: ScheduleCommitment, b: ScheduleCommitment): [ScheduleCommitment, ScheduleCommitment] {
  return sourceKey(a).localeCompare(sourceKey(b)) <= 0 ? [a, b] : [b, a];
}

function addCommitment(
  target: Map<string, ScheduleCommitment>,
  input: Omit<ScheduleCommitment, "startMinutes" | "endMinutes">,
) {
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;
  const commitment: ScheduleCommitment = {
    ...input,
    startTime: canonicalTime(input.startTime),
    endTime: canonicalTime(input.endTime),
    startMinutes,
    endMinutes,
  };
  const key = sourceKey(commitment);
  if (!target.has(key)) target.set(key, commitment);
}

/**
 * Reúne os compromissos efetivos do dia. Sessões chegam pela convocação no
 * Livro do Dia; agenda, Escala e atividades juntam as outras áreas de trabalho.
 */
export async function collectScheduleCommitments(personId: string, date: string): Promise<ScheduleCommitment[]> {
  const commitments = new Map<string, ScheduleCommitment>();
  const weekday = dateWeekday(date);

  const [sessionRows, agendaRows, scaleRows, directActivityRows, groupActivityRows] = await Promise.all([
    db
      .select({
        sessionId: sessionsTable.id,
        startTime: sessionsTable.startTime,
        endTime: sessionsTable.endTime,
        showTitle: showBooksTable.title,
        organizationId: operationsTable.organizationId,
      })
      .from(dailyBookAssignmentsTable)
      .innerJoin(dailyBooksTable, eq(dailyBookAssignmentsTable.dailyBookId, dailyBooksTable.id))
      .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
      .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
      .innerJoin(sessionsTable, eq(sessionsTable.showId, dailyBooksTable.showBookId))
      .leftJoin(showBooksTable, eq(sessionsTable.showId, showBooksTable.id))
      .where(and(
        eq(dailyBookAssignmentsTable.userId, personId),
        eq(agendaEventsTable.date, date),
        eq(sessionsTable.active, true),
        sql`(sessions.valid_from IS NULL OR sessions.valid_from <= ${date})`,
        sql`(sessions.valid_to IS NULL OR sessions.valid_to >= ${date})`,
        ne(dailyBookAssignmentsTable.status, "REMOVED"),
        ne(dailyBooksTable.status, "CANCELLED"),
      )),
    db
      .select({
        eventId: agendaEventsTable.id,
        title: agendaEventsTable.title,
        startTime: agendaEventsTable.startTime,
        endTime: agendaEventsTable.endTime,
        organizationId: operationsTable.organizationId,
      })
      .from(agendaEventParticipantsTable)
      .innerJoin(agendaEventsTable, eq(agendaEventParticipantsTable.eventId, agendaEventsTable.id))
      .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
      .where(and(
        eq(agendaEventParticipantsTable.userId, personId),
        eq(agendaEventsTable.date, date),
        ne(agendaEventsTable.status, "CANCELLED"),
        isNotNull(agendaEventsTable.startTime),
        isNotNull(agendaEventsTable.endTime),
        // Um SHOW ligado ao próprio Livro do Show já é representado pelas sessões.
        or(ne(agendaEventsTable.type, "SHOW"), isNull(agendaEventsTable.showBookId)),
      )),
    db
      .select({
        allocationId: scaleAllocationsTable.id,
        userId: scaleAllocationsTable.userId,
        manualDate: scaleAllocationsTable.manualDate,
        manualLabel: scaleAllocationsTable.manualLabel,
        manualStartTime: scaleAllocationsTable.startTime,
        manualEndTime: scaleAllocationsTable.endTime,
        scaleTitle: scalesTable.title,
        eventDate: agendaEventsTable.date,
        eventTitle: agendaEventsTable.title,
        eventStartTime: agendaEventsTable.startTime,
        eventEndTime: agendaEventsTable.endTime,
        organizationId: operationsTable.organizationId,
      })
      .from(scaleAllocationsTable)
      .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
      .innerJoin(operationsTable, eq(scalesTable.operationId, operationsTable.id))
      .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
      .where(and(
        eq(scaleAllocationsTable.userId, personId),
        inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFLICT", "MANUAL_OVERRIDE"]),
        eq(scaleAllocationsTable.active, true),
      )),
    db
      .select({
        scheduleId: recurringActivitySchedulesTable.id,
        specificDate: recurringActivitySchedulesTable.specificDate,
        scheduledWeekday: recurringActivitySchedulesTable.weekday,
        startTime: recurringActivitySchedulesTable.startTime,
        endTime: recurringActivitySchedulesTable.endTime,
        title: recurringActivitiesTable.title,
        organizationId: operationsTable.organizationId,
      })
      .from(recurringActivityAssigneesTable)
      .innerJoin(recurringActivitiesTable, eq(recurringActivityAssigneesTable.activityId, recurringActivitiesTable.id))
      .innerJoin(recurringActivitySchedulesTable, eq(recurringActivitySchedulesTable.activityId, recurringActivitiesTable.id))
      .innerJoin(operationsTable, eq(recurringActivitiesTable.operationId, operationsTable.id))
      .where(and(
        eq(recurringActivityAssigneesTable.userId, personId),
        eq(recurringActivitiesTable.active, true),
      )),
    db
      .select({
        scheduleId: recurringActivitySchedulesTable.id,
        specificDate: recurringActivitySchedulesTable.specificDate,
        scheduledWeekday: recurringActivitySchedulesTable.weekday,
        startTime: recurringActivitySchedulesTable.startTime,
        endTime: recurringActivitySchedulesTable.endTime,
        title: recurringActivitiesTable.title,
        organizationId: operationsTable.organizationId,
      })
      .from(recurringActivityAssigneesTable)
      .innerJoin(recurringActivitiesTable, eq(recurringActivityAssigneesTable.activityId, recurringActivitiesTable.id))
      .innerJoin(recurringActivitySchedulesTable, eq(recurringActivitySchedulesTable.activityId, recurringActivitiesTable.id))
      .innerJoin(teamMembershipsTable, eq(recurringActivityAssigneesTable.groupId, teamMembershipsTable.teamId))
      .innerJoin(operationsTable, eq(recurringActivitiesTable.operationId, operationsTable.id))
      .where(and(
        eq(teamMembershipsTable.userId, personId),
        eq(teamMembershipsTable.active, true),
        eq(recurringActivitiesTable.active, true),
      )),
  ]);

  for (const row of sessionRows) {
    addCommitment(commitments, {
      userId: personId,
      organizationId: row.organizationId,
      date,
      sourceType: "sessao",
      sourceId: row.sessionId,
      label: row.showTitle ?? "Sessão de show",
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }

  for (const row of agendaRows) {
    if (!row.startTime || !row.endTime) continue;
    addCommitment(commitments, {
      userId: personId,
      organizationId: row.organizationId,
      date,
      sourceType: "agenda",
      sourceId: row.eventId,
      label: row.title,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }

  for (const row of scaleRows) {
    const rowDate = row.eventDate ?? row.manualDate;
    const startTime = row.manualStartTime ?? row.eventStartTime;
    const endTime = row.manualEndTime ?? row.eventEndTime;
    if (rowDate !== date || !startTime || !endTime) continue;
    addCommitment(commitments, {
      userId: personId,
      organizationId: row.organizationId,
      date,
      sourceType: "escala",
      sourceId: row.allocationId,
      label: row.eventTitle ?? row.manualLabel ?? row.scaleTitle,
      startTime,
      endTime,
    });
  }

  for (const row of [...directActivityRows, ...groupActivityRows]) {
    const applies = row.specificDate === date || (row.specificDate === null && row.scheduledWeekday === weekday);
    if (!applies || !row.startTime || !row.endTime) continue;
    addCommitment(commitments, {
      userId: personId,
      organizationId: row.organizationId,
      date,
      sourceType: "atividade",
      sourceId: row.scheduleId,
      label: row.title,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }

  return [...commitments.values()].sort((a, b) => a.startMinutes - b.startMinutes || sourceKey(a).localeCompare(sourceKey(b)));
}

/**
 * Detecta somente sobreposições reais. Intervalos adjacentes têm zero minutos
 * em comum e, portanto, não são conflito. Contenção total ou 30+ minutos é
 * grave; encavalamentos parciais menores são leves.
 */
function findConflictsForCommitments(
  personId: string,
  organizationId: string,
  date: string,
  commitments: ScheduleCommitment[],
): DetectedScheduleConflict[] {
  const result: DetectedScheduleConflict[] = [];
  for (let index = 0; index < commitments.length; index += 1) {
    const left = commitments[index]!;
    for (let nextIndex = index + 1; nextIndex < commitments.length; nextIndex += 1) {
      const right = commitments[nextIndex]!;
      if (left.sourceType === right.sourceType && left.sourceId === right.sourceId) continue;
      const overlapStart = Math.max(left.startMinutes, right.startMinutes);
      const overlapEnd = Math.min(left.endMinutes, right.endMinutes);
      const overlapMinutes = overlapEnd - overlapStart;
      if (overlapMinutes <= 0) continue;

      const [first, second] = orderPair(left, right);
      const totalOverlap = (
        (left.startMinutes <= right.startMinutes && left.endMinutes >= right.endMinutes)
        || (right.startMinutes <= left.startMinutes && right.endMinutes >= left.endMinutes)
      );
      result.push({
        userId: personId,
        organizationId,
        date,
        first,
        second,
        overlapMinutes,
        severity: totalOverlap || overlapMinutes >= 30 ? "grave" : "leve",
      });
    }
  }
  return result.sort((a, b) => pairKey(a).localeCompare(pairKey(b)));
}

export async function detectScheduleConflicts(personId: string, date: string): Promise<DetectedScheduleConflict[]> {
  const commitments = await collectScheduleCommitments(personId, date);
  const [person] = await db
    .select({ organizationId: usersTable.organizationId })
    .from(usersTable)
    .where(eq(usersTable.id, personId))
    .limit(1);
  if (!person) return [];
  return findConflictsForCommitments(personId, person.organizationId, date, commitments);
}

/**
 * Conferência do Livro do Show ainda não tem Livro do Dia persistido. Incluímos
 * as sessões do show como compromissos virtuais para alertar antes da geração,
 * sem inventar uma alocação ou bloquear a montagem.
 */
export async function detectShowBookResolveConflicts(input: {
  showBookId: string;
  operationId: string;
  date: string;
  userIds: readonly string[];
}): Promise<ProspectiveScheduleConflict[]> {
  const [show, sessions] = await Promise.all([
    db.select({ title: showBooksTable.title, organizationId: operationsTable.organizationId })
      .from(showBooksTable).innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
      .where(and(eq(showBooksTable.id, input.showBookId), eq(showBooksTable.operationId, input.operationId))).limit(1),
    db.select().from(sessionsTable).where(and(
      eq(sessionsTable.showId, input.showBookId),
      eq(sessionsTable.active, true),
      sql`(sessions.valid_from IS NULL OR sessions.valid_from <= ${input.date})`,
      sql`(sessions.valid_to IS NULL OR sessions.valid_to >= ${input.date})`,
    )),
  ]);
  const sourceShow = show[0];
  if (!sourceShow || sessions.length === 0) return [];
  const output = new Map<string, ProspectiveScheduleConflict>();
  for (const userId of new Set(input.userIds)) {
    const commitments = new Map<string, ScheduleCommitment>();
    for (const commitment of await collectScheduleCommitments(userId, input.date)) commitments.set(sourceKey(commitment), commitment);
    for (const session of sessions) {
      addCommitment(commitments, {
        userId,
        organizationId: sourceShow.organizationId,
        date: input.date,
        sourceType: "sessao",
        sourceId: session.id,
        label: sourceShow.title,
        startTime: session.startTime,
        endTime: session.endTime,
      });
    }
    for (const conflict of findConflictsForCommitments(userId, sourceShow.organizationId, input.date, [...commitments.values()])) {
      if (![conflict.first, conflict.second].some((part) => part.sourceType === "sessao" && sessions.some((session) => session.id === part.sourceId))) continue;
      const [existing] = await db.select().from(scheduleConflictsTable).where(conflictWhere(conflict)).limit(1);
      const recognized = existing?.state === "ciente"
        && existing.firstStartTime === conflict.first.startTime && existing.firstEndTime === conflict.first.endTime
        && existing.secondStartTime === conflict.second.startTime && existing.secondEndTime === conflict.second.endTime
        && existing.firstLabel === conflict.first.label && existing.secondLabel === conflict.second.label;
      const id = `preview:${pairKey(conflict)}`;
      output.set(id, {
        id: existing?.id ?? id, userId, personId: userId, organizationId: sourceShow.organizationId, date: input.date,
        first: { sourceType: conflict.first.sourceType, sourceId: conflict.first.sourceId, label: conflict.first.label, startTime: conflict.first.startTime, endTime: conflict.first.endTime },
        second: { sourceType: conflict.second.sourceType, sourceId: conflict.second.sourceId, label: conflict.second.label, startTime: conflict.second.startTime, endTime: conflict.second.endTime },
        overlapMinutes: conflict.overlapMinutes, severity: conflict.severity, state: recognized ? "ciente" : "aberto", alerting: !recognized,
      });
    }
  }
  return [...output.values()];
}

export async function detectDailyBookConflicts(dailyBookId: string, date: string): Promise<PublicScheduleConflict[]> {
  const assignments = await db.select({ userId: dailyBookAssignmentsTable.userId })
    .from(dailyBookAssignmentsTable)
    .where(and(eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId), ne(dailyBookAssignmentsTable.status, "REMOVED")));
  const conflicts = new Map<string, PublicScheduleConflict>();
  for (const userId of new Set(assignments.map((assignment) => assignment.userId).filter((id): id is string => Boolean(id)))) {
    for (const conflict of await detectAndPersistScheduleConflicts(userId, date)) conflicts.set(conflict.id, conflict);
  }
  return [...conflicts.values()];
}

function conflictWhere(conflict: DetectedScheduleConflict) {
  return and(
    eq(scheduleConflictsTable.userId, conflict.userId),
    eq(scheduleConflictsTable.date, conflict.date),
    eq(scheduleConflictsTable.firstSourceType, conflict.first.sourceType),
    eq(scheduleConflictsTable.firstSourceId, conflict.first.sourceId),
    eq(scheduleConflictsTable.secondSourceType, conflict.second.sourceType),
    eq(scheduleConflictsTable.secondSourceId, conflict.second.sourceId),
  );
}

function conflictSnapshot(conflict: ScheduleConflict) {
  return {
    id: conflict.id,
    userId: conflict.userId,
    date: conflict.date,
    first: {
      sourceType: conflict.firstSourceType,
      sourceId: conflict.firstSourceId,
      label: conflict.firstLabel,
      startTime: conflict.firstStartTime,
      endTime: conflict.firstEndTime,
    },
    second: {
      sourceType: conflict.secondSourceType,
      sourceId: conflict.secondSourceId,
      label: conflict.secondLabel,
      startTime: conflict.secondStartTime,
      endTime: conflict.secondEndTime,
    },
    overlapMinutes: conflict.overlapMinutes,
    severity: conflict.severity,
    state: conflict.state,
    acknowledgementReason: conflict.acknowledgementReason,
  };
}

export function serializeScheduleConflict(conflict: ScheduleConflict): PublicScheduleConflict {
  return {
    id: conflict.id,
    userId: conflict.userId,
    personId: conflict.userId,
    organizationId: conflict.organizationId,
    date: conflict.date,
    first: {
      sourceType: conflict.firstSourceType,
      sourceId: conflict.firstSourceId,
      label: conflict.firstLabel,
      startTime: conflict.firstStartTime,
      endTime: conflict.firstEndTime,
    },
    second: {
      sourceType: conflict.secondSourceType,
      sourceId: conflict.secondSourceId,
      label: conflict.secondLabel,
      startTime: conflict.secondStartTime,
      endTime: conflict.secondEndTime,
    },
    overlapMinutes: conflict.overlapMinutes,
    severity: conflict.severity,
    state: conflict.state,
    acknowledgedBy: conflict.acknowledgedBy,
    acknowledgedAt: conflict.acknowledgedAt,
    acknowledgementReason: conflict.acknowledgementReason,
    alerting: conflict.state === "aberto",
    createdAt: conflict.createdAt,
    updatedAt: conflict.updatedAt,
  };
}

/**
 * Persiste o estado atual sem apagar histórico. Um par que desapareceu fica
 * resolvido; um par que reapareceu ou mudou de horário volta a aberto e perde
 * o reconhecimento anterior.
 */
export async function detectAndPersistScheduleConflicts(personId: string, date: string): Promise<PublicScheduleConflict[]> {
  const detected = await detectScheduleConflicts(personId, date);
  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as typeof db;
    const currentRows: ScheduleConflict[] = [];
    const currentKeys = new Set(detected.map(pairKey));

    for (const conflict of detected) {
      const [existing] = await transactionDb
        .select()
        .from(scheduleConflictsTable)
        .where(conflictWhere(conflict))
        .limit(1);

      const changed = existing && (
        existing.firstLabel !== conflict.first.label
        || existing.firstStartTime !== conflict.first.startTime
        || existing.firstEndTime !== conflict.first.endTime
        || existing.secondLabel !== conflict.second.label
        || existing.secondStartTime !== conflict.second.startTime
        || existing.secondEndTime !== conflict.second.endTime
        || existing.overlapMinutes !== conflict.overlapMinutes
        || existing.severity !== conflict.severity
      );

      if (!existing) {
        const [created] = await transactionDb.insert(scheduleConflictsTable).values({
          userId: personId,
          organizationId: conflict.organizationId,
          date,
          firstSourceType: conflict.first.sourceType,
          firstSourceId: conflict.first.sourceId,
          firstLabel: conflict.first.label,
          firstStartTime: conflict.first.startTime,
          firstEndTime: conflict.first.endTime,
          secondSourceType: conflict.second.sourceType,
          secondSourceId: conflict.second.sourceId,
          secondLabel: conflict.second.label,
          secondStartTime: conflict.second.startTime,
          secondEndTime: conflict.second.endTime,
          overlapMinutes: conflict.overlapMinutes,
          severity: conflict.severity,
          state: "aberto",
        }).returning();
        if (created) {
          currentRows.push(created);
          await writeHistoryEvent({
            category: "OPERATIONAL_CHANGE", action: "schedule_conflict.detected",
            title: "Conflito de horário detectado",
            narrative: `Conflito entre ${created.firstLabel} e ${created.secondLabel} (${created.overlapMinutes} min).`,
            entityType: "schedule_conflict", entityId: created.id, actorType: "DETERMINISTIC_ENGINE",
            orgId: created.organizationId, beforeState: null, afterState: conflictSnapshot(created),
            metadata: { date: created.date, severity: created.severity },
          }, transactionDb as any);
        }
        continue;
      }

      const resetRecognition = Boolean(changed) || existing.state === "resolvido";
      const [updated] = await transactionDb
        .update(scheduleConflictsTable)
        .set({
          organizationId: conflict.organizationId,
          firstLabel: conflict.first.label,
          firstStartTime: conflict.first.startTime,
          firstEndTime: conflict.first.endTime,
          secondLabel: conflict.second.label,
          secondStartTime: conflict.second.startTime,
          secondEndTime: conflict.second.endTime,
          overlapMinutes: conflict.overlapMinutes,
          severity: conflict.severity,
          state: resetRecognition ? "aberto" : existing.state,
          acknowledgedBy: resetRecognition ? null : existing.acknowledgedBy,
          acknowledgedAt: resetRecognition ? null : existing.acknowledgedAt,
          acknowledgementReason: resetRecognition ? null : existing.acknowledgementReason,
          updatedAt: new Date(),
        })
        .where(eq(scheduleConflictsTable.id, existing.id))
        .returning();
      if (updated) {
        currentRows.push(updated);
        if (changed) {
          await writeHistoryEvent({
            category: "OPERATIONAL_CHANGE", action: resetRecognition ? "schedule_conflict.reopened" : "schedule_conflict.changed",
            title: resetRecognition ? "Reconhecimento de conflito removido" : "Conflito de horário atualizado",
            narrative: resetRecognition
              ? "O horário mudou; o reconhecimento anterior deixou de valer."
              : `Conflito entre ${updated.firstLabel} e ${updated.secondLabel} atualizado.`,
            entityType: "schedule_conflict", entityId: updated.id, actorType: "DETERMINISTIC_ENGINE",
            orgId: updated.organizationId, beforeState: conflictSnapshot(existing), afterState: conflictSnapshot(updated),
            metadata: { date: updated.date, severity: updated.severity },
          }, transactionDb as any);
        }
      }
    }

    const previous = await transactionDb
      .select()
      .from(scheduleConflictsTable)
      .where(and(
        eq(scheduleConflictsTable.userId, personId),
        eq(scheduleConflictsTable.date, date),
        ne(scheduleConflictsTable.state, "resolvido"),
      ));
    for (const conflict of previous) {
      const key = [
        conflict.userId,
        conflict.date,
        `${conflict.firstSourceType}:${conflict.firstSourceId}`,
        `${conflict.secondSourceType}:${conflict.secondSourceId}`,
      ].join("|");
      if (currentKeys.has(key)) continue;
      const [resolved] = await transactionDb.update(scheduleConflictsTable)
        .set({ state: "resolvido", updatedAt: new Date() })
        .where(eq(scheduleConflictsTable.id, conflict.id)).returning();
      if (resolved) {
        await writeHistoryEvent({
          category: "OPERATIONAL_CHANGE", action: "schedule_conflict.resolved",
          title: "Conflito de horário resolvido", narrative: "O par de horários deixou de se sobrepor.",
          entityType: "schedule_conflict", entityId: resolved.id, actorType: "DETERMINISTIC_ENGINE",
          orgId: resolved.organizationId, beforeState: conflictSnapshot(conflict), afterState: conflictSnapshot(resolved),
          metadata: { date: resolved.date },
        }, transactionDb as any);
      }
    }

    return currentRows
      .sort((a, b) => a.firstStartTime.localeCompare(b.firstStartTime))
      .map(serializeScheduleConflict);
  });
}

export async function listScheduleConflicts(
  personId: string,
  date: string,
  includeResolved = true,
): Promise<PublicScheduleConflict[]> {
  const conditions = [eq(scheduleConflictsTable.userId, personId), eq(scheduleConflictsTable.date, date)];
  if (!includeResolved) conditions.push(ne(scheduleConflictsTable.state, "resolvido"));
  const rows = await db.select().from(scheduleConflictsTable).where(and(...conditions));
  return rows.map(serializeScheduleConflict);
}

export async function acknowledgeScheduleConflict(input: {
  conflictId: string;
  actorId: string;
  reason: string;
}): Promise<PublicScheduleConflict> {
  const reason = normalizeReason(input.reason);
  if (!reason) throw new ScheduleConflictReasonRequiredError();

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as typeof db;
    const [current] = await transactionDb
      .select()
      .from(scheduleConflictsTable)
      .where(eq(scheduleConflictsTable.id, input.conflictId))
      .limit(1);
    if (!current) throw new ScheduleConflictNotFoundError();
    if (current.state === "ciente") throw new ScheduleConflictAlreadyAcknowledgedError();
    if (current.state === "resolvido") throw new ScheduleConflictNotActiveError();

    const beforeState = conflictSnapshot(current);
    const [updated] = await transactionDb
      .update(scheduleConflictsTable)
      .set({
        state: "ciente",
        acknowledgedBy: input.actorId,
        acknowledgedAt: new Date(),
        acknowledgementReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduleConflictsTable.id, input.conflictId), eq(scheduleConflictsTable.state, "aberto")))
      .returning();
    if (!updated) throw new ScheduleConflictNotActiveError();

    await transactionDb.insert(historyEventsTable).values({
      orgId: updated.organizationId,
      category: "OPERATIONAL_CHANGE",
      title: "Conflito de horário reconhecido",
      narrative: `Conflito entre ${updated.firstLabel} (${updated.firstStartTime}–${updated.firstEndTime}) e ${updated.secondLabel} (${updated.secondStartTime}–${updated.secondEndTime}) marcado como ciente.`,
      entityType: "schedule_conflict",
      entityId: updated.id,
      actorId: input.actorId,
      actorType: "HUMAN",
      action: "schedule_conflict.acknowledged",
      beforeState,
      afterState: conflictSnapshot(updated),
      metadata: {
        reason,
        date: updated.date,
        overlapMinutes: updated.overlapMinutes,
        severity: updated.severity,
      },
    });

    return serializeScheduleConflict(updated);
  });
}
