import { pgTable, uuid, text, integer, time, date, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./identity.js";
import { locationsTable } from "./locations.js";

/**
 * Restrição de horário (0071): a pessoa só pode trabalhar na janela [horaInicio, horaFim], nos dias da
 * semana listados (0 = domingo … 6 = sábado), dentro do período. É proibição no motor do Livro do Dia;
 * a exceção é a mexida à mão com motivo escrito. Encerrar não apaga: `status` vira ENDED.
 */
export const restricoesHorarioTable = pgTable("restricoes_horario", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  diasSemana: integer("dias_semana").array().notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFim: time("hora_fim").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }),
  motivo: text("motivo").notNull(),
  status: text("status").$type<"ACTIVE" | "ENDED">().notNull().default("ACTIVE"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedBy: uuid("ended_by").references(() => usersTable.id),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => [
  check("restricoes_horario_fim_depois_inicio_ck", sql`${table.horaFim} > ${table.horaInicio}`),
  index("restricoes_horario_user_ativa_idx").on(table.userId).where(sql`${table.status} = 'ACTIVE'`),
]);

/** Regras de escala por local (0071): limite de shows por pessoa por dia (null = sem limite) e intervalo de "colados". */
export const escalaRegrasLocalTable = pgTable("escala_regras_local", {
  locationId: uuid("location_id").primaryKey().references(() => locationsTable.id),
  limiteShowsDia: integer("limite_shows_dia"),
  intervaloMinimoMinutos: integer("intervalo_minimo_minutos").notNull().default(20),
  updatedBy: uuid("updated_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RestricaoHorario = typeof restricoesHorarioTable.$inferSelect;
export type EscalaRegrasLocal = typeof escalaRegrasLocalTable.$inferSelect;
