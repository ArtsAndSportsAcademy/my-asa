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
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { canOperateDailyBook, canViewDailyBook, isOperationManager, type ShowResponsibilityRef } from "../lib/show-responsibility.js";
import { eventBus } from "../lib/event-bus.js";
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
  type RoleResolution,
  type RotationWinners,
} from "../services/line-resolver.js";
import { detectDailyBookConflicts } from "../services/schedule-conflicts.js";
import { escalaDoDiaDoLivro, escalaPublicada, marcarEscalaAlteradaPeloLivro } from "../services/escala-dia.js";
import { isNotSessionBlock, listSessionBlocks, syncSessionBlocks } from "../services/session-blocks.js";

const router: IRouter = Router();
async function detectGeneratedDailyBookConflicts(dailyBookId: string, date: string) {
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
  book: { agendaEventId: string; showBookId: string | null; status: string },
): Promise<{
  ok: boolean;
  operationId: string;
  operationName: string;
  eventTitle: string;
  eventDate: string;
  showTitle: string | null;
} | null> {
  const [ev] = await db
    .select({
      operationId: agendaEventsTable.operationId,
      operationName: operationsTable.name,
      eventTitle: agendaEventsTable.title,
      eventDate: agendaEventsTable.date,
      organizationId: operationsTable.organizationId,
    })
    .from(agendaEventsTable)
    .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
    .where(eq(agendaEventsTable.id, book.agendaEventId))
    .limit(1);
  if (!ev) return null;

  let showTitle: string | null = null;
  let showResponsibleId: string | null = null;
  if (book.showBookId) {
    const [sb] = await db
      .select({ title: showBooksTable.title, responsibleId: showBooksTable.responsibleId })
      .from(showBooksTable)
      .where(eq(showBooksTable.id, book.showBookId))
      .limit(1);
    showTitle = sb?.title ?? null;
    showResponsibleId = sb?.responsibleId ?? null;
  }

  const ok =
    ev.organizationId === (actor.organizationId as string) &&
    (await canViewDailyBook(
      actor as any,
      ev.operationId,
      book.status,
      book.showBookId ? { id: book.showBookId, responsibleId: showResponsibleId } : null,
    ));

  return {
    ok,
    operationId: ev.operationId,
    operationName: ev.operationName,
    eventTitle: ev.eventTitle,
    eventDate: ev.eventDate,
    showTitle,
  };
}

