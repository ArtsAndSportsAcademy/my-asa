/** Fase E — o ciclo operacional chamado pelo agendador do Supabase (produção na Vercel). PostgreSQL real de teste. */
import http from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db, notificationOutboxTable, operationsTable, organizationsTable, pool, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { enqueueNotification } from "../src/services/undo.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `ciclo_${Date.now()}`;
  // Silêncio desligado: este teste prova o ciclo, não o silêncio noturno (que tem teste próprio).
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org`, regras: { silencio: { on: false, de: "22:00", ate: "06:00" }, lembreteCheckinMin: 30 } }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [julia] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Julia", fullName: `Julia ${tag}`, username: `${tag}_julia` }).returning();
  await db.insert(userRolesTable).values({ userId: julia!.id, operationId: op!.id, role: "MEMBER", active: true });
  const chave = "chave-do-agendador-de-teste-0123456789";
  const original = process.env.CRON_SECRET;
  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const ciclo = (headers: Record<string, string> = {}, rota = "ciclo") => fetch(`http://127.0.0.1:${address.port}/api/internal/${rota}`, { method: "POST", signal: AbortSignal.timeout(120_000), headers: { "content-type": "application/json", ...headers }, body: "{}" });

    delete process.env.CRON_SECRET;
    assert((await ciclo({ "x-myasa-cron": chave })).status === 503, "sem CRON_SECRET no servidor, o ciclo não roda");
    process.env.CRON_SECRET = chave;
    assert((await ciclo()).status === 401, "sem a chave do agendador, 401");
    assert((await ciclo({ "x-myasa-cron": "chave-errada-mas-do-mesmo-tamanho-000" })).status === 401, "chave errada, 401");
    assert((await ciclo({ authorization: `Bearer ${chave}` })).status === 401, "a chave só vale no cabeçalho do agendador, não como sessão");

    await db.transaction((tx) => enqueueNotification(tx as never, { userId: julia!.id, type: "scale.published", category: "schedule", title: `${tag} escala saiu`, message: "m" }, new Date(), { deduplicationKey: `${tag}:aviso` }));
    const ok = await ciclo({ "x-myasa-cron": chave });
    const corpo = await ok.json() as { ok?: boolean; ms?: number };
    assert(ok.status === 200 && corpo.ok === true && typeof corpo.ms === "number", "com a chave certa, o ciclo roda e responde quanto levou");
    const [linha] = (await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, julia!.id)));
    assert(linha?.status === "delivered", "o aviso que estava na fila foi entregue pelo ciclo");
    const noApp = await db.select().from(userNotificationsTable).where(eq(userNotificationsTable.userId, julia!.id));
    assert(noApp.some((n) => n.title === `${tag} escala saiu`), "e apareceu no app da pessoa");

    const [a, b] = await Promise.all([ciclo({ "x-myasa-cron": chave }), ciclo({ "x-myasa-cron": chave })]);
    assert(a.status === 200 && b.status === 200, "dois ciclos ao mesmo tempo não quebram (um espera a vez ou é pulado)");
    assert((await ciclo({ "x-myasa-cron": chave }, "tarefas-do-dia")).status === 200, "o lembrete diário de tarefas também roda pelo agendador");
    assert((await ciclo({}, "tarefas-do-dia")).status === 401, "e também exige a chave");
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original;
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(notificationOutboxTable).where(eq(notificationOutboxTable.userId, julia!.id));
    await db.delete(userNotificationsTable).where(eq(userNotificationsTable.userId, julia!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, julia!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, [julia!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no ciclo do agendador`);
  process.stdout.write(`fase-e-ciclo: ${passed} asserts passed\n`);
}

process.stdout.write("fase-e-ciclo: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
