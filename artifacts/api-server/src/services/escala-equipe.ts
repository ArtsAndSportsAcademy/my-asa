/**
 * Equipe por local na Programação (pacote O, passo O2).
 *
 * A equipe de uma Programação diz quem trabalha naquele local, em que dia da semana e, se a pessoa divide o dia entre dois locais, de que hora
 * a que hora. A tela manda o conjunto inteiro (a grade pessoa × dia) e o servidor guarda só a diferença: o que já estava igual não é tocado,
 * o que saiu fica inativo (nunca se apaga) e o que volta reativa a mesma linha.
 *
 * Esta camada só LÊ e GRAVA a equipe. A regra que usa a equipe para montar a Escala do dia (O3) e o Livro do Dia (O4) vem depois.
 */
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { areasTable, db, historyEventsTable, programacaoEquipeTable, scalesTable, usersTable } from "@workspace/db";

type Exec = typeof db;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_NO_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

/** Uma marcação da equipe: a pessoa, o dia da semana (0 = domingo … 6 = sábado) e a janela opcional ("HH:MM"). Janela vazia = o dia inteiro. */
export type LinhaDeEquipe = { userId: string; weekday: number; inicio: string | null; fim: string | null };
export type LinhaGuardada = LinhaDeEquipe & { id: string; active: boolean };

/** Teto de marcações num envio: 32 pessoas × 7 dias × algumas janelas cabe com folga; acima disso é erro da tela. */
export const MAXIMO_DE_LINHAS = 3000;

export const FRASE_EQUIPE_MUDOU = "Outra pessoa alterou a equipe depois que você abriu. Nada foi salvo: a tela foi atualizada, confira a equipe nova e refaça a mudança se ainda for preciso.";
export const FRASE_SEM_VERSAO = "Mande a versão da equipe que você abriu (baseVersao; use null se a equipe estava vazia). Sem ela não dá para saber se outra pessoa salvou antes de você.";

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
export const chaveDaLinha = (l: LinhaDeEquipe) => `${l.userId}|${l.weekday}|${l.inicio ?? ""}|${l.fim ?? ""}`;

/** Lê e confere o que a tela mandou. Dentro do limite, repetições são juntadas. */
export function lerLinhas(bruto: unknown): { ok: true; linhas: LinhaDeEquipe[] } | { ok: false; erro: string } {
  if (!Array.isArray(bruto)) return { ok: false, erro: "Mande a equipe como uma lista de marcações (linhas): pessoa, dia da semana e, se quiser, o horário." };
  if (bruto.length > MAXIMO_DE_LINHAS) return { ok: false, erro: `São marcações demais de uma vez (${bruto.length}). O máximo é ${MAXIMO_DE_LINHAS}.` };
  const vistas = new Map<string, LinhaDeEquipe>();
  for (let i = 0; i < bruto.length; i++) {
    const item = bruto[i] as { userId?: unknown; weekday?: unknown; inicio?: unknown; fim?: unknown } | null;
    const onde = `Marcação ${i + 1}`;
    if (!item || typeof item !== "object") return { ok: false, erro: `${onde}: formato inválido.` };
    if (typeof item.userId !== "string" || !UUID.test(item.userId)) return { ok: false, erro: `${onde}: a pessoa (userId) não é válida.` };
    const weekday = Number(item.weekday);
    if (item.weekday === null || item.weekday === undefined || item.weekday === "" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, erro: `${onde}: o dia da semana vai de 0 (domingo) a 6 (sábado).` };
    const horario = (valor: unknown, nome: string) => {
      if (valor === undefined || valor === null || valor === "") return { ok: true as const, valor: null };
      if (typeof valor !== "string" || !TIME.test(valor)) return { ok: false as const, erro: `${onde}: ${nome} precisa estar no formato HH:MM (por exemplo 13:00).` };
      return { ok: true as const, valor };
    };
    const inicio = horario(item.inicio, "o início"); if (!inicio.ok) return { ok: false, erro: inicio.erro };
    const fim = horario(item.fim, "o fim"); if (!fim.ok) return { ok: false, erro: fim.erro };
    if (inicio.valor && fim.valor && fim.valor <= inicio.valor) return { ok: false, erro: `${onde}: o fim precisa ser depois do início.` };
    const linha: LinhaDeEquipe = { userId: item.userId.toLowerCase(), weekday, inicio: inicio.valor, fim: fim.valor };
    vistas.set(chaveDaLinha(linha), linha);
  }
  return { ok: true, linhas: [...vistas.values()] };
}

