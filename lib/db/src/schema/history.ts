import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationalChangesTable, actorTypeEnum } from "./operational-change.js";

export const historyEventsTable = pgTable("history_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  moId: uuid("mo_id").notNull().references(() => operationalChangesTable.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorType: actorTypeEnum("actor_type").notNull(),
  action: text("action").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHistoryEventSchema = createInsertSchema(historyEventsTable).omit({ id: true, createdAt: true });
export type InsertHistoryEvent = z.infer<typeof insertHistoryEventSchema>;
export type HistoryEvent = typeof historyEventsTable.$inferSelect;
