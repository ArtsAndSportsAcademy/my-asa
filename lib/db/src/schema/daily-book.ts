import { pgTable, text, uuid, timestamp, integer, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { agendaEventsTable } from "./agenda.js";
import { scalesTable } from "./scale.js";
import { showBooksTable } from "./showbook.js";

export const dailyBookStatusEnum = pgEnum("daily_book_status", [
  "DRAFT", "PUBLISHED", "REPUBLISHED", "EXECUTED", "CANCELLED",
]);

export const dailyBookAssignmentStatusEnum = pgEnum("daily_book_assignment_status", [
  "ASSIGNED", "AT_RISK", "OPEN", "REMOVED",
]);

export const dailyBooksTable = pgTable("daily_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  agendaEventId: uuid("agenda_event_id").notNull().references(() => agendaEventsTable.id),
  scaleId: uuid("scale_id").references(() => scalesTable.id),
  showBookId: uuid("show_book_id").references(() => showBooksTable.id),
  status: dailyBookStatusEnum("status").notNull().default("DRAFT"),
  version: integer("version").notNull().default(1),
  snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>().default({}),
  republishDeltaJson: jsonb("republish_delta_json").$type<Record<string, unknown>>(),
  publishComment: text("publish_comment"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: uuid("published_by").references(() => usersTable.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  generatedBy: uuid("generated_by").references(() => usersTable.id),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  executedBy: uuid("executed_by").references(() => usersTable.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: uuid("cancelled_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyBookScenesTable = pgTable("daily_book_scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyBookId: uuid("daily_book_id").notNull().references(() => dailyBooksTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  sourceSceneId: uuid("source_scene_id"),
  isRemoved: boolean("is_removed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyBookBlocksTable = pgTable("daily_book_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyBookId: uuid("daily_book_id").notNull().references(() => dailyBooksTable.id, { onDelete: "cascade" }),
  sceneId: uuid("scene_id").references(() => dailyBookScenesTable.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  sourceBlockId: uuid("source_block_id"),
  isRemoved: boolean("is_removed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyBookPositionsTable = pgTable("daily_book_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyBookId: uuid("daily_book_id").notNull().references(() => dailyBooksTable.id, { onDelete: "cascade" }),
  blockId: uuid("block_id").references(() => dailyBookBlocksTable.id),
  name: text("name").notNull(),
  minimumCoverage: integer("minimum_coverage").notNull().default(1),
  sourceRoleId: uuid("source_role_id"),
  isRemoved: boolean("is_removed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyBookAssignmentsTable = pgTable("daily_book_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyBookId: uuid("daily_book_id").notNull().references(() => dailyBooksTable.id, { onDelete: "cascade" }),
  positionId: uuid("position_id").notNull().references(() => dailyBookPositionsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  status: dailyBookAssignmentStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyBookSchema = createInsertSchema(dailyBooksTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDailyBook = z.infer<typeof insertDailyBookSchema>;
export type DailyBook = typeof dailyBooksTable.$inferSelect;

export const insertDailyBookSceneSchema = createInsertSchema(dailyBookScenesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDailyBookScene = z.infer<typeof insertDailyBookSceneSchema>;
export type DailyBookScene = typeof dailyBookScenesTable.$inferSelect;

export const insertDailyBookBlockSchema = createInsertSchema(dailyBookBlocksTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDailyBookBlock = z.infer<typeof insertDailyBookBlockSchema>;
export type DailyBookBlock = typeof dailyBookBlocksTable.$inferSelect;

export const insertDailyBookPositionSchema = createInsertSchema(dailyBookPositionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDailyBookPosition = z.infer<typeof insertDailyBookPositionSchema>;
export type DailyBookPosition = typeof dailyBookPositionsTable.$inferSelect;

export const insertDailyBookAssignmentSchema = createInsertSchema(dailyBookAssignmentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDailyBookAssignment = z.infer<typeof insertDailyBookAssignmentSchema>;
export type DailyBookAssignment = typeof dailyBookAssignmentsTable.$inferSelect;
