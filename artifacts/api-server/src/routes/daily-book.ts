import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq, and, inArray, ne, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  dailyBooksTable,
  dailyBookScenesTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
  scalesTable,
  scaleAllocationsTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookKeyframesTable,
  agendaEventsTable,
  locationsTable,
  operationsTable,
  operationalChangesTable,
  historyEventsTable,
  usersTable,
  formationsTable,
  sessionsTable,
  areaLocalSupervisorsTable,
  areasTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { nomeFormalDoAtor, writeHistoryEvent } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { canOperateDailyBook, canViewDailyBook, isOperationManager, type ShowResponsibilityRef } from "../lib/show-responsibility.js";
import { eventBus } from "../lib/event-bus.js";
import { avisarExcecaoDeRegra, codigoDaExcecao, frasesDasRegras, verificarRegrasDeEscala } from "../services/regras-de-escala.js";
import { notifyMany } from "../services/notificationService.js";
import {
  readBaseSnapshot,
  requireExpectedVersion,
  respondWithVersionConflict,
  VersionConflictError,
  VersionedResourceNotFoundError,
  type VersionedSnapshot,
} from "../lib/versioning.js";
import {
  resolveAssignmentsByRole,
  advanceRotationCounts,
  advanceRotationCountsFromWinners,
  collectRotationWinners,
  getUnavailableUserIds,
  type RoleResolution,
  type RotationWinners,
} from "../services/line-resolver.js";
import { detectConflictsForDailyBooks, detectDailyBookConflicts, type PublicScheduleConflict } from "../services/schedule-conflicts.js";
import { lembrarOuLer, type LeiturasDoMes } from "../services/leituras-do-mes.js";
import { escalaDoDiaDoLivro, escalaPublicada, horariosDoShowNaProgramacao, horariosDosShowsNaProgramacao, marcarEscalaAlteradaPeloLivro } from "../services/escala-dia.js";
import { eligibleSessions, eligibleSessionsDoDia, isNotSessionBlock, listSessionBlocks, syncSessionBlocks } from "../services/session-blocks.js";

const router: IRouter = Router();
/** O que a geração devolve sobre conflitos de horário. "adiada": quem gera vários Livros confere o dia todo no fim. */
export type ConflitosDaGeracao = {
  conflicts: PublicScheduleConflict[];
  conflictDetection: { status: "complete" } | { status: "unavailable"; message: string } | { status: "adiada" };
};
const CONFLITOS_INDISPONIVEL = { status: "unavailable" as const, message: "Livro salvo. A verificação de horários está indisponível; consulte os conflitos novamente." };

/** Confere, de uma vez só, os conflitos de todos os Livros do dia; um erro aqui nunca desfaz o que foi gerado. */
export async function conferirConflitosDosLivros(dailyBookIds: string[], date: string): Promise<Map<string, ConflitosDaGeracao>> {
  const resultado = new Map<string, ConflitosDaGeracao>();
  try {
    const porLivro = await detectConflictsForDailyBooks(dailyBookIds, date);
    for (const id of dailyBookIds) resultado.set(id, { conflicts: porLivro.get(id) ?? [], conflictDetection: { status: "complete" } });
  } catch (error) {
    console.warn("detector de conflitos indisponível após gerar Livro do Dia", error);
    for (const id of dailyBookIds) resultado.set(id, { conflicts: [], conflictDetection: CONFLITOS_INDISPONIVEL });
  }
  return resultado;
}

async function detectGeneratedDailyBookConflicts(dailyBookId: string, date: string): Promise<ConflitosDaGeracao> {
  try {
    return { conflicts: await detectDailyBookConflicts(dailyBookId, date), conflictDetection: { status: "complete" as const } };
  } catch (error) {
    // Conflito é alerta, não pode desfazer uma geração já persistida.
    console.warn("detector de conflitos indisponível após gerar Livro do Dia", error);
    return { conflicts: [], conflictDetection: { status: "unavailable" as const, message: "Livro salvo. A verificação de horários está indisponível; consulte os conflitos novamente." } };
  }
}
async function loadShowRef(
  showBookId: string,
): Promise<{ ref: ShowResponsibilityRef; operationId: string } | null> {
  const [sb] = await db
    .select({ id: showBooksTable.id, responsibleId: showBooksTable.responsibleId, operationId: showBooksTable.operationId })
    .from(showBooksTable)
    .where(eq(showBooksTable.id, showBookId))
    .limit(1);
  return sb ? { ref: { id: sb.id, responsibleId: sb.responsibleId }, operationId: sb.operationId } : null;
}

/**
 * Regra de área da troca de pessoa no Livro do Dia: quem não é Administração nem responsável pelo show só mexe em
 * pessoas das áreas que supervisiona NAQUELE local. Devolve a frase da recusa, ou null quando pode.
 */
