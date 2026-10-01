/**
 * Amostra (`?amostra=1`) da 15 Escalas, montada só de design_handoff_my_asa/dados-de-exemplo.json.
 *
 * Regras de exemplo decididas (07-o-que-falta.md, "15 Escalas — decisões", item 5):
 * TREINO GELO → Patinadores · ENSAIO → Bailarinos · coluna da Produção → "PRODUÇÃO" ·
 * YETI/NANOOK → quem já está nos Livros de personagem. Bloco sem regra clara fica vazio e
 * sinalizado — nada é inventado. Blocos de show leem o Livro do Dia da amostra da tela 14
 * (sessionStorage), então tirar alguém do Livro tira o bloco da Escala também na amostra.
 */
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { ADMINISTRACAO_DA_AMOSTRA, FOLGA_DA_AMOSTRA } from "@/lib/amostra";

export type SampleBloco = {
  key: string; rotulo: string; inicio: string; fim: string | null; origem: "programacao" | "livro" | "manual";
  regra: "todos" | "ninguem" | "area" | "grupo" | "pessoas" | "livro" | null; pessoaIds: string[]; vazio: boolean; sinal: string | null;
  showBookId: string | null; dailyBookId: string | null; dailyBookStatus: string | null; blocoId: string | null; allocationId: string | null;
};
export type SampleEscalaState = {
  status: "DRAFT" | "PUBLISHED" | "REPUBLISHED"; version: number; prontas: Record<string, { por: string; em: string }>;
  publishedAt: string | null; alteradaDesde: string | null;
  ajustes?: Record<string, Record<string, "ADICIONAR" | "REMOVER">>;
  confirmacoes?: Record<string, { version: number; em: string }>;
};

type Show = { nome: string; local: string; tipo: string; sessoes: { inicio: string; fim: string }[]; cenas?: { slots_bl: string[]; slots_br: string[]; personagens: { pessoa_hoje: string }[] }[] };
const shows = exampleData.shows as unknown as Show[];

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoOf(new Date());
export const addDays = (iso: string, days: number) => { const [y, m, d] = iso.split("-").map(Number); return isoOf(new Date(y, m - 1, d + days)); };

export const sampleLocais = exampleData.locais.map((l) => ({ id: l.id, name: l.nome }));
export const sampleAreas = exampleData.areas.map((a) => ({ id: a.id, name: a.nome }));
const areaIdByKey = (key: string) => exampleData.areas.find((a) => a.id === key)?.id ?? key;
export const vocabularioDoLocal = (localId: string) => ((exampleData.blocos_por_local as Record<string, string[]>)[localId] ?? []);

export function samplePessoas(localId: string) {
  return exampleData.pessoas.filter((p) => p.local === localId).map((p) => ({
    // Sofia (Patinadores) é a folga visível da amostra de Snowland: dado de revisão, não uma regra criada
    // para a operação. Ela deixa claro que folga vence qualquer regra de bloco — e aparece para a Deborah.
    id: p.nome_de_exibicao, name: p.nome_de_exibicao, areaId: p.area, areaName: exampleData.areas.find((a) => a.id === p.area)?.nome ?? null, folga: localId === "snowland" && p.nome_de_exibicao === FOLGA_DA_AMOSTRA ? "DAY_OFF" : null as string | null,
  }));
}
export function sampleAreasDoLocal(localId: string) {
  const ids = [...new Set(samplePessoas(localId).map((p) => p.areaId).filter((id): id is string => Boolean(id)))];
  return ids.map((id) => ({
    id, name: exampleData.areas.find((a) => a.id === id)?.nome ?? id,
    supervisores: exampleData.supervisao_por_area_local.filter((s) => s.area === id && (s.local === localId || s.local === null)).map((s) => ({ id: s.supervisor, name: s.supervisor })),
  }));
}
/** Áreas que a pessoa supervisiona neste local (Deborah → Patinadores em Snowland). */
export const sampleAreasSupervisionadas = (pessoa: string, localId: string) =>
  exampleData.supervisao_por_area_local.filter((s) => s.supervisor === pessoa && (s.local === localId || s.local === null)).map((s) => s.area);

