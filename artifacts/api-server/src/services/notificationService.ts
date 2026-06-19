import { db } from "@workspace/db";
import {
  userNotificationsTable,
  type InsertUserNotification,
  type UserNotification,
} from "@workspace/db";
import { eq, and, isNull, or, gt, desc, count } from "drizzle-orm";
import { domainLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";

const log = domainLogger(LOG_DOMAIN.NOTIFICATIONS);

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationPriority = "LOW" | "NORMAL" | "IMPORTANT" | "CRITICAL";
export type NotificationCategory =
  | "schedule"
  | "book"
  | "notice"
  | "approval"
  | "absence"
  | "rehearsal"
  | "responsibility"
  | "message"
  | "system";

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  category: NotificationCategory;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface GetNotificationsOptions {
  userId: string;
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

// ─── Core CRUD ───────────────────────────────────────────────────────────────

export async function createNotification(
  input: CreateNotificationInput,
): Promise<UserNotification> {
  const [notification] = await db
    .insert(userNotificationsTable)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      priority: input.priority ?? "NORMAL",
      category: input.category,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  log.debug({ notificationId: notification!.id, userId: input.userId, type: input.type }, "notification created");
  return notification!;
}

export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<UserNotification | null> {
  const [updated] = await db
    .update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotificationsTable.id, notificationId),
        eq(userNotificationsTable.userId, userId),
        isNull(userNotificationsTable.readAt),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await db
    .update(userNotificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotificationsTable.userId, userId),
        isNull(userNotificationsTable.readAt),
      ),
    )
    .returning({ id: userNotificationsTable.id });

  return result.length;
}

export async function getUserNotifications(
  options: GetNotificationsOptions,
): Promise<{ notifications: UserNotification[]; total: number }> {
  const { userId, category, unreadOnly = false, limit = 50, offset = 0 } = options;

  const conditions = [eq(userNotificationsTable.userId, userId)];
  if (category) conditions.push(eq(userNotificationsTable.category, category));
  if (unreadOnly) conditions.push(isNull(userNotificationsTable.readAt));

  const now = new Date();

  // exclude expired rows at DB level: expiresAt IS NULL OR expiresAt > now
  const expiryCondition = or(
    isNull(userNotificationsTable.expiresAt),
    gt(userNotificationsTable.expiresAt, now),
  )!;

  const [notifications, totalResult] = await Promise.all([
    db
      .select()
      .from(userNotificationsTable)
      .where(and(...conditions, expiryCondition))
      .orderBy(desc(userNotificationsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(userNotificationsTable)
      .where(and(...conditions, expiryCondition)),
  ]);

  return {
    notifications,
    total: totalResult[0]?.count ?? 0,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const now = new Date();
  const [row] = await db
    .select({ count: count() })
    .from(userNotificationsTable)
    .where(
      and(
        eq(userNotificationsTable.userId, userId),
        isNull(userNotificationsTable.readAt),
        or(
          isNull(userNotificationsTable.expiresAt),
          gt(userNotificationsTable.expiresAt, now),
        ),
      ),
    );

  return row?.count ?? 0;
}

// ─── sendNotification stub ────────────────────────────────────────────────────
// Prepared for future Expo Push / Firebase / APNs integration.
// Currently stores the notification and logs it.

export async function sendNotification(
  input: CreateNotificationInput,
): Promise<UserNotification> {
  const notification = await createNotification(input);

  // TODO: integrate with Expo Push / Firebase / APNs
  // e.g. call push service with notification.id and input details
  log.info(
    { notificationId: notification.id, userId: input.userId, priority: input.priority },
    "sendNotification — push stub (not yet connected to external service)",
  );

  return notification;
}

// ─── Convenience batch helper (notify multiple users) ───────────────────────

export async function notifyMany(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.all(userIds.map((userId) => sendNotification({ ...input, userId })));
}
