import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Check, CirclePlus, ClipboardList, RotateCw, Trash2, X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useFecharComEsc } from "@/lib/fechar-com-esc";

type ShellRole = "adm" | "dir" | "sup" | "mem";
type Area = { id: string; name: string };
type Person = { id: string; name?: string; displayName?: string; areaId?: string | null; areaName?: string | null; status?: string; operationIds?: string[] };
type Operation = { id: string; name: string };
type Responsibility = { id: string; title: string; description?: string | null; areaId: string | null; areaName?: string | null; ownerId?: string | null; ownerName?: string | null; operationId?: string | null; active: boolean; assignments: { id: string; memberId: string; memberName: string; role: string; active: boolean }[] };
type Task = { id: string; title: string; description?: string | null; responsibilityId?: string | null; responsibilityTitle?: string | null; areaId?: string | null; assigneeId: string; assigneeName: string; dueDate: string; status: string; origin: string; operationId: string; operationName?: string };
// Uma linha do lote vale para quantas pessoas forem marcadas: vira uma tarefa para cada uma.
type Draft = { key: number; title: string; assigneeIds: string[]; dueDate: string };
const novoRascunho = (key: number): Draft => ({ key, title: "", assigneeIds: [], dueDate: today() });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const displayName = (person?: Person) => person?.displayName ?? person?.name ?? "Pessoa";
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const statusLabel: Record<string, string> = { CREATED: "A fazer", IN_PROGRESS: "Em andamento", READY_FOR_APPROVAL: "Aguardando", CHANGES_REQUESTED: "Ajustes", APPROVED: "Concluída", COMPLETED: "Concluída", CANCELLED: "Cancelada", EXPIRED: "Expirada" };

