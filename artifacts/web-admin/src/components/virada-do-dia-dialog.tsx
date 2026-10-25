import { type FormEvent, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { VIRADA_PADRAO, type ViradaDoDia, exemploDaVirada, frasePadrao, fraseDaViradaInvalida } from "@/lib/dia-da-escala";
import "./virada-do-dia.css";

const fraseDoServidor = (err: unknown) => {
  if (!(err instanceof ApiError)) return "Não consegui salvar agora, e nada foi alterado. Confira a conexão e tente de novo.";
  const dados = err.data as { message?: unknown } | null;
  return typeof dados?.message === "string" && dados.message ? dados.message : "Não consegui salvar agora. Nada foi alterado; tente de novo.";
};

/** "Qual dia a Escala mostra ao abrir": as duas horas de um local. Só a Administração abre esta janela. */
export function ViradaDoDiaDialog({ local, review, onClose, onSaved }: { local: { id: string; name: string; viradaDoDia?: ViradaDoDia }; review: boolean; onClose: () => void; onSaved: (virada: ViradaDoDia) => void }) {
  const atual = local.viradaDoDia ?? VIRADA_PADRAO;
  const [abre, setAbre] = useState(atual.abreAmanhaAPartirDe);
  const [volta, setVolta] = useState(atual.voltaAHojeAPartirDe);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const id = useId();
  useFecharComEsc(() => { if (!saving) onClose(); });
  const hoje = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
  const invalida = fraseDaViradaInvalida(abre, volta);
  const mudou = abre !== atual.abreAmanhaAPartirDe || volta !== atual.voltaAHojeAPartirDe;
  const jaEPadrao = atual.abreAmanhaAPartirDe === VIRADA_PADRAO.abreAmanhaAPartirDe && atual.voltaAHojeAPartirDe === VIRADA_PADRAO.voltaAHojeAPartirDe;

  const gravar = async (body: Record<string, unknown>, depois: ViradaDoDia) => {
    setSaving(true); setErro("");
    try {
      if (!review) await customFetch(`/api/locations/${local.id}/virada-do-dia`, { method: "PUT", body: JSON.stringify(body) });
      onSaved(depois);
      onClose();
    } catch (err) { setErro(fraseDoServidor(err)); } finally { setSaving(false); }
  };
  const salvar = (event: FormEvent) => {
    event.preventDefault();
    if (saving || invalida || !mudou) return;
    void gravar({ abreAmanhaAPartirDe: abre, voltaAHojeAPartirDe: volta }, { abreAmanhaAPartirDe: abre, voltaAHojeAPartirDe: volta });
  };

  return <div className="cad-dialog-backdrop vd-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
    <section className="cad-dialog vd-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} onMouseDown={(e) => e.stopPropagation()}>
      <button className="cad-dialog-close" type="button" aria-label="Fechar" onClick={() => { if (!saving) onClose(); }}><X size={20}/></button>
      <h2 id={`${id}-titulo`}>Qual dia a Escala mostra ao abrir</h2>
      <p className="vd-local">{local.name}</p>
      <form className="cad-form vd-form" onSubmit={salvar} noValidate>
        <p className="vd-explica">A escala de um dia costuma ser feita na noite anterior. Aqui você escolhe a partir de que hora a Escala deixa de abrir em hoje e passa a abrir no dia seguinte, e a que hora ela volta a abrir em hoje.</p>
        <div className="vd-frase">
          <label htmlFor={`${id}-abre`}>A partir das</label>
          <span className="vd-hora"><input id={`${id}-abre`} type="time" required value={abre} onChange={(e) => { setAbre(e.target.value); setErro(""); }} aria-describedby={`${id}-exemplo`}/>,</span>
          <span>a Escala abre no <b>dia seguinte</b>.</span>
        </div>
        <div className="vd-frase">
          <label htmlFor={`${id}-volta`}>A partir das</label>
          <span className="vd-hora"><input id={`${id}-volta`} type="time" required value={volta} onChange={(e) => { setVolta(e.target.value); setErro(""); }} aria-describedby={`${id}-exemplo`}/>,</span>
          <span>a Escala volta a abrir em <b>hoje</b>.</span>
        </div>
        {invalida
          ? <p className="vd-exemplo vd-aviso-erro" role="alert">{invalida}</p>
          : <p className="vd-exemplo" id={`${id}-exemplo`} aria-live="polite"><b>Exemplo.</b> {exemploDaVirada({ abreAmanhaAPartirDe: abre, voltaAHojeAPartirDe: volta }, hoje)}</p>}
        <p className="vd-nota">Isso só muda o dia em que a tela abre. Quem quiser ver outro dia usa Hoje, Amanhã ou o calendário.</p>
        <p className="vd-nota">Hoje, neste local: {frasePadrao(atual)}.</p>
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <footer className="vd-rodape">
          <button type="button" className="vd-padrao" disabled={saving || jaEPadrao} onClick={() => void gravar({ padrao: true }, VIRADA_PADRAO)}>{`Voltar ao padrão (${VIRADA_PADRAO.abreAmanhaAPartirDe} e ${VIRADA_PADRAO.voltaAHojeAPartirDe})`}</button>
          <span className="vd-espaco"/>
          <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="cad-primary" disabled={saving || Boolean(invalida) || !mudou}>{saving ? "Salvando…" : "Salvar"}</button>
        </footer>
      </form>
    </section>
  </div>;
}
