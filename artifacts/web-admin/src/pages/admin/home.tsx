import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetOperationalPanel,
  useGetUserContext,
  useGetCheckInSummary,
  useListCheckIns,
  useListPendingRequests,
  useGetMyNotices,
  useListTasks,
  useUpdateCheckIn,
  getListCheckInsQueryKey,
  getGetCheckInSummaryQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type {
  CheckInItem,
  OperationalUpcomingEvent,
  OperationalPendingBook,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { AsaAvatar } from "@/components/AsaAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EVENT_TYPE_LABELS } from "@/lib/operational-constants";
import {
  Activity,
  AlertCircle,
  Bell,
  BookMarked,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Package,
  RefreshCw,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Greeting ─────────────────────────────────────────────────────────────────

function Greeting({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-4 mb-6 p-5 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
      <AsaAvatar size="medium" pose="bomdia" />
      <div>
        <p className="text-xl font-serif font-bold text-foreground">Olá, {name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          O que precisa de atenção hoje
        </p>
      </div>
    </div>
  );
}

// ─── Check-in row ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  EXPECTED:   { label: "Aguardando", color: "bg-gray-100 text-gray-600",   dot: "bg-gray-400"  },
  CHECKED_IN: { label: "Presente",   color: "bg-green-100 text-green-800", dot: "bg-green-500" },
  LATE:       { label: "Atrasado",   color: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  ABSENT:     { label: "Ausente",    color: "bg-red-100 text-red-800",     dot: "bg-red-500"   },
  EXCUSED:    { label: "Justificado",color: "bg-blue-100 text-blue-700",   dot: "bg-blue-400"  },
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
  const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.EXPECTED;
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.userName}</p>
        {item.earliestStart && (
          <span className="text-xs text-muted-foreground">
            Entrada {item.earliestStart.slice(0, 5)}
          </span>
        )}
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
        {cfg.label}
      </span>
      {item.userId && (
        <div className="flex gap-1 shrink-0">
          {item.status !== "CHECKED_IN" && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              title="Marcar presente" disabled={isUpdating}
              onClick={() => onUpdate(item.userId!, item.checkInId, "CHECKED_IN")}
            >
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {item.status !== "ABSENT" && item.status !== "EXCUSED" && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              title="Marcar ausente" disabled={isUpdating}
              onClick={() => onUpdate(item.userId!, item.checkInId, "ABSENT")}
            >
              <XCircle className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Manager home (Admin + Supervisor) ────────────────────────────────────────

function ManagerHome({ isSupervisor }: { isSupervisor: boolean }) {
  const [, setLocation] = useLocation();
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: context } = useGetUserContext({});
  const operationId =
    roles.find((r) => r.operationId)?.operationId ??
    context?.operations?.[0]?.id ??
    "";

  const today = new Date().toISOString().slice(0, 10);
  const enabled = !!operationId;

  const { data: panelData, refetch, isFetching } = useGetOperationalPanel({});
  const { data: checkInsData, isLoading: checkInsLoading } = useListCheckIns(
    { date: today, operationId },
    { query: { enabled, queryKey: getListCheckInsQueryKey({ date: today, operationId }) } }
  );
  const { data: summaryData } = useGetCheckInSummary(
    { date: today, operationId },
    { query: { enabled, queryKey: getGetCheckInSummaryQueryKey({ date: today, operationId }) } }
  );
  const { data: requestsData } = useListPendingRequests(
    { operationId } as any,
    { query: { enabled } as any }
  );
  const { data: tasksData } = useListTasks(
    { operationId: operationId || undefined },
    { query: { enabled, queryKey: getListTasksQueryKey({ operationId: operationId || undefined }) } }
  );

  const checkIns: CheckInItem[] = checkInsData?.checkIns ?? [];
  const summary = (summaryData?.summary ?? null) as any;
  const pendingRequests = requestsData?.requests ?? [];
  const pendingBooks: OperationalPendingBook[] = (panelData?.pendingBooks ?? []) as any;
  const upcomingEvents: OperationalUpcomingEvent[] = (panelData?.upcomingEvents ?? []) as any;
  const tasks = tasksData?.tasks ?? [];
  const activeTasks = tasks.filter(
    (t) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(t.status)
  );
  const lateTasks = activeTasks.filter((t) => new Date(t.dueDate) < new Date());
  const approvalTasks = activeTasks.filter((t) => t.status === "READY_FOR_APPROVAL");

  const updateMutation = useUpdateCheckIn();
  function handleUpdate(userId: string, checkInId: string | null, status: string) {
    updateMutation.mutate(
      { id: checkInId ?? "new", data: { status, userId, operationId, date: today } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCheckInsQueryKey({ date: today, operationId }),
          });
          queryClient.invalidateQueries({
            queryKey: getGetCheckInSummaryQueryKey({ date: today, operationId }),
          });
          toast({ title: "Status atualizado" });
        },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
      }
    );
  }

  const dailyBookHref = isSupervisor ? "/supervisor/daily-book" : "/admin/daily-book";
  const requestsHref  = isSupervisor ? "/supervisor/requests"   : "/admin/requests";
  const tasksHref     = isSupervisor ? "/supervisor/tasks"      : "/admin/tasks";

  const hasItems =
    pendingRequests.length > 0 ||
    pendingBooks.length > 0 ||
    lateTasks.length > 0 ||
    approvalTasks.length > 0;

  return (
    <div className="space-y-5">
      <Greeting name={user?.name?.split(" ")[0] ?? ""} />

      {/* Para resolver */}
      {hasItems && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Para resolver
              </span>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => refetch()} disabled={isFetching}
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pendingRequests.length > 0 && (
                <button
                  onClick={() => setLocation(requestsHref)}
                  className="w-full flex items-center justify-between py-2.5 text-sm hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-4 h-4" /> Solicitações aguardando resposta
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="destructive" className="text-xs">
                      {pendingRequests.length}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                </button>
              )}
              {pendingBooks.length > 0 && (
                <button
                  onClick={() => setLocation(dailyBookHref)}
                  className="w-full flex items-center justify-between py-2.5 text-sm hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <BookMarked className="w-4 h-4" /> Livros do Dia não publicados
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {pendingBooks.length}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                </button>
              )}
              {lateTasks.length > 0 && (
                <button
                  onClick={() => setLocation(tasksHref)}
                  className="w-full flex items-center justify-between py-2.5 text-sm hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 text-red-500" /> Tarefas atrasadas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="destructive" className="text-xs">
                      {lateTasks.length}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                </button>
              )}
              {approvalTasks.length > 0 && (
                <button
                  onClick={() => setLocation(tasksHref)}
                  className="w-full flex items-center justify-between py-2.5 text-sm hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CheckSquare className="w-4 h-4 text-violet-500" /> Tarefas aguardando aprovação
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge className="text-xs bg-violet-100 text-violet-700 hover:bg-violet-100">
                      {approvalTasks.length}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presenças */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> Presenças de hoje
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                ✓ {summary.checkedIn} presentes
              </span>
              {summary.late > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">
                  ⚠ {summary.late} atrasados
                </span>
              )}
              {summary.absent > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-medium">
                  ✗ {summary.absent} ausentes
                </span>
              )}
              {summary.expected > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                  {summary.expected} aguardando
                </span>
              )}
            </div>
          )}
          {checkInsLoading ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !operationId ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              Nenhuma operação vinculada ao perfil.
            </p>
          ) : checkIns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Users className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Ninguém escalado para hoje.</p>
            </div>
          ) : (
            <div className="-mx-6 divide-y max-h-80 overflow-y-auto">
              {checkIns.map((item) => (
                <CheckInRow
                  key={item.userId ?? item.checkInId ?? item.userName}
                  item={item}
                  onUpdate={handleUpdate}
                  isUpdating={updateMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* A seguir */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              A seguir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcomingEvents.slice(0, 5).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="font-medium truncate flex-1 mr-3">{ev.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground text-xs">
                      {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })}
                      {ev.startTime && ` • ${ev.startTime.slice(0, 5)}`}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Member home (web) ────────────────────────────────────────────────────────

function MemberHome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: panelData } = useGetOperationalPanel({});
  const { data: avisosData } = useGetMyNotices({});

  const upcomingEvents = (panelData?.upcomingEvents ?? []) as OperationalUpcomingEvent[];
  const myNotices = (avisosData ?? []) as any[];
  const pendingAvisos = myNotices.filter(
    (a: any) => a.recipientStatus === "SENT" || a.recipientStatus === "PENDING"
  );

  const QUICK_LINKS = [
    { label: "Minha Escala",    icon: ClipboardList, href: "/membro/escala"       },
    { label: "Avisos",          icon: Bell,          href: "/membro/avisos"       },
    { label: "Solicitações",    icon: FileText,      href: "/membro/solicitacoes" },
    { label: "Minhas Tarefas",  icon: CheckCircle2,  href: "/membro/tarefas"      },
    { label: "Minhas Entregas", icon: Package,       href: "/membro/entregas"     },
    { label: "Mensagens",       icon: Activity,      href: "/membro/mensagens"    },
    { label: "Biblioteca",      icon: BookMarked,    href: "/membro/biblioteca"   },
    { label: "Livro do Dia",    icon: AlertCircle,   href: "/membro/livro-do-dia" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <Greeting name={user?.name?.split(" ")[0] ?? ""} />

      <div className="grid grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ label, icon: Icon, href }) => (
          <button
            key={href}
            onClick={() => setLocation(href)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <Icon className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {pendingAvisos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" /> Avisos ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingAvisos.slice(0, 3).map((a: any) => (
                <div
                  key={a.id}
                  className="text-sm p-2 rounded-lg bg-amber-50 border border-amber-100"
                >
                  {a.title && <p className="font-medium text-amber-900">{a.title}</p>}
                  {a.content && (
                    <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{a.content}</p>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost" size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => setLocation("/membro/avisos")}
            >
              Ver todos <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              A seguir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcomingEvents.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{ev.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{ev.date}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm">
        <img src="/asinha.svg" alt="" className="w-8 h-9 shrink-0 opacity-70" />
        <p className="text-muted-foreground">
          Leve sua operação no bolso: o{" "}
          <strong className="text-foreground">app MyASA</strong> traz check-in,
          notificações e tudo do seu dia no celular.
        </p>
      </div>
    </div>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default function AdminHome() {
  const { roles: userRoles } = useAuth();
  const isAdmin = userRoles.some((r) => r.role === "ADMIN");
  const isSupervisor = userRoles.some(
    (r) => r.role === "SUPERVISOR_A" || r.role === "SUPERVISOR_B"
  );

  return (
    <AdminLayout title="Início">
      {isAdmin || isSupervisor ? (
        <ManagerHome isSupervisor={isSupervisor && !isAdmin} />
      ) : (
        <MemberHome />
      )}
    </AdminLayout>
  );
}