/**
 * O que muda entre o que está guardado e o que chegou. Linha igual não é tocada; linha que sumiu fica inativa; linha que volta reativa a
 * mesma (uma pessoa que entra e sai várias vezes não enche a tabela de cópias).
 */
export function diferencaDaEquipe(guardadas: LinhaGuardada[], novas: LinhaDeEquipe[]) {
  const ativas = new Map<string, LinhaGuardada>();
  const inativas = new Map<string, LinhaGuardada>();
  for (const g of guardadas) {
    const linha = { ...g, inicio: hhmm(g.inicio), fim: hhmm(g.fim) };
    (g.active ? ativas : inativas).set(chaveDaLinha(linha), linha);
  }
  const chegaram = new Set(novas.map(chaveDaLinha));
  const inserir: LinhaDeEquipe[] = [];
  const reativar: LinhaGuardada[] = [];
  for (const n of novas) {
    const chave = chaveDaLinha(n);
    if (ativas.has(chave)) continue;
    const velha = inativas.get(chave);
    if (velha) reativar.push(velha); else inserir.push(n);
  }
  const remover = [...ativas.entries()].filter(([chave]) => !chegaram.has(chave)).map(([, linha]) => linha);
  return { inserir, reativar, remover, mudou: inserir.length + reativar.length + remover.length > 0 };
}

/** "segunda até 13:00", "terça a partir de 14:00", "quarta 09:00–13:00", "quinta". */
export function textoDaLinha(l: Pick<LinhaDeEquipe, "weekday" | "inicio" | "fim">) {
  const dia = DIAS[l.weekday]!;
  if (l.inicio && l.fim) return `${dia} ${l.inicio}–${l.fim}`;
  if (l.fim) return `${dia} até ${l.fim}`;
  if (l.inicio) return `${dia} a partir de ${l.inicio}`;
  return dia;
}

/** Agrupa por pessoa para o Registro: "Fulano (segunda, terça até 13:00)". Mostra no máximo `limite` pessoas. */
export function resumoPorPessoa(linhas: LinhaDeEquipe[], nomes: Map<string, string>, limite = 8) {
  const porPessoa = new Map<string, LinhaDeEquipe[]>();
  for (const l of linhas) porPessoa.set(l.userId, [...(porPessoa.get(l.userId) ?? []), l]);
  const partes = [...porPessoa.entries()].map(([userId, ls]) => `${nomes.get(userId) ?? "Pessoa fora do elenco"} (${ls.sort((a, b) => a.weekday - b.weekday).map(textoDaLinha).join(", ")})`);
  return partes.length > limite ? `${partes.slice(0, limite).join("; ")}; e mais ${partes.length - limite} pessoa(s)` : partes.join("; ");
}

/** O elenco que pode estar numa equipe: o mesmo que a Escala do dia usa (pessoa ativa, com área). */
export async function elencoDaOrganizacao(organizationId: string, executor: Exec = db) {
  return executor.select({ id: usersTable.id, nome: usersTable.name, areaId: usersTable.areaId, areaNome: areasTable.name }).from(usersTable)
    .leftJoin(areasTable, eq(areasTable.id, usersTable.areaId))
    .where(and(eq(usersTable.organizationId, organizationId), isNotNull(usersTable.areaId), eq(usersTable.status, "ACTIVE"), eq(usersTable.personStatus, "ACTIVE")))
    .orderBy(asc(usersTable.name));
}

