import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  showBookVersionsTable,
  showBookTagsTable,
  userTagsTable,
  showBookPositionLibraryRefsTable,
  libraryDocumentsTable,
  usersTable,
  userRolesTable,
  scalesTable,
  scaleAllocationsTable,
  allocationExceptionsTable,
  agendaEventsTable,
  dailyBooksTable,
  operationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { buildShowBookTree, collectUserIdsFromConfig, resolveShowBookCast } from "../services/line-resolver.js";
import { canManageShowBook } from "../lib/show-responsibility.js";

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] as const;

const DEFAULT_STRUCTURAL_REASON = "Edição estrutural (sem motivo informado)";
function isValidBlockTime(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

const router: IRouter = Router();

async function getShowBookOrFail(id: string, res: any) {
  const [book] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, id)).limit(1);
  if (!book) {
    res.status(404).json({ error: "Livro do Show não encontrado" });
    return null;
  }
  return book;
}

// Guard de mutação: carrega o livro (via req.params.id) e confirma que o ator
// pode geri-lo (admin, responsável definido, ou qualquer gestor se não houver
// responsável). Devolve o livro ou null (já tendo respondido 404/403).
async function requireShowManage(req: any, res: any) {
  const id = req.params.id as string;
  const book = await getShowBookOrFail(id, res);
  if (!book) return null;
  const actor = { sub: req.user!.sub, role: req.user!.role, operationIds: req.user!.operationIds };
  if (!canManageShowBook(actor, { id: book.id, responsibleId: book.responsibleId }, book.operationId)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas o responsável por este show (ou um admin) pode editá-lo" });
    return null;
  }
  return book;
}

async function buildMemberDirectory(
  scenes: Awaited<ReturnType<typeof buildShowBookTree>>
): Promise<{ id: string; name: string }[]> {
  const userIds = new Set<string>();
  for (const scene of scenes) {
    for (const block of scene.blocks) {
      for (const pos of block.positions) {
        for (const line of pos.lines) {
          collectUserIdsFromConfig(line.config).forEach((id) => userIds.add(id));
        }
      }
    }
  }
  if (userIds.size === 0) return [];
  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(inArray(usersTable.id, Array.from(userIds)));
  return rows;
}

async function bumpVersion(
  showBookId: string,
  changeType: "STRUCTURAL" | "CONFIG",
  reason: string,
  createdBy: string,
  requestId?: string,
  correlationId?: string
) {
  const [book] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, showBookId)).limit(1);
  if (!book) return;
  const newVersion = book.version + 1;
  await db
    .update(showBooksTable)
    .set({ version: newVersion, updatedAt: new Date() })
    .where(eq(showBooksTable.id, showBookId));
  const tree = await buildShowBookTree(showBookId);
  await db.insert(showBookVersionsTable).values({
    showBookId,
    version: newVersion,
    changeType,
    reason,
    snapshot: tree as any,
    createdBy,
  });
  eventBus.emit("showbook.version_created", { showBookId, version: newVersion, changeType });
  const log = requestLogger("show_book", requestId ?? "", correlationId ?? "");
  log.info({ showBookId, version: newVersion, changeType }, "Nova versão criada");
  return newVersion;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Apaga posições (papéis) por completo, resolvendo as FKs que não têm cascade:
// as linhas pertencem à posição (apagar) e o histórico de escala aponta para ela
// (desligar, preservando os registos). As refs de biblioteca têm cascade no schema.
async function purgePositions(tx: Tx, positionIds: string[]) {
  if (positionIds.length === 0) return;
  await tx.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, positionIds));
  await tx.update(scaleAllocationsTable).set({ positionId: null }).where(inArray(scaleAllocationsTable.positionId, positionIds));
  await tx.update(allocationExceptionsTable).set({ positionId: null }).where(inArray(allocationExceptionsTable.positionId, positionIds));
  await tx.delete(showBookRolesTable).where(inArray(showBookRolesTable.id, positionIds));
}

