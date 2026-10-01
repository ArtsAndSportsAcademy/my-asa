import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
// D5: login e troca obrigatória de senha só carregam quando aparecem (quem já entrou não baixa zod/react-hook-form).
const Login = lazy(() => import("@/pages/login"));
import { UndoNotices } from "@/components/undo-notices";
import { ReasonConfirmation } from "@/components/reason-confirmation";
const ForcePasswordChange = lazy(() => import("@/pages/force-password-change"));
import ShellFoundation from "@/components/shell-foundation";
import "@/shell-foundation.css";
import "@/shell-foundation-navigation.css";
import "@/shell-assets.css";

const queryClient = new QueryClient();
const PrintDayPage = lazy(() => import("@/pages/print-day"));

function PrintDayRoute() {
  return (
    <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center">Carregando impressão…</div>}>
      <PrintDayPage />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center">Carregando…</div>}><Login /></Suspense>}</Route>
      <Route path="/imprimir" component={PrintDayRoute} />
      <Route component={ShellFoundation} />
    </Switch>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (!isLoading && isAuthenticated && user?.mustChangePassword) {
    return <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center">Carregando…</div>}><ForcePasswordChange /></Suspense>;
  }
  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate />
            <UndoNotices />
            <ReasonConfirmation />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
    </QueryClientProvider>
  );
}

export default App;
