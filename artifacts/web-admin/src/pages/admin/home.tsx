import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useGetUserContext, 
  getGetUserContextQueryKey,
  useLogout
} from "@workspace/api-client-react";
import { 
  LogOut, 
  Theater, 
  Building2, 
  Briefcase, 
  Users, 
  User as UserIcon,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function AdminHome() {
  const [, setLocation] = useLocation();
  const { logout: clearAuth } = useAuth();
  
  const { data: context, isLoading } = useGetUserContext({
    query: {
      queryKey: getGetUserContextQueryKey()
    }
  });

  const logoutMutation = useLogout();

  const handleLogout = () => {
    const refreshToken = localStorage.getItem("myasa_refresh_token") || "";
    logoutMutation.mutate(
      { data: { refreshToken } },
      {
        onSettled: () => {
          clearAuth();
          setLocation("/login");
        }
      }
    );
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN": return "Administrador";
      case "SUPERVISOR_A": return "Supervisor Sênior";
      case "SUPERVISOR_B": return "Supervisor";
      case "MEMBER": return "Membro";
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <header className="h-16 border-b bg-card flex items-center px-6">
          <div className="w-8 h-8 bg-muted rounded-md animate-pulse" />
          <div className="ml-4 w-32 h-6 bg-muted rounded animate-pulse" />
        </header>
        <main className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-6">
          <div className="w-64 h-10 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-48 bg-muted rounded-xl animate-pulse" />
            <div className="h-48 bg-muted rounded-xl animate-pulse md:col-span-2" />
          </div>
        </main>
      </div>
    );
  }

  if (!context) return null;

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col font-sans">
      {/* Topbar */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded text-primary">
            <Theater className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-lg tracking-tight">MyASA 2.0</span>
          <div className="hidden md:flex items-center text-muted-foreground ml-4">
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-sm font-medium">Painel Operacional</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-medium leading-none">{context.user.name}</span>
            <span className="text-xs text-muted-foreground mt-1">{context.organization.name}</span>
          </div>
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={context.user.photoUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {context.user.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="h-6 w-px bg-border mx-2" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">
            Olá, {context.user.name.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Visão geral da sua organização e operações.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Perfil & Organização */}
          <div className="md:col-span-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <UserIcon className="w-5 h-5 mr-2 text-primary" />
                  Identidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
                  <p className="text-base font-medium">{context.user.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                  <p className="text-base">{context.user.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Papéis Ativos</p>
                  <div className="flex flex-wrap gap-2">
                    {context.roles.map(role => (
                      <Badge key={role.id} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        {getRoleLabel(role.role)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Building2 className="w-5 h-5 mr-2 text-primary" />
                  Organização Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="font-medium text-lg">{context.organization.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ID: {context.organization.id.split('-')[0]}...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Operações & Grupos */}
          <div className="md:col-span-8 space-y-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Briefcase className="w-5 h-5 mr-2 text-primary" />
                  Operações Ativas
                </CardTitle>
                <CardDescription>
                  Produções e espetáculos que você tem acesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                {context.operations.length === 0 ? (
                  <div className="text-center p-8 border border-dashed rounded-lg bg-muted/30">
                    <p className="text-muted-foreground">Nenhuma operação associada ao seu perfil.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {context.operations.map(op => (
                      <div key={op.id} className="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-lg leading-tight">{op.name}</h3>
                          <Badge variant="outline" className={op.status === 'ACTIVE' ? "border-green-500/30 text-green-600 bg-green-500/10" : ""}>
                            {op.status === 'ACTIVE' ? 'Ativa' : 'Arquivada'}
                          </Badge>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            Grupos Operacionais
                          </p>
                          <div className="space-y-2">
                            {context.groups
                              .filter(g => g.operationId === op.id)
                              .map(group => (
                                <div key={group.id} className="text-sm flex items-center bg-muted/50 px-2 py-1.5 rounded">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                                  {group.name}
                                </div>
                              ))}
                            {context.groups.filter(g => g.operationId === op.id).length === 0 && (
                              <p className="text-sm text-muted-foreground italic">Sem grupos designados</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
