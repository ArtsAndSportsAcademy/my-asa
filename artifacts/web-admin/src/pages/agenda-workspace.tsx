import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, MapPin, Plus, RotateCw, Users, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useFecharComEsc } from "@/lib/fechar-com-esc";

type Role = "adm" | "dir" | "sup" | "mem";
type Person = { id: string; name?: string; displayName?: string; areaId?: string | null; areaName?: string | null; status?: string; operationIds?: string[] };
type Operation = { id: string; name: string; status?: string };
type Area = { id: string; name: string };
type Location = { id: string; name: string };
type Entry = { id: string; source: string; sourceId: string; title: string; date: string; endDate?: string | null; startTime?: string | null; endTime?: string | null; status?: string; type?: string; response?: string; detail?: string; operationName?: string; location?: string | null; reason?: string | null; alternativeDetails?: string | null };
type AgendaEvent = { id: string; title: string; type: string; date: string; startTime?: string | null; endTime?: string | null; status: string; operationId: string; myResponse?: string | null; participants?: { id: string; name: string; response: string; responseNote?: string | null }[]; reason?: string | null; alternativeDetails?: string | null; alternativeDate?: string | null; alternativeStartTime?: string | null; alternativeEndTime?: string | null; location?: string | null };
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
  const [tab, setTab] = useState<"journey" | "month" | "requests">("journey");
  const [monthCursor, setMonthCursor] = useState(() => today().slice(0, 7));
  const [formOpen, setFormOpen] = useState(false);
  const [decision, setDecision] = useState<AgendaEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  // A conferência vale só para a data, o horário e as pessoas em que foi feita; mexeu em qualquer um, ela perde a validade.
  const [checked, setChecked] = useState<{ key: string; failed: boolean } | null>(null);
  const [form, setForm] = useState({ title: "", type: "MEETING", operationId: "", areaId: currentUser?.areaId ?? "", locationId: "", location: "", date: today(), startTime: "", endTime: "", notes: "", participantIds: [] as string[] });
  const [reply, setReply] = useState({ reason: "", alternativeDetails: "", alternativeDate: "", alternativeStartTime: "", alternativeEndTime: "" });
  // Janelas novas: remarcar, cancelar (motivo opcional), recusar convite (motivo opcional) e confirmar vários rascunhos.
  const [remarcar, setRemarcar] = useState<AgendaEvent | null>(null), [remarcarForm, setRemarcarForm] = useState({ date: "", startTime: "", endTime: "", location: "", reason: "" });
  const [cancelar, setCancelar] = useState<AgendaEvent | null>(null), [recusar, setRecusar] = useState<AgendaEvent | null>(null), [motivo, setMotivo] = useState("");
  const [confirmarTodos, setConfirmarTodos] = useState(false), [dialogError, setDialogError] = useState("");
  // Ensaio que chama quem está de folga: a recusa do servidor lista quem, e o motivo escrito libera.
  const [folgaMotivo, setFolgaMotivo] = useState(""), [folgaNomes, setFolgaNomes] = useState<string[]>([]), [formError, setFormError] = useState("");
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const monthRange = useMemo(() => { const [year, month] = monthCursor.split("-").map(Number); const start = `${monthCursor}-01`; const last = new Date(year, month, 0).getDate(); return { start, end: `${monthCursor}-${String(last).padStart(2, "0")}` }; }, [monthCursor]);
  const monthDays = useMemo(() => Array.from({ length: Number(monthRange.end.slice(8, 10)) }, (_, i) => `${monthCursor}-${String(i + 1).padStart(2, "0")}`), [monthCursor, monthRange.end]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayEntries = useMemo(() => entries.filter((item) => item.date === day || Boolean(item.endDate && item.date <= day && item.endDate >= day)), [entries, day]);
  const pending = useMemo(() => manager ? events.filter((item) => item.status === "DRAFT" || item.status === "PROPOSED") : events.filter((item) => item.status === "PROPOSED" || item.status === "REJECTED" || item.myResponse === "PENDING"), [events, manager]);
  // Só aparece quem o servidor aceita: ativa e da operação escolhida (senão a recusa só vinha na hora de salvar).
  const invitees = useMemo(() => people.filter((person) => person.id !== user?.id && (!person.status || person.status === "ACTIVE") && (!form.operationId || !person.operationIds?.length || person.operationIds.includes(form.operationId))), [people, user?.id, form.operationId]);
  const checkKey = [form.date, form.startTime, form.endTime, [...form.participantIds].sort().join(",")].join("|");
  const checkValid = checked?.key === checkKey;
  const timeInvalid = Boolean(form.startTime && form.endTime && form.endTime <= form.startTime);
  const precisaMotivoFolga = form.type === "REHEARSAL" && (folgaNomes.length > 0 || (checkValid && conflicts.some((item) => item.includes("(dia todo)"))));
  const dayEvents = useMemo(() => manager ? events.filter((item) => item.date === day && !["CANCELLED", "REJECTED", "COMPLETED"].includes(item.status)) : [], [events, day, manager]);
  const rascunhos = useMemo(() => manager ? events.filter((item) => item.status === "DRAFT") : [], [events, manager]);
  const missing = precisaMotivoFolga && !folgaMotivo.trim() ? "Escreva o motivo para chamar quem está de folga." : !form.operationId ? "Escolha a operação." : !form.areaId ? "Escolha a área." : !form.participantIds.length ? (form.type === "REHEARSAL" ? "Marque ao menos uma pessoa para convocar." : "Marque ao menos uma pessoa para convidar.") : role === "sup" && !form.locationId ? "Escolha o local onde você supervisiona esta área." : "";
  useFecharComEsc(() => setFormOpen(false), formOpen);
  useFecharComEsc(() => setDecision(null), Boolean(decision));
  useFecharComEsc(() => setRemarcar(null), Boolean(remarcar));
  useFecharComEsc(() => setCancelar(null), Boolean(cancelar));
  useFecharComEsc(() => setRecusar(null), Boolean(recusar));
  useFecharComEsc(() => setConfirmarTodos(false), confirmarTodos);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const suffix = personId ? "&personId=" + encodeURIComponent(personId) : "";
      const [eventData, journeyData] = await Promise.all([
        customFetch<{ events: AgendaEvent[] }>("/api/agenda/events?from=" + (tab === "month" ? monthRange.start : weekStart) + "&to=" + (tab === "month" ? monthRange.end : weekEnd)),
        customFetch<{ events: Entry[] }>("/api/agenda/journey?from=" + (tab === "month" ? monthRange.start : weekStart) + "&to=" + (tab === "month" ? monthRange.end : weekEnd) + suffix),
      ]);
      setEvents(eventData.events ?? []); setEntries(journeyData.events ?? []);
    } catch { setError("Não consegui carregar a Agenda agora. Confira a conexão e tente de novo."); }
    finally { setLoading(false); }
  }, [monthRange.end, monthRange.start, personId, tab, weekEnd, weekStart]);
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

  const moveWeek = (n: number) => { const next = addDays(weekStart, 7 * n); setWeekStart(next); setDay(next); setMonthCursor(next.slice(0, 7)); };
  const moveMonth = (n: number) => {
    const [year, month] = monthCursor.split("-").map(Number);
    const next = keyDate(new Date(year, month - 1 + n, 1, 12)).slice(0, 7);
    setMonthCursor(next);
    // Ao voltar para a semana, ela abre no mês que a pessoa estava olhando (e no mês de hoje, abre hoje).
    const first = next === today().slice(0, 7) ? today() : next + "-01";
    setDay(first); setWeekStart(monday(first));
  };
  const openDay = (date: string) => { setDay(date); setWeekStart(monday(date)); setTab("journey"); };
  const goToday = () => { setWeekStart(monday(today())); setDay(today()); setMonthCursor(today().slice(0, 7)); };
  // Quem olha a jornada de outra pessoa não está vendo "a minha semana".
  const ownJourney = !personId || personId === user?.id;
  const monthTitle = labelDate(monthCursor + "-01", { month: "long", year: "numeric" });
  const openForm = () => {
    setForm({ title: "", type: "MEETING", operationId: operations[0]?.id ?? "", areaId: currentUser?.areaId ?? areas[0]?.id ?? "", locationId: "", location: "", date: day, startTime: "", endTime: "", notes: "", participantIds: role === "mem" && user?.id ? [user.id] : [] });
    setConflicts([]); setChecked(null); setFolgaMotivo(""); setFolgaNomes([]); setFormError(""); setFormOpen(true);
  };
  // A frase que o servidor mandou (a Agenda responde em `error`), ou o texto da tela quando foi rede ou servidor fora do ar.
  const frase = (cause: unknown, padrao: string) => { const data = (cause as { data?: { message?: string; error?: string } } | null)?.data; return data?.message || data?.error || padrao; };
  const pessoasAvisadas = (item: AgendaEvent) => item.status === "CONFIRMED" ? (item.participants?.length ?? 0) : 0;
  const fecharComAviso = (item: AgendaEvent) => { const n = pessoasAvisadas(item); return n ? `${n} ${n === 1 ? "pessoa foi avisada" : "pessoas foram avisadas"}.` : "Ninguém precisou ser avisado, porque o compromisso ainda não tinha sido confirmado."; };
  const abrirRemarcar = (item: AgendaEvent) => { setDialogError(""); setRemarcarForm({ date: item.date, startTime: (item.startTime ?? "").slice(0, 5), endTime: (item.endTime ?? "").slice(0, 5), location: item.location ?? "", reason: "" }); setRemarcar(item); };
  const abrirCancelar = (item: AgendaEvent) => { setDialogError(""); setMotivo(""); setCancelar(item); };
  const enviarRemarcar = async (e: FormEvent) => {
    e.preventDefault(); if (!remarcar || saving) return;
    if (remarcarForm.endTime <= remarcarForm.startTime) { setDialogError("O fim precisa ser depois do início."); return; }
    setSaving(true); setDialogError("");
    try {
      await customFetch("/api/agenda/events/" + remarcar.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: remarcarForm.date, startTime: remarcarForm.startTime, endTime: remarcarForm.endTime, location: remarcarForm.location.trim() || null, reason: remarcarForm.reason.trim() || undefined }) });
      setNotice("Compromisso remarcado. " + fecharComAviso(remarcar).replace("Ninguém precisou ser avisado, porque o compromisso ainda não tinha sido confirmado.", "Ninguém foi avisado ainda: as pessoas recebem o aviso quando você confirmar.")); setRemarcar(null); await reload();
    } catch (cause) { setDialogError(frase(cause, "Não consegui remarcar agora. Nada foi alterado; tente de novo.")); }
    finally { setSaving(false); }
  };
  const enviarCancelar = async (e: FormEvent) => {
    e.preventDefault(); if (!cancelar || saving) return;
    setSaving(true); setDialogError("");
    try {
      await customFetch("/api/agenda/events/" + cancelar.id + "/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: motivo.trim() || undefined }) });
      setNotice("Compromisso cancelado. " + fecharComAviso(cancelar)); setCancelar(null); await reload();
    } catch (cause) { setDialogError(frase(cause, "Não consegui cancelar agora. Nada foi alterado; tente de novo.")); }
    finally { setSaving(false); }
  };
  const enviarRecusa = async (e: FormEvent) => {
    e.preventDefault(); if (!recusar || saving) return;
    setSaving(true); setDialogError("");
    try {
      await customFetch("/api/agenda/events/" + recusar.id + "/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: "DECLINED", responseNote: motivo.trim() || undefined }) });
      setNotice("Convite recusado."); setRecusar(null); await reload();
    } catch (cause) { setDialogError(frase(cause, "Não consegui recusar agora. Tente de novo.")); }
    finally { setSaving(false); }
  };
  const enviarConfirmarTodos = async () => {
    if (saving) return;
    setSaving(true); setDialogError("");
    let feitos = 0; const falhas: string[] = [];
    for (const item of rascunhos) {
      try { await customFetch("/api/agenda/events/" + item.id + "/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); feitos += 1; }
      catch (cause) { falhas.push(item.title + ": " + frase(cause, "não consegui confirmar")); }
    }
    setSaving(false); setConfirmarTodos(false);
    setNotice(`${feitos} ${feitos === 1 ? "compromisso confirmado" : "compromissos confirmados"}, e as pessoas foram avisadas.${falhas.length ? " Não confirmei: " + falhas.join("; ") + "." : ""}`);
    await reload();
  };
  const togglePerson = (id: string) => setForm((current) => ({ ...current, participantIds: current.participantIds.includes(id) ? current.participantIds.filter((v) => v !== id) : [...current.participantIds, id] }));
  const checkConflicts = async () => {
    setConflicts([]); setChecked(null);
    if (!form.date || !form.startTime || !form.endTime || form.endTime <= form.startTime) return;
    const key = checkKey;
    let failed = false;
    const inspectablePeople = [...new Set(form.participantIds)].filter((id) => manager || id === user?.id);
    const rows = await Promise.all(inspectablePeople.map(async (id) => {
      try {
        const data = await customFetch<{ events: Entry[] }>("/api/agenda/journey?from=" + form.date + "&to=" + form.date + "&personId=" + encodeURIComponent(id));
        return (data.events ?? []).filter((item) => item.source === "LEAVE" || overlaps(form.startTime, form.endTime, item.startTime, item.endTime))
          .map((item) => nameOf(people.find((p) => p.id === id) ?? (user?.id === id ? user : undefined)) + ": " + item.title + " (" + (item.source === "LEAVE" ? "dia todo" : timeRange(item.startTime, item.endTime)) + ")");
      } catch { failed = true; return []; }
    }));
    setConflicts(rows.flat()); setChecked({ key, failed });
  };
  const saveEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.operationId || !form.date || !form.startTime || !form.endTime) return;
    if (timeInvalid) { setNotice("O fim precisa ser depois do início."); return; }
    setSaving(true); setFormError("");
    try {
      await customFetch("/api/agenda/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, title: form.title.trim(), participantIds: [...new Set(form.participantIds)], visibility: "OPERATION", reason: folgaMotivo.trim() || undefined }) });
      setFormOpen(false); setNotice(role === "mem" ? "Proposta enviada. Ela fica em Convites e propostas até a Supervisão responder." : "Rascunho salvo. Ninguém é avisado ainda: as pessoas só recebem o aviso quando você confirmar, na aba Propostas."); await reload();
    } catch (cause) {
      const dados = (cause as { data?: { code?: string; emFolga?: string[] } } | null)?.data;
      if (dados?.code === "FOLGA_EXIGE_MOTIVO") setFolgaNomes(dados.emFolga ?? []);
      setFormError(frase(cause, "Não consegui salvar o compromisso agora. Confira a conexão; o que você escreveu continua aqui."));
    }
    finally { setSaving(false); }
  };
  const act = async (path: string, body: unknown, success: string) => {
    setSaving(true);
    try { await customFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setNotice(success); await reload(); }
    catch (cause) { setNotice(frase(cause, "Não consegui atualizar a Agenda agora. Tente de novo.")); }
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
    {tab === "month"
      ? <div className="ag-week-nav"><button className="ag-icon-button" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18}/></button><strong className="ag-month-title">{monthTitle}</strong><button className="ag-icon-button" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight size={18}/></button><button className="ag-today" onClick={goToday}>Hoje</button></div>
      : <div className="ag-week-nav"><button className="ag-icon-button" onClick={() => moveWeek(-1)} aria-label="Semana anterior"><ChevronLeft size={18}/></button><strong>{labelDate(weekStart, { day: "2-digit", month: "long" })} – {labelDate(weekEnd, { day: "2-digit", month: "long", year: "numeric" })}</strong><button className="ag-icon-button" onClick={() => moveWeek(1)} aria-label="Próxima semana"><ChevronRight size={18}/></button><button className="ag-today" onClick={goToday}>Hoje</button></div>}
    {tab !== "month" && <div className="ag-day-strip" role="tablist" aria-label="Dias da semana">{days.map((d) => <button key={d} role="tab" aria-selected={day === d} className={day === d ? "selected" : ""} onClick={() => setDay(d)}><span>{labelDate(d, { weekday: "short" })}</span><strong>{labelDate(d, { day: "2-digit" })}</strong><i>{entries.some((item) => item.date === d || Boolean(item.endDate && item.date <= d && item.endDate >= d)) ? "•" : ""}</i></button>)}</div>}
    <div className="ag-tabs" role="tablist"><button role="tab" aria-selected={tab === "journey"} onClick={() => setTab("journey")}>{ownJourney ? "Minha semana" : "Semana"}{tab === "journey" && <span>{entries.length}</span>}</button><button role="tab" aria-selected={tab === "month"} onClick={() => setTab("month")}>{ownJourney ? "Meu mês" : "Mês"}</button><button role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>{manager ? "Propostas" : "Convites e propostas"}<span>{pending.length}</span></button></div>
    {notice && <div className="ag-notice" role="status">{notice}<button aria-label="Dispensar aviso" onClick={() => setNotice("")}><X size={16}/></button></div>}
    {error && <div className="ag-error" role="alert"><CircleAlert size={18}/><span>{error}</span><button onClick={() => void reload()}>Tentar de novo</button></div>}
    {tab === "month" ? <section className="ag-month-grid" aria-label="Agenda do mês">{monthDays.map((date, index) => { const items = entries.filter((item) => item.date === date || Boolean(item.endDate && item.date <= date && item.endDate >= date)); return <article key={date} className={items.length ? "has-items" : ""} style={index === 0 ? { ["--ag-offset" as string]: (parseDate(date).getDay() + 6) % 7 + 1 } : undefined}><header><strong>{labelDate(date, { day: "2-digit" })}</strong><span>{labelDate(date, { weekday: "short" })}</span></header>{items.length ? <>{items.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => openDay(date)}><b>{item.title}</b><small>{item.source === "LEAVE" ? "Dia todo" : timeRange(item.startTime, item.endTime)}</small></button>)}{items.length > 4 && <button type="button" onClick={() => openDay(date)}><b>+{items.length - 4} {items.length - 4 === 1 ? "compromisso" : "compromissos"}</b></button>}</> : <span className="ag-month-empty">—</span>}</article>; })}</section> : tab === "journey" ? <>
      <div className="ag-day-heading"><div><span>{labelDate(day, { weekday: "long", day: "numeric", month: "long" })}</span><h2>{personId ? nameOf(people.find((p) => p.id === personId) ?? user ?? undefined) : "Minha jornada"}</h2></div><span className="ag-count">{dayEntries.length} {dayEntries.length === 1 ? "compromisso" : "compromissos"}</span></div>
      {loading ? <div className="ag-loading" aria-busy="true"><i/><i/><i/></div> : dayEntries.length === 0 ? <div className="ag-empty"><CalendarDays size={25}/><strong>Sem compromissos neste dia</strong><span>Escala, folgas, Livro do Dia e convites confirmados aparecem juntos aqui.</span></div> : <div className="ag-timeline">{dayEntries.map((item) => <article className={"ag-entry ag-" + item.source.toLowerCase()} key={item.id}><time>{item.source === "LEAVE" ? "Dia todo" : timeRange(item.startTime, item.endTime)}</time><span className="ag-entry-rail"/><div className="ag-entry-body"><div className="ag-entry-top"><span className="ag-source">{sourceLabels[item.source] ?? item.source}</span>{item.status && <span className="ag-status">{statuses[item.status] ?? item.status}</span>}</div><strong>{item.title}</strong><p>{[item.operationName, item.detail, item.location].filter(Boolean).join(" · ") || (item.source === "LEAVE" ? labelDate(item.date, { day: "2-digit", month: "short" }) : eventTypes[item.type ?? ""] ?? "")}</p>{item.reason && <p>{item.reason}{item.alternativeDetails ? " · Alternativa: " + item.alternativeDetails : ""}</p>}</div></article>)}</div>}
      {!loading && dayEvents.length > 0 && <section className="ag-day-events" aria-label="Compromissos marcados neste dia"><h3>Marcados neste dia</h3>{dayEvents.map((item) => <article className="ag-day-event" key={item.id}><div><strong>{item.title}</strong><span>{eventTypes[item.type] ?? item.type} · {timeRange(item.startTime, item.endTime)} · {statuses[item.status] ?? item.status}{item.participants?.length ? ` · ${item.participants.length} ${item.participants.length === 1 ? "pessoa" : "pessoas"}` : ""}</span></div><div className="ag-day-event-actions"><button type="button" className="ag-secondary" disabled={saving} onClick={() => abrirRemarcar(item)}>Remarcar</button><button type="button" className="ag-secondary ag-danger" disabled={saving} onClick={() => abrirCancelar(item)}>Cancelar</button></div></article>)}</section>}
    </> : <div className="ag-proposals">{manager && rascunhos.length > 1 && <div className="ag-bulk"><span>{rascunhos.length} rascunhos esperando confirmação.</span><button type="button" className="ag-primary" disabled={saving} onClick={() => { setDialogError(""); setConfirmarTodos(true); }}>Confirmar todos</button></div>}{loading ? <div className="ag-loading"><i/><i/></div> : pending.length === 0 ? <div className="ag-empty"><CalendarDays size={25}/><strong>{manager ? "Nada aguardando revisão" : "Nenhum convite ou proposta pendente"}</strong><span>{manager ? "Rascunhos e propostas da sua área aparecem aqui." : "Convites e respostas da Supervisão ficam reunidos aqui."}</span></div> : pending.map((item) => <article className="ag-proposal" key={item.id}><div className="ag-proposal-main"><span className="ag-kicker">{eventTypes[item.type] ?? item.type} · {statuses[item.status]}</span><h3>{item.title}</h3><p><Clock3 size={15}/>{labelDate(item.date, { weekday: "long", day: "2-digit", month: "long" })} · {timeRange(item.startTime, item.endTime)}</p>{item.location && <p><MapPin size={15}/>{item.location}</p>}{item.status === "REJECTED" && <div className="ag-alternative"><strong>{item.reason}</strong><span>Alternativa: {item.alternativeDetails}{item.alternativeDate ? " · " + labelDate(item.alternativeDate) : ""}{item.alternativeStartTime ? " · " + timeRange(item.alternativeStartTime, item.alternativeEndTime) : ""}</span></div>}{item.participants?.length ? <div className="ag-participants">{item.participants.map((p) => <span key={p.id}>{p.name} · {p.response === "CALLED" ? "convocada" : p.response === "ACCEPTED" ? "aceitou" : p.response === "DECLINED" ? "recusou" : "aguardando"}{p.responseNote ? ` (“${p.responseNote}”)` : ""}</span>)}</div> : null}</div>
      <div className="ag-proposal-actions">{manager && item.status === "PROPOSED" ? <><button className="ag-secondary" disabled={saving} onClick={() => setDecision(item)}>Negar com alternativa</button><button className="ag-primary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/decision", { decision: "ACCEPT" }, "Proposta aceita e compromisso confirmado.")}>Aceitar</button></> : manager && item.status === "DRAFT" ? <><button className="ag-secondary ag-danger" disabled={saving} onClick={() => abrirCancelar(item)}>Cancelar</button><button className="ag-secondary" disabled={saving} onClick={() => abrirRemarcar(item)}>Remarcar</button><button className="ag-primary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/confirm", {}, "Compromisso confirmado. As pessoas foram avisadas.")}>Confirmar</button></> : !manager && item.status === "CONFIRMED" && item.myResponse === "PENDING" ? <><button className="ag-secondary" disabled={saving} onClick={() => { setDialogError(""); setMotivo(""); setRecusar(item); }}>Recusar convite</button><button className="ag-primary" disabled={saving} onClick={() => void act("/api/agenda/events/" + item.id + "/respond", { response: "ACCEPTED" }, "Convite aceito.")}>Aceitar convite</button></> : <span className="ag-status">{statuses[item.status]}</span>}</div></article>)}</div>}
    {formOpen && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-form-title"><header><h2 id="ag-form-title">{role === "mem" ? "Propor um horário" : "Marcar compromisso"}</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setFormOpen(false)}><X size={18}/></button></header><p>{role === "mem" ? "Sua reunião começa como proposta. A Supervisão responde com motivo e alternativa se não puder liberar." : "Ensaios convocam; reuniões convidam. Conflitos são avisos, não bloqueios."}</p><form onSubmit={saveEvent} className="ag-form">
      <label>Título<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: alinhamento do próximo show"/></label>
      <div className="ag-form-row"><label>Tipo<select value={form.type} disabled={role === "mem"} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="MEETING">Reunião</option>{role !== "mem" && <option value="REHEARSAL">Ensaio</option>}</select></label><label>Operação<select required value={form.operationId} onChange={(e) => { const operationId = e.target.value; setForm((current) => ({ ...current, operationId, participantIds: current.participantIds.filter((id) => id === user?.id || !people.find((p) => p.id === id)?.operationIds?.length || people.find((p) => p.id === id)?.operationIds?.includes(operationId)) })); }}><option value="">Escolher</option>{operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>
      {manager && <div className="ag-form-row"><label>Área<select required value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}><option value="">Escolher</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Local<select required={role === "sup"} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">{role === "sup" ? "Escolher o local" : "Sem local definido"}</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>}
      <label>Espaço ou link<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Sala, palco ou link online"/></label>
      <div className="ag-form-row"><label>Data<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label><label>Início<input required type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}/></label><label>Fim<input required type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}/></label></div>
      <label>Observações<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label>
      <fieldset><legend>{form.type === "REHEARSAL" ? "Convocados" : "Convidados"}{form.participantIds.length ? ` · ${form.participantIds.length}` : ""}</legend>{invitees.length > 1 && <div className="ag-person-tools"><button type="button" onClick={() => setForm((current) => ({ ...current, participantIds: [...new Set([...current.participantIds, ...invitees.map((p) => p.id)])] }))}>Marcar todas</button><button type="button" onClick={() => setForm((current) => ({ ...current, participantIds: role === "mem" && user ? [user.id] : [] }))}>Limpar</button></div>}{invitees.length === 0 && role !== "mem" && <p className="ag-hint ag-hint-aviso">Nenhuma pessoa ativa encontrada nesta operação.</p>}<div className="ag-person-list">{role === "mem" && user && <label><input type="checkbox" checked disabled/><span>{nameOf(user)} (você)</span></label>}{invitees.map((p) => <label key={p.id}><input type="checkbox" checked={form.participantIds.includes(p.id)} onChange={() => togglePerson(p.id)}/><span>{nameOf(p)}{p.areaName ? " · " + p.areaName : ""}</span></label>)}</div></fieldset>
      <button type="button" className="ag-secondary ag-check-conflicts" onClick={() => void checkConflicts()} disabled={!form.date || !form.startTime || !form.endTime}>Conferir jornada e conflitos</button>
      {timeInvalid && <span className="ag-hint ag-hint-erro" role="alert">O fim precisa ser depois do início.</span>}
      {checkValid && conflicts.length > 0 && <div className="ag-conflicts" role="status"><strong>Há compromissos neste horário</strong><ul>{conflicts.map((v, i) => <li key={v + i}>{v}</li>)}</ul><span>{form.type === "REHEARSAL" ? "Quem está de folga só pode ser chamada com o motivo escrito. Os outros avisos não bloqueiam." : "O aviso não bloqueia; a pessoa responsável avalia o conflito."}</span></div>}
      {checkValid && checked?.failed &&<span className="ag-hint ag-hint-erro" role="alert">Não consegui conferir a jornada de todas as pessoas agora. Tente de novo antes de salvar.</span>}
      {checkValid && !checked?.failed && conflicts.length === 0 &&<span className="ag-hint">Conferência feita: ninguém tem compromisso, escala ou folga neste horário.</span>}
      {precisaMotivoFolga && <label className="ag-folga-motivo">Motivo para chamar quem está de folga<textarea required rows={2} value={folgaMotivo} onChange={(e) => setFolgaMotivo(e.target.value)} placeholder={"Ex.: ensaio extra antes da estreia" + (folgaNomes.length ? ". De folga: " + folgaNomes.join(", ") : "")}/><small>Fica no Registro, e quem foi chamada na folga é avisada de que foi de propósito.</small></label>}
      {formError && <span className="ag-hint ag-hint-erro" role="alert">{formError}</span>}
      {missing && <span className="ag-hint ag-hint-aviso">{missing}</span>}
      <footer><button type="button" className="ag-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="ag-primary" disabled={saving || Boolean(missing) || timeInvalid}>{saving ? "Salvando…" : role === "mem" ? "Enviar proposta" : "Salvar rascunho"}</button></footer>
    </form></section></div>}
    {decision && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDecision(null); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-decision-title"><header><h2 id="ag-decision-title">Negar proposta</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setDecision(null)}><X size={18}/></button></header><p>{decision.title} · {labelDate(decision.date)} · {timeRange(decision.startTime, decision.endTime)}</p><form className="ag-form" onSubmit={denyProposal}><label>Motivo<input required value={reply.reason} onChange={(e) => setReply({ ...reply, reason: e.target.value })}/></label><label>Alternativa<textarea required rows={2} value={reply.alternativeDetails} onChange={(e) => setReply({ ...reply, alternativeDetails: e.target.value })} placeholder="Sugira outro dia ou horário"/></label><div className="ag-form-row"><label>Data sugerida<input type="date" value={reply.alternativeDate} onChange={(e) => setReply({ ...reply, alternativeDate: e.target.value })}/></label><label>Início sugerido<input type="time" value={reply.alternativeStartTime} onChange={(e) => setReply({ ...reply, alternativeStartTime: e.target.value })}/></label><label>Fim sugerido<input type="time" value={reply.alternativeEndTime} onChange={(e) => setReply({ ...reply, alternativeEndTime: e.target.value })}/></label></div><footer><button type="button" className="ag-secondary" onClick={() => setDecision(null)}>Cancelar</button><button className="ag-primary" disabled={saving || !reply.reason.trim() || !reply.alternativeDetails.trim()}>{saving ? "Salvando…" : "Registrar resposta"}</button></footer></form></section></div>}
    {remarcar && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setRemarcar(null); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-remarcar-title"><header><h2 id="ag-remarcar-title">Remarcar compromisso</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setRemarcar(null)}><X size={18}/></button></header><p>{remarcar.title} · {remarcar.status === "CONFIRMED" ? "quem já foi avisado recebe um aviso com o novo horário." : "ainda não foi confirmado, então ninguém é avisado agora."}</p><form className="ag-form" onSubmit={enviarRemarcar}><div className="ag-form-row"><label>Data<input required type="date" value={remarcarForm.date} onChange={(e) => setRemarcarForm({ ...remarcarForm, date: e.target.value })}/></label><label>Início<input required type="time" value={remarcarForm.startTime} onChange={(e) => setRemarcarForm({ ...remarcarForm, startTime: e.target.value })}/></label><label>Fim<input required type="time" value={remarcarForm.endTime} onChange={(e) => setRemarcarForm({ ...remarcarForm, endTime: e.target.value })}/></label></div><label>Espaço ou link<input value={remarcarForm.location} onChange={(e) => setRemarcarForm({ ...remarcarForm, location: e.target.value })}/></label><label>Motivo (opcional)<textarea rows={2} value={remarcarForm.reason} onChange={(e) => setRemarcarForm({ ...remarcarForm, reason: e.target.value })} placeholder="Ex.: a sala estava ocupada"/></label>{dialogError && <span className="ag-hint ag-hint-erro" role="alert">{dialogError}</span>}<footer><button type="button" className="ag-secondary" onClick={() => setRemarcar(null)}>Cancelar</button><button className="ag-primary" disabled={saving}>{saving ? "Salvando…" : "Remarcar"}</button></footer></form></section></div>}
    {cancelar && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setCancelar(null); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-cancelar-title"><header><h2 id="ag-cancelar-title">Cancelar compromisso</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setCancelar(null)}><X size={18}/></button></header><p>{cancelar.title} · {labelDate(cancelar.date)} · {timeRange(cancelar.startTime, cancelar.endTime)}. {cancelar.status === "CONFIRMED" ? `${pessoasAvisadas(cancelar) ? `Quem já foi avisado (${pessoasAvisadas(cancelar)} ${pessoasAvisadas(cancelar) === 1 ? "pessoa" : "pessoas"})` : "Quem já foi avisado"} recebe o aviso de cancelamento. Não dá para desfazer; para voltar, é preciso marcar de novo.` : "Ele ainda não foi confirmado, então ninguém é avisado."}</p><form className="ag-form" onSubmit={enviarCancelar}><label>Motivo (opcional)<textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Quem foi avisado lê este motivo"/></label>{dialogError && <span className="ag-hint ag-hint-erro" role="alert">{dialogError}</span>}<footer><button type="button" className="ag-secondary" onClick={() => setCancelar(null)}>Voltar</button><button className="ag-primary ag-danger-solid" disabled={saving}>{saving ? "Cancelando…" : "Cancelar compromisso"}</button></footer></form></section></div>}
    {recusar && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setRecusar(null); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-recusar-title"><header><h2 id="ag-recusar-title">Recusar convite</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setRecusar(null)}><X size={18}/></button></header><p>{recusar.title} · {labelDate(recusar.date)} · {timeRange(recusar.startTime, recusar.endTime)}</p><form className="ag-form" onSubmit={enviarRecusa}><label>Motivo (opcional)<textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ajuda quem marcou a reunião a entender"/></label>{dialogError && <span className="ag-hint ag-hint-erro" role="alert">{dialogError}</span>}<footer><button type="button" className="ag-secondary" onClick={() => setRecusar(null)}>Voltar</button><button className="ag-primary" disabled={saving}>{saving ? "Enviando…" : "Recusar convite"}</button></footer></form></section></div>}
    {confirmarTodos && <div className="ag-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setConfirmarTodos(false); }}><section className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-todos-title"><header><h2 id="ag-todos-title">Confirmar {rascunhos.length} rascunhos</h2><button className="ag-icon-button" aria-label="Fechar" onClick={() => setConfirmarTodos(false)}><X size={18}/></button></header><p>As pessoas convocadas e convidadas recebem o aviso de cada compromisso. Confira a lista antes de confirmar.</p><ul className="ag-lista-rascunhos">{rascunhos.map((item) => <li key={item.id}><strong>{item.title}</strong> · {labelDate(item.date)} · {timeRange(item.startTime, item.endTime)}</li>)}</ul><footer className="ag-form-footer"><button type="button" className="ag-secondary" disabled={saving} onClick={() => setConfirmarTodos(false)}>Cancelar</button><button type="button" className="ag-primary" disabled={saving} onClick={() => void enviarConfirmarTodos()}>{saving ? "Confirmando…" : `Confirmar ${rascunhos.length}`}</button></footer></section></div>}
  </section>;
}
