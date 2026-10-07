import { Router, type IRouter } from "express";
import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  showBookDriveLinksTable,
  showBookKeyframesTable,
  stageFormatPresetsTable,
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
  charactersTable,
  characterCastTable,
  locationsTable,
  operationLocationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { eventBus } from "../lib/event-bus.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { buildShowBookTree, collectUserIdsFromConfig, resolveShowBookCast } from "../services/line-resolver.js";
import { detectShowBookResolveConflicts } from "../services/schedule-conflicts.js";
import { canManageShowBook, canOperateDailyBook, canViewShowBook, isOperationManager } from "../lib/show-responsibility.js";

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] as const;

const DEFAULT_STRUCTURAL_REASON = "Edição estrutural (sem motivo informado)";
/** Prefixo só é derivado na criação. O valor persistido nunca é recalculado ao
 * renomear um grupo: os rótulos são a chave dos quadros-chave já publicados. */
function deriveSlotPrefix(name: string): string {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (normalized === "BACKSTAGE LEFT") return "BL";
  if (normalized === "BACKSTAGE RIGHT") return "BR";
  if (normalized === "PAPEIS NOMEADOS") return "PER";
  const words = normalized.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((word) => word[0]).join("") : normalized.slice(0, 2) || "GR").slice(0, 4);
}
function isValidBlockTime(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

const router: IRouter = Router();

async function getShowBookOrFail(req: any, res: any) {
  const id = req.params.id as string;
  const [book] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, id)).limit(1);
  if (!book) {
    res.status(404).json({ error: "Livro do Show não encontrado" });
    return null;
  }
  // Isolamento multi-tenant: o show tem de pertencer à organização do ator. Usa
  // 404 (e não 403) para não revelar a existência de shows de outra organização.
  const [op] = await db
    .select({ organizationId: operationsTable.organizationId })
    .from(operationsTable)
    .where(eq(operationsTable.id, book.operationId))
    .limit(1);
  if (!op || op.organizationId !== req.user!.organizationId) {
    res.status(404).json({ error: "Livro do Show não encontrado" });
    return null;
  }
  return book;
}

// Guard de mutação: carrega o livro (via req.params.id) e confirma que o ator
// pode geri-lo (admin, responsável definido, ou qualquer gestor se não houver
// responsável). Devolve o livro ou null (já tendo respondido 404/403).
async function requireShowManage(req: any, res: any) {
  const book = await getShowBookOrFail(req, res);
  if (!book) return null;
  const actor = { sub: req.user!.sub, role: req.user!.role, operationIds: req.user!.operationIds };
  if (!(await canManageShowBook(actor, { id: book.id, responsibleId: book.responsibleId }, book.operationId))) {
    res.status(403).json({ error: "Forbidden", message: "Apenas o responsável por este show (ou um admin) pode editá-lo" });
    return null;
  }
  return book;
}

// Guard de leitura: carrega o livro (via req.params.id) e confirma que o ator
// pode vê-lo (admin; membro da operação do show; ou supervisor que o pode
// operar). Impede que um não-admin leia, via API direta, shows de outra
// operação ou o show de que outro supervisor é responsável.
async function requireShowView(req: any, res: any) {
  const book = await getShowBookOrFail(req, res);
  if (!book) return null;
  const actor = { sub: req.user!.sub, role: req.user!.role, operationIds: req.user!.operationIds };
  if (!(await canViewShowBook(actor, { id: book.id, responsibleId: book.responsibleId }, book.operationId))) {
    res.status(403).json({ error: "Forbidden", message: "Sem permissão para ver este Livro do Show" });
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function bumpVersion(
  showBookId: string,
  changeType: "STRUCTURAL" | "CONFIG",
  reason: string,
  createdBy: string,
  requestId?: string,
  correlationId?: string,
  executor: Tx | typeof db = db,
) {
  const [book] = await executor.select().from(showBooksTable).where(eq(showBooksTable.id, showBookId)).limit(1);
  if (!book) return;
  const newVersion = book.version + 1;
  await executor
    .update(showBooksTable)
    .set({ version: newVersion, updatedAt: new Date() })
    .where(eq(showBooksTable.id, showBookId));
  const tree = await buildShowBookTree(showBookId, executor as any);
  await executor.insert(showBookVersionsTable).values({
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

// Apaga posições (papéis) por completo, resolvendo as FKs que não têm cascade:
// as linhas pertencem à posição (apagar) e o histórico de escala aponta para ela
// (desligar, preservando os registos). As refs de biblioteca têm cascade no schema.
async function purgePositions(tx: Tx, positionIds: string[]) {
  if (positionIds.length === 0) return;
  await tx.update(showBookLinesTable).set({ active: false, updatedAt: new Date() }).where(and(inArray(showBookLinesTable.positionId, positionIds), eq(showBookLinesTable.active, true)));
  // Preservamos positionId para que alocações e exceções históricas continuem
  // apontando para a posição que existia no Livro do Show.
  await tx.update(showBookRolesTable).set({ active: false, updatedAt: new Date() }).where(and(inArray(showBookRolesTable.id, positionIds), eq(showBookRolesTable.active, true)));
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

async function sceneInShowBook(sceneId: string, showBookId: string): Promise<boolean> {
  const [row] = await db.select({ id: showBookScenesTable.id }).from(showBookScenesTable)
    .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId))).limit(1);
  return !!row;
}

async function blockInShowBook(blockId: string, showBookId: string): Promise<boolean> {
  const [row] = await db.select({ id: showBookBlocksTable.id }).from(showBookBlocksTable)
    .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId))).limit(1);
  return !!row;
}

async function driveLinkInShowBook(linkId: string, showBookId: string): Promise<boolean> {
  const [row] = await db.select({ id: showBookDriveLinksTable.id }).from(showBookDriveLinksTable)
    .where(and(eq(showBookDriveLinksTable.id, linkId), eq(showBookDriveLinksTable.showBookId, showBookId))).limit(1);
  return !!row;
}

async function keyframeInShowBook(keyframeId: string, showBookId: string) {
  const [row] = await db.select({ keyframe: showBookKeyframesTable, scene: showBookScenesTable })
    .from(showBookKeyframesTable)
    .innerJoin(showBookScenesTable, eq(showBookKeyframesTable.sceneId, showBookScenesTable.id))
    .where(and(eq(showBookKeyframesTable.id, keyframeId), eq(showBookScenesTable.showBookId, showBookId)))
    .limit(1);
  return row ?? null;
}

const KEYFRAME_TYPES = ["inicial", "splice", "locacao", "saida"] as const;
type KeyframeType = typeof KEYFRAME_TYPES[number];

function isPositionMap(value: unknown): value is Record<string, { x: number; y: number }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((position) => {
    if (!position || typeof position !== "object" || Array.isArray(position)) return false;
    const { x, y } = position as Record<string, unknown>;
    return typeof x === "number" && Number.isFinite(x) && x >= 4 && x <= 96
      && typeof y === "number" && Number.isFinite(y) && y >= 4 && y <= 96;
  });
}

function isStageFormat(value: unknown): value is "L" | "RET" | "QUAD" | "NONE" {
  return value === "L" || value === "RET" || value === "QUAD" || value === "NONE";
}

