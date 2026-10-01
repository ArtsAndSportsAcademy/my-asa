import express, { Router, type IRouter } from "express";
import { registerUndo } from "../services/undo.js";
import { eq, and, desc, or, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  libraryCategoriesTable,
  libraryDocumentsTable,
  libraryDocumentVersionsTable,
  libraryDocumentPageCitationsTable,
  libraryDocumentFilesTable,
  libraryViewsTable,
  usersTable,
  userRolesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { canReadLibraryScope as canReadScope, isLibraryFullReader, isLibraryManager, LIBRARY_MANAGER_ROLES, type LibraryRole as RoleValue } from "../services/library-access.js";

const MANAGER_ROLES = LIBRARY_MANAGER_ROLES;

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserRole(userId: string): Promise<RoleValue | null> {
  const [row] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)))
    .limit(1);
  return (row?.role as RoleValue) ?? null;
}

async function snapshotVersion(docId: string, userId: string, version: number, title: string, body: string, summary: string | null | undefined, executor: any = db): Promise<void> {
  await executor.insert(libraryDocumentVersionsTable).values({
    documentId: docId,
    version,
    title,
    body,
    summary: summary ?? null,
    createdBy: userId,
  }).onConflictDoNothing();
}

async function actorAreaId(userId: string) {
  const [person] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return person?.areaId ?? null;
}

async function canManageDocumentScope(role: RoleValue | null, userId: string, doc: { scopeType: string; areaId: string | null }) {
  if (role === "ADMIN") return true;
  if (role !== "SUPERVISOR_A" && role !== "SUPERVISOR_B") return false;
  const areaId = await actorAreaId(userId);
  return doc.scopeType === "AREA" && Boolean(areaId) && doc.areaId === areaId;
}

// ─── GET /library/categories ─────────────────────────────────────────────────