async function recusaDeAreaNaTroca(
  book: { showBookId: string | null; scaleId: string | null },
  actor: { sub: string; role: string },
  pessoas: (string | null)[],
): Promise<string | null> {
  if (actor.role === "ADMIN") return null;
  let locationId: string | null = null;
  if (book.showBookId) {
    const [sb] = await db.select({ responsibleId: showBooksTable.responsibleId, locationId: showBooksTable.locationId }).from(showBooksTable).where(eq(showBooksTable.id, book.showBookId)).limit(1);
    if (sb?.responsibleId === actor.sub) return null;
    locationId = sb?.locationId ?? null;
  }
  if (!locationId && book.scaleId) {
    const [sc] = await db.select({ locationId: scalesTable.locationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
    locationId = sc?.locationId ?? null;
  }
  const ids = [...new Set(pessoas.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return null;
  const minhas = locationId
    ? new Set((await db.select({ areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable).where(and(
        eq(areaLocalSupervisorsTable.supervisorId, actor.sub), eq(areaLocalSupervisorsTable.locationId, locationId), eq(areaLocalSupervisorsTable.active, true),
      ))).map((r) => r.areaId))
    : new Set<string>();
  const linhas = await db.select({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId, areaName: areasTable.name }).from(usersTable)
    .leftJoin(areasTable, eq(usersTable.areaId, areasTable.id)).where(inArray(usersTable.id, ids));
  const fora = linhas.find((p) => !p.areaId || !minhas.has(p.areaId));
  if (!fora) return null;
  return `Supervisão troca só pessoas das áreas que supervisiona neste local. ${fora.name} é ${fora.areaName ? `de ${fora.areaName}` : "sem área"}: peça à Administração ou a quem é responsável pelo show.`;
}

// Estilo MyASA antigo: o operador não precisa digitar "Motivo" nas ações do dia.
// Quando nenhum motivo é informado, o sistema grava um texto padrão na auditoria/delta.
const DEFAULT_DAY_REASON = "Ajuste operacional do dia (sem motivo informado)";

/**
 * Resolve o contexto de operação de um Livro do Dia e decide se o ator pode lê-lo.
 * Reúne a derivação operação→organização e a regra canViewDailyBook num só sítio,
 * para que detalhe e delta apliquem exatamente o mesmo escopo.
 */
async function resolveDailyBookReadContext(
  actor: { sub: string; role: string; operationIds: string[]; organizationId?: string | null },
  book: { agendaEventId: string; showBookId: string | null; status: string; sessionId?: string | null },
): Promise<{
  ok: boolean;
  /** Vê a versão AO VIVO (gestão, capitão delegado, Direção) em vez da preservada da publicação. */
  seesLive: boolean;
  operationId: string;
  operationName: string;
  eventTitle: string;
  eventDate: string;
  showTitle: string | null;
  /** Local do show: é ele que distingue dois Livros do mesmo dia, não a operação. */
  locationName: string | null;
  locationId: string | null;
  eventStartTime: string | null;
  /** Hora ("11:30") do Livro de uma sessão separada; nulo no Livro do dia. */
  sessionLabel: string | null;
} | null> {
  const [ev] = await db
    .select({
      operationId: agendaEventsTable.operationId,
      operationName: operationsTable.name,
      eventTitle: agendaEventsTable.title,
      eventDate: agendaEventsTable.date,
      eventStartTime: agendaEventsTable.startTime,
      organizationId: operationsTable.organizationId,
    })
    .from(agendaEventsTable)
    .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
    .where(eq(agendaEventsTable.id, book.agendaEventId))
    .limit(1);
  if (!ev) return null;

  let showTitle: string | null = null;
  let showResponsibleId: string | null = null;
  let locationName: string | null = null;
  let locationId: string | null = null;
  if (book.showBookId) {
    const [sb] = await db
      .select({ title: showBooksTable.title, responsibleId: showBooksTable.responsibleId, locationName: locationsTable.name, locationId: showBooksTable.locationId })
      .from(showBooksTable)
      .leftJoin(locationsTable, eq(showBooksTable.locationId, locationsTable.id))
      .where(eq(showBooksTable.id, book.showBookId))
      .limit(1);
    showTitle = sb?.title ?? null;
    showResponsibleId = sb?.responsibleId ?? null;
    locationName = sb?.locationName ?? null;
    locationId = sb?.locationId ?? null;
  }

  const show = book.showBookId ? { id: book.showBookId, responsibleId: showResponsibleId } : null;
  const ok =
    ev.organizationId === (actor.organizationId as string) &&
    (await canViewDailyBook(actor as any, ev.operationId, book.status, show));
  // Direção lê tudo mas não opera — ainda assim vê a versão ao vivo, como a gestão, para
  // acompanhar o que está de fato acontecendo (não só o que foi anunciado ao Elenco).
  const seesLive = actor.role === "DIR" || (await canOperateDailyBook(actor as any, ev.operationId, show));

  return {
    ok,
    seesLive,
    operationId: ev.operationId,
    operationName: ev.operationName,
    eventTitle: ev.eventTitle,
    eventDate: ev.eventDate,
    showTitle,
    locationName,
    locationId,
    eventStartTime: ev.eventStartTime ?? null,
    sessionLabel: book.sessionId && ev.eventStartTime ? ev.eventStartTime.slice(0, 5) : null,
  };
}

async function getDailyBookOrFail(id: string, res: any) {
  // O Livro tem que ser da organização de quem pede. Antes só se procurava pelo id, e a Administração passava em qualquer
  // checagem seguinte (o papel ADMIN vale sem olhar a organização): a Administração de uma casa cancelava o Livro do Dia
  // de outra casa só de saber o id. Livro de outra organização responde 404, como se não existisse.
  const organizationId = res?.req?.user?.organizationId as string | undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(404).json({ error: "NAO_ENCONTRADO", message: "Livro do Dia não encontrado." });
    return null;
  }
  const [row] = await db
    .select({ book: dailyBooksTable, organizationId: operationsTable.organizationId })
    .from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
    .where(eq(dailyBooksTable.id, id))
    .limit(1);
  if (!row || (organizationId && row.organizationId !== organizationId)) {
    res.status(404).json({ error: "NAO_ENCONTRADO", message: "Livro do Dia não encontrado." });
    return null;
  }
  return row.book;
}

/**
 * Deriva a operação + o ref de responsabilidade do show a partir de um Livro do
 * Dia (via showBookId → scaleId → agendaEventId) e aplica `canOperateDailyBook`.
 * Centraliza a autorização de TODAS as mutações do Livro do Dia (assignments,
 * cenas/blocos/posições, reorder), não só gerar/publicar: sem isto, qualquer
 * supervisor da org poderia, por chamada direta, mutar o livro de um show de que
 * outro supervisor é responsável. Responde 403 e devolve false quando barrado.
 */
async function requireDailyBookOperate(
  book: { showBookId: string | null; scaleId: string | null; agendaEventId: string | null },
  user: { sub: string; role: string; operationIds: string[] },
  res: any,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  let operationId: string | null = null;
  let show: ShowResponsibilityRef | null = null;
  if (book.showBookId) {
    const loaded = await loadShowRef(book.showBookId);
    if (loaded) { operationId = loaded.operationId; show = loaded.ref; }
  }
  if (!operationId && book.scaleId) {
    const [sr] = await db.select({ operationId: scalesTable.operationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
    operationId = sr?.operationId ?? null;
  }
  if (!operationId && book.agendaEventId) {
    const [ev] = await db.select({ operationId: agendaEventsTable.operationId }).from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
    operationId = ev?.operationId ?? null;
  }
  if (!operationId || !(await canOperateDailyBook(user, operationId, show))) {
    res.status(403).json({ error: "ACESSO_NEGADO", message: show?.responsibleId ? "Este show tem uma pessoa responsável: só ela e a Administração mexem no Livro do Dia." : "Acesso restrito à Supervisão da operação e à Administração" });
    return false;
  }
  return true;
}

/** Linha da geração atual, sem o marcador interno: o snapshot mantém o mesmo formato de antes. */
const liveRow = <T extends { supersededAt: Date | null }>({ supersededAt: _superseded, ...row }: T) => row;

async function buildDailyBookTree(dailyBookId: string, dbLike: typeof db = db) {
  // Linhas substituídas por uma regeneração ficam no banco, mas não fazem parte do Livro.
  const scenes = (await dbLike
    .select()
    .from(dailyBookScenesTable)
    .where(and(eq(dailyBookScenesTable.dailyBookId, dailyBookId), isNull(dailyBookScenesTable.supersededAt)))
    .orderBy(dailyBookScenesTable.order)).map(liveRow);

  const blocks = (await dbLike
    .select()
    .from(dailyBookBlocksTable)
    .where(and(eq(dailyBookBlocksTable.dailyBookId, dailyBookId), isNull(dailyBookBlocksTable.supersededAt)))
    .orderBy(dailyBookBlocksTable.order)).map(liveRow);

  const positions = (await dbLike
    .select()
    .from(dailyBookPositionsTable)
    .where(and(eq(dailyBookPositionsTable.dailyBookId, dailyBookId), isNull(dailyBookPositionsTable.supersededAt)))).map(liveRow);

  const assignments = positions.length > 0
    ? (await dbLike
        .select()
        .from(dailyBookAssignmentsTable)
        .where(
          and(
            eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId),
            inArray(dailyBookAssignmentsTable.positionId, positions.map((p) => p.id)),
            isNull(dailyBookAssignmentsTable.supersededAt),
          )
        )
        // Ordem estável (criação): a resolução ao vivo casa cada vaga guardada com a mesma posição
        // na lista que o motor resolve agora — sem ORDER BY o Postgres não garante a ordem.
        .orderBy(dailyBookAssignmentsTable.createdAt, dailyBookAssignmentsTable.id)).map(liveRow)
    : [];

  const assignedUserIds = [
    ...new Set(assignments.map((a) => a.userId).filter((id): id is string => !!id)),
  ];
  const nameByUserId: Record<string, string> = {};
  if (assignedUserIds.length > 0) {
    const users = await dbLike
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, assignedUserIds));
    users.forEach((u) => {
      nameByUserId[u.id] = u.name;
    });
  }

  return montarArvoreDoLivro({ scenes, blocks, positions, assignments, nameByUserId });
}

/**
 * A árvore cena → bloco → posição → vaga a partir das linhas já lidas (ou recém-gravadas). Pura: não toca no banco,
 * então a geração monta o retrato do Livro com o que acabou de gravar, sem reler tudo.
 */
function montarArvoreDoLivro<
  S extends { id: string },
  B extends { id: string; sceneId: string | null },
  P extends { id: string; blockId: string | null },
  A extends { positionId: string; userId: string | null },
>(input: { scenes: S[]; blocks: B[]; positions: P[]; assignments: A[]; nameByUserId: Record<string, string> }) {
  const { scenes, blocks, positions, assignments, nameByUserId } = input;
  const assignmentsWithNames = assignments.map((a) => ({
    ...a,
    userName: a.userId ? nameByUserId[a.userId] ?? null : null,
  }));

  const assignmentsByPosition: Record<string, typeof assignmentsWithNames> = {};
  assignmentsWithNames.forEach((a) => {
    if (!assignmentsByPosition[a.positionId]) assignmentsByPosition[a.positionId] = [];
    assignmentsByPosition[a.positionId]!.push(a);
  });

  const positionsWithAssignments = positions.map((p) => ({
    ...p,
    assignments: assignmentsByPosition[p.id] ?? [],
  }));

  const positionsByBlock: Record<string, typeof positionsWithAssignments> = {};
  positionsWithAssignments.forEach((p) => {
    const key = p.blockId ?? "__none";
    if (!positionsByBlock[key]) positionsByBlock[key] = [];
    positionsByBlock[key]!.push(p);
  });

  const blocksWithPositions = blocks.map((b) => ({
    ...b,
    positions: positionsByBlock[b.id] ?? [],
  }));

  const blocksByScene: Record<string, typeof blocksWithPositions> = {};
  blocksWithPositions.forEach((b) => {
    const key = b.sceneId ?? "__none";
    if (!blocksByScene[key]) blocksByScene[key] = [];
    blocksByScene[key]!.push(b);
  });

  return scenes.map((s) => ({ ...s, blocks: blocksByScene[s.id] ?? [] }));
}

async function mutateDailyBook<T>(
  dailyBookId: string,
  expectedVersion: number,
  mutate: (tx: typeof db, claimedBook: typeof dailyBooksTable.$inferSelect) => Promise<T>,
  afterMutate?: (
    tx: typeof db,
    claimedBook: typeof dailyBooksTable.$inferSelect,
    result: T,
  ) => Promise<void>,
): Promise<T> {
  return db.transaction((tx) => mutateDailyBookEm(tx as unknown as typeof db, dailyBookId, expectedVersion, mutate, afterMutate));
}

/** O mesmo que `mutateDailyBook`, mas dentro de uma transação que já existe (a de quem chamou). */
async function mutateDailyBookEm<T>(
  tx: typeof db,
  dailyBookId: string,
  expectedVersion: number,
  mutate: (tx: typeof db, claimedBook: typeof dailyBooksTable.$inferSelect) => Promise<T>,
  afterMutate?: (
    tx: typeof db,
    claimedBook: typeof dailyBooksTable.$inferSelect,
    result: T,
  ) => Promise<void>,
): Promise<T> {
  const [claimedBook] = await tx
    .update(dailyBooksTable)
    .set({ version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(dailyBooksTable.id, dailyBookId), eq(dailyBooksTable.version, expectedVersion)))
    .returning();
  if (!claimedBook) throw new VersionConflictError("Livro do Dia");
  const result = await mutate(tx, claimedBook);
  if (afterMutate) await afterMutate(tx, claimedBook, result);
  return result;
}

async function respondDailyBookVersionConflict(
  req: any,
  res: any,
  dailyBookId: string,
  expectedVersion: number,
): Promise<void> {
  const [currentBook] = await db
    .select()
    .from(dailyBooksTable)
    .where(eq(dailyBooksTable.id, dailyBookId))
    .limit(1);
  if (!currentBook) {
    res.status(404).json({ error: "NAO_ENCONTRADO", message: "Livro do Dia não encontrado." });
    return;
  }
  const currentSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(dailyBookId) };
  respondWithVersionConflict(
    res,
    "Livro do Dia",
    expectedVersion,
    currentBook.version,
    currentSnapshot,
    readBaseSnapshot(req),
  );
}

async function respondDailyBookMutationError(
  err: unknown,
  req: any,
  res: any,
  dailyBookId: string,
  expectedVersion: number,
): Promise<boolean> {
  if (err instanceof VersionConflictError) {
    await respondDailyBookVersionConflict(req, res, dailyBookId, expectedVersion);
    return true;
  }
  if (err instanceof VersionedResourceNotFoundError) {
    res.status(404).json({ error: "NAO_ENCONTRADO", message: err.message });
    return true;
  }
  return false;
}

/** Todo userId convocado (não REMOVED) num snapshot `{ scenes: [...] }` — usado para avisar quem
 *  está na foto que acabou de ser publicada/republicada, em vez de reconsultar o banco. */
function userIdsInSnapshot(snapshotJson: unknown): string[] {
  const scenes = (snapshotJson as { scenes?: any[] } | null | undefined)?.scenes ?? [];
  const ids = new Set<string>();
  for (const scene of scenes) for (const block of scene.blocks ?? []) for (const position of block.positions ?? [])
    for (const a of position.assignments ?? []) if (a.status !== "REMOVED" && a.userId) ids.add(a.userId);
  return [...ids];
}

function computeDelta(
  prevSnapshot: Record<string, unknown> | null | undefined,
  currSnapshot: Record<string, unknown>
): Record<string, unknown> {
  // Guard: if the stored snapshot has no `scenes` array it is either an empty
  // placeholder ({}) or a pre-feature legacy row ({rotationWinners:…}).
  // Treat it as "snapshot unavailable" instead of reporting every live scene
  // as a new addition.
  if (!prevSnapshot || !Array.isArray(prevSnapshot.scenes)) {
    return { additions: [], removals: [], swaps: [], structural: [], isEmpty: true, snapshotUnavailable: true };
  }

  const prevScenes = (prevSnapshot.scenes as any[]) ?? [];
  const currScenes = (currSnapshot.scenes as any[]) ?? [];

  const additions: any[] = [];
  const removals: any[] = [];
  const swaps: any[] = [];
  const structural: any[] = [];

  const prevSceneMap = new Map(prevScenes.map((s: any) => [s.id, s]));
  const currSceneMap = new Map(currScenes.map((s: any) => [s.id, s]));

  currScenes.forEach((s: any) => {
    if (!prevSceneMap.has(s.id)) structural.push({ type: "scene_added", id: s.id, name: s.name });
  });
  prevScenes.forEach((s: any) => {
    if (!currSceneMap.has(s.id)) structural.push({ type: "scene_removed", id: s.id, name: s.name });
  });

  currScenes.forEach((s: any) => {
    const prev = prevSceneMap.get(s.id);
    if (s.isRemoved && prev && !prev.isRemoved) {
      structural.push({ type: "scene_soft_removed", id: s.id, name: s.name });
    }
    const prevBlockMap = new Map<string, any>((prev?.blocks ?? []).map((b: any) => [b.id, b]));
    (s.blocks ?? []).forEach((b: any) => {
      const prevBlock: any = prevBlockMap.get(b.id);
      if (b.isRemoved && prevBlock && !prevBlock.isRemoved) {
        structural.push({ type: "block_soft_removed", blockId: b.id, blockName: b.name, sceneId: s.id });
      }
      const prevPosMap = new Map<string, any>((prevBlock?.positions ?? []).map((p: any) => [p.id, p]));
      (b.positions ?? []).forEach((p: any) => {
        const prevPos: any = prevPosMap.get(p.id);
        if (p.isRemoved && prevPos && !prevPos.isRemoved) {
          structural.push({ type: "position_soft_removed", positionId: p.id, positionName: p.name, sceneId: s.id, blockId: b.id });
        }
      });
    });
  });

  const prevAssignments: Record<string, string | null> = {};
  const currAssignments: Record<string, string | null> = {};

  prevScenes.forEach((s: any) => {
    (s.blocks ?? []).forEach((b: any) => {
      (b.positions ?? []).forEach((p: any) => {
        if (p.isRemoved) return;
        (p.assignments ?? []).forEach((a: any) => {
          if (a.status !== "REMOVED") prevAssignments[a.id] = a.userId ?? null;
        });
      });
    });
  });

  currScenes.forEach((s: any) => {
    (s.blocks ?? []).forEach((b: any) => {
      (b.positions ?? []).forEach((p: any) => {
        if (p.isRemoved) return;
        (p.assignments ?? []).forEach((a: any) => {
          if (a.status !== "REMOVED") currAssignments[a.id] = a.userId ?? null;
        });
      });
    });
  });

  Object.keys(currAssignments).forEach((assignId) => {
    if (prevAssignments[assignId] !== undefined) {
      if (prevAssignments[assignId] !== currAssignments[assignId]) {
        swaps.push({ assignmentId: assignId, from: prevAssignments[assignId], to: currAssignments[assignId] });
      }
    } else {
      additions.push({ type: "assignment", assignmentId: assignId, userId: currAssignments[assignId] });
    }
  });

  Object.keys(prevAssignments).forEach((assignId) => {
    if (currAssignments[assignId] === undefined) {
      removals.push({ type: "assignment", assignmentId: assignId, userId: prevAssignments[assignId] });
    }
  });

  const isEmpty = additions.length === 0 && removals.length === 0 && swaps.length === 0 && structural.length === 0;
  return { additions, removals, swaps, structural, isEmpty };
}

async function writeDailyBookAudit(
  dailyBookId: string,
  actorId: string,
  action: string,
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown> | null,
  executor: any = db,
) {
  const write = async () => {
    const [mo] = await executor
      .insert(operationalChangesTable)
      .values({
        type: "MO_AJUSTE_ESCALA",
        actorId,
        actorType: "HUMAN",
        correlationId: dailyBookId,
        affectedEntities: [{ type: "daily_book", id: dailyBookId }] as any,
        context: { action } as any,
      })
      .returning();

    if (mo) {
      await executor.insert(historyEventsTable).values({
        moId: mo.id,
        entityType: "daily_book",
        entityId: dailyBookId,
        actorId,
        actorType: "HUMAN",
        action,
        beforeState: beforeState as any,
        afterState: afterState as any,
      });
    }
  };
  await write();
}

export interface PlannedAssignment {
  userId: string | null;
  status: "ASSIGNED" | "OPEN";
}

// Decide (puro, sem efeitos no banco) quais assignments um papel deve receber, a partir da
// resolução por papel (regras + disponibilidade) e da alocação manual da escala. Regras:
// - papel COM linhas e pessoas resolvidas → 1 ASSIGNED por pessoa;
// - papel COM linhas, sem pessoas, mas com linha DESCOBERTA hoje → 1 OPEN (buraco real);
// - papel COM linhas todas INATIVAS hoje → nenhum buraco; só honra alocação manual, se houver;
// - papel SEM linhas → fallback na escala (compat papéis legados).
export function planRoleAssignments(
  rr: RoleResolution | undefined,
  roleId: string,
  allocationMap: Record<string, string | null>,
  minimumCoverage: number = 1
): PlannedAssignment[] {
  const openSlots = (n: number): PlannedAssignment[] =>
    Array.from({ length: n }, () => ({ userId: null, status: "OPEN" as const }));

  if (rr && rr.hasLines) {
    if (rr.people.length > 0) {
      // Linhas cobertas → uma vaga ASSIGNED por pessoa + buracos até o mínimo.
      const result: PlannedAssignment[] = rr.people.map((person) => ({ userId: person.userId, status: "ASSIGNED" as const }));
      while (result.length < minimumCoverage) result.push({ userId: null, status: "OPEN" });
      return result;
    }
    if (rr.hasUncoveredLine) {
      // Linha ativa hoje sem ninguém disponível: buraco(s) real(is).
      return openSlots(Math.max(1, minimumCoverage));
    }
    // Todas as linhas estão INATIVAS hoje (ex.: dia da semana que não atua): o papel não
    // participa. Não geramos buraco; honramos apenas uma alocação manual da escala, se houver.
    const manualUserId = allocationMap[roleId] ?? null;
    if (manualUserId) {
      return [{ userId: manualUserId, status: "ASSIGNED" }];
    }
    return [];
  }
  // Caminho legado (papel sem linhas): cai na escala manual e gera minimumCoverage vagas.
  const assignedUserId = allocationMap[roleId] ?? null;
  const result: PlannedAssignment[] = assignedUserId
    ? [{ userId: assignedUserId, status: "ASSIGNED" }]
    : [];
  while (result.length < Math.max(1, minimumCoverage)) result.push({ userId: null, status: "OPEN" });
  return result;
}

// Regra: a mesma pessoa não pode ocupar duas posições dentro da MESMA cena (pode em cenas
// diferentes). Quando o planeamento escolhe alguém que já está noutra posição da cena, esse
// segundo lugar vira buraco (OPEN) — assim a pessoa só aparece uma vez na cena e o lugar
// duplicado fica visível para o gestor preencher com outra pessoa. Muta `assignedInScene`.
export function dedupAssignmentsForScene(
  planned: PlannedAssignment[],
  assignedInScene: Set<string>
): PlannedAssignment[] {
  return planned.map((a) => {
    if (!a.userId) return a;
    if (assignedInScene.has(a.userId)) {
      return { userId: null, status: "OPEN" as const };
    }
    assignedInScene.add(a.userId);
    return a;
  });
}

// Pré-popula a ocupação por cena com as pessoas dos papéis resolvidos por LINHAS, para que
// papéis legados/manuais (escala) não dupliquem essas pessoas na mesma cena, independentemente
// da ordem em que são processados no loop.
function buildSceneOccupancyFromResolver(
  roles: { id: string; blockId: string | null }[],
  sceneByBlock: Record<string, string | null>,
  byRole: Map<string, RoleResolution>
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const role of roles) {
    const sceneKey = role.blockId ? sceneByBlock[role.blockId] ?? null : null;
    if (!sceneKey) continue;
    const rr = byRole.get(role.id);
    if (rr && rr.hasLines && rr.people.length > 0) {
      let set = map.get(sceneKey);
      if (!set) { set = new Set<string>(); map.set(sceneKey, set); }
      for (const p of rr.people) set.add(p.userId);
    }
  }
  return map;
}

// Cria os assignments de um papel: usa o resolvedor (regras + disponibilidade) quando
// o papel tem linhas configuradas; senão cai na escala (compatibilidade com papéis legados).
// Papéis resolvidos por linhas já vêm sem duplicatas na cena (o resolver puxou o próximo
// substituto/rodízio). Para papéis legados/manuais não há cadeia: aqui deduplicamos contra a
// ocupação da cena — a 2ª ocorrência da pessoa vira OPEN (vazio).
function planAssignmentsForRole(
  roleId: string,
  byRole: Map<string, RoleResolution>,
  allocationMap: Record<string, string | null>,
  sceneKey: string | null,
  assignedByScene: Map<string, Set<string>>,
  minimumCoverage: number = 1,
): PlannedAssignment[] {
  const rr = byRole.get(roleId);
  const fromResolver = !!(rr && rr.hasLines && rr.people.length > 0);
  const planned = planRoleAssignments(rr, roleId, allocationMap, minimumCoverage);
  let finalPlanned = planned;
  if (sceneKey && !fromResolver) {
    let set = assignedByScene.get(sceneKey);
    if (!set) { set = new Set<string>(); assignedByScene.set(sceneKey, set); }
    finalPlanned = dedupAssignmentsForScene(planned, set);
  }
  return finalPlanned;
}

async function createAssignmentsForRole(
  dailyBookId: string,
  positionId: string,
  roleId: string,
  byRole: Map<string, RoleResolution>,
  allocationMap: Record<string, string | null>,
  sceneKey: string | null,
  assignedByScene: Map<string, Set<string>>,
  minimumCoverage: number = 1,
  dailySceneId: string | null = sceneKey,
  dbLike: typeof db = db
) {
  const finalPlanned = planAssignmentsForRole(roleId, byRole, allocationMap, sceneKey, assignedByScene, minimumCoverage);
  for (const a of finalPlanned) {
    await dbLike.insert(dailyBookAssignmentsTable).values({
      dailyBookId,
      positionId,
      sceneId: dailySceneId,
      userId: a.userId,
      status: a.status,
    });
  }
}

// ─── Livro do Dia vivo (14/10) ─────────────────────────────────────────────────
// A vaga sem `manual=true` é recalculada na leitura, com o mesmo motor usado para gerar/
// regenerar (titular, depois rodízio, sem quem está de folga). `manual=true` é a exceção do dia
// — a gerência trocou esta vaga à mão (hoje, pela Escala) — e para de ser recalculada sozinha.

type LiveResolutionContext = {
  operationId: string;
  date: string;
  byRole: Map<string, RoleResolution>;
  allocationMap: Record<string, string | null>;
  unavailable: Set<string>;
};

/** Reúne o que é preciso para resolver o livro ao vivo. `null` quando não há Show Book para
 *  resolver contra (papel legado/manual continua exatamente como está guardado). */
async function liveResolutionContext(
  book: { agendaEventId: string; showBookId: string | null; scaleId: string | null },
  dbLike: typeof db = db,
): Promise<LiveResolutionContext | null> {
  if (!book.showBookId) return null;
  const [event] = await dbLike.select({ operationId: agendaEventsTable.operationId, date: agendaEventsTable.date })
    .from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
  if (!event) return null;
  const allocations = book.scaleId
    ? await dbLike.select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.scaleId, book.scaleId), eq(scaleAllocationsTable.agendaEventId, book.agendaEventId), eq(scaleAllocationsTable.active, true)))
    : [];
  const allocationMap: Record<string, string | null> = {};
  allocations.forEach((a) => { if (a.positionId) allocationMap[a.positionId] = a.userId ?? null; });
  const [{ byRole }, unavailable] = await Promise.all([
    resolveAssignmentsByRole(book.showBookId, event.operationId, event.date, { dedupPerScene: true, eventId: book.agendaEventId }),
    getUnavailableUserIds(event.operationId, event.date),
  ]);
  return { operationId: event.operationId, date: event.date, byRole, allocationMap, unavailable };
}

