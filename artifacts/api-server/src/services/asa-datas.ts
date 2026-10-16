/**
 * Leitor de datas em português para a ASA, sem modelo de linguagem: entende os jeitos comuns de a pessoa falar
 * e devolve datas ISO (AAAA-MM-DD). Quando a data não tem ano, vale a próxima que vem (nunca uma data no passado).
 *
 * Entende: 20/11, 20/11/2026, "20 de novembro", "dia 20", "nos dias 20, 21 e 25", "hoje", "amanhã", "depois de amanhã",
 * dias da semana ("sexta", "próxima segunda", "segunda-feira"), e períodos: "de 20/11 a 24/11", "do dia 20 ao 24",
 * "de 20 a 24 de novembro", "20 a 24/11", "de segunda a quarta".
 */
export type DatasLidas = { kind: "ok"; datas: string[] } | { kind: "nenhuma" } | { kind: "invalida"; trecho: string };

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};
const SEMANA: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
export const LIMITE_DE_DIAS_LIDOS = 62;

function semAcento(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}
const iso = (data: Date) => data.toISOString().slice(0, 10);
const somar = (base: string, dias: number) => { const d = new Date(`${base}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return iso(d); };
function existe(ano: number, mes: number, dia: number) {
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}
/** A próxima vez que dia/mês acontece, a partir de hoje (inclusive). */
function proximaOcorrencia(hoje: string, mes: number, dia: number): string | null {
  const ano = Number(hoje.slice(0, 4));
  for (const candidato of [ano, ano + 1, ano + 2]) if (existe(candidato, mes, dia) && `${candidato}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}` >= hoje) return `${candidato}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return null;
}
/** "dia 20" sem mês: este mês se ainda não passou, senão o mês que vem. */
function diaSemMes(hoje: string, dia: number): string | null {
  const [ano, mes] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  for (let passo = 0; passo < 13; passo++) {
    const total = mes - 1 + passo, a = ano + Math.floor(total / 12), m = (total % 12) + 1;
    const candidato = `${a}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (existe(a, m, dia) && candidato >= hoje) return candidato;
  }
  return null;
}
function diaDaSemana(hoje: string, alvo: number, proxima: boolean): string {
  const atual = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  let falta = (alvo - atual + 7) % 7;
  if (falta === 0 && proxima) falta = 7;
  return somar(hoje, falta);
}
function intervalo(inicio: string, fim: string): string[] | null {
  if (fim < inicio) return null;
  const dias: string[] = [];
  for (let d = inicio; d <= fim && dias.length <= LIMITE_DE_DIAS_LIDOS; d = somar(d, 1)) dias.push(d);
  return dias;
}

export function lerDatasEmPortugues(texto: string, hoje: string): DatasLidas {
  let t = ` ${semAcento(texto)} `;
  const colhidas = new Set<string>();
  const nomesDosMeses = Object.keys(MESES).sort((a, b) => b.length - a.length).join("|");
  const nomesDaSemana = "domingo|segunda|terca|quarta|quinta|sexta|sabado";
  let invalida: string | null = null;
  const tomar = (regex: RegExp, fn: (m: RegExpMatchArray) => string[] | null) => {
    t = t.replace(regex, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray;
      const dias = fn(m);
      if (!dias) { invalida ??= String(m[0]).trim(); return " "; }
      for (const dia of dias) colhidas.add(dia);
      return " ";
    });
  };
  const dataCompleta = (d: string, m: string, a?: string) => {
    const dia = Number(d), mes = Number(m);
    if (a) { const ano = a.length === 2 ? 2000 + Number(a) : Number(a); return existe(ano, mes, dia) ? `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}` : null; }
    return proximaOcorrencia(hoje, mes, dia);
  };
  const DMA = String.raw`(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?`;
  const sep = String.raw`\s+(?:a|ate|ao|ate o|ate a|ao dia|ate o dia|ate dia|a partir do dia)\s+`;
  // 1) períodos
  tomar(new RegExp(String.raw`\b(?:de|do dia|do|da)\s+(?:dia\s+)?${DMA}${sep}(?:dia\s+)?${DMA}`, "g"), (m) => {
    const a = dataCompleta(m[1]!, m[2]!, m[3]), b = dataCompleta(m[4]!, m[5]!, m[6]);
    return a && b ? intervalo(a, b) : null;
  });
  tomar(new RegExp(String.raw`\b(?:de|do dia|do|da)?\s*(?:dia\s+)?(\d{1,2})${sep}(?:dia\s+)?(\d{1,2})\s+de\s+(${nomesDosMeses})(?:\s+de\s+(\d{4}))?`, "g"), (m) => {
    const mes = MESES[m[3]!]!, a = dataCompleta(m[1]!, String(mes), m[4]), b = dataCompleta(m[2]!, String(mes), m[4]);
    return a && b ? intervalo(a, b) : null;
  });
  tomar(new RegExp(String.raw`\b(?:de|do dia|do|da)?\s*(?:dia\s+)?(\d{1,2})${sep}(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?`, "g"), (m) => {
    const a = dataCompleta(m[1]!, m[3]!, m[4]), b = dataCompleta(m[2]!, m[3]!, m[4]);
    return a && b ? intervalo(a, b) : null;
  });
  tomar(new RegExp(String.raw`\b(?:de|do dia|do|da)\s+(?:dia\s+)?(\d{1,2})${sep}(?:dia\s+)?(\d{1,2})\b`, "g"), (m) => {
    const a = diaSemMes(hoje, Number(m[1])); if (!a) return null;
    const b = diaSemMes(a, Number(m[2])); return b ? intervalo(a, b) : null;
  });
  tomar(new RegExp(String.raw`\b(?:de|da)\s+(${nomesDaSemana})(?:-feira)?${sep}(${nomesDaSemana})(?:-feira)?`, "g"), (m) => {
    const a = diaDaSemana(hoje, SEMANA[m[1]!]!, false); const b = diaDaSemana(a, SEMANA[m[2]!]!, false);
    return intervalo(a, b);
  });
  // 2) datas soltas
  tomar(new RegExp(String.raw`\b(\d{1,2})\s+de\s+(${nomesDosMeses})(?:\s+de\s+(\d{4}))?`, "g"), (m) => { const d = dataCompleta(m[1]!, String(MESES[m[2]!]!), m[3]); return d ? [d] : null; });
  tomar(new RegExp(String.raw`\b${DMA}`, "g"), (m) => { const d = dataCompleta(m[1]!, m[2]!, m[3]); return d ? [d] : null; });
  // 3) "dia 20", "dias 20, 21 e 25"
  tomar(/\bdias?\s+((?:\d{1,2})(?:\s*(?:,|e|ou)\s*(?:dia\s+)?\d{1,2})*)/g, (m) => {
    const dias: string[] = [];
    for (const n of String(m[1]).match(/\d{1,2}/g) ?? []) { const d = diaSemMes(hoje, Number(n)); if (!d) return null; dias.push(d); }
    return dias;
  });
  // 4) relativas e dias da semana
  tomar(/\bdepois de amanha\b/g, () => [somar(hoje, 2)]);
  tomar(/\bamanha\b/g, () => [somar(hoje, 1)]);
  tomar(/\bhoje\b/g, () => [hoje]);
  tomar(new RegExp(String.raw`\b(?:(proxima|que vem|essa|esta|nesta|nessa)\s+)?(${nomesDaSemana})(?:-feira)?(?:\s+(que vem|proxima))?\b`, "g"), (m) => {
    const proxima = Boolean(m[1] === "proxima" || m[3]);
    return [diaDaSemana(hoje, SEMANA[m[2]!]!, proxima)];
  });
  if (invalida) return { kind: "invalida", trecho: invalida };
  if (!colhidas.size) return { kind: "nenhuma" };
  return { kind: "ok", datas: [...colhidas].sort() };
}