export default function ResponsibilitiesTasksPage({ role }: { role: ShellRole }) {
  const canDefine = role === "adm" || role === "dir";
  // Supervisão sem a responsabilidade "Aprovação de tarefas" não distribui: o botão nem aparece (o servidor recusaria só no fim).
  const [semAcessoEquipe, setSemAcessoEquipe] = useState(false), [lotError, setLotError] = useState("");
  const canDistribute = canDefine || (role === "sup" && !semAcessoEquipe);
  const [tab, setTab] = useState<"tasks" | "responsibilities">("tasks");
  const [filter, setFilter] = useState("today");
  const myId = useAuth().user?.id ?? null;
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
  const [assignmentForm, setAssignmentForm] = useState<{ memberIds: string[]; role: string }>({ memberIds: [], role: "SECONDARY" });
  const [assignmentError, setAssignmentError] = useState("");
  // Cancelar tarefa: o motivo é opcional e quem tinha a tarefa recebe o aviso.
  const [cancelTask, setCancelTask] = useState<Task | null>(null), [cancelMotivo, setCancelMotivo] = useState(""), [cancelError, setCancelError] = useState("");
  const [lotDialog, setLotDialog] = useState(false);
  const [responsibilityForm, setResponsibilityForm] = useState({ title: "", areaId: "", description: "" });
  const [selectedResponsibility, setSelectedResponsibility] = useState("");
  const [selectedOperation, setSelectedOperation] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([novoRascunho(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [refsFailed, setRefsFailed] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const lotDirty = drafts.some((draft) => draft.title.trim() || draft.assigneeIds.length);
  const lotCount = drafts.reduce((total, draft) => total + (draft.title.trim() && draft.dueDate ? draft.assigneeIds.length : 0), 0);
  // Fechar o lote com coisa digitada pergunta antes: Esc, × e Descartar valem o mesmo, e o clique fora não fecha.
  const closeLot = () => { if (saving) return; if (lotDirty && !discarding) { setDiscarding(true); return; } setLotDialog(false); setDiscarding(false); };
  useFecharComEsc(() => setResponsibilityDialog(false), responsibilityDialog && !saving);
  useFecharComEsc(() => setAssignmentResponsibility(""), Boolean(assignmentResponsibility) && !saving);
  useFecharComEsc(closeLot, lotDialog);
  useEffect(() => { if (!lotDialog) setLotError(""); }, [lotDialog]);
  useFecharComEsc(() => setCancelTask(null), Boolean(cancelTask) && !saving);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Se alguma lista de apoio falhar, a tela abre mesmo assim, mas o lote avisa em vez de dizer "nenhuma operação".
      let falhou = false;
      const [responsibilityData, operationData, userData, areaData] = await Promise.all([
        customFetch<{ responsibilities: Responsibility[] }>("/api/responsibilities"),
        customFetch<{ operations?: Operation[] }>("/api/operations").catch(() => { falhou = true; return { operations: [] as Operation[] }; }),
        customFetch<{ users?: Person[] }>("/api/users").catch(() => { falhou = true; return { users: [] as Person[] }; }),
        // O Elenco não monta lote nem escolhe área: pedir a lista de áreas para ele só gerava uma recusa (403) à toa.
        role === "mem" ? Promise.resolve({ areas: [] as Area[] }) : customFetch<{ areas?: Area[] }>("/api/areas").catch(() => { falhou = true; return { areas: [] as Area[] }; }),
      ]);
      setRefsFailed(falhou);
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
        setSemAcessoEquipe(Boolean(withoutTeamAccess && withoutTeamAccess === nextOperations.length));
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
    if (filter === "mine") return task.assigneeId === myId;
    return true;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [filter, tasks, myId]);
  const abertas = useMemo(() => tasks.filter((task) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status)).length, [tasks]);
  // A tela abre em "Hoje". Se nada vence hoje mas a pessoa tem tarefa em aberto, abre direto em "Em aberto": senão a lista parece vazia
  // enquanto o contador da aba diz "Tarefas 1".
  const [escolheuFiltroInicial, setEscolheuFiltroInicial] = useState(false);
  useEffect(() => {
    if (loading || escolheuFiltroInicial) return;
    setEscolheuFiltroInicial(true);
    const venceHoje = tasks.some((task) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status) && task.dueDate <= today());
    if (filter === "today" && !venceHoje && abertas > 0) setFilter("open");
  }, [loading, escolheuFiltroInicial, tasks, abertas, filter]);

  const scopedPeople = useMemo(() => {
    const selected = responsibilities.find((item) => item.id === selectedResponsibility);
    // Só quem pode receber tarefa: pessoa ativa e da operação escolhida (desligada e gente de outra operação não entram).
    const elegiveis = people.filter((person) => (!person.status || person.status === "ACTIVE") && (!selectedOperation || !person.operationIds?.length || person.operationIds.includes(selectedOperation)));
    return role === "sup" && selected?.areaId ? elegiveis.filter((person) => person.areaId === selected.areaId) : elegiveis;
  }, [people, responsibilities, role, selectedResponsibility, selectedOperation]);

  // Trocar a operação tira da seleção quem não é dela, para não confirmar tarefa para quem a lista já não mostra.
  useEffect(() => {
    const permitidas = new Set(scopedPeople.map((person) => person.id));
    setDrafts((atuais) => atuais.some((draft) => draft.assigneeIds.some((id) => !permitidas.has(id))) ? atuais.map((draft) => ({ ...draft, assigneeIds: draft.assigneeIds.filter((id) => permitidas.has(id)) })) : atuais);
  }, [scopedPeople]);

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
    const validDrafts = drafts.filter((draft) => draft.title.trim() && draft.assigneeIds.length && draft.dueDate);
    if (!selectedOperation || !validDrafts.length) return;
    const tasksToSend = validDrafts.flatMap(({ title, assigneeIds, dueDate }) => assigneeIds.map((assigneeId) => ({ title: title.trim(), assigneeId, dueDate })));
    if (tasksToSend.length > 50) { setNotice(`Um lote aceita até 50 tarefas e este tem ${tasksToSend.length}. Divida em dois lotes.`); return; }
    setSaving(true);
    try {
      const result = await customFetch<{ tasks: Task[] }>("/api/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: selectedOperation,
          responsibilityId: selectedResponsibility || undefined,
          tasks: tasksToSend,
        }),
      });
      // A resposta da criação não traz o nome do responsável nem da operação: recarrega a lista, em vez de inserir linhas incompletas.
      await reload();
      setLotDialog(false); setDiscarding(false);
      setDrafts([novoRascunho(0)]);
      // O filtro "Hoje" esconderia tarefa com prazo adiante: a pessoa confirma e não vê nada. Em aberto mostra as novas.
      setTab("tasks"); setFilter("open");
      const total = result.tasks?.length ?? tasksToSend.length;
      const pessoas = new Set(tasksToSend.map((task) => task.assigneeId)).size;
      setNotice(`${plural(total, "tarefa confirmada", "tarefas confirmadas")} para ${plural(pessoas, "pessoa", "pessoas")}. Cada uma recebe um aviso no sino.`);
    } catch (cause) {
      // Dentro da janela (o aviso da página fica atrás dela) e com a frase do servidor, sem o "HTTP 403 Forbidden:" na frente.
      setLotError(frase(cause, "Não consegui confirmar o lote agora. Nada foi criado; confira a conexão e tente de novo."));
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
    setDrafts((current) => [...current, novoRascunho(nextKey)]);
    setNextKey((current) => current + 1);
  };

  // A frase que o servidor mandou, ou o texto da tela quando foi rede ou servidor fora do ar.
  const frase = (cause: unknown, padrao: string) => { const data = (cause as { data?: { message?: string; error?: string } } | null)?.data; return data?.message || data?.error || padrao; };
  // Várias pessoas de uma vez: uma chamada por pessoa, e o resumo diz quem entrou e quem não entrou (e por quê).
  const addParticipant = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentResponsibility || !assignmentForm.memberIds.length || saving) return;
    if (assignmentForm.role === "PRIMARY" && assignmentForm.memberIds.length > 1) { setAssignmentError("Só uma pessoa pode ser a principal. Escolha só uma, ou mude para Participante."); return; }
    setSaving(true); setAssignmentError("");
    const entraram: string[] = [], falhas: string[] = [], falhaIds: string[] = [];
    for (const memberId of assignmentForm.memberIds) {
      const nome = displayName(people.find((person) => person.id === memberId));
      try {
        await customFetch(`/api/responsibilities/${assignmentResponsibility}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, role: assignmentForm.role }) });
        entraram.push(nome);
      } catch (cause) { falhas.push(`${nome} (${frase(cause, "não consegui")})`); falhaIds.push(memberId); }
    }
    setSaving(false);
    if (entraram.length) await reload();
    if (falhas.length) { setAssignmentForm((atual) => ({ ...atual, memberIds: falhaIds })); setAssignmentError(`${entraram.length ? `Entraram ${entraram.length}. ` : ""}Não entrou: ${falhas.join("; ")}.`); if (entraram.length) setNotice(`${entraram.length} ${entraram.length === 1 ? "pessoa adicionada" : "pessoas adicionadas"}; veja no aviso da janela quem faltou.`); return; }
    setAssignmentResponsibility(""); setAssignmentForm({ memberIds: [], role: "SECONDARY" });
    setNotice(`${entraram.length} ${entraram.length === 1 ? "pessoa adicionada" : "pessoas adicionadas"}. Cada uma recebe um aviso no sino.`);
  };
  const confirmCancelTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!cancelTask || saving) return;
    setSaving(true); setCancelError("");
    try {
      await customFetch(`/api/tasks/${cancelTask.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: cancelMotivo.trim() || undefined }) });
      setNotice(`Tarefa cancelada. ${cancelTask.assigneeName} recebe o aviso.`); setCancelTask(null); setCancelMotivo(""); await reload();
    } catch (cause) { setCancelError(frase(cause, "Não consegui cancelar agora. Nada foi alterado; tente de novo.")); }
    finally { setSaving(false); }
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
      <div className="rt-toolbar"><div className="rt-filters" role="group" aria-label="Filtrar tarefas">{([["today", "Hoje"], ["open", "Em aberto"], ["late", "Vencidas"], ["done", "Feitas"], ...(role === "mem" ? [] : [["mine", "Minhas"]]), ["all", "Todas"]] as [string, string][]).map(([value, label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>{canDistribute && <button className="rt-primary" onClick={() => { setSelectedResponsibility(""); setLotDialog(true); }}><CirclePlus size={16}/>Preparar lote</button>}</div>
      {role !== "mem" && <p className="rt-explainer">Uma tarefa só entra na lista quando o lote é confirmado.</p>}
      {visibleTasks.length ? <div className="rt-task-list">{visibleTasks.map((task) => {
        const closed = ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status);
        const overdue = !closed && task.dueDate < today();
        return <article className={`rt-task ${overdue ? "is-late" : ""}`} key={task.id}>
          {role === "mem" && !closed ? <button className="rt-check" aria-label={`Concluir ${task.title}`} title="Marcar como feita" disabled={saving} onClick={() => void finishTask(task)}><Check size={17}/></button> : <span className={`rt-task-mark ${closed ? "done" : ""}`}>{closed ? <Check size={15}/> : <ClipboardList size={15}/>}</span>}
          <div className="rt-task-main"><strong>{task.title}</strong><div><span>{task.responsibilityTitle ?? "Tarefa avulsa"}</span><span>{task.assigneeName}</span><span>Origem: {task.origin === "ASA" || task.origin === "AI" ? "ASA" : "Pessoa"}</span></div></div>
          <div className="rt-task-end"><time dateTime={task.dueDate} className={overdue ? "late" : ""}>{overdue ? "Atrasada · " : "Até "}{dateLabel(task.dueDate)}</time><span className={`rt-state ${closed ? "closed" : overdue ? "late" : ""}`}>{statusLabel[task.status] ?? task.status}</span>{canDistribute && !closed && <button type="button" className="rt-task-cancel" onClick={() => { setCancelError(""); setCancelMotivo(""); setCancelTask(task); }}>Cancelar tarefa</button>}</div>
        </article>;
      })}</div> : <div className="rt-empty"><ClipboardList size={24}/><strong>{filter === "today" ? "Nada vence hoje" : "Nenhuma tarefa neste filtro"}</strong>{abertas > 0 && filter !== "open" && filter !== "all"
        ? <><span>{abertas === 1 ? "Você tem 1 tarefa em aberto, com prazo em outro dia." : `Você tem ${abertas} tarefas em aberto, com prazo em outros dias.`}</span><button type="button" className="rt-link" onClick={() => setFilter("open")}>Ver as em aberto</button></>
        : <span>{role === "mem" ? "Quando uma tarefa for distribuída para você, ela aparece aqui." : "Tire ou troque o filtro para ver as outras tarefas."}</span>}</div>}
    </> : <>
      <div className="rt-toolbar"><p className="rt-scope-note">Resultados permanentes pelos quais cada área responde.</p>{canDefine && <button className="rt-primary" onClick={() => setResponsibilityDialog(true)}><CirclePlus size={16}/>Nova responsabilidade</button>}</div>
      {responsibilities.length ? <div className="rt-responsibility-list">{responsibilities.map((responsibility) => <article className="rt-responsibility" key={responsibility.id}>
        <div className="rt-resp-line"><span className="rt-resp-symbol" aria-hidden="true"><ClipboardList size={17}/></span><div className="rt-resp-main"><strong>{responsibility.title}</strong><span>{responsibility.areaName ?? areas.find((area) => area.id === responsibility.areaId)?.name ?? "Área não informada"}</span></div><span className="rt-active">Ativa</span></div>
        {responsibility.description && <p className="rt-resp-description">{responsibility.description}</p>}
        <div className="rt-resp-meta"><span>Responsável pela definição</span><strong>{responsibility.ownerName ?? "Não informado"}</strong><span>Participantes</span><strong>{responsibility.assignments.filter((assignment) => assignment.active).map((assignment) => assignment.memberName).join(", ") || "Ainda sem participantes"}</strong></div>
        {canDefine && <button className="rt-link-button" onClick={() => { setAssignmentError(""); setAssignmentForm({ memberIds: [], role: "SECONDARY" }); setAssignmentResponsibility(responsibility.id); }}><CirclePlus size={14}/>Adicionar participante</button>}
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
      <form onSubmit={addParticipant} className="rt-form">{(() => {
          const jaSao = new Set(responsibilities.find((item) => item.id === assignmentResponsibility)?.assignments.filter((assignment) => assignment.active).map((assignment) => assignment.memberId) ?? []);
          const candidatas = people.filter((person) => !jaSao.has(person.id) && (!person.status || person.status === "ACTIVE"));
          return <div className="rt-assignees" role="group" aria-label="Pessoas a adicionar"><div className="rt-assignees-head"><span>Pessoas{assignmentForm.memberIds.length ? ` · ${assignmentForm.memberIds.length}` : ""} <small>(marque quantas quiser)</small></span>{candidatas.length > 1 && <span className="rt-assignees-tools"><button type="button" onClick={() => setAssignmentForm((atual) => ({ ...atual, memberIds: candidatas.map((person) => person.id) }))}>Marcar todas</button><button type="button" onClick={() => setAssignmentForm((atual) => ({ ...atual, memberIds: [] }))}>Limpar</button></span>}</div><div className="rt-assignee-list">{candidatas.map((person) => <label key={person.id}><input type="checkbox" checked={assignmentForm.memberIds.includes(person.id)} onChange={() => setAssignmentForm((atual) => ({ ...atual, memberIds: atual.memberIds.includes(person.id) ? atual.memberIds.filter((id) => id !== person.id) : [...atual.memberIds, person.id] }))}/><span>{displayName(person)}{person.areaName ? ` · ${person.areaName}` : ""}</span></label>)}{!candidatas.length && <p className="rt-form-error">Todas as pessoas já participam desta responsabilidade.</p>}</div></div>;
        })()}<label>Participação<select value={assignmentForm.role} onChange={(event) => setAssignmentForm({ ...assignmentForm, role: event.target.value })}><option value="SECONDARY">Participante</option><option value="PRIMARY">Principal</option><option value="VIEWER">Somente leitura</option></select></label>{assignmentError && <p className="rt-form-error" role="alert">{assignmentError}</p>}<footer><button type="button" className="rt-secondary" onClick={() => setAssignmentResponsibility("")}>Cancelar</button><button className="rt-primary" disabled={saving || !assignmentForm.memberIds.length}>{saving ? "Adicionando…" : assignmentForm.memberIds.length > 1 ? `Adicionar ${assignmentForm.memberIds.length} pessoas` : "Adicionar pessoa"}</button></footer></form>
    </section></div>}

    {cancelTask && <div className="rt-backdrop" role="presentation" onMouseDown={() => !saving && setCancelTask(null)}><section className="rt-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-cancel-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="rt-cancel-title">Cancelar tarefa</h2><button className="rt-icon-button" aria-label="Fechar" onClick={() => setCancelTask(null)}><X size={18}/></button></header>
      <p>{cancelTask.title} · {cancelTask.assigneeName} · até {dateLabel(cancelTask.dueDate)} — {cancelTask.assigneeName} recebe o aviso de que a tarefa não vale mais. Não dá para desfazer; para voltar, é preciso criar a tarefa de novo.</p>
      <form onSubmit={confirmCancelTask} className="rt-form"><label>Motivo (opcional)<textarea value={cancelMotivo} onChange={(event) => setCancelMotivo(event.target.value)} rows={3} placeholder="Quem tinha a tarefa lê este motivo"/></label>{cancelError && <p className="rt-form-error" role="alert">{cancelError}</p>}<footer><button type="button" className="rt-secondary" onClick={() => setCancelTask(null)}>Voltar</button><button className="rt-primary rt-danger-solid" disabled={saving}>{saving ? "Cancelando…" : "Cancelar tarefa"}</button></footer></form>
    </section></div>}

    {lotDialog && <div className="rt-backdrop" role="presentation" onMouseDown={() => { if (!saving && !lotDirty) closeLot(); }}><section className="rt-dialog rt-lot-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-lot-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="rt-lot-title">Preparar lote</h2><button className="rt-icon-button" aria-label="Fechar" onClick={closeLot}><X size={18}/></button></header>
      <p>Revise títulos, responsáveis e prazos. Nada entra na lista antes da confirmação.</p>
      <form onSubmit={confirmLot} className="rt-form">
        <label>Responsabilidade<select value={selectedResponsibility} onChange={(event) => setSelectedResponsibility(event.target.value)}><option value="">Tarefas avulsas</option>{responsibilities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {operations.length > 1 && <label>Operação<select required value={selectedOperation} onChange={(event) => setSelectedOperation(event.target.value)}>{operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}</select></label>}
        {refsFailed && <p className="rt-form-error" role="alert">Não consegui carregar parte das listas (operações, pessoas ou áreas), então o que aparece aqui pode estar incompleto. Feche, toque em Atualizar e tente de novo.</p>}
        {!refsFailed && !operations.length && <p className="rt-form-error">Nenhuma operação disponível para distribuir tarefas.</p>}
        <div className="rt-drafts">{drafts.map((draft, index) => <fieldset key={draft.key}><legend>Tarefa {index + 1}</legend><label>Título<input required value={draft.title} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, title: event.target.value } : item))} placeholder="Ação a realizar"/></label><label>Prazo<input type="date" required value={draft.dueDate} onChange={(event) => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, dueDate: event.target.value } : item))}/></label><div className="rt-assignees" role="group" aria-label={`Responsáveis da tarefa ${index + 1}`}><div className="rt-assignees-head"><span>Responsáveis{draft.assigneeIds.length ? ` · ${draft.assigneeIds.length}` : ""} <small>(uma tarefa para cada pessoa marcada)</small></span>{scopedPeople.length > 1 && <span className="rt-assignees-tools"><button type="button" onClick={() => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, assigneeIds: scopedPeople.map((person) => person.id) } : item))}>Marcar todas</button><button type="button" onClick={() => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, assigneeIds: [] } : item))}>Limpar</button></span>}</div><div className="rt-assignee-list">{scopedPeople.map((person) => <label key={person.id}><input type="checkbox" checked={draft.assigneeIds.includes(person.id)} onChange={() => setDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, assigneeIds: item.assigneeIds.includes(person.id) ? item.assigneeIds.filter((id) => id !== person.id) : [...item.assigneeIds, person.id] } : item))}/><span>{displayName(person)}{person.areaName ? ` · ${person.areaName}` : ""}</span></label>)}{!scopedPeople.length && <p className="rt-form-error">Nenhuma pessoa disponível para receber tarefa.</p>}</div></div>{drafts.length > 1 && <button type="button" className="rt-remove" aria-label={`Remover tarefa ${index + 1}`} onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}><Trash2 size={15}/>Remover</button>}</fieldset>)}</div>
        <button type="button" className="rt-secondary rt-add" onClick={addDraft}><CirclePlus size={16}/>Adicionar tarefa</button>
        {!lotCount && <p className="rt-explainer">Para confirmar, cada tarefa precisa de título, prazo e ao menos uma pessoa marcada.</p>}
        {lotError && <p className="rt-form-error" role="alert">{lotError}</p>}
        {discarding && <div className="rt-discard" role="alertdialog" aria-label="Descartar o lote"><span>Descartar o que você digitou? As tarefas deste lote não foram criadas.</span><div><button type="button" className="rt-secondary" onClick={() => setDiscarding(false)}>Continuar editando</button><button type="button" className="rt-secondary rt-danger" onClick={() => { setLotDialog(false); setDiscarding(false); setDrafts([novoRascunho(0)]); }}>Descartar</button></div></div>}
        <footer><button type="button" className="rt-secondary" onClick={closeLot}>{lotDirty ? "Descartar" : "Cancelar"}</button><button className="rt-primary" disabled={saving || lotCount === 0}>{saving ? "Confirmando…" : lotCount ? `Confirmar ${plural(lotCount, "tarefa", "tarefas")}` : "Confirmar lote"}</button></footer>
      </form>
    </section></div>}
  </section>;
}
