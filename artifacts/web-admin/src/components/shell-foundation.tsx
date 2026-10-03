import { type ReactNode, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Bell, BookOpen, CalendarDays, CheckCircle2, CircleAlert, ClipboardCheck, Clock3, Inbox, LayoutDashboard, LogOut, MapPin, Menu, MessageCircle, MoreHorizontal, Search, Users } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { PwaSetup, installedMode, usePushSubscribed } from "@/components/pwa-setup";
import AvisoSemConexao from "@/components/aviso-sem-conexao";
const ShowsPage = lazy(() => import("@/pages/shows"));
const MeuDiaPage = lazy(() => import("@/pages/meu-dia"));
const PerfilPage = lazy(() => import("@/pages/perfil"));
import { useSignOut } from "@/hooks/use-sign-out";
const RegistroPage = lazy(() => import("@/pages/registro"));
const AniversariosFaixa = lazy(() => import("@/pages/aniversarios-faixa"));
const LivroDoDiaPage = lazy(() => import("@/pages/livro-do-dia"));
const EscalasPage = lazy(() => import("@/pages/escalas"));
const CadastrosPage = lazy(() => import("@/pages/cadastros"));
const CheckInPage = lazy(() => import("@/pages/checkin-shifts").then(module => ({ default: module.CheckInPage })));
const FolgasPage = lazy(() => import("@/pages/operational-cycle").then(module => ({ default: module.FolgasPage })));
const SolicitacoesPage = lazy(() => import("@/pages/solicitacoes"));
const PanelPage = lazy(() => import("@/pages/operational-cycle").then(module => ({ default: module.PanelPage })));
const LibraryPage = lazy(() => import("@/pages/communication").then(module => ({ default: module.LibraryPage })));
const MessagesPage = lazy(() => import("@/pages/communication").then(module => ({ default: module.MessagesPage })));
const MuralPage = lazy(() => import("@/pages/communication").then(module => ({ default: module.MuralPage })));
const ResponsibilitiesTasksPage = lazy(() => import("@/pages/responsibilities-tasks"));
// D5: a ASA carrega no próprio pacote, depois que a tela já abriu.
const GlobalAsaAssistant = lazy(() => import("@/components/global-asa-assistant"));
import "@/pages/responsibilities-tasks.css";
const AgendaWorkspacePage = lazy(() => import("@/pages/agenda-workspace"));
import "@/pages/agenda-workspace.css";

type ShellRole = "adm" | "dir" | "sup" | "mem";
// tabLabel: nome curto para a barra de baixo do celular. alsoHref: telas que moram dentro do mesmo item (abas).
type NavItem = { label: string; href: string; icon: typeof CalendarDays; kind: "list" | "time" | "cards"; roles: ShellRole[]; memberLabel?: string; tabLabel?: string; alsoHref?: string[] };
type SearchItem = { id: string; label: string; href: string; subtitle?: string };
type SearchResult = { groups: { key: string; label: string; items: SearchItem[] }[]; asaAtTop: boolean };

