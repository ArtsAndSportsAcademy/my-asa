/**
 * Tarefas — quem recebe tarefa no lote fica sabendo.
 * Cobre o que o crivo das "coisinhas" pegou na revisão de Tarefas: o lote criava as tarefas e não avisava
 * ninguém; a pessoa só descobria se abrisse a tela. O aviso é um por pessoa e por lote (não um por tarefa)
 * e não vai para quem confirmou o lote atribuindo a si mesma.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };
const espera = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function run() {
  const tag = `tarefas_lote_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), ana = await makeUser("ana"), bia = await makeUser("bia");
  const all = [admin, ana, bia];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: ana.id, operationId: operation!.id, role: "MEMBER", active: true },
      { userId: bia.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const adminApi = as(admin.id, "ADMIN"), anaApi = as(ana.id, "MEMBER");
    const avisosDe = (userId: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, "task.assigned")));
    // O aviso sai depois da resposta (não segura o lote); espera ele aparecer.
    const esperaAvisos = async (userId: string, quantos: number) => { for (let i = 0; i < 40; i++) { const rows = await avisosDe(userId); if (rows.length >= quantos) return rows; await espera(500); } return avisosDe(userId); };

    const prazo = "2026-12-30";
    const lote = await adminApi("/tasks/batch", { method: "POST", body: JSON.stringify({ operationId: operation!.id, tasks: [
      { title: "Provar o figurino novo", assigneeId: ana.id, dueDate: prazo },
      { title: "Conferir as luvas", assigneeId: ana.id, dueDate: prazo },
      { title: "Provar o figurino novo", assigneeId: bia.id, dueDate: prazo },
      { title: "Separar o próprio material", assigneeId: admin.id, dueDate: prazo },
    ] }) });
    const loteCorpo = await lote.json() as { tasks?: { id: string }[] };
    assert(lote.status === 201 && loteCorpo.tasks?.length === 4, `Administração confirma um lote de 4 tarefas (${lote.status})`);

    const avisosAna = await esperaAvisos(ana.id, 1);
    assert(avisosAna.length === 1, `Quem recebe duas tarefas no mesmo lote recebe um aviso só (${avisosAna.length})`);
    assert(avisosAna[0]?.title === "2 novas tarefas para você" && /Provar o figurino novo/.test(avisosAna[0]?.message ?? "") && /30\/12/.test(avisosAna[0]?.message ?? "") && /mais 1/.test(avisosAna[0]?.message ?? ""), `O aviso conta quantas são, a primeira e o prazo: ${JSON.stringify(avisosAna[0])}`);
    assert(avisosAna[0]?.actionUrl === "/responsabilidades", `O aviso leva a Tarefas (${avisosAna[0]?.actionUrl})`);
    const avisosBia = await esperaAvisos(bia.id, 1);
    assert(avisosBia.length === 1 && avisosBia[0]?.title === "Nova tarefa para você", `Quem recebe uma tarefa só recebe o aviso no singular (${JSON.stringify(avisosBia[0]?.title)})`);
    await espera(1500);
    assert((await avisosDe(admin.id)).length === 0, "Quem confirmou o lote não é avisada das tarefas que deu a si mesma");

    // Lote recusado não avisa ninguém: Elenco não confirma lote.
    const antes = (await avisosDe(bia.id)).length;
    const recusado = await anaApi("/tasks/batch", { method: "POST", body: JSON.stringify({ operationId: operation!.id, tasks: [{ title: "Tarefa que não devia existir", assigneeId: bia.id, dueDate: prazo }] }) });
    await espera(1500);
    assert(recusado.status === 403 && (await avisosDe(bia.id)).length === antes, `Lote recusado (${recusado.status}) não avisa ninguém`);

    const registros = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "task.created")));
    assert(registros.length === 4, `Cada tarefa do lote entrou no Registro (${registros.length})`);
  } finally {
    if (server) { (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    const userIds = all.map(user => user.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Tarefas (aviso do lote): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