async function getDailyBookOrFail(id: string, res: any) {
  const [book] = await db
    .select()
    .from(dailyBooksTable)
    .where(eq(dailyBooksTable.id, id))
    .limit(1);
  if (!book) {
    res.status(404).json({ error: "Livro do Dia não encontrado" });
    return null;
  }
  return book;
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
    res.status(403).json({ error: "Forbidden", message: "Acesso restrito ao responsável do show, capitão delegado ou admin" });
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
        )).map(liveRow)
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
  return db.transaction(async (tx) => {
    const [claimedBook] = await tx
      .update(dailyBooksTable)
      .set({ version: expectedVersion + 1, updatedAt: new Date() })
      .where(and(eq(dailyBooksTable.id, dailyBookId), eq(dailyBooksTable.version, expectedVersion)))
      .returning();
    if (!claimedBook) throw new VersionConflictError("Livro do Dia");
    const typedTx = tx as unknown as typeof db;
    const result = await mutate(typedTx, claimedBook);
    if (afterMutate) await afterMutate(typedTx, claimedBook, result);
    return result;
  });
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
    res.status(404).json({ error: "Livro do Dia não encontrado" });
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
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
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
  const rr = byRole.get(roleId);
  const fromResolver = !!(rr && rr.hasLines && rr.people.length > 0);
  const planned = planRoleAssignments(rr, roleId, allocationMap, minimumCoverage);
  let finalPlanned = planned;
  if (sceneKey && !fromResolver) {
    let set = assignedByScene.get(sceneKey);
    if (!set) { set = new Set<string>(); assignedByScene.set(sceneKey, set); }
    finalPlanned = dedupAssignmentsForScene(planned, set);
  }
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
}) {
  const { showBookId, date, scaleId, actorId, organizationId, reason = null } = input;
  const [showBook] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, showBookId)).limit(1);
  if (!showBook) throw new Error("Show Book não encontrado");

  let [event] = await db.select().from(agendaEventsTable).where(and(
    eq(agendaEventsTable.showBookId, showBookId),
    eq(agendaEventsTable.date, date),
    eq(agendaEventsTable.operationId, showBook.operationId),
  )).limit(1);
  if (!event) {
    [event] = await db.insert(agendaEventsTable).values({
      operationId: showBook.operationId,
      showBookId,
      type: "SHOW",
      title: showBook.title,
      date,
      status: "CONFIRMED",
      visibility: "MANAGEMENT",
      createdBy: actorId,
    }).returning();
  }
  if (!event) throw new Error("Não foi possível preparar o evento interno do Livro do Dia");

  // Livro cancelado (apagado) fica no histórico, mas não impede gerar o dia de novo.
  const [existing] = await db.select().from(dailyBooksTable).where(and(
    eq(dailyBooksTable.agendaEventId, event.id),
    eq(dailyBooksTable.showBookId, showBookId),
    ne(dailyBooksTable.status, "CANCELLED"),
  )).limit(1);
  if (existing) {
    if (existing.scaleId && existing.scaleId !== scaleId) {
      throw new Error("Este Livro do Dia já pertence a outra Escala");
    }
    const dailyBook = existing.scaleId
      ? existing
      : (await db.update(dailyBooksTable).set({ scaleId, updatedAt: new Date() }).where(eq(dailyBooksTable.id, existing.id)).returning())[0]!;
    return { dailyBook, generated: false, conflicts: await detectGeneratedDailyBookConflicts(dailyBook.id, date) };
  }

  const [scenes, blocks, roles, initialKeyframes] = await Promise.all([
    db.select().from(showBookScenesTable).where(and(eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.active, true))).orderBy(showBookScenesTable.order),
    db.select().from(showBookBlocksTable).where(and(eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true))).orderBy(showBookBlocksTable.order),
    db.select().from(showBookRolesTable).where(and(eq(showBookRolesTable.showBookId, showBookId), eq(showBookRolesTable.active, true))).orderBy(showBookRolesTable.order, showBookRolesTable.id),
    db.select({ id: showBookKeyframesTable.id, sceneId: showBookKeyframesTable.sceneId, markerPositions: showBookKeyframesTable.markerPositions })
      .from(showBookKeyframesTable).where(and(eq(showBookKeyframesTable.type, "inicial"), eq(showBookKeyframesTable.active, true))),
  ]);
  const initialKeyframeByScene = new Map(initialKeyframes.map((frame) => [frame.sceneId, frame]));
  const allocations = await db.select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
    .from(scaleAllocationsTable).where(and(eq(scaleAllocationsTable.scaleId, scaleId), eq(scaleAllocationsTable.agendaEventId, event.id), eq(scaleAllocationsTable.active, true)));
  const allocationMap: Record<string, string | null> = {};
  allocations.forEach((allocation) => { if (allocation.positionId) allocationMap[allocation.positionId] = allocation.userId ?? null; });
  const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, date, { dedupPerScene: true });
  const rotationWinners = collectRotationWinners(result);

  let positionsCount = 0;
  const dailyBook = await db.transaction(async (tx) => {
    const [created] = await tx.insert(dailyBooksTable).values({
      agendaEventId: event!.id,
      scaleId,
      showBookId,
      status: "DRAFT",
      version: 1,
      snapshotJson: {} as any,
      generatedAt: new Date(),
      generatedBy: actorId,
    }).returning();
    if (!created) throw new Error("Não foi possível criar o Livro do Dia");
    const sceneIdMap: Record<string, string> = {};
    for (const scene of scenes) {
      const [copy] = await tx.insert(dailyBookScenesTable).values({ dailyBookId: created.id, name: scene.name, order: scene.order, sourceSceneId: scene.id, sourceKeyframeId: initialKeyframeByScene.get(scene.id)?.id ?? null }).returning();
      sceneIdMap[scene.id] = copy!.id;
    }
    const blockIdMap: Record<string, string> = {};
    for (const block of blocks) {
      const [copy] = await tx.insert(dailyBookBlocksTable).values({
        dailyBookId: created.id, name: block.name, order: block.order, startTime: block.startTime, endTime: block.endTime,
        sourceBlockId: block.id, sceneId: block.sceneId ? sceneIdMap[block.sceneId] ?? null : null,
      }).returning();
      blockIdMap[block.id] = copy!.id;
    }
    const sessionSync = await syncSessionBlocks(created.id, showBookId, date, tx as unknown as typeof db);
    const sceneByBlock: Record<string, string | null> = {};
    blocks.forEach((block) => { sceneByBlock[block.id] = block.sceneId ?? null; });
    const assignedByScene = buildSceneOccupancyFromResolver(roles, sceneByBlock, byRole);
    for (const role of roles) {
      const [position] = await tx.insert(dailyBookPositionsTable).values({
        dailyBookId: created.id, name: role.name, minimumCoverage: role.minimumCoverage,
        sourceRoleId: role.id, blockId: role.blockId ? blockIdMap[role.blockId] ?? null : null,
      }).returning();
      positionsCount++;
      const sourceSceneId = role.blockId ? sceneByBlock[role.blockId] ?? null : null;
      await createAssignmentsForRole(created.id, position!.id, role.id, byRole, allocationMap, sourceSceneId, assignedByScene, role.minimumCoverage, sourceSceneId ? sceneIdMap[sourceSceneId] ?? null : null, tx as unknown as typeof db);
    }
    const fullTree = await buildDailyBookTree(created.id, tx as unknown as typeof db);
    const [updated] = await tx.update(dailyBooksTable).set({ snapshotJson: { scenes: fullTree, rotationWinners } as any }).where(eq(dailyBooksTable.id, created.id)).returning();
    await writeHistoryEvent({
      category: "DAILY_BOOK", action: "generated", title: "Livro do Dia gerado",
      narrative: `O Livro do Dia foi gerado para ${date} a partir da Escala em rascunho.`,
      entityType: "daily_book", entityId: created.id, actorId, actorType: "HUMAN", operationId: event!.operationId, orgId: organizationId,
      beforeState: null, afterState: updated,
      metadata: { agendaEventId: event!.id, showBookId, scaleId, reason, sessionIds: sessionSync.sessionIds, sessionBlockIds: sessionSync.createdBlockIds },
    }, tx as any);
    return updated!;
  });
  eventBus.emit("daily-book.created", { dailyBookId: dailyBook.id, agendaEventId: event.id, scaleId, version: 1 });
  eventBus.emit("daily-book.generated", { dailyBookId: dailyBook.id, agendaEventId: event.id, version: 1, scenesCount: scenes.length, positionsCount });
  return { dailyBook, generated: true, conflicts: await detectGeneratedDailyBookConflicts(dailyBook.id, date) };
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
    res.status(400).json({ error: "Informe o Livro do Show e a data" });
    return;
  }
  // Não aceitamos payload ambíguo: ou modo por data, ou modo legado por evento.
  if (bodyAgendaEventId && (bodyShowBookId || bodyDate)) {
    res.status(400).json({ error: "Envie apenas o Livro do Show + data, ou apenas um evento — não ambos" });
    return;
  }
  try {
    let agendaEventId: string = bodyAgendaEventId ?? "";

    if (!agendaEventId) {
      const [sb] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, bodyShowBookId)).limit(1);
      if (!sb) { res.status(404).json({ error: "Show Book não encontrado" }); return; }

      if (!(await canOperateDailyBook(user, sb.operationId, { id: sb.id, responsibleId: sb.responsibleId }))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas o responsável por este show, um capitão delegado ou um admin podem gerar o Livro do Dia" });
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
        .select({ operationId: agendaEventsTable.operationId, showBookId: agendaEventsTable.showBookId })
        .from(agendaEventsTable)
        .where(eq(agendaEventsTable.id, agendaEventId))
        .limit(1);
      if (!ev) { res.status(404).json({ error: "Evento não encontrado" }); return; }
      const loaded = ev.showBookId ? await loadShowRef(ev.showBookId) : null;
      if (!(await canOperateDailyBook(user, ev.operationId, loaded?.ref ?? null))) {
        res.status(403).json({ error: "Forbidden", message: "Apenas o responsável por este show, um capitão delegado ou um admin podem gerar o Livro do Dia" });
        return;
      }
    }

    const [event] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, agendaEventId)).limit(1);
    if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }

    const showBookId = event.showBookId;
    if (!showBookId) { res.status(400).json({ error: "Evento não tem Show Book associado" }); return; }

    const [showBook] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, showBookId)).limit(1);
    if (!showBook) { res.status(404).json({ error: "Show Book não encontrado" }); return; }

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
    const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, event.date, { dedupPerScene: true });
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
    res.status(500).json({ error: "Erro ao gerar Livro do Dia" });
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
        res.status(403).json({ error: "Forbidden", message: "Apenas o responsável por este show, um capitão delegado ou um admin podem regenerar o Livro do Dia" });
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
      res.status(409).json({ error: blocked[book.status] ?? "Só um Livro em rascunho pode ser regenerado." });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };

    const [event] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
    if (!event || !event.showBookId) { res.status(400).json({ error: "Evento ou Show Book não encontrado" }); return; }

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
    const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, event.date, { dedupPerScene: true });
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
    res.status(500).json({ error: "Erro ao regenerar Livro do Dia" });
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
        res.status(403).json({ error: "Forbidden", message: "Acesso restrito ao responsável do show, capitão delegado ou admin" }); return;
      }
    }
    if (!["DRAFT"].includes(book.status)) {
      res.status(409).json({ error: `Livro em status ${book.status} não pode ser publicado diretamente` });
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
      const [next] = await tx
        .update(dailyBooksTable)
        .set({ status: "PUBLISHED", publishComment, publishedAt: new Date(), publishedBy: userId })
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
    // notify assigned users
    db.select({ userId: dailyBookAssignmentsTable.userId })
      .from(dailyBookAssignmentsTable)
      .where(and(eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)))
      .then((rows) => {
        const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
        notifyMany(userIds, {
          type: "book.published",
          title: "Livro do Dia publicado",
          message: `O Livro do Dia (v${updated!.version}) foi publicado com suas atribuições.`,
          priority: "NORMAL",
          category: "book",
          entityType: "daily_book",
          entityId: id,
          actionUrl: `/(tabs)/daily-book`,
        });
      })
      .catch(() => {});
    res.json({ dailyBook: updated });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "Erro ao publicar Livro do Dia" });
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
        res.status(403).json({ error: "Forbidden", message: "Acesso restrito ao responsável do show, capitão delegado ou admin" }); return;
      }
    }
    if (!["PUBLISHED", "REPUBLISHED"].includes(book.status)) {
      res.status(409).json({ error: "Somente livros PUBLICADOS ou REPUBLICADOS podem ser republicados" });
      return;
    }

    const currentTree = await buildDailyBookTree(id);
    const currentSnapshot = { scenes: currentTree };
    const prevSnapshot = (book.snapshotJson as Record<string, unknown>) ?? {};
    const delta = computeDelta(prevSnapshot, currentSnapshot);

    if (delta.isEmpty) {
      res.status(409).json({ error: "Nenhuma alteração detectada. Delta está vazio." });
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
    // notify assigned users of changes
    db.select({ userId: dailyBookAssignmentsTable.userId })
      .from(dailyBookAssignmentsTable)
      .where(and(eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)))
      .then((rows) => {
        const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
        notifyMany(userIds, {
          type: "book.republished",
          title: "Livro do Dia atualizado",
          message: `O Livro do Dia foi republicado (v${previousVersion} → v${newVersion}). Verifique as alterações.`,
          priority: "IMPORTANT",
          category: "book",
          entityType: "daily_book",
          entityId: id,
          actionUrl: `/(tabs)/daily-book`,
        });
      })
      .catch(() => {});
    res.json({ dailyBook: updated, delta });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    console.error(err);
    res.status(500).json({ error: "Erro ao republicar Livro do Dia" });
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
      res.status(409).json({ error: "Somente livros publicados podem ser executados" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBooksTable)
        .set({ status: "EXECUTED", executedAt: new Date(), executedBy: userId })
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
    res.status(500).json({ error: "Erro ao executar Livro do Dia" });
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
      res.status(409).json({ error: "Livro já está cancelado" });
      return;
    }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const cancelReason = reason?.trim() || DEFAULT_DAY_REASON;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBooksTable)
        .set({ status: "CANCELLED", cancelledAt: new Date(), cancelledBy: userId })
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
    res.status(500).json({ error: "Erro ao cancelar Livro do Dia" });
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
      res.status(409).json({ error: `Livro em status ${book.status} não precisa ser reaberto — só EXECUTED ou CANCELLED voltam a rascunho.` });
      return;
    }
    const reopenReason = typeof reason === "string" ? reason.trim() : "";
    if (!reopenReason) {
      res.status(400).json({ error: "Motivo obrigatório para reabrir um dia fechado." });
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
    res.status(500).json({ error: "Erro ao reabrir Livro do Dia" });
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
      res.status(403).json({ error: "Sem permissão para apagar este Livro do Dia" });
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
    res.status(500).json({ error: "Erro ao apagar Livro do Dia" });
  }
});

