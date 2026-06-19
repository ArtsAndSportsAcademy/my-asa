import { pgTable, text, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";

export const delegationStatusEnum = pgEnum("delegation_status", [
  "PENDING", "ACTIVE", "EXPIRED", "CANCELLED",
]);

export const delegationsTable = pgTable("delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  supervisorId: uuid("supervisor_id").notNull().references(() => usersTable.id),
  delegateId: uuid("delegate_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  reason: text("reason"),
  status: delegationStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Delegation = typeof delegationsTable.$inferSelect;
