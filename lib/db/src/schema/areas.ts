import { boolean, index, pgTable, timestamp, uniqueIndex, uuid, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organization.js";
import { locationsTable } from "./locations.js";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";

/** Área operacional independente dos grupos legados de uma operação. */
export const areasTable = pgTable("areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("areas_organization_name_active_uq")
    .on(table.organizationId, table.name)
    .where(sql`${table.active}`),
]);

/** Vínculo explícito: a supervisão pertence à combinação área + local. */
export const areaLocalSupervisorsTable = pgTable("area_local_supervisors", {
  id: uuid("id").primaryKey().defaultRandom(),
  areaId: uuid("area_id").notNull().references(() => areasTable.id),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  supervisorId: uuid("supervisor_id").notNull().references(() => usersTable.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("area_local_supervisors_active_pair_uq")
    .on(table.areaId, table.locationId)
    .where(sql`${table.active}`),
  index("area_local_supervisors_supervisor_idx").on(table.supervisorId),
]);

/** Substitui gradualmente o JSON de locais da Operação sem apagar o legado. */
export const operationLocationsTable = pgTable("operation_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("operation_locations_active_pair_uq")
    .on(table.operationId, table.locationId)
    .where(sql`${table.active}`),
]);

export const insertAreaSchema = createInsertSchema(areasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areasTable.$inferSelect;
export type AreaLocalSupervisor = typeof areaLocalSupervisorsTable.$inferSelect;
