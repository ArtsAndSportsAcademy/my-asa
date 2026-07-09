import { useState } from "react";
import {
  useGetMyTasks,
  getGetMyTasksQueryKey,
  useStartTask,
  useUpdateTask,
  useSubmitTaskForApproval,
  useAddTaskEvidence,
  useDeleteTaskEvidence,
  useGetTask,
  getGetTaskQueryKey,
} from "@workspace/api-client-react";
import type { TaskItem, TaskEvidence } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MinhasEntregasContent } from "@/pages/membro/minhas-entregas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckSquare,
  RefreshCw,
  Clock,
  Briefcase,
  Check,
  Link2,
  Plus,
  Trash2,
  Paperclip,
  AlertTriangle,
  AlertCircle,
  Play,
  Send,
} from "lucide-react";

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-gray-100 text-gray-600",
};

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Criada",
  IN_PROGRESS: "Em Andamento",
  READY_FOR_APPROVAL: "Ag. Aprovação",
  CHANGES_REQUESTED: "Ajustes Solicitados",
  APPROVED: "Aprovada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

const STATUS_BADGES: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  READY_FOR_APPROVAL: "bg-violet-100 text-violet-700",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  EXPIRED: "bg-red-100 text-red-700",
};

const FILTER_TABS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "CREATED", label: "Criadas" },
  { value: "IN_PROGRESS", label: "Em Andamento" },
  { value: "READY_FOR_APPROVAL", label: "Ag. Aprovação" },
  { value: "CHANGES_REQUESTED", label: "Ajustes" },
  { value: "APPROVED", label: "Aprovadas" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getChecklist(task: TaskItem) {
  return (task.operationalChecklist ?? []).concat(task.mandatoryChecklist ?? []);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
}

// ─── Evidence Section ────────────────────────────────────────────────────────

function EvidenceSection({
  taskId,
  taskStatus,
  enabled,
  onChanged,
}: {
  taskId: string;
  taskStatus: string;
  enabled: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const { data: taskDetail, refetch: refetchDetail } = useGetTask(taskId, {
    query: { enabled, queryKey: getGetTaskQueryKey(taskId) },
  });
  const evidences: TaskEvidence[] = (taskDetail as any)?.evidences ?? [];

  const addMutation = useAddTaskEvidence({
    mutation: {
      onSuccess: () => {
        refetchDetail();
        onChanged();
        setShowForm(false);
        setUrl("");
        setDescription("");
      },
    },
  });

  const deleteMutation = useDeleteTaskEvidence({
    mutation: {
      onSuccess: () => {
        refetchDetail();
        onChanged();
      },
    },
  });

  const canEdit = ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(taskStatus);

  return (
    <div className="border-t pt-4 mt-2 space-y-3">
      <div className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidências{evidences.length > 0 ? ` (${evidences.length})` : ""}
        </span>
      </div>

      {evidences.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">Nenhuma evidência anexada ainda.</p>
      )}

      <div className="space-y-2">
        {evidences.map((ev) => (
          <div key={ev.id} className="flex items-start gap-2 bg-muted rounded-lg p-3">
            <Link2 className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <a
                href={ev.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-violet-600 font-medium break-all hover:underline line-clamp-2"
              >
                {ev.url}
              </a>
              {ev.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(ev.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-500 shrink-0"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm("Remover esta evidência? Essa ação não pode ser desfeita.")) {
                    deleteMutation.mutate({ taskId, evidenceId: ev.id });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && !showForm && (
        <Button
          size="sm"
          variant="ghost"
          className="text-violet-600 hover:text-violet-700 px-0"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" /> Adicionar Evidência
        </Button>
      )}

      {showForm && (
        <div className="space-y-2">
          <Input
            placeholder="URL / Link (Drive, YouTube, OneDrive...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Textarea
            placeholder="Descrição ou observação (opcional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setUrl("");
                setDescription("");
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!url.trim() || addMutation.isPending}
              onClick={() => {
                if (!url.trim()) return;
                addMutation.mutate({
                  taskId,
                  data: { type: "LINK", url: url.trim(), description: description.trim() || undefined },
                });
              }}
            >
              {addMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onOpen,
  onStart,
  starting,
}: {
  task: TaskItem;
  onOpen: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isLate =
    !["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status) && task.dueDate < today;
  const checklist = getChecklist(task);
  const completedCount = checklist.filter((i) => i.completed).length;

  return (
    <Card
      className={`cursor-pointer hover:shadow-sm transition-shadow ${
        isLate ? "border-red-200 bg-red-50/30" : ""
      }`}
      onClick={onOpen}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`} />
          <h3 className="text-sm font-semibold leading-snug flex-1 line-clamp-2">{task.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGES[task.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
          {isLate && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
              Atrasada
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {task.operationName && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {task.operationName}
            </span>
          )}
          <span className={`flex items-center gap-1 ${isLate ? "text-red-600 font-medium" : ""}`}>
            <Clock className="h-3 w-3" />
            Prazo: {formatDate(task.dueDate)}
          </span>
          {checklist.length > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {completedCount}/{checklist.length}
            </span>
          )}
        </div>

        {task.status === "CREATED" && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="sm" disabled={starting} onClick={onStart}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {starting ? "Iniciando..." : "Iniciar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ───────────────────────────────────────────────────────────

function TaskDetailDialog({
  task,
  open,
  onClose,
  onToggleChecklist,
  onSubmit,
  submitting,
  onEvidenceChanged,
}: {
  task: TaskItem;
  open: boolean;
  onClose: () => void;
  onToggleChecklist: (task: TaskItem, itemId: string, completed: boolean) => void;
  onSubmit: (id: string) => void;
  submitting: boolean;
  onEvidenceChanged: () => void;
}) {
  const checklist = getChecklist(task);
  const completedCount = checklist.filter((i) => i.completed).length;
  const checklistDone = checklist.length === 0 || completedCount === checklist.length;
  const canSubmit = task.status === "IN_PROGRESS" && checklistDone;
  const showEvidence = ["IN_PROGRESS", "CHANGES_REQUESTED", "READY_FOR_APPROVAL"].includes(task.status);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-left">{task.title}</DialogTitle>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGES[task.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
              {PRIORITY_LABELS[task.priority] ?? task.priority}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {task.operationName && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {task.operationName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Prazo: {formatDate(task.dueDate)}
            </span>
          </div>

          {task.status === "CHANGES_REQUESTED" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Ajustes solicitados — atualize as evidências e reenvie para aprovação.
              </p>
            </div>
          )}

          {task.status === "READY_FOR_APPROVAL" && (
            <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <Clock className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
              <p className="text-sm text-violet-800">Aguardando aprovação do supervisor.</p>
            </div>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checklist ({completedCount}/{checklist.length})
              </p>
              <div className="space-y-1.5">
                {checklist.map((item) => {
                  const interactive = task.status === "IN_PROGRESS";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!interactive}
                      onClick={() => interactive && onToggleChecklist(task, item.id, !item.completed)}
                      className={`flex items-center gap-2.5 w-full text-left ${interactive ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          item.completed ? "bg-primary border-primary" : "border-input"
                        }`}
                      >
                        {item.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                      </span>
                      <span
                        className={`text-sm ${
                          item.completed ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidences */}
          {showEvidence && (
            <EvidenceSection
              taskId={task.id}
              taskStatus={task.status}
              enabled={open}
              onChanged={onEvidenceChanged}
            />
          )}

          {/* Actions */}
          {(canSubmit || task.status === "CHANGES_REQUESTED") && (
            <div className="pt-2">
              {task.status === "IN_PROGRESS" && !checklistDone && (
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Conclua todos os itens do checklist para enviar.
                </p>
              )}
              <Button
                className="w-full"
                disabled={(task.status === "IN_PROGRESS" && !checklistDone) || submitting}
                onClick={() => onSubmit(task.id)}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {submitting
                  ? "Enviando..."
                  : task.status === "CHANGES_REQUESTED"
                    ? "Reenviar para Aprovação"
                    : task.requiresApproval
                      ? "Enviar para Aprovação"
                      : "Concluir"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function TarefasContent() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const params = statusFilter ? { status: statusFilter } : undefined;
  const { data, isLoading, isError, refetch, isFetching } = useGetMyTasks(params, {
    query: { queryKey: getGetMyTasksQueryKey(params) },
  });
  const tasks: TaskItem[] = (data?.tasks ?? []) as TaskItem[];

  const { mutateAsync: startTask } = useStartTask();
  const { mutateAsync: submitTask } = useSubmitTaskForApproval();
  const { mutateAsync: updateTask } = useUpdateTask();

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });
    refetch();
  };

  async function handleStart(id: string) {
    setActionId(id);
    try {
      await startTask({ taskId: id });
      refreshTasks();
    } catch {
      window.alert("Não foi possível iniciar a tarefa.");
    } finally {
      setActionId(null);
    }
  }

  async function handleSubmit(id: string) {
    setActionId(id);
    try {
      await submitTask({ taskId: id });
      refreshTasks();
      setSelectedId(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        "Verifique se o checklist está completo e as evidências obrigatórias foram anexadas.";
      window.alert(`Não foi possível enviar: ${msg}`);
    } finally {
      setActionId(null);
    }
  }

  async function handleToggleChecklist(task: TaskItem, itemId: string, completed: boolean) {
    const currentOperational = task.operationalChecklist ?? [];
    const currentMandatory = task.mandatoryChecklist ?? [];
    const newOperational = currentOperational.map((i) =>
      i.id === itemId ? { ...i, completed } : i
    );
    const newMandatory = currentMandatory.map((i) =>
      i.id === itemId ? { ...i, completed } : i
    );
    try {
      await updateTask({
        taskId: task.id,
        data: { operationalChecklist: newOperational, mandatoryChecklist: newMandatory },
      });
      refreshTasks();
    } catch {
      /* silently handled */
    }
  }

  return (
    <>
      <div className="max-w-4xl space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 bg-muted rounded-lg flex-wrap">
            {FILTER_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === t.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={refreshTasks} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Não foi possível carregar suas tarefas.</p>
              <Button variant="outline" size="sm" onClick={refreshTasks}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <CheckSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Sem tarefas por enquanto. Quando você receber uma tarefa, ela vai aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={() => setSelectedId(task.id)}
                onStart={() => handleStart(task.id)}
                starting={actionId === task.id}
              />
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedId}
          onClose={() => setSelectedId(null)}
          onToggleChecklist={handleToggleChecklist}
          onSubmit={handleSubmit}
          submitting={actionId === selectedTask.id}
          onEvidenceChanged={refreshTasks}
        />
      )}
    </>
  );
}

export default function MinhasTarefasPage() {
  return (
    <AdminLayout title="Tarefas">
      <Tabs defaultValue="tarefas">
        <TabsList className="mb-4">
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="entregas">Entregas</TabsTrigger>
        </TabsList>
        <TabsContent value="tarefas"><TarefasContent /></TabsContent>
        <TabsContent value="entregas"><MinhasEntregasContent /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
