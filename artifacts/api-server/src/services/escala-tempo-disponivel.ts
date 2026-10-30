/**
 * Tempo disponível na Escala do dia (pacote G): quem fica um bom tempo sem nada entre duas atividades do mesmo dia.
 *
 * O dia de cada pessoa vai da PRIMEIRA à ÚLTIMA atividade dela; antes da primeira e depois da última não é tempo disponível, e quem tem uma
 * atividade só (ou nenhuma) não tem buraco. O que ocupa o tempo: atividades, a janela de almoço INTEIRA, a chamada que "ocupa tempo" e a ida
 * entre locais (o tempo cadastrado em Locais é descontado do buraco). Quem está de folga, sem local hoje ou na equipe de outro local fica de fora
 * (quem chama decide a lista). O buraco que começa em outro local aparece na Escala daquele local, com o limite dele.
 * Só avisa: nunca bloqueia, não vai para o sino nem para a impressão.
 */
import { contaComoAtividadeDe, type RegraDaEquipe } from "./escala-equipe-regra.js";
import { horaDe, minutosDe, type TempoDeIda } from "./escala-deslocamento.js";
import { DIA_DIVIDIDO_MINUTOS } from "../lib/tempo-disponivel.js";
import type { BlocoDia } from "./escala-dia.js";

/** Atividade sem fim dura 30 minutos (a mesma conta do choque entre locais). */
const DURACAO_PADRAO_MINUTOS = 30;

export type LadoDoBuraco = { rotulo: string; localId: string; localNome: string };

/** Um tempo livre de uma pessoa: de que hora a que hora, quantos minutos, e o que vem antes e depois. */
export type Buraco = {
  pessoaId: string; de: string; ate: string; minutos: number;
  antes: LadoDoBuraco; depois: LadoDoBuraco;
  /** A próxima atividade é em outro local: o tempo de ida já foi descontado do buraco. */
  minutosDeIda?: number;
};

export type TempoDisponivel = {
  /** O limite do local, em minutos. */
  limite: number;
  /** Buracos de `limite` minutos até menos de 3 horas, do maior para o menor. */
  avisos: Buraco[];
  /** Buracos de 3 horas ou mais (manhã e noite, por exemplo), do maior para o menor. A tela mostra recolhidos. */
  diaDividido: Buraco[];
};

type Trecho = { inicio: number; fim: number; localId: string; localNome: string; rotulo: string };

export type LocalDoDia = { id: string; name: string; blocos: BlocoDia[] };

/** O que ocupa o tempo da pessoa num bloco, em minutos; null quando o bloco não ocupa (ou não tem hora). */
function trechoDoBloco(b: BlocoDia, local: { id: string; name: string }): Trecho | null {
  if (b.regra === "ninguem") return null;
  if (b.chamada && !b.chamada.ocupaTempo) return null;
  const ini = minutosDe(b.inicio);
  if (ini === null) return null;
  const fimLido = minutosDe(b.fim);
  // A janela de almoço só vale com fim; os outros blocos, sem fim, duram 30 minutos.
  if (b.flexivel && (fimLido === null || fimLido <= ini)) return null;
  const fim = fimLido !== null && fimLido > ini ? fimLido : ini + DURACAO_PADRAO_MINUTOS;
  return { inicio: ini, fim, localId: local.id, localNome: local.name, rotulo: b.rotulo };
}

