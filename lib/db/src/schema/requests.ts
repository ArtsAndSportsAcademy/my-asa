import { pgTable, text, uuid, timestamp, pgEnum, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable, organizationsTable } from "./organization.js";
import { areasTable } from "./areas.js";
import { locationsTable } from "./locations.js";

export const requestTypeEnum = pgEnum("request_type", [
  "LEAVE", "ROLE_RESTRICTION", "PHYSICAL_RESTRICTION",
  "HEALTH_RESTRICTION", "SCHEDULE_CHANGE", "SWAP", "OTHER",
  // Horário na escala para algo da pessoa (peruca, gravar vídeo…): aprovado, vira bloco da Escala do dia.
  "ESCALA_SLOT",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "PENDING", "APPROVED", "DENIED",
  "ALTERNATIVE_PROPOSED", "ALTERNATIVE_ACCEPTED", "ALTERNATIVE_REJECTED", "EXPIRED",
  // Troca: o colega aceita antes de a Supervisão decidir. Cancelado: a própria pessoa desistiu.
  "WAITING_PEER", "CANCELLED",
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
  // Tela Solicitações (0051).
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  areaId: uuid("area_id").references(() => areasTable.id),
  locationId: uuid("location_id").references(() => locationsTable.id),
  peerId: uuid("peer_id").references(() => usersTable.id),
  peerRespondedAt: timestamp("peer_responded_at", { withTimezone: true }),
  subject: text("subject"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  decidedBy: uuid("decided_by").references(() => usersTable.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionReason: text("decision_reason"),
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
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;

export const insertRequestDecisionSchema = createInsertSchema(requestDecisionsTable).omit({ id: true, createdAt: true });
export type InsertRequestDecision = z.infer<typeof insertRequestDecisionSchema>;
export type RequestDecision = typeof requestDecisionsTable.$inferSelect;