// 02/10 (Claude): grupos, ordem e nomes do desenho (Estrutura My ASA e telas 25/28). Folgas e Solicitações viraram um item só, com duas abas.
const groups: { label: string; items: NavItem[] }[] = [
  { label: "Porta de entrada", items: [
    { label: "Meu Dia", href: "/meu-dia", icon: LayoutDashboard, kind: "cards", roles: ["adm", "dir", "sup", "mem"] },
  ] },
  { label: "O dia", items: [
    { label: "Agenda", memberLabel: "Minha agenda", href: "/agenda", icon: CalendarDays, kind: "time", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Escalas", memberLabel: "Minha escala", href: "/escalas", icon: Clock3, kind: "time", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Shows", href: "/shows", icon: CalendarDays, kind: "list", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Livro do Dia", memberLabel: "Meus shows", href: "/livro-do-dia", icon: BookOpen, kind: "time", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Check-in e ocorrências", memberLabel: "Check-in", tabLabel: "Check-in", href: "/check-in", icon: CheckCircle2, kind: "cards", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Responsabilidades e tarefas", memberLabel: "Minhas tarefas", href: "/responsabilidades", icon: ClipboardCheck, kind: "list", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Folgas e solicitações", memberLabel: "Minhas folgas", href: "/folgas", alsoHref: ["/solicitacoes"], icon: Inbox, kind: "time", roles: ["adm", "dir", "sup", "mem"] },
  ] },
  { label: "Gestão", items: [
    { label: "Painel", href: "/painel", icon: LayoutDashboard, kind: "cards", roles: ["adm", "dir", "sup"] },
    { label: "Locais", href: "/locais", icon: MapPin, kind: "list", roles: ["adm", "dir", "sup"] },
    { label: "Pessoas e acessos", memberLabel: "Meu grupo", href: "/pessoas", icon: Users, kind: "list", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Áreas", href: "/areas", icon: Users, kind: "list", roles: ["adm", "dir", "sup"] },
    { label: "Registro", href: "/registro", icon: Clock3, kind: "list", roles: ["adm", "dir"] },
  ] },
  { label: "Comunicação", items: [
    { label: "Avisos e Mural", memberLabel: "Mural", tabLabel: "Mural", href: "/mural", icon: Bell, kind: "list", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Mensagens", memberLabel: "Conversas", href: "/mensagens", icon: MessageCircle, kind: "list", roles: ["adm", "dir", "sup", "mem"] },
    { label: "Biblioteca", href: "/biblioteca", icon: BookOpen, kind: "list", roles: ["adm", "dir", "sup", "mem"] },
  ] },
];

function useIsMobile() { const [mobile, setMobile] = useState(() => window.innerWidth < 720); useEffect(() => { const fn = () => setMobile(window.innerWidth < 720); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, []); return mobile; }
function roleFromSession(roles: { role: string }[]): ShellRole {
  if (roles.some(r => r.role === "ADMIN" || r.role === "ADM")) return "adm";
  if (roles.some(r => r.role === "DIR" || r.role === "DIRECTOR")) return "dir";
  if (roles.some(r => r.role === "SUP" || r.role.startsWith("SUPERVISOR"))) return "sup";
  return "mem";
}
function roleLabel(role: ShellRole) { return ({ adm: "ADMINISTRAÇÃO", dir: "DIREÇÃO", sup: "SUPERVISÃO", mem: "ELENCO" } as const)[role]; }
function itemLabel(item: NavItem, role: ShellRole) { return role === "mem" ? item.memberLabel ?? item.label : item.label; }
function tabLabel(item: NavItem, role: ShellRole) { return item.tabLabel ?? itemLabel(item, role); }
function canSee(item: NavItem, role: ShellRole) { return item.roles.includes(role); }
function isAt(item: NavItem, location: string) { return location === item.href || Boolean(item.alsoHref?.includes(location)); }
function todayLabel() { return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }); }
function agoLabel(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora"; if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60); if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
}

type Notificacao = { id: string; title: string; message: string; actionUrl: string | null; readAt: string | null; createdAt: string };
/** Sino do cabeçalho (desenho 01): contador de não lidas e a lista das últimas, cada uma levando à tela certa. */
function NotificationBell({ enabled }: { enabled: boolean }) {
  const [, navigate] = useLocation();
  const [count, setCount] = useState(0), [open, setOpen] = useState(false), [items, setItems] = useState<Notificacao[] | null>(null), [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => customFetch<{ count: number }>("/api/notifications/unread-count").then(r => { if (alive) setCount(r.count); }).catch(() => {});
    load(); const timer = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [enabled]);
  const toggle = () => {
    const next = !open; setOpen(next);
    if (next && enabled) { setError(""); customFetch<{ notifications: Notificacao[] }>("/api/notifications?limit=20").then(r => setItems(r.notifications)).catch(() => setError("Não consegui carregar os avisos agora. Tente de novo.")); }
  };
  const go = async (n: Notificacao) => {
    if (!n.readAt) { try { await customFetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }); setCount(c => Math.max(0, c - 1)); } catch { /* abrir a tela vale mais que marcar como lida */ } }
    setOpen(false);
    navigate(n.actionUrl && n.actionUrl.startsWith("/") && !n.actionUrl.startsWith("//") ? n.actionUrl : "/meu-dia");
  };
  const readAll = async () => {
    try { await customFetch("/api/notifications/read-all", { method: "PATCH" }); setCount(0); setItems(list => list?.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null); }
    catch { setError("Não consegui marcar como lidas. Tente de novo."); }
  };
  return <div className="asa-bell" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <button type="button" className="asa-bell-button" aria-label={count ? `Avisos: ${count} não ${count === 1 ? "lido" : "lidos"}` : "Avisos"} aria-expanded={open} onClick={toggle}><Bell size={18}/>{count > 0 && <span className="asa-bell-count">{count > 99 ? "99+" : count}</span>}</button>
    {open && <div className="asa-bell-panel" role="dialog" aria-label="Avisos">
      <div className="asa-bell-head"><strong>Avisos</strong>{enabled && count > 0 && <button type="button" onClick={() => void readAll()}>marcar todos como lidos</button>}</div>
      {!enabled ? <p className="asa-bell-empty">Entre na sua conta para ver seus avisos.</p>
        : error ? <p className="asa-bell-empty" role="alert">{error}</p>
        : !items ? <p className="asa-bell-empty">Carregando…</p>
        : !items.length ? <p className="asa-bell-empty">Nenhum aviso por enquanto. Quando a escala mudar ou um aviso pedir ciente, ele aparece aqui.</p>
        : <ul>{items.map(n => <li key={n.id}><button type="button" className={n.readAt ? "" : "unread"} onClick={() => void go(n)}><b>{n.title}</b><span>{n.message}</span><small>{agoLabel(n.createdAt)}</small></button></li>)}</ul>}
    </div>}
  </div>;
}
function looksQuestion(query: string, noResults: boolean) { const clean = query.trim().toLocaleLowerCase("pt-BR"); return noResults || clean.split(/\s+/).length >= 4 || /^(quem|quando|onde|quantos|por que|porque|como)\b/.test(clean) || clean.endsWith("?"); }

