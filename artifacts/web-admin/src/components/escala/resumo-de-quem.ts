/**
 * Resumo de "quem faz" um bloco, igual na Escala (visão "Por atividade") e na folha impressa.
 * Lista de 30 nomes não se lê no papel nem no celular; quando o bloco é do elenco todo, de uma área
 * inteira ou de um show grande, a frase curta diz o mesmo. Regras da usuária (26/10/2026):
 *  1. 80% ou mais das pessoas que trabalham no dia → "Elenco do dia".
 *  2. 80% ou mais de UMA área (das pessoas dela que trabalham no dia) → o nome da área; quem é de fora
 *     entra pelo nome ("Bailarinos e Fulano"). Quem faltou não aparece: a folga já tem lista própria.
 *  3. Show com mais de 12 posições no Livro do Dia → "Elenco do show: N pessoas" (o papel diz "ver Livro do Dia").
 *  4. O resto lista os nomes. Show pequeno lista "personagem: pessoa" (isso é com quem desenha a linha do show).
 */
export type PessoaDoDia = { id: string; name: string; areaId: string | null; areaName: string | null };
export type ResumoDeQuem = {
  tipo: "todos" | "area" | "show-grande" | "lista";
  /** Frase pronta para mostrar ("Elenco do dia", "Bailarinos e Bel", "Elenco do show: 21 pessoas"). Vazia quando não há ninguém. */
  rotulo: string;
  /** Nomes de quem está no bloco mas é de fora da área resumida (só no tipo "area"). */
  extras: string[];
  /** Todos os nomes do bloco, em ordem alfabética: é o que abre ao tocar no resumo. */
  nomes: string[];
};

/** Acima disto o show tem Livro próprio e vira resumo; até aqui a lista cabe e o papel precisa lê-la. */
export const LIMITE_POSICOES_SHOW_PEQUENO = 12;
/** Fração das pessoas do dia (ou da área) a partir da qual vale o resumo. */
export const FRACAO_DO_RESUMO = 0.8;
/** Resumir 2 pessoas como "elenco todo" ou "a área" confunde; abaixo disto lista os nomes. */
export const MINIMO_PARA_RESUMIR = 3;
/** Área com mais gente de fora que isto já não é "a área e mais alguém": lista os nomes. */
const MAXIMO_DE_FORA = 3;

const ordem = (a: string, b: string) => a.localeCompare(b, "pt-BR");
const emLista = (nomes: string[]) => nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
// Compara em inteiros (n * 10 >= total * 8): 80% exato não pode cair por erro de ponto flutuante.
const temFracao = (parte: number, total: number) => total > 0 && parte * 10 >= total * FRACAO_DO_RESUMO * 10;

/**
 * @param pessoaIds   quem está no bloco
 * @param doDia       as pessoas que trabalham no dia (sem folga, recesso, afastamento nem no show), com a área
 * @param posicoes    nº de posições do Livro do Dia quando o bloco é um show (`vagas.length`); 0 nos demais
 */
export function resumirQuem(pessoaIds: string[], doDia: PessoaDoDia[], posicoes = 0): ResumoDeQuem {
  const porId = new Map(doDia.map((p) => [p.id, p]));
  const ids = [...new Set(pessoaIds)];
  // Quem foi chamado na folga não está em `doDia`, mas está no bloco: o nome entra mesmo assim (cai em "de fora").
  const nomes = ids.map((id) => porId.get(id)?.name ?? id).sort(ordem);
  if (!ids.length) return { tipo: "lista", rotulo: "", extras: [], nomes };

  if (posicoes > LIMITE_POSICOES_SHOW_PEQUENO) {
    return { tipo: "show-grande", rotulo: `Elenco do show: ${ids.length === 1 ? "1 pessoa" : `${ids.length} pessoas`}`, extras: [], nomes };
  }

  const doBloco = ids.map((id) => porId.get(id)).filter((p): p is PessoaDoDia => Boolean(p));
  if (doBloco.length >= MINIMO_PARA_RESUMIR && temFracao(doBloco.length, doDia.length)) {
    return { tipo: "todos", rotulo: "Elenco do dia", extras: [], nomes };
  }

  const contagem = new Map<string, { nome: string; noDia: number; noBloco: number }>();
  for (const p of doDia) if (p.areaId) { const c = contagem.get(p.areaId) ?? { nome: p.areaName ?? "Área", noDia: 0, noBloco: 0 }; c.noDia += 1; contagem.set(p.areaId, c); }
  for (const p of doBloco) if (p.areaId) contagem.get(p.areaId)!.noBloco += 1;
  const candidatas = [...contagem.entries()]
    .filter(([, c]) => c.noBloco >= MINIMO_PARA_RESUMIR && temFracao(c.noBloco, c.noDia))
    .sort((a, b) => b[1].noBloco - a[1].noBloco || ordem(a[1].nome, b[1].nome));
  const melhor = candidatas[0];
  if (melhor) {
    const [areaId, c] = melhor;
    const extras = ids.filter((id) => porId.get(id)?.areaId !== areaId).map((id) => porId.get(id)?.name ?? id).sort(ordem);
    if (extras.length <= MAXIMO_DE_FORA) {
      return { tipo: "area", rotulo: extras.length ? `${c.nome} e ${emLista(extras)}` : c.nome, extras, nomes };
    }
  }

  return { tipo: "lista", rotulo: "", extras: [], nomes };
}

/**
 * O resumo de um BLOCO. Quando a Programação convoca o elenco todo ou uma área, a frase é essa (nunca a lista de nomes), mesmo que alguém tenha saído
 * por ter outra atividade no mesmo horário (decisão de 27/10/2026: "Acrobacia: elenco todo" e "Patinadores", não 21 nomes). Os nomes continuam em "ver nomes".
 * Os demais blocos seguem a conta de sempre (`resumirQuem`).
 */
export function resumoDoBloco(b: { quemRegra?: "todos" | "area"; areaNomes?: string[] }, pessoaIds: string[], doDia: PessoaDoDia[], posicoes = 0): ResumoDeQuem {
  const base = resumirQuem(pessoaIds, doDia, posicoes);
  if (posicoes > LIMITE_POSICOES_SHOW_PEQUENO || !b.quemRegra) return base;
  const n = base.nomes.length;
  if (b.quemRegra === "todos") return { ...base, tipo: "todos", rotulo: "Elenco do dia", extras: [] };
  const nome = b.areaNomes?.length ? emLista(b.areaNomes) : "";
  return nome ? { ...base, tipo: "area", rotulo: nome, extras: [] } : base;
}

/**
 * Posições numeradas ("Guardião 1" … "Guardião 8") saem em ordem de número, na Escala e na folha. Só reordena quando TODAS terminam em número: show com
 * nomes de personagem (YETI, IGNO, ASTRID…) segue na ordem do Livro do Dia.
 */
export function emOrdemDeNumero<T>(itens: T[], rotuloDe: (item: T) => string): T[] {
  const partes = itens.map((item) => /^(.*?)(\d+)\s*$/.exec(rotuloDe(item).trim()));
  if (itens.length < 2 || partes.some((m) => !m)) return itens;
  return itens.map((item, i) => ({ item, i, prefixo: partes[i]![1]!.trim(), n: Number(partes[i]![2]) }))
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, "pt-BR") || a.n - b.n || a.i - b.i)
    .map((x) => x.item);
}
