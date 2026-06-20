import { db } from "@workspace/db";
import {
  deviceTokensTable,
  notificationsTable,
  type DeviceToken,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { domainLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";

const log = domainLogger(LOG_DOMAIN.NOTIFICATIONS);

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export type DevicePlatform = "IOS" | "ANDROID";

export interface RegisterDeviceTokenInput {
  userId: string;
  token: string;
  platform?: DevicePlatform | null;
}

export interface PushPayload {
  title: string;
  body: string;
  priority?: "LOW" | "NORMAL" | "IMPORTANT" | "CRITICAL";
  data?: Record<string, unknown>;
}

export interface PushDeliveryResult {
  attempted: number;
  sent: number;
  failed: number;
}

// ─── Token registration (upsert by unique token) ─────────────────────────────

export async function registerDeviceToken(
  input: RegisterDeviceTokenInput,
): Promise<DeviceToken> {
  const [row] = await db
    .insert(deviceTokensTable)
    .values({
      userId: input.userId,
      token: input.token,
      platform: input.platform ?? null,
    })
    .onConflictDoUpdate({
      target: deviceTokensTable.token,
      set: {
        userId: input.userId,
        platform: input.platform ?? null,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  log.debug({ userId: input.userId, platform: input.platform }, "device token registered");
  return row!;
}

// Deletes a token only when it belongs to the requesting user — prevents an
// authenticated user from removing another user's device token if they learn it.
export async function removeDeviceToken(userId: string, token: string): Promise<void> {
  await db
    .delete(deviceTokensTable)
    .where(and(eq(deviceTokensTable.token, token), eq(deviceTokensTable.userId, userId)));
}

// ─── Expo push validation ────────────────────────────────────────────────────

function isExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

// ─── Map semantic priority → Expo priority ───────────────────────────────────

function expoPriority(priority?: PushPayload["priority"]): "default" | "high" {
  return priority === "IMPORTANT" || priority === "CRITICAL" ? "high" : "default";
}

// ─── Core: send push to all of a user's devices ──────────────────────────────
// Records each attempt in the `notifications` (push-delivery) table with status
// SENT or FAILED. Never throws — returns a summary so callers (in-app history,
// Asa) can keep working even if push delivery fails.

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  const tokens = await db
    .select()
    .from(deviceTokensTable)
    .where(eq(deviceTokensTable.userId, userId));

  if (tokens.length === 0) {
    log.debug({ userId }, "no device tokens registered — skipping push");
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const valid = tokens.filter((t) => isExpoPushToken(t.token));
  if (valid.length === 0) {
    log.warn({ userId, total: tokens.length }, "no valid Expo push tokens for user");
    return { attempted: tokens.length, sent: 0, failed: tokens.length };
  }

  const messages = valid.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    sound: "default" as const,
    priority: expoPriority(payload.priority),
    data: payload.data ?? {},
  }));

  const now = new Date();
  // Per-token delivery status, indexed parallel to `valid`/`messages`.
  // Default each token to FAILED; flip to SENT only when Expo confirms its ticket.
  const tokenStatus: Array<"SENT" | "FAILED"> = valid.map(() => "FAILED");

  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.error({ userId, status: res.status, text }, "Expo push request failed");
      // All tokens stay FAILED.
    } else {
      const json = (await res.json()) as {
        data?: Array<{ status: "ok" | "error"; id?: string; message?: string }>;
      };
      const tickets = json.data ?? [];
      // Expo returns tickets in the same order as the messages we sent.
      tickets.forEach((ticket, i) => {
        if (i < tokenStatus.length && ticket.status === "ok") {
          tokenStatus[i] = "SENT";
        }
      });
      // Any token without a corresponding ticket remains FAILED (default).
    }
  } catch (err) {
    log.error({ userId, err }, "Expo push delivery threw");
    // All tokens stay FAILED.
  }

  const sent = tokenStatus.filter((s) => s === "SENT").length;
  const failed = tokenStatus.length - sent;

  // Record one delivery row per device token, each with its own real status.
  await Promise.all(
    valid.map((t, i) => {
      const status = tokenStatus[i]!;
      return db
        .insert(notificationsTable)
        .values({
          userId,
          type: String(payload.data?.["type"] ?? "PUSH"),
          priority: payload.priority ?? "NORMAL",
          payload: {
            title: payload.title,
            body: payload.body,
            ...(payload.data ?? {}),
          },
          deviceToken: t.token,
          platform: t.platform ?? undefined,
          status,
          deliveredAt: status === "SENT" ? now : null,
        })
        .catch((err) =>
          log.error({ userId, err }, "failed to record push delivery row"),
        );
    }),
  );

  log.info({ userId, attempted: valid.length, sent, failed }, "push delivery complete");
  return { attempted: valid.length, sent, failed };
}

// ─── Convenience: prune invalid tokens reported by Expo (best-effort) ─────────

export async function touchDeviceToken(token: string): Promise<void> {
  await db
    .update(deviceTokensTable)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(deviceTokensTable.token, token));
}
