/**
 * A regra da equipe por local na Escala do dia (pacote O, O3).
 *
 * Só os blocos gerais ("todo mundo" e "a área", inclusive a janela de almoço) olham a equipe. Grupo e pessoas escolhidas pelo nome
 * não filtram, e o show lê o Livro do Dia (a regra do show é o O4). A regra é por PESSOA:
 * - sem nenhuma marca de equipe na temporada (em nenhum local): segue como antes, entra em tudo;
 * - com marca em algum local: só entra no bloco geral de um local se tem marca ali, naquele dia da semana, cruzando o horário do
 *   bloco, ou se o imprevisto do dia a trouxe para cá nesse horário;
 * - com marca mas sem nenhuma marca no dia (e sem imprevisto): não entra em bloco geral de nenhum local ("sem local hoje").
 * O imprevisto do dia (`escala_local_do_dia`) manda a pessoa para outro local naquela data e horário: ali ela entra, aqui não.
 */
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, escalaLocalDoDiaTable, locationsTable, programacaoEquipeTable, programacoesTable } from "@workspace/db";

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

/** Uma marca de equipe, já com o local a que pertence. */
export type MarcaDeEquipe = { userId: string; locationId: string; weekday: number; inicio: string | null; fim: string | null };
/** Um imprevisto do dia: a pessoa trabalha em `locationId` nessa data (de `inicio` a `fim`, ou o dia inteiro). */
export type ImprevistoDoDia = { id?: string; userId: string; locationId: string; inicio: string | null; fim: string | null };

export type RegraDaEquipe = {
  /** Há alguma marca de equipe vigente neste dia em algum local? Se não, a regra inteira fica desligada. */
  ativa: boolean;
  /** Esta pessoa entra no bloco geral de `locationId` entre `inicio` e `fim`? */
  entra: (userId: string, locationId: string, inicio: string, fim: string | null) => boolean;
  /** Tem marca na temporada, nenhuma no dia da semana e nenhum imprevisto: não entra em bloco geral de nenhum local. */
  semLocalHoje: (userId: string) => boolean;
};

/**
 * A janela da marca ([inicio, fim), vazio = desde o começo / até o fim do dia) cruza o bloco? Bloco sem fim é um ponto no horário de início:
 * "Acqua a partir de 14:00" não cruza um bloco das 08:00 que não diz quando termina.
 */
export function janelasSeCruzam(janela: { inicio: string | null; fim: string | null }, bloco: { inicio: string | null; fim: string | null }) {
  const j1 = janela.inicio ?? "00:00", j2 = janela.fim ?? "24:00", b1 = bloco.inicio ?? "00:00";
  if (!bloco.fim || bloco.fim <= b1) return b1 >= j1 && b1 < j2;
  return j1 < bloco.fim && b1 < j2;
}

/** Monta a regra do dia a partir das marcas vigentes e dos imprevistos. Pura: o banco só entra em `lerRegraDaEquipe`. */
export function montarRegraDaEquipe(marcas: MarcaDeEquipe[], imprevistos: ImprevistoDoDia[], weekday: number): RegraDaEquipe {
  const comMarca = new Set(marcas.map((m) => m.userId));
  const marcasDoDia = marcas.filter((m) => m.weekday === weekday);
  const doDia = new Map<string, MarcaDeEquipe[]>();
  for (const m of marcasDoDia) doDia.set(m.userId, [...(doDia.get(m.userId) ?? []), m]);
  const imprevistoDe = new Map<string, ImprevistoDoDia[]>();
  for (const i of imprevistos) imprevistoDe.set(i.userId, [...(imprevistoDe.get(i.userId) ?? []), i]);

  const entra: RegraDaEquipe["entra"] = (userId, locationId, inicio, fim) => {
    if (!comMarca.has(userId) && !imprevistoDe.has(userId)) return true;
    const janela = { inicio, fim };
    const imprevistos = imprevistoDe.get(userId) ?? [];
    // O imprevisto manda no horário que cobre: ali a pessoa fica onde ele disse, e nos outros locais não entra nesse horário.
    const cobre = imprevistos.filter((i) => janelasSeCruzam(i, janela));
    if (cobre.length) return cobre.some((i) => i.locationId === locationId);
    if (!comMarca.has(userId)) return true;
    return (doDia.get(userId) ?? []).some((m) => m.locationId === locationId && janelasSeCruzam(m, janela));
  };
  const semLocalHoje: RegraDaEquipe["semLocalHoje"] = (userId) => comMarca.has(userId) && !doDia.has(userId) && !imprevistoDe.has(userId);
  return { ativa: marcas.length > 0 || imprevistos.length > 0, entra, semLocalHoje };
}

