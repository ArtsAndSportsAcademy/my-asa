/**
 * Solicitações (01/10) — pedidos do Elenco, numa tela só, nos quatro perfis.
 * Elenco: pede e acompanha (horário na escala, troca com colega, mudança de horário, restrição, outro
 * assunto e folga — a folga grava no mesmo pedido da tela Folgas). Supervisão: decide os pedidos da
 * própria área. Administração: decide todos. Direção: acompanha. As regras moram no servidor
 * (routes/solicitacoes.ts); a tela só mostra o que ele permite (`pode`).
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeftRight, CalendarClock, CalendarDays, Clock3, HeartPulse, MessageSquareText, Plus } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { REVIEW_PERSON } from "@/lib/amostra";
import { todayISO } from "@/lib/review-escala";
import "./operational-cycle.css";
import "./solicitacoes.css";

type Role = "adm" | "dir" | "sup" | "mem";
type Tipo = "ESCALA_SLOT" | "SWAP" | "SCHEDULE_CHANGE" | "HEALTH_RESTRICTION" | "PHYSICAL_RESTRICTION" | "OTHER" | "LEAVE";
type Estado = "WAITING_PEER" | "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
type Pedido = {
  id: string; tipo: Tipo; estado: Estado; pessoa: { id: string; nome: string }; area: string | null; local: string | null;
  colega: { id: string; nome: string | null } | null; data: string | null; ate: string | null; inicio: string | null; fim: string | null;
  assunto: string | null; motivo: string | null; oculto: boolean;
  decisao: { por: string | null; em: string; motivo: string | null } | null; criadoEm: string;
  pode: { cancelar: boolean; responderColega: boolean; decidir: boolean };
};
type Folga = { id: string; userId: string; userName?: string; areaName?: string | null; startDate: string; endDate: string; reason: string; status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED"; decisionReason?: string | null; createdAt?: string };
type Colega = { id: string; nome: string; area: string | null };

const TIPOS: { tipo: Tipo; nome: string; dica: string; Icon: typeof Clock3 }[] = [
  { tipo: "ESCALA_SLOT", nome: "Horário na escala", dica: "Peruca, gravar vídeo, prova de figurino…", Icon: CalendarClock },
  { tipo: "SWAP", nome: "Troca com colega", dica: "A colega aceita antes de ir para a supervisão", Icon: ArrowLeftRight },
  { tipo: "SCHEDULE_CHANGE", nome: "Mudança de horário", dica: "Entrar mais tarde, sair mais cedo", Icon: Clock3 },
  { tipo: "HEALTH_RESTRICTION", nome: "Restrição", dica: "Saúde ou físico: o que você não pode fazer", Icon: HeartPulse },
  { tipo: "LEAVE", nome: "Folga", dica: "Vai para a mesma fila da tela Folgas", Icon: CalendarDays },
  { tipo: "OTHER", nome: "Outro assunto", dica: "O que não se encaixa nos outros", Icon: MessageSquareText },
];
const NOME: Record<Tipo, string> = { ESCALA_SLOT: "Horário na escala", SWAP: "Troca com colega", SCHEDULE_CHANGE: "Mudança de horário", HEALTH_RESTRICTION: "Restrição de saúde", PHYSICAL_RESTRICTION: "Restrição física", OTHER: "Outro assunto", LEAVE: "Folga" };
const ESTADO: Record<Estado, { rotulo: string; tom: "" | "warn" | "ok" | "bad" | "mute" }> = {
  WAITING_PEER: { rotulo: "esperando a colega", tom: "warn" }, PENDING: { rotulo: "em análise", tom: "warn" },
  APPROVED: { rotulo: "aprovado", tom: "ok" }, DENIED: { rotulo: "recusado", tom: "bad" }, CANCELLED: { rotulo: "cancelado", tom: "mute" },
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${SEMANA[new Date(y!, m! - 1, d!).getDay()]}, ${d} ${MESES[m! - 1]}`; };
const shift = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(y!, m! - 1, d! + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const quando = (p: Pick<Pedido, "data" | "ate" | "inicio" | "fim">) => [p.data ? diaCurto(p.data) + (p.ate && p.ate !== p.data ? ` a ${diaCurto(p.ate)}` : "") : "", p.inicio ? `${p.inicio}${p.fim ? `–${p.fim}` : ""}` : ""].filter(Boolean).join(" · ");
const ABERTO = (e: Estado) => e === "PENDING" || e === "WAITING_PEER";

/** Folga (tela Folgas) no mesmo formato da lista. */
function daFolga(f: Folga, role: Role, meuId: string | null): Pedido {
  const minha = meuId ? f.userId === meuId : role === "mem";
  return {
    id: `folga:${f.id}`, tipo: "LEAVE", estado: f.status, pessoa: { id: f.userId, nome: f.userName ?? "" }, area: f.areaName ?? null, local: null, colega: null,
    data: f.startDate, ate: f.endDate, inicio: null, fim: null, assunto: null, motivo: f.reason, oculto: false,
    decisao: f.status !== "PENDING" && f.decisionReason ? { por: null, em: "", motivo: f.decisionReason } : null, criadoEm: f.createdAt ?? f.startDate,
    pode: { cancelar: false, responderColega: false, decidir: f.status === "PENDING" && !minha && (role === "adm" || role === "sup") },
  };
}

