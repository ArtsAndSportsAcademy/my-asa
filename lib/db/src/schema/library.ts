import { pgTable, text, uuid, timestamp, integer, pgEnum, index, unique, boolean, customType } from "drizzle-orm/pg-core";
import { areasTable } from "./areas.js";
import { locationsTable } from "./locations.js";
import { usersTable } from "./identity.js";

const pdfBytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const libraryDocTypeEnum = pgEnum("library_doc_type", [
  "OPERATIONAL_PROCEDURE",
  "RULES_AND_POLICIES",
  "CHARACTER_REFERENCE",
  "COSTUME_REFERENCE",
  "ONBOARDING_MATERIAL",
  "SAFETY_PROCEDURE",
]);

export const libraryDocStatusEnum = pgEnum("library_doc_status", [
  "DRAFT",
  "PUBLISHED",
  "UPDATED",
  "ARCHIVED",
]);

export const libraryCategoriesTable = pgTable("library_categories", {
  id:          uuid("id").primaryKey().defaultRandom(),
  orgId:       uuid("org_id").notNull(),
  name:        text("name").notNull(),
  description: text("description"),
  active:      boolean("active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const libraryDocumentsTable = pgTable("library_documents", {
  id:            uuid("id").primaryKey().defaultRandom(),
  orgId:         uuid("org_id").notNull(),
  categoryId:    uuid("category_id").references(() => libraryCategoriesTable.id),
  type:          libraryDocTypeEnum("type").notNull(),
  title:         text("title").notNull(),
  slug:          text("slug"),
  summary:       text("summary"),
  body:          text("body").notNull().default(""),
  /** Link do PDF/documento no armazenamento escolhido pela Administração. */
  fileUrl:       text("file_url"),
  tags:          text("tags").array().notNull().default([]),
  requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
  scopeType:     text("scope_type").$type<"HOUSE" | "AREA" | "LOCATION">().notNull().default("HOUSE"),
  areaId:        uuid("area_id").references(() => areasTable.id),
  locationId:    uuid("location_id").references(() => locationsTable.id),
  status:        libraryDocStatusEnum("status").notNull().default("DRAFT"),
  version:       integer("version").notNull().default(1),
  responsibleId: uuid("responsible_id").references(() => usersTable.id),
  publishedAt:   timestamp("published_at", { withTimezone: true }),
  archivedAt:    timestamp("archived_at", { withTimezone: true }),
  createdBy:     uuid("created_by").notNull().references(() => usersTable.id),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const libraryDocumentVersionsTable = pgTable(
  "library_document_versions",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => libraryDocumentsTable.id),
    version:    integer("version").notNull(),
    title:      text("title").notNull(),
    body:       text("body").notNull(),
    summary:    text("summary"),
    createdBy:  uuid("created_by").notNull().references(() => usersTable.id),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.documentId, t.version)]
);

export const libraryDocumentPageCitationsTable = pgTable("library_document_page_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => libraryDocumentsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  pageNumber: integer("page_number").notNull(),
  excerpt: text("excerpt").notNull(),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("library_document_page_citations_doc_version_idx").on(t.documentId, t.version)]);

/**
 * Arquivo institucional guardado no próprio banco do piloto.
 *
 * A casa ainda não configurou um bucket de Storage separado. Para os PDFs
 * pequenos da Biblioteca, manter um único arquivo ativo por documento no
 * Postgres elimina uma dependência e continua passando por autenticação da API.
 */
export const libraryDocumentFilesTable = pgTable("library_document_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => libraryDocumentsTable.id),
  orgId: uuid("org_id").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  sizeBytes: integer("size_bytes").notNull(),
  content: pdfBytes("content").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => usersTable.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("library_document_files_doc_active_idx").on(t.documentId, t.active)]);

export const libraryViewsTable = pgTable("library_views", {
  id:         uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => libraryDocumentsTable.id),
  userId:     uuid("user_id").notNull().references(() => usersTable.id),
  orgId:      uuid("org_id").notNull(),
  viewedAt:   timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
}, (t) => [
  index("library_views_doc_idx").on(t.documentId),
  index("library_views_user_idx").on(t.userId),
]);

export type LibraryCategory = typeof libraryCategoriesTable.$inferSelect;
export type LibraryDocument = typeof libraryDocumentsTable.$inferSelect;
export type LibraryDocumentVersion = typeof libraryDocumentVersionsTable.$inferSelect;
export type LibraryDocumentPageCitation = typeof libraryDocumentPageCitationsTable.$inferSelect;
export type LibraryDocumentFile = typeof libraryDocumentFilesTable.$inferSelect;
export type LibraryView = typeof libraryViewsTable.$inferSelect;