export function PersonRow({ name = "Pessoa", context = "Área · Local · Bloco" }: { name?: string; context?: string }) { return <div className="asa-person-row"><span className="asa-avatar">{name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>{context}</small></span></div>; }
export function AreaLocationChips({ area = "Bailarinos", location = "Snowland" }: { area?: string; location?: string }) { return <span className="asa-chips"><span className="asa-chip asa-chip-area">{area}</span><span className="asa-chip asa-chip-location">{location}</span></span>; }
export function StatusTag({ children = "Rascunho", tone = "neutral" }: { children?: string; tone?: "neutral" | "good" | "warn" | "bad" }) { return <span className={`asa-status asa-status-${tone}`}>{children}</span>; }
export function TimeBlock() { return <div className="asa-time-block"><b>10:00–11:00</b><span>ACQUASHOW DUO</span></div>; }

function GlobalSearch() {
  const [query, setQuery] = useState(""); const [result, setResult] = useState<SearchResult | null>(null); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!query.trim()) { setResult(null); setError(""); return; } const c = new AbortController(); const timer = window.setTimeout(() => customFetch<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`, { signal: c.signal }).then(setResult).catch(() => setError("Não consegui buscar agora. Tente de novo.")), 160); return () => { clearTimeout(timer); c.abort(); }; }, [query]);
  const noResults = Boolean(result && result.groups.every(g => !g.items.length)); const asaTop = looksQuestion(query, noResults) || Boolean(result?.asaAtTop);
  const asa = <Link className="asa-search-asa" href={`/asa?question=${encodeURIComponent(query)}`} onClick={() => setOpen(false)}>Perguntar à ASA sobre “{query}”</Link>;
  return <div className="asa-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}><Search size={16}/><input aria-label="Buscar ou perguntar" value={query} placeholder="Buscar ou perguntar" onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} />
    {open && <div className="asa-search-results" aria-live="polite">{!query.trim() ? <p className="asa-search-empty"><img className="asa-mascot asa-mascot-inline" src="/asa/oi.webp" alt=""/>Pessoas e datas aparecem aqui. Seus últimos atalhos ficam só neste aparelho.</p> : error ? <p role="alert"><img className="asa-mascot asa-mascot-inline" src="/asa/duvida.webp" alt=""/>Não consegui buscar agora. Tente de novo.</p> : !result ? <p>Buscando…</p> : <>{asaTop && asa}{result.groups.map(group => group.items.length ? <section key={group.key}><h2>{group.label}</h2>{group.items.slice(0, 3).map(item => <Link key={item.id} href={item.href} onClick={() => setOpen(false)}><strong>{item.label}</strong><small>{item.subtitle}</small></Link>)}</section> : null)}{noResults && <p className="asa-search-empty"><img className="asa-mascot asa-mascot-inline" src="/asa/duvida.webp" alt=""/>Nada no seu acesso para esta busca.</p>}{!asaTop && asa}</>}</div>}</div>;
}

function PageArchetype({ kind, title }: { kind: NavItem["kind"]; title: string }) {
  const [state, setState] = useState<"ready" | "loading" | "error" | "empty" | "conflict">("ready");
  const body = state === "loading" ? <div className="asa-skeletons" aria-busy="true"><i/><i/><i/></div> : state === "error" ? <div className="asa-card asa-error"><img className="asa-mascot" src="/asa/duvida.webp" alt=""/><CircleAlert/><strong>Não consegui carregar {title.toLocaleLowerCase()}.</strong><button onClick={() => setState("ready")}>Tentar de novo</button></div> : state === "empty" ? <div className="asa-card asa-empty"><img className="asa-mascot" src="/asa/oi.webp" alt=""/><strong>Nada por aqui ainda</strong><p>Quando houver dados para seu acesso, eles aparecem nesta área.</p></div> : state === "conflict" ? <div className="asa-card asa-conflict"><strong>Alguém alterou este conteúdo</strong><p><b>Horário:</b> de 10:00 para 10:30</p><button onClick={() => setState("ready")}>Recarregar antes de salvar</button></div> : kind === "cards" ? <div className="asa-card-grid">{["Seu próximo compromisso", "O que precisa de você", "Hoje"].map((card, i) => <article className="asa-card" key={card}><StatusTag tone={i === 1 ? "warn" : "good"}>{i === 1 ? "atenção" : "pronto"}</StatusTag><h2>{card}</h2><PersonRow /><TimeBlock /></article>)}</div> : kind === "time" ? <div className="asa-temporal"><div>Horário</div><div>Hoje</div><div>10:00</div><TimeBlock/><div>11:00</div><TimeBlock/></div> : <div className="asa-list"><div><PersonRow/><AreaLocationChips/><StatusTag>ativa</StatusTag></div><div><PersonRow name="Pessoa" context="Área · Local · Bloco"/><AreaLocationChips area="Patinadores"/><StatusTag tone="good">publicado</StatusTag></div></div>;
  return <section className="asa-page"><div className="asa-page-tools"><button onClick={() => setState("loading")}>Carregando</button><button onClick={() => setState("error")}>Erro</button><button onClick={() => setState("empty")}>Vazio</button><button onClick={() => setState("conflict")}>409</button></div>{body}</section>;
}

function InstallPrompt() { const installed = installedMode(); const [subscribed] = usePushSubscribed(installed); const ios = /iPhone|iPad|iPod/.test(navigator.userAgent); const outside = ios && (!/Safari/.test(navigator.userAgent) || /CriOS|FxiOS|EdgiOS|WhatsApp|Instagram/.test(navigator.userAgent)); if (installed && subscribed) return null; if (installed) return <section className="asa-install"><img className="asa-mascot asa-mascot-install" src="/asa/lembrete.webp" alt=""/><StatusTag tone="warn">avisos</StatusTag><h2>Ative os avisos neste celular</h2><p>Você fica sabendo quando a escala sai ou muda, na hora do check-in e quando um aviso pede ciente.</p><PwaSetup embedded /></section>; return <section className="asa-install"><img className="asa-mascot asa-mascot-install" src="/asa/lembrete.webp" alt=""/><StatusTag tone="warn">instalação</StatusTag><h2>Coloque o My ASA na tela de início</h2><p>Instale primeiro. Só depois, abrindo pelo ícone, o app pede permissão para avisos.</p>{outside ? <p className="asa-install-warning">Abra este endereço no Safari. No iPhone, a instalação não existe no navegador interno ou no Chrome.</p> : <ol><li>Abra o menu do navegador.</li><li>{ios ? "Toque em Adicionar à Tela de Início." : "Escolha Instalar aplicativo."}</li><li>Abra o My ASA pelo ícone e então permita avisos.</li></ol>}<PwaSetup embedded /></section>; }

export default function ShellFoundation() {
  const { user, roles, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const signOut = useSignOut();
  const mobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerExtra, setHeaderExtra] = useState<ReactNode>(null);
  // Altura ocupada pelo cabeçalho do shell (e, no celular, pela barra de cima e pela de baixo).
  // O mapa de palco usa isso para caber na área visível sem rolar (--asa-chrome-h).
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => {
      const height = [".asa-header", ".asa-mobile-head", ".asa-bottom"].reduce((total, selector) => total + ((shell.querySelector(selector) as HTMLElement | null)?.offsetHeight ?? 0), 0);
      shell.style.setProperty("--asa-chrome-h", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    shell.querySelectorAll(".asa-header, .asa-mobile-head, .asa-bottom").forEach((element) => observer.observe(element));
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  });
  // A prévia é uma sessão visual local. O navegador pode preservar a opção do
  // select entre recargas; guardar a escolha evita uma tela que parece SUP,
  // mas ainda recebe as permissões de MEM por dentro.
  const [reviewRole, setReviewRole] = useState<ShellRole | "">(() => {
    if (!import.meta.env.DEV) return "";
    const stored = window.sessionStorage.getItem("myasa-review-role");
    if (stored === "adm" || stored === "dir" || stored === "sup" || stored === "mem") return stored;
    return new URLSearchParams(window.location.search).get("amostra") === "1" ? "sup" : "";
  });
  const sessionRole = roleFromSession(roles);
  // Somente no Vite local: altera a prévia visual, nunca a sessão ou a API.
  const role = import.meta.env.DEV && reviewRole ? reviewRole : sessionRole;
  const visible = useMemo(() => groups.map(g => ({ ...g, items: g.items.filter(i => canSee(i, role)) })).filter(g => g.items.length), [role]);
  const visibleItems = visible.flatMap(g => g.items);
  const profileItem: NavItem = { label: "Perfil", href: "/perfil", icon: Users, kind: "cards", roles: ["adm", "dir", "sup", "mem"] };
  // Elenco vê Shows como estante de leitura (desenho 28): abre o Livro e lê, sem editar.
  const active = visibleItems.find(i => isAt(i, location)) ?? (location === "/perfil" ? profileItem : visible[0]?.items[0]);
  const mobileItems = ["/meu-dia", "/escalas", "/check-in", "/mural"].map(href => visibleItems.find(item => item.href === href)).filter((item): item is NavItem => Boolean(item));
  // Sem sessão, o app não abre: vai para a entrada. A única exceção é a amostra local do Vite.
  const localSample = import.meta.env.DEV && (Boolean(reviewRole) || new URLSearchParams(window.location.search).get("amostra") === "1" || window.sessionStorage.getItem("myasa-review-sample") === "1");
  if (isLoading) return null;
  if (!isAuthenticated && !localSample) return <Redirect to="/login"/>;
  // Endereço que não é tela deste perfil (rota antiga, link velho de aviso) cai no Meu Dia.
  const known = visibleItems.some(i => isAt(i, location)) || location === "/perfil";
  if (!known) return <Redirect to="/meu-dia"/>;
  if (!active) return null;
  const renderNavigation = () => <nav>{visible.map(group => <section key={group.label}><h2>{group.label}</h2>{group.items.map(item => { const Icon = item.icon; return <Link className={isAt(item, location) ? "active" : ""} key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}><Icon size={16}/>{itemLabel(item, role)}</Link>; })}</section>)}</nav>;
  return <div className="asa-shell" ref={shellRef}>
    {drawerOpen && <button className="asa-shell-drawer-backdrop" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)} />}
    <aside className={`asa-sidebar ${drawerOpen ? "open" : ""}`}>
      <Link href="/meu-dia" className="asa-brand" onClick={() => setDrawerOpen(false)}><img src="/asa-wing.png" alt=""/> <b>My ASA</b></Link>
      <GlobalSearch/>
      {renderNavigation()}
      <div className="asa-sidebar-footer">
        {import.meta.env.DEV && <label className="asa-review asa-review-sidebar"><span>Revisar como</span><select aria-label="Revisar menu como" value={reviewRole} onChange={e => { const next = e.target.value as ShellRole | ""; setReviewRole(next); if (next) window.sessionStorage.setItem("myasa-review-role", next); else window.sessionStorage.removeItem("myasa-review-role"); }}><option value="">Sessão atual: {isAuthenticated ? roleLabel(sessionRole) : "sem login"}</option><option value="adm">Administração</option><option value="dir">Direção</option><option value="sup">Supervisão</option><option value="mem">Elenco</option></select></label>}
        <Link href="/perfil" className="asa-profile" onClick={() => setDrawerOpen(false)}><span className="asa-avatar">{((user as any)?.displayName ?? user?.name ?? "ASA").slice(0,2).toUpperCase()}</span><span><b>{(user as any)?.displayName ?? user?.name ?? (isAuthenticated ? "Sua conta" : "Prévia local")}</b><small>{roleLabel(role)}</small></span></Link>
        {isAuthenticated && <button type="button" className="asa-signout" onClick={() => void signOut()}><LogOut size={15}/> Sair</button>}
      </div>
    </aside>
    <div className="asa-mobile-head"><button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu" aria-expanded={drawerOpen}><Menu/></button><b>{itemLabel(active, role)}</b>{mobile && <NotificationBell enabled={isAuthenticated}/>}</div>
    <main>
      <AvisoSemConexao/>
      <header className={`asa-header${active.href === "/livro-do-dia" || active.href === "/escalas" ? " ldd-shell-header" : ""}`}>
        <div><h1>{itemLabel(active, role)}</h1><p className="asa-header-date">{todayLabel()}{active.href === "/shows" && " · Livro do Show, origem do Livro do Dia"}</p></div>
        {active.href === "/livro-do-dia" || active.href === "/escalas" ? headerExtra : null}
        {!mobile && <NotificationBell enabled={isAuthenticated}/>}
      </header>
      {active.href === "/folgas" && <nav className="asa-page-tabs" aria-label="Folgas e solicitações"><Link className={location === "/folgas" ? "active" : ""} href="/folgas">Folgas</Link><Link className={location === "/solicitacoes" ? "active" : ""} href="/solicitacoes">Solicitações</Link></nav>}
      <Suspense fallback={<section className="asa-page"><div className="asa-skeletons" aria-busy="true"><i/><i/><i/></div></section>}>
        {active.href === "/meu-dia" ? <><MeuDiaPage role={role}/><InstallPrompt/></>
          : active.href === "/perfil" ? <PerfilPage role={role}/>
          : active.href === "/shows" ? <ShowsPage canManage={role === "adm" || role === "sup"} onlyPublished={role === "mem"}/>
          : active.href === "/escalas" ? <EscalasPage role={role} onHeader={setHeaderExtra}/>
          : active.href === "/livro-do-dia" ? <LivroDoDiaPage role={role} canManage={role === "adm" || role === "sup"} onHeader={setHeaderExtra}/>
          : active.href === "/folgas" ? (location === "/solicitacoes" ? <SolicitacoesPage role={role} meuId={user?.id ?? null}/> : <FolgasPage role={role}/>)
          : active.href === "/check-in" ? <CheckInPage role={role}/>
          : active.href === "/painel" ? <PanelPage role={role}/>
          : active.href === "/mural" ? <><AniversariosFaixa/><MuralPage role={role}/></>
          : active.href === "/mensagens" ? <MessagesPage role={role}/>
          : active.href === "/biblioteca" ? <LibraryPage role={role}/>
          : active.href === "/pessoas" ? <CadastrosPage screen="people" role={role}/>
          : active.href === "/areas" ? <CadastrosPage screen="areas" role={role}/>
          : active.href === "/locais" ? <CadastrosPage screen="locations" role={role}/>
          : active.href === "/responsabilidades" ? <ResponsibilitiesTasksPage role={role}/>
          : active.href === "/agenda" ? <AgendaWorkspacePage role={role}/>
          : active.href === "/registro" ? <RegistroPage role={role}/>
          : <PageArchetype kind={active.kind} title={itemLabel(active, role)}/>}
      </Suspense>
    </main>
    {mobile && <nav className="asa-bottom">{mobileItems.map(item => { const Icon = item.icon; return <Link className={isAt(item, location) ? "active" : ""} href={item.href} key={item.href}><Icon size={18}/><span>{tabLabel(item, role)}</span></Link>; })}<button onClick={() => setDrawerOpen(true)} aria-label="Mais itens do menu"><MoreHorizontal size={20}/><span>Mais</span></button></nav>}
    <Suspense fallback={null}><GlobalAsaAssistant /></Suspense>
  </div>;
}
