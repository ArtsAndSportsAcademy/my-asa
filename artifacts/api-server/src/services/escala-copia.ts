/**
 * Copiar de outro dia (pacote H1, decidido em 30/10/2026): leva para um dia o que alguém fez à mão em outro dia do MESMO local —
 * atividades só do dia, ajustes por pessoa, horários só de uma pessoa, edições da atividade no dia e chamadas só do dia.
 *
 * O dia não é guardado inteiro: a Escala é montada na leitura (Programação do dia da semana + exceções gravadas por cima). Copiar é, então,
 * copiar essas exceções, passando por cada regra que o ajuste normal já respeita:
 *   - folga vence (quem está de folga no destino não entra);
 *   - equipe por local (quem é da equipe de outro local ou está sem local no destino não entra);
 *   - local fechado no destino: o dia é pulado;
 *   - "nada muda escondido": destino publicado marca "alterada depois de publicada" e avisa a Administração; o Elenco segue vendo a versão publicada.
 * Quem fica de fora volta na resposta com o motivo, para a Supervisão decidir (traz pelo imprevisto do dia, ajusta à mão…).
 *
 * Um pedido = UM dia de destino (a tela chama um por dia): um evento no Registro, uma transação, um aviso. Dá para desfazer enquanto ninguém mexeu
 * nos itens criados (`desfazerCopia`). Nada é apagado: "começar do zero" só desativa o que havia, e o desfazer reativa.
 *
 * Show (Livro do Dia) fica para o H2: ajustes em atividades de show não são copiados aqui.
 */
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import {
  agendaEventsTable, dailyBooksTable, db, dailyBookAssignmentsTable, showBooksTable, escalaBlocoAjustesTable, escalaBlocoEdicoesTable, escalaChamadasTable, folgasTable, historyEventsTable, locationsTable,
  programacaoBlocosTable, scaleAllocationsTable, scalesTable, usersTable,
} from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { avisarRepublicacaoPendente, diaFechadoDoLocal, escalaPublicada, findEscalaDoDia, montarEscalaDoDia, operationForLocation, type EscalaDia } from "./escala-dia.js";
import { areasQueSupervisiona, novaColeta } from "./escala-mexidas.js";
import { lerLivrosDoDia, planejarVagas, type ForaDoLivro, type PlanoDoLivro } from "./escala-copia-livros.js";
import { trocarVagasNoLivro, type VagaTrocada } from "../routes/daily-book.js";
import { VersionConflictError } from "../lib/versioning.js";

type Exec = typeof db;
type Escala = typeof scalesTable.$inferSelect;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SUPERVISOR = ["SUPERVISOR_A", "SUPERVISOR_B"];
export const ACAO_COPIA = "escala.copiada_de_outro_dia";
export const ACAO_COPIA_DESFEITA = "escala.copia_desfeita";
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const FRASE_COPIA_SEM_ACESSO = "Copiar um dia é da Administração e da Supervisão do local.";
export const FRASE_ORIGEM_SEM_ESCALA = "O dia de origem não tem Escala feita. Escolha um dia que já tenha Escala neste local.";
export const FRASE_ESCOLHA_A_VERSAO = "O dia de origem mudou depois de publicado. Escolha qual versão copiar: a que o Elenco viu (publicada) ou a de agora.";

export type ItensDaCopia = { atividades: boolean; ajustes: boolean; horarios: boolean; edicoes: boolean; chamadas: boolean; livros: boolean };
export const TODOS_OS_ITENS: ItensDaCopia = { atividades: true, ajustes: true, horarios: true, edicoes: true, chamadas: true, livros: true };
export type VersaoDaOrigem = "publicada" | "atual";
export type ModoDaCopia = "juntar" | "zero";

export type PedidoDeCopia = {
  locationId: string; origem: string; destino: string; versao?: VersaoDaOrigem; itens?: Partial<ItensDaCopia>; modo?: ModoDaCopia; motivo?: string | null;
};
export type Ator = { sub: string; role: string; organizationId: string };

export type ForaDaCopia = {
  tipo: "folga" | "outro_local" | "sem_local" | "fora_do_elenco" | "sem_atividade" | "show" | "chamada_na_folga" | "pedido" | ForaDoLivro["tipo"];
  pessoaId?: string; pessoa?: string; atividades?: string[]; frase: string;
};
export type ResumoDoDestino = {
  date: string; diaDaSemana: string; estado: "vazio" | "rascunho" | "publicado" | "fechado" | "igual_a_origem";
  fechado?: string; publicado: boolean; jaTemAjustes: number;
  copia: { atividades: number; ajustes: number; horarios: number; edicoes: number; chamadas: number; vagas: number }; jaEstava: number; foraDe: ForaDaCopia[];
};

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const faixa = (a: string, b: string | null) => (b ? `${a}–${b}` : a);

export async function podeCopiar(ator: Ator, locationId: string): Promise<boolean> {
  if (ator.role === "ADMIN") return true;
  return SUPERVISOR.includes(ator.role) && (await areasQueSupervisiona(ator.sub, locationId)).length > 0;
}

/** Foi válido no instante T? Sem T, vale o que está ativo agora. */
function valia(T: Date | null, r: { createdAt: Date; active: boolean }, fimDaVida: Date | null | undefined): boolean {
  if (!T) return r.active;
  return r.createdAt <= T && (r.active || (fimDaVida != null && fimDaVida > T));
}

// ─── Origem ──────────────────────────────────────────────────────────────────────────────────────

type GrupoManual = { label: string; inicio: string; fim: string | null; tipoId: string | null; ids: string[]; userIds: string[] };
type MoldeDaOrigem = { rotulo: string; inicio: string; regra: string };
type Origem = {
  scale: Escala; instante: Date | null; publicada: boolean; mudouDepois: boolean;
  ajustes: (typeof escalaBlocoAjustesTable.$inferSelect)[]; edicoes: (typeof escalaBlocoEdicoesTable.$inferSelect)[];
  chamadas: (typeof escalaChamadasTable.$inferSelect)[]; grupos: GrupoManual[]; molde: Map<string, MoldeDaOrigem>;
};

