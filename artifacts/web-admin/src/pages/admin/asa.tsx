import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Bot, User2, Loader2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  streaming?: boolean;
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
};

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
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
        {msg.content || (msg.streaming ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Pensando...
          </span>
        ) : "")}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AsaPage() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    createConversation();
  }, []);

  async function createConversation() {
    try {
      const res = await fetch(`${getApiBase()}/api/anthropic/conversations`, {
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

            if (json.content) {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <AdminLayout title="ASA" subtitle="Assistente inteligente operacional da ASA">
      <div className="flex flex-col h-[calc(100vh-12rem)] max-w-3xl mx-auto">

        {/* ── Header Card ── */}
        <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
          <div className="flex items-center gap-3">
            <img src="/asinha.svg" alt="ASA" className="w-10 h-12 shrink-0" />
            <div>
              <p className="font-serif font-bold text-base">ASA</p>
              <p className="text-xs text-muted-foreground">Assistente Operacional • sempre disponível</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conversationId && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3 mr-1" />
                claude-sonnet
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={createConversation}
              disabled={streaming}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nova conversa
            </Button>
          </div>
        </div>

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
                  avisos, tarefas e muito mais.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {[
                  "Quais ensaios temos essa semana?",
                  "Tem alguma responsabilidade sem responsável?",
                  "Quais avisos foram publicados recentemente?",
                ].map((suggestion) => (
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

          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
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
      </div>
    </AdminLayout>
  );
}