/** Elenco do Livro do Dia de um show na amostra: o Livro salvo pela tela 14, se houver; senão o do JSON. */
function elencoDoLivro(showIndex: number): { pessoas: string[]; status: string } {
  const show = shows[showIndex];
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(`myasa-review-dailybook-v2-sample-book-${showIndex}`) ?? "null") as null | { status: string; scenes?: { isRemoved: boolean; blocks: { isRemoved: boolean; positions: { isRemoved: boolean; assignments: { status: string; userName: string | null }[] }[] }[] }[] };
    if (saved) {
      const names = (saved.scenes ?? []).filter((s) => !s.isRemoved).flatMap((s) => s.blocks.filter((b) => !b.isRemoved).flatMap((b) => b.positions.filter((p) => !p.isRemoved).flatMap((p) => p.assignments.filter((a) => a.status !== "REMOVED" && a.userName).map((a) => a.userName!))));
      if (names.length || (saved.scenes ?? []).length) return { pessoas: [...new Set(names)], status: saved.status };
    }
  } catch { /* amostra sem Livro salvo */ }
  const fromScenes = (show?.cenas ?? []).flatMap((c) => [...c.slots_bl, ...c.slots_br, ...c.personagens.map((p) => p.pessoa_hoje)]).filter(Boolean);
  // Show só de personagem: quem a fila de rodízio/titular põe hoje (mesma regra da amostra da 14).
  const fromCharacters = exampleData.personagens.filter((p) => p.shows.includes(show?.nome ?? "")).map((p) => {
    const fila = p.fila as { pessoa: string; vezes?: number }[];
    return (p.modo === "titular" ? fila[0] : [...fila].sort((a, b) => (a.vezes ?? 0) - (b.vezes ?? 0))[0])?.pessoa;
  }).filter((n): n is string => Boolean(n));
  return { pessoas: [...new Set(fromScenes.length ? fromScenes : fromCharacters)], status: showIndex % 4 === 0 ? "PUBLISHED" : "DRAFT" };
}
const showIndex = (nome: string) => shows.findIndex((s) => s.nome === nome);

type MoldeBloco = { rotulo: string; inicio: string; fim: string | null; regra: SampleBloco["regra"]; show?: string; area?: string };
/** Molde de exemplo de Snowland: horários do vocabulário real; regra só onde a escala real a define. */
const MOLDE_SNOWLAND: MoldeBloco[] = [
  { rotulo: "ENSAIO", inicio: "08:40", fim: "09:40", regra: "area", area: "bailarinos" },
  { rotulo: "TREINO GELO", inicio: "09:40", fim: "11:00", regra: "area", area: "patinadores" },
  { rotulo: "BOAS-VINDAS", inicio: "09:50", fim: null, regra: "pessoas" },
  { rotulo: "YETI", inicio: "10:00", fim: "10:20", regra: "livro", show: "Yeti" },
  { rotulo: "ACOMP. YETI", inicio: "10:00", fim: "10:20", regra: "pessoas" },
  { rotulo: "NANOOK", inicio: "11:00", fim: "11:20", regra: "livro", show: "Nanook" },
  { rotulo: "ACOMP. NANOOK", inicio: "11:00", fim: "11:20", regra: "pessoas" },
  // Almoço em turnos por área (dado de exemplo): cada turno cai entre os shows daquela área.
  { rotulo: "ALMOÇO", inicio: "11:20", fim: "12:20", regra: "area", area: "bailarinos" },
  { rotulo: "ALMOÇO", inicio: "12:00", fim: "13:00", regra: "area", area: "producao" },
  { rotulo: "ALMOÇO", inicio: "13:10", fim: "14:00", regra: "area", area: "patinadores" },
  { rotulo: "MUSICAL", inicio: "12:30", fim: "13:10", regra: "livro", show: "Musical do Natal" },
  { rotulo: "SHOW PATINAÇÃO", inicio: "14:00", fim: "14:40", regra: "livro", show: "Show Patinação" },
  { rotulo: "PRODUÇÃO", inicio: "14:30", fim: null, regra: "area", area: "producao" },
  { rotulo: "FLASHMOB", inicio: "15:15", fim: "15:30", regra: "livro", show: "Flashmob" },
  { rotulo: "ENSAIO MUSICAL", inicio: "16:00", fim: "17:00", regra: "pessoas" },
  { rotulo: "YETI", inicio: "16:00", fim: "16:20", regra: "livro", show: "Yeti" },
  { rotulo: "YETI", inicio: "16:40", fim: "17:00", regra: "livro", show: "Yeti" },
];
const MOLDES: Record<string, MoldeBloco[]> = { snowland: MOLDE_SNOWLAND };