// Confirma que a posição pertence ao livro (evita IDOR cross-showbook em mutações).
async function positionInShowBook(positionId: string, showBookId: string): Promise<boolean> {
  const [row] = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable)
    .where(and(eq(showBookRolesTable.id, positionId), eq(showBookRolesTable.showBookId, showBookId)));
  return !!row;
}

// Confirma que a linha pertence a uma posição do livro (linha→posição→livro).
async function lineInShowBook(lineId: string, showBookId: string): Promise<boolean> {
  const [row] = await db.select({ id: showBookLinesTable.id }).from(showBookLinesTable)
    .innerJoin(showBookRolesTable, eq(showBookLinesTable.positionId, showBookRolesTable.id))
    .where(and(eq(showBookLinesTable.id, lineId), eq(showBookRolesTable.showBookId, showBookId)));
  return !!row;
}

router.get("/show-books", requireAuth, requireOrganization, async (req, res) => {
  const { operationId } = req.query as { operationId?: string };
  try {
    const books = operationId
      ? await db.select().from(showBooksTable).where(eq(showBooksTable.operationId, operationId))
      : await db.select().from(showBooksTable);
    res.json({ showBooks: books });
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao listar livros" });
  }
});

router.post("/show-books", requireAuth, requireOrganization, async (req, res) => {
  const { operationId, title, description, type } = req.body;
  if (!operationId || !title) {
    res.status(400).json({ error: "operationId e title são obrigatórios" });
    return;
  }
  const userId = req.user!.sub;
  try {
    const [book] = await db
      .insert(showBooksTable)
      .values({
        operationId,
        title,
        description: description ?? null,
        type: type ?? "STRUCTURED",
        version: 1,
        status: "DRAFT",
        createdBy: userId,
      })
      .returning();
    eventBus.emit("showbook.created", { showBookId: book!.id, operationId });
    res.status(201).json({ showBook: book });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar livro" });
  }
});

router.get("/show-books/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const book = await getShowBookOrFail(id, res);
    if (!book) return;
    const tree = await buildShowBookTree(id);
    const memberDirectory = await buildMemberDirectory(tree);
    res.json({ showBook: { ...book, scenes: tree, memberDirectory } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar livro" });
  }
});

// Conferência: resolve quem ocupa cada linha numa data específica (folgas, ordem e rodízio).
router.get("/show-books/:id/resolve", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const date = (req.query.date as string) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date (YYYY-MM-DD) é obrigatório" });
    return;
  }
  // Valida data de calendário real (rejeita 2026-13-40 etc.)
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    res.status(400).json({ error: "date inválida" });
    return;
  }
  try {
    const book = await getShowBookOrFail(id, res);
    if (!book) return;
    // dedupPerScene: a mesma pessoa não pode ocupar dois papéis na mesma cena —
    // quem já foi escalado numa posição é saltado nas seguintes (puxa o próximo
    // substituto/rodízio). Mantém a Conferência por data coerente com o Livro do Dia.
    const resolution = await resolveShowBookCast(id, book.operationId, date, { dedupPerScene: true });
    res.json({ resolution });
  } catch (err) {
    const log = requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "");
    log.error({ err, showBookId: id, date }, "Erro ao resolver elenco por data");
    res.status(500).json({ error: "Erro ao resolver elenco por data" });
  }
});

router.patch("/show-books/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { title, description, startTime, endTime, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const book = await requireShowManage(req, res);
    if (!book) return;
    const [updated] = await db
      .update(showBooksTable)
      .set({
        title: title ?? book.title,
        description: description ?? book.description,
        startTime: "startTime" in req.body ? (startTime || null) : book.startTime,
        endTime: "endTime" in req.body ? (endTime || null) : book.endTime,
        updatedAt: new Date(),
      })
      .where(eq(showBooksTable.id, id))
      .returning();
    res.json({ showBook: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar livro" });
  }
});

