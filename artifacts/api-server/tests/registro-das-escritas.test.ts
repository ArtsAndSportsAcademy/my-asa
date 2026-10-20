// Revisão 4, assunto 1: escritas que ficavam fora do Registro (categoria da Biblioteca e reconhecimento).
import http from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool, organizationsTable, operationsTable, usersTable, userRolesTable, historyEventsTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
const assert = (value: unknown, message: string) => {
  if (value) { passed++; console.log(`  ✓ ${message}`); }
  else { failures.push(message); console.error(`  ✗ ${message}`); }
};

async function run() {
  const tag = `registro_escritas_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: tag }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: tag, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Admin do Registro" }).returning();
  const [pessoa] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Pessoa reconhecida" }).returning();
  let server: http.Server | undefined;
  try {
    await db.insert(userRolesTable).values({ userId: admin!.id, operationId: operation!.id, role: "ADMIN" });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Servidor não iniciou");
    const token = signAccessToken({ sub: admin!.id, jti: randomUUID(), role: "ADMIN", organizationId: org!.id, operationIds: [operation!.id] });
    const request = (path: string, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const registroDe = (entityId: string, action: string) =>
      db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, entityId), eq(historyEventsTable.action, action)));

    const categoria = await request("/library/categories", "POST", { name: `Figurinos ${tag}`, description: "Teste" });
    const categoriaBody = await categoria.json() as any;
    assert(categoria.status === 201, "Categoria da Biblioteca é criada");
    const registroCategoria = await registroDe(categoriaBody.category.id, "library.category_created");
    assert(registroCategoria.length === 1 && registroCategoria[0]!.actorId === admin!.id, "Criar categoria da Biblioteca grava Registro com quem criou");

    const reconhecimento = await request("/asa/recognitions", "POST", { userId: pessoa!.id, type: "DESTAQUE", title: "Show impecável", message: "Obrigada pelo cuidado." });
    const reconhecimentoBody = await reconhecimento.json() as any;
    assert(reconhecimento.status === 201, "Reconhecimento é criado");
    const registroReconhecimento = await registroDe(reconhecimentoBody.recognition.id, "recognition.created");
    assert(registroReconhecimento.length === 1 && registroReconhecimento[0]!.actorId === admin!.id, "Dar reconhecimento grava Registro com quem deu");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query("DELETE FROM history_events WHERE org_id = $1", [org!.id]);
    await pool.query("DELETE FROM notification_outbox WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)", [org!.id]).catch(() => {});
    await pool.query("DELETE FROM user_notifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)", [org!.id]).catch(() => {});
    await pool.query("DELETE FROM recognitions WHERE organization_id = $1", [org!.id]);
    await pool.query("DELETE FROM library_categories WHERE org_id = $1", [org!.id]);
    await pool.query("DELETE FROM user_roles WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM users WHERE organization_id = $1", [org!.id]);
    await pool.query("DELETE FROM operations WHERE id = $1", [operation!.id]);
    await pool.query("DELETE FROM organizations WHERE id = $1", [org!.id]);
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length) process.exitCode = 1;
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
