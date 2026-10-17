/**
 * Tarefas em etapas — o que a revisão final da branch achou (17/10/2026).
 * Cobre: tarefa que nasceu sem etapas (lote, ASA, banco) continua podendo ser concluída e aprovada; a Administração de
 * outra organização não lê, não anexa e não cancela tarefa alheia; trocar a pessoa pelo jeito antigo só vale para
 * pessoa ativa; "Adicionar etapa" entra antes da aprovação; dispensar a última etapa avisa quem criou; cancelar encerra
 * as etapas e avisa quem ainda tinha o que fazer e quem criou; tarefa que nasce já na aprovação aguarda aprovação.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, taskStepsTable, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { processNotificationOutbox } from "../src/services/notification-outbox.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `tarefas_rev_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outra] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const makeUser = async (name: string, organizationId = org!.id, status: "ACTIVE" | "INACTIVE" = "ACTIVE") => (await db.insert(usersTable).values({ organizationId, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status, personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), ana = await makeUser("ana"), bia = await makeUser("bia"), cris = await makeUser("cris"), saiu = await makeUser("saiu", org!.id, "INACTIVE"), adminOutra = await makeUser("adminOutra", outra!.id);
  const todos = [admin, ana, bia, cris, saiu, adminOutra];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [operacaoOutra] = await db.insert(operationsTable).values({ organizationId: outra!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      ...[ana, bia, cris, saiu].map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
      { userId: adminOutra.id, operationId: operacaoOutra!.id, role: "ADMIN", active: true },
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string, organizationId = org!.id, operationId = operation!.id) => async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const response = await fetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId, role, operationIds: [operationId] })}`, "content-type": "application/json" } });
      const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, json };
    };
    const adminApi = as(admin.id, "ADMIN"), anaApi = as(ana.id, "MEMBER"), biaApi = as(bia.id, "MEMBER"), outraApi = as(adminOutra.id, "ADMIN", outra!.id, operacaoOutra!.id);
    const userIds = todos.map((person) => person.id);
    const entrega = async () => {
      for (let i = 0; i < 60; i++) {
        await processNotificationOutbox(async () => {});
        const faltam = await db.select({ id: notificationOutboxTable.id }).from(notificationOutboxTable).where(and(inArray(notificationOutboxTable.userId, userIds), inArray(notificationOutboxTable.status, ["pending", "sending"])));
        if (!faltam.length) return;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    };
    const avisos = (userId: string, type: string, taskId: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, type))).then((rows) => rows.filter((row) => row.entityId === taskId));
    const espera = async (userId: string, type: string, taskId: string) => { for (let i = 0; i < 40; i++) { const rows = await avisos(userId, type, taskId); if (rows.length) return rows; await new Promise((resolve) => setTimeout(resolve, 500)); } return avisos(userId, type, taskId); };
    const etapasDe = (taskId: string) => db.select().from(taskStepsTable).where(eq(taskStepsTable.taskId, taskId)).orderBy(taskStepsTable.position);
    const tarefa = async (id: string) => (await db.select().from(tasksTable).where(eq(tasksTable.id, id)))[0]!;

    // ── Tarefa que nasceu sem etapas (lote, ASA, gravada direto no banco) ───────────────
    const [antiga] = await db.insert(tasksTable).values({ organizationId: org!.id, operationId: operation!.id, title: "Tarefa do lote", creatorId: ana.id, assigneeId: bia.id, approverId: admin.id, requiresApproval: true, status: "CREATED", dueDate: "2026-12-30", origin: "PERSON" }).returning();
    const entregue = await biaApi(`/tasks/${antiga!.id}/ready-for-approval`, { method: "POST", body: {} });
    assert(entregue.status === 200 && (await tarefa(antiga!.id)).status === "READY_FOR_APPROVAL", `tarefa sem etapas: a pessoa conclui e a tarefa vai para aprovação (${entregue.status} ${(await tarefa(antiga!.id)).status})`);
    const aprovada = await adminApi(`/tasks/${antiga!.id}/approve`, { method: "POST", body: {} });
    assert(aprovada.status === 200 && (await tarefa(antiga!.id)).status === "APPROVED" && (await etapasDe(antiga!.id)).length === 2, `tarefa sem etapas: a aprovação conclui (${aprovada.status} ${(await tarefa(antiga!.id)).status})`);

    // ── Outra organização não enxerga nem mexe ──────────────────────────────────────────
    const criada = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Só desta casa", steps: [{ title: "Fazer", assigneeId: bia.id }, { title: "Aprovar", kind: "APPROVAL", assigneeId: admin.id }] } });
    const id: string = criada.json?.task?.id;
    const lerAlheia = await outraApi(`/tasks/${id}/comments`), comentarAlheia = await outraApi(`/tasks/${id}/comments`, { method: "POST", body: { body: "oi" } });
    const anexarAlheia = await outraApi(`/tasks/${id}/evidences`, { method: "POST", body: { url: "https://drive.google.com/file/d/1AbCdEfGh/view" } });
    const cancelarAlheia = await outraApi(`/tasks/${id}/cancel`, { method: "POST", body: { reason: "x" } });
    assert([lerAlheia, comentarAlheia, anexarAlheia, cancelarAlheia].every((resposta) => resposta.status === 404) && (await tarefa(id)).status !== "CANCELLED", `a Administração de outra organização não lê, não comenta, não anexa e não cancela (${[lerAlheia, comentarAlheia, anexarAlheia, cancelarAlheia].map((r) => r.status).join(",")})`);

    // ── Trocar a pessoa pelo jeito antigo só vale para pessoa ativa ──────────────────────
    const trocaInvalida = await anaApi(`/tasks/${id}`, { method: "PATCH", body: { assigneeId: saiu.id } });
    const trocaDeOutraCasa = await anaApi(`/tasks/${id}`, { method: "PATCH", body: { assigneeId: adminOutra.id } });
    assert(trocaInvalida.status === 400 && trocaDeOutraCasa.status === 400 && /ativa/i.test(trocaInvalida.json?.message ?? ""), `trocar para pessoa desligada ou de outra casa é recusado com a frase (${trocaInvalida.status} ${trocaDeOutraCasa.status})`);

    // ── Adicionar etapa entra antes da aprovação ─────────────────────────────────────────
    const nova = await adminApi(`/tasks/${id}/steps`, { method: "POST", body: { title: "Editar", assigneeId: cris.id } });
    const ordem = (await etapasDe(id)).map((etapa) => etapa.title).join(">");
    assert(nova.status === 201 && ordem === "Fazer>Editar>Aprovar", `a etapa nova entra antes da aprovação (${ordem})`);

    // ── Dispensar a última etapa pendente avisa quem criou ───────────────────────────────
    const solo = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Etapa única", steps: [{ title: "Fazer", assigneeId: bia.id }] } });
    const soloId: string = solo.json?.task?.id; const [soloEtapa] = await etapasDe(soloId);
    await adminApi(`/tasks/${soloId}/steps/${soloEtapa!.id}/dispense`, { method: "POST", body: { reason: "Não precisa mais" } });
    const fim = await espera(ana.id, "task.completed", soloId);
    assert(fim.length === 1 && (await tarefa(soloId)).status === "COMPLETED", `dispensar a última etapa encerra a tarefa e avisa quem criou (${fim.length})`);

    // ── Cancelar encerra as etapas e avisa quem ainda tinha o que fazer e quem criou ────────
    const cancelavel = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Vai ser cancelada", steps: [{ title: "Primeira", assigneeId: bia.id }, { title: "Segunda", assigneeId: cris.id }] } });
    const cancelId: string = cancelavel.json?.task?.id;
    const cancelou = await adminApi(`/tasks/${cancelId}/cancel`, { method: "POST", body: { reason: "Mudou o plano" } });
    await entrega();
    const estados = (await etapasDe(cancelId)).map((etapa) => etapa.status).join(",");
    assert(cancelou.status === 200 && estados === "DISPENSED,DISPENSED", `cancelar encerra as etapas, que não aparecem mais como "na vez" (${cancelou.status} ${estados})`);
    assert((await avisos(bia.id, "task.cancelled", cancelId)).length === 1 && (await avisos(cris.id, "task.cancelled", cancelId)).length === 1 && (await avisos(ana.id, "task.cancelled", cancelId)).length === 1, "avisa quem tinha etapa e quem criou a tarefa");
    const registro = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, cancelId), eq(historyEventsTable.action, "task.cancelled")));
    assert(registro.length === 1 && JSON.stringify(registro[0]?.metadata ?? {}).includes("Mudou o plano"), "o cancelamento e o motivo estão no Registro");

    // ── Já nasce na aprovação: aguarda aprovação ────────────────────────────────────────
    const soAprovacao = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Só aprovar", steps: [{ title: "Aprovar", kind: "APPROVAL", assigneeId: admin.id }] } });
    assert((await tarefa(soAprovacao.json?.task?.id)).status === "READY_FOR_APPROVAL", "a tarefa que nasce com a aprovação na vez aguarda aprovação");
    const origemFalsa = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Origem", origin: "ASA", priority: "ENORME", steps: [{ title: "x", assigneeId: bia.id }] } });
    assert(origemFalsa.status === 400, `prioridade inventada é recusada com a frase, não vira erro de servidor (${origemFalsa.status})`);
    const origemSegura = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Origem", origin: "ASA", steps: [{ title: "x", assigneeId: bia.id }] } });
    assert(origemSegura.status === 201 && origemSegura.json?.task?.origin === "PERSON", `quem cria pela tela não escolhe a origem (${origemSegura.json?.task?.origin})`);
  } finally {
    const orgTasks = await db.select({ id: tasksTable.id }).from(tasksTable).where(inArray(tasksTable.organizationId, [org!.id, outra!.id]));
    const ids = orgTasks.map((task) => task.id); const userIds = todos.map((person) => person.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(inArray(historyEventsTable.orgId, [org!.id, outra!.id]));
    if (ids.length) await db.delete(taskStepsTable).where(inArray(taskStepsTable.taskId, ids));
    await db.delete(tasksTable).where(inArray(tasksTable.organizationId, [org!.id, outra!.id]));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(inArray(operationsTable.organizationId, [org!.id, outra!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outra!.id]));
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Tarefas (achados da revisão): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
