import { pgTable, text, uuid, timestamp, integer, pgEnum, unique, uniqueIndex, check, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { locationsTable } from "./locations.js";

export const characterModeEnum = pgEnum("character_mode", ["titular", "rodizio"]);

export const charactersTable = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  mode: characterModeEnum("mode").notNull(),
  // 0059: vaga que só existe neste show (P1, Boas vindas 1…). Nulo = compartilhado entre shows do
  // local (aba Personagens). A FK para show_books está na migração; aqui fica sem `.references`
  // porque showbook.ts já importa este arquivo e a referência criaria um ciclo de módulos.
  showBookId: uuid("show_book_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("characters_name_location_show_uq")
    .on(table.locationId, table.name, sql`COALESCE(${table.showBookId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
    .where(sql`${table.active}`),
]);

export const characterCastTable = pgTable("character_cast", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => charactersTable.id),
  personId: uuid("person_id").notNull().references(() => usersTable.id),
  order: integer("order").notNull(),
  timesDone: integer("times_done").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("character_cast_character_person_uq").on(table.characterId, table.personId),
  unique("character_cast_character_order_uq").on(table.characterId, table.order),
  check("character_cast_order_nonnegative_ck", sql`${table.order} >= 0`),
  check("character_cast_times_done_nonnegative_ck", sql`${table.timesDone} >= 0`),
]);

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;

export const insertCharacterCastSchema = createInsertSchema(characterCastTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCharacterCast = z.infer<typeof insertCharacterCastSchema>;
export type CharacterCast = typeof characterCastTable.$inferSelect;
