/**
 * Janela do Mural (decisão de 14/10/2026): só o mês atual e o seguinte. O que foi publicado antes do
 * início do mês atual sai do feed (continua no Registro), exceto aviso que pede ciente e que a
 * pessoa ainda não deu. Aviso cuja data de evento cai neste mês ou no próximo fica, mesmo publicado
 * antes; evento depois do mês que vem ainda não aparece.
 * Tudo em horário de São Paulo (UTC−3, sem horário de verão).
 */
const pad = (n: number) => String(n).padStart(2, "0");

export function hojeSaoPaulo(now = new Date()) {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

function somaMeses(y: number, m: number, meses: number) {
  const indice = y * 12 + (m - 1) + meses;
  return { y: Math.floor(indice / 12), m: (indice % 12) + 1 };
}

export function janelaDoMural(now = new Date()) {
  const { y, m } = hojeSaoPaulo(now);
  const depois = somaMeses(y, m, 2);
  return {
    /** Primeiro instante do mês atual. */
    inicio: new Date(`${y}-${pad(m)}-01T00:00:00-03:00`),
    inicioYmd: `${y}-${pad(m)}-01`,
    /** Primeiro dia do mês DEPOIS do que vem (exclusivo): evento nessa data ou depois ainda não entra. */
    fimYmd: `${depois.y}-${pad(depois.m)}-01`,
  };
}

export type DataEspecial = { id: string; nome: string; mensagem: string | null; mes: number; dia: number };

/** Datas especiais (que se repetem todo ano) de hoje até `dias` dias à frente. */
export function proximasDatas(datas: DataEspecial[], now = new Date(), dias = 7) {
  const hoje = hojeSaoPaulo(now);
  const base = Date.UTC(hoje.y, hoje.m - 1, hoje.d);
  const saida: { id: string; nome: string; mensagem: string | null; dia: string; emDias: number }[] = [];
  for (const data of datas) {
    for (const ano of [hoje.y, hoje.y + 1]) {
      const emDias = Math.round((Date.UTC(ano, data.mes - 1, data.dia) - base) / 86_400_000);
      if (emDias < 0 || emDias > dias) continue;
      saida.push({ id: data.id, nome: data.nome, mensagem: data.mensagem, dia: `${pad(data.dia)}/${pad(data.mes)}`, emDias });
      break;
    }
  }
  return saida.sort((a, b) => a.emDias - b.emDias || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O dia existe no mês? 29/02 vale (ano bissexto). */
export function diaValido(mes: number, dia: number) {
  return Number.isInteger(mes) && Number.isInteger(dia) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= new Date(Date.UTC(2024, mes, 0)).getUTCDate();
}
