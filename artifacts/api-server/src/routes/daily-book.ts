import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
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
  agendaEventsTable,
  operationalChangesTable,
  historyEventsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { hasActiveResponsibility } from "../lib/delegation-check.js";
import { eventBus } from "../lib/event-bus.js";
import { notifyMany } from "../services/notificationService.js";
import {
  resolveAssignmentsByRole,
  advanceRotationCounts,
  advanceRotationCountsFromWinners,
  collectRotationWinners,
  type RoleResolution,
  type RotationWinners,
} from "../services/line-resolver.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// Estilo MyASA antigo: o operador não precisa digitar "Motivo" nas ações do dia.
// Quando nenhum motivo é informado, o sistema grava um texto padrão na auditoria/delta.
const DEFAULT_DAY_REASON = "Ajuste operacional do dia (sem motivo informado)";

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

async function buildDailyBookTree(dailyBookId: string) {
  const scenes = await db
    .select()
    .from(dailyBookScenesTable)
    .where(eq(dailyBookScenesTable.dailyBookId, dailyBookId))
    .orderBy(dailyBookScenesTable.order);

  const blocks = await db
    .select()
    .from(dailyBookBlocksTable)
    .where(eq(dailyBookBlocksTable.dailyBookId, dailyBookId))
    .orderBy(dailyBookBlocksTable.order);

  const positions = await db
    .select()
    .from(dailyBookPositionsTable)
    .where(eq(dailyBookPositionsTable.dailyBookId, dailyBookId));

  const assignments = positions.length > 0
    ? await db
        .select()
        .from(dailyBookAssignmentsTable)
        .where(
          and(
            eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId),
            inArray(dailyBookAssignmentsTable.positionId, positions.map((p) => p.id))
          )
        )
    : [];

  const assignedUserIds = [
    ...new Set(assignments.map((a) => a.userId).filter((id): id is string => !!id)),
  ];
  const nameByUserId: Record<string, string> = {};
  if (assignedUserIds.length > 0) {
    const users = await db
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

function computeDelta(
  prevSnapshot: Record<string, unknown>,
  currSnapshot: Record<string, unknown>
): Record<string, unknown> {
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
  afterState: Record<string, unknown> | null
) {
  try {
    const [mo] = await db
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
      await db.insert(historyEventsTable).values({
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
  } catch {
  }
}

// Cria os assignments de um papel: usa o resolvedor (regras + disponibilidade) quando
// o papel tem linhas configuradas; senão cai na escala (compatibilidade com papéis legados).
async function createAssignmentsForRole(
  dailyBookId: string,
  positionId: string,
  roleId: string,
  byRole: Map<string, RoleResolution>,
  allocationMap: Record<string, string | null>
) {
  const rr = byRole.get(roleId);
  if (rr && rr.hasLines) {
    if (rr.people.length > 0) {
      for (const person of rr.people) {
        await db.insert(dailyBookAssignmentsTable).values({ dailyBookId, positionId, userId: person.userId, status: "ASSIGNED" });
      }
      return;
    }
    if (rr.hasUncoveredLine) {
      // Linha ativa hoje sem ninguém disponível: buraco real.
      await db.insert(dailyBookAssignmentsTable).values({ dailyBookId, positionId, userId: null, status: "OPEN" });
      return;
    }
    // Todas as linhas estão INATIVAS hoje (ex.: dia da semana que não atua): o papel não
    // participa. Não geramos buraco; honramos apenas uma alocação manual da escala, se houver.
    const manualUserId = allocationMap[roleId] ?? null;
    if (manualUserId) {
      await db.insert(dailyBookAssignmentsTable).values({ dailyBookId, positionId, userId: manualUserId, status: "ASSIGNED" });
    }
    return;
  }
  const assignedUserId = allocationMap[roleId] ?? null;
  await db.insert(dailyBookAssignmentsTable).values({ dailyBookId, positionId, userId: assignedUserId, status: assignedUserId ? "ASSIGNED" : "OPEN" });
}

router.post("/daily-book/generate", requireAuth, requireOrganization, async (req, res) => {
  const { agendaEventId, scaleId: explicitScaleId, operationId: bodyOperationId } = req.body;
  if (!agendaEventId) {
    res.status(400).json({ error: "agendaEventId é obrigatório" });
    return;
  }
  const user = req.user!;
  const userId = user.sub;

  if (!MANAGER_ROLES.includes(user.role)) {
    const opId = bodyOperationId ?? null;
    if (!opId || !(await hasActiveResponsibility(userId, opId, "DAILY_BOOK"))) {
      res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Livro do Dia podem gerar" });
      return;
    }
  }
  try {
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
      .where(eq(showBookScenesTable.showBookId, showBookId))
      .orderBy(showBookScenesTable.order);

    const blocks = await db
      .select()
      .from(showBookBlocksTable)
      .where(eq(showBookBlocksTable.showBookId, showBookId))
      .orderBy(showBookBlocksTable.order);

    const roles = await db
      .select()
      .from(showBookRolesTable)
      .where(eq(showBookRolesTable.showBookId, showBookId));

    let allocations: { positionId: string | null; userId: string | null }[] = [];
    if (scaleId) {
      allocations = await db
        .select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.scaleId, scaleId), eq(scaleAllocationsTable.agendaEventId, agendaEventId)));
    }

    const allocationMap: Record<string, string | null> = {};
    allocations.forEach((a) => { if (a.positionId) allocationMap[a.positionId] = a.userId ?? null; });

    // Resolve o elenco por papel pelas regras das linhas + disponibilidade na data do evento.
    const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, event.date);
    // Persistimos o vencedor de cada linha ROTATION agora, na geração, para que a publicação
    // avance o contador exatamente para quem ficou escalado (e não re-resolva).
    const rotationWinners = collectRotationWinners(result);

    const [dailyBook] = await db
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
      const [dbScene] = await db
        .insert(dailyBookScenesTable)
        .values({ dailyBookId, name: scene.name, order: scene.order, sourceSceneId: scene.id })
        .returning();
      sceneIdMap[scene.id] = dbScene!.id;
    }

    const blockIdMap: Record<string, string> = {};
    for (const block of blocks) {
      const [dbBlock] = await db
        .insert(dailyBookBlocksTable)
        .values({
          dailyBookId,
          name: block.name,
          order: block.order,
          sourceBlockId: block.id,
          sceneId: block.sceneId ? sceneIdMap[block.sceneId] ?? null : null,
        })
        .returning();
      blockIdMap[block.id] = dbBlock!.id;
    }

    let positionsCount = 0;
    for (const role of roles) {
      const [dbPos] = await db
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
      await createAssignmentsForRole(dailyBookId, dbPos!.id, role.id, byRole, allocationMap);
    }

    const fullTree = await buildDailyBookTree(dailyBookId);
    const snapshotJson = { scenes: fullTree, rotationWinners };
    await db
      .update(dailyBooksTable)
      .set({ snapshotJson: snapshotJson as any })
      .where(eq(dailyBooksTable.id, dailyBookId));

    const [updatedBook] = await db
      .select()
      .from(dailyBooksTable)
      .where(eq(dailyBooksTable.id, dailyBookId))
      .limit(1);

    eventBus.emit("daily-book.created", { dailyBookId, agendaEventId, scaleId: scaleId ?? null, version: 1 });
    eventBus.emit("daily-book.generated", { dailyBookId, agendaEventId, version: 1, scenesCount: scenes.length, positionsCount });

    res.status(201).json({ dailyBook: updatedBook });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar Livro do Dia" });
  }
});

