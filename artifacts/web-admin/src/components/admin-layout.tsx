import { Link, useLocation } from "wouter";
import React, { useEffect, useState } from "react";
import {
  Home, Users, Briefcase, Users2, LogOut, ChevronRight,
  BookOpen, CalendarDays, ShieldCheck, ClipboardList, BookMarked,
  Bell, MessageSquare, Library,
  FileText, CheckSquare, TrendingUp, ClipboardCheck,
  Shield, Sparkles, Palmtree, Trophy, Boxes, CalendarClock, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useLogout, useGetMyActiveDelegations } from "@workspace/api-client-react";
import { AsaAvatar, type AsaPose } from "@/components/AsaAvatar";

// ─── Nav definitions ──────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  comingSoon?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: "INÍCIO",
    items: [
      { href: "/admin/home",  icon: Home,   label: "Início" },
      { href: "/admin/mural", icon: Trophy, label: "Mural"  },
    ],
  },
  {
    label: "OPERAÇÃO",
    items: [
      { href: "/admin/scales",                       icon: ClipboardList,  label: "Escalas"                    },
      { href: "/admin/activities",                   icon: CalendarClock,  label: "Atividades"                 },
      { href: "/admin/daily-book",                   icon: BookMarked,     label: "Livro do Dia"               },
      { href: "/admin/requests",                     icon: FileText,       label: "Solicitações"               },
      { href: "/admin/folgas-indisponibilidades",    icon: Palmtree,       label: "Folgas & Indisponib."       },
      { href: "/admin/tasks",                        icon: CheckSquare,    label: "Tarefas"                    },
      { href: "/supervisor/check-ins",               icon: ClipboardCheck, label: "Status do Dia"             },
      { href: "/admin/responsabilidades-delegacoes", icon: ShieldCheck,    label: "Responsabilidades"          },
    ],
  },
  {
    label: "PLANEJAMENTO",
    items: [
      { href: "/admin/agenda",    icon: CalendarDays, label: "Agenda"        },
      { href: "/admin/show-book", icon: BookOpen,     label: "Livro do Show" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { href: "/admin/avisos",   icon: Bell,          label: "Avisos"    },
      { href: "/admin/messages", icon: MessageSquare, label: "Mensagens" },
      { href: "#",               icon: Share2,         label: "Marketing", comingSoon: true },
    ],
  },
  {
    label: "CONHECIMENTO",
    items: [
      { href: "/admin/library", icon: Library, label: "Biblioteca" },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { href: "/admin/insights", icon: TrendingUp, label: "Indicadores" },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { href: "/admin/asa", icon: Sparkles, label: "My ASA" },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/admin/operations", icon: Briefcase, label: "Operações" },
      { href: "/admin/groups",     icon: Users2,    label: "Grupos"    },
      { href: "/admin/users",      icon: Users,     label: "Usuários"  },
    ],
  },
];