/** Os trechos que ocupam a pessoa no dia: deste local, e (quando a casa usa equipe) dos outros, pela regra do choque entre locais. */
export function trechosDaPessoa(pessoaId: string, localId: string, locais: LocalDoDia[], equipe: Pick<RegraDaEquipe, "ativa" | "temMarca">): Trecho[] {
  const trechos: Trecho[] = [];
  for (const local of locais) {
    const aqui = local.id === localId;
    // Sem equipe na casa, o "todo mundo" de outro local não diz onde a pessoa está: só este local conta.
    if (!aqui && !equipe.ativa) continue;
    for (const b of local.blocos) {
      if (!b.pessoaIds.includes(pessoaId)) continue;
      // Nos outros locais, atividade geral ("todos" e "área") só conta para quem tem marca de equipe; janela de almoço e chamada, idem.
      if (!aqui && (b.flexivel || b.chamada ? !equipe.temMarca(pessoaId) : !contaComoAtividadeDe(b, pessoaId, equipe))) continue;
      const t = trechoDoBloco(b, local);
      if (t) trechos.push(t);
    }
  }
  return trechos;
}

/**
 * Os buracos de UMA pessoa a partir de `limite` minutos que COMEÇAM em `localId`. Funde o que se encosta ou se cruza e, entre dois locais
 * diferentes, desconta o tempo de ida (sem tempo cadastrado vale 0). Pura.
 */
export function buracosDaPessoa(pessoaId: string, trechos: Trecho[], localId: string, limite: number, tempoDeIda: TempoDeIda): Buraco[] {
  if (trechos.length < 2) return [];
  const ordenados = [...trechos].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  const buracos: Buraco[] = [];
  let atual = { ...ordenados[0]! };
  for (const proximo of ordenados.slice(1)) {
    if (proximo.inicio < atual.fim) {
      // Cruza ou encosta: um trecho só. Quem termina por último diz onde a pessoa está depois.
      if (proximo.fim > atual.fim) atual = { ...atual, fim: proximo.fim, localId: proximo.localId, localNome: proximo.localNome, rotulo: proximo.rotulo };
      continue;
    }
    const outroLocal = proximo.localId !== atual.localId;
    const ida = outroLocal ? Math.max(tempoDeIda(atual.localId, proximo.localId) ?? 0, 0) : 0;
    const livre = proximo.inicio - atual.fim - ida;
    if (atual.localId === localId && livre >= limite) {
      buracos.push({
        pessoaId, de: horaDe(atual.fim), ate: horaDe(proximo.inicio - ida), minutos: livre,
        antes: { rotulo: atual.rotulo, localId: atual.localId, localNome: atual.localNome },
        depois: { rotulo: proximo.rotulo, localId: proximo.localId, localNome: proximo.localNome },
        ...(outroLocal && ida > 0 ? { minutosDeIda: ida } : {}),
      });
    }
    atual = { ...proximo };
  }
  return buracos;
}

/**
 * O tempo disponível do dia no local `localId`: `pessoaIds` são só as pessoas que a Escala deste local conta (sem folga, sem "sem local hoje",
 * sem equipe de outro local). `locais` traz este local e os outros, já montados. O buraco de 3 horas ou mais vai para `diaDividido`.
 */
export function tempoDisponivelDoDia(entrada: {
  localId: string; limite: number; pessoaIds: string[]; locais: LocalDoDia[]; equipe: Pick<RegraDaEquipe, "ativa" | "temMarca">; tempoDeIda: TempoDeIda;
}): TempoDisponivel {
  const todos: Buraco[] = [];
  for (const pessoaId of entrada.pessoaIds) {
    const trechos = trechosDaPessoa(pessoaId, entrada.localId, entrada.locais, entrada.equipe);
    todos.push(...buracosDaPessoa(pessoaId, trechos, entrada.localId, entrada.limite, entrada.tempoDeIda));
  }
  const maiorPrimeiro = (a: Buraco, b: Buraco) => b.minutos - a.minutos || a.de.localeCompare(b.de) || a.pessoaId.localeCompare(b.pessoaId);
  return {
    limite: entrada.limite,
    avisos: todos.filter((b) => b.minutos < DIA_DIVIDIDO_MINUTOS).sort(maiorPrimeiro),
    diaDividido: todos.filter((b) => b.minutos >= DIA_DIVIDIDO_MINUTOS).sort(maiorPrimeiro),
  };
}
