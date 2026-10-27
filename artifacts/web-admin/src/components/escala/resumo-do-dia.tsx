import type { Bloco, Pessoa } from "@/pages/escalas";
import { ehExcecao, nomesCurtos, quandoDoDia } from "./tipos";
import "./escala-tokens.css";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

export type ResumoDoDiaProps = {
  /** Dia mostrado (AAAA-MM-DD): o texto diz "hoje", "amanhã" ou "neste dia" conforme o caso. */
  data: string;
  pessoas: Pessoa[];
  blocos: Bloco[];
  blocosDe: (pessoaId: string) => Bloco[];
  pessoasComChoque: number;
  motivoDaFolga: (pessoa: Pessoa) => string;
  soExcecoes: boolean;
  onSoExcecoes: (ligado: boolean) => void;
  onIrParaAtencao: () => void;
};

/** Quem entra na grade: quem trabalha no dia, mais quem foi chamado de propósito na folga. */
export const trabalhaNoDia = (p: Pessoa, blocosDe: (id: string) => Bloco[]) => !p.folga || Boolean(p.chamadaNaFolga && blocosDe(p.id).length);

export function ResumoDoDia({ data, pessoas, blocos, blocosDe, pessoasComChoque, motivoDaFolga, soExcecoes, onSoExcecoes, onIrParaAtencao }: ResumoDoDiaProps) {
  const quando = quandoDoDia(data);
  const trabalham = pessoas.filter((p) => trabalhaNoDia(p, blocosDe));
  const fora = pessoas.filter((p) => !trabalhaNoDia(p, blocosDe));
  const semAtividade = trabalham.filter((p) => blocosDe(p.id).length === 0);
  const comExcecao = trabalham.filter((p) => blocosDe(p.id).some(ehExcecao));
  const semNinguem = blocos.filter((b) => b.regra !== "ninguem" && (b.vazio || b.vagas?.some((v) => !v.userId))).length;

  return <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div className="ge-resumo" role="group" aria-label="Resumo do dia">
      <div className="ge-num" data-tom="ok" style={{ cursor: "default" }}><b>{trabalham.length - semAtividade.length}</b>escaladas</div>
      <button type="button" className="ge-num" data-tom={pessoasComChoque ? "mal" : undefined} onClick={onIrParaAtencao} disabled={!pessoasComChoque} aria-label={`${plural(pessoasComChoque, "pessoa com choque", "pessoas com choque")}${pessoasComChoque ? ", ver" : ""}`}><b>{pessoasComChoque}</b>{pessoasComChoque === 1 ? "choque" : "choques"}</button>
      <button type="button" className="ge-num" data-tom={semNinguem ? "atencao" : undefined} onClick={onIrParaAtencao} disabled={!semNinguem}><b>{semNinguem}</b>{semNinguem === 1 ? "bloco com lugar sem ninguém" : "blocos com lugar sem ninguém"}</button>
      <button type="button" className="ge-num" data-tom={comExcecao.length ? "atencao" : undefined} aria-pressed={soExcecoes} disabled={!soExcecoes && !comExcecao.length && !pessoasComChoque} onClick={() => onSoExcecoes(!soExcecoes)} title="Mostrar só as exceções e os choques"><b>{comExcecao.length}</b>{soExcecoes ? "com exceção · só elas na grade" : "com exceção"}</button>
      <div className="ge-num" style={{ cursor: "default" }}><b>{semAtividade.length}</b>sem atividade</div>
    </div>
    <details className="ge-fora">
      <summary>
        <strong>{`Não trabalham ${quando} (${fora.length})`}</strong>
        {fora.length > 0 && <span>{fora.slice(0, 3).map(nomesCurtos(pessoas)).join(", ")}{fora.length > 3 ? ` e mais ${fora.length - 3}` : ""}</span>}
        <span style={{ color: "var(--asa-purple)", fontWeight: 700 }}>{fora.length ? "ver todos" : ""}</span>
      </summary>
      {fora.length > 0 && <div className="ge-fora-lista">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{fora.map((p) => <span key={p.id} className="ge-pilula" title={motivoDaFolga(p)}>{p.name}{p.areaName ? ` · ${p.areaName}` : ""}</span>)}</div>
        <span style={{ fontSize: 12, color: "var(--asa-label)" }}>Folga vence a escala: quem está aqui só entra se for chamado de propósito, com motivo escrito.</span>
      </div>}
    </details>
    {semAtividade.length > 0 && <details className="ge-fora">
      <summary><strong>{`Sem atividade ${quando} (${semAtividade.length})`}</strong><span style={{ color: "var(--asa-purple)", fontWeight: 700 }}>ver quem</span></summary>
      <div className="ge-fora-lista"><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{semAtividade.map((p) => <span key={p.id} className="ge-pilula">{p.name}{p.areaName ? ` · ${p.areaName}` : ""}</span>)}</div></div>
    </details>}
  </div>;
}
