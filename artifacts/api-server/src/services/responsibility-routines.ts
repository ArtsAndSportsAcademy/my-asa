/**
 * Lista fixa da responsabilidade: o que quem cuida faz sempre. Cada item repete do jeito que o dono escolher —
 * nunca, todo dia, toda semana (no dia escolhido), todo mês ou a cada N dias. Marcar um item agenda a próxima vez; no dia
 * dela o item volta a ficar aberto e o dono recebe um aviso (um só, mesmo com o ciclo passando mil vezes).
 * "Depois de cada show" ficou para depois: depende da escala.
 */
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db, responsibilitiesTable, responsibilityRoutinesTable, usersTable, type RepeatKind, type ResponsibilityRoutine } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { OPERATIONAL_TIME_ZONE, operationalDate } from "../lib/operational-date.js";
import { enqueueNotification, databaseNow, type Transaction } from "./undo.js";
import { TarefaError, type Ator } from "./task-steps.js";

export type Regra = { kind: RepeatKind; n?: number | null; weekday?: number | null };
const HORA_MINIMA = 8;

/** A próxima data (AAAA-MM-DD) depois de `aPartirDe`, ou null quando o item não repete. */
export function proximaData(regra: Regra, aPartirDe: string): string | null {
  const base = new Date(`${aPartirDe}T12:00:00Z`);
  const em = (dias: number) => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
  switch (regra.kind) {
    case "NONE": return null;
    case "DAILY": return em(1);
    case "WEEKLY": {
      if (!Number.isInteger(regra.weekday) || regra.weekday! < 0 || regra.weekday! > 6) throw new Error("Escolha o dia da semana.");
      return em((regra.weekday! - base.getUTCDay() + 7) % 7 || 7);
    }
    case "EVERY_N_DAYS": {
      if (!Number.isInteger(regra.n) || regra.n! < 1 || regra.n! > 365) throw new Error("Escolha de quantos em quantos dias, de 1 a 365.");
      return em(regra.n!);
    }
    case "MONTHLY": {
      const [ano, mes, dia] = aPartirDe.split("-").map(Number) as [number, number, number];
      const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
      return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo), 12)).toISOString().slice(0, 10);
    }
  }
}

/** Valida a repetição que veio da tela e devolve uma recusa com a frase da regra. */
export function lerRegra(corpo: { repeatKind?: unknown; repeatN?: unknown; weekday?: unknown }): Regra {
  const kind = (corpo.repeatKind ?? "NONE") as RepeatKind;
  if (!["NONE", "DAILY", "WEEKLY", "MONTHLY", "EVERY_N_DAYS"].includes(kind)) throw new TarefaError(400, "Escolha uma repetição: nunca, todo dia, toda semana, todo mês ou a cada tantos dias.");
  const regra: Regra = { kind, n: kind === "EVERY_N_DAYS" ? Number(corpo.repeatN) : null, weekday: kind === "WEEKLY" ? Number(corpo.weekday) : null };
  try { proximaData(regra, "2026-01-01"); } catch (erro) { throw new TarefaError(400, (erro as Error).message); }
  return regra;
}

async function nomeDe(tx: Pick<typeof db, "select">, userId: string) {
  const [row] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.name ?? userId;
}
async function registrar(tx: Transaction, ator: Ator, nome: string, item: ResponsibilityRoutine, action: string, titulo: string, narrativa: string, metadata: Record<string, unknown> = {}) {
  await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action, title: titulo, narrative: narrativa, entityType: "responsibility_routine", entityId: item.id, actorId: ator.id, actorName: nome, orgId: ator.organizationId, metadata: { responsibilityId: item.responsibilityId, ...metadata } }, tx as never);
}

export async function criarItem(tx: Transaction, ator: Ator, responsibilityId: string, corpo: { title?: string; repeatKind?: unknown; repeatN?: unknown; weekday?: unknown }) {
  const title = corpo.title?.trim();
  if (!title) throw new TarefaError(400, "Dê um nome ao item.");
  const regra = lerRegra(corpo);
  const [item] = await tx.insert(responsibilityRoutinesTable).values({ responsibilityId, title, ownerId: ator.id, repeatKind: regra.kind, repeatN: regra.n ?? null, weekday: regra.weekday ?? null, createdBy: ator.id }).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, item!, "responsibility.routine_created", `Item da lista fixa: ${title}`, `${nome} acrescentou "${title}" à lista fixa.`, { repeatKind: regra.kind });
  return item!;
}

async function carregarItem(tx: Transaction, responsibilityId: string, itemId: string) {
  const [item] = await tx.select().from(responsibilityRoutinesTable).where(and(eq(responsibilityRoutinesTable.id, itemId), eq(responsibilityRoutinesTable.responsibilityId, responsibilityId))).for("update").limit(1);
  if (!item) throw new TarefaError(404, "Item não encontrado.");
  return item;
}

