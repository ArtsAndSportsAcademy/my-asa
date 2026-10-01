/** Solicitações no Meu Dia: o que espera esta pessoa (regras completas em routes/solicitacoes.ts). */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, requestsTable } from "@workspace/db";
import { listAreaLocalScopes } from "./area-local-scope.js";

export async function pedidosEsperando(ator: { sub: string; organizationId: string; role: string }) {
  const daOrg = eq(requestsTable.organizationId, ator.organizationId);
  const [meus, colega] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(requestsTable).where(and(daOrg, eq(requestsTable.requesterId, ator.sub), inArray(requestsTable.status, ["WAITING_PEER", "PENDING"]))),
    db.select({ n: sql<number>`count(*)::int` }).from(requestsTable).where(and(daOrg, eq(requestsTable.peerId, ator.sub), eq(requestsTable.status, "WAITING_PEER"))),
  ]);
  let paraDecidir = 0;
  const admin = ator.role === "ADMIN", sup = ator.role === "SUPERVISOR_A" || ator.role === "SUPERVISOR_B" || ator.role === "SUP";
  if (admin || sup) {
    const areas = admin ? null : [...new Set((await listAreaLocalScopes(ator.sub, ator.organizationId)).map((s) => s.areaId))];
    if (!areas || areas.length) {
      const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(requestsTable).where(and(
        daOrg, eq(requestsTable.status, "PENDING"), sql`${requestsTable.requesterId} <> ${ator.sub}`, areas ? inArray(requestsTable.areaId, areas) : undefined,
      ));
      paraDecidir = n?.n ?? 0;
    }
  }
  return { meusEmAnalise: meus[0]?.n ?? 0, colegaEspera: colega[0]?.n ?? 0, paraDecidir };
}
