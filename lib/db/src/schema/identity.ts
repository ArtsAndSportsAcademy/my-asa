import { pgTable, text, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE"]);

// ─── Especialização Profissional ───────────────────────────────────────────────
// Identifica quem o usuário é dentro da organização (não altera papéis nem permissões).
// Papel = o que a pessoa pode fazer. Especialização = quem a pessoa é.

export type UserSpecialization =
  | "PERFORMER"
  | "PROFESSOR"
  | "TRAINER"
  | "PHYSIOTHERAPIST"
  | "STRENGTH_COACH"
  | "TECHNICAL_OPERATOR"
  | "OTHER";

export const ALL_SPECIALIZATIONS: UserSpecialization[] = [
  "PERFORMER",
  "PROFESSOR",
  "TRAINER",
  "PHYSIOTHERAPIST",
  "STRENGTH_COACH",
  "TECHNICAL_OPERATOR",
  "OTHER",
];

export const SPECIALIZATION_LABELS: Record<UserSpecialization, string> = {
  PERFORMER:          "Performer",
  PROFESSOR:          "Professor",
  TRAINER:            "Treinador",
  PHYSIOTHERAPIST:    "Fisioterapeuta",
  STRENGTH_COACH:     "Preparador Físico",
  TECHNICAL_OPERATOR: "Técnico Operacional",
  OTHER:              "Outro",
};

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  photoUrl: text("photo_url"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  specialization: text("specialization").$type<UserSpecialization | null>(),
  birthDate: date("birth_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
