import { and, desc, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, userRolesTable, usersTable } from "@workspace/db";
import { enqueueNotification } from "./undo.js";

export type FolgaPublicada = {
  id: string;
  userId: string;
  userName: string;
  operationId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE";
};

export const chaveMesFolgas = (operationId: string, year: number, month: number) =>
  `${operationId}:${year}-${String(month).padStart(2, "0")}`;

/** O retrato é a última publicação ou a foto inicial da migração, nunca o mapa em edição. */
export async function ultimoRetratoFolgas(operationId: string, year: number, month: number) {
  const [event] = await db.select({ action: historyEventsTable.action, afterState: historyEventsTable.afterState, occurredAt: historyEventsTable.occurredAt })
    .from(historyEventsTable)
    .where(and(inArray(historyEventsTable.action, ["FOLGA_MONTH_PUBLISHED", "FOLGA_MONTH_BASELINE"]), eq(historyEventsTable.status, "ACTIVE"), eq(historyEventsTable.entityId, chaveMesFolgas(operationId, year, month))))
    .orderBy(desc(historyEventsTable.occurredAt), desc(historyEventsTable.createdAt)).limit(1);
  if (!event) return null;
  const state = event.afterState as { folgas?: FolgaPublicada[] } | null;
  // Uma publicação antiga sem retrato não pode ser apresentada como se fosse a versão atual.
  return { publishedAt: event.action === "FOLGA_MONTH_PUBLISHED" ? event.occurredAt.toISOString() : null,
    retratoInicial: event.action === "FOLGA_MONTH_BASELINE", folgas: Array.isArray(state?.folgas) ? state.folgas : null };
}

const DIA = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const TIPO: Record<string, string> = { DAY_OFF: "folga", NO_SHOW: "no show", RECESSO: "recesso", AFASTAMENTO: "afastamento", RESTRICAO: "restrição", OUTRO: "ausência" };
const descrever = (f: FolgaPublicada) => `${TIPO[f.type] ?? "folga"} de ${f.startDate === f.endDate ? DIA(f.startDate) : `${DIA(f.startDate)} a ${DIA(f.endDate)}`}`;
/** Duas folgas são a mesma coisa quando o tipo e as datas batem; só isso muda o dia de alguém. */
const assinatura = (f: FolgaPublicada) => `${f.type}|${f.startDate}|${f.endDate}`;

/**
 * Quem teve a própria folga mexida entre uma publicação e a seguinte, com a frase do que mudou.
 * Republicação avisa só estas pessoas: mandar "o mapa mudou" para a operação inteira ensina o
 * Elenco a ignorar o aviso, que é justamente o contrário do que ele serve.
 */
export function pessoasComFolgaAlterada(antes: FolgaPublicada[] | null, depois: FolgaPublicada[]): Map<string, string> {
  const porPessoa = (lista: FolgaPublicada[]) => {
    const mapa = new Map<string, Map<string, FolgaPublicada>>();
    for (const f of lista) {
      const dela = mapa.get(f.userId) ?? new Map<string, FolgaPublicada>();
      dela.set(assinatura(f), f);
      mapa.set(f.userId, dela);
    }
    return mapa;
  };
  // Sem retrato anterior não dá para dizer quem mudou: trata-se como tudo novo, e quem decide o
  // que fazer com isso é quem chama.
  const anteriores = porPessoa(antes ?? []);
  const atuais = porPessoa(depois);
  const mudancas = new Map<string, string>();
  for (const pessoa of new Set([...anteriores.keys(), ...atuais.keys()])) {
    const antesDela = anteriores.get(pessoa) ?? new Map();
    const depoisDela = atuais.get(pessoa) ?? new Map();
    const entraram = [...depoisDela.values()].filter((f) => !antesDela.has(assinatura(f)));
    const sairam = [...antesDela.values()].filter((f) => !depoisDela.has(assinatura(f)));
    if (!entraram.length && !sairam.length) continue;
    const frases = [
      entraram.length ? `entrou ${entraram.map(descrever).join(", ")}` : "",
      sairam.length ? `saiu ${sairam.map(descrever).join(", ")}` : "",
    ].filter(Boolean);
    mudancas.set(pessoa, frases.join("; "));
  }
  return mudancas;
}

/** Depois de mudar um mês publicado, a Administração recebe um aviso por alteração. */
export async function avisarRepublicacaoFolgas(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], organizationId: string, operationId: string, startDate: string, endDate: string, eventId: string) {
  const months: { year: number; month: number }[] = [];
  let year = Number(startDate.slice(0, 4)), month = Number(startDate.slice(5, 7));
  const last = Number(endDate.slice(0, 4)) * 12 + Number(endDate.slice(5, 7));
  while (year * 12 + month <= last && months.length < 24) { months.push({ year, month }); month++; if (month === 13) { year++; month = 1; } }
  const admins = await tx.selectDistinct({ id: userRolesTable.userId }).from(userRolesTable)
    .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true), eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE")));
  for (const period of months) {
    const key = chaveMesFolgas(operationId, period.year, period.month);
    const [publication] = await tx.select({ id: historyEventsTable.id }).from(historyEventsTable)
      .where(and(eq(historyEventsTable.entityId, key), eq(historyEventsTable.action, "FOLGA_MONTH_PUBLISHED"))).limit(1);
    if (!publication) continue;
    for (const admin of admins) await enqueueNotification(tx as never, {
      userId: admin.id, type: "folga.republication_needed", title: "Folgas precisam de nova publicação",
      message: `O mapa de ${String(period.month).padStart(2, "0")}/${period.year} mudou. Publique o mês de novo para avisar o Elenco.`,
      category: "absence", entityType: "folga_mes", entityId: key, actionUrl: "/folgas",
    }, new Date(), { deduplicationKey: `folga:republicar:${eventId}:${key}:${admin.id}` });
  }
}
