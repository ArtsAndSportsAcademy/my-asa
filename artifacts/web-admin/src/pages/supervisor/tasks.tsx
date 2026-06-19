import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useListTasks,
  useGetOperations,
  useListUsers,
  useCreateTask,
  useApproveTask,
  useRequestTaskChanges,
  useCancelTask,
  useGetTask,
} from "@workspace/api-client-react";
import type { TaskItem, TaskEvidence } from "@workspace/api-client-react";
import { Plus, CheckCircle2, XCircle, RotateCcw, AlertCircle, Ban, Paperclip, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700 border-gray-200",
  MEDIUM: "bg-blue-100 text-blue-700 border-blue-200",
  HIGH: "bg-amber-100 text-amber-700 border-amber-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  CREATED: "Criada",
  IN_PROGRESS: "Em Andamento",
  READY_FOR_APPROVAL: "Aguardando Aprovação",
  CHANGES_REQUESTED: "Ajustes Solicitados",
  APPROVED: "Aprovada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};
const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  READY_FOR_APPROVAL: "bg-violet-100 text-violet-700 border-violet-200",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
  EXPIRED: "bg-red-100 text-red-600 border-red-200",
};

function EvidenceViewer({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const { data: detail } = useGetTask(taskId, {
    query: { enabled: open } as any,
  });
  const evidences: TaskEvidence[] = (detail as any)?.evidences ?? [];

  return (
    <div className="mt-3 pt-3 border-t">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Paperclip className="h-3 w-3" />
        Evidências{evidences.length > 0 ? ` (${evidences.length})` : ""}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {evidences.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma evidência anexada.</p>
          ) : (
            evidences.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 bg-muted/50 rounded-md p-2">
                <ExternalLink className="h-3 w-3 mt-0.5 text-violet-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-600 hover:underline truncate block"
                  >
                    {ev.url}
                  </a>
                  {ev.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(ev.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onApprove, onRequestChanges, onCancel }: {
  task: TaskItem;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isLate = !["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)
    && new Date(task.dueDate) < new Date();
  return (
    <Card className={`border ${isLate ? "border-red-200 bg-red-50/30" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium text-sm truncate">{task.title}</span>
              {isLate && <Badge variant="outline" className="bg-red-100 text-red-600 border-red-200 text-xs">Atrasada</Badge>}
            </div>
            {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status] ?? task.status}</Badge>
              <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>Responsável: <span className="text-foreground font-medium">{task.assigneeName ?? task.assigneeId}</span></div>
              {task.operationName && <div>Operação: {task.operationName}</div>}
              <div>Prazo: <span className={isLate ? "text-red-600 font-medium" : ""}>{new Date(task.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</span></div>
            </div>
            <EvidenceViewer taskId={task.id} />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {task.status === "READY_FOR_APPROVAL" && (
              <>
                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onApprove(task.id)}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRequestChanges(task.id)}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Ajustes
                </Button>
              </>
            )}
            {!["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status) && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => onCancel(task.id)}>
                <Ban className="h-3 w-3 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTaskDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", operationId: "", assigneeId: "",
    approverId: "", requiresApproval: true, priority: "MEDIUM",
    dueDate: "", mandatoryChecklist: [] as { id: string; label: string; completed: boolean }[],
    newChecklistItem: "",
  });
  const { data: opsData } = useGetOperations();
  const { data: usersData } = useListUsers();
  const operations = opsData?.operations ?? [];
  const users = usersData?.users ?? [];
  const { mutateAsync: createTask, isPending } = useCreateTask();

  function addChecklistItem() {
    if (!form.newChecklistItem.trim()) return;
    setForm((f) => ({ ...f, mandatoryChecklist: [...f.mandatoryChecklist, { id: crypto.randomUUID(), label: f.newChecklistItem.trim(), completed: false }], newChecklistItem: "" }));
  }

  async function handleSubmit() {
    if (!form.title || !form.operationId || !form.assigneeId || !form.dueDate) {
      toast({ title: "Campos obrigatórios", description: "Preencha título, operação, responsável e prazo.", variant: "destructive" });
      return;
    }
    try {
      await createTask({ data: { title: form.title, description: form.description || undefined, operationId: form.operationId, assigneeId: form.assigneeId, approverId: form.requiresApproval && form.approverId ? form.approverId : undefined, requiresApproval: form.requiresApproval, priority: form.priority as any, dueDate: form.dueDate, mandatoryChecklist: form.mandatoryChecklist } });
      toast({ title: "Tarefa criada com sucesso" });
      setOpen(false);
      setForm({ title: "", description: "", operationId: "", assigneeId: "", approverId: "", requiresApproval: true, priority: "MEDIUM", dueDate: "", mandatoryChecklist: [], newChecklistItem: "" });
      onCreated();
    } catch {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Nova Tarefa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Tarefa Operacional</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Preparar Pocket para show do sábado" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Operação *</Label>
              <Select value={form.operationId} onValueChange={(v) => setForm((f) => ({ ...f, operationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{operations.map((op) => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsável *</Label>
              <Select value={form.assigneeId} onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo *</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="req-approval" checked={form.requiresApproval} onCheckedChange={(v) => setForm((f) => ({ ...f, requiresApproval: !!v }))} />
            <Label htmlFor="req-approval" className="cursor-pointer">Requer aprovação</Label>
          </div>
          {form.requiresApproval && (
            <div className="space-y-1.5">
              <Label>Aprovador</Label>
              <Select value={form.approverId} onValueChange={(v) => setForm((f) => ({ ...f, approverId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar aprovador" /></SelectTrigger>
                <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Checklist Obrigatório</Label>
            <div className="space-y-1.5">
              {form.mandatoryChecklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{item.label}</span>
                  <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setForm((f) => ({ ...f, mandatoryChecklist: f.mandatoryChecklist.filter((i) => i.id !== item.id) }))}>
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={form.newChecklistItem} onChange={(e) => setForm((f) => ({ ...f, newChecklistItem: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addChecklistItem()} placeholder="Adicionar item" className="text-sm" />
              <Button size="sm" variant="outline" onClick={addChecklistItem} type="button">+</Button>
            </div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={isPending}>{isPending ? "Criando..." : "Criar Tarefa"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupervisorTasksPage() {
  const { toast } = useToast();
  const [operationId, setOperationId] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [refetchKey, setRefetchKey] = useState(0);
  const [changesComment, setChangesComment] = useState("");
  const [changesTaskId, setChangesTaskId] = useState<string | null>(null);

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const { data, refetch } = useListTasks({
    operationId: operationId || undefined,
    priority: priorityFilter || undefined,
  }, { query: { queryKey: ["sup-tasks-list", operationId, priorityFilter, refetchKey] } });
  const tasks: TaskItem[] = (data?.tasks ?? []) as TaskItem[];

  const { mutateAsync: approveTask } = useApproveTask();
  const { mutateAsync: requestChanges } = useRequestTaskChanges();
  const { mutateAsync: cancelTask } = useCancelTask();

  async function handleApprove(id: string) {
    try { await approveTask({ taskId: id }); toast({ title: "Tarefa aprovada" }); refetch(); }
    catch { toast({ title: "Erro ao aprovar tarefa", variant: "destructive" }); }
  }

  async function submitChanges() {
    if (!changesTaskId || !changesComment.trim()) return;
    try {
      await requestChanges({ taskId: changesTaskId, data: { comment: changesComment } });
      toast({ title: "Ajustes solicitados" });
      setChangesTaskId(null); setChangesComment(""); refetch();
    } catch { toast({ title: "Erro ao solicitar ajustes", variant: "destructive" }); }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancelar esta tarefa?")) return;
    try { await cancelTask({ taskId: id }); toast({ title: "Tarefa cancelada" }); refetch(); }
    catch { toast({ title: "Erro ao cancelar tarefa", variant: "destructive" }); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const pending = tasks.filter((t) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(t.status));
  const awaitingApproval = tasks.filter((t) => t.status === "READY_FOR_APPROVAL");
  const late = tasks.filter((t) => !["APPROVED", "COMPLETED", "CANCELLED"].includes(t.status) && t.dueDate < today);
  const done = tasks.filter((t) => ["APPROVED", "COMPLETED"].includes(t.status));

  return (
    <AdminLayout title="Tarefas Operacionais" subtitle="Gerencie e aprove tarefas da operação">
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[180px] space-y-1.5">
                <Label className="text-xs">Operação</Label>
                <Select value={operationId} onValueChange={setOperationId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas as operações" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as operações</SelectItem>
                    {operations.map((op) => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px] space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto">
                <CreateTaskDialog onCreated={() => { setRefetchKey((k) => k + 1); refetch(); }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Todas <Badge variant="secondary" className="ml-1.5 h-4 text-xs">{tasks.length}</Badge></TabsTrigger>
            <TabsTrigger value="pending">Em Aberto <Badge variant="secondary" className="ml-1.5 h-4 text-xs">{pending.length}</Badge></TabsTrigger>
            <TabsTrigger value="approval">
              Aguardando Aprovação
              {awaitingApproval.length > 0 && <Badge className="ml-1.5 h-4 text-xs bg-violet-600">{awaitingApproval.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="late">
              Atrasadas
              {late.length > 0 && <Badge className="ml-1.5 h-4 text-xs bg-red-600">{late.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="done">Concluídas <Badge variant="secondary" className="ml-1.5 h-4 text-xs">{done.length}</Badge></TabsTrigger>
          </TabsList>
          {([["all", tasks], ["pending", pending], ["approval", awaitingApproval], ["late", late], ["done", done]] as [string, TaskItem[]][]).map(([tab, list]) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-3 opacity-40" />
                  <p className="text-sm">Nenhuma tarefa encontrada.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((task) => (
                    <TaskCard key={task.id} task={task} onApprove={handleApprove} onRequestChanges={setChangesTaskId} onCancel={handleCancel} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={!!changesTaskId} onOpenChange={(o) => { if (!o) { setChangesTaskId(null); setChangesComment(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Solicitar Ajustes</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Descreva o que precisa ser corrigido.</p>
              <Textarea value={changesComment} onChange={(e) => setChangesComment(e.target.value)} rows={3} placeholder="Ex: A foto está com baixa resolução. Por favor, tire uma nova com melhor iluminação." />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setChangesTaskId(null); setChangesComment(""); }}>Cancelar</Button>
                <Button onClick={submitChanges} disabled={!changesComment.trim()}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Solicitar Ajustes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
