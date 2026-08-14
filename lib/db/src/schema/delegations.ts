import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";
import { showBooksTable } from "./showbook.js";

export type DelegatedResponsibility =
  | "CHECK_INS"
  | "REQUESTS"
  | "TASK_APPROVALS"
  | "DAILY_BOOK"
  | "NOTICES"
  | "OPERATIONAL_MESSAGES"
  | "SCALES";

export const ALL_RESPONSIBILITIES: DelegatedResponsibility[] = [
  "CHECK_INS",
  "REQUESTS",
  "TASK_APPROVALS",
  "DAILY_BOOK",
  "NOTICES",
  "OPERATIONAL_MESSAGES",
  "SCALES",
];

export const delegationsTable = pgTable("delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  delegatorId: uuid("delegator_id").notNull().references(() => usersTable.id),
  delegateeId: uuid("delegatee_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  // Quando definido, a delegação aplica-se APENAS a este Livro do Show (capitão de um show).
  // Null = delegação ao nível da operação inteira (comportamento legado, retrocompatível).
  showBookId: uuid("show_book_id").references(() => showBooksTable.id),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  // Nulo representa uma delegacao permanente, ate revogacao explicita.
  validUntil: timestamp("valid_until", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  reason: text("reason"),
  responsibilities: text("responsibilities").array().notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Delegation = typeof delegationsTable.$inferSelect;
