import { pgTable, text, uuid, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable, operationalGroupsTable } from "./organization.js";

export const noticeUrgencyEnum = pgEnum("notice_urgency", ["INFORMATIVE", "IMPORTANT", "CRITICAL"]);
export const messageContextTypeEnum = pgEnum("message_context_type", [
  "REQUEST", "DELIVERY", "NOTICE", "MO", "DAILY_BOOK", "FREE",
]);

export const noticesTable = pgTable("notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  urgency: noticeUrgencyEnum("urgency").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const noticeConfirmationsTable = pgTable("notice_confirmations", {
  id: uuid("id").primaryKey().defaultRandom(),
  noticeId: uuid("notice_id").notNull().references(() => noticesTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull().references(() => usersTable.id),
  recipientId: uuid("recipient_id").references(() => usersTable.id),
  groupId: uuid("group_id").references(() => operationalGroupsTable.id),
  contextType: messageContextTypeEnum("context_type"),
  contextId: uuid("context_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoticeSchema = createInsertSchema(noticesTable).omit({ id: true, createdAt: true });
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type Notice = typeof noticesTable.$inferSelect;

export const insertNoticeConfirmationSchema = createInsertSchema(noticeConfirmationsTable).omit({ id: true });
export type InsertNoticeConfirmation = z.infer<typeof insertNoticeConfirmationSchema>;
export type NoticeConfirmation = typeof noticeConfirmationsTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
