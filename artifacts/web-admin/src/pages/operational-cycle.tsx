import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, Info, Plus, Settings2, UserRoundCheck } from "lucide-react";
import { customFetch, ApiError } from "@workspace/api-client-react";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { todayISO } from "@/lib/review-escala";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import { PeriodoDeDatas } from "@/components/periodo-de-datas";
import { AnaliseDoPedido } from "./folga-analise";
import { useAuth } from "@/hooks/useAuth";
import { FolgasGrid, type FolgasPublicacao } from "@/components/folgas-grid";
import "./operational-cycle.css";

type Role = "adm" | "dir" | "sup" | "mem";
type LeaveRequest = { id: string; userId: string; userName?: string; areaName?: string | null; startDate: string; endDate: string; reason: string; status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED"; decisionReason?: string | null; jaTemFolga?: boolean; alternativa?: { dias: string[]; souEu: boolean; estado: "ESPERANDO" | "ACEITA" | "RECUSADA"; motivoRecusa: string | null }; troca?: { colegaId: string; colegaNome: string | null; diaDevolvido: string | null; estado: "ESPERANDO" | "ACEITA" | "RECUSADA"; motivoRecusa: string | null; souEu: boolean }; destino?: { quem: "SUPERVISAO" | "ADMINISTRACAO"; area: string | null; adminPodeDecidirEm: string | null; adminPodeAgora: boolean } };
type FolgaAtiva = { id: string; userId: string; userName: string; startDate: string; endDate: string; type: string; status: "ACTIVE" };
type FolgaGrupo = { id: string; nome: string; diasFolga: number[]; dataInicio: string | null; dataFim: string | null; tipo: string; active: boolean; editavel: boolean; pessoas: { id: string; name: string }[] };
type DayBlock = { key: string; rotulo: string; inicio: string; fim: string | null; pessoaIds: string[]; dailyBookId: string | null; vazio: boolean; sinal: string | null; scaleId?: string; locationName?: string };
type CheckIn = { id: string; sourceKey: string; userId: string; status: string; reason?: string | null; etaMinutes?: number | null };
type Occurrence = { id: string; personId: string; personName: string; date: string; type: string; description: string; state: "aberta" | "em_analise" | "resolvida" };

const PEOPLE = exampleData.pessoas.map((p) => ({ id: p.nome_de_exibicao, name: p.nome_de_exibicao, area: exampleData.areas.find((a) => a.id === p.area)?.nome ?? p.area }));
const LOCATIONS = exampleData.locais.map((l) => ({ id: l.id, name: l.nome }));
import { REVIEW_PERSON } from "@/lib/amostra";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "28 de outubro"; um dia só não repete a data, e período curto no mesmo mês não repete o mês. */
const porExtenso = (inicio: string, fim: string) => {
  const [, m1, d1] = inicio.split("-").map(Number), [, m2, d2] = fim.split("-").map(Number);
  if (inicio === fim) return `${d1} de ${MONTHS[m1! - 1]}`;
  return m1 === m2 ? `${d1} a ${d2} de ${MONTHS[m1! - 1]}` : `${d1} de ${MONTHS[m1! - 1]} a ${d2} de ${MONTHS[m2! - 1]}`;
};
const weekLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const label = (date: string) => { const [y, m, d] = date.split("-").map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}`; };
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const roleCanWrite = (role: Role) => role === "adm" || role === "sup";
// A Direção só lê, mas lê o mesmo Mapa do mês que a gestão (sem botões de marcar, publicar ou repetir; o servidor manda editable=false).
const roleCanSeeMap = (role: Role) => roleCanWrite(role) || role === "dir";
const STATUS_PEDIDO: Record<LeaveRequest["status"], string> = { PENDING: "pendente", APPROVED: "aprovada", DENIED: "recusada", CANCELLED: "retirada" };

type DirectoryPerson = { id: string; name: string; area: string | null };
/** Pessoas e locais: a amostra usa o dados-de-exemplo.json; fora dela, a API — que já recorta pelo escopo do perfil. */
function useCycleDirectory(review: boolean, role: Role) {
  const [people, setPeople] = useState<DirectoryPerson[]>(review ? PEOPLE : []);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>(review ? LOCATIONS : []);
  const [ready, setReady] = useState(review);
  const [falhou, setFalhou] = useState(false), [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (review) return;
    let cancelled = false;
    setFalhou(false);
    Promise.all([
      customFetch<{ users?: { id: string; name: string; areaName?: string | null }[] }>("/api/users").catch(() => { if (!cancelled) setFalhou(true); return { users: [] }; }),
      role === "mem" ? Promise.resolve({ locais: [] }) : customFetch<{ locais: { id: string; name: string }[] }>("/api/escalas/locais").catch(() => { if (!cancelled) setFalhou(true); return { locais: [] }; }),
    ]).then(([users, locais]) => {
      if (cancelled) return;
      setPeople((users.users ?? []).map((user) => ({ id: user.id, name: user.name, area: user.areaName ?? "Sem área" })));
      setLocations(locais.locais.map((local) => ({ id: local.id, name: local.name })));
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [review, role, tentativa]);
  return { people, locations, ready, falhou, recarregar: () => setTentativa((n) => n + 1) };
}

function State({ error, loading, empty, children, onRetry }: { error: string; loading: boolean; empty: boolean; children: React.ReactNode; onRetry?: () => void }) {
  if (loading) return <div className="cycle-state" aria-busy="true"><i/><i/><i/></div>;
  if (error) return <div className="cycle-feedback error" role="alert"><CircleAlert/> {error}{onRetry && <button type="button" className="cycle-retry" onClick={onRetry}>Tentar de novo</button>}</div>;
  if (empty) return <div className="cycle-feedback"><img src="/asa/oi.webp" alt=""/> Ainda não há nada para este recorte.</div>;
  return <>{children}</>;
}

function MonthGrid({ selected, requests, people, onSelect }: { selected: Date; requests: LeaveRequest[]; people: typeof PEOPLE; onSelect?: (date: string) => void }) {
  const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const days = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const blanks = Array.from({ length: start.getDay() }, (_, i) => <span className="cycle-day blank" key={`blank-${i}`}/>);
  const cells = Array.from({ length: days }, (_, index) => {
    const d = new Date(selected.getFullYear(), selected.getMonth(), index + 1), key = iso(d);
    const approved = requests.filter((request) => request.status === "APPROVED" && request.startDate <= key && request.endDate >= key);
    const pending = requests.filter((request) => request.status === "PENDING" && request.startDate <= key && request.endDate >= key);
    return <button type="button" className="cycle-day" key={key} onClick={() => onSelect?.(key)} title={`${approved.length} folga(s) aprovada(s), ${pending.length} pendente(s)`}><b>{index + 1}</b>{approved.slice(0, 3).map((request) => <span className="cycle-dot approved" key={request.id}>{initials(request.userName ?? people.find((p) => p.id === request.userId)?.name ?? "")}</span>)}{pending.slice(0, 2).map((request) => <span className="cycle-dot pending" key={request.id}>{initials(request.userName ?? people.find((p) => p.id === request.userId)?.name ?? "")}</span>)}</button>;
  });
  return <div className="cycle-calendar"><div className="cycle-week">{weekLabel.map((day) => <span key={day}>{day}</span>)}</div><div className="cycle-days">{blanks}{cells}</div></div>;
}

export function FolgasPage({ role }: { role: Role }) {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const me = REVIEW_PERSON[role];
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [requests, setRequests] = useState<LeaveRequest[]>([]), [folgasAtivas, setFolgasAtivas] = useState<FolgaAtiva[]>([]), [folgasPublicadas, setFolgasPublicadas] = useState(false), [retratoInicial, setRetratoInicial] = useState(false), [precisaRepublicar, setPrecisaRepublicar] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [askOpen, setAskOpen] = useState(false), [regimeOpen, setRegimeOpen] = useState(false), [calendarOpen, setCalendarOpen] = useState(false), [decision, setDecision] = useState<{ request: LeaveRequest; status: "APPROVED" | "DENIED" } | null>(null), [resposta, setResposta] = useState<{ request: LeaveRequest; aceita: boolean; tipo: "troca" | "alternativa" } | null>(null), [respostaErro, setRespostaErro] = useState(""), [respondendo, setRespondendo] = useState(false), [regrasOpen, setRegrasOpen] = useState(false), [pedidoFeito, setPedidoFeito] = useState(""), [prioridades, setPrioridades] = useState<{ id: string; userName: string; areaName: string | null; startDate: string; endDate: string }[]>([]), [desfazer, setDesfazer] = useState<{ id: string; userName: string; startDate: string; endDate: string } | null>(null), [desfazerErro, setDesfazerErro] = useState(""), [desfazendo, setDesfazendo] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  useEffect(() => {
    if (!askOpen && !regimeOpen && !calendarOpen && !decision && !resposta && !desfazer) return;
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAskOpen(false); setRegimeOpen(false); setCalendarOpen(false); setDecision(null); setResposta(null); setDesfazer(null);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [askOpen, regimeOpen, calendarOpen, decision, resposta, desfazer]);
  const from = iso(new Date(month.getFullYear(), month.getMonth(), 1)), to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const { user, roles } = useAuth();
  const operationId = roles[0]?.operationId ?? "";
  const [groupBy, setGroupBy] = useState(true), [mapInfoOpen, setMapInfoOpen] = useState(false), [memberFilter, setMemberFilter] = useState(""), [managerTab, setManagerTab] = useState<"map" | "grupos" | "records">("map"), [repeating, setRepeating] = useState(false);
  const [gridRevision, setGridRevision] = useState(0);
  // Grupos de folga: padrão (pessoas + os dois dias) por equipe. Guardam só o padrão; o período é
  // escolhido na hora de aplicar, porque os grupos mudam a cada ano.
  const [grupos, setGrupos] = useState<FolgaGrupo[]>([]), [grupoEdit, setGrupoEdit] = useState<FolgaGrupo | "novo" | null>(null), [grupoAplicar, setGrupoAplicar] = useState<FolgaGrupo | null>(null), [grupoErro, setGrupoErro] = useState(""), [verArquivados, setVerArquivados] = useState(false), [gruposRevision, setGruposRevision] = useState(0);
  // A publicação guarda a versão que o Elenco vê; edições posteriores esperam republicação.
  const [publicacao, setPublicacao] = useState<FolgasPublicacao | null>(null), [publishing, setPublishing] = useState(false), [publishMsg, setPublishMsg] = useState("");
  useEffect(() => { setPublicacao(null); setPublishMsg(""); }, [month]);
  const directory = useCycleDirectory(review, role);
  const visiblePeople = useMemo(() => review ? (role === "mem" ? PEOPLE.filter((person) => person.name === me) : role === "sup" ? PEOPLE.filter((person) => person.area === "Patinadores") : PEOPLE) : role === "mem" ? directory.people.filter((person) => person.id === user?.id) : directory.people, [review, role, me, directory.people, user?.id]);
  // Fora da amostra o servidor já devolve só os pedidos do escopo de quem pergunta.
  const visibleRequests = useMemo(() => review ? requests.filter((request) => visiblePeople.some((person) => person.id === request.userId)) : requests, [review, requests, visiblePeople]);
  // Pedido aprovado pode ter sido cancelado depois. O calendário mostra a folga ativa,
  // enquanto os pedidos pendentes continuam vindo da fila de solicitações.
  const calendarEntries = useMemo(() => role === "mem" && !review ? [
    ...folgasAtivas.filter((folga) => folga.type === "DAY_OFF" || folga.type === "NO_SHOW").map((folga): LeaveRequest => ({ id: `folga-${folga.id}`, userId: folga.userId, userName: folga.userName, startDate: folga.startDate, endDate: folga.endDate, reason: "Folga definida", status: "APPROVED" })),
    ...visibleRequests.filter((request) => request.status === "PENDING" && !request.troca?.souEu),
  ] : visibleRequests, [role, review, folgasAtivas, visibleRequests]);
  const scopeTitle = review ? "Patinadores" : [...new Set(visiblePeople.map((person) => person.area).filter((area) => area !== "Sem área"))].join(" · ") || "Sua área";
  const reload = () => {
    setLoading(true); setError("");
    if (review) { setRequests([{ id: "sample-folga-sofia", userId: "Sofia", userName: "Sofia", areaName: "Patinadores", startDate: from, endDate: from, reason: "Folga planejada", status: "APPROVED" }, { id: "sample-pedido-julia", userId: "Julia", userName: "Julia", areaName: "Patinadores", startDate: to, endDate: to, reason: "Compromisso pessoal", status: "PENDING", jaTemFolga: true }]); setLoading(false); return; }
    Promise.all([
      customFetch<{ requests: LeaveRequest[] }>(`/api/leave-requests?from=${from}&to=${to}`),
      role === "mem" ? customFetch<{ folgas: FolgaAtiva[]; publicada: boolean; retratoInicial: boolean; precisaRepublicar: boolean }>(`/api/folgas/publicadas?year=${month.getFullYear()}&month=${month.getMonth() + 1}`) : Promise.resolve({ folgas: [] as FolgaAtiva[], publicada: false, retratoInicial: false, precisaRepublicar: false }),
      roleCanWrite(role) ? customFetch<{ pedidos: { id: string; userName: string; areaName: string | null; startDate: string; endDate: string }[] }>("/api/leave-requests/prioridades").catch((e: unknown) => e instanceof ApiError && e.status === 403 ? ({ pedidos: [] }) : Promise.reject(e)) : Promise.resolve({ pedidos: [] }),
    ]).then(([list, folgas, prio]) => { setPrioridades(prio.pedidos); setRequests(list.requests); setFolgasAtivas(folgas.folgas); setFolgasPublicadas(folgas.publicada); setRetratoInicial(folgas.retratoInicial); setPrecisaRepublicar(folgas.precisaRepublicar); }).catch(() => setError("Não consegui carregar as folgas agora.")).finally(() => setLoading(false));
  };
  useEffect(reload, [from, to, review, role]);
  // Erro de janela aberta aparece dentro dela: o erro da página troca o conteúdo todo por um aviso, e a
  // pessoa perderia de vista o que acabou de digitar por causa de uma recusa que tinha explicação.
  const [avisoFila, setAvisoFila] = useState(""), [pedidoErro, setPedidoErro] = useState(""), [decisaoErro, setDecisaoErro] = useState(""), [enviando, setEnviando] = useState(false);
  useEffect(() => { if (askOpen) setPedidoErro(""); }, [askOpen]);
  const requestLeave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget); const body = { startDate: String(data.get("startDate")), endDate: String(data.get("endDate")), reason: String(data.get("reason")).trim() };
    setPedidoErro("");
    if (review) { setRequests((rows) => [{ id: `sample-${Date.now()}`, userId: me, userName: me, areaName: visiblePeople[0]?.area, ...body, status: "PENDING" }, ...rows]); setAskOpen(false); return; }
    setEnviando(true);
    try {
      await customFetch("/api/leave-requests", { method: "POST", body: JSON.stringify(body) });
      setPedidoFeito(`Pedido enviado para ${porExtenso(body.startDate, body.endDate)}. A Supervisão da sua área responde, e você vê a resposta aqui e no sino.`);
      setAskOpen(false); reload();
    }
    catch (e) { setPedidoErro(mensagemDoErro(e, "Não consegui enviar o pedido agora. Nada foi enviado; tente de novo.")); }
    finally { setEnviando(false); }
  };
  const responderTroca = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resposta) return;
    const motivo = String(new FormData(event.currentTarget).get("motivo") ?? "").trim();
    setRespostaErro("");
    if (!resposta.aceita && !motivo && resposta.tipo === "troca") { setRespostaErro("Recusar pede o motivo: a Supervisão vai ler."); return; }
    setRespondendo(true);
    try { await customFetch(`/api/leave-requests/${resposta.request.id}/${resposta.tipo === "troca" ? "troca" : "alternativa"}/resposta`, { method: "POST", body: JSON.stringify({ aceita: resposta.aceita, motivo }) }); setResposta(null); reload(); }
    catch (e) { setRespostaErro(mensagemDoErro(e, "Não consegui registrar a sua resposta agora. A troca continua esperando você; tente de novo.")); }
    finally { setRespondendo(false); }
  };
  const desfazerPrioridade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!desfazer) return;
    const motivo = String(new FormData(event.currentTarget).get("motivo") ?? "").trim();
    if (motivo.length < 2) { setDesfazerErro("Desfazer pede o motivo: a pessoa vai ler."); return; }
    setDesfazendo(true); setDesfazerErro("");
    try { await customFetch(`/api/leave-requests/${desfazer.id}/desfazer`, { method: "POST", body: JSON.stringify({ motivo }) }); setDesfazer(null); reload(); }
    catch (e) { setDesfazerErro(mensagemDoErro(e, "Não consegui desfazer a folga agora. Ela continua valendo; tente de novo.")); }
    finally { setDesfazendo(false); }
  };
  const retirarProposta = async (request: LeaveRequest) => {
    const dias = request.alternativa?.estado === "ESPERANDO";
    if (!window.confirm(dias ? "Retirar a proposta de dias? A pessoa não precisa mais responder." : `Retirar a proposta de troca com ${request.troca?.colegaNome ?? "o colega"}? Ele não precisa mais responder.`)) return;
    try { await customFetch(`/api/leave-requests/${request.id}/${dias ? "alternativa" : "troca"}/retirar`, { method: "POST" }); reload(); }
    catch (e) { setError(mensagemDoErro(e, "Não consegui retirar a proposta agora. Ela continua esperando o colega; tente de novo.")); }
  };
  const withdrawRequest = async (request: LeaveRequest) => {
    if (!window.confirm(`Retirar seu pedido de folga de ${request.startDate} a ${request.endDate}?`)) return;
    if (review) { setRequests((rows) => rows.map((row) => row.id === request.id ? { ...row, status: "CANCELLED" } : row)); return; }
    try { await customFetch(`/api/leave-requests/${request.id}/cancelar`, { method: "POST" }); reload(); }
    catch { setError("Não consegui retirar o pedido. Ele continua na fila; tente de novo."); }
  };
  const decide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setDecisaoErro("");
    if (decision.status === "DENIED" && !reason) { setDecisaoErro("Recusar pede o motivo: a pessoa vai ler."); return; }
    if (review) { setRequests((rows) => rows.map((item) => item.id === decision.request.id ? { ...item, status: decision.status, decisionReason: reason } : item)); setDecision(null); return; }
    setEnviando(true);
    try { const r = await customFetch<{ aviso?: string }>(`/api/leave-requests/${decision.request.id}`, { method: "PATCH", body: JSON.stringify({ status: decision.status, decisionReason: reason }) }); setAvisoFila(r?.aviso ?? (decision.status === "APPROVED" ? "Aprovada. A pessoa recebe o aviso; a folga aparece para o Elenco quando a Administração publicar o mês." : "Recusada. A pessoa recebe o aviso com o motivo.")); setDecision(null); setGridRevision((value) => value + 1); reload(); }
    catch (e) { setDecisaoErro(mensagemDoErro(e, "Não consegui registrar a decisão agora. O pedido continua na fila; tente de novo.")); }
    finally { setEnviando(false); }
  };
  const putOnCalendar = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const body = { operationId, userIds: data.getAll("userIds").map(String), startDate: String(data.get("startDate")), endDate: String(data.get("endDate")), reason: String(data.get("reason")) }; if (!body.userIds.length) { setCalendarError("Escolha ao menos uma pessoa para a folga."); return; } if (review) { setRequests((rows) => [...body.userIds.map((userId, index) => { const person = visiblePeople.find((item) => item.id === userId); return { id: `sample-calendar-${Date.now()}-${index}`, userId, userName: person?.name, areaName: person?.area, startDate: body.startDate, endDate: body.endDate, reason: body.reason, status: "APPROVED" as const }; }), ...rows]); setCalendarOpen(false); return; } try { await customFetch("/api/leave-calendar", { method: "POST", body: JSON.stringify(body) }); setCalendarOpen(false); setGridRevision((value) => value + 1); reload(); } catch { setError("Não consegui colocar a folga no calendário."); } };
  /** Marca (ou limpa) folga de várias pessoas em várias datas, num pedido só. */
  const marcarFolgas = async (v: { userIds: string[]; datas: string[]; tipo: string | null; motivo: string }) => {
    if (!operationId) { setCalendarError("Sem operação associada ao seu perfil."); return; }
    if (review) { setCalendarOpen(false); return; }
    try {
      await customFetch("/api/folgas/grid/bulk", { method: "POST", body: JSON.stringify({
        operationId, userIds: v.userIds, dates: v.datas, type: v.tipo, motivo: v.motivo,
      }) });
      setCalendarOpen(false); setGridRevision((value) => value + 1); reload();
    } catch { setCalendarError("Não consegui marcar as folgas. Nada foi alterado; tente de novo."); }
  };
  // Carrega os grupos salvos (gestão). Na amostra, grupos de exemplo para dar o que revisar.
  useEffect(() => {
    if (!roleCanWrite(role)) return;
    if (review) {
      const nome = (n: number) => visiblePeople.slice(n, n + 3).map((p) => ({ id: p.id, name: p.name }));
      const ano = month.getFullYear();
      setGrupos([
        { id: "amostra-g1", nome: "Grupo 1 — seg e ter", diasFolga: [1, 2], dataInicio: null, dataFim: null, tipo: "DAY_OFF", active: true, editavel: true, pessoas: nome(0) },
        { id: "amostra-g2", nome: "Grupo 2 — qua e qui", diasFolga: [3, 4], dataInicio: null, dataFim: null, tipo: "DAY_OFF", active: true, editavel: role !== "sup", pessoas: nome(3) },
        { id: "amostra-g3", nome: "Recesso de fim de ano", diasFolga: [], dataInicio: `${ano}-12-24`, dataFim: `${ano}-12-26`, tipo: "RECESSO", active: true, editavel: true, pessoas: nome(0) },
      ]);
      return;
    }
    if (!operationId) { setGrupos([]); return; }
    customFetch<{ grupos: FolgaGrupo[] }>(`/api/folgas/grupos?operationId=${operationId}${verArquivados ? "&incluirArquivados=1" : ""}`)
      .then((r) => setGrupos(r.grupos)).catch(() => setGrupoErro("Não consegui carregar os grupos de folga."));
  }, [review, role, operationId, verArquivados, gruposRevision, visiblePeople, month]);
  const salvarGrupo = async (v: { id?: string; nome: string; diasFolga: number[]; dataInicio: string | null; dataFim: string | null; pessoaIds: string[]; tipo: string }) => {
    if (review) { setGrupoEdit(null); return; }
    if (!operationId) { setGrupoErro("Sem operação associada ao seu perfil."); return; }
    const corpo = { nome: v.nome, diasFolga: v.diasFolga, dataInicio: v.dataInicio, dataFim: v.dataFim, pessoaIds: v.pessoaIds, tipo: v.tipo };
    try {
      if (v.id) await customFetch(`/api/folgas/grupos/${v.id}`, { method: "PATCH", body: JSON.stringify(corpo) });
      else await customFetch("/api/folgas/grupos", { method: "POST", body: JSON.stringify({ operationId, ...corpo }) });
      setGrupoEdit(null); setGruposRevision((n) => n + 1);
    } catch { setGrupoErro("Não consegui salvar o grupo. Nada foi alterado; tente de novo."); }
  };
  const arquivarGrupo = async (grupo: FolgaGrupo) => {
    if (!window.confirm(`Arquivar o grupo "${grupo.nome}"? As folgas já aplicadas continuam; dá para restaurar depois.`)) return;
    if (review) { setGrupos((gs) => gs.filter((g) => g.id !== grupo.id)); return; }
    try { await customFetch(`/api/folgas/grupos/${grupo.id}`, { method: "DELETE" }); setGruposRevision((n) => n + 1); }
    catch { setGrupoErro("Não consegui arquivar o grupo. Ele continua; tente de novo."); }
  };
  const restaurarGrupo = async (grupo: FolgaGrupo) => {
    if (review) { setGrupos((gs) => gs.map((g) => g.id === grupo.id ? { ...g, active: true } : g)); return; }
    try { await customFetch(`/api/folgas/grupos/${grupo.id}/restaurar`, { method: "POST" }); setGruposRevision((n) => n + 1); }
    catch { setGrupoErro("Não consegui restaurar o grupo; tente de novo."); }
  };
  /** Aplicar um grupo é marcar a folga dos dois dias no período escolhido — reusa o lote. */
  const aplicarGrupo = async (grupo: FolgaGrupo, de: string, ate: string) => {
    const datas = datasDoGrupo(grupo, de, ate);
    if (!datas.length) { setGrupoErro("O período escolhido não tem nenhum dia para marcar."); return; }
    if (review) { setGrupoAplicar(null); return; }
    if (!operationId) { setGrupoErro("Sem operação associada ao seu perfil."); return; }
    try {
      await customFetch("/api/folgas/grid/bulk", { method: "POST", body: JSON.stringify({ operationId, userIds: grupo.pessoas.map((p) => p.id), dates: datas, type: grupo.tipo, motivo: `Grupo de folga: ${grupo.nome}` }) });
      setGrupoAplicar(null); setGridRevision((n) => n + 1); reload();
    } catch { setGrupoErro("Não consegui aplicar o grupo. Nada foi alterado; tente de novo."); }
  };
  const publishMonth = async () => {
    if (!operationId || publishing) return;
    setPublishing(true); setPublishMsg("");
    try {
      const r = await customFetch<{ avisados: number; publicacao: FolgasPublicacao }>("/api/folgas/grid/publicar", { method: "POST", body: JSON.stringify({ operationId, year: month.getFullYear(), month: month.getMonth() + 1 }) });
      setPublicacao(r.publicacao); setPublishMsg(`${r.avisados} ${r.avisados === 1 ? "pessoa avisada" : "pessoas avisadas"}.`);
    } catch { setPublishMsg("Não consegui publicar agora. O mapa continua como está; tente de novo."); }
    finally { setPublishing(false); }
  };
  const repeatPrevious = async () => { if (!operationId || repeating) return; setRepeating(true); try { await customFetch("/api/folgas/grid/repeat", { method: "POST", body: JSON.stringify({ operationId, year: month.getFullYear(), month: month.getMonth() + 1 }) }); window.location.reload(); } catch { setError("Não consegui repetir a configuração do mês anterior."); setRepeating(false); } };
  const managerMap = roleCanSeeMap(role) && !review ? <><div className="cycle-toolbar"><div><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight/></button></div><div><span className={`cycle-tag ${publicacao?.publishedAt && !publicacao.changedSince ? "" : "warn"}`} title={publicacao?.publishedBy ? `por ${publicacao.publishedBy}` : undefined}>{!publicacao ? "…" : !publicacao.publishedAt ? "mês não publicado" : publicacao.changedSince ? "mudou depois de publicar" : `publicado em ${new Date(publicacao.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}</span>{publishMsg && <span className="cycle-publish-msg" role="status">{publishMsg}</span>}{role === "adm" && <button className="cycle-secondary" type="button" onClick={() => void repeatPrevious()} disabled={repeating}>{repeating ? "Repetindo…" : "Repetir mês anterior"}</button>}{role === "adm" && <button className="cycle-secondary" onClick={() => setRegimeOpen(true)}><Settings2/> Como contar folgas</button>}{role === "adm" && <button className="cycle-secondary" onClick={() => setRegrasOpen(true)}><Settings2/> Regras do pedido</button>}{roleCanWrite(role) && <button className="cycle-secondary" onClick={() => { setCalendarError(""); setCalendarOpen(true); }}><Plus/> Definir folga</button>}<button className="cycle-secondary" onClick={() => setAskOpen(true)}><Plus/> Pedir folga</button>{role === "adm" && <button className="cycle-primary" type="button" disabled={publishing || !operationId || Boolean(publicacao?.publishedAt && !publicacao.changedSince)} onClick={() => void publishMonth()}>{publishing ? "Publicando…" : publicacao?.publishedAt ? "Publicar de novo" : "Publicar mês"}</button>}</div></div><div className="cycle-tabs" role="group" aria-label="Folgas"><button className={managerTab === "map" ? "active" : ""} type="button" onClick={() => setManagerTab("map")}>Mapa do mês</button><button className={managerTab === "grupos" ? "active" : ""} type="button" onClick={() => setManagerTab("grupos")}>Grupos</button><button className={managerTab === "records" ? "active" : ""} type="button" onClick={() => setManagerTab("records")}>Registros</button><button type="button" onClick={() => setRegimeOpen(true)}>Como contar folgas</button></div>{managerTab === "map" ? <div className="cycle-leave-layout cycle-leave-full"><article className="cycle-card cycle-calendar-card"><header><div><span className="cycle-kicker">mapa mensal · edição por célula</span><h2 className="cycle-title-info">Folgas da equipe<button type="button" className="cycle-info-button" aria-expanded={mapInfoOpen} aria-label="Como contar folgas e editar" title="Como contar folgas e editar" onClick={() => setMapInfoOpen((value) => !value)}><Info size={16}/></button></h2>{mapInfoOpen && <div className="cycle-info-pop" role="note"><div><span className="cycle-kicker">como contar folgas</span><p>A conta fecha no mês, sem corte fixo da semana. A segunda folga depende da jornada completa.</p></div><div><span className="cycle-kicker">como editar</span><p>Toque ou arraste as células. Use F para folga, R para recesso, A para afastamento e O para outro. A alteração fica registrada no histórico.</p></div></div>}</div><label className="cycle-filter">Buscar pessoa<input value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} placeholder="Nome"/></label></header>{operationId ? <FolgasGrid operationId={operationId} year={month.getFullYear()} month={month.getMonth() + 1} memberFilter={memberFilter} groupBy={groupBy} onPublicacao={setPublicacao} refreshKey={gridRevision}/> : <p>Sem operação associada ao seu perfil.</p>}<footer><button className="cycle-secondary" type="button" onClick={() => setGroupBy((value) => !value)}>{groupBy ? "Mostrar sem agrupar" : "Agrupar por turma"}</button><span className="cycle-legend"><i className="approved"/> F folga <i className="pending"/> R recesso <i className="away"/> A afastamento</span></footer></article></div> : managerTab === "grupos" ? <GruposPanel grupos={grupos} verArquivados={verArquivados} erro={grupoErro} podeCriar={roleCanWrite(role)} onVerArquivados={setVerArquivados} onNovo={() => { setGrupoErro(""); setGrupoEdit("novo"); }} onEditar={(g) => { setGrupoErro(""); setGrupoEdit(g); }} onAplicar={(g) => { setGrupoErro(""); setGrupoAplicar(g); }} onArquivar={(g) => void arquivarGrupo(g)} onRestaurar={(g) => void restaurarGrupo(g)}/> : <article className="cycle-card" id="folgas-registros"><span className="cycle-kicker">registros no período</span><h2>Pedidos e decisões</h2>{visibleRequests.length ? visibleRequests.map((request) => <div className="cycle-request" key={request.id}><div><strong>{request.userName ?? request.userId}</strong><small>{porExtenso(request.startDate, request.endDate)} · {request.reason}</small>{request.decisionReason && request.status !== "PENDING" ? <small>Decisão: {request.decisionReason}</small> : null}</div><span className={`cycle-tag ${request.status === "PENDING" ? "warn" : ""}`}>{STATUS_PEDIDO[request.status]}</span></div>) : <p>Nenhum registro neste mês.</p>}</article>}</> : null;
  // Fila de pedidos: aparece com o mapa do mês (gestão) e no calendário (elenco/amostra).
  /** A Administração só decide pedido de área com Supervisão depois do prazo; antes, a tela diz por quê em vez de calar. */
  const bloqueadaParaAdm = (request: LeaveRequest) => role === "adm" && request.destino?.quem === "SUPERVISAO" && request.destino.adminPodeAgora === false;
  const dia = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
  const destinoTexto = (request: LeaveRequest) => {
    const d = request.destino;
    if (!d) return "";
    if (d.quem === "ADMINISTRACAO") return role === "mem" ? "Aguardando a Administração decidir" : "Sem Supervisão cadastrada na área: a decisão é da Administração.";
    const area = d.area ? ` de ${d.area}` : "";
    if (role === "mem") return `Aguardando a Supervisão${area} responder`;
    return bloqueadaParaAdm(request) && d.adminPodeDecidirEm ? `Com a Supervisão${area}. Você poderá decidir a partir de ${dia(d.adminPodeDecidirEm)}.` : `Com a Supervisão${area}.`;
  };
  const esperandoColega = (request: LeaveRequest) => request.troca?.estado === "ESPERANDO" || request.alternativa?.estado === "ESPERANDO";
  const trocaTexto = (request: LeaveRequest) => {
    const a = request.alternativa;
    if (a && a.estado === "ESPERANDO") return role === "mem" ? `A Supervisão propôs você folgar só em ${a.dias.map((d) => d.split("-").reverse().slice(0, 2).join("/")).join(", ")}.` : `Esperando ${request.userName ?? "a pessoa"} responder à proposta de dias.`;
    if (a && a.estado === "RECUSADA") return `${request.userName ?? "A pessoa"} não aceitou a proposta de dias${a.motivoRecusa ? `: ${a.motivoRecusa}` : ""}.`;
    const t = request.troca;
    if (!t) return "";
    const colega = t.colegaNome ?? "o colega";
    if (t.estado === "ESPERANDO") return role === "mem" ? `Troca proposta a ${colega}: esperando a resposta.` : `Esperando ${colega} responder à troca.`;
    if (t.estado === "RECUSADA") return `${colega} recusou a troca${t.motivoRecusa ? `: ${t.motivoRecusa}` : ""}.`;
    return "";
  };
  const diaMes = (iso: string | null | undefined) => iso ? iso.split("-").reverse().slice(0, 2).join("/") : "outro dia";
  const paraMim = visibleRequests.filter((request) => request.status === "PENDING" && request.troca?.souEu && request.troca.estado === "ESPERANDO");
  const trocaParaMimCard = paraMim.length ? <article className="cycle-card"><span className="cycle-kicker">pedidos de troca para você</span>{paraMim.map((request) => <div className="cycle-request cycle-troca" key={request.id}><div><strong>{request.userName}</strong><small>Quer folgar em {diaMes(request.startDate)} e você já está de folga nesse dia. Se aceitar, você trabalha nesse dia e fica com a folga de {diaMes(request.troca?.diaDevolvido)}.</small></div><div className="cycle-request-acoes"><button className="cycle-sim" onClick={() => { setRespostaErro(""); setResposta({ request, aceita: true, tipo: "troca" }); }}>Aceitar</button><button className="cycle-nao" onClick={() => { setRespostaErro(""); setResposta({ request, aceita: false, tipo: "troca" }); }}>Recusar</button></div></div>)}</article> : null;
  const prioridadeCard = roleCanWrite(role) && prioridades.length ? <article className="cycle-card"><span className="cycle-kicker">entraram como prioridade</span><p>O mapa do mês ainda não foi publicado, então estes pedidos entraram direto. Se houver algo especial no dia, desfaça com o motivo: a pessoa recebe o aviso.</p>{prioridades.map((request) => <div className="cycle-request" key={request.id}><div><strong>{request.userName}</strong><small>{request.areaName} · {porExtenso(request.startDate, request.endDate)}</small></div><div className="cycle-request-acoes"><button className="cycle-nao" onClick={() => { setDesfazerErro(""); setDesfazer(request); }}>Desfazer</button></div></div>)}</article> : null;
  const filaCard = <article className="cycle-card"><span className="cycle-kicker">{role === "mem" ? "seus pedidos" : "fila de pedidos"}</span>{pedidoFeito && role === "mem" ? <p role="status" className="cycle-pedido-feito">{pedidoFeito}</p> : null}{avisoFila && roleCanWrite(role) ? <p role="status">{avisoFila}</p> : null}{visibleRequests.filter((request) => request.status === "PENDING" && !request.troca?.souEu).length ? visibleRequests.filter((request) => request.status === "PENDING" && !request.troca?.souEu).map((request) => <div className="cycle-request" key={request.id}><div>{role === "mem" ? <strong>{porExtenso(request.startDate, request.endDate)}</strong> : <><strong>{request.userName}</strong><small>{request.areaName} · {porExtenso(request.startDate, request.endDate)}</small>{request.jaTemFolga ? <small className="cycle-ja-folga">já tem folga marcada nesses dias</small> : null}</>}{role === "mem" && request.reason ? <small>{request.reason}</small> : null}{request.destino && (role === "mem" || role === "adm") ? <small className="cycle-destino">{destinoTexto(request)}</small> : null}{(request.troca || request.alternativa) && request.troca?.estado !== "ACEITA" && request.alternativa?.estado !== "ACEITA" && role !== "dir" ? <small className="cycle-destino">{trocaTexto(request)}</small> : null}</div>{roleCanWrite(role) ? <div className="cycle-request-acoes"><button className="cycle-sim" disabled={bloqueadaParaAdm(request) || esperandoColega(request)} title={bloqueadaParaAdm(request) ? destinoTexto(request) : esperandoColega(request) ? trocaTexto(request) : undefined} onClick={() => { setDecisaoErro(""); setDecision({ request, status: "APPROVED" }); }}>Aprovar</button><button className="cycle-nao" disabled={bloqueadaParaAdm(request) || esperandoColega(request)} title={bloqueadaParaAdm(request) ? destinoTexto(request) : esperandoColega(request) ? trocaTexto(request) : undefined} onClick={() => { setDecisaoErro(""); setDecision({ request, status: "DENIED" }); }}>Recusar</button>{esperandoColega(request) ? <button className="cycle-nao" onClick={() => void retirarProposta(request)}>Retirar proposta</button> : null}</div> : role === "mem" ? <div className="cycle-request-acoes">{request.alternativa?.estado === "ESPERANDO" && request.alternativa.souEu ? <><button type="button" className="cycle-sim" onClick={() => { setRespostaErro(""); setResposta({ request, aceita: true, tipo: "alternativa" }); }}>Aceitar proposta</button><button type="button" className="cycle-nao" onClick={() => { setRespostaErro(""); setResposta({ request, aceita: false, tipo: "alternativa" }); }}>Recusar proposta</button></> : null}<button type="button" className="cycle-nao" onClick={() => void withdrawRequest(request)}>Retirar pedido</button></div> : <span className="cycle-tag warn">pendente</span>}</div>) : <p>{role === "mem" ? "Você não tem pedido esperando resposta." : "Nenhum pedido esperando decisão."}</p>}</article>;
  return <section className="cycle-page">{managerMap}
    {(!roleCanSeeMap(role) || review) && <div className="cycle-toolbar"><div><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight/></button></div><div>{role === "adm" && <button className="cycle-secondary" onClick={() => setRegimeOpen(true)}><Settings2/> Como contar folgas</button>}{role === "adm" && <button className="cycle-secondary" onClick={() => setRegrasOpen(true)}><Settings2/> Regras do pedido</button>}{roleCanWrite(role) && <button className="cycle-secondary" onClick={() => { setCalendarError(""); setCalendarOpen(true); }}><Plus/> Definir folga</button>}{role !== "dir" && <button className="cycle-primary" onClick={() => setAskOpen(true)}><Plus/> Pedir folga</button>}</div></div>}
    {managerMap ? <State loading={loading} error={error} empty={false} onRetry={reload}><div className="cycle-manager-queue">{filaCard}{prioridadeCard}</div></State> : <State loading={loading} error={error} empty={false} onRetry={reload}><div className="cycle-leave-layout"><article className="cycle-card cycle-calendar-card"><header><div><span className="cycle-kicker">{role === "mem" ? "suas folgas" : "calendário do grupo"}</span><h2>{role === "mem" ? "Seu mês" : role === "sup" ? scopeTitle : "Folgas da equipe"}</h2></div><span className="cycle-legend"><i className="approved"/> aprovada <i className="pending"/> pendente</span></header>{role === "mem" && !review && (!folgasPublicadas || precisaRepublicar) && <p role="status">{precisaRepublicar ? "A Administração precisa publicar este mês de novo para mostrar suas folgas aqui." : retratoInicial ? "Suas folgas anteriores continuam aqui. A Administração ainda precisa publicar este mês para confirmar o mapa." : "A Administração ainda não publicou as folgas deste mês. Seus pedidos pendentes continuam visíveis."}</p>}<MonthGrid selected={month} requests={calendarEntries} people={visiblePeople}/><footer>{visiblePeople.slice(0, 5).map((person) => <span className="cycle-person-key" key={person.id}><b>{initials(person.name)}</b>{person.name}<small>{person.area}</small></span>)}</footer></article><aside className="cycle-stack"><article className="cycle-card"><span className="cycle-kicker">como contar folgas</span><p>A conta fecha no mês, sem corte fixo da semana. A segunda folga depende da jornada completa.</p></article>{trocaParaMimCard}{filaCard}{prioridadeCard}</aside></div></State>}
    {roleCanWrite(role) && review && <GruposPanel grupos={grupos} verArquivados={verArquivados} erro={grupoErro} podeCriar onVerArquivados={setVerArquivados} onNovo={() => { setGrupoErro(""); setGrupoEdit("novo"); }} onEditar={(g) => { setGrupoErro(""); setGrupoEdit(g); }} onAplicar={(g) => { setGrupoErro(""); setGrupoAplicar(g); }} onArquivar={(g) => void arquivarGrupo(g)} onRestaurar={(g) => void restaurarGrupo(g)}/>}
    {askOpen && <div className="cycle-modal"><form onSubmit={requestLeave}><header><h2>Pedir folga</h2><button type="button" aria-label="Fechar" onClick={() => setAskOpen(false)}>×</button></header><p className="cycle-ajuda">Seu pedido vai para a Supervisão da sua área. Se a área não tiver Supervisão cadastrada, vai direto para a Administração.</p><PeriodoDeDatas rotuloDe="Começa" rotuloAte="Termina" de={from} ate={from} nomeDe="startDate" nomeAte="endDate" className="cycle-duas"/><label>Conte o necessário<textarea name="reason" required minLength={2} maxLength={600}/></label>{pedidoErro && <p className="cycle-erro-janela" role="alert">{pedidoErro}</p>}<footer><button type="button" className="cycle-secondary" onClick={() => setAskOpen(false)}>Voltar</button><button className="cycle-primary" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button></footer></form></div>}
    {regimeOpen && <div className="cycle-modal"><div className="cycle-card" role="dialog" aria-modal="true" aria-label="Como contar folgas"><header><h2>Como contar folgas</h2><button type="button" onClick={() => setRegimeOpen(false)} aria-label="Fechar">×</button></header><p>A conta fecha no mês; não existe dia fixo para começar a semana. Uma semana com menos folgas pode ser compensada em outra.</p><p>Snowland fecha às quartas e Acquamotion às segundas. A segunda folga depende de jornada completa. Nos meses em que o parque abre todos os dias, os grupos fixos são definidos pela Supervisão.</p><p>A tabela automática e o recesso de 2027 ainda precisam de revisão com a Babi antes de virarem regra no app.</p><footer><button type="button" className="cycle-primary" onClick={() => setRegimeOpen(false)}>Entendi</button></footer></div></div>}
    {calendarOpen && <DefinirFolgaDialog pessoas={visiblePeople} mes={month} erro={calendarError} onClose={() => setCalendarOpen(false)} onSubmit={marcarFolgas}/>}
    {grupoEdit && <GrupoDialog grupo={grupoEdit === "novo" ? null : grupoEdit} pessoas={visiblePeople} erro={grupoErro} onClose={() => setGrupoEdit(null)} onSubmit={salvarGrupo}/>}
    {grupoAplicar && <AplicarGrupoDialog grupo={grupoAplicar} mes={month} erro={grupoErro} onClose={() => setGrupoAplicar(null)} onSubmit={(de, ate) => aplicarGrupo(grupoAplicar, de, ate)}/>}
    {desfazer && <div className="cycle-modal"><form onSubmit={desfazerPrioridade}><header><h2>Desfazer a folga</h2><button type="button" aria-label="Fechar" onClick={() => setDesfazer(null)}>×</button></header><p>{desfazer.userName} · {porExtenso(desfazer.startDate, desfazer.endDate)}. A folga volta a ser dia de trabalho e a pessoa recebe o aviso com o motivo.</p><label>Motivo (a pessoa vai ler)<textarea name="motivo" required minLength={2} maxLength={600}/></label>{desfazerErro && <p className="cycle-erro-janela" role="alert">{desfazerErro}</p>}<footer><button type="button" className="cycle-secondary" onClick={() => setDesfazer(null)}>Voltar</button><button className="cycle-primary" disabled={desfazendo}>{desfazendo ? "Desfazendo…" : "Desfazer folga"}</button></footer></form></div>}
    {regrasOpen && <RegrasDoPedidoDialog onClose={() => setRegrasOpen(false)} />}
    {resposta && <div className="cycle-modal"><form onSubmit={responderTroca}><header><h2>{resposta.tipo === "alternativa" ? (resposta.aceita ? "Aceitar a proposta" : "Recusar a proposta") : resposta.aceita ? "Aceitar a troca" : "Recusar a troca"}</h2><button type="button" aria-label="Fechar" onClick={() => setResposta(null)}>×</button></header>{resposta.tipo === "alternativa" ? <p>{resposta.aceita ? `Você fica de folga só em ${(resposta.request.alternativa?.dias ?? []).map((d) => diaMes(d)).join(", ")}. Os outros dias do seu pedido não são concedidos.` : "Seu pedido volta para a Supervisão, que vai decidir. Se quiser, diga por quê (opcional)."}</p> : <p>{resposta.request.userName} quer folgar em {diaMes(resposta.request.startDate)}. {resposta.aceita ? `Você vai trabalhar nesse dia e ficar com a folga de ${diaMes(resposta.request.troca?.diaDevolvido)}. As suas folgas no mês continuam do mesmo tamanho.` : "Diga por que não dá: a Supervisão vai ler e decide o que fazer."}</p>}{resposta.aceita ? null : <label>{resposta.tipo === "alternativa" ? "Motivo (opcional)" : "Motivo (a Supervisão vai ler)"}<textarea name="motivo" required={resposta.tipo === "troca"} minLength={resposta.tipo === "troca" ? 2 : 0}/></label>}{respostaErro && <p className="cycle-erro-janela" role="alert">{respostaErro}</p>}<footer><button type="button" className="cycle-secondary" onClick={() => setResposta(null)}>Voltar</button><button className="cycle-primary" disabled={respondendo}>{respondendo ? "Salvando…" : "Confirmar"}</button></footer></form></div>}
    {decision && <div className="cycle-modal"><form onSubmit={decide}><header><h2>{decision.status === "APPROVED" ? "Aprovar folga" : "Recusar folga"}</h2><button type="button" aria-label="Fechar" onClick={() => setDecision(null)}>×</button></header><p>{decision.request.userName} · {porExtenso(decision.request.startDate, decision.request.endDate)}{decision.request.reason ? ` · ${decision.request.reason}` : ""}</p>{decision.request.jaTemFolga && decision.status === "APPROVED" ? <p className="cycle-ja-folga" role="note">Atenção: {decision.request.userName} já tem folga marcada nesses dias. Aprovar não cria uma segunda por cima.</p> : null}{!review && (role === "adm" || role === "sup") && <AnaliseDoPedido pedidoId={decision.request.id} pessoa={decision.request.userName ?? "A pessoa"} onTrocaProposta={() => { setDecision(null); reload(); }}/>}<label>{decision.status === "DENIED" ? "Motivo (a pessoa vai ler)" : "Recado para a pessoa (opcional)"}<textarea name="reason" required={decision.status === "DENIED"} minLength={2}/></label>{decisaoErro && <p className="cycle-erro-janela" role="alert">{decisaoErro}</p>}<footer><button type="button" className="cycle-secondary" onClick={() => setDecision(null)}>Voltar</button><button className="cycle-primary" disabled={enviando}>{enviando ? "Salvando…" : "Confirmar"}</button></footer></form></div>}
  </section>;
}

