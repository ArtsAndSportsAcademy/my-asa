import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db, webPushSubscriptionsTable, usersTable } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";
import type { CreateNotificationInput } from "./notificationService.js";
import { normalizeActionUrl } from "../lib/app-routes.js";

export const WEB_PUSH_TYPES = new Set(["scale.published", "scale.republished", "scale.changed", "checkin.shift_reminder", "notice.requires_ack"]);
export function validPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const hosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      (hosts.includes(url.hostname) || url.hostname.endsWith(".push.apple.com") || url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}
export function webPushConfigured() { return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT); }
export type PushTransport = typeof webpush.sendNotification;
/** No occurrence/absence text enters browser push, even if a caller sends it. */
export async function deliverWebPush(input: CreateNotificationInput, transport: PushTransport = webpush.sendNotification.bind(webpush)) {
  if (!WEB_PUSH_TYPES.has(input.type)) return { delivered: 0, skipped: "category" };
  const subscriptions = await db.select().from(webPushSubscriptionsTable).where(and(eq(webPushSubscriptionsTable.userId, input.userId), eq(webPushSubscriptionsTable.active, true)));
  if (!subscriptions.length) return { delivered: 0, skipped: "no_subscription" };
  if (!webPushConfigured()) throw new Error("Web Push requer VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT");
  const titles: Record<string, string> = { "scale.published": "Escala mudou", "scale.republished": "Escala mudou", "scale.changed": "Escala mudou", "checkin.shift_reminder": "Lembrete de check-in do turno", "notice.requires_ack": "Aviso que pede ciente" };
  const url = normalizeActionUrl(input.actionUrl, input.type);
  const payload = JSON.stringify({ title: titles[input.type], body: "Abra o My ASA para consultar.", type: input.type, url, tag: `${input.type}:${input.entityId ?? "today"}` });
  let delivered = 0;
  for (const subscription of subscriptions) {
    try {
      await transport({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, {
        TTL: 3600, timeout: 10_000, vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
      });
      delivered++;
    } catch (error) {
      if ([404, 410].includes((error as { statusCode?: number }).statusCode ?? 0)) {
        await db.transaction(async tx => {
          const [current] = await tx.select().from(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.id, subscription.id)).for("update");
          if (!current?.active) return;
          const [owner] = await tx.select({ organizationId: usersTable.organizationId }).from(usersTable).where(eq(usersTable.id, current.userId));
          await tx.update(webPushSubscriptionsTable).set({ active: false, updatedAt: new Date() }).where(eq(webPushSubscriptionsTable.id, current.id));
          await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "web_push.expired", title: "Inscrição expirada no provedor", narrative: "O provedor informou que a inscrição do navegador deixou de existir.", entityType: "web_push_subscription", entityId: current.id, orgId: owner?.organizationId, actorType: "DETERMINISTIC_ENGINE", beforeState: { active: true }, afterState: { active: false }, metadata: { statusCode: (error as { statusCode?: number }).statusCode } }, tx);
        });
      } else throw error;
    }
  }
  return { delivered, skipped: null };
}