export type SampleProgramacao = { id: string; locationId: string; nome: string; vigenciaInicio: string; vigenciaFim: string; blocos: {
  id: string; programacaoId: string; weekday: number; inicio: string; fim: string | null; rotulo: string; regra: NonNullable<SampleBloco["regra"]>; showBookId: string | null; areaIds: string[]; grupoIds: string[]; pessoaIds: string[]; order: number; active: boolean;
}[] };
const progKey = (localId: string) => `myasa-review-programacoes-v1-${localId}`;
/** Programação de exemplo: o molde de Snowland vale todos os dias da semana, em vigência que cobre hoje. */
export function loadSampleProgramacoes(localId: string): SampleProgramacao[] {
  try { const saved = JSON.parse(window.sessionStorage.getItem(progKey(localId)) ?? "null"); if (saved) return saved as SampleProgramacao[]; } catch { /* sem salvo */ }
  const molde = MOLDES[localId];
  if (!molde) return [];
  const id = `sample-prog-${localId}`;
  return [{
    id, locationId: localId, nome: "Natal", vigenciaInicio: addDays(todayISO(), -30), vigenciaFim: addDays(todayISO(), 105),
    blocos: [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => molde.map((b, i) => ({
      id: `${id}-${weekday}-${i}`, programacaoId: id, weekday, inicio: b.inicio, fim: b.fim, rotulo: b.rotulo, regra: b.regra ?? "pessoas",
      showBookId: b.show ? `sample-show-${showIndex(b.show)}` : null, areaIds: b.area ? [areaIdByKey(b.area)] : [], grupoIds: [], pessoaIds: [], order: i, active: true,
    }))),
  }];
}
export const saveSampleProgramacoes = (localId: string, list: SampleProgramacao[]) => window.sessionStorage.setItem(progKey(localId), JSON.stringify(list));

const escalaKey = (localId: string, date: string) => `myasa-review-escala-v1-${localId}-${date}`;
/** Estado da Escala do dia na amostra. Hoje de Snowland já nasce publicada (os Livros de hoje da 14 dependem disso). */
export function loadSampleEscala(localId: string, date: string): SampleEscalaState | null {
  try { const saved = JSON.parse(window.sessionStorage.getItem(escalaKey(localId, date)) ?? "null"); if (saved) return saved as SampleEscalaState; } catch { /* sem salvo */ }
  if (date === todayISO() && MOLDES[localId]) {
    const em = new Date(`${date}T08:00:00`).toISOString();
    return { status: "PUBLISHED", version: 2, prontas: Object.fromEntries(sampleAreasDoLocal(localId).map((a) => [a.id, { por: a.supervisores[0]?.name ?? ADMINISTRACAO_DA_AMOSTRA, em }])), publishedAt: em, alteradaDesde: null };
  }
  return null;
}
export const saveSampleEscala = (localId: string, date: string, state: SampleEscalaState) => window.sessionStorage.setItem(escalaKey(localId, date), JSON.stringify(state));
/** Ligação 2 na amostra: o Livro do Dia mudou o elenco; Escala publicada fica "alterada". */
export function markSampleEscalaAlterada(localId: string, date: string) {
  const current = loadSampleEscala(localId, date);
  if (current && (current.status === "PUBLISHED" || current.status === "REPUBLISHED") && !current.alteradaDesde) saveSampleEscala(localId, date, { ...current, alteradaDesde: new Date().toISOString() });
}
/** Ligação 1 na amostra: o Livro só publica com a Escala do dia publicada. */
export const sampleEscalaPublicada = (localId: string, date: string) => { const s = loadSampleEscala(localId, date); return s?.status === "PUBLISHED" || s?.status === "REPUBLISHED"; };