function amostra(role: Role): Pedido[] {
  const hoje = todayISO(), eu = REVIEW_PERSON[role];
  const base = { area: "Patinadores", local: "Snowland", colega: null, ate: null, oculto: false, decisao: null, criadoEm: hoje, pode: { cancelar: false, responderColega: false, decidir: false } };
  const rows: Pedido[] = [
    { ...base, id: "a1", tipo: "ESCALA_SLOT", estado: "PENDING", pessoa: { id: "Julia", nome: "Julia" }, data: shift(hoje, 2), inicio: "14:00", fim: "14:30", assunto: "Peruca", motivo: "Ajuste da peruca nova do show." },
    { ...base, id: "a2", tipo: "SWAP", estado: "WAITING_PEER", pessoa: { id: "Julia", nome: "Julia" }, colega: { id: "Sofia", nome: "Sofia" }, data: shift(hoje, 4), inicio: null, fim: null, assunto: null, motivo: "Eu faço o show das 16h dela e ela faz o meu das 19h." },
    { ...base, id: "a3", tipo: "ESCALA_SLOT", estado: "APPROVED", pessoa: { id: "Sofia", nome: "Sofia" }, data: shift(hoje, 1), inicio: "10:30", fim: "11:00", assunto: "Vídeo do Dia das Mães", motivo: "Gravação para as redes.", decisao: { por: "Deborah", em: hoje, motivo: null } },
    { ...base, id: "a4", tipo: "OTHER", estado: "DENIED", pessoa: { id: "Julia", nome: "Julia" }, data: null, inicio: null, fim: null, assunto: "Figurino", motivo: "O figurino do 2º ato está apertado.", decisao: { por: "Deborah", em: hoje, motivo: "Já pedimos ajuste à costura; fica pronto sexta." } },
  ];
  return rows.filter((p) => role !== "mem" || p.pessoa.nome === eu || p.colega?.nome === eu).map((p) => ({
    ...p, pode: { cancelar: p.pessoa.nome === eu && ABERTO(p.estado), responderColega: p.colega?.nome === eu && p.estado === "WAITING_PEER", decidir: (role === "adm" || role === "sup") && p.estado === "PENDING" && p.pessoa.nome !== eu },
  }));
}