router.get("/show-books", requireAuth, requireOrganization, async (req, res) => {
  const { operationId } = req.query as { operationId?: string };
  try {
    // Isolamento multi-tenant: filtra SEMPRE pela organização do ator no SQL
    // (via join a operations), para que nem mesmo um admin veja shows de outra org.
    const orgId = req.user!.organizationId;
    const rows = await db
      .select({ book: showBooksTable, locationName: locationsTable.name })
      .from(showBooksTable)
      .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
      .leftJoin(locationsTable, eq(showBooksTable.locationId, locationsTable.id))
      .where(
        operationId
          ? and(
              eq(showBooksTable.operationId, operationId),
              eq(operationsTable.organizationId, orgId),
              eq(operationsTable.status, "ACTIVE"),
              ne(showBooksTable.status, "ARCHIVED"),
            )
          : and(
              eq(operationsTable.organizationId, orgId),
              eq(operationsTable.status, "ACTIVE"),
              ne(showBooksTable.status, "ARCHIVED"),
            ),
      );
    const all = rows.map((r) => ({ ...r.book, locationName: r.locationName ?? undefined }));
    // Escopo de leitura: filtra ao nível do servidor para que um não-admin só
    // receba os shows que pode ver (a sua operação / a sua responsabilidade),
    // mesmo chamando a API diretamente sem (ou com outro) operationId.
    const actor = { sub: req.user!.sub, role: req.user!.role, operationIds: req.user!.operationIds };
    const visible = await Promise.all(
      all.map((b) => canViewShowBook(actor, { id: b.id, responsibleId: b.responsibleId }, b.operationId)),
    );
    // Elenco lê a estante de shows: rascunho é trabalho da gestão e não aparece para ele,
    // exceto o show delegado a ele (capitão), que ele opera.
    const readable = await Promise.all(all.map((b, i) =>
      !visible[i] ? false
        : actor.role !== "MEMBER" || b.status === "PUBLISHED" ? true
        : canOperateDailyBook(actor, b.operationId, { id: b.id, responsibleId: b.responsibleId }),
    ));
    const books = all.filter((_, i) => readable[i]);
    res.json({ showBooks: books });
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao listar livros" });
  }
});

router.post("/show-books", requireAuth, requireOrganization, async (req, res) => {
  const { locationId, operationId: legacyOperationId, title, description, type, usesCharacters } = req.body;
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title é obrigatório" });
    return;
  }
  if (!["COMPLETE", "CHARACTERS_ONLY", "SIMPLE"].includes(type ?? "COMPLETE")) {
    res.status(400).json({ error: "type deve ser COMPLETE, CHARACTERS_ONLY ou SIMPLE" });
    return;
  }
  const userId = req.user!.sub;
  try {
    // Compatibilidade de API: integrações legadas ainda indicam a operação.
    // O formulário novo sempre usa Local, mas não pode transformar uma recusa
    // de escopo 403 em validação 400 só porque o campo visual mudou.
    if (!locationId && typeof legacyOperationId === "string") {
      const [legacyOperation] = await db.select({ id: operationsTable.id, status: operationsTable.status, organizationId: operationsTable.organizationId })
        .from(operationsTable).where(eq(operationsTable.id, legacyOperationId)).limit(1);
      if (!legacyOperation || legacyOperation.organizationId !== req.user!.organizationId) {
        res.status(404).json({ error: "Operação não encontrada" }); return;
      }
      const actor = { sub: req.user!.sub, role: req.user!.role, operationIds: req.user!.operationIds };
      if (!(await isOperationManager(actor, legacyOperationId))) {
        res.status(403).json({ error: "Forbidden", message: "Sem permissão para criar show nesta operação" }); return;
      }
      if (legacyOperation.status !== "ACTIVE") {
        res.status(409).json({ error: "OPERATION_NOT_ACTIVE", message: "Ative a operação antes de criar Livros do Show." }); return;
      }
      const book = await db.transaction(async (tx) => {
        const [created] = await tx.insert(showBooksTable).values({
          operationId: legacyOperationId, locationId: null, title: title.trim(), description: description ?? null,
          type: type ?? "COMPLETE", usesCharacters: usesCharacters === true, version: 1, status: "DRAFT", createdBy: userId,
        }).returning();
        await writeHistoryEvent({
          category: "OPERATIONAL_CHANGE", action: "show_book.created", title: "Show criado",
          narrative: `Show ${created!.title} criado como rascunho.`, entityType: "show_book", entityId: created!.id,
          actorId: userId, operationId: legacyOperationId, orgId: req.user!.organizationId, beforeState: null, afterState: created,
        }, tx as any);
        return created;
      });
      eventBus.emit("showbook.created", { showBookId: book!.id, operationId: legacyOperationId });
      res.status(201).json({ showBook: book });
      return;
    }
    if (!locationId) { res.status(400).json({ error: "locationId é obrigatório" }); return; }
    // Local é o vocabulário do cadastro. A operação continua só como contêiner
    // legado de autorização e é resolvida aqui, sem aparecer no formulário.
    const candidates = await db.select({ operationId: operationsTable.id, status: operationsTable.status })
      .from(operationLocationsTable)
      .innerJoin(operationsTable, eq(operationLocationsTable.operationId, operationsTable.id))
      .innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id))
      .where(and(eq(operationLocationsTable.locationId, locationId), eq(operationLocationsTable.active, true), eq(locationsTable.organizationId, req.user!.organizationId)));
    if (!candidates.length) {
      res.status(404).json({ error: "Local não encontrado ou sem operação ativa" });
      return;
    }
    const actor = { sub: req.user!.sub, role: req.user!.role, operationIds: req.user!.operationIds };
    const authorized = (await Promise.all(candidates.map(async candidate => (await isOperationManager(actor, candidate.operationId)) ? candidate : null))).filter((candidate): candidate is (typeof candidates)[number] => candidate !== null);
    if (!authorized.length) {
      res.status(403).json({ error: "Forbidden", message: "Sem permissão para criar show neste local" });
      return;
    }
    if (authorized.length > 1) {
      res.status(409).json({ error: "LOCAL_OPERATION_AMBIGUOUS", message: "Este local está ligado a mais de uma operação. Ajuste o contexto operacional antes de criar o show." });
      return;
    }
    const operationId = authorized[0]!.operationId;
    if (authorized[0]!.status !== "ACTIVE") {
      res.status(409).json({
        error: "OPERATION_NOT_ACTIVE",
        message: "Ative a operação antes de criar Livros do Show.",
      });
      return;
    }
    // Criar o show entra no Registro na mesma transação (06/10: antes não ficava registrado).
    const book = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(showBooksTable)
        .values({
          operationId,
          locationId,
          title: title.trim(),
          description: description ?? null,
          type: type ?? "COMPLETE",
          usesCharacters: usesCharacters === true,
          version: 1,
          status: "DRAFT",
          createdBy: userId,
        })
        .returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.created", title: "Show criado",
        narrative: `Show ${created!.title} criado como rascunho.`, entityType: "show_book", entityId: created!.id,
        actorId: userId, operationId, orgId: req.user!.organizationId, beforeState: null, afterState: created,
      }, tx as any);
      return created;
    });
    eventBus.emit("showbook.created", { showBookId: book!.id, operationId });
    res.status(201).json({ showBook: book });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar livro" });
  }
});

router.get("/show-books/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  try {
    const book = await requireShowView(req, res);
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
    const book = await requireShowView(req, res);
    if (!book) return;
    // dedupPerScene: a mesma pessoa não pode ocupar dois papéis na mesma cena —
    // quem já foi escalado numa posição é saltado nas seguintes (puxa o próximo
    // substituto/rodízio). Mantém a Conferência por data coerente com o Livro do Dia.
    const resolution = await resolveShowBookCast(id, book.operationId, date, { dedupPerScene: true });
    const userIds = new Set<string>();
    for (const scene of resolution.scenes) {
      for (const block of scene.blocks) {
        for (const position of block.positions) {
          for (const line of position.lines) for (const person of line.people) userIds.add(person.userId);
        }
      }
    }
    const conflicts = await detectShowBookResolveConflicts({ showBookId: id, operationId: book.operationId, date, userIds: [...userIds] });
    res.json({ resolution, conflicts });
  } catch (err) {
    const log = requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "");
    log.error({ err, showBookId: id, date }, "Erro ao resolver elenco por data");
    res.status(500).json({ error: "Erro ao resolver elenco por data" });
  }
});