router.patch("/show-books/:id/status", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { status, reason } = req.body;
  if (!status || !["PUBLISHED", "ARCHIVED", "DRAFT"].includes(status)) {
    res.status(400).json({ error: "status inválido. Valores: PUBLISHED, ARCHIVED, DRAFT" }); return;
  }
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const [updated] = await db
      .update(showBooksTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(showBooksTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Livro não encontrado" }); return; }
    if (status === "PUBLISHED") {
      eventBus.emit("showbook.published", { showBookId: id, version: updated.version });
    }
    res.json({ showBook: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Atribuir/limpar o responsável de um show (apenas ADMIN).
router.patch("/show-books/:id/responsible", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const { responsibleId } = req.body as { responsibleId?: string | null };
  try {
    const book = await getShowBookOrFail(id, res);
    if (!book) return;
    if (responsibleId) {
      const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, responsibleId)).limit(1);
      if (!u) { res.status(404).json({ error: "Utilizador responsável não encontrado" }); return; }
      // O responsável de um show TEM de ser um supervisor (A/B) da operação do
      // show. Sem esta validação, atribuir um membro/capitão como responsável
      // promovê-lo-ia a controlo total do show (escalada de privilégio), pois
      // canManageShowBook/canOperateDailyBook dão direitos a quem casa com
      // responsibleId.
      const [sup] = await db
        .select({ id: userRolesTable.id })
        .from(userRolesTable)
        .where(
          and(
            eq(userRolesTable.userId, responsibleId),
            eq(userRolesTable.operationId, book.operationId),
            eq(userRolesTable.active, true),
            inArray(userRolesTable.role, ["SUPERVISOR_A", "SUPERVISOR_B"]),
          ),
        )
        .limit(1);
      if (!sup) {
        res.status(400).json({ error: "O responsável tem de ser um supervisor da operação do show" });
        return;
      }
    }
    const [updated] = await db
      .update(showBooksTable)
      .set({ responsibleId: responsibleId ?? null, updatedAt: new Date() })
      .where(eq(showBooksTable.id, id))
      .returning();
    const log = requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "");
    log.info({ showBookId: id, responsibleId: responsibleId ?? null }, "Responsável do show atualizado");
    res.json({ showBook: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao definir responsável" });
  }
});

router.delete("/show-books/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const organizationId = req.user!.organizationId;
  try {
    const book = await getShowBookOrFail(id, res);
    if (!book) return;

    const [op] = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(and(eq(operationsTable.id, book.operationId), eq(operationsTable.organizationId, organizationId)))
      .limit(1);
    if (!op) {
      res.status(404).json({ error: "Livro do Show não encontrado" });
      return;
    }

    const [inScale] = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.showBookId, id)).limit(1);
    const [inAgenda] = await db.select({ id: agendaEventsTable.id }).from(agendaEventsTable).where(eq(agendaEventsTable.showBookId, id)).limit(1);
    const [inDaily] = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, id)).limit(1);
    if (inScale || inAgenda || inDaily) {
      const usos: string[] = [];
      if (inScale) usos.push("escalas");
      if (inAgenda) usos.push("agenda");
      if (inDaily) usos.push("livro do dia");
      res.status(409).json({
        error: `Este livro está a ser usado em ${usos.join(", ")}. Arquive-o em vez de apagar, ou remova primeiro essas ligações.`,
      });
      return;
    }

    await db.transaction(async (tx) => {
      const roles = await tx.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, id));
      const roleIds = roles.map((r) => r.id);
      if (roleIds.length > 0) {
        await tx.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roleIds));
      }
      await tx.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, id));
      await tx.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, id));
      await tx.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, id));
      await tx.delete(showBookVersionsTable).where(eq(showBookVersionsTable.showBookId, id));
      await tx.delete(showBooksTable).where(eq(showBooksTable.id, id));
    });

    eventBus.emit("showbook.deleted", { showBookId: id, operationId: book.operationId });
    const log = requestLogger("show_book", (req as any).requestId ?? "", (req as any).correlationId ?? "");
    log.info({ showBookId: id }, "Livro do Show apagado");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao apagar o livro" });
  }
});

router.get("/show-books/:id/versions", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const book = await getShowBookOrFail(id, res);
    if (!book) return;
    const versions = await db
      .select()
      .from(showBookVersionsTable)
      .where(eq(showBookVersionsTable.showBookId, id))
      .orderBy(showBookVersionsTable.version);
    res.json({ versions });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar versões" });
  }
});