router.get("/library/categories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const cats = await db
      .select()
      .from(libraryCategoriesTable)
      .where(and(eq(libraryCategoriesTable.orgId, orgId), eq(libraryCategoriesTable.active, true)))
      .orderBy(libraryCategoriesTable.name);
    res.json({ categories: cats });
  } catch (err) {
    console.error("[library] GET /library/categories", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /library/categories ─────────────────────────────────────────────────

router.post("/library/categories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const { name, description } = req.body;
    if (!name) { res.status(400).json({ error: "name obrigatório" }); return; }

    const [cat] = await db.insert(libraryCategoriesTable).values({ orgId, name, description: description ?? null }).returning();
    res.status(201).json({ category: cat });
  } catch (err) {
    console.error("[library] POST /library/categories", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── DELETE /library/categories/:id ──────────────────────────────────────────

router.delete("/library/categories/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const categoryId = req.params.id as string;

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const [cat] = await db
      .select()
      .from(libraryCategoriesTable)
      .where(and(eq(libraryCategoriesTable.id, categoryId), eq(libraryCategoriesTable.orgId, orgId), eq(libraryCategoriesTable.active, true)))
      .limit(1);
    if (!cat) { res.status(404).json({ error: "Categoria não encontrada" }); return; }

    const [linked] = await db
      .select({ count: libraryDocumentsTable.id })
      .from(libraryDocumentsTable)
      .where(eq(libraryDocumentsTable.categoryId, categoryId))
      .limit(1);
    if (linked) {
      res.status(409).json({ error: "Conflict", message: "Existem documentos vinculados a esta categoria. Remova-os antes de excluir." });
      return;
    }

    await db.transaction(async (tx) => {
      const [updated] = await tx.update(libraryCategoriesTable)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(libraryCategoriesTable.id, categoryId), eq(libraryCategoriesTable.active, true)))
        .returning();
      if (!updated) throw new Error("Categoria não encontrada");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "library.category_deactivated",
        title: `Categoria desativada: ${cat.name}`,
        narrative: `A categoria ${cat.name} foi desativada.`, entityType: "library_category",
        entityId: categoryId, actorId: userId, orgId,
        beforeState: cat, afterState: updated, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
    });
    res.status(204).end();
  } catch (err) {
    console.error("[library] DELETE /library/categories/:id", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /library/documents ──────────────────────────────────────────────────

router.get("/library/documents", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.sub;
    const role = await getUserRole(userId);
    const isManager = isLibraryManager(role);
    // Direção acompanha toda a Biblioteca, mas continua somente leitura.
    const isFullReader = isLibraryFullReader(role);
    const areaIdForReader = isFullReader ? null : await actorAreaId(userId);

    const q = String(req.query.q ?? "");
    const type = req.query.type ? String(req.query.type) : undefined;
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    // Members only see PUBLISHED/UPDATED docs
    const statusFilter = isManager
      ? (status ? eq(libraryDocumentsTable.status, status as any) : undefined)
      : or(
          eq(libraryDocumentsTable.status, "PUBLISHED"),
          eq(libraryDocumentsTable.status, "UPDATED")
        );

    let rows = await db
      .select({
        id: libraryDocumentsTable.id,
        title: libraryDocumentsTable.title,
        type: libraryDocumentsTable.type,
        status: libraryDocumentsTable.status,
        summary: libraryDocumentsTable.summary,
        fileUrl: libraryDocumentsTable.fileUrl,
        tags: libraryDocumentsTable.tags,
        requiresConfirmation: libraryDocumentsTable.requiresConfirmation,
        scopeType: libraryDocumentsTable.scopeType,
        areaId: libraryDocumentsTable.areaId,
        locationId: libraryDocumentsTable.locationId,
        version: libraryDocumentsTable.version,
        categoryId: libraryDocumentsTable.categoryId,
        responsibleId: libraryDocumentsTable.responsibleId,
        publishedAt: libraryDocumentsTable.publishedAt,
        archivedAt: libraryDocumentsTable.archivedAt,
        updatedAt: libraryDocumentsTable.updatedAt,
        createdAt: libraryDocumentsTable.createdAt,
        responsibleName: usersTable.name,
        fileName: libraryDocumentFilesTable.fileName,
      })
      .from(libraryDocumentsTable)
      .leftJoin(usersTable, eq(libraryDocumentsTable.responsibleId, usersTable.id))
      .leftJoin(libraryDocumentFilesTable, and(eq(libraryDocumentFilesTable.documentId, libraryDocumentsTable.id), eq(libraryDocumentFilesTable.active, true)))
      .where(
        and(
          eq(libraryDocumentsTable.orgId, orgId),
          type ? eq(libraryDocumentsTable.type, type as any) : undefined,
          categoryId ? eq(libraryDocumentsTable.categoryId, categoryId) : undefined,
          statusFilter,
          q ? ilike(libraryDocumentsTable.title, `%${q}%`) : undefined
        )
      )
      .orderBy(desc(libraryDocumentsTable.updatedAt));

    rows = rows.filter((doc) => canReadScope(doc, isFullReader, areaIdForReader));
    res.json({ documents: rows });
  } catch (err) {
    console.error("[library] GET /library/documents", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /library/documents ─────────────────────────────────────────────────

router.post("/library/documents", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const { title, type, summary, body, categoryId, responsibleId, fileUrl, tags, requiresConfirmation = false, scopeType = "HOUSE", areaId = null, locationId = null } = req.body;
    if (!title || !type) { res.status(400).json({ error: "title e type obrigatórios" }); return; }
    if (!String(type).includes("PROCEDURE") && !["RULES_AND_POLICIES", "ONBOARDING_MATERIAL"].includes(String(type))) { res.status(400).json({ error: "A Biblioteca aceita somente documentos institucionais" }); return; }
    if (!["HOUSE", "AREA", "LOCATION"].includes(scopeType)) { res.status(400).json({ error: "scopeType inválido" }); return; }
    if (role !== "ADMIN") { const area = await actorAreaId(userId); if (scopeType !== "AREA" || !area || area !== areaId) { res.status(403).json({ error: "Supervisão publica documentos apenas para a própria área" }); return; } }

    const [doc] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(libraryDocumentsTable).values({
        orgId,
        title,
        type,
        summary: summary ?? null,
        body: body ?? "",
        fileUrl: fileUrl?.trim() || null,
        tags: Array.isArray(tags) ? tags.map(String).filter(Boolean) : [],
        requiresConfirmation: Boolean(requiresConfirmation),
        scopeType,
        areaId,
        locationId,
        categoryId: categoryId ?? null,
        responsibleId: responsibleId ?? null,
        createdBy: userId,
        status: "DRAFT",
        version: 1,
      }).returning();
      await writeHistoryEvent({
        category: "DELIVERY", action: "library.created", title: `Documento criado: ${created!.title}`,
        narrative: `Rascunho criado para a Biblioteca.`, entityType: "library_document", entityId: created!.id,
        actorId: userId, orgId, afterState: created,
      }, tx as any);
      return [created] as const;
    });

    res.status(201).json({ document: doc });
  } catch (err) {
    console.error("[library] POST /library/documents", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /library/documents/:id ──────────────────────────────────────────────

router.get("/library/documents/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);
    const userId = req.user!.sub;
    const role = await getUserRole(userId);
    const isManager = isLibraryManager(role);
    const isFullReader = isLibraryFullReader(role);

    const [doc] = await db
      .select({
        id: libraryDocumentsTable.id,
        orgId: libraryDocumentsTable.orgId,
        title: libraryDocumentsTable.title,
        type: libraryDocumentsTable.type,
        status: libraryDocumentsTable.status,
        summary: libraryDocumentsTable.summary,
        fileUrl: libraryDocumentsTable.fileUrl,
        tags: libraryDocumentsTable.tags,
        requiresConfirmation: libraryDocumentsTable.requiresConfirmation,
        scopeType: libraryDocumentsTable.scopeType,
        areaId: libraryDocumentsTable.areaId,
        locationId: libraryDocumentsTable.locationId,
        body: libraryDocumentsTable.body,
        version: libraryDocumentsTable.version,
        categoryId: libraryDocumentsTable.categoryId,
        responsibleId: libraryDocumentsTable.responsibleId,
        publishedAt: libraryDocumentsTable.publishedAt,
        archivedAt: libraryDocumentsTable.archivedAt,
        createdBy: libraryDocumentsTable.createdBy,
        createdAt: libraryDocumentsTable.createdAt,
        updatedAt: libraryDocumentsTable.updatedAt,
        responsibleName: usersTable.name,
      })
      .from(libraryDocumentsTable)
      .leftJoin(usersTable, eq(libraryDocumentsTable.responsibleId, usersTable.id))
      .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId)))
      .limit(1);

    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }

    // Members can't see drafts or documents outside their server-side audience.
    if (!isManager && doc.status === "DRAFT") {
      res.status(403).json({ error: "Documento não publicado" });
      return;
    }
    if (!canReadScope(doc, isFullReader, isFullReader ? null : await actorAreaId(userId))) { res.status(403).json({ error: "Documento fora do seu escopo" }); return; }

    // Version history (managers only)
    const versions = isManager
      ? await db
          .select()
          .from(libraryDocumentVersionsTable)
          .where(eq(libraryDocumentVersionsTable.documentId, docId))
          .orderBy(desc(libraryDocumentVersionsTable.version))
      : [];

    // Log view (fire-and-forget — does not block the response)
    db.insert(libraryViewsTable).values({ documentId: docId, userId, orgId, viewedAt: new Date() }).catch(() => {});

    const citations = await db.select({ pageNumber: libraryDocumentPageCitationsTable.pageNumber, excerpt: libraryDocumentPageCitationsTable.excerpt })
      .from(libraryDocumentPageCitationsTable)
      .where(and(eq(libraryDocumentPageCitationsTable.documentId, docId), eq(libraryDocumentPageCitationsTable.version, doc.version)))
      .orderBy(libraryDocumentPageCitationsTable.pageNumber);
    const canManageCitations = doc.status !== "ARCHIVED" && await canManageDocumentScope(role, userId, doc);

    res.json({ document: doc, versions, citations, canManageCitations });
  } catch (err) {
    console.error("[library] GET /library/documents/:id", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── PUT /library/documents/:id/file — PDF do próprio documento ───────────────
// O piloto mantém o PDF no Postgres, nunca num bucket público. O limite de 15 MB
// cobre os manuais institucionais sem transformar o banco em acervo de mídia.
router.put("/library/documents/:id/file", requireAuth, requireOrganization, express.raw({ type: "application/pdf", limit: "15mb" }), async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);
    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const [doc] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);
    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "ARCHIVED") { res.status(400).json({ error: "Documento arquivado não aceita arquivo" }); return; }
    if (!await canManageDocumentScope(role, userId, doc)) { res.status(403).json({ error: "Documento fora do seu escopo de escrita" }); return; }
    const content = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");
    if (!content.length || content.length > 15 * 1024 * 1024 || content.subarray(0, 5).toString("ascii") !== "%PDF-") { res.status(400).json({ error: "Envie um PDF válido de até 15 MB" }); return; }
    const rawName = decodeURIComponent(String(req.header("x-file-name") ?? "documento.pdf"));
    const fileName = rawName.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180) || "documento.pdf";
    const [file] = await db.transaction(async (tx) => {
      await tx.update(libraryDocumentFilesTable).set({ active: false }).where(and(eq(libraryDocumentFilesTable.documentId, docId), eq(libraryDocumentFilesTable.active, true)));
      const [created] = await tx.insert(libraryDocumentFilesTable).values({ documentId: docId, orgId, fileName, contentType: "application/pdf", sizeBytes: content.length, content, uploadedBy: userId }).returning();
      await tx.delete(libraryDocumentPageCitationsTable).where(and(eq(libraryDocumentPageCitationsTable.documentId, docId), eq(libraryDocumentPageCitationsTable.version, doc.version)));
      await writeHistoryEvent({ category: "DELIVERY", action: "library.file_uploaded", title: `PDF atualizado: ${doc.title}`, narrative: `${fileName} foi enviado para a Biblioteca.`, entityType: "library_document_file", entityId: created!.id, actorId: userId, orgId, beforeState: null, afterState: { id: created!.id, documentId: docId, fileName, sizeBytes: content.length }, metadata: { documentId: docId } }, tx as any);
      return [created] as const;
    });
    res.status(201).json({ file: { id: file.id, fileName: file.fileName, sizeBytes: file.sizeBytes } });
  } catch (err) {
    console.error("[library] PUT /library/documents/:id/file", err);
    res.status(500).json({ error: "Não consegui guardar o PDF" });
  }
});

