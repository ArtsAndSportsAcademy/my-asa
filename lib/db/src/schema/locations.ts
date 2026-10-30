import { pgTable, text, uuid, timestamp, boolean, integer, unique, jsonb } from "drizzle-orm/pg-core";
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
  /** Qual dia a Escala mostra ao abrir: a partir desta hora (HH:MM) abre no dia seguinte... */
  escalaAbreAmanhaAPartir: text("escala_abre_amanha_a_partir").notNull().default("18:00"),
  /** ...e a partir desta hora (HH:MM) da manhã volta a abrir em hoje. */
  escalaVoltaAHojeAPartir: text("escala_volta_a_hoje_a_partir").notNull().default("05:00"),
  /** Aviso de tempo disponível na Atenção do dia (0090): ligado ou não, e a partir de quantos minutos sem nada entre duas atividades ele vale. */
  tempoDisponivelLigado: boolean("tempo_disponivel_ligado").notNull().default(true),
  tempoDisponivelMinutos: integer("tempo_disponivel_minutos").notNull().default(30),
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
