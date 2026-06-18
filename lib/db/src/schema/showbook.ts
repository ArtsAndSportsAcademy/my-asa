import { pgTable, text, uuid, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { operationsTable } from "./organization.js";

export const showBookStatusEnum = pgEnum("show_book_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const showBooksTable = pgTable("show_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  title: text("title").notNull(),
  version: integer("version").notNull().default(1),
  status: showBookStatusEnum("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookBlocksTable = pgTable("show_book_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookRolesTable = pgTable("show_book_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  blockId: uuid("block_id").references(() => showBookBlocksTable.id),
  name: text("name").notNull(),
  minimumCoverage: integer("minimum_coverage").notNull().default(1),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShowBookSchema = createInsertSchema(showBooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBook = z.infer<typeof insertShowBookSchema>;
export type ShowBook = typeof showBooksTable.$inferSelect;

export const insertShowBookBlockSchema = createInsertSchema(showBookBlocksTable).omit({ id: true, createdAt: true });
export type InsertShowBookBlock = z.infer<typeof insertShowBookBlockSchema>;
export type ShowBookBlock = typeof showBookBlocksTable.$inferSelect;

export const insertShowBookRoleSchema = createInsertSchema(showBookRolesTable).omit({ id: true, createdAt: true });
export type InsertShowBookRole = z.infer<typeof insertShowBookRoleSchema>;
export type ShowBookRole = typeof showBookRolesTable.$inferSelect;
