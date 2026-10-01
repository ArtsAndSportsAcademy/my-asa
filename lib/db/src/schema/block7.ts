import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./identity.js";
import { userNotificationsTable } from "./notifications.js";

export const undoActionsTable = pgTable("undo_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  kind: text("kind").notNull(),
  entityId: uuid("entity_id").notNull(),
  changes: jsonb("changes").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
export const notificationOutboxTable = pgTable("notification_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  undoActionId: uuid("undo_action_id").references(() => undoActionsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  payload: jsonb("payload").notNull(),
  deduplicationKey: text("deduplication_key").unique(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  notificationId: uuid("notification_id").references(() => userNotificationsTable.id),
  attempts: integer("attempts").notNull().default(0),
  leasedUntil: timestamp("leased_until", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("notification_outbox_due_idx").on(t.status, t.dueAt)]).enableRLS();
export const webPushSubscriptionsTable = pgTable("web_push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
export const pwaInstallationsTable = pgTable("pwa_installations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  installationId: uuid("installation_id").notNull(),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique("pwa_installation_user_device_uq").on(t.userId, t.installationId)]).enableRLS();
