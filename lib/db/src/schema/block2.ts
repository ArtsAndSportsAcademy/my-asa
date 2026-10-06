import { pgTable, text, uuid, timestamp, integer, pgEnum, date, time, jsonb, index, check, unique, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { showBooksTable, showBookScenesTable } from "./showbook.js";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  showId: uuid("show_id").notNull().references(() => showBooksTable.id),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  callTime: time("call_time"),
  // A sessão pode voltar na próxima temporada: ela deixa de ser recriada só
  // porque ficou fora de vigência por alguns meses.
  validFrom: date("valid_from", { mode: "string" }),
  validTo: date("valid_to", { mode: "string" }),
  // 0058: dias da semana em que este horário vale (0 = domingo … 6 = sábado). Nulo = todos os dias.
  weekdays: jsonb("weekdays").$type<number[] | null>(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("sessions_show_start_end_uq").on(table.showId, table.startTime, table.endTime),
  check("sessions_end_after_start_ck", sql`${table.endTime} > ${table.startTime}`),
  check("sessions_validity_range_ck", sql`${table.validTo} IS NULL OR ${table.validFrom} IS NULL OR ${table.validTo} >= ${table.validFrom}`),
]);

export const formationsTable = pgTable("formations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  name: text("name").notNull(),
  peopleCount: integer("people_count").notNull(),
  positions: jsonb("positions").notNull().default([]),
  showId: uuid("show_id").references(() => showBooksTable.id),
  // Opcional: quando presente, a Biblioteca navega show → cena → quantidade,
  // como em 14 Livro do Dia.dc.html. Nulo preserva formações só por show
  // (o Bloco 4 as criava assim, antes de a tela 14 pedir a cena).
  sceneId: uuid("scene_id").references(() => showBookScenesTable.id),
  active: boolean("active").notNull().default(true),
  timesUsed: integer("times_used").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("formations_people_count_idx").on(table.peopleCount),
  check("formations_people_count_positive_ck", sql`${table.peopleCount} > 0`),
  check("formations_times_used_nonnegative_ck", sql`${table.timesUsed} >= 0`),
]);

export const occurrenceStateEnum = pgEnum("occurrence_state", ["aberta", "em_analise", "resolvida"]);

export const occurrencesTable = pgTable("occurrences", {
  id: uuid("id").primaryKey().defaultRandom(),
  active: boolean("active").notNull().default(true),
  personId: uuid("person_id").notNull().references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  state: occurrenceStateEnum("state").notNull().default("aberta"),
  registeredBy: uuid("registered_by").notNull().references(() => usersTable.id),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("occurrences_reason_nonblank_ck", sql`btrim(${table.reason}) <> ''`),
  check("occurrences_type_nonblank_ck", sql`btrim(${table.type}) <> ''`),
  check("occurrences_description_nonblank_ck", sql`btrim(${table.description}) <> ''`),
]);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

export const insertFormationSchema = createInsertSchema(formationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFormation = z.infer<typeof insertFormationSchema>;
export type Formation = typeof formationsTable.$inferSelect;

export const insertOccurrenceSchema = createInsertSchema(occurrencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOccurrence = z.infer<typeof insertOccurrenceSchema>;
export type Occurrence = typeof occurrencesTable.$inferSelect;
