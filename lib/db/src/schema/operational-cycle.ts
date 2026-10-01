import { boolean, date, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import { organizationsTable } from "./organization.js";
import { usersTable } from "./identity.js";
import { areasTable } from "./areas.js";
import { scalesTable } from "./scale.js";
import { dailyBooksTable, dailyBookAssignmentsTable } from "./daily-book.js";

/** Política com vigência: a configuração aplicada a um dia não é reescrita por uma regra futura. */
export const leaveRegimesTable = pgTable("leave_regimes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  weeklyDays: integer("weekly_days").notNull(),
  weekStartsOn: integer("week_starts_on").notNull().default(4),
  recessRules: jsonb("recess_rules").$type<Record<string, unknown>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("leave_regimes_active_effective_from_uq").on(table.organizationId, table.effectiveFrom).where(sql`${table.active}`),
]);

export const leaveRequestStatusEnum = pgEnum("leave_request_status", ["PENDING", "APPROVED", "DENIED", "CANCELLED"]);

/** Pedido é separado da Folga materializada: fila, decisão e histórico continuam legíveis. */
export const leaveRequestsTable = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  areaId: uuid("area_id").references(() => areasTable.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  reason: text("reason").notNull(),
  status: leaveRequestStatusEnum("status").notNull().default("PENDING"),
  decidedBy: uuid("decided_by").references(() => usersTable.id),
  decisionReason: text("decision_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("leave_requests_pending_range_uq").on(table.userId, table.startDate, table.endDate).where(eq(table.status, "PENDING")),
]);

export const dayCheckInStatusEnum = pgEnum("day_checkin_status", ["EXPECTED", "CHECKED_IN", "LATE", "ABSENT", "EXCUSED"]);

/** Presença por bloco da Escala. A vaga do Livro é mantida como relação, sem apagar a convocação original. */
export const dayCheckInsTable = pgTable("day_check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id),
  sourceKey: text("source_key").notNull(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  status: dayCheckInStatusEnum("status").notNull().default("EXPECTED"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  etaMinutes: integer("eta_minutes"),
  reason: text("reason"),
  registeredBy: uuid("registered_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("day_checkins_scale_source_user_uq").on(table.scaleId, table.sourceKey, table.userId),
]);

/** A ausência marca a posição como em risco, mas preservar a designação permite cobertura e Registro. */
export const dailyBookCheckInVacanciesTable = pgTable("daily_book_checkin_vacancies", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyBookId: uuid("daily_book_id").notNull().references(() => dailyBooksTable.id),
  assignmentId: uuid("assignment_id").notNull().references(() => dailyBookAssignmentsTable.id),
  checkInId: uuid("check_in_id").notNull().references(() => dayCheckInsTable.id),
  active: boolean("active").notNull().default(true),
  resolvedBy: uuid("resolved_by").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("daily_book_checkin_vacancy_active_assignment_uq").on(table.assignmentId).where(sql`${table.active}`),
]);

export type LeaveRegime = typeof leaveRegimesTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type DayCheckIn = typeof dayCheckInsTable.$inferSelect;