type LiveSlotRow = { id: string; userId: string | null; status: string; manual: boolean };

/** Dado o que está guardado numa posição, devolve só o que precisa mudar para bater com o motor
 *  agora — pulando toda vaga `manual`. Pura: não lê nem escreve no banco. */
function reconcileLiveSlots(
  rows: LiveSlotRow[],
  rr: RoleResolution | undefined,
  roleId: string,
  allocationMap: Record<string, string | null>,
  minimumCoverage: number,
): { id: string; userId: string | null; status: "ASSIGNED" | "OPEN" }[] {
  if (!rows.length || rows.every((row) => row.manual)) return [];
  const planned = planRoleAssignments(rr, roleId, allocationMap, minimumCoverage);
  const out: { id: string; userId: string | null; status: "ASSIGNED" | "OPEN" }[] = [];
  rows.forEach((row, index) => {
    if (row.manual) return;
    const next = planned[index] ?? { userId: null, status: "OPEN" as const };
    out.push({ id: row.id, userId: next.userId, status: next.status });
  });
  return out;
}

/**
 * Árvore do Livro do Dia como ela está AGORA: vaga sem `manual` mostra quem o motor escalaria
 * neste instante; vaga `manual` mostra exatamente o que está guardado (com um aviso se a pessoa
 * está de folga hoje — não desfaz a troca sozinho). Não escreve nada no banco. Livro
 * executado/cancelado volta sem recalcular: é o registro do que aconteceu.
 */
async function resolveLiveTree(
  book: { id: string; status: string; agendaEventId: string; showBookId: string | null; scaleId: string | null },
  dbLike: typeof db = db,
) {
  const tree = await buildDailyBookTree(book.id, dbLike);
  if (book.status === "EXECUTED" || book.status === "CANCELLED") return tree;
  const ctx = await liveResolutionContext(book, dbLike);
  if (!ctx) return tree;

  const nameOf = new Map<string, string | null>();
  for (const scene of tree) for (const block of scene.blocks) for (const position of block.positions)
    for (const a of position.assignments) if (a.userId && a.userName) nameOf.set(a.userId, a.userName);
  const missing = new Set<string>();

  const liveTree = tree.map((scene) => ({
    ...scene,
    blocks: scene.blocks.map((block) => ({
      ...block,
      positions: block.positions.map((position) => {
        if (position.isRemoved || !position.sourceRoleId) return position;
        const liveRows = position.assignments.filter((a) => a.status !== "REMOVED");
        const rr = ctx.byRole.get(position.sourceRoleId);
        const updates = new Map(reconcileLiveSlots(
          liveRows.map((row) => ({ id: row.id, userId: row.userId, status: row.status, manual: row.manual })),
          rr, position.sourceRoleId, ctx.allocationMap, position.minimumCoverage,
        ).map((u) => [u.id, u]));
        const assignments = position.assignments.map((a) => {
          const update = updates.get(a.id);
          if (update) {
            const userName = update.userId ? nameOf.get(update.userId) ?? null : null;
            if (update.userId && userName === null) missing.add(update.userId);
            return { ...a, userId: update.userId, status: update.status, userName };
          }
          if (a.manual && a.userId && ctx.unavailable.has(a.userId)) {
            return { ...a, alerta: "Esta pessoa está de folga hoje. A troca continua valendo — confira se ainda faz sentido." };
          }
          return a;
        });
        return { ...position, assignments };
      }),
    })),
  }));

  if (missing.size) {
    const rows = await dbLike.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, [...missing]));
    const byId = new Map(rows.map((r) => [r.id, r.name]));
    for (const scene of liveTree) for (const block of scene.blocks) for (const position of block.positions)
      for (const a of position.assignments) if (a.userId && missing.has(a.userId) && !a.userName) a.userName = byId.get(a.userId) ?? null;
  }
  return liveTree;
}

/**
 * Escreve nas vagas de verdade o que estava ao vivo no instante de executar ou cancelar — só nas
 * que não são `manual`. É o único momento em que a resolução ao vivo é GRAVADA: a leitura normal
 * (`resolveLiveTree`) só mostra. Depois disso o livro é histórico e nunca mais recalcula.
 */
async function bakeLiveAssignments(
  book: { id: string; status: string; agendaEventId: string; showBookId: string | null; scaleId: string | null },
  tx: typeof db,
) {
  const ctx = await liveResolutionContext(book, tx);
  if (!ctx) return;
  const positions = await tx.select().from(dailyBookPositionsTable).where(and(
    eq(dailyBookPositionsTable.dailyBookId, book.id), eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
  ));
  if (!positions.length) return;
  const assignments = await tx.select().from(dailyBookAssignmentsTable).where(and(
    eq(dailyBookAssignmentsTable.dailyBookId, book.id), inArray(dailyBookAssignmentsTable.positionId, positions.map((p) => p.id)),
    isNull(dailyBookAssignmentsTable.supersededAt), ne(dailyBookAssignmentsTable.status, "REMOVED"),
  )).orderBy(dailyBookAssignmentsTable.createdAt, dailyBookAssignmentsTable.id);
  const byPosition = new Map<string, typeof assignments>();
  for (const a of assignments) { const list = byPosition.get(a.positionId) ?? []; list.push(a); byPosition.set(a.positionId, list); }
  for (const position of positions) {
    if (!position.sourceRoleId) continue;
    const rows = byPosition.get(position.id) ?? [];
    const rr = ctx.byRole.get(position.sourceRoleId);
    const updates = reconcileLiveSlots(rows, rr, position.sourceRoleId, ctx.allocationMap, position.minimumCoverage);
    for (const update of updates) {
      const current = rows.find((r) => r.id === update.id);
      if (current && current.userId === update.userId && current.status === update.status) continue;
      await tx.update(dailyBookAssignmentsTable).set({ userId: update.userId, status: update.status, updatedAt: new Date() }).where(eq(dailyBookAssignmentsTable.id, update.id));
    }
  }
}

/**
 * Cria o rascunho de um Livro do Dia a partir de um Show já programado.
 *
 * A Escala é quem inicia o dia operacional: esta função não publica nem
 * notifica ninguém. Ela só materializa a cópia editável do Livro do Show e a
 * vincula à Escala que está sendo preparada. É idempotente para show+data:
 * repetir a geração não apaga ajustes já feitos pela Supervisão.
 */
export async function generateDailyBookDraftForScale(input: {
  showBookId: string;
  date: string;
  scaleId: string;
  actorId: string;
  organizationId: string;
  reason?: string | null;
  /** Sessão separada (0071): o Livro é só desta sessão, com a hora dela. Sem ela, é o Livro do dia do show. */
  sessionId?: string | null;
  /**
   * Gerar o mês: leituras que não mudam durante a geração (o Show, o elenco, as sessões, as regras do local)
   * são feitas uma vez só e reaproveitadas pelos Livros seguintes. O resultado é o mesmo.
   */
  leituras?: LeiturasDoMes;
  /** Falso quando quem chama confere os conflitos de todos os Livros do dia de uma vez (`conferirConflitosDosLivros`). */
  conferirConflitos?: boolean;
  /** As sessões do show que não são separadas e valem na data, se quem chama já as leu. */
  sessoesComuns?: Awaited<ReturnType<typeof eligibleSessions>>;
}) {
  const { showBookId, date, scaleId, actorId, organizationId, reason = null, sessionId = null, leituras, conferirConflitos = true, sessoesComuns } = input;
  const conflitosAdiados = (): ConflitosDaGeracao => ({ conflicts: [], conflictDetection: { status: "adiada" } });
  const [showBook] = await lembrarOuLer(leituras, `show:${showBookId}`, () => db.select().from(showBooksTable).where(eq(showBooksTable.id, showBookId)).limit(1));
  if (!showBook) throw new Error("Show Book não encontrado");
  const [session] = sessionId
    ? await lembrarOuLer(leituras, `sessao:${showBookId}:${sessionId}`, () => db.select().from(sessionsTable).where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.showId, showBookId))).limit(1))
    : [];
  if (sessionId && !session) throw new Error("Sessão não encontrada neste show");

  // O evento do Livro de sessão separada é achado pela hora da sessão; o do Livro do dia é o evento do show
  // que não pertence a nenhuma sessão separada (senão o Livro do dia herdaria o evento de uma sessão).
  // Se a sessão já tem Livro neste dia, o evento é o dele (a hora da sessão pode ter mudado depois da geração).
  const [eventoDoLivroDaSessao] = session ? await db.select({ id: agendaEventsTable.id }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .where(and(eq(dailyBooksTable.sessionId, session.id), eq(agendaEventsTable.date, date), ne(dailyBooksTable.status, "CANCELLED"))).limit(1) : [];
  let [event] = await db.select().from(agendaEventsTable).where(eventoDoLivroDaSessao ? eq(agendaEventsTable.id, eventoDoLivroDaSessao.id) : and(
    eq(agendaEventsTable.showBookId, showBookId),
    eq(agendaEventsTable.date, date),
    eq(agendaEventsTable.operationId, showBook.operationId),
    session
      ? eq(agendaEventsTable.startTime, session.startTime)
      : sql`NOT EXISTS (SELECT 1 FROM daily_books sb WHERE sb.agenda_event_id = ${agendaEventsTable.id} AND sb.session_id IS NOT NULL)`,
  )).limit(1);
  if (event && session && (event.startTime?.slice(0, 5) !== session.startTime.slice(0, 5) || event.endTime?.slice(0, 5) !== session.endTime.slice(0, 5))) {
    [event] = await db.update(agendaEventsTable).set({
      startTime: session.startTime, endTime: session.endTime, title: `${showBook.title} · ${session.startTime.slice(0, 5)}`, updatedAt: new Date(),
    }).where(eq(agendaEventsTable.id, event.id)).returning();
  }
  // Livro do dia inteiro (sem sessão separada): a hora vem da Programação do local, que é o que a Escala lê
  // (decisão de 17/10/2026). Vale a primeira hora do dia; as outras o cartão lista a partir da própria
  // Programação. Hora que já existe na Agenda não é apagada.
  // Show misto: a hora de uma sessão SEPARADA tem o Livro e o evento dela; o Livro do dia não pode herdá-la só por ser a
  // primeira do dia (09:00 da separada no lugar das 17:00 da comum). Por isso essas horas saem da conta.
  const horasDeSeparadas = session ? new Set<string>() : new Set((await eligibleSessionsDoDia(showBookId, date, leituras)).filter((x) => x.separada).map((x) => x.startTime.slice(0, 5)));
  const horaDaProgramacao = session ? null : (await lembrarOuLer(leituras, `programacao:${showBookId}:${date}`, () => horariosDoShowNaProgramacao(showBookId, date))).find((h) => !horasDeSeparadas.has(h.inicio.slice(0, 5))) ?? null;
  if (event && horaDaProgramacao && !event.startTime && !session) {
    [event] = await db.update(agendaEventsTable).set({
      startTime: horaDaProgramacao.inicio, endTime: event.endTime ?? horaDaProgramacao.fim, updatedAt: new Date(),
    }).where(eq(agendaEventsTable.id, event.id)).returning();
  }
  // Evento recém-criado aqui: ainda não tem Livro nem alocação, não há o que procurar.
  let eventoNovo = false;
  if (!event) {
    [event] = await db.insert(agendaEventsTable).values({
      operationId: showBook.operationId,
      showBookId,
      type: "SHOW",
      title: session ? `${showBook.title} · ${session.startTime.slice(0, 5)}` : showBook.title,
      date,
      startTime: session?.startTime ?? horaDaProgramacao?.inicio ?? null,
      endTime: session?.endTime ?? horaDaProgramacao?.fim ?? null,
      status: "CONFIRMED",
      visibility: "MANAGEMENT",
      createdBy: actorId,
    }).returning();
    eventoNovo = true;
  }
  if (!event) throw new Error("Não foi possível preparar o evento interno do Livro do Dia");

  // Livro cancelado (apagado) fica no histórico, mas não impede gerar o dia de novo.
  const [existing] = eventoNovo ? [] : await db.select().from(dailyBooksTable).where(and(
    eq(dailyBooksTable.agendaEventId, event.id),
    eq(dailyBooksTable.showBookId, showBookId),
    sessionId ? eq(dailyBooksTable.sessionId, sessionId) : isNull(dailyBooksTable.sessionId),
    ne(dailyBooksTable.status, "CANCELLED"),
  )).limit(1);
  if (existing) {
    if (existing.scaleId && existing.scaleId !== scaleId) {
      throw new Error("Este Livro do Dia já pertence a outra Escala");
    }
    const dailyBook = existing.scaleId
      ? existing
      : (await db.update(dailyBooksTable).set({ scaleId, updatedAt: new Date() }).where(eq(dailyBooksTable.id, existing.id)).returning())[0]!;
    return { dailyBook, generated: false, conflicts: conferirConflitos ? await detectGeneratedDailyBookConflicts(dailyBook.id, date) : conflitosAdiados() };
  }

  const [{ scenes, blocks, roles }, initialKeyframes] = await Promise.all([
    lembrarOuLer(leituras, `geracao:${showBookId}`, async () => {
      const [scenes, blocks, roles] = await Promise.all([
        db.select().from(showBookScenesTable).where(and(eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.active, true))).orderBy(showBookScenesTable.order),
        db.select().from(showBookBlocksTable).where(and(eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true))).orderBy(showBookBlocksTable.order),
        db.select().from(showBookRolesTable).where(and(eq(showBookRolesTable.showBookId, showBookId), eq(showBookRolesTable.active, true))).orderBy(showBookRolesTable.order, showBookRolesTable.id),
      ]);
      return { scenes, blocks, roles };
    }),
    lembrarOuLer(leituras, "quadros-iniciais", () => db.select({ id: showBookKeyframesTable.id, sceneId: showBookKeyframesTable.sceneId, markerPositions: showBookKeyframesTable.markerPositions })
      .from(showBookKeyframesTable).where(and(eq(showBookKeyframesTable.type, "inicial"), eq(showBookKeyframesTable.active, true)))),
  ]);
  const initialKeyframeByScene = new Map(initialKeyframes.map((frame) => [frame.sceneId, frame]));
  const allocations = eventoNovo ? [] : await db.select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
    .from(scaleAllocationsTable).where(and(eq(scaleAllocationsTable.scaleId, scaleId), eq(scaleAllocationsTable.agendaEventId, event.id), eq(scaleAllocationsTable.active, true)));
  const allocationMap: Record<string, string | null> = {};
  allocations.forEach((allocation) => { if (allocation.positionId) allocationMap[allocation.positionId] = allocation.userId ?? null; });
  // O evento e o local do Show já estão em mãos: o motor das regras do dia não precisa relê-los.
  const eventoConhecido = { id: event.id, showBookId: event.showBookId, start: event.startTime, end: event.endTime, eventLocationId: event.locationId, showLocationId: showBook.locationId };
  const { byRole, result, nomes } = await resolveAssignmentsByRole(showBookId, event.operationId, date, { dedupPerScene: true, eventId: event.id, leituras, eventoConhecido });
  const rotationWinners = collectRotationWinners(result);
  const sessoesDoLivro = sessoesComuns ?? (session ? [] : await eligibleSessions(showBookId, date, db, { separada: false }));
  const nomeFormal = await nomeFormalDoAtor(actorId, leituras);

  // Tudo o que o Livro leva é gravado em poucas instruções (uma por tabela, não uma por linha), com os ids já
  // definidos aqui — assim a árvore do retrato (snapshot) se monta com o que acabou de ser gravado, sem reler.
  let positionsCount = 0;
  const dailyBook = await db.transaction(async (tx) => {
    const typedTx = tx as unknown as typeof db;
    const bookId = randomUUID();
    await typedTx.insert(dailyBooksTable).values({
      id: bookId,
      agendaEventId: event!.id,
      scaleId,
      showBookId,
      sessionId,
      status: "DRAFT",
      version: 1,
      snapshotJson: {} as any,
      generatedAt: new Date(),
      generatedBy: actorId,
    });
    const sceneIdMap: Record<string, string> = {};
    const scenesToInsert = scenes.map((scene) => {
      const id = randomUUID();
      sceneIdMap[scene.id] = id;
      return { id, dailyBookId: bookId, name: scene.name, order: scene.order, sourceSceneId: scene.id, sourceKeyframeId: initialKeyframeByScene.get(scene.id)?.id ?? null };
    });
    const sceneRows = scenesToInsert.length ? await typedTx.insert(dailyBookScenesTable).values(scenesToInsert).returning() : [];
    const blockIdMap: Record<string, string> = {};
    const blocksToInsert = blocks.map((block) => {
      const id = randomUUID();
      blockIdMap[block.id] = id;
      return {
        id, dailyBookId: bookId, name: block.name, order: block.order, startTime: block.startTime, endTime: block.endTime,
        sourceBlockId: block.id, sceneId: block.sceneId ? sceneIdMap[block.sceneId] ?? null : null,
      };
    });
    const blockRows = blocksToInsert.length ? await typedTx.insert(dailyBookBlocksTable).values(blocksToInsert).returning() : [];
    const sessionSync = await syncSessionBlocks(bookId, showBookId, date, typedTx, { sessionId, sessoesComuns: sessoesDoLivro });
    const sceneByBlock: Record<string, string | null> = {};
    blocks.forEach((block) => { sceneByBlock[block.id] = block.sceneId ?? null; });
    const assignedByScene = buildSceneOccupancyFromResolver(roles, sceneByBlock, byRole);
    const positionsToInsert: (typeof dailyBookPositionsTable.$inferInsert)[] = [];
    const assignmentsToInsert: (typeof dailyBookAssignmentsTable.$inferInsert)[] = [];
    for (const role of roles) {
      const positionId = randomUUID();
      positionsToInsert.push({
        id: positionId, dailyBookId: bookId, name: role.name, minimumCoverage: role.minimumCoverage,
        sourceRoleId: role.id, blockId: role.blockId ? blockIdMap[role.blockId] ?? null : null,
      });
      positionsCount++;
      const sourceSceneId = role.blockId ? sceneByBlock[role.blockId] ?? null : null;
      for (const a of planAssignmentsForRole(role.id, byRole, allocationMap, sourceSceneId, assignedByScene, role.minimumCoverage)) {
        assignmentsToInsert.push({ dailyBookId: bookId, positionId, sceneId: sourceSceneId ? sceneIdMap[sourceSceneId] ?? null : null, userId: a.userId, status: a.status });
      }
    }
    const positionRows = positionsToInsert.length ? await typedTx.insert(dailyBookPositionsTable).values(positionsToInsert).returning() : [];
    const assignmentRows: (typeof dailyBookAssignmentsTable.$inferSelect)[] = [];
    // Em pedaços, para não estourar o limite de parâmetros de uma instrução do PostgreSQL.
    for (let i = 0; i < assignmentsToInsert.length; i += 1000) {
      assignmentRows.push(...await typedTx.insert(dailyBookAssignmentsTable).values(assignmentsToInsert.slice(i, i + 1000)).returning());
    }

    // O retrato é a mesma árvore que a leitura monta do banco (ver `buildDailyBookTree`), com as linhas na mesma ordem.
    const faltamNomes = [...new Set(assignmentRows.map((a) => a.userId).filter((id): id is string => Boolean(id) && !nomes.has(id!)))];
    const nameByUserId: Record<string, string> = Object.fromEntries(nomes);
    if (faltamNomes.length) for (const u of await typedTx.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, faltamNomes))) nameByUserId[u.id] = u.name;
    const fullTree = montarArvoreDoLivro({
      scenes: [...sceneRows].sort((a, b) => a.order - b.order).map(liveRow),
      blocks: [...blockRows].sort((a, b) => a.order - b.order).map(liveRow),
      positions: positionRows.map(liveRow),
      assignments: [...assignmentRows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(liveRow),
      nameByUserId,
    });
    const [updated] = await typedTx.update(dailyBooksTable).set({ snapshotJson: { scenes: fullTree, rotationWinners } as any }).where(eq(dailyBooksTable.id, bookId)).returning();
    if (!updated) throw new Error("Não foi possível criar o Livro do Dia");
    await writeHistoryEvent({
      category: "DAILY_BOOK", action: "generated", title: "Livro do Dia gerado",
      narrative: `O Livro do Dia foi gerado para ${date} a partir da Escala em rascunho.`,
      entityType: "daily_book", entityId: bookId, actorId, actorType: "HUMAN", operationId: event!.operationId, orgId: organizationId,
      beforeState: null, afterState: updated,
      metadata: { agendaEventId: event!.id, showBookId, scaleId, reason, sessionIds: sessionSync.sessionIds, sessionBlockIds: sessionSync.createdBlockIds },
      nomeFormalDoAtor: nomeFormal,
    }, tx as any);
    return updated;
  });
  eventBus.emit("daily-book.created", { dailyBookId: dailyBook.id, agendaEventId: event.id, scaleId, version: 1 });
  eventBus.emit("daily-book.generated", { dailyBookId: dailyBook.id, agendaEventId: event.id, version: 1, scenesCount: scenes.length, positionsCount });
  return { dailyBook, generated: true, conflicts: conferirConflitos ? await detectGeneratedDailyBookConflicts(dailyBook.id, date) : conflitosAdiados() };
}

