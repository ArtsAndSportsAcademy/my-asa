import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { Check, Clock3, Phone, WifiOff, X, Plus } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { REVIEW_PERSON } from "@/lib/amostra";
import "./checkin-shifts.css";

type Role = "adm" | "dir" | "sup" | "mem";
type State = "EXPECTED" | "ARRIVED" | "LATE" | "ABSENT" | "NO_RESPONSE" | "LATE_UNCONFIRMED";
type Shift = { id?: string; name: string; startTime: string; endTime: string };
type RecordRow = { id: string; date: string; userId: string; shiftState: State; checkedInAt: string | null; reportedAt: string | null; etaMinutes: number | null; lateArrival: boolean; excuseReason: string | null; reasonCode: string | null };
type Item = { date: string; shiftId: string; shiftName: string; startTime: string; endTime: string; userId: string; userName: string; opensAt: string; closesAt: string; firstActivityAt: string; extended: boolean; state: State; canAnswer: boolean; checkIn: RecordRow | null; activities: { key: string; date: string; label: string; startTime: string; endTime: string | null; locationId: string; locationName: string }[] };
type History = { checkIn: RecordRow; name: string; shiftName: string };
type Summary = { date: string; shiftId: string; shiftName: string; startTime: string; endTime: string; counts: Record<State, number> };
type Aggregate = { date: string; counts: Record<State, number> };
type Occurrence = { id: string; personId: string; personName: string; type: string; description: string; state: "aberta" | "em_analise" | "resolvida" };
const LABEL: Record<State, string> = { EXPECTED: "Ainda sem resposta", ARRIVED: "Chegada confirmada", LATE: "Atraso avisado", ABSENT: "Não vem", NO_RESPONSE: "Sem resposta", LATE_UNCONFIRMED: "Atraso sem chegada confirmada" };
const REASONS: Record<string, string> = { ILLNESS: "Enfermidade", PERSONAL: "Problema pessoal", TRANSPORT: "Transporte", OTHER: "Outro" };
const today = () => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const p = (key: string) => parts.find(part => part.type === key)!.value; return `${p("year")}-${p("month")}-${p("day")}`; };
const moveDate = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const shortDate = (value: string) => value.split("-").reverse().join("/");
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível guardar. Seus dados continuam aqui; tente novamente.";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog className="shift-dialog" ref={ref} onCancel={onClose} aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>{children}</dialog>;
}

function samples(role: Role, date: string): Item[] {
  if (!import.meta.env.DEV) return [];
  const names = role === "mem" ? [REVIEW_PERSON.mem] : [REVIEW_PERSON.mem, "Pessoa da equipe 2", "Pessoa da equipe 3", "Pessoa da equipe 4"];
  return ["Dia", "Noite"].flatMap((shiftName, s) => names.map((userName, i) => ({ date, shiftId: `sample-${s}`, shiftName, startTime: s ? "18:00" : "07:00", endTime: s ? "22:00" : "18:00", userId: `sample-person-${i}`, userName, opensAt: `${date}T06:00:00-03:00`, firstActivityAt: `${date}T08:00:00-03:00`, closesAt: `${date}T23:45:00-03:00`, extended: s === 1, state: (role === "mem" ? "EXPECTED" : ["ARRIVED", "LATE", "ABSENT", "EXPECTED"][i]) as State, canAnswer: role !== "dir" && (role === "mem" || i === 1 || i === 3), checkIn: null, activities: [{ key: `sample-activity-${s}`, date, label: s ? "Show da noite" : "Preparação e ensaio", startTime: s ? "23:00" : "08:00", endTime: s ? "23:45" : "10:00", locationId: "sample-location", locationName: "Local da escala" }] })));
}

