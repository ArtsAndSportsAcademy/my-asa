/**
 * Endereços das telas do app (web-admin, ShellFoundation). Todo link que vai dentro de um aviso
 * passa por aqui antes de ser gravado ou enviado ao celular: rotas antigas — do app Expo
 * (`/(tabs)/...`) e das telas por perfil (`/membro/...`, `/admin/...`, `/supervisor/...`) — não
 * existem mais e levariam a pessoa ao lugar errado.
 */
export const APP_ROUTES = {
  meuDia: "/meu-dia",
  escalas: "/escalas",
  livroDoDia: "/livro-do-dia",
  checkIn: "/check-in",
  folgas: "/folgas",
  solicitacoes: "/solicitacoes",
  agenda: "/agenda",
  mural: "/mural",
  mensagens: "/mensagens",
  biblioteca: "/biblioteca",
  responsabilidades: "/responsabilidades",
  painel: "/painel",
} as const;

const CURRENT = new Set<string>([...Object.values(APP_ROUTES), "/perfil", "/shows", "/pessoas", "/areas", "/locais", "/registro"]);

const LEGACY: [RegExp, string][] = [
  [/^\/\(tabs\)\/(scale|escala)\b|^\/membro\/escala\b|^\/admin\/scales\b/, APP_ROUTES.escalas],
  [/^\/\(tabs\)\/daily-book\b|^\/(membro|admin|supervisor)\/(livro-do-dia|daily-book)\b/, APP_ROUTES.livroDoDia],
  [/^\/\(tabs\)\/agenda\b|^\/admin\/agenda\b/, APP_ROUTES.agenda],
  [/^\/\(tabs\)\/mensagens\b|^\/(membro|admin|supervisor)\/(mensagens|messages)\b/, APP_ROUTES.mensagens],
  [/^\/\(tabs\)\/avisos\b|^\/(membro|admin|supervisor)\/avisos\b|^\/admin\/mural\b/, APP_ROUTES.mural],
  [/^\/\(tabs\)\/solicitacoes\b|^\/membro\/solicitacoes\b|^\/(admin|supervisor)\/requests\b/, APP_ROUTES.solicitacoes],
  [/^\/membro\/folgas\b|^\/(admin|supervisor)\/folgas\b/, APP_ROUTES.folgas],
  [/^\/\(tabs\)\/mais\b|^\/admin\/(responsibilities|responsabilidades)|^\/supervisor\/delegations\b|^\/membro\/tarefas\b|^\/(admin|supervisor)\/tasks\b/, APP_ROUTES.responsabilidades],
  [/^\/supervisor\/check-ins\b/, APP_ROUTES.checkIn],
];

/** Tela padrão de cada tipo de aviso, quando quem gerou não deu um endereço. */
export function appUrlForType(type: string): string {
  if (type.startsWith("scale.")) return APP_ROUTES.escalas;
  if (type.startsWith("book.") || type.startsWith("daily-book")) return APP_ROUTES.livroDoDia;
  if (type.startsWith("checkin.")) return APP_ROUTES.checkIn;
  if (type.startsWith("notice.")) return APP_ROUTES.mural;
  if (type.startsWith("message")) return APP_ROUTES.mensagens;
  if (type.startsWith("leave")) return APP_ROUTES.folgas;
  if (type.startsWith("request.")) return APP_ROUTES.solicitacoes;
  if (type.startsWith("agenda.")) return APP_ROUTES.agenda;
  if (type.startsWith("task") || type.startsWith("delegation") || type.startsWith("responsibility")) return APP_ROUTES.responsabilidades;
  return APP_ROUTES.meuDia;
}

/** Converte o endereço de um aviso para uma tela que existe hoje. Query string é preservada. */
export function normalizeActionUrl(actionUrl: string | null | undefined, type: string): string {
  if (!actionUrl) return appUrlForType(type);
  const [path, query] = actionUrl.split("?");
  const clean = path!.replace(/\/+$/, "") || "/";
  let target: string | undefined = CURRENT.has(clean) ? clean : undefined;
  if (!target) for (const [pattern, route] of LEGACY) if (pattern.test(clean)) { target = route; break; }
  if (!target) target = appUrlForType(type);
  return query ? `${target}?${query}` : target;
}