router.get("/daily-book", requireAuth, requireOrganization, async (req, res) => {
  const { agendaEventId, status, groupId, date } = req.query as Record<string, string | undefined>;
  const actor = req.user!;
  try {
    // Escopo de organização: só livros cujo evento pertence a uma operação da org.
    const conditions: ReturnType<typeof eq>[] = [
      eq(operationsTable.organizationId, actor.organizationId as string),
    ];
    if (agendaEventId) conditions.push(eq(dailyBooksTable.agendaEventId, agendaEventId));
    if (status) conditions.push(eq(dailyBooksTable.status, status as any));
    else conditions.push(ne(dailyBooksTable.status, "CANCELLED"));
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

    const dailyBooks = rows
      .filter((_, i) => visibility[i])
      .map((r) => ({
        ...r.book,
        operationId: r.operationId,
        operationName: r.operationName,
        eventTitle: r.eventTitle,
        eventDate: r.eventDate,
        showTitle: r.showTitle,
      }));

    res.json({ dailyBooks });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar Livros do Dia" });
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
      res.status(404).json({ error: "Evento do Livro do Dia não encontrado" });
      return;
    }
    if (!ctx.ok) {
      res.status(403).json({ error: "FORBIDDEN", message: "Livro do Dia fora do seu escopo" });
      return;
    }

    const tree = await buildDailyBookTree(id);
    const currentSnapshot: VersionedSnapshot = { scenes: tree };
    res.json({
      dailyBook: {
        ...book,
        operationId: ctx.operationId,
        operationName: ctx.operationName,
        eventTitle: ctx.eventTitle,
        eventDate: ctx.eventDate,
        showTitle: ctx.showTitle,
        scenes: tree,
        sessionBlocks: await listSessionBlocks(id, book.showBookId, ctx.eventDate),
        currentSnapshot,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar Livro do Dia" });
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
      res.status(404).json({ error: "Evento do Livro do Dia não encontrado" });
      return;
    }
    if (!ctx.ok) {
      res.status(403).json({ error: "FORBIDDEN", message: "Livro do Dia fora do seu escopo" });
      return;
    }

    const currentTree = await buildDailyBookTree(id);
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
    res.status(500).json({ error: "Erro ao buscar delta" });
  }
});

/**
 * Diferenças de hoje contra o PADRÃO (o Livro do Show na data do evento) — não contra o
 * snapshot anterior do próprio Livro do Dia (isso é o `/delta`). Re-resolve o elenco ao vivo
 * com a mesma lógica de generate/regenerate, sem persistir nada, e compara contra a árvore
 * viva: cena/bloco/posição removidos hoje, e substituições/vagas por papel.
 */
async function buildPatternDiffRows(dailyBookId: string, showBookId: string, operationId: string, dateISO: string) {
  const [currentTree, resolved] = await Promise.all([
    buildDailyBookTree(dailyBookId),
    resolveAssignmentsByRole(showBookId, operationId, dateISO, { dedupPerScene: true }),
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
    if (!ctx) { res.status(404).json({ error: "Evento do Livro do Dia não encontrado" }); return; }
    if (!ctx.ok) { res.status(403).json({ error: "FORBIDDEN", message: "Livro do Dia fora do seu escopo" }); return; }
    if (!book.showBookId) { res.json({ diffs: [] }); return; }
    const diffs = await buildPatternDiffRows(id, book.showBookId, ctx.operationId, ctx.eventDate);
    res.json({ diffs, version: book.version, status: book.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao calcular diferenças do padrão" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    const [before] = await db
      .select()
      .from(dailyBookAssignmentsTable)
      .where(and(eq(dailyBookAssignmentsTable.id, assignmentId), eq(dailyBookAssignmentsTable.dailyBookId, id), isNull(dailyBookAssignmentsTable.supersededAt)))
      .limit(1);
    if (!before) { res.status(404).json({ error: "Alocação não encontrada" }); return; }
    expectedVersion = requireExpectedVersion(req, res, "o Livro do Dia");
    if (expectedVersion === null) return;
    const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(id) };
    const updated = await mutateDailyBook(id, expectedVersion, async (tx) => {
      const [next] = await tx
        .update(dailyBookAssignmentsTable)
        .set({ userId: userId ?? null, status: userId ? "ASSIGNED" : "OPEN", updatedAt: new Date() })
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
    });
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "assignment_swap", changedBy: actorId });
    res.json({ assignment: updated, version: book.version + 1 });
  } catch (err) {
    if (expectedVersion !== null && await respondDailyBookMutationError(err, req, res, id, expectedVersion)) return;
    res.status(500).json({ error: "Erro ao atualizar alocação" });
  }
});

