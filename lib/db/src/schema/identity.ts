import { pgTable, text, uuid, timestamp, pgEnum, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE"]);
export const personStatusEnum = pgEnum("person_status", ["ACTIVE", "ON_LEAVE", "LEFT", "ARCHIVED"]);

// ─── Especialização Profissional ───────────────────────────────────────────────
// Identifica quem o usuário é dentro da organização (não altera papéis nem permissões).
// Papel = o que a pessoa pode fazer. Especialização = quem a pessoa é.

export type UserSpecialization =
  | "PERFORMER"
  | "CONVIDADO"
  | "PROFESSOR"
  | "TRAINER"
  | "PHYSIOTHERAPIST"
  | "STRENGTH_COACH"
  | "TECHNICAL_OPERATOR"
  | "CHOREOGRAPHER"
  | "OTHER";

export const ALL_SPECIALIZATIONS: UserSpecialization[] = [
  "PERFORMER",
  "CONVIDADO",
  "PROFESSOR",
  "TRAINER",
  "PHYSIOTHERAPIST",
  "STRENGTH_COACH",
  "TECHNICAL_OPERATOR",
  "CHOREOGRAPHER",
  "OTHER",
];

export const SPECIALIZATION_LABELS: Record<UserSpecialization, string> = {
  PERFORMER:          "Performer",
  CONVIDADO:          "Convidado",
  PROFESSOR:          "Professor",
  TRAINER:            "Treinador",
  PHYSIOTHERAPIST:    "Fisioterapeuta",
  STRENGTH_COACH:     "Preparador Físico",
  TECHNICAL_OPERATOR: "Técnico Operacional",
  CHOREOGRAPHER:      "Coreógrafo",
  OTHER:              "Outro",
};

// ─── Quem aparece nas escalas e na grade de folgas ────────────────────────────
// Única fonte de verdade para "membro escalável" (Performer comum). Administradores
// (role=ADMIN) e membros especiais (specialization preenchida e != PERFORMER) não
// fazem parte do elenco escalável e não devem aparecer em escalas nem na grade de
// folgas. Use estes predicados em TODOS os pontos para evitar divergência de regra.

/**
 * Membro especial: especialização preenchida e diferente de PERFORMER ou CONVIDADO.
 * Convidados participam de shows/ensaios e aparecem nas escalas como qualquer performer.
 */
export function isSpecialSpecialization(
  specialization: UserSpecialization | string | null | undefined
): boolean {
  return specialization != null && specialization !== "PERFORMER" && specialization !== "CONVIDADO";
}

/**
 * Membro escalável (Performer comum): NÃO é administrador e NÃO é especial.
 * `isAdmin` deve ser calculado pelo chamador a partir dos papéis (role=ADMIN).
 */
export function isSchedulableMember(args: {
  isAdmin: boolean;
  specialization: UserSpecialization | string | null | undefined;
}): boolean {
  return !args.isAdmin && !isSpecialSpecialization(args.specialization);
}

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  preferredName: text("preferred_name"),
  email: text("email").unique(),
  phone: text("phone"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  photoUrl: text("photo_url"),
  personStatus: personStatusEnum("person_status").notNull().default("ACTIVE"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  professionalProfile: text("professional_profile"),
  primaryFunction: text("primary_function"),
  specialization: text("specialization").$type<UserSpecialization | null>(),
  birthDate: date("birth_date", { mode: "string" }),
  entryDate: date("entry_date", { mode: "string" }),
  /** Data de saída prevista para Convidados (CONVIDADO). Nulo para membros fixos. */
  visitUntil: date("visit_until", { mode: "string" }),
  adminNotes: text("admin_notes"),
  contactVisibility: jsonb("contact_visibility").$type<{ email: boolean; phone: boolean }>().notNull().default({ email: true, phone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by"),
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
