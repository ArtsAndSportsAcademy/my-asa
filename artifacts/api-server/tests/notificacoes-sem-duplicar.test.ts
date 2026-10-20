// Revisão 4, assunto 7: um aviso por acontecimento e por pessoa.
import { eq } from "drizzle-orm";
import { db, pool, organizationsTable, usersTable, userNotificationsTable } from "@workspace/db";
import { notifyMany } from "../src/services/notificationService.js";

let passed = 0;
const failures: string[] = [];
const assert = (value: unknown, message: string) => {
  if (value) { passed++; console.log(`  ✓ ${message}`); }
  else { failures.push(message); console.error(`  ✗ ${message}`); }
};

async function run() {
  const tag = `notif_dup_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: tag }).returning();
  const [ana] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_ana` }).returning();
  const [bia] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_bia` }).returning();
  try {
    // Ana aparece três vezes na lista (por exemplo: autora do aviso, parte do público e supervisora da área).
    await notifyMany([ana!.id, bia!.id, ana!.id, ana!.id], {
      type: "notice.updated", title: "Aviso atualizado", message: "teste", category: "notice", entityType: "notice", entityId: ana!.id,
    });
    const deAna = await db.select().from(userNotificationsTable).where(eq(userNotificationsTable.userId, ana!.id));
    const deBia = await db.select().from(userNotificationsTable).where(eq(userNotificationsTable.userId, bia!.id));
    assert(deAna.length === 1 && deBia.length === 1, "quem aparece mais de uma vez na lista recebe um aviso só");
  } finally {
    await pool.query("DELETE FROM notification_outbox WHERE user_id IN ($1, $2)", [ana!.id, bia!.id]).catch(() => {});
    await pool.query("DELETE FROM user_notifications WHERE user_id IN ($1, $2)", [ana!.id, bia!.id]);
    await pool.query("DELETE FROM users WHERE organization_id = $1", [org!.id]);
    await pool.query("DELETE FROM organizations WHERE id = $1", [org!.id]);
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length) process.exitCode = 1;
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
