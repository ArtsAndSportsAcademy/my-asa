import { pgTable, text, uuid, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";

export const moTypeEnum = pgEnum("mo_type", [
  "MO_PUBLICACAO_ESCALA",
  "MO_APROVACAO_FOLGA",
  "MO_NOVA_RESTRICAO",
  "MO_CANCELAMENTO_SHOW",
  "MO_SUBSTITUICAO",
  "MO_AJUSTE_ESCALA",
  "MO_PUBLICACAO_LIVRO_DIA",
  "MO_REPUBLICACAO_LIVRO_DIA",
  "MO_CANCELAMENTO_SOLICITACAO",
  "MO_DELEGACAO_CRIADA",
  "MO_DELEGACAO_EXPIRADA",
  "MO_RESTRICAO_CRIADA",
  "MO_RESTRICAO_EXPIRADA",
  "MO_MEMBRO_ADICIONADO",
  "MO_PAPEL_ALTERADO",
]);

export const actorTypeEnum = pgEnum("actor_type", [
  "HUMAN",
  "DETERMINISTIC_ENGINE",
  "LLM_CONFIRMED",
]);

export const operationalChangesTable = pgTable("operational_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: moTypeEnum("type").notNull(),
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorType: actorTypeEnum("actor_type").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  triggeredByType: text("triggered_by_type"),
  triggeredById: uuid("triggered_by_id"),
  affectedEntities: jsonb("affected_entities").notNull().default("[]"),
  context: jsonb("context").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOperationalChangeSchema = createInsertSchema(operationalChangesTable).omit({ id: true, createdAt: true });
export type InsertOperationalChange = z.infer<typeof insertOperationalChangeSchema>;
export type OperationalChange = typeof operationalChangesTable.$inferSelect;