export async function lerOrigem(organizationId: string, locationId: string, date: string, versao: VersaoDaOrigem | undefined): Promise<Origem | { erro: { status: number; error: string; message: string } }> {
  const scale = await findEscalaDoDia(locationId, date);
  if (!scale) return { erro: { status: 409, error: "ORIGEM_SEM_ESCALA", message: FRASE_ORIGEM_SEM_ESCALA } };
  const publicada = escalaPublicada(scale.status);
  const mudouDepois = publicada && Boolean(scale.alteradaDesde);
  const instante = publicada && (versao ?? "publicada") === "publicada" ? (scale.republishedAt ?? scale.publishedAt ?? null) : null;
  const [ajustesTodos, edicoesTodas, manuaisTodos, chamadasTodas] = await Promise.all([
    db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.scaleId, scale.id)).orderBy(asc(escalaBlocoAjustesTable.createdAt)),
    db.select().from(escalaBlocoEdicoesTable).where(eq(escalaBlocoEdicoesTable.scaleId, scale.id)),
    db.select().from(scaleAllocationsTable).where(and(eq(scaleAllocationsTable.scaleId, scale.id), eq(scaleAllocationsTable.manualDate, date))).orderBy(asc(scaleAllocationsTable.createdAt)),
    db.select().from(escalaChamadasTable).where(eq(escalaChamadasTable.scaleId, scale.id)).orderBy(asc(escalaChamadasTable.ordem), asc(escalaChamadasTable.createdAt)),
  ]);
  const ajustes = ajustesTodos.filter((a) => valia(instante, a, a.endedAt));
  const edicoes = edicoesTodas.filter((e) => valia(instante, e, e.endedAt));
  const chamadas = chamadasTodas.filter((c) => valia(instante, c, c.updatedAt));
  const mapa = new Map<string, GrupoManual>();
  for (const m of manuaisTodos.filter((x) => x.manualLabel && x.startTime && valia(instante, x, x.updatedAt))) {
    const inicio = hhmm(m.startTime)!, fim = hhmm(m.endTime);
    const chave = `${m.manualLabel}|${inicio}|${fim ?? ""}`;
    const g = mapa.get(chave) ?? { label: m.manualLabel!, inicio, fim, tipoId: m.tipoId ?? null, ids: [], userIds: [] };
    g.ids.push(m.id);
    if (m.userId && !g.userIds.includes(m.userId)) g.userIds.push(m.userId);
    mapa.set(chave, g);
  }
  const grupos = [...mapa.values()];
  // Quem entrou ou saiu de uma atividade manual por ajuste já vale na lista de pessoas do grupo.
  for (const a of ajustes) {
    if (!a.sourceKey.startsWith("m:") || a.mesmoDeFolga || a.action === "HORARIO") continue;
    const id = a.sourceKey.slice(2);
    const g = grupos.find((x) => x.ids.includes(id));
    if (!g) continue;
    if (a.action === "ADICIONAR" && !g.userIds.includes(a.userId)) g.userIds.push(a.userId);
    if (a.action === "REMOVER") g.userIds = g.userIds.filter((u) => u !== a.userId);
  }
  const idsDoMolde = new Set<string>();
  for (const k of [...ajustes.map((a) => a.sourceKey.replace(/^h:/, "")), ...edicoes.map((e) => e.sourceKey), ...chamadas.map((c) => c.blocoKey ?? "")]) if (k.startsWith("p:")) idsDoMolde.add(k.slice(2));
  const molde = new Map<string, MoldeDaOrigem>();
  if (idsDoMolde.size) {
    const linhas = await db.select({ id: programacaoBlocosTable.id, rotulo: programacaoBlocosTable.rotulo, inicio: programacaoBlocosTable.inicio, regra: programacaoBlocosTable.regra })
      .from(programacaoBlocosTable).where(inArray(programacaoBlocosTable.id, [...idsDoMolde]));
    for (const l of linhas) molde.set(`p:${l.id}`, { rotulo: l.rotulo, inicio: hhmm(l.inicio)!, regra: l.regra });
  }
  return { scale, instante, publicada, mudouDepois, ajustes, edicoes, chamadas, grupos, molde };
}

// ─── Plano do destino ────────────────────────────────────────────────────────────────────────────

type Plano = {
  resumo: ResumoDoDestino; destDia: EscalaDia | null; scale: Escala | null; operationId: string | null; pularPorFechado: boolean;
  manuais: { grupo: GrupoManual; userIds: string[] }[];
  ajustes: { sourceKey: string; userId: string; action: "ADICIONAR" | "REMOVER" }[];
  horarios: { sourceKey: string; userId: string; newStart: string; newEnd: string | null }[];
  edicoes: { sourceKey: string; newRotulo: string | null; newStart: string | null; newEnd: string | null; newTipoId: string | null }[];
  chamadas: { blocoKey: string | null; grupo: GrupoManual | null; c: typeof escalaChamadasTable.$inferSelect }[];
  livros: PlanoDoLivro[];
};

