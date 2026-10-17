/**
 * Link do Drive nas tarefas (rotas). A leitura do link tem o teste puro em tarefas-link-drive.test.ts; aqui:
 * o anexo só aceita link do Drive; o link fica ligado à etapa; a conferência de compartilhamento avisa e não bloqueia.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, taskEvidencesTable, taskStepsTable, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `tarefas_links_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const ana = await makeUser("ana"), bia = await makeUser("bia"), eva = await makeUser("eva");
  const todos = [ana, bia, eva];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values(todos.map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })));
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string) => async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const response = await fetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role: "MEMBER", operationIds: [operation!.id] })}`, "content-type": "application/json" } });
      const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, json };
    };
    const anaApi = as(ana.id), biaApi = as(bia.id), evaApi = as(eva.id);

    const criada = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Música do show", steps: [{ title: "Enviar a música", assigneeId: bia.id }] } });
    const tarefaId: string = criada.json?.task?.id; const etapaId: string = criada.json?.steps?.[0]?.id;

    const conferir = await biaApi("/tasks/check-link", { method: "POST", body: { url: "https://drive.google.com/file/d/1AbCdEfGh/view?usp=sharing" } });
    assert(conferir.status === 200 && conferir.json?.valid === true && conferir.json?.embedUrl === "https://drive.google.com/file/d/1AbCdEfGh/preview" && [true, false, null].includes(conferir.json?.shared), `a conferência devolve o endereço embutido e o compartilhamento (${conferir.status} ${JSON.stringify(conferir.json)})`);
    const lixo = await biaApi("/tasks/check-link", { method: "POST", body: { url: "javascript:alert(1)" } });
    assert(lixo.status === 200 && lixo.json?.valid === false && /Drive/.test(lixo.json?.message ?? ""), `link inválido volta com uma frase, sem erro de servidor (${JSON.stringify(lixo.json)})`);

    const foraDoDrive = await biaApi(`/tasks/${tarefaId}/evidences`, { method: "POST", body: { type: "LINK", url: "https://exemplo.com/arquivo.mp3", stepId: etapaId } });
    assert(foraDoDrive.status === 400 && /Drive/.test(foraDoDrive.json?.message ?? ""), `anexo fora do Drive é recusado com a frase (${foraDoDrive.status} ${foraDoDrive.json?.message})`);
    const upload = await biaApi(`/tasks/${tarefaId}/evidences`, { method: "POST", body: { type: "AUDIO", url: "data:audio/mp3;base64,AAAA" } });
    assert(upload.status === 400, `upload em texto (data:) é recusado (${upload.status})`);

    const boa = await biaApi(`/tasks/${tarefaId}/evidences`, { method: "POST", body: { url: "https://drive.google.com/file/d/1AbCdEfGh/view", description: "Música final", stepId: etapaId } });
    assert(boa.status === 201 && boa.json?.evidence?.type === "LINK" && boa.json?.evidence?.stepId === etapaId && boa.json?.embedUrl === "https://drive.google.com/file/d/1AbCdEfGh/preview", `link do Drive é aceito, ligado à etapa, mesmo sem checar o compartilhamento (${boa.status} ${JSON.stringify(boa.json).slice(0, 200)})`);
    assert(boa.json && "shared" in boa.json, "a resposta diz se o arquivo está compartilhado (true, false ou null)");

    const etapaDeOutra = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Outra", steps: [{ title: "x", assigneeId: bia.id }] } });
    const alheia = await biaApi(`/tasks/${tarefaId}/evidences`, { method: "POST", body: { url: "https://drive.google.com/file/d/1AbCdEfGh/view", stepId: etapaDeOutra.json?.steps?.[0]?.id } });
    assert(alheia.status === 400, `o link não pode ser ligado a uma etapa de outra tarefa (${alheia.status})`);
    const intrusa = await evaApi(`/tasks/${tarefaId}/evidences`, { method: "POST", body: { url: "https://drive.google.com/file/d/1AbCdEfGh/view" } });
    assert(intrusa.status === 403, `quem não é da tarefa não anexa (${intrusa.status})`);
    const detalhe = await anaApi(`/tasks/${tarefaId}`);
    assert(detalhe.json?.evidences?.length === 1 && detalhe.json.evidences[0].stepId === etapaId, "o detalhe da tarefa traz o link com a etapa dele");
  } finally {
    const orgTasks = await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    const ids = orgTasks.map((task) => task.id); const userIds = todos.map((person) => person.id);
    if (ids.length) { await db.delete(taskEvidencesTable).where(inArray(taskEvidencesTable.taskId, ids)); }
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
  console.log(`✓ Tarefas (links do Drive): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
