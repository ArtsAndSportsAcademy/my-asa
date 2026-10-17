/**
 * Regras que o motor do Livro do Dia respeita além da folga (16/10/2026):
 *  - restrição de horário por pessoa: PROIBIÇÃO. A pessoa só pode trabalhar na janela cadastrada
 *    (ex.: escola). A exceção é a mexida à mão, com motivo escrito;
 *  - limite de shows por pessoa por dia, configurável por local: PROIBIÇÃO, passável à mão com motivo;
 *  - shows colados um no outro: só "evitar" — a pessoa vai para o fim da fila, mas entra se não houver outra.
 *
 * As funções puras ficam aqui no alto; a leitura do banco, mais abaixo.
 */
import { and, asc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { enqueueNotification } from "./undo.js";
import { APP_ROUTES } from "../lib/app-routes.js";
import {
  agendaEventsTable, dailyBookAssignmentsTable, dailyBooksTable, db, escalaRegrasLocalTable, programacaoBlocosTable,
  programacoesTable, restricoesHorarioTable, sessionsTable, showBooksTable, userRolesTable,
} from "@workspace/db";

export type RestricaoDeHorario = {
  userId: string;
  /** 0 = domingo … 6 = sábado. */
  diasSemana: number[];
  /** Janela em que a pessoa PODE trabalhar, "HH:MM" ou "HH:MM:SS". */
  horaInicio: string;
  horaFim: string;
  periodStart: string;
  /** Nulo = sem fim. */
  periodEnd: string | null;
  motivo: string;
};

/** "HH:MM" ou "HH:MM:SS" → minutos desde a meia-noite. Hora ilegível devolve null. */
export function minutosDoDia(hora: string | null | undefined): number | null {
  const partes = (hora ?? "").split(":");
  const h = Number(partes[0]), m = Number(partes[1] ?? 0);
  return partes[0] !== "" && Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * A restrição que impede a pessoa de entrar num show que começa em `startTime` na data, ou null.
 * Impede quando o dia da semana está na lista, a data está no período e a hora de início cai FORA da janela.
 * Show sem horário não é conferido: a regra é ignorada em vez de escalar às cegas ou derrubar a geração.
 */
export function restricaoImpede(restricoes: RestricaoDeHorario[], userId: string, date: string, startTime: string | null): RestricaoDeHorario | null {
  const minutos = minutosDoDia(startTime);
  if (minutos === null) return null;
  const diaDaSemana = new Date(`${date}T00:00:00Z`).getUTCDay();
  for (const restricao of restricoes) {
    if (restricao.userId !== userId || !restricao.diasSemana.includes(diaDaSemana)) continue;
    if (date < restricao.periodStart || (restricao.periodEnd !== null && date > restricao.periodEnd)) continue;
    const inicio = minutosDoDia(restricao.horaInicio), fim = minutosDoDia(restricao.horaFim);
    if (inicio === null || fim === null) continue;
    if (minutos < inicio || minutos > fim) return restricao;
  }
  return null;
}

/** Quanto dura um show sem hora de fim, para medir o intervalo entre dois shows. */
const DURACAO_PADRAO_MINUTOS = 30;

/**
 * Dois shows do mesmo dia estão colados quando se sobrepõem ou o intervalo entre o fim de um e o início
 * do outro é menor que o mínimo do local. Show sem `end` conta como 30 minutos. Hora ilegível não cola.
 */
export function showsColados(a: { start: string; end: string | null }, b: { start: string; end: string | null }, intervaloMinimoMinutos: number): boolean {
  const aInicio = minutosDoDia(a.start), bInicio = minutosDoDia(b.start);
  if (aInicio === null || bInicio === null) return false;
  const aFim = minutosDoDia(a.end) ?? aInicio + DURACAO_PADRAO_MINUTOS, bFim = minutosDoDia(b.end) ?? bInicio + DURACAO_PADRAO_MINUTOS;
  if (aInicio < bFim && bInicio < aFim) return true;
  const intervalo = bInicio >= aFim ? bInicio - aFim : aInicio - bFim;
  return intervalo < intervaloMinimoMinutos;
}

/** 1 se a pessoa tem outro show colado neste, senão 0: entra na fila de escolha logo depois do supervisor. */
export function chaveDeEvitar(userId: string, ctx: { colados: ReadonlySet<string> }): number {
  return ctx.colados.has(userId) ? 1 : 0;
}

// ─── Leitura do banco ─────────────────────────────────────────────────────────

/** Intervalo mínimo entre shows quando o local não definiu o dele. */
export const INTERVALO_COLADO_PADRAO_MINUTOS = 20;

const hhmm = (hora: string | null | undefined) => (hora ?? "").slice(0, 5);

type LivroParaHorario = { id: string; agendaEventId: string; showBookId: string | null; sessionId: string | null; start: string | null; end: string | null };
export type Horario = { start: string; end: string | null };

/**
 * Horário de cada Livro do dia. O evento da agenda só guarda hora no Livro de sessão separada; os demais
 * usam a hora da sessão (quando há `sessionId`) ou, por último, o bloco da Programação do dia para aquele
 * show (o menor início). Sem nenhuma das três, o Livro fica sem horário (null) — nenhuma hora é inventada.
 */
async function horariosDosLivros(livros: LivroParaHorario[], date: string): Promise<Map<string, Horario | null>> {
  const horarios = new Map<string, Horario | null>();
  for (const livro of livros) if (livro.start) horarios.set(livro.id, { start: hhmm(livro.start), end: livro.end ? hhmm(livro.end) : null });
  const semHora = livros.filter((livro) => !livro.start);
  if (!semHora.length) return horarios;

  const sessionIds = [...new Set(semHora.map((l) => l.sessionId).filter((id): id is string => Boolean(id)))];
  const sessoes = sessionIds.length ? await db.select({ id: sessionsTable.id, startTime: sessionsTable.startTime, endTime: sessionsTable.endTime }).from(sessionsTable).where(inArray(sessionsTable.id, sessionIds)) : [];
  const sessaoPorId = new Map(sessoes.map((s) => [s.id, s]));
  const semSessao = semHora.filter((livro) => {
    const sessao = livro.sessionId ? sessaoPorId.get(livro.sessionId) : undefined;
    if (sessao) horarios.set(livro.id, { start: hhmm(sessao.startTime), end: hhmm(sessao.endTime) });
    return !sessao;
  });
  const showIds = [...new Set(semSessao.map((l) => l.showBookId).filter((id): id is string => Boolean(id)))];
  if (showIds.length) {
    const shows = await db.select({ id: showBooksTable.id, locationId: showBooksTable.locationId }).from(showBooksTable).where(inArray(showBooksTable.id, showIds));
    const locationIds = [...new Set(shows.map((s) => s.locationId).filter((id): id is string => Boolean(id)))];
    const programacoes = locationIds.length ? await db.select().from(programacoesTable).where(and(
      inArray(programacoesTable.locationId, locationIds), eq(programacoesTable.active, true),
      lte(programacoesTable.vigenciaInicio, date), gte(programacoesTable.vigenciaFim, date),
    )).orderBy(asc(programacoesTable.vigenciaFim), asc(programacoesTable.createdAt)) : [];
    const programacaoDoLocal = new Map<string, string>();
    for (const p of programacoes) if (!programacaoDoLocal.has(p.locationId)) programacaoDoLocal.set(p.locationId, p.id);
    const diaDaSemana = new Date(`${date}T00:00:00Z`).getUTCDay();
    const blocos = programacaoDoLocal.size ? await db.select().from(programacaoBlocosTable).where(and(
      inArray(programacaoBlocosTable.programacaoId, [...programacaoDoLocal.values()]), eq(programacaoBlocosTable.weekday, diaDaSemana),
      eq(programacaoBlocosTable.regra, "livro"), eq(programacaoBlocosTable.active, true), inArray(programacaoBlocosTable.showBookId, showIds),
    )).orderBy(asc(programacaoBlocosTable.inicio)) : [];
    const localDoShow = new Map(shows.map((s) => [s.id, s.locationId]));
    for (const livro of semSessao) {
      const programacaoId = livro.showBookId ? programacaoDoLocal.get(localDoShow.get(livro.showBookId) ?? "") : undefined;
      const bloco = blocos.find((b) => b.programacaoId === programacaoId && b.showBookId === livro.showBookId);
      horarios.set(livro.id, bloco ? { start: hhmm(bloco.inicio), end: bloco.fim ? hhmm(bloco.fim) : null } : null);
    }
  }
  for (const livro of semHora) if (!horarios.has(livro.id)) horarios.set(livro.id, null);
  return horarios;
}

/** Horário de um Livro do Dia (ver `horariosDosLivros`). */
export async function horarioDoLivro(book: { id: string; agendaEventId: string; showBookId: string | null; sessionId: string | null }, date: string): Promise<Horario | null> {
  const [evento] = await db.select({ start: agendaEventsTable.startTime, end: agendaEventsTable.endTime }).from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
  const horarios = await horariosDosLivros([{ ...book, start: evento?.start ?? null, end: evento?.end ?? null }], date);
  return horarios.get(book.id) ?? null;
}

export type RegraDeEscala = "RESTRICAO_HORARIO" | "LIMITE_DO_DIA";

export type RegrasDoDia = {
  /** userId → por que a pessoa não pode entrar neste show ("está com restrição de horário (…)", "já está em 3 shows hoje (…)"). */
  bloqueios: Map<string, string>;
  /** O mesmo, por regra: a exceção à mão precisa saber QUAL regra está sendo passada. */
  motivos: Map<string, { regra: RegraDeEscala; frase: string }[]>;
  /** Quem tem outro show do dia colado neste: vai para o fim da fila, mas pode entrar. */
  colados: Set<string>;
  /** Havia restrição de horário a conferir, mas o show não tem horário: a regra não foi aplicada. */
  semHorario: boolean;
};

/**
 * O que o motor precisa saber de restrição, limite do dia e shows colados para escolher quem faz um show.
 * `eventId` é o evento do Livro que está sendo gerado, lido ou regenerado: o próprio Livro nunca conta contra a pessoa.
 */
export async function carregarRegrasDoDia(input: { eventId: string; userIds: string[]; date: string; operationId: string }): Promise<RegrasDoDia> {
  const { eventId, userIds, date, operationId } = input;
  const regras: RegrasDoDia = { bloqueios: new Map(), motivos: new Map(), colados: new Set(), semHorario: false };
  const barrar = (userId: string, regra: RegraDeEscala, frase: string) => {
    const antes = regras.bloqueios.get(userId);
    regras.bloqueios.set(userId, antes ? `${antes}; ${frase}` : frase);
    regras.motivos.set(userId, [...(regras.motivos.get(userId) ?? []), { regra, frase }]);
  };
  if (!userIds.length) return regras;
  const [evento] = await db.select({
    id: agendaEventsTable.id, showBookId: agendaEventsTable.showBookId, start: agendaEventsTable.startTime, end: agendaEventsTable.endTime,
    eventLocationId: agendaEventsTable.locationId, showLocationId: showBooksTable.locationId,
  }).from(agendaEventsTable).leftJoin(showBooksTable, eq(showBooksTable.id, agendaEventsTable.showBookId)).where(eq(agendaEventsTable.id, eventId)).limit(1);
  if (!evento) return regras;
  const locationId = evento.showLocationId ?? evento.eventLocationId;

  const livros = await db.select({
    id: dailyBooksTable.id, agendaEventId: dailyBooksTable.agendaEventId, showBookId: dailyBooksTable.showBookId, sessionId: dailyBooksTable.sessionId,
    start: agendaEventsTable.startTime, end: agendaEventsTable.endTime,
  }).from(dailyBooksTable).innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id)).where(and(
    eq(agendaEventsTable.date, date), eq(agendaEventsTable.operationId, operationId), ne(dailyBooksTable.status, "CANCELLED"),
  ));
  const outros = livros.filter((livro) => livro.agendaEventId !== eventId);
  const proprioId = `evento:${eventId}`;
  const horarios = await horariosDosLivros([...outros, { id: proprioId, agendaEventId: eventId, showBookId: evento.showBookId, sessionId: null, start: evento.start, end: evento.end }], date);
  const proprio = horarios.get(proprioId) ?? null;

  const linhas = await db.select().from(restricoesHorarioTable).where(and(
    inArray(restricoesHorarioTable.userId, userIds), eq(restricoesHorarioTable.status, "ACTIVE"),
    lte(restricoesHorarioTable.periodStart, date), or(isNull(restricoesHorarioTable.periodEnd), gte(restricoesHorarioTable.periodEnd, date)),
  ));
  const restricoes: RestricaoDeHorario[] = linhas.map((r) => ({
    userId: r.userId, diasSemana: r.diasSemana, horaInicio: r.horaInicio, horaFim: r.horaFim, periodStart: r.periodStart, periodEnd: r.periodEnd, motivo: r.motivo,
  }));
  const diaDaSemana = new Date(`${date}T00:00:00Z`).getUTCDay();
  for (const userId of new Set(restricoes.map((r) => r.userId))) {
    if (!proprio) {
      if (restricoes.some((r) => r.userId === userId && r.diasSemana.includes(diaDaSemana))) regras.semHorario = true;
      continue;
    }
    const impede = restricaoImpede(restricoes, userId, date, proprio.start);
    if (impede) barrar(userId, "RESTRICAO_HORARIO", `está com restrição de horário (só pode das ${hhmm(impede.horaInicio)} às ${hhmm(impede.horaFim)}: ${impede.motivo})`);
  }

  const [regrasDoLocal] = locationId ? await db.select().from(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, locationId)).limit(1) : [];
  const limite = regrasDoLocal?.limiteShowsDia ?? null;
  const intervalo = regrasDoLocal?.intervaloMinimoMinutos ?? INTERVALO_COLADO_PADRAO_MINUTOS;
  const atribuicoes = outros.length ? await db.select({ livro: dailyBookAssignmentsTable.dailyBookId, userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable).where(and(
    inArray(dailyBookAssignmentsTable.dailyBookId, outros.map((l) => l.id)), inArray(dailyBookAssignmentsTable.userId, userIds),
    isNull(dailyBookAssignmentsTable.supersededAt), inArray(dailyBookAssignmentsTable.status, ["ASSIGNED", "AT_RISK"]),
  )) : [];
  const showsDaPessoa = new Map<string, Set<string>>();
  for (const a of atribuicoes) {
    if (!a.userId) continue;
    const conjunto = showsDaPessoa.get(a.userId) ?? new Set<string>();
    conjunto.add(a.livro);
    showsDaPessoa.set(a.userId, conjunto);
  }
  for (const [userId, shows] of showsDaPessoa) {
    if (limite !== null && shows.size >= limite) barrar(userId, "LIMITE_DO_DIA", `já está em ${shows.size} shows hoje (limite do local: ${limite})`);
    if (proprio) {
      for (const livroId of shows) {
        const outro = horarios.get(livroId);
        if (outro && showsColados(outro, proprio, intervalo)) { regras.colados.add(userId); break; }
      }
    }
  }
  return regras;
}