router.post("/daily-book/:id/regenerate", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const user = req.user!;
  const userId = user.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;

    if (!MANAGER_ROLES.includes(user.role)) {
      let allowed = false;
      if (book.agendaEventId) {
        const [ev] = await db.select({ operationId: agendaEventsTable.operationId }).from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
        if (ev?.operationId && await hasActiveResponsibility(userId, ev.operationId, "DAILY_BOOK")) allowed = true;
      }
      if (!allowed) {
        res.status(403).json({ error: "Forbidden", message: "Apenas supervisores ou delegados com responsabilidade de Livro do Dia podem regenerar" });
        return;
      }
    }

    if (book.status === "PUBLISHED" || book.status === "REPUBLISHED") {
      res.status(409).json({ error: "Livro publicado não pode ser regenerado. Use republish." });
      return;
    }

    await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
    await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
    await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
    await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));

    const [event] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, book.agendaEventId)).limit(1);
    if (!event || !event.showBookId) { res.status(400).json({ error: "Evento ou Show Book não encontrado" }); return; }

    const showBookId = event.showBookId;
    const scenes = await db.select().from(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showBookId)).orderBy(showBookScenesTable.order);
    const blocks = await db.select().from(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showBookId)).orderBy(showBookBlocksTable.order);
    const roles = await db.select().from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));

    let allocations: { positionId: string | null; userId: string | null }[] = [];
    if (book.scaleId) {
      allocations = await db
        .select({ positionId: scaleAllocationsTable.positionId, userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.scaleId, book.scaleId), eq(scaleAllocationsTable.agendaEventId, book.agendaEventId)));
    }
    const allocationMap: Record<string, string | null> = {};
    allocations.forEach((a) => { if (a.positionId) allocationMap[a.positionId] = a.userId ?? null; });

    // Resolve o elenco por papel pelas regras das linhas + disponibilidade na data do evento.
    const { byRole, result } = await resolveAssignmentsByRole(showBookId, event.operationId, event.date);
    const rotationWinners = collectRotationWinners(result);

    const newVersion = book.version + 1;

    const sceneIdMap: Record<string, string> = {};
    for (const scene of scenes) {
      const [dbScene] = await db.insert(dailyBookScenesTable).values({ dailyBookId: id, name: scene.name, order: scene.order, sourceSceneId: scene.id }).returning();
      sceneIdMap[scene.id] = dbScene!.id;
    }
    const blockIdMap: Record<string, string> = {};
    for (const block of blocks) {
      const [dbBlock] = await db.insert(dailyBookBlocksTable).values({ dailyBookId: id, name: block.name, order: block.order, sourceBlockId: block.id, sceneId: block.sceneId ? sceneIdMap[block.sceneId] ?? null : null }).returning();
      blockIdMap[block.id] = dbBlock!.id;
    }
    for (const role of roles) {
      const [dbPos] = await db.insert(dailyBookPositionsTable).values({ dailyBookId: id, name: role.name, minimumCoverage: role.minimumCoverage, sourceRoleId: role.id, blockId: role.blockId ? blockIdMap[role.blockId] ?? null : null }).returning();
      await createAssignmentsForRole(id, dbPos!.id, role.id, byRole, allocationMap);
    }

    const fullTree = await buildDailyBookTree(id);
    const snapshotJson = { scenes: fullTree, rotationWinners };

    const [updated] = await db
      .update(dailyBooksTable)
      .set({ version: newVersion, generatedAt: new Date(), generatedBy: userId, snapshotJson: snapshotJson as any, updatedAt: new Date() })
      .where(eq(dailyBooksTable.id, id))
      .returning();

    eventBus.emit("daily-book.generated", { dailyBookId: id, agendaEventId: book.agendaEventId, version: newVersion, scenesCount: scenes.length, positionsCount: roles.length });

    res.json({ dailyBook: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao regenerar Livro do Dia" });
  }
});