export function CheckInPage({ role }: { role: Role }) {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const [date, setDate] = useState(today), [month, setMonth] = useState(today().slice(0, 7));
  const [items, setItems] = useState<Item[]>([]), [history, setHistory] = useState<History[]>([]), [recent, setRecent] = useState<History[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]), [aggregate, setAggregate] = useState<Aggregate[]>([]), [recentAggregate, setRecentAggregate] = useState<Aggregate[]>([]);
  const [configured, setConfigured] = useState(false), [tab, setTab] = useState(""), [section, setSection] = useState("today");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [reload, setReload] = useState(0), [online, setOnline] = useState(navigator.onLine);
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([]);
  const [configuration, setConfiguration] = useState<Shift[]>([]), [effective, setEffective] = useState(""), [gaps, setGaps] = useState<{ startTime: string; endTime: string }[]>([]);
  const [selected, setSelected] = useState<{ item: Item; action: "READY" | "LATE" | "ABSENT" | "ARRIVED" } | null>(null);
  const [absenceCode, setAbsenceCode] = useState("");
  const [saving, setSaving] = useState(false), [dialogError, setDialogError] = useState(""), [notice, setNotice] = useState("");
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]), [occurrenceDialog, setOccurrenceDialog] = useState<Occurrence | "new" | null>(null);
  useEffect(() => { setSection("today"); setTab(""); setSelected(null); setOccurrenceDialog(null); }, [role]);
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  useEffect(() => { setDialogError(""); setAbsenceCode(""); }, [selected, occurrenceDialog]);
  useEffect(() => {
    let stale = false;
    setError(""); setLoading(true);
    if (review) {
      const sampleItems = samples(role, date); setItems(role === "dir" ? [] : sampleItems); setSummary(["Dia", "Noite"].map((shiftName, index) => ({ date, shiftId: `sample-${index}`, shiftName, startTime: index ? "18:00" : "07:00", endTime: index ? "22:00" : "18:00", counts: { ARRIVED: 1, LATE: 1, ABSENT: 1, EXPECTED: 1, NO_RESPONSE: 0, LATE_UNCONFIRMED: 0 } }))); setConfigured(true); setConfiguration([{ name: "Dia", startTime: "07:00", endTime: "18:00" }, { name: "Noite", startTime: "18:00", endTime: "22:00" }]); setEffective(moveDate(today(), 1)); setGaps([{ startTime: "22:00", endTime: "07:00" }]);
      const sampleHistory: History[] = Array.from({ length: 5 }, (_, i) => ({ name: REVIEW_PERSON.mem, shiftName: "Dia", checkIn: { id: `sample-history-${i}`, date: moveDate(date, -i - 1), userId: "sample-person-0", shiftState: i === 2 ? "ABSENT" : "ARRIVED", checkedInAt: `${date}T08:00:00-03:00`, reportedAt: `${date}T07:50:00-03:00`, etaMinutes: i === 1 ? 20 : null, lateArrival: i === 1, excuseReason: null, reasonCode: i === 2 ? "TRANSPORT" : null } }));
      setHistory(role === "dir" ? [] : sampleHistory); setRecent(role === "dir" ? [] : sampleHistory); setAggregate([{ date: moveDate(date, -1), counts: { ARRIVED: 3, LATE: 0, ABSENT: 1, EXPECTED: 0, NO_RESPONSE: 0, LATE_UNCONFIRMED: 0 } }]); setRecentAggregate([{ date: moveDate(date, -1), counts: { ARRIVED: 3, LATE: 0, ABSENT: 1, EXPECTED: 0, NO_RESPONSE: 0, LATE_UNCONFIRMED: 0 } }]); setOccurrences(role === "dir" ? [] : [{ id: "sample-occurrence", personId: "sample-person-1", personName: "Pessoa da equipe 2", type: "Transporte", description: "Acompanhamento da chegada", state: "aberta" }]); setLoading(false); return;
    }
    const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 12).getDate();
    Promise.all([
      customFetch<{ configured: boolean; items: Item[]; summary: Summary[] }>(`/api/shift-checkins?date=${date}`),
      customFetch<{ records: History[]; aggregate?: Aggregate[] }>(`/api/shift-checkins/history?from=${month}-01&to=${month}-${monthEnd}`),
      customFetch<{ records: History[]; aggregate?: Aggregate[] }>(`/api/shift-checkins/history?from=${moveDate(today(), -29)}&to=${today()}`),
      customFetch<{ next: Shift[]; effectiveFrom: string; gaps: { startTime: string; endTime: string }[] }>("/api/shift-checkins/configuration"),
      role === "mem" || role === "dir" ? Promise.resolve({ occurrences: [] }) : customFetch<{ occurrences: Occurrence[] }>(`/api/occurrences?from=${date}&to=${date}`),
      customFetch<{ contacts: { name: string; phone: string }[] }>("/api/shift-checkins/contact").catch(() => ({ contacts: [] })),
    ]).then(([result, monthly, thirtyDays, config, occ, contact]) => {
      if (stale) return;
      setItems(result.items); setSummary(result.summary); setConfigured(result.configured); setHistory(monthly.records); setRecent(thirtyDays.records); setAggregate(monthly.aggregate ?? []); setRecentAggregate(thirtyDays.aggregate ?? []); setConfiguration(config.next); setEffective(config.effectiveFrom); setGaps(config.gaps); setOccurrences(occ.occurrences); setContacts(contact.contacts);
    }).catch(() => { if (!stale) setError("Não consegui abrir os check-ins. Confira a conexão e tente novamente."); }).finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [date, month, role, review, reload]);
  const tabs = [...new Map((role === "dir" ? summary : items).map(item => [`${item.date}:${item.shiftId}`, item])).entries()];
  const activeTab = tabs.some(([key]) => key === tab) ? tab : tabs[0]?.[0];
  const visible = items.filter(item => `${item.date}:${item.shiftId}` === activeTab);
  const arrivals = recent.filter(row => row.checkIn.shiftState === "ARRIVED");
  const punctual = arrivals.filter(row => !row.checkIn.lateArrival).length;
  const rate = arrivals.length ? `${Math.round(punctual * 100 / arrivals.length)}%` : "—";
  const directionCounts = summary.find(item => `${item.date}:${item.shiftId}` === activeTab)?.counts;
  const directionArrivals = recentAggregate.reduce((total, row) => total + (row.counts.ARRIVED ?? 0), 0);
  const openAnswer = (item: Item, action: NonNullable<typeof selected>["action"]) => { setSelected({ item, action }); setDialogError(""); };
  const sendAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected || saving) return;
    const form = new FormData(event.currentTarget);
    const { item, action } = selected;
    const body = { date: item.date, shiftId: item.shiftId, userId: item.userId, action, ...(action === "LATE" ? { etaMinutes: Number(form.get("eta")) } : {}), ...(action === "ABSENT" ? { reasonCode: String(form.get("reasonCode")), reason: String(form.get("reason") ?? "") } : {}) };
    setSaving(true); setDialogError("");
    try {
      if (review) setItems(rows => rows.map(row => row.userId === item.userId && row.shiftId === item.shiftId ? { ...row, state: action === "READY" || action === "ARRIVED" ? "ARRIVED" : action, canAnswer: action === "LATE", checkIn: { id: "sample", date, userId: item.userId, shiftState: action === "READY" || action === "ARRIVED" ? "ARRIVED" : action, etaMinutes: body.etaMinutes ?? row.checkIn?.etaMinutes ?? null, reasonCode: body.reasonCode ?? null, excuseReason: body.reason ?? null, checkedInAt: action === "READY" || action === "ARRIVED" ? new Date().toISOString() : null, reportedAt: new Date().toISOString(), lateArrival: false } } : row));
      else { await customFetch("/api/shift-checkins", { method: "POST", body: JSON.stringify(body) }); setReload(value => value + 1); }
      setSelected(null); setNotice(review ? "Check-in atualizado na amostra." : "Check-in registrado para este turno.");
    } catch (err) { setDialogError(message(err)); } finally { setSaving(false); }
  };
  const saveConfiguration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (saving) return; setSaving(true); setError("");
    try {
      if (review) setNotice("Amostra: configuração agendada para amanhã. Os turnos de hoje não mudaram.");
      else { await customFetch("/api/shift-checkins/configuration", { method: "PUT", body: JSON.stringify({ shifts: configuration.map(({ name, startTime, endTime }) => ({ name, startTime, endTime })) }) }); setNotice("Configuração guardada. Vale a partir de amanhã."); setReload(value => value + 1); }
    } catch (err) { setError(message(err)); } finally { setSaving(false); }
  };
  const saveOccurrence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!occurrenceDialog || saving) return;
    const form = new FormData(event.currentTarget), reason = String(form.get("reason"));
    setSaving(true); setDialogError("");
    try {
      if (occurrenceDialog === "new") {
        const personId = String(form.get("personId")), type = String(form.get("type")), description = String(form.get("description"));
        if (review) setOccurrences(rows => [...rows, { id: `sample-${Date.now()}`, personId, personName: items.find(i => i.userId === personId)?.userName ?? "Pessoa", type, description, state: "aberta" }]);
        else await customFetch("/api/occurrences", { method: "POST", body: JSON.stringify({ date, personId, type, description, reason }) });
      } else {
        const state = occurrenceDialog.state === "aberta" ? "em_analise" : "resolvida";
        if (review) setOccurrences(rows => rows.map(row => row.id === occurrenceDialog.id ? { ...row, state } : row));
        else await customFetch(`/api/occurrences/${occurrenceDialog.id}/state`, { method: "PATCH", body: JSON.stringify({ state, reason }) });
      }
      setOccurrenceDialog(null); if (!review) setReload(value => value + 1);
    } catch (err) { setDialogError(message(err)); } finally { setSaving(false); }
  };

  return <section className={`shift-page shift-role-${role}`}>
    <header className="shift-heading"><div><span className="shift-eyebrow">O dia em execução</span><h1>{role === "mem" ? "Seu check-in" : "Check-in e ocorrências"}</h1><p>Uma resposta por turno. Todas as atividades cobertas.</p></div><label>Dia<input type="date" value={date} onChange={e => setDate(e.target.value || today())}/></label></header>
    <nav className="shift-sections" aria-label="Seções do check-in">{[["today", "Check-in"], ["history", "Histórico do mês"], ...(["adm", "sup"].includes(role) ? [["occurrences", "Ocorrências"]] : []), ...(role === "adm" ? [["configuration", "Turnos"]] : [])].map(([key, label]) => <button key={key} aria-pressed={section === key} onClick={() => setSection(key)}>{label}</button>)}</nav>
    {!online && <div className="shift-offline" role="alert"><WifiOff/><div><strong>Sem sinal. Avise a supervisão.</strong><p>O check-in não foi enviado. Não feche esta tela se ainda estiver preenchendo.</p>{contacts.length ? contacts.map(contact => <a key={contact.phone} href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}><Phone size={16}/> Ligar para {contact.name}</a>) : <p>Nenhum telefone compartilhado disponível. Use seu contato habitual com a supervisão.</p>}</div></div>}
    {notice && <p className="shift-notice" role="status">{notice}</p>}
    {error && <div className="shift-error" role="alert">{error}<button onClick={() => setReload(value => value + 1)}>Tentar de novo</button></div>}
    {loading ? <div className="shift-skeleton" aria-busy="true" aria-label="Carregando turnos"><i/><i/><i/></div> : <>
      {section === "today" && <>
        {!configured ? <article className="shift-card"><h2>Os turnos ainda não estão configurados</h2><p>{role === "adm" ? "Na aba Turnos, cadastre de 1 a 3 turnos. A configuração começa amanhã." : "A Administração precisa configurar os turnos. Consulte sua escala e avise a supervisão."}</p><Link href="/escalas">Ver escala</Link></article> : !(role === "dir" ? summary.length : items.length) ? <article className="shift-card"><h2>Nenhum turno publicado para este dia</h2><p>O check-in aparece quando há uma atividade na escala publicada dentro do seu acesso.</p><Link href="/escalas">Ver escala</Link></article> : <>
          <nav className="shift-tabs" aria-label="Turnos">{tabs.map(([key, item]) => <button key={key} aria-pressed={key === activeTab} onClick={() => setTab(key)}><strong>{item.shiftName}</strong><span>{item.startTime} — {item.endTime}{item.date !== date ? " · começou ontem" : ""}</span></button>)}</nav>
          {role !== "mem" && <div className="shift-counts">{(["ARRIVED", "LATE", "ABSENT", "EXPECTED", "NO_RESPONSE", "LATE_UNCONFIRMED"] as State[]).map(state => <div key={state}><b>{role === "dir" ? directionCounts?.[state] ?? 0 : visible.filter(i => i.state === state).length}</b><span>{LABEL[state]}</span></div>)}</div>}
          {role === "dir" && <article className="shift-card"><h2>Visão da Direção</h2><p>A Direção acompanha somente os números da casa. Nomes e motivos permanecem com a equipe autorizada.</p><p>Chegadas confirmadas nos últimos 30 dias: {directionArrivals}. Faltas e atrasos aparecem separadamente no histórico.</p></article>}
          {role !== "dir" && <div className="shift-layout"><main className="shift-stack">{visible.map(item => <article className={`shift-card shift-person ${item.state.toLowerCase()}`} key={`${item.userId}:${item.shiftId}`}>
            <header><div><span className="shift-eyebrow">{role === "mem" ? "Você está no local e pronta?" : item.shiftName}</span><h2>{role === "mem" ? "Como você chega neste turno?" : item.userName}</h2></div><span className="shift-state">{LABEL[item.state]}{item.checkIn?.lateArrival ? " · com atraso" : ""}</span></header>
            {item.checkIn?.checkedInAt && <p>Chegada registrada às {time(item.checkIn.checkedInAt)}.</p>}
            {item.checkIn?.etaMinutes && <p>Previsão informada: {item.checkIn.etaMinutes} minutos após o aviso.</p>}
            {item.state === "ABSENT" && <p className="shift-absence">{item.userName} não vem neste turno. {item.checkIn?.reasonCode && REASONS[item.checkIn.reasonCode]} {role !== "mem" && <Link href={`/escalas${review ? "?amostra=1" : ""}`}>Resolver na Escala →</Link>}</p>}
            {item.canAnswer && <div className="shift-actions">{item.state === "LATE" ? <button disabled={!online} className="shift-ready" onClick={() => openAnswer(item, "ARRIVED")}><Check/>{role === "mem" ? "Cheguei" : "Marcar chegada"}</button> : <><button disabled={!online} className="shift-ready" onClick={() => openAnswer(item, "READY")}><Check/>{role === "mem" ? "Pronta" : "Marcar chegada"}</button><button disabled={!online} className="shift-late" onClick={() => openAnswer(item, "LATE")}><Clock3/>Atraso</button><button disabled={!online} className="shift-absent" onClick={() => openAnswer(item, "ABSENT")}><X/>Falta</button></>}</div>}
            {!item.canAnswer && item.state === "EXPECTED" && <p>Abre às {time(item.opensAt)}, duas horas antes da primeira atividade.</p>}
            <details open={role === "mem"}><summary>O que o check-in cobre neste turno · {item.activities.length} atividade(s)</summary><ul className="shift-activities">{item.activities.map(activity => <li key={`${activity.date}:${activity.key}:${activity.locationId}`}><time>{activity.startTime}<small>{activity.endTime ?? ""}</small></time><div><strong>{activity.label}</strong><span>{activity.locationName}{activity.date !== item.date ? ` · ${shortDate(activity.date)}` : ""}</span></div></li>)}</ul></details>
            {item.extended && <p className="shift-extension">Há atividade após o horário do turno. O check-in encerra às {time(item.closesAt)}, no fim da última atividade vinculada.</p>}
          </article>)}</main><aside className="shift-stack"><article className="shift-card shift-insight"><span className="shift-eyebrow">Últimos 30 dias · {role === "mem" ? "seus números" : "seu acesso"}</span><strong className="shift-rate">{rate}</strong><h2>Chegadas no prazo</h2><p>{punctual} de {arrivals.length} chegadas confirmadas, considerando a tolerância. Faltas ficam separadas.</p><dl><div><dt>Atrasos confirmados</dt><dd>{arrivals.length - punctual}</dd></div><div><dt>Faltas avisadas</dt><dd>{recent.filter(r => r.checkIn.shiftState === "ABSENT").length}</dd></div><div><dt>Sem resposta</dt><dd>{recent.filter(r => r.checkIn.shiftState === "NO_RESPONSE").length}</dd></div><div><dt>Atrasos sem chegada</dt><dd>{recent.filter(r => r.checkIn.shiftState === "LATE_UNCONFIRMED").length}</dd></div></dl><button onClick={() => setSection("history")}>Ver histórico do mês →</button></article><article className="shift-card"><h2>Uma resposta vale pelo turno</h2><p>Se houver outro turno, faça um novo check-in. Avisar atraso não confirma a chegada: toque em “Cheguei” quando estiver no local.</p></article></aside></div>}
        </>}
      </>}
      {section === "history" && <article className="shift-card"><header><div><span className="shift-eyebrow">Sem misturar atraso e falta</span><h2>Histórico do mês</h2></div><label>Mês<input type="month" value={month} onChange={e => setMonth(e.target.value || today().slice(0, 7))}/></label></header>{role === "dir" ? (!aggregate.length ? <p>Nenhum registro neste mês.</p> : <ul className="shift-history">{aggregate.map(row => <li key={row.date}><time>{shortDate(row.date)}</time><div><strong>Números da casa</strong><span>{row.counts.ARRIVED ?? 0} chegadas · {row.counts.ABSENT ?? 0} faltas · {row.counts.NO_RESPONSE ?? 0} sem resposta</span></div></li>)}</ul>) : !history.length ? <p>Nenhum check-in registrado neste mês dentro do seu acesso.</p> : <ul className="shift-history">{history.map(row => <li key={row.checkIn.id}><time>{shortDate(row.checkIn.date)}</time><div><strong>{role === "mem" ? row.shiftName : `${row.name} · ${row.shiftName}`}</strong><span>{LABEL[row.checkIn.shiftState]}{row.checkIn.lateArrival ? " · com atraso" : ""}</span>{row.checkIn.reasonCode && <small>{REASONS[row.checkIn.reasonCode]}{row.checkIn.excuseReason ? ` · ${row.checkIn.excuseReason}` : ""}</small>}</div>{row.checkIn.checkedInAt && <span>{time(row.checkIn.checkedInAt)}</span>}</li>)}</ul>}</article>}
      {section === "configuration" && role === "adm" && <form className="shift-card shift-config" onSubmit={saveConfiguration}><span className="shift-eyebrow">Administração · todos os locais</span><h2>Turnos da ASA</h2><p>Cadastre apenas nome e horário, de 1 a 3 turnos. Mudanças valem em {effective ? shortDate(effective) : "amanhã"}; os registros anteriores são preservados.</p>{configuration.map((shift, index) => <fieldset key={index}><legend>Turno {index + 1}</legend><label>Nome<input required maxLength={80} value={shift.name} onChange={e => setConfiguration(rows => rows.map((row, i) => i === index ? { ...row, name: e.target.value } : row))}/></label><label>Início<input type="time" required value={shift.startTime} onChange={e => setConfiguration(rows => rows.map((row, i) => i === index ? { ...row, startTime: e.target.value } : row))}/></label><label>Fim<input type="time" required value={shift.endTime} onChange={e => setConfiguration(rows => rows.map((row, i) => i === index ? { ...row, endTime: e.target.value } : row))}/></label><button type="button" aria-label={`Retirar turno ${index + 1} da configuração futura`} onClick={() => setConfiguration(rows => rows.filter((_, i) => i !== index))}><X size={18}/></button></fieldset>)}{configuration.length < 3 && <button type="button" onClick={() => setConfiguration(rows => [...rows, { name: "", startTime: "", endTime: "" }])}><Plus size={16}/>Adicionar turno</button>}<div className="shift-gap"><strong>Horários sem turno</strong>{gaps.length ? gaps.map((gap, i) => <p key={i}>{gap.startTime} — {gap.endTime} na configuração guardada.</p>) : <p>{configuration.length ? "Confira os intervalos ao guardar os horários." : "Ainda não há configuração."}</p>}<p>Atividades nesse intervalo pertencem ao turno anterior e estendem seu encerramento até o fim da última atividade vinculada.</p></div><button className="shift-primary" disabled={saving || !online || !configuration.length}>{saving ? "Guardando…" : "Guardar para amanhã"}</button></form>}
      {section === "occurrences" && ["adm", "sup"].includes(role) && <article className="shift-card"><header><div><span className="shift-eyebrow">Acompanhamento separado da presença</span><h2>Ocorrências</h2></div><button onClick={() => setOccurrenceDialog("new")} disabled={!online || !items.length}>Registrar ocorrência</button></header><p>Aberta → em análise → resolvida. Toda mudança exige motivo.</p>{!occurrences.length && <p>Nenhuma ocorrência neste dia dentro do seu acesso.</p>}{occurrences.map(row => <div className="shift-occurrence" key={row.id}><div><strong>{row.personName} · {row.type}</strong><p>{row.description}</p><span>{row.state.replace("_", " ")}</span></div>{row.state !== "resolvida" && <button onClick={() => setOccurrenceDialog(row)}>{row.state === "aberta" ? "Analisar" : "Resolver"}</button>}</div>)}</article>}
    </>}
    {selected && <Dialog title={selected.action === "LATE" ? "Avisar atraso" : selected.action === "ABSENT" ? "Avisar falta" : "Confirmar chegada"} onClose={() => !saving && setSelected(null)}><form onSubmit={sendAnswer}><p>{selected.item.userName} · {selected.item.shiftName}</p>{selected.action === "LATE" && <label>Em quantos minutos você chega?<input name="eta" type="number" inputMode="numeric" min="1" max="1440" required autoFocus/></label>}{selected.action === "ABSENT" && <><label>Motivo<select name="reasonCode" required value={absenceCode} onChange={event => setAbsenceCode(event.target.value)}><option value="">Escolha um motivo</option>{Object.entries(REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Conte mais {absenceCode === "OTHER" ? "(obrigatório)" : "(opcional)"}<textarea name="reason" maxLength={2000} required={absenceCode === "OTHER"}/></label></>}{["READY", "ARRIVED"].includes(selected.action) && <p>Confirme somente quando estiver no local e pronta para a atividade.</p>}{dialogError && <p className="shift-error" role="alert">{dialogError}</p>}<button className="shift-primary" disabled={saving || !online}>{saving ? "Registrando…" : "Confirmar"}</button></form></Dialog>}
    {occurrenceDialog && <Dialog title={occurrenceDialog === "new" ? "Registrar ocorrência" : "Atualizar ocorrência"} onClose={() => !saving && setOccurrenceDialog(null)}><form onSubmit={saveOccurrence}>{occurrenceDialog === "new" && <><label>Pessoa<select name="personId" required>{[...new Map(items.map(item => [item.userId, item])).values()].map(item => <option key={item.userId} value={item.userId}>{item.userName}</option>)}</select></label><label>Tipo<input name="type" required/></label><label>Descrição<textarea name="description" required/></label></>}<label>Motivo do registro ou da mudança<textarea name="reason" required/></label>{dialogError && <p className="shift-error" role="alert">{dialogError}</p>}<button className="shift-primary" disabled={saving || !online}>{saving ? "Guardando…" : "Guardar ocorrência"}</button></form></Dialog>}
  </section>;
}
