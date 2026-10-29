/**
 * Chamadas da Escala (0086): o horário em que as pessoas de um show ou de uma atividade precisam estar prontas ("Aquecimento 13:00",
 * "Call do show 13:45"). Uma atividade pode ter várias. Aqui ficam as regras que as rotas e a montagem do dia dividem:
 *   - validar o que a pessoa digitou;
 *   - dizer em que janela do relógio uma chamada cai, dado o início da atividade ("X minutos antes" acompanha o horário);
 *   - montar as chamadas de um dia a partir das atividades que o dia tem.
 * Quem vai numa chamada NÃO se guarda: são as pessoas da atividade a que ela pertence (no show, as do Livro do Dia).
 */
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db, escalaChamadasTable, sessionsTable, MODOS_DE_CHAMADA, type EscalaChamada, type ModoDeChamada } from "@workspace/db";
import { eligibleSessionsDoDia } from "./session-blocks.js";
import type { BlocoDia } from "./escala-dia.js";

type Exec = typeof db;

/** Uma atividade pode ter, no máximo, este tanto de chamadas ativas (mais que isso já é erro de digitação). */
export const MAXIMO_DE_CHAMADAS = 8;

export const FRASE_CHAMADA_SEM_NOME = "Dê um nome à chamada, de 2 a 40 letras (por exemplo: Aquecimento).";
export const FRASE_CHAMADA_HORARIO = "Escolha o horário da chamada: uma hora fixa (HH:MM) ou quantos minutos antes do início (de 1 a 600).";
export const FRASE_CHAMADA_DURACAO = "A duração da chamada vai de 5 a 240 minutos.";
export const FRASE_CHAMADA_MUITAS = `Uma atividade pode ter até ${MAXIMO_DE_CHAMADAS} chamadas. Tire uma antes de acrescentar outra.`;
export const fraseChamadaDepoisDoInicio = (inicio: string) => `A chamada precisa começar antes do início da atividade (${inicio}). Escolha um horário anterior.`;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutos = (hora: string) => { const [h, m] = hora.slice(0, 5).split(":").map(Number); return h! * 60 + (m || 0); };
const horaDe = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
const hhmm = (valor: string | null | undefined) => (valor ? valor.slice(0, 5) : null);

export type DadosDeChamada = {
  nome: string; modo: ModoDeChamada; horaFixa: string | null; minutosAntes: number | null;
  duracaoMin: number; ocupaTempo: boolean; avisar: boolean; ordem: number;
};

/**
 * Lê o corpo de uma chamada. `parcial` (PATCH) aceita só os campos enviados; o resto vem da chamada atual (`atual`).
 * Devolve o que gravar ou a frase do erro, em português, para a tela mostrar como está.
 */
export function lerChamada(corpo: Record<string, unknown> | undefined, parcial: boolean, atual?: EscalaChamada): { ok: true; valor: DadosDeChamada } | { ok: false; erro: string } {
  const c = corpo ?? {};
  const base: DadosDeChamada = atual
    ? { nome: atual.nome, modo: atual.modo, horaFixa: hhmm(atual.horaFixa), minutosAntes: atual.minutosAntes, duracaoMin: atual.duracaoMin, ocupaTempo: atual.ocupaTempo, avisar: atual.avisar, ordem: atual.ordem }
    : { nome: "", modo: "fixo", horaFixa: null, minutosAntes: null, duracaoMin: 15, ocupaTempo: true, avisar: true, ordem: 0 };
  const out = { ...base };
  if (c.nome !== undefined || !parcial) {
    const nome = typeof c.nome === "string" ? c.nome.trim().replace(/\s+/g, " ") : "";
    if (nome.length < 2 || nome.length > 40) return { ok: false, erro: FRASE_CHAMADA_SEM_NOME };
    out.nome = nome;
  }
  if (c.modo !== undefined || !parcial) {
    if (!MODOS_DE_CHAMADA.includes(c.modo as ModoDeChamada)) return { ok: false, erro: FRASE_CHAMADA_HORARIO };
    out.modo = c.modo as ModoDeChamada;
  }
  if (c.horaFixa !== undefined) { if (c.horaFixa !== null && (typeof c.horaFixa !== "string" || !HORA.test(c.horaFixa))) return { ok: false, erro: FRASE_CHAMADA_HORARIO }; out.horaFixa = (c.horaFixa as string | null) ?? null; }
  if (c.minutosAntes !== undefined) { if (c.minutosAntes !== null && (!Number.isInteger(c.minutosAntes) || (c.minutosAntes as number) < 1 || (c.minutosAntes as number) > 600)) return { ok: false, erro: FRASE_CHAMADA_HORARIO }; out.minutosAntes = (c.minutosAntes as number | null) ?? null; }
  // O horário que não é do modo escolhido não fica guardado: um modo, um valor.
  if (out.modo === "fixo") { if (!out.horaFixa) return { ok: false, erro: FRASE_CHAMADA_HORARIO }; out.minutosAntes = null; }
  else { if (!out.minutosAntes) return { ok: false, erro: FRASE_CHAMADA_HORARIO }; out.horaFixa = null; }
  if (c.duracaoMin !== undefined) { if (!Number.isInteger(c.duracaoMin) || (c.duracaoMin as number) < 5 || (c.duracaoMin as number) > 240) return { ok: false, erro: FRASE_CHAMADA_DURACAO }; out.duracaoMin = c.duracaoMin as number; }
  if (c.ocupaTempo !== undefined) { if (typeof c.ocupaTempo !== "boolean") return { ok: false, erro: "Diga se a chamada ocupa tempo: sim ou não." }; out.ocupaTempo = c.ocupaTempo; }
  if (c.avisar !== undefined) { if (typeof c.avisar !== "boolean") return { ok: false, erro: "Diga se a chamada avisa: sim ou não." }; out.avisar = c.avisar; }
  if (c.ordem !== undefined) { if (!Number.isInteger(c.ordem) || (c.ordem as number) < 0 || (c.ordem as number) > 99) return { ok: false, erro: "A ordem da chamada vai de 0 a 99." }; out.ordem = c.ordem as number; }
  return { ok: true, valor: out };
}

