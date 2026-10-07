import { pgTable, text, uuid, timestamp, integer, pgEnum, boolean, jsonb, date, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { operationsTable, organizationsTable } from "./organization.js";
import { locationsTable } from "./locations.js";
import { usersTable } from "./identity.js";
import { libraryDocumentsTable } from "./library.js";
import { charactersTable } from "./characters.js";

export const showBookStatusEnum = pgEnum("show_book_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
// STRUCTURED permanece apenas para ler livros legados. Todo novo show usa um
// dos três tipos do vocabulário operacional: completo, só personagens ou simples.
export const showBookTypeEnum = pgEnum("show_book_type", ["SIMPLE", "STRUCTURED", "COMPLETE", "CHARACTERS_ONLY"]);
export const showBookLineTypeEnum = pgEnum("show_book_line_type", [
  "FIXED_PERSON", "TITULAR_SUBSTITUTE", "ROTATION", "DAY_OF_WEEK", "FUNCTION", "CHARACTER", "MANUAL",
]);
export const showBookVersionChangeTypeEnum = pgEnum("show_book_version_change_type", ["STRUCTURAL", "CONFIG"]);
export const showBookKeyframeTypeEnum = pgEnum("show_book_keyframe_type", ["inicial", "splice", "locacao", "saida"]);
export const showBookTagCategoryEnum = pgEnum("show_book_tag_category", [
  "ARTISTIC_SKILL", "TECHNICAL_SKILL", "PHYSICAL_REQUIREMENT", "MEDICAL_REQUIREMENT",
  "SAFETY", "PROFESSIONAL_CERTIFICATION", "CHARACTER", "COSTUME", "EQUIPMENT", "SPACE", "ADMINISTRATIVE",
]);

export const showBooksTable = pgTable("show_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  locationId: uuid("location_id").references(() => locationsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  // Informações específicas de cada show (por exemplo, troca entre cenas)
  // não precisam forçar um novo campo de schema para cada produção.
  details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
  type: showBookTypeEnum("type").notNull().default("COMPLETE"),
  usesCharacters: boolean("uses_characters").notNull().default(false),
  version: integer("version").notNull().default(1),
  status: showBookStatusEnum("status").notNull().default("DRAFT"),
  // Horário único do show inteiro (não por bloco). Aditivo e anulável (prod-safe).
  startTime: text("start_time"),
  endTime: text("end_time"),
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
  // 0059: cena reservada com as vagas de personagem do show inteiro (no máximo uma ativa por show).
  isCastRoster: boolean("is_cast_roster").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Quadro-chave pertence à Cena, mas não ganha uma versão própria: a árvore
 * inteira é congelada pelo versionamento já existente do Livro do Show.
 * `type` é nulo durante a montagem de um quadro novo; a única classificação
 * que tem efeito operacional é `inicial`, consumida pelo Livro do Dia.
 */
export const showBookKeyframesTable = pgTable("show_book_keyframes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sceneId: uuid("scene_id").notNull().references(() => showBookScenesTable.id),
  order: integer("order").notNull(),
  name: text("name").notNull(),
  type: showBookKeyframeTypeEnum("type"),
  moment: text("moment"),
  markerPositions: jsonb("marker_positions").$type<Record<string, { x: number; y: number }>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // O endpoint troca o `inicial` anterior na mesma transação. O índice também
  // protege contra escrita concorrente ou importação direta fora da API.
  uniqueIndex("show_book_keyframes_one_initial_per_scene_uq")
    .on(table.sceneId)
    .where(sql`${table.active} AND ${table.type} = 'inicial'`),
]);

/**
 * As zonas descrevem um formato físico de palco, não uma cena. A organização
 * conserva seus próprios presets para que uma alteração em L valha para todos
 * os seus shows em L sem atravessar o isolamento multi-tenant.
 */
export const stageFormatPresetsTable = pgTable("stage_format_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  format: text("format").notNull(),
  zonePositions: jsonb("zone_positions").$type<Record<string, { x: number; y: number }>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("stage_format_presets_organization_format_uq").on(table.organizationId, table.format),
]);

export const showBookBlocksTable = pgTable("show_book_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  sceneId: uuid("scene_id").references(() => showBookScenesTable.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  // Um bloco de cena é também o grupo visual dos slots. A zona decide onde
  // `buildMarkers` desenha o grupo; o prefixo mantém a identidade estável.
  zone: text("zone"),
  prefix: text("prefix"),
  // Cor padrão do grupo; uma posição pode definir um ajuste individual em positionJson.
  color: text("color"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Atalhos externos do acervo do show. O Drive continua sendo a fonte do
 * arquivo; aqui ficam rótulo, contexto e a ordem de consulta. */
export const showBookDriveLinksTable = pgTable("show_book_drive_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  showBookId: uuid("show_book_id").notNull().references(() => showBooksTable.id),
  label: text("label").notNull(),
  url: text("url"),
  type: text("type").notNull(),
  scope: text("scope").notNull(),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
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
  // Dados da posição no palco copiados de uma Formação; não contém pessoa.
  positionJson: jsonb("position_json").$type<Record<string, unknown>>().notNull().default({}),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const showBookLinesTable = pgTable("show_book_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull().references(() => showBookRolesTable.id),
  characterId: uuid("character_id").references(() => charactersTable.id),
  type: showBookLineTypeEnum("type").notNull(),
  config: jsonb("config").notNull().default({}),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Ledger idempotente do avanço de rodízio.
 *
 * `characterId` é uma chave estável de personagem durante a compatibilidade com
 * o modelo legado (pode ser um ID de personagem ou uma chave de migração).
 * O Bloco 2 poderá transformá-la em FK para Personagem sem mudar a regra:
 * uma pessoa soma no máximo uma vez por personagem e por dia.
 */
export const rotationDailyAdvancesTable = pgTable("rotation_daily_advances", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => charactersTable.id),
  legacyCharacterKey: text("legacy_character_key"),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  sourceLineId: uuid("source_line_id").references(() => showBookLinesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("rotation_daily_advances_character_user_date_uq").on(
    table.characterId,
    table.userId,
    table.date,
  ),
]);

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
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userTagsTable = pgTable("user_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  tagId: uuid("tag_id").notNull().references(() => showBookTagsTable.id),
  assignedBy: uuid("assigned_by").notNull().references(() => usersTable.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShowBookSchema = createInsertSchema(showBooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBook = z.infer<typeof insertShowBookSchema>;
export type ShowBook = typeof showBooksTable.$inferSelect;

export const insertShowBookSceneSchema = createInsertSchema(showBookScenesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookScene = z.infer<typeof insertShowBookSceneSchema>;
export type ShowBookScene = typeof showBookScenesTable.$inferSelect;

export const insertShowBookKeyframeSchema = createInsertSchema(showBookKeyframesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookKeyframe = z.infer<typeof insertShowBookKeyframeSchema>;
export type ShowBookKeyframe = typeof showBookKeyframesTable.$inferSelect;
export type StageFormatPreset = typeof stageFormatPresetsTable.$inferSelect;

export const insertShowBookBlockSchema = createInsertSchema(showBookBlocksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookBlock = z.infer<typeof insertShowBookBlockSchema>;
export type ShowBookBlock = typeof showBookBlocksTable.$inferSelect;

export const insertShowBookDriveLinkSchema = createInsertSchema(showBookDriveLinksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookDriveLink = z.infer<typeof insertShowBookDriveLinkSchema>;
export type ShowBookDriveLink = typeof showBookDriveLinksTable.$inferSelect;

export const insertShowBookRoleSchema = createInsertSchema(showBookRolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookRole = z.infer<typeof insertShowBookRoleSchema>;
export type ShowBookRole = typeof showBookRolesTable.$inferSelect;

export const insertShowBookLineSchema = createInsertSchema(showBookLinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShowBookLine = z.infer<typeof insertShowBookLineSchema>;
export type ShowBookLine = typeof showBookLinesTable.$inferSelect;
export type RotationDailyAdvance = typeof rotationDailyAdvancesTable.$inferSelect;

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
  active:     boolean("active").notNull().default(true),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShowBookPositionLibraryRef = typeof showBookPositionLibraryRefsTable.$inferSelect;
