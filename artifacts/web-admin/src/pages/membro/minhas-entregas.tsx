import { useState, useCallback, useEffect } from "react";
import {
  useGetMyDeliveries,
  useViewDelivery,
  useCompleteDelivery,
  useUpdateDeliveryChecklist,
  getGetMyDeliveriesQueryKey,
} from "@workspace/api-client-react";
import type { MyDeliveryAssignmentItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Video,
  CheckSquare,
  Package,
  ChevronRight,
  RefreshCw,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  MANDATORY_READ: "Leitura Obrigatória",
  MANDATORY_VIDEO: "Vídeo Obrigatório",
  OPERATIONAL_UPDATE: "Atualização Operacional",
  CHECKLIST: "Checklist",
  READING: "Leitura",
  VIDEO: "Vídeo",
};

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Aguardando",
  RECEIVED: "Recebida",
  VIEWED: "Visualizada",
  COMPLETED: "Concluída",
  OVERDUE: "Atrasada",
  EXPIRED: "Expirada",
};

const STATUS_BADGES: Record<string, string> = {
  PUBLISHED: "bg-gray-100 text-gray-600",
  RECEIVED: "bg-blue-100 text-blue-700",
  VIEWED: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-green-100 text-green-700",
  OVERDUE: "bg-amber-100 text-amber-700",
  EXPIRED: "bg-amber-100 text-amber-700",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function isLate(assignment: MyDeliveryAssignmentItem): boolean {
  if (assignment.status === "COMPLETED") return false;
  return new Date(assignment.deliveryDueDate) < new Date();
}

function typeIcon(type: string) {
  if (type === "MANDATORY_READ" || type === "READING") return BookOpen;
  if (type === "CHECKLIST") return CheckSquare;
  if (type === "MANDATORY_VIDEO" || type === "VIDEO") return Video;
  return Package;
}

type Tab = "pending" | "completed" | "late";

// ─── Assignment Card ──────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  onClick,
}: {
  assignment: MyDeliveryAssignmentItem;
  onClick: () => void;
}) {
  const late = isLate(assignment);
  const Icon = typeIcon(assignment.deliveryType);
  const statusKey = late && assignment.status !== "COMPLETED" ? "OVERDUE" : assignment.status;
  const statusBadge = STATUS_BADGES[statusKey] ?? "bg-gray-100 text-gray-600";
  const statusLabel =
    late && assignment.status !== "COMPLETED"
      ? "Atrasada"
      : STATUS_LABELS[assignment.status] ?? assignment.status;

  return (
    <Card
      className="cursor-pointer hover:shadow-sm transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold line-clamp-2">{assignment.deliveryTitle}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-violet-50 text-violet-700">
              {TYPE_LABELS[assignment.deliveryType] ?? assignment.deliveryType}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
            <Clock className="w-3 h-3" />
            Prazo: {fmtDate(assignment.deliveryDueDate)}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function AssignmentDetailDialog({
  assignment,
  onClose,
}: {
  assignment: MyDeliveryAssignmentItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const viewMut = useViewDelivery();
  const completeMut = useCompleteDelivery();
  const checklistMut = useUpdateDeliveryChecklist();

  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>(
    assignment.checklistProgress ?? {}
  );

  const deliveryId = assignment.deliveryId;
  const isChecklist = assignment.deliveryType === "CHECKLIST";
  const items = assignment.deliveryChecklistItems ?? [];
  const isDone = assignment.status === "COMPLETED";
  const late = isLate(assignment);

  const allChecked = items.length > 0 && items.every((i) => checklistProgress[i.id]);

  const handleView = useCallback(() => {
    if (assignment.status !== "PUBLISHED" && assignment.status !== "RECEIVED") return;
    viewMut.mutate(
      { deliveryId },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() }) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment.status, deliveryId]);

  const handleComplete = useCallback(() => {
    completeMut.mutate(
      { deliveryId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() });
          onClose();
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  const toggleItem = (itemId: string) => {
    const newProgress = { ...checklistProgress, [itemId]: !checklistProgress[itemId] };
    setChecklistProgress(newProgress);
    checklistMut.mutate(
      { deliveryId, data: { progress: newProgress } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() }) }
    );
  };

  // Auto-mark as viewed when opening
  useEffect(() => {
    if (assignment.status === "PUBLISHED" || assignment.status === "RECEIVED") {
      handleView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{assignment.deliveryTitle}</DialogTitle>
          <p className="text-xs font-semibold text-violet-600">
            {TYPE_LABELS[assignment.deliveryType] ?? assignment.deliveryType}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status box */}
          <div className="rounded-lg border divide-y">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-medium">
                {isDone ? "✓ Concluída" : STATUS_LABELS[assignment.status] ?? assignment.status}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Prazo</span>
              <span className={`text-sm font-medium ${late && !isDone ? "text-amber-600" : ""}`}>
                {fmtDate(assignment.deliveryDueDate)}
                {late && !isDone ? " ⚠ Atrasada" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Prazo Máximo</span>
              <span className="text-sm font-medium">{fmtDate(assignment.deliveryMaxDueDate)}</span>
            </div>
          </div>

          {/* Description */}
          {assignment.deliveryDescription && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Descrição
              </p>
              <p className="text-sm whitespace-pre-wrap">{assignment.deliveryDescription}</p>
            </div>
          )}

          {/* Checklist */}
          {isChecklist && items.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Checklist
              </p>
              <div className="rounded-lg border divide-y">
                {items.map((item) => {
                  const checked = !!checklistProgress[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isDone}
                      onClick={() => !isDone && toggleItem(item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default hover:bg-muted/40 transition-colors"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          checked ? "bg-violet-600 border-violet-600" : "border-input"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span
                        className={`text-sm ${
                          checked ? "text-muted-foreground line-through" : ""
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

          {/* CTA */}
          {!isDone && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleComplete}
              disabled={completeMut.isPending || (isChecklist && !allChecked)}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {completeMut.isPending
                ? "Concluindo..."
                : isChecklist && !allChecked
                  ? `Conclua todos os ${items.length} itens`
                  : "Confirmar Conclusão"}
            </Button>
          )}

          {isDone && (
            <div className="flex flex-col items-center gap-2 py-4 text-green-600">
              <CheckCircle2 className="w-7 h-7" />
              <p className="text-sm font-semibold">Concluída em {fmtDate(assignment.completedAt)}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MinhasEntregasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<MyDeliveryAssignmentItem | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useGetMyDeliveries();
  const all = (data?.assignments ?? []) as MyDeliveryAssignmentItem[];

  const pending = all.filter(
    (a) =>
      a.status !== "COMPLETED" &&
      !isLate(a) &&
      a.status !== "OVERDUE" &&
      a.status !== "EXPIRED"
  );
  const completed = all.filter((a) => a.status === "COMPLETED");
  const late = all.filter(
    (a) =>
      a.status !== "COMPLETED" &&
      (isLate(a) || a.status === "OVERDUE" || a.status === "EXPIRED")
  );

  const counts: Record<Tab, number> = {
    pending: pending.length,
    completed: completed.length,
    late: late.length,
  };
  const displayed = tab === "pending" ? pending : tab === "completed" ? completed : late;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() });
    refetch();
  };

  const FILTER_TABS: { key: Tab; label: string }[] = [
    { key: "pending", label: "Pendentes" },
    { key: "completed", label: "Concluídas" },
    { key: "late", label: "Atrasadas" },
  ];

  const EmptyIcon = tab === "completed" ? CheckCircle2 : tab === "late" ? AlertCircle : Inbox;
  const emptyTitle =
    tab === "pending"
      ? "Nenhuma entrega pendente no momento"
      : tab === "completed"
        ? "Nenhuma entrega concluída ainda"
        : "Nenhuma entrega em atraso — tudo em dia!";
  const emptySubtitle =
    tab === "pending"
      ? "Você está em dia!"
      : tab === "completed"
        ? "Conclua suas entregas para vê-las aqui"
        : "Ótimo! Tudo em dia.";

  return (
    <AdminLayout title="Minhas Entregas" subtitle="Conteúdos e leituras obrigatórias">
      <div className="max-w-3xl space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {FILTER_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {counts[t.key] > 0 ? ` (${counts[t.key]})` : ""}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
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
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Não foi possível carregar suas entregas.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <EmptyIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">{emptyTitle}</p>
            <p className="text-sm text-muted-foreground mt-1">{emptySubtitle}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((a) => (
              <AssignmentCard key={a.id} assignment={a} onClick={() => setSelected(a)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <AssignmentDetailDialog assignment={selected} onClose={() => setSelected(null)} />
      )}
    </AdminLayout>
  );
}
