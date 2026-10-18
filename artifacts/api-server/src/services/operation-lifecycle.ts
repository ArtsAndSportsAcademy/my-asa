import {
  db,
  locationsTable,
  operationLocationsTable,
  operationsTable,
  operationalGroupsTable,
  teamMembershipsTable,
  userRolesTable,
} from "@workspace/db";
import { and, count, eq, inArray, sql } from "drizzle-orm";

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

/** As contagens que o servidor confere no banco antes de avaliar o checklist. */
export interface OperationReadinessCounts {
  /** Integrantes de equipes fixas (grupos operacionais) da operação. */
  teamCount: number;
  /** Pessoas com perfil ativo gravado para a operação (é assim que a tela Pessoas dá acesso). */
  accessCount: number;
  /** Locais abertos ligados à operação. */
  linkedLocationCount: number;
}

type ReadinessOperation = Pick<
  typeof operationsTable.$inferSelect,
  "name" | "description" | "clientName" | "color" | "icon" | "modulesReviewedAt"
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

/**
 * Checklist de várias operações de uma vez: uma consulta agrupada por item, em fila (não em paralelo — o banco
 * de teste e o pooler em modo sessão têm poucas conexões, e a lista de Operações não pode estourá-las).
 */
export async function getOperationsReadiness(
  operations: (typeof operationsTable.$inferSelect)[],
): Promise<Map<string, { readiness: OperationReadiness; accessCount: number }>> {
  const resultado = new Map<string, { readiness: OperationReadiness; accessCount: number }>();
  const ids = operations.map((operation) => operation.id);
  if (ids.length === 0) return resultado;
  const porOperacao = (rows: { operationId: string | null; value: unknown }[]) => new Map(rows.map((row) => [row.operationId, Number(row.value ?? 0)]));

  const equipes = porOperacao(await db
    .select({ operationId: operationalGroupsTable.operationId, value: count() })
    .from(teamMembershipsTable)
    .innerJoin(operationalGroupsTable, eq(teamMembershipsTable.teamId, operationalGroupsTable.id))
    .where(and(inArray(operationalGroupsTable.operationId, ids), eq(operationalGroupsTable.status, "ACTIVE"), eq(teamMembershipsTable.active, true)))
    .groupBy(operationalGroupsTable.operationId));
  const acessos = porOperacao(await db
    .select({ operationId: userRolesTable.operationId, value: sql<number>`count(distinct ${userRolesTable.userId})` })
    .from(userRolesTable)
    .where(and(inArray(userRolesTable.operationId, ids), eq(userRolesTable.active, true)))
    .groupBy(userRolesTable.operationId));
  const locais = porOperacao(await db
    .select({ operationId: operationLocationsTable.operationId, value: count() })
    .from(operationLocationsTable)
    .innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id))
    .where(and(inArray(operationLocationsTable.operationId, ids), eq(operationLocationsTable.active, true), eq(locationsTable.closed, false)))
    .groupBy(operationLocationsTable.operationId));

  for (const operation of operations) {
    const accessCount = acessos.get(operation.id) ?? 0;
    resultado.set(operation.id, {
      accessCount,
      readiness: evaluateOperationReadiness(operation, {
        teamCount: equipes.get(operation.id) ?? 0,
        accessCount,
        linkedLocationCount: locais.get(operation.id) ?? 0,
      }),
    });
  }
  return resultado;
}

export async function getOperationReadiness(
  operation: typeof operationsTable.$inferSelect,
): Promise<OperationReadiness> {
  return (await getOperationsReadiness([operation])).get(operation.id)!.readiness;
}

export function evaluateOperationReadiness(
  operation: ReadinessOperation,
  counts: OperationReadinessCounts,
): OperationReadiness {
  const hasDescription = Boolean(operation.description?.trim());
  const hasClient = Boolean(operation.clientName?.trim());
  const hasLocation = counts.linkedLocationCount > 0;
  const hasGeneralData = Boolean(operation.name.trim()) && hasDescription && hasClient && hasLocation;
  const missingGeneral = [
    !hasDescription && "a descrição",
    !hasClient && "o empreendimento (para quem a ASA trabalha)",
    !hasLocation && "pelo menos um local aberto ligado a esta operação",
  ].filter(Boolean) as string[];
  const hasVisualIdentity = /^#[0-9a-f]{6}$/i.test(operation.color) && Boolean(operation.icon.trim());
  const hasPeople = counts.teamCount > 0 || counts.accessCount > 0;

  const items: OperationReadinessItem[] = [
    {
      key: "GENERAL_DATA",
      label: "Dados gerais e local",
      complete: hasGeneralData,
      message: hasGeneralData
        ? "Nome, descrição, empreendimento e pelo menos um local aberto estão preenchidos."
        : `Falta informar ${missingGeneral.join("; ")}. A Escala e os shows só existem dentro de um local desta operação.`,
    },
    {
      key: "VISUAL_IDENTITY",
      label: "Identidade visual",
      complete: hasVisualIdentity,
      message: hasVisualIdentity ? "Cor e ícone estão definidos." : "Defina uma cor válida e um ícone.",
    },
    {
      key: "FIXED_TEAM",
      label: "Pessoas com acesso",
      complete: hasPeople,
      message: hasPeople
        ? "Há pessoas com acesso a esta operação."
        : "Dê acesso a pelo menos uma pessoa. Sem isso ninguém monta a Escala nem vê a operação.",
    },
    {
      key: "RELATED_MODULES",
      label: "Módulos relacionados",
      complete: operation.modulesReviewedAt !== null,
      message: operation.modulesReviewedAt
        ? "A Administração confirmou que Escalas, Programação e Livros do Dia estão prontos para esta operação."
        : "Confira Escalas, Programação e Livros do Dia e marque esta etapa como revisada.",
    },
  ];

  const blockers = items.filter((item) => !item.complete);
  return { ready: blockers.length === 0, items, blockers };
}
