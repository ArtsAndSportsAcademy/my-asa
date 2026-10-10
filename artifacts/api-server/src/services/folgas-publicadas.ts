import { and, desc, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, userRolesTable, usersTable } from "@workspace/db";
import { enqueueNotification } from "./undo.js";

export type FolgaPublicada = {
  id: string;
  userId: string;
  userName: string;
  operationId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE";
};

export const chaveMesFolgas = (operationId: string, year: number, month: number) =>
  `${operationId}:${year}-${String(month).padStart(2, "0")}`;

/** O retrato é a última publicação ou a foto inicial da migração, nunca o mapa em edição. */
export async function ultimoRetratoFolgas(operationId: string, year: number, month: number) {
  const [event] = await db.select({ action: historyEventsTable.action, afterState: historyEventsTable.afterState, occurredAt: historyEventsTable.occurredAt })
    .from(historyEventsTable)
    .where(and(inArray(historyEventsTable.action, ["FOLGA_MONTH_PUBLISHED", "FOLGA_MONTH_BASELINE"]), eq(historyEventsTable.status, "ACTIVE"), eq(historyEventsTable.entityId, chaveMesFolgas(operationId, year, month))))
    .orderBy(desc(historyEventsTable.occurredAt), desc(historyEventsTable.createdAt)).limit(1);
  if (!event) return null;
  const state = event.afterState as { folgas?: FolgaPublicada[] } | null;
  // Uma publicação antiga sem retrato não pode ser apresentada como se fosse a versão atual.
  return { publishedAt: event.action === "FOLGA_MONTH_PUBLISHED" ? event.occurredAt.toISOString() : null,
    retratoInicial: event.action === "FOLGA_MONTH_BASELINE", folgas: Array.isArray(state?.folgas) ? state.folgas : null };
}

/** Depois de mudar um mês publicado, a Administração recebe um aviso por alteração. */
export async function avisarRepublicacaoFolgas(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], organizationId: string, operationId: string, startDate: string, endDate: string, eventId: string) {
  const months: { year: number; month: number }[] = [];
  let year = Number(startDate.slice(0, 4)), month = Number(startDate.slice(5, 7));
  const last = Number(endDate.slice(0, 4)) * 12 + Number(endDate.slice(5, 7));
  while (year * 12 + month <= last && months.length < 24) { months.push({ year, month }); month++; if (month === 13) { year++; month = 1; } }
  const admins = await tx.selectDistinct({ id: userRolesTable.userId }).from(userRolesTable)
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true), eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE")));
  for (const period of months) {
    const key = chaveMesFolgas(operationId, period.year, period.month);
    const [publication] = await tx.select({ id: historyEventsTable.id }).from(historyEventsTable)
      .where(and(eq(historyEventsTable.entityId, key), eq(historyEventsTable.action, "FOLGA_MONTH_PUBLISHED"))).limit(1);
    if (!publication) continue;
    for (const admin of admins) await enqueueNotification(tx as never, {
      userId: admin.id, type: "folga.republication_needed", title: "Folgas precisam de nova publicação",
      message: `O mapa de ${String(period.month).padStart(2, "0")}/${period.year} mudou. Publique o mês de novo para avisar o Elenco.`,
      category: "absence", entityType: "folga_mes", entityId: key, actionUrl: "/folgas",
    }, new Date(), { deduplicationKey: `folga:republicar:${eventId}:${key}:${admin.id}` });
  }
}
