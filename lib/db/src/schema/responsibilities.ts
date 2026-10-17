import { pgTable, text, uuid, timestamp, boolean, pgEnum, integer, date, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable, operationsTable } from "./organization.js";
import { usersTable } from "./identity.js";
import { areasTable } from "./areas.js";
import { tasksTable } from "./tasks.js";

export const RESPONSIBILITY_CATEGORIES = [
  "OPERAÇÃO",
  "TREINAMENTO",
  "MANUTENÇÃO",
  "COMUNICAÇÃO",
  "ARTÍSTICO",
  "EQUIPAMENTOS",
  "ADMINISTRATIVO",
] as const;
export type ResponsibilityCategory = (typeof RESPONSIBILITY_CATEGORIES)[number];

export const responsibilityAssignmentRoleEnum = pgEnum("responsibility_assignment_role", [
  "PRIMARY",
  "SECONDARY",
  "VIEWER",
]);

export const responsibilitiesTable = pgTable("responsibilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id),
  operationId: uuid("operation_id").references(() => operationsTable.id),
  areaId: uuid("area_id").references(() => areasTable.id),
  ownerId: uuid("owner_id").references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("OPERAÇÃO"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const responsibilityAssignmentsTable = pgTable("responsibility_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  responsibilityId: uuid("responsibility_id").notNull().references(() => responsibilitiesTable.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => usersTable.id),
  role: responsibilityAssignmentRoleEnum("role").notNull().default("PRIMARY"),
  substituteMemberId: uuid("substitute_member_id").references(() => usersTable.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});


// ─── Pedidos às responsabilidades ─────────────────────────────────────────────

/** Alguém pede algo escolhendo a responsabilidade; quem cuida dela aceita (um aceita e o pedido vira tarefa) ou recusa. */
export const responsibilityRequestsTable = pgTable("responsibility_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id),
  responsibilityId: uuid("responsibility_id").notNull().references(() => responsibilitiesTable.id),
  requesterId: uuid("requester_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  details: text("details"),
  dueDate: date("due_date", { mode: "string" }),
  status: text("status").$type<"OPEN" | "ACCEPTED" | "DECLINED" | "CANCELLED">().notNull().default("OPEN"),
  acceptedById: uuid("accepted_by_id").references(() => usersTable.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  taskId: uuid("task_id").references(() => tasksTable.id),
  /** A responsabilidade não tinha ninguém cuidando: o pedido foi para a Administração. */
  semDono: boolean("sem_dono").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const responsibilityRequestRecipientsTable = pgTable("responsibility_request_recipients", {
  requestId: uuid("request_id").notNull().references(() => responsibilityRequestsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  declineReason: text("decline_reason"),
}, (table) => [primaryKey({ columns: [table.requestId, table.userId] })]);

// ─── Lista fixa ───────────────────────────────────────────────────────────────

export type RepeatKind = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "EVERY_N_DAYS";

/** Um item da lista fixa da responsabilidade: o que se faz sempre. Pode voltar sozinho, conforme a repetição escolhida. */
export const responsibilityRoutinesTable = pgTable("responsibility_routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  responsibilityId: uuid("responsibility_id").notNull().references(() => responsibilitiesTable.id),
  title: text("title").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id),
  repeatKind: text("repeat_kind").$type<RepeatKind>().notNull().default("NONE"),
  repeatN: integer("repeat_n"),
  /** 0 = domingo … 6 = sábado (só para a repetição semanal). */
  weekday: integer("weekday"),
  done: boolean("done").notNull().default(false),
  lastDoneAt: timestamp("last_done_at", { withTimezone: true }),
  nextDueOn: date("next_due_on", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  removedReason: text("removed_reason"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResponsibilitySchema = createInsertSchema(responsibilitiesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertResponsibilityAssignmentSchema = createInsertSchema(responsibilityAssignmentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Responsibility = typeof responsibilitiesTable.$inferSelect;
export type ResponsibilityAssignment = typeof responsibilityAssignmentsTable.$inferSelect;
export type InsertResponsibility = z.infer<typeof insertResponsibilitySchema>;
export type InsertResponsibilityAssignment = z.infer<typeof insertResponsibilityAssignmentSchema>;
export type ResponsibilityRequest = typeof responsibilityRequestsTable.$inferSelect;
export type ResponsibilityRoutine = typeof responsibilityRoutinesTable.$inferSelect;