router.post("/show-books/:id/scenes", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const { name, order, isOptional } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const [scene] = await db
      .insert(showBookScenesTable)
      .values({ showBookId, name, order, isOptional: isOptional ?? false })
      .returning();
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(201).json({ scene });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar cena" });
  }
});

router.patch("/show-books/:id/scenes/:sceneId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const { name, order, isOptional, changeType } = req.body;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (order !== undefined) updates.order = order;
    if (isOptional !== undefined) updates.isOptional = isOptional;
    const [updated] = await db
      .update(showBookScenesTable)
      .set(updates as any)
      .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Cena não encontrada" }); return; }
    const ct = changeType === "STRUCTURAL" ? "STRUCTURAL" : "CONFIG";
    await bumpVersion(showBookId, ct, reason, req.user!.sub, req.requestId, req.correlationId);
    res.json({ scene: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar cena" });
  }
});

router.delete("/show-books/:id/scenes/:sceneId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const [owned] = await db.select({ id: showBookScenesTable.id }).from(showBookScenesTable)
      .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId)));
    if (!owned) { res.status(404).json({ error: "Cena não encontrada" }); return; }
    await db.transaction(async (tx) => {
      const blocks = await tx.select({ id: showBookBlocksTable.id })
        .from(showBookBlocksTable)
        .where(and(eq(showBookBlocksTable.sceneId, sceneId), eq(showBookBlocksTable.showBookId, showBookId)));
      const blockIds = blocks.map((b) => b.id);
      if (blockIds.length > 0) {
        const positions = await tx.select({ id: showBookRolesTable.id })
          .from(showBookRolesTable)
          .where(and(inArray(showBookRolesTable.blockId, blockIds), eq(showBookRolesTable.showBookId, showBookId)));
        await purgePositions(tx, positions.map((p) => p.id));
        await tx.delete(showBookBlocksTable)
          .where(and(inArray(showBookBlocksTable.id, blockIds), eq(showBookBlocksTable.showBookId, showBookId)));
      }
      await tx.delete(showBookScenesTable)
        .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId)));
    });
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "")
      .error({ err, showBookId, sceneId }, "Erro ao remover cena");
    res.status(500).json({ error: "Erro ao remover cena" });
  }
});

router.post("/show-books/:id/blocks", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const { name, order, sceneId, startTime, endTime } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  if (!isValidBlockTime(startTime) || !isValidBlockTime(endTime)) { res.status(400).json({ error: "Horário inválido (use HH:MM)" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (sceneId) {
      const [scene] = await db.select({ id: showBookScenesTable.id }).from(showBookScenesTable)
        .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId)));
      if (!scene) { res.status(404).json({ error: "Cena não encontrada" }); return; }
    }
    const [block] = await db
      .insert(showBookBlocksTable)
      .values({ showBookId, name, order, sceneId: sceneId ?? null, startTime: startTime ?? null, endTime: endTime ?? null })
      .returning();
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(201).json({ block });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar bloco" });
  }
});

router.patch("/show-books/:id/blocks/:blockId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const blockId = req.params.blockId as string;
  const { name, order, changeType, startTime, endTime } = req.body;
  if (!isValidBlockTime(startTime) || !isValidBlockTime(endTime)) { res.status(400).json({ error: "Horário inválido (use HH:MM)" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (order !== undefined) updates.order = order;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    const [updated] = await db
      .update(showBookBlocksTable)
      .set(updates as any)
      .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Bloco não encontrado" }); return; }
    const ct = changeType === "STRUCTURAL" ? "STRUCTURAL" : "CONFIG";
    await bumpVersion(showBookId, ct, reason, req.user!.sub, req.requestId, req.correlationId);
    res.json({ block: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar bloco" });
  }
});

router.delete("/show-books/:id/blocks/:blockId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const blockId = req.params.blockId as string;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const [owned] = await db.select({ id: showBookBlocksTable.id }).from(showBookBlocksTable)
      .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId)));
    if (!owned) { res.status(404).json({ error: "Bloco não encontrado" }); return; }
    await db.transaction(async (tx) => {
      const positions = await tx.select({ id: showBookRolesTable.id })
        .from(showBookRolesTable)
        .where(and(eq(showBookRolesTable.blockId, blockId), eq(showBookRolesTable.showBookId, showBookId)));
      await purgePositions(tx, positions.map((p) => p.id));
      await tx.delete(showBookBlocksTable)
        .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId)));
    });
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "")
      .error({ err, showBookId, blockId }, "Erro ao remover bloco");
    res.status(500).json({ error: "Erro ao remover bloco" });
  }
});

