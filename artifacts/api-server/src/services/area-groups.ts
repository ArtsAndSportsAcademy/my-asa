import { and, eq, inArray, sql } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  messageThreadParticipantsTable,
  messageThreadsTable,
  usersTable,
} from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";

// Desenho 23: "grupos automáticos da casa". Cada área ativa tem uma conversa própria
// (context_type AREA_GROUP, context_id = área) com quem é da área e quem a supervisiona.
// O grupo se acerta sozinho quando alguém da área abre Mensagens: entra quem chegou,
// sai quem mudou de área. A participação é dado derivado do cadastro — as mensagens ficam.
export const AREA_GROUP = "AREA_GROUP";

async function desiredMembers(areaId: string, orgId: string) {
  const [members, supervisors] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"), eq(usersTable.areaId, areaId))),
    db.selectDistinct({ id: usersTable.id }).from(areaLocalSupervisorsTable)
      .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
      .where(and(eq(areaLocalSupervisorsTable.areaId, areaId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE"), eq(usersTable.organizationId, orgId))),
  ]);
  return new Set([...members, ...supervisors].map((row) => row.id));
}

async function syncAreaGroup(area: { id: string; name: string }, orgId: string) {
  const wanted = await desiredMembers(area.id, orgId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`area-group:${area.id}`}))`);
    let [thread] = await tx.select().from(messageThreadsTable)
      .where(and(eq(messageThreadsTable.orgId, orgId), eq(messageThreadsTable.contextType, AREA_GROUP), eq(messageThreadsTable.contextId, area.id))).limit(1);
    if (!thread) {
      [thread] = await tx.insert(messageThreadsTable).values({ orgId, title: `${area.name} · grupo da área`, contextType: AREA_GROUP, contextId: area.id, contextTitle: area.name }).returning();
      await writeHistoryEvent({ category: "MESSAGE", action: "message.area_group_created", title: "Grupo da área criado", narrative: `Grupo automático de ${area.name} nas Mensagens.`, entityType: "message_thread", entityId: thread!.id, orgId }, tx as any);
    }
    const current = await tx.select({ userId: messageThreadParticipantsTable.userId }).from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, thread!.id));
    const have = new Set(current.map((row) => row.userId));
    const entering = [...wanted].filter((id) => !have.has(id));
    const leaving = [...have].filter((id) => !wanted.has(id));
    if (entering.length) await tx.insert(messageThreadParticipantsTable).values(entering.map((userId) => ({ threadId: thread!.id, userId, role: "PARTICIPANT" as const }))).onConflictDoNothing();
    if (leaving.length) await tx.delete(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, thread!.id), inArray(messageThreadParticipantsTable.userId, leaving)));
    if (entering.length || leaving.length) {
      await writeHistoryEvent({ category: "MESSAGE", action: "message.area_group_synced", title: "Grupo da área atualizado", narrative: `${area.name}: ${entering.length} entrou(aram), ${leaving.length} saiu(íram) do grupo da área.`, entityType: "message_thread", entityId: thread!.id, orgId, metadata: { entering, leaving } }, tx as any);
    }
  });
}

/** Acerta os grupos das áreas desta pessoa: a área em que está e as que supervisiona. */
export async function syncAreaGroupsFor(userId: string, orgId: string) {
  const [me] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, orgId))).limit(1);
  const supervised = await db.selectDistinct({ areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable)
    .where(and(eq(areaLocalSupervisorsTable.supervisorId, userId), eq(areaLocalSupervisorsTable.active, true)));
  // Também as áreas de grupos em que a pessoa ainda está, para sair de quem não é mais.
  const stale = await db.select({ areaId: messageThreadsTable.contextId }).from(messageThreadParticipantsTable)
    .innerJoin(messageThreadsTable, eq(messageThreadParticipantsTable.threadId, messageThreadsTable.id))
    .where(and(eq(messageThreadParticipantsTable.userId, userId), eq(messageThreadsTable.orgId, orgId), eq(messageThreadsTable.contextType, AREA_GROUP)));
  const ids = [...new Set([me?.areaId, ...supervised.map((row) => row.areaId), ...stale.map((row) => row.areaId)].filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const areas = await db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(eq(areasTable.organizationId, orgId), inArray(areasTable.id, ids)));
  for (const area of areas) await syncAreaGroup(area, orgId);
}