router.post("/daily-book/:id/publish", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body;
  const userId = req.user!.sub;
  const user = req.user!;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!MANAGER_ROLES.includes(user.role)) {
      let allowed = false;
      if (book.scaleId) {
        const [sr] = await db.select({ operationId: scalesTable.operationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
        if (sr && await hasActiveResponsibility(userId, sr.operationId, "DAILY_BOOK")) allowed = true;
      }
      if (!allowed) { res.status(403).json({ error: "Forbidden", message: "Acesso restrito a supervisores ou delegados" }); return; }
    }
    if (!["DRAFT"].includes(book.status)) {
      res.status(409).json({ error: `Livro em status ${book.status} não pode ser publicado diretamente` });
      return;
    }
    const [updated] = await db
      .update(dailyBooksTable)
      .set({ status: "PUBLISHED", publishedAt: new Date(), publishedBy: userId, updatedAt: new Date() })
      .where(eq(dailyBooksTable.id, id))
      .returning();

    // Efetivação da escala do dia: avança os contadores de rodízio uma única vez (DRAFT→PUBLISHED).
    // Usamos os vencedores persistidos na geração para garantir que o contador avance para quem
    // de fato ficou escalado na linha — mesmo que a disponibilidade tenha mudado entre gerar e publicar.
    const snapshot = (book.snapshotJson as Record<string, unknown> | null) ?? null;
    const storedWinners =
      snapshot && snapshot.rotationWinners && typeof snapshot.rotationWinners === "object"
        ? (snapshot.rotationWinners as RotationWinners)
        : null;
    if (storedWinners) {
      advanceRotationCountsFromWinners(storedWinners).catch((e) =>
        console.error("rotation advance failed", e)
      );
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
    writeHistoryEvent({
      category: "DAILY_BOOK", action: "published",
      title: `Livro do Dia publicado (v${updated!.version})`,
      narrative: `Livro do Dia publicado e disponível para a equipe.`,
      entityType: "daily_book", entityId: id,
      actorId: userId, actorType: "HUMAN",
    }).catch(() => {});
    await writeDailyBookAudit(id, userId, "publish", { status: book.status }, { status: "PUBLISHED", reason: reason?.trim() || DEFAULT_DAY_REASON });
    // notify assigned users
    db.select({ userId: dailyBookAssignmentsTable.userId })
      .from(dailyBookAssignmentsTable)
      .where(eq(dailyBookAssignmentsTable.dailyBookId, id))
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
    res.status(500).json({ error: "Erro ao publicar Livro do Dia" });
  }
});

