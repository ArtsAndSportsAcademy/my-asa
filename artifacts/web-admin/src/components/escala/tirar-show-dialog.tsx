import { useState } from "react";
import { X } from "lucide-react";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./escala-tokens.css";

/**
 * "Tirar este show do dia": o show normal não vai acontecer neste dia (entrou outro no lugar). O motivo é opcional, nunca obrigatório.
 * Devolve a frase do servidor quando não deu, ou null quando deu — a janela fica aberta e mostra a frase, com o rodapé à vista.
 */
export function TirarShowDialog({ rotulo, dataCurta, publicada, onClose, onConfirmar }: {
  rotulo: string; dataCurta: string;
  /** A Escala deste dia já foi publicada: a mudança espera a republicação. */
  publicada: boolean;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<string | null>;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useFecharComEsc(() => { if (!salvando) onClose(); });
  const confirmar = async () => {
    if (salvando) return;
    setSalvando(true); setErro("");
    const frase = await onConfirmar(motivo.trim());
    if (frase) { setErro(frase); setSalvando(false); }
  };
  const campo = "width:100%;box-sizing:border-box;min-height:64px;border:1px solid var(--asa-line-soft);border-radius:10px;padding:8px 12px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark);resize:vertical";

  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={`Tirar ${rotulo} do dia`}>
    <header className="shows-dialog-header"><div><h2>Tirar este show do dia</h2><p>{`${rotulo} · ${dataCurta}`}</p></div><button type="button" onClick={onClose} disabled={salvando} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-muted)" }}>O show sai da Escala só deste dia: ninguém é convocado para ele e o Livro do Dia dele deixa de valer. A Programação e o Livro do Show não mudam, e gerar o dia de novo não traz o show de volta. Dá para desfazer logo depois, e também depois, na lista "Tirado deste dia".</p>
      {publicada && <p role="status" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-amber-dark)", background: "var(--asa-amber-pale)", border: "1px solid var(--asa-amber-stripe)", borderRadius: 11, padding: "9px 12px" }}>Este dia já foi publicado. O Elenco continua vendo a versão publicada até a Administração republicar, e ela é avisada de que há o que republicar.</p>}
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--asa-label)" }}>Por quê? (opcional, fica no Registro)
        <textarea rows={2} maxLength={300} value={motivo} disabled={salvando} onChange={(e) => setMotivo(e.target.value)} placeholder="Entrou o show de Halloween no lugar" style={css(campo)}/>
      </label>
      {erro && <p role="alert" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ausente-fg)" }}>{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary" disabled={salvando}>Cancelar</button>
      <button type="button" className="shows-primary" disabled={salvando} onClick={() => void confirmar()}>{salvando ? "Tirando…" : "Tirar do dia"}</button>
    </footer>
  </div></div>;
}