router.post("/show-books/:id/positions", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const { name, order, blockId, minimumCoverage, tagsJson } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (blockId) {
      const [block] = await db.select({ id: showBookBlocksTable.id }).from(showBookBlocksTable)
        .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId)));
      if (!block) { res.status(404).json({ error: "Bloco não encontrado" }); return; }
    }
    const [position] = await db
      .insert(showBookRolesTable)
      .values({
        showBookId, name, order,
        blockId: blockId ?? null,
        minimumCoverage: minimumCoverage ?? 1,
        tagsJson: tagsJson ?? [],
      })
      .returning();
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(201).json({ position });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar posição" });
  }
});

router.patch("/show-books/:id/positions/:positionId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const { name, minimumCoverage, tagsJson, order, changeType } = req.body;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (minimumCoverage !== undefined) updates.minimumCoverage = minimumCoverage;
    if (tagsJson !== undefined) updates.tagsJson = tagsJson;
    if (order !== undefined) updates.order = order;
    const [updated] = await db
      .update(showBookRolesTable)
      .set(updates as any)
      .where(and(eq(showBookRolesTable.id, positionId), eq(showBookRolesTable.showBookId, showBookId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Posição não encontrada" }); return; }
    const ct = changeType === "STRUCTURAL" ? "STRUCTURAL" : "CONFIG";
    await bumpVersion(showBookId, ct, reason, req.user!.sub, req.requestId, req.correlationId);
    res.json({ position: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar posição" });
  }
});

router.delete("/show-books/:id/positions/:positionId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const [owned] = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable)
      .where(and(eq(showBookRolesTable.id, positionId), eq(showBookRolesTable.showBookId, showBookId)));
    if (!owned) { res.status(404).json({ error: "Posição não encontrada" }); return; }
    await db.transaction(async (tx) => {
      await purgePositions(tx, [positionId]);
    });
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "")
      .error({ err, showBookId, positionId }, "Erro ao remover posição");
    res.status(500).json({ error: "Erro ao remover posição" });
  }
});

router.post("/show-books/:id/positions/:positionId/lines", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const { type, config, order } = req.body;
  if (!type) { res.status(400).json({ error: "type é obrigatório" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (!(await positionInShowBook(positionId, showBookId))) {
      res.status(404).json({ error: "Posição não encontrada" }); return;
    }
    const [line] = await db
      .insert(showBookLinesTable)
      .values({ positionId, type, config: config ?? {}, order: order ?? 0 })
      .returning();
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(201).json({ line });
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "")
      .error({ err, showBookId, positionId }, "Erro ao criar linha");
    res.status(500).json({ error: "Erro ao criar linha" });
  }
});

router.patch("/show-books/:id/lines/:lineId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const lineId = req.params.lineId as string;
  const { type, config, order, changeType } = req.body;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (!(await lineInShowBook(lineId, showBookId))) {
      res.status(404).json({ error: "Linha não encontrada" }); return;
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (type !== undefined) updates.type = type;
    if (config !== undefined) updates.config = config;
    if (order !== undefined) updates.order = order;
    const [updated] = await db
      .update(showBookLinesTable)
      .set(updates as any)
      .where(eq(showBookLinesTable.id, lineId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Linha não encontrada" }); return; }
    const ct = changeType === "STRUCTURAL" ? "STRUCTURAL" : "CONFIG";
    await bumpVersion(showBookId, ct, reason, req.user!.sub, req.requestId, req.correlationId);
    res.json({ line: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar linha" });
  }
});

router.delete("/show-books/:id/lines/:lineId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const lineId = req.params.lineId as string;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (!(await lineInShowBook(lineId, showBookId))) {
      res.status(404).json({ error: "Linha não encontrada" }); return;
    }
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.id, lineId));
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "")
      .error({ err, showBookId, lineId }, "Erro ao remover linha");
    res.status(500).json({ error: "Erro ao remover linha" });
  }
});

