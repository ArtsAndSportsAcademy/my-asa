import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Check, CirclePlus, ClipboardList, RotateCw, Trash2, X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";

type ShellRole = "adm" | "dir" | "sup" | "mem";
type Area = { id: string; name: string };
type Person = { id: string; name?: string; displayName?: string; areaId?: string | null; areaName?: string | null };
type Operation = { id: string; name: string };
type Responsibility = { id: string; title: string; description?: string | null; areaId: string | null; areaName?: string | null; ownerId?: string | null; ownerName?: string | null; operationId?: string | null; active: boolean; assignments: { id: string; memberId: string; memberName: string; role: string; active: boolean }[] };
type Task = { id: string; title: string; description?: string | null; responsibilityId?: string | null; responsibilityTitle?: string | null; areaId?: string | null; assigneeId: string; assigneeName: string; dueDate: string; status: string; origin: string; operationId: string; operationName?: string };
type Draft = { key: number; title: string; assigneeId: string; dueDate: string };

const displayName = (person?: Person) => person?.displayName ?? person?.name ?? "Pessoa";
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const statusLabel: Record<string, string> = { CREATED: "A fazer", IN_PROGRESS: "Em andamento", READY_FOR_APPROVAL: "Aguardando", CHANGES_REQUESTED: "Ajustes", APPROVED: "Concluída", COMPLETED: "Concluída", CANCELLED: "Cancelada", EXPIRED: "Expirada" };