export default function SolicitacoesPage({ role, meuId }: { role: Role; meuId: string | null }) {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [locais, setLocais] = useState<{ id: string; name: string }[]>([]);
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState(""), [aviso, setAviso] = useState(""), [tentativa, setTentativa] = useState(0);
  const gestor = role === "adm" || role === "sup";
  const [aba, setAba] = useState<"decidir" | "abertos" | "encerrados">(gestor ? "decidir" : "abertos");
  const [novo, setNovo] = useState<Tipo | "escolher" | null>(null);
  const [decidindo, setDecidindo] = useState<{ pedido: Pedido; decisao: "APPROVED" | "DENIED" } | null>(null);
  const [respondendo, setRespondendo] = useState<{ pedido: Pedido; aceita: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Erro de uma janela aberta aparece dentro dela (o aviso da página fica atrás da janela).
  const [erroJanela, setErroJanela] = useState("");
  useEffect(() => setErroJanela(""), [novo, decidindo, respondendo]);

  useEffect(() => {
    setCarregando(true); setErro("");
    if (review) { setPedidos(amostra(role)); setColegas([{ id: "Sofia", nome: "Sofia", area: "Patinadores" }, { id: "Carol", nome: "Carol", area: "Patinadores" }]); setCarregando(false); return; }
    const hoje = todayISO();
    Promise.all([
      customFetch<{ pedidos: Pedido[] }>("/api/solicitacoes"),
      customFetch<{ requests: Folga[] }>(`/api/leave-requests?from=${shift(hoje, -120)}&to=${shift(hoje, 365)}`).catch(() => ({ requests: [] as Folga[] })),
    ]).then(([s, f]) => {
      const folgas = f.requests.map((x) => daFolga(x, role, meuId));
      setPedidos([...s.pedidos, ...folgas].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))));
    }).catch(() => setErro("Não consegui carregar os pedidos agora.")).finally(() => setCarregando(false));
  }, [review, role, meuId, tentativa]);

  useEffect(() => {
    if (review || role === "dir") return;
    customFetch<{ colegas: Colega[] }>("/api/solicitacoes/colegas").then((r) => setColegas(r.colegas)).catch(() => undefined);
    if (gestor) customFetch<{ locais: { id: string; name: string }[] }>("/api/escalas/locais").then((r) => setLocais(r.locais)).catch(() => undefined);
  }, [review, role, gestor]);

  const paraDecidir = useMemo(() => pedidos.filter((p) => p.pode.decidir || p.pode.responderColega), [pedidos]);
  const abertos = useMemo(() => pedidos.filter((p) => ABERTO(p.estado)), [pedidos]);
  const encerrados = useMemo(() => pedidos.filter((p) => !ABERTO(p.estado)), [pedidos]);
  const lista = aba === "decidir" ? paraDecidir : aba === "abertos" ? abertos : encerrados;
  const recarregar = () => setTentativa((n) => n + 1);
  const trocarLocal = (id: string, novoPedido: Pedido) => setPedidos((rows) => rows.map((p) => (p.id === id ? novoPedido : p)));

  async function enviarNovo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!novo || novo === "escolher") return;
    const d = new FormData(event.currentTarget), v = (k: string) => String(d.get(k) ?? "").trim();
    setEnviando(true); setAviso("");
    try {
      if (novo === "LEAVE") {
        const body = { startDate: v("data"), endDate: v("ate") || v("data"), reason: v("motivo") };
        if (!review) await customFetch("/api/leave-requests", { method: "POST", body: JSON.stringify(body) });
        setAviso("Pedido de folga enviado. Ele também aparece na tela Folgas.");
      } else {
        const tipo = novo === "HEALTH_RESTRICTION" && v("restricao") === "PHYSICAL" ? "PHYSICAL_RESTRICTION" : novo;
        const body = { tipo, data: v("data") || undefined, ate: v("ate") || undefined, inicio: v("inicio") || undefined, fim: v("fim") || undefined, assunto: v("assunto") || undefined, motivo: v("motivo") || undefined, colegaId: v("colegaId") || undefined, localId: v("localId") || undefined };
        if (review) {
          const eu = REVIEW_PERSON[role];
          setPedidos((rows) => [{ id: `n${Date.now()}`, tipo, estado: tipo === "SWAP" ? "WAITING_PEER" : "PENDING", pessoa: { id: eu, nome: eu }, area: "Patinadores", local: "Snowland", colega: body.colegaId ? { id: body.colegaId, nome: body.colegaId } : null, data: body.data ?? null, ate: body.ate ?? null, inicio: body.inicio ?? null, fim: body.fim ?? null, assunto: body.assunto ?? null, motivo: body.motivo ?? null, oculto: false, decisao: null, criadoEm: todayISO(), pode: { cancelar: true, responderColega: false, decidir: false } }, ...rows]);
        } else await customFetch("/api/solicitacoes", { method: "POST", body: JSON.stringify(body) });
        setAviso(tipo === "SWAP" ? "Pedido de troca enviado. Primeiro a colega aceita; depois vai para a supervisão." : "Pedido enviado. Você recebe um aviso quando ele for decidido.");
      }
      setNovo(null); setAba("abertos");
      if (!review) recarregar();
    } catch (e) {
      setErroJanela(mensagemDe(e, "Não consegui enviar o pedido."));
    } finally { setEnviando(false); }
  }

  async function enviarDecisao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decidindo) return;
    const d = new FormData(event.currentTarget), motivo = String(d.get("motivo") ?? "").trim(), inicio = String(d.get("inicio") ?? ""), fim = String(d.get("fim") ?? "");
    const { pedido, decisao } = decidindo;
    setEnviando(true); setAviso("");
    try {
      if (review) trocarLocal(pedido.id, { ...pedido, estado: decisao, inicio: inicio || pedido.inicio, fim: fim || pedido.fim, decisao: { por: REVIEW_PERSON[role], em: todayISO(), motivo: motivo || null }, pode: { cancelar: false, responderColega: false, decidir: false } });
      else if (pedido.tipo === "LEAVE") await customFetch(`/api/leave-requests/${pedido.id.replace("folga:", "")}`, { method: "PATCH", body: JSON.stringify({ status: decisao, decisionReason: motivo }) });
      else await customFetch(`/api/solicitacoes/${pedido.id}/decisao`, { method: "POST", body: JSON.stringify({ decisao, motivo, inicio: inicio || undefined, fim: fim || undefined }) });
      setDecidindo(null);
      setAviso(decisao === "APPROVED" ? (pedido.tipo === "ESCALA_SLOT" ? "Aprovado. O horário já entrou na escala do dia." : pedido.tipo === "SWAP" ? "Troca aprovada. Faça o ajuste na Escala do dia." : "Aprovado. A pessoa recebe o aviso.") : "Recusado. A pessoa recebe o aviso com o motivo.");
      if (!review) recarregar();
    } catch (e) { setErroJanela(mensagemDe(e, "Não consegui registrar a decisão.")); } finally { setEnviando(false); }
  }

  async function enviarResposta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!respondendo) return;
    const motivo = String(new FormData(event.currentTarget).get("motivo") ?? "").trim();
    const { pedido, aceita } = respondendo;
    setEnviando(true); setAviso("");
    try {
      if (review) trocarLocal(pedido.id, { ...pedido, estado: aceita ? "PENDING" : "DENIED", pode: { cancelar: false, responderColega: false, decidir: false } });
      else await customFetch(`/api/solicitacoes/${pedido.id}/colega`, { method: "POST", body: JSON.stringify({ aceita, motivo }) });
      setRespondendo(null);
      setAviso(aceita ? "Você aceitou a troca. Agora ela vai para a supervisão." : "Você não aceitou a troca. A colega recebe o aviso.");
      if (!review) recarregar();
    } catch (e) { setErroJanela(mensagemDe(e, "Não consegui registrar a resposta.")); } finally { setEnviando(false); }
  }

  async function cancelar(pedido: Pedido) {
    if (!window.confirm("Cancelar este pedido?")) return;
    setAviso("");
    try {
      if (review) trocarLocal(pedido.id, { ...pedido, estado: "CANCELLED", pode: { cancelar: false, responderColega: false, decidir: false } });
      else { await customFetch(`/api/solicitacoes/${pedido.id}/cancelar`, { method: "POST" }); recarregar(); }
      setAviso("Pedido cancelado.");
    } catch (e) { setAviso(mensagemDe(e, "Não consegui cancelar.")); }
  }

  const abas: { id: typeof aba; rotulo: string; n: number }[] = [
    ...(gestor || paraDecidir.length ? [{ id: "decidir" as const, rotulo: gestor ? "Para decidir" : "Esperando você", n: paraDecidir.length }] : []),
    { id: "abertos", rotulo: "Em aberto", n: abertos.length },
    { id: "encerrados", rotulo: "Encerrados", n: encerrados.length },
  ];

  return <section className="cycle-page sol-page">
    <div className="cycle-toolbar">
      <div className="sol-abas" role="tablist">{abas.map((a) => <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? "active" : ""} onClick={() => setAba(a.id)}>{a.rotulo}{a.n ? <b>{a.n}</b> : null}</button>)}</div>
      <div>{role !== "dir" && <button className="cycle-primary" onClick={() => setNovo("escolher")}><Plus size={16}/> Novo pedido</button>}</div>
    </div>
    {aviso && <div className="sol-aviso" role="status">{aviso}</div>}
    {carregando ? <div className="cycle-state" aria-busy="true"><i/><i/><i/></div>
      : erro ? <div className="cycle-feedback error" role="alert">{erro}<button type="button" className="cycle-retry" onClick={recarregar}>Tentar de novo</button></div>
      : <div className="sol-layout">
        <article className="cycle-card sol-lista">
          {lista.length === 0 ? <div className="sol-vazio"><img src="/asa/oi.webp" alt=""/><p>{aba === "decidir" ? (gestor ? "Nenhum pedido esperando decisão sua." : "Nenhuma troca esperando você.") : aba === "abertos" ? "Nenhum pedido em aberto." : "Nada encerrado nos últimos meses."}</p>{role !== "dir" && aba !== "decidir" && <button className="cycle-secondary" onClick={() => setNovo("escolher")}><Plus size={15}/> Fazer um pedido</button>}</div>
            : lista.map((p) => <Linha key={p.id} p={p} role={role} meuId={meuId} review={review}
              onDecidir={(decisao) => setDecidindo({ pedido: p, decisao })} onResponder={(aceita) => setRespondendo({ pedido: p, aceita })} onCancelar={() => cancelar(p)} />)}
        </article>
        <aside className="cycle-stack">
          <article className="cycle-card"><span className="cycle-kicker">como funciona</span>
            <p>{role === "mem" ? "Você pede, a supervisão da sua área decide e você recebe o aviso. Horário aprovado entra sozinho na sua escala. Na troca, a colega aceita primeiro." : role === "sup" ? "Aqui chegam os pedidos da sua área. Recusar sempre pede motivo. No horário na escala, você pode aprovar em outro horário." : role === "adm" ? "Você vê os pedidos de todas as áreas. Normalmente a supervisão de cada área decide; você também pode." : "A Direção acompanha os pedidos. Detalhes de saúde ficam com a supervisão."}</p>
          </article>
          <article className="cycle-card"><span className="cycle-kicker">folgas</span><p>Folga também pode ser pedida aqui; ela entra na mesma fila da tela Folgas, com o calendário do grupo.</p><Link className="cycle-inline-link" href="/folgas">Abrir Folgas</Link></article>
        </aside>
      </div>}

    {novo === "escolher" && <div className="cycle-modal" onClick={(e) => { if (e.target === e.currentTarget) setNovo(null); }}><div>
      <header><h2>O que você precisa?</h2><button type="button" aria-label="Fechar" onClick={() => setNovo(null)}>×</button></header>
      <div className="sol-tipos">{TIPOS.map(({ tipo, nome, dica, Icon }) => <button key={tipo} type="button" onClick={() => setNovo(tipo)}><Icon size={20}/><b>{nome}</b><small>{dica}</small></button>)}</div>
    </div></div>}
    {novo && novo !== "escolher" && <div className="cycle-modal"><form onSubmit={enviarNovo}>
      <header><h2>{TIPOS.find((t) => t.tipo === novo)?.nome}</h2><button type="button" aria-label="Fechar" onClick={() => setNovo(null)}>×</button></header>
      <CamposNovo tipo={novo} colegas={colegas} locais={locais} />
      {erroJanela && <p className="sol-erro" role="alert">{erroJanela}</p>}
      <footer><button type="button" className="cycle-secondary" onClick={() => setNovo("escolher")}>Voltar</button><button className="cycle-primary" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button></footer>
    </form></div>}
    {decidindo && <div className="cycle-modal"><form onSubmit={enviarDecisao}>
      <header><h2>{decidindo.decisao === "APPROVED" ? "Aprovar" : "Recusar"}</h2><button type="button" aria-label="Fechar" onClick={() => setDecidindo(null)}>×</button></header>
      <p className="sol-resumo"><b>{decidindo.pedido.pessoa.nome}</b> · {NOME[decidindo.pedido.tipo]}{decidindo.pedido.assunto ? ` · ${decidindo.pedido.assunto}` : ""}<br/>{quando(decidindo.pedido)}</p>
      {decidindo.decisao === "APPROVED" && decidindo.pedido.tipo === "ESCALA_SLOT" && <fieldset className="sol-horario"><legend>Horário (mude se for aprovar em outro)</legend><label>De<input name="inicio" type="time" defaultValue={decidindo.pedido.inicio ?? ""} required/></label><label>Até<input name="fim" type="time" defaultValue={decidindo.pedido.fim ?? ""} required/></label></fieldset>}
      <label>{decidindo.decisao === "DENIED" || decidindo.pedido.tipo === "LEAVE" ? "Motivo (a pessoa vai ler)" : "Motivo (obrigatório se mudar o horário)"}<textarea name="motivo" required={decidindo.decisao === "DENIED" || decidindo.pedido.tipo === "LEAVE"} minLength={2}/></label>
      {decidindo.decisao === "APPROVED" && decidindo.pedido.tipo === "SWAP" && <p className="sol-nota">Depois de aprovar, faça a troca na Escala do dia.</p>}
      {erroJanela && <p className="sol-erro" role="alert">{erroJanela}</p>}
      <footer><button className="cycle-primary" disabled={enviando}>{enviando ? "Salvando…" : "Confirmar"}</button></footer>
    </form></div>}
    {respondendo && <div className="cycle-modal"><form onSubmit={enviarResposta}>
      <header><h2>{respondendo.aceita ? "Aceitar a troca" : "Não aceitar a troca"}</h2><button type="button" aria-label="Fechar" onClick={() => setRespondendo(null)}>×</button></header>
      <p className="sol-resumo"><b>{respondendo.pedido.pessoa.nome}</b> quer trocar com você · {quando(respondendo.pedido)}<br/>{respondendo.pedido.motivo}</p>
      {!respondendo.aceita && <label>Por que não dá? (ela vai ler)<textarea name="motivo" required minLength={2}/></label>}
      {respondendo.aceita && <p className="sol-nota">Depois de você aceitar, a supervisão decide.</p>}
      {erroJanela && <p className="sol-erro" role="alert">{erroJanela}</p>}
      <footer><button className="cycle-primary" disabled={enviando}>{enviando ? "Salvando…" : "Confirmar"}</button></footer>
    </form></div>}
  </section>;
}