export async function planejarDestino(ator: Ator, o: Origem, pedido: PedidoDeCopia): Promise<Plano> {
  const itens: ItensDaCopia = { ...TODOS_OS_ITENS, ...pedido.itens };
  const modo: ModoDaCopia = pedido.modo ?? "juntar";
  const date = pedido.destino;
  const resumo: ResumoDoDestino = {
    date, diaDaSemana: DIAS[weekdayOf(date)]!, estado: "vazio", publicado: false, jaTemAjustes: 0,
    copia: { atividades: 0, ajustes: 0, horarios: 0, edicoes: 0, chamadas: 0, vagas: 0 }, jaEstava: 0, foraDe: [],
  };
  const plano: Plano = { resumo, destDia: null, scale: null, operationId: null, pularPorFechado: false, manuais: [], ajustes: [], horarios: [], edicoes: [], chamadas: [], livros: [] };
  if (date === pedido.origem) { resumo.estado = "igual_a_origem"; resumo.fechado = "Este é o próprio dia de origem."; plano.pularPorFechado = true; return plano; }
  const scale = await findEscalaDoDia(pedido.locationId, date);
  plano.scale = scale;
  const fechado = await diaFechadoDoLocal(pedido.locationId, date);
  if (fechado && !scale) { resumo.estado = "fechado"; resumo.fechado = fechado.motivo; plano.pularPorFechado = true; return plano; }
  plano.operationId = scale?.operationId ?? (await operationForLocation(pedido.locationId));
  if (scale) { resumo.estado = escalaPublicada(scale.status) ? "publicado" : "rascunho"; resumo.publicado = escalaPublicada(scale.status); }
  const destDia = await montarEscalaDoDia(ator.organizationId, pedido.locationId, date);
  plano.destDia = destDia;
  if (!destDia) { resumo.estado = "fechado"; resumo.fechado = "Local não encontrado."; plano.pularPorFechado = true; return plano; }

  // O que o destino já tem (para "juntar" não mexer, e para dizer quantos itens já existem).
  const [ajDest, edDest, maDest, chDest] = scale ? await Promise.all([
    db.select().from(escalaBlocoAjustesTable).where(and(eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.active, true))),
    db.select().from(escalaBlocoEdicoesTable).where(and(eq(escalaBlocoEdicoesTable.scaleId, scale.id), eq(escalaBlocoEdicoesTable.active, true))),
    db.select().from(scaleAllocationsTable).where(and(eq(scaleAllocationsTable.scaleId, scale.id), eq(scaleAllocationsTable.active, true), eq(scaleAllocationsTable.manualDate, date))),
    db.select().from(escalaChamadasTable).where(and(eq(escalaChamadasTable.scaleId, scale.id), eq(escalaChamadasTable.active, true))),
  ]) : [[], [], [], []];
  resumo.jaTemAjustes = ajDest.length + edDest.length + maDest.filter((m) => m.manualLabel).length + chDest.length;
  const zero = modo === "zero";
  const jaAjuste = new Set(zero ? [] : ajDest.map((a) => `${a.sourceKey}|${a.userId}`));
  const jaEdicao = new Set(zero ? [] : edDest.map((e) => e.sourceKey));
  const jaManual = new Set(zero ? [] : maDest.filter((m) => m.manualLabel).map((m) => `${m.manualLabel}|${hhmm(m.startTime)}|${hhmm(m.endTime) ?? ""}|${m.userId}`));

  // Nomes (para as frases) e quem é do elenco do destino.
  const idsDaOrigem = new Set<string>([...o.ajustes.map((a) => a.userId), ...o.grupos.flatMap((g) => g.userIds)]);
  const nomes = new Map<string, string>(destDia.pessoas.map((p) => [p.id, p.name]));
  const faltam = [...idsDaOrigem].filter((id) => !nomes.has(id));
  if (faltam.length) for (const u of await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, faltam), eq(usersTable.organizationId, ator.organizationId)))) nomes.set(u.id, u.name);
  const folgaDe = new Map<string, string>();
  const comFolga = destDia.pessoas.filter((p) => p.folga && !p.chamadaNaFolga).map((p) => p.id);
  if (comFolga.length) for (const f of await db.select({ userId: folgasTable.userId, ini: folgasTable.startDate, fim: folgasTable.endDate }).from(folgasTable).where(and(
    inArray(folgasTable.userId, comFolga), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, date), gte(folgasTable.endDate, date)))) {
    folgaDe.set(f.userId, f.ini === f.fim ? ` em ${dm(f.ini)}` : ` de ${dm(f.ini)} a ${dm(f.fim)}`);
  }
  const porPessoa = new Map<string, ForaDaCopia>();
  const fora = (userId: string, tipo: ForaDaCopia["tipo"], frase: (nome: string) => string, atividade: string) => {
    const chave = `${userId}|${tipo}`;
    const nome = nomes.get(userId) ?? "Uma pessoa";
    const atual = porPessoa.get(chave) ?? { tipo, pessoaId: userId, pessoa: nome, atividades: [], frase: frase(nome) };
    if (!atual.atividades!.includes(atividade)) atual.atividades!.push(atividade);
    porPessoa.set(chave, atual);
  };
  const semLocal = new Set(destDia.semLocalHoje ?? []);
  /** null = pode entrar; senão a pessoa fica de fora e a frase diz por quê. */
  const barrar = (userId: string, atividade: string): boolean => {
    const p = destDia.pessoas.find((x) => x.id === userId);
    if (!p) { fora(userId, "fora_do_elenco", (n) => `${n} não está no elenco deste local neste dia.`, atividade); return true; }
    if (p.folga && !p.chamadaNaFolga) { fora(userId, "folga", (n) => `${n} está de folga${folgaDe.get(userId) ?? ""}. Folga vence a escala.`, atividade); return true; }
    if (p.foraDoLocal) {
      const onde = p.noutroLocal?.[0]?.localNome;
      fora(userId, "outro_local", (n) => `${n} é da equipe ${onde ? `de ${onde}` : "de outro local"} neste dia. Se precisar dela aqui, traga pelo imprevisto do dia.`, atividade); return true;
    }
    if (semLocal.has(userId)) { fora(userId, "sem_local", (n) => `${n} está sem local neste dia (a equipe dela não tem este dia da semana). Se precisar dela aqui, traga pelo imprevisto do dia.`, atividade); return true; }
    return false;
  };

  // Quais atividades do destino casam com as da origem: o mesmo bloco da Programação, ou o mesmo nome no mesmo horário.
  const doMolde = destDia.blocos.filter((b) => b.origem === "programacao" && !b.chamada);
  const casar = (chave: string): { key: string | null; show: boolean; rotulo: string } => {
    const m = o.molde.get(chave);
    const rotulo = m?.rotulo ?? chave;
    if (m?.regra === "livro") return { key: null, show: true, rotulo };
    const igual = doMolde.find((b) => b.key === chave);
    const alvo = igual ?? (m ? doMolde.find((b) => norm(b.editadoNoDia?.original.rotulo ?? b.rotulo) === norm(m.rotulo) && (b.editadoNoDia?.original.inicio ?? b.inicio) === m.inicio) : undefined);
    if (!alvo) return { key: null, show: false, rotulo: m ? `${m.rotulo} das ${m.inicio}` : rotulo };
    if (alvo.regra === "livro") return { key: null, show: true, rotulo: alvo.rotulo };
    return { key: alvo.key, show: false, rotulo: alvo.rotulo };
  };
  const semPar = new Set<string>();
  let ajustesEmShow = 0;
  const naoCaiu = (c: ReturnType<typeof casar>) => {
    if (c.show) { ajustesEmShow += 1; return false; }
    if (!c.key) { semPar.add(c.rotulo); return false; }
    return true;
  };

  // Atividades só do dia.
  const criaraManual: Plano["manuais"] = [];
  if (itens.atividades) {
    for (const g of o.grupos) {
      const entram: string[] = [];
      for (const u of g.userIds) {
        if (barrar(u, g.label)) continue;
        if (jaManual.has(`${g.label}|${g.inicio}|${g.fim ?? ""}|${u}`)) { resumo.jaEstava += 1; continue; }
        entram.push(u);
      }
      if (entram.length) criaraManual.push({ grupo: g, userIds: entram });
    }
  }
  plano.manuais = criaraManual;
  resumo.copia.atividades = criaraManual.length;
  const gruposQueNascem = new Set(criaraManual.map((x) => x.grupo));

  // Ajustes por pessoa e horários só de uma pessoa.
  const naBloco = (key: string, userId: string) => destDia.blocos.find((b) => b.key === key)?.pessoaIds.includes(userId) ?? false;
  for (const a of o.ajustes) {
    if (a.action === "HORARIO") {
      if (!itens.horarios) continue;
      const c = casar(a.sourceKey.replace(/^h:/, ""));
      if (!a.sourceKey.replace(/^h:/, "").startsWith("p:")) continue; // horário de pessoa em atividade manual: segue a atividade, que já leva a pessoa
      if (!naoCaiu(c)) continue;
      if (barrar(a.userId, c.rotulo)) continue;
      if (!zero && !naBloco(c.key!, a.userId)) continue; // a pessoa não está nesta atividade neste dia: o horário não teria efeito
      const chave = `h:${c.key}`;
      if (jaAjuste.has(`${chave}|${a.userId}`)) { resumo.jaEstava += 1; continue; }
      if (!a.newStart) continue;
      plano.horarios.push({ sourceKey: chave, userId: a.userId, newStart: a.newStart, newEnd: a.newEnd ?? null });
      continue;
    }
    if (!itens.ajustes) continue;
    if (a.sourceKey.startsWith("m:")) continue; // já entrou na lista de pessoas da atividade manual
    if (!a.sourceKey.startsWith("p:")) {
      if (a.sourceKey.startsWith("l:")) ajustesEmShow += 1;
      continue;
    }
    if (a.mesmoDeFolga) {
      const quem = nomes.get(a.userId) ?? "Uma pessoa";
      resumo.foraDe.push({ tipo: "chamada_na_folga", pessoaId: a.userId, pessoa: quem, frase: `${quem} foi chamada na folga no dia de origem, com motivo escrito. Essa chamada não é copiada: se precisar, chame de novo, com o motivo de agora.` });
      continue;
    }
    const c = casar(a.sourceKey);
    if (!naoCaiu(c)) continue;
    if (a.action === "ADICIONAR") {
      if (barrar(a.userId, c.rotulo)) continue;
      if (!zero && naBloco(c.key!, a.userId)) { resumo.jaEstava += 1; continue; }
    } else if (!zero && !naBloco(c.key!, a.userId)) { resumo.jaEstava += 1; continue; }
    if (jaAjuste.has(`${c.key}|${a.userId}`)) { resumo.jaEstava += 1; continue; }
    if (!plano.ajustes.some((x) => x.sourceKey === c.key && x.userId === a.userId)) plano.ajustes.push({ sourceKey: c.key!, userId: a.userId, action: a.action });
  }

  // Edição da atividade só naquele dia (nome, horário, tipo).
  if (itens.edicoes) {
    for (const e of o.edicoes) {
      const c = casar(e.sourceKey);
      if (!naoCaiu(c)) continue;
      if (jaEdicao.has(c.key!)) { resumo.jaEstava += 1; continue; }
      if (!plano.edicoes.some((x) => x.sourceKey === c.key)) plano.edicoes.push({ sourceKey: c.key!, newRotulo: e.newRotulo, newStart: e.newStart, newEnd: e.newEnd, newTipoId: e.newTipoId });
    }
  }

  // Chamadas só do dia.
  if (itens.chamadas) {
    for (const c of o.chamadas) {
      // A Escala só lê chamada guardada no dia para atividade criada só naquele dia (`m:`); a chamada de atividade da Programação mora na
      // Programação e vem sozinha com o molde, então não há o que copiar dela.
      if (!c.blocoKey?.startsWith("m:")) continue;
      const g = o.grupos.find((x) => x.ids.includes(c.blocoKey!.slice(2)));
      if (g && gruposQueNascem.has(g)) plano.chamadas.push({ blocoKey: null, grupo: g, c });
    }
  }

  resumo.copia.ajustes = plano.ajustes.length;
  resumo.copia.horarios = plano.horarios.length;
  resumo.copia.edicoes = plano.edicoes.length;
  resumo.copia.chamadas = plano.chamadas.length;

  // Vagas dos Livros do Dia (H2): só nos Livros que já existem no destino.
  if (itens.livros && plano.operationId) {
    const [livrosOrigem, livrosDestino] = await Promise.all([lerLivrosDoDia(pedido.locationId, pedido.origem), lerLivrosDoDia(pedido.locationId, date)]);
    const v = await planejarVagas({ organizationId: ator.organizationId, operationId: plano.operationId, locationId: pedido.locationId, origem: pedido.origem, destino: date, modo, destDia, livrosOrigem, livrosDestino });
    plano.livros = v.planos;
    resumo.copia.vagas = v.vagas;
    resumo.jaEstava += v.jaEstava;
    resumo.foraDe.push(...v.foraDe);
  }
  resumo.foraDe.unshift(...[...porPessoa.values()].map((f) => ({ ...f, frase: `${f.frase} Fica de fora de: ${f.atividades!.join(", ")}.` })));
  for (const rotulo of semPar) resumo.foraDe.push({ tipo: "sem_atividade", frase: `A atividade "${rotulo}" não existe neste dia, então o que era dela não foi copiado.` });
  if (ajustesEmShow) resumo.foraDe.push({ tipo: "show", frase: `${ajustesEmShow === 1 ? "Há 1 ajuste" : `Há ${ajustesEmShow} ajustes`} em atividades de show. As vagas dos shows ficam para a cópia dos Livros do Dia e não foram copiadas.` });
  return plano;
}