router.post("/daily-book/generate", requireAuth, requireOrganization, async (req, res) => {
  const {
    agendaEventId: bodyAgendaEventId,
    scaleId: explicitScaleId,
    showBookId: bodyShowBookId,
    date: bodyDate,
  } = req.body;
  const user = req.user!;
  const userId = user.sub;

  // Dois modos de geração:
  //  (1) por DATA (novo): escolhe-se o Livro do Show + a data. A operação vem do próprio
  //      Livro do Show e a disponibilidade (folgas/restrições) é resolvida pela data. Nos
  //      bastidores reutilizamos/criamos um evento de agenda interno (visibility MANAGEMENT)
  //      apenas para carregar showBook+operação+data — o utilizador nunca lida com a agenda.
  //  (2) por EVENTO (legado): mantém o comportamento antigo via agendaEventId.
  if (!bodyAgendaEventId && (!bodyShowBookId || !bodyDate)) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Informe o Livro do Show e a data." });
    return;
  }
  // Não aceitamos payload ambíguo: ou modo por data, ou modo legado por evento.
  if (bodyAgendaEventId && (bodyShowBookId || bodyDate)) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Envie apenas o Livro do Show + data, ou apenas um evento — não ambos." });
    return;
  }
  try {
    let agendaEventId: string = bodyAgendaEventId ?? "";

    if (!agendaEventId) {
      const [achado] = await db.select({ sb: showBooksTable, organizationId: operationsTable.organizationId }).from(showBooksTable)
        .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id)).where(eq(showBooksTable.id, bodyShowBookId)).limit(1);
      // Show de outra organização responde como se não existisse (antes a Administração gerava Livro no show de outra casa).
      const sb = achado && achado.organizationId === user.organizationId ? achado.sb : undefined;
      if (!sb) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Show Book não encontrado." }); return; }

      if (!(await canOperateDailyBook(user, sb.operationId, { id: sb.id, responsibleId: sb.responsibleId }))) {
        res.status(403).json({ error: "ACESSO_NEGADO", message: "Apenas o responsável por este show, um capitão delegado ou um admin podem gerar o Livro do Dia" });
        return;
      }

      // Reutiliza um evento existente para este Livro do Show + data; senão cria um interno.
      const [existing] = await db
        .select({ id: agendaEventsTable.id })
        .from(agendaEventsTable)
        .where(and(
          eq(agendaEventsTable.showBookId, bodyShowBookId),
          eq(agendaEventsTable.date, bodyDate),
          eq(agendaEventsTable.operationId, sb.operationId),
        ))
        .limit(1);
      if (existing) {
        agendaEventId = existing.id;
      } else {
        const [created] = await db
          .insert(agendaEventsTable)
          .values({
            operationId: sb.operationId,
            showBookId: bodyShowBookId,
            type: "SHOW",
            title: sb.title,
            date: bodyDate,
            status: "CONFIRMED",
            visibility: "MANAGEMENT",
            createdBy: userId,
          })
          .returning({ id: agendaEventsTable.id });
        agendaEventId = created!.id;
      }
    } else {
      // Auth do modo legado: validar contra a operação REAL do evento, nunca um operationId
      // vindo do cliente (evita bypass com evento de outra operação).
      const [ev] = await db
        .select({ operationId: agendaEventsTable.operationId, showBookId: agendaEventsTable.showBookId, organizationId: operationsTable.organizationId })
        .from(agendaEventsTable)
        .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
        .where(eq(agendaEventsTable.id, agendaEventId))
        .limit(1);
      if (!ev || ev.organizationId !== user.organizationId) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Evento não encontrado." }); return; }
      const loaded = ev.showBookId ? await loadShowRef(ev.showBookId) : null;
      if (!(await canOperateDailyBook(user, ev.operationId, loaded?.ref ?? null))) {
        res.status(403).json({ error: "ACESSO_NEGADO", message: "Apenas o responsável por este show, um capitão delegado ou um admin podem gerar o Livro do Dia" });
        return;
      }
    }

    const [event] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, agendaEventId)).limit(1);
    if (!event) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Evento não encontrado." }); return; }

    const showBookId = event.showBookId;
    if (!showBookId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Evento não tem Show Book associado." }); return; }

    const [showBook] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, showBookId)).limit(1);
    if (!showBook) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Show Book não encontrado." }); return; }

    let scaleId = explicitScaleId ?? null;
    if (!scaleId) {
      const [publishedScale] = await db
        .select({ id: scalesTable.id })
        .from(scalesTable)
        .where(and(
          eq(scalesTable.agendaEventId, agendaEventId),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"])
        ))
        .limit(1);
      scaleId = publishedScale?.id ?? null;
    }

    const scenes = await db
      .select()
      .from(showBookScenesTable)
      .where(and(eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.active, true)))
      .orderBy(showBookScenesTable.order);

    const blocks = await db
      .select()
      .from(showBookBlocksTable)
      .where(and(eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true)))
      .orderBy(showBookBlocksTable.order);

    const initialKeyframes = await db
      .select({ id: showBookKeyframesTable.id, sceneId: showBookKeyframesTable.sceneId, markerPositions: showBookKeyframesTable.markerPositions })
      .from(showBookKeyframesTable)
      .where(and(eq(showBookKeyframesTable.type, "inicial"), eq(showBookKeyframesTable.active, true)));
    const initialKeyframeByScene = new Map(initialKeyframes.map((frame) => [frame.sceneId, frame]));

    const roles = await db
      .select()
      .from(showBookRolesTable)
      .where(and(eq(showBookRolesTable.showBookId, showBookId), eq(showBookRolesTable.active, true)))
      .orderBy(showBookRolesTable.order, showBookRolesTable.id);

    let allocations: { positionId: string | null; userId: string | null }[] = [];
    if (scaleId) {
      allocations = await db
        .select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.scaleId, scaleId), eq(scaleAllocationsTable.agendaEventId, agendaEventId), eq(scaleAllocationsTable.active, true)));
    }

    const allocationMap: Record<string, string | null> = {};
    allocations.forEach((a) => { if (a.positionId) allocationMap[a.positionId] = a.userId ?? null; });

    // Resolve o elenco por papel pelas regras das linhas + disponibilidade na data do evento.
    // dedupPerScene: não repetir a mesma pessoa na mesma cena — puxa o próximo substituto/rodízio.
    const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, event.date, { dedupPerScene: true, eventId: event.id });
    // Persistimos o vencedor de cada linha ROTATION agora, na geração, para que a publicação
    // avance o contador exatamente para quem ficou escalado (e não re-resolva).
    const rotationWinners = collectRotationWinners(result);

    // Wrap the entire creation in a transaction so the row with snapshotJson={}
    // is never visible outside the transaction. On any error, everything rolls
    // back and the client receives a clean 500.
    let positionsCount = 0;
    const { updatedBook, dailyBookId } = await db.transaction(async (tx) => {
      const [dailyBook] = await tx
        .insert(dailyBooksTable)
        .values({
          agendaEventId,
          scaleId: scaleId ?? null,
          showBookId,
          status: "DRAFT",
          version: 1,
          snapshotJson: {} as any,
          generatedAt: new Date(),
          generatedBy: userId,
        })
        .returning();

      const dailyBookId = dailyBook!.id;

      const sceneIdMap: Record<string, string> = {};
      for (const scene of scenes) {
        const [dbScene] = await tx
          .insert(dailyBookScenesTable)
          .values({ dailyBookId, name: scene.name, order: scene.order, sourceSceneId: scene.id, sourceKeyframeId: initialKeyframeByScene.get(scene.id)?.id ?? null })
          .returning();
        sceneIdMap[scene.id] = dbScene!.id;
      }

      const blockIdMap: Record<string, string> = {};
      for (const block of blocks) {
        const [dbBlock] = await tx
          .insert(dailyBookBlocksTable)
          .values({
            dailyBookId,
            name: block.name,
            order: block.order,
            startTime: block.startTime,
            endTime: block.endTime,
            sourceBlockId: block.id,
            sceneId: block.sceneId ? sceneIdMap[block.sceneId] ?? null : null,
          })
          .returning();
        blockIdMap[block.id] = dbBlock!.id;
      }

      // Um bloco por sessão elegível na data, só marcando o horário (sem posições próprias).
      // Sem sessão elegível nada é criado e a geração segue normalmente.
      const sessionSync = await syncSessionBlocks(dailyBookId, showBookId, event.date, tx as unknown as typeof db);

      // Mapa bloco→cena (origem) para aplicar a regra de não-duplicar pessoa na mesma cena.
      const sceneByBlock: Record<string, string | null> = {};
      blocks.forEach((b) => { sceneByBlock[b.id] = b.sceneId ?? null; });
      const assignedByScene = buildSceneOccupancyFromResolver(roles, sceneByBlock, byRole);

      for (const role of roles) {
        const [dbPos] = await tx
          .insert(dailyBookPositionsTable)
          .values({
            dailyBookId,
            name: role.name,
            minimumCoverage: role.minimumCoverage,
            sourceRoleId: role.id,
            blockId: role.blockId ? blockIdMap[role.blockId] ?? null : null,
          })
          .returning();
        positionsCount++;
        const sceneKey = role.blockId ? sceneByBlock[role.blockId] ?? null : null;
        const dailySceneId = sceneKey ? sceneIdMap[sceneKey] ?? null : null;
        await createAssignmentsForRole(
          dailyBookId,
          dbPos!.id,
          role.id,
          byRole,
          allocationMap,
          sceneKey,
          assignedByScene,
          role.minimumCoverage,
          dailySceneId,
          tx as unknown as typeof db,
        );
      }

      const fullTree = await buildDailyBookTree(dailyBookId, tx as unknown as typeof db);
      const snapshotJson = { scenes: fullTree, rotationWinners };
      const [updatedBook] = await tx
        .update(dailyBooksTable)
        .set({ snapshotJson: snapshotJson as any })
        .where(eq(dailyBooksTable.id, dailyBookId))
        .returning();

      await writeHistoryEvent({
        category: "DAILY_BOOK", action: "generated", title: "Livro do Dia gerado",
        narrative: `O Livro do Dia foi gerado para ${event.date}.`, entityType: "daily_book", entityId: dailyBookId,
        actorId: userId, operationId: event.operationId, orgId: user.organizationId,
        beforeState: null, afterState: updatedBook,
        metadata: { agendaEventId, showBookId, scaleId, reason: req.body?.reason ?? null, sessionIds: sessionSync.sessionIds, sessionBlockIds: sessionSync.createdBlockIds },
      }, tx as any);

      return { updatedBook: updatedBook!, dailyBookId };
    });

    eventBus.emit("daily-book.created", { dailyBookId, agendaEventId, scaleId: scaleId ?? null, version: 1 });
    eventBus.emit("daily-book.generated", { dailyBookId, agendaEventId, version: 1, scenesCount: scenes.length, positionsCount });

    const conflictResult = await detectGeneratedDailyBookConflicts(dailyBookId, event.date);
    res.status(201).json({ dailyBook: updatedBook, sessionBlocks: await listSessionBlocks(dailyBookId, showBookId, event.date), ...conflictResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível gerar o Livro do Dia. Tente de novo." });
  }
});

