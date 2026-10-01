import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { ArrowUp, Check, CircleHelp, SlidersHorizontal, Undo2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAsaPresenceState, selectAsaSuggestions, type AsaProactivityLevel, type AsaSuggestionFrequency, type AsaSuggestionMode } from "@workspace/shared";
import "@/global-asa-assistant.css";
import "@/global-asa-proposal.css";
import "@/global-asa-assistant-operation.css";

type AsaProposal = { id: string; actionType: string; title: string; recipientName?: string; recipientNames?: string[]; newTitle?: string; previousTitle?: string; content?: string; previousContent?: string; announcementContent?: string; reaction?: string; previousReaction?: string | null; description?: string; evidenceUrl?: string; evidenceDescription?: string; responsibilityTitle?: string; previousResponsibilityTitle?: string | null; newResponsibilityTitle?: string | null; previousDescription?: string | null; operationName: string; recipientCount?: number; assigneeName?: string; checklistLabels?: string[]; checklistItemLabel?: string; checklistKind?: "mandatory" | "operational"; checklistCompleted?: boolean; previousChecklistCompleted?: boolean; mandatoryEvidences?: Array<{ type: string; description: string }>; previousChecklistLabels?: string[]; previousMandatoryEvidences?: Array<{ type?: string; description?: string }>; previousAssigneeName?: string; previousStatus?: string; expectedStatus?: string; previousDate?: string; previousStartTime?: string | null; previousEndTime?: string | null; date?: string; startTime?: string; endTime?: string; previousNotes?: string | null; notes?: string | null; dueDate?: string; previousDueDate?: string; previousPriority?: string; priority?: string; previousMode?: string; mode?: string; changes?: Array<{ key: string; label: string; before: string; after: string }>; expiresAt: string; state: string };
type AsaUndo = { id: string; expiresAt: string; windowSeconds: number };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; pending?: boolean; proposal?: AsaProposal; undo?: AsaUndo; undoState?: "UNDONE"; undoError?: string };
type AsaSuggestionChip = { label: string; prompt: string };

