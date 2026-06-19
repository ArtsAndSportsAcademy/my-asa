import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable, organizationsTable } from "./organization.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const taskPriorityEnum = pgEnum("task_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "CREATED",
  "IN_PROGRESS",
  "READY_FOR_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

export const taskOriginEnum = pgEnum("task_origin", [
  "MANUAL",
  "REQUEST",
  "LIBRARY",
  "AI",
]);

export const taskEvidenceTypeEnum = pgEnum("task_evidence_type", [
  "PHOTO",
  "VIDEO",
  "DOCUMENT",
  "PDF",
  "LINK",
  "AUDIO",
  "PRESENTATION",
]);

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  operationId: uuid("operation_id")
    .notNull()
    .references(() => operationsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => usersTable.id),
  assigneeId: uuid("assignee_id")
    .notNull()
    .references(() => usersTable.id),
  approverId: uuid("approver_id").references(() => usersTable.id),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
  status: taskStatusEnum("status").notNull().default("CREATED"),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  /**
   * Array of { id: string; label: string; completed: boolean }
   * Defined by the creator. Required items must all be completed before
   * the task can move to READY_FOR_APPROVAL.
   */
  mandatoryChecklist: jsonb("mandatory_checklist")
    .$type<{ id: string; label: string; completed: boolean }[]>()
    .default([]),
  /**
   * Array of { id: string; label: string; completed: boolean }
   * Defined and maintained by the assignee. Informational — does not
   * block approval.
   */
  operationalChecklist: jsonb("operational_checklist")
    .$type<{ id: string; label: string; completed: boolean }[]>()
    .default([]),
  /**
   * Array of { id: string; type: TaskEvidenceType; description: string }
   * Defined by the creator. Each must be fulfilled before READY_FOR_APPROVAL.
   */
  mandatoryEvidences: jsonb("mandatory_evidences")
    .$type<{ id: string; type: string; description: string }[]>()
    .default([]),
  origin: taskOriginEnum("origin").notNull().default("MANUAL"),
  /** If origin=LIBRARY: optional reference to the library document produced */
  libraryDocumentId: uuid("library_document_id"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledById: uuid("cancelled_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Task Evidences ───────────────────────────────────────────────────────────

export const taskEvidencesTable = pgTable("task_evidences", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  uploaderId: uuid("uploader_id")
    .notNull()
    .references(() => usersTable.id),
  type: taskEvidenceTypeEnum("type").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  /**
   * true  → fulfills one of the mandatory evidences defined by the creator
   * false → complementary evidence added by the assignee
   */
  isRequired: boolean("is_required").notNull().default(false),
  /**
   * If this evidence fulfills a mandatory evidence slot, this stores the
   * mandatory evidence requirement id from tasks.mandatoryEvidences.
   */
  mandatoryEvidenceRefId: text("mandatory_evidence_ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Task Comments ────────────────────────────────────────────────────────────

export const taskCommentsTable = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Zod / Insert schemas ─────────────────────────────────────────────────────

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  cancelledById: true,
  approvedAt: true,
  completedAt: true,
});

export const insertTaskEvidenceSchema = createInsertSchema(
  taskEvidencesTable
).omit({ id: true, createdAt: true });

export const insertTaskCommentSchema = createInsertSchema(
  taskCommentsTable
).omit({ id: true, createdAt: true });

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
export type TaskEvidence = typeof taskEvidencesTable.$inferSelect;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
