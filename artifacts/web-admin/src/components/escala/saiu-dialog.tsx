import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError } from "@workspace/api-client-react";
import type { Pessoa } from "@/pages/escalas";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./escala-tokens.css";

export type TipoDaSaida = "DOENCA" | "EMERGENCIA" | "OUTRO";
export type AtividadeDaSaida = { key: string; rotulo: string; inicio: string; fim: string | null; acao: "SAI" | "TERMINA_MAIS_CEDO" | "SAI_DO_SHOW"; novoFim?: string };
export type PreviaDaSaida = { atividades: AtividadeDaSaida[]; shows: { rotulo: string; dailyBookId: string | null; cobertura: { assignmentId: string; personagem: string; cobertoPor: string | null }[] }[]; semNinguem: number };
export type SaiuApi = {
  simular: (pessoaId: string, aPartirDe: string) => Promise<PreviaDaSaida>;
  gravar: (pessoaId: string, aPartirDe: string, motivo: string, tipo: TipoDaSaida) => Promise<{ saiuId: string }>;
  desfazer: (saiuId: string) => Promise<{ naoDevolvidas?: string[] } | void>;
};

const frase = (err: unknown, padrao: string) => (err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : padrao);
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const ROTULO_DA_ACAO: Record<AtividadeDaSaida["acao"], string> = { SAI: "sai", TERMINA_MAIS_CEDO: "termina mais cedo", SAI_DO_SHOW: "sai do show" };

/** Alguém passou mal ou precisou ir embora: tira a pessoa do resto do dia de uma vez, com prévia, motivo e desfazer. */
export function SaiuDialog({ pessoa, inicialAPartirDe, api, onClose, onFeito }: { pessoa: Pessoa; inicialAPartirDe: string; api: SaiuApi; onClose: () => void; onFeito: (saiuId: string, texto: string) => void }) {
  useFecharComEsc(onClose);
  const [aPartirDe, setAPartirDe] = useState(inicialAPartirDe);
  const [tipo, setTipo] = useState<TipoDaSaida>("DOENCA");
  const [motivo, setMotivo] = useState("");
  const [previa, setPrevia] = useState<PreviaDaSaida | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const horaCerta = HORA.test(aPartirDe);

  useEffect(() => {
    if (!horaCerta) { setPrevia(null); return; }
    let cancelado = false;
    setCarregando(true); setErro("");
    const id = window.setTimeout(() => {
      api.simular(pessoa.id, aPartirDe)
        .then((p) => { if (!cancelado) setPrevia(p); })
        .catch((e) => { if (!cancelado) { setPrevia(null); setErro(frase(e, "Não consegui montar a prévia agora. Nada foi alterado; tente de novo.")); } })
        .finally(() => { if (!cancelado) setCarregando(false); });
    }, 250);
    return () => { cancelado = true; window.clearTimeout(id); };
  }, [aPartirDe, horaCerta, pessoa.id]);

  const nada = Boolean(previa && previa.atividades.length === 0);
  const pronto = horaCerta && motivo.trim().length >= 3 && Boolean(previa) && !nada && !carregando;
  const confirmar = async () => {
    if (!pronto) return;
    setSalvando(true); setErro("");
    try {
      const r = await api.gravar(pessoa.id, aPartirDe, motivo.trim(), tipo);
      onFeito(r.saiuId, `${pessoa.name} saiu a partir das ${aPartirDe}.`);
    } catch (e) { setErro(frase(e, "Não consegui tirar a pessoa do resto do dia. Nada foi alterado; tente de novo.")); } finally { setSalvando(false); }
  };
  const campo = "width:100%;box-sizing:border-box;min-height:44px;border:1px solid var(--asa-line-soft);border-radius:10px;padding:8px 12px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark)";

  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={`${pessoa.name} saiu ou não vem`}>
    <header className="shows-dialog-header"><div><h2>Saiu ou não vem</h2><p>{pessoa.name}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-muted)" }}>Tira a pessoa de tudo a partir da hora que você escolher. Quem está em andamento termina mais cedo só para ela, e o show sai pelo Livro do Dia. Dá para desfazer logo depois.</p>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--asa-label)" }}>A partir das
        <input type="time" value={aPartirDe} onChange={(e) => setAPartirDe(e.target.value)} style={css(campo)}/>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--asa-label)" }}>O que aconteceu
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDaSaida)} style={css(campo)}>
          <option value="DOENCA">Passou mal ou ficou doente</option><option value="EMERGENCIA">Emergência</option><option value="OUTRO">Outro motivo</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--asa-label)" }}>Por quê? (fica no Registro e vai no aviso)
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Passou mal depois do treino" style={{ ...css(campo), minHeight: 64, resize: "vertical" }}/>
      </label>
      <section aria-label="Prévia do que muda" aria-live="polite" style={{ border: "1px solid var(--asa-lavender)", background: "var(--asa-purple-dawn)", borderRadius: 11, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ink-dark)" }}>
        <strong>Prévia</strong>
        {!horaCerta && <div>Escolha a hora para ver o que muda.</div>}
        {horaCerta && carregando && <div>Montando a prévia…</div>}
        {horaCerta && !carregando && previa && (nada
          ? <div>{`${pessoa.name} não tem nada a partir das ${aPartirDe}: não há o que tirar.`}</div>
          : <>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{previa.atividades.map((a) => <li key={a.key}>{`${a.rotulo} (${a.inicio}${a.fim ? `–${a.fim}` : ""}): ${ROTULO_DA_ACAO[a.acao]}${a.acao === "TERMINA_MAIS_CEDO" && a.novoFim ? ` às ${a.novoFim}` : ""}`}</li>)}</ul>
            {previa.semNinguem > 0 && <div style={{ marginTop: 6, color: "var(--esc-choque)", fontWeight: 700 }}>{`${previa.semNinguem === 1 ? "1 posição de show fica" : `${previa.semNinguem} posições de show ficam`} sem ninguém. A reserva do grupo não entra sozinha quando alguém sai no meio do dia: a Supervisão decide no Livro, pelo "Atenção do dia".`}</div>}
          </>)}
      </section>
      {erro && <p role="alert" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--asa-ausente-fg)" }}>{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary" disabled={salvando}>Cancelar</button>
      <button type="button" className="shows-primary" disabled={!pronto || salvando} onClick={() => void confirmar()}>{salvando ? "Salvando…" : "Tirar do resto do dia"}</button>
    </footer>
  </div></div>;
}
