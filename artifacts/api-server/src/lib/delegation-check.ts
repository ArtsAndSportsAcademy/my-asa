import { eq, and, isNull, lte, gte, or, arrayContains } from "drizzle-orm";
import { db } from "@workspace/db";
import { delegationsTable } from "@workspace/db/schema";
import type { DelegatedResponsibility } from "@workspace/db/schema";

/**
 * Returns true if `userId` has ANY active delegation for `operationId`
 * (backwards-compatible helper — does NOT check specific responsibility).
 */
export async function isActiveDelegate(userId: string, operationId: string): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .select({ id: delegationsTable.id })
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.delegateeId, userId),
        eq(delegationsTable.operationId, operationId),
        isNull(delegationsTable.revokedAt),
        lte(delegationsTable.validFrom, now),
        or(isNull(delegationsTable.validUntil), gte(delegationsTable.validUntil, now)),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Returns true if `userId` has an active delegation for `operationId`
 * that includes the specific `responsibility`.
 */
export async function hasActiveResponsibility(
  userId: string,
  operationId: string,
  responsibility: DelegatedResponsibility,
  executor: Pick<typeof db, "select"> = db,
): Promise<boolean> {
  const now = new Date();
  const [row] = await executor
    .select({ id: delegationsTable.id })
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.delegateeId, userId),
        eq(delegationsTable.operationId, operationId),
        arrayContains(delegationsTable.responsibilities, [responsibility]),
        isNull(delegationsTable.revokedAt),
        lte(delegationsTable.validFrom, now),
        or(isNull(delegationsTable.validUntil), gte(delegationsTable.validUntil, now)),
      ),
    )
    .for("share")
    .limit(1);

  return !!row;
}