export function PanelPage({ role }: { role: Role }) {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const [data, setData] = useState<{ coverage: { expected: number; checkedIn: number; pct: number }; checkIns: { checkedIn: number; late: number; absent: number }; leaves: { approved: number }; vacancies: { open: number }; scales: { drafts: number } } | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [tentativaPainel, setTentativaPainel] = useState(0);
  const [dia, setDia] = useState(todayISO());
  useEffect(() => { if (role === "mem") return; setLoading(true); setError(""); if (review) { setData({ coverage: { expected: 18, checkedIn: 14, pct: 78 }, checkIns: { checkedIn: 14, late: 2, absent: 1 }, leaves: { approved: 1 }, vacancies: { open: 1 }, scales: { drafts: 0 } }); setLoading(false); return; } customFetch(`/api/panel-indicators?date=${dia}`).then((result) => setData(result as typeof data)).catch(() => setError("Não consegui calcular os indicadores.")).finally(() => setLoading(false)); }, [review, role, tentativaPainel, dia]);
  if (role === "mem") return <section className="cycle-page"><div className="cycle-empty-panel"><img src="/asa/consultando.webp" alt=""/><h2>O Elenco não tem Painel</h2><p>Seus números moram no Meu Dia — sem comparação com colegas.</p><Link href="/meu-dia">Abrir Meu Dia</Link></div></section>;
  const ehHoje = dia === todayISO(), quando = ehHoje ? "hoje" : "neste dia";
  const mudarDia = (n: number) => setDia((atual) => { const d = new Date(`${atual}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); });
  // Sem ninguém escalado o servidor devolve 100%: mostrar "100% cumprido" num dia sem Escala seria mentira.
  const semEscala = data ? data.coverage.expected === 0 : false;
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const cards = data ? [{ label: ehHoje ? "Quem já chegou" : "Quem fez check-in", value: semEscala ? "—" : `${data.coverage.checkedIn} de ${data.coverage.expected}`, sub: semEscala ? `ninguém escalado ${quando} em escala publicada` : `${data.coverage.pct}% das pessoas escaladas ${quando}`, tone: "" }, { label: "Faltas e atrasos", value: semEscala ? "—" : String(data.checkIns.absent + data.checkIns.late), sub: semEscala ? "sem escala publicada para medir" : `${plural(data.checkIns.absent, "falta", "faltas")} e ${plural(data.checkIns.late, "atraso", "atrasos")} ${quando}`, tone: data.checkIns.absent ? "bad" : "" }, { label: "Pessoas de folga", value: String(data.leaves.approved), sub: `${data.leaves.approved === 1 ? "pessoa de folga" : "pessoas de folga"} ${quando}`, tone: "" }, { label: "Vagas sem ninguém", value: String(data.vacancies.open), sub: data.vacancies.open === 1 ? "posição do Livro do Dia ainda sem ninguém" : "posições do Livro do Dia ainda sem ninguém", tone: data.vacancies.open ? "bad" : "" }] : [];
  const acoes = data ? [
    { n: data.checkIns.absent, texto: data.checkIns.absent === 1 ? "falta registrada" : "faltas registradas", abrir: "Check-in", href: "/check-in" },
    { n: data.checkIns.late, texto: data.checkIns.late === 1 ? "atraso avisado" : "atrasos avisados", abrir: "Check-in", href: "/check-in" },
    { n: data.vacancies.open, texto: data.vacancies.open === 1 ? "posição em risco" : "posições em risco", abrir: "Livro do Dia", href: "/livro-do-dia" },
    // O atalho leva ao dia que o Painel está mostrando, não ao "amanhã" que a Escala abre por padrão.
    { n: data.scales.drafts, texto: data.scales.drafts === 1 ? "Escala em rascunho, ainda sem publicar" : "Escalas em rascunho, ainda sem publicar", abrir: "Escalas", href: `/escalas?data=${dia}` },
  ].filter((acao) => acao.n > 0) : [];
  return <section className="cycle-page"><div className="cycle-toolbar"><div><button type="button" onClick={() => mudarDia(-1)} aria-label="Dia anterior"><ChevronLeft/></button><strong>{label(dia)}</strong><button type="button" onClick={() => mudarDia(1)} aria-label="Próximo dia"><ChevronRight/></button></div><div><button type="button" className="cycle-secondary" disabled={ehHoje} onClick={() => setDia(todayISO())}>Hoje</button></div></div><State loading={loading} error={error} empty={false} onRetry={() => setTentativaPainel((n) => n + 1)}><div className="cycle-panel-head"><div><span className="cycle-kicker">{ehHoje ? "hoje · " : ""}{label(dia)}</span><h2>Painel da operação</h2><p>Quatro números do dia para decidir o próximo passo.</p></div>{role === "dir" && <span className="cycle-tag">somente leitura</span>}</div><div className="cycle-panel-grid">{cards.map((card) => <article className={`cycle-card cycle-metric ${card.tone}`} key={card.label}><span>{card.label}</span><b>{card.value}</b><small>{card.sub}</small></article>)}</div><div className="cycle-panel-columns"><article className="cycle-card"><span className="cycle-kicker">o que pede ação</span>{data && (acoes.length ? <div className="cycle-action-list">{acoes.map((acao) => <Link key={acao.texto} href={acao.href}><b>{acao.n}</b><span>{acao.texto} · abrir {acao.abrir}{ehHoje ? "" : " e escolher o dia"}</span></Link>)}</div> : <p role="status">Nada pedindo ação {quando}.</p>)}</article><article className="cycle-card"><span className="cycle-kicker">um dia por vez</span><p>O Painel mostra um dia de cada vez: use as setas para olhar o dia seguinte ou um dia que já passou.</p></article></div></State></section>;
}

/* ---------- definir folga: pessoas em lote, datas de três jeitos ---------- */
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaISO = (ano: number, mes: number, dia: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
/** "segunda e terça"; três ou mais junta com vírgula e "e" no último. */
const diasPorExtenso = (dias: number[]) => {
  const nomes = [...dias].sort((a, b) => a - b).map((d) => DIAS_LONGOS[d]);
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
};
/** Todas as datas de [de, ate] cujo dia da semana está em `dias` (0=domingo … 6=sábado). */
const datasDoPadrao = (de: string, ate: string, dias: number[]) => {
  const lista: string[] = [];
  if (!de || !ate || de > ate) return lista;
  for (let t = new Date(`${de}T12:00:00`); t <= new Date(`${ate}T12:00:00`); t.setDate(t.getDate() + 1)) {
    if (dias.includes(t.getDay())) lista.push(diaISO(t.getFullYear(), t.getMonth() + 1, t.getDate()));
  }
  return lista;
};
/** Todos os dias corridos de [de, ate] (para o recesso, que vai de tal a tal data). */
const datasConsecutivas = (de: string, ate: string) => {
  const lista: string[] = [];
  if (!de || !ate || de > ate) return lista;
  for (let t = new Date(`${de}T12:00:00`); t <= new Date(`${ate}T12:00:00`); t.setDate(t.getDate() + 1)) {
    lista.push(diaISO(t.getFullYear(), t.getMonth() + 1, t.getDate()));
  }
  return lista;
};
/** As datas que um grupo marca ao ser aplicado, conforme o seu modo (dia da semana ou período). */
const datasDoGrupo = (grupo: Pick<FolgaGrupo, "diasFolga" | "dataInicio" | "dataFim">, de: string, ate: string) =>
  grupo.dataInicio && grupo.dataFim ? datasConsecutivas(grupo.dataInicio, grupo.dataFim) : datasDoPadrao(de, ate, grupo.diasFolga);

function DefinirFolgaDialog({ pessoas, mes, erro, onClose, onSubmit }: {
  pessoas: { id: string; name: string; area?: string | null }[];
  mes: Date;
  erro: string;
  onClose: () => void;
  onSubmit: (v: { userIds: string[]; datas: string[]; tipo: string | null; motivo: string }) => Promise<void>;
}) {
  useFecharComEsc(onClose);
  const ano = mes.getFullYear(), mesNum = mes.getMonth() + 1;
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const [quem, setQuem] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  // Três jeitos de dizer "quando", porque um intervalo só não cobre o que a casa faz: dias soltos
  // (3, 11 e 19), um período corrido, ou um padrão ("toda quarta e quinta").
  const [modo, setModo] = useState<"dias" | "periodo" | "semanal">("dias");
  const [dias, setDias] = useState<number[]>([]);
  const [de, setDe] = useState(diaISO(ano, mesNum, 1));
  const [ate, setAte] = useState(diaISO(ano, mesNum, diasNoMes));
  const [semana, setSemana] = useState<number[]>([]);
  const [tipo, setTipo] = useState("DAY_OFF");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const alterna = <T,>(lista: T[], valor: T): T[] => lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
  const filtradas = pessoas.filter((p) => `${p.name} ${p.area ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const areas = [...new Set(pessoas.map((p) => p.area).filter((a): a is string => Boolean(a)))];

  const datas = (() => {
    if (modo === "dias") return dias.sort((a, b) => a - b).map((d) => diaISO(ano, mesNum, d));
    const lista: string[] = [];
    for (let t = new Date(`${de}T12:00:00`); t <= new Date(`${ate}T12:00:00`); t.setDate(t.getDate() + 1)) {
      if (modo === "semanal" && !semana.includes(t.getDay())) continue;
      lista.push(diaISO(t.getFullYear(), t.getMonth() + 1, t.getDate()));
    }
    return lista;
  })();

  const pronto = quem.length > 0 && datas.length > 0 && (modo !== "semanal" || semana.length > 0) && de <= ate;
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!pronto || salvando) return;
    setSalvando(true);
    try { await onSubmit({ userIds: quem, datas, tipo: tipo === "LIMPAR" ? null : tipo, motivo }); } finally { setSalvando(false); }
  };

  const chip = (ligado: boolean) => `cycle-chip${ligado ? " on" : ""}`;
  return <div className="cycle-modal"><form onSubmit={enviar} className="cycle-folga-form">
    <header><h2>Definir folga</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
    <p>Vale para quem você escolher, nos dias que escolher. A mudança só aparece para o Elenco quando a Administração publicar o mês de novo.</p>
    {erro && <p role="alert">{erro}</p>}

    <fieldset>
      <legend>Quem</legend>
      <div className="cycle-folga-atalhos">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" aria-label="Buscar pessoa"/>
        <button type="button" className={chip(false)} onClick={() => setQuem(filtradas.map((p) => p.id))}>Todas da lista</button>
        {areas.map((a) => <button key={a} type="button" className={chip(false)} onClick={() => setQuem((atual) => [...new Set([...atual, ...pessoas.filter((p) => p.area === a).map((p) => p.id)])])}>{a}</button>)}
        {quem.length > 0 && <button type="button" className={chip(false)} onClick={() => setQuem([])}>Limpar</button>}
      </div>
      <div className="cycle-folga-pessoas">
        {filtradas.map((p) => <button key={p.id} type="button" aria-pressed={quem.includes(p.id)} className={chip(quem.includes(p.id))} onClick={() => setQuem((atual) => alterna(atual, p.id))}>{p.name}</button>)}
        {!filtradas.length && <span>Ninguém com esse nome.</span>}
      </div>
    </fieldset>

    <fieldset>
      <legend>Quando</legend>
      <div className="cycle-folga-atalhos" role="tablist">
        {([["dias", "Dias soltos"], ["periodo", "Período"], ["semanal", "Toda semana"]] as const).map(([valor, rotulo]) =>
          <button key={valor} type="button" role="tab" aria-selected={modo === valor} className={chip(modo === valor)} onClick={() => setModo(valor)}>{rotulo}</button>)}
      </div>
      {modo === "dias" && <div className="cycle-folga-dias">
        {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((d) => {
          const semanaDoDia = new Date(ano, mesNum - 1, d).getDay();
          return <button key={d} type="button" aria-pressed={dias.includes(d)} className={chip(dias.includes(d))} onClick={() => setDias((atual) => alterna(atual, d))}>
            <b>{d}</b><small>{DIAS_CURTOS[semanaDoDia]}</small>
          </button>;
        })}
      </div>}
      {modo !== "dias" && <div className="cycle-folga-periodo">
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)}/></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)}/></label>
      </div>}
      {modo === "semanal" && <div className="cycle-folga-atalhos">
        {DIAS_CURTOS.map((nome, i) => <button key={nome} type="button" aria-pressed={semana.includes(i)} className={chip(semana.includes(i))} onClick={() => setSemana((atual) => alterna(atual, i))}>{nome}</button>)}
      </div>}
    </fieldset>

    <label>O que marcar
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="DAY_OFF">Folga</option>
        <option value="RECESSO">Recesso</option>
        <option value="AFASTAMENTO">Afastamento</option>
        <option value="OUTRO">Outro</option>
        <option value="LIMPAR">Limpar o que estiver nesses dias</option>
      </select>
    </label>
    <label>Motivo (opcional)<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}/></label>

    <p className="cycle-folga-previa" role="status">{!pronto
      ? "Escolha quem e quando."
      : `${quem.length === 1 ? "1 pessoa" : `${quem.length} pessoas`} × ${datas.length === 1 ? "1 dia" : `${datas.length} dias`} = ${quem.length * datas.length} ${
          tipo === "LIMPAR"
            ? quem.length * datas.length === 1 ? "dia limpo" : "dias limpos"
            : quem.length * datas.length === 1 ? "marcação" : "marcações"
        }. O que já existir nesses dias é substituído.`}</p>

    <footer>
      <button type="button" className="cycle-secondary" onClick={onClose}>Cancelar</button>
      <button className="cycle-primary" disabled={!pronto || salvando}>{salvando ? "Guardando…" : "Guardar no mapa"}</button>
    </footer>
  </form></div>;
}

