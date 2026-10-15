import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, folgasTable, notificationOutboxTable, userNotificationsTable } from "@workspace/db";
import { operationalDate } from "../lib/operational-date.js";

/**
 * Regras das Mensagens (estilo WhatsApp, versão profissional).
 * Tipos de conversa (message_threads.context_type): DIRECT (duas pessoas), GROUP (criado por uma pessoa),
 * HOUSE_GROUP (criado pela Administração/Direção, como "meninas" e "meninos") e AREA_GROUP (automático, da área).
 * A Administração NÃO lê conversa de ninguém (decisão de 14/10/2026): ela vê a lista de grupos e quem está
 * em cada um, e arquiva com motivo, mas só participante lê o conteúdo.
 */
export const GRUPO_DA_PESSOA = "GROUP";
export const GRUPO_DA_CASA = "HOUSE_GROUP";
export const GRUPO_DA_AREA = "AREA_GROUP";
export const DIRETA = "DIRECT";
/** Conversas que são grupos e aparecem na lista de grupos da Administração. */
export const TIPOS_DE_GRUPO = [GRUPO_DA_PESSOA, GRUPO_DA_CASA, GRUPO_DA_AREA];
export const MAX_INTEGRANTES = 200;
export const MAX_TEXTO = 4000;

/** Figurinhas da ASA (as poses em /asa/*.webp). O conteúdo da mensagem é o nome da figurinha. */
export const FIGURINHAS = ["oi", "bom-dia", "vencemos", "tarefa-concluida", "olhos-de-estrela", "travessa", "lembrete", "atencao", "aviso-importante", "duvida", "pensativa", "consultando", "estudando", "sonolenta"];

/** Reações das mensagens: as mesmas do Mural. */
export const REACOES = ["❤️", "👏", "🎉", "😂", "🙏", "🎂"];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Quem está de folga hoje (qualquer tipo de folga ativa). */
export async function emFolgaHoje(executor: Pick<typeof db, "select">, userIds: string[]) {
  if (!userIds.length) return new Set<string>();
  const hoje = operationalDate();
  const rows = await executor.select({ userId: folgasTable.userId }).from(folgasTable)
    .where(and(inArray(folgasTable.userId, userIds), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, hoje), gte(folgasTable.endDate, hoje)));
  return new Set(rows.map(row => row.userId));
}

/**
 * Aviso de mensagem nova: um por conversa, não um por mensagem. Quem já tem um aviso desta conversa ainda por
 * ler (no sino ou esperando na fila) só tem o texto atualizado; quem não tem recebe um novo, pela fila de
 * notificações (mesma da escala e do Mural: entra na transação de quem envia e não se perde se o servidor
 * cair). Quem está de folga recebe no sino, mas o celular não toca.
 */
export async function avisarNovaMensagem(tx: Tx, input: { threadId: string; messageId: string; titulo: string; texto: string; destinatarios: string[] }) {
  const ids = [...new Set(input.destinatarios)];
  if (!ids.length) return;
  const agora = new Date();
  const abertos = await tx.select({ id: userNotificationsTable.id, userId: userNotificationsTable.userId }).from(userNotificationsTable)
    .where(and(inArray(userNotificationsTable.userId, ids), eq(userNotificationsTable.type, "message.new"), eq(userNotificationsTable.entityId, input.threadId), isNull(userNotificationsTable.readAt)));
  if (abertos.length) {
    await tx.update(userNotificationsTable).set({ title: input.titulo, message: input.texto, createdAt: agora })
      .where(inArray(userNotificationsTable.id, abertos.map(row => row.id)));
  }
  const naFila = await tx.update(notificationOutboxTable)
    .set({ payload: sql`jsonb_set(jsonb_set(${notificationOutboxTable.payload}, '{message}', to_jsonb(${input.texto}::text)), '{title}', to_jsonb(${input.titulo}::text))` })
    .where(and(inArray(notificationOutboxTable.userId, ids), eq(notificationOutboxTable.status, "pending"), sql`${notificationOutboxTable.payload}->>'type' = 'message.new'`, sql`${notificationOutboxTable.payload}->>'entityId' = ${input.threadId}`))
    .returning({ userId: notificationOutboxTable.userId });
  const jaTem = new Set([...abertos.map(row => row.userId), ...naFila.map(row => row.userId)]);
  const novos = ids.filter(id => !jaTem.has(id));
  if (!novos.length) return;
  const folga = await emFolgaHoje(tx, novos);
  for (let i = 0; i < novos.length; i += 500) {
    await tx.insert(notificationOutboxTable).values(novos.slice(i, i + 500).map(userId => ({
      userId, dueAt: agora, deduplicationKey: `msg:${input.threadId}:${input.messageId}:${userId}`,
      payload: { userId, type: "message.new", title: input.titulo, message: input.texto, priority: "NORMAL", category: "message", entityType: "thread", entityId: input.threadId, actionUrl: "/mensagens", semPush: folga.has(userId) },
    }))).onConflictDoNothing();
  }
}

/** Aviso único de um acontecimento do grupo (entrou, saiu, arquivado), pela fila. */
export async function avisarDoGrupo(tx: Tx, userIds: string[], chave: string, aviso: { threadId: string; titulo: string; texto: string }) {
  const unicos = [...new Set(userIds)];
  if (!unicos.length) return;
  const agora = new Date();
  for (let i = 0; i < unicos.length; i += 500) {
    await tx.insert(notificationOutboxTable).values(unicos.slice(i, i + 500).map(userId => ({
      userId, dueAt: agora, deduplicationKey: `${chave}:${userId}`,
      payload: { userId, type: "message.group", title: aviso.titulo, message: aviso.texto, priority: "NORMAL", category: "message", entityType: "thread", entityId: aviso.threadId, actionUrl: "/mensagens" },
    }))).onConflictDoNothing();
  }
}

/** Marca como lidos os avisos de mensagem nova da conversa (quem abriu a conversa já leu). */
export async function marcarAvisosLidos(executor: Pick<typeof db, "update">, userId: string, threadId: string) {
  await executor.update(userNotificationsTable).set({ readAt: new Date() })
    .where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, "message.new"), eq(userNotificationsTable.entityId, threadId), isNull(userNotificationsTable.readAt)));
}
