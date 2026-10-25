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
  escalaTiposTable,
  folgasTable,
  historyEventsTable,
  locationsTable,
  operationLocationsTable,
  operationsTable,
  programacaoBlocosTable,
  programacoesTable,
  requestsTable,
  scaleAllocationsTable,
  scalesTable,
  showBooksTable,
  teamMembershipsTable,
  userRolesTable,
  usersTable,
  type RegraBloco,
} from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { isNotSessionBlock, listSessionBlocks } from "./session-blocks.js";
import { enqueueNotification } from "./undo.js";
import { operationalDate } from "../lib/operational-date.js";
import { APP_ROUTES } from "../lib/app-routes.js";

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
  /** Tipo do show do Livro (COMPLETE, STRUCTURED, CHARACTERS_ONLY…): a Escala mostra "personagem → pessoa" só nos de personagens. */
  showTipo?: string | null;
  /** Tipo de atividade escolhido na Programação ou na atividade só de hoje (0084); vazio = a tela adivinha pelo nome. */
  tipoId?: string | null;
  blocoId: string | null;
  allocationId: string | null;
  /** Quando a mesma atividade manual vale para várias pessoas, todas as entradas do bloco. */
  allocationIds?: string[];
  /** Bloco "só da pessoa": a mesma atividade com horário mudado para uma pessoa (0080). Guarda de onde veio. */
  horarioDela?: { chaveOriginal: string; inicio: string; fim: string | null };
  /** Bloco de Livro do Dia: cada personagem (vaga) e quem o faz hoje, para o Ajustar trocar por personagem. */
  vagas?: VagaDoLivro[];
};

export type VagaDoLivro = { assignmentId: string; personagem: string; userId: string | null };

/** Tipo de atividade do local, como a Escala o recebe. `chave` diz de qual dos sete tipos prontos ele nasceu; `active: false` = arquivado. */
export type TipoDoLocal = { id: string; nome: string; cor: string; chave: string | null; ordem: number; active: boolean };

export type EscalaDia = {
  date: string;
  location: { id: string; name: string };
  escala: { id: string; status: string; version: number; publishedAt: Date | null; alteradaDesde: Date | null } | null;
  programacao: { id: string; nome: string; vigenciaInicio: string; vigenciaFim: string } | null;
  areas: { id: string; name: string; supervisores: { id: string; name: string }[]; pronta: { por: string | null; em: Date } | null }[];
  pessoas: { id: string; name: string; areaId: string | null; areaName: string | null; folga: string | null; chamadaNaFolga?: { motivo: string | null; decidida: boolean } }[];
  blocos: BlocoDia[];
  /** Os tipos de atividade do local (inclusive os arquivados, que ainda pintam o que já os usa). Vazio = o local ainda não tem lista. */
  tipos?: TipoDoLocal[];
};

/** Os tipos de atividade de um local, na ordem da lista. */
export async function tiposDoLocal(locationId: string, executor: Exec = db): Promise<TipoDoLocal[]> {
  return executor.select({ id: escalaTiposTable.id, nome: escalaTiposTable.nome, cor: escalaTiposTable.cor, chave: escalaTiposTable.chave, ordem: escalaTiposTable.ordem, active: escalaTiposTable.active })
    .from(escalaTiposTable).where(eq(escalaTiposTable.locationId, locationId)).orderBy(asc(escalaTiposTable.ordem), asc(escalaTiposTable.nome));
}

const hhmm = (value: string | null | undefined) => value ? value.slice(0, 5) : null;
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** A Escala do dia de um local (a mais recente que cobre a data, fora arquivadas). */
export async function findEscalaDoDia(locationId: string, date: string, executor: Exec = db, publishedOnly = false) {
  const [scale] = await executor.select().from(scalesTable).where(and(
    eq(scalesTable.locationId, locationId),
    lte(scalesTable.periodStart, date),
    gte(scalesTable.periodEnd, date),
    publishedOnly ? inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]) : ne(scalesTable.status, "ARCHIVED"),
  )).orderBy(desc(scalesTable.createdAt)).limit(1);
  return scale ?? null;
}

