/**
 * Equipe mudou: quais Escalas JÁ PUBLICADAS passam a pedir republicação (pacote O, O3; crivo 6 do AGENTS.md).
 *
 * A equipe vale na hora para o rascunho, porque a Escala do dia é montada na leitura. Mas o Elenco vê a versão publicada (`comoPublicada`), então
 * nada muda para quem faz até a Administração republicar. O que falta é avisar a Administração de que há o que republicar: olhamos as Escalas
 * publicadas dos próximos dias de TODOS os locais (mexer na equipe de Snowland também muda a da Acqua) e marcamos só as que de fato mudaram.
 */
import { and, between, eq, inArray } from "drizzle-orm";
import { areaLocalSupervisorsTable, db, locationsTable, scalesTable, userRolesTable, usersTable } from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { APP_ROUTES } from "../lib/app-routes.js";
import { avisarRepublicacaoPendente, comoPublicada, montarEscalaDoDia } from "./escala-dia.js";
import { enqueueNotification } from "./undo.js";

/** Quantos dias à frente conferir. Escala publicada é a dos próximos dias; mais longe que isso se confere quando for publicada. */
export const DIAS_A_CONFERIR = 30;

const somarDias = (data: string, dias: number) => new Date(new Date(`${data}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

export async function marcarEscalasPublicadasPelaEquipe(organizationId: string, actorId: string, nomeDaProgramacao: string, hoje = operationalDate(new Date())) {
  const locais = await db.select({ id: locationsTable.id }).from(locationsTable).where(eq(locationsTable.organizationId, organizationId));
  if (!locais.length) return { conferidas: 0, marcadas: 0 };
  const escalas = await db.select().from(scalesTable).where(and(
    inArray(scalesTable.locationId, locais.map((l) => l.id)), inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
    between(scalesTable.periodStart, hoje, somarDias(hoje, DIAS_A_CONFERIR)),
  ));
  let marcadas = 0;
  for (const escala of escalas) {
    if (!escala.locationId || escala.alteradaDesde) continue; // já pede republicação: o aviso daquele acontecimento já saiu
    const dia = await montarEscalaDoDia(organizationId, escala.locationId, escala.periodStart);
    if (!dia?.escala || !(await comoPublicada(dia)).mudouDesdeAPublicacao) continue;
    await db.transaction(async (tx) => {
      const agora = new Date();
      const [atualizada] = await tx.update(scalesTable).set({ alteradaDesde: agora, updatedAt: agora, version: escala.version + 1 }).where(eq(scalesTable.id, escala.id)).returning();
      const motivo = `a equipe do local mudou (${nomeDaProgramacao})`;
      await writeHistoryEvent({
        category: "SCALE", action: "escala.alterada_pela_equipe", title: "Escala alterada pela equipe do local",
        narrative: `A equipe do local mudou (${nomeDaProgramacao}) e a Escala publicada de ${escala.periodStart} deixou de bater com a publicação. Ela pede republicação.`,
        entityType: "scale", entityId: escala.id, actorId, operationId: escala.operationId,
        beforeState: { alteradaDesde: escala.alteradaDesde }, afterState: { alteradaDesde: atualizada?.alteradaDesde ?? agora, motivo },
      }, tx as unknown as HistoryExecutor);
      await avisarRepublicacaoPendente(tx as unknown as Parameters<typeof avisarRepublicacaoPendente>[0], atualizada ?? escala, motivo, { now: agora });
    });
    marcadas += 1;
  }
  return { conferidas: escalas.length, marcadas };
}

/**
 * O imprevisto do dia mexeu em quem está onde: as Escalas já publicadas DAQUELA data, nos locais envolvidos, que deixaram de bater com a publicação
 * passam a pedir republicação (Registro `escala.alterada_pelo_imprevisto`, aviso à Administração). O Elenco segue vendo a versão publicada.
 */
export async function marcarEscalasDoDiaPeloImprevisto(organizationId: string, actorId: string, date: string, locationIds: string[], motivo: string) {
  const ids = [...new Set(locationIds)];
  if (!ids.length) return { marcadas: 0 };
  const escalas = await db.select().from(scalesTable).where(and(inArray(scalesTable.locationId, ids), inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), eq(scalesTable.periodStart, date)));
  let marcadas = 0;
  for (const escala of escalas) {
    if (!escala.locationId || escala.alteradaDesde) continue;
    const dia = await montarEscalaDoDia(organizationId, escala.locationId, escala.periodStart);
    if (!dia?.escala || !(await comoPublicada(dia)).mudouDesdeAPublicacao) continue;
    await db.transaction(async (tx) => {
      const agora = new Date();
      const [atualizada] = await tx.update(scalesTable).set({ alteradaDesde: agora, updatedAt: agora, version: escala.version + 1 }).where(eq(scalesTable.id, escala.id)).returning();
      await writeHistoryEvent({
        category: "SCALE", action: "escala.alterada_pelo_imprevisto", title: "Escala alterada por um imprevisto de local",
        narrative: `${motivo}. A Escala publicada de ${escala.periodStart} deixou de bater com a publicação e pede republicação.`,
        entityType: "scale", entityId: escala.id, actorId, operationId: escala.operationId,
        beforeState: { alteradaDesde: escala.alteradaDesde }, afterState: { alteradaDesde: atualizada?.alteradaDesde ?? agora, motivo },
      }, tx as unknown as HistoryExecutor);
      await avisarRepublicacaoPendente(tx as unknown as Parameters<typeof avisarRepublicacaoPendente>[0], atualizada ?? escala, motivo, { now: agora });
    });
    marcadas += 1;
  }
  return { marcadas };
}

/**
 * Quem precisa saber que uma pessoa mudou de local só por hoje: a Supervisão do OUTRO local (quem não é quem mexeu), pela área da pessoa quando
 * houver e, senão, qualquer Supervisão do local. Se nenhum dos locais envolvidos tem Supervisão a avisar, vai para a Administração. Um aviso por
 * acontecimento: a chave leva o imprevisto e o destinatário. Quem fez nunca recebe o próprio aviso.
 */
export async function avisarImprevistoDeLocal(executor: typeof db, input: {
  imprevistoId: string; organizationId: string; actorId: string; actorAdmin: boolean; actorLocalIds: string[]; pessoa: { id: string; name: string; areaId: string | null };
  destinoId: string; origemId: string | null; nomesDosLocais: Map<string, string>; date: string; faixa: string; motivo: string | null; telaLocalId: string;
}) {
  const envolvidos = [input.destinoId, ...(input.origemId ? [input.origemId] : [])];
  // Quem mexeu e supervisiona um dos locais já sabe daquele lado; o aviso é para o lado que ele não cuida.
  const aAvisar = input.actorAdmin ? envolvidos : envolvidos.filter((id) => !input.actorLocalIds.includes(id));
  const destinatarios = new Set<string>();
  for (const localId of aAvisar) {
    const doLocal = await executor.select({ id: areaLocalSupervisorsTable.supervisorId, areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable)
      .innerJoin(usersTable, eq(usersTable.id, areaLocalSupervisorsTable.supervisorId))
      .where(and(eq(areaLocalSupervisorsTable.locationId, localId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE")));
    const daArea = input.pessoa.areaId ? doLocal.filter((s) => s.areaId === input.pessoa.areaId) : [];
    for (const s of (daArea.length ? daArea : doLocal)) destinatarios.add(s.id);
  }
  if (!destinatarios.size) {
    const operacoes = await executor.selectDistinct({ id: usersTable.id }).from(usersTable)
      .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(eq(usersTable.organizationId, input.organizationId), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true), eq(usersTable.status, "ACTIVE")));
    for (const a of operacoes) destinatarios.add(a.id);
  }
  destinatarios.delete(input.actorId);
  const destino = input.nomesDosLocais.get(input.destinoId) ?? "outro local";
  const origem = input.origemId ? input.nomesDosLocais.get(input.origemId) : null;
  for (const userId of destinatarios) {
    await enqueueNotification(executor as unknown as Parameters<typeof enqueueNotification>[0], {
      userId, type: "escala.local_do_dia", category: "schedule", priority: "NORMAL",
      title: `${input.pessoa.name} vai para ${destino} ${input.faixa}`,
      message: `${origem ? `${input.pessoa.name} sai de ${origem} e` : `${input.pessoa.name}`} trabalha em ${destino} ${input.faixa}, só nesse dia. A Programação não muda.${input.motivo ? ` Motivo: ${input.motivo}.` : ""}`,
      entityType: "location", entityId: input.destinoId, actionUrl: `${APP_ROUTES.escalas}?data=${input.date}&local=${input.telaLocalId}`,
    }, new Date(), { deduplicationKey: `local-do-dia:${input.imprevistoId}:${userId}` });
  }
  return destinatarios.size;
}
