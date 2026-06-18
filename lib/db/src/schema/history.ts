import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationalChangesTable, actorTypeEnum } from "./operational-change.js";

// ─── History Events ──────────────────────────────────────────────────────────
// Core unit: one entry per relevant operational occurrence.
// category: SCALE | DAILY_BOOK | NOTICE | AGENDA | REQUEST | DELIVERY | MESSAGE | OPERATIONAL_CHANGE

export const historyEventsTable = pgTable("history_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Legacy MO link (nullable — older rows may have it, new ones may not)
  moId: uuid("mo_id").references(() => operationalChangesTable.id),
  // Org + context
  orgId: uuid("org_id"),
  category: text("category").notNull().default("OPERATIONAL_CHANGE"),
  // Human-readable narrative
  title: text("title").notNull().default(""),
  narrative: text("narrative").notNull().default(""),
  // Entity this event refers to
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(), // string — not all refs are UUIDs
  // Actor
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorType: actorTypeEnum("actor_type").notNull().default("HUMAN"),
  actorName: text("actor_name"),
  // Scope
  operationId: uuid("operation_id"),
  groupId: uuid("group_id"),
  // Action (machine label)
  action: text("action").notNull(),
  // State diff (kept for compatibility)
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  // Status
  status: text("status").notNull().default("ACTIVE"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── History Relations ────────────────────────────────────────────────────────
// Directed links between two events: caused_by | resulted_in | related_to

export const historyRelationsTable = pgTable("history_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceEventId: uuid("source_event_id")
    .notNull()
    .references(() => historyEventsTable.id, { onDelete: "cascade" }),
  targetEventId: uuid("target_event_id")
    .notNull()
    .references(() => historyEventsTable.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull().default("related_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── History Narratives (MO Investigation) ───────────────────────────────────
// Structured investigation record: Causa → Decisão → Impacto → Resolução

export const historyNarrativesTable = pgTable("history_narratives", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id"),
  operationId: uuid("operation_id"),
  title: text("title").notNull(),
  category: text("category").notNull().default("OPERATIONAL_CHANGE"),
  cause: text("cause"),
  decision: text("decision"),
  impact: text("impact"),
  resolution: text("resolution"),
  status: text("status").notNull().default("OPEN"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Insert schemas & types ───────────────────────────────────────────────────

export const insertHistoryEventSchema = createInsertSchema(historyEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHistoryEvent = z.infer<typeof insertHistoryEventSchema>;
export type HistoryEvent = typeof historyEventsTable.$inferSelect;

export const insertHistoryNarrativeSchema = createInsertSchema(historyNarrativesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHistoryNarrative = z.infer<typeof insertHistoryNarrativeSchema>;
export type HistoryNarrative = typeof historyNarrativesTable.$inferSelect;
export type HistoryRelation = typeof historyRelationsTable.$inferSelect;
