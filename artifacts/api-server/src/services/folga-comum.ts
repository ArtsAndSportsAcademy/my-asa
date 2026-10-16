/**
 * O que as rotas do pedido de folga (troca, mediação, prioridade, regras, análise) têm em comum:
 * leitura de papel, formatação curta de dia, Registro na mesma transação, aviso por acontecimento e a
 * busca do pedido dentro da organização. Fica num lugar só para um papel novo ou um aviso novo
 * não exigir mexer em cinco arquivos.
 */
import { and, eq } from "drizzle-orm";
import { db, leaveRequestsTable } from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { enqueueNotification } from "./undo.js";

export const isAdmin = (role: string) => role === "ADMIN";
export const isDirector = (role: string) => role === "DIR" || role === "DIRECTOR";
export const isSupervisor = (role: string) => role === "SUPERVISOR_A" || role === "SUPERVISOR_B" || role === "SUP";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATA = /^\d{4}-\d{2}-\d{2}$/;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** "2026-10-29" → "29/10", para frases que as pessoas leem. */
export const dia = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
/** O id da rota, que o Express pode entregar como lista. */
export const idDaRota = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor) ?? "";

/** Grava no Registro dentro da transação em andamento. */
export const registrar = (tx: Tx, input: Parameters<typeof writeHistoryEvent>[0]) => writeHistoryEvent(input, tx as unknown as HistoryExecutor);

/** Um aviso por acontecimento e por pessoa: a chave impede o segundo, mesmo que o ciclo rode de novo. */
export async function avisarFolga(tx: Tx, userId: string, chave: string, type: string, title: string, message: string, requestId: string) {
  await enqueueNotification(tx as never, { userId, type, title, message, category: "absence", entityType: "leave_request", entityId: requestId, actionUrl: "/folgas" }, new Date(), { deduplicationKey: `folga:${requestId}:${chave}:${userId}` });
}

export async function pedidoDaOrganizacao(id: string, organizationId: string) {
  if (!UUID.test(id)) return null;
  const [pedido] = await db.select().from(leaveRequestsTable).where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.organizationId, organizationId))).limit(1);
  return pedido ?? null;
}

/** "Esperando o colega da troca" e "esperando a pessoa da proposta de dias" são derivados das colunas, não do status. */
export const esperandoColega = (p: { peerId: string | null; peerAccepted: boolean | null }) => Boolean(p.peerId) && p.peerAccepted === null;
export const esperandoPessoa = (p: { alternativeDates: string[] | null; alternativeAccepted: boolean | null }) => Boolean(p.alternativeDates?.length) && p.alternativeAccepted === null;

/** O início do motivo de decisão de um pedido que entrou como prioridade; é por ele que a gerência reconhece o que pode desfazer. */
export const MARCA_DE_PRIORIDADE = "Entrou como prioridade";
