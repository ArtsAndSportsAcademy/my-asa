import { pgTable, text, uuid, timestamp, pgEnum, date, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable, operationalGroupsTable } from "./organization.js";
import { agendaEventsTable } from "./agenda.js";
import { showBooksTable, showBookRolesTable } from "./showbook.js";

export const scaleStatusEnum = pgEnum("scale_status", [
  "DRAFT", "PUBLISHED", "REPUBLISHED", "ARCHIVED",
]);

export const allocationStatusEnum = pgEnum("allocation_status", [
  "ASSIGNED", "OPEN", "CONFLICT", "MANUAL_OVERRIDE",
]);

export const allocationExceptionTypeEnum = pgEnum("allocation_exception_type", [
  "NO_CANDIDATE", "RESTRICTION", "CONFLICT", "INSUFFICIENT_COVERAGE", "SUPERVISOR_OVERRIDE",
]);

export const scalesTable = pgTable("scales", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  agendaEventId: uuid("agenda_event_id").references(() => agendaEventsTable.id),
  showBookId: uuid("show_book_id").references(() => showBooksTable.id),
  title: text("title").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  status: scaleStatusEnum("status").notNull().default("DRAFT"),
  publishDeadline: timestamp("publish_deadline", { withTimezone: true }),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  generatedBy: uuid("generated_by").references(() => usersTable.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: uuid("published_by").references(() => usersTable.id),
  republishedAt: timestamp("republished_at", { withTimezone: true }),
  republishedBy: uuid("republished_by").references(() => usersTable.id),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by").references(() => usersTable.id),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scaleAllocationsTable = pgTable("scale_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id, { onDelete: "cascade" }),
  agendaEventId: uuid("agenda_event_id").references(() => agendaEventsTable.id),
  positionId: uuid("position_id").references(() => showBookRolesTable.id),
  userId: uuid("user_id").references(() => usersTable.id),
  status: allocationStatusEnum("status").notNull().default("OPEN"),
  overriddenBy: uuid("overridden_by").references(() => usersTable.id),
  overrideReason: text("override_reason"),
  notes: text("notes"),
  // Campos para entradas manuais (sem evento de agenda)
  manualDate: date("manual_date", { mode: "string" }),
  manualLabel: text("manual_label"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const allocationCandidatesTable = pgTable("allocation_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id, { onDelete: "cascade" }),
  allocationId: uuid("allocation_id").notNull().references(() => scaleAllocationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  rank: integer("rank").notNull(),
  eligible: boolean("eligible").notNull().default(false),
  compatible: boolean("compatible").notNull().default(false),
  priorityScore: integer("priority_score").notNull().default(0),
  rejectionReason: text("rejection_reason"),
  candidateData: jsonb("candidate_data").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const allocationExceptionsTable = pgTable("allocation_exceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id, { onDelete: "cascade" }),
  agendaEventId: uuid("agenda_event_id").references(() => agendaEventsTable.id),
  positionId: uuid("position_id").references(() => showBookRolesTable.id),
  type: allocationExceptionTypeEnum("type").notNull(),
  reason: text("reason").notNull(),
  impact: text("impact"),
  candidatesAnalyzed: jsonb("candidates_analyzed").$type<Record<string, unknown>[]>().default([]),
  resolvedBy: uuid("resolved_by").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScaleSchema = createInsertSchema(scalesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertScale = z.infer<typeof insertScaleSchema>;
export type Scale = typeof scalesTable.$inferSelect;

export const insertScaleAllocationSchema = createInsertSchema(scaleAllocationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertScaleAllocation = z.infer<typeof insertScaleAllocationSchema>;
export type ScaleAllocation = typeof scaleAllocationsTable.$inferSelect;

export const insertAllocationCandidateSchema = createInsertSchema(allocationCandidatesTable).omit({
  id: true, createdAt: true,
});
export type InsertAllocationCandidate = z.infer<typeof insertAllocationCandidateSchema>;
export type AllocationCandidate = typeof allocationCandidatesTable.$inferSelect;

export const insertAllocationExceptionSchema = createInsertSchema(allocationExceptionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertAllocationException = z.infer<typeof insertAllocationExceptionSchema>;
export type AllocationException = typeof allocationExceptionsTable.$inferSelect;