router.patch("/show-books/:id", requireAuth, requireOrganization, async (req, res) => {
  const id = req.params.id as string;
  const { title, description, startTime, endTime, details, reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try {
    const book = await requireShowManage(req, res);
    if (!book) return;
    const updated = await db.transaction(async (tx) => {
      const [next] = await tx
        .update(showBooksTable)
        .set({
          title: title ?? book.title,
          description: description ?? book.description,
          startTime: "startTime" in req.body ? (startTime || null) : book.startTime,
          endTime: "endTime" in req.body ? (endTime || null) : book.endTime,
          details: details === undefined ? (book as any).details : details,
          updatedAt: new Date(),
        } as any)
        .where(eq(showBooksTable.id, id))
        .returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.updated",
        title: "Livro do Show atualizado", narrative: `Informações do show ${book.title} atualizadas.`,
        entityType: "show_book", entityId: id, actorId: req.user!.sub,
        operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: book, afterState: next, metadata: { reason },
      }, tx as any);
      await bumpVersion(id, "CONFIG", reason, req.user!.sub, req.requestId, req.correlationId, tx as any);
      return next;
    });
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
    const updated = await db.transaction(async (tx) => {
      const [next] = await tx
        .update(showBooksTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(showBooksTable.id, id))
        .returning();
      if (!next) return undefined;
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: `show_book.status.${status.toLowerCase()}`,
        title: status === "PUBLISHED" ? "Livro do Show publicado" : "Estado do Livro do Show alterado",
        narrative: status === "PUBLISHED" ? `Livro do Show ${guard.title} publicado.` : `Livro do Show ${guard.title} movido para ${status}.`,
        entityType: "show_book", entityId: id, actorId: req.user!.sub,
        operationId: guard.operationId, orgId: req.user!.organizationId,
        beforeState: guard, afterState: next, metadata: { reason },
      }, tx as any);
      return next;
    });
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
    const book = await getShowBookOrFail(req, res);
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
    // Trocar o responsável entra no Registro na mesma transação (06/10: antes não ficava registrado).
    const nomeDe = async (userId: string | null | undefined) => userId
      ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.name ?? null
      : null;
    const [antes, depois] = await Promise.all([nomeDe(book.responsibleId), nomeDe(responsibleId)]);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(showBooksTable)
        .set({ responsibleId: responsibleId ?? null, updatedAt: new Date() })
        .where(eq(showBooksTable.id, id))
        .returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.responsible_changed", title: "Responsável do show alterado",
        narrative: `${book.title}: responsável ${antes ?? "nenhum"} → ${depois ?? "nenhum"}.`, entityType: "show_book", entityId: id,
        actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: { responsibleId: book.responsibleId ?? null }, afterState: { responsibleId: responsibleId ?? null },
      }, tx as any);
      return row;
    });
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
    const book = await getShowBookOrFail(req, res);
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
      const roles = await tx.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(and(eq(showBookRolesTable.showBookId, id), eq(showBookRolesTable.active, true)));
      const roleIds = roles.map((r) => r.id);
      if (roleIds.length > 0) {
        await tx.update(showBookLinesTable).set({ active: false, updatedAt: new Date() }).where(and(inArray(showBookLinesTable.positionId, roleIds), eq(showBookLinesTable.active, true)));
      }
      await tx.update(showBookRolesTable).set({ active: false, updatedAt: new Date() }).where(and(eq(showBookRolesTable.showBookId, id), eq(showBookRolesTable.active, true)));
      await tx.update(showBookBlocksTable).set({ active: false, updatedAt: new Date() }).where(and(eq(showBookBlocksTable.showBookId, id), eq(showBookBlocksTable.active, true)));
      await tx.update(showBookScenesTable).set({ active: false, updatedAt: new Date() }).where(and(eq(showBookScenesTable.showBookId, id), eq(showBookScenesTable.active, true)));
      const [archived] = await tx.update(showBooksTable).set({ status: "ARCHIVED", updatedAt: new Date() })
        .where(and(eq(showBooksTable.id, id), eq(showBooksTable.status, book.status))).returning();
      if (!archived) throw new Error("Livro do Show foi alterado antes do arquivamento");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.archived",
        title: "Livro do Show arquivado", narrative: `O Livro do Show ${book.title} foi arquivado sem apagar seu histórico.`,
        entityType: "show_book", entityId: id, actorId: req.user!.sub,
        operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: book, afterState: archived,
        metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
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
    const book = await requireShowView(req, res);
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

// ─── Quadros-chave e preset do palco ────────────────────────────────────────
// O quadro inicial é fonte estável do Livro do Dia. Coordenadas de marcadores
// são sempre substituídas como um JSON inteiro do quadro (nunca em linhas soltas).
router.post("/show-books/:id/scenes/:sceneId/keyframes", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const sceneId = req.params.sceneId as string;
  const { name, order, type, moment, markerPositions } = req.body as {
    name?: unknown; order?: unknown; type?: unknown; moment?: unknown; markerPositions?: unknown;
  };
  if (typeof name !== "string" || !name.trim()) { res.status(400).json({ error: "name é obrigatório" }); return; }
  if (type !== undefined && type !== null && !KEYFRAME_TYPES.includes(type as KeyframeType)) { res.status(400).json({ error: "type inválido" }); return; }
  if (markerPositions !== undefined && !isPositionMap(markerPositions)) { res.status(400).json({ error: "markerPositions precisa ser um JSON de coordenadas entre 4% e 96%" }); return; }
  try {
    const book = await requireShowManage(req, res);
    if (!book) return;
    if (!(await sceneInShowBook(sceneId, showBookId))) { res.status(404).json({ error: "Cena não encontrada" }); return; }
    const reason = typeof req.body.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : DEFAULT_STRUCTURAL_REASON;
    const result = await db.transaction(async (tx) => {
      const previousInitial = type === "inicial"
        ? await tx.select().from(showBookKeyframesTable).where(and(eq(showBookKeyframesTable.sceneId, sceneId), eq(showBookKeyframesTable.active, true), eq(showBookKeyframesTable.type, "inicial"))).limit(1)
        : [];
      if (previousInitial[0]) {
        // Não atribuímos splice/saída por adivinhação: o quadro antigo fica sem
        // classificação e a resposta avisa a supervisão para concluí-la.
        await tx.update(showBookKeyframesTable).set({ type: null, updatedAt: new Date() }).where(eq(showBookKeyframesTable.id, previousInitial[0].id));
      }
      const [created] = await tx.insert(showBookKeyframesTable).values({
        sceneId,
        name: name.trim(),
        order: typeof order === "number" ? order : (await tx.select({ count: showBookKeyframesTable.id }).from(showBookKeyframesTable).where(eq(showBookKeyframesTable.sceneId, sceneId))).length,
        type: (type ?? null) as KeyframeType | null,
        moment: typeof moment === "string" && moment.trim() ? moment.trim() : null,
        markerPositions: (markerPositions ?? {}) as Record<string, { x: number; y: number }>,
      }).returning();
      const version = await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId, tx);
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.keyframe_created", title: "Quadro-chave criado",
        narrative: `Quadro-chave ${created!.name} criado na cena ${sceneId}.`, entityType: "show_book_keyframe", entityId: created!.id,
        actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: null, afterState: created!, metadata: { showBookId, sceneId, version, reason },
      }, tx as any);
      return { keyframe: created!, warning: previousInitial[0] ? `“${previousInitial[0].name}” deixou de ser inicial e ficou sem tipo; classifique-o antes de publicar.` : null };
    });
    res.status(201).json(result);
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "").error({ err, showBookId, sceneId }, "Erro ao criar quadro-chave");
    res.status(500).json({ error: "Erro ao criar quadro-chave" });
  }
});

