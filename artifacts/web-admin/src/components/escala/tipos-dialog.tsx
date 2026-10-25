import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import { CORES, nomeDaCor, toneDoTipo, type TipoDoLocal } from "./tipos";
import "./escala-tokens.css";

/**
 * Tipos de atividade do local (só a Administração). Cada tipo dá o nome e a cor das atividades na Escala. Arquivar tira o tipo da lista de
 * escolha sem apagar nada: o que já usa o tipo continua pintado, e dá para desarquivar. As cores vêm de uma lista fixa de 15, sempre com o
 * nome do tipo escrito junto (a cor sozinha não basta para ler).
 */
export function TiposDialog({ locationId, locationName, onClose, onChanged }: { locationId: string; locationName: string; onClose: () => void; onChanged: () => void }) {
  useFecharComEsc(onClose);
  const [tipos, setTipos] = useState<TipoDoLocal[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  // `id: null` = tipo novo. O formulário só vale quando a pessoa confirma em "Salvar".
  const [editando, setEditando] = useState<{ id: string | null; nome: string; cor: string } | null>(null);

  const carregar = useCallback(async () => {
    try { setTipos((await customFetch<{ tipos: TipoDoLocal[] }>(`/api/escalas/tipos?locationId=${locationId}`)).tipos); }
    catch (e) { setErro(mensagemDoErro(e, "Não consegui carregar os tipos de atividade.")); setTipos((atual) => atual ?? []); }
  }, [locationId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (chave: string, acao: () => Promise<{ tipos: TipoDoLocal[] }>, falha: string) => {
    setOcupado(chave); setErro("");
    try { const r = await acao(); setTipos(r.tipos); onChanged(); return true; }
    catch (e) { setErro(mensagemDoErro(e, falha)); return false; }
    finally { setOcupado(""); }
  };

  const criarProntos = () => executar("prontos", () => customFetch(`/api/escalas/tipos`, { method: "POST", body: JSON.stringify({ locationId, padrao: true }) }), "Não consegui criar os tipos prontos.");
  const salvar = async () => {
    if (!editando) return;
    const nome = editando.nome.trim();
    if (nome.length < 2) { setErro("O nome do tipo precisa ter de 2 a 40 letras."); return; }
    const ok = await executar("salvar", () => editando.id
      ? customFetch(`/api/escalas/tipos/${editando.id}`, { method: "PATCH", body: JSON.stringify({ nome, cor: editando.cor }) })
      : customFetch(`/api/escalas/tipos`, { method: "POST", body: JSON.stringify({ locationId, nome, cor: editando.cor }) }), "Não consegui salvar o tipo.");
    if (ok) setEditando(null);
  };
  const arquivar = (t: TipoDoLocal, active: boolean) => executar(`arq:${t.id}`, () => customFetch(`/api/escalas/tipos/${t.id}`, { method: "PATCH", body: JSON.stringify({ active }) }), active ? "Não consegui desarquivar o tipo." : "Não consegui arquivar o tipo.");

  const ativos = (tipos ?? []).filter((t) => t.active), arquivados = (tipos ?? []).filter((t) => !t.active);
  const etiqueta = (t: { nome: string; cor: string }) => <span className="ge-tipo-etiqueta" style={{ background: toneDoTipo(t.cor).bg, color: toneDoTipo(t.cor).fg, borderColor: toneDoTipo(t.cor).bd }}>{t.nome}</span>;

  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Tipos de atividade">
    <header className="shows-dialog-header"><div><h2>Tipos de atividade</h2><p>{locationName}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content ge-tipos">
      <p style={css("margin:0;font-size:12.5px;line-height:1.5;color:var(--asa-ink-muted)")}>Cada tipo dá o nome e a cor das atividades na Escala. Arquivar tira o tipo da lista de escolha, mas não apaga nada: o que já usa o tipo continua pintado, e dá para desarquivar.</p>
      {erro && !editando && <p role="alert" style={css("margin:0;font-size:12.5px;font-weight:700;color:var(--asa-error-fg)")}>{erro}</p>}
      {tipos === null && <p role="status" style={css("margin:0;font-size:12.5px;color:var(--asa-label)")}>Carregando os tipos…</p>}
      {tipos !== null && !tipos.length && <div className="ge-tipos-vazio">
        <p style={css("margin:0 0 8px;font-size:12.5px;line-height:1.5;color:var(--asa-ink-medium)")}>Este local ainda não tem lista de tipos. Enquanto isso, a Escala usa os sete de fábrica e adivinha pelo nome da atividade.</p>
        <button type="button" className="shows-primary" disabled={ocupado === "prontos"} onClick={() => void criarProntos()}>{ocupado === "prontos" ? "Criando…" : "Criar os 7 tipos prontos"}</button>
      </div>}
      {ativos.length > 0 && <ul className="ge-tipos-lista" aria-label="Tipos em uso">
        {ativos.map((t) => <li key={t.id}>
          {etiqueta(t)}
          <span className="ge-tipos-cor">{nomeDaCor(t.cor)}</span>
          <span className="ge-tipos-acoes">
            <button type="button" className="shows-secondary" onClick={() => { setErro(""); setEditando({ id: t.id, nome: t.nome, cor: t.cor }); }}>Editar</button>
            <button type="button" className="shows-secondary" disabled={ocupado === `arq:${t.id}`} onClick={() => void arquivar(t, false)}>{ocupado === `arq:${t.id}` ? "Arquivando…" : "Arquivar"}</button>
          </span>
        </li>)}
      </ul>}
      {tipos !== null && tipos.length > 0 && !editando && <button type="button" className="shows-secondary" style={{ alignSelf: "flex-start" }} onClick={() => { setErro(""); setEditando({ id: null, nome: "", cor: "coral" }); }}>+ Novo tipo</button>}

      {editando && <form className="ge-tipos-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }} aria-label={editando.id ? "Editar tipo" : "Novo tipo"}>
        <h3>{editando.id ? "Editar tipo" : "Novo tipo"}</h3>
        <label>Nome do tipo<input value={editando.nome} maxLength={40} required autoFocus onChange={(e) => setEditando({ ...editando, nome: e.target.value })} placeholder="Ensaio aberto"/></label>
        <fieldset className="ge-cores">
          <legend>Cor</legend>
          <div role="radiogroup" aria-label="Cor do tipo">
            {CORES.map((c) => { const tom = toneDoTipo(c.key); const on = editando.cor === c.key; return <button key={c.key} type="button" role="radio" aria-checked={on} className="ge-cor" data-on={on} onClick={() => setEditando({ ...editando, cor: c.key })}>
              <i style={{ background: tom.bg, borderColor: tom.bd }} aria-hidden="true">{on ? "✓" : ""}</i><span>{c.label}</span>
            </button>; })}
          </div>
        </fieldset>
        {erro && <p role="alert" style={css("margin:0;font-size:12.5px;font-weight:700;color:var(--asa-error-fg)")}>{erro}</p>}
        <div className="ge-tipos-previa" aria-live="polite"><span>Como fica na Escala:</span>{etiqueta({ nome: editando.nome.trim() || "Nome do tipo", cor: editando.cor })}</div>
        <div className="ge-tipos-form-rodape">
          <button type="button" className="shows-secondary" onClick={() => { setEditando(null); setErro(""); }}>Cancelar</button>
          <button type="submit" className="shows-primary" disabled={ocupado === "salvar"}>{ocupado === "salvar" ? "Salvando…" : editando.id ? "Salvar tipo" : "Criar tipo"}</button>
        </div>
      </form>}

      {arquivados.length > 0 && <details className="ge-tipos-arquivados">
        <summary>{`${arquivados.length} ${arquivados.length === 1 ? "tipo arquivado" : "tipos arquivados"}`}</summary>
        <ul className="ge-tipos-lista" aria-label="Tipos arquivados">
          {arquivados.map((t) => <li key={t.id}>
            {etiqueta(t)}
            <span className="ge-tipos-cor">arquivado</span>
            <span className="ge-tipos-acoes"><button type="button" className="shows-secondary" disabled={ocupado === `arq:${t.id}`} onClick={() => void arquivar(t, true)}>{ocupado === `arq:${t.id}` ? "Desarquivando…" : "Desarquivar"}</button></span>
          </li>)}
        </ul>
      </details>}
    </div>
    <footer className="shows-dialog-footer"><button type="button" className="shows-primary" onClick={onClose}>Fechar</button></footer>
  </div></div>;
}
