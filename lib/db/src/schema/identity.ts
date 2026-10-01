import { pgTable, text, uuid, timestamp, pgEnum, date, boolean, jsonb, integer, customType } from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Quem vê: só a gestão, o próprio grupo (área) ou a ASA inteira. */
export type NivelVisibilidade = "gestao" | "grupo" | "asa";
/** Aniversário: não aparece, só na lista da semana, ou sobe para o alto do mural no dia. Nunca o ano. */
export type NivelAniversario = "off" | "lista" | "mural";
export type Privacidade = { tel: NivelVisibilidade; mail: NivelVisibilidade; bday: NivelAniversario };
/** Janela de silêncio noturno em horário de São Paulo ("22:00" a "06:00"); on=false desliga. */
export type JanelaSilencio = { on: boolean; de: string; ate: string };
/** Regras da casa, definidas pela Administração no Perfil. */
export type RegrasCasa = { silencio: JanelaSilencio; lembreteCheckinMin: number };
export const REGRAS_PADRAO: RegrasCasa = { silencio: { on: true, de: "22:00", ate: "06:00" }, lembreteCheckinMin: 30 };

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
  /** Nome formal: cadastro, ficha administrativa e Registro. */
  fullName: text("nome_completo").notNull().default(""),
  /**
   * Adaptação de compatibilidade para a base existente. Todo uso de `name`
   * na interface e nas rotas representa o nome de exibição, nunca o formal.
   */
  name: text("nome_de_exibicao").notNull(),
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
  // As FKs são aplicadas pela migração do Bloco 6. Mantemos estas colunas
  // desacopladas aqui para não criar um ciclo de módulos entre identidade e área.
  areaId: uuid("area_id"),
  // Legado de migração: a aplicação não lê nem escreve este campo. Pessoa
  // pertence à ASA; o local é definido pela Programação/Escala de cada dia.
  // Mantido fisicamente por ora para não apagar histórico sem uma auditoria de
  // dados e uma migração reversível própria.
  defaultLocationId: uuid("default_location_id"),
  specialization: text("specialization").$type<UserSpecialization | null>(),
  birthDate: date("birth_date", { mode: "string" }),
  entryDate: date("entry_date", { mode: "string" }),
  /** Data de saída prevista para Convidados (CONVIDADO). Nulo para membros fixos. */
  visitUntil: date("visit_until", { mode: "string" }),
  adminNotes: text("admin_notes"),
  contactVisibility: jsonb("contact_visibility").$type<{ email: boolean; phone: boolean }>().notNull().default({ email: true, phone: true }),
  /** 28 Perfil: quem vê telefone/e-mail (gestao | grupo | asa) e se o aniversário aparece (off | lista | mural). Escolha da própria pessoa. */
  privacidade: jsonb("privacidade").$type<Privacidade>().notNull().default({ tel: "grupo", mail: "gestao", bday: "mural" }),
  /** Silêncio noturno da pessoa; null = segue o silêncio da casa (organizations.regras.silencio). */
  silencio: jsonb("silencio").$type<JanelaSilencio | null>(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Foto de perfil no Postgres, servida só pela API autenticada. Trocar desativa a anterior; nada é apagado. */
export const userPhotosTable = pgTable("user_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  orgId: uuid("org_id").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  content: bytea("content").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
