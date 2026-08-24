import { and, eq } from "drizzle-orm";
import { db, operationsTable, userRolesTable, usersTable } from "@workspace/db";

export const CAPABILITIES = {
  VIEW_HOME: "VIEW_HOME",
  VIEW_OWN_SCHEDULE: "VIEW_OWN_SCHEDULE",
  VIEW_OPERATIONAL_SCHEDULES: "VIEW_OPERATIONAL_SCHEDULES",
  MANAGE_OPERATIONAL_SCHEDULES: "MANAGE_OPERATIONAL_SCHEDULES",
  VIEW_AGENDA: "VIEW_AGENDA",
  MANAGE_AGENDA: "MANAGE_AGENDA",
  VIEW_SHOW_BOOK: "VIEW_SHOW_BOOK",
  MANAGE_SHOW_BOOK: "MANAGE_SHOW_BOOK",
  VIEW_PEOPLE: "VIEW_PEOPLE",
  MANAGE_PEOPLE: "MANAGE_PEOPLE",
  VIEW_OPERATIONS: "VIEW_OPERATIONS",
  MANAGE_OPERATIONS: "MANAGE_OPERATIONS",
  VIEW_COMMUNICATION: "VIEW_COMMUNICATION",
  MANAGE_COMMUNICATION: "MANAGE_COMMUNICATION",
  VIEW_MEMBER_WORK: "VIEW_MEMBER_WORK",
  MANAGE_RESPONSIBILITIES: "MANAGE_RESPONSIBILITIES",
  USE_ASA: "USE_ASA",
} as const;

export type Capability = typeof CAPABILITIES[keyof typeof CAPABILITIES];

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  ADMIN: Object.values(CAPABILITIES),
  SUPERVISOR_A: [
    CAPABILITIES.VIEW_HOME,
    CAPABILITIES.VIEW_OWN_SCHEDULE,
    CAPABILITIES.VIEW_OPERATIONAL_SCHEDULES,
    CAPABILITIES.MANAGE_OPERATIONAL_SCHEDULES,
    CAPABILITIES.VIEW_AGENDA,
    CAPABILITIES.MANAGE_AGENDA,
    CAPABILITIES.VIEW_SHOW_BOOK,
    CAPABILITIES.MANAGE_SHOW_BOOK,
    CAPABILITIES.VIEW_PEOPLE,
    CAPABILITIES.VIEW_OPERATIONS,
    CAPABILITIES.VIEW_COMMUNICATION,
    CAPABILITIES.MANAGE_COMMUNICATION,
    CAPABILITIES.VIEW_MEMBER_WORK,
    CAPABILITIES.MANAGE_RESPONSIBILITIES,
    CAPABILITIES.USE_ASA,
  ],
  SUPERVISOR_B: [],
  MEMBER: [
    CAPABILITIES.VIEW_HOME,
    CAPABILITIES.VIEW_OWN_SCHEDULE,
    CAPABILITIES.VIEW_AGENDA,
    CAPABILITIES.VIEW_COMMUNICATION,
    CAPABILITIES.VIEW_MEMBER_WORK,
    CAPABILITIES.USE_ASA,
  ],
  // Compatibilidade temporária da Onda 1. TRAINER deixa de herdar acesso
  // implícito de membro e recebe apenas as áreas básicas explicitamente listadas.
  TRAINER: [
    CAPABILITIES.VIEW_HOME,
    CAPABILITIES.VIEW_AGENDA,
    CAPABILITIES.VIEW_COMMUNICATION,
  ],
};

ROLE_CAPABILITIES.SUPERVISOR_B = ROLE_CAPABILITIES.SUPERVISOR_A;

const ROLE_PRIORITY = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER", "TRAINER"];

export function resolvePrimaryRole(roles: Array<{ role: string }>): string | null {
  return ROLE_PRIORITY.find((role) => roles.some((record) => record.role === role)) ?? null;
}

export function capabilitiesForRoles(roles: Array<{ role: string }>): Capability[] {
  const result = new Set<Capability>();
  for (const record of roles) {
    for (const capability of ROLE_CAPABILITIES[record.role] ?? []) result.add(capability);
  }
  return [...result];
}

export async function loadAuthorizationContext(userId: string) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return { roles: [], primaryRole: null, operationIds: [], capabilities: [] };
  const [allRoles, organizationOperations] = await Promise.all([
    db.query.userRolesTable.findMany({
      where: and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)),
    }),
    db.query.operationsTable.findMany({
      where: eq(operationsTable.organizationId, user.organizationId),
    }),
  ]);
  const organizationOperationIds = new Set(organizationOperations.map((operation) => operation.id));
  const roles = allRoles.filter((role) => organizationOperationIds.has(role.operationId));
  const primaryRole = resolvePrimaryRole(roles);
  const operationIds = [...new Set(roles.map((role) => role.operationId))];
  return { roles, primaryRole, operationIds, capabilities: capabilitiesForRoles(roles) };
}

export async function hasOperationAccess(args: {
  userId: string;
  organizationId: string;
  operationId: string;
  supervisorOnly?: boolean;
}): Promise<boolean> {
  const operation = await db.query.operationsTable.findFirst({
    where: and(
      eq(operationsTable.id, args.operationId),
      eq(operationsTable.organizationId, args.organizationId),
    ),
  });
  if (!operation) return false;

  const { roles, primaryRole } = await loadAuthorizationContext(args.userId);
  if (primaryRole === "ADMIN") return true;

  return roles.some((role) => {
    if (role.operationId !== args.operationId) return false;
    if (!args.supervisorOnly) return true;
    return role.role === "SUPERVISOR_A" || role.role === "SUPERVISOR_B";
  });
}
