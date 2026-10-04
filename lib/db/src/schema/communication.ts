import { pgTable, text, uuid, timestamp, boolean, jsonb, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable, operationalGroupsTable } from "./organization.js";
import { areasTable } from "./areas.js";
import { locationsTable } from "./locations.js";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const noticeUrgencyEnum = pgEnum("notice_urgency", ["INFORMATIVE", "IMPORTANT", "CRITICAL"]);

export const noticeTypeEnum = pgEnum("notice_type", [
  "INFORMATIVE",
  "IMPORTANT",
  "PERSISTENT",
  "ESCALATED",
]);

export const noticeStatusEnum = pgEnum("notice_status", [
  "DRAFT",
  "PUBLISHED",
  "EXPIRED",
  "CANCELLED",
]);

export const noticeRecipientStatusEnum = pgEnum("notice_recipient_status", [
  "PENDING",
  "SENT",
  "VIEWED",
  "CONFIRMED",
  "ESCALATED",
]);

export const messageContextTypeEnum = pgEnum("message_context_type", [
  "REQUEST", "DELIVERY", "NOTICE", "MO", "DAILY_BOOK", "FREE",
]);

// ─── Mural ────────────────────────────────────────────────────────────────────
// Avisos e reconhecimentos compartilham o mesmo feed. Reconhecimento não é uma
// entidade paralela: é um tipo de publicação, para que a casa tenha uma única
// linha do tempo e uma única regra de escopo.
export const announcementTypeEnum = pgEnum("announcement_type", ["NOTICE", "RECOGNITION", "BIRTHDAY", "TENURE"]);
// PEOPLE (0053): aviso para pessoas escolhidas, listadas em announcement_recipients.
export const announcementScopeEnum = pgEnum("announcement_scope", ["HOUSE", "AREA", "LOCATION", "PEOPLE"]);

export const announcementsTable = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  type: announcementTypeEnum("type").notNull().default("NOTICE"),
  scope: announcementScopeEnum("scope").notNull().default("HOUSE"),
  areaId: uuid("area_id").references(() => areasTable.id),
  locationId: uuid("location_id").references(() => locationsTable.id),
  recipientId: uuid("recipient_id").references(() => usersTable.id),
  title: text("title"),
  body: text("body").notNull(),
  reason: text("reason"),
  requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("announcements_org_published_idx").on(table.orgId, table.publishedAt),
  index("announcements_recipient_idx").on(table.recipientId),
]);

export const announcementRecipientsTable = pgTable("announcement_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").notNull().references(() => announcementsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("announcement_recipients_announcement_user_uq").on(table.announcementId, table.userId),
  index("announcement_recipients_user_idx").on(table.userId),
]);

export const announcementReadsTable = pgTable("announcement_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").notNull().references(() => announcementsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  readAt: timestamp("read_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  reaction: text("reaction"),
  reactedAt: timestamp("reacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("announcement_reads_announcement_user_uq").on(table.announcementId, table.userId)]);

export const announcementCommentsTable = pgTable("announcement_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").notNull().references(() => announcementsTable.id),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("announcement_comments_post_idx").on(table.announcementId, table.createdAt)]);

// ─── Notices ───────────────────────────────────────────────────────────────────

export const noticesTable = pgTable("notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  urgency: noticeUrgencyEnum("urgency").notNull().default("INFORMATIVE"),
  type: noticeTypeEnum("type").notNull().default("INFORMATIVE"),
  status: noticeStatusEnum("status").notNull().default("DRAFT"),
  title: text("title"),
  content: text("content").notNull(),
  requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
  deltaJson: jsonb("delta_json"),
  autoGenerated: boolean("auto_generated").notNull().default(false),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
});

// ─── Notice Recipients ─────────────────────────────────────────────────────────

