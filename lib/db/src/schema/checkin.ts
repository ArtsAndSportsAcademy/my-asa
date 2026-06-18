import { pgTable, text, uuid, timestamp, pgEnum, date, unique } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_checkin_user_operation_date").on(t.userId, t.operationId, t.date),
]);

export const insertCheckInSchema = createInsertSchema(operationalCheckInsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type OperationalCheckIn = typeof operationalCheckInsTable.$inferSelect;
