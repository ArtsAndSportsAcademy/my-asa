/**
 * Escala do dia (tela 15): uma por local e dia, com todas as áreas dentro e uma publicação só.
 *
 * A grade é montada na leitura — a Escala guarda a regra, não uma lista congelada:
 * - blocos da Programação vigente (molde do local) para o dia da semana, cada um com sua regra
 *   de quem entra (todos, ninguém, área, grupo, pessoas, ou show → Livro do Dia);
 * - bloco de show lê o elenco do Livro do Dia daquele show naquela data, ao vivo. Por isso tirar
 *   alguém do Livro tira o bloco dessa pessoa da Escala sem cópia a sincronizar;
 * - entradas manuais da própria Escala;
 * - horários pedidos pelo Elenco em Solicitações e aprovados (peruca, gravar vídeo…);
 * - folga vence tudo: quem está de folga não entra em bloco nenhum do dia.
 * Bloco sem ninguém (e cuja regra não é "ninguém") volta vazio e sinalizado — nunca inventado.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import {
  agendaEventsTable,
  areaLocalSupervisorsTable,
  areasTable,
  dailyBookAssignmentsTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookScenesTable,
  dailyBooksTable,
  db,
  escalaAreasProntasTable,
  escalaBlocoAjustesTable,
  folgasTable,
  leaveRequestsTable,
  locationsTable,
  operationLocationsTable,
  programacaoBlocosTable,
  programacoesTable,
  requestsTable,
  scaleAllocationsTable,
  scalesTable,
  showBooksTable,
  teamMembershipsTable,
  usersTable,
  type RegraBloco,
} from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { isNotSessionBlock, listSessionBlocks } from "./session-blocks.js";

type Exec = typeof db;

export type BlocoDia = {
  key: string;
  rotulo: string;
  inicio: string;
  fim: string | null;
  origem: "programacao" | "livro" | "manual" | "solicitacao";
  regra: RegraBloco | null;
  pessoaIds: string[];
  vazio: boolean;
  sinal: string | null;
  showBookId: string | null;
  dailyBookId: string | null;
  dailyBookStatus: string | null;
  blocoId: string | null;
  allocationId: string | null;
};

export type EscalaDia = {
  date: string;
  location: { id: string; name: string };
  escala: { id: string; status: string; version: number; publishedAt: Date | null; alteradaDesde: Date | null } | null;
  programacao: { id: string; nome: string; vigenciaInicio: string; vigenciaFim: string } | null;
  areas: { id: string; name: string; supervisores: { id: string; name: string }[]; pronta: { por: string | null; em: Date } | null }[];
  pessoas: { id: string; name: string; areaId: string | null; areaName: string | null; folga: string | null }[];
  blocos: BlocoDia[];
};

const hhmm = (value: string | null | undefined) => value ? value.slice(0, 5) : null;
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** A Escala do dia de um local (a mais recente que cobre a data, fora arquivadas). */
export async function findEscalaDoDia(locationId: string, date: string, executor: Exec = db) {
  const [scale] = await executor.select().from(scalesTable).where(and(
    eq(scalesTable.locationId, locationId),
    lte(scalesTable.periodStart, date),
    gte(scalesTable.periodEnd, date),
    ne(scalesTable.status, "ARCHIVED"),
  )).orderBy(desc(scalesTable.createdAt)).limit(1);
  return scale ?? null;
}

/** Operação dona do local — a Escala (tabela `scales`) exige uma para autorização legada. */
export async function operationForLocation(locationId: string, executor: Exec = db) {
  const [row] = await executor.select({ operationId: operationLocationsTable.operationId }).from(operationLocationsTable)
    .where(and(eq(operationLocationsTable.locationId, locationId), eq(operationLocationsTable.active, true))).limit(1);
  return row?.operationId ?? null;
}

