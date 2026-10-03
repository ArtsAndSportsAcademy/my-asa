import { pgTable, text, uuid, timestamp, pgEnum, date, uniqueIndex, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable, operationsTable } from "./organization.js";
import { usersTable } from "./identity.js";

export const checkInStatusEnum = pgEnum("check_in_status", [
  "EXPECTED",
  "CHECKED_IN",
  "LATE",
  "ABSENT",
  "EXCUSED",
]);

export const shiftsTable = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShiftActivitySnapshot = { key: string; scaleId: string; locationId: string; locationName: string; label: string; date: string; startTime: string; endTime: string | null; dailyBookId: string | null };

export const operationalCheckInsTable = pgTable("operational_check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  status: checkInStatusEnum("status").notNull().default("EXPECTED"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  registeredBy: uuid("registered_by").references(() => usersTable.id),
  excuseReason: text("excuse_reason"),
  shiftId: uuid("shift_id").references(() => shiftsTable.id),
  shiftState: text("shift_state").$type<"EXPECTED" | "ARRIVED" | "LATE" | "ABSENT" | "NO_RESPONSE" | "LATE_UNCONFIRMED">(),
  etaMinutes: integer("eta_minutes"),
  reasonCode: text("reason_code"),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  firstActivityAt: timestamp("first_activity_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  lateArrival: boolean("late_arrival").notNull().default(false),
  activities: jsonb("activities").$type<ShiftActivitySnapshot[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_checkin_user_operation_date").on(t.userId, t.operationId, t.date).where(sql`${t.shiftId} is null`),
  uniqueIndex("uq_checkin_user_date_shift").on(t.userId, t.date, t.shiftId),
]);

export const insertCheckInSchema = createInsertSchema(operationalCheckInsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type OperationalCheckIn = typeof operationalCheckInsTable.$inferSelect;