/* ---------- grupos de folga: padrão (pessoas + quando) por equipe ---------- */
const TIPO_ROTULO: Record<string, string> = { DAY_OFF: "Folga", RECESSO: "Recesso", AFASTAMENTO: "Afastamento", OUTRO: "Outro" };
/** "folga segunda e terça" (por dia da semana) ou "recesso de 24 a 26 de dezembro" (por período). */
const quandoDoGrupoTexto = (g: Pick<FolgaGrupo, "diasFolga" | "dataInicio" | "dataFim" | "tipo">) => {
  const rotulo = (TIPO_ROTULO[g.tipo] ?? g.tipo).toLocaleLowerCase("pt-BR");
  return g.dataInicio && g.dataFim ? `${rotulo} de ${porExtenso(g.dataInicio, g.dataFim)}` : `${rotulo} ${diasPorExtenso(g.diasFolga)}`;
};

function GruposPanel({ grupos, verArquivados, erro, podeCriar, onVerArquivados, onNovo, onEditar, onAplicar, onArquivar, onRestaurar }: {
  grupos: FolgaGrupo[]; verArquivados: boolean; erro: string; podeCriar: boolean;
  onVerArquivados: (v: boolean) => void; onNovo: () => void; onEditar: (g: FolgaGrupo) => void;
  onAplicar: (g: FolgaGrupo) => void; onArquivar: (g: FolgaGrupo) => void; onRestaurar: (g: FolgaGrupo) => void;
}) {
  return <article className="cycle-card" id="folgas-grupos">
    <header>
      <div><span className="cycle-kicker">grupos de folga · por equipe</span><h2>Grupos de folga</h2></div>
      <div className="cycle-grupos-acoes">
        <label className="cycle-grupos-switch"><input type="checkbox" checked={verArquivados} onChange={(e) => onVerArquivados(e.target.checked)}/> ver arquivados</label>
        {podeCriar && <button type="button" className="cycle-secondary" onClick={onNovo}><Plus/> Novo grupo</button>}
      </div>
    </header>
    <p>Um grupo guarda o padrão — as pessoas e o quando: os dois dias de folga da semana, ou um período corrido como o recesso. Guardar o grupo evita reescolher as pessoas todo mês; os grupos mudam a cada ano. Aplicar marca a folga, e o Elenco só vê depois da publicação do mês.</p>
    {erro && <p role="alert">{erro}</p>}
    {!grupos.length ? <div className="cycle-feedback"><img src="/asa/oi.webp" alt=""/> Nenhum grupo ainda. Crie um para repetir as folgas fixas sem reescolher as pessoas todo mês.</div>
      : <div className="cycle-grupos-lista">{grupos.map((g) => <div className={`cycle-grupo${g.active ? "" : " arquivado"}`} key={g.id}>
          <div className="cycle-grupo-info">
            <strong>{g.nome}{!g.active && <span className="cycle-tag"> arquivado</span>}</strong>
            <small>{quandoDoGrupoTexto(g)} · {g.pessoas.length === 1 ? "1 pessoa" : `${g.pessoas.length} pessoas`}</small>
            <small className="cycle-grupo-pessoas">{g.pessoas.map((p) => p.name).join(", ")}</small>
          </div>
          <div className="cycle-grupo-botoes">
            {g.active && <button type="button" className="cycle-secondary" onClick={() => onAplicar(g)} disabled={!g.editavel}>Aplicar</button>}
            {g.active
              ? <>{g.editavel && <button type="button" onClick={() => onEditar(g)}>Editar</button>}{g.editavel && <button type="button" onClick={() => onArquivar(g)}>Arquivar</button>}</>
              : g.editavel && <button type="button" onClick={() => onRestaurar(g)}>Restaurar</button>}
          </div>
        </div>)}</div>}
  </article>;
}

