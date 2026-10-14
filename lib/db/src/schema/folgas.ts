import { pgTable, text, uuid, timestamp, pgEnum, date, integer, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";
import { requestsTable } from "./requests.js";

export const folgaTypeEnum = pgEnum("folga_type", [
  "DAY_OFF", "NO_SHOW", "RECESSO", "AFASTAMENTO", "RESTRICAO", "OUTRO",
]);

export const folgaStatusEnum = pgEnum("folga_status", [
  "ACTIVE", "CANCELLED",
]);

export const folgaOrigemEnum = pgEnum("folga_origem", [
  "MANUAL", "SOLICITACAO",
]);

export const folgasTable = pgTable("folgas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  type:        folgaTypeEnum("type").notNull().default("DAY_OFF"),
  startDate:   date("start_date", { mode: "string" }).notNull(),
  endDate:     date("end_date",   { mode: "string" }).notNull(),
  status:      folgaStatusEnum("status").notNull().default("ACTIVE"),
  origem:      folgaOrigemEnum("origem").notNull().default("MANUAL"),
  requestId:   uuid("request_id").references(() => requestsTable.id),
  createdBy:   uuid("created_by").notNull().references(() => usersTable.id),
  notes:       text("notes"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Folga = typeof folgasTable.$inferSelect;

/**
 * Grupo de folga — na alta temporada as duas folgas da semana são fixas por grupo (regra da Babi).
 * O grupo guarda só o PADRÃO: as pessoas e os dois dias de folga. O período se escolhe ao aplicar,
 * porque os grupos mudam a cada ano (dependem de quem faz o quê no show) — não é molde permanente.
 * Aplicar um grupo é marcar a folga daqueles dois dias da semana, para aquelas pessoas, no período
 * escolhido; por baixo reusa o mesmo caminho do "Definir folga" em lote.
 * É por equipe: cada supervisor cuida do grupo da sua equipe; a Administração vê e edita todos.
 */
export const folgaGruposTable = pgTable("folga_grupos", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  nome: text("nome").notNull(),
  // 0 = domingo … 6 = sábado. Os dois dias de folga fixos do grupo.
  diasFolga: integer("dias_folga").array().notNull().default(sql`'{}'::integer[]`),
  pessoaIds: uuid("pessoa_ids").array().notNull().default(sql`'{}'::uuid[]`),
  tipo: folgaTypeEnum("tipo").notNull().default("DAY_OFF"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("folga_grupos_dias_ck", sql`${table.diasFolga} <@ ARRAY[0,1,2,3,4,5,6]`),
]);

export type FolgaGrupo = typeof folgaGruposTable.$inferSelect;
