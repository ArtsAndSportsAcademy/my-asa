import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
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

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen bg-muted/20 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Route path={path} component={Component} />;
}

function RoleRoute({ component: Component, path, roles }: { component: React.ComponentType<any>, path: string, roles: string[] }) {
  const { isAuthenticated, isLoading, roles: userRoles } = useAuth();
  
  if (isLoading) return <div className="min-h-screen bg-muted/20 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  
  if (!isAuthenticated) return <Redirect to="/login" />;
  
  const hasRole = userRoles.some((r) => roles.includes(r.role));
  if (!hasRole) return <Redirect to="/admin/home" />;

  return <Route path={path} component={Component} />;
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-muted/20 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  return <Redirect to={isAuthenticated ? "/admin/home" : "/login"} />;
}

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
      <ProtectedRoute path="/admin/scales" component={ScalesPage} />
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