// ─── Gravação ────────────────────────────────────────────────────────────────────────────────────

export type ResultadoDoDia = { ok: true; resumo: ResumoDoDestino; eventoId: string | null; gravou: boolean } | { ok: false; status: number; error: string; message: string; resumo?: ResumoDoDestino };

export async function copiarParaODia(ator: Ator, pedido: PedidoDeCopia, simular: boolean): Promise<ResultadoDoDia> {
  const modo: ModoDaCopia = pedido.modo ?? "juntar";
  const motivo = typeof pedido.motivo === "string" ? pedido.motivo.trim().slice(0, 300) : "";
  if (modo === "zero" && !simular && motivo.length < 3) return { ok: false, status: 400, error: "MOTIVO_OBRIGATORIO", message: "Para começar o dia do zero, escreva o motivo (pelo menos 3 letras). Nada é apagado: dá para restaurar." };
  const o = await lerOrigem(ator.organizationId, pedido.locationId, pedido.origem, pedido.versao);
  if ("erro" in o) return { ok: false, ...o.erro };
  if (!simular && o.mudouDepois && !pedido.versao) return { ok: false, status: 400, error: "ESCOLHER_VERSAO", message: FRASE_ESCOLHA_A_VERSAO };
  const plano = await planejarDestino(ator, o, pedido);
  const { resumo } = plano;
  const nada = resumo.copia.atividades + resumo.copia.ajustes + resumo.copia.horarios + resumo.copia.edicoes + resumo.copia.chamadas + resumo.copia.vagas === 0;
  if (simular) return { ok: true, resumo, eventoId: null, gravou: false };
  if (plano.pularPorFechado) return { ok: false, status: 409, error: "DIA_NAO_COPIAVEL", message: resumo.fechado ?? "Este dia não recebe cópia.", resumo };
  if (!plano.operationId) return { ok: false, status: 409, error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação.", resumo };
  if (nada && modo !== "zero") return { ok: true, resumo, eventoId: null, gravou: false };
  const operationId = plano.operationId;
  const [local] = await db.select({ name: locationsTable.name }).from(locationsTable).where(eq(locationsTable.id, pedido.locationId)).limit(1);
  const coleta = await novaColeta(ator, pedido.locationId, pedido.destino);
  const idsDePessoas = new Set<string>([...plano.ajustes.map((x) => x.userId), ...plano.horarios.map((x) => x.userId), ...plano.manuais.flatMap((m) => m.userIds), ...plano.livros.flatMap((l) => l.trocas.map((t) => t.para.userId).filter((u): u is string => Boolean(u)))]);
  const pessoas = idsDePessoas.size ? await db.select({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId }).from(usersTable).where(inArray(usersTable.id, [...idsDePessoas])) : [];
  const areasDosBlocos = new Set<string | null>(pessoas.map((p) => p.areaId));
  for (const e of plano.edicoes) for (const id of plano.destDia?.blocos.find((b) => b.key === e.sourceKey)?.pessoaIds ?? []) areasDosBlocos.add(plano.destDia?.pessoas.find((p) => p.id === id)?.areaId ?? null);
  const depoisDoCommit: (() => void)[] = [];
  try {
    const resultado = await db.transaction(async (tx) => {
      let scale = plano.scale;
      if (!scale) {
        const [criada] = await tx.insert(scalesTable).values({
          operationId, locationId: pedido.locationId, title: `Escala do dia · ${local?.name ?? ""} · ${pedido.destino}`, periodStart: pedido.destino, periodEnd: pedido.destino,
          status: "DRAFT", generatedAt: new Date(), generatedBy: ator.sub, createdBy: ator.sub,
        }).returning();
        scale = criada!;
        await writeHistoryEvent({ category: "SCALE", action: "escala.criada", title: "Escala do dia criada", narrative: `Escala de ${local?.name ?? "o local"} para ${pedido.destino} criada ao copiar o dia ${pedido.origem}.`, entityType: "scale", entityId: scale.id, actorId: ator.sub, operationId, orgId: ator.organizationId, afterState: { scale } }, tx as unknown as HistoryExecutor);
      }
      const desativados = { ajustes: [] as string[], edicoes: [] as string[], manuais: [] as string[], chamadas: [] as string[] };
      if (modo === "zero") {
        const agora = new Date();
        const aj = await tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: ator.sub, endedAt: agora }).where(and(eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.active, true))).returning({ id: escalaBlocoAjustesTable.id });
        const ed = await tx.update(escalaBlocoEdicoesTable).set({ active: false, endedBy: ator.sub, endedAt: agora }).where(and(eq(escalaBlocoEdicoesTable.scaleId, scale.id), eq(escalaBlocoEdicoesTable.active, true))).returning({ id: escalaBlocoEdicoesTable.id });
        const ma = await tx.update(scaleAllocationsTable).set({ active: false, updatedAt: agora }).where(and(eq(scaleAllocationsTable.scaleId, scale.id), eq(scaleAllocationsTable.active, true), eq(scaleAllocationsTable.manualDate, pedido.destino), sql`${scaleAllocationsTable.manualLabel} IS NOT NULL`)).returning({ id: scaleAllocationsTable.id });
        const ch = await tx.update(escalaChamadasTable).set({ active: false, updatedAt: agora }).where(and(eq(escalaChamadasTable.scaleId, scale.id), eq(escalaChamadasTable.active, true))).returning({ id: escalaChamadasTable.id });
        desativados.ajustes = aj.map((r) => r.id); desativados.edicoes = ed.map((r) => r.id); desativados.manuais = ma.map((r) => r.id); desativados.chamadas = ch.map((r) => r.id);
      }
      const criados = { ajustes: [] as string[], edicoes: [] as string[], manuais: [] as string[], chamadas: [] as string[] };
      const chaveDoGrupo = new Map<GrupoManual, string>();
      for (const m of plano.manuais) {
        const linhas = await tx.insert(scaleAllocationsTable).values(m.userIds.map((userId) => ({
          scaleId: scale!.id, agendaEventId: null, userId, status: "MANUAL_OVERRIDE" as const, manualDate: pedido.destino, manualLabel: m.grupo.label,
          tipoId: m.grupo.tipoId, startTime: m.grupo.inicio, endTime: m.grupo.fim, overriddenBy: ator.sub, overrideReason: `Copiada do dia ${pedido.origem}`,
        }))).returning({ id: scaleAllocationsTable.id });
        criados.manuais.push(...linhas.map((l) => l.id));
        chaveDoGrupo.set(m.grupo, `m:${linhas[0]!.id}`);
      }
      const linhasAjuste = [
        ...plano.ajustes.map((a) => ({ scaleId: scale!.id, sourceKey: a.sourceKey, userId: a.userId, action: a.action, createdBy: ator.sub, motivo: null as string | null, newStart: null as string | null, newEnd: null as string | null })),
        ...plano.horarios.map((h) => ({ scaleId: scale!.id, sourceKey: h.sourceKey, userId: h.userId, action: "HORARIO" as const, createdBy: ator.sub, motivo: null as string | null, newStart: h.newStart as string | null, newEnd: h.newEnd })),
      ];
      if (linhasAjuste.length) criados.ajustes.push(...(await tx.insert(escalaBlocoAjustesTable).values(linhasAjuste).returning({ id: escalaBlocoAjustesTable.id })).map((r) => r.id));
      if (plano.edicoes.length) criados.edicoes.push(...(await tx.insert(escalaBlocoEdicoesTable).values(plano.edicoes.map((e) => ({ scaleId: scale!.id, ...e, motivo: null as string | null, createdBy: ator.sub }))).returning({ id: escalaBlocoEdicoesTable.id })).map((r) => r.id));
      const novasChamadas = plano.chamadas.flatMap(({ blocoKey, grupo, c }) => {
        const chave = blocoKey ?? (grupo ? chaveDoGrupo.get(grupo) : null);
        return chave ? [{ organizationId: ator.organizationId, scaleId: scale!.id, blocoKey: chave, nome: c.nome, modo: c.modo, horaFixa: c.horaFixa, minutosAntes: c.minutosAntes, duracaoMin: c.duracaoMin, ocupaTempo: c.ocupaTempo, avisar: c.avisar, ordem: c.ordem, createdBy: ator.sub }] : [];
      });
      if (novasChamadas.length) criados.chamadas.push(...(await tx.insert(escalaChamadasTable).values(novasChamadas).returning({ id: escalaChamadasTable.id })).map((r) => r.id));

      // Vagas dos Livros do Dia (H2): cada Livro muda na mesma transação, com a versão que o planejamento leu (se alguém mexeu antes, VersionConflictError).
      const livrosTrocados: { dailyBookId: string; show: string; trocas: VagaTrocada[] }[] = [];
      for (const pl of plano.livros) {
        const r = await trocarVagasNoLivro({ dailyBookId: pl.livro.id, actorId: ator.sub, trocas: pl.trocas, origem: `cópia do dia ${pedido.origem}` }, { tx: tx as unknown as typeof db, depoisDoCommit });
        if (r) livrosTrocados.push({ dailyBookId: pl.livro.id, show: pl.livro.titulo, trocas: r });
      }

      const mex = await coleta.registrar(scale.id, pessoas.map((pessoa) => ({ pessoa, texto: `copiou o dia ${dm(pedido.origem)} e mexeu na escala de ${pessoa.name}` })));
      const total = resumo.copia.atividades + resumo.copia.ajustes + resumo.copia.horarios + resumo.copia.edicoes + resumo.copia.chamadas + resumo.copia.vagas;
      const partes = [
        resumo.copia.atividades && `${resumo.copia.atividades} ${resumo.copia.atividades === 1 ? "atividade só do dia" : "atividades só do dia"}`,
        resumo.copia.ajustes && `${resumo.copia.ajustes} ${resumo.copia.ajustes === 1 ? "ajuste" : "ajustes"}`,
        resumo.copia.horarios && `${resumo.copia.horarios} ${resumo.copia.horarios === 1 ? "horário" : "horários"}`,
        resumo.copia.edicoes && `${resumo.copia.edicoes} ${resumo.copia.edicoes === 1 ? "edição de atividade" : "edições de atividade"}`,
        resumo.copia.chamadas && `${resumo.copia.chamadas} ${resumo.copia.chamadas === 1 ? "chamada" : "chamadas"}`,
        resumo.copia.vagas && `${resumo.copia.vagas} ${resumo.copia.vagas === 1 ? "vaga de Livro do Dia" : "vagas de Livros do Dia"}`,
      ].filter(Boolean).join(", ");
      const versaoTexto = o.publicada ? ((pedido.versao ?? "publicada") === "publicada" ? " (versão publicada)" : " (versão de agora)") : " (rascunho)";
      const eventoId = await writeHistoryEvent({
        category: "SCALE", action: ACAO_COPIA, title: "Dia copiado de outro dia",
        narrative: `Copiou o dia ${pedido.origem} (${DIAS[weekdayOf(pedido.origem)]})${versaoTexto} para ${pedido.destino}: ${total ? partes : "nada novo para copiar"}.${modo === "zero" ? ` Começou do zero (${desativados.ajustes.length + desativados.edicoes.length + desativados.manuais.length + desativados.chamadas.length} itens desativados, restauráveis). Motivo: ${motivo}.` : ""}${resumo.jaEstava ? ` ${resumo.jaEstava} já estavam no dia.` : ""}${resumo.foraDe.length ? ` Ficaram de fora: ${resumo.foraDe.map((f) => f.pessoa ? `${f.pessoa} (${f.tipo})` : f.tipo).join("; ")}.` : ""}`,
        entityType: "scale", entityId: scale.id, actorId: ator.sub, operationId, orgId: ator.organizationId,
        beforeState: { origem: pedido.origem, modo },
        afterState: { origem: pedido.origem, origemEscalaId: o.scale.id, versao: o.publicada ? (pedido.versao ?? "publicada") : "rascunho", modo, criados, desativados, livros: livrosTrocados, copia: resumo.copia, jaEstava: resumo.jaEstava, foraDe: resumo.foraDe.map((f) => ({ tipo: f.tipo, pessoaId: f.pessoaId ?? null, frase: f.frase })) },
        metadata: { ...(modo === "zero" ? { reason: motivo } : {}), ...mex },
      }, tx as unknown as HistoryExecutor);
      if (escalaPublicada(scale.status)) {
        scale = (await tx.update(scalesTable).set({ alteradaDesde: scale.alteradaDesde ?? new Date(), updatedAt: new Date(), version: scale.version + 1 }).where(eq(scalesTable.id, scale.id)).returning())[0]!;
        await avisarRepublicacaoPendente(tx as unknown as Exec, scale, `copiou o dia ${dm(pedido.origem)} para cá`, { areaIds: [...areasDosBlocos], ...coleta.paraARepublicacao() });
      }
      await coleta.avisar(tx as unknown as Exec, scale);
      return eventoId;
    });
    for (const emitir of depoisDoCommit) { try { emitir(); } catch (err) { console.error(err); } }
    return { ok: true, resumo, eventoId: resultado || null, gravou: true };
  } catch (err) {
    console.error(err);
    if (err instanceof VersionConflictError) return { ok: false, status: 409, error: "LIVRO_MUDOU", message: "Um Livro do Dia mudou enquanto a cópia era gravada. Nada foi gravado neste dia: confira e copie de novo.", resumo };
    return { ok: false, status: 500, error: "ERRO_INTERNO", message: "Não consegui copiar para este dia. Nada foi gravado nele; tente de novo.", resumo };
  }
}

