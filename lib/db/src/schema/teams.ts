import { pgTable, text, uuid, timestamp, boolean, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable, operationalGroupsTable } from "./organization.js";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER", "TRAINER"]);
export const restrictionTypeEnum = pgEnum("restriction_type", ["PHYSICAL", "HEALTH", "SCHEDULE", "ROLE", "TECHNICAL", "PERSONAL"]);
export const restrictionStatusEnum = pgEnum("restriction_status", ["ACTIVE", "EXPIRED"]);

export const userRolesTable = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  role: userRoleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// O vinculo com uma equipe e independente do perfil de acesso. Mantemos
// user_roles durante a transicao porque Escalas/Folgas ainda o consultam.
export const teamMembershipsTable = pgTable("team_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => operationalGroupsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  isPrimary: boolean("is_primary").notNull().default(false),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  assignedBy: uuid("assigned_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const restrictionsTable = pgTable("restrictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  type: restrictionTypeEnum("type").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  status: restrictionStatusEnum("status").notNull().default("ACTIVE"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({ id: true, createdAt: true });
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRolesTable.$inferSelect;
export type TeamMembership = typeof teamMembershipsTable.$inferSelect;

export const insertRestrictionSchema = createInsertSchema(restrictionsTable).omit({ id: true, createdAt: true });
export type InsertRestriction = z.infer<typeof insertRestrictionSchema>;
export type Restriction = typeof restrictionsTable.$inferSelect;
