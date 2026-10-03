import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, Plus, Settings2, UserRoundCheck } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { todayISO } from "@/lib/review-escala";
import { useAuth } from "@/hooks/useAuth";
import { FolgasGrid } from "@/components/folgas-grid";
import "./operational-cycle.css";

type Role = "adm" | "dir" | "sup" | "mem";
type LeaveRequest = { id: string; userId: string; userName?: string; areaName?: string | null; startDate: string; endDate: string; reason: string; status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED"; decisionReason?: string | null };
type Regime = { id: string; effectiveFrom: string; effectiveTo?: string | null; weeklyDays: number; weekStartsOn: number; recessRules?: Record<string, unknown> } | null;
type DayBlock = { key: string; rotulo: string; inicio: string; fim: string | null; pessoaIds: string[]; dailyBookId: string | null; vazio: boolean; sinal: string | null; scaleId?: string; locationName?: string };
type CheckIn = { id: string; sourceKey: string; userId: string; status: string; reason?: string | null; etaMinutes?: number | null };
type Occurrence = { id: string; personId: string; personName: string; date: string; type: string; description: string; state: "aberta" | "em_analise" | "resolvida" };

const PEOPLE = exampleData.pessoas.map((p) => ({ id: p.nome_de_exibicao, name: p.nome_de_exibicao, area: exampleData.areas.find((a) => a.id === p.area)?.nome ?? p.area }));
const LOCATIONS = exampleData.locais.map((l) => ({ id: l.id, name: l.nome }));
import { REVIEW_PERSON } from "@/lib/amostra";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const weekLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const label = (date: string) => { const [y, m, d] = date.split("-").map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}`; };
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const roleCanWrite = (role: Role) => role === "adm" || role === "sup";

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
      customFetch<{ users?: { id: string; name: string; areaName?: string | null }[] }>("/api/users").catch(() => ({ users: [] })),
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
  const [requests, setRequests] = useState<LeaveRequest[]>([]), [regime, setRegime] = useState<Regime>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [askOpen, setAskOpen] = useState(false), [regimeOpen, setRegimeOpen] = useState(false), [calendarOpen, setCalendarOpen] = useState(false), [decision, setDecision] = useState<{ request: LeaveRequest; status: "APPROVED" | "DENIED" } | null>(null);
  const from = iso(new Date(month.getFullYear(), month.getMonth(), 1)), to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const { user, roles } = useAuth();
  const operationId = roles[0]?.operationId ?? "";
  const [groupBy, setGroupBy] = useState(true), [memberFilter, setMemberFilter] = useState("");
  const directory = useCycleDirectory(review, role);
  const visiblePeople = useMemo(() => review ? (role === "mem" ? PEOPLE.filter((person) => person.name === me) : role === "sup" ? PEOPLE.filter((person) => person.area === "Patinadores") : PEOPLE) : role === "mem" ? directory.people.filter((person) => person.id === user?.id) : directory.people, [review, role, me, directory.people, user?.id]);
  // Fora da amostra o servidor já devolve só os pedidos do escopo de quem pergunta.
  const visibleRequests = useMemo(() => review ? requests.filter((request) => visiblePeople.some((person) => person.id === request.userId)) : requests, [review, requests, visiblePeople]);
  const scopeTitle = review ? "Patinadores" : [...new Set(visiblePeople.map((person) => person.area).filter((area) => area !== "Sem área"))].join(" · ") || "Sua área";
  const reload = () => {
    setLoading(true); setError("");
    if (review) { setRequests([{ id: "sample-folga-sofia", userId: "Sofia", userName: "Sofia", areaName: "Patinadores", startDate: from, endDate: from, reason: "Folga planejada", status: "APPROVED" }, { id: "sample-pedido-julia", userId: "Julia", userName: "Julia", areaName: "Patinadores", startDate: to, endDate: to, reason: "Compromisso pessoal", status: "PENDING" }]); setRegime({ id: "sample-regime", effectiveFrom: from, weeklyDays: 1, weekStartsOn: 4 }); setLoading(false); return; }
    Promise.all([customFetch<{ requests: LeaveRequest[] }>(`/api/leave-requests?from=${from}&to=${to}`), role === "mem" ? Promise.resolve({ regime: null as Regime }) : customFetch<{ regime: Regime }>(`/api/leave-regimes/current?date=${from}`)]).then(([list, current]) => { setRequests(list.requests); setRegime(current.regime); }).catch(() => setError("Não consegui carregar as folgas agora.")).finally(() => setLoading(false));
  };
  useEffect(reload, [from, to, review, role]);
  const requestLeave = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const body = { startDate: String(data.get("startDate")), endDate: String(data.get("endDate")), reason: String(data.get("reason")) }; if (review) { setRequests((rows) => [{ id: `sample-${Date.now()}`, userId: me, userName: me, areaName: visiblePeople[0]?.area, ...body, status: "PENDING" }, ...rows]); setAskOpen(false); return; } try { await customFetch("/api/leave-requests", { method: "POST", body: JSON.stringify(body) }); setAskOpen(false); reload(); } catch { setError("Não consegui enviar o pedido."); } };
  const decide = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!decision) return; const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim(); if (!reason) return; if (review) { setRequests((rows) => rows.map((item) => item.id === decision.request.id ? { ...item, status: decision.status, decisionReason: reason } : item)); setDecision(null); return; } try { await customFetch(`/api/leave-requests/${decision.request.id}`, { method: "PATCH", body: JSON.stringify({ status: decision.status, decisionReason: reason }) }); setDecision(null); reload(); } catch { setError("Não consegui registrar a decisão."); } };
  const saveRegime = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const body = { effectiveFrom: String(data.get("effectiveFrom")), weeklyDays: Number(data.get("weeklyDays")), weekStartsOn: Number(data.get("weekStartsOn")), recessRules: { note: String(data.get("recessRules") ?? "") } }; if (review) { setRegime({ id: "sample-regime", ...body }); setRegimeOpen(false); return; } try { await customFetch("/api/leave-regimes", { method: "POST", body: JSON.stringify(body) }); setRegimeOpen(false); reload(); } catch { setError("Não consegui salvar o regime."); } };
  const putOnCalendar = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const body = { userId: String(data.get("userId")), startDate: String(data.get("startDate")), endDate: String(data.get("endDate")), reason: String(data.get("reason")) }; if (review) { const person = visiblePeople.find((item) => item.id === body.userId); setRequests((rows) => [{ id: `sample-calendar-${Date.now()}`, userName: person?.name, areaName: person?.area, ...body, status: "APPROVED" }, ...rows]); setCalendarOpen(false); return; } try { await customFetch("/api/leave-calendar", { method: "POST", body: JSON.stringify(body) }); setCalendarOpen(false); reload(); } catch { setError("Não consegui colocar a folga no calendário."); } };
  const managerMap = roleCanWrite(role) && !review ? <><div className="cycle-toolbar"><div><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight/></button></div><div>{role === "adm" && <button className="cycle-secondary" onClick={() => setRegimeOpen(true)}><Settings2/> Regras e grupos</button>}{<button className="cycle-secondary" onClick={() => setCalendarOpen(true)}><Plus/> Definir folga</button>}<button className="cycle-primary" onClick={() => setAskOpen(true)}><Plus/> Pedir folga</button></div></div><div className="cycle-tabs" role="tablist" aria-label="Folgas"><button className="active" type="button">Mapa do mês</button><button type="button" onClick={() => document.getElementById("folgas-registros")?.scrollIntoView({ behavior: "smooth" })}>Registros</button><button type="button" onClick={() => setRegimeOpen(true)}>Regras e grupos</button></div><div className="cycle-leave-layout"><article className="cycle-card cycle-calendar-card"><header><div><span className="cycle-kicker">mapa mensal · edição por célula</span><h2>Folgas da equipe</h2></div><label className="cycle-filter">Buscar pessoa<input value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} placeholder="Nome"/></label></header>{operationId ? <FolgasGrid operationId={operationId} year={month.getFullYear()} month={month.getMonth() + 1} memberFilter={memberFilter} groupBy={groupBy}/> : <p>Sem operação associada ao seu perfil.</p>}<footer><button className="cycle-secondary" type="button" onClick={() => setGroupBy((value) => !value)}>{groupBy ? "Mostrar sem agrupar" : "Agrupar por turma"}</button><span className="cycle-legend"><i className="approved"/> F folga <i className="pending"/> R recesso <i className="away"/> A afastamento</span></footer></article><aside className="cycle-stack"><article className="cycle-card"><span className="cycle-kicker">regime em vigor</span>{regime ? <><b className="cycle-number">{regime.weeklyDays}</b><strong>{regime.weeklyDays === 1 ? "folga por semana" : "folgas por semana"}</strong><p>Semana começa em {weekLabel[regime.weekStartsOn]}. Válido desde {label(regime.effectiveFrom)}.</p></> : <p>Sem regime configurado para esta data.</p>}</article><article className="cycle-card"><span className="cycle-kicker">como editar</span><p>Toque ou arraste as células. Use F para folga, R para recesso, A para afastamento e O para outro. A alteração fica registrada no histórico.</p></article></aside></div></> : null;
  return <section className="cycle-page">{managerMap}
    {(!roleCanWrite(role) || review) && <div className="cycle-toolbar"><div><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight/></button></div><div>{role === "adm" && <button className="cycle-secondary" onClick={() => setRegimeOpen(true)}><Settings2/> Configurar regime</button>}{roleCanWrite(role) && <button className="cycle-secondary" onClick={() => setCalendarOpen(true)}><Plus/> Definir folga</button>}{role !== "dir" && <button className="cycle-primary" onClick={() => setAskOpen(true)}><Plus/> Pedir folga</button>}</div></div>}
    <State loading={loading} error={error} empty={false} onRetry={reload}><div className="cycle-leave-layout"><article className="cycle-card cycle-calendar-card"><header><div><span className="cycle-kicker">{role === "mem" ? "suas folgas" : "calendário do grupo"}</span><h2>{role === "mem" ? "Seu mês" : role === "sup" ? scopeTitle : "Folgas da equipe"}</h2></div><span className="cycle-legend"><i className="approved"/> aprovada <i className="pending"/> pendente</span></header><MonthGrid selected={month} requests={visibleRequests} people={visiblePeople}/><footer>{visiblePeople.slice(0, 5).map((person) => <span className="cycle-person-key" key={person.id}><b>{initials(person.name)}</b>{person.name}<small>{person.area}</small></span>)}</footer></article><aside className="cycle-stack"><article className="cycle-card"><span className="cycle-kicker">regime em vigor</span>{regime ? <><b className="cycle-number">{regime.weeklyDays}</b><strong>{regime.weeklyDays === 1 ? "folga por semana" : "folgas por semana"}</strong><p>Semana começa em {weekLabel[regime.weekStartsOn]}. Válido desde {label(regime.effectiveFrom)}.</p></> : <p>Sem regime configurado para esta data.</p>}</article><article className="cycle-card"><span className="cycle-kicker">fila de pedidos</span>{visibleRequests.filter((request) => request.status === "PENDING").length ? visibleRequests.filter((request) => request.status === "PENDING").map((request) => <div className="cycle-request" key={request.id}><div><strong>{request.userName}</strong><small>{request.areaName} · {request.startDate} — {request.endDate}</small></div>{roleCanWrite(role) ? <div><button onClick={() => setDecision({ request, status: "APPROVED" })}>Aprovar</button><button onClick={() => setDecision({ request, status: "DENIED" })}>Negar</button></div> : <span className="cycle-tag warn">pendente</span>}</div>) : <p>Nenhum pedido esperando decisão.</p>}</article></aside></div></State>
    {askOpen && <div className="cycle-modal"><form onSubmit={requestLeave}><header><h2>Pedir folga</h2><button type="button" onClick={() => setAskOpen(false)}>×</button></header><label>Começa<input name="startDate" type="date" defaultValue={from} required/></label><label>Termina<input name="endDate" type="date" defaultValue={from} required/></label><label>Conte o necessário<textarea name="reason" required minLength={2}/></label><footer><button className="cycle-primary">Enviar pedido</button></footer></form></div>}
    {regimeOpen && <div className="cycle-modal"><form onSubmit={saveRegime}><header><h2>Regime de folgas</h2><button type="button" onClick={() => setRegimeOpen(false)}>×</button></header><label>Vigência começa<input name="effectiveFrom" type="date" defaultValue={from} required/></label><label>Folgas por semana<input name="weeklyDays" type="number" min="0" max="7" defaultValue={regime?.weeklyDays ?? 1}/></label><label>Corte da semana<select name="weekStartsOn" defaultValue={regime?.weekStartsOn ?? 4}>{weekLabel.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label>Recesso / observação<textarea name="recessRules"/></label><footer><button className="cycle-primary">Salvar regime</button></footer></form></div>}
    {calendarOpen && <div className="cycle-modal"><form onSubmit={putOnCalendar}><header><h2>Definir folga</h2><button type="button" onClick={() => setCalendarOpen(false)}>×</button></header><p>Folga decidida pela gestão: a Escala não convoca a pessoa nesse período.</p><label>Pessoa<select name="userId" required>{visiblePeople.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.area}</option>)}</select></label><label>Começa<input name="startDate" type="date" defaultValue={from} required/></label><label>Termina<input name="endDate" type="date" defaultValue={from} required/></label><label>Motivo<textarea name="reason" required minLength={2}/></label><footer><button className="cycle-primary">Guardar no calendário</button></footer></form></div>}
    {decision && <div className="cycle-modal"><form onSubmit={decide}><header><h2>{decision.status === "APPROVED" ? "Aprovar folga" : "Negar folga"}</h2><button type="button" onClick={() => setDecision(null)}>×</button></header><p>{decision.request.userName} · {decision.request.startDate} — {decision.request.endDate}</p><label>Motivo da decisão<textarea name="reason" required minLength={2}/></label><footer><button className="cycle-primary">Confirmar</button></footer></form></div>}
  </section>;
}

export function PanelPage({ role }: { role: Role }) {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const [data, setData] = useState<{ coverage: { expected: number; checkedIn: number; pct: number }; checkIns: { checkedIn: number; late: number; absent: number }; leaves: { approved: number }; vacancies: { open: number }; scales: { drafts: number } } | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [tentativaPainel, setTentativaPainel] = useState(0);
  useEffect(() => { if (role === "mem") return; setLoading(true); setError(""); if (review) { setData({ coverage: { expected: 18, checkedIn: 14, pct: 78 }, checkIns: { checkedIn: 14, late: 2, absent: 1 }, leaves: { approved: 1 }, vacancies: { open: 1 }, scales: { drafts: 0 } }); setLoading(false); return; } customFetch(`/api/panel-indicators?date=${todayISO()}`).then((result) => setData(result as typeof data)).catch(() => setError("Não consegui calcular os indicadores.")).finally(() => setLoading(false)); }, [review, role, tentativaPainel]);
  if (role === "mem") return <section className="cycle-page"><div className="cycle-empty-panel"><img src="/asa/consultando.webp" alt=""/><h2>O Elenco não tem Painel</h2><p>Seus números moram no Meu Dia — sem comparação com colegas.</p><Link href="/meu-dia">Abrir Meu Dia</Link></div></section>;
  const cards = data ? [{ label: "Cobertura agora", value: data.coverage.expected ? `${data.coverage.pct}%` : "—", sub: data.coverage.expected ? `${data.coverage.checkedIn} de ${data.coverage.expected} com check-in` : "ninguém escalado hoje em escala publicada", tone: "" }, { label: "Atrasos", value: String(data.checkIns.late), sub: "check-ins marcados como atraso", tone: "warn" }, { label: "Posições em risco", value: String(data.vacancies.open), sub: "Livro do Dia pede cobertura", tone: "bad" }, { label: "Folgas hoje", value: String(data.leaves.approved), sub: "pedidos aprovados", tone: "" }] : [];
  return <section className="cycle-page"><State loading={loading} error={error} empty={false} onRetry={() => setTentativaPainel((n) => n + 1)}><div className="cycle-panel-head"><div><span className="cycle-kicker">hoje · {label(todayISO())}</span><h2>Painel da operação</h2></div>{role === "dir" && <span className="cycle-tag">somente leitura</span>}</div><div className="cycle-panel-grid">{cards.map((card) => <article className={`cycle-card cycle-metric ${card.tone}`} key={card.label}><span>{card.label}</span><b>{card.value}</b><small>{card.sub}</small></article>)}</div><div className="cycle-panel-columns"><article className="cycle-card"><span className="cycle-kicker">o que pede ação</span>{data && <div className="cycle-action-list"><Link href="/check-in"><b>{data.checkIns.absent}</b><span>falta(s) registrada(s) · abrir Check-in</span></Link><Link href="/livro-do-dia"><b>{data.vacancies.open}</b><span>posição(ões) em risco · abrir Livro do Dia</span></Link><Link href="/folgas"><b>{data.leaves.approved}</b><span>folga(s) aprovada(s) hoje · abrir Folgas</span></Link></div>}</article><article className="cycle-card"><span className="cycle-kicker">origem dos números</span><p>Cobertura vem da Escala e do Check-in. Posições em risco vêm do Livro do Dia. Folgas são pedidos aprovados em vigor.</p></article></div></State></section>;
}
