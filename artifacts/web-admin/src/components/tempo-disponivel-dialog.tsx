import { type FormEvent, useId, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./virada-do-dia.css";
import "./tempo-disponivel-dialog.css";

export type TempoDisponivelDoLocal = { ligado: boolean; minutos: number };
export const TEMPO_DISPONIVEL_PADRAO: TempoDisponivelDoLocal = { ligado: true, minutos: 30 };
const MINIMO = 5, MAXIMO = 240;

/** A frase curta que o cartão do local mostra para quem lê. */
export const fraseDoTempoDisponivel = (t: TempoDisponivelDoLocal) => (t.ligado ? `Avisa quem fica ${t.minutos} min ou mais livre` : "O aviso de tempo disponível está desligado");

const fraseDoServidor = (err: unknown) => {
  if (!(err instanceof ApiError)) return "Não consegui salvar agora, e nada foi alterado. Confira a conexão e tente de novo.";
  const dados = err.data as { message?: unknown } | null;
  return typeof dados?.message === "string" && dados.message ? dados.message : "Não consegui salvar agora. Nada foi alterado; tente de novo.";
};

/** "Tempo disponível" de um local: liga ou desliga o aviso da Atenção do dia e escolhe a partir de quantos minutos livres ele vale. Só a Administração abre. */
export function TempoDisponivelDialog({ local, review, onClose, onSaved }: { local: { id: string; name: string; tempoDisponivel?: TempoDisponivelDoLocal }; review: boolean; onClose: () => void; onSaved: (valor: TempoDisponivelDoLocal) => void }) {
  const atual = local.tempoDisponivel ?? TEMPO_DISPONIVEL_PADRAO;
  const [ligado, setLigado] = useState(atual.ligado);
  const [minutos, setMinutos] = useState(String(atual.minutos));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const id = useId();
  useFecharComEsc(() => { if (!saving) onClose(); });
  const numero = minutos.trim() === "" ? NaN : Number(minutos);
  const invalida = !Number.isInteger(numero) || numero < MINIMO || numero > MAXIMO
    ? `Escreva os minutos como um número inteiro, de ${MINIMO} a ${MAXIMO} (o padrão é ${TEMPO_DISPONIVEL_PADRAO.minutos}).` : "";
  const mudou = ligado !== atual.ligado || numero !== atual.minutos;
  const jaEPadrao = atual.ligado === TEMPO_DISPONIVEL_PADRAO.ligado && atual.minutos === TEMPO_DISPONIVEL_PADRAO.minutos;

  const gravar = async (valor: TempoDisponivelDoLocal) => {
    setSaving(true); setErro("");
    try {
      if (!review) await customFetch(`/api/locations/${local.id}/tempo-disponivel`, { method: "PUT", body: JSON.stringify(valor) });
      onSaved(valor);
      onClose();
    } catch (err) { setErro(fraseDoServidor(err)); } finally { setSaving(false); }
  };
  const salvar = (event: FormEvent) => {
    event.preventDefault();
    if (saving || invalida || !mudou) return;
    void gravar({ ligado, minutos: numero });
  };

  return <div className="cad-dialog-backdrop vd-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
    <section className="cad-dialog vd-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} onMouseDown={(e) => e.stopPropagation()}>
      <button className="cad-dialog-close" type="button" aria-label="Fechar" onClick={() => { if (!saving) onClose(); }}><X size={20}/></button>
      <h2 id={`${id}-titulo`}>Tempo disponível</h2>
      <p className="vd-local">{local.name}</p>
      <form className="cad-form vd-form" onSubmit={salvar} noValidate>
        <p className="vd-explica">Na Atenção do dia, a Escala avisa a Administração e a Supervisão quando alguém fica um tempo sem nada entre duas atividades do mesmo dia. A Direção e o Elenco não veem esse aviso.</p>
        <label className="td-liga" htmlFor={`${id}-liga`}>
          <input id={`${id}-liga`} type="checkbox" checked={ligado} onChange={(e) => { setLigado(e.target.checked); setErro(""); }}/>
          <span>Avisar quando alguém ficar livre neste local</span>
        </label>
        <div className="vd-frase">
          <label htmlFor={`${id}-minutos`}>A partir de</label>
          <span className="vd-hora"><input id={`${id}-minutos`} className="td-minutos" type="number" inputMode="numeric" min={MINIMO} max={MAXIMO} step={5} disabled={!ligado} value={minutos} onChange={(e) => { setMinutos(e.target.value); setErro(""); }} aria-describedby={`${id}-nota`}/></span>
          <span>minutos livres entre duas atividades.</span>
        </div>
        {ligado && invalida && <p className="vd-exemplo vd-aviso-erro" role="alert">{invalida}</p>}
        <p className="vd-nota" id={`${id}-nota`}>Contam como ocupados: a janela de almoço inteira, a ida entre locais (o tempo de ida de Locais é descontado) e a chamada que ocupa tempo. Não entram quem está de folga, sem local hoje ou na equipe de outro local. Buraco de 3 horas ou mais vai para uma linha à parte, "Dia dividido".</p>
        <p className="vd-nota">Hoje, neste local: {fraseDoTempoDisponivel(atual)}.</p>
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <footer className="vd-rodape">
          <button type="button" className="vd-padrao" disabled={saving || jaEPadrao} onClick={() => void gravar(TEMPO_DISPONIVEL_PADRAO)}>{`Voltar ao padrão (ligado, ${TEMPO_DISPONIVEL_PADRAO.minutos} min)`}</button>
          <span className="vd-espaco"/>
          <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="cad-primary" disabled={saving || (ligado && Boolean(invalida)) || !mudou}>{saving ? "Salvando…" : "Salvar"}</button>
        </footer>
      </form>
    </section>
  </div>;
}
