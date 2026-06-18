import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetOperationalPanel,
  useGetUserContext,
  getGetUserContextQueryKey,
} from "@workspace/api-client-react";
import type {
  OperationalException,
  OperationalPendingBook,
  OperationalUpcomingEvent,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
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
  Users2,
  XCircle,
} from "lucide-react";

// ─── Shared branded greeting ──────────────────────────────────────────────────

function BrandedGreeting({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-4 mb-6 p-5 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
      <img
        src="/asinha.svg"
        alt="Asinha MyASA"
        className="w-12 h-14 shrink-0"
      />
      <div>
        <p className="text-xl font-serif font-bold text-foreground">
          Olá, {name}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">Tudo da ASA em um só lugar</p>
      </div>
    </div>
  );
}

// ─── Admin view ───────────────────────────────────────────────────────────────

function AdminHomeContent() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: panelData } = useGetOperationalPanel({});
  const { data: context } = useGetUserContext({
    query: { queryKey: getGetUserContextQueryKey() },
  });

  const health = panelData?.health;
  const exceptions = (panelData?.exceptions ?? []) as OperationalException[];
  const upcomingEvents = (panelData?.upcomingEvents ?? []) as OperationalUpcomingEvent[];
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

  return (
    <div className="space-y-6">
      <BrandedGreeting name={user?.name?.split(" ")[0] ?? "Admin"} />

      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/operational-panel")}>
          <Activity className="w-4 h-4 mr-2" />
          Painel Completo
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/operations")}>
          <Briefcase className="w-4 h-4 mr-2" />
          Operações
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/groups")}>
          <Users2 className="w-4 h-4 mr-2" />
          Grupos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className={cfg ? `${cfg.border} border-2` : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Saúde Operacional
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
        </div>

        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Operações Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma operação configurada ainda. Crie sua primeira operação para começar a organizar sua equipe.
                </p>
              ) : (
                <div className="space-y-2">
                  {operations.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-colors"
                    >
                      <span className="font-medium text-sm">{op.name}</span>
                      <Badge
                        variant="outline"
                        className={
                          op.status === "ACTIVE"
                            ? "border-green-500/30 text-green-600 bg-green-500/10"
                            : ""
                        }
                      >
                        {op.status === "ACTIVE" ? "Ativa" : "Arquivada"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingEvents.slice(0, 3).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-sm">
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
  const { user } = useAuth();
  const { data: panelData } = useGetOperationalPanel({});

  const exceptions = (panelData?.exceptions ?? []) as OperationalException[];
  const upcomingEvents = (panelData?.upcomingEvents ?? []) as OperationalUpcomingEvent[];
  const pendingBooks = (panelData?.pendingBooks ?? []) as OperationalPendingBook[];

  return (
    <div className="space-y-6">
      <BrandedGreeting name={user?.name?.split(" ")[0] ?? "Supervisor"} />

      <div className="flex gap-3 flex-wrap">
        <Button size="sm" onClick={() => setLocation("/supervisor/daily-book")}>
          <BookMarked className="w-4 h-4 mr-2" />
          Livro do Dia
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/supervisor/avisos")}>
          <Bell className="w-4 h-4 mr-2" />
          Avisos
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation("/supervisor/operational-panel")}>
          <Activity className="w-4 h-4 mr-2" />
          Painel Completo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Exceções Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exceptions.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Tudo em ordem — nenhuma exceção pendente
              </div>
            ) : (
              <div className="space-y-2">
                {exceptions.slice(0, 5).map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-muted-foreground truncate flex-1 mr-2">
                      {ex.reason}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                      {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                    </span>
                  </div>
                ))}
                {exceptions.length > 5 && (
                  <button
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                    onClick={() => setLocation("/supervisor/operational-panel")}
                  >
                    +{exceptions.length - 5} mais{" "}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookMarked className="h-4 w-4" />
              Livros Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingBooks.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Nenhum livro aguardando preenchimento
              </div>
            ) : (
              <div className="space-y-2">
                {pendingBooks.slice(0, 4).map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation("/supervisor/daily-book")}
                  >
                    <span className="font-medium truncate flex-1">{book.eventTitle}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {book.eventDate}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingEvents.slice(0, 4).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-sm">
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
  const { user } = useAuth();
  return (
    <div className="max-w-md space-y-4">
      <BrandedGreeting name={user?.name?.split(" ")[0] ?? ""} />
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Para acompanhar sua rotina operacional, use o app MyASA no seu
            celular — a experiência completa do Membro está disponível lá.
          </p>
        </CardContent>
      </Card>
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
