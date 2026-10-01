import { db } from "@workspace/db";
import { historyEventsTable, historyRelationsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/** Executor mínimo aceito por Drizzle e por uma transação Drizzle. */
export type HistoryExecutor = Pick<typeof db, "insert" | "select">;

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
  | "SUPERVISOR_REQUEST"
  | "ABSENCE";

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
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  /** If provided, will link this event as resulting_in from the given source event */
  causedByEventId?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Campos que nunca entram no Registro, mesmo quando a rota passa a linha inteira do banco como antes/depois. */
const SEGREDOS = new Set(["passwordHash", "tokenHash", "refreshToken", "accessToken", "password", "newPassword", "currentPassword"]);
export function semSegredos(state: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!state) return null;
  const limpo = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(limpo);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !SEGREDOS.has(key)).map(([key, item]) => [key, limpo(item)]));
    }
    return value;
  };
  return limpo(state) as Record<string, unknown>;
}

export async function writeHistoryEvent(
  input: WriteHistoryEventInput,
  executor: HistoryExecutor = db,
): Promise<string> {
  if (process.env.MYASA_TEST_FAIL_HISTORY === "1") {
    throw new Error("Falha de Registro solicitada pelo teste");
  }

  // Registro é o documento operacional: quando há ator humano, conserva o
  // nome formal cadastrado, nunca o apelido mostrado nas telas.
  const actorName = input.actorId
    ? (await executor
        .select({ fullName: usersTable.fullName })
        .from(usersTable)
        .where(eq(usersTable.id, input.actorId))
        .limit(1))[0]?.fullName ?? input.actorName
    : input.actorName;

  const [row] = await executor
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
      actorName,
      operationId: input.operationId,
      groupId: input.groupId,
      orgId: input.orgId,
      beforeState: semSegredos(input.beforeState),
      afterState: semSegredos(input.afterState),
      status: "ACTIVE",
      metadata: semSegredos(input.metadata) ?? {},
    })
    .returning({ id: historyEventsTable.id });

  if (input.causedByEventId && row) {
    await executor.insert(historyRelationsTable).values({
      sourceEventId: input.causedByEventId,
      targetEventId: row.id,
      relationType: "resulted_in",
    });
  }

  return row?.id ?? "";
}
