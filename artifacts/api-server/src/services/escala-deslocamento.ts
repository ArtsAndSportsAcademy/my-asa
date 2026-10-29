/**
 * Tempo de ida de um local a outro e o choque entre locais (pacote O, O5).
 *
 * A Administração escreve, em Locais, quantos minutos leva de um local a outro (Snowland ↔ Acqua: 30). Um par guarda uma linha só, com o menor id
 * em `locationAId`. Par sem tempo = só confere se os horários se cruzam. O choque entre locais só avisa, nunca bloqueia (a pessoa pode estar nos
 * dois de propósito); no Livro do Dia, quem não chega a tempo conta como indisponível e a reserva entra (ver `regras-de-escala.ts`).
 */
import { and, eq, sql } from "drizzle-orm";
import { db, locaisDeslocamentoTable } from "@workspace/db";
import type { BlocoDia } from "./escala-dia.js";

type Exec = typeof db;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAXIMO_DE_MINUTOS = 720;
export const FRASE_DESLOCAMENTO_MUDOU = "Outra pessoa alterou o tempo de ida entre os locais enquanto você editava. Nada foi salvo: confira o que está aí agora e refaça a mudança.";
export const FRASE_DESLOCAMENTO_SEM_VERSAO = "Faltou dizer qual versão do tempo de ida você abriu (baseVersao). Recarregue a tela e tente de novo.";

/** Um par de locais com o tempo de ida, na ordem canônica (A < B). */
export type ParDeLocais = { locationAId: string; locationBId: string; minutos: number };

/** Põe o par na ordem canônica: o menor id primeiro. */
export const parNaOrdem = (x: string, y: string) => (x.toLowerCase() < y.toLowerCase() ? [x.toLowerCase(), y.toLowerCase()] as const : [y.toLowerCase(), x.toLowerCase()] as const);
export const chaveDoPar = (x: string, y: string) => parNaOrdem(x, y).join("|");

/** Lê o que a tela mandou: pares com minutos de 0 a 720. O mesmo par repetido vale o último. Frase de gente quando algo não serve. */
export function lerPares(bruto: unknown): { ok: true; pares: ParDeLocais[] } | { ok: false; erro: string } {
  if (!Array.isArray(bruto)) return { ok: false, erro: "pares: mande a lista de pares de locais com o tempo de ida." };
  if (bruto.length > 200) return { ok: false, erro: "pares: são pares demais para uma vez só." };
  const porChave = new Map<string, ParDeLocais>();
  for (const [i, item] of bruto.entries()) {
    const onde = `Par ${i + 1}`;
    if (!item || typeof item !== "object") return { ok: false, erro: `${onde}: formato inválido.` };
    const p = item as Record<string, unknown>;
    if (typeof p.locationAId !== "string" || !UUID.test(p.locationAId) || typeof p.locationBId !== "string" || !UUID.test(p.locationBId)) return { ok: false, erro: `${onde}: os dois locais precisam ser válidos.` };
    if (p.locationAId.toLowerCase() === p.locationBId.toLowerCase()) return { ok: false, erro: `${onde}: escolha dois locais diferentes.` };
    const minutos = typeof p.minutos === "number" ? p.minutos : typeof p.minutos === "string" && p.minutos.trim() !== "" ? Number(p.minutos) : NaN;
    if (!Number.isInteger(minutos) || minutos < 0 || minutos > MAXIMO_DE_MINUTOS) return { ok: false, erro: `${onde}: o tempo de ida é um número inteiro de minutos, de 0 a ${MAXIMO_DE_MINUTOS}.` };
    const [a, b] = parNaOrdem(p.locationAId, p.locationBId);
    porChave.set(`${a}|${b}`, { locationAId: a, locationBId: b, minutos });
  }
  return { ok: true, pares: [...porChave.values()] };
}

export type ParGuardado = ParDeLocais & { id: string; active: boolean };

/**
 * O que muda para o conjunto novo ficar igual ao pedido, sem apagar nada: par novo entra, par que tinha saído e voltou é reativado (mesma linha),
 * par com outro tempo é atualizado e par que sumiu da lista fica inativo.
 */
export function diferencaDosPares(guardados: ParGuardado[], novos: ParDeLocais[]) {
  const guardadoPor = new Map<string, ParGuardado>();
  for (const g of guardados) {
    const chave = chaveDoPar(g.locationAId, g.locationBId);
    const atual = guardadoPor.get(chave);
    if (!atual || (g.active && !atual.active)) guardadoPor.set(chave, g);
  }
  const querido = new Map(novos.map((p) => [chaveDoPar(p.locationAId, p.locationBId), p]));
  const inserir: ParDeLocais[] = [], reativar: (ParGuardado & { novoMinutos: number })[] = [], atualizar: (ParGuardado & { novoMinutos: number })[] = [], remover: ParGuardado[] = [];
  for (const [chave, par] of querido) {
    const g = guardadoPor.get(chave);
    if (!g) inserir.push(par);
    else if (!g.active) reativar.push({ ...g, novoMinutos: par.minutos });
    else if (g.minutos !== par.minutos) atualizar.push({ ...g, novoMinutos: par.minutos });
  }
  for (const [chave, g] of guardadoPor) if (g.active && !querido.has(chave)) remover.push(g);
  return { inserir, reativar, atualizar, remover, mudou: inserir.length + reativar.length + atualizar.length + remover.length > 0 };
}

/** A versão do conjunto: o instante da última mexida nos pares (mesma ideia da versão da equipe). Vazio = nunca foi configurado. */
export async function versaoDoDeslocamento(organizationId: string, executor: Exec = db): Promise<string | null> {
  const [r] = await executor.select({ ms: sql<string | null>`floor(extract(epoch from max(${locaisDeslocamentoTable.updatedAt})) * 1000)::bigint` })
    .from(locaisDeslocamentoTable).where(eq(locaisDeslocamentoTable.organizationId, organizationId));
  return r?.ms ? new Date(Number(r.ms)).toISOString() : null;
}

