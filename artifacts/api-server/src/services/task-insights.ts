import { shiftOperationalDate } from "../lib/operational-date.js";

export type TaskInsightPeriod = "today" | "7d" | "30d";

export function taskPeriodDates(period: TaskInsightPeriod, today: string) {
  const daysBack = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return { startDate: shiftOperationalDate(today, -daysBack), endDate: today };
}

export function summarizeTasks(rows: readonly { status: string; count: number }[]) {
  const counts: Record<string, number> = {
    CREATED: 0,
    IN_PROGRESS: 0,
    READY_FOR_APPROVAL: 0,
    CHANGES_REQUESTED: 0,
    APPROVED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    EXPIRED: 0,
  };
  for (const row of rows) if (row.status in counts) counts[row.status] = Number(row.count) || 0;
  return {
    total: Object.values(counts).reduce((total, count) => total + count, 0),
    pending: counts.CREATED + counts.IN_PROGRESS + counts.READY_FOR_APPROVAL + counts.CHANGES_REQUESTED,
    inProgress: counts.IN_PROGRESS,
    awaitingApproval: counts.READY_FOR_APPROVAL,
    changesRequested: counts.CHANGES_REQUESTED,
    completed: counts.COMPLETED + counts.APPROVED,
    cancelled: counts.CANCELLED,
  };
}