router.patch("/show-books/:id/keyframes/:keyframeId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const keyframeId = req.params.keyframeId as string;
  const { name, order, type, moment, markerPositions } = req.body as Record<string, unknown>;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) { res.status(400).json({ error: "name não pode ficar vazio" }); return; }
  if (type !== undefined && type !== null && !KEYFRAME_TYPES.includes(type as KeyframeType)) { res.status(400).json({ error: "type inválido" }); return; }
  if (markerPositions !== undefined && !isPositionMap(markerPositions)) { res.status(400).json({ error: "markerPositions precisa ser um JSON de coordenadas entre 4% e 96%" }); return; }
  try {
    const book = await requireShowManage(req, res);
    if (!book) return;
    const owned = await keyframeInShowBook(keyframeId, showBookId);
    if (!owned || !owned.keyframe.active) { res.status(404).json({ error: "Quadro-chave não encontrado" }); return; }
    const reason = typeof req.body.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : DEFAULT_STRUCTURAL_REASON;
    const result = await db.transaction(async (tx) => {
      const previousInitial = type === "inicial"
        ? await tx.select().from(showBookKeyframesTable).where(and(eq(showBookKeyframesTable.sceneId, owned.keyframe.sceneId), eq(showBookKeyframesTable.active, true), eq(showBookKeyframesTable.type, "inicial"), ne(showBookKeyframesTable.id, keyframeId))).limit(1)
        : [];
      if (previousInitial[0]) await tx.update(showBookKeyframesTable).set({ type: null, updatedAt: new Date() }).where(eq(showBookKeyframesTable.id, previousInitial[0].id));
      const changes: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) changes.name = (name as string).trim();
      if (typeof order === "number") changes.order = order;
      if (type !== undefined) changes.type = type as KeyframeType | null;
      if (moment !== undefined) changes.moment = typeof moment === "string" && moment.trim() ? moment.trim() : null;
      if (markerPositions !== undefined) changes.markerPositions = markerPositions;
      const [updated] = await tx.update(showBookKeyframesTable).set(changes as any).where(eq(showBookKeyframesTable.id, keyframeId)).returning();
      const version = await bumpVersion(showBookId, "CONFIG", reason, req.user!.sub, req.requestId, req.correlationId, tx);
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.keyframe_updated", title: "Quadro-chave atualizado",
        narrative: `Quadro-chave ${updated!.name} atualizado.`, entityType: "show_book_keyframe", entityId: keyframeId,
        actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: owned.keyframe, afterState: updated!, metadata: { showBookId, sceneId: owned.scene.id, version, reason },
      }, tx as any);
      return { keyframe: updated!, warning: previousInitial[0] ? `“${previousInitial[0].name}” deixou de ser inicial e ficou sem tipo; classifique-o antes de publicar.` : null };
    });
    res.json(result);
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "").error({ err, showBookId, keyframeId }, "Erro ao atualizar quadro-chave");
    res.status(500).json({ error: "Erro ao atualizar quadro-chave" });
  }
});

router.delete("/show-books/:id/keyframes/:keyframeId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const keyframeId = req.params.keyframeId as string;
  try {
    const book = await requireShowManage(req, res);
    if (!book) return;
    const owned = await keyframeInShowBook(keyframeId, showBookId);
    if (!owned || !owned.keyframe.active) { res.status(404).json({ error: "Quadro-chave não encontrado" }); return; }
    const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : DEFAULT_STRUCTURAL_REASON;
    const result = await db.transaction(async (tx) => {
      const activeFrames = await tx.select({ id: showBookKeyframesTable.id }).from(showBookKeyframesTable)
        .where(and(eq(showBookKeyframesTable.sceneId, owned.keyframe.sceneId), eq(showBookKeyframesTable.active, true)));
      if (activeFrames.length <= 1) {
        const error = new Error("A cena precisa manter pelo menos um quadro-chave");
        (error as Error & { status?: number }).status = 409;
        throw error;
      }
      const [updated] = await tx.update(showBookKeyframesTable).set({ active: false, updatedAt: new Date() }).where(eq(showBookKeyframesTable.id, keyframeId)).returning();
      const version = await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId, tx);
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.keyframe_archived", title: "Quadro-chave desativado",
        narrative: `Quadro-chave ${owned.keyframe.name} desativado sem apagar o histórico.`, entityType: "show_book_keyframe", entityId: keyframeId,
        actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: owned.keyframe, afterState: updated!, metadata: { showBookId, sceneId: owned.scene.id, version, reason },
      }, tx as any);
      return { warning: owned.keyframe.type === "inicial" ? "O quadro inicial foi removido. Eleja outro quadro como inicial antes de gerar o Livro do Dia." : null };
    });
    res.json(result);
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    res.status(status ?? 500).json({ error: status ? (err as Error).message : "Erro ao desativar quadro-chave" });
  }
});

router.get("/show-books/:id/stage-formats/:format/zones", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const format = req.params.format;
  if (!isStageFormat(format)) { res.status(400).json({ error: "Formato de palco inválido" }); return; }
  try {
    if (!(await requireShowView(req, res))) return;
    const [preset] = await db.select().from(stageFormatPresetsTable)
      .where(and(eq(stageFormatPresetsTable.organizationId, req.user!.organizationId), eq(stageFormatPresetsTable.format, format))).limit(1);
    res.json({ zonePositions: preset?.zonePositions ?? {} });
  } catch { res.status(500).json({ error: "Erro ao buscar posições das zonas" }); }
});

router.put("/show-books/:id/stage-formats/:format/zones", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const format = req.params.format;
  const { zonePositions } = req.body as { zonePositions?: unknown };
  if (!isStageFormat(format)) { res.status(400).json({ error: "Formato de palco inválido" }); return; }
  if (!isPositionMap(zonePositions)) { res.status(400).json({ error: "zonePositions precisa ser um JSON de coordenadas entre 4% e 96%" }); return; }
  try {
    const book = await requireShowManage(req, res);
    if (!book) return;
    const reason = typeof req.body.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : DEFAULT_STRUCTURAL_REASON;
    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(stageFormatPresetsTable)
        .where(and(eq(stageFormatPresetsTable.organizationId, req.user!.organizationId), eq(stageFormatPresetsTable.format, format))).limit(1);
      const [preset] = before
        ? await tx.update(stageFormatPresetsTable).set({ zonePositions, updatedAt: new Date() }).where(eq(stageFormatPresetsTable.id, before.id)).returning()
        : await tx.insert(stageFormatPresetsTable).values({ organizationId: req.user!.organizationId, format, zonePositions }).returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "stage_format.zones_updated", title: "Zonas do palco atualizadas",
        narrative: `Zonas do formato ${format} atualizadas para todos os shows que usam este palco.`, entityType: "stage_format_preset", entityId: preset!.id,
        actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: before ?? null, afterState: preset!, metadata: { format, showBookId, reason },
      }, tx as any);
      return preset!;
    });
    res.json({ preset: result });
  } catch { res.status(500).json({ error: "Erro ao atualizar zonas do palco" }); }
});

