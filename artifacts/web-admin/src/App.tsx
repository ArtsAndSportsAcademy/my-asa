import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { useGetMyActiveDelegations } from "@workspace/api-client-react";
import Login from "@/pages/login";
import AdminHome from "@/pages/admin/home";
import UsersPage from "@/pages/admin/users";
import OperationsPage from "@/pages/admin/operations";
import GroupsPage from "@/pages/admin/groups";
import ShowBookPage from "@/pages/admin/show-book";
import AgendaPage from "@/pages/admin/agenda";
import AuditoriaPage from "@/pages/admin/auditoria";
import ScalesPage from "@/pages/admin/scales";
import DailyBookPage from "@/pages/admin/daily-book";
import SupervisorDailyBookPage from "@/pages/supervisor/daily-book";
import AdminOperationalPanel from "@/pages/admin/operational-panel";
import SupervisorOperationalPanel from "@/pages/supervisor/operational-panel";
import MeuDiaPage from "@/pages/admin/meu-dia";
import AdminAvisosPage from "@/pages/admin/avisos";
import SupervisorAvisosPage from "@/pages/supervisor/avisos";
import AdminHistoryPage from "@/pages/admin/history";
import SupervisorHistoryPage from "@/pages/supervisor/history";
import AdminMessagesPage from "@/pages/admin/messages";
import SupervisorMessagesPage from "@/pages/supervisor/messages";
import AdminDeliveriesPage from "@/pages/admin/deliveries";
import SupervisorDeliveriesPage from "@/pages/supervisor/deliveries";
import AdminLibraryPage from "@/pages/admin/library";
import SupervisorLibraryPage from "@/pages/supervisor/library";
import AdminRequestsPage from "@/pages/admin/requests";
import SupervisorRequestsPage from "@/pages/supervisor/requests";
import SupervisorDelegationsPage from "@/pages/supervisor/delegations";
import AdminTasksPage from "@/pages/admin/tasks";
import SupervisorTasksPage from "@/pages/supervisor/tasks";
import AdminInsightsPage from "@/pages/admin/insights";
import SupervisorInsightsPage from "@/pages/supervisor/insights";
import SupervisorRestrictionsPage from "@/pages/supervisor/restrictions";
import SupervisorCheckInsPage from "@/pages/supervisor/check-ins";
import SupervisorInterRequestsPage from "@/pages/supervisor/supervisor-requests";
import ResponsibilitiesPage from "@/pages/admin/responsibilities";
import AsaPage from "@/pages/admin/asa";
import AdminFolgasPage from "@/pages/admin/folgas";
import SupervisorFolgasPage from "@/pages/supervisor/folgas";
import MuralPage from "@/pages/admin/mural";

const queryClient = new QueryClient();

// ─── Responsabilidade → rota (para acesso por delegação) ──────────────────────

const ROUTE_RESPONSIBILITY: Record<string, string> = {
  "/supervisor/check-ins":  "CHECK_INS",
  "/supervisor/requests":   "REQUESTS",
  "/supervisor/tasks":      "TASK_APPROVALS",
  "/supervisor/daily-book": "DAILY_BOOK",
  "/supervisor/avisos":     "NOTICES",
  "/admin/scales":          "SCALES",
  "/supervisor/messages":   "OPERATIONAL_MESSAGES",
};

