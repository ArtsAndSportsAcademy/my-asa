import {
  db,
  operationsTable,
  operationalGroupsTable,
  teamMembershipsTable,
  responsibilitiesTable,
  responsibilityAssignmentsTable,
} from "@workspace/db";
import { and, count, eq, sql } from "drizzle-orm";

export const OPERATION_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<OperationStatus, readonly OperationStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["DRAFT", "ACTIVE"],
};

export type OperationReadinessItemKey =
  | "GENERAL_DATA"
  | "VISUAL_IDENTITY"
  | "FIXED_TEAM"
  | "RESPONSIBILITIES"
  | "RELATED_MODULES";

export interface OperationReadinessItem {
  key: OperationReadinessItemKey;
  label: string;
  complete: boolean;
  message: string;
}

export interface OperationReadiness {
  ready: boolean;
  items: OperationReadinessItem[];
  blockers: OperationReadinessItem[];
}

type ReadinessOperation = Pick<
  typeof operationsTable.$inferSelect,
  "name" | "description" | "clientName" | "locations" | "color" | "icon" | "modulesReviewedAt"
>;

export function normalizeOperationName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function canTransitionOperation(from: OperationStatus, to: OperationStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function isOperationStatus(value: unknown): value is OperationStatus {
  return typeof value === "string" && OPERATION_STATUSES.includes(value as OperationStatus);
}

export function isDuplicateOperationError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function operationNameExists(
  organizationId: string,
  name: string,
  excludingId?: string,
): Promise<boolean> {
  const normalized = normalizeOperationName(name);
  const conditions = [
    eq(operationsTable.organizationId, organizationId),
    sql`lower(regexp_replace(btrim(${operationsTable.name}), '[[:space:]]+', ' ', 'g')) = ${normalized}`,
  ];
  if (excludingId) conditions.push(sql`${operationsTable.id} <> ${excludingId}`);

  const row = await db.query.operationsTable.findFirst({ where: and(...conditions) });
  return !!row;
}

export async function getOperationInOrganization(operationId: string, organizationId: string) {
  return db.query.operationsTable.findFirst({
    where: and(
      eq(operationsTable.id, operationId),
      eq(operationsTable.organizationId, organizationId),
    ),
  });
}

export async function getActiveOperationInOrganization(operationId: string, organizationId: string) {
  return db.query.operationsTable.findFirst({
    where: and(
      eq(operationsTable.id, operationId),
      eq(operationsTable.organizationId, organizationId),
      eq(operationsTable.status, "ACTIVE"),
    ),
  });
}

export async function getOperationReadiness(
  operation: typeof operationsTable.$inferSelect,
): Promise<OperationReadiness> {
  const [[teamCount], [responsibilityCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(teamMembershipsTable)
      .innerJoin(
        operationalGroupsTable,
        eq(teamMembershipsTable.teamId, operationalGroupsTable.id),
      )
      .where(
        and(
          eq(operationalGroupsTable.operationId, operation.id),
          eq(operationalGroupsTable.status, "ACTIVE"),
          eq(teamMembershipsTable.active, true),
        ),
      ),
    db
      .select({ value: count() })
      .from(responsibilityAssignmentsTable)
      .innerJoin(
        responsibilitiesTable,
        eq(responsibilityAssignmentsTable.responsibilityId, responsibilitiesTable.id),
      )
      .where(
        and(
          eq(responsibilitiesTable.operationId, operation.id),
          eq(responsibilitiesTable.active, true),
          eq(responsibilityAssignmentsTable.active, true),
        ),
      ),
  ]);

  return evaluateOperationReadiness(
    operation,
    Number(teamCount?.value ?? 0),
    Number(responsibilityCount?.value ?? 0),
  );
}

export function evaluateOperationReadiness(
  operation: ReadinessOperation,
  teamCount: number,
  responsibilityCount: number,
): OperationReadiness {
  const hasGeneralData = Boolean(
    operation.name.trim()
      && operation.description?.trim()
      && operation.clientName?.trim()
      && operation.locations.length > 0,
  );
  const hasVisualIdentity = /^#[0-9a-f]{6}$/i.test(operation.color) && Boolean(operation.icon.trim());

  const items: OperationReadinessItem[] = [
    {
      key: "GENERAL_DATA",
      label: "Dados gerais",
      complete: hasGeneralData,
      message: hasGeneralData
        ? "Nome, descrição, empreendimento e local estão preenchidos."
        : "Preencha nome, descrição, empreendimento e pelo menos um local.",
    },
    {
      key: "VISUAL_IDENTITY",
      label: "Identidade visual",
      complete: hasVisualIdentity,
      message: hasVisualIdentity ? "Cor e ícone estão definidos." : "Defina uma cor válida e um ícone.",
    },
    {
      key: "FIXED_TEAM",
      label: "Equipe fixa",
      complete: teamCount > 0,
      message: teamCount > 0
        ? "A operação possui integrantes em sua equipe fixa."
        : "Adicione pelo menos uma pessoa a uma equipe desta operação.",
    },
    {
      key: "RESPONSIBILITIES",
      label: "Responsáveis",
      complete: responsibilityCount > 0,
      message: responsibilityCount > 0
        ? "A operação possui uma responsabilidade ativa com responsável."
        : "Defina pelo menos uma responsabilidade e seu responsável.",
    },
    {
      key: "RELATED_MODULES",
      label: "Módulos relacionados",
      complete: operation.modulesReviewedAt !== null,
      message: operation.modulesReviewedAt
        ? "Os módulos relacionados foram revisados pela administração."
        : "Revise Escalas, Programação e Livros e confirme esta etapa.",
    },
  ];

  const blockers = items.filter((item) => !item.complete);
  return { ready: blockers.length === 0, items, blockers };
}
