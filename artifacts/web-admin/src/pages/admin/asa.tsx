import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User2, Loader2, Plus, RefreshCw, Check, X, Brain, Pencil, Trash2, Power, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { announceActionUndo, customFetch } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  streaming?: boolean;
  proposal?: AsaProposal;
}

interface AsaProposal {
  id: string;
  actionType: string;
  title: string;
  content?: string;
  operationName: string;
  recipientCount?: number;
  assigneeName?: string;
  dueDate?: string;
  previousDueDate?: string;
  priority?: string;
  expiresAt: string;
  state: string;
}

interface AsaMemory {
  id: string;
  type: string;
  key: string;
  value: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
  createdAt: string;
}

function taskPriorityLabel(priority?: string) {
  return ({ LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" } as Record<string, string>)[priority ?? "MEDIUM"] ?? "média";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  return localStorage.getItem("myasa_access_token") ?? "";
}

function getApiBase(): string {
  return "";
}

const TOOL_LABELS: Record<string, string> = {
  consultar_agenda:            "📅 Consultando agenda",
  consultar_meu_checkin:       "✅ Consultando seu check-in",
  consultar_checkins_equipe:   "✅ Consultando check-ins da equipe",
  consultar_escalas:           "📋 Consultando escalas",
  consultar_responsabilidades: "👥 Consultando responsabilidades",
  consultar_notificacoes:      "🔔 Consultando notificações",
  consultar_avisos:            "📢 Consultando avisos",
  consultar_tarefas:           "✅ Consultando tarefas",
  consultar_memorias:          "🧠 Consultando memórias",
  criar_aviso_rascunho:        "✏️ Criando rascunho de aviso",
  criar_ensaio_rascunho:       "🎭 Criando rascunho de ensaio",
  sugerir_memoria:             "💡 Sugerindo memória",
  registrar_ausencia:          "📋 Registrando ausência",
  criar_solicitacao_troca:     "🔄 Criando solicitação de troca",
  consultar_riscos_operacionais: "⚠️ Analisando riscos",
  consultar_posicoes_abertas:  "🔍 Verificando posições abertas",
  consultar_tarefas_criticas:  "📌 Verificando tarefas críticas",
  consultar_conflitos:         "⚡ Verificando conflitos",
  sugerir_cobertura:           "💡 Sugerindo cobertura",
  consultar_carga_operacional: "📊 Analisando carga operacional",
  detectar_conquistas:            "🏆 Detectando conquistas",
  consultar_marcos:               "⭐ Consultando marcos futuros",
  criar_reconhecimento_automatico:"🎖️ Criando reconhecimento automático",
  consultar_historico_membro:     "📋 Consultando histórico do membro",
  analisar_conversa:              "💬 Analisando conversa",
  detectar_eventos:               "📅 Detectando eventos",
  detectar_tarefas:               "📌 Detectando tarefas",
  detectar_ausencias:             "🌴 Detectando ausências",
  detectar_trocas:                "🔄 Detectando trocas",
  resumir_conversa:               "📋 Resumindo conversa",
  destacar_itens:                 "⚠️ Destacando itens importantes",
  consultar_estatisticas:         "📈 Consultando estatísticas",
  consultar_indicadores:          "📊 Consultando indicadores",
  consultar_desempenho:           "🏅 Analisando desempenho",
  consultar_ausencias_historicas: "🌴 Analisando histórico de ausências",
  consultar_tarefas_historicas:   "📌 Analisando histórico de tarefas",
  consultar_carga_historica:      "📊 Analisando carga histórica",
  resumir_documento:              "📚 Resumindo documento",
  comparar_documentos:            "🔍 Comparando documentos",
  consultar_perguntas_frequentes: "❓ Consultando perguntas frequentes",
  consultar_documentos_populares: "📋 Consultando documentos da biblioteca",
  sugerir_leituras:               "💡 Buscando leituras relevantes",
  publicar_aviso:                 "📢 Publicando aviso",
  publicar_escala:                "📅 Publicando escala",
  criar_bloco_agenda:             "🟦 Criando bloco na agenda",
  consultar_leituras_biblioteca:  "📖 Verificando leituras da biblioteca",
  cancelar_ausencia:              "🌴 Cancelando ausência",
  cancelar_tarefa:                "📌 Cancelando tarefa",
  remover_entrada_escala:         "📅 Removendo entrada da escala",
  consultar_tendencias:           "📈 Analisando tendências",
  consultar_padroes:              "🔍 Identificando padrões",
  consultar_aprendizados:         "💡 Consultando aprendizados",
  consultar_riscos_recorrentes:   "⚠️ Identificando riscos recorrentes",
  gerar_relatorio_asa:            "📊 Gerando relatório",
};

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, busy, onResolve }: { msg: Message; busy: boolean; onResolve: (proposal: AsaProposal, action: "confirm" | "cancel") => void }) {
  const isUser = msg.role === "user";
  const contentParts = (msg.content || "").split(/(\/admin\/search\?document=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi);
  return (
    <div className={cn("flex gap-3 max-w-3xl", isUser ? "ml-auto flex-row-reverse" : "")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-primary/10" : "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
      )}>
        {isUser ? <User2 className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-primary" />}
      </div>
      <div className={cn(
        "rounded-2xl px-4 py-3 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed shadow-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-card border border-border rounded-tl-sm"
      )}>
        {msg.tools && msg.tools.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {msg.tools.map((t, i) => (
              <span key={i} className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                {TOOL_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        )}
        {msg.content ? contentParts.map((part, index) => {
          const documentId = part.match(/^\/admin\/search\?document=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
          return documentId
            ? <a key={`${documentId}-${index}`} href={`/biblioteca?document=${documentId}`} className="mt-1 inline-flex items-center gap-1.5 text-primary underline underline-offset-2"><BookOpen className="h-3.5 w-3.5" />Abrir documento</a>
            : <span key={index}>{part}</span>;
        }) : msg.streaming ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Pensando...
          </span>
        ) : ""}
        {msg.proposal && (
          <div className="mt-3 grid gap-2 rounded-md border border-border bg-background p-3">
            <strong className="text-xs">{msg.proposal.actionType === "MURAL_ACK" ? "Confirmação do Mural" : msg.proposal.actionType === "TASK_CREATE" ? `Tarefa · ${msg.proposal.operationName}` : msg.proposal.actionType === "TASK_UPDATE_DUE_DATE" ? `Alterar prazo · ${msg.proposal.operationName}` : `Rascunho · ${msg.proposal.operationName}`}</strong>
            <span className="text-xs text-muted-foreground">{msg.proposal.actionType === "MURAL_ACK"
              ? `Aviso: ${msg.proposal.title}`
              : msg.proposal.actionType === "TASK_CREATE"
              ? `${msg.proposal.title} · ${msg.proposal.assigneeName} · prazo ${msg.proposal.dueDate ? new Date(`${msg.proposal.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "não informado"} · prioridade ${taskPriorityLabel(msg.proposal.priority)}`
              : msg.proposal.actionType === "TASK_UPDATE_DUE_DATE"
              ? `${msg.proposal.title} · ${msg.proposal.previousDueDate ? new Date(`${msg.proposal.previousDueDate}T12:00:00`).toLocaleDateString("pt-BR") : "prazo atual indisponível"} → ${msg.proposal.dueDate ? new Date(`${msg.proposal.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "novo prazo indisponível"}`
              : `${msg.proposal.title} · ${msg.proposal.recipientCount ?? 0} destinatário(s)`}</span>
            {msg.proposal.state === "PENDING" && Date.parse(msg.proposal.expiresAt) > Date.now() ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => onResolve(msg.proposal!, "confirm")}><Check className="mr-1 h-4 w-4" />{msg.proposal.actionType === "MURAL_ACK" ? "Registrar ciente" : msg.proposal.actionType === "TASK_CREATE" ? "Criar tarefa" : msg.proposal.actionType === "TASK_UPDATE_DUE_DATE" ? "Atualizar prazo" : "Criar rascunho"}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve(msg.proposal!, "cancel")}><X className="mr-1 h-4 w-4" />Cancelar</Button>
              </div>
            ) : <span className="text-xs text-muted-foreground">{msg.proposal.state === "PENDING" ? "Prévia expirada" : msg.proposal.state === "CONFIRMED" ? msg.proposal.actionType === "MURAL_ACK" ? "Ciente registrado" : msg.proposal.actionType === "TASK_CREATE" ? "Tarefa criada; aprovação após a conclusão" : msg.proposal.actionType === "TASK_UPDATE_DUE_DATE" ? "Prazo atualizado" : "Rascunho criado, não publicado" : msg.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Proposta não está mais disponível"}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SUGGESTIONS_MANAGER = [
  "Quem está de folga hoje?",
  "Quais são minhas responsabilidades?",
  "Quais são minhas mensagens não lidas?",
  "Meus avisos",
  "Buscar na biblioteca regras de segurança",
];

const SUGGESTIONS_MEMBER = [
  "Qual é minha escala essa semana?",
  "Meus avisos",
  "Quais tarefas tenho pendentes?",
  "Quais são minhas mensagens não lidas?",
  "Quais são minhas folgas?",
];

export default function AsaPage() {
  const { roles: userRoles } = useAuth();
  const isManager = userRoles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => new URLSearchParams(window.location.search).get("question") ?? "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [view, setView] = useState<"conversation" | "memories">("conversation");
  const [memories, setMemories] = useState<AsaMemory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoryRefresh, setMemoryRefresh] = useState(0);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    createConversation();
  }, []);

  useEffect(() => {
    if (view !== "memories") return;
    let active = true;
    setMemoriesLoading(true);
    setMemoryError(null);
    customFetch<AsaMemory[]>("/api/asa/memories?type=PERSONAL")
      .then((data) => { if (active) setMemories(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setMemoryError("Não foi possível carregar seus atalhos."); })
      .finally(() => { if (active) setMemoriesLoading(false); });
    return () => { active = false; };
  }, [view, memoryRefresh]);

  async function createConversation() {
    try {
      const res = await fetch(`${getApiBase()}/api/asa/conversations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `Conversa ASA ${new Date().toLocaleString("pt-BR")}` }),
      });
      if (!res.ok) throw new Error("Falha ao criar conversa");
      const data = await res.json();
      setConversationId(data.id);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError("Não foi possível iniciar uma conversa com a ASA. Tente novamente.");
    }
  }

  async function sendMessage() {
    if (!input.trim() || streaming || !conversationId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      tools: [],
      streaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}/api/asa/chat/${conversationId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: userMsg.content }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));

            if (json.undo) {
              announceActionUndo(json.undo);
            } else if (json.proposal) {
              setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, proposal: json.proposal } : m));
            } else if (json.content) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + json.content, streaming: true }
                  : m
              ));
            } else if (json.tool) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id
                  ? { ...m, tools: [...(m.tools ?? []), json.tool] }
                  : m
              ));
            } else if (json.done) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, streaming: false } : m
              ));
            } else if (json.error) {
              throw new Error(json.error);
            }
          } catch {}
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, streaming: false } : m
      ));
    } catch (err) {
      setError(`Erro ao enviar mensagem: ${String(err)}`);
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
    } finally {
      setStreaming(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }

  async function resolveProposal(proposal: AsaProposal, action: "confirm" | "cancel") {
    if (proposalBusyId) return;
    setProposalBusyId(proposal.id);
    setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/asa/actions/${proposal.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não consegui atualizar a proposta.");
      setMessages(current => current.map(message => message.proposal?.id === proposal.id
        ? { ...message, proposal: { ...message.proposal, state: action === "confirm" ? "CONFIRMED" : "CANCELLED" }, content: `${message.content}\n\n${result.message ?? "Concluído."}` }
        : message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui atualizar a proposta.");
    } finally {
      setProposalBusyId(null);
    }
  }

  async function saveMemory(memory: AsaMemory) {
    if (!memoryDraft.trim() || savingMemory) return;
    setSavingMemory(true);
    setMemoryError(null);
    try {
      const updated = await customFetch<AsaMemory>(`/api/asa/memories/${memory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value: memoryDraft.trim() }),
      });
      setMemories((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingMemoryId(null);
      setMemoryDraft("");
    } catch {
      setMemoryError("Não consegui salvar a edição. Tente novamente.");
    } finally {
      setSavingMemory(false);
    }
  }

  async function removeMemory(memory: AsaMemory) {
    const phrase = memory.key.startsWith("ASA_COMMAND_ALIAS:") ? memory.key.slice("ASA_COMMAND_ALIAS:".length) : memory.key;
    if (!window.confirm(`Remover o aprendizado “${phrase}”? A ASA deixará de usá-lo.`)) return;
    setMemoryError(null);
    try {
      await customFetch(`/api/asa/memories/${memory.id}`, { method: "DELETE" });
      setMemories((current) => current.filter((item) => item.id !== memory.id));
    } catch {
      setMemoryError("Não consegui remover esse atalho. Tente novamente.");
    }
  }

  async function toggleMemory(memory: AsaMemory) {
    const enabling = memory.status === "DISABLED";
    const isAlias = memory.key.startsWith("ASA_COMMAND_ALIAS:");
    const phrase = isAlias ? memory.key.slice("ASA_COMMAND_ALIAS:".length) : memory.key;
    if (!window.confirm(enabling
      ? `Reativar “${phrase}”? A ASA voltará a ${isAlias ? "reconhecer esta frase" : "usar este aprendizado"}.`
      : `Desativar “${phrase}”? O aprendizado continuará salvo, mas a ASA deixará de ${isAlias ? "reconhecer esta frase" : "usá-lo"}.`)) return;
    setMemoryError(null);
    try {
      const updated = await customFetch<AsaMemory>(`/api/asa/memories/${memory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: enabling ? "APPROVED" : "DISABLED" }),
      });
      setMemories((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setMemoryError("Não consegui alterar o estado desse atalho. Tente novamente.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <AdminLayout title="ASA" subtitle="Assistente operacional">
      <div className="flex flex-col h-[calc(100dvh-14rem)] min-h-0 max-w-3xl mx-auto">

        {/* ── Header Card ── */}
        <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
          <div className="flex items-center gap-3">
            <img src="/asa-wing.png" alt="Asa My ASA" className="w-10 h-12 shrink-0 object-contain" />
            <div>
              <p className="font-serif font-bold text-base">ASA</p>
              <p className="text-xs text-muted-foreground">Assistente Operacional • sempre disponível</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <Button variant={view === "memories" ? "secondary" : "outline"} size="sm" onClick={() => setView(view === "memories" ? "conversation" : "memories")}>
              <Brain className="h-4 w-4" />{view === "memories" ? "Conversa" : "Meus aprendizados"}
            </Button>
            {conversationId && <Badge variant="outline" className="text-xs text-muted-foreground">Sem modelo externo</Badge>}
            {view === "conversation" && <Button
              variant="outline"
              size="sm"
              onClick={createConversation}
              disabled={streaming}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nova conversa
            </Button>}
          </div>
        </div>

        {view === "memories" ? (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-1 pb-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-semibold">Meus aprendizados pessoais</h2>
                <p className="text-sm text-muted-foreground">Só você pode ver e alterar estes aprendizados.</p>
              </div>
              <Button variant="outline" size="icon" aria-label="Atualizar aprendizados" title="Atualizar" onClick={() => setMemoryRefresh((value) => value + 1)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {memoryError && <p role="alert" className="text-sm text-destructive">{memoryError}</p>}
            {memoriesLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
              : memories.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Você ainda não ensinou aprendizados pessoais à ASA.</p>
              : memories.map((memory) => {
                const phrase = memory.key.startsWith("ASA_COMMAND_ALIAS:") ? memory.key.slice("ASA_COMMAND_ALIAS:".length) : memory.key;
                const status = memory.status === "APPROVED" ? "Ativo" : memory.status === "PENDING" ? "Aguardando aprovação" : memory.status === "DISABLED" ? "Desativado" : "Rejeitado";
                const editing = editingMemoryId === memory.id;
                return <article key={memory.id} className="border-b py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium break-words">{phrase}</h3>
                        <Badge variant={memory.status === "APPROVED" ? "secondary" : "outline"}>{status}</Badge>
                      </div>
                      {editing ? <div className="mt-3 space-y-2">
                        <Textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} maxLength={2000} rows={3} aria-label="Conteúdo do aprendizado" />
                        <p className="text-xs text-muted-foreground">Salvar envia a edição para nova aprovação antes de a ASA voltar a usá-la.</p>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={!memoryDraft.trim() || savingMemory} onClick={() => void saveMemory(memory)}><Check className="h-4 w-4" />Salvar</Button>
                          <Button size="sm" variant="outline" disabled={savingMemory} onClick={() => { setEditingMemoryId(null); setMemoryDraft(""); }}><X className="h-4 w-4" />Cancelar</Button>
                        </div>
                      </div> : <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{memory.value}</p>}
                    </div>
                    {!editing && <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" title="Editar aprendizado" aria-label="Editar aprendizado" onClick={() => { setEditingMemoryId(memory.id); setMemoryDraft(memory.value); }}><Pencil className="h-4 w-4" /></Button>
                      {(memory.status === "APPROVED" || memory.status === "DISABLED") && <Button variant="ghost" size="icon" title={memory.status === "APPROVED" ? "Desativar aprendizado" : "Reativar aprendizado"} aria-label={memory.status === "APPROVED" ? "Desativar aprendizado" : "Reativar aprendizado"} onClick={() => void toggleMemory(memory)}><Power className={cn("h-4 w-4", memory.status === "APPROVED" ? "text-muted-foreground" : "text-primary")} /></Button>}
                      <Button variant="ghost" size="icon" title="Remover aprendizado" aria-label="Remover aprendizado" onClick={() => void removeMemory(memory)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>}
                  </div>
                </article>;
              })}
          </div>
        ) : <>
        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1">
          {messages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary/50" />
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Olá! Sou a ASA.</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Posso consultar agenda, escalas, responsabilidades,<br />
                  avisos, tarefas e mensagens não lidas.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {(isManager ? SUGGESTIONS_MANAGER : SUGGESTIONS_MEMBER).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm">
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={createConversation} className="ml-auto text-xs">
                Tentar novamente
              </Button>
            </div>
          )}

          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} busy={proposalBusyId === msg.proposal?.id} onResolve={(proposal, action) => void resolveProposal(proposal, action)} />)}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="border-t pt-4">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem para a ASA… (Enter para enviar)"
              className="resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              disabled={streaming || !conversationId}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || streaming || !conversationId}
              size="icon"
              className="shrink-0 h-11 w-11"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            A ASA pode cometer erros. Sempre revise ações importantes antes de confirmar.
          </p>
        </div>
        </>}
      </div>
    </AdminLayout>
  );
}
