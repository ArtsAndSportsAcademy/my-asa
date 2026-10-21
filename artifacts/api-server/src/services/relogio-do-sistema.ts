import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, relogioDoSistemaTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { logger } from "../lib/logger.js";

/**
 * Vigia do relógio do sistema (21/10/2026).
 *
 * O ciclo por minuto (POST /api/internal/ciclo, chamado pelo pg_cron do Supabase) manda os lembretes de check-in, as publicações
 * automáticas e entrega os avisos da fila. Se ele para, nada disso sai e ninguém fica sabendo. Aqui o ciclo passa a anotar quando
 * rodou, e quem olhar (o verificador de fora em /api/saude, ou a Administração abrindo o Painel) descobre a parada.
 *
 * Duas decisões que não são óbvias:
 *  - Os avisos do sino são gravados DIRETO em `user_notifications`, sem passar pela fila (`notification_outbox`): a fila só é
 *    esvaziada pelo próprio ciclo, então um aviso "o ciclo parou" na fila nunca sairia justamente quando é preciso.
 *  - Quem tem direito de avisar é quem consegue marcar `parado_desde` primeiro (UPDATE condicional na mesma transação do aviso).
 *    Dois verificadores ao mesmo tempo, ou o verificador de fora e o Painel, geram UM aviso por parada, não um por minuto.
 *
 * Todo instante vem do relógio do banco (now()), nunca do servidor: o servidor da Vercel e o banco podem discordar de segundos.
 */
export const CHAVE_DO_CICLO = "ciclo";
/** Passou disto sem um ciclo terminar bem, o relógio é considerado parado (o agendador chama a cada 60 s). */
export const LIMITE_DO_RELOGIO_SEGUNDOS = 180;

const log = logger.child({ domain: "relogio" });
const agoraDoBanco = sql`now()`;

/** O ciclo começou. Falha aqui nunca derruba o ciclo: o vigia é um observador, não parte do trabalho. */
export async function registrarInicioDoCiclo(): Promise<void> {
  try {
    await db.insert(relogioDoSistemaTable).values({ chave: CHAVE_DO_CICLO, ultimoInicioEm: agoraDoBanco })
      .onConflictDoUpdate({ target: relogioDoSistemaTable.chave, set: { ultimoInicioEm: agoraDoBanco, updatedAt: agoraDoBanco } });
  } catch (err) { log.error({ err }, "não consegui anotar o início do ciclo"); }
}

/** O ciclo falhou. Só anota (para a tela e o guia dizerem "o relógio bate, mas o ciclo dá erro"). */
export async function registrarCicloComFalha(): Promise<void> {
  try {
    await db.insert(relogioDoSistemaTable).values({ chave: CHAVE_DO_CICLO, ultimoErroEm: agoraDoBanco })
      .onConflictDoUpdate({ target: relogioDoSistemaTable.chave, set: { ultimoErroEm: agoraDoBanco, updatedAt: agoraDoBanco } });
  } catch (err) { log.error({ err }, "não consegui anotar a falha do ciclo"); }
}

type AdministradorDaCasa = { id: string; organizationId: string };

async function administradoresDeTodasAsCasas(tx: Pick<typeof db, "selectDistinct">): Promise<AdministradorDaCasa[]> {
  return tx.selectDistinct({ id: usersTable.id, organizationId: usersTable.organizationId }).from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(eq(usersTable.status, "ACTIVE"), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true)));
}

/** Um aviso no sino de cada administrador, e um evento no Registro de cada casa que tem administrador. */
async function avisarAdministracao(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], aviso: {
  tipo: "relogio.parou" | "relogio.voltou"; titulo: string; mensagem: string; prioridade: "IMPORTANT" | "NORMAL"; narrativa: string; metadados: Record<string, unknown>;
}): Promise<number> {
  const admins = await administradoresDeTodasAsCasas(tx);
  if (!admins.length) return 0;
  await tx.insert(userNotificationsTable).values(admins.map((admin) => ({
    userId: admin.id, type: aviso.tipo, title: aviso.titulo, message: aviso.mensagem, priority: aviso.prioridade,
    category: "system" as const, entityType: "relogio", entityId: CHAVE_DO_CICLO, actionUrl: "/painel",
  })));
  for (const orgId of new Set(admins.map((admin) => admin.organizationId))) {
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: aviso.tipo, title: aviso.titulo, narrative: aviso.narrativa,
      actorType: "DETERMINISTIC_ENGINE", orgId, entityType: "relogio", entityId: CHAVE_DO_CICLO, metadata: aviso.metadados,
    }, tx as any);
  }
  return admins.length;
}