/** A equipe ativa de uma Programação, pronta para a tela. */
export async function equipeDaProgramacao(programacaoId: string, executor: Exec = db) {
  const rows = await executor.select().from(programacaoEquipeTable)
    .where(and(eq(programacaoEquipeTable.programacaoId, programacaoId), eq(programacaoEquipeTable.active, true)))
    .orderBy(asc(programacaoEquipeTable.weekday), asc(programacaoEquipeTable.inicio), asc(programacaoEquipeTable.createdAt));
  return rows.map((r) => ({ id: r.id, userId: r.userId, weekday: r.weekday, inicio: hhmm(r.inicio), fim: hhmm(r.fim) }));
}

/**
 * A "versão" da equipe é o instante da última mexida em qualquer marcação (inclusive as que saíram), em ISO; `null` = nunca teve equipe.
 * Quem salva manda a versão que abriu; se mudou, nada é gravado. Não usa `programacoes.version`: mexer na equipe não pode brigar com quem
 * só está renomeando a temporada.
 */
export async function versaoDaEquipe(programacaoId: string, executor: Exec = db): Promise<string | null> {
  const [r] = await executor.select({ ms: sql<string | null>`floor(extract(epoch from max(${programacaoEquipeTable.updatedAt})) * 1000)::bigint` })
    .from(programacaoEquipeTable).where(eq(programacaoEquipeTable.programacaoId, programacaoId));
  return r?.ms ? new Date(Number(r.ms)).toISOString() : null;
}

/** "Duplicar molde" leva a equipe junto: só quem ainda é do elenco. Devolve quantas marcações foram copiadas. */
export async function copiarEquipe(executor: Exec, origemId: string, destinoId: string, organizationId: string, actorId: string): Promise<number> {
  const rows = await executor.select().from(programacaoEquipeTable).where(and(eq(programacaoEquipeTable.programacaoId, origemId), eq(programacaoEquipeTable.active, true)));
  if (!rows.length) return 0;
  const elenco = new Set((await elencoDaOrganizacao(organizationId, executor)).map((p) => p.id));
  const levar = rows.filter((r) => elenco.has(r.userId));
  if (!levar.length) return 0;
  await executor.insert(programacaoEquipeTable).values(levar.map((r) => ({ programacaoId: destinoId, userId: r.userId, weekday: r.weekday, inicio: r.inicio, fim: r.fim, createdBy: actorId })));
  return levar.length;
}

// ─── Sugestão pelas Escalas já feitas ────────────────────────────────────────

/** Quantas semanas para trás a sugestão olha. */
export const SEMANAS_DA_SUGESTAO = 8;
/** A partir de quantas pessoas convocadas num dia dá para dizer que um bloco é "de todo mundo". Em equipe pequena, tudo seria "de todo mundo". */
const MINIMO_PARA_BLOCO_GERAL = 5;
/** Um bloco chamado para esta parte (ou mais) das pessoas convocadas do dia é "de todo mundo" e não prova que a pessoa trabalha naquele local. */
const PARTE_DO_BLOCO_GERAL = 0.8;

const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/**
 * Quem teve atividade PRÓPRIA do local (não só os blocos de todo mundo) nas Escalas publicadas das últimas semanas, por dia da semana.
 * O que fica guardado de uma escala passada é a convocação por pessoa gravada no Registro na publicação; um bloco chamado para 80% ou mais
 * de quem foi convocado no dia é tratado como "de todo mundo" e não conta. Um dia da semana é sugerido quando a pessoa teve atividade
 * própria em pelo menos metade das Escalas publicadas daquele dia da semana (e em ao menos uma).
 */