router.post("/show-books/:id/scenes", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const { name, order, isOptional } = req.body;
  if (!name || order === undefined) { res.status(400).json({ error: "name e order são obrigatórios" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    // Show "só personagens" não tem cena nem mapa: os personagens ficam no quadro de vagas.
    if (guard.type === "CHARACTERS_ONLY") { res.status(400).json({ error: "Show só de personagens não tem cenas nem mapa" }); return; }
    const scene = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(showBookScenesTable)
        .values({ showBookId, name, order, isOptional: isOptional ?? false })
        .returning();
      // O trio nasce pronto para o caso comum de Snowland, mas continua sendo
      // apenas o ponto de partida: cada cena pode criar, editar ou retirar seus grupos.
      const groups = [
        { name: "Backstage left", prefix: "BL", zone: "BACKSTAGE LEFT" },
        { name: "Backstage right", prefix: "BR", zone: "BACKSTAGE RIGHT" },
        { name: "Papéis nomeados", prefix: "PER", zone: "CENTRO" },
      ];
      await tx.insert(showBookBlocksTable).values(groups.map((group, groupOrder) => ({
        showBookId, sceneId: created!.id, order: groupOrder, ...group,
      })));
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.scene.created",
        title: "Cena criada", narrative: `Cena ${created!.name} criada com grupos-base.`,
        entityType: "show_book_scene", entityId: created!.id, actorId: req.user!.sub,
        operationId: guard.operationId, orgId: req.user!.organizationId,
        beforeState: null, afterState: created, metadata: { reason },
      }, tx as any);
      await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId, tx as any);
      return created!;
    });
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
        .where(and(eq(showBookBlocksTable.sceneId, sceneId), eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true)));
      const blockIds = blocks.map((b) => b.id);
      if (blockIds.length > 0) {
        const positions = await tx.select({ id: showBookRolesTable.id })
          .from(showBookRolesTable)
          .where(and(inArray(showBookRolesTable.blockId, blockIds), eq(showBookRolesTable.showBookId, showBookId)));
        await purgePositions(tx, positions.map((p) => p.id));
        await tx.update(showBookBlocksTable).set({ active: false, updatedAt: new Date() })
          .where(and(inArray(showBookBlocksTable.id, blockIds), eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true)));
      }
      await tx.update(showBookScenesTable).set({ active: false, updatedAt: new Date() })
        .where(and(eq(showBookScenesTable.id, sceneId), eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.active, true)));
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
  const { name, order, sceneId, startTime, endTime, zone, prefix, color } = req.body;
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
    const normalizedPrefix = String(prefix ?? deriveSlotPrefix(name)).trim().toUpperCase();
    const [block] = await db
      .insert(showBookBlocksTable)
      .values({ showBookId, name, order, sceneId: sceneId ?? null, startTime: startTime ?? null, endTime: endTime ?? null, zone: zone ?? "CENTRO", prefix: normalizedPrefix, color: typeof color === "string" ? color : null } as any)
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
  const { name, order, changeType, startTime, endTime, zone, prefix, color } = req.body;
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
    if (zone !== undefined) updates.zone = zone;
    if (prefix !== undefined) updates.prefix = String(prefix).trim().toUpperCase();
    if (color !== undefined) updates.color = color;
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
  const confirm = req.body.confirm === true;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const [owned] = await db.select({ id: showBookBlocksTable.id }).from(showBookBlocksTable)
      .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId)));
    if (!owned) { res.status(404).json({ error: "Bloco não encontrado" }); return; }
    const [usage] = await db.select({ count: sql<number>`count(*)::int` }).from(showBookRolesTable)
      .where(and(eq(showBookRolesTable.blockId, blockId), eq(showBookRolesTable.active, true)));
    if ((usage?.count ?? 0) > 0 && !confirm) { res.status(409).json({ error: "Confirmação necessária", slots: usage!.count, message: `Este grupo contém ${usage!.count} slots. Confirme para removê-los logicamente.` }); return; }
    await db.transaction(async (tx) => {
      const positions = await tx.select({ id: showBookRolesTable.id })
        .from(showBookRolesTable)
        .where(and(eq(showBookRolesTable.blockId, blockId), eq(showBookRolesTable.showBookId, showBookId)));
      await purgePositions(tx, positions.map((p) => p.id));
      await tx.update(showBookBlocksTable).set({ active: false, updatedAt: new Date() })
        .where(and(eq(showBookBlocksTable.id, blockId), eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true)));
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
  const { name, minimumCoverage, tagsJson, order, changeType, positionJson } = req.body;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (minimumCoverage !== undefined) updates.minimumCoverage = minimumCoverage;
    if (tagsJson !== undefined) updates.tagsJson = tagsJson;
    if (positionJson !== undefined) updates.positionJson = positionJson;
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
  const { type, config, order, characterId } = req.body;
  if (!type) { res.status(400).json({ error: "type é obrigatório" }); return; }
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (!(await positionInShowBook(positionId, showBookId))) {
      res.status(404).json({ error: "Posição não encontrada" }); return;
    }
    if (characterId) {
      const [character] = await db
        .select({ id: charactersTable.id })
        .from(charactersTable)
        .innerJoin(locationsTable, eq(charactersTable.locationId, locationsTable.id))
        .where(and(
          eq(charactersTable.id, characterId),
          eq(locationsTable.organizationId, req.user!.organizationId),
        ))
        .limit(1);
      if (!character) { res.status(404).json({ error: "Personagem não encontrado" }); return; }
    }
    const [line] = await db
      .insert(showBookLinesTable)
      .values({ positionId, characterId: characterId ?? null, type, config: config ?? {}, order: order ?? 0 })
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
  const { type, config, order, characterId, changeType } = req.body;
  const reason: string = req.body.reason || DEFAULT_STRUCTURAL_REASON;
  try {
    const guard = await requireShowManage(req, res);
    if (!guard) return;
    if (!(await lineInShowBook(lineId, showBookId))) {
      res.status(404).json({ error: "Linha não encontrada" }); return;
    }
    if (characterId) {
      const [character] = await db
        .select({ id: charactersTable.id })
        .from(charactersTable)
        .innerJoin(locationsTable, eq(charactersTable.locationId, locationsTable.id))
        .where(and(
          eq(charactersTable.id, characterId),
          eq(locationsTable.organizationId, req.user!.organizationId),
        ))
        .limit(1);
      if (!character) { res.status(404).json({ error: "Personagem não encontrado" }); return; }
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (type !== undefined) updates.type = type;
    if (characterId !== undefined) updates.characterId = characterId || null;
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
    await db.update(showBookLinesTable).set({ active: false, updatedAt: new Date() })
      .where(and(eq(showBookLinesTable.id, lineId), eq(showBookLinesTable.active, true)));
    await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId);
    res.status(204).send();
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "")
      .error({ err, showBookId, lineId }, "Erro ao remover linha");
    res.status(500).json({ error: "Erro ao remover linha" });
  }
});

// ─── Titular e substitutos de posição-base ─────────────────────────────────
// A linha pertence ao slot/posição, não à pessoa. Assim o titular pode mudar
// sem perder a ordem dos substitutos que a operação já montou.
router.get("/show-books/:id/positions/:positionId/cast", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  try {
    const book = await requireShowView(req, res); if (!book) return;
    if (!(await positionInShowBook(positionId, showBookId))) { res.status(404).json({ error: "Slot não encontrado" }); return; }
    const [line] = await db.select().from(showBookLinesTable)
      .where(and(eq(showBookLinesTable.positionId, positionId), eq(showBookLinesTable.type, "TITULAR_SUBSTITUTE"), eq(showBookLinesTable.active, true)))
      .orderBy(showBookLinesTable.order, showBookLinesTable.id).limit(1);
    res.json({ line: line ?? null });
  } catch { res.status(500).json({ error: "Erro ao consultar elenco do slot" }); }
});

