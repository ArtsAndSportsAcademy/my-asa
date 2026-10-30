import { useState } from "react";
import { css } from "@/lib/dc-style";

/** Um tempo livre de uma pessoa entre duas atividades (o servidor desconta a ida entre locais). */
export type BuracoDaPessoa = {
  pessoaId: string; de: string; ate: string; minutos: number;
  antes: { rotulo: string; localId: string; localNome: string }; depois: { rotulo: string; localId: string; localNome: string };
  minutosDeIda?: number;
};
/** O tempo disponível do dia: só chega para a Administração e a Supervisão, com o aviso ligado no local. */
export type TempoDisponivel = { limite: number; avisos: BuracoDaPessoa[]; diaDividido: BuracoDaPessoa[] };

type PessoaDoCartao = { id: string; name: string; areaName: string | null };

/** Quantas linhas aparecem antes do "ver todos": os 5 maiores buracos. */
export const BURACOS_VISIVEIS = 5;

export const minutosPorExtenso = (minutos: number) => {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
};
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** "livre das 10:00 às 11:00 (1 h)" */
export const fraseDoBuraco = (b: BuracoDaPessoa) => `livre das ${b.de} às ${b.ate} (${minutosPorExtenso(b.minutos)})`;

/** "entre Treino e Aula", ou, quando a próxima atividade é em outro local, "entre Treino e Aula em Acqua (a ida de 30 min já foi descontada)". */
const contextoDoBuraco = (b: BuracoDaPessoa) => b.depois.localId === b.antes.localId
  ? `entre ${b.antes.rotulo} e ${b.depois.rotulo}`
  : `entre ${b.antes.rotulo} e ${b.depois.rotulo} em ${b.depois.localNome}${b.minutosDeIda ? ` (a ida de ${b.minutosDeIda} min já foi descontada)` : ""}`;

/** Quantas pessoas diferentes têm tempo disponível comum (fora o dia dividido): é o número do resumo da Atenção do dia. */
export const pessoasComTempoDisponivel = (t: TempoDisponivel | undefined, nomeDe: Map<string, unknown>) =>
  t ? new Set(t.avisos.filter((b) => nomeDe.has(b.pessoaId)).map((b) => b.pessoaId)).size : 0;
export const pessoasComDiaDividido = (t: TempoDisponivel | undefined, nomeDe: Map<string, unknown>) =>
  t ? new Set(t.diaDividido.filter((b) => nomeDe.has(b.pessoaId)).map((b) => b.pessoaId)).size : 0;

/**
 * Cartão "Tempo disponível" da Atenção do dia: os 5 maiores buracos comuns (do maior para o menor, com "ver todos") e, recolhida, a linha
 * "Dia dividido" (buraco de 3 horas ou mais). É um alerta: pode ser descanso de propósito, e não bloqueia nada.
 */
export function CartaoTempoDisponivel({ tempo, pessoas }: { tempo: TempoDisponivel; pessoas: PessoaDoCartao[] }) {
  const [todos, setTodos] = useState(false);
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const comuns = tempo.avisos.filter((b) => porId.has(b.pessoaId));
  const divididos = tempo.diaDividido.filter((b) => porId.has(b.pessoaId));
  if (!comuns.length && !divididos.length) return null;
  const visiveis = todos ? comuns : comuns.slice(0, BURACOS_VISIVEIS);
  const pessoasDivididas = new Set(divididos.map((b) => b.pessoaId)).size;
  const linha = (b: BuracoDaPessoa, i: number) => {
    const p = porId.get(b.pessoaId)!;
    return <li key={`${b.pessoaId}-${b.de}-${i}`} style={css("font-size:12.5px;line-height:1.5;color:var(--asa-ink-medium);border:1px solid var(--asa-line-soft);background:#faf8fe;border-radius:12px;padding:8px 11px")}>
      <strong style={css("color:var(--asa-ink-dark)")}>{p.name}</strong>{p.areaName ? <span style={css("color:var(--asa-label)")}>{` (${p.areaName})`}</span> : null}
      {` fica ${fraseDoBuraco(b)}, ${contextoDoBuraco(b)}.`}
    </li>;
  };
  return <div style={css("display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:14px;padding:11px 13px;")}>
    <div style={css("display:flex;flex-direction:column;gap:2px")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600;color:var(--asa-ink-dark)")}>Tempo disponível</span>
      <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45;text-wrap:pretty")}>{`Quem fica ${minutosPorExtenso(tempo.limite)} ou mais sem nada entre duas atividades, do maior tempo para o menor. É um alerta: pode ser descanso de propósito, e não bloqueia nada. A Administração liga, desliga e escolhe os minutos em Cadastros, Locais.`}</span>
    </div>
    {comuns.length > 0 && <ul style={css("margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px")}>{visiveis.map(linha)}</ul>}
    {comuns.length > BURACOS_VISIVEIS && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44, alignSelf: "flex-start" }} aria-expanded={todos} onClick={() => setTodos((v) => !v)}>
      {todos ? `Mostrar só os ${BURACOS_VISIVEIS} maiores` : `Ver todos (${comuns.length})`}
    </button>}
    {divididos.length > 0 && <details style={css("border:1px dashed var(--asa-line-soft);border-radius:12px;padding:4px 11px;")}>
      <summary style={css("display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;min-height:44px;font-size:12.5px;font-weight:700;color:var(--asa-ink-medium)")}>
        <span style={css("flex:1;min-width:0")}>{`Dia dividido (${plural(pessoasDivididas, "pessoa", "pessoas")})`}</span>
        <span style={css("font-size:12px;font-weight:700;color:var(--asa-label)")}>ver quem</span>
      </summary>
      <span style={css("display:block;font-size:12px;color:var(--asa-label);line-height:1.45;margin:2px 0 6px")}>Três horas ou mais entre duas atividades, como manhã e noite. Provavelmente é de propósito; fica aqui só para você saber.</span>
      <ul style={css("margin:0 0 8px;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px")}>{divididos.map(linha)}</ul>
    </details>}
  </div>;
}