/**
 * Em que janela do relógio uma chamada cai, dado o início da atividade. "X minutos antes" acompanha o horário da atividade; a hora fixa não.
 * A chamada termina, no máximo, quando a atividade começa (ela não invade a própria atividade). Chamada que começaria na hora da atividade ou depois
 * dela não se aplica: devolve null.
 */
export function janelaDaChamada(c: Pick<DadosDeChamada, "modo" | "duracaoMin"> & { horaFixa: string | null; minutosAntes: number | null }, inicioDaAtividade: string): { inicio: string; fim: string } | null {
  const comeco = minutos(inicioDaAtividade);
  const dela = c.modo === "fixo" ? (c.horaFixa ? minutos(c.horaFixa) : null) : (c.minutosAntes ? comeco - c.minutosAntes : null);
  if (dela === null || dela < 0 || dela >= comeco) return null;
  return { inicio: horaDe(dela), fim: horaDe(Math.min(dela + c.duracaoMin, comeco)) };
}

/** Uma chamada que o dia tem, com a janela já calculada e as pessoas da atividade a que pertence. */
export type ChamadaDoDia = {
  key: string;
  chamadaId: string;
  nome: string;
  inicio: string;
  fim: string;
  ocupaTempo: boolean;
  avisar: boolean;
  /** De quem a chamada é: da sessão do show, do bloco da Programação, ou da atividade só deste dia. */
  dona: "sessao" | "bloco" | "dia";
  /** A atividade a que a chamada leva (a chave do bloco do dia), para a tela ligar uma coisa à outra. */
  atividade: { key: string; rotulo: string; inicio: string };
  pessoaIds: string[];
};

/** Blocos "derivados" (horário só da pessoa, bloco encurtado) vêm de outro bloco: a chamada é do bloco de origem, não deles. */
const ehDerivado = (b: BlocoDia) => b.key.startsWith("h:") || b.key.startsWith("t:");

/**
 * As chamadas de um dia. Para cada atividade do dia procura as chamadas da dona certa:
 *   - bloco da Programação (`blocoId`)  → chamadas do bloco;
 *   - show do Livro (`showBookId`)      → chamadas das sessões do show que começam na hora da atividade (e valem na data);
 *   - atividade só deste dia (`m:…`)    → chamadas guardadas na Escala daquele dia, com a chave do bloco.
 * A chamada leva as pessoas que a atividade tem (já com folga, ajustes e prioridade aplicados): no show, as do Livro do Dia.
 */