router.put("/library/documents/:id/citations", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);
    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const [doc] = await db.select().from(libraryDocumentsTable)
      .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);
    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "ARCHIVED") { res.status(400).json({ error: "Documento arquivado não aceita citações" }); return; }
    if (!await canManageDocumentScope(role, userId, doc)) { res.status(403).json({ error: "Documento fora do seu escopo de escrita" }); return; }

    const payload = req.body as { version?: unknown; citations?: unknown };
    if (payload.version !== doc.version) { res.status(409).json({ error: "A versão mudou. Recarregue o documento antes de salvar citações." }); return; }
    if (!Array.isArray(payload.citations) || payload.citations.length > 100) {
      res.status(400).json({ error: "Envie uma lista de até 100 citações de página." }); return;
    }
    const citations: Array<{ pageNumber: number; excerpt: string }> = [];
    for (const raw of payload.citations) {
      if (!raw || typeof raw !== "object") { res.status(400).json({ error: "Citação inválida." }); return; }
      const item = raw as Record<string, unknown>;
      const pageNumber = Number(item.pageNumber);
      const excerpt = typeof item.excerpt === "string" ? item.excerpt.trim() : "";
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100000 || excerpt.length < 8 || excerpt.length > 1000) {
        res.status(400).json({ error: "Cada citação precisa de página positiva e trecho entre 8 e 1.000 caracteres." }); return;
      }
      citations.push({ pageNumber, excerpt });
    }
    const uniqueCitations = new Set(citations.map((item) => `${item.pageNumber}:${item.excerpt.toLocaleLowerCase("pt-BR")}`));
    if (uniqueCitations.size !== citations.length) { res.status(400).json({ error: "Remova citações repetidas da mesma página." }); return; }

    const saved = await db.transaction(async (tx) => {
      const previous = await tx.select({ pageNumber: libraryDocumentPageCitationsTable.pageNumber })
        .from(libraryDocumentPageCitationsTable)
        .where(and(eq(libraryDocumentPageCitationsTable.documentId, docId), eq(libraryDocumentPageCitationsTable.version, doc.version)));
      await tx.delete(libraryDocumentPageCitationsTable).where(and(
        eq(libraryDocumentPageCitationsTable.documentId, docId), eq(libraryDocumentPageCitationsTable.version, doc.version),
      ));
      const rows = citations.length
        ? await tx.insert(libraryDocumentPageCitationsTable).values(citations.map((item) => ({ ...item, documentId: docId, version: doc.version, createdBy: userId })))
          .returning({ pageNumber: libraryDocumentPageCitationsTable.pageNumber, excerpt: libraryDocumentPageCitationsTable.excerpt })
        : [];
      await writeHistoryEvent({
        category: "DELIVERY", action: "library.page_citations_updated", title: `Citações atualizadas: ${doc.title}`,
        narrative: `${citations.length} trecho(s) com página confirmada foram registrados na versão v${doc.version}.`,
        entityType: "library_document", entityId: docId, actorId: userId, orgId,
        beforeState: { citationCount: previous.length, version: doc.version },
        afterState: { citationCount: rows.length, version: doc.version },
        metadata: { version: doc.version },
      }, tx as any);
      return rows;
    });
    res.json({ citations: saved });
  } catch (err) {
    console.error("[library] PUT /library/documents/:id/citations", err);
    res.status(500).json({ error: "Não consegui atualizar as citações" });
  }
});

