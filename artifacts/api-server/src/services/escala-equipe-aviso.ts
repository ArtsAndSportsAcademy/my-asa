/**
 * Equipe mudou: quais Escalas JÁ PUBLICADAS passam a pedir republicação (pacote O, O3; crivo 6 do AGENTS.md).
 *
 * A equipe vale na hora para o rascunho, porque a Escala do dia é montada na leitura. Mas o Elenco vê a versão publicada (`comoPublicada`), então
 * nada muda para quem faz até a Administração republicar. O que falta é avisar a Administração de que há o que republicar: olhamos as Escalas
 * publicadas dos próximos dias de TODOS os locais (mexer na equipe de Snowland também muda a da Acqua) e marcamos só as que de fato mudaram.
 */
import { and, between, eq, inArray } from "drizzle-orm";
import { db, locationsTable, scalesTable } from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { avisarRepublicacaoPendente, comoPublicada, montarEscalaDoDia } from "./escala-dia.js";

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