// ─── Desfazer ────────────────────────────────────────────────────────────────────────────────────

type Criados = { ajustes?: string[]; edicoes?: string[]; manuais?: string[]; chamadas?: string[] };
export type ResultadoDoDesfazer = { eventoId: string; date: string | null; ok: boolean; desfeitos: number; restaurados: number; naoDesfeitos: string[]; message: string };

export async function desfazerCopia(ator: Ator, eventoId: string): Promise<{ status: number; body: ResultadoDoDesfazer | { error: string; message: string } }> {
  const [ev] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.id, eventoId), eq(historyEventsTable.orgId, ator.organizationId), eq(historyEventsTable.action, ACAO_COPIA))).limit(1);
  if (!ev) return { status: 404, body: { error: "NAO_ENCONTRADO", message: "Não achei essa cópia no Registro." } };
  const [scale] = await db.select().from(scalesTable).where(eq(scalesTable.id, ev.entityId)).limit(1);
  if (!scale?.locationId) return { status: 404, body: { error: "NAO_ENCONTRADO", message: "A Escala dessa cópia não existe mais." } };
  if (!(await podeCopiar(ator, scale.locationId))) return { status: 403, body: { error: "ACESSO_NEGADO", message: FRASE_COPIA_SEM_ACESSO } };
  const [jaDesfeita] = await db.select({ id: historyEventsTable.id }).from(historyEventsTable).where(and(
    eq(historyEventsTable.action, ACAO_COPIA_DESFEITA), eq(historyEventsTable.entityId, scale.id), sql`${historyEventsTable.metadata}->>'eventoId' = ${eventoId}`)).limit(1);
  if (jaDesfeita) return { status: 409, body: { error: "JA_DESFEITA", message: "Essa cópia já foi desfeita." } };
  const depois = (ev.afterState ?? {}) as { criados?: Criados; desativados?: Criados };
  const criados = depois.criados ?? {}, desativados = depois.desativados ?? {};
  const naoDesfeitos: string[] = [];
  let desfeitos = 0, restaurados = 0;
  const agora = new Date();
  const livrosGravados = ((depois as { livros?: { dailyBookId: string; show: string; trocas: VagaTrocada[] }[] }).livros) ?? [];
  const depoisDoCommit: (() => void)[] = [];
  await db.transaction(async (tx) => {
    // Vagas dos Livros (H2): volta ao que era antes só a vaga que ninguém mexeu depois da cópia (mesma pessoa e mesma hora de gravação).
    for (const livro of livrosGravados) {
      const atuais = await tx.select({ id: dailyBookAssignmentsTable.id, userId: dailyBookAssignmentsTable.userId, updatedAt: dailyBookAssignmentsTable.updatedAt }).from(dailyBookAssignmentsTable)
        .where(inArray(dailyBookAssignmentsTable.id, livro.trocas.map((t) => t.assignmentId)));
      const intactas = livro.trocas.filter((t) => { const a = atuais.find((x) => x.id === t.assignmentId); return a && a.userId === t.depois.userId && a.updatedAt.toISOString() === t.updatedAt; });
      let voltou = false;
      if (intactas.length) voltou = (await trocarVagasNoLivro({ dailyBookId: livro.dailyBookId, actorId: ator.sub, trocas: intactas.map((t) => ({ assignmentId: t.assignmentId, para: t.antes })), origem: "desfazer a cópia de outro dia" }, { tx: tx as unknown as typeof db, depoisDoCommit })) !== false;
      const ficaram = livro.trocas.length - (voltou ? intactas.length : 0);
      if (voltou) desfeitos += intactas.length;
      if (ficaram > 0) naoDesfeitos.push(`${ficaram} ${ficaram === 1 ? "vaga" : "vagas"} de ${livro.show} já ${ficaram === 1 ? "foi mexida" : "foram mexidas"} depois da cópia (ou o Livro já foi executado) e ${ficaram === 1 ? "ficou" : "ficaram"} como está.`);
    }
    if (criados.ajustes?.length) {
      const linhas = await tx.select().from(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.id, criados.ajustes));
      const intactas = linhas.filter((l) => l.active && !l.endedAt).map((l) => l.id);
      if (intactas.length) await tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: ator.sub, endedAt: agora }).where(inArray(escalaBlocoAjustesTable.id, intactas));
      desfeitos += intactas.length;
      const mexidas = linhas.length - intactas.length;
      if (mexidas > 0) naoDesfeitos.push(`${mexidas} ${mexidas === 1 ? "ajuste" : "ajustes"} já ${mexidas === 1 ? "foi mexido" : "foram mexidos"} depois da cópia e ${mexidas === 1 ? "ficou" : "ficaram"} como está.`);
    }
    if (criados.edicoes?.length) {
      const linhas = await tx.select().from(escalaBlocoEdicoesTable).where(inArray(escalaBlocoEdicoesTable.id, criados.edicoes));
      const intactas = linhas.filter((l) => l.active && !l.endedAt).map((l) => l.id);
      if (intactas.length) await tx.update(escalaBlocoEdicoesTable).set({ active: false, endedBy: ator.sub, endedAt: agora }).where(inArray(escalaBlocoEdicoesTable.id, intactas));
      desfeitos += intactas.length;
      const mexidas = linhas.length - intactas.length;
      if (mexidas > 0) naoDesfeitos.push(`${mexidas} ${mexidas === 1 ? "edição de atividade" : "edições de atividade"} já ${mexidas === 1 ? "foi mexida" : "foram mexidas"} depois da cópia e ${mexidas === 1 ? "ficou" : "ficaram"} como está.`);
    }
    if (criados.manuais?.length) {
      const linhas = await tx.select().from(scaleAllocationsTable).where(inArray(scaleAllocationsTable.id, criados.manuais));
      const intactas = linhas.filter((l) => l.active && l.updatedAt.getTime() === l.createdAt.getTime()).map((l) => l.id);
      if (intactas.length) await tx.update(scaleAllocationsTable).set({ active: false, updatedAt: agora }).where(inArray(scaleAllocationsTable.id, intactas));
      desfeitos += intactas.length;
      const mexidas = linhas.length - intactas.length;
      if (mexidas > 0) naoDesfeitos.push(`${mexidas} ${mexidas === 1 ? "entrada de atividade só do dia" : "entradas de atividades só do dia"} já ${mexidas === 1 ? "foi mexida" : "foram mexidas"} depois da cópia e ${mexidas === 1 ? "ficou" : "ficaram"} como está.`);
    }
    if (criados.chamadas?.length) {
      const linhas = await tx.select().from(escalaChamadasTable).where(inArray(escalaChamadasTable.id, criados.chamadas));
      const intactas = linhas.filter((l) => l.active && l.updatedAt.getTime() === l.createdAt.getTime()).map((l) => l.id);
      if (intactas.length) await tx.update(escalaChamadasTable).set({ active: false, updatedAt: agora }).where(inArray(escalaChamadasTable.id, intactas));
      desfeitos += intactas.length;
      const mexidas = linhas.length - intactas.length;
      if (mexidas > 0) naoDesfeitos.push(`${mexidas} ${mexidas === 1 ? "chamada" : "chamadas"} já ${mexidas === 1 ? "foi mexida" : "foram mexidas"} depois da cópia e ${mexidas === 1 ? "ficou" : "ficaram"} como está.`);
    }
    // "Começar do zero" desativou o que havia: volta, a não ser que já exista outra linha ativa no lugar.
    if (desativados.ajustes?.length) {
      const velhas = await tx.select().from(escalaBlocoAjustesTable).where(and(inArray(escalaBlocoAjustesTable.id, desativados.ajustes), eq(escalaBlocoAjustesTable.active, false)));
      const vivas = await tx.select({ k: escalaBlocoAjustesTable.sourceKey, u: escalaBlocoAjustesTable.userId }).from(escalaBlocoAjustesTable).where(and(eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.active, true)));
      const ocupadas = new Set(vivas.map((v) => `${v.k}|${v.u}`));
      const voltam = velhas.filter((v) => !ocupadas.has(`${v.sourceKey}|${v.userId}`));
      if (voltam.length) await tx.update(escalaBlocoAjustesTable).set({ active: true, endedBy: null, endedAt: null }).where(inArray(escalaBlocoAjustesTable.id, voltam.map((v) => v.id)));
      restaurados += voltam.length;
      if (velhas.length - voltam.length > 0) naoDesfeitos.push(`${velhas.length - voltam.length} ajustes de antes não voltaram porque já há outro no lugar.`);
    }
    if (desativados.edicoes?.length) {
      const velhas = await tx.select().from(escalaBlocoEdicoesTable).where(and(inArray(escalaBlocoEdicoesTable.id, desativados.edicoes), eq(escalaBlocoEdicoesTable.active, false)));
      const vivas = await tx.select({ k: escalaBlocoEdicoesTable.sourceKey }).from(escalaBlocoEdicoesTable).where(and(eq(escalaBlocoEdicoesTable.scaleId, scale.id), eq(escalaBlocoEdicoesTable.active, true)));
      const ocupadas = new Set(vivas.map((v) => v.k));
      const voltam = velhas.filter((v) => !ocupadas.has(v.sourceKey));
      if (voltam.length) await tx.update(escalaBlocoEdicoesTable).set({ active: true, endedBy: null, endedAt: null }).where(inArray(escalaBlocoEdicoesTable.id, voltam.map((v) => v.id)));
      restaurados += voltam.length;
      if (velhas.length - voltam.length > 0) naoDesfeitos.push(`${velhas.length - voltam.length} edições de atividade de antes não voltaram porque já há outra no lugar.`);
    }
    if (desativados.manuais?.length) {
      const n = await tx.update(scaleAllocationsTable).set({ active: true, updatedAt: agora }).where(and(inArray(scaleAllocationsTable.id, desativados.manuais), eq(scaleAllocationsTable.active, false))).returning({ id: scaleAllocationsTable.id });
      restaurados += n.length;
    }
    if (desativados.chamadas?.length) {
      const n = await tx.update(escalaChamadasTable).set({ active: true, updatedAt: agora }).where(and(inArray(escalaChamadasTable.id, desativados.chamadas), eq(escalaChamadasTable.active, false))).returning({ id: escalaChamadasTable.id });
      restaurados += n.length;
    }
    await writeHistoryEvent({
      category: "SCALE", action: ACAO_COPIA_DESFEITA, title: "Cópia de outro dia desfeita",
      narrative: `Desfez a cópia do dia ${(ev.afterState as { origem?: string } | null)?.origem ?? "de origem"} em ${scale.periodStart}: ${desfeitos} ${desfeitos === 1 ? "item tirado" : "itens tirados"}${restaurados ? `, ${restaurados} ${restaurados === 1 ? "item de antes restaurado" : "itens de antes restaurados"}` : ""}.${naoDesfeitos.length ? ` ${naoDesfeitos.join(" ")}` : ""}`,
      entityType: "scale", entityId: scale.id, actorId: ator.sub, operationId: scale.operationId, orgId: ator.organizationId,
      beforeState: { eventoId }, afterState: { desfeitos, restaurados, naoDesfeitos }, metadata: { eventoId },
    }, tx as unknown as HistoryExecutor);
  });
  for (const emitir of depoisDoCommit) { try { emitir(); } catch (err) { console.error(err); } }
  const message = naoDesfeitos.length
    ? `Desfiz o que não foi mexido (${desfeitos}). ${naoDesfeitos.join(" ")}`
    : `Desfiz a cópia de ${dm(scale.periodStart)}: ${desfeitos} ${desfeitos === 1 ? "item tirado" : "itens tirados"}${restaurados ? ` e ${restaurados} de antes ${restaurados === 1 ? "voltou" : "voltaram"}` : ""}.`;
  return { status: 200, body: { eventoId, date: scale.periodStart, ok: naoDesfeitos.length === 0, desfeitos, restaurados, naoDesfeitos, message } };
}

