import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./escala-tokens.css";

type LivroDaPrevia = { dailyBookId: string; rotulo: string; inicio: string | null; status: string; version: number; vagasMexidas: number; refaz: boolean; motivoDeNao?: string };
type Previa = { publicada: boolean; escalaExiste: boolean; livros: LivroDaPrevia[] };
type Resultado = { dailyBookId: string; rotulo: string; ok: boolean; frase?: string };

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const fraseDe = (err: unknown, padrao: string) => err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : padrao;
const nomeDoLivro = (l: { rotulo: string; inicio: string | null }) => `${l.rotulo}${l.inicio ? ` das ${l.inicio}` : ""}`;

/**
 * "Refazer os Livros deste dia" (menu Mais da Escala): refaz do zero os Livros do Dia em rascunho deste local e data, pela mesma rota do botão
 * "Refazer este dia do zero" do Livro do Dia. Antes de gravar mostra quais shows serão refeitos, quais ficam como estão (e por quê) e quantas
 * trocas feitas à mão se perdem. Em fila, um Livro por vez: se um falhar, a janela diz qual e por quê, e os outros seguem.
 * O motivo é opcional. Dia publicado: avisa que depois é preciso republicar.
 */
export function RefazerDiaDialog({ localId, localNome, date, dataCurta, onClose, onTerminou }: {
  localId: string; localNome: string; date: string; dataCurta: string;
  onClose: () => void;
  /** A janela terminou de refazer (mesmo que em parte): a tela relê o dia. */
  onTerminou: () => void;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fazendo, setFazendo] = useState<{ feitos: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<Resultado[] | null>(null);
  const [avisoRegistro, setAvisoRegistro] = useState("");
  useFecharComEsc(() => { if (!fazendo) onClose(); });

  useEffect(() => {
    let cancelado = false;
    customFetch<Previa>(`/api/escalas/dia/refazer?locationId=${encodeURIComponent(localId)}&date=${date}`)
      .then((p) => { if (!cancelado) setPrevia(p); })
      .catch((e) => { if (!cancelado) setErro(fraseDe(e, "Não consegui montar a lista dos Livros. Nada foi alterado; tente de novo.")); });
    return () => { cancelado = true; };
  }, [localId, date]);

  const aRefazer = previa?.livros.filter((l) => l.refaz) ?? [];
  const deFora = previa?.livros.filter((l) => !l.refaz) ?? [];
  const perdem = aRefazer.reduce((n, l) => n + l.vagasMexidas, 0);

  const refazer = async () => {
    if (fazendo || !aRefazer.length) return;
    setErro(""); setFazendo({ feitos: 0, total: aRefazer.length });
    const feitos: Resultado[] = [];
    for (const l of aRefazer) {
      try {
        await customFetch(`/api/daily-book/${l.dailyBookId}/regenerate`, { method: "POST", body: JSON.stringify({ reason: motivo.trim() || undefined, expectedVersion: l.version }) });
        feitos.push({ dailyBookId: l.dailyBookId, rotulo: nomeDoLivro(l), ok: true });
      } catch (e) {
        feitos.push({ dailyBookId: l.dailyBookId, rotulo: nomeDoLivro(l), ok: false, frase: fraseDe(e, "Não consegui refazer este Livro. Ele ficou como estava; tente de novo.") });
      }
      setFazendo({ feitos: feitos.length, total: aRefazer.length });
    }
    // Um evento só no Registro da Escala por acontecimento (com o motivo); se ele falhar, a janela diz, porque os Livros já foram refeitos.
    const certos = feitos.filter((f) => f.ok);
    if (certos.length) {
      try { await customFetch("/api/escalas/dia/refazer/registrar", { method: "POST", body: JSON.stringify({ locationId: localId, date, livros: certos.map((f) => f.dailyBookId), ...(motivo.trim() ? { motivo: motivo.trim() } : {}) }) }); }
      catch (e) { setAvisoRegistro(fraseDe(e, "Os Livros foram refeitos, mas não consegui gravar o Registro da Escala.")); }
    }
    setFazendo(null); setResultado(feitos); onTerminou();
  };

  const campo = "width:100%;box-sizing:border-box;min-height:64px;border:1px solid var(--asa-line-soft);border-radius:10px;padding:8px 12px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark);resize:vertical";
  const certos = resultado?.filter((r) => r.ok).length ?? 0;
  const falhas = resultado?.filter((r) => !r.ok) ?? [];

  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Refazer os Livros deste dia">
    <header className="shows-dialog-header"><div><h2>Refazer os Livros deste dia</h2><p>{`${localNome} · ${dataCurta}`}</p></div><button type="button" onClick={onClose} disabled={Boolean(fazendo)} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!previa && !erro && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--asa-label)" }}>Conferindo os Livros do dia…</p>}
      {erro && <p role="alert" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ausente-fg)" }}>{erro}</p>}
      {previa && !resultado && <>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-muted)" }}>Cada Livro em rascunho é montado de novo a partir do Livro do Show e da Escala. Mudou um titular, uma regra ou a ordem das cenas e não apareceu no dia? É isso que resolve. Para só trazer cenas e posições novas sem perder nada, use "Trazer as novidades" dentro do Livro.</p>
        {previa.publicada && <p role="status" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-amber-dark)", background: "var(--asa-amber-pale)", border: "1px solid var(--asa-amber-stripe)", borderRadius: 11, padding: "9px 12px" }}>Este dia já foi publicado. O Elenco segue vendo a versão publicada; depois de refazer, a Administração precisa republicar.</p>}
        {!aRefazer.length && <p role="status" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-medium)" }}>{previa.livros.length ? "Nenhum Livro deste dia está em rascunho, então não há o que refazer." : "Este dia ainda não tem Livro do Dia. Gere a Escala e os Livros primeiro."}</p>}
        {aRefazer.length > 0 && <section aria-label="Livros que serão refeitos" style={{ border: "1px solid var(--asa-lavender)", background: "var(--asa-purple-dawn)", borderRadius: 11, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-dark)" }}>
          <strong>{`Serão refeitos (${aRefazer.length})`}</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{aRefazer.map((l) => <li key={l.dailyBookId}>{nomeDoLivro(l)}{l.vagasMexidas > 0 ? ` · ${plural(l.vagasMexidas, "troca feita à mão se perde", "trocas feitas à mão se perdem")}` : ""}</li>)}</ul>
          {perdem > 0 && <div style={{ marginTop: 6, color: "var(--esc-choque)", fontWeight: 700 }}>{`${plural(perdem, "vaga mexida à mão volta", "vagas mexidas à mão voltam")} ao que o app calcula.`}</div>}
        </section>}
        {deFora.length > 0 && <section aria-label="Livros que ficam como estão" style={{ border: "1px solid var(--asa-line-soft)", borderRadius: 11, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-medium)" }}>
          <strong>{`Ficam como estão (${deFora.length})`}</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{deFora.map((l) => <li key={l.dailyBookId}>{`${nomeDoLivro(l)}: ${l.motivoDeNao ?? "não se refaz."}`}</li>)}</ul>
        </section>}
        {aRefazer.length > 0 && <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--asa-label)" }}>Por quê? (opcional, fica no Registro)
          <textarea rows={2} maxLength={300} value={motivo} disabled={Boolean(fazendo)} onChange={(e) => setMotivo(e.target.value)} placeholder="Troquei o titular no Livro do Show" style={css(campo)}/>
        </label>}
      </>}
      {resultado && <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-dark)" }}>
        {certos > 0 && <p style={{ margin: 0, color: "var(--asa-ok-fg)", fontWeight: 700 }}>{`${plural(certos, "Livro refeito", "Livros refeitos")}.${previa?.publicada ? " Falta a Administração republicar o dia." : ""}`}</p>}
        {avisoRegistro && <p role="alert" style={{ margin: 0, color: "var(--asa-ausente-fg)" }}>{avisoRegistro}</p>}
        {falhas.map((f) => <p key={f.dailyBookId} role="alert" style={{ margin: 0, color: "var(--asa-ausente-fg)" }}>{`${f.rotulo}: ${f.frase}`}</p>)}
      </div>}
    </div>
    <footer className="shows-dialog-footer">
      {!resultado
        ? <>
          <button type="button" onClick={onClose} className="shows-secondary" disabled={Boolean(fazendo)}>Cancelar</button>
          <button type="button" className="shows-primary" disabled={Boolean(fazendo) || !aRefazer.length} onClick={() => void refazer()}>{fazendo ? `Refazendo ${Math.min(fazendo.feitos + 1, fazendo.total)} de ${fazendo.total}…` : aRefazer.length === 1 ? "Refazer 1 Livro" : aRefazer.length > 1 ? `Refazer ${aRefazer.length} Livros` : "Refazer"}</button>
        </>
        : <button type="button" className="shows-primary" onClick={onClose}>Fechar</button>}
    </footer>
  </div></div>;
}