router.put("/show-books/:id/positions/:positionId/cast", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string;
  const positionId = req.params.positionId as string;
  const { titularId, substituteIds, reason } = req.body as { titularId?: string | null; substituteIds?: unknown; reason?: string };
  if (!reason?.trim()) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  if (substituteIds !== undefined && (!Array.isArray(substituteIds) || substituteIds.some((id) => typeof id !== "string"))) { res.status(400).json({ error: "substituteIds inválido" }); return; }
  const orderedSubs = Array.from(new Set((substituteIds ?? []).filter((id): id is string => typeof id === "string" && id !== titularId)));
  try {
    const book = await requireShowManage(req, res); if (!book) return;
    if (!(await positionInShowBook(positionId, showBookId))) { res.status(404).json({ error: "Slot não encontrado" }); return; }
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(showBookLinesTable)
        .where(and(eq(showBookLinesTable.positionId, positionId), eq(showBookLinesTable.type, "TITULAR_SUBSTITUTE"), eq(showBookLinesTable.active, true)))
        .orderBy(showBookLinesTable.order, showBookLinesTable.id).limit(1);
      const config = { titularId: titularId ?? null, substituteIds: orderedSubs };
      const [line] = current
        ? await tx.update(showBookLinesTable).set({ config, updatedAt: new Date() }).where(eq(showBookLinesTable.id, current.id)).returning()
        : await tx.insert(showBookLinesTable).values({ positionId, type: "TITULAR_SUBSTITUTE", config, order: 0 }).returning();
      await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.slot_cast.updated", title: "Titular e substitutos do slot atualizados", narrative: "A ordem do elenco do slot foi atualizada.", entityType: "show_book_position", entityId: positionId, actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId, beforeState: current ?? null, afterState: line, metadata: { reason } }, tx as any);
      await bumpVersion(showBookId, "CONFIG", reason, req.user!.sub, req.requestId, req.correlationId, tx as any);
      return line;
    });
    res.json({ line: result });
  } catch (err) { requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "").error({ err, showBookId, positionId }, "Erro ao atualizar elenco do slot"); res.status(500).json({ error: "Erro ao atualizar elenco do slot" }); }
});

// ─── Personagens e vagas do show (0059) ─────────────────────────────────────
// Cada vaga é uma posição na cena reservada do show, ligada a um personagem por uma linha
// CHARACTER. A vaga exclusiva (P1, Boas vindas 1…) é um personagem com showBookId; o
// compartilhado (Astrid, Rainha) é um personagem do local reaproveitado por vários shows.
// Assim a fila, o titular × rodízio e a contagem ficam num lugar só: o personagem.
const CAST_ROSTER_SCENE_NAME = "Personagens do show";

class VagaConflict extends Error {}

async function ensureCastRoster(tx: Tx, showBookId: string) {
  const [scene] = await tx.select().from(showBookScenesTable).where(and(
    eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.isCastRoster, true), eq(showBookScenesTable.active, true),
  )).limit(1);
  const roster = scene ?? (await tx.insert(showBookScenesTable).values({
    showBookId, name: CAST_ROSTER_SCENE_NAME, order: 0, isCastRoster: true,
  }).returning())[0]!;
  const [block] = await tx.select().from(showBookBlocksTable).where(and(
    eq(showBookBlocksTable.sceneId, roster.id), eq(showBookBlocksTable.active, true),
  )).orderBy(showBookBlocksTable.order).limit(1);
  return block ?? (await tx.insert(showBookBlocksTable).values({
    showBookId, sceneId: roster.id, name: "Personagens", order: 0, zone: "CENTRO", prefix: "PER",
  }).returning())[0]!;
}

function isUniqueViolation(err: unknown) {
  const error = err as { code?: string; cause?: { code?: string } } | null;
  return error?.code === "23505" || error?.cause?.code === "23505";
}

router.post("/show-books/:id/vagas", requireAuth, requireOrganization, async (req, res) => {
  const { characterId, name, mode, memberIds } = (req.body ?? {}) as { characterId?: unknown; name?: unknown; mode?: unknown; memberIds?: unknown };
  try {
    const book = await requireShowManage(req, res); if (!book) return;
    if (book.type === "SIMPLE") { res.status(400).json({ error: "Show de formação não tem personagens" }); return; }
    if (!book.locationId) { res.status(400).json({ error: "Defina o local do show antes de cadastrar personagens" }); return; }
    let shared: typeof charactersTable.$inferSelect | null = null;
    let queue: string[] = [];
    let vagaName = "";
    let vagaMode: "titular" | "rodizio" = "rodizio";
    if (characterId !== undefined) {
      if (typeof characterId !== "string") { res.status(400).json({ error: "characterId inválido" }); return; }
      const [character] = await db.select().from(charactersTable)
        .where(and(eq(charactersTable.id, characterId), eq(charactersTable.active, true))).limit(1);
      if (!character || character.locationId !== book.locationId) { res.status(404).json({ error: "Personagem não encontrado neste local" }); return; }
      if (character.showBookId && character.showBookId !== book.id) { res.status(409).json({ error: "Este personagem é uma vaga de outro show" }); return; }
      shared = character;
    } else {
      vagaName = typeof name === "string" ? name.trim() : "";
      if (!vagaName || vagaName.length > 80) { res.status(400).json({ error: "Nome da vaga é obrigatório (até 80 caracteres)" }); return; }
      if (mode !== "titular" && mode !== "rodizio") { res.status(400).json({ error: "Tipo deve ser titular ou rodízio" }); return; }
      vagaMode = mode;
      if (!Array.isArray(memberIds) || !memberIds.length || memberIds.some((id) => typeof id !== "string") || new Set(memberIds).size !== memberIds.length) {
        res.status(400).json({ error: "A fila precisa de pessoas, sem repetir" }); return;
      }
      queue = memberIds as string[];
      const people = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(inArray(usersTable.id, queue), eq(usersTable.organizationId, req.user!.organizationId)));
      if (people.length !== queue.length) { res.status(400).json({ error: "Há pessoa fora do cadastro na fila" }); return; }
    }
    const result = await db.transaction(async (tx) => {
      const block = await ensureCastRoster(tx, book.id);
      const current = await tx.select({ id: showBookRolesTable.id, order: showBookRolesTable.order, characterId: showBookLinesTable.characterId })
        .from(showBookRolesTable)
        .leftJoin(showBookLinesTable, and(eq(showBookLinesTable.positionId, showBookRolesTable.id), eq(showBookLinesTable.active, true)))
        .where(and(eq(showBookRolesTable.blockId, block.id), eq(showBookRolesTable.active, true)));
      let character = shared;
      if (character && current.some((row) => row.characterId === character!.id)) throw new VagaConflict("Este personagem já está neste show");
      if (!character) {
        const [created] = await tx.insert(charactersTable).values({
          name: vagaName, locationId: book.locationId!, mode: vagaMode, showBookId: book.id, active: true,
        }).returning();
        await tx.insert(characterCastTable).values(queue.map((personId, order) => ({
          characterId: created!.id, personId, order, timesDone: 0, active: true,
        })));
        character = created!;
      }
      const [position] = await tx.insert(showBookRolesTable).values({
        // Entra no fim da lista, mesmo depois de reordenar ou tirar vagas.
        showBookId: book.id, blockId: block.id, name: character.name, order: Math.max(-1, ...current.map((row) => row.order)) + 1,
      }).returning();
      await tx.insert(showBookLinesTable).values({ positionId: position!.id, characterId: character.id, type: "CHARACTER", config: {}, order: 0 });
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: shared ? "show_book.vaga.linked" : "show_book.vaga.created",
        title: shared ? "Personagem ligado ao show" : "Vaga criada no show",
        narrative: `${book.title}: ${character.name} (${character.mode === "titular" ? "titular" : "rodízio"}) ${shared ? "passa a entrar no show" : "criada no show"}.`,
        entityType: "show_book_position", entityId: position!.id, actorId: req.user!.sub,
        operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: null, afterState: { position, character, fila: shared ? undefined : queue },
      }, tx as any);
      await bumpVersion(book.id, "STRUCTURAL", "Vaga de personagem acrescentada", req.user!.sub, req.requestId, req.correlationId, tx as any);
      return { position, character };
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof VagaConflict) { res.status(409).json({ error: err.message }); return; }
    if (isUniqueViolation(err)) { res.status(409).json({ error: "Já existe uma vaga com esse nome neste show" }); return; }
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "").error({ err, showBookId: req.params.id }, "Erro ao criar vaga");
    res.status(500).json({ error: "Erro ao criar vaga" });
  }
});