router.post("/daily-book/:id/republish", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body;
  const userId = req.user!.sub;
  const user = req.user!;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!MANAGER_ROLES.includes(user.role)) {
      let allowed = false;
      if (book.scaleId) {
        const [sr] = await db.select({ operationId: scalesTable.operationId }).from(scalesTable).where(eq(scalesTable.id, book.scaleId)).limit(1);
        if (sr && await hasActiveResponsibility(userId, sr.operationId, "DAILY_BOOK")) allowed = true;
      }
      if (!allowed) { res.status(403).json({ error: "Forbidden", message: "Acesso restrito a supervisores ou delegados" }); return; }
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

    const previousVersion = book.version;
    const newVersion = previousVersion + 1;

    const [updated] = await db
      .update(dailyBooksTable)
      .set({
        status: "REPUBLISHED",
        version: newVersion,
        publishedAt: new Date(),
        publishedBy: userId,
        republishDeltaJson: delta as any,
        snapshotJson: currentSnapshot as any,
        updatedAt: new Date(),
      })
      .where(eq(dailyBooksTable.id, id))
      .returning();

    eventBus.emit("daily-book.republished", { dailyBookId: id, previousVersion, newVersion, delta, republishedBy: userId });
    writeHistoryEvent({
      category: "DAILY_BOOK", action: "republished",
      title: `Livro do Dia republicado (v${previousVersion} → v${newVersion})`,
      narrative: `Livro do Dia republicado com alterações. Versão ${previousVersion} → ${newVersion}.`,
      entityType: "daily_book", entityId: id,
      actorId: userId, actorType: "HUMAN",
    }).catch(() => {});
    await writeDailyBookAudit(id, userId, "republish", { version: previousVersion, snapshot: prevSnapshot }, { version: newVersion, delta, reason: reason?.trim() || DEFAULT_DAY_REASON });
    // notify assigned users of changes
    db.select({ userId: dailyBookAssignmentsTable.userId })
      .from(dailyBookAssignmentsTable)
      .where(eq(dailyBookAssignmentsTable.dailyBookId, id))
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
    console.error(err);
    res.status(500).json({ error: "Erro ao republicar Livro do Dia" });
  }
});