function GrupoDialog({ grupo, pessoas, erro, onClose, onSubmit }: {
  grupo: FolgaGrupo | null;
  pessoas: { id: string; name: string; area?: string | null }[];
  erro: string;
  onClose: () => void;
  onSubmit: (v: { id?: string; nome: string; diasFolga: number[]; dataInicio: string | null; dataFim: string | null; pessoaIds: string[]; tipo: string }) => Promise<void>;
}) {
  useFecharComEsc(onClose);
  const [nome, setNome] = useState(grupo?.nome ?? "");
  // Dois jeitos de dizer "quando": por dia da semana (folgas fixas) ou um período corrido (recesso).
  const [modo, setModo] = useState<"semana" | "periodo">(grupo?.dataInicio ? "periodo" : "semana");
  const [dias, setDias] = useState<number[]>(grupo?.diasFolga ?? []);
  const [de, setDe] = useState(grupo?.dataInicio ?? "");
  const [ate, setAte] = useState(grupo?.dataFim ?? "");
  const [quem, setQuem] = useState<string[]>(grupo?.pessoas.map((p) => p.id) ?? []);
  const [tipo, setTipo] = useState(grupo?.tipo ?? "DAY_OFF");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const alterna = <T,>(lista: T[], valor: T): T[] => lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
  const chip = (ligado: boolean) => `cycle-chip${ligado ? " on" : ""}`;
  const filtradas = pessoas.filter((p) => `${p.name} ${p.area ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const areas = [...new Set(pessoas.map((p) => p.area).filter((a): a is string => Boolean(a)))];
  const quandoOk = modo === "semana" ? dias.length > 0 : Boolean(de && ate && de <= ate);
  const pronto = nome.trim().length > 0 && quandoOk && quem.length > 0;
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!pronto || salvando) return;
    setSalvando(true);
    const quando = modo === "semana" ? { diasFolga: dias, dataInicio: null, dataFim: null } : { diasFolga: [], dataInicio: de, dataFim: ate };
    try { await onSubmit({ id: grupo?.id, nome: nome.trim(), ...quando, pessoaIds: quem, tipo }); } finally { setSalvando(false); }
  };
  return <div className="cycle-modal"><form onSubmit={enviar} className="cycle-folga-form">
    <header><h2>{grupo ? "Editar grupo" : "Novo grupo de folga"}</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
    <p>As pessoas e o quando. Salvar só guarda o grupo — não marca nada no mapa; isso é no "Aplicar".</p>
    {erro && <p role="alert">{erro}</p>}

    <label>Nome do grupo<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Grupo 1 — seg e ter" maxLength={80}/></label>

    <fieldset>
      <legend>Quando</legend>
      <div className="cycle-folga-atalhos" role="tablist">
        {([["semana", "Por dia da semana"], ["periodo", "Período corrido"]] as const).map(([valor, rotulo]) =>
          <button key={valor} type="button" role="tab" aria-selected={modo === valor} className={chip(modo === valor)} onClick={() => setModo(valor)}>{rotulo}</button>)}
      </div>
      {modo === "semana"
        ? <div className="cycle-folga-atalhos">
            {DIAS_CURTOS.map((rotulo, i) => <button key={rotulo} type="button" aria-pressed={dias.includes(i)} className={chip(dias.includes(i))} onClick={() => setDias((atual) => alterna(atual, i))}>{rotulo}</button>)}
          </div>
        : <div className="cycle-folga-periodo">
            <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)}/></label>
            <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)}/></label>
          </div>}
    </fieldset>

    <fieldset>
      <legend>Quem</legend>
      <div className="cycle-folga-atalhos">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" aria-label="Buscar pessoa"/>
        <button type="button" className={chip(false)} onClick={() => setQuem(filtradas.map((p) => p.id))}>Todas da lista</button>
        {areas.map((a) => <button key={a} type="button" className={chip(false)} onClick={() => setQuem((atual) => [...new Set([...atual, ...pessoas.filter((p) => p.area === a).map((p) => p.id)])])}>{a}</button>)}
        {quem.length > 0 && <button type="button" className={chip(false)} onClick={() => setQuem([])}>Limpar</button>}
      </div>
      <div className="cycle-folga-pessoas">
        {filtradas.map((p) => <button key={p.id} type="button" aria-pressed={quem.includes(p.id)} className={chip(quem.includes(p.id))} onClick={() => setQuem((atual) => alterna(atual, p.id))}>{p.name}</button>)}
        {!filtradas.length && <span>Ninguém com esse nome.</span>}
      </div>
    </fieldset>

    <label>O que marcar ao aplicar
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="DAY_OFF">Folga</option>
        <option value="RECESSO">Recesso</option>
        <option value="AFASTAMENTO">Afastamento</option>
        <option value="OUTRO">Outro</option>
      </select>
    </label>

    <p className="cycle-folga-previa" role="status">{pronto
      ? `${quandoDoGrupoTexto({ diasFolga: dias, dataInicio: modo === "periodo" ? de : null, dataFim: modo === "periodo" ? ate : null, tipo })}, ${quem.length === 1 ? "1 pessoa" : `${quem.length} pessoas`}.`
      : modo === "semana" ? "Dê um nome, escolha os dias e as pessoas." : "Dê um nome, escolha o período e as pessoas."}</p>
    <footer>
      <button type="button" className="cycle-secondary" onClick={onClose}>Cancelar</button>
      <button className="cycle-primary" disabled={!pronto || salvando}>{salvando ? "Guardando…" : "Guardar grupo"}</button>
    </footer>
  </form></div>;
}

function AplicarGrupoDialog({ grupo, mes, erro, onClose, onSubmit }: {
  grupo: FolgaGrupo;
  mes: Date;
  erro: string;
  onClose: () => void;
  onSubmit: (de: string, ate: string) => Promise<void>;
}) {
  useFecharComEsc(onClose);
  const porPeriodo = Boolean(grupo.dataInicio && grupo.dataFim);
  const ano = mes.getFullYear(), mesNum = mes.getMonth() + 1;
  // Grupo por dia da semana: escolhe-se o período. Grupo por período: o intervalo já é o do grupo.
  const [de, setDe] = useState(porPeriodo ? grupo.dataInicio! : diaISO(ano, mesNum, 1));
  const [ate, setAte] = useState(porPeriodo ? grupo.dataFim! : diaISO(ano, mesNum, new Date(ano, mesNum, 0).getDate()));
  const [salvando, setSalvando] = useState(false);
  const datas = datasDoGrupo(grupo, de, ate);
  const marcacoes = datas.length * grupo.pessoas.length;
  const pronto = de <= ate && datas.length > 0;
  const rotuloTipo = (TIPO_ROTULO[grupo.tipo] ?? grupo.tipo).toLocaleLowerCase("pt-BR");
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!pronto || salvando) return;
    setSalvando(true);
    try { await onSubmit(de, ate); } finally { setSalvando(false); }
  };
  return <div className="cycle-modal"><form onSubmit={enviar} className="cycle-folga-form">
    <header><h2>Aplicar “{grupo.nome}”</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
    <p>Marca {rotuloTipo} de {porPeriodo ? porExtenso(grupo.dataInicio!, grupo.dataFim!) : diasPorExtenso(grupo.diasFolga)} para {grupo.pessoas.length === 1 ? "esta pessoa" : `estas ${grupo.pessoas.length} pessoas`}{porPeriodo ? "" : ", em todo o período"}. O que já existir nesses dias é substituído. O Elenco só vê depois da publicação do mês.</p>
    {erro && <p role="alert">{erro}</p>}
    {porPeriodo
      ? <p className="cycle-folga-previa">Período do grupo: {porExtenso(grupo.dataInicio!, grupo.dataFim!)}.</p>
      : <div className="cycle-folga-periodo">
          <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)}/></label>
          <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)}/></label>
        </div>}
    <p className="cycle-folga-previa" role="status">{!pronto
      ? (de > ate ? "A data final é antes da inicial." : `O período não tem nenhum dia para marcar.`)
      : `${datas.length === 1 ? "1 dia" : `${datas.length} dias`} × ${grupo.pessoas.length === 1 ? "1 pessoa" : `${grupo.pessoas.length} pessoas`} = ${marcacoes === 1 ? "1 marcação" : `${marcacoes} marcações`}.`}</p>
    <footer>
      <button type="button" className="cycle-secondary" onClick={onClose}>Cancelar</button>
      <button className="cycle-primary" disabled={!pronto || salvando}>{salvando ? "Aplicando…" : porPeriodo ? "Aplicar" : "Aplicar ao período"}</button>
    </footer>
  </form></div>;
}
type ModoDoLimite = "REFERENCIA" | "EXIGE_MOTIVO";
type RegrasDoPedido = { config: { prazoSupervisaoDias: number; limiteFolgaPorArea: Record<string, number>; limiteAreaAtivo: boolean; limiteAreaModo: ModoDoLimite; limiteTotalAtivo: boolean; limiteTotal: number | null; limiteTotalModo: ModoDoLimite; lembreteRespostaHoras: number }; areas: { id: string; name: string }[] };
/**
 * Regras do pedido de folga que a Administração ajusta: em quantos dias a Administração pode decidir um
 * pedido que a Supervisão não respondeu, quantas pessoas podem folgar no mesmo dia (no total da casa e por área,
 * cada limite liga e desliga) e depois de quantas horas sem resposta vem o lembrete. Cada limite só avisa
 * (referência) ou exige motivo escrito para passar; nenhum impede a decisão.
 */
function RegrasDoPedidoDialog({ onClose }: { onClose: () => void }) {
  useFecharComEsc(onClose);
  const [dados, setDados] = useState<RegrasDoPedido | null>(null), [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let vivo = true;
    customFetch<RegrasDoPedido>("/api/folga-config").then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e, "Não consegui abrir as regras agora. Nada foi alterado; tente de novo.")); });
    return () => { vivo = false; };
  }, []);
  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dados) return;
    const f = new FormData(event.currentTarget);
    const prazo = Number(f.get("prazo"));
    if (!Number.isInteger(prazo) || prazo < 0 || prazo > 30) { setErro("O prazo é um número inteiro de dias, de 0 a 30."); return; }
    const limites: Record<string, number | null> = {};
    for (const area of dados.areas) {
      const texto = String(f.get(`limite-${area.id}`) ?? "").trim();
      if (texto === "") { limites[area.id] = null; continue; }
      const n = Number(texto);
      if (!Number.isInteger(n) || n < 0 || n > 200) { setErro(`O limite de ${area.name} é um número inteiro de pessoas, de 0 a 200. Deixe em branco para não avisar.`); return; }
      limites[area.id] = n;
    }
    const totalTexto = String(f.get("limite-total") ?? "").trim();
    const limiteTotal = totalTexto === "" ? null : Number(totalTexto);
    if (limiteTotal !== null && (!Number.isInteger(limiteTotal) || limiteTotal < 0 || limiteTotal > 2000)) { setErro("O limite total é um número inteiro de pessoas, de 0 a 2000."); return; }
    const limiteTotalAtivo = f.get("limite-total-ativo") === "on";
    if (limiteTotalAtivo && limiteTotal === null) { setErro("Para ligar o limite total, diga quantas pessoas podem estar de folga no mesmo dia."); return; }
    const lembrete = Number(f.get("lembrete"));
    if (!Number.isInteger(lembrete) || lembrete < 0 || lembrete > 168) { setErro("O lembrete é um número inteiro de horas, de 0 (sem lembrete) a 168."); return; }
    setSalvando(true); setErro("");
    try {
      await customFetch("/api/folga-config", { method: "PUT", body: JSON.stringify({
        prazoSupervisaoDias: prazo, limiteFolgaPorArea: limites,
        limiteTotalAtivo, limiteTotal, limiteTotalModo: String(f.get("limite-total-modo")),
        limiteAreaAtivo: f.get("limite-area-ativo") === "on", limiteAreaModo: String(f.get("limite-area-modo")),
        lembreteRespostaHoras: lembrete,
      }) }); onClose(); }
    catch (e) { setErro(mensagemDoErro(e, "Não consegui salvar as regras agora. Nada foi alterado; tente de novo.")); }
    finally { setSalvando(false); }
  };
  return <div className="cycle-modal"><form onSubmit={salvar} className="cycle-folga-form" aria-label="Regras do pedido de folga">
    <header><h2>Regras do pedido de folga</h2><button type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
    {!dados && !erro ? <p role="status">Abrindo as regras…</p> : null}
    {dados && <>
      <label>Dias antes da data pedida em que a Administração pode decidir
        <input name="prazo" type="number" min={0} max={30} step={1} defaultValue={dados.config.prazoSupervisaoDias} required />
        <small>A Supervisão da área decide primeiro. Se ela não responder, a Administração passa a poder decidir quando faltarem esses dias (corridos) ou menos para a data pedida.</small>
      </label>
      <fieldset>
        <legend>Limite total: pessoas de folga no mesmo dia na casa toda</legend>
        <small>Conta Snowland e Acquamotion juntos. Ligado, a análise do pedido mostra quando o dia passa do número. Desligado, não conta.</small>
        <label className="cycle-regra-liga"><input name="limite-total-ativo" type="checkbox" defaultChecked={dados.config.limiteTotalAtivo} /> Ligar o limite total</label>
        <label>Quantas pessoas no máximo<input name="limite-total" type="number" min={0} max={2000} step={1} defaultValue={dados.config.limiteTotal ?? ""} placeholder="ex.: 10" /></label>
        <label>Quando passar do limite<select name="limite-total-modo" defaultValue={dados.config.limiteTotalModo}><option value="REFERENCIA">Só avisar (referência)</option><option value="EXIGE_MOTIVO">Exigir motivo escrito para aprovar</option></select></label>
      </fieldset>
      <fieldset>
        <legend>Limite por área: pessoas da área de folga no mesmo dia</legend>
        <small>Depende dos shows. Em branco, a área não tem limite. Pode ficar em referência enquanto o total é mais firme, ou o contrário.</small>
        <label className="cycle-regra-liga"><input name="limite-area-ativo" type="checkbox" defaultChecked={dados.config.limiteAreaAtivo} /> Ligar os limites por área</label>
        <label>Quando passar do limite<select name="limite-area-modo" defaultValue={dados.config.limiteAreaModo}><option value="REFERENCIA">Só avisar (referência)</option><option value="EXIGE_MOTIVO">Exigir motivo escrito para aprovar</option></select></label>
        {dados.areas.length ? dados.areas.map((area) => <label key={area.id}>{area.name}<input name={`limite-${area.id}`} type="number" min={0} max={200} step={1} defaultValue={dados.config.limiteFolgaPorArea[area.id] ?? ""} placeholder="sem limite" /></label>) : <p>Nenhuma área cadastrada ainda.</p>}
      </fieldset>
      <label>Lembrar quem não respondeu depois de quantas horas
        <input name="lembrete" type="number" min={0} max={168} step={1} defaultValue={dados.config.lembreteRespostaHoras} required />
        <small>Vale para o colega de uma troca de folga e para quem recebeu uma proposta de outros dias. Um lembrete só, no sino. Zero desliga.</small>
      </label>
    </>}
    {erro && <p className="cycle-erro-janela" role="alert">{erro}</p>}
    <footer><button type="button" className="cycle-secondary" onClick={onClose}>Voltar</button><button className="cycle-primary" disabled={salvando || !dados}>{salvando ? "Salvando…" : "Salvar"}</button></footer>
  </form></div>;
}
