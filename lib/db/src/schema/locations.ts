import { pgTable, text, uuid, timestamp, boolean, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organization.js";

/** Local físico da operação. Mantém o local ativo sem apagar seu histórico. */
export const locationsTable = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("parque"),
  operatingDays: jsonb("operating_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5, 6, 0]),
  openTime: text("open_time").notNull().default("08:00"),
  closeTime: text("close_time").notNull().default("22:00"),
  closed: boolean("closed").notNull().default(false),
  closedReason: text("closed_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("locations_organization_name_uq").on(table.organizationId, table.name),
]);

export const insertLocationSchema = createInsertSchema(locationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;