router.post("/daily-book/:id/regenerate", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const user = req.user!;
  const userId = user.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;

    if (user.role !== "ADMIN") {
      const [ev] = book.agendaEventId
        ? await db.select({ operationId: agendaEventsTable.operationId, showBookId: agendaEventsTable.showBookId }).from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1)
        : [undefined];
      const loaded = ev?.showBookId ? await loadShowRef(ev.showBookId) : null;
      if (!ev?.operationId || !(await canOperateDailyBook(user, ev.operationId, loaded?.ref ?? null))) {
        res.status(403).json({ error: "ACESSO_NEGADO", message: "Apenas o responsável por este show, a Supervisão da operação ou a Administração podem regenerar o Livro do Dia" });
        return;
      }
    }

    // Regenerar recria a árvore do Livro; só o rascunho pode passar. Qualquer outro estado
    // (inclusive um futuro) é recusado: publicado/executado/cancelado é registro, não rascunho.
    if (book.status !== "DRAFT") {
      const blocked: Record<string, string> = {
        PUBLISHED: "Livro publicado não pode ser regenerado. Use republish.",
        REPUBLISHED: "Livro republicado não pode ser regenerado. Use republish.",
        EXECUTED: "Livro já executado é histórico e não pode ser regenerado.",
        CANCELLED: "Livro cancelado não pode ser regenerado.",
      };
      res.status(409).json({ error: "ESTADO_INVALIDO", message: blocked[book.status] ?? "Só um Livro em rascunho pode ser regenerado." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };

    const [event] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
    if (!event || !event.showBookId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Evento ou Show Book não encontrado." }); return; }

    const showBookId = event.showBookId;
    const scenes = await db.select().from(showBookScenesTable).where(and(eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.active, true))).orderBy(showBookScenesTable.order);
    const blocks = await db.select().from(showBookBlocksTable).where(and(eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true))).orderBy(showBookBlocksTable.order);
    const initialKeyframes = await db
      .select({ id: showBookKeyframesTable.id, sceneId: showBookKeyframesTable.sceneId, markerPositions: showBookKeyframesTable.markerPositions })
      .from(showBookKeyframesTable)
      .where(and(eq(showBookKeyframesTable.type, "inicial"), eq(showBookKeyframesTable.active, true)));
    const initialKeyframeByScene = new Map(initialKeyframes.map((frame) => [frame.sceneId, frame]));
    const roles = await db.select().from(showBookRolesTable).where(and(eq(showBookRolesTable.showBookId, showBookId), eq(showBookRolesTable.active, true))).orderBy(showBookRolesTable.order, showBookRolesTable.id);

    let allocations: { positionId: string | null; userId: string | null }[] = [];
    if (book.scaleId) {
      allocations = await db
        .select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.scaleId, book.scaleId), eq(scaleAllocationsTable.agendaEventId, book.agendaEventId), eq(scaleAllocationsTable.active, true)));
    }
    const allocationMap: Record<string, string | null> = {};
    allocations.forEach((a) => { if (a.positionId) allocationMap[a.positionId] = a.userId ?? null; });

    // Resolve o elenco por papel pelas regras das linhas + disponibilidade na data do evento.
    // dedupPerScene: não repetir a mesma pessoa na mesma cena — puxa o próximo substituto/rodízio.
    const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, event.date, { dedupPerScene: true, eventId: event.id });
    const rotationWinners = collectRotationWinners(result);

    // Blocos de sessão nunca são apagados aqui: os das sessões ainda elegíveis são
    // atualizados/criados e os que ficaram órfãos permanecem, só sinalizados (a Supervisão decide).
    const beforeSessionBlocks = await listSessionBlocks(id, showBookId, event.date);
    const sessionOutcome = { createdBlockIds: [] as string[], updatedBlockIds: [] as string[], staleBlockIds: [] as string[] };

    // Claim the parent version before replacing children. If another editor
    // changed the book after it was loaded, the whole transaction rolls back.
    const updated = await mutateDailyBook(id, expectedVersion, async (tx, claimedBook) => {
      // Nada é apagado: a geração anterior fica preservada como removida e substituída.
      // `supersededAt` impede que as rotas de restaurar tragam de volta uma linha antiga.
      const supersededAt = sql`now()`;
      await tx.update(dailyBookAssignmentsTable).set({ status: "REMOVED", supersededAt, updatedAt: new Date() })
        .where(and(eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)));
      await tx.update(dailyBookPositionsTable).set({ isRemoved: true, supersededAt, updatedAt: new Date() })
        .where(and(eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt)));
      await tx.update(dailyBookBlocksTable).set({ isRemoved: true, supersededAt, updatedAt: new Date() })
        .where(and(eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.supersededAt), isNotSessionBlock));
      await tx.update(dailyBookScenesTable).set({ isRemoved: true, supersededAt, updatedAt: new Date() })
        .where(and(eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)));

      const sceneIdMap: Record<string, string> = {};
      for (const scene of scenes) {
        const [dbScene] = await tx.insert(dailyBookScenesTable).values({ dailyBookId: id, name: scene.name, order: scene.order, sourceSceneId: scene.id, sourceKeyframeId: initialKeyframeByScene.get(scene.id)?.id ?? null }).returning();
        sceneIdMap[scene.id] = dbScene!.id;
      }
      const blockIdMap: Record<string, string> = {};
      for (const block of blocks) {
        const [dbBlock] = await tx.insert(dailyBookBlocksTable).values({ dailyBookId: id, name: block.name, order: block.order, startTime: block.startTime, endTime: block.endTime, sourceBlockId: block.id, sceneId: block.sceneId ? sceneIdMap[block.sceneId] ?? null : null }).returning();
        blockIdMap[block.id] = dbBlock!.id;
      }
      const sessionSync = await syncSessionBlocks(id, showBookId, event.date, tx);
      sessionOutcome.createdBlockIds = sessionSync.createdBlockIds;
      sessionOutcome.updatedBlockIds = sessionSync.updatedBlockIds;
      sessionOutcome.staleBlockIds = sessionSync.staleBlockIds;
      const sceneByBlock: Record<string, string | null> = {};
      blocks.forEach((b) => { sceneByBlock[b.id] = b.sceneId ?? null; });
      const assignedByScene = buildSceneOccupancyFromResolver(roles, sceneByBlock, byRole);
      for (const role of roles) {
        const [dbPos] = await tx.insert(dailyBookPositionsTable).values({ dailyBookId: id, name: role.name, minimumCoverage: role.minimumCoverage, sourceRoleId: role.id, blockId: role.blockId ? blockIdMap[role.blockId] ?? null : null }).returning();
        const sceneKey = role.blockId ? sceneByBlock[role.blockId] ?? null : null;
        const dailySceneId = sceneKey ? sceneIdMap[sceneKey] ?? null : null;
        await createAssignmentsForRole(
          id,
          dbPos!.id,
          role.id,
          byRole,
          allocationMap,
          sceneKey,
          assignedByScene,
          role.minimumCoverage,
          dailySceneId,
          tx as unknown as typeof db,
        );
      }

      const fullTree = await buildDailyBookTree(id, tx as unknown as typeof db);
      const snapshotJson = { scenes: fullTree, rotationWinners };

      const [updated] = await tx
        .update(dailyBooksTable)
        .set({ version: claimedBook.version, generatedAt: new Date(), generatedBy: userId, snapshotJson: snapshotJson as any, updatedAt: new Date() })
        .where(eq(dailyBooksTable.id, id))
        .returning();

      return updated!;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await writeDailyBookAudit(id, userId, "regenerate",
        { version: book.version, snapshot: beforeSnapshot, sessionBlocks: beforeSessionBlocks },
        { version: next.version, snapshot: afterSnapshot, sessionBlocks: await listSessionBlocks(id, showBookId, event.date, tx), sessionSync: sessionOutcome }, tx);
    });

    eventBus.emit("daily-book.generated", { dailyBookId: id, agendaEventId: book.agendaEventId, version: updated.version, scenesCount: scenes.length, positionsCount: roles.length });

    const conflictResult = await detectGeneratedDailyBookConflicts(id, event.date);
    const sessionBlocks = await listSessionBlocks(id, showBookId, event.date);
    // Órfão só avisa: nada é removido; a Supervisão decide o que fazer com o bloco.
    const warnings = sessionBlocks.filter((block) => block.stale).map((block) => ({ code: "session_block_stale" as const, blockId: block.id, message: `${block.name}: ${block.staleReason}` }));
    res.json({ dailyBook: updated, sessionBlocks, warnings, ...conflictResult });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível regenerar o Livro do Dia. Tente de novo." });
  }
});