export const noticeRecipientsTable = pgTable("notice_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  noticeId: uuid("notice_id").notNull().references(() => noticesTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  status: noticeRecipientStatusEnum("status").notNull().default("PENDING"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Notice Escalations ────────────────────────────────────────────────────────

export const noticeEscalationsTable = pgTable("notice_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  noticeId: uuid("notice_id").notNull().references(() => noticesTable.id),
  recipientId: uuid("recipient_id").notNull().references(() => usersTable.id),
  escalatedBy: uuid("escalated_by").references(() => usersTable.id),
  reason: text("reason"),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Notice Confirmations (legacy — kept for compat) ──────────────────────────

export const noticeConfirmationsTable = pgTable("notice_confirmations", {
  id: uuid("id").primaryKey().defaultRandom(),
  noticeId: uuid("notice_id").notNull().references(() => noticesTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Message Threads ──────────────────────────────────────────────────────────
// Container for a conversation. Created by a user, linked to an operational context.
// context_type: SCALE | DAILY_BOOK | AGENDA | NOTICE | REQUEST | OPERATIONAL_CHANGE | DIRECT

export const messageThreadStatusEnum = pgEnum("message_thread_status", ["OPEN", "CLOSED"]);
export const messageParticipantRoleEnum = pgEnum("message_participant_role", ["INITIATOR", "PARTICIPANT"]);

export const messageThreadsTable = pgTable("message_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id"),
  title: text("title").notNull(),
  contextType: text("context_type"),
  contextId: text("context_id"),
  contextTitle: text("context_title"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  status: messageThreadStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
});

// ─── Message Thread Participants ──────────────────────────────────────────────

export const messageThreadParticipantsTable = pgTable("message_thread_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => messageThreadsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  role: messageParticipantRoleEnum("role").notNull().default("PARTICIPANT"),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("uniq_thread_user").on(t.threadId, t.userId)]);

export const messageThreadPreferencesTable = pgTable("message_thread_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => messageThreadsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  pinned: boolean("pinned").notNull().default(false),
  muted: boolean("muted").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("uniq_thread_preference_user").on(t.threadId, t.userId)]);

// ─── Messages ─────────────────────────────────────────────────────────────────
// Individual messages within a thread. Immutable — no edit, no delete (MSG-D04).

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").references(() => messageThreadsTable.id),
  senderId: uuid("sender_id").notNull().references(() => usersTable.id),
  senderName: text("sender_name"),
  recipientId: uuid("recipient_id").references(() => usersTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  contextType: messageContextTypeEnum("context_type"),
  contextId: uuid("context_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  quotedMessageId: uuid("quoted_message_id"),
});

// ─── Zod schemas ───────────────────────────────────────────────────────────────

export const insertNoticeSchema = createInsertSchema(noticesTable).omit({ id: true, createdAt: true });
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type Notice = typeof noticesTable.$inferSelect;

export const insertNoticeRecipientSchema = createInsertSchema(noticeRecipientsTable).omit({ id: true, createdAt: true });
export type InsertNoticeRecipient = z.infer<typeof insertNoticeRecipientSchema>;
export type NoticeRecipient = typeof noticeRecipientsTable.$inferSelect;

export const insertNoticeEscalationSchema = createInsertSchema(noticeEscalationsTable).omit({ id: true, createdAt: true });
export type InsertNoticeEscalation = z.infer<typeof insertNoticeEscalationSchema>;
export type NoticeEscalation = typeof noticeEscalationsTable.$inferSelect;

export const insertNoticeConfirmationSchema = createInsertSchema(noticeConfirmationsTable).omit({ id: true });
export type InsertNoticeConfirmation = z.infer<typeof insertNoticeConfirmationSchema>;
export type NoticeConfirmation = typeof noticeConfirmationsTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

export const insertMessageThreadSchema = createInsertSchema(messageThreadsTable).omit({ id: true, createdAt: true });
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type MessageThread = typeof messageThreadsTable.$inferSelect;

export const insertMessageThreadParticipantSchema = createInsertSchema(messageThreadParticipantsTable).omit({ id: true, joinedAt: true });
export type InsertMessageThreadParticipant = z.infer<typeof insertMessageThreadParticipantSchema>;
export type MessageThreadParticipant = typeof messageThreadParticipantsTable.$inferSelect;