// ─── GET /library/documents/:id/file — download autenticado ───────────────────
router.get("/library/documents/:id/file", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);
    const role = await getUserRole(userId);
    const isManager = isLibraryManager(role);
    const isFullReader = isLibraryFullReader(role);
    const [doc] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);
    if (!doc || (!isManager && doc.status === "DRAFT") || !canReadScope(doc, isFullReader, isFullReader ? null : await actorAreaId(userId))) { res.status(404).json({ error: "PDF não encontrado" }); return; }
    const [file] = await db.select().from(libraryDocumentFilesTable).where(and(eq(libraryDocumentFilesTable.documentId, docId), eq(libraryDocumentFilesTable.active, true))).limit(1);
    if (!file) { res.status(404).json({ error: "PDF não encontrado" }); return; }
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", String(file.sizeBytes));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.send(Buffer.from(file.content));
  } catch (err) { console.error("[library] GET /library/documents/:id/file", err); res.status(500).json({ error: "Não consegui abrir o PDF" }); }
});

// ─── PATCH /library/documents/:id — Editar rascunho ─────────────────────────

router.patch("/library/documents/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const [doc] = await db
      .select()
      .from(libraryDocumentsTable)
      .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId)))
      .limit(1);

    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "ARCHIVED") { res.status(400).json({ error: "Documentos arquivados não podem ser editados" }); return; }

    const { title, summary, body, categoryId, responsibleId, fileUrl, tags, requiresConfirmation, scopeType, areaId, locationId } = req.body;
    const now = new Date();

    const prevResponsible = doc.responsibleId;

    const [updated] = await db.transaction(async (tx) => {
      if (body !== undefined && body !== doc.body) {
        await tx.delete(libraryDocumentPageCitationsTable).where(and(
          eq(libraryDocumentPageCitationsTable.documentId, docId),
          eq(libraryDocumentPageCitationsTable.version, doc.version),
        ));
      }
      const [row] = await tx.update(libraryDocumentsTable).set({
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(body !== undefined && { body }),
        ...(categoryId !== undefined && { categoryId }),
        ...(responsibleId !== undefined && { responsibleId }),
        ...(fileUrl !== undefined && { fileUrl: fileUrl?.trim() || null }),
        ...(tags !== undefined && { tags: Array.isArray(tags) ? tags.map(String).filter(Boolean) : [] }),
        ...(requiresConfirmation !== undefined && { requiresConfirmation: Boolean(requiresConfirmation) }),
        ...(scopeType !== undefined && { scopeType }),
        ...(areaId !== undefined && { areaId }),
        ...(locationId !== undefined && { locationId }),
        updatedAt: now,
      }).where(eq(libraryDocumentsTable.id, docId)).returning();
      if (!row) throw new Error("Documento não encontrado");
      await writeHistoryEvent({
        category: "DELIVERY", action: responsibleId !== undefined && responsibleId !== prevResponsible ? "library.responsible_changed" : "library.updated",
        title: `Documento atualizado: ${row.title}`,
        narrative: `Documento atualizado por ${userId}.`, entityType: "library_document", entityId: docId,
        actorId: userId, orgId, beforeState: doc, afterState: row,
        metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    res.json({ document: updated });
  } catch (err) {
    console.error("[library] PATCH /library/documents/:id", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /library/documents/:id/publish — Publicar ─────────────────────────

router.post("/library/documents/:id/publish", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const [doc] = await db.select().from(libraryDocumentsTable)
      .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);

    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "PUBLISHED" || doc.status === "UPDATED") {
      res.status(400).json({ error: "Documento já está publicado" }); return;
    }
    if (doc.status === "ARCHIVED") {
      res.status(400).json({ error: "Documento arquivado não pode ser publicado" }); return;
    }

    const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(libraryDocumentsTable)
        .set({ status: "PUBLISHED", publishedAt: now, updatedAt: now })
        .where(eq(libraryDocumentsTable.id, docId)).returning();
      if (!row) throw new Error("Documento não encontrado");
      await snapshotVersion(docId, userId, doc.version, doc.title, doc.body, doc.summary, tx);
      await writeHistoryEvent({
        category: "DELIVERY", action: "library.published", title: `Documento publicado: ${doc.title}`,
        narrative: `Documento "${doc.title}" (v${doc.version}) publicado na Biblioteca.`,
        entityType: "library_document", entityId: docId, actorId: userId, orgId,
        beforeState: doc, afterState: row, metadata: { version: doc.version, type: doc.type },
      }, tx as any);
      return [row] as const;
    });

    res.json({ document: updated });
  } catch (err) {
    console.error("[library] POST /library/documents/:id/publish", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /library/documents/:id/version — Nova versão ───────────────────────

router.post("/library/documents/:id/version", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const [doc] = await db.select().from(libraryDocumentsTable)
      .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);

    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "ARCHIVED") { res.status(400).json({ error: "Documento arquivado" }); return; }
    if (doc.status === "DRAFT") { res.status(400).json({ error: "Publique o documento antes de versionar" }); return; }

    const { title, body, summary } = req.body;
    if (!title || !body) { res.status(400).json({ error: "title e body obrigatórios" }); return; }

    const newVersion = doc.version + 1;
    const now = new Date();

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(libraryDocumentsTable)
        .set({ title, body, summary: summary ?? doc.summary, status: "UPDATED", version: newVersion, updatedAt: now })
        .where(eq(libraryDocumentsTable.id, docId)).returning();
      if (!row) throw new Error("Documento não encontrado");
      await snapshotVersion(docId, userId, newVersion, title, body, summary ?? doc.summary, tx);
      await writeHistoryEvent({
        category: "DELIVERY", action: "library.versioned", title: `Documento atualizado: ${doc.title}`,
        narrative: `Nova versão v${newVersion} do documento "${doc.title}" publicada.`,
        entityType: "library_document", entityId: docId, actorId: userId, orgId,
        beforeState: doc, afterState: row, metadata: { previousVersion: doc.version, newVersion },
      }, tx as any);
      return [row] as const;
    });

    res.json({ document: updated });
  } catch (err) {
    console.error("[library] POST /library/documents/:id/version", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /library/documents/:id/archive — Arquivar ─────────────────────────

router.post("/library/documents/:id/archive", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);

    const role = await getUserRole(userId);
    if (!role || role !== "ADMIN") { res.status(403).json({ error: "Apenas Admin pode arquivar documentos" }); return; }

    const [doc] = await db.select().from(libraryDocumentsTable)
      .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);

    if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (doc.status === "ARCHIVED") { res.json({ document: doc }); return; }

    const now = new Date();
    let undo: Awaited<ReturnType<typeof registerUndo>> | undefined;
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(libraryDocumentsTable)
        .set({ status: "ARCHIVED", archivedAt: now, updatedAt: now })
        .where(eq(libraryDocumentsTable.id, docId)).returning();
      if (!row) throw new Error("Documento não encontrado");
      await writeHistoryEvent({
        category: "DELIVERY", action: "library.archived", title: `Documento arquivado: ${doc.title}`,
        narrative: `Documento "${doc.title}" arquivado por ${userId}. Arquivado ≠ excluído.`,
        entityType: "library_document", entityId: docId, actorId: userId, orgId,
        beforeState: doc, afterState: row,
      }, tx as any);
      undo = await registerUndo(tx, { organizationId: orgId, actorId: userId, kind: "library_document", entityId: docId, changes: [{ table: "library_document", id: docId, before: { status: doc.status, archivedAt: doc.archivedAt }, after: { status: row.status, archivedAt: row.archivedAt, updatedAt: row.updatedAt } }] });
      return [row] as const;
    });

    res.json({ document: updated, undo });
  } catch (err) {
    console.error("[library] POST /library/documents/:id/archive", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /library/documents/:id/versions — Histórico de versões ──────────────

router.post("/library/documents/:id/confirm", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);
    const role = await getUserRole(userId);
    const isManager = isLibraryManager(role);
    const [doc] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, orgId))).limit(1);
    if (!doc || !(doc.status === "PUBLISHED" || doc.status === "UPDATED")) { res.status(404).json({ error: "Documento publicado não encontrado" }); return; }
    if (!canReadScope(doc, isLibraryFullReader(role), isLibraryFullReader(role) ? null : await actorAreaId(userId))) { res.status(403).json({ error: "Documento fora do seu escopo" }); return; }
    if (!doc.requiresConfirmation) { res.status(400).json({ error: "Este documento não pede confirmação" }); return; }
    const now = new Date();
    const [view] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(libraryViewsTable).values({ documentId: doc.id, userId, orgId, viewedAt: now, confirmedAt: now }).returning();
      await writeHistoryEvent({ category: "DELIVERY", action: "library.read_confirmed", title: `Leitura confirmada: ${doc.title}`, narrative: "Leitura confirmada na Biblioteca.", entityType: "library_document", entityId: doc.id, actorId: userId, orgId, afterState: created }, tx as any);
      return [created] as const;
    });
    res.json({ view });
  } catch (err) { console.error("[library] POST confirm", err); res.status(500).json({ error: "Erro interno" }); }
});

router.get("/library/documents/:id/versions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const [document] = await db
      .select()
      .from(libraryDocumentsTable)
      .where(eq(libraryDocumentsTable.id, docId))
      .limit(1);

    if (!document) { res.status(404).json({ error: "Documento não encontrado" }); return; }
    if (document.orgId !== orgId) { res.status(403).json({ error: "Sem permissão" }); return; }

    const versions = await db
      .select()
      .from(libraryDocumentVersionsTable)
      .innerJoin(libraryDocumentsTable, eq(libraryDocumentVersionsTable.documentId, libraryDocumentsTable.id))
      .where(and(
        eq(libraryDocumentVersionsTable.documentId, docId),
        eq(libraryDocumentsTable.orgId, orgId),
      ))
      .orderBy(desc(libraryDocumentVersionsTable.version));

    res.json({ versions });
  } catch (err) {
    console.error("[library] GET /library/documents/:id/versions", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
