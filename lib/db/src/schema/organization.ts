import { pgTable, text, uuid, timestamp, jsonb, pgEnum, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";

export const operationStatusEnum = pgEnum("operation_status", ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
export const groupStatusEnum = pgEnum("group_status", ["ACTIVE", "INACTIVE", "ARCHIVED"]);
// Abrangência do grupo: OPERATION = uma operação; MULTI = várias operações escolhidas; ALL = todas as operações da organização.
export const groupScopeEnum = pgEnum("group_scope", ["OPERATION", "MULTI", "ALL"]);

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationsTable = pgTable("operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  clientName: text("client_name"),
  locations: jsonb("locations").$type<string[]>().notNull().default([]),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  color: text("color").notNull().default("#6D4AFF"),
  icon: text("icon").notNull().default("sparkles"),
  localCoordinatorId: uuid("local_coordinator_id").references(() => usersTable.id),
  status: operationStatusEnum("status").notNull().default("ACTIVE"),
  healthThresholds: jsonb("health_thresholds"),
  lateThresholdMinutes: integer("late_threshold_minutes").notNull().default(15),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationalGroupsTable = pgTable("operational_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  // Para grupos OPERATION é a operação dona. Nulo para grupos amplos (MULTI/ALL).
  operationId: uuid("operation_id").references(() => operationsTable.id),
  scope: groupScopeEnum("scope").notNull().default("OPERATION"),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6D4AFF"),
  icon: text("icon").notNull().default("users"),
  status: groupStatusEnum("status").notNull().default("ACTIVE"),
  supervisorId: uuid("supervisor_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Operações cobertas por grupos amplos de escopo MULTI (uma linha por operação coberta).
export const groupOperationsTable = pgTable("group_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => operationalGroupsTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const insertOperationSchema = createInsertSchema(operationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operationsTable.$inferSelect;

export const insertOperationalGroupSchema = createInsertSchema(operationalGroupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOperationalGroup = z.infer<typeof insertOperationalGroupSchema>;
export type OperationalGroup = typeof operationalGroupsTable.$inferSelect;

export const insertGroupOperationSchema = createInsertSchema(groupOperationsTable).omit({ id: true, createdAt: true });
export type InsertGroupOperation = z.infer<typeof insertGroupOperationSchema>;
export type GroupOperation = typeof groupOperationsTable.$inferSelect;
