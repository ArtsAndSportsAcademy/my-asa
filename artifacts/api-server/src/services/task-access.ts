import { and, eq } from "drizzle-orm";
import { db, responsibilitiesTable, usersTable } from "@workspace/db";
import { hasActiveResponsibility } from "../lib/delegation-check.js";
import { listAreaLocalScopes } from "./area-local-scope.js";

export async function canManageTasks(
  userId: string,
  role: string,
  operationId: string,
  organizationId: string,
  areaId: string | null,
  executor: Pick<typeof db, "select"> = db,
): Promise<boolean> {
  if (role === "ADMIN" || role === "DIR") return true;
  if ((role !== "SUPERVISOR_A" && role !== "SUPERVISOR_B") || !areaId) return false;
  const areaIds = await listTaskManagementAreaIds(userId, operationId, organizationId, executor);
  return areaIds?.includes(areaId) ?? false;
}

export async function resolveTaskAreaId(
  responsibilityId: string | undefined,
  assigneeId: string,
  organizationId: string,
  executor: Pick<typeof db, "select"> = db,
): Promise<string | null> {
  if (responsibilityId) {
    const [responsibility] = await executor.select({ areaId: responsibilitiesTable.areaId })
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, responsibilityId), eq(responsibilitiesTable.orgId, organizationId), eq(responsibilitiesTable.active, true)))
      .for("share")
      .limit(1);
    return responsibility?.areaId ?? null;
  }
  const [assignee] = await executor.select({ areaId: usersTable.areaId })
    .from(usersTable)
    .where(and(eq(usersTable.id, assigneeId), eq(usersTable.organizationId, organizationId)))
    .for("share")
    .limit(1);
  return assignee?.areaId ?? null;
}

/** Returns the supervisor's task areas, or null when TASK_APPROVALS is absent. */
export async function listTaskManagementAreaIds(
  userId: string,
  operationId: string,
  organizationId: string,
  executor: Pick<typeof db, "select"> = db,
): Promise<string[] | null> {
  if (!(await hasActiveResponsibility(userId, operationId, "TASK_APPROVALS", executor))) return null;
  const scopes = await listAreaLocalScopes(userId, organizationId, executor);
  return [...new Set(scopes.map((scope) => scope.areaId))];
}