// A ordem das vagas é a ordem em que o Livro do Dia escala (depois das titulares): quem vem
// depois não repete quem já foi escalado. A lista enviada tem de ser exatamente a atual.
router.put("/show-books/:id/vagas/order", requireAuth, requireOrganization, async (req, res) => {
  const positionIds = (req.body ?? {}).positionIds as unknown;
  if (!Array.isArray(positionIds) || positionIds.some((id) => typeof id !== "string") || new Set(positionIds).size !== positionIds.length) {
    res.status(400).json({ error: "positionIds deve ser uma lista sem repetições" }); return;
  }
  try {
    const book = await requireShowManage(req, res); if (!book) return;
    const current = await db.select({ id: showBookRolesTable.id, name: showBookRolesTable.name, order: showBookRolesTable.order })
      .from(showBookRolesTable)
      .innerJoin(showBookBlocksTable, eq(showBookRolesTable.blockId, showBookBlocksTable.id))
      .innerJoin(showBookScenesTable, eq(showBookBlocksTable.sceneId, showBookScenesTable.id))
      .where(and(
        eq(showBookRolesTable.showBookId, book.id), eq(showBookRolesTable.active, true),
        eq(showBookScenesTable.isCastRoster, true), eq(showBookScenesTable.active, true),
      ))
      .orderBy(showBookRolesTable.order, showBookRolesTable.id);
    if (current.length !== positionIds.length || current.some((row) => !positionIds.includes(row.id))) {
      res.status(400).json({ error: "A lista precisa conter exatamente as vagas atuais do show" }); return;
    }
    if (current.every((row, index) => row.id === positionIds[index])) { res.json({ unchanged: true }); return; }
    await db.transaction(async (tx) => {
      for (const [order, id] of (positionIds as string[]).entries()) {
        await tx.update(showBookRolesTable).set({ order, updatedAt: new Date() }).where(eq(showBookRolesTable.id, id));
      }
      const nameOf = new Map(current.map((row) => [row.id, row.name]));
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.vaga.reordered", title: "Ordem das vagas alterada",
        narrative: `${book.title}: nova ordem — ${(positionIds as string[]).map((id) => nameOf.get(id)).join(", ")}.`,
        entityType: "show_book", entityId: book.id, actorId: req.user!.sub,
        operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: { ordem: current.map((row) => row.name) }, afterState: { ordem: (positionIds as string[]).map((id) => nameOf.get(id)) },
      }, tx as any);
      await bumpVersion(book.id, "CONFIG", "Ordem das vagas de personagem", req.user!.sub, req.requestId, req.correlationId, tx as any);
    });
    res.json({ ok: true });
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "").error({ err, showBookId: req.params.id }, "Erro ao reordenar vagas");
    res.status(500).json({ error: "Erro ao reordenar vagas" });
  }
});

router.delete("/show-books/:id/vagas/:positionId", requireAuth, requireOrganization, async (req, res) => {
  const positionId = req.params.positionId as string;
  try {
    const book = await requireShowManage(req, res); if (!book) return;
    const [row] = await db.select({ position: showBookRolesTable })
      .from(showBookRolesTable)
      .innerJoin(showBookBlocksTable, eq(showBookRolesTable.blockId, showBookBlocksTable.id))
      .innerJoin(showBookScenesTable, eq(showBookBlocksTable.sceneId, showBookScenesTable.id))
      .where(and(
        eq(showBookRolesTable.id, positionId), eq(showBookRolesTable.showBookId, book.id), eq(showBookRolesTable.active, true),
        eq(showBookScenesTable.isCastRoster, true),
      )).limit(1);
    if (!row) { res.status(404).json({ error: "Vaga não encontrada" }); return; }
    const [line] = await db.select({ characterId: showBookLinesTable.characterId }).from(showBookLinesTable)
      .where(and(eq(showBookLinesTable.positionId, positionId), eq(showBookLinesTable.active, true))).limit(1);
    const [character] = line?.characterId
      ? await db.select().from(charactersTable).where(eq(charactersTable.id, line.characterId)).limit(1)
      : [];
    await db.transaction(async (tx) => {
      await purgePositions(tx, [positionId]);
      // A vaga exclusiva some junto com o show; o compartilhado continua no local para os outros shows.
      const exclusive = character?.showBookId === book.id;
      if (exclusive) await tx.update(charactersTable).set({ active: false, updatedAt: new Date() }).where(eq(charactersTable.id, character!.id));
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.vaga.removed", title: "Vaga retirada do show",
        narrative: `${book.title}: ${character?.name ?? row.position.name} ${exclusive ? "removida (histórico preservado)" : "deixa de entrar no show"}.`,
        entityType: "show_book_position", entityId: positionId, actorId: req.user!.sub,
        operationId: book.operationId, orgId: req.user!.organizationId,
        beforeState: { position: row.position, character: character ?? null }, afterState: null,
      }, tx as any);
      await bumpVersion(book.id, "STRUCTURAL", "Vaga de personagem retirada", req.user!.sub, req.requestId, req.correlationId, tx as any);
    });
    res.status(204).send();
  } catch (err) {
    requestLogger("show_book", req.requestId ?? "", req.correlationId ?? "").error({ err, showBookId: req.params.id, positionId }, "Erro ao retirar vaga");
    res.status(500).json({ error: "Erro ao retirar vaga" });
  }
});

// ─── Grupos de slots (blocos de cena) ──────────────────────────────────────
router.patch("/show-books/:id/blocks/:blockId/group", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string, blockId = req.params.blockId as string;
  const { name, zone, prefix, color, reason } = req.body as { name?: string; zone?: string; prefix?: string; color?: string | null; reason?: string };
  if (!reason?.trim() || !name?.trim() || !zone?.trim() || !prefix?.trim()) { res.status(400).json({ error: "name, zone, prefix e reason são obrigatórios" }); return; }
  try {
    const book = await requireShowManage(req, res); if (!book) return;
    if (!(await blockInShowBook(blockId, showBookId))) { res.status(404).json({ error: "Grupo não encontrado" }); return; }
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(showBookBlocksTable).where(eq(showBookBlocksTable.id, blockId));
      const [after] = await tx.update(showBookBlocksTable).set({ name: name.trim(), zone: zone.trim(), prefix: prefix.trim().toUpperCase(), color: color === undefined ? (before as any).color : color, updatedAt: new Date() } as any).where(eq(showBookBlocksTable.id, blockId)).returning();
      await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.group.updated", title: "Grupo de slots atualizado", narrative: `Grupo ${before!.name} atualizado.`, entityType: "show_book_block", entityId: blockId, actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId, beforeState: before, afterState: after, metadata: { reason } }, tx as any);
      await bumpVersion(showBookId, "STRUCTURAL", reason, req.user!.sub, req.requestId, req.correlationId, tx as any); return after;
    });
    res.json({ group: updated });
  } catch { res.status(500).json({ error: "Erro ao atualizar grupo" }); }
});

// ─── Links do Drive ────────────────────────────────────────────────────────
router.get("/show-books/:id/drive-links", requireAuth, requireOrganization, async (req, res) => {
  try { const book = await requireShowView(req, res); if (!book) return; const links = await db.select().from(showBookDriveLinksTable).where(and(eq(showBookDriveLinksTable.showBookId, book.id), eq(showBookDriveLinksTable.active, true))).orderBy(showBookDriveLinksTable.order, showBookDriveLinksTable.id); res.json({ links }); } catch { res.status(500).json({ error: "Erro ao listar links" }); }
});