/**
 * As marcas de equipe de todos os locais da casa, cada local com a Programação que vale neste dia (a de vigência mais curta; a "Especial" vence a "Natal").
 * Uma ida só ao banco: as Programações vigentes junto das suas marcas (cada ida custa, e a Escala do dia já faz muitas).
 */
export async function marcasVigentesNoDia(organizationId: string, date: string): Promise<MarcaDeEquipe[]> {
  const linhas = await db.select({
    programacaoId: programacoesTable.id, locationId: programacoesTable.locationId,
    userId: programacaoEquipeTable.userId, weekday: programacaoEquipeTable.weekday, inicio: programacaoEquipeTable.inicio, fim: programacaoEquipeTable.fim,
  }).from(programacoesTable)
    .innerJoin(locationsTable, eq(programacoesTable.locationId, locationsTable.id))
    .leftJoin(programacaoEquipeTable, and(eq(programacaoEquipeTable.programacaoId, programacoesTable.id), eq(programacaoEquipeTable.active, true)))
    .where(and(
      eq(locationsTable.organizationId, organizationId), eq(programacoesTable.active, true),
      lte(programacoesTable.vigenciaInicio, date), gte(programacoesTable.vigenciaFim, date),
    ))
    .orderBy(asc(sql`${programacoesTable.vigenciaFim} - ${programacoesTable.vigenciaInicio}`), desc(programacoesTable.createdAt), asc(programacoesTable.id));
  // A ordem põe a Programação mais curta (e, no empate, a mais nova) primeiro: a primeira de cada local é a que vale.
  const vale = new Map<string, string>();
  for (const l of linhas) if (!vale.has(l.locationId)) vale.set(l.locationId, l.programacaoId);
  return linhas
    .filter((l) => l.userId !== null && l.weekday !== null && vale.get(l.locationId) === l.programacaoId)
    .map((l) => ({ userId: l.userId!, locationId: l.locationId, weekday: l.weekday!, inicio: hhmm(l.inicio), fim: hhmm(l.fim) }));
}

/** Os imprevistos vivos do dia (a pessoa trabalha em outro local só nesta data). */
export async function imprevistosDoDia(organizationId: string, date: string): Promise<ImprevistoDoDia[]> {
  const linhas = await db.select({
    id: escalaLocalDoDiaTable.id, userId: escalaLocalDoDiaTable.userId, locationId: escalaLocalDoDiaTable.locationId, inicio: escalaLocalDoDiaTable.inicio, fim: escalaLocalDoDiaTable.fim,
  }).from(escalaLocalDoDiaTable).where(and(
    eq(escalaLocalDoDiaTable.organizationId, organizationId), eq(escalaLocalDoDiaTable.data, date), eq(escalaLocalDoDiaTable.active, true),
  ));
  return linhas.map((l) => ({ id: l.id, userId: l.userId, locationId: l.locationId, inicio: hhmm(l.inicio), fim: hhmm(l.fim) }));
}

/** Lê do banco e monta a regra do dia. */
export async function lerRegraDaEquipe(organizationId: string, date: string, weekday: number): Promise<RegraDaEquipe> {
  const [marcas, imprevistos] = await Promise.all([marcasVigentesNoDia(organizationId, date), imprevistosDoDia(organizationId, date)]);
  return montarRegraDaEquipe(marcas, imprevistos, weekday);
}
