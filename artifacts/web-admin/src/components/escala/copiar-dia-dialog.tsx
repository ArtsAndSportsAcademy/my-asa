import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./escala-tokens.css";
import "./equipe-dialog.css";
import "./copiar-dia-dialog.css";

type Itens = { atividades: boolean; ajustes: boolean; horarios: boolean; edicoes: boolean; chamadas: boolean };
type Origem = { date: string; diaDaSemana: string; estado: "rascunho" | "publicado"; mudouDepois: boolean; atividades: number; ajustes: number; horarios: number; edicoes: number; chamadas: number };
type ForaDe = { tipo: string; pessoa?: string; atividades?: string[]; frase: string };
type Resumo = {
  date: string; diaDaSemana: string; estado: "vazio" | "rascunho" | "publicado" | "fechado" | "igual_a_origem"; fechado?: string; publicado: boolean; jaTemAjustes: number;
  copia: { atividades: number; ajustes: number; horarios: number; edicoes: number; chamadas: number }; jaEstava: number; foraDe: ForaDe[];
};
type Previa = { carregando: boolean; resumo?: Resumo; erro?: string };
export type CopiaFeita = { eventoId: string | null; date: string; itens: number };

const NOMES_ITENS: { chave: keyof Itens; um: string; muitos: string; rotulo: string; ajuda: string }[] = [
  { chave: "atividades", um: "atividade só do dia", muitos: "atividades só do dia", rotulo: "Atividades só do dia", ajuda: "As que foram criadas à mão naquele dia (peruca, vídeo…), com as pessoas." },
  { chave: "ajustes", um: "ajuste por pessoa", muitos: "ajustes por pessoa", rotulo: "Ajustes por pessoa", ajuda: "Quem entrou ou saiu de uma atividade do molde." },
  { chave: "horarios", um: "horário só de uma pessoa", muitos: "horários só de uma pessoa", rotulo: "Horários só de uma pessoa", ajuda: "Quando alguém começou mais tarde ou saiu mais cedo." },
  { chave: "edicoes", um: "edição de atividade", muitos: "edições de atividade", rotulo: "Edições da atividade no dia", ajuda: "Nome, horário ou tipo mudados só naquele dia." },
  { chave: "chamadas", um: "chamada só do dia", muitos: "chamadas só do dia", rotulo: "Chamadas só do dia", ajuda: "As chamadas que foram criadas naquele dia." },
];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MAXIMO_DE_DIAS = 8;
const dt = (iso: string) => new Date(`${iso}T12:00:00`);
const curto = (iso: string) => `${DIAS[dt(iso).getDay()]!.slice(0, 3)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const longo = (iso: string) => `${DIAS[dt(iso).getDay()]}, ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const somaDias = (iso: string, n: number) => { const d = dt(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const fraseDe = (err: unknown, padrao: string) => err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : padrao;
const totalDe = (r: Resumo["copia"]) => r.atividades + r.ajustes + r.horarios + r.edicoes + r.chamadas;

/**
 * Copiar de outro dia (H1). Quatro tempos numa janela só: escolher o dia de origem, escolher os dias de destino e o que copiar, conferir (a prévia não grava nada
 * e diz quem fica de fora e por quê) e copiar. Um pedido por dia de destino, em fila, para um dia lento não derrubar os outros e cada um virar um evento no Registro.
 */
export function CopiarDiaDialog({ localId, localNome, dataInicial, onClose }: {
  localId: string; localNome: string; dataInicial: string;
  /** Quando a janela fecha: o que foi copiado (para a tela mostrar o "Desfazer cópia"). */
  onClose: (feitas: CopiaFeita[], origem: string | null) => void;
}) {
  const id = useId();
  const [etapa, setEtapa] = useState<"escolher" | "conferir" | "resultado">("escolher");
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const [erroOrigens, setErroOrigens] = useState("");
  const [origem, setOrigem] = useState("");
  const [versao, setVersao] = useState<"" | "publicada" | "atual">("");
  const [destinos, setDestinos] = useState<string[]>([dataInicial]);
  const [outroDia, setOutroDia] = useState("");
  const [itens, setItens] = useState<Itens>({ atividades: true, ajustes: true, horarios: true, edicoes: true, chamadas: true });
  const [modo, setModo] = useState<"juntar" | "zero">("juntar");
  const [motivo, setMotivo] = useState("");
  const [previas, setPrevias] = useState<Record<string, Previa>>({});
  const [copiando, setCopiando] = useState<{ feitos: number; total: number } | null>(null);
  const [feitas, setFeitas] = useState<CopiaFeita[]>([]);
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const rodada = useRef(0);
  // O modo com que a última conferência foi feita: mudar para "do zero" sem conferir de novo mostraria um resumo que já não vale.
  const [modoConferido, setModoConferido] = useState<"juntar" | "zero">("juntar");

  useEffect(() => {
    let cancelado = false;
    customFetch<{ origens: Origem[] }>(`/api/escalas/copia/origens?locationId=${localId}&date=${dataInicial}`)
      .then((r) => { if (!cancelado) setOrigens(r.origens); })
      .catch((e) => { if (!cancelado) { setOrigens([]); setErroOrigens(fraseDe(e, "Não consegui listar os dias para copiar. Feche e tente de novo.")); } });
    return () => { cancelado = true; };
  }, [localId, dataInicial]);

  const ocupado = copiando !== null;
  const fechar = () => { if (!ocupado) onClose(feitas, origem || null); };
  useFecharComEsc(fechar);
  useEffect(() => { if (erro) document.getElementById(`${id}-erro`)?.scrollIntoView({ block: "nearest" }); }, [erro, id]);

  const escolhida = origens?.find((o) => o.date === origem) ?? null;
  const precisaEscolherVersao = Boolean(escolhida?.estado === "publicado" && escolhida.mudouDepois);
  const algumItem = Object.values(itens).some(Boolean);
  const dias = useMemo(() => Array.from({ length: 28 }, (_, i) => somaDias(dataInicial, i)), [dataInicial]);
  const proximas = [7, 14, 21].map((n) => somaDias(dataInicial, n));
  const pronto = Boolean(origem) && destinos.length > 0 && algumItem && (!precisaEscolherVersao || versao !== "");

  const alternar = (d: string) => { setDestinos((v) => v.includes(d) ? v.filter((x) => x !== d) : v.length >= MAXIMO_DE_DIAS ? v : [...v, d].sort()); setErro(""); };
  const acrescentarOutro = () => {
    if (!outroDia || destinos.includes(outroDia)) { setOutroDia(""); return; }
    if (destinos.length >= MAXIMO_DE_DIAS) { setErro(`Dá para copiar para até ${MAXIMO_DE_DIAS} dias de uma vez.`); return; }
    setDestinos((v) => [...v, outroDia].sort()); setOutroDia(""); setErro("");
  };
  const pedidoDe = (destino: string, simular: boolean) => ({
    locationId: localId, origem, destino, itens, modo, ...(modo === "zero" ? { motivo: motivo.trim() } : {}),
    ...(precisaEscolherVersao && versao ? { versao } : {}), simular,
  });

  /** Confere cada dia de destino (a prévia não grava nada), dois de cada vez. */
  const conferir = async () => {
    const minha = ++rodada.current;
    setEtapa("conferir"); setErro(""); setModoConferido(modo);
    setPrevias(Object.fromEntries(destinos.map((d) => [d, { carregando: true }])));
    const fila = [...destinos];
    const trabalhar = async () => {
      for (let d = fila.shift(); d; d = fila.shift()) {
        let previa: Previa;
        try { previa = { carregando: false, resumo: (await customFetch<{ resumo: Resumo }>("/api/escalas/dia/copiar", { method: "POST", body: JSON.stringify(pedidoDe(d, true)) })).resumo }; }
        catch (e) { previa = { carregando: false, erro: fraseDe(e, "Não consegui conferir este dia. Tente de novo.") }; }
        if (rodada.current !== minha) return;
        setPrevias((atual) => ({ ...atual, [d]: previa }));
      }
    };
    await Promise.all([trabalhar(), trabalhar()]);
  };
  const voltar = () => { rodada.current += 1; setEtapa("escolher"); setErro(""); };

  const copiaveis = destinos.filter((d) => { const r = previas[d]?.resumo; return r && r.estado !== "fechado" && r.estado !== "igual_a_origem"; });
  const conferindo = destinos.some((d) => previas[d]?.carregando);
  const motivoFalta = modo === "zero" && motivo.trim().length < 3;
  const conferenciaVelha = modo !== modoConferido;
  const algoACopiar = copiaveis.some((d) => totalDe(previas[d]!.resumo!.copia) > 0) || (modo === "zero" && copiaveis.length > 0);

  const copiar = async () => {
    if (ocupado || conferindo || motivoFalta || conferenciaVelha || !copiaveis.length) return;
    setErro(""); setFalhas({});
    const novas: CopiaFeita[] = [...feitas], falhou: Record<string, string> = {};
    for (let i = 0; i < copiaveis.length; i += 1) {
      const d = copiaveis[i]!;
      setCopiando({ feitos: i, total: copiaveis.length });
      try {
        const r = await customFetch<{ resumo: Resumo; eventoId: string | null; gravou: boolean }>("/api/escalas/dia/copiar", { method: "POST", body: JSON.stringify(pedidoDe(d, false)) });
        novas.push({ eventoId: r.gravou ? r.eventoId : null, date: d, itens: totalDe(r.resumo.copia) });
      } catch (e) { falhou[d] = fraseDe(e, "Não consegui copiar para este dia. Nada foi gravado nele."); }
    }
    setCopiando(null); setFeitas(novas); setFalhas(falhou);
    if (!Object.keys(falhou).length) { onClose(novas, origem); return; }
    setEtapa("resultado");
  };

  const titulo = etapa === "escolher" ? "Copiar de outro dia" : etapa === "conferir" ? "Conferir antes de copiar" : "Resultado da cópia";
  return <div className="shows-dialog-backdrop eq-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
    <div className="shows-dialog cd-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
      <header className="shows-dialog-header"><div><h2 id={`${id}-titulo`}>{titulo}</h2><p>{localNome}</p></div><button type="button" onClick={fechar} aria-label="Fechar" disabled={ocupado}><X size={18}/></button></header>
      <div className="shows-dialog-content cd-conteudo">
        {etapa === "escolher" && <>
          <p className="cd-explica">Leva para o dia escolhido o que foi feito à mão em outro dia deste local. Quem estiver de folga, na equipe de outro local ou fora do dia fica de fora, e a próxima tela diz quem e por quê.</p>
          <section aria-labelledby={`${id}-de`}>
            <h3 id={`${id}-de`} className="cd-h">1. De onde copiar</h3>
            {origens === null && <p className="cd-nota" aria-busy="true">Procurando os dias que têm algo para copiar…</p>}
            {origens !== null && erroOrigens && <p className="cd-erro" role="alert">{erroOrigens}</p>}
            {origens !== null && !erroOrigens && origens.length === 0 && <p className="cd-vazio" role="status">Nenhum dia deste local tem ajuste, atividade só do dia ou chamada para copiar. Faça o ajuste em um dia primeiro; depois ele aparece aqui.</p>}
            {origens !== null && origens.length > 0 && <div className="cd-lista" role="radiogroup" aria-label="Dia de origem">
              {[...origens].sort((a, b) => Number(dt(b.date).getDay() === dt(dataInicial).getDay()) - Number(dt(a.date).getDay() === dt(dataInicial).getDay()) || b.date.localeCompare(a.date)).map((o) => {
                const soma = o.atividades + o.ajustes + o.horarios + o.edicoes + o.chamadas;
                return <label key={o.date} className={`cd-linha${origem === o.date ? " cd-linha-on" : ""}`}>
                  <input type="radio" name={`${id}-origem`} checked={origem === o.date} onChange={() => { setOrigem(o.date); setVersao(""); setErro(""); }}/>
                  <span className="cd-linha-texto"><strong>{longo(o.date)}</strong>
                    <span>{o.estado === "publicado" ? (o.mudouDepois ? "publicada, mudou depois" : "publicada") : "rascunho"} · {plural(soma, "item", "itens")}</span></span>
                </label>;
              })}
            </div>}
            {precisaEscolherVersao && <fieldset className="cd-versao"><legend>Este dia mudou depois de publicado. Qual versão copiar?</legend>
              <label><input type="radio" name={`${id}-versao`} checked={versao === "publicada"} onChange={() => setVersao("publicada")}/> A que o Elenco viu (publicada)</label>
              <label><input type="radio" name={`${id}-versao`} checked={versao === "atual"} onChange={() => setVersao("atual")}/> A de agora (com as mudanças que ainda não foram publicadas)</label>
            </fieldset>}
          </section>
          <section aria-labelledby={`${id}-para`}>
            <h3 id={`${id}-para`} className="cd-h">2. Para quais dias</h3>
            <div className="cd-chips" role="group" aria-label="Dias de destino">
              {dias.map((d) => <button key={d} type="button" className={`cd-chip${destinos.includes(d) ? " cd-chip-on" : ""}`} aria-pressed={destinos.includes(d)} disabled={d === origem} onClick={() => alternar(d)}>{curto(d)}</button>)}
            </div>
            <div className="cd-atalhos">
              <button type="button" className="cd-link" onClick={() => setDestinos([...new Set([dataInicial, ...proximas])].filter((d) => d !== origem).sort())}>Este e as próximas 3 {DIAS[dt(dataInicial).getDay()]}s</button>
              <button type="button" className="cd-link" onClick={() => setDestinos([dataInicial])}>Só este dia</button>
              <label className="cd-outro">Outro dia <input type="date" value={outroDia} min={hojeISO()} onChange={(e) => setOutroDia(e.target.value)}/></label>
              <button type="button" className="cd-link" disabled={!outroDia} onClick={acrescentarOutro}>Acrescentar</button>
            </div>
            {destinos.filter((d) => !dias.includes(d)).length > 0 && <p className="cd-nota">Também: {destinos.filter((d) => !dias.includes(d)).map(curto).join(", ")}.</p>}
            <p className="cd-nota">{plural(destinos.length, "dia escolhido", "dias escolhidos")} (até {MAXIMO_DE_DIAS}).</p>
          </section>
          <section aria-labelledby={`${id}-oque`}>
            <h3 id={`${id}-oque`} className="cd-h">3. O que copiar</h3>
            <div className="cd-itens">
              {NOMES_ITENS.map((n) => {
                const qtd = escolhida ? escolhida[n.chave] : null;
                return <label key={n.chave} className="cd-item"><input type="checkbox" checked={itens[n.chave]} disabled={qtd === 0} onChange={(e) => setItens((v) => ({ ...v, [n.chave]: e.target.checked }))}/>
                  <span><strong>{n.rotulo}{qtd !== null ? ` · ${qtd}` : ""}</strong><span>{n.ajuda}</span></span></label>;
              })}
            </div>
            <p className="cd-nota">Os Livros do Dia (quem faz cada vaga do show) ainda não entram nesta cópia.</p>
          </section>
        </>}

        {etapa === "conferir" && <>
          <p className="cd-explica">De <strong>{longo(origem)}</strong>{precisaEscolherVersao ? ` (versão ${versao === "publicada" ? "publicada" : "de agora"})` : ""}. Nada foi gravado ainda.</p>
          {destinos.map((d) => {
            const p = previas[d];
            const r = p?.resumo;
            return <section key={d} className="cd-dia" aria-busy={p?.carregando}>
              <h3 className="cd-dia-t">{longo(d)}{r && <span className={`cd-estado cd-estado-${r.estado}`}>{r.estado === "publicado" ? "publicado" : r.estado === "rascunho" ? "em rascunho" : r.estado === "fechado" ? "fechado" : r.estado === "igual_a_origem" ? "dia de origem" : "ainda vazio"}</span>}</h3>
              {(!p || p.carregando) && <p className="cd-nota">Conferindo este dia…</p>}
              {p?.erro && <p className="cd-erro" role="alert">{p.erro}</p>}
              {r && (r.estado === "fechado" || r.estado === "igual_a_origem") && <p className="cd-aviso">{r.fechado} Este dia não recebe cópia.</p>}
              {r && r.estado !== "fechado" && r.estado !== "igual_a_origem" && <>
                {r.publicado && <p className="cd-amarela" role="note">Este dia está publicado: a cópia espera a republicação. O Elenco segue vendo a versão antiga e a Administração é avisada.</p>}
                <p className="cd-resumo">{totalDe(r.copia) === 0 && modo === "juntar"
                  ? `Nada novo para copiar${r.jaEstava ? ` (${plural(r.jaEstava, "item já estava", "itens já estavam")} no dia)` : ""}.`
                  : `Vai copiar: ${NOMES_ITENS.filter((n) => r.copia[n.chave] > 0).map((n) => plural(r.copia[n.chave], n.um, n.muitos)).join(", ") || "nada"}.${r.jaEstava ? ` ${plural(r.jaEstava, "já estava", "já estavam")} no dia.` : ""}`}</p>
                {r.jaTemAjustes > 0 && <p className="cd-nota">{modo === "juntar" ? `Este dia já tem ${plural(r.jaTemAjustes, "ajuste", "ajustes")}: continuam como estão.` : `Os ${plural(r.jaTemAjustes, "item", "itens")} que este dia já tem serão desativados (nada é apagado) e o dia fica só com a cópia.`}</p>}
                {r.foraDe.length > 0 && <details className="cd-fora" open={r.foraDe.length <= 3}><summary>Ficam de fora ({r.foraDe.length})</summary>
                  <ul>{r.foraDe.map((f, i) => <li key={i}>{f.frase}</li>)}</ul></details>}
              </>}
            </section>;
          })}
          {Object.values(previas).some((p) => p.resumo && p.resumo.jaTemAjustes > 0) && <div className="cd-zero">
            {modo === "juntar"
              ? <button type="button" className="cd-link" disabled={conferindo} onClick={() => { setModo("zero"); }}>Começar do zero em vez de juntar…</button>
              : <>
                <label className="cd-campo" htmlFor={`${id}-motivo`}>Por que começar do zero? (obrigatório)
                  <textarea id={`${id}-motivo`} rows={2} maxLength={300} value={motivo} disabled={ocupado} placeholder="Ex.: o dia ficou todo diferente do que estava" onChange={(e) => setMotivo(e.target.value)}/>
                </label>
                <p className="cd-nota">Os ajustes, as atividades e as chamadas que o dia já tem ficam desativados, não apagados, e voltam se você desfizer a cópia. Depois de mudar, confira de novo.</p>
                <div className="cd-atalhos"><button type="button" className="cd-link" disabled={ocupado} onClick={() => { setModo("juntar"); setMotivo(""); }}>Voltar a juntar</button>
                  <button type="button" className="cd-link" disabled={ocupado || conferindo || motivoFalta} onClick={() => void conferir()}>Conferir de novo</button></div>
              </>}
          </div>}
          {modo === "juntar" && Object.values(previas).some((p) => p.resumo && p.resumo.jaTemAjustes > 0) && <p className="cd-nota">Juntar é o padrão: nada do que já está no dia é mexido.</p>}
        </>}

        {etapa === "resultado" && <>
          <p className="cd-explica">Alguns dias foram copiados e outros não. O que não deu não foi gravado.</p>
          <ul className="cd-resultado">
            {feitas.filter((f) => destinos.includes(f.date)).map((f) => <li key={f.date}><strong>{longo(f.date)}</strong> · {f.eventoId ? `${plural(f.itens, "item copiado", "itens copiados")}` : "nada novo para copiar"}</li>)}
            {Object.entries(falhas).map(([d, frase]) => <li key={d} className="cd-erro"><strong>{longo(d)}</strong> · {frase}</li>)}
          </ul>
        </>}
        {erro && <p id={`${id}-erro`} className="cd-erro-geral" role="alert">{erro}</p>}
      </div>
      <footer className="shows-dialog-footer">
        {etapa === "escolher" && <>
          <button type="button" className="shows-secondary" onClick={fechar}>Cancelar</button>
          <button type="button" className="shows-primary" disabled={!pronto} onClick={() => void conferir()}>Conferir</button>
        </>}
        {etapa === "conferir" && <>
          <button type="button" className="shows-secondary" onClick={fechar} disabled={ocupado}>Cancelar</button>
          <button type="button" className="shows-secondary" onClick={voltar} disabled={ocupado}>Voltar</button>
          <button type="button" className="shows-primary" disabled={ocupado || conferindo || motivoFalta || conferenciaVelha || !copiaveis.length || !algoACopiar} onClick={() => void copiar()}>
            {copiando ? `Copiando ${copiando.feitos + 1} de ${copiando.total}…` : conferindo ? "Conferindo…" : conferenciaVelha ? "Confira de novo" : copiaveis.length === 1 ? `Copiar para ${curto(copiaveis[0]!)}` : `Copiar para ${copiaveis.length} dias`}</button>
        </>}
        {etapa === "resultado" && <button type="button" className="shows-primary" onClick={fechar}>Fechar</button>}
      </footer>
    </div>
  </div>;
}