/** Operação dona do local — a Escala (tabela `scales`) exige uma para autorização legada. */
export async function operationForLocation(locationId: string, executor: Exec = db) {
  // Local ligado a mais de uma operação: sem ordem, o banco devolvia qualquer uma (até operação parada), e a Escala
  // podia nascer numa operação diferente da do Show ("Show fora do local"). Prefere a operação ativa e a ligação mais antiga.
  const [row] = await executor.select({ operationId: operationLocationsTable.operationId }).from(operationLocationsTable)
    .innerJoin(operationsTable, eq(operationsTable.id, operationLocationsTable.operationId))
    .where(and(eq(operationLocationsTable.locationId, locationId), eq(operationLocationsTable.active, true)))
    .orderBy(sql`case when ${operationsTable.status} = 'ACTIVE' then 0 else 1 end`, asc(operationLocationsTable.createdAt)).limit(1);
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
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const porExtenso = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} de ${MESES_LONGOS[m! - 1]}`; };

/**
 * Avisa no sino quando uma Escala já publicada muda (troca na grade, Livro do Dia, atividade só de
 * hoje). A Administração recebe o chamado para republicar, porque é quem republica; a supervisão da
 * área mexida recebe só o aviso de que a mudança ainda não chegou a quem faz. Um aviso por
 * publicação para cada pessoa: a chave de repetição usa a hora da última publicação, então mudanças
 * seguidas não viram fila de avisos, e depois de republicar volta a avisar.
 */
export async function avisarRepublicacaoPendente(
  executor: Exec,
  scale: { id: string; operationId: string; locationId: string | null; periodStart: string; publishedAt: Date | null; republishedAt: Date | null },
  motivo: string,
  options: { areaIds?: (string | null)[]; now?: Date; soAdministracao?: boolean } = {},
) {
  const now = options.now ?? new Date();
  const admins = await executor.selectDistinct({ id: usersTable.id }).from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(userRolesTable.operationId, scale.operationId), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true), eq(usersTable.status, "ACTIVE")));
  // Supervisão da área mexida naquele local; sem área conhecida, quem responde pelo local.
  const areas = [...new Set((options.areaIds ?? []).filter((id): id is string => Boolean(id)))];
  // `soAdministracao`: quem mexeu foi uma Supervisão em pessoa de outra área; a Supervisão daquela área recebe o aviso de "quem mexeu" (escala-mexidas.ts).
  const supervisores = scale.locationId && !options.soAdministracao
    ? await executor.selectDistinct({ id: usersTable.id }).from(areaLocalSupervisorsTable)
      .innerJoin(usersTable, eq(usersTable.id, areaLocalSupervisorsTable.supervisorId))
      .where(and(eq(areaLocalSupervisorsTable.locationId, scale.locationId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE"),
        ...(areas.length ? [inArray(areaLocalSupervisorsTable.areaId, areas)] : [])))
    : [];
  if (!admins.length && !supervisores.length) return;
  const [local] = scale.locationId
    ? await executor.select({ name: locationsTable.name }).from(locationsTable).where(eq(locationsTable.id, scale.locationId)).limit(1)
    : [];
  const publicacao = (scale.republishedAt ?? scale.publishedAt)?.getTime() ?? 0;
  const hoje = scale.periodStart === operationalDate(now);
  const quando = porExtenso(scale.periodStart);
  const onde = local?.name ?? "Escala do dia";
  const avisar = async (userId: string, paraAdministracao: boolean) => {
    await enqueueNotification(executor as unknown as Parameters<typeof enqueueNotification>[0], {
      userId, type: "scale.needs_republish", category: "schedule",
      priority: paraAdministracao ? (hoje ? "CRITICAL" : "IMPORTANT") : "NORMAL",
      title: `A escala de ${quando} mudou depois de publicada`,
      message: `${onde} · ${motivo}. ${paraAdministracao ? "Quem faz só recebe a mudança quando você republicar." : "Quem faz só recebe quando a Administração republicar."}`,
      entityType: "scale", entityId: scale.id, actionUrl: APP_ROUTES.escalas,
    }, now, { deduplicationKey: `escala-republicar:${scale.id}:${publicacao}:${userId}` });
  };
  const jaAvisados = new Set<string>();
  for (const admin of admins) { jaAvisados.add(admin.id); await avisar(admin.id, true); }
  for (const sup of supervisores) if (!jaAvisados.has(sup.id)) await avisar(sup.id, false);
}

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
  await avisarRepublicacaoPendente(executor, updated ?? scale, `o Livro do Dia mudou o elenco (${motivo})`, { now });
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

/** Vagas vivas de um Livro do Dia, na ordem em que foram criadas: o personagem (nome da posição) e quem o faz hoje. */
async function vagasDoLivro(dailyBookId: string, executor: Exec = db): Promise<VagaDoLivro[]> {
  const rows = await executor.select({ assignmentId: dailyBookAssignmentsTable.id, personagem: dailyBookPositionsTable.name, userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable)
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
    ))
    .orderBy(asc(dailyBookPositionsTable.createdAt), asc(dailyBookAssignmentsTable.createdAt), asc(dailyBookAssignmentsTable.id));
  return rows;
}

export async function montarEscalaDoDia(organizationId: string, locationId: string, date: string, options: { publishedOnly?: boolean } = {}): Promise<EscalaDia | null> {
  const [location] = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId))).limit(1);
  if (!location) return null;

  const [scale, people, supervisors] = await Promise.all([
    findEscalaDoDia(locationId, date, db, options.publishedOnly),
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
  const [areas, prontas, folgas] = await Promise.all([
    areaIds.length ? db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(inArray(areasTable.id, areaIds), eq(areasTable.active, true))).orderBy(asc(areasTable.name)) : Promise.resolve([]),
    scale ? db.select({ areaId: escalaAreasProntasTable.areaId, markedBy: usersTable.name, markedAt: escalaAreasProntasTable.markedAt }).from(escalaAreasProntasTable)
      .leftJoin(usersTable, eq(escalaAreasProntasTable.markedBy, usersTable.id))
      .where(and(eq(escalaAreasProntasTable.scaleId, scale.id), eq(escalaAreasProntasTable.active, true))) : Promise.resolve([] as { areaId: string; markedBy: string | null; markedAt: Date }[]),
    personIds.length ? db.select({ userId: folgasTable.userId, type: folgasTable.type }).from(folgasTable).where(and(
      inArray(folgasTable.userId, personIds), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, date), gte(folgasTable.endDate, date),
    )) : Promise.resolve([]),
  ]);
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  // A folga ativa é a fonte da escala: retirar a marca no mapa não pode deixar
  // um pedido aprovado antigo impedindo a pessoa de trabalhar para sempre.
  const folgaOf = new Map(folgas.map((f) => [f.userId, f.type]));
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
    id: dailyBooksTable.id, status: dailyBooksTable.status, showBookId: dailyBooksTable.showBookId, sessionId: dailyBooksTable.sessionId, showTitle: showBooksTable.title, showType: showBooksTable.type,
    startTime: agendaEventsTable.startTime, endTime: agendaEventsTable.endTime,
  }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .where(and(eq(agendaEventsTable.date, date), eq(showBooksTable.locationId, locationId), ne(dailyBooksTable.status, "CANCELLED")));
  const elenco = new Map<string, string[]>();
  const vagas = new Map<string, VagaDoLivro[]>();
  for (const livro of livros) { elenco.set(livro.id, await elencoDoLivro(livro.id)); vagas.set(livro.id, await vagasDoLivro(livro.id)); }

  const blocos: BlocoDia[] = [];
  const cobertos = new Set<string>();
  const base = { dailyBookId: null, dailyBookStatus: null, showBookId: null, blocoId: null, allocationId: null } as const;
  for (const bloco of blocosMolde) {
    const inicio = hhmm(bloco.inicio)!;
    let pessoaIds: string[] = [];
    let sinal: string | null = null;
    let livro: (typeof livros)[number] | undefined;
    if (bloco.regra === "livro") {
      // Sessão separada (0071): cada sessão tem o seu Livro e o bloco escolhe o da sua hora; o show sem sessão
      // separada naquele dia (ou sem Livro na hora do bloco) cai no Livro do dia, como sempre foi.
      const doShow = livros.filter((l) => l.showBookId === bloco.showBookId);
      const minutos = (hora: string | null | undefined) => { const [h, m] = (hora ?? "").split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null; };
      const separados = doShow.filter((l) => l.sessionId);
      const maisPerto = [...separados].sort((x, y) => Math.abs((minutos(x.startTime) ?? 9999) - (minutos(inicio) ?? 0)) - Math.abs((minutos(y.startTime) ?? 9999) - (minutos(inicio) ?? 0)))[0];
      livro = separados.find((l) => hhmm(l.startTime) === inicio) ?? doShow.find((l) => !l.sessionId) ?? maisPerto;
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
      pessoaIds, vazio, sinal, blocoId: bloco.id, showBookId: bloco.showBookId, tipoId: bloco.tipoId ?? null,
      dailyBookId: livro?.id ?? null, dailyBookStatus: livro?.status ?? null, showTipo: livro?.showType ?? null,
      ...(livro ? { vagas: vagas.get(livro.id) ?? [] } : {}),
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
        ...base, key: `l:${livro.id}:${h.inicio}`, rotulo: `${livro.showTitle ?? "SHOW"}${livro.sessionId ? ` · ${h.inicio}` : ""}`.toLocaleUpperCase("pt-BR"), inicio: h.inicio, fim: h.fim,
        origem: "livro", regra: "livro", pessoaIds, vazio: pessoaIds.length === 0, sinal: pessoaIds.length ? null : "Livro do Dia sem ninguém escalado",
        showBookId: livro.showBookId, dailyBookId: livro.id, dailyBookStatus: livro.status, showTipo: livro.showType, vagas: vagas.get(livro.id) ?? [],
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
    // A mesma atividade criada para várias pessoas é um bloco só na grade: agrupa por
    // rótulo e horário, na ordem em que foi criada.
    const grupos = new Map<string, { label: string; inicio: string; fim: string | null; ids: string[]; pessoaIds: string[]; tipoId: string | null }>();
    for (const m of manuais) {
      if (!m.manualLabel || !m.startTime) continue;
      const inicio = hhmm(m.startTime)!, fim = hhmm(m.endTime);
      const chave = `${m.manualLabel}|${inicio}|${fim ?? ""}`;
      const grupo = grupos.get(chave) ?? { label: m.manualLabel, inicio, fim, ids: [], pessoaIds: [], tipoId: m.tipoId ?? null };
      grupo.ids.push(m.id);
      if (m.userId && present.has(m.userId) && !grupo.pessoaIds.includes(m.userId)) grupo.pessoaIds.push(m.userId);
      grupos.set(chave, grupo);
    }
    for (const g of grupos.values()) {
      blocos.push({
        ...base, key: `m:${g.ids[0]}`, rotulo: g.label, inicio: g.inicio, fim: g.fim, origem: "manual", regra: "pessoas",
        pessoaIds: g.pessoaIds, vazio: g.pessoaIds.length === 0, sinal: g.pessoaIds.length ? null : "Entrada manual sem ninguém",
        allocationId: g.ids[0]!, allocationIds: g.ids, tipoId: g.tipoId,
      });
    }
  }

  // Quem foi chamado mesmo estando de folga: a grade mostra a marca e o motivo, e a decisão
  // sobre a folga perdida (remarcar ou deixar) fica pendente até alguém resolver.
  const chamadasNaFolga = new Map<string, { motivo: string | null; decidida: boolean }>();
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
        // Folga vence, menos quando a pessoa foi chamada de propósito, com motivo escrito.
        if (!present.has(ajuste.userId) && !(ajuste.action === "ADICIONAR" && ajuste.mesmoDeFolga)) continue;
        if (ajuste.mesmoDeFolga && folgaOf.has(ajuste.userId)) chamadasNaFolga.set(ajuste.userId, { motivo: ajuste.motivo, decidida: Boolean(ajuste.folgaDecididaEm) });
        if (ajuste.action === "ADICIONAR") pessoas.add(ajuste.userId);
        else pessoas.delete(ajuste.userId);
      }
      bloco.pessoaIds = [...pessoas];
      bloco.vazio = bloco.regra !== "ninguem" && bloco.pessoaIds.length === 0;
      bloco.sinal = bloco.vazio ? (bloco.sinal ?? "Ajuste do dia deixou este bloco sem ninguém") : null;
    }
  }
  // Horário só da pessoa (0080): a pessoa sai da atividade no horário de todos e entra num bloco só da pessoa, com o mesmo nome e o
  // horário novo. Assim a grade, o choque, o Meu Dia e a convocação enxergam um bloco comum. Sem efeito se ela já não estava na atividade
  // (saiu por outro ajuste, entrou em folga): o horário volta a valer sozinho se ela voltar.
  if (scale) {
    const horarios = await db.select().from(escalaBlocoAjustesTable).where(and(
      eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.active, true), eq(escalaBlocoAjustesTable.action, "HORARIO"),
    ));
    const movidosDe = new Set<string>();
    for (const h of horarios) {
      const chave = h.sourceKey.replace(/^h:/, "");
      const original = blocos.find((b) => b.key === chave);
      if (!original || !h.newStart || !original.pessoaIds.includes(h.userId)) continue;
      original.pessoaIds = original.pessoaIds.filter((id) => id !== h.userId);
      movidosDe.add(original.key);
      blocos.push({
        ...base, key: `h:${original.key}:${h.userId}`, rotulo: original.rotulo, inicio: h.newStart, fim: h.newEnd ?? null, origem: original.origem, regra: "pessoas",
        pessoaIds: [h.userId], vazio: false, sinal: `Horário só desta pessoa: era ${original.inicio}${original.fim ? `–${original.fim}` : ""}`,
        horarioDela: { chaveOriginal: original.key, inicio: original.inicio, fim: original.fim }, tipoId: original.tipoId ?? null,
      });
    }
    for (const bloco of blocos) {
      if (!movidosDe.has(bloco.key) || bloco.pessoaIds.length > 0) continue;
      bloco.vazio = false; bloco.sinal = null;
    }
  }
  blocos.sort((a, b) => a.inicio.localeCompare(b.inicio) || (a.fim ?? "").localeCompare(b.fim ?? ""));

  // "Pronta" só se pede de quem tem a ver com o local neste dia (decisão de 17/10/2026): área com gente
  // escalada em algum bloco, com supervisão neste local, ou que já foi marcada. Área sem nada aqui não
  // trava a publicação nem aparece como "falta".
  const areaDe = new Map(people.map((p) => [p.id, p.areaId]));
  const comGenteEscalada = new Set(blocos.flatMap((b) => b.pessoaIds.map((id) => areaDe.get(id))).filter((id): id is string => Boolean(id)));
  const todasAsAreas: { id: string; name: string }[] = areas;
  const areasDoLocal = todasAsAreas.filter((a) => comGenteEscalada.has(a.id) || supervisors.some((s) => s.areaId === a.id) || prontas.some((p) => p.areaId === a.id));

  return {
    date,
    location,
    escala: scale ? { id: scale.id, status: scale.status, version: scale.version, publishedAt: scale.publishedAt, alteradaDesde: scale.alteradaDesde } : null,
    programacao: programacao ? { id: programacao.id, nome: programacao.nome, vigenciaInicio: programacao.vigenciaInicio, vigenciaFim: programacao.vigenciaFim } : null,
    areas: areasDoLocal.map((a) => {
      const pronta = prontas.find((p) => p.areaId === a.id);
      return { id: a.id, name: a.name, supervisores: supervisors.filter((s) => s.areaId === a.id).map((s) => ({ id: s.id, name: s.name })), pronta: pronta ? { por: pronta.markedBy, em: pronta.markedAt } : null };
    }),
    pessoas: people.map((p) => {
      const chamada = chamadasNaFolga.get(p.id);
      return {
        id: p.id, name: p.name, areaId: p.areaId, areaName: p.areaId ? areaName.get(p.areaId) ?? null : null,
        folga: folgaOf.get(p.id) ?? null,
        ...(chamada ? { chamadaNaFolga: chamada } : {}),
      };
    }),
    blocos,
    tipos: await tiposDoLocal(locationId),
  };
}

/**
 * Horários em que a Programação vigente põe este show no dia (blocos "do Livro"). O Livro do Dia usa isto
 * para dizer quando o show acontece mesmo sem sessões no Livro do Show; as sessões continuam existindo
 * porque a formação da 1ª e da 2ª sessão pode não ser a mesma.
 */
export async function horariosDoShowNaProgramacao(showBookId: string, date: string): Promise<{ inicio: string; fim: string | null; rotulo: string }[]> {
  return (await horariosDosShowsNaProgramacao([showBookId], date)).get(showBookId) ?? [];
}

/**
 * O mesmo para vários shows de uma vez (a lista do Livro do Dia mostra dez cartões): três leituras no total,
 * não três por show. Cada show só aparece no mapa se a Programação lhe dá algum horário no dia.
 */
export async function horariosDosShowsNaProgramacao(showBookIds: string[], date: string): Promise<Map<string, { inicio: string; fim: string | null; rotulo: string }[]>> {
  const out = new Map<string, { inicio: string; fim: string | null; rotulo: string }[]>();
  const ids = [...new Set(showBookIds)];
  if (!ids.length) return out;
  const shows = await db.select({ id: showBooksTable.id, locationId: showBooksTable.locationId }).from(showBooksTable).where(inArray(showBooksTable.id, ids));
  const locais = [...new Set(shows.map((s) => s.locationId).filter((id): id is string => Boolean(id)))];
  if (!locais.length) return out;
  const programacoes = await db.select().from(programacoesTable).where(and(
    inArray(programacoesTable.locationId, locais), eq(programacoesTable.active, true),
    lte(programacoesTable.vigenciaInicio, date), gte(programacoesTable.vigenciaFim, date),
  )).orderBy(asc(sql`${programacoesTable.vigenciaFim} - ${programacoesTable.vigenciaInicio}`), desc(programacoesTable.createdAt));
  // Por local vale a de vigência mais curta (a mais específica), como em `escalaDoDia`.
  const vigentePorLocal = new Map<string, string>();
  for (const p of programacoes) if (p.locationId && !vigentePorLocal.has(p.locationId)) vigentePorLocal.set(p.locationId, p.id);
  if (!vigentePorLocal.size) return out;
  const blocos = await db.select().from(programacaoBlocosTable).where(and(
    inArray(programacaoBlocosTable.programacaoId, [...vigentePorLocal.values()]), eq(programacaoBlocosTable.weekday, weekdayOf(date)), eq(programacaoBlocosTable.active, true),
    eq(programacaoBlocosTable.regra, "livro"), inArray(programacaoBlocosTable.showBookId, ids),
  )).orderBy(asc(programacaoBlocosTable.inicio), asc(programacaoBlocosTable.order));
  const localDoShow = new Map(shows.map((s) => [s.id, s.locationId]));
  for (const b of blocos) {
    const showId = b.showBookId;
    // O bloco só vale se a Programação dele é a vigente do local do show (um show não herda bloco de outro local).
    if (!showId || vigentePorLocal.get(localDoShow.get(showId) ?? "") !== b.programacaoId) continue;
    (out.get(showId) ?? out.set(showId, []).get(showId)!).push({ inicio: hhmm(b.inicio)!, fim: hhmm(b.fim), rotulo: b.rotulo });
  }
  return out;
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

/** Convocação guardada na última publicação/republicação desta Escala (null se nunca publicou). */
export async function convocacaoPublicada(scaleId: string): Promise<Record<string, string[]> | null> {
  const [ultima] = await db.select({ afterState: historyEventsTable.afterState }).from(historyEventsTable)
    .where(and(eq(historyEventsTable.entityId, scaleId), inArray(historyEventsTable.action, ["escala.publicada", "escala.republicada"])))
    .orderBy(desc(historyEventsTable.createdAt)).limit(1);
  return (ultima?.afterState as { convocacao?: Record<string, string[]> } | null | undefined)?.convocacao ?? null;
}

/**
 * Versão publicada preservada: o que mudou depois de publicar (troca, Livro, bloco novo na Programação)
 * só chega ao Elenco quando a Administração republica. Cada pessoa vê os blocos em que foi convocada na
 * última publicação; `mudouDesdeAPublicacao` diz à Administração que há diferença a republicar.
 */
export async function comoPublicada(dia: EscalaDia): Promise<EscalaDia & { mudouDesdeAPublicacao: boolean }> {
  if (!dia.escala || dia.escala.status === "DRAFT") return { ...dia, mudouDesdeAPublicacao: false };
  const antes = await convocacaoPublicada(dia.escala.id);
  if (!antes) return { ...dia, mudouDesdeAPublicacao: false };
  const mudou = pessoasAfetadas(antes, convocacaoPorPessoa(dia)).length > 0;
  const blocos = dia.blocos.map((bloco) => {
    const assinatura = `${bloco.inicio}|${bloco.fim ?? ""}|${bloco.rotulo}`;
    return { ...bloco, pessoaIds: Object.keys(antes).filter((pessoa) => antes[pessoa]!.includes(assinatura)) };
  });
  return { ...dia, blocos, mudouDesdeAPublicacao: mudou };
}
