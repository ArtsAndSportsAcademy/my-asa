import { pgTable, text, uuid, timestamp, pgEnum, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { operationsTable, operationalGroupsTable } from "./organization.js";
import { showBooksTable } from "./showbook.js";
import { usersTable } from "./identity.js";

export const agendaEventTypeEnum = pgEnum("agenda_event_type", [
  "SHOW", "REHEARSAL", "MEETING", "OPERATIONAL_BLOCK", "COLLECTIVE_VACATION",
]);

export const agendaEventStatusEnum = pgEnum("agenda_event_status", [
  "DRAFT", "CONFIRMED", "SUSPENDED", "CANCELLED", "COMPLETED",
]);

export const agendaEventsTable = pgTable("agenda_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  showBookId: uuid("show_book_id").references(() => showBooksTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  type: agendaEventTypeEnum("type").notNull(),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  startTime: time("start_time"),
  endTime: time("end_time"),
  location: text("location"),
  notes: text("notes"),
  status: agendaEventStatusEnum("status").notNull().default("DRAFT"),
  reason: text("reason"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  confirmedBy: uuid("confirmed_by").references(() => usersTable.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  suspendedBy: uuid("suspended_by").references(() => usersTable.id),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  canceledBy: uuid("canceled_by").references(() => usersTable.id),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgendaEventSchema = createInsertSchema(agendaEventsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertAgendaEvent = z.infer<typeof insertAgendaEventSchema>;
export type AgendaEvent = typeof agendaEventsTable.$inferSelect;
