import { db } from "@workspace/db";
import { tasksTable, usersTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { domainLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { sendNotification } from "./notificationService.js";

const log = domainLogger(LOG_DOMAIN.TASKS);

// Statuses that still count as "open" work the assignee must act on.
const OPEN_TASK_STATUSES = ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"] as const;

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Task deadline reminders (basic path: "vence amanhã") ─────────────────────
// Finds open tasks whose dueDate is tomorrow and notifies each assignee
// (in-app history + real push). Returns how many reminders were sent.

export async function sendTaskDueReminders(): Promise<{ reminded: number }> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = dateOnly(tomorrow);

  const tasks = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      dueDate: tasksTable.dueDate,
      assigneeId: tasksTable.assigneeId,
      priority: tasksTable.priority,
      assigneeName: usersTable.name,
    })
    .from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(and(
      eq(tasksTable.dueDate, tomorrowStr),
      inArray(tasksTable.status, [...OPEN_TASK_STATUSES]),
    ));

  let reminded = 0;
  for (const t of tasks) {
    try {
      await sendNotification({
        userId: t.assigneeId,
        type: "TASK_DUE_SOON",
        title: "⏰ Tarefa vence amanhã",
        message: `"${t.title}" vence amanhã (${tomorrowStr}).`,
        priority: t.priority === "CRITICAL" || t.priority === "HIGH" ? "IMPORTANT" : "NORMAL",
        category: "system",
        entityType: "task",
        entityId: t.id,
      });
      reminded += 1;
    } catch (err) {
      log.error({ taskId: t.id, assigneeId: t.assigneeId, err }, "failed to send task due reminder");
    }
  }

  log.info({ dueDate: tomorrowStr, candidates: tasks.length, reminded }, "task due reminders processed");
  return { reminded };
}

// ─── Daily scheduler ──────────────────────────────────────────────────────────
// Basic recurring path: runs once a day at REMINDER_HOUR (server local time).
// Does not fire on startup to avoid duplicate reminders across restarts.

const REMINDER_HOUR = 8;
let timer: ReturnType<typeof setTimeout> | null = null;

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(REMINDER_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startTaskReminderScheduler(): void {
  if (timer) return;
  const schedule = () => {
    timer = setTimeout(async () => {
      try {
        await sendTaskDueReminders();
      } catch (err) {
        log.error({ err }, "task reminder scheduler tick failed");
      } finally {
        schedule();
      }
    }, msUntilNextRun());
  };
  schedule();
  log.info({ reminderHour: REMINDER_HOUR }, "task reminder scheduler started");
}
