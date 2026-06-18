import { pgTable, text, uuid, timestamp, pgEnum, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { operationsTable } from "./organization.js";
import { showBooksTable } from "./showbook.js";

export const agendaEventTypeEnum = pgEnum("agenda_event_type", ["SHOW", "REHEARSAL", "MEETING", "WORKSHOP", "OTHER"]);
export const agendaEventStatusEnum = pgEnum("agenda_event_status", ["DRAFT", "CONFIRMED", "CHANGED", "CANCELLED", "COMPLETED"]);

export const agendaEventsTable = pgTable("agenda_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  showBookId: uuid("show_book_id").references(() => showBooksTable.id),
  type: agendaEventTypeEnum("type").notNull(),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  location: text("location"),
  status: agendaEventStatusEnum("status").notNull().default("DRAFT"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgendaEventSchema = createInsertSchema(agendaEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgendaEvent = z.infer<typeof insertAgendaEventSchema>;
export type AgendaEvent = typeof agendaEventsTable.$inferSelect;
