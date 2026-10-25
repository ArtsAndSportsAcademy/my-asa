import { Link } from "wouter";
import { css } from "@/lib/dc-style";
import type { Bloco } from "@/pages/escalas";
import "./escala-tokens.css";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/**
 * Quem faz um show, na visão "Por atividade": uma linha só ("30 convocados"), igual para todo tipo de show, e o detalhe abre ao tocar.
 * Show só de personagens mostra "personagem → pessoa"; os outros mostram só os nomes dos convocados, em ordem alfabética.
 * Cena e posição ficam no Livro do Dia, que é um toque dali.
 */
export function ShowLinha({ bloco, data, nomeDe }: { bloco: Bloco; data: string; nomeDe: (pessoaId: string) => string }) {
  const livro = bloco.dailyBookId;
  if (!livro) return <span style={css("font-size:12px;color:var(--asa-vaga-fg);font-weight:700")}>{bloco.sinal ?? "Livro do Dia deste show ainda não gerado"}</span>;
  const convocados = [...new Set(bloco.pessoaIds)].map((id) => ({ id, nome: nomeDe(id) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const vagas = bloco.vagas ?? [];
  const semNinguem = vagas.filter((v) => !v.userId).length;
  const porPersonagem = bloco.showTipo === "CHARACTERS_ONLY" && vagas.length > 0;
  return <details className="ge-show" style={css("font-size:12.5px;color:var(--asa-ink-medium);min-width:0")}>
    <summary style={css("cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;min-height:44px")}>
      <strong style={css("color:var(--asa-ink-dark)")}>{plural(convocados.length, "convocado", "convocados")}</strong>
      {semNinguem > 0 && <span style={css("color:var(--esc-choque);font-weight:700")}>{plural(semNinguem, "vaga sem ninguém", "vagas sem ninguém")}</span>}
      <span style={css("color:var(--asa-purple);font-weight:700")}>ver quem</span>
    </summary>
    <div style={css("display:flex;flex-direction:column;gap:8px;padding:2px 0 8px")}>
      {porPersonagem
        ? <ul style={css("margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px")}>
          {vagas.map((v) => <li key={v.assignmentId} style={css("display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline")}>
            <span style={css("min-width:120px;color:var(--asa-label)")}>{v.personagem}</span>
            <span aria-hidden="true">→</span>
            {v.userId ? <strong style={css("color:var(--asa-ink-dark)")}>{nomeDe(v.userId)}</strong> : <strong style={css("color:var(--esc-choque)")}>sem ninguém</strong>}
          </li>)}
        </ul>
        : <div style={css("display:flex;flex-wrap:wrap;gap:5px")}>{convocados.map((c) => <span key={c.id} className="ge-pilula">{c.nome}</span>)}</div>}
      <Link href={`/livro-do-dia?data=${data}&livro=${livro}`} style={css("align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;color:var(--asa-purple);text-decoration:none")}>Abrir o Livro do Dia →</Link>
    </div>
  </details>;
}
