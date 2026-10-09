import { pgTable, text, uuid, timestamp, integer, boolean, date, time, check, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizationsTable } from "./organization.js";
import { locationsTable } from "./locations.js";
import { usersTable } from "./identity.js";
import { showBooksTable } from "./showbook.js";
import { scalesTable } from "./scale.js";
import { areasTable } from "./areas.js";

/**
 * Programação — o molde da Escala de um local (tela 15, aba Programação).
 * Um molde tem nome ("Natal", "Normal", "Baixa"…), local e vigência; os blocos dizem, por dia
 * da semana, o horário, o rótulo do vocabulário da escala e a regra de quem entra.
 * Não é `recurring_activities`: aquela tabela não tem vigência, local, nem regra por bloco.
 */
export const programacoesTable = pgTable("programacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  nome: text("nome").notNull(),
  vigenciaInicio: date("vigencia_inicio", { mode: "string" }).notNull(),
  vigenciaFim: date("vigencia_fim", { mode: "string" }).notNull(),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("programacoes_vigencia_ck", sql`${table.vigenciaFim} >= ${table.vigenciaInicio}`),
  index("programacoes_local_vigencia_idx").on(table.locationId, table.vigenciaInicio, table.vigenciaFim),
]);

/** Regras de quem entra num bloco. `livro`: o elenco é o do Livro do Dia daquele show. */
export const REGRAS_BLOCO = ["todos", "ninguem", "area", "grupo", "pessoas", "livro"] as const;
export type RegraBloco = typeof REGRAS_BLOCO[number];

export const programacaoBlocosTable = pgTable("programacao_blocos", {
  id: uuid("id").primaryKey().defaultRandom(),
  programacaoId: uuid("programacao_id").notNull().references(() => programacoesTable.id),
  // 0 = domingo … 6 = sábado
  weekday: integer("weekday").notNull(),
  inicio: time("inicio").notNull(),
  fim: time("fim"),
  rotulo: text("rotulo").notNull(),
  regra: text("regra").$type<RegraBloco>().notNull(),
  showBookId: uuid("show_book_id").references(() => showBooksTable.id),
  areaIds: uuid("area_ids").array().notNull().default(sql`'{}'::uuid[]`),
  grupoIds: uuid("grupo_ids").array().notNull().default(sql`'{}'::uuid[]`),
  pessoaIds: uuid("pessoa_ids").array().notNull().default(sql`'{}'::uuid[]`),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("programacao_blocos_weekday_ck", sql`${table.weekday} BETWEEN 0 AND 6`),
  check("programacao_blocos_fim_ck", sql`${table.fim} IS NULL OR ${table.fim} > ${table.inicio}`),
  check("programacao_blocos_regra_ck", sql`${table.regra} IN ('todos','ninguem','area','grupo','pessoas','livro')`),
  check("programacao_blocos_livro_show_ck", sql`${table.regra} <> 'livro' OR ${table.showBookId} IS NOT NULL`),
  index("programacao_blocos_programacao_weekday_idx").on(table.programacaoId, table.weekday),
]);

/**
 * A Supervisão marca a parte da área dela como pronta na Escala do dia (uma por local e dia).
 * Desmarcar não apaga: a linha fica inativa, com quem desmarcou.
 */
export const escalaAreasProntasTable = pgTable("escala_areas_prontas", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id),
  areaId: uuid("area_id").notNull().references(() => areasTable.id),
  markedBy: uuid("marked_by").notNull().references(() => usersTable.id),
  markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  unmarkedBy: uuid("unmarked_by").references(() => usersTable.id),
  unmarkedAt: timestamp("unmarked_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("escala_areas_prontas_active_uq").on(table.scaleId, table.areaId).where(sql`${table.active}`),
]);

/**
 * Ajuste pontual da grade de um dia. A Programação continua sendo o molde e o Livro do Dia
 * continua sendo a fonte dos blocos de show; esta tabela apenas diz quem entra ou sai de uma
 * célula específica daquela Escala. `sourceKey` é a chave estável devolvida pelo resolvedor
 * (p:<bloco da Programação> ou l:<Livro do Dia>:<horário>).
 */
export const escalaBlocoAjustesTable = pgTable("escala_bloco_ajustes", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  action: text("action").$type<"ADICIONAR" | "REMOVER">().notNull(),
  /** Por que a exceção foi feita. Obrigatório quando a pessoa está de folga naquele dia. */
  motivo: text("motivo"),
  /** Chamada mesmo de folga: sem isto, folga continua vencendo e a pessoa não entra na grade. */
  mesmoDeFolga: boolean("mesmo_de_folga").notNull().default(false),
  /** Quando a Administração ou a Supervisão decidiu o que fazer com a folga perdida. */
  folgaDecididaEm: timestamp("folga_decidida_em", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedBy: uuid("ended_by").references(() => usersTable.id),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => [
  check("escala_bloco_ajustes_action_ck", sql`${table.action} IN ('ADICIONAR','REMOVER')`),
  uniqueIndex("escala_bloco_ajustes_active_uq").on(table.scaleId, table.sourceKey, table.userId).where(sql`${table.active}`),
  index("escala_bloco_ajustes_scale_source_idx").on(table.scaleId, table.sourceKey),
]);

/** Leitura confirmada da versão publicada da Escala pela própria pessoa. */
export const escalaConfirmacoesTable = pgTable("escala_confirmacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  scaleId: uuid("scale_id").notNull().references(() => scalesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  version: integer("version").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("escala_confirmacoes_scale_user_uq").on(table.scaleId, table.userId),
]);

export type Programacao = typeof programacoesTable.$inferSelect;
export type ProgramacaoBloco = typeof programacaoBlocosTable.$inferSelect;
export type EscalaAreaPronta = typeof escalaAreasProntasTable.$inferSelect;
export type EscalaBlocoAjuste = typeof escalaBlocoAjustesTable.$inferSelect;
export type EscalaConfirmacao = typeof escalaConfirmacoesTable.$inferSelect;
