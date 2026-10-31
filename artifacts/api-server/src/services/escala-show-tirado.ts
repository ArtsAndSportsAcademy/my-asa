/**
 * Show tirado do dia (Escala, 30/10/2026). "Tirar este show do dia" cancela o Livro do Dia e deixa no retrato dele a marca `tiradoDoDia`
 * (ver `tirarLivroDoDia` em routes/daily-book.ts). É essa marca que separa a decisão do dia de um cancelamento comum:
 * - a Escala não mostra o show na grade, mas lista "Tirado deste dia" com o botão de voltar;
 * - gerar o dia (ou o mês) NÃO recria o Livro de um show tirado;
 * - o resumo do mês conta o show tirado como resolvido, não como "Livro que falta".
 * Livro cancelado por apagar ou por descartar o mês não tem a marca e continua podendo ser gerado de novo.
 */
import { and, eq, sql } from "drizzle-orm";
import { agendaEventsTable, dailyBooksTable, db, showBooksTable, usersTable } from "@workspace/db";

/** Livro cancelado COM a marca de "tirado do dia". */
export const livroTiradoDoDia = and(eq(dailyBooksTable.status, "CANCELLED"), sql`${dailyBooksTable.snapshotJson}->'tiradoDoDia' is not null`);

export type ShowTirado = {
  dailyBookId: string; showBookId: string; sessionId: string | null; rotulo: string; inicio: string | null; fim: string | null;
  porId: string | null; porNome: string | null; em: string | null; motivo: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/** Os shows deste local que foram tirados do dia nesta data (do mais cedo ao mais tarde). */
export async function showsTiradosDoDia(locationId: string, date: string): Promise<ShowTirado[]> {
  const linhas = await db.select({
    id: dailyBooksTable.id, showBookId: dailyBooksTable.showBookId, sessionId: dailyBooksTable.sessionId, titulo: showBooksTable.title,
    inicio: agendaEventsTable.startTime, fim: agendaEventsTable.endTime, snapshot: dailyBooksTable.snapshotJson,
  }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .where(and(eq(agendaEventsTable.date, date), eq(showBooksTable.locationId, locationId), livroTiradoDoDia));
  if (!linhas.length) return [];
  const marcas = linhas.map((l) => (l.snapshot as { tiradoDoDia?: { por?: string; em?: string; motivo?: string | null } } | null)?.tiradoDoDia ?? {});
  const porIds = [...new Set(marcas.map((m) => m.por).filter((id): id is string => Boolean(id)))];
  const nomes = new Map<string, string>();
  for (const id of porIds) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (u) nomes.set(id, u.name);
  }
  return linhas.map((l, i) => ({
    dailyBookId: l.id, showBookId: l.showBookId!, sessionId: l.sessionId, rotulo: l.titulo, inicio: hhmm(l.inicio), fim: hhmm(l.fim),
    porId: marcas[i]!.por ?? null, porNome: marcas[i]!.por ? nomes.get(marcas[i]!.por!) ?? null : null, em: marcas[i]!.em ?? null, motivo: marcas[i]!.motivo ?? null,
  })).sort((a, b) => (a.inicio ?? "99:99").localeCompare(b.inicio ?? "99:99") || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}