/**
 * 09/10: ajuste na Escala de um bloco que vem de um Livro do Dia troca a pessoa no próprio Livro,
 * para Escala e Livro dizerem sempre a mesma coisa. Tirar abre a vaga da pessoa; colocar preenche a
 * primeira vaga aberta. Devolve false quando não há o que mudar no Livro (ex.: colocar alguém sem
 * vaga aberta, ou tirar quem só estava na Escala) — aí o ajuste fica só na Escala, como antes.
 */
export async function ajustarPessoaNoLivro(input: { dailyBookId: string; userId: string; action: "ADICIONAR" | "REMOVER"; actorId: string }): Promise<boolean> {
  const [book] = await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, input.dailyBookId)).limit(1);
  if (!book || book.status === "EXECUTED" || book.status === "CANCELLED") return false;
  const vivas = and(
    eq(dailyBookAssignmentsTable.dailyBookId, book.id), isNull(dailyBookAssignmentsTable.supersededAt),
    ne(dailyBookAssignmentsTable.status, "REMOVED"), eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
  );
  const daPessoa = await db.select({ id: dailyBookAssignmentsTable.id }).from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .where(and(vivas, eq(dailyBookAssignmentsTable.userId, input.userId)));
  let alvo: { id: string }[];
  if (input.action === "REMOVER") alvo = daPessoa;
  else {
    if (daPessoa.length) return true; // já está no Livro: nada a mudar
    alvo = await db.select({ id: dailyBookAssignmentsTable.id }).from(dailyBookAssignmentsTable)
      .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
      .where(and(vivas, isNull(dailyBookAssignmentsTable.userId)))
      .orderBy(dailyBookPositionsTable.createdAt, dailyBookPositionsTable.id).limit(1);
  }
  if (!alvo.length) return false;
  const beforeSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(book.id) };
  await mutateDailyBook(book.id, book.version, async (tx) => {
    for (const a of alvo) {
      await tx.update(dailyBookAssignmentsTable)
        .set(input.action === "REMOVER" ? { userId: null, status: "OPEN", updatedAt: new Date() } : { userId: input.userId, status: "ASSIGNED", updatedAt: new Date() })
        .where(eq(dailyBookAssignmentsTable.id, a.id));
    }
    return alvo;
  }, async (tx) => {
    const afterSnapshot: VersionedSnapshot = { scenes: await buildDailyBookTree(book.id, tx) };
    await writeDailyBookAudit(book.id, input.actorId, "assignment_swap",
      { version: book.version, snapshot: beforeSnapshot, userId: input.userId, origem: "ajuste na Escala" },
      { version: book.version + 1, snapshot: afterSnapshot, userId: input.userId, action: input.action, assignmentIds: alvo.map((a) => a.id) }, tx);
  });
  eventBus.emit("daily-book.updated", { dailyBookId: book.id, changeType: "assignment_swap", changedBy: input.actorId });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao remover posição" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao remover cena" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao remover bloco" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao restaurar cena" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao restaurar bloco" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao restaurar posição" });
  }
});

