import { Link } from "wouter";
import { css } from "@/lib/dc-style";
import type { Bloco } from "@/pages/escalas";
import { QuemResumido } from "./quem-resumido";
import { LIMITE_POSICOES_SHOW_PEQUENO, resumirQuem, type PessoaDoDia } from "./resumo-de-quem";
import "./escala-tokens.css";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/**
 * Quem faz um show, na visão "Por atividade".
 * Show grande (mais de 12 posições no Livro do Dia): "Elenco do show: 21 pessoas"; ao tocar abre os nomes e o atalho para o Livro do Dia
 * (só o show grande tem esse atalho: cena e posição moram lá). Show pequeno lista "personagem: pessoa" à vista, sem tocar
 * (o papel e o olho rápido precisam ler). Show sem posições cadastradas cai no resumo comum (elenco todo, área ou nomes).
 */
export function ShowLinha({ bloco, data, nomeDe, pessoasDoDia }: { bloco: Bloco; data: string; nomeDe: (pessoaId: string) => string; pessoasDoDia: PessoaDoDia[] }) {
  const livro = bloco.dailyBookId;
  if (!livro) return <span style={css("font-size:12px;color:var(--asa-vaga-fg);font-weight:700")}>{bloco.sinal ?? "Livro do Dia deste show ainda não gerado"}</span>;
  const vagas = bloco.vagas ?? [];
  const resumo = resumirQuem(bloco.pessoaIds, pessoasDoDia, vagas.length);
  const semNinguem = vagas.filter((v) => !v.userId).length;

  if (resumo.tipo === "show-grande") {
    return <details className="ge-show" style={css("font-size:12.5px;color:var(--asa-ink-medium);min-width:0")}>
      <summary style={css("cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;min-height:44px")}>
        <strong style={css("color:var(--asa-ink-dark)")}>{resumo.rotulo}</strong>
        {semNinguem > 0 && <span style={css("color:var(--esc-choque);font-weight:700")}>{plural(semNinguem, "vaga sem ninguém", "vagas sem ninguém")}</span>}
        <span style={css("color:var(--asa-purple);font-weight:700")}>ver quem</span>
      </summary>
      <div style={css("display:flex;flex-direction:column;gap:8px;padding:2px 0 8px")}>
        <div style={css("display:flex;flex-wrap:wrap;gap:5px")}>{resumo.nomes.map((nome, i) => <span key={`${nome}-${i}`} className="ge-pilula">{nome}</span>)}</div>
        <Link href={`/livro-do-dia?data=${data}&livro=${livro}`} style={css("align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;color:var(--asa-purple);text-decoration:none")}>Abrir o Livro do Dia →</Link>
      </div>
    </details>;
  }

  if (vagas.length > 0 && vagas.length <= LIMITE_POSICOES_SHOW_PEQUENO) {
    const comVaga = new Set(vagas.map((v) => v.userId).filter((id): id is string => Boolean(id)));
    const semVaga = [...new Set(bloco.pessoaIds)].filter((id) => !comVaga.has(id)).map(nomeDe).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return <ul style={css("margin:0;padding:4px 0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--asa-ink-medium);min-width:0")}>
      {vagas.map((v) => <li key={v.assignmentId} style={css("display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline")}>
        <span style={css("color:var(--asa-label);overflow-wrap:anywhere")}>{v.personagem}:</span>
        {v.userId ? <strong style={css("color:var(--asa-ink-dark)")}>{nomeDe(v.userId)}</strong> : <strong style={css("color:var(--esc-choque)")}>vaga sem ninguém</strong>}
      </li>)}
      {semVaga.length > 0 && <li style={css("color:var(--asa-ink-medium)")}>{semVaga.join(" · ")}</li>}
    </ul>;
  }

  // Sem posições cadastradas: nada a destacar além de quem é (elenco todo, uma área ou a lista de nomes).
  if (resumo.tipo === "lista") return <div style={css("display:flex;flex-wrap:wrap;gap:5px")}>{resumo.nomes.length ? resumo.nomes.map((nome, i) => <span key={`${nome}-${i}`} className="ge-pilula">{nome}</span>) : <span style={css("font-size:12px;color:var(--asa-label)")}>ninguém convocado</span>}</div>;
  return <QuemResumido resumo={resumo}/>;
}