function taskPriorityLabel(priority?: string) {
  return ({ LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" } as Record<string, string>)[priority ?? "MEDIUM"] ?? "média";
}

function proposalTitle(actionType: string, operationName: string) {
  const titles: Record<string, string> = {
    TASK_COMMENT_CREATE: "Comentar tarefa", TASK_EVIDENCE_LINK_ADD: "Anexar link complementar", TASK_CHECKLIST_UPDATE: "Atualizar checklist", TASK_CANCEL: "Cancelar tarefa", MURAL_ACK: "Confirmação do Mural",
    NOTICE_DRAFT_UPDATE: "Editar rascunho", AGENDA_DRAFT_RENAME: "Renomear reunião",
    AGENDA_DRAFT_SCHEDULE_UPDATE: "Alterar data e horário", AGENDA_DRAFT_NOTES_UPDATE: "Alterar observações",
    AGENDA_MEETING_CREATE: "Reunião", TASK_CREATE: "Tarefa", TASK_START: "Iniciar tarefa",
    TASK_READY_FOR_APPROVAL: "Enviar para aprovação", TASK_COMPLETE: "Concluir tarefa",
    TASK_UPDATE_DUE_DATE: "Alterar prazo", TASK_UPDATE_ASSIGNEE: "Alterar responsável",
    TASK_UPDATE_PRIORITY: "Alterar prioridade", TASK_UPDATE_DESCRIPTION: "Alterar descrição",
    TASK_UPDATE_TITLE: "Alterar título", TASK_UPDATE_REQUIREMENTS: "Alterar requisitos",
    TASK_UPDATE_RESPONSIBILITY: "Alterar responsabilidade",
  };
  return `${titles[actionType] ?? "Rascunho"} · ${operationName}`;
}

function proposalConfirmLabel(actionType: string) {
  return ({
    TASK_COMMENT_CREATE: "Publicar comentário", TASK_EVIDENCE_LINK_ADD: "Anexar link", TASK_CHECKLIST_UPDATE: "Atualizar item", TASK_CANCEL: "Cancelar tarefa", MURAL_ACK: "Registrar ciente",
    NOTICE_DRAFT_UPDATE: "Atualizar rascunho", AGENDA_DRAFT_RENAME: "Renomear rascunho",
    AGENDA_DRAFT_SCHEDULE_UPDATE: "Atualizar horário", AGENDA_DRAFT_NOTES_UPDATE: "Atualizar observações",
    AGENDA_MEETING_CREATE: "Criar reunião", TASK_CREATE: "Criar tarefa", TASK_START: "Iniciar tarefa",
    TASK_READY_FOR_APPROVAL: "Enviar para aprovação", TASK_COMPLETE: "Concluir tarefa",
    TASK_UPDATE_DUE_DATE: "Atualizar prazo", TASK_UPDATE_ASSIGNEE: "Atualizar responsável",
    TASK_UPDATE_PRIORITY: "Atualizar prioridade", TASK_UPDATE_DESCRIPTION: "Atualizar descrição",
    TASK_UPDATE_TITLE: "Atualizar título", TASK_UPDATE_REQUIREMENTS: "Atualizar requisitos",
    TASK_UPDATE_RESPONSIBILITY: "Atualizar vínculo",
  } as Record<string, string>)[actionType] ?? "Criar rascunho";
}

function proposalStateLabel(actionType: string, state: string, expectedStatus?: string) {
  if (state === "PENDING") return "Prévia expirada";
  if (state === "CANCELLED") return "Proposta cancelada";
  if (state !== "CONFIRMED") return "Proposta não está mais disponível";
  const labels: Record<string, string> = {
    TASK_COMMENT_CREATE: "Comentário publicado", TASK_EVIDENCE_LINK_ADD: "Link complementar anexado", TASK_CHECKLIST_UPDATE: "Checklist atualizada", TASK_CANCEL: "Tarefa cancelada",
    AGENDA_DRAFT_NOTES_UPDATE: "Observações atualizadas; rascunho não confirmado",
    AGENDA_DRAFT_SCHEDULE_UPDATE: "Data e horário atualizados; rascunho não confirmado",
    AGENDA_DRAFT_RENAME: "Rascunho renomeado; não confirmado", NOTICE_DRAFT_UPDATE: "Rascunho atualizado; não publicado",
    MURAL_ACK: "Ciente registrado", TASK_CREATE: "Tarefa criada; aprovação após a conclusão",
    TASK_START: "Tarefa iniciada", TASK_READY_FOR_APPROVAL: "Enviada para aprovação",
    TASK_COMPLETE: "Tarefa concluída", TASK_UPDATE_DUE_DATE: "Prazo atualizado",
    TASK_UPDATE_ASSIGNEE: "Responsável atualizado", TASK_UPDATE_PRIORITY: "Prioridade atualizada",
    TASK_UPDATE_DESCRIPTION: "Descrição atualizada", TASK_UPDATE_TITLE: "Título atualizado",
    TASK_UPDATE_REQUIREMENTS: "Requisitos atualizados", TASK_UPDATE_RESPONSIBILITY: "Responsabilidade atualizada",
  };
  if (actionType === "AGENDA_MEETING_CREATE") return expectedStatus === "PROPOSED" ? "Proposta enviada à Supervisão" : "Rascunho criado na Agenda";
  return labels[actionType] ?? "Rascunho criado, não publicado";
}

const suggestions = ["Mostra minha escala dessa semana", "Quais são minhas tarefas?", "Tenho notificações não lidas?"];
const pageSuggestions: Record<string, string[]> = {
  "/meu-dia": ["O que tenho aqui?", "O que tenho no Meu Dia?"],
  "/escalas": ["O que tenho aqui?", "Mostra minha escala dessa semana"],
  "/livro-do-dia": ["O que tenho aqui?", "Mostra o Livro do Dia de hoje"],
  "/check-in": ["O que tenho aqui?", "Meu check-in hoje"],
  "/agenda": ["O que tenho aqui?", "Mostra a agenda", "Quais são minhas propostas de reunião?"],
  "/responsabilidades": ["O que tenho aqui?", "Quais são minhas tarefas pendentes?"],
  "/folgas": ["O que tenho aqui?", "Quais são minhas folgas?"],
  "/mensagens": ["Minhas mensagens não lidas", "Busque nas mensagens por ‘figurino’"],
  "/membro/mensagens": ["O que tenho aqui?", "Minhas mensagens não lidas"],
  "/notificacoes": ["O que tenho aqui?", "Minhas notificações não lidas"],
  "/mural": ["O que tenho aqui?", "Mostra o Mural"],
  "/biblioteca": ["Quais leituras estão pendentes na Biblioteca?", "Buscar na biblioteca"],
  "/shows": ["O que tenho aqui?", "Quais Livros do Show estão disponíveis?"],
  "/pessoas": ["O que tenho aqui?", "Buscar pessoas por ‘Ana’"],
  "/locais": ["O que tenho aqui?", "Mostrar locais"],
  "/membro/entregas": ["O que tenho aqui?", "Minhas entregas"],
  "/membro/tarefas": ["O que tenho aqui?", "Quais são minhas tarefas pendentes?"],
  "/membro/avisos": ["O que tenho aqui?", "Meus avisos"],
  "/membro/solicitacoes": ["O que tenho aqui?", "Minhas solicitações"],
  "/membro/folgas": ["O que tenho aqui?", "Quais são minhas folgas?"],
  "/membro/escala": ["O que tenho aqui?", "Mostra minha escala dessa semana"],
  "/membro/biblioteca": ["O que tenho aqui?", "Buscar na biblioteca"],
  "/admin/library": ["Quais leituras estão pendentes na Biblioteca?", "Buscar na biblioteca", "Qual o estado da Biblioteca?"],
  "/supervisor/library": ["Quais leituras estão pendentes na Biblioteca?", "Buscar na biblioteca", "Qual o estado da Biblioteca?"],
  "/admin/meu-dia": ["O que tenho aqui?", "O que tenho no Meu Dia?"],
  "/admin/agenda": ["O que tenho aqui?", "Mostra a agenda"],
  "/admin/insights": ["O que tenho aqui?", "Resumo de check-ins dos últimos 7 dias"],
  "/supervisor/insights": ["O que tenho aqui?", "Mostra os check-ins da equipe hoje"],
  "/admin/tasks": ["O que tenho aqui?", "Resumo das tarefas da equipe dos últimos 7 dias"],
  "/admin/responsibilities": ["O que tenho aqui?", "Mostre as responsabilidades da equipe", "Quais responsabilidades estão sem responsável?", "Quais são minhas responsabilidades?"],
  "/admin/responsabilidades-delegacoes": ["O que tenho aqui?", "Mostre as responsabilidades da equipe", "Quais responsabilidades estão sem responsável?", "Quais são minhas responsabilidades?"],
  "/admin/activities": ["O que tenho aqui?", "Quais atividades recorrentes temos?"],
  "/supervisor/tasks": ["O que tenho aqui?", "Mostra as tarefas pendentes da equipe"],
  "/admin/folgas": ["O que tenho aqui?", "Quem está de folga hoje?"],
  "/supervisor/folgas": ["O que tenho aqui?", "Quem está de folga hoje?"],
  "/admin/deliveries": ["O que tenho aqui?", "Entregas da equipe"],
  "/supervisor/deliveries": ["O que tenho aqui?", "Entregas da equipe"],
  "/admin/avisos": ["O que tenho aqui?", "Mostra o Mural"],
  "/supervisor/avisos": ["O que tenho aqui?", "Mostra o Mural"],
  "/admin/messages": ["O que tenho aqui?", "Minhas mensagens não lidas"],
  "/supervisor/messages": ["O que tenho aqui?", "Minhas mensagens não lidas"],
  "/admin/locations": ["O que tenho aqui?", "Mostrar locais"],
  "/admin/users": ["O que tenho aqui?", "Buscar pessoas por ‘Ana’"],
  "/supervisor/equipe": ["O que tenho aqui?", "Buscar pessoas por ‘Ana’"],
  "/supervisor/check-ins": ["O que tenho aqui?", "Mostra os check-ins da equipe hoje"],
  "/admin/daily-book": ["O que tenho aqui?", "Mostra o Livro do Dia de hoje"],
  "/admin/show-book": ["O que tenho aqui?", "Quais Livros do Show estão disponíveis?"],
  "/supervisor/daily-book": ["O que tenho aqui?", "Mostra o Livro do Dia de hoje"],
  "/membro/livro-do-dia": ["O que tenho aqui?", "Mostra o Livro do Dia de hoje"],
};
const pageNames: Record<string, string> = {
  "/admin/home": "Painel", "/admin/search": "Busca", "/print/day": "Impressão do Dia",
  "/admin/formations": "Formações", "/admin/locations": "Locais", "/admin/users": "Pessoas",
  "/admin/operations": "Operações", "/admin/groups": "Grupos", "/admin/show-book": "Livro do Show",
  "/admin/auditoria": "Auditoria", "/admin/scales": "Escalas", "/admin/activities": "Atividades",
  "/admin/operational-panel": "Painel Operacional", "/supervisor/operational-panel": "Painel Operacional",
  "/admin/avisos": "Avisos", "/supervisor/avisos": "Avisos",
  "/admin/history": "Histórico", "/supervisor/history": "Histórico",
  "/admin/messages": "Mensagens", "/supervisor/messages": "Mensagens",
  "/admin/deliveries": "Entregas", "/supervisor/deliveries": "Entregas",
  "/admin/requests": "Solicitações", "/supervisor/requests": "Solicitações",
  "/supervisor/delegations": "Delegações", "/supervisor/equipe": "Equipe", "/supervisor/grupos": "Grupos",
  "/supervisor/restrictions": "Restrições", "/supervisor/supervisor-requests": "Solicitações de Supervisão",
  "/admin/responsibilities": "Responsabilidades", "/admin/asa": "ASA", "/admin/mural": "Mural",
  "/admin/folgas": "Folgas da equipe", "/supervisor/folgas": "Folgas da equipe",
  "/admin/folgas-indisponibilidades": "Folgas e indisponibilidades",
  "/admin/responsabilidades-delegacoes": "Responsabilidades e delegações",
  "/meu-dia": "Meu Dia", "/escalas": "Escalas", "/livro-do-dia": "Livro do Dia", "/shows": "Shows",
  "/check-in": "Check-in", "/folgas": "Folgas", "/agenda": "Agenda", "/pessoas": "Pessoas",
  "/areas": "Áreas", "/locais": "Locais", "/responsabilidades": "Responsabilidades e tarefas",
  "/mural": "Mural", "/mensagens": "Mensagens", "/biblioteca": "Biblioteca", "/painel": "Painel",
  "/notificacoes": "Notificações", "/membro/tarefas": "Minhas tarefas", "/membro/entregas": "Minhas entregas", "/membro/avisos": "Meus avisos", "/membro/solicitacoes": "Minhas solicitações",
  "/membro/biblioteca": "Biblioteca", "/admin/library": "Biblioteca", "/supervisor/library": "Biblioteca",
  "/membro/folgas": "Minhas folgas", "/membro/escala": "Minha escala",
  "/membro/mensagens": "Mensagens",
  "/admin/meu-dia": "Meu Dia", "/admin/agenda": "Agenda", "/admin/insights": "Indicadores",
  "/admin/tasks": "Tarefas da equipe", "/supervisor/tasks": "Tarefas da equipe",
  "/supervisor/insights": "Indicadores",
  "/admin/daily-book": "Livro do Dia", "/supervisor/daily-book": "Livro do Dia", "/membro/livro-do-dia": "Livro do Dia",
  "/supervisor/check-ins": "Check-ins da equipe",
};

function token(): string {
  return localStorage.getItem("myasa_access_token") ?? "";
}

function fallbackToPng(event: { currentTarget: HTMLImageElement }, pngPath: string) {
  if (event.currentTarget.src.endsWith(".webp")) event.currentTarget.src = pngPath;
}

export default function GlobalAsaAssistant() {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [operations, setOperations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [sending, setSending] = useState(false);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [undoBusyId, setUndoBusyId] = useState<string | null>(null);
  const [undoNow, setUndoNow] = useState(Date.now());
  const [asaMode, setAsaMode] = useState<AsaSuggestionMode>("BALANCED");
  const [suggestionFrequency, setSuggestionFrequency] = useState<AsaSuggestionFrequency>("DAILY");
  const [proactivityLevel, setProactivityLevel] = useState<AsaProactivityLevel>("MEDIUM");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [visibleSuggestions, setVisibleSuggestions] = useState<AsaSuggestionChip[]>([]);
  const [error, setError] = useState("");
  const [presenceState, setPresenceState] = useState(() => getAsaPresenceState());
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = user?.id ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceState(getAsaPresenceState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentPage = pageNames[location] ?? "MyASA";
  const currentSuggestions = pageSuggestions[location] ?? suggestions;

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setConversationId(null);
      setMessages([]);
      setOperations([]);
      setSelectedOperationId("");
      setInput("");
      setSending(false);
      setLoadingContext(false);
      setError("");
      setPreferencesLoaded(false);
      setVisibleSuggestions([]);
      return;
    }

    let cancelled = false;
    const storageKey = `myasa_asa_${user.id}`;
    setPreferencesLoaded(false);
    setPreferencesOpen(false);
    setVisibleSuggestions([]);
    setLoadingContext(true);
    setError("");

    async function restore() {
      try {
        const contextResponse = await fetch("/api/asa/context", { headers: { Authorization: `Bearer ${token()}` } });
        if (!contextResponse.ok) throw new Error("Não consegui carregar seu contexto da ASA.");
        const context = await contextResponse.json() as { operations: Array<{ id: string; name: string }> };
        if (cancelled) return;

        const preferencesResponse = await fetch("/api/asa/preferences", { headers: { Authorization: `Bearer ${token()}` } });
        if (cancelled) return;
        if (preferencesResponse.ok) {
          const preferences = await preferencesResponse.json() as { mode?: AsaSuggestionMode; messageFrequency?: AsaSuggestionFrequency; proactivityLevel?: AsaProactivityLevel };
          setAsaMode(preferences.mode ?? "BALANCED");
          setSuggestionFrequency(preferences.messageFrequency ?? "DAILY");
          setProactivityLevel(preferences.proactivityLevel ?? "MEDIUM");
        }
        setPreferencesLoaded(true);

        const available = Array.isArray(context.operations) ? context.operations : [];
        setOperations(available);
        const savedOperation = localStorage.getItem(`${storageKey}_operation`);
        const operationId = available.some((operation) => operation.id === savedOperation)
          ? savedOperation!
          : available.length === 1 ? available[0]!.id : "";
        setSelectedOperationId(operationId);
        if (operationId) localStorage.setItem(`${storageKey}_operation`, operationId);
        else localStorage.removeItem(`${storageKey}_operation`);

        const savedConversation = Number(localStorage.getItem(`${storageKey}_conversation`));
        if (!Number.isInteger(savedConversation) || savedConversation <= 0) {
          setConversationId(null);
          setMessages([]);
          return;
        }

        const historyResponse = await fetch(`/api/asa/conversations/${savedConversation}/messages`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (cancelled) return;
        if (!historyResponse.ok) {
          localStorage.removeItem(`${storageKey}_conversation`);
          setConversationId(null);
          setMessages([]);
          return;
        }
        const history = await historyResponse.json() as { messages: Array<{ id: number; role: string; content: string; proposal?: AsaProposal }> };
        setConversationId(savedConversation);
        setMessages((history.messages ?? []).filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ id: String(message.id), role: message.role as "user" | "assistant", content: message.content, proposal: message.proposal })));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Não consegui restaurar a conversa.");
      } finally {
        if (!cancelled) {
          setPreferencesLoaded(true);
          setLoadingContext(false);
        }
      }
    }

    void restore();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!open || !isAuthenticated || !user?.id || !preferencesLoaded || loadingContext || messages.length > 0) {
      setVisibleSuggestions([]);
      return;
    }
    const userId = user.id;
    let cancelled = false;
    async function loadSuggestions() {
      const key = `myasa_asa_${userId}_suggestions_shown`;
      const previous = Number(localStorage.getItem(key));
      const lastShownAt = Number.isFinite(previous) && previous > 0 ? previous : null;
      const now = Date.now();
      const eligible = selectAsaSuggestions(currentSuggestions, asaMode, suggestionFrequency, proactivityLevel, lastShownAt, now);
      if (!eligible.length) {
        setVisibleSuggestions([]);
        return;
      }

      let proactive: AsaSuggestionChip[] = [];
      if (asaMode === "PROACTIVE") {
        try {
          const response = await fetch("/api/asa/proactive-suggestions", { headers: { Authorization: `Bearer ${token()}` } });
          if (response.ok) {
            const counts = await response.json() as { overdueCount?: number; dueTodayCount?: number; dueSoonCount?: number };
            if (cancelled) return;
            if (counts.overdueCount && counts.overdueCount > 0) {
              const taskLabel = counts.overdueCount === 1 ? "tarefa vencida" : "tarefas vencidas";
              proactive.push({
                label: `Você tem ${counts.overdueCount} ${taskLabel}. Ver?`,
                prompt: "Mostra minhas tarefas vencidas",
              });
            }
            if (counts.dueTodayCount && counts.dueTodayCount > 0) {
              const taskLabel = counts.dueTodayCount === 1 ? "tarefa com prazo hoje" : "tarefas com prazo hoje";
              proactive.push({
                label: `Você tem ${counts.dueTodayCount} ${taskLabel}. Ver?`,
                prompt: "Quais são minhas tarefas para hoje?",
              });
            }
            if (counts.dueSoonCount && counts.dueSoonCount > 0) {
              const taskLabel = counts.dueSoonCount === 1 ? "tarefa com prazo nos próximos 3 dias" : "tarefas com prazo nos próximos 3 dias";
              proactive.push({
                label: `Você tem ${counts.dueSoonCount} ${taskLabel}. Ver?`,
                prompt: "Quais tarefas tenho com prazo nos próximos 3 dias?",
              });
            }
          }
        } catch {
          // Keep the ordinary suggestions available when the summary is offline.
        }
      }
      if (cancelled) return;
      const allSuggestions = [
        ...proactive,
        ...currentSuggestions.map((suggestion) => ({ label: suggestion, prompt: suggestion })),
      ];
      const selected = selectAsaSuggestions(allSuggestions, asaMode, suggestionFrequency, proactivityLevel, lastShownAt, now);
      setVisibleSuggestions(selected);
      if (selected.length > 0) localStorage.setItem(key, String(now));
    }
    void loadSuggestions();
    return () => { cancelled = true; };
  }, [asaMode, currentSuggestions, isAuthenticated, loadingContext, messages.length, open, preferencesLoaded, proactivityLevel, suggestionFrequency, user?.id]);

  async function updateAsaPreferences(patch: { mode?: AsaSuggestionMode; messageFrequency?: AsaSuggestionFrequency; proactivityLevel?: AsaProactivityLevel }) {
    if (!user?.id || preferenceBusy) return;
    setPreferenceBusy(true);
    try {
      const response = await fetch("/api/asa/preferences", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Não consegui salvar as preferências da ASA.");
      const saved = await response.json() as { mode?: AsaSuggestionMode; messageFrequency?: AsaSuggestionFrequency; proactivityLevel?: AsaProactivityLevel };
      if (saved.mode) setAsaMode(saved.mode);
      if (saved.messageFrequency) setSuggestionFrequency(saved.messageFrequency);
      if (saved.proactivityLevel) setProactivityLevel(saved.proactivityLevel);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui salvar as preferências da ASA.");
    } finally {
      setPreferenceBusy(false);
    }
  }

  useEffect(() => {
    if (location !== "/asa") return;
    const question = new URLSearchParams(window.location.search).get("question");
    if (question) setInput(question);
    setOpen(true);
  }, [location]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    const nextExpiry = messages
      .filter((message) => message.undo && !message.undoState)
      .map((message) => Date.parse(message.undo!.expiresAt))
      .filter((expiresAt) => expiresAt > undoNow)
      .sort((a, b) => a - b)[0];
    if (!nextExpiry) return;
    const timer = window.setTimeout(() => setUndoNow(Date.now()), Math.max(0, nextExpiry - Date.now() + 25));
    return () => window.clearTimeout(timer);
  }, [messages, undoNow]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function ensureConversation(): Promise<number> {
    if (conversationId) return conversationId;
    const response = await fetch("/api/asa/conversations", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: `ASA · ${currentPage}` }),
    });
    if (!response.ok) throw new Error("Não consegui iniciar a conversa. Entre novamente e tente outra vez.");
    const data = await response.json() as { id: number };
    if (user?.id) localStorage.setItem(`myasa_asa_${user.id}_conversation`, String(data.id));
    if (currentUserIdRef.current === user?.id) setConversationId(data.id);
    return data.id;
  }

  async function sendMessage(value: string) {
    const question = value.trim();
    const senderId = user?.id;
    if (!question || sending || !isAuthenticated || !senderId) return;
    const isCurrentSession = () => currentUserIdRef.current === senderId;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", pending: true };
    setMessages((current) => isCurrentSession() ? [...current, userMessage, assistantMessage] : current);
    setInput("");
    setSending(true);
    setError("");

    try {
      const id = await ensureConversation();
      if (!isCurrentSession()) return;
      const response = await fetch(`/api/asa/chat/${id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: question, context: { page: location, operationId: selectedOperationId || undefined } }),
      });
      if (!response.ok || !response.body) throw new Error("Não consegui consultar agora. Tente novamente.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as { content?: string; error?: string; proposal?: AsaProposal; undo?: AsaUndo };
          if (event.proposal) {
            setMessages((current) => !isCurrentSession() ? current : current.map((message) => message.id === assistantMessage.id
              ? { ...message, proposal: event.proposal }
              : message));
          }
          if (event.undo) {
            setMessages((current) => !isCurrentSession() ? current : current.map((message) => message.id === assistantMessage.id
              ? { ...message, undo: event.undo, undoState: undefined, undoError: undefined }
              : message));
          }
          if (event.content) {
            setMessages((current) => !isCurrentSession() ? current : current.map((message) => message.id === assistantMessage.id
              ? { ...message, content: message.content + event.content, pending: false }
              : message));
          }
          if (event.error) throw new Error(event.error);
        }
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não consegui consultar agora.";
      setMessages((current) => !isCurrentSession() ? current : current.map((item) => item.id === assistantMessage.id
        ? { ...item, content: item.content || "Tive um problema ao consultar. Seus dados continuam intactos.", pending: false }
        : item));
      if (isCurrentSession()) setError(message);
    } finally {
      if (isCurrentSession()) {
        setSending(false);
        inputRef.current?.focus();
      }
    }
  }

  async function resolveProposal(proposal: AsaProposal, action: "confirm" | "cancel", messageId: string) {
    if (proposalBusyId) return;
    setProposalBusyId(proposal.id);
    setError("");
    try {
      const response = await fetch(`/api/asa/actions/${proposal.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Não consegui atualizar a proposta.");
      setMessages((current) => current.map((message) => message.id === messageId && message.proposal
        ? { ...message, proposal: { ...message.proposal, state: action === "confirm" ? "CONFIRMED" : "CANCELLED" }, content: `${message.content}\n\n${result.message ?? "Concluído."}` }
        : message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui atualizar a proposta.");
    } finally {
      setProposalBusyId(null);
    }
  }

  async function undoAsaAction(undo: AsaUndo, messageId: string) {
    if (undoBusyId) return;
    setUndoBusyId(undo.id);
    try {
      const response = await fetch(`/api/actions/${undo.id}/undo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não consegui desfazer essa alteração.");
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, undoState: "UNDONE", undoError: undefined }
        : message));
    } catch (cause) {
      const undoError = cause instanceof Error ? cause.message : "Não consegui desfazer essa alteração.";
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, undoError } : message));
    } finally {
      setUndoBusyId(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  return <>
    {open && <section className="global-asa-panel" role="dialog" aria-label="Conversa com a ASA" aria-modal="false">
      <header className="global-asa-header">
        <img src={sending ? "/asa/consultando.webp" : "/asa/oi.webp"} onError={(event) => fallbackToPng(event, sending ? "/asa/consultando.png" : "/asa/oi.png")} alt="" />
        <div><strong>ASA</strong><span>{currentPage}</span></div>
        {operations.length > 1 && <select className="global-asa-operation" aria-label="Operação da ASA" value={selectedOperationId} disabled={loadingContext || sending} onChange={(event) => {
          const value = event.target.value;
          setSelectedOperationId(value);
          if (user?.id) {
            const key = `myasa_asa_${user.id}_operation`;
            if (value) localStorage.setItem(key, value);
            else localStorage.removeItem(key);
          }
        }}>
          <option value="">Escolha operação</option>
          {operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}
        </select>}
        <div className="global-asa-actions" style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto", flex: "0 0 auto" }}>
          <button type="button" className="global-asa-icon" style={{ marginLeft: 0 }} aria-label="Perguntar o que a ASA pode fazer" title="O que posso pedir?" disabled={!isAuthenticated || sending} onClick={() => void sendMessage("O que você consegue fazer?")}><CircleHelp size={17} /></button>
          {isAuthenticated && <button type="button" className="global-asa-icon" style={{ marginLeft: 0 }} aria-label="Preferências da ASA" title="Preferências" aria-expanded={preferencesOpen} onClick={() => setPreferencesOpen((value) => !value)}><SlidersHorizontal size={17} /></button>}
          <button type="button" className="global-asa-icon" style={{ marginLeft: 0 }} aria-label="Fechar ASA" title="Fechar" onClick={() => setOpen(false)}><X size={19} /></button>
        </div>
      </header>
      {preferencesOpen && isAuthenticated && <div className="global-asa-preferences" role="group" aria-label="Preferências da ASA">
        <div className="global-asa-mode-group" role="group" aria-label="Modo das sugestões"><span>Sugestões</span><div>
          {[{ value: "SILENT" as const, label: "Pausadas" }, { value: "BALANCED" as const, label: "Pontuais" }, { value: "PROACTIVE" as const, label: "Proativas" }].map((option) => <button key={option.value} type="button" aria-pressed={asaMode === option.value} disabled={preferenceBusy || !preferencesLoaded} onClick={() => void updateAsaPreferences({ mode: option.value })}>{option.label}</button>)}
        </div></div>
        <label>Frequência<select aria-label="Frequência das sugestões" value={suggestionFrequency} disabled={preferenceBusy || !preferencesLoaded} onChange={(event) => void updateAsaPreferences({ messageFrequency: event.target.value as AsaSuggestionFrequency })}>
          <option value="REALTIME">Em tempo real</option><option value="DAILY">Diária</option><option value="WEEKLY">Semanal</option>
        </select></label>
        <label>Nível<select aria-label="Nível de proatividade" value={proactivityLevel} disabled={preferenceBusy || !preferencesLoaded} onChange={(event) => void updateAsaPreferences({ proactivityLevel: event.target.value as AsaProactivityLevel })}>
          <option value="LOW">Baixo</option><option value="MEDIUM">Médio</option><option value="HIGH">Alto</option>
        </select></label>
      </div>}
      <div className="global-asa-feed" ref={feedRef} aria-live="polite">
        {messages.length === 0 && <div className="global-asa-welcome">
          <img src="/asa/oi.webp" onError={(event) => fallbackToPng(event, "/asa/oi.png")} alt="" />
          <p>Oi! Estou com você em {currentPage}.</p>
          {isAuthenticated
            ? visibleSuggestions.length > 0 && <div className="global-asa-suggestions">{visibleSuggestions.map((suggestion) => <button type="button" key={`${suggestion.label}-${suggestion.prompt}`} onClick={() => void sendMessage(suggestion.prompt)}>{suggestion.label}</button>)}</div>
            : <p className="global-asa-auth-note">Entre na sua conta para eu consultar os dados do MyASA. <a href="/login">Entrar</a></p>}
        </div>}
        {messages.map((message) => <article className={`global-asa-message ${message.role}`} key={message.id}>
          {message.role === "assistant" && <img src={message.pending ? "/asa/consultando.webp" : "/asa/oi.webp"} onError={(event) => fallbackToPng(event, message.pending ? "/asa/consultando.png" : "/asa/oi.png")} alt="" />}
          <div className="global-asa-message-body">
            <p>{message.content ? message.content.split(/(\/admin\/search\?document=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi).map((part, index) => {
              const documentId = part.match(/^\/admin\/search\?document=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
              return documentId ? <a key={`${documentId}-${index}`} href={`/biblioteca?document=${documentId}`} onClick={(event) => { event.preventDefault(); setLocation(`/biblioteca?document=${documentId}`); }}>Abrir documento</a> : part;
            }) : message.pending ? "Vou conferir…" : ""}</p>
            {message.proposal && (message.proposal.actionType === "MESSAGE_DIRECT_CREATE" || message.proposal.actionType === "MESSAGE_REPLY") && <div className="global-asa-proposal">
              <strong>{message.proposal.actionType === "MESSAGE_REPLY" ? `Resposta para ${(message.proposal.recipientNames ?? []).join(", ")}` : `Mensagem para ${message.proposal.recipientName}`}</strong>
              <span>{message.proposal.actionType === "MESSAGE_REPLY" ? `Conversa: ${message.proposal.title}` : `Assunto: ${message.proposal.title}`}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{message.proposal.content}</span>
              <span>Expira {new Date(message.proposal.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {message.proposal.state === "PENDING" && Date.parse(message.proposal.expiresAt) > Date.now()
                ? <div className="global-asa-proposal-actions">
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "confirm", message.id)}><Check size={15} />{proposalBusyId === message.proposal.id ? "Aguarde…" : message.proposal.actionType === "MESSAGE_REPLY" ? "Enviar resposta" : "Enviar mensagem"}</button>
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "cancel", message.id)}><X size={15} />Cancelar</button>
                  </div>
                : <span className="global-asa-proposal-state">{message.proposal.state === "CONFIRMED" ? message.proposal.actionType === "MESSAGE_REPLY" ? "Resposta enviada" : "Mensagem enviada" : message.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</span>}
            </div>}
            {message.proposal?.actionType === "ASA_PREFERENCE_UPDATE" && <div className="global-asa-proposal">
              <strong>Preferências pessoais da ASA</strong>
              <span style={{ whiteSpace: "pre-wrap" }}>{message.proposal.changes?.map((change) => `${change.label}: ${change.before} → ${change.after}`).join("\n") ?? `Sugestões: ${message.proposal.previousMode === "SILENT" ? "Pausadas" : message.proposal.previousMode === "PROACTIVE" ? "Proativas" : "Equilibradas"} → ${message.proposal.mode === "SILENT" ? "Pausadas" : message.proposal.mode === "PROACTIVE" ? "Proativas" : "Equilibradas"}`}</span>
              <span>Expira {new Date(message.proposal.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              {message.proposal.state === "PENDING" && Date.parse(message.proposal.expiresAt) > Date.now()
                ? <div className="global-asa-proposal-actions">
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "confirm", message.id)}><Check size={15} />{proposalBusyId === message.proposal.id ? "Aguarde…" : "Atualizar preferências"}</button>
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "cancel", message.id)}><X size={15} />Cancelar</button>
                  </div>
                : <span className="global-asa-proposal-state">{message.proposal.state === "CONFIRMED" ? "Preferências atualizadas" : message.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</span>}
            </div>}
            {message.proposal?.actionType === "MURAL_REACT" && <div className="global-asa-proposal">
              <strong>Reação no Mural</strong>
              <span>Publicação: {message.proposal.title}</span>
              <span>Reação: {message.proposal.reaction} (coração){message.proposal.previousReaction ? ` · substitui ${message.proposal.previousReaction}` : ""}</span>
              <span>Expira {new Date(message.proposal.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              {message.proposal.state === "PENDING" && Date.parse(message.proposal.expiresAt) > Date.now()
                ? <div className="global-asa-proposal-actions">
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "confirm", message.id)}><Check size={15} />{proposalBusyId === message.proposal.id ? "Aguarde…" : "Reagir"}</button>
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "cancel", message.id)}><X size={15} />Cancelar</button>
                  </div>
                : <span className="global-asa-proposal-state">{message.proposal.state === "CONFIRMED" ? "Reação registrada" : message.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</span>}
            </div>}
            {message.proposal?.actionType === "MURAL_COMMENT_CREATE" && <div className="global-asa-proposal">
              <strong>Comentário no Mural</strong>
              <span>Publicação: {message.proposal.title}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>Comentário: {message.proposal.content}</span>
              <span>Expira {new Date(message.proposal.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              {message.proposal.state === "PENDING" && Date.parse(message.proposal.expiresAt) > Date.now()
                ? <div className="global-asa-proposal-actions">
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "confirm", message.id)}><Check size={15} />{proposalBusyId === message.proposal.id ? "Aguarde…" : "Publicar comentário"}</button>
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "cancel", message.id)}><X size={15} />Cancelar</button>
                  </div>
                : <span className="global-asa-proposal-state">{message.proposal.state === "CONFIRMED" ? "Comentário publicado" : message.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</span>}
            </div>}
            {message.proposal && message.proposal.actionType !== "MESSAGE_DIRECT_CREATE" && message.proposal.actionType !== "MESSAGE_REPLY" && message.proposal.actionType !== "MURAL_REACT" && message.proposal.actionType !== "MURAL_COMMENT_CREATE" && <div className="global-asa-proposal">
              <strong>{proposalTitle(message.proposal.actionType, message.proposal.operationName)}</strong>
              {message.proposal.actionType === "TASK_COMMENT_CREATE"
                ? <><span>{message.proposal.title}</span><span>Comentário:</span><span style={{ whiteSpace: "pre-wrap" }}>{message.proposal.content}</span><span>Só será publicado após confirmar.</span></>
                : message.proposal.actionType === "TASK_CHECKLIST_UPDATE"
                ? <><span>Tarefa: {message.proposal.title}</span><span>Checklist {message.proposal.checklistKind === "mandatory" ? "obrigatória" : "operacional"} · {message.proposal.checklistItemLabel}</span><span>{message.proposal.previousChecklistCompleted ? "Concluído" : "Pendente"} → {message.proposal.checklistCompleted ? "Concluído" : "Pendente"}</span><span>Só a pessoa responsável pode atualizar este item.</span></>
                : message.proposal.actionType === "TASK_EVIDENCE_LINK_ADD"
                ? <><span>Tarefa: {message.proposal.title}</span><span>Link complementar: {message.proposal.evidenceDescription}</span><span style={{ overflowWrap: "anywhere" }}>{message.proposal.evidenceUrl}</span><span>Não contará como evidência obrigatória. Só será anexado após confirmar.</span></>
                : message.proposal.actionType === "TASK_CANCEL"
                ? <><span>{message.proposal.title} · {message.proposal.assigneeName} · Estado atual: {message.proposal.previousStatus}</span><span>O motivo informado está na prévia acima. A tarefa só será cancelada após a confirmação.</span></>
                : message.proposal.actionType === "MURAL_ACK"
                ? <span>Aviso: {message.proposal.title}</span>
                : message.proposal.actionType === "NOTICE_DRAFT_UPDATE"
                ? <><span>Título: {message.proposal.previousTitle} → {message.proposal.newTitle}</span><span>Texto atual: {message.proposal.previousContent}</span><span>Novo texto: {message.proposal.content}</span><span>Permanece como rascunho; não será publicado.</span></>
                : message.proposal.actionType === "AGENDA_DRAFT_RENAME"
                ? <><span>{message.proposal.previousTitle} → {message.proposal.newTitle}</span><span>{message.proposal.date ? new Date(`${message.proposal.date}T12:00:00`).toLocaleDateString("pt-BR") : "data"} · {message.proposal.startTime}–{message.proposal.endTime}</span><span>Somente o título será alterado; o evento continuará como rascunho.</span></>
                : message.proposal.actionType === "AGENDA_DRAFT_SCHEDULE_UPDATE"
                ? <><span>{message.proposal.title}</span><span>Data: {message.proposal.previousDate ? new Date(`${message.proposal.previousDate}T12:00:00`).toLocaleDateString("pt-BR") : "data não definida"} → {message.proposal.date ? new Date(`${message.proposal.date}T12:00:00`).toLocaleDateString("pt-BR") : "data"}</span><span>Horário: {message.proposal.previousStartTime ?? "—"}–{message.proposal.previousEndTime ?? "—"} → {message.proposal.startTime}–{message.proposal.endTime}</span><span>O evento continua como rascunho; não será confirmado nem publicado.</span></>
                : message.proposal.actionType === "AGENDA_DRAFT_NOTES_UPDATE"
                ? <><span>{message.proposal.title}</span><span>Observações atuais: {message.proposal.previousNotes || "nenhuma"}</span><span>Novas observações: {message.proposal.notes ?? "nenhuma (serão removidas)"}</span><span>Somente as observações serão alteradas; continua como rascunho.</span></>
                : message.proposal.actionType === "AGENDA_MEETING_CREATE"
                ? <span>{message.proposal.title} · {message.proposal.date ? new Date(`${message.proposal.date}T12:00:00`).toLocaleDateString("pt-BR") : "data"} · {message.proposal.startTime}–{message.proposal.endTime} · {message.proposal.expectedStatus === "PROPOSED" ? "Proposta para análise" : "Rascunho não publicado"}</span>
                : message.proposal.actionType === "TASK_CREATE"
                ? <span>{message.proposal.assigneeName} · prazo {message.proposal.dueDate ? new Date(`${message.proposal.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "não informado"} · prioridade {taskPriorityLabel(message.proposal.priority)}{message.proposal.checklistLabels?.length ? ` · checklist: ${message.proposal.checklistLabels.join("; ")}` : ""}{message.proposal.mandatoryEvidences?.length ? ` · evidências: ${message.proposal.mandatoryEvidences.map((item) => `${item.type}: ${item.description}`).join("; ")}` : ""}</span>
                : message.proposal.actionType === "TASK_UPDATE_DUE_DATE"
                ? <span>{message.proposal.title} · {message.proposal.previousDueDate ? new Date(`${message.proposal.previousDueDate}T12:00:00`).toLocaleDateString("pt-BR") : "prazo atual indisponível"} → {message.proposal.dueDate ? new Date(`${message.proposal.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "novo prazo indisponível"}</span>
                : message.proposal.actionType === "TASK_UPDATE_ASSIGNEE"
                ? <span>{message.proposal.title} · {message.proposal.previousAssigneeName ?? "responsável atual"} → {message.proposal.assigneeName ?? "novo responsável"}</span>
                : message.proposal.actionType === "TASK_UPDATE_PRIORITY"
                ? <span>{message.proposal.title} · {taskPriorityLabel(message.proposal.previousPriority)} → {taskPriorityLabel(message.proposal.priority)}</span>
                : message.proposal.actionType === "TASK_UPDATE_DESCRIPTION"
                ? <span>{message.proposal.title} · {(message.proposal.previousDescription || "sem descrição").slice(0, 120)} → {(message.proposal.description || "").slice(0, 120)}</span>
                : message.proposal.actionType === "TASK_UPDATE_TITLE"
                ? <span>{message.proposal.previousTitle ?? message.proposal.title} → {message.proposal.newTitle}</span>
                : message.proposal.actionType === "TASK_UPDATE_REQUIREMENTS"
                ? <span>{message.proposal.title} · checklist: {message.proposal.checklistLabels?.join("; ") || "nenhuma"} · evidências: {message.proposal.mandatoryEvidences?.map((item) => `${item.type}: ${item.description}`).join("; ") || "nenhuma"}</span>
                : message.proposal.actionType === "TASK_UPDATE_RESPONSIBILITY"
                ? <span>{message.proposal.title} · {message.proposal.previousResponsibilityTitle ?? "sem responsabilidade"} → {message.proposal.newResponsibilityTitle ?? "sem responsabilidade"}</span>
                : message.proposal.actionType === "TASK_START"
                ? <span>{message.proposal.title} · {message.proposal.assigneeName} · {message.proposal.previousStatus === "CHANGES_REQUESTED" ? "Ajustes solicitados" : "Pendente"} → Em andamento</span>
                : message.proposal.actionType === "TASK_READY_FOR_APPROVAL"
                ? <span>{message.proposal.title} · Em andamento → Aguardando aprovação</span>
                : message.proposal.actionType === "TASK_COMPLETE"
                ? <span>{message.proposal.title} · Em andamento → Concluída</span>
                : <span>{message.proposal.recipientCount ?? 0} destinatário(s)</span>}
              {message.proposal.actionType === "TASK_CREATE" && message.proposal.responsibilityTitle && <span>Responsabilidade: {message.proposal.responsibilityTitle}</span>}
              <span>Expira {new Date(message.proposal.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {message.proposal.state === "PENDING" && Date.parse(message.proposal.expiresAt) > Date.now()
                ? <div className="global-asa-proposal-actions">
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "confirm", message.id)}><Check size={15} />{proposalBusyId === message.proposal.id ? "Aguarde…" : proposalConfirmLabel(message.proposal.actionType)}</button>
                    <button type="button" disabled={proposalBusyId !== null} onClick={() => void resolveProposal(message.proposal!, "cancel", message.id)}><X size={15} />Cancelar</button>
                  </div>
                : <span className="global-asa-proposal-state">{proposalStateLabel(message.proposal.actionType, message.proposal.state, message.proposal.expectedStatus)}</span>}
            </div>}
            {message.undo && <div className="global-asa-undo" role="group" aria-label="Desfazer remoção de integrante">
              {message.undoState === "UNDONE"
                ? <span>Remoção desfeita</span>
                : Date.parse(message.undo.expiresAt) > undoNow
                ? <button type="button" title="Desfazer remoção" disabled={undoBusyId !== null} onClick={() => void undoAsaAction(message.undo!, message.id)}>
                    <Undo2 size={14} />{undoBusyId === message.undo.id ? "Desfazendo…" : `Desfazer · ${Math.ceil((Date.parse(message.undo.expiresAt) - undoNow) / 1000)} s`}
                  </button>
                : <span>Janela para desfazer encerrada</span>}
              {message.undoError && <span role="alert">{message.undoError}</span>}
            </div>}
          </div>
        </article>)}
        {error && <p className="global-asa-error" role="status">{error}</p>}
      </div>
      <form className="global-asa-composer" onSubmit={submit}>
        <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown} disabled={!isAuthenticated || sending} aria-label="Mensagem para ASA" placeholder={isAuthenticated ? "Escreva para a ASA…" : "Entre para conversar"} />
        <button type="submit" disabled={!isAuthenticated || sending || !input.trim()} aria-label="Enviar mensagem" title="Enviar"><ArrowUp size={18} /></button>
      </form>
    </section>}
    <button type="button" className={`global-asa-launcher${open ? " active" : ""}`} onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar conversa com ASA" : "Conversar com ASA"} aria-expanded={open} title="Conversar com ASA">
      <img src={`/asa/${presenceState === "bomdia" ? "bom-dia" : presenceState === "boanoite" ? "sonolenta" : "oi"}.webp`} onError={(event) => fallbackToPng(event, `/asa/${presenceState === "bomdia" ? "bom-dia" : presenceState === "boanoite" ? "sonolenta" : "oi"}.png`)} alt="" />
      <span>ASA</span>
    </button>
  </>;
}
