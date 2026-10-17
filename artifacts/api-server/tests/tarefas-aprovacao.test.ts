/**
 * Tarefas em etapas — aprovação como etapa e os avisos de fim e de cancelamento.
 * Cobre: a aprovação ativa avisa só quem aprova (e com texto de aprovação, não de "sua vez"); a Administração e a
 * Direção aprovam no lugar; quem criou é avisado quando a tarefa termina (e não quando foi ela mesma quem terminou);
 * cancelar avisa todas as pessoas que ainda tinham etapa por fazer, e só elas; a gestão enxerga a tarefa da lista.
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
  const tag = `tarefas_aprov_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), dir = await makeUser("dir"), ana = await makeUser("ana"), bia = await makeUser("bia"), cris = await makeUser("cris"), dan = await makeUser("dan");
  const todos = [admin, dir, ana, bia, cris, dan];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
      ...[ana, bia, cris, dan].map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const response = await fetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json" } });
      const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, json };
    };
    const adminApi = as(admin.id, "ADMIN"), dirApi = as(dir.id, "DIR"), anaApi = as(ana.id, "MEMBER"), biaApi = as(bia.id, "MEMBER"), crisApi = as(cris.id, "MEMBER"), danApi = as(dan.id, "MEMBER");
    const userIds = todos.map((person) => person.id);
    const entrega = async () => {
      for (let i = 0; i < 60; i++) {
        await processNotificationOutbox(async () => {});
        const faltam = await db.select({ id: notificationOutboxTable.id }).from(notificationOutboxTable).where(and(inArray(notificationOutboxTable.userId, userIds), inArray(notificationOutboxTable.status, ["pending", "sending"])));
        if (!faltam.length) return;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    };
    const avisos = (userId: string, type: string, taskId?: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, type))).then((rows) => taskId ? rows.filter((row) => row.entityId === taskId) : rows);
    const espera = async (userId: string, type: string, taskId: string, quantos: number) => { for (let i = 0; i < 40; i++) { const rows = await avisos(userId, type, taskId); if (rows.length >= quantos) return rows; await new Promise((resolve) => setTimeout(resolve, 500)); } return avisos(userId, type, taskId); };
    const etapasDe = (taskId: string) => db.select().from(taskStepsTable).where(eq(taskStepsTable.taskId, taskId)).orderBy(taskStepsTable.position);

    // Tarefa criada por Ana: Bia faz, Cris aprova.
    const criada = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Coreografia do hotel", dueDate: "2026-12-30", steps: [
      { title: "Criar a coreografia", assigneeId: bia.id },
      { title: "Aprovar", kind: "APPROVAL", assigneeId: cris.id },
    ] } });
    const tarefaId: string = criada.json?.task?.id;
    const [fazer, aprovar] = await etapasDe(tarefaId);
    await biaApi(`/tasks/${tarefaId}/steps/${fazer!.id}/complete`, { method: "POST", body: {} });
    await entrega();
    const paraAprovar = await avisos(cris.id, "task.awaiting_approval", tarefaId);
    assert(paraAprovar.length === 1 && /aprovar/i.test(paraAprovar[0]?.title ?? ""), `Quem aprova recebe o aviso de aprovação, com texto de aprovação (${JSON.stringify(paraAprovar.map((aviso) => aviso.title))})`);
    assert((await avisos(cris.id, "task.step_ready", tarefaId)).length === 0, "A aprovação não chega como aviso comum de \"sua vez\"");
    assert((await avisos(bia.id, "task.awaiting_approval", tarefaId)).length === 0 && (await avisos(ana.id, "task.awaiting_approval", tarefaId)).length === 0, "Só quem aprova recebe esse aviso");

    // A Direção aprova no lugar de quem foi designado; quem criou é avisada do fim.
    const aprovouDir = await dirApi(`/tasks/${tarefaId}/steps/${aprovar!.id}/complete`, { method: "POST", body: {} });
    assert(aprovouDir.status === 200, `A Direção aprova no lugar de quem foi designado (${aprovouDir.status})`);
    const fim = await espera(ana.id, "task.completed", tarefaId, 1);
    assert(fim.length === 1 && /coreografia do hotel/i.test(fim[0]?.message ?? ""), `Quem criou a tarefa é avisada quando ela termina (${fim.length})`);
    assert((await avisos(dir.id, "task.completed", tarefaId)).length === 0, "Quem terminou a tarefa não se avisa");

    // Quem criou e também termina não recebe aviso de si mesma.
    const propria = await biaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Minha própria", steps: [{ title: "Fazer", assigneeId: bia.id }] } });
    const propriaId: string = propria.json?.task?.id; const [minhaEtapa] = await etapasDe(propriaId);
    await biaApi(`/tasks/${propriaId}/steps/${minhaEtapa!.id}/complete`, { method: "POST", body: {} });
    await entrega();
    assert((await avisos(bia.id, "task.completed", propriaId)).length === 0, "Quem criou e concluiu a própria tarefa não recebe aviso de si mesma");

    // Cancelar avisa todas as pessoas que ainda tinham etapa por fazer, e só elas.
    const tres = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Cartaz do show", steps: [
      { title: "Desenhar", assigneeId: dan.id }, { title: "Imprimir", assigneeId: bia.id }, { title: "Pendurar", assigneeId: cris.id },
    ] } });
    const tresId: string = tres.json?.task?.id; const [desenhar] = await etapasDe(tresId);
    await danApi(`/tasks/${tresId}/steps/${desenhar!.id}/complete`, { method: "POST", body: {} });
    const cancelou = await adminApi(`/tasks/${tresId}/cancel`, { method: "POST", body: { reason: "O show mudou de data" } });
    assert(cancelou.status === 200, `A gestão cancela a tarefa (${cancelou.status})`);
    const avisoBia = await espera(bia.id, "task.cancelled", tresId, 1), avisoCris = await espera(cris.id, "task.cancelled", tresId, 1);
    assert(avisoBia.length === 1 && avisoCris.length === 1, `Quem tem a vez e quem ainda espera são avisados do cancelamento (${avisoBia.length}, ${avisoCris.length})`);
    assert(/O show mudou de data/.test(avisoBia[0]?.message ?? ""), "O aviso traz o motivo");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    assert((await avisos(dan.id, "task.cancelled", tresId)).length === 0, "Quem já tinha feito a sua etapa não é avisada");
    assert((await avisos(admin.id, "task.cancelled", tresId)).length === 0, "Quem cancelou não se avisa");

    // A gestão enxerga a tarefa na lista, com as etapas.
    const lista = await adminApi(`/tasks?operationId=${operation!.id}`), listaDir = await dirApi(`/tasks?operationId=${operation!.id}`);
    const naLista = lista.json?.tasks?.find((task: any) => task.id === tarefaId);
    assert(lista.status === 200 && naLista?.steps?.length === 2 && listaDir.json?.tasks?.some((task: any) => task.id === tarefaId), "Administração e Direção veem a tarefa do Elenco na lista, com as etapas");
    assert((await crisApi("/tasks")).status === 403, "O Elenco continua sem a lista geral (a dele é /tasks/my)");
  } finally {
    const orgTasks = await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    const ids = orgTasks.map((task) => task.id); const userIds = todos.map((person) => person.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    if (ids.length) await db.delete(taskStepsTable).where(inArray(taskStepsTable.taskId, ids));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Tarefas em etapas (aprovação e avisos): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
