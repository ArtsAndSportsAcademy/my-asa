import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useGetOperations,
  useCreateTask,
  useCreateFolga,
  useCreateDelegation,
  useCreateMessageThread,
  useSendMessage,
  getListMessageThreadsQueryKey,
  getListDelegationsQueryKey,
  ALL_RESPONSIBILITIES,
  RESPONSIBILITY_LABELS,
} from "@workspace/api-client-react";
import type { DelegatedResponsibility } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, CheckSquare, ShieldCheck, Palmtree, Trophy,
  ArrowLeft, Loader2, Search, Users, AlertCircle, ChevronRight,
} from "lucide-react";

// ─── Types & constants ──────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  email?: string;
  photoUrl?: string | null;
  specialization?: string | null;
  role?: string;
  status?: string;
}

interface Operation {
  id: string;
  name: string;
}

type ActionKey = "message" | "task" | "delegation" | "folga" | "recognition";

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica",
};

const SPECIALIZATION_LABELS: Record<string, string> = {
  PERFORMER:          "Performer",
  PROFESSOR:          "Professor",
  TRAINER:            "Treinador",
  PHYSIOTHERAPIST:    "Fisioterapeuta",
  STRENGTH_COACH:     "Preparador Físico",
  TECHNICAL_OPERATOR: "Técnico Operacional",
  OTHER:              "Outro",
};

const specLabel = (s?: string | null) => (s ? SPECIALIZATION_LABELS[s] ?? s : "");

const FOLGA_TYPES = [
  { value: "DAY_OFF",     label: "Folga" },
  { value: "NO_SHOW",     label: "No-show" },
  { value: "RECESSO",     label: "Recesso" },
  { value: "AFASTAMENTO", label: "Afastamento" },
  { value: "RESTRICAO",   label: "Restrição" },
  { value: "OUTRO",       label: "Outro" },
];

const RECOGNITION_TYPES = [
  { value: "HIGHLIGHT",     label: "⭐ Destaque" },
  { value: "ACHIEVEMENT",   label: "🏆 Conquista" },
  { value: "THANK_YOU",     label: "🙏 Agradecimento" },
  { value: "TEAM_STAR",     label: "🌟 Estrela da Equipe" },
  { value: "BIRTHDAY",      label: "🎂 Aniversário" },
  { value: "TIME_OF_HOUSE", label: "📅 Tempo de Casa" },
];

