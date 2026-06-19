import {
  useGetMyDay,
  getGetMyDayQueryKey,
  useGetMyTasks,
  getGetMyTasksQueryKey,
  useListFolgas,
} from "@workspace/api-client-react";
import type { MyDayActivity, MyDayResponse, TaskItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import {
  Zap,
  ArrowRightCircle,
  Calendar,
  TrendingUp,
  Info,
  Clock,
  MapPin,
  UserCheck,
  Briefcase,
  RefreshCw,
  AlertTriangle,
  Bell,
  BookOpen,
  Video,
  CheckSquare,
  Package,
  AlertCircle,
  Palmtree,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_BADGES,
  ALLOCATION_STATUS_LABELS,
} from "@/lib/operational-constants";

// ─── Constants (local only — not in shared constants) ─────────────────────────

const ALLOCATION_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-green-100 text-green-700 border-green-200",
  OPEN: "bg-gray-100 text-gray-600 border-gray-200",
  CONFLICT: "bg-amber-100 text-amber-700 border-amber-200",
  MANUAL_OVERRIDE: "bg-purple-100 text-purple-700 border-purple-200",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  LEAVE: "Folga",
  ROLE_RESTRICTION: "Restrição de Papel",
  PHYSICAL_RESTRICTION: "Restrição Física",
  HEALTH_RESTRICTION: "Restrição de Saúde",
  SCHEDULE_CHANGE: "Mudança de Horário",
  SWAP: "Troca",
  OTHER: "Outro",
};

// ─── Task constants ───────────────────────────────────────────────────────────

