import { Link, useLocation } from "wouter";
import {
  Home, Users, Briefcase, Users2, LogOut, ChevronRight,
  BookOpen, CalendarDays, ShieldCheck, ClipboardList, BookMarked,
  LayoutDashboard, Bell, Clock, MessageSquare, Package, Library,
  FileText, CheckSquare, TrendingUp, AlertTriangle, ClipboardCheck, ArrowLeftRight,
  Shield, Sparkles, Palmtree, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useLogout, useGetMyActiveDelegations } from "@workspace/api-client-react";

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
      { href: "/admin/scales",                  icon: ClipboardList,   label: "Escalas"                      },
      { href: "/admin/daily-book",              icon: BookMarked,      label: "Livro do Dia"                 },
      { href: "/admin/responsibilities",        icon: Users,           label: "Responsabilidades"            },
      { href: "/admin/requests",                icon: FileText,        label: "Solicitações"                 },
      { href: "/admin/folgas",                  icon: Palmtree,        label: "Folgas"                       },
      { href: "/admin/tasks",                   icon: CheckSquare,     label: "Tarefas"                      },
      { href: "/supervisor/restrictions",       icon: AlertTriangle,   label: "Indisponibilidades"            },
      { href: "/supervisor/check-ins",          icon: ClipboardCheck,  label: "Check-ins"                    },
      { href: "/supervisor/supervisor-requests",icon: ArrowLeftRight,  label: "Aprovações entre Supervisores"},
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
      { href: "/admin/insights",  icon: TrendingUp,  label: "Indicadores"  },
    ],
  },
  {
    label: "EQUIPE",
    items: [
      { href: "/admin/mural", icon: Trophy, label: "Mural da Equipe" },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { href: "/admin/asa", icon: Sparkles, label: "ASA" },
    ],
  },
];

const SUPERVISOR_NAV: NavGroup[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { href: "/supervisor/operational-panel", icon: LayoutDashboard, label: "Painel"        },
      { href: "/admin/scales",                 icon: ClipboardList,   label: "Escalas"       },
      { href: "/supervisor/daily-book",        icon: BookMarked,      label: "Livro do Dia"  },
      { href: "/supervisor/requests",          icon: FileText,        label: "Solicitações"  },
      { href: "/supervisor/folgas",            icon: Palmtree,        label: "Folgas"        },
      { href: "/supervisor/tasks",             icon: CheckSquare,     label: "Tarefas"       },
      { href: "/admin/responsibilities",         icon: Users,            label: "Responsabilidades"    },
      { href: "/supervisor/delegations",        icon: ShieldCheck,      label: "Delegações"           },
      { href: "/supervisor/restrictions",       icon: AlertTriangle,    label: "Indisponibilidades"   },
      { href: "/supervisor/check-ins",          icon: ClipboardCheck,   label: "Check-ins"            },
      { href: "/supervisor/supervisor-requests",icon: ArrowLeftRight,   label: "Aprovações entre Supervisores"   },
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
      { href: "/supervisor/history",   icon: Clock,       label: "Histórico" },
      { href: "/supervisor/insights",  icon: TrendingUp,  label: "Indicadores"  },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { href: "/admin/asa", icon: Sparkles, label: "ASA" },
    ],
  },
];

// Responsabilidade → item de navegação para Capitão
const RESP_TO_NAV: Record<string, NavItem> = {
  CHECK_INS:            { href: "/supervisor/check-ins",  icon: ClipboardCheck, label: "Check-ins"     },
  REQUESTS:             { href: "/supervisor/requests",   icon: FileText,       label: "Solicitações"  },
  TASK_APPROVALS:       { href: "/supervisor/tasks",      icon: CheckSquare,    label: "Tarefas"       },
  DAILY_BOOK:           { href: "/supervisor/daily-book", icon: BookMarked,     label: "Livro do Dia"  },
  NOTICES:              { href: "/supervisor/avisos",     icon: Bell,           label: "Avisos"        },
  SCALES:               { href: "/admin/scales",          icon: ClipboardList,  label: "Escalas"       },
  OPERATIONAL_MESSAGES: { href: "/supervisor/messages",   icon: MessageSquare,  label: "Mensagens"     },
};

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
  const { data: delegData } = useGetMyActiveDelegations({
    query: { retry: false } as any,
  });

  const isAdmin      = userRoles.some((r) => r.role === "ADMIN");
  const isSupervisor = userRoles.some((r) => r.role === "SUPERVISOR_A" || r.role === "SUPERVISOR_B");
  const activeDelegations = delegData?.delegations ?? [];

  // Responsabilidades únicas das delegações ativas
  const captainResponsibilities = [
    ...new Set(activeDelegations.flatMap((d) => d.responsibilities as string[])),
  ];

  const isCaptain = !isAdmin && !isSupervisor && captainResponsibilities.length > 0;

  // Itens do CAPITÃO: apenas responsabilidades recebidas, sem duplicar
  const captainItems: NavItem[] = captainResponsibilities
    .map((r) => RESP_TO_NAV[r])
    .filter(Boolean);

  const roleLabel = isAdmin
    ? "Administrador"
    : isSupervisor
    ? "Supervisor"
    : isCaptain
    ? "Capitão"
    : "Membro";

  const navGroups: NavGroup[] = isAdmin
    ? ADMIN_NAV
    : isSupervisor
    ? SUPERVISOR_NAV
    : [];

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
          <div>
            <span className="font-serif font-bold text-base tracking-tight leading-none">MyASA</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-4">
          {/* Início sempre visível */}
          <div>
            <div className="space-y-0.5">
              {[{ href: "/admin/home", icon: Home, label: "Início" }].map((item) => {
                const Icon = item.icon;
                const active = location === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Seção CAPITÃO — só para membros com delegações */}
          {isCaptain && captainItems.length > 0 && (
            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                Capitão
              </p>
              <div className="space-y-0.5">
                {captainItems.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nav normal de admin/supervisor */}
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
                    <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
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
              <Link href="/admin/home" className="text-muted-foreground hover:text-foreground text-sm">
                Início
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
