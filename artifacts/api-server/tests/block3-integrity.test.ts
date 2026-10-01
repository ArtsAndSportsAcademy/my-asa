/**
 * Aceite do Bloco 3 contra PostgreSQL real.
 *
 * Este teste cobre detecção, severidade, não bloqueio da Escala, reconhecimento
 * com motivo e reabertura quando o horário de uma das partes muda.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  organizationsTable,
  operationsTable,
  usersTable,
  userRolesTable,
  showBooksTable,
  sessionsTable,
  agendaEventsTable,
  dailyBooksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
  scalesTable,
  scaleAllocationsTable,
  recurringActivitiesTable,
  recurringActivitySchedulesTable,
  recurringActivityAssigneesTable,
  scheduleConflictsTable,
  historyEventsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import {
  acknowledgeScheduleConflict,
  detectAndPersistScheduleConflicts,
  listScheduleConflicts,
  ScheduleConflictReasonRequiredError,
} from "../src/services/schedule-conflicts.js";

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

function hasSources(conflict: { first: { sourceType: string }; second: { sourceType: string } }, left: string, right: string) {
  return [conflict.first.sourceType, conflict.second.sourceType].sort().join("|") === [left, right].sort().join("|");
}

async function run() {
  const tag = `block3_${Date.now()}`;
  const date = "2026-09-16";
  const nextDate = "2026-09-17";
  const [organization] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({
    organizationId: organization!.id,
    name: `${tag}_operation`,
    locations: ["Snowland"],
    status: "ACTIVE",
  }).returning();
  const [admin] = await db.insert(usersTable).values({
    organizationId: organization!.id,
    name: `${tag}_admin`,
    username: `${tag}_admin`,
  }).returning();
  const [person] = await db.insert(usersTable).values({
    organizationId: organization!.id,
    name: `${tag}_person`,
    username: `${tag}_person`,
  }).returning();

  let showBookId: string | null = null;
  let sessionOneId: string | null = null;
  let sessionTwoId: string | null = null;
  let agendaEventId: string | null = null;
  let dailyBookId: string | null = null;
  let positionId: string | null = null;
  let scaleId: string | null = null;
  let activityId: string | null = null;
  let activityScheduleId: string | null = null;
  const conflictIds = new Set<string>();
  let server: http.Server | null = null;

  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: person!.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);

    const [showBook] = await db.insert(showBooksTable).values({
      operationId: operation!.id,
      title: `${tag}_show`,
      createdBy: admin!.id,
    }).returning();
    showBookId = showBook!.id;

    const [sessionOne] = await db.insert(sessionsTable).values({
      showId: showBook!.id,
      startTime: "10:00",
      endTime: "11:00",
    }).returning();
    const [sessionTwo] = await db.insert(sessionsTable).values({
      showId: showBook!.id,
      startTime: "10:30",
      endTime: "11:30",
    }).returning();
    sessionOneId = sessionOne!.id;
    sessionTwoId = sessionTwo!.id;

    const [agendaEvent] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id,
      showBookId: showBook!.id,
      type: "SHOW",
      title: `${tag}_show_event`,
      date,
      createdBy: admin!.id,
    }).returning();
    agendaEventId = agendaEvent!.id;
    const [dailyBook] = await db.insert(dailyBooksTable).values({
      agendaEventId: agendaEvent!.id,
      showBookId: showBook!.id,
      status: "DRAFT",
      version: 1,
      snapshotJson: {},
    }).returning();
    dailyBookId = dailyBook!.id;
    const [position] = await db.insert(dailyBookPositionsTable).values({
      dailyBookId: dailyBook!.id,
      name: `${tag}_position`,
    }).returning();
    positionId = position!.id;
    await db.insert(dailyBookAssignmentsTable).values({
      dailyBookId: dailyBook!.id,
      positionId: position!.id,
      userId: person!.id,
      status: "ASSIGNED",
    });

    let conflicts = await detectAndPersistScheduleConflicts(person!.id, date);
    for (const conflict of conflicts) conflictIds.add(conflict.id);
    const grave = conflicts.find((conflict) => hasSources(conflict, "sessao", "sessao"));
    assert(Boolean(grave), "duas sessões sobrepostas no mesmo dia são detectadas");
    assert(grave?.severity === "grave" && grave?.overlapMinutes === 30, "sobreposição de 30 minutos recebe severidade grave");

    await db.update(sessionsTable).set({ startTime: "10:50" }).where(eq(sessionsTable.id, sessionTwo!.id));
    conflicts = await detectAndPersistScheduleConflicts(person!.id, date);
    for (const conflict of conflicts) conflictIds.add(conflict.id);
    const light = conflicts.find((conflict) => hasSources(conflict, "sessao", "sessao"));
    assert(light?.overlapMinutes === 10 && light?.severity === "leve", "encavalamento parcial de 10 minutos recebe severidade leve");

    await db.update(sessionsTable).set({ startTime: "11:00" }).where(eq(sessionsTable.id, sessionTwo!.id));
    conflicts = await detectAndPersistScheduleConflicts(person!.id, date);
    assert(!conflicts.some((conflict) => hasSources(conflict, "sessao", "sessao")), "sessões adjacentes que só se tocam não geram conflito");
    const differentDateConflicts = await detectAndPersistScheduleConflicts(person!.id, nextDate);
    assert(differentDateConflicts.length === 0, "compromissos em datas diferentes não geram conflito");

    const [scale] = await db.insert(scalesTable).values({
      operationId: operation!.id,
      title: `${tag}_scale`,
      periodStart: date,
      periodEnd: date,
      status: "DRAFT",
      createdBy: admin!.id,
    }).returning();
    scaleId = scale!.id;

    const token = signAccessToken({
      sub: admin!.id,
      jti: `${tag}_token`,
      organizationId: organization!.id,
      role: "ADMIN",
      operationIds: [operation!.id],
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");

    const saveResponse = await fetch(`http://127.0.0.1:${address.port}/api/scales/${scale!.id}/entries`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 1,
        memberId: person!.id,
        date,
        label: "Turno de hotelaria",
        startTime: "10:50",
        endTime: "11:10",
      }),
    });
    const saveBody = await saveResponse.json() as { entry?: { id: string }; conflicts?: Array<{ severity: string }>; alerts?: unknown[] };
    assert(saveResponse.status === 201 && Boolean(saveBody.entry), "salvar Escala com conflito sucede");
    assert((saveBody.conflicts?.length ?? 0) > 0 && (saveBody.alerts?.length ?? 0) > 0, "salvamento retorna o conflito e o alerta sem recusar a escrita");
    assert(
      (saveBody.conflicts ?? []).some((conflict) => conflict.severity === "leve"),
      "o conflito criado pela entrada manual de Escala preserva a severidade leve",
    );

    const [activity] = await db.insert(recurringActivitiesTable).values({
      organizationId: organization!.id,
      operationId: operation!.id,
      title: "Hotelaria",
      active: true,
    }).returning();
    activityId = activity!.id;
    const [activitySchedule] = await db.insert(recurringActivitySchedulesTable).values({
      activityId: activity!.id,
      specificDate: date,
      startTime: "11:00",
      endTime: "12:00",
    }).returning();
    activityScheduleId = activitySchedule!.id;
    await db.insert(recurringActivityAssigneesTable).values({ activityId: activity!.id, userId: person!.id });

    conflicts = await detectAndPersistScheduleConflicts(person!.id, date);
    for (const conflict of conflicts) conflictIds.add(conflict.id);
    const crossArea = conflicts.find((conflict) => hasSources(conflict, "atividade", "escala"));
    assert(Boolean(crossArea), "a mesma pessoa em Escala e hotelaria gera conflito entre áreas");
    if (!crossArea) throw new Error("conflito entre Escala e atividade não foi criado para o aceite");

    let blankRejected = false;
    try {
      await acknowledgeScheduleConflict({ conflictId: crossArea.id, actorId: admin!.id, reason: "   " });
    } catch (error) {
      blankRejected = error instanceof ScheduleConflictReasonRequiredError;
    }
    assert(blankRejected, "reconhecimento com motivo vazio ou só espaços é rejeitado");

    const acknowledged = await acknowledgeScheduleConflict({
      conflictId: crossArea.id,
      actorId: admin!.id,
      reason: "Sobreposição conhecida pela supervisão",
    });
    assert(acknowledged.state === "ciente" && !acknowledged.alerting, "reconhecimento com motivo silencia o alerta e mantém o conflito consultável");
    const acknowledgementHistory = await db.select().from(historyEventsTable).where(and(
      eq(historyEventsTable.entityType, "schedule_conflict"),
      eq(historyEventsTable.entityId, crossArea.id),
      eq(historyEventsTable.action, "schedule_conflict.acknowledged"),
    ));
    assert(
      acknowledgementHistory.length === 1
        && (acknowledgementHistory[0]?.metadata as { reason?: string } | null)?.reason === "Sobreposição conhecida pela supervisão"
        && (acknowledgementHistory[0]?.beforeState as { state?: string } | null)?.state === "aberto"
        && (acknowledgementHistory[0]?.afterState as { state?: string } | null)?.state === "ciente",
      "reconhecimento grava Registro com motivo e estados antes/depois",
    );

    await db.update(recurringActivitySchedulesTable)
      .set({ startTime: "11:05" })
      .where(eq(recurringActivitySchedulesTable.id, activitySchedule!.id));
    conflicts = await detectAndPersistScheduleConflicts(person!.id, date);
    const reopened = conflicts.find((conflict) => conflict.id === crossArea.id);
    assert(reopened?.state === "aberto" && reopened.alerting, "mudança de horário derruba o ciente e reabre o alerta");
    const queryRows = await listScheduleConflicts(person!.id, date, true);
    assert(queryRows.some((conflict) => conflict.id === crossArea.id && conflict.state === "aberto"), "conflito reaberto continua consultável");
    for (const conflict of conflicts) conflictIds.add(conflict.id);
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    if (conflictIds.size > 0) {
      await db.delete(historyEventsTable).where(inArray(historyEventsTable.entityId, [...conflictIds]));
    }
    if (person) await db.delete(scheduleConflictsTable).where(eq(scheduleConflictsTable.userId, person.id));
    if (activityId) await db.delete(recurringActivityAssigneesTable).where(eq(recurringActivityAssigneesTable.activityId, activityId));
    if (activityScheduleId) await db.delete(recurringActivitySchedulesTable).where(eq(recurringActivitySchedulesTable.id, activityScheduleId));
    if (activityId) await db.delete(recurringActivitiesTable).where(eq(recurringActivitiesTable.id, activityId));
    if (scaleId) {
      await db.delete(historyEventsTable).where(eq(historyEventsTable.entityId, scaleId));
      await db.delete(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId));
      await db.delete(scalesTable).where(eq(scalesTable.id, scaleId));
    }
    if (dailyBookId) await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId));
    if (positionId) await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.id, positionId));
    if (dailyBookId) await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, dailyBookId));
    if (agendaEventId) await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, agendaEventId));
    if (showBookId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.showId, showBookId));
      await db.delete(showBooksTable).where(eq(showBooksTable.id, showBookId));
    }
    if (admin && person) await db.delete(userRolesTable).where(inArray(userRolesTable.userId, [admin.id, person.id]));
    if (admin && person) await db.delete(usersTable).where(inArray(usersTable.id, [admin.id, person.id]));
    if (operation) await db.delete(operationsTable).where(eq(operationsTable.id, operation.id));
    if (organization) await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }

  if (failures.length > 0) throw new Error(`${failures.length} teste(s) do Bloco 3 falharam`);
  console.log(`block3-integrity: ${passed} asserts passed`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
