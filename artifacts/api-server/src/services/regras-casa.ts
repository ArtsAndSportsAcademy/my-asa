/**
 * Regras da casa (28 Perfil): silêncio noturno e antecedência do lembrete de check-in.
 * A Administração define o padrão da organização; cada pessoa só desloca a própria janela de silêncio.
 * "Notificação não é preferência": ninguém desliga tipo de aviso — o silêncio só adia o push.
 */
import { eq } from "drizzle-orm";
import { db, organizationsTable, usersTable, REGRAS_PADRAO, type JanelaSilencio, type RegrasCasa } from "@workspace/db";
import type { CreateNotificationInput } from "./notificationService.js";

export const LEMBRETE_OPCOES = [15, 30, 60] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function regrasValidas(value: unknown): value is RegrasCasa {
  const r = value as RegrasCasa | null;
  return Boolean(r && janelaValida(r.silencio) && (LEMBRETE_OPCOES as readonly number[]).includes(r.lembreteCheckinMin));
}
export function janelaValida(value: unknown): value is JanelaSilencio {
  const j = value as JanelaSilencio | null;
  return Boolean(j && typeof j.on === "boolean" && typeof j.de === "string" && typeof j.ate === "string" && HHMM.test(j.de) && HHMM.test(j.ate) && j.de !== j.ate);
}

/** Regras gravadas completadas com o padrão (organização antiga ou campo faltando). */
export function comPadrao(regras: Partial<RegrasCasa> | null | undefined): RegrasCasa {
  return {
    silencio: janelaValida(regras?.silencio) ? regras!.silencio : REGRAS_PADRAO.silencio,
    lembreteCheckinMin: (LEMBRETE_OPCOES as readonly number[]).includes(regras?.lembreteCheckinMin ?? -1) ? regras!.lembreteCheckinMin! : REGRAS_PADRAO.lembreteCheckinMin,
  };
}

export async function regrasDaOrganizacao(organizationId: string): Promise<RegrasCasa> {
  const [org] = await db.select({ regras: organizationsTable.regras }).from(organizationsTable).where(eq(organizationsTable.id, organizationId)).limit(1);
  return comPadrao(org?.regras);
}

/** Hora "HH:MM" e minutos do dia em São Paulo. */
function minutosSP(now: Date) {
  const hhmm = now.toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = hhmm.split(":").map(Number);
  return (h! % 24) * 60 + m!;
}
const minutos = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h! * 60 + m!; };

export function dentroDoSilencio(now: Date, janela: JanelaSilencio): boolean {
  if (!janela.on) return false;
  const agora = minutosSP(now), de = minutos(janela.de), ate = minutos(janela.ate);
  return de < ate ? agora >= de && agora < ate : agora >= de || agora < ate;
}

/** Quando a janela acaba (próximo "ate" em São Paulo). */
export function fimDoSilencio(now: Date, janela: JanelaSilencio): Date {
  const faltam = (minutos(janela.ate) - minutosSP(now) + 1440) % 1440 || 1440;
  const fim = new Date(now.getTime() + faltam * 60_000);
  fim.setSeconds(0, 0);
  return fim;
}

/**
 * O que atravessa o silêncio: aviso marcado como crítico, troca de escala do próprio dia
 * (a publicação marca como CRITICAL) e o lembrete do próprio turno, que só existe perto do bloco.
 */
export function atravessaSilencio(input: Pick<CreateNotificationInput, "type" | "priority">): boolean {
  return input.priority === "CRITICAL" || input.type === "checkin.shift_reminder";
}

/** Janela que vale para a pessoa: a dela, se escolheu; senão a da casa. */
export async function janelaDaPessoa(userId: string): Promise<JanelaSilencio | null> {
  const [row] = await db.select({ silencio: usersTable.silencio, regras: organizationsTable.regras })
    .from(usersTable).innerJoin(organizationsTable, eq(organizationsTable.id, usersTable.organizationId))
    .where(eq(usersTable.id, userId)).limit(1);
  if (!row) return null;
  return janelaValida(row.silencio) ? row.silencio : comPadrao(row.regras).silencio;
}

/** Se o push deve esperar, devolve até quando; senão null. */
export async function pushEsperaAte(input: CreateNotificationInput, now = new Date()): Promise<Date | null> {
  if (atravessaSilencio(input)) return null;
  const janela = await janelaDaPessoa(input.userId);
  if (!janela || !dentroDoSilencio(now, janela)) return null;
  return fimDoSilencio(now, janela);
}
