import { pgTable, text, uuid, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable, operationsTable } from "./organization.js";
import { usersTable } from "./identity.js";

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