router.get("/operations/:operationId/tags", requireAuth, requireOrganization, async (req, res) => {
  const operationId = req.params.operationId as string;
  try {
    const tags = await db.select().from(showBookTagsTable)
      .where(eq(showBookTagsTable.operationId, operationId));
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar tags" });
  }
});

router.post("/operations/:operationId/tags", requireAuth, requireOrganization, async (req, res) => {
  const operationId = req.params.operationId as string;
  const { category, label } = req.body;
  if (!category || !label) { res.status(400).json({ error: "category e label são obrigatórios" }); return; }
  try {
    const [tag] = await db
      .insert(showBookTagsTable)
      .values({ operationId, category, label, createdBy: req.user!.sub })
      .returning();
    res.status(201).json({ tag });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar tag" });
  }
});

router.delete("/operations/:operationId/tags/:tagId", requireAuth, requireOrganization, async (req, res) => {
  const tagId = req.params.tagId as string;
  try {
    await db.delete(showBookTagsTable).where(eq(showBookTagsTable.id, tagId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover tag" });
  }
});

router.get("/users/:userId/tags", requireAuth, requireOrganization, async (req, res) => {
  const userId = req.params.userId as string;
  try {
    const tags = await db
      .select({ userTag: userTagsTable, tag: showBookTagsTable })
      .from(userTagsTable)
      .innerJoin(showBookTagsTable, eq(userTagsTable.tagId, showBookTagsTable.id))
      .where(eq(userTagsTable.userId, userId));
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar tags do usuário" });
  }
});

router.post("/users/:userId/tags", requireAuth, requireOrganization, async (req, res) => {
  const userId = req.params.userId as string;
  const { tagId } = req.body;
  if (!tagId) { res.status(400).json({ error: "tagId é obrigatório" }); return; }
  try {
    const [userTag] = await db
      .insert(userTagsTable)
      .values({ userId, tagId, assignedBy: req.user!.sub })
      .returning();
    res.status(201).json({ userTag });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atribuir tag ao usuário" });
  }
});

router.delete("/users/:userId/tags/:tagId", requireAuth, requireOrganization, async (req, res) => {
  const userId = req.params.userId as string;
  const tagId = req.params.tagId as string;
  try {
    await db.delete(userTagsTable)
      .where(and(eq(userTagsTable.userId, userId), eq(userTagsTable.tagId, tagId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover tag do usuário" });
  }
});

// ─── Referências oficiais da Biblioteca por posição ───────────────────────────

router.get("/show-books/:id/positions/:positionId/refs", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const role = req.user!.role as string;
  const isManager = MANAGER_ROLES.includes(role as any);
  try {
    const baseWhere = and(
      eq(showBookPositionLibraryRefsTable.positionId, positionId),
      eq(showBookPositionLibraryRefsTable.showBookId, showBookId)
    );
    const rows = await db
      .select({
        ref: showBookPositionLibraryRefsTable,
        doc: {
          id:      libraryDocumentsTable.id,
          title:   libraryDocumentsTable.title,
          type:    libraryDocumentsTable.type,
          status:  libraryDocumentsTable.status,
          summary: libraryDocumentsTable.summary,
          version: libraryDocumentsTable.version,
        },
      })
      .from(showBookPositionLibraryRefsTable)
      .innerJoin(libraryDocumentsTable, eq(showBookPositionLibraryRefsTable.documentId, libraryDocumentsTable.id))
      .where(
        isManager
          ? baseWhere
          : and(baseWhere, inArray(libraryDocumentsTable.status, ["PUBLISHED", "UPDATED"]))
      );
    res.json({ refs: rows.map((r) => ({ ...r.ref, document: r.doc })) });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar referências" });
  }
});

router.post("/show-books/:id/positions/:positionId/refs", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const { documentId, label } = req.body;
  const role = req.user!.role as string;
  if (!MANAGER_ROLES.includes(role as any)) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  if (!documentId) {
    res.status(400).json({ error: "documentId é obrigatório" }); return;
  }
  try {
    const book = await getShowBookOrFail(showBookId, res);
    if (!book) return;
    if (!(await positionInShowBook(positionId, showBookId))) {
      res.status(404).json({ error: "Posição não encontrada" }); return;
    }
    const [doc] = await db.select().from(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, documentId)).limit(1);
    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "ARCHIVED") { res.status(400).json({ error: "Documento arquivado não pode ser referenciado" }); return; }
    const [ref] = await db
      .insert(showBookPositionLibraryRefsTable)
      .values({ positionId, showBookId, documentId, label: label ?? null, addedBy: req.user!.sub })
      .returning();
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE",
      action: "ref_added",
      title: "Referência adicionada à posição",
      narrative: `Documento "${doc.title}" vinculado à posição no Livro do Show`,
      entityType: "show_book_position",
      entityId: positionId,
      actorId: req.user!.sub,
      operationId: book.operationId,
      metadata: { showBookId, documentId, refId: ref!.id },
    });
    res.status(201).json({ ref });
  } catch (err) {
    res.status(500).json({ error: "Erro ao adicionar referência" });
  }
});

