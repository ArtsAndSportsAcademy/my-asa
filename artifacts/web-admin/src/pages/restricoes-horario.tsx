/**
 * Restrições de horário (16/10/2026): "a pessoa só pode trabalhar das X às Y, nestes dias, neste período"
 * (ex.: escola). Para o rodízio é proibição; para escalar mesmo assim num dia (sem aula, emergência) a
 * Administração ou a Supervisão da pessoa escala à mão na Escala e escreve o motivo.
 *
 * Administração cadastra para qualquer pessoa; Supervisão, só para gente da própria área (o servidor
 * recusa o resto, com a frase); Direção só lê; Elenco vê as próprias. Encerrar pede motivo e dá para reabrir:
 * nada é apagado. As regras moram no servidor (routes/restricoes-horario.ts).
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./shows.css";
import "./restricoes-horario.css";

type Role = "adm" | "dir" | "sup" | "mem";
type Restricao = {
  id: string; userId: string; userName: string; diasSemana: number[]; horaInicio: string; horaFim: string;
  periodStart: string; periodEnd: string | null; motivo: string; status: "ACTIVE" | "ENDED";
};
type Pessoa = { id: string; name: string; areaName?: string | null };

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** "segunda a sexta", "sábado e domingo" ou a lista, na ordem da semana começando na segunda. */
function textoDosDias(dias: number[]): string {
  const ordem = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d));
  if (ordem.length === 7) return "todos os dias";
  const emSequencia = ordem.length > 2 && ordem.every((d, i) => i === 0 || ([1, 2, 3, 4, 5, 6, 0].indexOf(d) - [1, 2, 3, 4, 5, 6, 0].indexOf(ordem[i - 1]!)) === 1);
  if (emSequencia) return `${DIAS[ordem[0]!]} a ${DIAS[ordem[ordem.length - 1]!]}`;
  return ordem.length === 2 ? `${DIAS[ordem[0]!]} e ${DIAS[ordem[1]!]}` : ordem.map((d) => DIAS[d]).join(", ");
}
/** "só das 15:00 às 18:00"; quando o fim é 23:59 o que vale é "a partir das 15:00". */
const textoDaJanela = (r: Pick<Restricao, "horaInicio" | "horaFim">) => r.horaFim === "23:59" ? `só a partir das ${r.horaInicio}` : `só das ${r.horaInicio} às ${r.horaFim}`;
const textoDoPeriodo = (r: Pick<Restricao, "periodStart" | "periodEnd">) => r.periodEnd ? `de ${dataCurta(r.periodStart)} a ${dataCurta(r.periodEnd)}` : `a partir de ${dataCurta(r.periodStart)}`;

