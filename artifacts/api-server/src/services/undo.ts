import { and, eq, sql } from "drizzle-orm";
import { db, formationsTable, libraryDocumentsTable, teamMembershipsTable, userRolesTable, requestsTable, requestDecisionsTable, undoActionsTable, notificationOutboxTable } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";
import type { CreateNotificationInput } from "./notificationService.js";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const tables = { formation: formationsTable, library_document: libraryDocumentsTable, membership: teamMembershipsTable, role: userRolesTable, request: requestsTable, decision: requestDecisionsTable };
export type UndoChange = { table: keyof typeof tables; id: string; before: Record<string, unknown>; after: Record<string, unknown> };
export class UndoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function databaseNow(tx: Transaction) {
  const result = await tx.execute<{ now: Date }>(sql`select clock_timestamp() as now`);
  return new Date(result.rows[0]!.now);
}
export async function enqueueNotification(tx: Transaction, input: CreateNotificationInput, dueAt: Date, options: { undoActionId?: string; deduplicationKey?: string } = {}) {
  await tx.insert(notificationOutboxTable).values({ userId: input.userId, payload: input, dueAt, ...options }).onConflictDoNothing();
}
/** All four reversible actions use this durable window; no process-local timers. */
export async function registerUndo(tx: Transaction, input: { organizationId: string; actorId: string; kind: "formation" | "library_document" | "group_member" | "leave_denial"; entityId: string; changes: UndoChange[]; notifications?: CreateNotificationInput[] }) {
  const now = await databaseNow(tx);
  const expiresAt = new Date(now.getTime() + 10_000);
  const { notifications, ...row } = input;
  const [action] = await tx.insert(undoActionsTable).values({ ...row, expiresAt }).returning();
  for (const notification of notifications ?? []) await enqueueNotification(tx, notification, expiresAt, { undoActionId: action!.id });
  return { id: action!.id, expiresAt: expiresAt.toISOString(), windowSeconds: 10 };
}
function serial(value: unknown) { return JSON.stringify(value); }
function restoreDates(patch: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, key.endsWith("At") && typeof value === "string" ? new Date(value) : value]));
}
export async function undoAction(id: string, actorId: string, organizationId: string) {
  return db.transaction(async tx => {
    const [action] = await tx.select().from(undoActionsTable).where(eq(undoActionsTable.id, id)).for("update");
    if (!action || action.actorId !== actorId || action.organizationId !== organizationId) throw new UndoError(403, "Desfazer pertence a outra pessoa ou organização.");
    if (action.undoneAt) return { undone: true, alreadyUndone: true };
    const now = await databaseNow(tx);
    if (now >= action.expiresAt) throw new UndoError(409, "A janela de 10 segundos terminou.");
    const changes = action.changes as UndoChange[];
    // Compare every affected field before reverting; do not erase subsequent edits.
    for (const change of changes) {
      const table = tables[change.table];
      if (!table) throw new Error("Tabela não autorizada para desfazer");
      const [current] = await tx.select().from(table).where(eq(table.id, change.id)).for("update") as Record<string, unknown>[];
      if (!current || Object.entries(change.after).some(([key, value]) => serial(current[key]) !== serial(value))) throw new UndoError(409, "Outra alteração ocorreu. Atualize antes de desfazer.");
    }
    for (const change of changes) {
      const table = tables[change.table];
      const patch = restoreDates(change.before);
      if (change.table === "decision") patch.revertedAt = now;
      if ("updatedAt" in table) patch.updatedAt = now;
      await tx.update(table).set(patch).where(eq(table.id, change.id));
    }
    await tx.update(notificationOutboxTable).set({ status: "cancelled" }).where(and(eq(notificationOutboxTable.undoActionId, id), eq(notificationOutboxTable.status, "pending")));
    await tx.update(undoActionsTable).set({ undoneAt: now }).where(eq(undoActionsTable.id, id));
    await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "action.undone", title: "Ação desfeita", narrative: `A pessoa desfez ${action.kind} dentro da janela de 10 segundos.`, entityType: action.kind, entityId: action.entityId, actorId, orgId: organizationId, beforeState: { changes: changes.map(c => ({ id: c.id, ...c.after })) }, afterState: { changes: changes.map(c => ({ id: c.id, ...c.before })) }, metadata: { undoActionId: id } }, tx);
    return { undone: true, alreadyUndone: false };
  });
}
