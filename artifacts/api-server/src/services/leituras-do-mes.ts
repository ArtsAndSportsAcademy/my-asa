/**
 * Leituras que não mudam enquanto o mês está sendo gerado, lidas uma vez só.
 *
 * Gerar um dia repetia, a cada Livro do Dia, as mesmas leituras: a árvore do Livro do Show, o elenco e os nomes,
 * as sessões, a Programação, as regras do local. Nada disso muda no meio de uma geração, então a chamada de
 * `gerarMes` cria uma destas e passa adiante: a primeira leitura vai ao banco e as seguintes reaproveitam.
 *
 * A vida da instância é a de UMA chamada (a tela chama de novo a cada ~40 s e recomeça do zero), de modo que
 * uma edição feita no Show durante a geração só vale na chamada seguinte. O que MUDA durante a geração (os Livros
 * do dia já gerados, quem está em quantos shows) nunca passa por aqui: continua sendo lido a cada Livro.
 */
export class LeiturasDoMes {
  private readonly memo = new Map<string, Promise<unknown>>();

  /** Lê uma vez por `chave`; leituras simultâneas da mesma chave compartilham o mesmo pedido. Falha não fica guardada. */
  lembrar<T>(chave: string, carrega: () => Promise<T>): Promise<T> {
    const guardada = this.memo.get(chave);
    if (guardada) return guardada as Promise<T>;
    const pedido = carrega().catch((erro) => { this.memo.delete(chave); throw erro; });
    this.memo.set(chave, pedido);
    return pedido;
  }
}

/** Primeiro e último dia (YYYY-MM-DD) do mês da data. */
export function janelaDoMes(dateISO: string): { inicio: string; fim: string } {
  const [ano, mes] = dateISO.split("-").map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-${pad(ultimo)}` };
}

/** Com `leituras`, reaproveita; sem ele, lê direto (o comportamento de sempre das outras telas). */
export function lembrarOuLer<T>(leituras: LeiturasDoMes | undefined, chave: string, carrega: () => Promise<T>): Promise<T> {
  return leituras ? leituras.lembrar(chave, carrega) : carrega();
}