const TASK_PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};
const TASK_PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa",
};
const TASK_PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH:     "bg-orange-100 text-orange-800",
  MEDIUM:   "bg-amber-100 text-amber-800",
  LOW:      "bg-gray-100 text-gray-600",
};
const TASK_STATUS_LABELS: Record<string, string> = {
  CREATED:              "Criada",
  IN_PROGRESS:          "Em andamento",
  READY_FOR_APPROVAL:   "Ag. aprovação",
  CHANGES_REQUESTED:    "Revisar",
  APPROVED:             "Aprovada",
  COMPLETED:            "Concluída",
  CANCELLED:            "Cancelada",
  EXPIRED:              "Expirada",
};
const TASK_STATUS_BADGES: Record<string, string> = {
  CREATED:              "bg-gray-100 text-gray-600",
  IN_PROGRESS:          "bg-blue-100 text-blue-700",
  READY_FOR_APPROVAL:   "bg-violet-100 text-violet-700",
  CHANGES_REQUESTED:    "bg-amber-100 text-amber-700",
  APPROVED:             "bg-green-100 text-green-700",
  COMPLETED:            "bg-green-100 text-green-700",
  CANCELLED:            "bg-gray-100 text-gray-500",
  EXPIRED:              "bg-red-100 text-red-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function dayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ activity, highlighted = false }: { activity: MyDayActivity; highlighted?: boolean }) {
  const isRepublished = activity.scaleStatus === "REPUBLISHED" || activity.dailyBook?.status === "REPUBLISHED";
  const republishDelta = activity.dailyBook?.republishedDelta;
  const statusClass = ALLOCATION_STATUS_COLORS[activity.allocationStatus] ?? "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <Card className={highlighted ? "border-2 border-primary shadow-md" : "border"}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {highlighted && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-bold tracking-wide">
                AGORA
              </Badge>
            )}
            <Badge variant="outline" className="text-xs font-semibold">
              {isToday(activity.eventDate) ? "Hoje" : formatDate(activity.eventDate)}
            </Badge>
            {isRepublished && (
              <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs gap-1">
                <RefreshCw className="w-3 h-3" />
                Republicado
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={`text-xs ${statusClass}`}>
            {ALLOCATION_STATUS_LABELS[activity.allocationStatus] ?? activity.allocationStatus}
          </Badge>
        </div>

        {/* Event title */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {EVENT_TYPE_LABELS[activity.eventType] ?? activity.eventType}
          </span>
        </div>
        <h3 className="text-base font-semibold leading-tight">{activity.eventTitle}</h3>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {activity.eventStartTime && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTime(activity.eventStartTime)}
              {activity.eventEndTime ? ` — ${formatTime(activity.eventEndTime)}` : ""}
            </div>
          )}
          {activity.eventLocation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {activity.eventLocation}
            </div>
          )}
          {activity.positionName && (
            <div className="flex items-center gap-1 text-xs text-primary font-medium">
              <UserCheck className="w-3 h-3" />
              {activity.positionName}
            </div>
          )}
          {(activity.operationName || activity.groupName) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Briefcase className="w-3 h-3" />
              {[activity.operationName, activity.groupName].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        {/* Daily book assignments */}
        {activity.dailyBook && activity.dailyBook.myAssignments.length > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              Livro do Dia — v{activity.dailyBook.version}
            </p>
            {activity.dailyBook.myAssignments.map((a) => (
              <p key={a.assignmentId} className="text-sm text-foreground">
                · {a.positionName}
              </p>
            ))}
          </div>
        )}

        {/* Republish delta */}
        {isRepublished && republishDelta && Object.keys(republishDelta).length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-700">O que mudou (ERA → AGORA)</span>
            </div>
            {Object.entries(republishDelta).map(([key, val]) => (
              <div key={key} className="flex gap-2 text-xs text-amber-700">
                <span className="font-semibold">{key}:</span>
                <span>{JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 bg-muted/30">
      <p className="text-sm text-muted-foreground text-center">{message}</p>
    </div>
  );
}

// ─── Pending Notice Card ───────────────────────────────────────────────────────

function PendingNoticeCard({ notice }: { notice: any }) {
  const urgCfg: Record<string, { border: string; bg: string; badge: string; label: string; Icon: React.ComponentType<any> }> = {
    INFORMATIVE: { border: "border-l-blue-400",  bg: "bg-blue-50/60",  badge: "bg-blue-100 text-blue-800",   label: "Informativo", Icon: Info },
    IMPORTANT:   { border: "border-l-amber-400", bg: "bg-amber-50/60", badge: "bg-amber-100 text-amber-800", label: "Importante",  Icon: AlertCircle },
    CRITICAL:    { border: "border-l-red-500",   bg: "bg-red-50/60",   badge: "bg-red-100 text-red-800",     label: "Crítico",     Icon: AlertTriangle },
  };
  const uc = urgCfg[notice.urgency] ?? urgCfg.INFORMATIVE;
  const UrgIcon = uc.Icon;
  const isUnread = notice.recipientStatus !== "CONFIRMED" && notice.recipientStatus !== "VIEWED";

  return (
    <Card className={`border-l-4 ${uc.border} ${uc.bg}`}>
      <CardContent className="p-3 flex items-start gap-3">
        <UrgIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          {notice.title && <p className="text-sm font-semibold truncate mb-0.5">{notice.title}</p>}
          <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${uc.badge}`}>{uc.label}</span>
          {notice.type === "ESCALATED" && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Escalado</span>
          )}
          {notice.requiresConfirmation && isUnread && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">Confirmar</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeuDiaPage() {
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: folgasHoje } = useListFolgas({ dateFrom: today, dateTo: today, status: "ACTIVE" });
  const ausenciasHoje = folgasHoje?.folgas ?? [];

  const { data, isLoading, isError, refetch, isFetching } = useGetMyDay({
    query: {
      queryKey: getGetMyDayQueryKey(),
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetMyDayQueryKey() });
    refetch();
  };

  const { data: myTasksData } = useGetMyTasks(
    undefined,
    { query: { queryKey: getGetMyTasksQueryKey() } }
  );
  const myTasks: TaskItem[] = myTasksData?.tasks ?? [];
  const activeTasks = myTasks
    .filter((t) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(t.status))
    .sort((a, b) => TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority]);

  return (
    <AdminLayout title="Meu Dia" subtitle={dayLabel()}>
      <div className="max-w-3xl space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : isError || !data ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Não foi possível carregar o Meu Dia.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* ── Avisos Pendentes ── */}
            {(data as any).pendingNotices && (data as any).pendingNotices.length > 0 && (
              <>
                <SectionHeader title="Avisos Pendentes" icon={Bell} />
                <div className="space-y-2">
                  {((data as any).pendingNotices as any[]).map((n) => (
                    <PendingNoticeCard key={n.id} notice={n} />
                  ))}
                </div>
              </>
            )}

            {/* ── Nível 1: Ação Imediata ── */}
            <SectionHeader title="Ação Imediata" icon={Zap} />
            {data.immediateAction ? (
              <ActivityCard activity={data.immediateAction} highlighted />
            ) : (
              <EmptyState message="Nenhuma atividade imediata." />
            )}

            {/* ── Nível 2: Próxima Atividade ── */}
            <SectionHeader title="Próxima Atividade" icon={ArrowRightCircle} />
            {data.nextActivity ? (
              <ActivityCard activity={data.nextActivity} />
            ) : (
              <EmptyState message="Sem próxima atividade programada." />
            )}

            {/* ── Nível 3: Hoje ── */}
            <SectionHeader title="Hoje" icon={Calendar} />
            {data.todayActivities.length > 0 ? (
              <div className="space-y-3">
                {data.todayActivities.map((act) => (
                  <ActivityCard key={act.allocationId} activity={act} />
                ))}
              </div>
            ) : (
              <EmptyState message="Nenhuma atividade para hoje." />
            )}

            {/* Future activities */}
            {data.futureActivities.length > 0 && (
              <>
                <SectionHeader title="Próximos Dias" icon={TrendingUp} />
                <div className="space-y-3">
                  {data.futureActivities.map((act) => (
                    <ActivityCard key={act.allocationId} activity={act} />
                  ))}
                </div>
              </>
            )}

            {/* ── Nível 4: Informações Complementares ── */}
            <SectionHeader title="Informações Complementares" icon={Info} />

            {/* Pending requests */}
            {data.complementaryInfo.pendingRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground ml-1">Solicitações em andamento</p>
                {data.complementaryInfo.pendingRequests.map((req) => (
                  <Card key={req.requestId}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.targetDates.map(formatDate).join(", ")}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{req.reason}</p>
                        )}
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap text-xs">
                        {req.status === "PENDING" ? "Pendente" : "Alt. Proposta"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Upcoming deliveries */}
            {data.complementaryInfo.upcomingDeliveries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground ml-1">Entregas futuras</p>
                {data.complementaryInfo.upcomingDeliveries.map((del) => (
                  <Card key={del.assignmentId}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium line-clamp-1">{del.title}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Clock className="w-3 h-3" />
                            Até {formatDate(del.dueDate)}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">{del.type}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {data.complementaryInfo.pendingRequests.length === 0 &&
              data.complementaryInfo.upcomingDeliveries.length === 0 && (
                <EmptyState message="Nenhuma solicitação pendente ou entrega futura." />
              )}

            {/* ── Minhas Tarefas (T001) ── */}
            {activeTasks.length > 0 && (
              <>
                <SectionHeader title="Minhas Tarefas" icon={CheckSquare} />
                <div className="space-y-2">
                  {activeTasks.slice(0, 6).map((t) => {
                    const isLate = new Date(t.dueDate) < new Date();
                    return (
                      <Card key={t.id} className={isLate ? "border-red-200 bg-red-50/30" : ""}>
                        <CardContent className="p-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold line-clamp-1">{t.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TASK_PRIORITY_BADGES[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                                {TASK_PRIORITY_LABELS[t.priority] ?? t.priority}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TASK_STATUS_BADGES[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {TASK_STATUS_LABELS[t.status] ?? t.status}
                              </span>
                              {t.operationName && (
                                <span className="text-xs text-muted-foreground">{t.operationName}</span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-xs font-medium whitespace-nowrap ${isLate ? "text-red-600" : "text-muted-foreground"}`}>
                              {isLate ? "⚠ " : ""}
                              Até {new Date(t.dueDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Ausências de Hoje ── */}
            {ausenciasHoje.length > 0 && (
              <>
                <SectionHeader title="Ausências de Hoje" icon={Palmtree} />
                <div className="space-y-2">
                  {ausenciasHoje.map((f) => (
                    <Card key={f.id}>
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{f.userName}</p>
                          {f.operationName && (
                            <p className="text-xs text-muted-foreground">{f.operationName}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs bg-green-50 text-green-700 border-green-200">
                          {f.type === "DAY_OFF" ? "Folga" : f.type === "NO_SHOW" ? "No-show" : f.type === "RECESSO" ? "Recesso" : f.type === "AFASTAMENTO" ? "Afastamento" : f.type}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground text-right">
              Atualizado às {new Date(data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
