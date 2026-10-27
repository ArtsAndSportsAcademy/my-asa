import { useState } from "react";
import { X } from "lucide-react";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import type { Bloco } from "@/pages/escalas";
import { faixa, type TipoDoLocal } from "./tipos";
import { TipoSelect } from "./tipo-select";
import "./escala-tokens.css";

export type EdicaoDaAtividade = { rotulo: string; inicio: string; fim: string | null; tipoId: string | null; motivo?: string };

/**
 * Editar a atividade só neste dia: o nome, o horário (para todos) e o tipo/cor mudam só na Escala desta data; a Programação não muda.
 * Quando a atividade já foi editada, o que vale como "normal" é o que a Programação manda (`editadoNoDia.original`), e dá para voltar a ele.
 */
export function EditarAtividadeDialog({ bloco, tipos, publicada, onClose, onSalvar, onVoltar }: {
  bloco: Bloco; tipos: TipoDoLocal[]; publicada: boolean; onClose: () => void;
  onSalvar: (v: EdicaoDaAtividade) => Promise<string | null>;
  onVoltar: () => Promise<string | null>;
}) {
  useFecharComEsc(onClose);
  const original = bloco.editadoNoDia?.original ?? { rotulo: bloco.rotulo, inicio: bloco.inicio, fim: bloco.fim, tipoId: bloco.tipoId ?? null };
  const [rotulo, setRotulo] = useState(bloco.rotulo);
  const [inicio, setInicio] = useState(bloco.inicio);
  const [fim, setFim] = useState(bloco.fim ?? "");
  const [tipoId, setTipoId] = useState<string | null>(bloco.tipoId ?? null);
  const [motivo, setMotivo] = useState(bloco.editadoNoDia?.motivo ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const nomeCurto = rotulo.trim().length < 2;
  const fimRuim = fim !== "" && fim <= inicio;
  const fimVelho = fim === "" && Boolean(original.fim) && (original.fim as string) <= inicio;
  const invalido = nomeCurto || !inicio || fimRuim || fimVelho;
  const igualAoOriginal = rotulo.trim() === original.rotulo && inicio === original.inicio && (fim || null) === original.fim && (tipoId ?? null) === original.tipoId;
  const roda = async (acao: () => Promise<string | null>) => { setSaving(true); setErro(""); try { const frase = await acao(); if (frase) setErro(frase); } finally { setSaving(false); } };
  const campo = "width:100%;box-sizing:border-box;border:1px solid var(--asa-line-soft);border-radius:10px;padding:10px 12px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark)";
  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={`Editar ${bloco.rotulo} só neste dia`}>
    <header className="shows-dialog-header"><div><h2>Editar a atividade só neste dia</h2><p>{`${original.rotulo} · ${faixa(original)}`}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={css("display:flex;flex-direction:column;gap:12px")}>
      <p style={css("margin:0;font-size:12.5px;line-height:1.5;color:var(--asa-ink-muted)")}>Vale para todas as pessoas desta atividade, só nesta data. A Programação e os outros dias não mudam.{publicada ? " A escala deste dia já foi publicada: a Administração vai precisar republicar para o Elenco ver a mudança." : ""}</p>
      <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Nome da atividade
        <input value={rotulo} maxLength={80} onChange={(e) => setRotulo(e.target.value)} style={css(campo)}/>
      </label>
      <div style={css("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px")}>
        <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label);min-width:0")}>Começa às<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} style={css(campo + ";min-width:0")}/></label>
        <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label);min-width:0")}>Termina às<input type="time" value={fim} onChange={(e) => setFim(e.target.value)} style={css(campo + ";min-width:0")}/></label>
      </div>
      {fimRuim && <span role="alert" style={css("font-size:12px;color:var(--asa-ausente-fg)")}>O fim precisa ser depois do início.</span>}
      {fimVelho && <span role="alert" style={css("font-size:12px;color:var(--asa-ausente-fg)")}>{`O fim da Programação (${original.fim}) ficou antes do novo início. Escolha também a hora de fim.`}</span>}
      <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label);min-width:0")}>Tipo (dá a cor na Escala)
        <TipoSelect tipos={tipos} value={tipoId} onChange={setTipoId} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", border: "1px solid var(--asa-line-soft)", borderRadius: 10, padding: "10px 12px", minHeight: 44, font: "600 13px Manrope,sans-serif", color: "var(--asa-ink-dark)", background: "#fff" }}/>
      </label>
      <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Por quê? (opcional, fica no Registro)
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Gelo atrasou" style={css(campo + ";resize:vertical")}/>
      </label>
      {bloco.editadoNoDia && <div style={css("border:1px solid var(--asa-lavender);background:var(--asa-purple-dawn);border-radius:11px;padding:10px 12px;font-size:12px;line-height:1.5;color:var(--asa-ink-dark);display:flex;flex-direction:column;gap:8px;align-items:flex-start")}>
        <span>{`Esta atividade já foi editada neste dia. A Programação manda: ${original.rotulo}, ${faixa(original)}.`}</span>
        <button type="button" className="shows-secondary" disabled={saving} onClick={() => void roda(onVoltar)}>Voltar ao normal</button>
      </div>}
      {erro && <p role="alert" style={css("margin:0;font-size:12.5px;line-height:1.5;color:var(--asa-ausente-fg)")}>{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary" disabled={saving}>Cancelar</button>
      <button type="button" className="shows-primary" disabled={invalido || saving || (igualAoOriginal && !bloco.editadoNoDia)} onClick={() => void roda(() => onSalvar({ rotulo: rotulo.trim(), inicio, fim: fim || null, tipoId, motivo: motivo.trim() || undefined }))}>{saving ? "Salvando…" : "Salvar neste dia"}</button>
    </footer>
  </div></div>;
}
