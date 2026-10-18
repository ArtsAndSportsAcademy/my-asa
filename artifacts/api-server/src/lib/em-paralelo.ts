/**
 * Roda `fn` sobre os itens com no máximo `limite` ao mesmo tempo e devolve os resultados na ordem da lista.
 * O pooler do banco é compartilhado por toda a API: por isso poucas conexões por vez (3), não tudo de uma vez.
 * Se um item falhar, os que já começaram terminam, os que não começaram não começam, e o primeiro erro sobe.
 */
export const LIMITE_PARALELO = 3;

export async function emParalelo<T, R>(itens: readonly T[], fn: (item: T, indice: number) => Promise<R>, limite = LIMITE_PARALELO): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  let falha: { erro: unknown } | undefined;
  const trabalhador = async () => {
    while (!falha && proximo < itens.length) {
      const indice = proximo++;
      try { resultados[indice] = await fn(itens[indice]!, indice); } catch (erro) { falha ??= { erro }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limite), itens.length) }, trabalhador));
  if (falha) throw falha.erro;
  return resultados;
}

/** Uma consulta por chave, mesmo que vários itens em paralelo peçam a mesma (a promessa é guardada, não o valor). */
export function lembrarPorChave<K, V>(ler: (chave: K) => Promise<V>) {
  const guardadas = new Map<K, Promise<V>>();
  return (chave: K): Promise<V> => {
    let promessa = guardadas.get(chave);
    if (!promessa) { promessa = ler(chave); guardadas.set(chave, promessa); }
    return promessa;
  };
}
