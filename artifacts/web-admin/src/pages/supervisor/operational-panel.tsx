import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOperationalPanel,
  useListCheckIns,
  useGetCheckInSummary,
  useUpdateCheckIn,
  getListCheckInsQueryKey,
  getGetCheckInSummaryQueryKey,
  useListTasks,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type {
  OperationalHealth,
  OperationalException,
  OperationalPendingBook,
  OperationalUpcomingEvent,
  CheckInItem,
  CheckInSummary,
  TaskItem,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, AlertTriangle, BookMarked, CalendarDays,
  CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw, Layers,
  UserCheck, Users, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  HEALTH_CONFIG,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_BADGES,
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPE_BADGES,
} from "@/lib/operational-constants";

// ─── Health icon map ───────────────────────────────────────────────────────────

const HEALTH_ICONS = {
  HEALTHY:   CheckCircle2,
  ATTENTION: AlertCircle,
  RISK:      AlertTriangle,
  CRITICAL:  XCircle,
} as const;

// ─── Check-in status config ───────────────────────────────────────────────────

const CHECK_IN_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  EXPECTED:   { label: "Esperado",    color: "bg-gray-100 text-gray-600",    dot: "bg-gray-400"   },
  CHECKED_IN: { label: "Presente",    color: "bg-green-100 text-green-800",  dot: "bg-green-500"  },
  LATE:       { label: "Atrasado",    color: "bg-amber-100 text-amber-800",  dot: "bg-amber-500"  },
  ABSENT:     { label: "Ausente",     color: "bg-red-100 text-red-800",      dot: "bg-red-500"    },
  EXCUSED:    { label: "Justificado", color: "bg-blue-100 text-blue-700",    dot: "bg-blue-400"   },
};

