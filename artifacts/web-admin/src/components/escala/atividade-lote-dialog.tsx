import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import type { Bloco, Pessoa } from "@/pages/escalas";
import { fimEmMinutos, foraDoChoque, minutosDe, textoDoBloco, type TipoDoLocal } from "./tipos";
import { TipoSelect } from "./tipo-select";
import { ChamadasLista, primeiroErro, type ChamadaRascunho } from "./chamadas-editor";
import "./escala-tokens.css";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Primeiros nomes, no máximo quatro: o resto vira "e mais N" (a lista completa já está marcada na janela). */
const nomes = (lista: Pessoa[]) => lista.slice(0, 4).map((p) => p.name.split(" ")[0]).join(", ") + (lista.length > 4 ? ` e mais ${lista.length - 4}` : "");

export type AtividadeLoteProps = {
  pessoas: Pessoa[];
  areas: { id: string; name: string }[];
  blocos: Bloco[];
  /** Áreas que a pessoa que mexe supervisiona; null quando é a Administração. Serve só para avisar que mexer em outra área fica visível. */
  areasQueSupervisiona: string[] | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (v: { pessoaIds: string[]; rotulo: string; inicio: string; fim: string; tipoId: string | null; chamadasNovas?: ChamadaRascunho[] }) => Promise<void>;
  /** Tipos de atividade do local: o tipo escolhido dá a cor da atividade na Escala (sem escolha, a tela adivinha pelo nome). */
  tipos: TipoDoLocal[];
};