router.post("/daily-book/:id/execute", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const userId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (!["PUBLISHED", "REPUBLISHED"].includes(book.status)) {
      res.status(409).json({ error: "Somente livros publicados podem ser executados" });
      return;
    }
    const [updated] = await db
      .update(dailyBooksTable)
      .set({ status: "EXECUTED", executedAt: new Date(), executedBy: userId, updatedAt: new Date() })
      .where(eq(dailyBooksTable.id, id))
      .returning();
    eventBus.emit("daily-book.executed", { dailyBookId: id, version: updated!.version, executedBy: userId });
    await writeDailyBookAudit(id, userId, "execute", { status: book.status }, { status: "EXECUTED" });
    res.json({ dailyBook: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao executar Livro do Dia" });
  }
});

router.post("/daily-book/:id/cancel", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body;
  const userId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "CANCELLED") {
      res.status(409).json({ error: "Livro já está cancelado" });
      return;
    }
    const cancelReason = reason?.trim() || DEFAULT_DAY_REASON;
    const [updated] = await db
      .update(dailyBooksTable)
      .set({ status: "CANCELLED", cancelledAt: new Date(), cancelledBy: userId, updatedAt: new Date() })
      .where(eq(dailyBooksTable.id, id))
      .returning();
    await writeDailyBookAudit(id, userId, "cancel", { status: book.status }, { status: "CANCELLED", reason: cancelReason });
    res.json({ dailyBook: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao cancelar Livro do Dia" });
  }
});

router.get("/daily-book", requireAuth, requireOrganization, async (req, res) => {
  const { agendaEventId, status, groupId } = req.query as Record<string, string | undefined>;
  try {
    const conditions: ReturnType<typeof eq>[] = [];
    if (agendaEventId) conditions.push(eq(dailyBooksTable.agendaEventId, agendaEventId));
    if (status) conditions.push(eq(dailyBooksTable.status, status as any));
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

    const books = conditions.length > 0
      ? await db.select().from(dailyBooksTable).where(and(...conditions))
      : await db.select().from(dailyBooksTable);

    res.json({ dailyBooks: books });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar Livros do Dia" });
  }
});

router.get("/daily-book/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    const tree = await buildDailyBookTree(id);
    res.json({ dailyBook: { ...book, scenes: tree } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar Livro do Dia" });
  }
});

router.get("/daily-book/:id/delta", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;

    const currentTree = await buildDailyBookTree(id);
    const currentSnapshot = { scenes: currentTree };
    const prevSnapshot = (book.snapshotJson as Record<string, unknown>) ?? {};
    const liveDelta = computeDelta(prevSnapshot, currentSnapshot);

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

router.patch("/daily-book/:id/assignments/:assignmentId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const assignmentId = req.params.assignmentId as string;
  const { userId } = req.body;
  const actorId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
      return;
    }
    const [before] = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, assignmentId)).limit(1);
    const [updated] = await db
      .update(dailyBookAssignmentsTable)
      .set({ userId: userId ?? null, status: userId ? "ASSIGNED" : "OPEN", updatedAt: new Date() })
      .where(and(eq(dailyBookAssignmentsTable.id, assignmentId), eq(dailyBookAssignmentsTable.dailyBookId, id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Alocação não encontrada" }); return; }
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "assignment_swap", changedBy: actorId });
    await writeDailyBookAudit(id, actorId, "assignment_swap",
      { assignmentId, userId: before?.userId ?? null, status: before?.status ?? null },
      { assignmentId, userId: userId ?? null, status: updated.status });
    res.json({ assignment: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar alocação" });
  }
});