/** Local e data de um Livro do Dia: local do show (ou, sem local, a operação do evento). */
async function dayOfBook(dailyBookId: string, executor: Exec = db) {
  const [row] = await executor.select({
    date: agendaEventsTable.date, operationId: agendaEventsTable.operationId, locationId: showBooksTable.locationId,
  }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .leftJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .where(eq(dailyBooksTable.id, dailyBookId)).limit(1);
  return row ?? null;
}

/** A Escala do dia que convoca o elenco deste Livro do Dia (pelo local do show e a data). */
export async function escalaDoDiaDoLivro(dailyBookId: string, executor: Exec = db) {
  const day = await dayOfBook(dailyBookId, executor);
  if (!day) return { day: null, scale: null };
  if (day.locationId) return { day, scale: await findEscalaDoDia(day.locationId, day.date, executor) };
  // Show legado sem local: a Escala da operação que cobre a data.
  const [scale] = await executor.select().from(scalesTable).where(and(
    eq(scalesTable.operationId, day.operationId), lte(scalesTable.periodStart, day.date), gte(scalesTable.periodEnd, day.date), ne(scalesTable.status, "ARCHIVED"),
  )).orderBy(desc(scalesTable.createdAt)).limit(1);
  return { day, scale: scale ?? null };
}

export const escalaPublicada = (status: string | null | undefined) => status === "PUBLISHED" || status === "REPUBLISHED";

/**
 * O Livro do Dia mudou o elenco (posição/cena tirada ou restaurada, formação aplicada). Se a
 * Escala do dia já está publicada, ela fica marcada como alterada e pede republicação — na mesma
 * transação da mudança do Livro, com Registro.
 */
export async function marcarEscalaAlteradaPeloLivro(executor: Exec, dailyBookId: string, actorId: string, motivo: string) {
  const { scale } = await escalaDoDiaDoLivro(dailyBookId, executor);
  if (!scale || !escalaPublicada(scale.status)) return null;
  const now = new Date();
  const [updated] = await executor.update(scalesTable)
    .set({ alteradaDesde: scale.alteradaDesde ?? now, updatedAt: now })
    .where(eq(scalesTable.id, scale.id)).returning();
  await writeHistoryEvent({
    category: "SCALE", action: "escala.alterada_pelo_livro", title: "Escala alterada pelo Livro do Dia",
    narrative: `O Livro do Dia mudou o elenco (${motivo}). A Escala publicada pede republicação.`,
    entityType: "scale", entityId: scale.id, actorId, operationId: scale.operationId,
    beforeState: { alteradaDesde: scale.alteradaDesde }, afterState: { alteradaDesde: updated?.alteradaDesde ?? now, dailyBookId, motivo },
  }, executor as unknown as HistoryExecutor);
  return updated ?? null;
}

/** Quem está escalado num Livro do Dia agora: posições vivas, em cenas e blocos vivos. */
async function elencoDoLivro(dailyBookId: string, executor: Exec = db) {
  const rows = await executor.select({ userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .leftJoin(dailyBookBlocksTable, eq(dailyBookPositionsTable.blockId, dailyBookBlocksTable.id))
    .leftJoin(dailyBookScenesTable, eq(dailyBookBlocksTable.sceneId, dailyBookScenesTable.id))
    .where(and(
      eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId),
      ne(dailyBookAssignmentsTable.status, "REMOVED"),
      isNull(dailyBookAssignmentsTable.supersededAt),
      eq(dailyBookPositionsTable.isRemoved, false),
      isNull(dailyBookPositionsTable.supersededAt),
      or(isNull(dailyBookBlocksTable.id), eq(dailyBookBlocksTable.isRemoved, false)),
      or(isNull(dailyBookScenesTable.id), eq(dailyBookScenesTable.isRemoved, false)),
    ));
  return [...new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
}

export async function montarEscalaDoDia(organizationId: string, locationId: string, date: string): Promise<EscalaDia | null> {
  const [location] = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId))).limit(1);
  if (!location) return null;

  const [scale, people, supervisors] = await Promise.all([
    findEscalaDoDia(locationId, date),
    db.select({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId }).from(usersTable).where(and(
      eq(usersTable.organizationId, organizationId), isNotNull(usersTable.areaId),
      eq(usersTable.status, "ACTIVE"), eq(usersTable.personStatus, "ACTIVE"),
    )).orderBy(asc(usersTable.name)),
    db.select({ areaId: areaLocalSupervisorsTable.areaId, id: usersTable.id, name: usersTable.name }).from(areaLocalSupervisorsTable)
      .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
      .where(and(eq(areaLocalSupervisorsTable.locationId, locationId), eq(areaLocalSupervisorsTable.active, true))),
  ]);

  const areaIds = [...new Set([...people.map((p) => p.areaId), ...supervisors.map((s) => s.areaId)].filter((id): id is string => Boolean(id)))];
  const personIds = people.map((p) => p.id);
  const [areas, prontas, folgas, pedidosAprovados] = await Promise.all([
    areaIds.length ? db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(inArray(areasTable.id, areaIds), eq(areasTable.active, true))).orderBy(asc(areasTable.name)) : Promise.resolve([]),
    scale ? db.select({ areaId: escalaAreasProntasTable.areaId, markedBy: usersTable.name, markedAt: escalaAreasProntasTable.markedAt }).from(escalaAreasProntasTable)
      .leftJoin(usersTable, eq(escalaAreasProntasTable.markedBy, usersTable.id))
      .where(and(eq(escalaAreasProntasTable.scaleId, scale.id), eq(escalaAreasProntasTable.active, true))) : Promise.resolve([] as { areaId: string; markedBy: string | null; markedAt: Date }[]),
    personIds.length ? db.select({ userId: folgasTable.userId, type: folgasTable.type }).from(folgasTable).where(and(
      inArray(folgasTable.userId, personIds), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, date), gte(folgasTable.endDate, date),
    )) : Promise.resolve([]),
    personIds.length ? db.select({ userId: leaveRequestsTable.userId }).from(leaveRequestsTable).where(and(
      inArray(leaveRequestsTable.userId, personIds), eq(leaveRequestsTable.status, "APPROVED"),
      lte(leaveRequestsTable.startDate, date), gte(leaveRequestsTable.endDate, date),
    )) : Promise.resolve([]),
  ]);
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  // Pedido aprovado já materializa a Folga legada para compatibilidade, mas também entra
  // diretamente aqui: a regra de geração lê a fonte nova e não depende de um efeito lateral.
  const folgaOf = new Map(folgas.map((f) => [f.userId, f.type]));
  for (const pedido of pedidosAprovados) if (!folgaOf.has(pedido.userId)) folgaOf.set(pedido.userId, "DAY_OFF");
  const present = new Set(people.filter((p) => !folgaOf.has(p.id)).map((p) => p.id));

  // Programação vigente: a de vigência mais curta que cobre a data (a "Especial" vence a "Natal").
  const [programacao] = await db.select().from(programacoesTable).where(and(
    eq(programacoesTable.locationId, locationId), eq(programacoesTable.active, true),
    lte(programacoesTable.vigenciaInicio, date), gte(programacoesTable.vigenciaFim, date),
  )).orderBy(asc(sql`${programacoesTable.vigenciaFim} - ${programacoesTable.vigenciaInicio}`), desc(programacoesTable.createdAt)).limit(1);
  const blocosMolde = programacao ? await db.select().from(programacaoBlocosTable).where(and(
    eq(programacaoBlocosTable.programacaoId, programacao.id), eq(programacaoBlocosTable.weekday, weekdayOf(date)), eq(programacaoBlocosTable.active, true),
  )).orderBy(asc(programacaoBlocosTable.inicio), asc(programacaoBlocosTable.order)) : [];

  const grupoIds = [...new Set(blocosMolde.flatMap((b) => b.grupoIds))];
  const grupos = grupoIds.length ? await db.select({ teamId: teamMembershipsTable.teamId, userId: teamMembershipsTable.userId }).from(teamMembershipsTable)
    .where(and(inArray(teamMembershipsTable.teamId, grupoIds), eq(teamMembershipsTable.active, true))) : [];

  // Livros do Dia dos shows deste local nesta data (cancelado não convoca ninguém).
  const livros = await db.select({
    id: dailyBooksTable.id, status: dailyBooksTable.status, showBookId: dailyBooksTable.showBookId, showTitle: showBooksTable.title,
    startTime: agendaEventsTable.startTime, endTime: agendaEventsTable.endTime,
  }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .where(and(eq(agendaEventsTable.date, date), eq(showBooksTable.locationId, locationId), ne(dailyBooksTable.status, "CANCELLED")));
  const elenco = new Map<string, string[]>();
  for (const livro of livros) elenco.set(livro.id, await elencoDoLivro(livro.id));

  const blocos: BlocoDia[] = [];
  const cobertos = new Set<string>();
  const base = { dailyBookId: null, dailyBookStatus: null, showBookId: null, blocoId: null, allocationId: null } as const;
  for (const bloco of blocosMolde) {
    const inicio = hhmm(bloco.inicio)!;
    let pessoaIds: string[] = [];
    let sinal: string | null = null;
    let livro: (typeof livros)[number] | undefined;
    if (bloco.regra === "livro") {
      livro = livros.find((l) => l.showBookId === bloco.showBookId);
      if (livro) { cobertos.add(livro.id); pessoaIds = (elenco.get(livro.id) ?? []).filter((id) => present.has(id)); }
      else sinal = "Livro do Dia deste show ainda não gerado";
    } else if (bloco.regra === "todos") pessoaIds = [...present];
    else if (bloco.regra === "area") pessoaIds = people.filter((p) => present.has(p.id) && p.areaId && bloco.areaIds.includes(p.areaId)).map((p) => p.id);
    else if (bloco.regra === "grupo") pessoaIds = [...new Set(grupos.filter((g) => bloco.grupoIds.includes(g.teamId)).map((g) => g.userId))].filter((id) => present.has(id));
    else if (bloco.regra === "pessoas") pessoaIds = bloco.pessoaIds.filter((id) => present.has(id));
    const vazio = bloco.regra !== "ninguem" && pessoaIds.length === 0;
    if (vazio && !sinal) sinal = bloco.regra === "pessoas" && bloco.pessoaIds.length === 0 ? "Sem regra de quem entra — fica vazio até alguém decidir" : "Ninguém disponível para a regra deste bloco hoje";
    blocos.push({
      ...base, key: `p:${bloco.id}`, rotulo: bloco.rotulo, inicio, fim: hhmm(bloco.fim), origem: "programacao", regra: bloco.regra,
      pessoaIds, vazio, sinal, blocoId: bloco.id, showBookId: bloco.showBookId,
      dailyBookId: livro?.id ?? null, dailyBookStatus: livro?.status ?? null,
    });
  }

  // Show com Livro do Dia no local e sem bloco no molde: o Livro convoca mesmo assim.
  for (const livro of livros) {
    if (cobertos.has(livro.id)) continue;
    const pessoaIds = (elenco.get(livro.id) ?? []).filter((id) => present.has(id));
    const sessoes = (await listSessionBlocks(livro.id, livro.showBookId, date)).filter((s) => !s.isRemoved);
    const horarios = sessoes.length ? sessoes.map((s) => ({ inicio: hhmm(s.startTime)!, fim: hhmm(s.endTime) })) : [{ inicio: hhmm(livro.startTime) ?? "00:00", fim: hhmm(livro.endTime) }];
    for (const h of horarios) {
      blocos.push({
        ...base, key: `l:${livro.id}:${h.inicio}`, rotulo: (livro.showTitle ?? "SHOW").toLocaleUpperCase("pt-BR"), inicio: h.inicio, fim: h.fim,
        origem: "livro", regra: "livro", pessoaIds, vazio: pessoaIds.length === 0, sinal: pessoaIds.length ? null : "Livro do Dia sem ninguém escalado",
        showBookId: livro.showBookId, dailyBookId: livro.id, dailyBookStatus: livro.status,
      });
    }
  }

  // Solicitação de horário aprovada (peruca, gravar vídeo…): entra como bloco só da pessoa, lido ao
  // vivo — aprovada depois da geração ou com a Escala ainda por criar, aparece igual. Folga vence.
  const horarios = await db.select({ id: requestsTable.id, userId: requestsTable.requesterId, subject: requestsTable.subject, startTime: requestsTable.startTime, endTime: requestsTable.endTime })
    .from(requestsTable).where(and(
      eq(requestsTable.organizationId, organizationId), eq(requestsTable.locationId, locationId),
      eq(requestsTable.type, "ESCALA_SLOT"), eq(requestsTable.status, "APPROVED"), sql`${date}::date = any(${requestsTable.targetDates})`,
    ));
  for (const h of horarios) {
    if (!h.startTime || !present.has(h.userId)) continue;
    blocos.push({
      ...base, key: `s:${h.id}`, rotulo: h.subject ?? "Horário pedido", inicio: hhmm(h.startTime)!, fim: hhmm(h.endTime), origem: "solicitacao", regra: "pessoas",
      pessoaIds: [h.userId], vazio: false, sinal: null,
    });
  }

  if (scale) {
    const manuais = await db.select().from(scaleAllocationsTable).where(and(
      eq(scaleAllocationsTable.scaleId, scale.id), eq(scaleAllocationsTable.active, true), eq(scaleAllocationsTable.manualDate, date),
    ));
    for (const m of manuais) {
      if (!m.manualLabel || !m.startTime) continue;
      const pessoaIds = m.userId && present.has(m.userId) ? [m.userId] : [];
      blocos.push({
        ...base, key: `m:${m.id}`, rotulo: m.manualLabel, inicio: hhmm(m.startTime)!, fim: hhmm(m.endTime), origem: "manual", regra: "pessoas",
        pessoaIds, vazio: pessoaIds.length === 0, sinal: pessoaIds.length ? null : "Entrada manual sem ninguém", allocationId: m.id,
      });
    }
  }

  // Ajustes são exceções da Escala deste dia, nunca alteração do molde da Programação nem do
  // Livro do Dia. A chave do bloco é estável dentro do dia; a pessoa continua sujeita à folga.
  if (scale) {
    const ajustes = await db.select().from(escalaBlocoAjustesTable).where(and(
      eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.active, true),
    ));
    const porBloco = new Map<string, typeof ajustes>();
    for (const ajuste of ajustes) porBloco.set(ajuste.sourceKey, [...(porBloco.get(ajuste.sourceKey) ?? []), ajuste]);
    for (const bloco of blocos) {
      const ajustesDoBloco = porBloco.get(bloco.key) ?? [];
      if (!ajustesDoBloco.length) continue;
      const pessoas = new Set(bloco.pessoaIds);
      for (const ajuste of ajustesDoBloco) {
        if (!present.has(ajuste.userId)) continue;
        if (ajuste.action === "ADICIONAR") pessoas.add(ajuste.userId);
        else pessoas.delete(ajuste.userId);
      }
      bloco.pessoaIds = [...pessoas];
      bloco.vazio = bloco.regra !== "ninguem" && bloco.pessoaIds.length === 0;
      bloco.sinal = bloco.vazio ? (bloco.sinal ?? "Ajuste do dia deixou este bloco sem ninguém") : null;
    }
  }
  blocos.sort((a, b) => a.inicio.localeCompare(b.inicio) || (a.fim ?? "").localeCompare(b.fim ?? ""));

  return {
    date,
    location,
    escala: scale ? { id: scale.id, status: scale.status, version: scale.version, publishedAt: scale.publishedAt, alteradaDesde: scale.alteradaDesde } : null,
    programacao: programacao ? { id: programacao.id, nome: programacao.nome, vigenciaInicio: programacao.vigenciaInicio, vigenciaFim: programacao.vigenciaFim } : null,
    areas: areas.map((a) => {
      const pronta = prontas.find((p) => p.areaId === a.id);
      return { id: a.id, name: a.name, supervisores: supervisors.filter((s) => s.areaId === a.id).map((s) => ({ id: s.id, name: s.name })), pronta: pronta ? { por: pronta.markedBy, em: pronta.markedAt } : null };
    }),
    pessoas: people.map((p) => ({ id: p.id, name: p.name, areaId: p.areaId, areaName: p.areaId ? areaName.get(p.areaId) ?? null : null, folga: folgaOf.get(p.id) ?? null })),
    blocos,
  };
}

/**
 * Retrato de quem está convocado em quê: pessoa → blocos (rótulo, início, fim). Guardado no Registro a
 * cada publicação; a republicação compara com o retrato anterior para avisar só quem mudou.
 */
export function convocacaoPorPessoa(dia: Pick<EscalaDia, "blocos">): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const bloco of dia.blocos) {
    const assinatura = `${bloco.inicio}|${bloco.fim ?? ""}|${bloco.rotulo}`;
    for (const pessoa of bloco.pessoaIds) (out[pessoa] ??= []).push(assinatura);
  }
  for (const pessoa of Object.keys(out)) out[pessoa] = [...new Set(out[pessoa])].sort();
  return out;
}

/** Quem precisa de aviso na republicação: entrou, saiu, ou teve bloco/horário alterado. */
export function pessoasAfetadas(antes: Record<string, string[]> | null, depois: Record<string, string[]>) {
  if (!antes) return Object.keys(depois);
  const todas = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  return [...todas].filter((pessoa) => (antes[pessoa] ?? []).join("\n") !== (depois[pessoa] ?? []).join("\n"));
}