function CheckInRow({
  item,
  onUpdate,
  isUpdating,
}: {
  item: CheckInItem;
  onUpdate: (userId: string, checkInId: string | null, status: string) => void;
  isUpdating: boolean;
}) {
  const cfg = CHECK_IN_STATUS_CONFIG[item.status] ?? CHECK_IN_STATUS_CONFIG.EXPECTED;
  return (
    <div className="px-6 py-3 flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.userName}</p>
        <div className="flex gap-3 mt-0.5">
          {item.earliestStart && (
            <span className="text-xs text-muted-foreground">Escala {item.earliestStart.slice(0, 5)}</span>
          )}
          {item.checkedInAt && (
            <span className="text-xs text-muted-foreground">
              ✓ {new Date(item.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
        {cfg.label}
      </span>
      {item.userId && (
        <div className="flex gap-1 shrink-0">
          {item.status !== "CHECKED_IN" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar Presente"
              disabled={isUpdating}
              onClick={() => onUpdate(item.userId!, item.checkInId, "CHECKED_IN")}>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {item.status !== "LATE" && item.status !== "CHECKED_IN" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar Atrasado"
              disabled={isUpdating}
              onClick={() => onUpdate(item.userId!, item.checkInId, "LATE")}>
              <Clock className="h-4 w-4 text-amber-500" />
            </Button>
          )}
          {item.status !== "ABSENT" && item.status !== "EXCUSED" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar Ausente"
              disabled={isUpdating}
              onClick={() => onUpdate(item.userId!, item.checkInId, "ABSENT")}>
              <XCircle className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SupervisorOperationalPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const operationId = auth.roles.find((r: { operationId?: string }) => r.operationId)?.operationId ?? "";

  const { data, isLoading, refetch, isFetching } = useGetOperationalPanel({});

  const checkInParams = { date: today, operationId };
  const { data: checkInsData, isLoading: checkInsLoading } = useListCheckIns(
    checkInParams,
    { query: { enabled: !!operationId, queryKey: getListCheckInsQueryKey(checkInParams) } }
  );
  const { data: summaryData } = useGetCheckInSummary(
    checkInParams,
    { query: { enabled: !!operationId, queryKey: getGetCheckInSummaryQueryKey(checkInParams) } }
  );
  const checkIns: CheckInItem[] = checkInsData?.checkIns ?? [];
  const summary: CheckInSummary | null = summaryData?.summary ?? null;

  const taskParams = { operationId: operationId || undefined };
  const { data: tasksData } = useListTasks(
    taskParams,
    { query: { enabled: !!operationId, queryKey: getListTasksQueryKey(taskParams) } }
  );
  const tasks: TaskItem[] = tasksData?.tasks ?? [];
  const activeTasks = tasks.filter((t) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(t.status));
  const lateTasks = activeTasks.filter((t) => new Date(t.dueDate) < new Date());
  const approvalTasks = activeTasks.filter((t) => t.status === "READY_FOR_APPROVAL");
  const criticalTasks = activeTasks.filter((t) => t.priority === "CRITICAL");

  const cargaPorResponsavel = activeTasks.reduce<Record<string, { name: string; total: number; late: number; inProgress: number }>>((acc, t) => {
    const key = t.assigneeId;
    if (!acc[key]) acc[key] = { name: t.assigneeName ?? t.assigneeId, total: 0, late: 0, inProgress: 0 };
    acc[key].total++;
    if (new Date(t.dueDate) < new Date()) acc[key].late++;
    if (t.status === "IN_PROGRESS") acc[key].inProgress++;
    return acc;
  }, {});
  const cargaList = Object.values(cargaPorResponsavel).sort((a, b) => b.late - a.late || b.total - a.total);

  const updateMutation = useUpdateCheckIn();

  function handleUpdateStatus(userId: string, checkInId: string | null, status: string) {
    updateMutation.mutate(
      { id: checkInId ?? "new", data: { status, userId, operationId, date: today } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey(checkInParams) });
          queryClient.invalidateQueries({ queryKey: getGetCheckInSummaryQueryKey(checkInParams) });
          toast({ title: "Status atualizado" });
        },
        onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
      }
    );
  }

  if (isLoading) {
    return (
      <AdminLayout title="Painel Operacional">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout title="Painel Operacional">
        <p className="text-center py-12 text-sm text-muted-foreground">Sem dados disponíveis.</p>
      </AdminLayout>
    );
  }

  const { health, exceptions, pendingBooks, upcomingEvents, generatedAt } = data;
  const cfg = HEALTH_CONFIG[health.status as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.ATTENTION;
  const HealthIcon = HEALTH_ICONS[health.status as keyof typeof HEALTH_ICONS] ?? HEALTH_ICONS.ATTENTION;

  const criticalItems = exceptions.filter(
    (e) => e.type === "OPEN_POSITION" || e.type === "CONFLICT"
  );

  const h48 = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];
  const urgentEvents = upcomingEvents.filter((e) => e.date <= h48 && (!e.hasDailyBook));

  return (
    <AdminLayout
      title="Painel Operacional"
      subtitle="O que exige minha atenção agora"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-muted-foreground">
          Atualizado às {new Date(generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Check-ins do Dia ── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> Check-ins do Dia
            <span className="ml-auto text-xs font-normal">
              {today.split("-").reverse().join("/")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                <Users className="h-3 w-3 inline mr-1" />{summary.total} total
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                <CheckCircle2 className="h-3 w-3 inline mr-1" />{summary.checkedIn} presentes
              </span>
              {summary.late > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">
                  <Clock className="h-3 w-3 inline mr-1" />{summary.late} atrasados
                </span>
              )}
              {summary.absent > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-medium">
                  <XCircle className="h-3 w-3 inline mr-1" />{summary.absent} ausentes
                </span>
              )}
              {summary.excused > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {summary.excused} justificados
                </span>
              )}
              {summary.expected > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {summary.expected} esperados
                </span>
              )}
            </div>
          )}
          {checkInsLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !operationId ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma operação vinculada ao seu perfil ainda. Peça ao administrador para configurar sua operação na ASA.
            </p>
          ) : checkIns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum membro escalado para hoje.</p>
            </div>
          ) : (
            <div className="-mx-6 divide-y max-h-64 overflow-y-auto">
              {checkIns.map((item) => (
                <CheckInRow
                  key={item.userId ?? item.checkInId ?? item.userName}
                  item={item}
                  onUpdate={handleUpdateStatus}
                  isUpdating={updateMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Saúde — banner proeminente ── */}
      <div className={`rounded-xl border-l-4 ${cfg.borderL} ${cfg.bg} p-5 mb-6 flex items-start gap-4`}>
        <HealthIcon className={`h-10 w-10 ${cfg.text} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Activity className={`h-4 w-4 ${cfg.text}`} />
            <span className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</span>
          </div>
          <ul className="space-y-1">
            {health.reasons.map((r, i) => (
              <li key={i} className={`text-sm ${cfg.text}/90`}>• {r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Ações urgentes — eventos em 48h sem Livro publicado ── */}
      {urgentEvents.length > 0 && (
        <Card className="border-red-200 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Ação Imediata — Eventos sem Livro publicado (48h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {urgentEvents.map((ev: OperationalUpcomingEvent) => (
                <div key={ev.id} className="px-6 py-3 bg-red-50/50 flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ev.title}</p>
                    <p className="text-xs text-red-600">
                      {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                      {ev.startTime && ` às ${ev.startTime.slice(0, 5)}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ev.hasScale ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}>
                      {ev.hasScale ? "Escala ✓" : "Sem escala"}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      Livro pendente
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grid: Livros Pendentes + Conflitos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookMarked className="h-4 w-4" /> Livros Não Publicados
              {pendingBooks.length > 0 && (
                <span className="ml-auto bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {pendingBooks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingBooks.length === 0 ? (
              <div className="px-6 py-5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-600">Todos publicados</p>
              </div>
            ) : (
              <div className="divide-y max-h-56 overflow-y-auto">
                {pendingBooks.map((book: OperationalPendingBook) => (
                  <div key={book.id} className="px-6 py-3 flex items-center gap-3">
                    <BookMarked className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.eventTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(book.eventDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full shrink-0">
                      Rascunho
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Conflitos e Posições Abertas
              {criticalItems.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-800 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {criticalItems.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {criticalItems.length === 0 ? (
              <div className="px-6 py-5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-600">Sem conflitos ou abertos</p>
              </div>
            ) : (
              <div className="divide-y max-h-56 overflow-y-auto">
                {criticalItems.map((ex: OperationalException) => (
                  <div key={ex.id} className="px-6 py-3">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${EXCEPTION_TYPE_BADGES[ex.type] ?? "bg-muted text-muted-foreground"}`}>
                        {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                      </span>
                      {ex.positionName && (
                        <span className="text-sm font-medium truncate">{ex.positionName}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{ex.reason}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {ex.eventTitle && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{ex.eventTitle}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {new Date(ex.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Próximos eventos ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Agenda (próximos 14 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingEvents.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Nenhum evento próximo na agenda da operação.</p>
          ) : (
            <div className="divide-y max-h-72 overflow-y-auto">
              {upcomingEvents.map((ev: OperationalUpcomingEvent) => {
                const isUrgent = ev.date <= h48 && !ev.hasDailyBook;
                return (
                  <div key={ev.id} className={`px-6 py-3 flex items-center gap-3 ${isUrgent ? "bg-red-50/40" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{ev.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${EVENT_TYPE_BADGES[ev.type] ?? "bg-muted text-muted-foreground"}`}>
                          {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                        {ev.startTime && ` • ${ev.startTime.slice(0, 5)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ev.coveragePct !== null && ev.coveragePct !== undefined && (
                        <span className={`text-xs font-medium ${ev.coveragePct >= 100 ? "text-green-600" : ev.coveragePct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                          {ev.coveragePct.toFixed(0)}%
                        </span>
                      )}
                      <Layers className={`h-3.5 w-3.5 ${ev.hasScale ? "text-violet-500" : "text-muted-foreground/40"}`} />
                      <BookMarked className={`h-3.5 w-3.5 ${ev.hasDailyBook ? "text-blue-500" : "text-muted-foreground/40"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tarefas Operacionais (T002/T006) ── */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Tarefas Operacionais
            {lateTasks.length > 0 && (
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {lateTasks.length} atrasada{lateTasks.length > 1 ? "s" : ""}
              </span>
            )}
            {lateTasks.length === 0 && approvalTasks.length > 0 && (
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {approvalTasks.length} ag. aprovação
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!operationId ? (
            <p className="px-6 py-4 text-sm text-muted-foreground text-center">Operação não vinculada ao perfil.</p>
          ) : activeTasks.length === 0 ? (
            <div className="px-6 py-6 flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm text-green-600 font-medium">Nenhuma tarefa ativa</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 px-6 pt-4 pb-3">
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                  {activeTasks.length} ativas
                </span>
                {approvalTasks.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-medium">
                    {approvalTasks.length} ag. aprovação
                  </span>
                )}
                {lateTasks.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                    {lateTasks.length} atrasada{lateTasks.length > 1 ? "s" : ""}
                  </span>
                )}
                {criticalTasks.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-800 font-medium border border-red-200">
                    {criticalTasks.length} crítica{criticalTasks.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="divide-y max-h-56 overflow-y-auto">
                {activeTasks.slice(0, 8).map((t) => {
                  const isLate = new Date(t.dueDate) < new Date();
                  return (
                    <div key={t.id} className={`px-6 py-3 flex items-start gap-2 ${isLate ? "bg-red-50/30" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            t.priority === "CRITICAL" ? "bg-red-100 text-red-800"
                            : t.priority === "HIGH" ? "bg-orange-100 text-orange-800"
                            : t.priority === "MEDIUM" ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-600"
                          }`}>
                            {t.priority === "CRITICAL" ? "Crítica" : t.priority === "HIGH" ? "Alta" : t.priority === "MEDIUM" ? "Média" : "Baixa"}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            t.status === "READY_FOR_APPROVAL" ? "bg-violet-100 text-violet-700"
                            : t.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700"
                            : t.status === "CHANGES_REQUESTED" ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                          }`}>
                            {t.status === "READY_FOR_APPROVAL" ? "Ag. aprovação"
                              : t.status === "IN_PROGRESS" ? "Em andamento"
                              : t.status === "CHANGES_REQUESTED" ? "Revisar"
                              : "Criada"}
                          </span>
                          {t.assigneeName && (
                            <span className="text-xs text-muted-foreground">{t.assigneeName}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-xs font-medium ${isLate ? "text-red-600" : "text-muted-foreground"}`}>
                          {isLate ? "⚠ " : ""}
                          {new Date(t.dueDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Carga Operacional por Responsável (T007) ── */}
      {cargaList.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Carga Operacional por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-64 overflow-y-auto">
              {cargaList.map((item) => (
                <div key={item.name} className="px-6 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {item.total} tarefa{item.total > 1 ? "s" : ""}
                    </span>
                    {item.inProgress > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {item.inProgress} em andamento
                      </span>
                    )}
                    {item.late > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                        {item.late} atrasada{item.late > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}
