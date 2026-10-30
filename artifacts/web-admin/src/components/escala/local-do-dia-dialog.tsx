import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./escala-tokens.css";
import "./equipe-dialog.css";
import "./local-do-dia-dialog.css";

export type MudarDeLocal = { destinoId: string; origemId: string | null; inicio: string | null; fim: string | null; motivo: string };
type LocalSimples = { id: string; name: string };

const quandoDe = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/**
 * Imprevisto do dia (pacote O): "trazer o Fulano para cá hoje" (a pessoa é de outro local) ou "mandar para outro local hoje". Vale só nesta data,
 * a Programação não muda, e dá para desfazer. Horário é opcional: sem ele vale o dia inteiro.
 */
export function LocalDoDiaDialog({ modo, pessoa, data, localAtual, origem, destinos, onClose, onConfirmar }: {
  modo: "trazer" | "mandar";
  pessoa: { id: string; name: string };
  data: string;
  /** O local da tela. */
  localAtual: LocalSimples;
  /** Em "trazer": o local onde a pessoa está hoje (de onde ela vem). */
  origem?: LocalSimples | null;
  /** Em "mandar": os outros locais abertos para escolher. */
  destinos: LocalSimples[];
  onClose: () => void;
  /** Devolve a frase do servidor quando não deu, ou null quando deu. */
  onConfirmar: (v: MudarDeLocal) => Promise<string | null>;
}) {
  const id = useId();
  const [destinoId, setDestinoId] = useState(modo === "trazer" ? localAtual.id : destinos[0]?.id ?? "");
  const [inicio, setInicio] = useState(""), [fim, setFim] = useState(""), [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false), [erro, setErro] = useState("");
  useFecharComEsc(() => { if (!saving) onClose(); });
  // No celular o erro fica no fim do miolo: leva a pessoa até ele para a frase do servidor não passar despercebida.
  useEffect(() => { if (erro) document.getElementById(`${id}-erro`)?.scrollIntoView({ block: "nearest" }); }, [erro, id]);
  const fimInvalido = Boolean(inicio && fim && fim <= inicio);
  const destino = modo === "trazer" ? localAtual : destinos.find((l) => l.id === destinoId);
  const pronto = Boolean(destinoId) && !fimInvalido;
  const origemDoPedido = modo === "trazer" ? origem?.id ?? null : localAtual.id;

  const confirmar = async () => {
    if (!pronto || saving) return;
    setSaving(true); setErro("");
    const frase = await onConfirmar({ destinoId, origemId: origemDoPedido, inicio: inicio || null, fim: fim || null, motivo: motivo.trim() });
    setSaving(false);
    if (frase) setErro(frase);
  };
  const quando = inicio && fim ? `das ${inicio} às ${fim}` : inicio ? `a partir das ${inicio}` : fim ? `até as ${fim}` : "o dia inteiro";

  return <div className="shows-dialog-backdrop eq-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
    <div className="shows-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
      <header className="shows-dialog-header"><div><h2 id={`${id}-titulo`}>{modo === "trazer" ? "Trazer para cá hoje" : "Mandar para outro local hoje"}</h2><p>{pessoa.name} · {quandoDe(data)}</p></div><button type="button" onClick={onClose} aria-label="Fechar" disabled={saving}><X size={18}/></button></header>
      <div className="shows-dialog-content ld-conteudo">
        <p className="ld-explica">
          {modo === "trazer"
            ? `${pessoa.name}${origem ? ` está em ${origem.name} hoje` : " está sem local hoje"}. Ao trazer, ela passa a entrar nos blocos de todo mundo e de área de ${localAtual.name}${origem ? " e deixa os do outro local" : ""}, só nesta data.`
            : `${pessoa.name} passa o dia no local que você escolher: deixa os blocos de todo mundo e de área de ${localAtual.name} e entra nos de lá, só nesta data.`}
          {" "}A Programação não muda e dá para desfazer.
        </p>
        {modo === "mandar" && <label className="ld-campo" htmlFor={`${id}-destino`}>Para onde
          <select id={`${id}-destino`} value={destinoId} disabled={saving} onChange={(e) => { setDestinoId(e.target.value); setErro(""); }}>
            {destinos.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>}
        <div className="ld-horas">
          <label className="ld-campo" htmlFor={`${id}-inicio`}>A partir de (opcional)<input id={`${id}-inicio`} type="time" value={inicio} disabled={saving} onChange={(e) => { setInicio(e.target.value); setErro(""); }}/></label>
          <label className="ld-campo" htmlFor={`${id}-fim`}>Até (opcional)<input id={`${id}-fim`} type="time" value={fim} disabled={saving} onChange={(e) => { setFim(e.target.value); setErro(""); }}/></label>
        </div>
        <p className="ld-nota">{fimInvalido ? <span className="ld-erro" role="alert">O fim precisa ser depois do início.</span> : `Vale ${quando}. Sem horário, vale o dia inteiro; com horário, só nesse período (quem é trazida às 15h não entra no almoço das 12h).`}</p>
        <label className="ld-campo" htmlFor={`${id}-motivo`}>Motivo (opcional)
          <textarea id={`${id}-motivo`} rows={2} maxLength={300} value={motivo} disabled={saving} placeholder="Ex.: faltou gente no treino" onChange={(e) => setMotivo(e.target.value)}/>
        </label>
        <p className="ld-nota">Entra no Registro. {modo === "trazer" && !origem ? "A Supervisão do local, ou a Administração, é avisada." : `A Supervisão de ${modo === "trazer" ? origem!.name : destino?.name ?? "do outro local"} é avisada; se não houver, o aviso vai para a Administração.`}</p>
        {erro && <p id={`${id}-erro`} className="ld-erro-geral" role="alert">{erro}</p>}
      </div>
      <footer className="shows-dialog-footer">
        <button type="button" className="shows-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className="shows-primary" disabled={!pronto || saving} onClick={() => void confirmar()}>{saving ? "Salvando…" : modo === "trazer" ? "Trazer para cá" : "Mandar"}</button>
      </footer>
    </div>
  </div>;
}