const minutosPorExtenso = (minutos: number) => `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;

/**
 * O ciclo terminou bem: anota o instante e, se havia uma parada já avisada, encerra-a e avisa a Administração que voltou.
 * Devolve quantos minutos o relógio ficou parado quando esta chamada foi a que o viu voltar (senão null).
 */
export async function registrarCicloBemSucedido(): Promise<number | null> {
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(relogioDoSistemaTable).values({ chave: CHAVE_DO_CICLO }).onConflictDoNothing();
      const [antes] = await tx.select().from(relogioDoSistemaTable).where(eq(relogioDoSistemaTable.chave, CHAVE_DO_CICLO)).for("update").limit(1);
      await tx.update(relogioDoSistemaTable).set({ ultimoSucessoEm: agoraDoBanco, paradoDesde: null, updatedAt: agoraDoBanco }).where(eq(relogioDoSistemaTable.chave, CHAVE_DO_CICLO));
      if (!antes?.paradoDesde) return null;
      const referencia = antes.ultimoSucessoEm ?? antes.paradoDesde;
      const minutos = Math.max(1, Math.round((Date.now() - referencia.getTime()) / 60_000));
      await avisarAdministracao(tx, {
        tipo: "relogio.voltou", prioridade: "NORMAL", titulo: "O relógio do sistema voltou",
        mensagem: `O relógio do sistema voltou a funcionar depois de cerca de ${minutosPorExtenso(minutos)} parado. Check-ins e lembretes desse período podem não ter saído: confira o Painel e avise quem ficou sem lembrete, se for preciso.`,
        narrativa: `O ciclo por minuto voltou a rodar depois de cerca de ${minutosPorExtenso(minutos)} sem terminar. Os lembretes e avisos desse intervalo podem não ter saído.`,
        metadados: { minutosParado: minutos },
      });
      return minutos;
    });
  } catch (err) { log.error({ err }, "não consegui anotar o fim do ciclo"); return null; }
}

export type SituacaoDoRelogio = "em_dia" | "parado" | "sem_registro";
export type RelogioLido = {
  situacao: SituacaoDoRelogio;
  /** Segundos desde o último ciclo que terminou bem; null enquanto nenhum ciclo foi anotado. */
  segundosDesdeUltimoCiclo: number | null;
  /** Há uma parada já avisada (a faixa do Painel fica ligada enquanto isto vale). */
  paradoDesde: Date | null;
  ultimoErroEm: Date | null;
};

/** Lê o relógio sem avisar ninguém. A conta de segundos é do banco. */
export async function lerRelogio(): Promise<RelogioLido> {
  const [linha] = await db.select({
    paradoDesde: relogioDoSistemaTable.paradoDesde,
    ultimoErroEm: relogioDoSistemaTable.ultimoErroEm,
    ultimoSucessoEm: relogioDoSistemaTable.ultimoSucessoEm,
    segundos: sql<string | null>`extract(epoch from (now() - ${relogioDoSistemaTable.ultimoSucessoEm}))`,
  }).from(relogioDoSistemaTable).where(eq(relogioDoSistemaTable.chave, CHAVE_DO_CICLO)).limit(1);
  if (!linha?.ultimoSucessoEm || linha.segundos === null) return { situacao: "sem_registro", segundosDesdeUltimoCiclo: null, paradoDesde: linha?.paradoDesde ?? null, ultimoErroEm: linha?.ultimoErroEm ?? null };
  const segundos = Math.max(0, Math.floor(Number(linha.segundos)));
  return { situacao: segundos > LIMITE_DO_RELOGIO_SEGUNDOS ? "parado" : "em_dia", segundosDesdeUltimoCiclo: segundos, paradoDesde: linha.paradoDesde, ultimoErroEm: linha.ultimoErroEm };
}

/**
 * Olha o relógio e, se ele parou e ainda ninguém foi avisado desta parada, avisa a Administração (sino + Registro).
 * Pode ser chamado à vontade: só o primeiro que marcar `parado_desde` avisa. Devolve se ESTA chamada avisou.
 */
export async function verificarRelogio(): Promise<{ avisou: boolean; relogio: RelogioLido }> {
  const lido = await lerRelogio();
  if (lido.situacao !== "parado" || lido.paradoDesde) return { avisou: false, relogio: lido };
  const avisou = await db.transaction(async (tx) => {
    const [marcada] = await tx.update(relogioDoSistemaTable).set({ paradoDesde: agoraDoBanco, updatedAt: agoraDoBanco }).where(and(
      eq(relogioDoSistemaTable.chave, CHAVE_DO_CICLO), isNull(relogioDoSistemaTable.paradoDesde),
      lt(relogioDoSistemaTable.ultimoSucessoEm, sql`now() - make_interval(secs => ${LIMITE_DO_RELOGIO_SEGUNDOS})`),
    )).returning({ ultimoSucessoEm: relogioDoSistemaTable.ultimoSucessoEm });
    // Outra chamada marcou primeiro, ou o ciclo voltou nesse meio tempo: não há o que avisar.
    if (!marcada?.ultimoSucessoEm) return false;
    const minutos = Math.max(3, Math.floor((Date.now() - marcada.ultimoSucessoEm.getTime()) / 60_000));
    await avisarAdministracao(tx, {
      tipo: "relogio.parou", prioridade: "IMPORTANT", titulo: "O relógio do sistema parou",
      mensagem: `O relógio do sistema parou há ${minutosPorExtenso(minutos)}: check-ins e lembretes podem não ter saído. Abra o Painel e, se não voltar em alguns minutos, avise quem cuida do app.`,
      narrativa: `O ciclo por minuto não termina há ${minutosPorExtenso(minutos)} (o limite é ${LIMITE_DO_RELOGIO_SEGUNDOS / 60} minutos). Check-ins, lembretes e avisos podem não ter saído.`,
      metadados: { minutosParado: minutos, limiteSegundos: LIMITE_DO_RELOGIO_SEGUNDOS },
    });
    return true;
  });
  return { avisou, relogio: avisou ? await lerRelogio() : lido };
}
