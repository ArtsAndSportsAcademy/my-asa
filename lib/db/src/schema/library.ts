import { pgTable, text, uuid, timestamp, integer, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./identity.js";

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

export const libraryViewsTable = pgTable("library_views", {
  id:         uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => libraryDocumentsTable.id),
  userId:     uuid("user_id").notNull().references(() => usersTable.id),
  orgId:      uuid("org_id").notNull(),
  viewedAt:   timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("library_views_doc_idx").on(t.documentId),
  index("library_views_user_idx").on(t.userId),
]);

export type LibraryCategory = typeof libraryCategoriesTable.$inferSelect;
export type LibraryDocument = typeof libraryDocumentsTable.$inferSelect;
export type LibraryDocumentVersion = typeof libraryDocumentVersionsTable.$inferSelect;
export type LibraryView = typeof libraryViewsTable.$inferSelect;
