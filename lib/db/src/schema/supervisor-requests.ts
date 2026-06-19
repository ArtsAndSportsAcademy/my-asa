import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";
import { agendaEventsTable } from "./agenda.js";

export const supervisorRequestsTable = pgTable("supervisor_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestorId: uuid("requestor_id").notNull().references(() => usersTable.id),
  requestorOperationId: uuid("requestor_operation_id").notNull().references(() => operationsTable.id),
  targetSupervisorId: uuid("target_supervisor_id").references(() => usersTable.id),
  targetOperationId: uuid("target_operation_id").notNull().references(() => operationsTable.id),
  memberId: uuid("member_id").notNull().references(() => usersTable.id),
  agendaEventId: uuid("agenda_event_id").references(() => agendaEventsTable.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PENDING"),
  responseReason: text("response_reason"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  respondedBy: uuid("responded_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSupervisorRequestSchema = createInsertSchema(supervisorRequestsTable).omit({
  id: true, createdAt: true, respondedAt: true,
});
export type InsertSupervisorRequest = z.infer<typeof insertSupervisorRequestSchema>;
export type SupervisorRequest = typeof supervisorRequestsTable.$inferSelect;