export async function sugerirEquipe(programacao: { id: string; locationId: string }, organizationId: string, hoje: string, executor: Exec = db) {
  const ate = somarDias(hoje, -1);
  const de = somarDias(hoje, -7 * SEMANAS_DA_SUGESTAO);
  const escalas = await executor.select({ id: scalesTable.id, data: scalesTable.periodStart }).from(scalesTable).where(and(
    eq(scalesTable.locationId, programacao.locationId), inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
    sql`${scalesTable.periodStart} = ${scalesTable.periodEnd}`, sql`${scalesTable.periodStart} BETWEEN ${de} AND ${ate}`,
  ));
  const elenco = await elencoDaOrganizacao(organizationId, executor);
  const nomes = new Map(elenco.map((p) => [p.id, p.nome]));
  const equipeAtual = await equipeDaProgramacao(programacao.id, executor);
  const jaMarcado = new Set(equipeAtual.map((l) => `${l.userId}|${l.weekday}`));
  const base = { janela: { de, ate }, escalasLidas: 0, semHistorico: true, sugestoes: [] as Array<{ userId: string; nome: string; dias: Array<{ weekday: number; vezes: number; de: number; jaMarcado: boolean }>; frase: string }> };
  if (!escalas.length) return base;

  const eventos = await executor.select({ entityId: historyEventsTable.entityId, afterState: historyEventsTable.afterState }).from(historyEventsTable)
    .where(and(inArray(historyEventsTable.entityId, escalas.map((e) => e.id)), inArray(historyEventsTable.action, ["escala.publicada", "escala.republicada"])))
    .orderBy(desc(historyEventsTable.createdAt));
  const ultima = new Map<string, Record<string, string[]>>();
  for (const ev of eventos) {
    if (ultima.has(ev.entityId)) continue;
    const convocacao = (ev.afterState as { convocacao?: Record<string, string[]> } | null)?.convocacao;
    if (convocacao) ultima.set(ev.entityId, convocacao);
  }

  // Por data (uma Escala por local e dia): quem teve atividade própria naquele dia.
  const proprioPorData = new Map<string, Set<string>>();
  for (const escala of escalas) {
    const convocacao = ultima.get(escala.id);
    if (!convocacao) continue;
    const pessoas = Object.keys(convocacao);
    const contagem = new Map<string, number>();
    for (const assinaturas of Object.values(convocacao)) for (const a of assinaturas) contagem.set(a, (contagem.get(a) ?? 0) + 1);
    const ehGeral = (a: string) => pessoas.length >= MINIMO_PARA_BLOCO_GERAL && (contagem.get(a) ?? 0) / pessoas.length >= PARTE_DO_BLOCO_GERAL;
    const proprios = proprioPorData.get(escala.data) ?? new Set<string>();
    for (const [userId, assinaturas] of Object.entries(convocacao)) if (assinaturas.some((a) => !ehGeral(a))) proprios.add(userId);
    proprioPorData.set(escala.data, proprios);
  }
  const datasPorDia = new Map<number, number>();
  for (const data of proprioPorData.keys()) datasPorDia.set(diaDaSemana(data), (datasPorDia.get(diaDaSemana(data)) ?? 0) + 1);
  const vezesPorPessoa = new Map<string, Map<number, number>>();
  for (const [data, pessoas] of proprioPorData) for (const userId of pessoas) {
    const dias = vezesPorPessoa.get(userId) ?? new Map<number, number>();
    dias.set(diaDaSemana(data), (dias.get(diaDaSemana(data)) ?? 0) + 1);
    vezesPorPessoa.set(userId, dias);
  }

  const sugestoes = [...vezesPorPessoa.entries()].filter(([userId]) => nomes.has(userId)).map(([userId, dias]) => {
    const escolhidos = [...dias.entries()].map(([weekday, vezes]) => ({ weekday, vezes, de: datasPorDia.get(weekday) ?? vezes }))
      .filter((d) => d.vezes >= Math.max(1, Math.ceil(d.de / 2))).sort((a, b) => a.weekday - b.weekday)
      .map((d) => ({ ...d, jaMarcado: jaMarcado.has(`${userId}|${d.weekday}`) }));
    const nome = nomes.get(userId)!;
    return { userId, nome, dias: escolhidos, frase: `${nome} teve atividade neste local em ${escolhidos.map((d) => `${DIAS_NO_PLURAL[d.weekday]} (${d.vezes} de ${d.de})`).join(", ")}.` };
  }).filter((s) => s.dias.length > 0).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { janela: { de, ate }, escalasLidas: ultima.size, semHistorico: ultima.size === 0, sugestoes };
}
