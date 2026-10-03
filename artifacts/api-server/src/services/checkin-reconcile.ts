/**
 * Fecha a presença que não foi registrada no limite operacional: não apaga a
 * convocação; marca a designação do Livro do Dia como em risco para que a
 * Supervisão cubra o mesmo slot que já conhece.
 */
import { and, eq, ne } from "drizzle-orm";
import {
  dailyBookAssignmentsTable, dailyBookCheckInVacanciesTable, dayCheckInsTable,
  db, locationsTable,
} from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate, OPERATIONAL_TIME_ZONE } from "../lib/operational-date.js";
import { montarEscalaDoDia } from "./escala-dia.js";
import { shiftsForDate, reconcileShiftCheckIns } from "./shift-checkins.js";

function clockMinutes(now: Date): number {
  const fields = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (kind: string) => Number(fields.find((part) => part.type === kind)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}

async function markAssignmentsAtRisk(tx: Pick<typeof db, "select" | "insert" | "update">, dailyBookId: string, userId: string, checkInId: string) {
  const assignments = await tx.select().from(dailyBookAssignmentsTable).where(and(
    eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId), eq(dailyBookAssignmentsTable.userId, userId), ne(dailyBookAssignmentsTable.status, "REMOVED"),
  ));
  for (const assignment of assignments) {
    await tx.update(dailyBookAssignmentsTable).set({ status: "AT_RISK", updatedAt: new Date() }).where(eq(dailyBookAssignmentsTable.id, assignment.id));
    const [open] = await tx.select({ id: dailyBookCheckInVacanciesTable.id }).from(dailyBookCheckInVacanciesTable).where(and(eq(dailyBookCheckInVacanciesTable.assignmentId, assignment.id), eq(dailyBookCheckInVacanciesTable.active, true))).limit(1);
    if (!open) await tx.insert(dailyBookCheckInVacanciesTable).values({ dailyBookId, assignmentId: assignment.id, checkInId });
  }
}

/** Pode ser chamado pelo scheduler e é idempotente por (escala, bloco, pessoa). */
export async function reconcileDueCheckIns(now = new Date(), organizationId?: string) {
  const shifts = await reconcileShiftCheckIns(now, organizationId);
  const date = operationalDate(now);
  const nowMinutes = clockMinutes(now);
  const locations = await db.select({ id: locationsTable.id, organizationId: locationsTable.organizationId }).from(locationsTable)
    .where(and(eq(locationsTable.closed, false), organizationId ? eq(locationsTable.organizationId, organizationId) : undefined));
  let marked = 0;
  for (const location of locations) {
    if ((await shiftsForDate(location.organizationId, date)).length) continue;
    const day = await montarEscalaDoDia(location.organizationId, location.id, date);
    if (!day?.escala) continue;
    for (const block of day.blocos.filter((item) => item.dailyBookId)) {
      const [hour, minute] = block.inicio.split(":").map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute) || nowMinutes < hour * 60 + minute - 15) continue;
      const existing = await db.select().from(dayCheckInsTable).where(and(eq(dayCheckInsTable.scaleId, day.escala.id), eq(dayCheckInsTable.sourceKey, block.key)));
      for (const userId of block.pessoaIds.filter((id) => !existing.some((row) => row.userId === id && (row.status === "CHECKED_IN" || row.status === "LATE")))) {
        const saved = await db.transaction(async (tx) => {
          const [created] = await tx.insert(dayCheckInsTable).values({ scaleId: day.escala!.id, sourceKey: block.key, userId, status: "ABSENT", reason: "Sem check-in até o horário limite" }).onConflictDoNothing().returning();
          if (!created) return null;
          await markAssignmentsAtRisk(tx, block.dailyBookId!, userId, created.id);
          await writeHistoryEvent({ category: "CHECK_IN", action: "checkin.deadline_missed", title: "Check-in não realizado", narrative: `Sem check-in até o limite do bloco ${block.rotulo}.`, entityType: "day_checkin", entityId: created.id, actorType: "DETERMINISTIC_ENGINE", orgId: location.organizationId, beforeState: null, afterState: created, metadata: { reason: created.reason } }, tx as unknown as HistoryExecutor);
          return created;
        });
        if (saved) marked++;
      }
    }
  }
  return { marked, date, shiftsClosed: shifts.closed };
}