const RESP_LABELS_WEB: Record<string, string> = {
  CHECK_INS:            "Check-ins",
  REQUESTS:             "Solicitações",
  TASK_APPROVALS:       "Aprovação de Tarefas",
  DAILY_BOOK:           "Livro do Dia",
  NOTICES:              "Avisos",
  OPERATIONAL_MESSAGES: "Mensagens Operacionais",
  SCALES:               "Escalas",
};

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function AccessDenied() {
  const [, setLocation] = useLocation();
  const { data } = useGetMyActiveDelegations();
  const allResp = [...new Set(
    (data?.delegations ?? []).flatMap((d) => d.responsibilities as string[])
  )];

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-serif font-bold">Acesso restrito</h2>
        <p className="text-muted-foreground text-sm">
          Você não tem permissão para acessar esta área.
        </p>
        {allResp.length > 0 && (
          <div className="text-left bg-muted/50 rounded-lg p-4">
            <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-widest">
              Suas responsabilidades ativas
            </p>
            <ul className="space-y-1.5">
              {allResp.map((r) => (
                <li key={r} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {RESP_LABELS_WEB[r] ?? r}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => setLocation("/admin/home")}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar para Meu Dia
        </button>
      </div>
    </div>
  );
}

// ─── Route guards ─────────────────────────────────────────────────────────────

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Route path={path} component={Component} />;
}

function RoleRoute({ component: Component, path, roles }: { component: React.ComponentType<any>, path: string, roles: string[] }) {
  const { isAuthenticated, isLoading, roles: userRoles } = useAuth();
  const { data: delegData, isLoading: delegLoading } = useGetMyActiveDelegations({
    query: { enabled: !isLoading && isAuthenticated, retry: false } as any,
  });

  if (isLoading || delegLoading) return <Spinner />;
  if (!isAuthenticated) return <Redirect to="/login" />;

  const hasRole = userRoles.some((r) => roles.includes(r.role));

  if (!hasRole) {
    const required = ROUTE_RESPONSIBILITY[path];
    const hasDelegation = required
      ? (delegData?.delegations ?? []).some((d) =>
          (d.responsibilities as string[]).includes(required)
        )
      : false;

    if (!hasDelegation) return <AccessDenied />;
  }

  return <Route path={path} component={Component} />;
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  return <Redirect to={isAuthenticated ? "/admin/home" : "/login"} />;
}

// ─── Router ───────────────────────────────────────────────────────────────────

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/login" component={Login} />
      <ProtectedRoute path="/admin/home" component={AdminHome} />
      <ProtectedRoute path="/admin/users" component={UsersPage} />
      <ProtectedRoute path="/admin/operations" component={OperationsPage} />
      <ProtectedRoute path="/admin/groups" component={GroupsPage} />
      <ProtectedRoute path="/admin/show-book" component={ShowBookPage} />
      <ProtectedRoute path="/admin/agenda" component={AgendaPage} />
      <ProtectedRoute path="/admin/auditoria" component={AuditoriaPage} />
      <RoleRoute path="/admin/scales" component={ScalesPage} roles={["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/daily-book" component={DailyBookPage} roles={["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/supervisor/daily-book" component={SupervisorDailyBookPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <ProtectedRoute path="/admin/operational-panel" component={AdminOperationalPanel} />
      <RoleRoute path="/supervisor/operational-panel" component={SupervisorOperationalPanel} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <ProtectedRoute path="/admin/meu-dia" component={MeuDiaPage} />
      <ProtectedRoute path="/admin/avisos" component={AdminAvisosPage} />
      <RoleRoute path="/supervisor/avisos" component={SupervisorAvisosPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/history" component={AdminHistoryPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/history" component={SupervisorHistoryPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/messages" component={AdminMessagesPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/messages" component={SupervisorMessagesPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/deliveries" component={AdminDeliveriesPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/deliveries" component={SupervisorDeliveriesPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/library" component={AdminLibraryPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/library" component={SupervisorLibraryPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/requests" component={AdminRequestsPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/requests" component={SupervisorRequestsPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/supervisor/delegations" component={SupervisorDelegationsPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/tasks" component={AdminTasksPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/tasks" component={SupervisorTasksPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/admin/insights" component={AdminInsightsPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/insights" component={SupervisorInsightsPage} roles={["SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/supervisor/restrictions" component={SupervisorRestrictionsPage} roles={["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/supervisor/check-ins" component={SupervisorCheckInsPage} roles={["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]} />
      <RoleRoute path="/supervisor/supervisor-requests" component={SupervisorInterRequestsPage} roles={["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]} />
      <ProtectedRoute path="/admin/responsibilities" component={ResponsibilitiesPage} />
      <ProtectedRoute path="/admin/asa" component={AsaPage} />
      <RoleRoute path="/admin/folgas" component={AdminFolgasPage} roles={["ADMIN"]} />
      <RoleRoute path="/supervisor/folgas" component={SupervisorFolgasPage} roles={["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]} />
      <ProtectedRoute path="/admin/mural" component={MuralPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