export default function RestricoesHorarioPage({ role }: { role: Role }) {
  const [restricoes, setRestricoes] = useState<Restricao[]>([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [aba, setAba] = useState<"ativas" | "encerradas">("ativas");
  const [nova, setNova] = useState(false);
  const [encerrando, setEncerrando] = useState<Restricao | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [abertos, setAbertos] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const r = await customFetch<{ restricoes: Restricao[]; podeEditar: boolean }>("/api/restricoes-horario");
      setRestricoes(r.restricoes); setPodeEditar(r.podeEditar);
    } catch (e) { setErro(mensagemDoErro(e, "Não consegui carregar as restrições de horário. Tente de novo em instantes.")); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrirNova = async () => {
    setNova(true);
    if (pessoas.length) return;
    try {
      const r = await customFetch<{ users?: Pessoa[] }>("/api/users");
      setPessoas((r.users ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    } catch (e) { setErro(mensagemDoErro(e, "Não consegui carregar a lista de pessoas.")); }
  };

  // Se a lista nem chegou, dizer "nenhuma restrição" seria mentira: só o erro e o botão aparecem.
  const naoCarregou = Boolean(erro) && !restricoes.length && !podeEditar;
  const visiveis = useMemo(() => restricoes.filter((r) => (aba === "ativas") === (r.status === "ACTIVE")), [restricoes, aba]);
  const mudar = async (r: Restricao, acao: "encerrar" | "reabrir", motivo?: string) => {
    setErro(""); setAviso("");
    try {
      await customFetch(`/api/restricoes-horario/${r.id}/${acao}`, { method: "POST", body: JSON.stringify(motivo ? { motivo } : {}) });
      // O banco de teste demora; a linha muda de aba na hora, para ninguém tocar duas vezes.
      setRestricoes((l) => l.map((x) => x.id === r.id ? { ...x, status: acao === "encerrar" ? "ENDED" : "ACTIVE" } : x));
      setAviso(acao === "encerrar" ? `Restrição de ${r.userName} encerrada. Dá para reabrir.` : `Restrição de ${r.userName} voltou a valer.`);
      await carregar();
    } catch (e) { setErro(mensagemDoErro(e, acao === "encerrar" ? "Não consegui encerrar a restrição." : "Não consegui reabrir a restrição.")); throw e; }
  };

  return <section className="asa-page restricoes-page">
    <p className="restricoes-intro">{role === "mem"
      ? "Aqui ficam as restrições de horário cadastradas para você. Enquanto valem, o rodízio não te coloca fora desse horário."
      : "Restrição de horário é proibição: o rodízio nunca escala a pessoa fora do horário em que ela pode. Para um dia sem a restrição (por exemplo, sem aula), escale à mão na Escala e escreva o motivo."}</p>
    <div className="restricoes-bar">
      <nav className="shows-tabs" aria-label="Restrições">
        <button type="button" className={aba === "ativas" ? "active" : ""} onClick={() => setAba("ativas")}>Valendo</button>
        <button type="button" className={aba === "encerradas" ? "active" : ""} onClick={() => setAba("encerradas")}>Encerradas</button>
      </nav>
      {podeEditar && <button type="button" className="shows-primary" onClick={() => void abrirNova()}>Nova restrição</button>}
    </div>
    {aviso && <p className="restricoes-aviso" role="status">{aviso}</p>}
    {erro && <p className="restricoes-erro" role="alert">{erro}{naoCarregou && <button type="button" className="shows-secondary" onClick={() => { setCarregando(true); void carregar(); }}>Tentar de novo</button>}</p>}
    {carregando ? <div className="asa-skeletons" aria-busy="true"><i/><i/></div>
      : naoCarregou ? null
      : !visiveis.length ? <div className="asa-card restricoes-vazio">{aba === "ativas"
          ? (role === "mem" ? "Você não tem restrição de horário." : "Nenhuma restrição de horário valendo. Quando alguém só puder trabalhar em certos horários (escola, curso), cadastre aqui e o rodízio passa a respeitar.")
          : "Nenhuma restrição encerrada."}</div>
      : <ul className="restricoes-lista">{visiveis.map((r) => <li key={r.id} className="asa-card">
          <div className="restricoes-corpo">
            <strong>{r.userName}</strong>
            <span>{`${textoDosDias(r.diasSemana)} · ${textoDaJanela(r)}`}</span>
            <small className={`restricoes-motivo-texto${abertos.includes(r.id) ? " aberto" : ""}`}>{`${textoDoPeriodo(r)} · ${r.motivo}`}</small>
            {r.motivo.length > 80 && <button type="button" className="restricoes-mais" aria-expanded={abertos.includes(r.id)} onClick={() => setAbertos((l) => l.includes(r.id) ? l.filter((x) => x !== r.id) : [...l, r.id])}>{abertos.includes(r.id) ? "ver menos" : "ver mais"}</button>}
          </div>
          {/* Na aba "Valendo" o selo repetiria o óbvio em toda linha; só as encerradas ganham selo. */}
          {r.status !== "ACTIVE" && <span className="asa-status">encerrada</span>}
          {podeEditar && (r.status === "ACTIVE"
            ? <button type="button" className="shows-secondary" onClick={() => setEncerrando(r)}>Encerrar</button>
            : <button type="button" className="shows-secondary" onClick={() => void mudar(r, "reabrir").catch(() => undefined)}>Reabrir</button>)}
        </li>)}</ul>}
    {nova && <NovaRestricaoDialog pessoas={pessoas} erroDaLista={erro} onClose={() => setNova(false)} onSalvou={async (quantas) => { setNova(false); setAviso(quantas === 1 ? "Restrição cadastrada." : `Restrição cadastrada para ${quantas} pessoas.`); await carregar(); }}/>}
    {encerrando && <EncerrarDialog restricao={encerrando} onClose={() => setEncerrando(null)} onEncerrar={async (motivo) => { await mudar(encerrando, "encerrar", motivo); setEncerrando(null); }}/>}
  </section>;
}

function NovaRestricaoDialog({ pessoas, erroDaLista, onClose, onSalvou }: { pessoas: Pessoa[]; erroDaLista: string; onClose: () => void; onSalvou: (quantas: number) => Promise<void> }) {
  useFecharComEsc(onClose);
  const [busca, setBusca] = useState("");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [inicio, setInicio] = useState("15:00");
  const [fim, setFim] = useState("23:59");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // O erro mora no fim do formulário; no celular ele ficaria fora da tela, então a janela rola até ele.
  useEffect(() => { if (erro) document.querySelector(".restricoes-form .restricoes-erro")?.scrollIntoView({ block: "nearest" }); }, [erro]);
  const naBusca = pessoas.filter((p) => `${p.name} ${p.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const alternar = (lista: number[], valor: number) => lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  const salvar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!escolhidas.length) { setErro("Escolha pelo menos uma pessoa."); return; }
    if (!dias.length) { setErro("Escolha pelo menos um dia da semana."); return; }
    if (!de) { setErro("Diga a partir de quando a restrição vale."); return; }
    if (fim <= inicio) { setErro("A hora final precisa ser depois da inicial: é a janela em que a pessoa pode trabalhar."); return; }
    if (motivo.trim().length < 3) { setErro("Escreva o motivo (ex.: escola)."); return; }
    setSalvando(true); setErro("");
    try {
      await customFetch("/api/restricoes-horario", { method: "POST", body: JSON.stringify({ userIds: escolhidas, diasSemana: dias, horaInicio: inicio, horaFim: fim, periodStart: de, periodEnd: ate || null, motivo: motivo.trim() }) });
      await onSalvou(escolhidas.length);
    } catch (err) { setErro(mensagemDoErro(err, "Não consegui salvar a restrição. Nada foi cadastrado; tente de novo.")); } finally { setSalvando(false); }
  };
  return <div className="shows-dialog-backdrop" role="presentation"><form className="shows-dialog" role="dialog" aria-modal="true" aria-label="Nova restrição de horário" onSubmit={(e) => void salvar(e)}>
    <header className="shows-dialog-header"><div><h2>Nova restrição de horário</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content restricoes-form">
      <fieldset><legend>Quem</legend>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa ou área" aria-label="Buscar pessoa"/>
        <ul className="restricoes-pessoas">{naBusca.map((p) => <li key={p.id}><label><input type="checkbox" aria-label={p.name} checked={escolhidas.includes(p.id)} onChange={() => setEscolhidas((l) => l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id])}/><span>{p.name}<small>{p.areaName ?? "Sem área"}</small></span></label></li>)}
          {!naBusca.length && <li className="restricoes-nada">{pessoas.length ? "Ninguém encontrado." : erroDaLista || "Carregando pessoas…"}</li>}</ul>
        {escolhidas.length > 0 && <div className="restricoes-escolhidas" aria-label="Pessoas escolhidas">{pessoas.filter((p) => escolhidas.includes(p.id)).map((p) => <button type="button" key={p.id} onClick={() => setEscolhidas((l) => l.filter((x) => x !== p.id))} aria-label={`Tirar ${p.name}`}>{p.name}<X size={14}/></button>)}</div>}
        <small>{escolhidas.length ? `${escolhidas.length} ${escolhidas.length === 1 ? "pessoa escolhida" : "pessoas escolhidas"}: a mesma regra vale para todas.` : "Dá para escolher várias pessoas de uma vez."}</small>
      </fieldset>
      <fieldset><legend>Dias da semana</legend>
        <div className="restricoes-dias">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button type="button" key={d} aria-pressed={dias.includes(d)} className={dias.includes(d) ? "on" : ""} onClick={() => setDias((l) => alternar(l, d))}>{DIAS_CURTOS[d]}</button>)}</div>
      </fieldset>
      <fieldset><legend>Pode trabalhar</legend>
        <div className="restricoes-linha"><label>das<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)}/></label><label>às<input type="time" value={fim} onChange={(e) => setFim(e.target.value)}/></label></div>
        <small>Fora dessa janela o rodízio não escala a pessoa.</small>
      </fieldset>
      <fieldset><legend>Período em que vale</legend>
        <div className="restricoes-linha"><label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)}/></label><label>Até (opcional)<input type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)}/></label></div>
      </fieldset>
      <label className="restricoes-motivo">Motivo
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Escola, curso, outro trabalho…"/>
      </label>
      {erro && <p className="restricoes-erro" role="alert">{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" className="shows-secondary" onClick={onClose}>Cancelar</button>
      <button type="submit" className="shows-primary" disabled={salvando}>{salvando ? "Salvando…" : escolhidas.length > 1 ? `Cadastrar (${escolhidas.length})` : "Cadastrar"}</button>
    </footer>
  </form></div>;
}

function EncerrarDialog({ restricao, onClose, onEncerrar }: { restricao: Restricao; onClose: () => void; onEncerrar: (motivo: string) => Promise<void> }) {
  useFecharComEsc(onClose);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const encerrar = async (e: FormEvent) => { e.preventDefault(); setSalvando(true); try { await onEncerrar(motivo.trim()); } catch { onClose(); } finally { setSalvando(false); } };
  return <div className="shows-dialog-backdrop" role="presentation"><form className="shows-dialog" role="dialog" aria-modal="true" aria-label="Encerrar restrição" onSubmit={(e) => void encerrar(e)}>
    <header className="shows-dialog-header"><div><h2>Encerrar restrição</h2><p>{`${restricao.userName} · ${textoDosDias(restricao.diasSemana)}, ${textoDaJanela(restricao).replace("só ", "")}`}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content restricoes-form">
      <p className="restricoes-intro">Encerrar não apaga: a restrição fica em "Encerradas" e dá para reabrir. Depois de encerrada, o rodízio volta a escalar a pessoa nesse horário.</p>
      <label className="restricoes-motivo">Por que encerrar?
        <textarea autoFocus rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Acabou o semestre"/>
      </label>
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" className="shows-secondary" onClick={onClose}>Cancelar</button>
      <button type="submit" className="shows-primary" disabled={salvando || motivo.trim().length < 3}>{salvando ? "Encerrando…" : "Encerrar restrição"}</button>
    </footer>
  </form></div>;
}
