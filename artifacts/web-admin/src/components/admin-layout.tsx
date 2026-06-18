import { Link, useLocation } from "wouter";
import {
  Home, Users, Briefcase, Users2, LogOut, ChevronRight,
  BookOpen, CalendarDays, ShieldCheck, ClipboardList, BookMarked,
  LayoutDashboard, Bell, Clock, MessageSquare, Package, Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@workspace/api-client-react";

// ─── Nav definitions ──────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: "PAINÉIS",
    items: [
      { href: "/admin/home",              icon: Home,            label: "Início"             },
      { href: "/admin/operational-panel", icon: LayoutDashboard, label: "Painel Operacional" },
    ],
  },
  {
    label: "OPERAÇÃO",
    items: [
      { href: "/admin/scales",     icon: ClipboardList, label: "Escalas"      },
      { href: "/admin/daily-book", icon: BookMarked,    label: "Livro do Dia" },
    ],
  },
  {
    label: "ORGANIZAÇÃO",
    items: [
      { href: "/admin/operations", icon: Briefcase, label: "Operações"   },
      { href: "/admin/groups",     icon: Users2,    label: "Grupos"      },
      { href: "/admin/users",      icon: Users,     label: "Usuários"    },
    ],
  },
  {
    label: "CONHECIMENTO",
    items: [
      { href: "/admin/show-book", icon: BookOpen, label: "Livro do Show" },
      { href: "/admin/library",   icon: Library,  label: "Biblioteca"   },
    ],
  },
  {
    label: "PLANEJAMENTO",
    items: [
      { href: "/admin/agenda", icon: CalendarDays, label: "Agenda" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { href: "/admin/avisos",     icon: Bell,          label: "Avisos"    },
      { href: "/admin/messages",   icon: MessageSquare, label: "Mensagens" },
      { href: "/admin/deliveries", icon: Package,       label: "Entregas"  },
    ],
  },
  {
    label: "GOVERNANÇA",
    items: [
      { href: "/admin/history",   icon: Clock,       label: "Histórico" },
      { href: "/admin/auditoria", icon: ShieldCheck, label: "Auditoria" },
    ],
  },
];

const SUPERVISOR_NAV: NavGroup[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { href: "/supervisor/operational-panel", icon: LayoutDashboard, label: "Painel"       },
      { href: "/admin/scales",                 icon: ClipboardList,   label: "Escalas"      },
      { href: "/supervisor/daily-book",        icon: BookMarked,      label: "Livro do Dia" },
    ],
  },
  {
    label: "PLANEJAMENTO",
    items: [
      { href: "/admin/agenda",     icon: CalendarDays, label: "Agenda"        },
      { href: "/admin/show-book",  icon: BookOpen,     label: "Livro do Show" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { href: "/supervisor/avisos",     icon: Bell,          label: "Avisos"    },
      { href: "/supervisor/messages",   icon: MessageSquare, label: "Mensagens" },
      { href: "/supervisor/deliveries", icon: Package,       label: "Entregas"  },
    ],
  },
  {
    label: "CONHECIMENTO",
    items: [
      { href: "/supervisor/library", icon: Library, label: "Biblioteca" },
    ],
  },
  {
    label: "CONTROLE",
    items: [
      { href: "/supervisor/history", icon: Clock, label: "Histórico" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout: clearAuth, roles: userRoles } = useAuth();
  const logoutMutation = useLogout();

  const isAdmin = userRoles.some((r) => r.role === "ADMIN");
  const navGroups = isAdmin ? ADMIN_NAV : SUPERVISOR_NAV;

  const handleLogout = () => {
    const refreshToken = localStorage.getItem("myasa_refresh_token") || "";
    logoutMutation.mutate(
      { data: { refreshToken } },
      { onSettled: () => { clearAuth(); setLocation("/login"); } }
    );
  };

  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : "??";
  const isHome = location === "/admin/home";

  return (
    <div className="min-h-screen flex bg-muted/20">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="h-16 flex items-center gap-2.5 px-4 border-b shrink-0">
          <img
            src="/asinha.svg"
            alt="Asinha MyASA"
            className="w-7 h-8 shrink-0"
          />
          <span className="font-serif font-bold text-base tracking-tight">MyASA</span>
        </div>

        <nav className="flex-1 p-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <a className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t shrink-0">
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

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center px-6 gap-2 sticky top-0 z-10">
          {isHome ? (
            <span className="text-sm font-medium">{title}</span>
          ) : (
            <>
              <Link href="/admin/home">
                <a className="text-muted-foreground hover:text-foreground text-sm">Início</a>
              </Link>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{title}</span>
            </>
          )}
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
