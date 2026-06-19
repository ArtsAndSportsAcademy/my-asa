import { db } from "@workspace/db";
import { historyEventsTable, historyRelationsTable } from "@workspace/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HistoryCategory =
  | "SCALE"
  | "DAILY_BOOK"
  | "NOTICE"
  | "AGENDA"
  | "REQUEST"
  | "DELIVERY"
  | "MESSAGE"
  | "OPERATIONAL_CHANGE"
  | "CHECK_IN"
  | "DELEGATION"
  | "TASK"
  | "RESTRICTION"
  | "SUPERVISOR_REQUEST";

export interface WriteHistoryEventInput {
  category: HistoryCategory;
  action: string;
  title: string;
  narrative: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType?: "HUMAN" | "DETERMINISTIC_ENGINE" | "LLM_CONFIRMED";
  actorName?: string;
  operationId?: string;
  groupId?: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
  /** If provided, will link this event as resulting_in from the given source event */
  causedByEventId?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export async function writeHistoryEvent(
  input: WriteHistoryEventInput
): Promise<string> {
  const [row] = await db
    .insert(historyEventsTable)
    .values({
      category: input.category,
      action: input.action,
      title: input.title,
      narrative: input.narrative,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      actorType: input.actorType ?? "HUMAN",
      actorName: input.actorName,
      operationId: input.operationId,
      groupId: input.groupId,
      orgId: input.orgId,
      status: "ACTIVE",
      metadata: input.metadata ?? {},
    })
    .returning({ id: historyEventsTable.id });

  if (input.causedByEventId && row) {
    await db.insert(historyRelationsTable).values({
      sourceEventId: input.causedByEventId,
      targetEventId: row.id,
      relationType: "resulted_in",
    });
  }

  return row?.id ?? "";
}