function mensagemDe(e: unknown, padrao: string) {
  const data = (e as { data?: { message?: string } } | null)?.data;
  return typeof data?.message === "string" ? data.message : padrao;
}

function Linha({ p, role, meuId, review, onDecidir, onResponder, onCancelar }: { p: Pedido; role: Role; meuId: string | null; review: boolean; onDecidir: (d: "APPROVED" | "DENIED") => void; onResponder: (aceita: boolean) => void; onCancelar: () => void }) {
  const eu = review ? REVIEW_PERSON[role] : null;
  const minha = review ? p.pessoa.nome === eu : p.pessoa.id === meuId;
  const est = ESTADO[p.estado];
  const Icon = TIPOS.find((t) => t.tipo === p.tipo || (p.tipo === "PHYSICAL_RESTRICTION" && t.tipo === "HEALTH_RESTRICTION"))?.Icon ?? MessageSquareText;
  return <div className="sol-linha">
    <span className="sol-icone"><Icon size={18}/></span>
    <div className="sol-corpo">
      <div className="sol-titulo"><strong>{p.assunto ?? NOME[p.tipo]}</strong>{p.assunto && <small>{NOME[p.tipo]}</small>}<span className={`sol-estado ${est.tom}`}>{est.rotulo}</span></div>
      <small className="sol-meta">{[minha ? "Você" : p.pessoa.nome, p.area, quando(p), p.local].filter(Boolean).join(" · ")}</small>
      {p.colega && <small className="sol-meta">Troca com {p.colega.id === meuId || p.colega.nome === eu ? "você" : p.colega.nome}</small>}
      {p.oculto ? <p className="sol-texto mute">Detalhe de saúde com a supervisão da área.</p> : p.motivo && <p className="sol-texto">{p.motivo}</p>}
      {p.decisao?.motivo && <p className={`sol-decisao ${p.estado === "DENIED" ? "bad" : ""}`}><b>{p.decisao.por ?? "Decisão"}:</b> {p.decisao.motivo}</p>}
      {p.estado === "APPROVED" && p.tipo === "ESCALA_SLOT" && <p className="sol-decisao ok">Na escala de {p.data ? diaCurto(p.data) : "hoje"}, das {p.inicio} às {p.fim}.</p>}
    </div>
    <div className="sol-acoes">
      {p.pode.decidir && <><button className="sol-sim" onClick={() => onDecidir("APPROVED")}>Aprovar</button><button className="sol-nao" onClick={() => onDecidir("DENIED")}>Recusar</button></>}
      {p.pode.responderColega && <><button className="sol-sim" onClick={() => onResponder(true)}>Aceitar troca</button><button className="sol-nao" onClick={() => onResponder(false)}>Não dá</button></>}
      {p.pode.cancelar && <button className="sol-nao" onClick={onCancelar}>Cancelar</button>}
      {p.tipo === "LEAVE" && <Link className="cycle-inline-link" href="/folgas">ver em Folgas</Link>}
    </div>
  </div>;
}

