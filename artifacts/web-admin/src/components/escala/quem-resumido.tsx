import { css } from "@/lib/dc-style";
import type { ResumoDeQuem } from "./resumo-de-quem";
import "./escala-tokens.css";

/** "Elenco todo (28)" ou "Bailarinos e Bel": a frase curta, e ao tocar abre os nomes de todo mundo do bloco. */
export function QuemResumido({ resumo }: { resumo: ResumoDeQuem }) {
  const n = resumo.nomes.length;
  return <details className="ge-show" style={css("font-size:14px;color:var(--asa-ink-medium);min-width:0")}>
    <summary style={css("cursor:pointer;list-style:none;display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 8px;min-height:44px;font-weight:700")}>
      <span style={css("border:1px solid var(--asa-line);background:var(--asa-fade);border-radius:999px;padding:4px 12px;overflow-wrap:anywhere")}>{resumo.rotulo}</span>
      {resumo.tipo === "area" && <span style={css("font-weight:600;color:var(--asa-label)")}>{n === 1 ? "1 pessoa" : `${n} pessoas`}</span>}
      <span style={css("color:var(--asa-purple)")}>ver nomes</span>
    </summary>
    <div style={css("display:flex;flex-wrap:wrap;gap:5px;padding:4px 0 8px")}>{resumo.nomes.map((nome, i) => <span key={`${nome}-${i}`} className="ge-pilula">{nome}</span>)}</div>
  </details>;
}