router.post("/show-books/:id/drive-links", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string; const { label, url, type, scope, order, reason } = req.body;
  if (!reason?.trim() || !label?.trim() || !type?.trim() || !scope?.trim()) { res.status(400).json({ error: "label, type, scope e reason são obrigatórios" }); return; }
  try { const book = await requireShowManage(req, res); if (!book) return; const link = await db.transaction(async (tx) => { const [created] = await tx.insert(showBookDriveLinksTable).values({ showBookId, label: label.trim(), url: url?.trim() || null, type: type.trim(), scope: scope.trim(), order: Number.isInteger(order) ? order : 0 }).returning(); await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.drive_link.created", title: "Link do Drive adicionado", narrative: `Link ${created.label} adicionado ao show.`, entityType: "show_book_drive_link", entityId: created.id, actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId, beforeState: null, afterState: created, metadata: { reason } }, tx as any); await bumpVersion(showBookId, "CONFIG", reason, req.user!.sub, req.requestId, req.correlationId, tx as any); return created; }); res.status(201).json({ link }); } catch { res.status(500).json({ error: "Erro ao criar link" }); }
});

router.patch("/show-books/:id/drive-links/:linkId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string, linkId = req.params.linkId as string; const { label, url, type, scope, order, reason } = req.body;
  if (!reason?.trim()) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try { const book = await requireShowManage(req, res); if (!book) return; if (!(await driveLinkInShowBook(linkId, showBookId))) { res.status(404).json({ error: "Link não encontrado" }); return; } const link = await db.transaction(async (tx) => { const [before] = await tx.select().from(showBookDriveLinksTable).where(eq(showBookDriveLinksTable.id, linkId)); const [after] = await tx.update(showBookDriveLinksTable).set({ label: label ?? before!.label, url: url === undefined ? before!.url : (url?.trim() || null), type: type ?? before!.type, scope: scope ?? before!.scope, order: Number.isInteger(order) ? order : before!.order, updatedAt: new Date() }).where(eq(showBookDriveLinksTable.id, linkId)).returning(); await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.drive_link.updated", title: "Link do Drive atualizado", narrative: `Link ${after.label} atualizado.`, entityType: "show_book_drive_link", entityId: linkId, actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId, beforeState: before, afterState: after, metadata: { reason } }, tx as any); await bumpVersion(showBookId, "CONFIG", reason, req.user!.sub, req.requestId, req.correlationId, tx as any); return after; }); res.json({ link }); } catch { res.status(500).json({ error: "Erro ao atualizar link" }); }
});

router.delete("/show-books/:id/drive-links/:linkId", requireAuth, requireOrganization, async (req, res) => {
  const showBookId = req.params.id as string, linkId = req.params.linkId as string; const { reason } = req.body;
  if (!reason?.trim()) { res.status(400).json({ error: "reason é obrigatório" }); return; }
  try { const book = await requireShowManage(req, res); if (!book) return; if (!(await driveLinkInShowBook(linkId, showBookId))) { res.status(404).json({ error: "Link não encontrado" }); return; } await db.transaction(async (tx) => { const [before] = await tx.select().from(showBookDriveLinksTable).where(eq(showBookDriveLinksTable.id, linkId)); const [after] = await tx.update(showBookDriveLinksTable).set({ active: false, updatedAt: new Date() }).where(eq(showBookDriveLinksTable.id, linkId)).returning(); await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.drive_link.removed", title: "Link do Drive removido", narrative: `Link ${before!.label} removido sem apagar o histórico.`, entityType: "show_book_drive_link", entityId: linkId, actorId: req.user!.sub, operationId: book.operationId, orgId: req.user!.organizationId, beforeState: before, afterState: after, metadata: { reason } }, tx as any); await bumpVersion(showBookId, "CONFIG", reason, req.user!.sub, req.requestId, req.correlationId, tx as any); }); res.status(204).send(); } catch { res.status(500).json({ error: "Erro ao remover link" }); }
});

router.get("/operations/:operationId/tags", requireAuth, requireOrganization, async (req, res) => {
  const operationId = req.params.operationId as string;
  try {
    const tags = await db.select().from(showBookTagsTable)
      .where(and(eq(showBookTagsTable.operationId, operationId), eq(showBookTagsTable.active, true)));
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
  const operationId = req.params.operationId as string;
  const tagId = req.params.tagId as string;
  try {
    // Desativação lógica: a tag e quem a recebeu continuam no histórico.
    const removed = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(showBookTagsTable)
        .where(and(eq(showBookTagsTable.id, tagId), eq(showBookTagsTable.operationId, operationId), eq(showBookTagsTable.active, true))).limit(1);
      if (!before) return null;
      const [next] = await tx.update(showBookTagsTable).set({ active: false, updatedAt: new Date() })
        .where(eq(showBookTagsTable.id, before.id)).returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book_tag.deactivated", title: "Tag desativada",
        narrative: `Tag "${before.label}" desativada sem apagar o histórico.`, entityType: "show_book_tag", entityId: before.id,
        actorId: req.user!.sub, operationId, orgId: req.user!.organizationId, beforeState: before, afterState: next,
      }, tx as any);
      return next;
    });
    if (!removed) { res.status(404).json({ error: "Tag não encontrada" }); return; }
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
      .where(and(eq(userTagsTable.userId, userId), eq(userTagsTable.active, true), eq(showBookTagsTable.active, true)));
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
    const removed = await db.transaction(async (tx) => {
      const before = await tx.select().from(userTagsTable)
        .where(and(eq(userTagsTable.userId, userId), eq(userTagsTable.tagId, tagId), eq(userTagsTable.active, true)));
      if (!before.length) return [];
      const next = await tx.update(userTagsTable).set({ active: false, updatedAt: new Date() })
        .where(inArray(userTagsTable.id, before.map((row) => row.id))).returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user_tag.deactivated", title: "Tag removida da pessoa",
        narrative: "Tag retirada da pessoa sem apagar o histórico.", entityType: "user", entityId: userId,
        actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: { userTags: before }, afterState: { userTags: next },
        metadata: { tagId },
      }, tx as any);
      return next;
    });
    if (!removed.length) { res.status(404).json({ error: "Tag não atribuída a esta pessoa" }); return; }
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
    const book = await requireShowView(req, res);
    if (!book) return;
    const baseWhere = and(
      eq(showBookPositionLibraryRefsTable.positionId, positionId),
      eq(showBookPositionLibraryRefsTable.showBookId, showBookId),
      eq(showBookPositionLibraryRefsTable.active, true),
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
  if (!documentId) {
    res.status(400).json({ error: "documentId é obrigatório" }); return;
  }
  try {
    // Gestão restrita ao responsável do show (ou admin / gestor legado sem responsável).
    const book = await requireShowManage(req, res);
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
  try {
    // Gestão restrita ao responsável do show (ou admin / gestor legado sem responsável).
    const book = await requireShowManage(req, res);
    if (!book) return;
    const [ref] = await db
      .select()
      .from(showBookPositionLibraryRefsTable)
      .where(and(
        eq(showBookPositionLibraryRefsTable.id, refId),
        eq(showBookPositionLibraryRefsTable.positionId, positionId),
        eq(showBookPositionLibraryRefsTable.showBookId, showBookId),
        eq(showBookPositionLibraryRefsTable.active, true),
      ))
      .limit(1);
    if (!ref) { res.status(404).json({ error: "Referência não encontrada" }); return; }
    // Desativação lógica e Registro na mesma transação: o vínculo continua recuperável.
    await db.transaction(async (tx) => {
      const [next] = await tx.update(showBookPositionLibraryRefsTable)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(showBookPositionLibraryRefsTable.id, ref.id), eq(showBookPositionLibraryRefsTable.active, true)))
        .returning();
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE",
        action: "ref_removed",
        title: "Referência removida da posição",
        narrative: `Vínculo de documento removido da posição no Livro do Show`,
        entityType: "show_book_position",
        entityId: positionId,
        actorId: req.user!.sub,
        operationId: book.operationId,
        beforeState: ref,
        afterState: next ?? null,
        metadata: { showBookId, documentId: ref.documentId, refId },
      }, tx as any);
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
    const book = await requireShowView(req, res);
    if (!book) return;
    const baseWhere = and(eq(showBookPositionLibraryRefsTable.showBookId, showBookId), eq(showBookPositionLibraryRefsTable.active, true));
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