// ─── Dias que podem servir de origem ─────────────────────────────────────────────────────────────

export type OrigemPossivel = { date: string; diaDaSemana: string; estado: "rascunho" | "publicado"; mudouDepois: boolean; atividades: number; ajustes: number; horarios: number; edicoes: number; chamadas: number; livros: number };

export async function origensPossiveis(locationId: string, centro: string, diasAtras = 56, diasAFrente = 14): Promise<OrigemPossivel[]> {
  const soma = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
  const escalas = await db.select().from(scalesTable).where(and(
    eq(scalesTable.locationId, locationId), ne(scalesTable.status, "ARCHIVED"), gte(scalesTable.periodStart, soma(centro, -diasAtras)), lte(scalesTable.periodStart, soma(centro, diasAFrente)),
  )).orderBy(desc(scalesTable.periodStart));
  if (!escalas.length) return [];
  const ids = escalas.map((e) => e.id);
  const datas = escalas.map((e) => e.periodStart);
  const [aj, ed, ma, ch, lv] = await Promise.all([
    db.select({ scaleId: escalaBlocoAjustesTable.scaleId, action: escalaBlocoAjustesTable.action, mesmo: escalaBlocoAjustesTable.mesmoDeFolga, key: escalaBlocoAjustesTable.sourceKey }).from(escalaBlocoAjustesTable).where(and(inArray(escalaBlocoAjustesTable.scaleId, ids), eq(escalaBlocoAjustesTable.active, true))),
    db.select({ scaleId: escalaBlocoEdicoesTable.scaleId }).from(escalaBlocoEdicoesTable).where(and(inArray(escalaBlocoEdicoesTable.scaleId, ids), eq(escalaBlocoEdicoesTable.active, true))),
    db.select({ scaleId: scaleAllocationsTable.scaleId, label: scaleAllocationsTable.manualLabel, ini: scaleAllocationsTable.startTime, fim: scaleAllocationsTable.endTime }).from(scaleAllocationsTable).where(and(inArray(scaleAllocationsTable.scaleId, ids), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualLabel} IS NOT NULL`)),
    db.select({ scaleId: escalaChamadasTable.scaleId }).from(escalaChamadasTable).where(and(inArray(escalaChamadasTable.scaleId, ids), eq(escalaChamadasTable.active, true))),
    // Livros do Dia de cada dia (cancelado não conta): um dia só com Livros também serve de origem das vagas.
    db.select({ date: agendaEventsTable.date }).from(dailyBooksTable).innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id)).innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
      .where(and(eq(showBooksTable.locationId, locationId), ne(dailyBooksTable.status, "CANCELLED"), inArray(agendaEventsTable.date, datas))),
  ]);
  const lista: OrigemPossivel[] = [];
  for (const e of escalas) {
    const ajustes = aj.filter((a) => a.scaleId === e.id && a.action !== "HORARIO" && !a.mesmo && (a.key.startsWith("p:") || a.key.startsWith("m:"))).length;
    const horarios = aj.filter((a) => a.scaleId === e.id && a.action === "HORARIO").length;
    const edicoes = ed.filter((x) => x.scaleId === e.id).length;
    const atividades = new Set(ma.filter((x) => x.scaleId === e.id).map((x) => `${x.label}|${x.ini}|${x.fim}`)).size;
    const chamadas = ch.filter((x) => x.scaleId === e.id).length;
    const livros = lv.filter((x) => x.date === e.periodStart).length;
    if (ajustes + horarios + edicoes + atividades + chamadas + livros === 0) continue;
    lista.push({ date: e.periodStart, diaDaSemana: DIAS[weekdayOf(e.periodStart)]!, estado: escalaPublicada(e.status) ? "publicado" : "rascunho", mudouDepois: escalaPublicada(e.status) && Boolean(e.alteradaDesde), atividades, ajustes, horarios, edicoes, chamadas, livros });
  }
  return lista;
}

/** Data AAAA-MM-DD que existe no calendário ("2026-13-45" passa no formato, mas o banco a recusaria com erro 500). */
export function lerData(v: unknown): string | null {
  if (typeof v !== "string" || !DATE.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}
