import { pgTable, text, uuid, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";

export const operationStatusEnum = pgEnum("operation_status", ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
export const groupStatusEnum = pgEnum("group_status", ["ACTIVE", "INACTIVE", "ARCHIVED"]);

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
  status: operationStatusEnum("status").notNull().default("ACTIVE"),
  healthThresholds: jsonb("health_thresholds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationalGroupsTable = pgTable("operational_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  name: text("name").notNull(),
  status: groupStatusEnum("status").notNull().default("ACTIVE"),
  supervisorId: uuid("supervisor_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