router.post("/daily-book/:id/publish", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { reason, comment } = req.body;
  const publishComment = typeof comment === "string" && comment.trim() ? comment.trim() : null;
  const userId = req.user!.sub;
  const user = req.user!;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (user.role !== "ADMIN") {
      let operationId: string | null = null;
      let show: ShowResponsibilityRef | null = null;
      if (book.showBookId) {
        const loaded = await loadShowRef(book.showBookId);
        if (loaded) { operationId = loaded.operationId; show = loaded.ref; }
      }
      if (!operationId && book.scaleId) {
        const [sr] = await db.select({ operationId: scalesTable.operationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
        operationId = sr?.operationId ?? null;
      }
      if (!operationId || !(await canOperateDailyBook(user, operationId, show))) {
        res.status(403).json({ error: "ACESSO_NEGADO", message: "Acesso restrito ao responsável do show, à Supervisão da operação ou à Administração" }); return;
      }
    }
    if (!["DRAFT"].includes(book.status)) {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: `Livro em status ${book.status} não pode ser publicado diretamente.` });
      return;
    }    // O Livro só publica depois da Escala do dia publicada: é a Escala que convoca (tela 15).
    const { scale: escalaDoDia } = await escalaDoDiaDoLivro(id);
    if (!escalaPublicada(escalaDoDia?.status)) {
      res.status(409).json({ error: "ESCALA_NAO_PUBLICADA", message: "A Escala do dia ainda não foi publicada. Publicar a escala é o que convoca as pessoas — antes disso o livro não tem para quem ir." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      // A foto que o Elenco vê até a próxima republicação é a árvore AO VIVO neste instante — não
      // a de quando o livro foi gerado (uma folga marcada entre gerar e publicar já entra aqui).
      // Os vencedores do rodízio continuam os da geração (o contador avança por eles, não por isto).
      const liveTree = await resolveLiveTree(book, tx);
      const existingSnapshot = (book.snapshotJson as { rotationWinners?: RotationWinners } | null) ?? null;
      const [next] = await tx
        .update(dailyBooksTable)
        .set({
          status: "PUBLISHED", publishComment, publishedAt: new Date(), publishedBy: userId,
          snapshotJson: { scenes: liveTree, rotationWinners: existingSnapshot?.rotationWinners ?? {} } as any,
        })
        .where(eq(dailyBooksTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      const [event] = await tx.select({ operationId: agendaEventsTable.operationId })
        .from(agendaEventsTable).where(eq(agendaEventsTable.id, next.agendaEventId)).limit(1);
      await writeHistoryEvent({
        category: "DAILY_BOOK", action: "published",
        title: `Livro do Dia publicado (v${next.version})`,
        narrative: "Livro do Dia publicado e disponível para a equipe.",
        entityType: "daily_book", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: event?.operationId,
        orgId: user.organizationId, beforeState: beforeSnapshot,
        afterState: { book: next, snapshot: afterSnapshot },
        metadata: { reason: reason?.trim() || DEFAULT_DAY_REASON },
      }, tx as any);
      await writeDailyBookAudit(id, userId, "publish",
        { version: book.version, snapshot: beforeSnapshot, status: book.status },
        { version: next.version, snapshot: afterSnapshot, status: "PUBLISHED", reason: reason?.trim() || DEFAULT_DAY_REASON },
        tx);
    });

    // Efetivação da escala do dia: avança os contadores de rodízio uma única vez (DRAFT→PUBLISHED).
    // Usamos os vencedores persistidos na geração para garantir que o contador avance para quem
    // de fato ficou escalado na linha — mesmo que a disponibilidade tenha mudado entre gerar e publicar.
    const snapshot = (book.snapshotJson as Record<string, unknown> | null) ?? null;
    const storedWinners =
      snapshot && snapshot.rotationWinners && typeof snapshot.rotationWinners === "object"
        ? (snapshot.rotationWinners as RotationWinners)
        : null;
    if (storedWinners) {
      db
        .select({ date: agendaEventsTable.date })
        .from(agendaEventsTable)
        .where(eq(agendaEventsTable.id, book.agendaEventId))
        .limit(1)
        .then(([event]) =>
          advanceRotationCountsFromWinners(
            storedWinners,
            event?.date ?? operationalDate(),
          ),
        )
        .catch((e) => console.error("rotation advance failed", e));
    } else if (book.showBookId && book.agendaEventId) {
      // Compat: Livros gerados antes de persistirmos os vencedores re-resolvem a data.
      const [ev] = await db
        .select({ operationId: agendaEventsTable.operationId, date: agendaEventsTable.date })
        .from(agendaEventsTable)
        .where(eq(agendaEventsTable.id, book.agendaEventId))
        .limit(1);
      if (ev?.operationId && ev.date) {
        advanceRotationCounts(book.showBookId, ev.operationId, ev.date).catch((e) =>
          console.error("rotation advance failed", e)
        );
      }
    }

    eventBus.emit("daily-book.published", { dailyBookId: id, version: updated!.version, publishedBy: userId });
    // Avisa quem foi convocado NA FOTO que acabou de ser publicada (ao vivo neste instante) — não
    // quem estava guardado antes de publicar, que pode já ter mudado por folga.
    notifyMany(userIdsInSnapshot(updated!.snapshotJson), {
      type: "book.published",
      title: "Livro do Dia publicado",
      message: `O Livro do Dia (v${updated!.version}) foi publicado com suas atribuições.`,
      priority: "NORMAL",
      category: "book",
      entityType: "daily_book",
      entityId: id,
      actionUrl: `/(tabs)/daily-book`,
    });
    res.json({ dailyBook: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível publicar o Livro do Dia. Tente de novo." });
  }
});

router.post("/daily-book/:id/republish", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { reason, comment } = req.body;
  const publishComment = typeof comment === "string" && comment.trim() ? comment.trim() : null;
  const userId = req.user!.sub;
  const user = req.user!;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (user.role !== "ADMIN") {
      let operationId: string | null = null;
      let show: ShowResponsibilityRef | null = null;
      if (book.showBookId) {
        const loaded = await loadShowRef(book.showBookId);
        if (loaded) { operationId = loaded.operationId; show = loaded.ref; }
      }
      if (!operationId && book.scaleId) {
        const [sr] = await db.select({ operationId: scalesTable.operationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
        operationId = sr?.operationId ?? null;
      }
      if (!operationId || !(await canOperateDailyBook(user, operationId, show))) {
        res.status(403).json({ error: "ACESSO_NEGADO", message: "Acesso restrito ao responsável do show, à Supervisão da operação ou à Administração" }); return;
      }
    }
    if (!["PUBLISHED", "REPUBLISHED"].includes(book.status)) {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Somente livros PUBLICADOS ou REPUBLICADOS podem ser republicados." });
      return;
    }

    // Ao vivo: o que mudou desde a última publicação inclui folga marcada depois, não só troca
    // manual — é exatamente o que a republicação deve avisar.
    const currentTree = await resolveLiveTree(book);
    const currentSnapshot = { scenes: currentTree };
    const prevSnapshot = (book.snapshotJson as Record<string, unknown>) ?? {};
    const delta = computeDelta(prevSnapshot, currentSnapshot);

    if (delta.isEmpty) {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Nenhuma alteração detectada. Delta está vazio.." });
      return;
    }

    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const previousVersion = expectedVersion;
    const newVersion = expectedVersion + 1;

    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBooksTable)
        .set({
          status: "REPUBLISHED",
          version: newVersion,
          publishComment,
          publishedAt: new Date(),
          publishedBy: userId,
          republishDeltaJson: delta as any,
          snapshotJson: currentSnapshot as any,
        })
        .where(eq(dailyBooksTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      const [event] = await tx.select({ operationId: agendaEventsTable.operationId })
        .from(agendaEventsTable).where(eq(agendaEventsTable.id, next.agendaEventId)).limit(1);
      await writeHistoryEvent({
        category: "DAILY_BOOK", action: "republished",
        title: `Livro do Dia republicado (v${previousVersion} → v${newVersion})`,
        narrative: `Livro do Dia republicado com alterações. Versão ${previousVersion} → ${newVersion}.`,
        entityType: "daily_book", entityId: id,
        actorId: userId, actorType: "HUMAN", operationId: event?.operationId,
        orgId: user.organizationId, beforeState: prevSnapshot,
        afterState: { book: next, snapshot: afterSnapshot, delta },
        metadata: { reason: reason?.trim() || DEFAULT_DAY_REASON },
      }, tx as any);
      await writeDailyBookAudit(id, userId, "republish",
        { version: previousVersion, snapshot: prevSnapshot },
        { version: newVersion, snapshot: afterSnapshot, delta, reason: reason?.trim() || DEFAULT_DAY_REASON },
        tx);
    });

    eventBus.emit("daily-book.republished", { dailyBookId: id, previousVersion, newVersion, delta, republishedBy: userId });
    // Avisa quem está na foto que acabou de ser republicada (ao vivo neste instante).
    notifyMany(userIdsInSnapshot(updated!.snapshotJson), {
      type: "book.republished",
      title: "Livro do Dia atualizado",
      message: `O Livro do Dia foi republicado (v${previousVersion} → v${newVersion}). Verifique as alterações.`,
      priority: "IMPORTANT",
      category: "book",
      entityType: "daily_book",
      entityId: id,
      actionUrl: `/(tabs)/daily-book`,
    });
    // Republicar só o Livro deixa a Escala do dia para trás: quem entrou no show recebe "Livro atualizado" e a Minha escala
    // dele continua sem o show, e quem saiu nem é avisado. Quando a Escala tem mudança pendente, a resposta diz isso, e a
    // Administração pode pedir `republicarEscala: true` para republicar as duas de uma vez (é o mesmo que a tela Escalas faz).
    let escala: { pendente: boolean; republicada: boolean; escalaId?: string; escalaVersion?: number; erro?: string } | null = null;
    if (book.scaleId) {
      const [sc] = await db.select({ id: scalesTable.id, status: scalesTable.status, version: scalesTable.version, alteradaDesde: scalesTable.alteradaDesde }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
      if (sc && ["PUBLISHED", "REPUBLISHED"].includes(sc.status) && sc.alteradaDesde) {
        if (req.body?.republicarEscala === true && user.role === "ADMIN") {
          const { republicarEscalaPorChamada } = await import("./escalas.js");
          const feito = await republicarEscalaPorChamada(user as never, sc.id, sc.version);
          escala = feito.status === 200
            ? { pendente: false, republicada: true }
            : { pendente: true, republicada: false, escalaId: sc.id, escalaVersion: sc.version, erro: `O Livro foi republicado, mas a Escala não: ${(feito.body as { message?: string } | null)?.message ?? "tente republicar pela tela Escalas"}.` };
        } else {
          escala = { pendente: true, republicada: false, escalaId: sc.id, escalaVersion: sc.version };
        }
      }
    }
    res.json({ dailyBook: updated, delta, escala });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível republicar o Livro do Dia. Tente de novo." });
  }
});

router.post("/daily-book/:id/execute", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const userId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    if (!["PUBLISHED", "REPUBLISHED"].includes(book.status)) {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Somente livros publicados podem ser executados." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      // Executar é o fim da janela ao vivo: grava de vez nas vagas de verdade o que estava ao
      // vivo neste instante, para o registro do que aconteceu não depender de recalcular depois.
      await bakeLiveAssignments(book, tx);
      const finalTree = await buildDailyBookTree(id, tx);
      const existingSnapshot = (book.snapshotJson as { rotationWinners?: RotationWinners } | null) ?? null;
      const [next] = await tx
        .update(dailyBooksTable)
        .set({
          status: "EXECUTED", executedAt: new Date(), executedBy: userId,
          snapshotJson: { scenes: finalTree, rotationWinners: existingSnapshot?.rotationWinners ?? {} } as any,
        })
        .where(eq(dailyBooksTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      // A nota de como o show correu é opcional, mas quando existe fica guardada no Registro.
      const nota = typeof req.body?.nota === "string" && req.body.nota.trim() ? req.body.nota.trim() : null;
      await writeDailyBookAudit(id, userId, "execute",
        { version: book.version, snapshot: beforeSnapshot, status: book.status },
        { version: next.version, snapshot: afterSnapshot, status: "EXECUTED", ...(nota ? { nota } : {}) }, tx);
    });
    eventBus.emit("daily-book.executed", { dailyBookId: id, version: updated!.version, executedBy: userId });
    res.json({ dailyBook: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível executar o Livro do Dia. Tente de novo." });
  }
});

router.post("/daily-book/:id/cancel", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body;
  const userId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    if (book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro já está cancelado." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const cancelReason = reason?.trim() || DEFAULT_DAY_REASON;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      // Cancelar também fecha a janela ao vivo: grava de vez o que estava ao vivo, pela mesma
      // razão de executar — o registro não pode depender de recalcular depois de virar histórico.
      await bakeLiveAssignments(book, tx);
      const finalTree = await buildDailyBookTree(id, tx);
      const existingSnapshot = (book.snapshotJson as { rotationWinners?: RotationWinners } | null) ?? null;
      const [next] = await tx
        .update(dailyBooksTable)
        .set({
          status: "CANCELLED", cancelledAt: new Date(), cancelledBy: userId,
          snapshotJson: { scenes: finalTree, rotationWinners: existingSnapshot?.rotationWinners ?? {} } as any,
        })
        .where(eq(dailyBooksTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await writeDailyBookAudit(id, userId, "cancel",
        { version: book.version, snapshot: beforeSnapshot, status: book.status },
        { version: next.version, snapshot: afterSnapshot, status: "CANCELLED", reason: cancelReason }, tx);
    });
    res.json({ dailyBook: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível cancelar o Livro do Dia. Tente de novo." });
  }
});

// Reabrir um dia fechado (EXECUTED/CANCELLED → DRAFT) é exclusivo da Administração — mesmo
// supervisor responsável pelo show não pode (20-livro-oficial-interacoes.md / 14 Livro do Dia.dc.html:
// "Reabrir é da Administração — peça a ela e fica registrado quem reabriu"). Motivo obrigatório.
router.post("/daily-book/:id/reopen", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body;
  const userId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!["EXECUTED", "CANCELLED"].includes(book.status)) {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: `Livro em status ${book.status} não precisa ser reaberto — só EXECUTED ou CANCELLED voltam a rascunho.` });
      return;
    }
    const reopenReason = typeof reason === "string" ? reason.trim() : "";
    if (!reopenReason) {
      res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Motivo obrigatório para reabrir um dia fechado.." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBooksTable)
        .set({
          status: "DRAFT",
          executedAt: null, executedBy: null,
          cancelledAt: null, cancelledBy: null,
        })
        .where(eq(dailyBooksTable.id, id))
        .returning();
      return next!;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await writeDailyBookAudit(id, userId, "reopen",
        { version: book.version, snapshot: beforeSnapshot, status: book.status },
        { version: next.version, snapshot: afterSnapshot, status: "DRAFT", reason: reopenReason }, tx);
    });
    eventBus.emit("daily-book.reopened", { dailyBookId: id, version: updated.version, reopenedBy: userId, previousStatus: book.status });
    res.json({ dailyBook: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível reabrir o Livro do Dia. Tente de novo." });
  }
});

router.delete("/daily-book/:id", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const userId = req.user!.sub;
  const user = req.user!;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;

    // Apagar é destrutivo: restrito a gestores (ADMIN ou supervisor da
    // operação). Capitães com delegação podem operar (gerar/publicar) mas NÃO
    // podem apagar — por isso usamos um gate de gestor, não canOperateDailyBook.
    let operationId: string | null = null;
    if (book.showBookId) {
      const loaded = await loadShowRef(book.showBookId);
      if (loaded) operationId = loaded.operationId;
    }
    if (!operationId && book.scaleId) {
      const [sr] = await db.select({ operationId: scalesTable.operationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
      operationId = sr?.operationId ?? null;
    }
    if (!operationId && book.agendaEventId) {
      const [ev] = await db.select({ operationId: agendaEventsTable.operationId }).from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
      operationId = ev?.operationId ?? null;
    }
    const isManagerInScope =
      operationId !== null && (await isOperationManager(user, operationId));
    if (!operationId || !isManagerInScope) {
      res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para apagar este Livro do Dia." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };

    // Encerramento lógico: a árvore e o Registro permanecem recuperáveis.
    await db.transaction(async (tx) => {
      const [cancelled] = await tx.update(dailyBooksTable)
        .set({ status: "CANCELLED", cancelledAt: new Date(), cancelledBy: userId, version: expectedVersion! + 1, updatedAt: new Date() })
        .where(and(eq(dailyBooksTable.id, id), eq(dailyBooksTable.version, expectedVersion!)))
        .returning();
      if (!cancelled) throw new VersionConflictError("Livro do Dia");
      await tx.update(dailyBookAssignmentsTable).set({ status: "REMOVED", updatedAt: new Date() })
        .where(and(eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)));
      await tx.update(dailyBookPositionsTable).set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt)));
      await tx.update(dailyBookBlocksTable).set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.supersededAt)));
      await tx.update(dailyBookScenesTable).set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)));
      await writeDailyBookAudit(id, userId, "archive", { status: book.status, version: book.version, snapshot: beforeSnapshot }, { status: "CANCELLED", version: cancelled.version, snapshot: beforeSnapshot }, tx);
    });
    res.json({ success: true });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível apagar o Livro do Dia. Tente de novo." });
  }
});

router.get("/daily-book", requireAuth, requireOrganization, async (req, res) => {
  const { agendaEventId, status, groupId, date, incluirCancelados } = req.query as Record<string, string | undefined>;
  const actor = req.user!;
  try {
    // Escopo de organização: só livros cujo evento pertence a uma operação da org.
    const conditions: ReturnType<typeof eq>[] = [
      eq(operationsTable.organizationId, actor.organizationId as string),
    ];
    if (agendaEventId) conditions.push(eq(dailyBooksTable.agendaEventId, agendaEventId));
    if (status) conditions.push(eq(dailyBooksTable.status, status as any));
    // O Livro marcado como "não ocorreu" some das listas gerais, mas a tela do dia precisa dele: é por ali que a
    // Administração o reabre. Sem isso, depois de recarregar, o show cancelado não tinha mais como ser alcançado.
    else if (incluirCancelados !== "1") conditions.push(ne(dailyBooksTable.status, "CANCELLED"));
    // "Os shows de hoje": filtra pela data do evento de agenda que originou o Livro.
    if (date) conditions.push(eq(agendaEventsTable.date, date));
    if (groupId) {
      const scaleRows = await db
        .select({ id: scalesTable.id })
        .from(scalesTable)
        .where(eq(scalesTable.groupId, groupId));
      const scaleIds = scaleRows.map((s) => s.id);
      if (scaleIds.length === 0) {
        res.json({ dailyBooks: [] });
        return;
      }
      conditions.push(inArray(dailyBooksTable.scaleId, scaleIds));
    }

    const rows = await db
      .select({
        book: dailyBooksTable,
        operationId: agendaEventsTable.operationId,
        operationName: operationsTable.name,
        eventTitle: agendaEventsTable.title,
        eventDate: agendaEventsTable.date,
        // Hora e local na lista: sem eles, dez livros do mesmo dia viram dez linhas iguais
        // (dois "Musical", um de cada local).
        eventStartTime: agendaEventsTable.startTime,
        locationName: locationsTable.name,
        showTitle: showBooksTable.title,
        showResponsibleId: showBooksTable.responsibleId,
      })
      .from(dailyBooksTable)
      .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
      .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
      .leftJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
      .leftJoin(locationsTable, eq(locationsTable.id, sql`coalesce(${showBooksTable.locationId}, ${agendaEventsTable.locationId})`))
      .where(and(...conditions));

    // Filtro de visibilidade por papel/operação (escopo por operação).
    const visibility = await Promise.all(
      rows.map((r) =>
        canViewDailyBook(
          actor,
          r.operationId,
          r.book.status,
          r.book.showBookId ? { id: r.book.showBookId, responsibleId: r.showResponsibleId } : null,
        ),
      ),
    );

    const visiveis = rows.filter((_, i) => visibility[i]);
    // Quando o show acontece, como a Escala diz: horários da Programação do local; sem eles, a hora da
    // Agenda; sem ela, as sessões do Livro do Show. Vazio quer dizer que nenhuma das três marca o show.
    const datas = [...new Set(visiveis.map((r) => String(r.eventDate).slice(0, 10)))];
    const daProgramacao = new Map<string, Map<string, { inicio: string; fim: string | null; rotulo: string }[]>>();
    for (const data of datas) {
      daProgramacao.set(data, await horariosDosShowsNaProgramacao(visiveis.filter((r) => String(r.eventDate).slice(0, 10) === data && !r.book.sessionId && r.book.showBookId).map((r) => r.book.showBookId!), data));
    }
    const sessoesComuns = new Map<string, string[]>();
    const horarios = await Promise.all(visiveis.map(async (r) => {
      const programacao = !r.book.sessionId && r.book.showBookId ? daProgramacao.get(String(r.eventDate).slice(0, 10))?.get(r.book.showBookId) ?? [] : [];
      if (programacao.length) return [...new Set(programacao.map((h) => h.inicio))];
      if (r.eventStartTime) return [r.eventStartTime.slice(0, 5)];
      if (r.book.sessionId || !r.book.showBookId) return [];
      const chave = `${r.book.showBookId}:${String(r.eventDate).slice(0, 10)}`;
      if (!sessoesComuns.has(chave)) sessoesComuns.set(chave, (await eligibleSessions(r.book.showBookId, String(r.eventDate).slice(0, 10), db, { separada: false })).map((x) => x.startTime.slice(0, 5)));
      return sessoesComuns.get(chave)!;
    }));

    const dailyBooks = visiveis
      .map((r, i) => ({
        ...r.book,
        horarios: horarios[i],
        operationId: r.operationId,
        operationName: r.operationName,
        eventTitle: r.eventTitle,
        eventDate: r.eventDate,
        showTitle: r.showTitle,
        sessionLabel: r.book.sessionId && r.eventStartTime ? r.eventStartTime.slice(0, 5) : null,
      }));

    res.json({ dailyBooks });
  } catch (err) {
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível listar os Livros do Dia. Tente de novo." });
  }
});