/** Monta a Escala do dia da amostra com as mesmas regras do servidor (services/escala-dia.ts). */
export function sampleDia(localId: string, date: string) {
  const location = sampleLocais.find((l) => l.id === localId) ?? { id: localId, name: localId };
  const pessoas = samplePessoas(localId);
  const present = new Set(pessoas.filter((p) => !p.folga).map((p) => p.id));
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const prog = loadSampleProgramacoes(localId).find((p) => p.vigenciaInicio <= date && date <= p.vigenciaFim) ?? null;
  const blocos: SampleBloco[] = [];
  const cobertos = new Set<number>();
  for (const b of (prog?.blocos ?? []).filter((x) => x.weekday === weekday && x.active).sort((a, c) => a.inicio.localeCompare(c.inicio) || a.order - c.order)) {
    let pessoaIds: string[] = [];
    let sinal: string | null = null;
    let dailyBookId: string | null = null, dailyBookStatus: string | null = null;
    if (b.regra === "livro") {
      const idx = Number((b.showBookId ?? "").replace("sample-show-", ""));
      if (shows[idx] && shows[idx].local === localId) {
        const livro = elencoDoLivro(idx);
        cobertos.add(idx);
        pessoaIds = livro.pessoas.filter((n) => present.has(n));
        dailyBookId = `sample-book-${idx}`; dailyBookStatus = livro.status;
        if (!pessoaIds.length) sinal = "Livro do Dia sem ninguém escalado";
      } else sinal = "Livro do Dia deste show ainda não gerado";
    } else if (b.regra === "todos") pessoaIds = [...present];
    else if (b.regra === "area") pessoaIds = pessoas.filter((p) => present.has(p.id) && p.areaId && b.areaIds.includes(p.areaId)).map((p) => p.id);
    else if (b.regra === "pessoas") pessoaIds = b.pessoaIds.filter((id) => present.has(id));
    const vazio = b.regra !== "ninguem" && pessoaIds.length === 0;
    if (vazio && !sinal) sinal = b.regra === "pessoas" && b.pessoaIds.length === 0 ? "Sem regra de quem entra — fica vazio até alguém decidir" : "Ninguém disponível para a regra deste bloco hoje";
    blocos.push({ key: `p:${b.id}`, rotulo: b.rotulo, inicio: b.inicio, fim: b.fim, origem: "programacao", regra: b.regra, pessoaIds, vazio, sinal, showBookId: b.showBookId, dailyBookId, dailyBookStatus, blocoId: b.id, allocationId: null });
  }
  // Show do local sem bloco no molde: o Livro convoca mesmo assim (uma entrada por sessão).
  shows.forEach((show, idx) => {
    if (show.local !== localId || cobertos.has(idx)) return;
    const livro = elencoDoLivro(idx);
    const pessoaIds = livro.pessoas.filter((n) => present.has(n));
    for (const s of show.sessoes) blocos.push({
      key: `l:${idx}:${s.inicio}`, rotulo: show.nome.toLocaleUpperCase("pt-BR"), inicio: s.inicio, fim: s.fim, origem: "livro", regra: "livro", pessoaIds, vazio: !pessoaIds.length,
      sinal: pessoaIds.length ? null : "Livro do Dia sem ninguém escalado", showBookId: `sample-show-${idx}`, dailyBookId: `sample-book-${idx}`, dailyBookStatus: livro.status, blocoId: null, allocationId: null,
    });
  });
  blocos.sort((a, b) => a.inicio.localeCompare(b.inicio) || (a.fim ?? "").localeCompare(b.fim ?? ""));
  const state = loadSampleEscala(localId, date);
  const ajustes = state?.ajustes ?? {};
  for (const bloco of blocos) {
    const ajustesDoBloco = ajustes[bloco.key];
    if (!ajustesDoBloco) continue;
    const resolved = new Set(bloco.pessoaIds);
    for (const [pessoaId, action] of Object.entries(ajustesDoBloco)) {
      if (!present.has(pessoaId)) continue;
      if (action === "ADICIONAR") resolved.add(pessoaId); else resolved.delete(pessoaId);
    }
    bloco.pessoaIds = [...resolved];
    bloco.vazio = bloco.regra !== "ninguem" && bloco.pessoaIds.length === 0;
    bloco.sinal = bloco.vazio ? (bloco.sinal ?? "Ajuste do dia deixou este bloco sem ninguém") : null;
  }
  return {
    date, location,
    escala: state ? { id: `sample-escala-${localId}-${date}`, status: state.status, version: state.version, publishedAt: state.publishedAt, alteradaDesde: state.alteradaDesde } : null,
    programacao: prog ? { id: prog.id, nome: prog.nome, vigenciaInicio: prog.vigenciaInicio, vigenciaFim: prog.vigenciaFim } : null,
    areas: sampleAreasDoLocal(localId).map((a) => ({ ...a, pronta: state?.prontas[a.id] ? { por: state.prontas[a.id].por, em: state.prontas[a.id].em } : null })),
    pessoas, blocos,
  };
}
export const sampleShowsDoLocal = (localId: string) => shows.map((s, i) => ({ id: `sample-show-${i}`, title: s.nome, local: s.local })).filter((s) => s.local === localId);
