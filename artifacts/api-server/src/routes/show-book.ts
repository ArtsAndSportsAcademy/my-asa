import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
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
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";

const router: IRouter = Router();

async function getShowBookOrFail(id: string, res: any) {
  const [book] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, id)).limit(1);
  if (!book) {
    res.status(404).json({ error: "Livro do Show não encontrado" });
    return null;
  }
  return book;
}

async function fetchAllLines(positionIds: string[]) {
  if (positionIds.length === 0) return {} as Record<string, (typeof showBookLinesTable.$inferSelect)[]>;
  const allLines = await Promise.all(
    positionIds.map((pid) =>
      db
        .select()
        .from(showBookLinesTable)
        .where(eq(showBookLinesTable.positionId, pid))
        .orderBy(showBookLinesTable.order)
    )
  );
  const map: Record<string, (typeof showBookLinesTable.$inferSelect)[]> = {};
  positionIds.forEach((pid, idx) => { map[pid] = allLines[idx] ?? []; });
  return map;
}

async function buildShowBookTree(showBookId: string) {
  const scenes = await db
    .select().from(showBookScenesTable)
    .where(eq(showBookScenesTable.showBookId, showBookId))
    .orderBy(showBookScenesTable.order);

  const blocks = await db
    .select().from(showBookBlocksTable)
    .where(eq(showBookBlocksTable.showBookId, showBookId))
    .orderBy(showBookBlocksTable.order);

  const positions = await db
    .select().from(showBookRolesTable)
    .where(eq(showBookRolesTable.showBookId, showBookId))
    .orderBy(showBookRolesTable.order);

  const linesMap = await fetchAllLines(positions.map((p) => p.id));

  const posWithLines = positions.map((p) => ({ ...p, lines: linesMap[p.id] ?? [] }));

  const posByBlock: Record<string, typeof posWithLines> = {};
  posWithLines.forEach((p) => {
    const key = p.blockId ?? "__none";
    if (!posByBlock[key]) posByBlock[key] = [];
    posByBlock[key]!.push(p);
  });

  const blocksWithPos = blocks.map((b) => ({ ...b, positions: posByBlock[b.id] ?? [] }));

  const blocksByScene: Record<string, typeof blocksWithPos> = {};
  blocksWithPos.forEach((b) => {
    const key = b.sceneId ?? "__none";
    if (!blocksByScene[key]) blocksByScene[key] = [];
    blocksByScene[key]!.push(b);
  });

  return scenes.map((s) => ({ ...s, blocks: blocksByScene[s.id] ?? [] }));
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
    res.json({ showBook: { ...book, scenes: tree } });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar livro" });
  }
});

router.patch("/show-books/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { title, description, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const book = await getShowBookOrFail(id, res);
    if (!book) return;
    const [updated] = await db
      .update(showBooksTable)
      .set({ title: title ?? book.title, description: description ?? book.description, updatedAt: new Date() })
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
  const { name, order, isOptional, reason } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  if (!reason) { res.status(400).json({ error: "reason é obrigatório para mudança estrutural" }); return; }
  try {
    const book = await getShowBookOrFail(showBookId, res);
    if (!book) return;
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
  const { name, order, isOptional, reason, changeType } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
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
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    await db.delete(showBookScenesTable)
      .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId)));
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover cena" });
  }
});

router.post("/show-books/:id/blocks", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const { name, order, sceneId, reason } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const book = await getShowBookOrFail(showBookId, res);
    if (!book) return;
    const [block] = await db
      .insert(showBookBlocksTable)
      .values({ showBookId, name, order, sceneId: sceneId ?? null })
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
  const { name, order, reason, changeType } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (order !== undefined) updates.order = order;
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
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    await db.delete(showBookBlocksTable)
      .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId)));
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover bloco" });
  }
});

router.post("/show-books/:id/positions", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const { name, order, blockId, minimumCoverage, tagsJson, reason } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const book = await getShowBookOrFail(showBookId, res);
    if (!book) return;
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
  const { name, minimumCoverage, tagsJson, order, reason, changeType } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
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
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    await db.delete(showBookRolesTable)
      .where(and(eq(showBookRolesTable.id, positionId), eq(showBookRolesTable.showBookId, showBookId)));
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover posição" });
  }
});

router.post("/show-books/:id/positions/:positionId/lines", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const { type, config, order, reason } = req.body;
  if (!type) { res.status(400).json({ error: "type é obrigatório" }); return; }
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const [line] = await db
      .insert(showBookLinesTable)
      .values({ positionId, type, config: config ?? {}, order: order ?? 0 })
      .returning();
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(201).json({ line });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar linha" });
  }
});

router.patch("/show-books/:id/lines/:lineId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const lineId = req.params.lineId as string;
  const { config, order, reason, changeType } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
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
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.id, lineId));
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
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

export default router;
