import { pgTable, uuid, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { agendaEventsTable } from "./agenda.js";
import { showBooksTable, showBookRolesTable } from "./showbook.js";

export const dailyBookStatusEnum = pgEnum("daily_book_status", ["DRAFT", "PUBLISHED", "OUTDATED", "CANCELLED"]);
export const positionStatusEnum = pgEnum("position_status", ["COVERED", "AT_RISK", "OPEN"]);

export const dailyBooksTable = pgTable("daily_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  agendaEventId: uuid("agenda_event_id").notNull().references(() => agendaEventsTable.id),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  version: integer("version").notNull().default(1),
  status: dailyBookStatusEnum("status").notNull().default("DRAFT"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: uuid("published_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyBookPositionsTable = pgTable("daily_book_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyBookId: uuid("daily_book_id").notNull().references(() => dailyBooksTable.id),
  showBookRoleId: uuid("show_book_role_id").notNull().references(() => showBookRolesTable.id),
  userId: uuid("user_id").references(() => usersTable.id),
  status: positionStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyBookSchema = createInsertSchema(dailyBooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyBook = z.infer<typeof insertDailyBookSchema>;
export type DailyBook = typeof dailyBooksTable.$inferSelect;

export const insertDailyBookPositionSchema = createInsertSchema(dailyBookPositionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyBookPosition = z.infer<typeof insertDailyBookPositionSchema>;
export type DailyBookPosition = typeof dailyBookPositionsTable.$inferSelect;