/**
 * As regras que a pessoa infringiria ao entrar neste show (vazio = nada impede). Serve à exceção à mão: quem escala
 * mesmo assim precisa escrever o motivo, e o Registro e o aviso à Administração dizem qual regra foi passada.
 */
export async function verificarRegrasDeEscala(input: { eventId: string; userId: string; date: string; operationId: string }): Promise<{ regra: RegraDeEscala; frase: string }[]> {
  const regras = await carregarRegrasDoDia({ eventId: input.eventId, userIds: [input.userId], date: input.date, operationId: input.operationId });
  return regras.motivos.get(input.userId) ?? [];
}

/** Frase única das regras passadas, para o Registro e o aviso. */
export const frasesDasRegras = (regras: { frase: string }[]) => regras.map((r) => r.frase).join("; ");

/** Código de erro (HTTP 409) da primeira regra que pede motivo. */
export const codigoDaExcecao = (regras: { regra: RegraDeEscala }[]) =>
  regras[0]?.regra === "RESTRICAO_HORARIO" ? "PESSOA_COM_RESTRICAO_DE_HORARIO" : "ACIMA_DO_LIMITE_DO_DIA";

/**
 * Avisa a Administração da operação (menos quem passou a regra) de que alguém foi escalado além de uma regra.
 * Um aviso por acontecimento: a chave leva a pessoa e o dia, não a regra nem o clique.
 */
export async function avisarExcecaoDeRegra(tx: Parameters<typeof enqueueNotification>[0], input: {
  operationId: string; actorId: string; pessoaId: string; pessoa: string; onde: string; regras: { regra: RegraDeEscala; frase: string }[]; motivo: string;
  entityType: string; entityId: string; dedupe: string;
}) {
  const admins = await tx.select({ userId: userRolesTable.userId }).from(userRolesTable).where(and(
    eq(userRolesTable.operationId, input.operationId), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true),
  ));
  for (const adminId of new Set(admins.map((a) => a.userId))) {
    if (adminId === input.actorId) continue;
    await enqueueNotification(tx, {
      userId: adminId, type: "escala.excecao_de_regra", category: "schedule", priority: "IMPORTANT",
      title: `${input.pessoa} foi escalado(a) além de uma regra`,
      message: `${input.onde}. ${input.pessoa} ${frasesDasRegras(input.regras)}. Motivo: ${input.motivo}.`,
      entityType: input.entityType, entityId: input.entityId, actionUrl: APP_ROUTES.escalas,
    }, new Date(), { deduplicationKey: `excecao:${input.dedupe}:${input.pessoaId}:${adminId}` });
  }
}
