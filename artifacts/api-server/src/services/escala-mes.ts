/**
 * Escalas do mês em rascunho. Gerar o mês é o MESMO passo de gerar um dia, repetido em ordem:
 * a Escala do dia nasce em rascunho e cada show da Programação (regra "livro") ganha o seu Livro do
 * Dia em rascunho. Não há regra nova de geração aqui — só orquestração, resumo e desfazer.
 *
 * - Em ordem, do primeiro ao último dia, nunca em paralelo: o equilíbrio por carga do rodízio olha o
 *   que os dias anteriores já escalaram.
 * - Cada chamada tem um orçamento de tempo (a Vercel mata a função em 60 s): devolve o que gerou e o
 *   que falta, e a tela chama de novo. Dia já gerado é pulado; refazer a chamada retoma de onde parou.
 * - Nada é publicado e ninguém é avisado (rascunho é rascunho).
 */
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import {
  agendaEventsTable, dailyBookAssignmentsTable, dailyBookPositionsTable, dailyBooksTable, db, escalaBlocoAjustesTable,
  historyEventsTable, locationsTable, programacaoBlocosTable, programacoesTable, scaleAllocationsTable, scalesTable, showBooksTable,
} from "@workspace/db";
import { nomeFormalDoAtor, writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { conferirConflitosDosLivros, generateDailyBookDraftForScale } from "../routes/daily-book.js";
import { eligibleSessions, eligibleSessionsDoDia } from "./session-blocks.js";
import { janelaDoMes, lembrarOuLer, LeiturasDoMes } from "./leituras-do-mes.js";
import { diaFechadoDoLocal, findEscalaDoDia, operationForLocation } from "./escala-dia.js";

export type ActorMes = { sub: string; role: string; organizationId: string };
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const pad = (n: number) => String(n).padStart(2, "0");

/** A Programação que gera o dia: a ativa que cobre a data (mesma escolha do "gerar o dia"). */
export async function programacaoDoDia(locationId: string, organizationId: string, date: string) {
  const [programacao] = await db.select().from(programacoesTable).where(and(
    eq(programacoesTable.locationId, locationId), eq(programacoesTable.active, true),
    eq(programacoesTable.organizationId, organizationId),
    lte(programacoesTable.vigenciaInicio, date), gte(programacoesTable.vigenciaFim, date),
  )).orderBy(asc(programacoesTable.vigenciaFim), asc(programacoesTable.createdAt)).limit(1);
  return programacao ?? null;
}

export type ResultadoDia =
  | { ok: true; scale: typeof scalesTable.$inferSelect; livros: Awaited<ReturnType<typeof generateDailyBookDraftForScale>>[] }
  | { ok: false; status: number; error: string; message: string };

/**
 * A Programação do dia e os blocos de Livro dela. Com as leituras do mês, as Programações do mês e seus blocos são lidos
 * uma vez e o dia é escolhido aqui, com a mesma regra de `programacaoDoDia` (a que cobre a data, a de fim mais próximo).
 */
async function programacaoEBlocosDoDia(locationId: string, organizationId: string, date: string, leituras?: LeiturasDoMes) {
  if (!leituras) {
    const programacao = await programacaoDoDia(locationId, organizationId, date);
    const blocos = programacao ? await db.select().from(programacaoBlocosTable).where(and(
      eq(programacaoBlocosTable.programacaoId, programacao.id), eq(programacaoBlocosTable.weekday, weekdayOf(date)),
      eq(programacaoBlocosTable.regra, "livro"), eq(programacaoBlocosTable.active, true),
    )) : [];
    return { programacao, blocos };
  }
  const { inicio, fim } = janelaDoMes(date);
  const programacoes = await leituras.lembrar(`programacoes:${locationId}:${organizationId}:${inicio}`, () => db.select().from(programacoesTable).where(and(
    eq(programacoesTable.locationId, locationId), eq(programacoesTable.active, true), eq(programacoesTable.organizationId, organizationId),
    lte(programacoesTable.vigenciaInicio, fim), gte(programacoesTable.vigenciaFim, inicio),
  )).orderBy(asc(programacoesTable.vigenciaFim), asc(programacoesTable.createdAt)));
  const programacao = programacoes.find((p) => p.vigenciaInicio <= date && p.vigenciaFim >= date) ?? null;
  if (!programacao) return { programacao, blocos: [] as (typeof programacaoBlocosTable.$inferSelect)[] };
  const blocosDoMes = await leituras.lembrar(`programacao-blocos:${locationId}:${organizationId}:${inicio}`, () => db.select().from(programacaoBlocosTable).where(and(
    inArray(programacaoBlocosTable.programacaoId, programacoes.map((p) => p.id)), eq(programacaoBlocosTable.regra, "livro"), eq(programacaoBlocosTable.active, true),
  )));
  return { programacao, blocos: blocosDoMes.filter((b) => b.programacaoId === programacao.id && b.weekday === weekdayOf(date)) };
}

/** Gera (ou completa) a Escala em rascunho de um local num dia e os Livros dos shows da Programação. */
export async function gerarDiaDoLocal(actor: ActorMes, location: { id: string; name: string }, date: string, opts: { leituras?: LeiturasDoMes } = {}): Promise<ResultadoDia> {
  // Gerar um dia sozinho também reaproveita o que não muda no meio da geração (o Livro do Show, as regras do local, a Escala dos outros locais):
  // antes só o "Gerar o mês" fazia isso, e cada Livro do dia remontava os outros locais de novo.
  const leituras = opts.leituras ?? new LeiturasDoMes();
  const locationId = location.id;
  let scale = await findEscalaDoDia(locationId, date);
  if (scale && scale.status !== "DRAFT") return { ok: false, status: 409, error: "ESCALA_JA_PUBLICADA", message: "O dia já foi publicado; use republicação para uma alteração posterior." };
  if (!scale) {
    const fechado = await diaFechadoDoLocal(locationId, date);
    if (fechado) return { ok: false, status: 409, error: "LOCAL_FECHADO", message: fechado.motivo };
  }
  const operationId = scale?.operationId ?? await lembrarOuLer(leituras, `operacao-do-local:${locationId}`, () => operationForLocation(locationId));
  if (!operationId) return { ok: false, status: 409, error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." };
  if (!scale) {
    const nomeFormal = await nomeFormalDoAtor(actor.sub, leituras);
    scale = await db.transaction(async (tx) => {
      const [created] = await tx.insert(scalesTable).values({
        operationId, locationId, title: `Escala do dia · ${location.name} · ${date}`, periodStart: date, periodEnd: date,
        status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
      }).returning();
      await writeHistoryEvent({
        category: "SCALE", action: "escala.gerada", title: "Escala do dia gerada",
        narrative: `Escala em rascunho de ${location.name} para ${date} gerada a partir da Programação.`,
        entityType: "scale", entityId: created!.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
        beforeState: null, afterState: { scale: created }, nomeFormalDoAtor: nomeFormal,
      }, tx as unknown as HistoryExecutor);
      return created!;
    });
  }
  const { blocos } = await programacaoEBlocosDoDia(locationId, actor.organizationId, date, leituras);
  const showIds = [...new Set(blocos.map((b) => b.showBookId).filter((id): id is string => Boolean(id)))];
  const validShows = showIds.length ? await lembrarOuLer(leituras, `shows-validos:${locationId}:${operationId}:${[...showIds].sort().join(",")}`, () => db.select({ id: showBooksTable.id }).from(showBooksTable).where(and(
    inArray(showBooksTable.id, showIds), eq(showBooksTable.locationId, locationId), eq(showBooksTable.operationId, operationId),
  ))) : [];
  if (validShows.length !== showIds.length) return { ok: false, status: 409, error: "SHOW_FORA_DO_LOCAL", message: "A Programação referencia um Show que não pertence a este local." };
  // Sessão separada (0071) tem Livro próprio; as demais sessões (ou show sem sessão) dividem o Livro do dia.
  // Em ordem de hora, para a sessão das 11:30 existir antes da das 15:30: a carga do dia só enxerga Livros já gravados.
  const alvos: { showBookId: string; sessionId: string | null; inicio: string; sessoesComuns: Awaited<ReturnType<typeof eligibleSessions>> }[] = [];
  for (const show of validShows) {
    const sessoes = await eligibleSessionsDoDia(show.id, date, leituras);
    const sessoesComuns = sessoes.filter((x) => !x.separada);
    const inicioDoShow = blocos.filter((b) => b.showBookId === show.id).map((b) => b.inicio).sort()[0] ?? "99:99";
    for (const sessao of sessoes.filter((x) => x.separada)) alvos.push({ showBookId: show.id, sessionId: sessao.id, inicio: sessao.startTime, sessoesComuns });
    if (sessoes.length === 0 || sessoes.some((x) => !x.separada)) alvos.push({ showBookId: show.id, sessionId: null, inicio: inicioDoShow, sessoesComuns });
  }
  alvos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  // Os Livros saem um de cada vez (cada um enxerga os anteriores na carga do dia); os conflitos de horário, que só
  // dependem de o dia estar completo, são conferidos UMA vez para todos no fim — quem está em dois Livros é conferido uma vez.
  const livros = [];
  for (const alvo of alvos) livros.push(await generateDailyBookDraftForScale({
    showBookId: alvo.showBookId, sessionId: alvo.sessionId, date, scaleId: scale.id, actorId: actor.sub, organizationId: actor.organizationId,
    reason: "Geração da Escala do dia", leituras, conferirConflitos: false, sessoesComuns: alvo.sessoesComuns,
  }));
  if (livros.length) {
    const conflitos = await conferirConflitosDosLivros(livros.map((l) => l.dailyBook.id), date);
    for (const livro of livros) livro.conflicts = conflitos.get(livro.dailyBook.id)!;
  }
  return { ok: true, scale, livros };
}

// ─── Mês ──────────────────────────────────────────────────────────────────────

/** Meses que se pode gerar: o corrente e até 2 à frente (decisão de 14/10/2026). */
export const MESES_A_FRENTE = 2;

export const FRASE_LOCAL_SEM_OPERACAO = "Este local não está ligado a nenhuma operação. Ligue-o em Gestão → Operações para poder gerar o mês.";

export function validarMes(year: unknown, month: unknown, hoje = operationalDate()): { year: number; month: number } | { erro: string } {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12 || y < 2000 || y > 2100) return { erro: "Informe o ano e o mês." };
  const [hy, hm] = hoje.split("-").map(Number) as [number, number];
  const distancia = (y - hy) * 12 + (m - hm);
  if (distancia < 0) return { erro: "Esse mês já passou." };
  if (distancia > MESES_A_FRENTE) return { erro: `Só dá para gerar o mês corrente e até ${MESES_A_FRENTE} meses à frente.` };
  return { year: y, month: m };
}

export type EstadoDiaMes =
  | "a_gerar" | "faltam_livros" | "completo" | "publicado" | "passou" | "fechado" | "sem_programacao" | "sem_atividades";
export type DiaMes = { date: string; weekday: number; estado: EstadoDiaMes; motivo: string | null; livrosEsperados: number; livrosGerados: number; escalaStatus: string | null };

/** Estado de cada dia do mês de um local — só leitura. Mesmas regras do gerar o dia. */
export async function resumoDoMes(organizationId: string, locationId: string, year: number, month: number, hoje = operationalDate()): Promise<{ location: { id: string; name: string }; dias: DiaMes[]; semOperacao: boolean } | null> {
  const [location] = await db.select().from(locationsTable).where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId))).limit(1);
  if (!location) return null;
  // Local desligado de toda operação (Gestão → Operações) não tem onde nascer a Escala: o mês inteiro falharia dia a dia
  // com a mesma frase. Quem lê o resumo recebe o aviso uma vez só.
  const semOperacao = !(await operationForLocation(locationId));
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const primeiroDia = `${year}-${pad(month)}-01`, ultimoDia = `${year}-${pad(month)}-${pad(ultimo)}`;

  const programacoes = await db.select().from(programacoesTable).where(and(
    eq(programacoesTable.locationId, locationId), eq(programacoesTable.active, true), eq(programacoesTable.organizationId, organizationId),
    lte(programacoesTable.vigenciaInicio, ultimoDia), gte(programacoesTable.vigenciaFim, primeiroDia),
  )).orderBy(asc(programacoesTable.vigenciaFim), asc(programacoesTable.createdAt));
  const blocos = programacoes.length ? await db.select().from(programacaoBlocosTable).where(and(
    inArray(programacaoBlocosTable.programacaoId, programacoes.map((p) => p.id)), eq(programacaoBlocosTable.active, true),
  )) : [];
  const escalas = await db.select().from(scalesTable).where(and(
    eq(scalesTable.locationId, locationId), ne(scalesTable.status, "ARCHIVED"), lte(scalesTable.periodStart, ultimoDia), gte(scalesTable.periodEnd, primeiroDia),
  ));
  const showIdsDoLocal = (await db.select({ id: showBooksTable.id }).from(showBooksTable).where(eq(showBooksTable.locationId, locationId))).map((s) => s.id);
  const livros = showIdsDoLocal.length ? await db.select({ date: agendaEventsTable.date, showBookId: dailyBooksTable.showBookId }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .where(and(inArray(dailyBooksTable.showBookId, showIdsDoLocal), gte(agendaEventsTable.date, primeiroDia), lte(agendaEventsTable.date, ultimoDia), ne(dailyBooksTable.status, "CANCELLED"))) : [];

  const dias: DiaMes[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`, weekday = weekdayOf(date);
    const base = { date, weekday, livrosEsperados: 0, livrosGerados: 0, escalaStatus: null as string | null };
    if (date < hoje) { dias.push({ ...base, estado: "passou", motivo: "Esse dia já passou." }); continue; }
    if (location.closed || !(location.operatingDays ?? []).includes(weekday)) { dias.push({ ...base, estado: "fechado", motivo: location.closed ? (location.closedReason ?? "Local fechado.") : "O local não abre neste dia da semana." }); continue; }
    const programacao = programacoes.find((p) => p.vigenciaInicio <= date && p.vigenciaFim >= date);
    if (!programacao) { dias.push({ ...base, estado: "sem_programacao", motivo: "Sem Programação para este dia." }); continue; }
    const doDia = blocos.filter((b) => b.programacaoId === programacao.id && b.weekday === weekday);
    if (!doDia.length) { dias.push({ ...base, estado: "sem_atividades", motivo: "A Programação não tem blocos neste dia da semana." }); continue; }
    const esperados = [...new Set(doDia.filter((b) => b.regra === "livro").map((b) => b.showBookId).filter((id): id is string => Boolean(id)))];
    const gerados = esperados.filter((id) => livros.some((l) => l.date === date && l.showBookId === id)).length;
    const escala = escalas.find((e) => e.periodStart <= date && e.periodEnd >= date) ?? null;
    const comum = { ...base, livrosEsperados: esperados.length, livrosGerados: gerados, escalaStatus: escala?.status ?? null };
    if (escala && escala.status !== "DRAFT") { dias.push({ ...comum, estado: "publicado", motivo: "Já publicado." }); continue; }
    if (!escala) { dias.push({ ...comum, estado: "a_gerar", motivo: null }); continue; }
    dias.push(gerados < esperados.length ? { ...comum, estado: "faltam_livros", motivo: `Faltam ${esperados.length - gerados} Livro(s).` } : { ...comum, estado: "completo", motivo: null });
  }
  return { location: { id: location.id, name: location.name }, dias, semOperacao };
}

// ─── Descartar rascunhos do mês (e desfazer) ──────────────────────────────────

export type DiaDescartavel = {
  date: string; escalaId: string; livros: number;
  /** O que a gerência mexeu à mão neste dia — se há algo, o dia só entra com a confirmação dela. */
  ajustes: { naEscala: number; atividadesManuais: number; vagasTrocadas: number; posicoesTiradas: number; total: number };
};

/** Dias do mês com Escala ainda em rascunho (de hoje em diante) e o que seria perdido em cada um. Só leitura. */
export async function descartaveisDoMes(organizationId: string, locationId: string, year: number, month: number, hoje = operationalDate()): Promise<{ location: { id: string; name: string }; dias: DiaDescartavel[] } | null> {
  const [location] = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId))).limit(1);
  if (!location) return null;
  const primeiro = `${year}-${pad(month)}-01`, ultimo = `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  const escalas = await db.select().from(scalesTable).where(and(
    eq(scalesTable.locationId, locationId), eq(scalesTable.status, "DRAFT"), gte(scalesTable.periodStart, primeiro > hoje ? primeiro : hoje), lte(scalesTable.periodStart, ultimo),
  )).orderBy(asc(scalesTable.periodStart));
  if (!escalas.length) return { location, dias: [] };
  const ids = escalas.map((e) => e.id);
  const [ajustes, manuais, livros] = await Promise.all([
    db.select({ scaleId: escalaBlocoAjustesTable.scaleId }).from(escalaBlocoAjustesTable).where(and(inArray(escalaBlocoAjustesTable.scaleId, ids), eq(escalaBlocoAjustesTable.active, true))),
    db.select({ scaleId: scaleAllocationsTable.scaleId }).from(scaleAllocationsTable).where(and(inArray(scaleAllocationsTable.scaleId, ids), eq(scaleAllocationsTable.active, true), isNotNull(scaleAllocationsTable.manualDate))),
    db.select({ id: dailyBooksTable.id, scaleId: dailyBooksTable.scaleId }).from(dailyBooksTable).where(and(inArray(dailyBooksTable.scaleId, ids), eq(dailyBooksTable.status, "DRAFT"))),
  ]);
  const livroIds = livros.map((l) => l.id);
  const [trocadas, tiradas] = livroIds.length ? await Promise.all([
    db.select({ livro: dailyBookAssignmentsTable.dailyBookId }).from(dailyBookAssignmentsTable).where(and(inArray(dailyBookAssignmentsTable.dailyBookId, livroIds), eq(dailyBookAssignmentsTable.manual, true), isNull(dailyBookAssignmentsTable.supersededAt), ne(dailyBookAssignmentsTable.status, "REMOVED"))),
    db.select({ livro: dailyBookPositionsTable.dailyBookId }).from(dailyBookPositionsTable).where(and(inArray(dailyBookPositionsTable.dailyBookId, livroIds), eq(dailyBookPositionsTable.isRemoved, true), isNull(dailyBookPositionsTable.supersededAt))),
  ]) : [[], []];
  const escalaDoLivro = new Map(livros.map((l) => [l.id, l.scaleId!]));
  const conta = <T,>(linhas: T[], chave: (l: T) => string | undefined) => { const m = new Map<string, number>(); for (const l of linhas) { const k = chave(l); if (k) m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const naEscala = conta(ajustes, (a) => a.scaleId), manuaisPorEscala = conta(manuais, (a) => a.scaleId);
  const trocadasPorEscala = conta(trocadas, (t) => escalaDoLivro.get(t.livro)), tiradasPorEscala = conta(tiradas, (t) => escalaDoLivro.get(t.livro));
  const livrosPorEscala = conta(livros, (l) => l.scaleId ?? undefined);
  return {
    location,
    dias: escalas.map((e) => {
      const a = { naEscala: naEscala.get(e.id) ?? 0, atividadesManuais: manuaisPorEscala.get(e.id) ?? 0, vagasTrocadas: trocadasPorEscala.get(e.id) ?? 0, posicoesTiradas: tiradasPorEscala.get(e.id) ?? 0 };
      return { date: e.periodStart, escalaId: e.id, livros: livrosPorEscala.get(e.id) ?? 0, ajustes: { ...a, total: a.naEscala + a.atividadesManuais + a.vagasTrocadas + a.posicoesTiradas } };
    }),
  };
}

export type ResultadoDescarte = { descartados: { date: string; livros: number }[]; pulados: { date: string; motivo: string }[]; eventoId: string | null };

/**
 * Descarte LÓGICO: a Escala em rascunho vira ARQUIVADA e os Livros em rascunho, CANCELADOS — nada é
 * apagado e dá para desfazer. Nunca toca em dia publicado. Dia com ajuste à mão só entra se a
 * gerência confirmar (`incluirComAjustes`). O motivo é obrigatório e vai para o Registro.
 */
export async function descartarMes(actor: ActorMes, locationId: string, year: number, month: number, motivo: string, incluirComAjustes: boolean): Promise<ResultadoDescarte | null> {
  const visao = await descartaveisDoMes(actor.organizationId, locationId, year, month);
  if (!visao) return null;
  const operationId = await operationForLocation(locationId);
  const descartados: ResultadoDescarte["descartados"] = [], pulados: ResultadoDescarte["pulados"] = [];
  const escalaIds: string[] = [], livroIds: string[] = [];
  const agora = new Date();
  await db.transaction(async (tx) => {
    for (const dia of visao.dias) {
      if (dia.ajustes.total > 0 && !incluirComAjustes) { pulados.push({ date: dia.date, motivo: `Tem ${dia.ajustes.total} ajuste(s) feito(s) à mão.` }); continue; }
      const livros = await tx.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(and(eq(dailyBooksTable.scaleId, dia.escalaId), eq(dailyBooksTable.status, "DRAFT")));
      if (livros.length) await tx.update(dailyBooksTable).set({ status: "CANCELLED", cancelledAt: agora, cancelledBy: actor.sub, updatedAt: agora }).where(inArray(dailyBooksTable.id, livros.map((l) => l.id)));
      await tx.update(scalesTable).set({ status: "ARCHIVED", updatedAt: agora }).where(and(eq(scalesTable.id, dia.escalaId), eq(scalesTable.status, "DRAFT")));
      escalaIds.push(dia.escalaId); livroIds.push(...livros.map((l) => l.id));
      descartados.push({ date: dia.date, livros: livros.length });
    }
  });
  let eventoId: string | null = null;
  if (descartados.length && operationId) {
    eventoId = await writeHistoryEvent({
      category: "SCALE", action: "escala.mes_descartado", title: `Rascunhos do mês descartados: ${descartados.length} dia(s) — ${visao.location.name}`,
      narrative: `A Administração descartou os rascunhos de ${descartados.length} dia(s) de ${month}/${year} em ${visao.location.name}. Motivo: ${motivo}. Dá para desfazer.`,
      entityType: "location", entityId: locationId, actorId: actor.sub, operationId, orgId: actor.organizationId,
      metadata: { motivo, incluirComAjustes },
      beforeState: null, afterState: { year, month, escalaIds, livroIds, descartados, pulados },
    });
  }
  return { descartados, pulados, eventoId };
}

/** Desfaz um descarte: devolve as Escalas a rascunho e reabre os Livros — só o que ainda está como foi deixado. */
export async function restaurarDescarte(actor: ActorMes, eventoId: string): Promise<{ restauradas: number; livros: number; conflitos: { date: string; motivo: string }[] } | null> {
  const [evento] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.id, eventoId), eq(historyEventsTable.action, "escala.mes_descartado"), eq(historyEventsTable.orgId, actor.organizationId))).limit(1);
  if (!evento) return null;
  const estado = (evento.afterState ?? {}) as { escalaIds?: string[]; livroIds?: string[]; descartados?: { date: string }[] };
  const escalaIds = estado.escalaIds ?? [], livroIds = estado.livroIds ?? [];
  const conflitos: { date: string; motivo: string }[] = [];
  let restauradas = 0, livrosRestaurados = 0;
  const agora = new Date();
  await db.transaction(async (tx) => {
    const escalas = escalaIds.length ? await tx.select().from(scalesTable).where(and(inArray(scalesTable.id, escalaIds), eq(scalesTable.status, "ARCHIVED"))) : [];
    for (const escala of escalas) {
      // Se o dia foi gerado de novo depois do descarte, não há o que restaurar: já existe uma Escala viva.
      const viva = escala.locationId ? await findEscalaDoDia(escala.locationId, escala.periodStart, tx as unknown as typeof db) : null;
      if (viva) { conflitos.push({ date: escala.periodStart, motivo: "O dia já foi gerado de novo depois do descarte." }); continue; }
      await tx.update(scalesTable).set({ status: "DRAFT", updatedAt: agora }).where(eq(scalesTable.id, escala.id));
      const livros = livroIds.length ? await tx.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(and(inArray(dailyBooksTable.id, livroIds), eq(dailyBooksTable.scaleId, escala.id), eq(dailyBooksTable.status, "CANCELLED"))) : [];
      if (livros.length) await tx.update(dailyBooksTable).set({ status: "DRAFT", cancelledAt: null, cancelledBy: null, updatedAt: agora }).where(inArray(dailyBooksTable.id, livros.map((l) => l.id)));
      restauradas += 1; livrosRestaurados += livros.length;
    }
  });
  if (restauradas && evento.operationId) {
    await writeHistoryEvent({
      category: "SCALE", action: "escala.mes_restaurado", title: `Rascunhos do mês restaurados: ${restauradas} dia(s)`,
      narrative: `A Administração desfez o descarte dos rascunhos do mês (${restauradas} dia(s), ${livrosRestaurados} Livro(s)).`,
      entityType: "location", entityId: evento.entityId, actorId: actor.sub, operationId: evento.operationId, orgId: actor.organizationId,
      beforeState: null, afterState: { eventoId, restauradas, livros: livrosRestaurados, conflitos }, causedByEventId: eventoId,
    });
  }
  return { restauradas, livros: livrosRestaurados, conflitos };
}

