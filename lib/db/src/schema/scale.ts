import { pgTable, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationalGroupsTable } from "./organization.js";
import { agendaEventsTable } from "./agenda.js";
import { showBookRolesTable } from "./showbook.js";

export const scaleStatusEnum = pgEnum("scale_status", ["DRAFT", "PUBLISHED"]);
export const allocationStatusEnum = pgEnum("allocation_status", ["ALLOCATED", "AT_RISK", "OPEN"]);

export const scalesTable = pgTable("scales", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => operationalGroupsTable.id),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  status: scaleStatusEnum("status").notNull().default("DRAFT"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: uuid("published_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scaleAllocationsTable = pgTable("scale_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id),
  agendaEventId: uuid("agenda_event_id").notNull().references(() => agendaEventsTable.id),
  showBookRoleId: uuid("show_book_role_id").references(() => showBookRolesTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  status: allocationStatusEnum("status").notNull().default("ALLOCATED"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScaleSchema = createInsertSchema(scalesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScale = z.infer<typeof insertScaleSchema>;
export type Scale = typeof scalesTable.$inferSelect;

export const insertScaleAllocationSchema = createInsertSchema(scaleAllocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScaleAllocation = z.infer<typeof insertScaleAllocationSchema>;
export type ScaleAllocation = typeof scaleAllocationsTable.$inferSelect;
