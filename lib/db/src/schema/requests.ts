import { pgTable, text, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";

export const requestTypeEnum = pgEnum("request_type", [
  "LEAVE", "ROLE_RESTRICTION", "PHYSICAL_RESTRICTION",
  "HEALTH_RESTRICTION", "SCHEDULE_CHANGE", "SWAP", "OTHER",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "PENDING", "APPROVED", "DENIED",
  "ALTERNATIVE_PROPOSED", "ALTERNATIVE_ACCEPTED", "ALTERNATIVE_REJECTED", "EXPIRED",
]);
export const requestDecisionEnum = pgEnum("request_decision", [
  "APPROVED", "DENIED", "ALTERNATIVE_PROPOSED",
]);

export const requestsTable = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  type: requestTypeEnum("type").notNull(),
  status: requestStatusEnum("status").notNull().default("PENDING"),
  targetDates: date("target_dates", { mode: "string" }).array().notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const requestDecisionsTable = pgTable("request_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => requestsTable.id),
  supervisorId: uuid("supervisor_id").notNull().references(() => usersTable.id),
  decision: requestDecisionEnum("decision").notNull(),
  reason: text("reason"),
  alternativeDetails: text("alternative_details"),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;

export const insertRequestDecisionSchema = createInsertSchema(requestDecisionsTable).omit({ id: true, createdAt: true });
export type InsertRequestDecision = z.infer<typeof insertRequestDecisionSchema>;
export type RequestDecision = typeof requestDecisionsTable.$inferSelect;
