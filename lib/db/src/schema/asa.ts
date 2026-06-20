import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./identity.js";

// ────────────────────────────────────────────────────────────────────────────
// Enums
// ────────────────────────────────────────────────────────────────────────────

export const asaMemoryTypeEnum = pgEnum("asa_memory_type", [
  "PERSONAL",
  "OPERATIONAL",
  "OFFICIAL",
]);

export const asaMemoryStatusEnum = pgEnum("asa_memory_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const asaUserModeEnum = pgEnum("asa_user_mode", [
  "SILENT",
  "BALANCED",
  "PROACTIVE",
]);

// ────────────────────────────────────────────────────────────────────────────
// Memories
// ────────────────────────────────────────────────────────────────────────────

export const asaMemoriesTable = pgTable("asa_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: asaMemoryTypeEnum("type").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  scope: text("scope").notNull(),
  organizationId: uuid("organization_id"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  approvedBy: uuid("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  status: asaMemoryStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAsaMemorySchema = createInsertSchema(asaMemoriesTable).omit({
  id: true,
  approvedBy: true,
  approvedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type AsaMemory = typeof asaMemoriesTable.$inferSelect;
export type InsertAsaMemory = z.infer<typeof insertAsaMemorySchema>;

// ────────────────────────────────────────────────────────────────────────────
// User Preferences
// ────────────────────────────────────────────────────────────────────────────

export const asaUserPreferencesTable = pgTable("asa_user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  mode: asaUserModeEnum("mode").notNull().default("BALANCED"),
  morningGreeting: boolean("morning_greeting").notNull().default(true),
  eveningGreeting: boolean("evening_greeting").notNull().default(false),
  reminders: boolean("reminders").notNull().default(true),
  birthdayAlerts: boolean("birthday_alerts").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  goodMorningTime: text("good_morning_time").default("07:00"),
  goodNightTime: text("good_night_time").default("22:00"),
  messageFrequency: text("message_frequency").default("DAILY"),
  proactivityLevel: text("proactivity_level").default("MEDIUM"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const updateAsaUserPreferencesSchema = createInsertSchema(asaUserPreferencesTable).omit({
  id: true,
  userId: true,
  updatedAt: true,
}).partial();

export type AsaUserPreferences = typeof asaUserPreferencesTable.$inferSelect;

// ────────────────────────────────────────────────────────────────────────────
// Audit Log
// ────────────────────────────────────────────────────────────────────────────

export const asaAuditLogTable = pgTable("asa_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id"),
  organizationId: uuid("organization_id"),
  question: text("question").notNull(),
  response: text("response").notNull(),
  toolsUsed: jsonb("tools_used").$type<string[]>().default([]),
  actionsExecuted: jsonb("actions_executed").$type<Record<string, unknown>[]>().default([]),
  confirmedByUser: boolean("confirmed_by_user").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AsaAuditLog = typeof asaAuditLogTable.$inferSelect;

// ────────────────────────────────────────────────────────────────────────────
// Recognitions
// ────────────────────────────────────────────────────────────────────────────

export const recognitionsTable = pgTable("recognitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Recognition = typeof recognitionsTable.$inferSelect;
