import { pgTable, text, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
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