function CamposNovo({ tipo, colegas, locais }: { tipo: Tipo; colegas: Colega[]; locais: { id: string; name: string }[] }) {
  const hoje = todayISO();
  const data = <label>Dia<input name="data" type="date" min={hoje} defaultValue={shift(hoje, 1)} required/></label>;
  const local = locais.length > 1 ? <label>Local<select name="localId" defaultValue="">{[<option key="" value="">O meu local de sempre</option>, ...locais.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)]}</select></label> : null;
  if (tipo === "ESCALA_SLOT") return <>
    <label>Para quê?<input name="assunto" required maxLength={120} placeholder="Ex.: peruca, gravar vídeo do Dia das Mães"/></label>
    {data}
    <div className="sol-duas"><label>De<input name="inicio" type="time" required/></label><label>Até<input name="fim" type="time" required/></label></div>
    {local}
    <label>Algum detalhe? (opcional)<textarea name="motivo" maxLength={600}/></label>
    <p className="sol-nota">Aprovado, o horário entra sozinho na sua escala daquele dia.</p>
  </>;
  if (tipo === "SWAP") return <>
    {data}
    <label>Com quem?<select name="colegaId" required defaultValue=""><option value="" disabled>Escolha a colega</option>{colegas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.area ? ` · ${c.area}` : ""}</option>)}</select></label>
    <label>O que vocês querem trocar?<textarea name="motivo" required minLength={2} maxLength={600} placeholder="Ex.: eu faço o show das 16h dela, ela faz o meu das 19h"/></label>
    <p className="sol-nota">A colega recebe o pedido e aceita primeiro. Depois vai para a supervisão.</p>
  </>;
  if (tipo === "SCHEDULE_CHANGE") return <>
    {data}
    <div className="sol-duas"><label>Entrar às (opcional)<input name="inicio" type="time"/></label><label>Sair às (opcional)<input name="fim" type="time"/></label></div>
    <label>Conte o que precisa<textarea name="motivo" required minLength={2} maxLength={600}/></label>
  </>;
  if (tipo === "HEALTH_RESTRICTION") return <>
    <label>Tipo<select name="restricao" defaultValue="HEALTH"><option value="HEALTH">Saúde</option><option value="PHYSICAL">Físico (lesão, movimento)</option></select></label>
    <div className="sol-duas"><label>De<input name="data" type="date" min={hoje} defaultValue={hoje} required/></label><label>Até<input name="ate" type="date" min={hoje} defaultValue={shift(hoje, 7)} required/></label></div>
    <label>O que você não pode fazer?<textarea name="motivo" required minLength={2} maxLength={600}/></label>
    <p className="sol-nota">Só você, a supervisão da sua área e a Administração leem o detalhe.</p>
  </>;
  if (tipo === "LEAVE") return <>
    <div className="sol-duas"><label>Começa<input name="data" type="date" min={hoje} defaultValue={shift(hoje, 1)} required/></label><label>Termina<input name="ate" type="date" min={hoje} defaultValue={shift(hoje, 1)} required/></label></div>
    <label>Conte o necessário<textarea name="motivo" required minLength={2} maxLength={600}/></label>
    <p className="sol-nota">Vai para a mesma fila da tela Folgas.</p>
  </>;
  return <>
    <label>Assunto<input name="assunto" required maxLength={120} placeholder="Ex.: figurino, transporte"/></label>
    <label>Dia (se tiver)<input name="data" type="date" min={hoje}/></label>
    <label>Conte o pedido<textarea name="motivo" required minLength={2} maxLength={600}/></label>
  </>;
}
