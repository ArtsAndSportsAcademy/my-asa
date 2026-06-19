import { pgTable, text, uuid, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";

export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "DELIVERED", "FAILED"]);
export const platformEnum = pgEnum("platform", ["IOS", "ANDROID"]);

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("NORMAL"),
  payload: jsonb("payload").notNull().default("{}"),
  deviceToken: text("device_token"),
  platform: platformEnum("platform"),
  status: notificationStatusEnum("status").notNull().default("PENDING"),
  retryCount: integer("retry_count").notNull().default(0),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

// ─── User Notifications (PUSH-D01) ────────────────────────────────────────────
// Semantic notification layer — separate from the push-delivery `notifications` table.
// Answers "do I need to do something or just know about this?"

export const userNotificationPriorityEnum = pgEnum("user_notification_priority", [
  "LOW",
  "NORMAL",
  "IMPORTANT",
  "CRITICAL",
]);

export const userNotificationCategoryEnum = pgEnum("user_notification_category", [
  "schedule",
  "book",
  "notice",
  "approval",
  "absence",
  "rehearsal",
  "responsibility",
  "message",
  "system",
]);

export const userNotificationsTable = pgTable("user_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: userNotificationPriorityEnum("priority").notNull().default("NORMAL"),
  category: userNotificationCategoryEnum("category").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  actionUrl: text("action_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertUserNotificationSchema = createInsertSchema(userNotificationsTable).omit({
  id: true,
  createdAt: true,
  readAt: true,
});
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotificationsTable.$inferSelect;
