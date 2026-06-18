import { Link, useLocation } from "wouter";
import { Theater, Home, Users, Briefcase, Users2, LogOut, ChevronRight, BookOpen, CalendarDays, ShieldCheck, ClipboardList, BookMarked, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@workspace/api-client-react";

const navItems = [
  { href: "/admin/home", icon: Home, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Usuários" },
  { href: "/admin/operations", icon: Briefcase, label: "Operações" },
  { href: "/admin/groups", icon: Users2, label: "Grupos" },
  { href: "/admin/show-book", icon: BookOpen, label: "Livro do Show" },
  { href: "/admin/agenda", icon: CalendarDays, label: "Agenda" },
  { href: "/admin/scales", icon: ClipboardList, label: "Escalas" },
  { href: "/admin/daily-book", icon: BookMarked, label: "Livro do Dia" },
  { href: "/supervisor/daily-book", icon: Eye, label: "Livro (Supervisor)" },
  { href: "/admin/auditoria", icon: ShieldCheck, label: "Auditoria" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout: clearAuth } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    const refreshToken = localStorage.getItem("myasa_refresh_token") || "";
    logoutMutation.mutate(
      { data: { refreshToken } },
      { onSettled: () => { clearAuth(); setLocation("/login"); } }
    );
  };

  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : "??";

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-3 px-4 border-b">
          <div className="p-1.5 bg-primary/10 rounded text-primary">
            <Theater className="w-4 h-4" />
          </div>
          <span className="font-serif font-bold text-base tracking-tight">MyASA 2.0</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-none truncate">{user?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email ?? "—"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="w-full justify-start text-muted-foreground hover:text-foreground text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center px-6 gap-2 sticky top-0 z-10">
          <Link href="/admin/home">
            <a className="text-muted-foreground hover:text-foreground text-sm">Dashboard</a>
          </Link>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </header>

        <main className="flex-1 p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-serif font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