/** Uma atividade que só existe neste dia, para várias pessoas de uma vez: marcar por área, ou pessoa por pessoa, e conferir a prévia antes de gravar. */
export function AtividadeLoteDialog({ tipos, pessoas, areas, blocos, areasQueSupervisiona, saving, onClose, onSubmit }: AtividadeLoteProps) {
  useFecharComEsc(onClose);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState("");
  const [chamadasNovas, setChamadasNovas] = useState<ChamadaRascunho[]>([]);

  const trabalham = useMemo(() => pessoas.filter((p) => !p.folga), [pessoas]);
  const deFolga = pessoas.filter((p) => p.folga);
  const filtradas = trabalham.filter((p) => `${p.name} ${p.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")));
  const marcadas = new Set(escolhidas);
  const alternar = (id: string) => setEscolhidas((atual) => (atual.includes(id) ? atual.filter((v) => v !== id) : [...atual, id]));
  const alternarGrupo = (ids: string[]) => setEscolhidas((atual) => (ids.every((id) => atual.includes(id)) ? atual.filter((id) => !ids.includes(id)) : [...new Set([...atual, ...ids])]));

  const horaCerta = HORA.test(inicio) && (fim === "" || (HORA.test(fim) && fim > inicio));
  const choques = useMemo(() => {
    if (!HORA.test(inicio)) return [] as { pessoa: Pessoa; com: Bloco }[];
    const a = minutosDe(inicio), z = fim && HORA.test(fim) ? minutosDe(fim) : a + 30;
    const achados: { pessoa: Pessoa; com: Bloco }[] = [];
    for (const p of trabalham) {
      if (!marcadas.has(p.id)) continue;
      const com = blocos.find((b) => !foraDoChoque(b) && b.pessoaIds.includes(p.id) && minutosDe(b.inicio) < z && a < fimEmMinutos(b));
      if (com) achados.push({ pessoa: p, com });
    }
    return achados;
  }, [trabalham, escolhidas, blocos, inicio, fim]);
  const deOutraArea = areasQueSupervisiona === null ? [] : trabalham.filter((p) => marcadas.has(p.id) && !(p.areaId && areasQueSupervisiona.includes(p.areaId)));
  const pronto = escolhidas.length > 0 && rotulo.trim().length > 0 && horaCerta && HORA.test(inicio);
  const parecShow = /\bshow\b/i.test(rotulo);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pronto || saving) return;
    const erroDeChamada = primeiroErro(chamadasNovas, inicio);
    if (erroDeChamada) { setErro(`Chamadas: ${erroDeChamada}`); return; }
    setErro("");
    try { await onSubmit({ pessoaIds: escolhidas, rotulo: rotulo.trim(), inicio, fim, tipoId, chamadasNovas }); } catch { setErro("Não consegui pôr a atividade no dia. Nada foi alterado; tente de novo."); }
  };
  const campo = "width:100%;box-sizing:border-box;min-height:44px;border:1px solid var(--asa-line-soft);border-radius:10px;padding:8px 12px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark)";
  const atalho = (ativo: boolean) => "min-height:44px;border-radius:999px;padding:6px 13px;font-size:12px;font-family:Manrope,sans-serif;cursor:pointer;white-space:nowrap;" + (ativo ? "border:1px solid var(--asa-ink-dark);background:var(--asa-ink-dark);color:#fff;font-weight:700;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-ink-medium);font-weight:600;");

  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Atividade só deste dia">
    <header className="shows-dialog-header"><div><h2>Atividade só deste dia</h2><p>Vale apenas neste dia: a Programação não muda.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-lote" onSubmit={(e) => void enviar(e)} className="shows-form" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <fieldset style={css("border:none;padding:0;margin:0;min-width:0;max-width:100%;display:flex;flex-direction:column;gap:8px")}>
        <legend style={css("padding:0;font-size:12px;font-weight:700;color:var(--asa-label)")}>Quem faz</legend>
        <div style={css("display:flex;flex-wrap:wrap;gap:6px")} role="group" aria-label="Marcar de uma vez">
          <button type="button" style={css(atalho(escolhidas.length === trabalham.length && trabalham.length > 0))} onClick={() => alternarGrupo(trabalham.map((p) => p.id))}>{`Todo o elenco do dia (${trabalham.length})`}</button>
          {areas.map((a) => { const ids = trabalham.filter((p) => p.areaId === a.id).map((p) => p.id); if (!ids.length) return null; return <button key={a.id} type="button" style={css(atalho(ids.every((id) => marcadas.has(id))))} onClick={() => alternarGrupo(ids)}>{`${a.name} (${ids.length})`}</button>; })}
          {escolhidas.length > 0 && <button type="button" style={css(atalho(false) + "border-style:dashed;")} onClick={() => setEscolhidas([])}>Limpar</button>}
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa ou área" aria-label="Buscar pessoa" style={css(campo)}/>
        <div role="group" aria-label="Pessoas" style={css("display:flex;flex-direction:column;gap:5px;max-height:224px;overflow:auto;border:1px solid var(--asa-border-soft);border-radius:11px;padding:7px")}>
          {filtradas.map((p) => {
            const marcada = marcadas.has(p.id);
            const choque = choques.find((c) => c.pessoa.id === p.id);
            return <button key={p.id} type="button" onClick={() => alternar(p.id)} aria-pressed={marcada}
              style={css("display:flex;align-items:center;gap:9px;text-align:left;min-height:44px;border:1px solid " + (marcada ? "var(--asa-lavender)" : "var(--asa-purple-veil)") + ";background:" + (marcada ? "var(--asa-purple-snow)" : "#fff") + ";border-radius:10px;padding:6px 10px;cursor:pointer;font-family:Manrope,sans-serif")}>
              <span aria-hidden="true" style={css("width:18px;height:18px;flex:none;border-radius:5px;border:1.5px solid " + (marcada ? "var(--asa-purple)" : "var(--asa-purple-line)") + ";background:" + (marcada ? "var(--asa-purple)" : "#fff") + ";color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center")}>{marcada ? "✓" : ""}</span>
              <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0")}>
                <strong style={css("font-size:12.5px;color:var(--asa-ink-dark)")}>{p.name}</strong>
                <span style={css("font-size:12px;color:" + (choque ? "var(--esc-choque)" : "var(--asa-label)"))}>{choque ? `já tem ${textoDoBloco(choque.com)} nesse horário` : p.areaName ?? "Sem área"}</span>
              </span>
            </button>;
          })}
          {!filtradas.length && <span style={css("font-size:12px;color:var(--asa-label);padding:6px 4px")}>Ninguém com esse nome trabalhando neste dia.</span>}
        </div>
      </fieldset>
      <label>O que é<input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Prova de figurino" maxLength={60} required/></label>
      <label>Começa às<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required/></label>
      <label>Termina às (opcional)<input type="time" value={fim} onChange={(e) => setFim(e.target.value)}/></label>
      <label>Tipo (dá a cor na Escala)<TipoSelect tipos={tipos} value={tipoId} onChange={setTipoId} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}/></label>
      {fim !== "" && HORA.test(inicio) && fim <= inicio && <span role="alert" style={css("font-size:12px;color:var(--asa-ausente-fg)")}>O fim precisa ser depois do início.</span>}
      {parecShow && <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45")}>Show é do Livro do Dia: quem faz cada posição é decidido lá. Aqui entra só atividade que não é show.</span>}
      <details open={chamadasNovas.length > 0} style={css("border-top:1px solid var(--asa-book-fade);padding-top:10px")}>
        <summary style={css("cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:13px;font-weight:700;color:var(--asa-ink-dark)")}>{chamadasNovas.length ? `Chamadas (${chamadasNovas.length})` : "Tem chamada?"}</summary>
        <ChamadasLista valor={chamadasNovas} onChange={setChamadasNovas} inicioDaAtividade={HORA.test(inicio) ? inicio : null} desabilitado={saving}/>
      </details>

      <section aria-label="Prévia" aria-live="polite" style={css("border:1px solid var(--asa-lavender);background:var(--asa-purple-dawn);border-radius:11px;padding:10px 12px;font-size:12.5px;line-height:1.5;color:var(--asa-ink-dark)")}>
        <strong>Prévia</strong>
        <ul style={css("margin:6px 0 0;padding-left:18px")}>
          <li>{escolhidas.length ? `${plural(escolhidas.length, "pessoa entra", "pessoas entram")}` : "Marque quem faz."}</li>
          {deFolga.length > 0 && <li>{`${plural(deFolga.length, "pessoa fica de fora", "pessoas ficam de fora")} por não trabalhar neste dia:${nomes(deFolga)}.`}</li>}
          {choques.length > 0 && <li style={css("color:var(--esc-choque);font-weight:700")}>{`${plural(choques.length, "pessoa vai ficar", "pessoas vão ficar")} em dois lugares ao mesmo tempo: ${nomes(choques.map((c) => c.pessoa))}. É um aviso, não bloqueia.`}</li>}
          {deOutraArea.length > 0 && <li>{`${plural(deOutraArea.length, "pessoa é", "pessoas são")} de outra área. A Supervisão dela vai ver que foi você.`}</li>}
        </ul>
      </section>
      {erro && <p role="alert" style={css("margin:0;font-size:12.5px;color:var(--asa-ausente-fg)")}>{erro}</p>}
    </form></div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary" disabled={saving}>Cancelar</button>
      <button form="esc-lote" className="shows-primary" disabled={!pronto || saving}>{saving ? "Salvando…" : escolhidas.length > 1 ? `Pôr no dia · ${escolhidas.length} pessoas` : "Pôr no dia"}</button>
    </footer>
  </div></div>;
}