router.get("/daily-book/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const actor = req.user!;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;

    const ctx = await resolveDailyBookReadContext(actor, book);
    if (!ctx) {
      res.status(404).json({ error: "NAO_ENCONTRADO", message: "Evento do Livro do Dia não encontrado." });
      return;
    }
    if (!ctx.ok) {
      res.status(403).json({ error: "FORBIDDEN", message: "Livro do Dia fora do seu escopo" });
      return;
    }

    const liveTree = await resolveLiveTree(book);
    // Publicado continua preservado: quem não opera o livro (Elenco) vê a foto da última
    // publicação/republicação, não o que mudou depois — igual à Escala. Quem publica sempre vê
    // ao vivo, para decidir se há o que republicar.
    const published = book.status === "PUBLISHED" || book.status === "REPUBLISHED";
    const snapshotScenes = (book.snapshotJson as { scenes?: unknown[] } | null)?.scenes;
    const tree = (published && !ctx.seesLive && Array.isArray(snapshotScenes))
      ? (snapshotScenes as typeof liveTree)
      : liveTree;
    const currentSnapshot: VersionedSnapshot = { scenes: liveTree };
    res.json({
      dailyBook: {
        ...book,
        operationId: ctx.operationId,
        operationName: ctx.operationName,
        eventTitle: ctx.eventTitle,
        eventDate: ctx.eventDate,
        showTitle: ctx.showTitle,
        locationName: ctx.locationName,
        locationId: ctx.locationId,
        eventStartTime: ctx.eventStartTime,
        sessionLabel: ctx.sessionLabel,
        scenes: tree,
        sessionBlocks: await listSessionBlocks(id, book.showBookId, ctx.eventDate),
        // Horários que a Programação do local dá a este show neste dia (a Escala lê daí); as sessões acima seguem valendo para a formação.
        programacaoHoje: book.showBookId ? await horariosDoShowNaProgramacao(book.showBookId, ctx.eventDate) : [],
        currentSnapshot,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível buscar o Livro do Dia. Tente de novo." });
  }
});

router.get("/daily-book/:id/delta", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const actor = req.user!;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;

    const ctx = await resolveDailyBookReadContext(actor, book);
    if (!ctx) {
      res.status(404).json({ error: "NAO_ENCONTRADO", message: "Evento do Livro do Dia não encontrado." });
      return;
    }
    if (!ctx.ok) {
      res.status(403).json({ error: "FORBIDDEN", message: "Livro do Dia fora do seu escopo" });
      return;
    }

    // Ao vivo: o delta compara contra o último publicado/republicado, então uma folga marcada
    // depois (sem ninguém mexer à mão) também aparece como "há o que republicar" — não só troca manual.
    const currentTree = await resolveLiveTree(book);
    const currentSnapshot = { scenes: currentTree };
    const prevSnapshot = (book.snapshotJson as Record<string, unknown> | null) ?? null;
    const liveDelta = computeDelta(prevSnapshot, currentSnapshot);

    // If the stored snapshot is a legacy/empty placeholder, report no changes
    // rather than treating every live scene as a new addition.
    if (liveDelta.snapshotUnavailable) {
      res.json({
        version: book.version,
        status: book.status,
        liveDelta: null,
        hasLiveChanges: false,
        snapshotUnavailable: true,
        lastRepublishDelta: book.republishDeltaJson ?? null,
      });
      return;
    }

    res.json({
      version: book.version,
      status: book.status,
      liveDelta,
      hasLiveChanges: !liveDelta.isEmpty,
      lastRepublishDelta: book.republishDeltaJson ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível calcular as diferenças. Tente de novo." });
  }
});

/**
 * Diferenças de hoje contra o PADRÃO (o Livro do Show na data do evento) — não contra o
 * snapshot anterior do próprio Livro do Dia (isso é o `/delta`). Re-resolve o elenco ao vivo
 * com a mesma lógica de generate/regenerate, sem persistir nada, e compara contra a árvore
 * viva: cena/bloco/posição removidos hoje, e substituições/vagas por papel.
 */
async function buildPatternDiffRows(
  book: { id: string; status: string; agendaEventId: string; showBookId: string | null; scaleId: string | null },
  showBookId: string, operationId: string, dateISO: string,
) {
  const [currentTree, resolved] = await Promise.all([
    resolveLiveTree(book),
    resolveAssignmentsByRole(showBookId, operationId, dateISO, { dedupPerScene: true, eventId: book.agendaEventId }),
  ]);
  const { byRole, result } = resolved;
  const noteByRole = new Map<string, string>();
  for (const scene of result.scenes) {
    for (const block of scene.blocks) {
      for (const pos of block.positions) {
        const note = pos.lines.find((l) => l.note)?.note;
        if (note) noteByRole.set(pos.positionId, note);
      }
    }
  }
  const rows: { where: string; padrao: string; hoje: string; why: string }[] = [];
  for (const scene of currentTree) {
    for (const block of scene.blocks) {
      for (const position of block.positions) {
        const roleId = position.sourceRoleId;
        const rr = roleId ? byRole.get(roleId) : undefined;
        const patternNames = rr ? rr.people.map((p) => p.name) : [];
        const patternLabel = patternNames.length ? patternNames.join(", ") : "posição do padrão";
        const where = `${scene.name} · ${position.name}`;
        if (scene.isRemoved || block.isRemoved || position.isRemoved) {
          rows.push({
            where, padrao: patternLabel, hoje: "fora do dia",
            why: scene.isRemoved ? "Cena removida no ajuste do dia." : block.isRemoved ? "Bloco removido no ajuste do dia." : "Posição removida no ajuste do dia.",
          });
          continue;
        }
        const liveAssignments = (position.assignments ?? []).filter((a) => a.status !== "REMOVED");
        const liveNames = liveAssignments.map((a) => a.userName).filter((n): n is string => Boolean(n));
        const patternSet = new Set(patternNames);
        const liveSet = new Set(liveNames);
        const sameSet = patternSet.size === liveSet.size && [...patternSet].every((n) => liveSet.has(n));
        if (sameSet) continue;
        if (!patternNames.length && !liveNames.length) continue;
        const isOpenToday = liveAssignments.length > 0 && liveAssignments.every((a) => a.status === "OPEN");
        rows.push({
          where, padrao: patternLabel,
          hoje: isOpenToday ? "em aberto" : liveNames.length ? liveNames.join(", ") : "em aberto",
          why: noteByRole.get(roleId ?? "") ?? (isOpenToday ? "Sem substituto disponível." : "Substituição no ajuste do dia."),
        });
      }
    }
  }
  return rows;
}

router.get("/daily-book/:id/pattern-diff", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const actor = req.user!;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    const ctx = await resolveDailyBookReadContext(actor, book);
    if (!ctx) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Evento do Livro do Dia não encontrado." }); return; }
    if (!ctx.ok) { res.status(403).json({ error: "FORBIDDEN", message: "Livro do Dia fora do seu escopo" }); return; }
    if (!book.showBookId) { res.json({ diffs: [] }); return; }
    const diffs = await buildPatternDiffRows(book, book.showBookId, ctx.operationId, ctx.eventDate);
    res.json({ diffs, version: book.version, status: book.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao calcular diferenças do padrão. Tente de novo." });
  }
});

router.patch("/daily-book/:id/assignments/:assignmentId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const assignmentId = req.params.assignmentId as string;
  const { userId } = req.body;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    const [before] = await db
      .select()
      .from(dailyBookAssignmentsTable)
      .where(and(eq(dailyBookAssignmentsTable.id, assignmentId), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)))
      .limit(1);
    if (!before) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Alocação não encontrada." }); return; }
    // Supervisão troca só pessoas das áreas que supervisiona naquele local (a mesma regra da Escala). O responsável
    // pelo show e a Administração trocam qualquer pessoa. Vale para quem sai e para quem entra.
    const recusaDeArea = await recusaDeAreaNaTroca(book, req.user!, [before.userId, userId ?? null]);
    if (recusaDeArea) { res.status(403).json({ error: "ACESSO_NEGADO", message: recusaDeArea }); return; }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    // Restrição de horário e limite de shows do dia são proibição; passar delas à mão pede motivo escrito.
    const motivoDaExcecao = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
    const [eventoDoLivro] = userId ? await db.select({ operationId: agendaEventsTable.operationId, date: agendaEventsTable.date }).from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1) : [];
    const regrasPassadas = userId && eventoDoLivro && userId !== before.userId
      ? await verificarRegrasDeEscala({ eventId: book.agendaEventId, userId, date: eventoDoLivro.date, operationId: eventoDoLivro.operationId })
      : [];
    const [pessoaDaTroca] = regrasPassadas.length ? await db.select({ name: usersTable.name, areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1) : [];
    if (regrasPassadas.length && motivoDaExcecao.length < 3) {
      res.status(409).json({ error: codigoDaExcecao(regrasPassadas), message: `${pessoaDaTroca?.name ?? "A pessoa"} ${frasesDasRegras(regrasPassadas)}. Para escalar mesmo assim, escreva o motivo.`, pessoa: pessoaDaTroca?.name ?? null });
      return;
    }
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBookAssignmentsTable)
        // Troca direta também é mexida à mão: vira exceção do dia (manual=true), mesmo
        // esvaziando a vaga de propósito — deixar vago assim também não se recalcula sozinho.
        .set({ userId: userId ?? null, status: userId ? "ASSIGNED" : "OPEN", manual: true, updatedAt: new Date() })
        .where(and(eq(dailyBookAssignmentsTable.id, assignmentId), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)))
        .returning();
      if (!next) throw new VersionedResourceNotFoundError("Alocação");
      return next;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "troca de pessoa");
      await writeDailyBookAudit(id, actorId, "assignment_swap",
        { version: book.version, snapshot: beforeSnapshot, assignmentId, userId: before?.userId ?? null, status: before?.status ?? null },
        { version: book.version + 1, snapshot: afterSnapshot, assignmentId, userId: userId ?? null, status: next.status }, tx);
      if (regrasPassadas.length && eventoDoLivro) {
        await writeHistoryEvent({
          category: "DAILY_BOOK", action: "assignment_exception", title: "Pessoa escalada além de uma regra",
          narrative: `${pessoaDaTroca?.name ?? "A pessoa"} foi escalada na troca direta do Livro do Dia passando da regra (${frasesDasRegras(regrasPassadas)}); motivo: ${motivoDaExcecao}.`,
          entityType: "daily_book", entityId: id, actorId, actorType: "HUMAN", operationId: eventoDoLivro.operationId, orgId: req.user!.organizationId,
          beforeState: null, afterState: { assignmentId, userId },
          metadata: { regras: regrasPassadas.map((r) => r.regra), frases: regrasPassadas.map((r) => r.frase), motivo: motivoDaExcecao },
        }, tx as any);
        await avisarExcecaoDeRegra(tx as never, {
          operationId: eventoDoLivro.operationId, actorId, pessoaId: userId, pessoa: pessoaDaTroca?.name ?? "A pessoa", areaId: pessoaDaTroca?.areaId, onde: `Livro do Dia de ${eventoDoLivro.date}`,
          regras: regrasPassadas, motivo: motivoDaExcecao, entityType: "daily_book", entityId: id, dedupe: `${id}:${assignmentId}`,
        });
      }
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "assignment_swap", changedBy: actorId });
    res.json({ assignment: updated, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao atualizar alocação. Tente de novo." });
  }
});

/**
 * 09/10: ajuste na Escala de um bloco que vem de um Livro do Dia troca a pessoa no próprio Livro,
 * para Escala e Livro dizerem sempre a mesma coisa. Tirar abre a vaga da pessoa; colocar preenche a
 * primeira vaga aberta. Devolve false quando não há o que mudar no Livro (ex.: colocar alguém sem
 * vaga aberta, ou tirar quem só estava na Escala) — aí o ajuste fica só na Escala, como antes.
 */
export async function ajustarPessoaNoLivro(
  input: { dailyBookId: string; userId: string; action: "ADICIONAR" | "REMOVER"; actorId: string; assignmentId?: string | null },
  /**
   * Quando o ajuste faz parte de um lote, a transação do lote vem aqui: tudo é lido e gravado nela,
   * e os eventos (`eventBus`) não saem na hora — vão para `depoisDoCommit`, para quem chamou
   * emitir só depois de gravar. Sem isto, o ajuste abre a própria transação e emite no fim.
   */
  dentro?: { tx: typeof db; depoisDoCommit: (() => void)[] },
): Promise<boolean> {
  const exec = dentro?.tx ?? db;
  const [book] = await exec.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, input.dailyBookId)).limit(1);
  if (!book || book.status === "EXECUTED" || book.status === "CANCELLED") return false;
  const vivas = and(
    eq(dailyBookAssignmentsTable.dailyBookId, book.id), isNull(dailyBookAssignmentsTable.supersededAt),
    ne(dailyBookAssignmentsTable.status, "REMOVED"), eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
  );
  const daPessoa = await exec.select({ id: dailyBookAssignmentsTable.id }).from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .where(and(vivas, eq(dailyBookAssignmentsTable.userId, input.userId)));
  let alvo: { id: string }[];
  if (input.assignmentId) {
    // Vaga escolhida (Ajustar por personagem): troca exatamente esse personagem, não "a primeira vaga aberta".
    // Tirar só vale se a vaga é mesmo da pessoa; colocar vale em qualquer vaga viva do Livro (inclusive já ocupada: é a troca).
    const daVaga = await exec.select({ id: dailyBookAssignmentsTable.id, userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable)
      .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
      .where(and(vivas, eq(dailyBookAssignmentsTable.id, input.assignmentId)));
    alvo = input.action === "REMOVER" ? daVaga.filter((a) => a.userId === input.userId) : daVaga;
  } else if (input.action === "REMOVER") alvo = daPessoa;
  else {
    if (daPessoa.length) return true; // já está no Livro: nada a mudar
    alvo = await exec.select({ id: dailyBookAssignmentsTable.id }).from(dailyBookAssignmentsTable)
      .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
      .where(and(vivas, isNull(dailyBookAssignmentsTable.userId)))
      .orderBy(dailyBookPositionsTable.createdAt, dailyBookPositionsTable.id).limit(1);
  }
  if (!alvo.length) return false;
  const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(book.id, exec) };
  const aplicar = async (tx: typeof db) => {
    for (const a of alvo) {
      // Ajuste pela Escala é mexida à mão: a vaga vira exceção do dia e para de ser recalculada
      // sozinha (o Livro do Dia vivo só recalcula o que a gerência não tocou).
      await tx.update(dailyBookAssignmentsTable)
        .set(input.action === "REMOVER" ? { userId: null, status: "OPEN", manual: true, updatedAt: new Date() } : { userId: input.userId, status: "ASSIGNED", manual: true, updatedAt: new Date() })
        .where(eq(dailyBookAssignmentsTable.id, a.id));
    }
    return alvo;
  };
  const auditar = async (tx: typeof db) => {
    const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(book.id, tx) };
    await writeDailyBookAudit(book.id, input.actorId, "assignment_swap",
      { version: book.version, snapshot: beforeSnapshot, userId: input.userId, origem: "ajuste na Escala" },
      { version: book.version + 1, snapshot: afterSnapshot, userId: input.userId, action: input.action, assignmentIds: alvo.map((a) => a.id) }, tx);
  };
  const avisar = () => eventBus.emit("daily-book.updated", { dailyBookId: book.id, changeType: "assignment_swap", changedBy: input.actorId });
  if (dentro) {
    await mutateDailyBookEm(dentro.tx, book.id, book.version, aplicar, auditar);
    dentro.depoisDoCommit.push(avisar);
  } else {
    await mutateDailyBook(book.id, book.version, aplicar, auditar);
    avisar();
  }
  return true;
}

router.delete("/daily-book/:id/positions/:positionId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const positionId = req.params.positionId as string;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const [before] = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.id, positionId)).limit(1);
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBookPositionsTable)
        .set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookPositionsTable.id, positionId), eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt)))
        .returning();
      if (!next) throw new VersionedResourceNotFoundError("Posição");
      await tx
        .update(dailyBookAssignmentsTable)
        .set({ status: "REMOVED", updatedAt: new Date() })
        .where(and(eq(dailyBookAssignmentsTable.positionId, positionId), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)));
      return next;
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "posição tirada do dia");
      await writeDailyBookAudit(id, actorId, "position_removed",
        { version: book.version, snapshot: beforeSnapshot, positionId, name: before?.name ?? null },
        { version: book.version + 1, snapshot: afterSnapshot, positionId, isRemoved: true }, tx);
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "position_removed", changedBy: actorId });
    res.json({ position: updated, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao remover posição. Tente de novo." });
  }
});

router.delete("/daily-book/:id/scenes/:sceneId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const [before] = await db.select().from(dailyBookScenesTable).where(eq(dailyBookScenesTable.id, sceneId)).limit(1);
    const { updatedScene, affectedBlocks } = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [nextScene] = await tx
        .update(dailyBookScenesTable)
        .set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookScenesTable.id, sceneId), eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)))
        .returning();
      if (!nextScene) throw new VersionedResourceNotFoundError("Cena");

      const nextBlocks = await tx
        .update(dailyBookBlocksTable)
        .set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookBlocksTable.sceneId, sceneId), eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.supersededAt)))
        .returning();
      for (const block of nextBlocks) {
        await tx
          .update(dailyBookPositionsTable)
          .set({ isRemoved: true, updatedAt: new Date() })
          .where(and(eq(dailyBookPositionsTable.blockId, block.id), eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt)));
      }
      return { updatedScene: nextScene, affectedBlocks: nextBlocks };
    }, async (tx, _claimedBook, result) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "cena tirada do dia");
      await writeDailyBookAudit(id, actorId, "scene_removed",
        { version: book.version, snapshot: beforeSnapshot, sceneId, name: before?.name ?? null },
        { version: book.version + 1, snapshot: afterSnapshot, sceneId, isRemoved: true, cascadedBlocks: result.affectedBlocks.length }, tx);
    });

    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "scene_removed", changedBy: actorId });
    res.json({ scene: updatedScene, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível remover a cena. Tente de novo." });
  }
});

router.delete("/daily-book/:id/blocks/:blockId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const blockId = req.params.blockId as string;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const [before] = await db.select().from(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.id, blockId)).limit(1);
    const { updatedBlock, affectedPositions } = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [nextBlock] = await tx
        .update(dailyBookBlocksTable)
        .set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookBlocksTable.id, blockId), eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.supersededAt)))
        .returning();
      if (!nextBlock) throw new VersionedResourceNotFoundError("Bloco");
      const nextPositions = await tx
        .update(dailyBookPositionsTable)
        .set({ isRemoved: true, updatedAt: new Date() })
        .where(and(eq(dailyBookPositionsTable.blockId, blockId), eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt)))
        .returning();
      return { updatedBlock: nextBlock, affectedPositions: nextPositions };
    }, async (tx, _claimedBook, result) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "bloco tirado do dia");
      await writeDailyBookAudit(id, actorId, "block_removed",
        { version: book.version, snapshot: beforeSnapshot, blockId, name: before?.name ?? null },
        { version: book.version + 1, snapshot: afterSnapshot, blockId, isRemoved: true, cascadedPositions: result.affectedPositions.length }, tx);
    });

    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "block_removed", changedBy: actorId });
    res.json({ block: updatedBlock, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível remover o bloco. Tente de novo." });
  }
});

