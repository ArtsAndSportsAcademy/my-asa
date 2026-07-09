import { Router, type IRouter } from "express";
import { eq, and, desc, or, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  libraryCategoriesTable,
  libraryDocumentsTable,
  libraryDocumentVersionsTable,
  libraryViewsTable,
  usersTable,
  userRolesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN";
const MANAGER_ROLES: RoleValue[] = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

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

async function snapshotVersion(docId: string, userId: string, version: number, title: string, body: string, summary: string | null | undefined): Promise<void> {
  await db.insert(libraryDocumentVersionsTable).values({
    documentId: docId,
    version,
    title,
    body,
    summary: summary ?? null,
    createdBy: userId,
  }).onConflictDoNothing();
}

// ─── GET /library/categories ─────────────────────────────────────────────────

router.get("/library/categories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const cats = await db
      .select()
      .from(libraryCategoriesTable)
      .where(eq(libraryCategoriesTable.orgId, orgId))
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
      .select({ id: libraryCategoriesTable.id })
      .from(libraryCategoriesTable)
      .where(and(eq(libraryCategoriesTable.id, categoryId), eq(libraryCategoriesTable.orgId, orgId)))
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

    await db.delete(libraryCategoriesTable).where(eq(libraryCategoriesTable.id, categoryId));
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
    const isManager = role && MANAGER_ROLES.includes(role);

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
        version: libraryDocumentsTable.version,
        categoryId: libraryDocumentsTable.categoryId,
        responsibleId: libraryDocumentsTable.responsibleId,
        publishedAt: libraryDocumentsTable.publishedAt,
        archivedAt: libraryDocumentsTable.archivedAt,
        updatedAt: libraryDocumentsTable.updatedAt,
        createdAt: libraryDocumentsTable.createdAt,
        responsibleName: usersTable.name,
      })
      .from(libraryDocumentsTable)
      .leftJoin(usersTable, eq(libraryDocumentsTable.responsibleId, usersTable.id))
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

    const { title, type, summary, body, categoryId, responsibleId } = req.body;
    if (!title || !type) { res.status(400).json({ error: "title e type obrigatórios" }); return; }

    const [doc] = await db.insert(libraryDocumentsTable).values({
      orgId,
      title,
      type,
      summary: summary ?? null,
      body: body ?? "",
      categoryId: categoryId ?? null,
      responsibleId: responsibleId ?? null,
      createdBy: userId,
      status: "DRAFT",
      version: 1,
    }).returning();

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
    const isManager = role && MANAGER_ROLES.includes(role);

    const [doc] = await db
      .select({
        id: libraryDocumentsTable.id,
        orgId: libraryDocumentsTable.orgId,
        title: libraryDocumentsTable.title,
        type: libraryDocumentsTable.type,
        status: libraryDocumentsTable.status,
        summary: libraryDocumentsTable.summary,
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

    // Members can't see drafts
    if (!isManager && doc.status === "DRAFT") {
      res.status(403).json({ error: "Documento não publicado" });
      return;
    }

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

    res.json({ document: doc, versions });
  } catch (err) {
    console.error("[library] GET /library/documents/:id", err);
    res.status(500).json({ error: "Erro interno" });
  }
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

    const { title, summary, body, categoryId, responsibleId } = req.body;
    const now = new Date();

    const prevResponsible = doc.responsibleId;

    const [updated] = await db
      .update(libraryDocumentsTable)
      .set({
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(body !== undefined && { body }),
        ...(categoryId !== undefined && { categoryId }),
        ...(responsibleId !== undefined && { responsibleId }),
        updatedAt: now,
      })
      .where(eq(libraryDocumentsTable.id, docId))
      .returning();

    // History: responsible changed
    if (responsibleId !== undefined && responsibleId !== prevResponsible) {
      writeHistoryEvent({
        category: "DELIVERY",
        action: "library.responsible_changed",
        title: `Responsável alterado: ${doc.title}`,
        narrative: `Responsável do documento alterado por ${userId}.`,
        entityType: "library_document",
        entityId: docId,
        actorId: userId,
        orgId,
      }).catch(() => {});
    }

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
    const [updated] = await db.update(libraryDocumentsTable)
      .set({ status: "PUBLISHED", publishedAt: now, updatedAt: now })
      .where(eq(libraryDocumentsTable.id, docId))
      .returning();

    await snapshotVersion(docId, userId, doc.version, doc.title, doc.body, doc.summary);

    writeHistoryEvent({
      category: "DELIVERY",
      action: "library.published",
      title: `Documento publicado: ${doc.title}`,
      narrative: `Documento "${doc.title}" (v${doc.version}) publicado na Biblioteca.`,
      entityType: "library_document",
      entityId: docId,
      actorId: userId,
      orgId,
      metadata: { version: doc.version, type: doc.type },
    }).catch(() => {});

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

    const [updated] = await db.update(libraryDocumentsTable)
      .set({ title, body, summary: summary ?? doc.summary, status: "UPDATED", version: newVersion, updatedAt: now })
      .where(eq(libraryDocumentsTable.id, docId))
      .returning();

    await snapshotVersion(docId, userId, newVersion, title, body, summary ?? doc.summary);

    writeHistoryEvent({
      category: "DELIVERY",
      action: "library.versioned",
      title: `Documento atualizado: ${doc.title}`,
      narrative: `Nova versão v${newVersion} do documento "${doc.title}" publicada.`,
      entityType: "library_document",
      entityId: docId,
      actorId: userId,
      orgId,
      metadata: { previousVersion: doc.version, newVersion },
    }).catch(() => {});

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
    const [updated] = await db.update(libraryDocumentsTable)
      .set({ status: "ARCHIVED", archivedAt: now, updatedAt: now })
      .where(eq(libraryDocumentsTable.id, docId))
      .returning();

    writeHistoryEvent({
      category: "DELIVERY",
      action: "library.archived",
      title: `Documento arquivado: ${doc.title}`,
      narrative: `Documento "${doc.title}" arquivado por ${userId}. Arquivado ≠ excluído.`,
      entityType: "library_document",
      entityId: docId,
      actorId: userId,
      orgId,
    }).catch(() => {});

    res.json({ document: updated });
  } catch (err) {
    console.error("[library] POST /library/documents/:id/archive", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /library/documents/:id/versions — Histórico de versões ──────────────

router.get("/library/documents/:id/versions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const orgId = req.user!.organizationId;
    const docId = String(req.params.id);

    const role = await getUserRole(userId);
    if (!role || !MANAGER_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }

    const versions = await db
      .select()
      .from(libraryDocumentVersionsTable)
      .where(eq(libraryDocumentVersionsTable.documentId, docId))
      .orderBy(desc(libraryDocumentVersionsTable.version));

    res.json({ versions });
  } catch (err) {
    console.error("[library] GET /library/documents/:id/versions", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