export async function atualizarItem(tx: Transaction, ator: Ator, responsibilityId: string, itemId: string, corpo: { title?: string; repeatKind?: unknown; repeatN?: unknown; weekday?: unknown }) {
  const item = await carregarItem(tx, responsibilityId, itemId);
  const campos: Partial<ResponsibilityRoutine> = {};
  if (corpo.title !== undefined) { if (!corpo.title.trim()) throw new TarefaError(400, "Dê um nome ao item."); campos.title = corpo.title.trim(); }
  if (corpo.repeatKind !== undefined) {
    const regra = lerRegra(corpo);
    Object.assign(campos, { repeatKind: regra.kind, repeatN: regra.n ?? null, weekday: regra.weekday ?? null });
    // Item já marcado: a próxima vez passa a seguir a repetição nova, contada de hoje.
    if (item.done) campos.nextDueOn = proximaData(regra, operationalDate(new Date()));
  }
  const [novo] = await tx.update(responsibilityRoutinesTable).set(campos).where(eq(responsibilityRoutinesTable.id, itemId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, novo!, "responsibility.routine_updated", `Item da lista fixa atualizado: ${novo!.title}`, `${nome} mudou o item "${item.title}" da lista fixa.`, { campos: Object.keys(campos) });
  return novo!;
}

export async function marcarItem(tx: Transaction, ator: Ator, responsibilityId: string, itemId: string) {
  const item = await carregarItem(tx, responsibilityId, itemId);
  if (!item.active) throw new TarefaError(409, "Esse item foi removido. Restaure antes de marcar.");
  const agora = await databaseNow(tx);
  const proxima = proximaData({ kind: item.repeatKind, n: item.repeatN, weekday: item.weekday }, operationalDate(agora));
  const [novo] = await tx.update(responsibilityRoutinesTable).set({ done: true, lastDoneAt: agora, nextDueOn: proxima }).where(eq(responsibilityRoutinesTable.id, itemId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, novo!, "responsibility.routine_checked", `Item feito: ${item.title}`, `${nome} marcou "${item.title}" como feito${proxima ? `; volta em ${proxima}` : ""}.`, { nextDueOn: proxima });
  return novo!;
}

export async function desmarcarItem(tx: Transaction, ator: Ator, responsibilityId: string, itemId: string) {
  const item = await carregarItem(tx, responsibilityId, itemId);
  const [novo] = await tx.update(responsibilityRoutinesTable).set({ done: false, nextDueOn: null }).where(eq(responsibilityRoutinesTable.id, itemId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, novo!, "responsibility.routine_unchecked", `Item reaberto: ${item.title}`, `${nome} desmarcou "${item.title}".`);
  return novo!;
}

export async function removerItem(tx: Transaction, ator: Ator, responsibilityId: string, itemId: string, motivoBruto: unknown) {
  const item = await carregarItem(tx, responsibilityId, itemId);
  const motivo = typeof motivoBruto === "string" ? motivoBruto.trim() : "";
  if (!motivo) throw new TarefaError(400, "Escreva o motivo para tirar o item. Ele fica no Registro, e dá para trazê-lo de volta.");
  const [novo] = await tx.update(responsibilityRoutinesTable).set({ active: false, removedReason: motivo }).where(eq(responsibilityRoutinesTable.id, itemId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, novo!, "responsibility.routine_removed", `Item tirado da lista: ${item.title}`, `${nome} tirou "${item.title}" da lista fixa. Motivo: ${motivo}.`, { reason: motivo });
  return novo!;
}

export async function restaurarItem(tx: Transaction, ator: Ator, responsibilityId: string, itemId: string) {
  const item = await carregarItem(tx, responsibilityId, itemId);
  const [novo] = await tx.update(responsibilityRoutinesTable).set({ active: true, removedReason: null }).where(eq(responsibilityRoutinesTable.id, itemId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, novo!, "responsibility.routine_restored", `Item de volta à lista: ${item.title}`, `${nome} trouxe "${item.title}" de volta à lista fixa.`);
  return novo!;
}

function minutosDoRelogio(now: Date) {
  const [hora, minuto] = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number);
  return hora! * 60 + minuto!;
}

/** No dia da próxima vez, o item marcado volta a ficar aberto e o dono recebe um aviso. Roda no ciclo operacional. */
export async function voltarRotinas(now = new Date(), organizationId?: string) {
  if (minutosDoRelogio(now) < HORA_MINIMA * 60) return { voltaram: 0 };
  const hoje = operationalDate(now);
  const prontos = await db.select({ item: responsibilityRoutinesTable, resp: responsibilitiesTable.title, orgId: responsibilitiesTable.orgId })
    .from(responsibilityRoutinesTable).innerJoin(responsibilitiesTable, eq(responsibilitiesTable.id, responsibilityRoutinesTable.responsibilityId))
    .where(and(eq(responsibilityRoutinesTable.active, true), eq(responsibilityRoutinesTable.done, true), isNotNull(responsibilityRoutinesTable.nextDueOn), lte(responsibilityRoutinesTable.nextDueOn, hoje), ...(organizationId ? [eq(responsibilitiesTable.orgId, organizationId)] : [])));
  let voltaram = 0;
  for (const { item, resp, orgId } of prontos) {
    const voltou = await db.transaction(async (tx) => {
      const [aberto] = await tx.update(responsibilityRoutinesTable).set({ done: false, nextDueOn: null })
        .where(and(eq(responsibilityRoutinesTable.id, item.id), eq(responsibilityRoutinesTable.done, true), eq(responsibilityRoutinesTable.active, true))).returning();
      if (!aberto) return false;
      await enqueueNotification(tx, { userId: item.ownerId, type: "responsibility.routine_back", title: "Voltou para a sua lista", message: `${item.title} (${resp}).`, priority: "NORMAL", category: "responsibility", entityType: "responsibility_routine", entityId: item.id, actionUrl: "/responsabilidades" }, now, { deduplicationKey: `rotina:${item.id}:${item.nextDueOn}` });
      await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "responsibility.routine_back", title: `Item voltou: ${item.title}`, narrative: `O item "${item.title}" da lista fixa de ${resp} voltou a ficar aberto, como a repetição pede.`, entityType: "responsibility_routine", entityId: item.id, actorType: "DETERMINISTIC_ENGINE", orgId, metadata: { responsibilityId: item.responsibilityId, repeatKind: item.repeatKind } }, tx as never);
      return true;
    });
    if (voltou) voltaram++;
  }
  return { voltaram };
}
