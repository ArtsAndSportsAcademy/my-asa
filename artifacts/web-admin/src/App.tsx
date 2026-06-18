import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
