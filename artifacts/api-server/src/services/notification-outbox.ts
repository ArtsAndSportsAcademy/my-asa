import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db, notificationOutboxTable, userNotificationsTable, usersTable } from "@workspace/db";
import type { CreateNotificationInput } from "./notificationService.js";
import { deliverWebPush, WEB_PUSH_TYPES } from "./web-push.js";
import { sendPushToUser } from "./pushService.js";
import { normalizeActionUrl } from "../lib/app-routes.js";
import { pushEsperaAte } from "./regras-casa.js";

export async function deliverOutboxPush(input: CreateNotificationInput) {
  if (WEB_PUSH_TYPES.has(input.type)) await deliverWebPush(input);
  // Kept independent: Expo is legacy, never used as a Web Push subscription.
  if (!(input as CreateNotificationInput & { webOnly?: boolean }).webOnly) await sendPushToUser(input.userId, { title: input.title, body: input.message, priority: input.priority, data: { type: input.type } });
}
/** Claim due work under a row lock. In-app delivery is idempotent; push is at-least-once after crashes. */
export async function processNotificationOutbox(deliver: (input: CreateNotificationInput) => Promise<unknown> = deliverOutboxPush, limit = 50) {
  let delivered = 0;
  for (let i = 0; i < limit; i++) {
    const job = await db.transaction(async tx => {
      const [row] = await tx.select().from(notificationOutboxTable).where(and(
        inArray(notificationOutboxTable.status, ["pending", "sending"]),
        lte(notificationOutboxTable.dueAt, sql`clock_timestamp()`),
        or(eq(notificationOutboxTable.status, "pending"), lte(notificationOutboxTable.leasedUntil, sql`clock_timestamp()`)),
      )).orderBy(notificationOutboxTable.dueAt).limit(1).for("update", { skipLocked: true });
      if (!row) return null;
      const [person] = await tx.select({ status: usersTable.status }).from(usersTable).where(eq(usersTable.id, row.userId));
      if (person?.status !== "ACTIVE") { await tx.update(notificationOutboxTable).set({ status: "cancelled" }).where(eq(notificationOutboxTable.id, row.id)); return null; }
      const input = row.payload as CreateNotificationInput;
      let notificationId = row.notificationId;
      if (!notificationId) {
        const [notification] = await tx.insert(userNotificationsTable).values({ ...input, actionUrl: normalizeActionUrl(input.actionUrl, input.type), expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }).returning({ id: userNotificationsTable.id });
        notificationId = notification!.id;
      }
      // Silêncio noturno: o aviso já está no app; só o push espera o fim da janela da pessoa.
      const esperaAte = await pushEsperaAte({ ...input, userId: row.userId });
      if (esperaAte) {
        await tx.update(notificationOutboxTable).set({ notificationId, status: "pending", dueAt: esperaAte, leasedUntil: null }).where(eq(notificationOutboxTable.id, row.id));
        return { adiado: true as const };
      }
      await tx.update(notificationOutboxTable).set({ notificationId, status: "sending", attempts: row.attempts + 1, leasedUntil: sql`clock_timestamp() + interval '1 minute'` }).where(eq(notificationOutboxTable.id, row.id));
      return { ...row, input };
    });
    if (!job) break;
    if ("adiado" in job) continue;
    try {
      await deliver(job.input);
      await db.update(notificationOutboxTable).set({ status: "delivered", deliveredAt: new Date(), leasedUntil: null }).where(eq(notificationOutboxTable.id, job.id));
      delivered++;
    } catch (error) {
      // A durable retry, not a swallowed failure: attempts/lease remain inspectable.
      console.error("[outbox] tentativa de envio falhou; nova tentativa após a concessão", job.id, (error as Error).name);
    }
  }
  return { delivered };
}