export default function ResponsibilitiesTasksPage({ role }: { role: ShellRole }) {
  const canDefine = role === "adm" || role === "dir";
  const canDistribute = canDefine || role === "sup";
  const [tab, setTab] = useState<"tasks" | "responsibilities">("tasks");
  const [filter, setFilter] = useState("today");
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [responsibilityDialog, setResponsibilityDialog] = useState(false);
  const [assignmentResponsibility, setAssignmentResponsibility] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({ memberId: "", role: "SECONDARY" });
  const [lotDialog, setLotDialog] = useState(false);
  const [responsibilityForm, setResponsibilityForm] = useState({ title: "", areaId: "", description: "" });
  const [selectedResponsibility, setSelectedResponsibility] = useState("");
  const [selectedOperation, setSelectedOperation] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([{ key: 0, title: "", assigneeId: "", dueDate: today() }]);
  const [nextKey, setNextKey] = useState(1);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [responsibilityData, operationData, userData, areaData] = await Promise.all([
        customFetch<{ responsibilities: Responsibility[] }>("/api/responsibilities"),
        customFetch<{ operations?: Operation[] }>("/api/operations").catch(() => ({ operations: [] })),
        customFetch<{ users?: Person[] }>("/api/users").catch(() => ({ users: [] })),
        customFetch<{ areas?: Area[] }>("/api/areas").catch(() => ({ areas: [] })),
      ]);
      const nextOperations = operationData.operations ?? [];
      let taskData: { tasks: Task[] };
      if (role === "mem") taskData = await customFetch<{ tasks: Task[] }>("/api/tasks/my");
      else if (role === "sup") {
        // Tarefas da equipe exigem a responsabilidade "Aprovação de tarefas" (regra do servidor: 403 sem ela).
        // Sem ela, a Supervisão ainda vê as próprias tarefas — a tela não vira erro.
        let withoutTeamAccess = 0;
        const team = await Promise.all(nextOperations.map((operation) => customFetch<{ tasks: Task[] }>(`/api/tasks?operationId=${encodeURIComponent(operation.id)}`).catch((cause) => {
          if (cause instanceof ApiError && cause.status === 403) { withoutTeamAccess += 1; return { tasks: [] as Task[] }; }
          throw cause;
        })));
        const own = await customFetch<{ tasks: Task[] }>("/api/tasks/my");
        const byId = new Map<string, Task>();
        for (const task of [...team.flatMap((response) => response.tasks ?? []), ...(own.tasks ?? [])]) byId.set(task.id, task);
        taskData = { tasks: [...byId.values()] };
        if (withoutTeamAccess && withoutTeamAccess === nextOperations.length) setNotice("Você vê só as suas tarefas. Para acompanhar as tarefas da equipe, a Administração precisa te dar a responsabilidade “Aprovação de tarefas”.");
      } else taskData = await customFetch<{ tasks: Task[] }>("/api/tasks");
      setResponsibilities(responsibilityData.responsibilities ?? []);
      setTasks(taskData.tasks ?? []);
      setOperations(nextOperations);
      setPeople(userData.users ?? []);
      setAreas(areaData.areas ?? []);
      setSelectedOperation((current) => nextOperations.some((operation) => operation.id === current) ? current : nextOperations[0]?.id ?? "");
    } catch {
      setError("Não consegui carregar responsabilidades e tarefas.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { void reload(); }, [reload]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const closed = ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status);
    if (filter === "today") return !closed && task.dueDate <= today();
    if (filter === "open") return !closed;
    if (filter === "late") return !closed && task.dueDate < today();
    if (filter === "done") return ["APPROVED", "COMPLETED"].includes(task.status);
    return true;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [filter, tasks]);

  const scopedPeople = useMemo(() => {
    const selected = responsibilities.find((item) => item.id === selectedResponsibility);
    return role === "sup" && selected?.areaId ? people.filter((person) => person.areaId === selected.areaId) : people;
  }, [people, responsibilities, role, selectedResponsibility]);

  const saveResponsibility = async (event: FormEvent) => {
    event.preventDefault();
    if (!responsibilityForm.title.trim() || !responsibilityForm.areaId) return;
    setSaving(true);
    try {
      await customFetch("/api/responsibilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...responsibilityForm, title: responsibilityForm.title.trim() }) });
      setResponsibilityDialog(false);
      setResponsibilityForm({ title: "", areaId: "", description: "" });
      setNotice("Responsabilidade criada.");
      await reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Não consegui criar a responsabilidade.");
    } finally { setSaving(false); }
  };

  const confirmLot = async (event: FormEvent) => {
    event.preventDefault();
    const validDrafts = drafts.filter((draft) => draft.title.trim() && draft.assigneeId && draft.dueDate);
    if (!selectedOperation || !validDrafts.length) return;
    setSaving(true);
    try {
      const result = await customFetch<{ tasks: Task[] }>("/api/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: selectedOperation,
          responsibilityId: selectedResponsibility || undefined,
          tasks: validDrafts.map(({ title, assigneeId, dueDate }) => ({ title: title.trim(), assigneeId, dueDate })),
        }),
      });
      setTasks((current) => [...(result.tasks ?? []), ...current]);
      setLotDialog(false);
      setDrafts([{ key: 0, title: "", assigneeId: "", dueDate: today() }]);
      setNotice(`${result.tasks?.length ?? validDrafts.length} tarefa(s) confirmada(s) no lote.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Não consegui confirmar o lote.");
    } finally { setSaving(false); }
  };

  const finishTask = async (task: Task) => {
    setSaving(true);
    setNotice("");
    try {
      if (task.status === "CREATED" || task.status === "CHANGES_REQUESTED") {
        await customFetch(`/api/tasks/${task.id}/start`, { method: "POST", body: JSON.stringify({}) });
      }
      await customFetch(`/api/tasks/${task.id}/ready-for-approval`, { method: "POST", body: JSON.stringify({}) });
      setNotice("Tarefa marcada como concluída.");
      await reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Não consegui concluir a tarefa.");
    } finally { setSaving(false); }
  };

  const addDraft = () => {
    setDrafts((current) => [...current, { key: nextKey, title: "", assigneeId: "", dueDate: today() }]);
    setNextKey((current) => current + 1);
  };

  const addParticipant = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentResponsibility || !assignmentForm.memberId) return;
    setSaving(true);
    try {
      await customFetch(`/api/responsibilities/${assignmentResponsibility}/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assignmentForm),
      });
      setAssignmentResponsibility("");
      setAssignmentForm({ memberId: "", role: "SECONDARY" });
      setNotice("Participante adicionado.");
      await reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Não consegui adicionar o participante.");
    } finally { setSaving(false); }
  };

  return <section className="asa-page rt-page">
    <div className="rt-intro"><div><span className="rt-kicker">CONTÍNUO · RESPONSABILIDADE</span><p>Responsabilidade permanece. Tarefa tem dono, prazo e conclusão.</p></div><button className="rt-icon-button" aria-label="Atualizar" title="Atualizar" onClick={() => void reload()} disabled={loading}><RotateCw size={17}/></button></div>

    <div className="rt-tabs" role="tablist" aria-label="Responsabilidades e tarefas">
      <button role="tab" aria-selected={tab === "tasks"} onClick={() => setTab("tasks")}>Tarefas <span>{tasks.filter((task) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status)).length}</span></button>
      <button role="tab" aria-selected={tab === "responsibilities"} onClick={() => setTab("responsibilities")}>Responsabilidades <span>{responsibilities.length}</span></button>
    </div>

    {notice && <div className="rt-notice" role="status">{notice}<button aria-label="Dispensar aviso" onClick={() => setNotice("")}><X size={16}/></button></div>}
    {error && <div className="rt-error" role="alert"><AlertTriangle size={17}/>{error}<button onClick={() => void reload()}>Tentar novamente</button></div>}
    {loading ? <div className="rt-loading" aria-busy="true"><i/><i/><i/></div> : tab === "tasks" ? <>
      <div className="rt-toolbar"><div className="rt-filters" role="group" aria-label="Filtrar tarefas">{[["today", "Hoje"], ["open", "Abertas"], ["late", "Atrasadas"], ["done", "Concluídas"], ["all", "Todas"]].map(([value, label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>{canDistribute && <button className="rt-primary" onClick={() => { setSelectedResponsibility(""); setLotDialog(true); }}><CirclePlus size={16}/>Preparar lote</button>}</div>
      <p className="rt-explainer">Uma tarefa só entra na lista quando o lote é confirmado.</p>
      {visibleTasks.length ? <div className="rt-task-list">{visibleTasks.map((task) => {
        const closed = ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status);
        const overdue = !closed && task.dueDate < today();
        return <article className={`rt-task ${overdue ? "is-late" : ""}`} key={task.id}>
          {role === "mem" && !closed ? <button className="rt-check" aria-label={`Concluir ${task.title}`} title="Marcar como feita" disabled={saving} onClick={() => void finishTask(task)}><Check size={17}/></button> : <span className={`rt-task-mark ${closed ? "done" : ""}`}>{closed ? <Check size={15}/> : <ClipboardList size={15}/>}</span>}
          <div className="rt-task-main"><strong>{task.title}</strong><div><span>{task.responsibilityTitle ?? "Tarefa avulsa"}</span><span>{task.assigneeName}</span><span>Origem: {task.origin === "ASA" || task.origin === "AI" ? "ASA" : "Pessoa"}</span></div></div>
          <div className="rt-task-end"><time dateTime={task.dueDate} className={overdue ? "late" : ""}>{overdue ? "Atrasada · " : "Até "}{dateLabel(task.dueDate)}</time><span className={`rt-state ${closed ? "closed" : overdue ? "late" : ""}`}>{statusLabel[task.status] ?? task.status}</span></div>
        </article>;
      })}</div> : <div className="rt-empty"><ClipboardList size={24}/><strong>{filter === "today" ? "Nada vence hoje" : "Nenhuma tarefa neste filtro"}</strong><span>Quando uma tarefa for distribuída para você, ela aparece aqui.</span></div>}
    </> : <>
      <div className="rt-toolbar"><p className="rt-scope-note">Resultados permanentes pelos quais cada área responde.</p>{canDefine && <button className="rt-primary" onClick={() => setResponsibilityDialog(true)}><CirclePlus size={16}/>Nova responsabilidade</button>}</div>
      {responsibilities.length ? <div className="rt-responsibility-list">{responsibilities.map((responsibility) => <article className="rt-responsibility" key={responsibility.id}>
        <div className="rt-resp-line"><span className="rt-resp-symbol" aria-hidden="true"><ClipboardList size={17}/></span><div className="rt-resp-main"><strong>{responsibility.title}</strong><span>{responsibility.areaName ?? areas.find((area) => area.id === responsibility.areaId)?.name ?? "Área não informada"}</span></div><span className="rt-active">Ativa</span></div>
        {responsibility.description && <p className="rt-resp-description">{responsibility.description}</p>}
        <div className="rt-resp-meta"><span>Responsável pela definição</span><strong>{responsibility.ownerName ?? "Não informado"}</strong><span>Participantes</span><strong>{responsibility.assignments.filter((assignment) => assignment.active).map((assignment) => assignment.memberName).join(", ") || "Ainda sem participantes"}</strong></div>
        {canDefine && <button className="rt-link-button" onClick={() => setAssignmentResponsibility(responsibility.id)}><CirclePlus size={14}/>Adicionar participante</button>}
        {canDistribute && <button className="rt-link-button" onClick={() => { setSelectedResponsibility(responsibility.id); setLotDialog(true); }}>Preparar lote desta responsabilidade</button>}
      </article>)}</div> : <div className="rt-empty"><ClipboardList size={24}/><strong>Não há responsabilidades no seu acesso</strong><span>As definições permanentes das áreas aparecem nesta lista.</span></div>}
    </>}

    {responsibilityDialog && <div className="rt-backdrop" role="presentation" onMouseDown={() => !saving && setResponsibilityDialog(false)}><section className="rt-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-resp-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="rt-resp-title">Nova responsabilidade</h2><button className="rt-icon-button" aria-label="Fechar" onClick={() => setResponsibilityDialog(false)}><X size={18}/></button></header>
      <p>Defina um resultado permanente e a área que responde por ele.</p>
      <form onSubmit={saveResponsibility} className="rt-form"><label>Título<input required autoFocus value={responsibilityForm.title} onChange={(event) => setResponsibilityForm({ ...responsibilityForm, title: event.target.value })} placeholder="Ex.: Elenco pronto para o show"/></label><label>Área<select required value={responsibilityForm.areaId} onChange={(event) => setResponsibilityForm({ ...responsibilityForm, areaId: event.target.value })}><option value="">Escolha uma área</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Descrição<textarea value={responsibilityForm.description} onChange={(event) => setResponsibilityForm({ ...responsibilityForm, description: event.target.value })} rows={3}/></label><footer><button type="button" className="rt-secondary" onClick={() => setResponsibilityDialog(false)}>Cancelar</button><button className="rt-primary" disabled={saving}>{saving ? "Salvando…" : "Criar responsabilidade"}</button></footer></form>
    </section></div>}

    {assignmentResponsibility && <div className="rt-backdrop" role="presentation" onMouseDown={() => !saving && setAssignmentResponsibility("")}><section className="rt-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-participant-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="rt-participant-title">Adicionar participante</h2><button className="rt-icon-button" aria-label="Fechar" onClick={() => setAssignmentResponsibility("")}><X size={18}/></button></header>
      <p>{responsibilities.find((item) => item.id === assignmentResponsibility)?.title}</p>
      <form onSubmit={addParticipant} className="rt-form"><label>Pessoa<select required value={assignmentForm.memberId} onChange={(event) => setAssignmentForm({ ...assignmentForm, memberId: event.target.value })}><option value="">Escolha uma pessoa</option>{people.map((person) => <option key={person.id} value={person.id}>{displayName(person)}{person.areaName ? ` · ${person.areaName}` : ""}</option>)}</select></label><label>Participação<select value={assignmentForm.role} onChange={(event) => setAssignmentForm({ ...assignmentForm, role: event.target.value })}><option value="SECONDARY">Participante</option><option value="PRIMARY">Principal</option><option value="VIEWER">Somente leitura</option></select></label><footer><button type="button" className="rt-secondary" onClick={() => setAssignmentResponsibility("")}>Cancelar</button><button className="rt-primary" disabled={saving || !assignmentForm.memberId}>{saving ? "Salvando…" : "Adicionar pessoa"}</button></footer></form>
    </section></div>}

    {lotDialog && <div className="rt-backdrop" role="presentation" onMouseDown={() => !saving && setLotDialog(false)}><section className="rt-dialog rt-lot-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-lot-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="rt-lot-title">Preparar lote</h2><button className="rt-icon-button" aria-label="Fechar" onClick={() => setLotDialog(false)}><X size={18}/></button></header>
      <p>Revise títulos, responsáveis e prazos. Nada entra na lista antes da confirmação.</p>
      <form onSubmit={confirmLot} className="rt-form">
        <label>Responsabilidade<select value={selectedResponsibility} onChange={(event) => setSelectedResponsibility(event.target.value)}><option value="">Tarefas avulsas</option>{responsibilities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {operations.length > 1 && <label>Operação<select required value={selectedOperation} onChange={(event) => setSelectedOperation(event.target.value)}>{operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}</select></label>}
        {!operations.length && <p className="rt-form-error">Nenhuma operação disponível para distribuir tarefas.</p>}
        <div className="rt-drafts">{drafts.map((draft, index) => <fieldset key={draft.key}><legend>Tarefa {index + 1}</legend><label>Título<input required value={draft.title} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, title: event.target.value } : item))} placeholder="Ação a realizar"/></label><div className="rt-draft-pair"><label>Responsável<select required value={draft.assigneeId} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, assigneeId: event.target.value } : item))}><option value="">Escolha uma pessoa</option>{scopedPeople.map((person) => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label><label>Prazo<input type="date" required value={draft.dueDate} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, dueDate: event.target.value } : item))}/></label></div>{drafts.length > 1 && <button type="button" className="rt-remove" aria-label={`Remover tarefa ${index + 1}`} onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}><Trash2 size={15}/>Remover</button>}</fieldset>)}</div>
        <button type="button" className="rt-secondary rt-add" onClick={addDraft}><CirclePlus size={16}/>Adicionar tarefa</button>
        <footer><button type="button" className="rt-secondary" onClick={() => setLotDialog(false)}>Descartar</button><button className="rt-primary" disabled={saving || drafts.every((draft) => !draft.title.trim() || !draft.assigneeId || !draft.dueDate)}>{saving ? "Confirmando…" : `Confirmar lote · ${drafts.length}`}</button></footer>
      </form>
    </section></div>}
  </section>;
}
