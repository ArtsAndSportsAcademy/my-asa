import { pgTable, text, uuid, timestamp, integer, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { operationsTable } from "./organization.js";
import { usersTable } from "./identity.js";
import { libraryDocumentsTable } from "./library.js";

export const showBookStatusEnum = pgEnum("show_book_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const showBookTypeEnum = pgEnum("show_book_type", ["SIMPLE", "STRUCTURED"]);
export const showBookLineTypeEnum = pgEnum("show_book_line_type", [
  "FIXED_PERSON", "TITULAR_SUBSTITUTE", "ROTATION", "DAY_OF_WEEK", "FUNCTION", "CHARACTER", "MANUAL",
]);
export const showBookVersionChangeTypeEnum = pgEnum("show_book_version_change_type", ["STRUCTURAL", "CONFIG"]);
export const showBookTagCategoryEnum = pgEnum("show_book_tag_category", [
  "ARTISTIC_SKILL", "TECHNICAL_SKILL", "PHYSICAL_REQUIREMENT", "MEDICAL_REQUIREMENT",
  "SAFETY", "PROFESSIONAL_CERTIFICATION", "CHARACTER", "COSTUME", "EQUIPMENT", "SPACE", "ADMINISTRATIVE",
]);

export const showBooksTable = pgTable("show_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  type: showBookTypeEnum("type").notNull().default("STRUCTURED"),
  version: integer("version").notNull().default(1),
  status: showBookStatusEnum("status").notNull().default("DRAFT"),
  // Responsável por este show (supervisor). Null = sem responsável definido → comportamento
  // legado por operação (qualquer gestor da operação opera). Aditivo e anulável (prod-safe).
  responsibleId: uuid("responsible_id").references(() => usersTable.id),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookScenesTable = pgTable("show_book_scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookBlocksTable = pgTable("show_book_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  sceneId: uuid("scene_id").references(() => showBookScenesTable.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookRolesTable = pgTable("show_book_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  blockId: uuid("block_id").references(() => showBookBlocksTable.id),
  name: text("name").notNull(),
  minimumCoverage: integer("minimum_coverage").notNull().default(1),
  tagsJson: jsonb("tags_json").$type<string[]>().default([]),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookLinesTable = pgTable("show_book_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull().references(() => showBookRolesTable.id),
  type: showBookLineTypeEnum("type").notNull(),
  config: jsonb("config").notNull().default({}),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookVersionsTable = pgTable("show_book_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  version: integer("version").notNull(),
  changeType: showBookVersionChangeTypeEnum("change_type").notNull(),
  reason: text("reason").notNull(),
  snapshot: jsonb("snapshot").notNull().default({}),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookTagsTable = pgTable("show_book_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  category: showBookTagCategoryEnum("category").notNull(),
  label: text("label").notNull(),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userTagsTable = pgTable("user_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  tagId: uuid("tag_id").notNull().references(() => showBookTagsTable.id),
  assignedBy: uuid("assigned_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShowBookSchema = createInsertSchema(showBooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBook = z.infer<typeof insertShowBookSchema>;
export type ShowBook = typeof showBooksTable.$inferSelect;

export const insertShowBookSceneSchema = createInsertSchema(showBookScenesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookScene = z.infer<typeof insertShowBookSceneSchema>;
export type ShowBookScene = typeof showBookScenesTable.$inferSelect;

export const insertShowBookBlockSchema = createInsertSchema(showBookBlocksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookBlock = z.infer<typeof insertShowBookBlockSchema>;
export type ShowBookBlock = typeof showBookBlocksTable.$inferSelect;

export const insertShowBookRoleSchema = createInsertSchema(showBookRolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookRole = z.infer<typeof insertShowBookRoleSchema>;
export type ShowBookRole = typeof showBookRolesTable.$inferSelect;

export const insertShowBookLineSchema = createInsertSchema(showBookLinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookLine = z.infer<typeof insertShowBookLineSchema>;
export type ShowBookLine = typeof showBookLinesTable.$inferSelect;

export const insertShowBookVersionSchema = createInsertSchema(showBookVersionsTable).omit({ id: true, createdAt: true });
export type InsertShowBookVersion = z.infer<typeof insertShowBookVersionSchema>;
export type ShowBookVersion = typeof showBookVersionsTable.$inferSelect;

export const insertShowBookTagSchema = createInsertSchema(showBookTagsTable).omit({ id: true, createdAt: true });
export type InsertShowBookTag = z.infer<typeof insertShowBookTagSchema>;
export type ShowBookTag = typeof showBookTagsTable.$inferSelect;

export const insertUserTagSchema = createInsertSchema(userTagsTable).omit({ id: true, createdAt: true });
export type InsertUserTag = z.infer<typeof insertUserTagSchema>;
export type UserTag = typeof userTagsTable.$inferSelect;

export const showBookPositionLibraryRefsTable = pgTable("show_book_position_library_refs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull().references(() => showBookRolesTable.id, { onDelete: "cascade" }),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id,    { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => libraryDocumentsTable.id),
  label:      text("label"),
  addedBy:    uuid("added_by").notNull().references(() => usersTable.id),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShowBookPositionLibraryRef = typeof showBookPositionLibraryRefsTable.$inferSelect;
