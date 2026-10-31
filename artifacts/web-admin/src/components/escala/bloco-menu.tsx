import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "wouter";
import type { Bloco, Pessoa } from "@/pages/escalas";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { faixa, resolverTipo, textoDoBloco, type TipoDoLocal } from "./tipos";
import "./escala-tokens.css";

export type BlocoMenuProps = {
  bloco: Bloco;
  pessoa: Pessoa;
  ancora: DOMRect;
  data: string;
  temChoque: boolean;
  excecao: boolean;
  /** Tipos de atividade do local (dão o nome do tipo do bloco). */
  tipos?: TipoDoLocal[];
  /** Quem pode mexer: a Administração em qualquer área, a Supervisão só na área dela. */
  pode: boolean;
  /** Frase da recusa (diz quem pode); vazia quando pode. */
  motivoSemPoder: string;
  ocupado: boolean;
  onFechar: () => void;
  onTirar: () => void;
  onMudarHorario: () => void;
  onAjustar: () => void;
  /** Só aparece quando a tela sabe tirar a pessoa do resto do dia. */
  onSaiu?: () => void;
  /** Só em bloco de show, para quem gere o local: o show não acontece neste dia. */
  onTirarShow?: () => void;
};

/** Menu junto do bloco tocado. No celular sobe de baixo, sempre com "Fechar" à vista. */
export function BlocoMenu({ bloco, pessoa, ancora, data, temChoque, excecao, tipos, pode, motivoSemPoder, ocupado, onFechar, onTirar, onMudarHorario, onAjustar, onSaiu, onTirarShow }: BlocoMenuProps) {
  useFecharComEsc(onFechar);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => { raiz.current?.querySelector<HTMLElement>("button:not([disabled]),a")?.focus(); }, []);
  const ehShow = bloco.regra === "livro" || Boolean(bloco.dailyBookId);
  const larguraDaTela = typeof window !== "undefined" ? window.innerWidth : 1200;
  const alturaDaTela = typeof window !== "undefined" ? window.innerHeight : 800;
  const esquerda = Math.max(8, Math.min(ancora.left, larguraDaTela - 336));
  const abreParaCima = ancora.bottom + 320 > alturaDaTela && ancora.top > 320;
  const posicao: CSSProperties = abreParaCima ? { left: esquerda, bottom: alturaDaTela - ancora.top + 6 } : { left: esquerda, top: Math.min(ancora.bottom + 6, Math.max(8, alturaDaTela - 330)) };
  const hrefLivro = `/livro-do-dia?data=${data}${bloco.dailyBookId ? `&livro=${bloco.dailyBookId}` : ""}`;

  return <>
    <button type="button" className="ge-menu-fundo" tabIndex={-1} aria-label="Fechar o menu" onClick={onFechar}/>
    <div ref={raiz} className="ge-menu" role="menu" aria-label={`Ações de ${textoDoBloco(bloco)} para ${pessoa.name}`} style={posicao}>
      <div className="ge-menu-topo">
        <b>{`${pessoa.name} · ${textoDoBloco(bloco)}`}</b>
        {`${faixa(bloco)} · ${resolverTipo(bloco, tipos).nome}`}
        {temChoque && <span style={{ display: "block", color: "var(--esc-choque)", fontWeight: 700 }}>Choque de horário com outra atividade dela</span>}
        {excecao && <span style={{ display: "block", color: "var(--esc-excecao)", fontWeight: 700 }}>Exceção ao padrão do dia</span>}
      </div>
      {bloco.chamada
        ? <p style={{ margin: 0, padding: "4px 12px 8px", fontSize: 12, lineHeight: 1.5, color: "var(--asa-ink-muted)" }}>{`${bloco.chamada.ocupaTempo ? "Esta chamada ocupa o tempo de quem a recebe." : "Esta chamada só informa a hora; não ocupa tempo."} Ela acompanha ${bloco.chamada.atividade.rotulo}: quem faz a atividade recebe a chamada. Para mudar a hora ou o nome, use "Chamadas" na própria atividade (no show, na Programação ou na atividade do dia).`}</p>
        : ehShow
        ? <>
          <Link href={hrefLivro} role="menuitem">Abrir o Livro do Dia<small>É lá que se vê e se muda quem faz cada posição</small></Link>
          <button type="button" role="menuitem" disabled>Mudar o horário só desta pessoa<small>Show não muda de horário. Para tirar a pessoa do show, use o Livro.</small></button>
          {onTirarShow && <button type="button" role="menuitem" disabled={ocupado} onClick={onTirarShow}>Tirar este show do dia<small>O show não acontece hoje. Com Desfazer.</small></button>}
        </>
        : pode
          ? <>
            <button type="button" role="menuitem" disabled={ocupado} onClick={onTirar}>{`Tirar ${pessoa.name.split(" ")[0]} de ${textoDoBloco(bloco)}`}<small>Só esta pessoa. Dá para desfazer logo depois.</small></button>
            <button type="button" role="menuitem" disabled={ocupado} onClick={onMudarHorario}>Mudar o horário só desta pessoa<small>Exceção só dela, com motivo. Vale só para este dia.</small></button>
            <button type="button" role="menuitem" disabled={ocupado} onClick={onAjustar}>Mudar quem faz esta atividade<small>Colocar ou tirar outras pessoas deste bloco.</small></button>
          </>
          : <p style={{ margin: 0, padding: "4px 12px 8px", fontSize: 12, lineHeight: 1.5, color: "var(--asa-ink-muted)" }}>{motivoSemPoder}</p>}
      {pode && onSaiu && <>
        <hr/>
        <button type="button" role="menuitem" disabled={ocupado} onClick={onSaiu}>{`${pessoa.name.split(" ")[0]} saiu ou não vem a partir de…`}<small>Doença, emergência: tira dela o resto do dia, com prévia.</small></button>
      </>}
      <hr/>
      <button type="button" role="menuitem" onClick={onFechar} style={{ alignItems: "center", color: "var(--asa-label)" }}>Fechar</button>
    </div>
  </>;
}