router.delete("/daily-book/:id/positions/:positionId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const positionId = req.params.positionId as string;
  const actorId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
      return;
    }
    const [before] = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.id, positionId)).limit(1);
    const [updated] = await db
      .update(dailyBookPositionsTable)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(and(eq(dailyBookPositionsTable.id, positionId), eq(dailyBookPositionsTable.dailyBookId, id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Posição não encontrada" }); return; }
    await db
      .update(dailyBookAssignmentsTable)
      .set({ status: "REMOVED", updatedAt: new Date() })
      .where(and(eq(dailyBookAssignmentsTable.positionId, positionId), eq(dailyBookAssignmentsTable.dailyBookId, id)));
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "position_removed", changedBy: actorId });
    await writeDailyBookAudit(id, actorId, "position_removed",
      { positionId, name: before?.name ?? null },
      { positionId, isRemoved: true });
    res.json({ position: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover posição" });
  }
});

router.delete("/daily-book/:id/scenes/:sceneId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const actorId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
      return;
    }
    const [before] = await db.select().from(dailyBookScenesTable).where(eq(dailyBookScenesTable.id, sceneId)).limit(1);
    const [updatedScene] = await db
      .update(dailyBookScenesTable)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(and(eq(dailyBookScenesTable.id, sceneId), eq(dailyBookScenesTable.dailyBookId, id)))
      .returning();
    if (!updatedScene) { res.status(404).json({ error: "Cena não encontrada" }); return; }

    const affectedBlocks = await db
      .update(dailyBookBlocksTable)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(and(eq(dailyBookBlocksTable.sceneId, sceneId), eq(dailyBookBlocksTable.dailyBookId, id)))
      .returning();

    if (affectedBlocks.length > 0) {
      for (const block of affectedBlocks) {
        await db
          .update(dailyBookPositionsTable)
          .set({ isRemoved: true, updatedAt: new Date() })
          .where(and(eq(dailyBookPositionsTable.blockId, block.id), eq(dailyBookPositionsTable.dailyBookId, id)));
      }
    }

    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "scene_removed", changedBy: actorId });
    await writeDailyBookAudit(id, actorId, "scene_removed",
      { sceneId, name: before?.name ?? null },
      { sceneId, isRemoved: true, cascadedBlocks: affectedBlocks.length });
    res.json({ scene: updatedScene });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover cena" });
  }
});

router.delete("/daily-book/:id/blocks/:blockId", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const blockId = req.params.blockId as string;
  const actorId = req.user!.sub;
  try {
    const book = await getDailyBookOrFail(id, res);
    if (!book) return;
    if (book.status === "EXECUTED" || book.status === "CANCELLED") {
      res.status(409).json({ error: "Livro em estado terminal não pode ser alterado" });
      return;
    }
    const [before] = await db.select().from(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.id, blockId)).limit(1);
    const [updatedBlock] = await db
      .update(dailyBookBlocksTable)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(and(eq(dailyBookBlocksTable.id, blockId), eq(dailyBookBlocksTable.dailyBookId, id)))
      .returning();
    if (!updatedBlock) { res.status(404).json({ error: "Bloco não encontrado" }); return; }

    const affectedPositions = await db
      .update(dailyBookPositionsTable)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(and(eq(dailyBookPositionsTable.blockId, blockId), eq(dailyBookPositionsTable.dailyBookId, id)))
      .returning();

    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "block_removed", changedBy: actorId });
    await writeDailyBookAudit(id, actorId, "block_removed",
      { blockId, name: before?.name ?? null },
      { blockId, isRemoved: true, cascadedPositions: affectedPositions.length });
    res.json({ block: updatedBlock });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover bloco" });
  }
});

router.patch("/daily-book/:id/scenes/reorder", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const id = req.params.id as string;
  const { scenes } = req.body as { scenes: { id: string; order: number }[] };
  const actorId = req.user!.sub;
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
    for (const s of scenes) {
      await db
        .update(dailyBookScenesTable)
        .set({ order: s.order, updatedAt: new Date() })
        .where(and(eq(dailyBookScenesTable.id, s.id), eq(dailyBookScenesTable.dailyBookId, id)));
    }
    eventBus.emit("daily-book.updated", { dailyBookId: id, changeType: "scenes_reordered", changedBy: actorId });
    await writeDailyBookAudit(id, actorId, "scenes_reordered", null, { scenes });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao reordenar cenas" });
  }
});

export default router;
