import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, MapPin, Plus, RotateCw, Users, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";

type Role = "adm" | "dir" | "sup" | "mem";
type Person = { id: string; name?: string; displayName?: string; areaId?: string | null; areaName?: string | null };
type Operation = { id: string; name: string; status?: string };
type Area = { id: string; name: string };
type Location = { id: string; name: string };
type Entry = { id: string; source: string; sourceId: string; title: string; date: string; endDate?: string | null; startTime?: string | null; endTime?: string | null; status?: string; type?: string; response?: string; detail?: string; operationName?: string; location?: string | null; reason?: string | null; alternativeDetails?: string | null };
type AgendaEvent = { id: string; title: string; type: string; date: string; startTime?: string | null; endTime?: string | null; status: string; operationId: string; myResponse?: string | null; participants?: { id: string; name: string; response: string }[]; reason?: string | null; alternativeDetails?: string | null; alternativeDate?: string | null; alternativeStartTime?: string | null; alternativeEndTime?: string | null; location?: string | null };
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const parseDate = (value: string) => new Date(value + "T12:00:00");
const keyDate = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (value: string, n: number) => { const d = parseDate(value); d.setDate(d.getDate() + n); return keyDate(d); };
const monday = (value: string) => { const d = parseDate(value); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyDate(d); };
const labelDate = (value: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short" }) => parseDate(value).toLocaleDateString("pt-BR", options);
const nameOf = (person?: Person) => person?.displayName || person?.name || "Pessoa";
const eventTypes: Record<string, string> = { MEETING: "Reunião", REHEARSAL: "Ensaio" };
const sourceLabels: Record<string, string> = { SCALE: "Escala publicada", LEAVE: "Folga", DAILY_BOOK: "Livro do Dia", AGENDA: "Agenda" };
const statuses: Record<string, string> = { DRAFT: "Rascunho", PROPOSED: "Proposta", CONFIRMED: "Confirmado", REJECTED: "Negada", SUSPENDED: "Suspenso", CANCELLED: "Cancelado", COMPLETED: "Realizado" };
const timeRange = (a?: string | null, b?: string | null) => !a ? "Horário não definido" : b ? a.slice(0, 5) + "–" + b.slice(0, 5) : a.slice(0, 5);
const overlaps = (a: string, b: string, c?: string | null, d?: string | null) => !c || (a < (d || c) && (c < b || !d));

export default function AgendaWorkspacePage({ role }: { role: Role }) {
  const { user } = useAuth();
  const currentUser = user as Person | null;
  const manager = role !== "mem";
  const [weekStart, setWeekStart] = useState(() => monday(today()));
  const [day, setDay] = useState(today());
  const [personId, setPersonId] = useState(user?.id ?? "");
  const [people, setPeople] = useState<Person[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"journey" | "requests">("journey");
  const [formOpen, setFormOpen] = useState(false);
  const [decision, setDecision] = useState<AgendaEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", type: "MEETING", operationId: "", areaId: currentUser?.areaId ?? "", locationId: "", location: "", date: today(), startTime: "", endTime: "", notes: "", participantIds: [] as string[] });
  const [reply, setReply] = useState({ reason: "", alternativeDetails: "", alternativeDate: "", alternativeStartTime: "", alternativeEndTime: "" });
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayEntries = useMemo(() => entries.filter((item) => item.date === day || Boolean(item.endDate && item.date <= day && item.endDate >= day)), [entries, day]);
  const pending = useMemo(() => manager ? events.filter((item) => item.status === "DRAFT" || item.status === "PROPOSED") : events.filter((item) => item.status === "PROPOSED" || item.status === "REJECTED" || item.myResponse === "PENDING"), [events, manager]);
  const invitees = useMemo(() => people.filter((person) => person.id !== user?.id), [people, user?.id]);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const suffix = personId ? "&personId=" + encodeURIComponent(personId) : "";
      const [eventData, journeyData] = await Promise.all([
        customFetch<{ events: AgendaEvent[] }>("/api/agenda/events?from=" + weekStart + "&to=" + weekEnd),
        customFetch<{ events: Entry[] }>("/api/agenda/journey?from=" + weekStart + "&to=" + weekEnd + suffix),
      ]);
      setEvents(eventData.events ?? []); setEntries(journeyData.events ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não consegui carregar a Agenda."); }
    finally { setLoading(false); }
  }, [personId, weekEnd, weekStart]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    let active = true;
    const references = [
      customFetch<{ users: Person[] }>("/api/users"),
      customFetch<{ operations: Operation[] }>("/api/operations"),
      manager ? customFetch<{ areas: Area[] }>("/api/areas") : Promise.resolve({ areas: [] as Area[] }),
      manager ? customFetch<{ locations: Location[] }>("/api/locations") : Promise.resolve({ locations: [] as Location[] }),
    ] as const;
    Promise.all(references).then(([u, o, a, l]) => {
      if (!active) return;
      const ops = (o.operations ?? []).filter((item) => !item.status || item.status === "ACTIVE");
      setPeople(u.users ?? []); setOperations(ops); setAreas(a.areas ?? []); setLocations(l.locations ?? []);
      setPersonId((current) => current || user?.id || u.users?.[0]?.id || "");
      setForm((current) => ({ ...current, operationId: current.operationId || ops[0]?.id || "", areaId: current.areaId || currentUser?.areaId || a.areas?.[0]?.id || "" }));
    }).catch(() => { if (active) setNotice("Não consegui carregar as opções de convocação."); });
    return () => { active = false; };
  }, [manager, currentUser?.areaId, user?.id]);
  useEffect(() => {
    if (role === "mem" && user?.id) {
      setPersonId(user.id);
      setForm((current) => ({ ...current, areaId: currentUser?.areaId ?? "", participantIds: current.participantIds.includes(user.id) ? current.participantIds : [...current.participantIds, user.id] }));
    }
  }, [role, currentUser?.areaId, user?.id]);

  const moveWeek = (n: number) => { const next = addDays(weekStart, 7 * n); setWeekStart(next); setDay(next); };
  const openForm = () => {
    setForm({ title: "", type: "MEETING", operationId: operations[0]?.id ?? "", areaId: currentUser?.areaId ?? areas[0]?.id ?? "", locationId: "", location: "", date: day, startTime: "", endTime: "", notes: "", participantIds: role === "mem" && user?.id ? [user.id] : [] });
    setConflicts([]); setFormOpen(true);
  };
  const togglePerson = (id: string) => setForm((current) => ({ ...current, participantIds: current.participantIds.includes(id) ? current.participantIds.filter((v) => v !== id) : [...current.participantIds, id] }));
  const checkConflicts = async () => {
    setConflicts([]);
    if (!form.date || !form.startTime || !form.endTime || form.endTime <= form.startTime) return;
    const inspectablePeople = [...new Set(form.participantIds)].filter((id) => manager || id === user?.id);
    const rows = await Promise.all(inspectablePeople.map(async (id) => {
      try {
        const data = await customFetch<{ events: Entry[] }>("/api/agenda/journey?from=" + form.date + "&to=" + form.date + "&personId=" + encodeURIComponent(id));
        return (data.events ?? []).filter((item) => item.source === "LEAVE" || overlaps(form.startTime, form.endTime, item.startTime, item.endTime))
          .map((item) => nameOf(people.find((p) => p.id === id) ?? (user?.id === id ? user : undefined)) + ": " + item.title + " (" + timeRange(item.startTime, item.endTime) + ")");
      } catch { return []; }
    }));
    setConflicts(rows.flat());
  };
  const saveEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.operationId || !form.date || !form.startTime || !form.endTime || form.endTime <= form.startTime) return;
    setSaving(true);
    try {
      await customFetch("/api/agenda/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, title: form.title.trim(), participantIds: [...new Set(form.participantIds)], visibility: "OPERATION" }) });
      setFormOpen(false); setNotice(role === "mem" ? "Proposta enviada para decisão." : "Compromisso salvo como rascunho."); await reload();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Não consegui salvar o compromisso."); }
    finally { setSaving(false); }
  };
  const act = async (path: string, body: unknown, success: string) => {
    setSaving(true);
    try { await customFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setNotice(success); await reload(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Não consegui atualizar a Agenda."); }
    finally { setSaving(false); }
  };
  const denyProposal = async (e: FormEvent) => {
    e.preventDefault(); if (!decision || !reply.reason.trim() || !reply.alternativeDetails.trim()) return;
    await act("/api/agenda/events/" + decision.id + "/decision", { decision: "REJECT", ...reply }, "Proposta negada com alternativa registrada.");
    setDecision(null); setReply({ reason: "", alternativeDetails: "", alternativeDate: "", alternativeStartTime: "", alternativeEndTime: "" });
  };

  return <section className="agenda-workspace">
    <div className="ag-intro"><div><span className="ag-kicker">20 · O DIA</span><p>Escala, folgas, Livro do Dia, ensaios e reuniões na jornada de cada pessoa.</p></div><div className="ag-actions">
      {manager && <label className="ag-person-picker"><Users size={16}/><select aria-label="Pessoa da jornada" value={personId} onChange={(e) => setPersonId(e.target.value)}><option value="">Minha jornada</option>{people.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}</select></label>}
      <button className="ag-icon-button" onClick={() => void reload()} aria-label="Atualizar agenda" title="Atualizar agenda"><RotateCw size={17}/></button>
      <button className="ag-primary" onClick={openForm}><Plus size={17}/>{role === "mem" ? "Propor horário" : "Marcar compromisso"}</button>
    </div></div>
    <div className="ag-week-nav"><button className="ag-icon-button" onClick={() => moveWeek(-1)} aria-label="Semana anterior"><ChevronLeft size={18}/></button><strong>{labelDate(weekStart, { day: "2-digit", month: "long" })} – {labelDate(weekEnd, { day: "2-digit", month: "long", year: "numeric" })}</strong><button className="ag-icon-button" onClick={() => moveWeek(1)} aria-label="Próxima semana"><ChevronRight size={18}/></button><button className="ag-today" onClick={() => { setWeekStart(monday(today())); setDay(today()); }}>Hoje</button></div>
    <div className="ag-day-strip" role="tablist" aria-label="Dias da semana">{days.map((d) => <button key={d} role="tab" aria-selected={day === d} className={day === d ? "selected" : ""} onClick={() => setDay(d)}><span>{labelDate(d, { weekday: "short" })}</span><strong>{labelDate(d, { day: "2-digit" })}</strong><i>{entries.some((item) => item.date === d || Boolean(item.endDate && item.date <= d && item.endDate >= d)) ? "•" : ""}</i></button>)}</div>
    <div className="ag-tabs" role="tablist"><button role="tab" aria-selected={tab === "journey"} onClick={() => setTab("journey")}>Jornada <span>{entries.length}</span></button><button role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>{manager ? "A revisar" : "Convites e propostas"}<span>{pending.length}</span></button></div>
    {notice && <div className="ag-notice" role="status">{notice}<button aria-label="Dispensar aviso" onClick={() => setNotice("")}><X size={16}/></button></div>}
    {error && <div className="ag-error" role="alert"><CircleAlert size={18}/><span>{error}</span><button onClick={() => void reload()}>Tentar de novo</button></div>}
    {tab === "journey" ? <>
      <div className="ag-day-heading"><div><span>{labelDate(day, { weekday: "long", day: "numeric", month: "long" })}</span><h2>{personId ? nameOf(people.find((p) => p.id === personId) ?? user ?? undefined) : "Minha jornada"}</h2></div><span className="ag-count">{dayEntries.length} {dayEntries.length === 1 ? "compromisso" : "compromissos"}</span></div>
      {loading ? <div className="ag-loading" aria-busy="true"><i/><i/><i/></div> : dayEntries.length === 0 ? <div className="ag-empty"><CalendarDays size={25}/><strong>Sem compromissos neste dia</strong><span>Escala, folgas, Livro do Dia e convites confirmados aparecem juntos aqui.</span></div> : <div className="ag-timeline">{dayEntries.map((item) => <article className={"ag-entry ag-" + item.source.toLowerCase()} key={item.id}><time>{item.source === "LEAVE" ? "Dia todo" : timeRange(item.startTime, item.endTime)}</time><span className="ag-entry-rail"/><div className="ag-entry-body"><div className="ag-entry-top"><span className="ag-source">{sourceLabels[item.source] ?? item.source}</span>{item.status && <span className="ag-status">{statuses[item.status] ?? item.status}</span>}</div><strong>{item.title}</strong><p>{[item.operationName, item.detail, item.location].filter(Boolean).join(" · ") || (item.source === "LEAVE" ? labelDate(item.date, { day: "2-digit", month: "short" }) : eventTypes[item.type ?? ""] ?? "")}</p>{item.reason && <p>{item.reason}{item.alternativeDetails ? " · Alternativa: " + item.alternativeDetails : ""}</p>}</div></article>)}</div>}
    </> : <div className="ag-proposals">{loading ? <div className="ag-loading"><i/><i/></div> : pending.length === 0 ? <div className="ag-empty"><CalendarDays size={25}/><strong>{manager ? "Nada aguardando revisão" : "Nenhum convite ou proposta pendente"}</strong><span>{manager ? "Rascunhos e propostas da sua área aparecem aqui." : "Convites e respostas da Supervisão ficam reunidos aqui."}</span></div> : pending.map((item) => <article className="ag-proposal" key={item.id}><div className="ag-proposal-main"><span className="ag-kicker">{eventTypes[item.type] ?? item.type} · {statuses[item.status]}</span><h3>{item.title}</h3><p><Clock3 size={15}/>{labelDate(item.date, { weekday: "long", day: "2-digit", month: "long" })} · {timeRange(item.startTime, item.endTime)}</p>{item.location && <p><MapPin size={15}/>{item.location}</p>}{item.status === "REJECTED" && <div className="ag-alternative"><strong>{item.reason}</strong><span>Alternativa: {item.alternativeDetails}{item.alternativeDate ? " · " + labelDate(item.alternativeDate) : ""}{item.alternativeStartTime ? " · " + timeRange(item.alternativeStartTime, item.alternativeEndTime) : ""}</span></div>}{item.participants?.length ? <div className="ag-participants">{item.participants.map((p) => <span key={p.id}>{p.name} · {p.response === "CALLED" ? "convocada" : p.response === "ACCEPTED" ? "aceitou" : p.response === "DECLINED" ? "recusou" : "aguardando"}</span>)}</div> : null}</div>
      <div className="ag-proposal-actions">{manager && item.status === "PROPOSED" ? <><button className="ag-secondary" disabled={saving} onClick={() => setDecision(item)}>Negar com alternativa</button><button className="ag-primary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/decision", { decision: "ACCEPT" }, "Proposta aceita e compromisso confirmado.")}>Aceitar</button></> : manager && item.status === "DRAFT" ? <button className="ag-primary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/confirm", {}, "Compromisso confirmado.")}>Confirmar</button> : !manager && item.status === "CONFIRMED" && item.myResponse === "PENDING" ? <><button className="ag-secondary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/respond", { response: "DECLINED" }, "Convite recusado.")}>Recusar convite</button><button className="ag-primary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/respond", { response: "ACCEPTED" }, "Convite aceito.")}>Aceitar convite</button></> : <span className="ag-status">{statuses[item.status]}</span>}</div></article>)}</div>}
    {formOpen && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-form-title"><header><h2 id="ag-form-title">{role === "mem" ? "Propor um horário" : "Marcar compromisso"}</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setFormOpen(false)}><X size={18}/></button></header><p>{role === "mem" ? "Sua reunião começa como proposta. A Supervisão responde com motivo e alternativa se não puder liberar." : "Ensaios convocam; reuniões convidam. Conflitos são avisos, não bloqueios."}</p><form onSubmit={saveEvent} className="ag-form">
      <label>Título<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: alinhamento do próximo show"/></label>
      <div className="ag-form-row"><label>Tipo<select value={form.type} disabled={role === "mem"} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="MEETING">Reunião</option>{role !== "mem" && <option value="REHEARSAL">Ensaio</option>}</select></label><label>Operação<select required value={form.operationId} onChange={(e) => setForm({ ...form, operationId: e.target.value })}><option value="">Escolher</option>{operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>
      {manager && <div className="ag-form-row"><label>Área<select required value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}><option value="">Escolher</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Local<select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">Sem local definido</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>}
      <label>Espaço ou link<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Sala, palco ou link online"/></label>
      <div className="ag-form-row"><label>Data<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label><label>Início<input required type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}/></label><label>Fim<input required type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}/></label></div>
      <label>Observações<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label>
      <fieldset><legend>{form.type === "REHEARSAL" ? "Convocados" : "Convidados"}</legend><div className="ag-person-list">{role === "mem" && user && <label><input type="checkbox" checked disabled/><span>{nameOf(user)} (você)</span></label>}{invitees.map((p) => <label key={p.id}><input type="checkbox" checked={form.participantIds.includes(p.id)} onChange={() => togglePerson(p.id)}/><span>{nameOf(p)}{p.areaName ? " · " + p.areaName : ""}</span></label>)}</div></fieldset>
      <button type="button" className="ag-secondary ag-check-conflicts" onClick={() => void checkConflicts()} disabled={!form.date || !form.startTime || !form.endTime}>Conferir jornada e conflitos</button>
      {conflicts.length > 0 && <div className="ag-conflicts" role="status"><strong>Há compromissos neste horário</strong><ul>{conflicts.map((v, i) => <li key={v + i}>{v}</li>)}</ul><span>O aviso não bloqueia; a pessoa responsável avalia o conflito.</span></div>}
      {conflicts.length === 0 && form.date && form.startTime && form.endTime && <span className="ag-hint">Conferência sem conflitos encontrados.</span>}
      <footer><button type="button" className="ag-secondary" onClick={() => setFormOpen(false)}>Voltar</button><button className="ag-primary" disabled={saving || !form.operationId || !form.areaId || !form.participantIds.length}>{saving ? "Salvando…" : role === "mem" ? "Enviar proposta" : "Salvar rascunho"}</button></footer>
    </form></section></div>}
    {decision && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDecision(null); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-decision-title"><header><h2 id="ag-decision-title">Negar proposta</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setDecision(null)}><X size={18}/></button></header><p>{decision.title} · {labelDate(decision.date)} · {timeRange(decision.startTime, decision.endTime)}</p><form className="ag-form" onSubmit={denyProposal}><label>Motivo<input required value={reply.reason} onChange={(e) => setReply({ ...reply, reason: e.target.value })}/></label><label>Alternativa<textarea required rows={2} value={reply.alternativeDetails} onChange={(e) => setReply({ ...reply, alternativeDetails: e.target.value })} placeholder="Sugira outro dia ou horário"/></label><div className="ag-form-row"><label>Data sugerida<input type="date" value={reply.alternativeDate} onChange={(e) => setReply({ ...reply, alternativeDate: e.target.value })}/></label><label>Início sugerido<input type="time" value={reply.alternativeStartTime} onChange={(e) => setReply({ ...reply, alternativeStartTime: e.target.value })}/></label><label>Fim sugerido<input type="time" value={reply.alternativeEndTime} onChange={(e) => setReply({ ...reply, alternativeEndTime: e.target.value })}/></label></div><footer><button type="button" className="ag-secondary" onClick={() => setDecision(null)}>Voltar</button><button className="ag-primary" disabled={saving || !reply.reason.trim() || !reply.alternativeDetails.trim()}>{saving ? "Salvando…" : "Registrar resposta"}</button></footer></form></section></div>}
  </section>;
}
