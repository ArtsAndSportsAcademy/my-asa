/**
 * Para onde vai um pedido de folga (Etapa 3, decisão de 19/10/2026):
 *  - Todo pedido espera a Supervisão da área da pessoa, publicado ou não o mapa do mês.
 *  - A Administração só decide quando a Supervisão não respondeu e faltam N dias corridos para a data
 *    pedida (N é configurável, começa em 3), ou quando a área não tem Supervisão cadastrada.
 * "Publicado" é o mapa de folgas do mês (publicação ou retrato inicial), não a Escala do dia.
 */
import { and, eq } from "drizzle-orm";
import { areaLocalSupervisorsTable, db, operationsTable, userRolesTable, usersTable } from "@workspace/db";
import { ultimoRetratoFolgas } from "./folgas-publicadas.js";
import { operationalDate } from "../lib/operational-date.js";

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

/**
 * O mapa está publicado para um pedido que atravessa meses quando QUALQUER mês do período já foi publicado:
 * mexer num mês publicado depende de olhar o dia, mesmo que o início caia num mês ainda aberto.
 */
export async function mesDeFolgasPublicadoNoPeriodo(operationId: string, inicio: string, fim: string) {
  const visto = new Set<string>();
  for (let t = new Date(`${inicio.slice(0, 7)}-01T12:00:00Z`); t.toISOString().slice(0, 7) <= fim.slice(0, 7) && visto.size < 4; t.setUTCMonth(t.getUTCMonth() + 1)) {
    const mes = t.toISOString().slice(0, 7);
    visto.add(mes);
    if (await mesDeFolgasPublicado(operationId, `${mes}-01`)) return true;
  }
  return false;
}

/** A operação ativa da pessoa (a mesma que a aprovação usa para gravar a folga). */
export async function operacaoDaPessoa(executor: Executor, userId: string, organizationId: string) {
  const [row] = await executor.select({ id: userRolesTable.operationId }).from(userRolesTable)
    .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true), eq(operationsTable.organizationId, organizationId))).limit(1);
  return row?.id ?? null;
}

/** Supervisão ativa da área da pessoa (a mesma regra que avisa o pedido). */
export async function supervisoresDaArea(executor: Executor, areaId: string | null, menos?: string): Promise<string[]> {
  if (!areaId) return [];
  const rows = await executor.selectDistinct({ id: areaLocalSupervisorsTable.supervisorId }).from(areaLocalSupervisorsTable)
    .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
    .where(and(eq(areaLocalSupervisorsTable.areaId, areaId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE")));
  // Quem pediu a própria folga não decide por si: sem outra pessoa na Supervisão, a decisão vai para a Administração.
  return rows.map((r) => r.id).filter((id) => id !== menos);
}

export async function administradores(executor: Executor, organizationId: string): Promise<string[]> {
  const rows = await executor.selectDistinct({ id: userRolesTable.userId }).from(userRolesTable)
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE"), eq(userRolesTable.active, true), eq(userRolesTable.role, "ADMIN")));
  return rows.map((r) => r.id);
}

/** "15/03" ou "15/03 a 17/03" (com o ano quando não é o ano de hoje), para frases que as pessoas leem: avisos e Registro. */
export function periodoLegivel(inicio: string, fim: string, hoje = operationalDate()): string {
  const curta = (iso: string) => { const [a, m, d] = iso.split("-"); return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`; };
  return inicio === fim ? curta(inicio) : `${curta(inicio)} a ${curta(fim)}`;
}
