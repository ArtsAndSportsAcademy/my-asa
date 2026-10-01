import { and, eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { operationsTable, userRolesTable } from "@workspace/db";
import { hasActiveResponsibility } from "../lib/delegation-check.js";
import { isAreaLocalSupervisor, usesAreaLocalScopes } from "./area-local-scope.js";

export async function hasScaleAuthority(
  userId: string,
  operationId: string,
  groupId?: string | null,
  areaId?: string | null,
  locationId?: string | null,
  readOperation = false,
): Promise<boolean> {
  const [operation] = await db.select({ organizationId: operationsTable.organizationId })
    .from(operationsTable).where(eq(operationsTable.id, operationId)).limit(1);
  if (!operation) return false;
  const supervisor = await db.query.userRolesTable.findFirst({
    where: and(
      eq(userRolesTable.userId, userId),
      eq(userRolesTable.operationId, operationId),
      eq(userRolesTable.active, true),
      or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
      groupId ? eq(userRolesTable.groupId, groupId) : undefined,
    ),
  });
  if (areaId || locationId) {
    if (!areaId || !locationId || !supervisor) return false;
    return isAreaLocalSupervisor({ supervisorId: userId, organizationId: operation.organizationId, areaId, locationId });
  }
  if (await usesAreaLocalScopes(operation.organizationId)) {
    return readOperation && (!!supervisor || await hasActiveResponsibility(userId, operationId, "SCALES"));
  }
  return !!supervisor || hasActiveResponsibility(userId, operationId, "SCALES");
}