router.patch("/daily-book/:id/scenes/reorder", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const { scenes } = req.body as { scenes: { id: string; order: number }[] };
  const actorId = req.user!.sub;
  let expectedVersion: number | null = null;
  if (!Array.isArray(scenes)) {
    res.status(400).json({ error: "scenes deve ser um array de {id, order}" });
    return;
  }
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
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
    res.status(500).json({ error: "Erro ao reordenar cenas" });
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
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
      return;
    }
    if (!(await requireDailyBookOperate(book, req.user!, res))) return;
    if (typeof formationId !== "string" || !formationId) {
      res.status(400).json({ error: "formationId é obrigatório" });
      return;
    }
    const [scene] = await db.select().from(dailyBookScenesTable)
      .where(and(eq(dailyBookScenesTable.id, sceneId), eq(dailyBookScenesTable.dailyBookId, id), isNull(dailyBookScenesTable.supersededAt)))
      .limit(1);
    if (!scene) { res.status(404).json({ error: "Cena não encontrada" }); return; }
    const [formation] = await db.select().from(formationsTable)
      .where(and(eq(formationsTable.id, formationId), eq(formationsTable.active, true)))
      .limit(1);
    if (!formation) { res.status(404).json({ error: "Formação não encontrada" }); return; }
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
    res.status(500).json({ error: "Erro ao aplicar formação para hoje" });
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
    if (!scene) { res.status(404).json({ error: "Cena não encontrada" }); return; }
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
    res.status(500).json({ error: "Erro ao guardar a formação do dia" });
  }
});

export default router;