export async function paresGuardados(organizationId: string, executor: Exec = db): Promise<ParGuardado[]> {
  const linhas = await executor.select().from(locaisDeslocamentoTable).where(eq(locaisDeslocamentoTable.organizationId, organizationId));
  return linhas.map((l) => ({ id: l.id, locationAId: l.locationAId, locationBId: l.locationBId, minutos: l.minutos, active: l.active }));
}

/** O tempo de ida entre dois locais, ou null quando a Administração não escreveu. */
export type TempoDeIda = (x: string, y: string) => number | null;

export async function lerTempoDeIda(organizationId: string, executor: Exec = db): Promise<TempoDeIda> {
  const linhas = await executor.select({ a: locaisDeslocamentoTable.locationAId, b: locaisDeslocamentoTable.locationBId, minutos: locaisDeslocamentoTable.minutos })
    .from(locaisDeslocamentoTable).where(and(eq(locaisDeslocamentoTable.organizationId, organizationId), eq(locaisDeslocamentoTable.active, true)));
  const mapa = new Map(linhas.map((l) => [chaveDoPar(l.a, l.b), l.minutos]));
  return (x, y) => mapa.get(chaveDoPar(x, y)) ?? null;
}

// ─── Choque entre locais (puro) ───────────────────────────────────────────────

const DURACAO_PADRAO_MINUTOS = 30;
export const minutosDe = (hora: string | null | undefined): number | null => {
  const [h, m] = (hora ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null;
};
export const horaDe = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** O que acontece na vida da pessoa: uma atividade, com início e fim em minutos (sem fim = 30 minutos). */
export type Atividade = { rotulo: string; inicio: string; fim: string | null };

export type ProblemaDeIda =
  | { tipo: "mesmo_horario" }
  | { tipo: "sem_tempo"; minutosDeIda: number; minutosDeFolga: number };

/**
 * Duas atividades de locais diferentes: se cruzam (mesmo horário) ou a folga entre uma e outra é menor que a ida (sem tempo)? Null quando está tudo bem.
 * Sem tempo cadastrado para o par, só confere o cruzamento. Pura.
 */
export function problemaDeIda(a: Atividade, b: Atividade, minutosDeIda: number | null): ProblemaDeIda | null {
  const ai = minutosDe(a.inicio), bi = minutosDe(b.inicio);
  if (ai === null || bi === null) return null;
  const af = minutosDe(a.fim) ?? ai + DURACAO_PADRAO_MINUTOS, bf = minutosDe(b.fim) ?? bi + DURACAO_PADRAO_MINUTOS;
  if (ai < bf && bi < af) return { tipo: "mesmo_horario" };
  if (minutosDeIda === null || minutosDeIda <= 0) return null;
  const folga = bi >= af ? bi - af : ai - bf;
  return folga < minutosDeIda ? { tipo: "sem_tempo", minutosDeIda, minutosDeFolga: folga } : null;
}

/** Uma pessoa em duas coisas em locais diferentes que não cabem: no mesmo horário, ou sem o tempo de ir de uma à outra. */
export type ChoqueEntreLocais = {
  pessoaId: string; tipo: ProblemaDeIda["tipo"];
  aqui: { key: string; rotulo: string; inicio: string; fim: string | null };
  la: { key: string; localId: string; localNome: string; rotulo: string; inicio: string; fim: string | null };
  minutosDeIda?: number; minutosDeFolga?: number;
};

/** O que conta como "atividade" para o choque entre locais: as mesmas exclusões da faixa "No outro local" (fora o almoço, o "todo mundo" e as chamadas). */
const contaParaOChoque = (b: BlocoDia) => !b.flexivel && b.regra !== "todos" && b.regra !== "ninguem" && !b.chamada && b.pessoaIds.length > 0;

/** Compara as atividades deste local com as dos outros, pessoa por pessoa. Só avisa; quem decide é quem responde pelo dia. */
export function choquesEntreLocais(localId: string, aqui: BlocoDia[], outros: { id: string; name: string; blocos: BlocoDia[] }[], tempoDeIda: TempoDeIda): ChoqueEntreLocais[] {
  const achados: ChoqueEntreLocais[] = [];
  const meus = aqui.filter(contaParaOChoque);
  for (const outro of outros) {
    const ida = tempoDeIda(localId, outro.id);
    for (const b of outro.blocos.filter(contaParaOChoque)) {
      for (const a of meus) {
        const comuns = a.pessoaIds.filter((id) => b.pessoaIds.includes(id));
        if (!comuns.length) continue;
        const problema = problemaDeIda({ rotulo: a.rotulo, inicio: a.inicio, fim: a.fim }, { rotulo: b.rotulo, inicio: b.inicio, fim: b.fim }, ida);
        if (!problema) continue;
        for (const pessoaId of comuns) {
          achados.push({
            pessoaId, tipo: problema.tipo,
            aqui: { key: a.key, rotulo: a.rotulo, inicio: a.inicio, fim: a.fim },
            la: { key: b.key, localId: outro.id, localNome: outro.name, rotulo: b.rotulo, inicio: b.inicio, fim: b.fim },
            ...(problema.tipo === "sem_tempo" ? { minutosDeIda: problema.minutosDeIda, minutosDeFolga: problema.minutosDeFolga } : {}),
          });
        }
      }
    }
  }
  return achados.sort((x, y) => x.aqui.inicio.localeCompare(y.aqui.inicio) || x.pessoaId.localeCompare(y.pessoaId));
}