router.delete("/show-books/:id/positions/:positionId/refs/:refId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const refId = req.params.refId as string;
  const role = req.user!.role as string;
  if (!MANAGER_ROLES.includes(role as any)) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  try {
    const book = await getShowBookOrFail(showBookId, res);
    if (!book) return;
    const [ref] = await db
      .select()
      .from(showBookPositionLibraryRefsTable)
      .where(and(
        eq(showBookPositionLibraryRefsTable.id, refId),
        eq(showBookPositionLibraryRefsTable.positionId, positionId),
        eq(showBookPositionLibraryRefsTable.showBookId, showBookId),
      ))
      .limit(1);
    if (!ref) { res.status(404).json({ error: "Referência não encontrada" }); return; }
    await db.delete(showBookPositionLibraryRefsTable)
      .where(and(
        eq(showBookPositionLibraryRefsTable.id, refId),
        eq(showBookPositionLibraryRefsTable.positionId, positionId),
        eq(showBookPositionLibraryRefsTable.showBookId, showBookId),
      ));
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE",
      action: "ref_removed",
      title: "Referência removida da posição",
      narrative: `Vínculo de documento removido da posição no Livro do Show`,
      entityType: "show_book_position",
      entityId: positionId,
      actorId: req.user!.sub,
      operationId: book.operationId,
      metadata: { showBookId, documentId: ref.documentId, refId },
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover referência" });
  }
});

router.get("/show-books/:id/refs", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const role = req.user!.role as string;
  const isManager = MANAGER_ROLES.includes(role as any);
  try {
    const book = await getShowBookOrFail(showBookId, res);
    if (!book) return;
    const baseWhere = eq(showBookPositionLibraryRefsTable.showBookId, showBookId);
    const rows = await db
      .select({
        ref: showBookPositionLibraryRefsTable,
        doc: {
          id:      libraryDocumentsTable.id,
          title:   libraryDocumentsTable.title,
          type:    libraryDocumentsTable.type,
          status:  libraryDocumentsTable.status,
          summary: libraryDocumentsTable.summary,
          version: libraryDocumentsTable.version,
        },
      })
      .from(showBookPositionLibraryRefsTable)
      .innerJoin(libraryDocumentsTable, eq(showBookPositionLibraryRefsTable.documentId, libraryDocumentsTable.id))
      .where(
        isManager
          ? baseWhere
          : and(baseWhere, inArray(libraryDocumentsTable.status, ["PUBLISHED", "UPDATED"]))
      );
    res.json({ refs: rows.map((r) => ({ ...r.ref, document: r.doc })) });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar referências do livro" });
  }
});

export default router;
