import { useState } from "react";
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
  GroupCoverage,
  EventCoverage,
  CheckInItem,
  CheckInSummary,
  TaskItem,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, BookMarked, CalendarDays,
  CheckCircle2, XCircle, AlertCircle, Clock, Layers,
  TrendingUp, RefreshCw, UserCheck, Users, ClipboardList,
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

// ─── Check-in status config ───────────────────────────────────────────────────

const CHECK_IN_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  EXPECTED:   { label: "Esperado",    color: "bg-gray-100 text-gray-600",    dot: "bg-gray-400"   },
  CHECKED_IN: { label: "Presente",    color: "bg-green-100 text-green-800",  dot: "bg-green-500"  },
  LATE:       { label: "Atrasado",    color: "bg-amber-100 text-amber-800",  dot: "bg-amber-500"  },
  ABSENT:     { label: "Ausente",     color: "bg-red-100 text-red-800",      dot: "bg-red-500"    },
  EXCUSED:    { label: "Justificado", color: "bg-blue-100 text-blue-700",    dot: "bg-blue-400"   },
};

// ─── CheckInRow ───────────────────────────────────────────────────────────────

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
          {item.excuseReason && (
            <span className="text-xs text-blue-600 truncate max-w-[120px]">{item.excuseReason}</span>
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

// ─── Health icon map (icons are not in shared constants) ──────────────────────

const HEALTH_ICONS = {
  HEALTHY:   CheckCircle2,
  ATTENTION: AlertCircle,
  RISK:      AlertTriangle,
  CRITICAL:  XCircle,
} as const;

function HealthCard({ health }: { health: OperationalHealth }) {
  const cfg = HEALTH_CONFIG[health.status as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.ATTENTION;
  const Icon = HEALTH_ICONS[health.status as keyof typeof HEALTH_ICONS] ?? HEALTH_ICONS.ATTENTION;
  return (
    <Card className={`${cfg.border} border-2`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" /> Saúde Operacional
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`flex items-center gap-3 p-3 rounded-lg ${cfg.bg}`}>
          <Icon className={`h-8 w-8 ${cfg.text} shrink-0`} />
          <div>
            <p className={`text-xl font-bold ${cfg.text}`}>{cfg.label}</p>
            <ul className="mt-1 space-y-0.5">
              {health.reasons.map((r, i) => (
                <li key={i} className={`text-xs ${cfg.text}/80`}>• {r}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

function CoverageBar({ pct, status }: { pct: number; status: string }) {
  const color = status === "COMPLETE" ? "bg-green-500" : status === "PARTIAL" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

const COVERAGE_LABELS: Record<string, string> = {
  COMPLETE: "Completa", PARTIAL: "Parcial", INSUFFICIENT: "Insuficiente",
};
const COVERAGE_BADGE: Record<string, string> = {
  COMPLETE: "bg-green-100 text-green-800", PARTIAL: "bg-amber-100 text-amber-800", INSUFFICIENT: "bg-red-100 text-red-800",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminOperationalPanel() {
  const [coverageTab, setCoverageTab] = useState("byGroup");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const today = new Date().toISOString().slice(0, 10);
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

  const updateMutation = useUpdateCheckIn();

  function handleUpdateStatus(userId: string, checkInId: string | null, status: string) {
    updateMutation.mutate(
      {
        id: checkInId ?? "new",
        data: { status, userId, operationId, date: today },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey({ date: today, operationId }) });
          queryClient.invalidateQueries({ queryKey: getGetCheckInSummaryQueryKey({ date: today, operationId }) });
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
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Consolidando dados operacionais…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout title="Painel Operacional">
        <div className="text-center py-12 text-muted-foreground text-sm">Aguardando dados do painel operacional. Verifique se há operações ativas configuradas.</div>
      </AdminLayout>
    );
  }

  const { health, coverage, exceptions, pendingBooks, upcomingEvents, generatedAt } = data;

  const criticalExceptions = exceptions.filter((e) =>
    e.type === "OPEN_POSITION" || e.type === "CONFLICT"
  );

  return (
    <AdminLayout
      title="Painel Operacional"
      subtitle="Visão consolidada da saúde operacional em tempo real"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-muted-foreground">
          Atualizado em {new Date(generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Linha 1: Saúde / Cobertura / Exceções ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <HealthCard health={health} />

        {/* Coverage summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Cobertura Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">
              {coverage.overall.pct.toFixed(0)}%
            </div>
            <CoverageBar pct={coverage.overall.pct} status={coverage.overall.status} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {coverage.overall.covered}/{coverage.overall.total} posições cobertas
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${COVERAGE_BADGE[coverage.overall.status]}`}>
                {COVERAGE_LABELS[coverage.overall.status]}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Exceptions summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Exceções Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{exceptions.length}</div>
            <div className="space-y-1.5">
              {criticalExceptions.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-600 font-medium">Críticas (conflitos + abertos)</span>
                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{criticalExceptions.length}</span>
                </div>
              )}
              {pendingBooks.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-600 font-medium">Livros não publicados</span>
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{pendingBooks.length}</span>
                </div>
              )}
              {exceptions.length === 0 && pendingBooks.length === 0 && (
                <p className="text-xs text-green-600">Nenhuma exceção ativa</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 2: Agenda Próxima + Livros Pendentes ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Agenda Próxima
              <span className="ml-auto text-xs font-normal">próximos 14 dias</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingEvents.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Nenhum evento próximo na agenda da operação.</p>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {upcomingEvents.map((ev: OperationalUpcomingEvent) => (
                  <div key={ev.id} className="px-6 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{ev.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${EVENT_TYPE_BADGES[ev.type] ?? "bg-muted text-muted-foreground"}`}>
                          {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {ev.startTime && ` • ${ev.startTime.slice(0, 5)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {ev.coveragePct !== null && ev.coveragePct !== undefined && (
                        <span className={`text-xs font-medium ${ev.coveragePct >= 100 ? "text-green-600" : ev.coveragePct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                          {ev.coveragePct.toFixed(0)}%
                        </span>
                      )}
                      <div className="flex gap-1">
                        <span title="Escala" className={`text-xs px-1 rounded ${ev.hasScale ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}>E</span>
                        <span title="Livro do Dia" className={`text-xs px-1 rounded ${ev.hasDailyBook ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>L</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Books */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookMarked className="h-4 w-4" /> Livros Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingBooks.length === 0 ? (
              <div className="px-6 py-6 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm text-green-600 font-medium">Todos os Livros publicados</p>
              </div>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {pendingBooks.map((book: OperationalPendingBook) => (
                  <div key={book.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1 mr-2">{book.eventTitle}</span>
                      <span className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        Rascunho
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(book.eventDate + "T00:00:00").toLocaleDateString("pt-BR")} • v{book.version}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Linha 3: Check-ins do Dia ── */}
      <div className="mb-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Status do Dia
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {today.split("-").reverse().join("/")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary pills */}
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
            {/* List */}
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
              <div className="-mx-6 divide-y max-h-72 overflow-y-auto">
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
      </div>

      {/* ── Linha 4: Cobertura Detalhada + Exceções ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Coverage detail */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" /> Cobertura Detalhada
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={coverageTab} onValueChange={setCoverageTab}>
              <TabsList className="w-full rounded-none border-b bg-transparent h-auto px-6 py-0 gap-4">
                <TabsTrigger value="byGroup" className="text-xs py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                  Por Grupo
                </TabsTrigger>
                <TabsTrigger value="byEvent" className="text-xs py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                  Por Evento
                </TabsTrigger>
              </TabsList>
              <TabsContent value="byGroup" className="mt-0">
                {coverage.byGroup.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">Sem dados de grupo</p>
                ) : (
                  <div className="divide-y max-h-56 overflow-y-auto">
                    {coverage.byGroup.map((g: GroupCoverage) => (
                      <div key={g.groupId} className="px-6 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium truncate flex-1 mr-2">{g.groupName}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{g.covered}/{g.total}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${COVERAGE_BADGE[g.status]}`}>
                              {g.pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <CoverageBar pct={g.pct} status={g.status} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="byEvent" className="mt-0">
                {coverage.byEvent.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">Sem dados de evento</p>
                ) : (
                  <div className="divide-y max-h-56 overflow-y-auto">
                    {coverage.byEvent.map((e: EventCoverage) => (
                      <div key={e.eventId} className="px-6 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex-1 mr-2 min-w-0">
                            <p className="text-sm font-medium truncate">{e.eventTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(e.eventDate + "T00:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{e.covered}/{e.total}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${COVERAGE_BADGE[e.status]}`}>
                              {e.pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <CoverageBar pct={e.pct} status={e.status} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Exceptions list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Exceções ({exceptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {exceptions.length === 0 ? (
              <div className="px-6 py-6 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm text-green-600 font-medium">Nenhuma exceção ativa</p>
              </div>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {exceptions.map((ex: OperationalException) => (
                  <div key={ex.id} className="px-6 py-3">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${EXCEPTION_TYPE_BADGES[ex.type] ?? "bg-muted text-muted-foreground"}`}>
                        {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{ex.reason}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {ex.eventTitle && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{ex.eventTitle}</span>}
                      {ex.positionName && <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{ex.positionName}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {new Date(ex.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {ex.impact && (
                      <p className="text-xs text-amber-600 mt-1">Impacto: {ex.impact}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Tarefas Operacionais (T002/T006) ── */}
        <Card>
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
      </div>
    </AdminLayout>
  );
}
