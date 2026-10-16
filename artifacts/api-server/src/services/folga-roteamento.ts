/**
 * Para onde vai um pedido de folga (Etapa 3):
 *  - Mês de folgas ainda não publicado: o pedido entra direto como prioridade.
 *  - Mês publicado: espera a Supervisão da área da pessoa. A Administração só decide quando a Supervisão
 *    não respondeu e faltam N dias corridos para a data pedida (N é configurável, começa em 3), ou
 *    quando a área não tem Supervisão cadastrada.
 * "Publicado" é o mapa de folgas do mês (publicação ou retrato inicial), não a Escala do dia.
 */
import { and, eq } from "drizzle-orm";
import { areaLocalSupervisorsTable, db, operationsTable, userRolesTable, usersTable } from "@workspace/db";
import { ultimoRetratoFolgas } from "./folgas-publicadas.js";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Dias corridos entre duas datas ISO (positivo quando `data` é depois de `hoje`). */
export const diasAte = (data: string, hoje: string) =>
  Math.round((Date.parse(`${data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);

/** A Administração passa a poder decidir quando faltam `prazoDias` dias corridos ou menos. */
export const prazoAdminAberto = (dataPedida: string, hoje: string, prazoDias: number) => diasAte(dataPedida, hoje) <= prazoDias;

/** O dia em que o prazo abre (a data pedida menos o prazo), para dizer "a partir de DD/MM". */
export function diaEmQueOPrazoAbre(dataPedida: string, prazoDias: number) {
  const t = new Date(`${dataPedida}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - prazoDias);
  return t.toISOString().slice(0, 10);
}

export async function mesDeFolgasPublicado(operationId: string, date: string) {
  return (await ultimoRetratoFolgas(operationId, Number(date.slice(0, 4)), Number(date.slice(5, 7)))) !== null;
}

/** A operação ativa da pessoa (a mesma que a aprovação usa para gravar a folga). */
export async function operacaoDaPessoa(executor: Executor, userId: string, organizationId: string) {
  const [row] = await executor.select({ id: userRolesTable.operationId }).from(userRolesTable)
    .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true), eq(operationsTable.organizationId, organizationId))).limit(1);
  return row?.id ?? null;
}

/** Supervisão ativa da área da pessoa (a mesma regra que avisa o pedido). */
export async function supervisoresDaArea(executor: Executor, areaId: string | null): Promise<string[]> {
  if (!areaId) return [];
  const rows = await executor.selectDistinct({ id: areaLocalSupervisorsTable.supervisorId }).from(areaLocalSupervisorsTable)
    .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
    .where(and(eq(areaLocalSupervisorsTable.areaId, areaId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE")));
  return rows.map((r) => r.id);
}

export async function administradores(executor: Executor, organizationId: string): Promise<string[]> {
  const rows = await executor.selectDistinct({ id: userRolesTable.userId }).from(userRolesTable)
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE"), eq(userRolesTable.active, true), eq(userRolesTable.role, "ADMIN")));
  return rows.map((r) => r.id);
}
