import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";

export type CheckInInsightPeriod = "today" | "7d" | "30d";
export type CheckInStatus = "CHECKED_IN" | "LATE" | "ABSENT" | "EXCUSED" | "EXPECTED";

export function checkInPeriodDates(period: CheckInInsightPeriod | string, now = new Date()) {
  const endDate = operationalDate(now);
  const daysBack = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return { startDate: shiftOperationalDate(endDate, -daysBack), endDate };
}

export function summarizeCheckIns(records: readonly { status: string }[]) {
  const counts: Record<CheckInStatus, number> = { CHECKED_IN: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, EXPECTED: 0 };
  for (const record of records) if (record.status in counts) counts[record.status as CheckInStatus]++;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const resolved = total - counts.EXPECTED;
  const pct = (part: number) => resolved > 0 ? Math.round((part / resolved) * 1000) / 10 : 0;
  return {
    total,
    checkedIn: counts.CHECKED_IN,
    late: counts.LATE,
    absent: counts.ABSENT,
    excused: counts.EXCUSED,
    expected: counts.EXPECTED,
    rates: { presence: pct(counts.CHECKED_IN), late: pct(counts.LATE), absence: pct(counts.ABSENT), excused: pct(counts.EXCUSED) },
  };
}
