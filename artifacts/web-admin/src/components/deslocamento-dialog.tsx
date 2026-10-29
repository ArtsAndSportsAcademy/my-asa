import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./virada-do-dia.css";
import "./deslocamento-dialog.css";

type Par = { locationAId: string; locationBId: string; minutos: number };
type Tela = { locais: { id: string; name: string }[]; pares: Par[]; versao: string | null; podeEditar: boolean };

const MAXIMO = 720;
const chaveDoPar = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
const valoresDe = (pares: Par[]) => Object.fromEntries(pares.map((p) => [chaveDoPar(p.locationAId, p.locationBId), String(p.minutos)]));
const fraseDoServidor = (err: unknown) => {
  if (!(err instanceof ApiError)) return "Não consegui salvar agora, e nada foi alterado. Confira a conexão e tente de novo.";
  const dados = err.data as { message?: unknown } | null;
  return typeof dados?.message === "string" && dados.message ? dados.message : "Não consegui salvar agora. Nada foi alterado; tente de novo.";
};

/**
 * Quantos minutos leva de um local a outro. A Escala usa para avisar quando uma pessoa sai de um local e não chega a tempo ao outro, e o Livro do
 * Dia usa para não escalar quem não chega ao show. Só a Administração grava; a Direção e a Supervisão leem.
 */
export function DeslocamentoDialog({ locais, review, onClose }: { locais: { id: string; name: string }[]; review: boolean; onClose: () => void }) {
  const [tela, setTela] = useState<Tela | null>(review ? { locais, pares: [], versao: null, podeEditar: true } : null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(!review);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const id = useId();
  useFecharComEsc(() => { if (!saving) onClose(); });

  useEffect(() => {
    if (review) return;
    let vivo = true;
    customFetch<Tela>("/api/locations/deslocamento")
      .then((r) => { if (vivo) { setTela(r); setValores(valoresDe(r.pares)); } })
      .catch((err) => { if (vivo) setErro(fraseDoServidor(err).replace("Não consegui salvar agora", "Não consegui abrir agora")); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [review]);

  const pares = useMemo(() => {
    const lista = tela?.locais ?? [];
    const saida: { chave: string; a: { id: string; name: string }; b: { id: string; name: string } }[] = [];
    for (let i = 0; i < lista.length; i += 1) for (let j = i + 1; j < lista.length; j += 1) saida.push({ chave: chaveDoPar(lista[i]!.id, lista[j]!.id), a: lista[i]!, b: lista[j]! });
    return saida;
  }, [tela]);
  const guardados = useMemo(() => valoresDe(tela?.pares ?? []), [tela]);
  const podeEditar = tela?.podeEditar === true;
  const invalido = (texto: string | undefined) => texto !== undefined && texto.trim() !== "" && (!/^\d+$/.test(texto.trim()) || Number(texto) > MAXIMO);
  const algumInvalido = pares.some((p) => invalido(valores[p.chave]));
  const mudou = pares.some((p) => (valores[p.chave] ?? "").trim() !== (guardados[p.chave] ?? ""));

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !tela || algumInvalido || !mudou) return;
    const novos: Par[] = pares.filter((p) => (valores[p.chave] ?? "").trim() !== "").map((p) => ({ locationAId: p.a.id, locationBId: p.b.id, minutos: Number(valores[p.chave]) }));
    setSaving(true); setErro("");
    try {
      if (!review) await customFetch(`/api/locations/deslocamento`, { method: "PUT", body: JSON.stringify({ baseVersao: tela.versao, pares: novos }) });
      onClose();
    } catch (err) {
      setErro(fraseDoServidor(err));
      // Outra pessoa salvou antes: mostra o que está valendo agora, sem perder a frase do motivo.
      const atual = err instanceof ApiError && err.status === 409 ? (err.data as Partial<Tela> | null) : null;
      if (atual?.pares) { setTela((t) => t ? { ...t, pares: atual.pares!, versao: atual.versao ?? null } : t); setValores(valoresDe(atual.pares)); }
    } finally { setSaving(false); }
  };

  return <div className="cad-dialog-backdrop vd-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
    <section className="cad-dialog vd-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} onMouseDown={(e) => e.stopPropagation()}>
      <button className="cad-dialog-close" type="button" aria-label="Fechar" onClick={() => { if (!saving) onClose(); }}><X size={20}/></button>
      <h2 id={`${id}-titulo`}>Tempo de ida entre locais</h2>
      <form className="cad-form vd-form" onSubmit={(e) => void salvar(e)} noValidate>
        <p className="vd-explica">Quantos minutos leva para ir de um local ao outro. Quando alguém sai de um local e a folga até a próxima atividade, no outro, é menor que isso, a Escala avisa. No Livro do Dia, quem não chega a tempo ao show não é escalada, e a reserva entra. Deixe em branco os locais em que a ida não importa.</p>
        {carregando && <p className="vd-nota" aria-live="polite">Abrindo…</p>}
        {!carregando && tela && pares.length === 0 && <p className="vd-exemplo">Só existe um local ativo. Quando houver dois ou mais, os pares aparecem aqui.</p>}
        {pares.length > 0 && <ul className="dl-lista">
          {pares.map((p) => <li key={p.chave} className="dl-par">
            <label htmlFor={`${id}-${p.chave}`}><span>{p.a.name}</span> <span aria-hidden="true">↔</span> <span>{p.b.name}</span></label>
            <span className="dl-campo">
              <input id={`${id}-${p.chave}`} inputMode="numeric" pattern="[0-9]*" placeholder="sem tempo" disabled={!podeEditar || saving} value={valores[p.chave] ?? ""} aria-invalid={invalido(valores[p.chave]) || undefined}
                onChange={(e) => { setValores((v) => ({ ...v, [p.chave]: e.target.value })); setErro(""); }}/>
              <span>min</span>
            </span>
            {invalido(valores[p.chave]) && <small className="dl-erro" role="alert">{`De 0 a ${MAXIMO} minutos, só números.`}</small>}
          </li>)}
        </ul>}
        {tela && !podeEditar && <p className="vd-nota">Quem escreve o tempo de ida é a Administração. Aqui você só lê.</p>}
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <footer className="vd-rodape">
          <span className="vd-espaco"/>
          <button type="button" onClick={onClose} disabled={saving}>{podeEditar ? "Cancelar" : "Fechar"}</button>
          {podeEditar && <button type="submit" className="cad-primary" disabled={saving || algumInvalido || !mudou}>{saving ? "Salvando…" : "Salvar"}</button>}
        </footer>
      </form>
    </section>
  </div>;
}
