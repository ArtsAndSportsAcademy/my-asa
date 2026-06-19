import { eq, and, not, inArray, lte, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { delegationsTable } from "@workspace/db/schema";

/**
 * Returns true if `userId` has an active delegation for `operationId`.
 * A delegation is considered active when:
 *   - status is not CANCELLED or EXPIRED
 *   - today is within [startDate, endDate]
 */
export async function isActiveDelegate(userId: string, operationId: string): Promise<boolean> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({ id: delegationsTable.id })
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.delegateId, userId),
        eq(delegationsTable.operationId, operationId),
        not(inArray(delegationsTable.status, ["CANCELLED", "EXPIRED"])),
        lte(delegationsTable.startDate, todayStr),
        gte(delegationsTable.endDate, todayStr),
      ),
    )
    .limit(1);
  return !!row;
}
