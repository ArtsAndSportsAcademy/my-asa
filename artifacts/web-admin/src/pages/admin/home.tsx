import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetOperationalPanel,
  useGetUserContext,
  useGetCheckInSummary,
  useListPendingRequests,
  useListNotices,
  getGetUserContextQueryKey,
  getGetCheckInSummaryQueryKey,
} from "@workspace/api-client-react";
import type {
  OperationalException,
  OperationalPendingBook,
  OperationalUpcomingEvent,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { AsaAvatar } from "@/components/AsaAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HEALTH_CONFIG,
  EVENT_TYPE_LABELS,
  EXCEPTION_TYPE_LABELS,
} from "@/lib/operational-constants";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  BookMarked,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Package,
  Users2,
  XCircle,
  UserCheck,
} from "lucide-react";

// ─── Shared branded greeting ──────────────────────────────────────────────────

function BrandedGreeting({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4 mb-6 p-5 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
      <AsaAvatar size="medium" pose="bomdia" />
      <div>
        <p className="text-xl font-serif font-bold text-foreground">Olá, {name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = "default",
}: {
  label: string;
  value: number;
  color?: "green" | "amber" | "red" | "default";
}) {
  const colors = {
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    default: "bg-muted text-muted-foreground",
  };
  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[color]}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Admin view ───────────────────────────────────────────────────────────────

function AdminHomeContent() {
  const [, setLocation] = useLocation();
  const { user, roles } = useAuth();
  const { data: panelData } = useGetOperationalPanel({});
  const { data: context } = useGetUserContext({
    query: { queryKey: getGetUserContextQueryKey() },
  });

  const operationId = roles.find((r) => r.operationId)?.operationId ?? context?.operations?.[0]?.id;
  const today = new Date().toISOString().slice(0, 10);
  const checkInParams = { date: today, operationId: operationId ?? "" };

  const { data: checkInData } = useGetCheckInSummary(checkInParams, {
    query: {
      enabled: !!operationId,
      queryKey: getGetCheckInSummaryQueryKey(checkInParams),
    },
  });
  const { data: pendingRequestsData } = useListPendingRequests(
    { operationId: operationId ?? "" } as any,
    { query: { enabled: !!operationId } as any }
  );

  const health = panelData?.health;
  const exceptions = (panelData?.exceptions ?? []) as OperationalException[];
  const upcomingEvents = (panelData?.upcomingEvents ?? []) as OperationalUpcomingEvent[];
  const pendingBooks = (panelData?.pendingBooks ?? []) as OperationalPendingBook[];
  const operations = context?.operations ?? [];

  const cfg = health
    ? (HEALTH_CONFIG[health.status as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.ATTENTION)
    : null;

  const HEALTH_ICONS = {
    HEALTHY: CheckCircle2,
    ATTENTION: AlertCircle,
    RISK: AlertTriangle,
    CRITICAL: XCircle,
  };
  const HealthIcon = health
    ? (HEALTH_ICONS[health.status as keyof typeof HEALTH_ICONS] ?? AlertCircle)
    : Activity;

  const pendingRequests = pendingRequestsData?.requests ?? [];
  const checkIn = checkInData as any;

  return (
    <div className="space-y-6">
      <BrandedGreeting
        name={user?.name?.split(" ")[0] ?? "Admin"}
        subtitle="Visão organizacional — saúde da operação"
      />

      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/operational-panel")}>
          <Activity className="w-4 h-4 mr-2" /> Painel Completo
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/operations")}>
          <Briefcase className="w-4 h-4 mr-2" /> Operações
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/groups")}>
          <Users2 className="w-4 h-4 mr-2" /> Grupos
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/avisos")}>
          <Bell className="w-4 h-4 mr-2" /> Avisos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saúde Operacional */}
        <Card className={cfg ? `${cfg.border} border-2` : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Saúde Operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!health ? (
              <div className="h-14 bg-muted rounded animate-pulse" />
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-lg ${cfg!.bg}`}>
                <HealthIcon className={`h-8 w-8 ${cfg!.text} shrink-0`} />
                <div>
                  <p className={`text-xl font-bold ${cfg!.text}`}>{cfg!.label}</p>
                  <p className={`text-xs mt-0.5 ${cfg!.text}`}>
                    {exceptions.length} exceção(ões)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-ins do Dia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Check-ins do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!checkIn ? (
              <div className="space-y-1">
                {["Presentes", "Atrasados", "Ausentes"].map((l) => (
                  <div key={l} className="h-6 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="divide-y">
                <StatPill label="Presentes" value={checkIn.present ?? 0} color="green" />
                <StatPill label="Atrasados" value={checkIn.late ?? 0} color="amber" />
                <StatPill label="Ausentes" value={checkIn.absent ?? 0} color="red" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => setLocation("/admin/operational-panel")}
            >
              Ver detalhes <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Solicitações e Livros Pendentes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <div
                className="flex items-center justify-between py-1.5 text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={() => setLocation("/admin/requests")}
              >
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Solicitações
                </span>
                {pendingRequests.length > 0 ? (
                  <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
                ) : (
                  <span className="text-xs text-green-600">Em dia</span>
                )}
              </div>
              <div
                className="flex items-center justify-between py-1.5 text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={() => setLocation("/admin/daily-book")}
              >
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <BookMarked className="w-3.5 h-3.5" /> Livros
                </span>
                {pendingBooks.length > 0 ? (
                  <Badge variant="secondary" className="text-xs">{pendingBooks.length}</Badge>
                ) : (
                  <span className="text-xs text-green-600">Em dia</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operações Ativas */}
      {operations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Operações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border hover:border-primary/50 transition-colors"
                >
                  <span className="font-medium text-sm truncate flex-1">{op.name}</span>
                  <Badge
                    variant="outline"
                    className={`ml-2 shrink-0 ${
                      op.status === "ACTIVE"
                        ? "border-green-500/30 text-green-600 bg-green-500/10"
                        : ""
                    }`}
                  >
                    {op.status === "ACTIVE" ? "Ativa" : "Arquivada"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Próximos Eventos */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcomingEvents.slice(0, 4).map((ev) => (
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
    </div>
  );
}

// ─── Supervisor view ──────────────────────────────────────────────────────────

function SupervisorHomeContent() {
  const [, setLocation] = useLocation();
  const { user, roles } = useAuth();
  const { data: panelData } = useGetOperationalPanel({});

  const operationId = roles.find((r) => r.operationId)?.operationId;
  const today = new Date().toISOString().slice(0, 10);
  const checkInParams = { date: today, operationId: operationId ?? "" };

  const { data: checkInData } = useGetCheckInSummary(checkInParams, {
    query: {
      enabled: !!operationId,
      queryKey: getGetCheckInSummaryQueryKey(checkInParams),
    },
  });
  const { data: pendingRequestsData } = useListPendingRequests(
    { operationId: operationId ?? "" } as any,
    { query: { enabled: !!operationId } as any }
  );

  const exceptions = (panelData?.exceptions ?? []) as OperationalException[];
  const upcomingEvents = (panelData?.upcomingEvents ?? []) as OperationalUpcomingEvent[];
  const pendingBooks = (panelData?.pendingBooks ?? []) as OperationalPendingBook[];
  const pendingRequests = pendingRequestsData?.requests ?? [];
  const checkIn = checkInData as any;

  return (
    <div className="space-y-6">
      <BrandedGreeting
        name={user?.name?.split(" ")[0] ?? "Supervisor"}
        subtitle="O que precisa da sua atenção agora"
      />

      <div className="flex gap-3 flex-wrap">
        <Button size="sm" onClick={() => setLocation("/supervisor/daily-book")}>
          <BookMarked className="w-4 h-4 mr-2" /> Livro do Dia
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/supervisor/requests")}>
          <FileText className="w-4 h-4 mr-2" /> Solicitações
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs">{pendingRequests.length}</Badge>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/supervisor/avisos")}>
          <Bell className="w-4 h-4 mr-2" /> Avisos
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/supervisor/operational-panel")}>
          <Activity className="w-4 h-4 mr-2" /> Painel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Check-ins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Check-ins do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!checkIn ? (
              <div className="space-y-1">
                {["Presentes", "Atrasados", "Ausentes"].map((l) => (
                  <div key={l} className="h-6 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="divide-y">
                <StatPill label="Presentes" value={checkIn.present ?? 0} color="green" />
                <StatPill label="Atrasados" value={checkIn.late ?? 0} color="amber" />
                <StatPill label="Ausentes" value={checkIn.absent ?? 0} color="red" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exceções Pendentes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Exceções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exceptions.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" /> Tudo em ordem
              </div>
            ) : (
              <div className="space-y-1.5">
                {exceptions.slice(0, 4).map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate flex-1 mr-2">{ex.reason}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                      {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                    </span>
                  </div>
                ))}
                {exceptions.length > 4 && (
                  <button
                    className="text-xs text-primary flex items-center gap-1 hover:underline mt-1"
                    onClick={() => setLocation("/supervisor/operational-panel")}
                  >
                    +{exceptions.length - 4} mais <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Livros + Solicitações */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <div
                className="flex items-center justify-between py-1.5 text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={() => setLocation("/supervisor/requests")}
              >
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Solicitações
                </span>
                {pendingRequests.length > 0 ? (
                  <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
                ) : (
                  <span className="text-xs text-green-600">Em dia</span>
                )}
              </div>
              <div
                className="flex items-center justify-between py-1.5 text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={() => setLocation("/supervisor/daily-book")}
              >
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <BookMarked className="w-3.5 h-3.5" /> Livros
                </span>
                {pendingBooks.length > 0 ? (
                  <Badge variant="secondary" className="text-xs">{pendingBooks.length}</Badge>
                ) : (
                  <span className="text-xs text-green-600">Em dia</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos Eventos */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Próximos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcomingEvents.slice(0, 4).map((ev) => (
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
    </div>
  );
}

// ─── Member view (web) ────────────────────────────────────────────────────────

function MemberHomeContent() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: panelData } = useGetOperationalPanel({});
  const { data: avisosData } = useListNotices({} as any, { query: {} as any });

  const upcomingEvents = (panelData?.upcomingEvents ?? []) as OperationalUpcomingEvent[];
  const activeAvisos = (avisosData as any)?.notices ?? [];
  const pendingAvisos = activeAvisos.filter((a: any) => a.status === "ACTIVE");

  const QUICK_LINKS = [
    { label: "Escalas", icon: ClipboardList, href: "/admin/scales" },
    { label: "Avisos", icon: Bell, href: "/admin/avisos" },
    { label: "Solicitações", icon: FileText, href: "/admin/requests" },
    { label: "Entregas", icon: Package, href: "/admin/deliveries" },
    { label: "Mensagens", icon: Activity, href: "/admin/messages" },
    { label: "Biblioteca", icon: BookMarked, href: "/admin/library" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <BrandedGreeting
        name={user?.name?.split(" ")[0] ?? ""}
        subtitle="Sua central de operações"
      />

      {/* Quick links */}
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

      {/* Avisos ativos */}
      {pendingAvisos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" /> Avisos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingAvisos.slice(0, 3).map((a: any) => (
                <div key={a.id} className="text-sm p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="font-medium text-amber-900">{a.title}</p>
                  {a.body && (
                    <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{a.body}</p>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost" size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => setLocation("/admin/avisos")}
            >
              Ver todos <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Próximos eventos */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Próximos Eventos
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

      {/* Mobile nudge */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm">
        <img src="/asinha.svg" alt="" className="w-8 h-9 shrink-0 opacity-70" />
        <p className="text-muted-foreground">
          Para a experiência completa do Membro — check-in, meu dia e atividades — use o <strong className="text-foreground">app MyASA</strong> no celular.
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

  const subtitle = isAdmin
    ? "Visão organizacional — saúde da operação"
    : isSupervisor
    ? "O que precisa da sua atenção agora"
    : "Sua central de operações";

  return (
    <AdminLayout title="Início" subtitle={subtitle}>
      {isAdmin ? (
        <AdminHomeContent />
      ) : isSupervisor ? (
        <SupervisorHomeContent />
      ) : (
        <MemberHomeContent />
      )}
    </AdminLayout>
  );
}
