import { pgTable, pgEnum, uuid, date, text, time, integer, timestamp, index, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./identity.js";
import { organizationsTable } from "./organization.js";

export const scheduleConflictSeverityEnum = pgEnum("schedule_conflict_severity", ["leve", "grave"]);
export const scheduleConflictStateEnum = pgEnum("schedule_conflict_state", ["aberto", "ciente", "resolvido"]);
export const scheduleConflictSourceEnum = pgEnum("schedule_conflict_source", [
  "sessao",
  "agenda",
  "escala",
  "atividade",
]);

/**
 * Par de compromissos que se sobrepôs para uma pessoa em uma data.
 * A linha permanece como histórico: quando o par deixa de existir, o estado
 * passa a resolvido; quando volta a existir ou muda de horário, reabre-se o
 * alerta e o reconhecimento anterior não é reutilizado.
 */
export const scheduleConflictsTable = pgTable("schedule_conflicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  date: date("date", { mode: "string" }).notNull(),
  firstSourceType: scheduleConflictSourceEnum("first_source_type").notNull(),
  firstSourceId: text("first_source_id").notNull(),
  firstLabel: text("first_label").notNull(),
  firstStartTime: time("first_start_time").notNull(),
  firstEndTime: time("first_end_time").notNull(),
  secondSourceType: scheduleConflictSourceEnum("second_source_type").notNull(),
  secondSourceId: text("second_source_id").notNull(),
  secondLabel: text("second_label").notNull(),
  secondStartTime: time("second_start_time").notNull(),
  secondEndTime: time("second_end_time").notNull(),
  overlapMinutes: integer("overlap_minutes").notNull(),
  severity: scheduleConflictSeverityEnum("severity").notNull(),
  state: scheduleConflictStateEnum("state").notNull().default("aberto"),
  acknowledgedBy: uuid("acknowledged_by").references(() => usersTable.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgementReason: text("acknowledgement_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("schedule_conflicts_pair_uq").on(
    table.userId,
    table.date,
    table.firstSourceType,
    table.firstSourceId,
    table.secondSourceType,
    table.secondSourceId,
  ),
  index("schedule_conflicts_user_date_idx").on(table.userId, table.date),
  check("schedule_conflicts_first_interval_ck", sql`${table.firstEndTime} > ${table.firstStartTime}`),
  check("schedule_conflicts_second_interval_ck", sql`${table.secondEndTime} > ${table.secondStartTime}`),
  check("schedule_conflicts_overlap_positive_ck", sql`${table.overlapMinutes} > 0`),
  check("schedule_conflicts_reason_nonblank_ck", sql`${table.acknowledgementReason} IS NULL OR btrim(${table.acknowledgementReason}) <> ''`),
  check(
    "schedule_conflicts_ack_consistency_ck",
    sql`${table.state} <> 'ciente' OR (${table.acknowledgedBy} IS NOT NULL AND ${table.acknowledgedAt} IS NOT NULL AND ${table.acknowledgementReason} IS NOT NULL AND btrim(${table.acknowledgementReason}) <> '')`,
  ),
]);

export type ScheduleConflict = typeof scheduleConflictsTable.$inferSelect;