export async function chamadasDoDia(blocos: BlocoDia[], date: string, scaleId: string | null, executor: Exec = db): Promise<ChamadaDoDia[]> {
  const base = blocos.filter((b) => !ehDerivado(b));
  const showIds = [...new Set(base.filter((b) => b.regra === "livro" && b.showBookId).map((b) => b.showBookId!))];
  const sessoesPorShow = new Map<string, Awaited<ReturnType<typeof eligibleSessionsDoDia>>>();
  for (const id of showIds) sessoesPorShow.set(id, await eligibleSessionsDoDia(id, date));
  const sessaoIds = [...sessoesPorShow.values()].flat().map((s) => s.id);
  const blocoIds = [...new Set(base.map((b) => b.blocoId).filter((id): id is string => Boolean(id)))];
  // A mesma atividade só deste dia, criada para várias pessoas, é um bloco só com várias entradas; a chamada pode ter sido guardada com a chave de
  // qualquer uma delas, então vale a chave de todas.
  const chavesDoManual = (b: BlocoDia) => new Set((b.allocationIds?.length ? b.allocationIds : b.allocationId ? [b.allocationId] : []).map((id) => `m:${id}`));
  const chavesManuais = base.filter((b) => b.origem === "manual").flatMap((b) => [...chavesDoManual(b)]);
  const donas = [
    sessaoIds.length ? inArray(escalaChamadasTable.sessionId, sessaoIds) : undefined,
    blocoIds.length ? inArray(escalaChamadasTable.programacaoBlocoId, blocoIds) : undefined,
    scaleId && chavesManuais.length ? and(eq(escalaChamadasTable.scaleId, scaleId), inArray(escalaChamadasTable.blocoKey, chavesManuais)) : undefined,
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (!donas.length) return [];
  const rows = await executor.select().from(escalaChamadasTable).where(and(eq(escalaChamadasTable.active, true), or(...donas))).orderBy(asc(escalaChamadasTable.ordem), asc(escalaChamadasTable.createdAt));

  const saida: ChamadaDoDia[] = [];
  const empurra = (c: EscalaChamada, b: BlocoDia, dona: ChamadaDoDia["dona"]) => {
    const janela = janelaDaChamada({ modo: c.modo, horaFixa: hhmm(c.horaFixa), minutosAntes: c.minutosAntes, duracaoMin: c.duracaoMin }, b.inicio);
    if (!janela) return;
    saida.push({
      key: `c:${c.id}:${b.key}`, chamadaId: c.id, nome: c.nome, inicio: janela.inicio, fim: janela.fim, ocupaTempo: c.ocupaTempo, avisar: c.avisar, dona,
      atividade: { key: b.key, rotulo: b.rotulo, inicio: b.inicio }, pessoaIds: [...b.pessoaIds],
    });
  };
  for (const b of base) {
    // Bloco de show: a chamada é da sessão do show (abaixo), nunca do bloco; assim cadastrar de um lado ou do outro dá no mesmo e nada sai duas vezes.
    if (b.blocoId && !(b.regra === "livro" && b.showBookId)) for (const c of rows.filter((r) => r.programacaoBlocoId === b.blocoId)) empurra(c, b, "bloco");
    if (b.regra === "livro" && b.showBookId) {
      const sessoes = (sessoesPorShow.get(b.showBookId) ?? []).filter((s) => hhmm(s.startTime) === b.inicio);
      for (const s of sessoes) for (const c of rows.filter((r) => r.sessionId === s.id)) empurra(c, b, "sessao");
    }
    if (b.origem === "manual") { const chaves = chavesDoManual(b); for (const c of rows.filter((r) => r.scaleId === scaleId && r.blocoKey && chaves.has(r.blocoKey))) empurra(c, b, "dia"); }
  }
  return saida.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Para o Livro do Dia: as chamadas ativas de cada bloco da Programação, já com a janela ("Aquecimento 13:00–13:15"), por id do bloco.
 * Bloco de show (`showBookId`): as chamadas são as da sessão do show que começa na mesma hora.
 */
export async function chamadasDosBlocos(blocos: { id: string; inicio: string; showBookId?: string | null }[], executor: Exec = db): Promise<Map<string, { nome: string; inicio: string; fim: string; ocupaTempo: boolean }[]>> {
  const out = new Map<string, { nome: string; inicio: string; fim: string; ocupaTempo: boolean }[]>();
  if (!blocos.length) return out;
  const showIds = [...new Set(blocos.map((b) => b.showBookId).filter((id): id is string => Boolean(id)))];
  const sessoes = showIds.length ? await executor.select({ id: sessionsTable.id, showId: sessionsTable.showId, startTime: sessionsTable.startTime }).from(sessionsTable).where(and(inArray(sessionsTable.showId, showIds), eq(sessionsTable.active, true))) : [];
  const donaDoBloco = (b: { id: string; inicio: string; showBookId?: string | null }) => b.showBookId ? sessoes.find((s) => s.showId === b.showBookId && hhmm(s.startTime) === b.inicio)?.id ?? null : b.id;
  const donas = [...new Set(blocos.map(donaDoBloco).filter((id): id is string => Boolean(id)))];
  if (!donas.length) return out;
  const linhas = await executor.select().from(escalaChamadasTable).where(and(
    or(inArray(escalaChamadasTable.programacaoBlocoId, donas), inArray(escalaChamadasTable.sessionId, donas)), eq(escalaChamadasTable.active, true),
  )).orderBy(asc(escalaChamadasTable.ordem), asc(escalaChamadasTable.createdAt));
  for (const b of blocos) {
    const dona = donaDoBloco(b);
    for (const c of linhas.filter((l) => (b.showBookId ? l.sessionId : l.programacaoBlocoId) === dona)) {
      const j = janelaDaChamada({ modo: c.modo, horaFixa: hhmm(c.horaFixa), minutosAntes: c.minutosAntes, duracaoMin: c.duracaoMin }, b.inicio);
      if (!j) continue;
      (out.get(b.id) ?? out.set(b.id, []).get(b.id)!).push({ nome: c.nome, inicio: j.inicio, fim: j.fim, ocupaTempo: c.ocupaTempo });
    }
  }
  return out;
}