// ── Restauração (undo soft delete) ──────────────────────────────────────────

router.patch("/daily-book/:id/scenes/:sceneId/restore", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const { updatedScene, restoredBlocks } = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [nextScene] = await tx
        .update(dailyBookScenesTable)
        .set({ isRemoved: false, updatedAt: new Date() })
        .where(and(eq(dailyBookScenesTable.id, sceneId), eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)))
        .returning();
      if (!nextScene) throw new VersionedResourceNotFoundError("Cena");
      const nextBlocks = await tx
        .update(dailyBookBlocksTable)
        .set({ isRemoved: false, updatedAt: new Date() })
        .where(and(eq(dailyBookBlocksTable.sceneId, sceneId), eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.supersededAt), eq(dailyBookBlocksTable.isRemoved, true)))
        .returning();
      for (const block of nextBlocks) {
        const positions = await tx
          .update(dailyBookPositionsTable)
          .set({ isRemoved: false, updatedAt: new Date() })
          .where(and(eq(dailyBookPositionsTable.blockId, block.id), eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt), eq(dailyBookPositionsTable.isRemoved, true)))
          .returning();
        for (const pos of positions) {
          await tx
            .update(dailyBookAssignmentsTable)
            .set({ status: "OPEN", updatedAt: new Date() })
            .where(and(eq(dailyBookAssignmentsTable.positionId, pos.id), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt), eq(dailyBookAssignmentsTable.status, "REMOVED")));
        }
      }
      return { updatedScene: nextScene, restoredBlocks: nextBlocks };
    }, async (tx, _claimedBook, result) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "cena restaurada");
      await writeDailyBookAudit(id, actorId, "scene_restored",
        { version: book.version, snapshot: beforeSnapshot, sceneId, isRemoved: true },
        { version: book.version + 1, snapshot: afterSnapshot, sceneId, isRemoved: false, restoredBlocks: result.restoredBlocks.length }, tx);
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "scene_restored", changedBy: actorId });
    res.json({ scene: updatedScene, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível restaurar a cena. Tente de novo." });
  }
});

router.patch("/daily-book/:id/blocks/:blockId/restore", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const blockId = req.params.blockId as string;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const { updatedBlock, restoredPositions } = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [nextBlock] = await tx
        .update(dailyBookBlocksTable)
        .set({ isRemoved: false, updatedAt: new Date() })
        .where(and(eq(dailyBookBlocksTable.id, blockId), eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.supersededAt)))
        .returning();
      if (!nextBlock) throw new VersionedResourceNotFoundError("Bloco");
      const nextPositions = await tx
        .update(dailyBookPositionsTable)
        .set({ isRemoved: false, updatedAt: new Date() })
        .where(and(eq(dailyBookPositionsTable.blockId, blockId), eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt), eq(dailyBookPositionsTable.isRemoved, true)))
        .returning();
      for (const pos of nextPositions) {
        await tx
          .update(dailyBookAssignmentsTable)
          .set({ status: "OPEN", updatedAt: new Date() })
          .where(and(eq(dailyBookAssignmentsTable.positionId, pos.id), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt), eq(dailyBookAssignmentsTable.status, "REMOVED")));
      }
      return { updatedBlock: nextBlock, restoredPositions: nextPositions };
    }, async (tx, _claimedBook, result) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "bloco restaurado");
      await writeDailyBookAudit(id, actorId, "block_restored",
        { version: book.version, snapshot: beforeSnapshot, blockId, isRemoved: true },
        { version: book.version + 1, snapshot: afterSnapshot, blockId, isRemoved: false, restoredPositions: result.restoredPositions.length }, tx);
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "block_restored", changedBy: actorId });
    res.json({ block: updatedBlock, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível restaurar o bloco. Tente de novo." });
  }
});

router.patch("/daily-book/:id/positions/:positionId/restore", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const positionId = req.params.positionId as string;
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updatedPosition = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [nextPosition] = await tx
        .update(dailyBookPositionsTable)
        .set({ isRemoved: false, updatedAt: new Date() })
        .where(and(eq(dailyBookPositionsTable.id, positionId), eq(dailyBookPositionsTable.dailyBookId, id), isNull(dailyBookPositionsTable.supersededAt)))
        .returning();
      if (!nextPosition) throw new VersionedResourceNotFoundError("Posição");
      await tx
        .update(dailyBookAssignmentsTable)
        .set({ status: "OPEN", updatedAt: new Date() })
        .where(and(eq(dailyBookAssignmentsTable.positionId, positionId), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt), eq(dailyBookAssignmentsTable.status, "REMOVED")));
      return nextPosition;
    }, async (tx, _claimedBook, _nextPosition) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "posição restaurada");
      await writeDailyBookAudit(id, actorId, "position_restored",
        { version: book.version, snapshot: beforeSnapshot, positionId, isRemoved: true },
        { version: book.version + 1, snapshot: afterSnapshot, positionId, isRemoved: false }, tx);
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "position_restored", changedBy: actorId });
    res.json({ position: updatedPosition, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao restaurar posição. Tente de novo." });
  }
});

router.patch("/daily-book/:id/scenes/reorder", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const { scenes } = req.body as { scenes: { id: string; order: number }[] };
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  if (!Array.isArray(scenes)) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "scenes deve ser um array de {id, order}." });
    return;
  }
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    await mutateDailyBook(id, expectedVersion, async (tx) => {
      for (const s of scenes) {
        await tx
          .update(dailyBookScenesTable)
          .set({ order: s.order, updatedAt: new Date() })
          .where(and(eq(dailyBookScenesTable.id, s.id), eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)));
      }
      return true;
    }, async (tx, _claimedBook, _result) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await writeDailyBookAudit(id, actorId, "scenes_reordered",
        { version: book.version, snapshot: beforeSnapshot },
        { version: book.version + 1, snapshot: afterSnapshot, scenes }, tx);
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "scenes_reordered", changedBy: actorId });
    res.json({ success: true, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível reordenar as cenas. Tente de novo." });
  }
});

/**
 * Aplica uma Formação da biblioteca a uma cena, só para hoje (nunca no Livro do Show), com
 * Registro. Leva as pessoas junto: posição viva cujo código de slot (nome) existe na formação
 * continua como está, com quem já estava nela. Só nasce vaga (OPEN) o slot da formação sem
 * correspondência, e sai do dia (soft-remove) a posição viva que a formação não tem. Ninguém é
 * escalado por esta ação — só permanece quem já estava escalado na cena hoje.
 */
router.post("/daily-book/:id/scenes/:sceneId/apply-formation", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const { formationId } = req.body ?? {};
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "ESTADO_INVALIDO", message: "Livro em estado terminal não pode ser alterado." });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    if (typeof formationId !== "string" || !formationId) {
      res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "formationId é obrigatório." });
      return;
    }
    const [scene] = await db.select().from(dailyBookScenesTable)
      .where(and(eq(dailyBookScenesTable.id, sceneId), eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)))
      .limit(1);
    if (!scene) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Cena não encontrada." }); return; }
    const [formation] = await db.select().from(formationsTable)
      .where(and(eq(formationsTable.id, formationId), eq(formationsTable.active, true)))
      .limit(1);
    if (!formation) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Formação não encontrada." }); return; }
    const formationPositions = Array.isArray(formation.positions)
      ? (formation.positions as { role?: string; function?: string; roleId?: unknown }[])
      : [];
    const slotOf = (position: { role?: string; function?: string }, index: number) => position.role || position.function || `Posição ${index + 1}`;
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const result = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const liveBlocks = await tx.select().from(dailyBookBlocksTable).where(and(
        eq(dailyBookBlocksTable.dailyBookId, id),
        eq(dailyBookBlocksTable.sceneId, sceneId),
        isNull(dailyBookBlocksTable.supersededAt),
        isNotSessionBlock,
      ));
      let targetBlockId: string;
      let livePositions: (typeof dailyBookPositionsTable.$inferSelect)[] = [];
      if (liveBlocks.length > 0) {
        targetBlockId = liveBlocks.slice().sort((a, b) => a.order - b.order)[0]!.id;
        livePositions = await tx.select().from(dailyBookPositionsTable).where(and(
          inArray(dailyBookPositionsTable.blockId, liveBlocks.map((block) => block.id)),
          eq(dailyBookPositionsTable.isRemoved, false),
          isNull(dailyBookPositionsTable.supersededAt),
        ));
      } else {
        const [newBlock] = await tx.insert(dailyBookBlocksTable).values({
          dailyBookId: id, sceneId, name: formation.name, order: 0,
        }).returning();
        targetBlockId = newBlock!.id;
      }
      // Casa slot a slot pelo código (nome da posição). Cada posição viva casa uma vez só.
      const unmatched = [...livePositions];
      const kept: string[] = [];
      const toCreate: { name: string; sourceRoleId: string | null }[] = [];
      formationPositions.forEach((position, index) => {
        const slot = slotOf(position, index);
        const at = unmatched.findIndex((live) => live.name === slot);
        if (at >= 0) { kept.push(unmatched[at]!.id); unmatched.splice(at, 1); return; }
        const roleId = typeof position.roleId === "string" && UUID.test(position.roleId) ? position.roleId : null;
        toCreate.push({ name: slot, sourceRoleId: roleId });
      });
      if (unmatched.length > 0) {
        const removedIds = unmatched.map((p) => p.id);
        await tx.update(dailyBookPositionsTable).set({ isRemoved: true, updatedAt: new Date() }).where(inArray(dailyBookPositionsTable.id, removedIds));
        await tx.update(dailyBookAssignmentsTable)
          .set({ status: "REMOVED", updatedAt: new Date() })
          .where(and(inArray(dailyBookAssignmentsTable.positionId, removedIds), isNull(dailyBookAssignmentsTable.supersededAt)));
      }
      for (const position of toCreate) {
        const [dbPosition] = await tx.insert(dailyBookPositionsTable).values({
          dailyBookId: id, blockId: targetBlockId, name: position.name, minimumCoverage: 1, sourceRoleId: position.sourceRoleId,
        }).returning();
        await tx.insert(dailyBookAssignmentsTable).values({
          dailyBookId: id, positionId: dbPosition!.id, sceneId, userId: null, status: "OPEN",
        });
      }
      await tx.update(formationsTable).set({
        timesUsed: sql`${formationsTable.timesUsed} + 1`, lastUsedAt: new Date(), updatedAt: new Date(),
      }).where(eq(formationsTable.id, formation.id));
      return { positionsCreated: toCreate.length, positionsKept: kept.length, positionsRemoved: unmatched.length };
    }, async (tx, _claimedBook, next) => {
      const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id, tx) };
      await marcarEscalaAlteradaPeloLivro(tx as unknown as typeof db, id, actorId, "formação aplicada só hoje");
      await writeDailyBookAudit(id, actorId, "formation_applied_today",
        { version: book.version, snapshot: beforeSnapshot, sceneId },
        { version: book.version + 1, snapshot: afterSnapshot, sceneId, formationId: formation.id, formationName: formation.name, ...next }, tx);
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "formation_applied_today", changedBy: actorId });
    res.json({ scenes: await buildDailyBookTree(id), version: book.version + 1, ...result });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao aplicar formação para hoje. Tente de novo." });
  }
});

/**
 * "Guardar no padrão": guarda a formação de HOJE — as posições vivas da cena no Livro do Dia,
 * já ajustadas — como nova variante na biblioteca daquela cena do Livro do Show. É para isso
 * que a biblioteca existe: reaproveitar um desfalque que se repete. Não muda o Livro do Dia nem
 * o Livro do Show; grava a Formação e o Registro na mesma transação.
 */
router.post("/daily-book/:id/scenes/:sceneId/save-formation", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const actorId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    if (!name) { res.status(400).json({ error: "NAME_REQUIRED", message: "Nome obrigatório para salvar a Formação." }); return; }
    const [scene] = await db.select().from(dailyBookScenesTable)
      .where(and(eq(dailyBookScenesTable.id, sceneId), eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)))
      .limit(1);
    if (!scene) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Cena não encontrada." }); return; }
    if (!scene.sourceSceneId || !book.showBookId) { res.status(409).json({ error: "SCENE_WITHOUT_PATTERN", message: "Esta cena não veio de um Livro do Show — não há biblioteca para guardar a formação." }); return; }
    if (scene.isRemoved) { res.status(409).json({ error: "SCENE_REMOVED", message: "A cena está fora do dia — restaure antes de guardar a formação." }); return; }

    const blocks = await db.select().from(dailyBookBlocksTable).where(and(
      eq(dailyBookBlocksTable.dailyBookId, id), eq(dailyBookBlocksTable.sceneId, sceneId),
      isNull(dailyBookBlocksTable.supersededAt), eq(dailyBookBlocksTable.isRemoved, false), isNotSessionBlock,
    ));
    const blockOrder = new Map(blocks.map((block) => [block.id, block.order]));
    const livePositions = blocks.length > 0
      ? (await db.select().from(dailyBookPositionsTable).where(and(
          inArray(dailyBookPositionsTable.blockId, blocks.map((block) => block.id)),
          eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
        ))).sort((a, b) => (blockOrder.get(a.blockId ?? "") ?? 0) - (blockOrder.get(b.blockId ?? "") ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())
      : [];
    if (livePositions.length === 0) { res.status(409).json({ error: "EMPTY_FORMATION", message: "A cena não tem posição viva hoje." }); return; }

    // Coordenada, cor e lado vêm do papel de origem no Livro do Show; o código do slot é o de hoje.
    const roleIds = livePositions.map((p) => p.sourceRoleId).filter((roleId): roleId is string => Boolean(roleId));
    const roles = roleIds.length > 0
      ? await db.select({ role: showBookRolesTable, zone: showBookBlocksTable.zone }).from(showBookRolesTable)
          .leftJoin(showBookBlocksTable, eq(showBookRolesTable.blockId, showBookBlocksTable.id))
          .where(inArray(showBookRolesTable.id, roleIds))
      : [];
    const roleById = new Map(roles.map((row) => [row.role.id, row]));
    const sideOf = (zone: string | null | undefined) => {
      const normalized = (zone ?? "").toLocaleUpperCase("pt-BR");
      return normalized === "BACKSTAGE LEFT" ? "BL" : normalized === "BACKSTAGE RIGHT" ? "BR" : "PER";
    };
    const positions = livePositions.map((position) => {
      const origin = position.sourceRoleId ? roleById.get(position.sourceRoleId) : undefined;
      const base = origin?.role.positionJson && Object.keys(origin.role.positionJson).length > 0 ? origin.role.positionJson as Record<string, unknown> : {};
      return {
        ...base,
        role: position.name,
        function: origin?.role.tagsJson?.[0] ?? position.name,
        coordinate: base.coordinate ?? null,
        roleId: position.sourceRoleId ?? null,
        ...(origin ? { side: sideOf(origin.zone) } : {}),
      };
    });

    const [showRow] = await db.select({ operationId: showBooksTable.operationId }).from(showBooksTable).where(eq(showBooksTable.id, book.showBookId)).limit(1);
    const created = await db.transaction(async (tx) => {
      const [formation] = await tx.insert(formationsTable).values({
        name, peopleCount: positions.length, positions, showId: book.showBookId, sceneId: scene.sourceSceneId,
        organizationId: req.user!.organizationId, active: true,
      }).returning();
      if (!formation) throw new Error("Não foi possível salvar a Formação.");
      await tx.insert(historyEventsTable).values({
        orgId: req.user!.organizationId, category: "OPERATIONAL_CHANGE", title: "Formação salva do dia",
        narrative: `A Formação ${name} foi salva a partir da cena ${scene.name}, como estava no Livro do Dia.`,
        entityType: "formation", entityId: formation.id, actorId, actorType: "HUMAN", operationId: showRow?.operationId ?? null,
        action: "formation.created", beforeState: null,
        afterState: { id: formation.id, name, peopleCount: formation.peopleCount, positions, showId: formation.showId, sceneId: formation.sceneId, dailyBookId: id, dailyBookSceneId: sceneId },
      });
      await writeDailyBookAudit(id, actorId, "formation_saved_from_day", null,
        { sceneId, formationId: formation.id, formationName: name, peopleCount: formation.peopleCount }, tx as unknown as typeof db);
      return formation;
    });
    res.status(201).json({ formation: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao guardar a formação do dia. Tente de novo." });
  }
});

export default router;
