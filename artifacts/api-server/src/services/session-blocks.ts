import { and, asc, eq, isNull, like, not, sql } from "drizzle-orm";
import { db, dailyBookBlocksTable, sessionsTable } from "@workspace/db";

/**
 * Bloco de sessão do Livro do Dia: só marca o horário. Não tem posições próprias —
 * a formação vale para o dia inteiro e continua nos blocos do Livro do Show.
 *
 * Identificação sem coluna nova: não vem de bloco do Livro do Show
 * (`source_block_id` nulo), não pertence a cena (`scene_id` nulo) e leva o prefixo
 * abaixo. A sessão de origem é reconhecida pelo par início/fim, que é único por show
 * (`sessions_show_start_end_uq`).
 */
export const SESSION_BLOCK_PREFIX = "Sessão ";

export const SESSION_BLOCK_STALE_REASON =
  "A sessão foi desativada, saiu da vigência ou mudou de horário. Nada foi removido: a Supervisão decide na regeneração.";

type DbLike = typeof db;

/** Condição SQL que reconhece um bloco de sessão (colunas não nulas nas comparações de texto). */
export const isSessionBlock = and(
  isNull(dailyBookBlocksTable.sourceBlockId),
  isNull(dailyBookBlocksTable.sceneId),
  like(dailyBookBlocksTable.name, `${SESSION_BLOCK_PREFIX}%`),
);

/** Tudo o que NÃO é bloco de sessão — usado para preservar esses blocos ao regenerar. */
export const isNotSessionBlock = not(isSessionBlock!);

const hhmm = (value: string | null | undefined) => (value ?? "").slice(0, 5);
const slotKey = (start: string | null | undefined, end: string | null | undefined) => `${hhmm(start)}-${hhmm(end)}`;
const blockName = (session: { startTime: string; endTime: string }) => `${SESSION_BLOCK_PREFIX}${hhmm(session.startTime)}–${hhmm(session.endTime)}`;

/**
 * Condição SQL: a sessão vale no dia da semana da data (0058). Sem dias definidos, vale todos os dias.
 * Usada aqui e em `schedule-conflicts.ts`, para os dois lados enxergarem os mesmos horários.
 */
export const sessionRunsOn = (date: string) =>
  sql`(sessions.weekdays IS NULL OR sessions.weekdays @> to_jsonb(extract(dow from ${date}::date)::int))`;

/**
 * Sessões do show que valem na data: ativa, dentro da vigência e no dia da semana. Mesmo
 * critério de `schedule-conflicts.ts`. Ordenadas por horário.
 */
export async function eligibleSessions(showBookId: string, date: string, dbLike: DbLike = db) {
  return dbLike
    .select()
    .from(sessionsTable)
    .where(and(
      eq(sessionsTable.showId, showBookId),
      eq(sessionsTable.active, true),
      sql`(sessions.valid_from IS NULL OR sessions.valid_from <= ${date})`,
      sql`(sessions.valid_to IS NULL OR sessions.valid_to >= ${date})`,
      sessionRunsOn(date),
    ))
    .orderBy(asc(sessionsTable.startTime), asc(sessionsTable.endTime));
}

export interface SessionBlockView {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  isRemoved: boolean;
  /** Verdadeiro quando nenhuma sessão elegível na data tem este início/fim. Recalculado a cada leitura. */
  stale: boolean;
  staleReason: string | null;
}

async function sessionBlockRows(dailyBookId: string, dbLike: DbLike) {
  return dbLike
    .select()
    .from(dailyBookBlocksTable)
    .where(and(eq(dailyBookBlocksTable.dailyBookId, dailyBookId), isSessionBlock));
}

/**
 * Cria/atualiza um bloco por sessão elegível, na ordem de horário. Nunca apaga:
 * bloco cuja sessão deixou de ser elegível fica como está e é devolvido em `staleBlockIds`.
 * Sem sessão elegível não faz nada — nenhum horário é inventado.
 * Idempotente: rodar de novo sem mudança não escreve nada.
 */
export async function syncSessionBlocks(dailyBookId: string, showBookId: string, date: string, dbLike: DbLike = db) {
  const sessions = await eligibleSessions(showBookId, date, dbLike);
  const existing = await sessionBlockRows(dailyBookId, dbLike);
  const existingBySlot = new Map<string, (typeof existing)[number]>();
  for (const block of existing) {
    const key = slotKey(block.startTime, block.endTime);
    if (!existingBySlot.has(key)) existingBySlot.set(key, block);
  }

  const createdBlockIds: string[] = [];
  const updatedBlockIds: string[] = [];
  const eligibleSlots = new Set<string>();

  for (const [order, session] of sessions.entries()) {
    const key = slotKey(session.startTime, session.endTime);
    eligibleSlots.add(key);
    const name = blockName(session);
    const found = existingBySlot.get(key);
    if (!found) {
      const [created] = await dbLike.insert(dailyBookBlocksTable).values({
        dailyBookId,
        name,
        order,
        startTime: hhmm(session.startTime),
        endTime: hhmm(session.endTime),
        sourceBlockId: null,
        sceneId: null,
      }).returning({ id: dailyBookBlocksTable.id });
      if (created) createdBlockIds.push(created.id);
    } else if (found.name !== name || found.order !== order || found.isRemoved) {
      await dbLike.update(dailyBookBlocksTable)
        .set({ name, order, isRemoved: false, updatedAt: new Date() })
        .where(eq(dailyBookBlocksTable.id, found.id));
      updatedBlockIds.push(found.id);
    }
  }

  const staleBlockIds = existing
    .filter((block) => !eligibleSlots.has(slotKey(block.startTime, block.endTime)))
    .map((block) => block.id);

  return { sessionIds: sessions.map((session) => session.id), createdBlockIds, updatedBlockIds, staleBlockIds };
}

/** Blocos de sessão do Livro do Dia, por horário, com a marca de desatualizado calculada na data. */
export async function listSessionBlocks(dailyBookId: string, showBookId: string | null, date: string, dbLike: DbLike = db): Promise<SessionBlockView[]> {
  const blocks = await sessionBlockRows(dailyBookId, dbLike);
  if (!blocks.length) return [];
  const eligibleSlots = new Set(
    (showBookId ? await eligibleSessions(showBookId, date, dbLike) : []).map((session) => slotKey(session.startTime, session.endTime)),
  );
  return blocks
    .map((block) => {
      const stale = !eligibleSlots.has(slotKey(block.startTime, block.endTime));
      return {
        id: block.id,
        name: block.name,
        startTime: block.startTime,
        endTime: block.endTime,
        order: block.order,
        isRemoved: block.isRemoved,
        stale,
        staleReason: stale ? SESSION_BLOCK_STALE_REASON : null,
      };
    })
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.order - b.order);
}
