import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./identity.js";
import { operationsTable, operationalGroupsTable } from "./organization.js";

/**
 * Atividades recorrentes (ou avulsas) que se juntam à Escala em tempo de leitura.
 * Os horários e dias vivem em `recurring_activity_schedules` (múltiplos por atividade).
 * As pessoas são definidas em `recurring_activity_assignees` (por utilizador OU grupo).
 */
export const recurringActivitiesTable = pgTable("recurring_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  operationId: uuid("operation_id")
    .notNull()
    .references(() => operationsTable.id),
  title: text("title").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Horários de uma atividade — cada linha é uma combinação de dia + horário.
 * - Recorrente: `weekday` preenchido (0=domingo … 6=sábado), `specificDate` null.
 * - Avulsa:     `specificDate` preenchido (YYYY-MM-DD), `weekday` null.
 * Uma atividade pode ter N schedules (ex.: Seg+Qui+Sáb, ou Seg 8h e Seg 14h).
 */
export const recurringActivitySchedulesTable = pgTable("recurring_activity_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => recurringActivitiesTable.id, { onDelete: "cascade" }),
  weekday: integer("weekday"),
  specificDate: text("specific_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Designados de uma atividade: cada linha aponta para um utilizador OU um grupo. */
export const recurringActivityAssigneesTable = pgTable("recurring_activity_assignees", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => recurringActivitiesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RecurringActivity = typeof recurringActivitiesTable.$inferSelect;
export type RecurringActivitySchedule = typeof recurringActivitySchedulesTable.$inferSelect;
export type RecurringActivityAssignee = typeof recurringActivityAssigneesTable.$inferSelect;