const SUPERVISOR_NAV: NavGroup[] = [
  {
    label: "INÍCIO",
    items: [
      { href: "/admin/home",  icon: Home,   label: "Início" },
      { href: "/admin/mural", icon: Trophy, label: "Mural"  },
    ],
  },
  {
    label: "EQUIPE",
    items: [
      { href: "/supervisor/equipe", icon: Users2, label: "Equipe"  },
      { href: "/supervisor/grupos", icon: Boxes,  label: "Grupos"  },
    ],
  },
  {
    label: "OPERAÇÃO",
    items: [
      { href: "/admin/scales",                       icon: ClipboardList,  label: "Escalas"             },
      { href: "/supervisor/daily-book",              icon: BookMarked,     label: "Livro do Dia"        },
      { href: "/supervisor/requests",                icon: FileText,       label: "Solicitações"        },
      { href: "/admin/folgas-indisponibilidades",    icon: Palmtree,       label: "Folgas & Indisponib."},
      { href: "/supervisor/tasks",                   icon: CheckSquare,    label: "Tarefas"             },
      { href: "/supervisor/check-ins",               icon: ClipboardCheck, label: "Status do Dia"       },
      { href: "/admin/responsabilidades-delegacoes", icon: ShieldCheck,    label: "Responsabilidades"   },
    ],
  },
  {
    label: "PLANEJAMENTO",
    items: [
      { href: "/admin/agenda",    icon: CalendarDays, label: "Agenda"        },
      { href: "/admin/show-book", icon: BookOpen,     label: "Livro do Show" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { href: "/supervisor/avisos",   icon: Bell,          label: "Avisos"    },
      { href: "/supervisor/messages", icon: MessageSquare, label: "Mensagens" },
      { href: "#",                    icon: Share2,         label: "Marketing", comingSoon: true },
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
      { href: "/supervisor/insights", icon: TrendingUp, label: "Indicadores" },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { href: "/admin/asa", icon: Sparkles, label: "My ASA" },
    ],
  },
];

const MEMBER_NAV: NavGroup[] = [
  {
    label: "INÍCIO",
    items: [
      { href: "/admin/home",  icon: Home,   label: "Início" },
      { href: "/admin/mural", icon: Trophy, label: "Mural"  },
    ],
  },
  {
    label: "MEU DIA A DIA",
    items: [
      { href: "/membro/escala",       icon: ClipboardList, label: "Minha Escala"  },
      { href: "/membro/livro-do-dia", icon: BookMarked,    label: "Livro do Dia"  },
      { href: "/membro/tarefas",      icon: CheckSquare,   label: "Tarefas"       },
      { href: "/membro/folgas",       icon: Palmtree,      label: "Folgas"        },
      { href: "/membro/solicitacoes", icon: FileText,      label: "Solicitações"  },
    ],
  },
  {
    label: "PLANEJAMENTO",
    items: [
      { href: "/admin/agenda",    icon: CalendarDays, label: "Agenda"        },
      { href: "/admin/show-book", icon: BookOpen,     label: "Livro do Show" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { href: "/membro/avisos",    icon: Bell,          label: "Avisos"    },
      { href: "/membro/mensagens", icon: MessageSquare, label: "Mensagens" },
    ],
  },
  {
    label: "CONHECIMENTO",
    items: [
      { href: "/membro/biblioteca", icon: Library, label: "Biblioteca" },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { href: "/admin/asa", icon: Sparkles, label: "My ASA" },
    ],
  },
];

const TRAINER_NAV: NavGroup[] = [
  {
    label: "INÍCIO",
    items: [
      { href: "/admin/home",  icon: Home,   label: "Início" },
      { href: "/admin/mural", icon: Trophy, label: "Mural"  },
    ],
  },
  {
    label: "MEU TRABALHO",
    items: [
      { href: "/membro/escala", icon: ClipboardList, label: "Minha Escala" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { href: "/membro/avisos",    icon: Bell,          label: "Avisos"    },
      { href: "/membro/mensagens", icon: MessageSquare, label: "Mensagens" },
    ],
  },
];

// Responsabilidade → item de navegação para Capitão
const RESP_TO_NAV: Record<string, NavItem> = {
  CHECK_INS:            { href: "/supervisor/check-ins",  icon: ClipboardCheck, label: "Status do Dia" },
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

type AsaResumoShort = {
  avatarState?: string;
  items?: { emoji: string; text: string }[];
};

function avatarStateToAdminPose(state: string | undefined): AsaPose {
  const map: Record<string, AsaPose> = {
    feliz:       "feliz",
    duvida:      "duvida",
    comemoracao: "comemoracao",
    atencao:     "aviso_importante",
    sugestao:    "recomendacao",
    boanoite:    "boanoite",
    bomdia:      "bomdia",
  };
  return (state && map[state]) ? map[state]! : "idle";
}

function getAdminSpeechText(resumo: AsaResumoShort | null): string {
  if (!resumo) return "Carregando seu dia…";
  const overdueItem = resumo.items?.find((i) => i.emoji === "⚠️");
  if (overdueItem) return `${overdueItem.emoji} ${overdueItem.text}`;
  const firstItem = resumo.items?.[0];
  if (firstItem) return `${firstItem.emoji} ${firstItem.text}`;
  switch (resumo.avatarState) {
    case "comemoracao": return "Tem motivos para comemorar hoje! 🎉";
    case "atencao":     return "Atenção: há itens importantes. ⚠️";
    case "sugestao":    return "Tenho sugestões para você. 💡";
    case "boanoite":    return "Boa noite! 🌙";
    default:            return "Tudo certo hoje! ☀️";
  }
}

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout: clearAuth, roles: userRoles } = useAuth();
  const logoutMutation = useLogout();
  const { data: delegData } = useGetMyActiveDelegations({
    query: { retry: false } as any,
  });
  const [asaResumo, setAsaResumo] = useState<AsaResumoShort | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("myasa_access_token");
    if (!token) return;
    fetch("/api/asa/resumo-do-dia", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setAsaResumo(data); })
      .catch(() => {});
  }, []);

  const isAdmin      = userRoles.some((r) => r.role === "ADMIN");
  const isSupervisor = userRoles.some((r) => r.role === "SUPERVISOR_A" || r.role === "SUPERVISOR_B");
  const isTrainer    = !isAdmin && !isSupervisor && userRoles.some((r) => r.role === "TRAINER");
  const activeDelegations = delegData?.delegations ?? [];

  // Responsabilidades únicas das delegações ativas
  const captainResponsibilities = [
    ...new Set(activeDelegations.flatMap((d) => d.responsibilities as string[])),
  ];

  const isCaptain = !isAdmin && !isSupervisor && !isTrainer && captainResponsibilities.length > 0;

  // Itens do CAPITÃO: apenas responsabilidades recebidas, sem duplicar
  const captainItems: NavItem[] = captainResponsibilities
    .map((r) => RESP_TO_NAV[r])
    .filter(Boolean);

  const roleLabel = isAdmin
    ? "Gerência"
    : isSupervisor
    ? "Supervisor"
    : isTrainer
    ? "Treinador"
    : isCaptain
    ? "Capitão"
    : "Elenco";

  const navGroups: NavGroup[] = isAdmin
    ? ADMIN_NAV
    : isSupervisor
    ? SUPERVISOR_NAV
    : isTrainer
    ? TRAINER_NAV
    : MEMBER_NAV;

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
          <div className="flex-1 min-w-0">
            <span className="font-serif font-bold text-base tracking-tight leading-none">MyASA</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{roleLabel}</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="shrink-0 cursor-pointer">
                  <AsaAvatar
                    size="small"
                    pose={avatarStateToAdminPose(asaResumo?.avatarState)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[180px] text-xs">
                {getAdminSpeechText(asaResumo)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <nav className="flex-1 p-3 space-y-4">
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

          {/* Nav normal por grupos */}
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.href;

                  if (item.comingSoon) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/40 cursor-default select-none"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                        <span className="ml-auto text-[9px] font-semibold bg-muted rounded px-1 py-0.5 text-muted-foreground/60">
                          Em breve
                        </span>
                      </div>
                    );
                  }

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