export type ResultadoMes = {
  gerados: { date: string; livros: number }[];
  falhas: { date: string; motivo: string }[];
  /** Dias que não entram (fechado, sem Programação, já publicado, passou) com o motivo — só no fim. */
  pulados: { date: string; estado: EstadoDiaMes; motivo: string | null }[];
  restantes: number;
  proximoDia: string | null;
};

/**
 * Gera dias em ordem até estourar o orçamento de tempo (ou acabar). Devolve o que gerou agora e o
 * que falta; a tela chama de novo com o `proximoDia`. A falha de um dia não derruba os outros.
 */
export async function gerarMes(actor: ActorMes, locationId: string, year: number, month: number, opts: { orcamentoMs?: number; agora?: () => number; desde?: string | null } = {}): Promise<ResultadoMes | null> {
  // 15 s por chamada: a tela só mostra o andamento quando a chamada volta, então chamadas curtas mantêm a barra andando
  // (e ficam longe do limite de 60 s da Vercel). Cada chamada relê o mês e as leituras estáticas, por isso não menos que isso.
  const orcamento = opts.orcamentoMs ?? 15_000;
  const agora = opts.agora ?? Date.now;
  const inicio = agora();
  const resumo = await resumoDoMes(actor.organizationId, locationId, year, month);
  if (!resumo) return null;
  // Leituras que não mudam durante esta chamada (o Show, o elenco, as sessões, a Programação) são feitas uma vez só.
  const leituras = new LeiturasDoMes();
  // `desde`: a tela manda o `proximoDia` da chamada anterior, e um dia que falhou não fica para sempre na frente.
  const pendentes = resumo.dias.filter((d) => (d.estado === "a_gerar" || d.estado === "faltam_livros") && (!opts.desde || d.date >= opts.desde));
  const gerados: ResultadoMes["gerados"] = [], falhas: ResultadoMes["falhas"] = [];
  let i = 0;
  for (; i < pendentes.length; i++) {
    // Pelo menos um dia por chamada; depois, só se ainda couber no orçamento.
    if (i > 0 && agora() - inicio >= orcamento) break;
    const dia = pendentes[i]!;
    try {
      const r = await gerarDiaDoLocal(actor, resumo.location, dia.date, { leituras });
      if (r.ok) gerados.push({ date: dia.date, livros: r.livros.length });
      else falhas.push({ date: dia.date, motivo: r.message });
    } catch (err) {
      console.error("erro ao gerar dia do mês", dia.date, err);
      falhas.push({ date: dia.date, motivo: "Erro inesperado ao gerar este dia." });
    }
  }
  const restantes = pendentes.length - i;
  const proximoDia = restantes > 0 ? pendentes[i]!.date : null;
  const pulados = resumo.dias.filter((d) => !["a_gerar", "faltam_livros", "completo"].includes(d.estado)).map((d) => ({ date: d.date, estado: d.estado, motivo: d.motivo }));

  if (gerados.length || falhas.length) {
    const operationId = await lembrarOuLer(leituras, `operacao-do-local:${locationId}`, () => operationForLocation(locationId));
    if (operationId) {
      await writeHistoryEvent({
        category: "SCALE", action: "escala.mes_gerado", title: `Mês em rascunho: ${gerados.length} dia(s) gerado(s) — ${resumo.location.name}`,
        narrative: `A Administração gerou em rascunho ${gerados.length} dia(s) de ${month}/${year} em ${resumo.location.name}${falhas.length ? `; ${falhas.length} falharam` : ""}. Nada foi publicado.`,
        entityType: "location", entityId: locationId, actorId: actor.sub, operationId, orgId: actor.organizationId,
        beforeState: null, afterState: { year, month, gerados, falhas },
        nomeFormalDoAtor: await nomeFormalDoAtor(actor.sub, leituras),
      });
    }
  }
  return { gerados, falhas, pulados, restantes, proximoDia };
}
