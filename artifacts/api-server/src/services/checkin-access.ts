import { and, eq } from "drizzle-orm";
import { db, operationsTable } from "@workspace/db";
import { hasActiveResponsibility } from "../lib/delegation-check.js";

export type CheckInAccessActor = {
  sub: string;
  role: string;
  organizationId: string;
  operationIds: string[];
};

export async function canManageCheckInsForOperation(
  user: CheckInAccessActor,
  operationId: string,
): Promise<boolean> {
  const [operation] = await db
    .select({ id: operationsTable.id })
    .from(operationsTable)
    .where(and(
      eq(operationsTable.id, operationId),
      eq(operationsTable.organizationId, user.organizationId),
      eq(operationsTable.status, "ACTIVE"),
    ))
    .limit(1);
  if (!operation) return false;
  if (user.role === "ADMIN") return true;
  return user.operationIds.includes(operationId)
    || hasActiveResponsibility(user.sub, operationId, "CHECK_INS");
}