function getToken(): string {
  return localStorage.getItem("myasa_access_token") ?? "";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Action: Mensagem ────────────────────────────────────────────────────────

function MessageForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateMessageThread();
  const sendMut = useSendMessage();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const valid = title.trim().length > 0;
  const pending = createMut.isPending || sendMut.isPending;

  const submit = async () => {
    if (!valid) return;
    try {
      const res = await createMut.mutateAsync({
        data: {
          title: title.trim(),
          participantIds: [member.id],
          contextType: "DIRECT",
        },
      });
      const threadId = res?.thread?.id;
      if (message.trim() && threadId) {
        await sendMut.mutateAsync({ threadId, data: { content: message.trim() } });
      }
      qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
      toast({ title: "Conversa iniciada com " + member.name });
      onDone();
    } catch {
      toast({ title: "Não foi possível iniciar a conversa.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Assunto *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Alinhamento sobre a escala" />
      </div>
      <div className="space-y-1.5">
        <Label>Mensagem (opcional)</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Escreva a primeira mensagem..." />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={!valid || pending}>
          {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Enviar mensagem
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Action: Tarefa ──────────────────────────────────────────────────────────

function TaskForm({ member, operations, onDone }: { member: Member; operations: Operation[]; onDone: () => void }) {
  const { toast } = useToast();
  const { mutateAsync: createTask, isPending } = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [operationId, setOperationId] = useState(operations.length === 1 ? operations[0].id : "");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim() || !operationId || !dueDate) {
      setError("Preencha título, operação e prazo.");
      return;
    }
    setError("");
    try {
      await createTask({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          operationId,
          assigneeId: member.id,
          requiresApproval: false,
          priority: priority as any,
          dueDate,
          mandatoryChecklist: [],
        } as any,
      });
      toast({ title: "Tarefa atribuída a " + member.name });
      onDone();
    } catch {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Título *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Preparar material para o show" />
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detalhes da tarefa" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Operação *</Label>
          <Select value={operationId} onValueChange={setOperationId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {operations.map((op) => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(PRIORITY_LABELS).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Prazo *</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      <DialogFooter>
        <Button onClick={submit} disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Criar tarefa
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Action: Delegação ───────────────────────────────────────────────────────

function DelegationForm({ member, operations, onDone }: { member: Member; operations: Operation[]; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateDelegation();
  const [operationId, setOperationId] = useState(operations.length === 1 ? operations[0].id : "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<DelegatedResponsibility[]>([]);
  const [error, setError] = useState("");

  const toggle = (r: DelegatedResponsibility) =>
    setSelected((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const submit = () => {
    if (!operationId || !startDate || !endDate) {
      setError("Preencha operação e período.");
      return;
    }
    if (endDate < startDate) {
      setError("A data de término deve ser igual ou posterior à de início.");
      return;
    }
    if (selected.length === 0) {
      setError("Selecione ao menos uma responsabilidade.");
      return;
    }
    setError("");
    createMut.mutate(
      {
        delegateId: member.id,
        operationId,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
        responsibilities: selected,
      } as any,
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListDelegationsQueryKey() });
          toast({ title: member.name + " recebeu as responsabilidades delegadas" });
          onDone();
        },
        onError: (err: any) => setError(err?.message ?? "Erro ao criar delegação."),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Operação *</Label>
        <Select value={operationId} onValueChange={setOperationId}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {operations.map((op) => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Início *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Término *</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Responsabilidades *</Label>
        <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/30 max-h-48 overflow-y-auto">
          {ALL_RESPONSIBILITIES.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <Checkbox id={`dlg-${r}`} checked={selected.includes(r)} onCheckedChange={() => toggle(r)} />
              <label htmlFor={`dlg-${r}`} className="text-sm cursor-pointer select-none">{RESPONSIBILITY_LABELS[r]}</label>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Motivo (opcional)</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ex: ausência planejada" />
      </div>
      {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      <DialogFooter>
        <Button onClick={submit} disabled={createMut.isPending}>
          {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Delegar
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Action: Folga ───────────────────────────────────────────────────────────

function FolgaForm({ member, operations, onDone }: { member: Member; operations: Operation[]; onDone: () => void }) {
  const { toast } = useToast();
  const createMut = useCreateFolga();
  const [operationId, setOperationId] = useState(operations.length === 1 ? operations[0].id : "");
  const [type, setType] = useState("DAY_OFF");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!operationId || !startDate || !endDate) {
      setError("Preencha operação e período.");
      return;
    }
    if (endDate < startDate) {
      setError("A data de término deve ser igual ou posterior à de início.");
      return;
    }
    setError("");
    createMut.mutate(
      { data: { userId: member.id, operationId, type: type as any, startDate, endDate, notes: notes.trim() || undefined } as any },
      {
        onSuccess: () => {
          toast({ title: "Folga registrada para " + member.name });
          onDone();
        },
        onError: (err: any) => setError(err?.message ?? "Erro ao registrar folga."),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Operação *</Label>
          <Select value={operationId} onValueChange={setOperationId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {operations.map((op) => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FOLGA_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Início *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Término *</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Observações (opcional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex: motivo da ausência" />
      </div>
      {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      <DialogFooter>
        <Button onClick={submit} disabled={createMut.isPending}>
          {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Registrar folga
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Action: Reconhecimento ──────────────────────────────────────────────────

function RecognitionForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const { toast } = useToast();
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = type && title.trim() && message.trim();

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const r = await fetch("/api/asa/recognitions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ userId: member.id, type, title: title.trim(), message: message.trim() }),
      });
      if (!r.ok) throw new Error(String(r.status));
      toast({ title: "Reconhecimento publicado no mural! 🎉" });
      onDone();
    } catch {
      toast({ title: "Não foi possível publicar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Tipo *</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
          <SelectContent>
            {RECOGNITION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Título *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Excelente atuação no espetáculo" />
      </div>
      <div className="space-y-1.5">
        <Label>Mensagem *</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Descreva o motivo do reconhecimento..." />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={!valid || saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Publicar no mural
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Action hub config ───────────────────────────────────────────────────────

const ACTIONS: { key: ActionKey; label: string; description: string; icon: React.ElementType; color: string }[] = [
  { key: "message",     label: "Mensagem",       description: "Iniciar uma conversa",            icon: MessageSquare, color: "text-blue-600 bg-blue-50"     },
  { key: "task",        label: "Tarefa",         description: "Atribuir uma tarefa",             icon: CheckSquare,   color: "text-violet-600 bg-violet-50" },
  { key: "delegation",  label: "Delegação",      description: "Delegar responsabilidades",       icon: ShieldCheck,   color: "text-emerald-600 bg-emerald-50" },
  { key: "folga",       label: "Folga",          description: "Registrar folga ou ausência",     icon: Palmtree,      color: "text-amber-600 bg-amber-50"   },
  { key: "recognition", label: "Reconhecimento", description: "Reconhecer no mural da equipe",   icon: Trophy,        color: "text-rose-600 bg-rose-50"     },
];

const ACTION_TITLES: Record<ActionKey, string> = {
  message: "Enviar mensagem",
  task: "Atribuir tarefa",
  delegation: "Delegar responsabilidade",
  folga: "Registrar folga",
  recognition: "Dar reconhecimento",
};

// ─── Member hub dialog ───────────────────────────────────────────────────────

function MemberHub({ member, operations, onClose }: { member: Member; operations: Operation[]; onClose: () => void }) {
  const [action, setAction] = useState<ActionKey | null>(null);

  const done = () => setAction(null);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {action && (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={() => setAction(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={member.photoUrl ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initialsOf(member.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight truncate">{member.name}</p>
              <p className="text-xs text-muted-foreground font-normal truncate">
                {action ? ACTION_TITLES[action] : (member.specialization || member.email || "Membro da equipe")}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {!action ? (
          <div className="space-y-2 py-1">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  onClick={() => setAction(a.key)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${a.color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-1">
            {action === "message"     && <MessageForm member={member} onDone={done} />}
            {action === "task"        && <TaskForm member={member} operations={operations} onDone={done} />}
            {action === "delegation"  && <DelegationForm member={member} operations={operations} onDone={done} />}
            {action === "folga"       && <FolgaForm member={member} operations={operations} onDone={done} />}
            {action === "recognition" && <RecognitionForm member={member} onDone={done} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function EquipePage() {
  const { user } = useAuth();
  const { data: usersData, isLoading, error } = useListUsers();
  const { data: opsData } = useGetOperations();
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("ALL");
  const [selected, setSelected] = useState<Member | null>(null);

  const operations: Operation[] = (opsData as any)?.operations ?? [];

  const activeMembers: Member[] = useMemo(() => {
    return ((usersData?.users ?? []) as Member[])
      .filter((m) => m.id !== user?.id)
      .filter((m) => !m.status || m.status === "ACTIVE");
  }, [usersData, user?.id]);

  const availableSpecs = useMemo(() => {
    const set = new Set<string>();
    activeMembers.forEach((m) => { if (m.specialization) set.add(m.specialization); });
    return Array.from(set).sort((a, b) => specLabel(a).localeCompare(specLabel(b)));
  }, [activeMembers]);

  const members: Member[] = useMemo(() => {
    return activeMembers
      .filter((m) => specFilter === "ALL" || m.specialization === specFilter)
      .filter((m) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeMembers, search, specFilter]);

  return (
    <AdminLayout title="Equipe" subtitle="Veja sua equipe e faça tudo a partir do perfil de cada pessoa">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro..."
              className="pl-9"
            />
          </div>
          {availableSpecs.length > 0 && (
            <Select value={specFilter} onValueChange={setSpecFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Todas as funções" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as funções</SelectItem>
                {availableSpecs.map((s) => (
                  <SelectItem key={s} value={s}>{specLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4 flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-md border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Erro ao carregar a equipe.
          </div>
        )}

        {!isLoading && !error && members.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">Nenhum membro encontrado.</p>
          </div>
        )}

        {!isLoading && members.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="text-left"
              >
                <Card className="p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all">
                  <Avatar className="h-11 w-11 border">
                    <AvatarImage src={m.photoUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{initialsOf(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.name}</p>
                    {m.specialization ? (
                      <Badge variant="secondary" className="text-[10px] mt-0.5">{specLabel(m.specialization)}</Badge>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <MemberHub member={selected} operations={operations} onClose={() => setSelected(null)} />
      )}
    </AdminLayout>
  );
}
