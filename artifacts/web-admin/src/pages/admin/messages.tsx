import { useState } from "react";
import {
  useListMessageThreads,
  useGetMessageThread,
  useCreateMessageThread,
  useSendMessage,
  useCloseMessageThread,
  useListMessageRecipients,
  getListMessageThreadsQueryKey,
  getGetMessageThreadQueryKey,
} from "@workspace/api-client-react";
import type {
  MessageThreadListItem,
  MessageItem,
  MessageParticipant,
  MessageRecipient,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  X,
  CheckCircle2,
  Clock,
  Users,
  BookOpen,
  Tag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ─── Config ────────────────────────────────────────────────────────────────────

const CONTEXT_LABELS: Record<string, string> = {
  SCALE:              "Escala",
  DAILY_BOOK:         "Livro do Dia",
  AGENDA:             "Agenda",
  NOTICE:             "Aviso",
  REQUEST:            "Solicitação",
  OPERATIONAL_CHANGE: "Mudança Operacional",
  DIRECT:             "Direto",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN:        "Gerência",
  SUPERVISOR_A: "Supervisor",
  SUPERVISOR_B: "Supervisor",
  TRAINER:      "Treinador",
  MEMBER:       "Elenco",
};

function fmtTime(dt: string | undefined | null) {
  if (!dt) return "";
  const d = new Date(dt);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtFull(dt: string | undefined | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Thread List Item ─────────────────────────────────────────────────────────

function ThreadRow({
  thread,
  selected,
  onSelect,
  myId,
}: {
  thread: MessageThreadListItem;
  selected: boolean;
  onSelect: () => void;
  myId: string;
}) {
  const otherParticipants = thread.participants?.filter((p) => p.userId !== myId) ?? [];
  const names = otherParticipants.map((p) => p.name ?? "—").join(", ");

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        selected ? "bg-violet-50 border-l-2 border-l-violet-600" : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate flex-1">{thread.title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {thread.status === "CLOSED" && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Encerrada</span>
          )}
          <span className="text-xs text-gray-400">{fmtTime(thread.lastMessage?.createdAt ?? thread.createdAt)}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 truncate mt-0.5">{names || "—"}</p>
      {thread.lastMessage && (
        <p className="text-xs text-gray-400 truncate mt-1">{thread.lastMessage.content}</p>
      )}
      {thread.contextType && thread.contextType !== "DIRECT" && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
          <Tag size={9} /> {CONTEXT_LABELS[thread.contextType] ?? thread.contextType}
          {thread.contextTitle && ` — ${thread.contextTitle}`}
        </span>
      )}
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }: { msg: MessageItem; isMe: boolean }) {
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
          isMe
            ? "bg-violet-700 text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
        }`}
      >
        {!isMe && (
          <p className="text-xs font-semibold mb-1 text-violet-700">{msg.senderName ?? "—"}</p>
        )}
        <p className="text-sm leading-relaxed">{msg.content}</p>
        <p className={`text-xs mt-1 ${isMe ? "text-violet-200" : "text-gray-400"}`}>
          {fmtFull(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Create Thread Dialog ─────────────────────────────────────────────────────

function CreateThreadDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: recipientsData } = useListMessageRecipients();
  const createMut = useCreateMessageThread();
  const recipients = recipientsData?.recipients ?? [];

  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextType, setContextType] = useState("DIRECT");
  const [contextTitle, setContextTitle] = useState("");

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!title.trim() || selectedIds.length === 0) return;
    createMut.mutate(
      {
        data: {
          title,
          participantIds: selectedIds,
          contextType,
          contextTitle: contextTitle || undefined,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Assunto</Label>
            <Input
              className="mt-1"
              placeholder="Ex: Dúvida sobre escala de 22/06"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label>Participantes</Label>
            <div className="mt-1 max-h-40 overflow-y-auto border rounded-md divide-y">
              {recipients.length === 0 && (
                <p className="text-xs text-gray-400 p-3 text-center">Nenhum membro da equipe disponível para adicionar à conversa.</p>
              )}
              {recipients.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="accent-violet-600"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleRecipient(r.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{r.name ?? r.email}</p>
                    <p className="text-xs text-gray-500">{ROLE_LABELS[r.role] ?? r.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Contexto</Label>
            <Select value={contextType} onValueChange={setContextType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTEXT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {contextType !== "DIRECT" && (
            <div>
              <Label>Referência (opcional)</Label>
              <Input
                className="mt-1"
                placeholder="Ex: Escala 22/06 — Evento X"
                value={contextTitle}
                onChange={(e) => setContextTitle(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={createMut.isPending || !title.trim() || selectedIds.length === 0}
            className="bg-violet-700 hover:bg-violet-800 text-white"
          >
            {createMut.isPending ? "Criando..." : "Criar Conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Thread Detail Panel ──────────────────────────────────────────────────────

function ThreadPanel({
  threadId,
  myId,
  onClose,
}: {
  threadId: string;
  myId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useGetMessageThread(threadId);
  const sendMut = useSendMessage();
  const closeMut = useCloseMessageThread();
  const [text, setText] = useState("");

  const thread = data?.thread;
  const messages = data?.messages ?? [];
  const participants = data?.participants ?? [];

  const handleSend = () => {
    const content = text.trim();
    if (!content || !thread || thread.status === "CLOSED") return;
    sendMut.mutate(
      { threadId, data: { content } },
      {
        onSuccess: () => {
          setText("");
          qc.invalidateQueries({ queryKey: getGetMessageThreadQueryKey(threadId) });
          qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
        },
      }
    );
  };

  const handleClose = () => {
    closeMut.mutate(
      { threadId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMessageThreadQueryKey(threadId) });
          qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">{thread.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {thread.contextType && thread.contextType !== "DIRECT" && (
              <span className="text-xs text-violet-700 font-medium">
                {CONTEXT_LABELS[thread.contextType] ?? thread.contextType}
                {thread.contextTitle && ` — ${thread.contextTitle}`}
              </span>
            )}
            {thread.status === "CLOSED" && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Encerrada</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {thread.status === "OPEN" && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleClose}
              disabled={closeMut.isPending}
            >
              {closeMut.isPending ? "..." : "Encerrar"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Participants strip */}
      <div className="px-4 py-1.5 bg-gray-50 border-b flex items-center gap-2 text-xs text-gray-500">
        <Users size={12} />
        {participants.map((p) => (
          <span key={p.userId} className="bg-white border rounded px-1.5 py-0.5">
            {p.name ?? "—"} <span className="text-gray-400">({p.role === "INITIATOR" ? "iniciador" : "participante"})</span>
          </span>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma mensagem nesta conversa ainda.</p>
              <p className="text-xs mt-1">Envie a primeira mensagem para iniciar a troca com sua equipe.</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === myId} />
        ))}
      </div>

      {/* Input */}
      {thread.status === "OPEN" ? (
        <div className="px-4 py-3 border-t bg-white flex gap-2">
          <Textarea
            className="flex-1 resize-none text-sm"
            rows={2}
            placeholder="Digite sua mensagem..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={sendMut.isPending || !text.trim()}
            className="bg-violet-700 hover:bg-violet-800 text-white self-end"
          >
            <Send size={14} />
          </Button>
        </div>
      ) : (
        <div className="px-4 py-3 border-t bg-gray-50 text-center text-xs text-gray-500">
          Esta conversa está encerrada
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminMessagesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const myId = (user as any)?.id ?? "";

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useListMessageThreads();
  const threads = (data?.threads ?? []) as MessageThreadListItem[];

  const filtered = threads.filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Mensagens">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 flex flex-col border-r bg-white">
          {/* Header */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={16} className="text-violet-600" />
                Mensagens
              </h1>
              <Button
                size="sm"
                className="bg-violet-700 hover:bg-violet-800 text-white h-7 text-xs"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={12} className="mr-1" /> Nova
              </Button>
            </div>
            <Input
              placeholder="Buscar conversa..."
              className="h-7 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex justify-center py-8">
                <RefreshCw size={18} className="animate-spin text-gray-400" />
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhuma conversa iniciada ainda. As mensagens da sua equipe aparecerão aqui.</p>
              </div>
            )}
            {filtered.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                selected={t.id === selectedThreadId}
                onSelect={() => setSelectedThreadId(t.id)}
                myId={myId}
              />
            ))}
          </div>
        </div>

        {/* Main panel */}
        {selectedThreadId ? (
          <ThreadPanel
            threadId={selectedThreadId}
            myId={myId}
            onClose={() => setSelectedThreadId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">Selecione uma conversa</p>
              <p className="text-xs mt-1">ou crie uma nova para começar</p>
            </div>
          </div>
        )}
      </div>

      {createOpen && <CreateThreadDialog onClose={() => setCreateOpen(false)} />}
    </AdminLayout>
  );
}
