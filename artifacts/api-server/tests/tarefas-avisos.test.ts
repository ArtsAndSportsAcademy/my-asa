/**
 * Tarefas em etapas — lembretes de prazo, atrasada e parada (rodam no ciclo operacional, um aviso por acontecimento).
 * Cobre: um dia antes e no dia, só para quem está com a vez; atrasada avisa a pessoa e quem criou; parada há 3 dias avisa
 * quem criou; tarefa cancelada e etapa à espera não avisam; a etapa herda o prazo da tarefa (e do período); sem prazo
 * nenhum, nada; antes das 8h do horário local ninguém recebe; chamar o ciclo de novo não repete o aviso.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, taskStepsTable, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import { criarTarefa } from "../src/services/task-steps.js";
import { enqueueTaskReminders } from "../src/services/task-reminders.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `tarefas_avisos_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const ana = await makeUser("ana"), bia = await makeUser("bia"), cris = await makeUser("cris");
  const todos = [ana, bia, cris];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  try {
    await db.insert(userRolesTable).values(todos.map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })));
    const agora = new Date("2026-10-20T15:00:00Z"); // meio-dia no horário de Brasília: hoje = 2026-10-20
    const ator = { id: ana.id, organizationId: org!.id, role: "MEMBER", gestor: false };
    const nova = async (title: string, steps: { title: string; assigneeId: string; dueDate?: string }[], extra: { dueDate?: string; periodStart?: string; ordering?: "FREE" } = {}) =>
      (await db.transaction((tx) => criarTarefa(tx, ator, { operationId: operation!.id, title, steps, ...extra }))).task;
    const userIds = todos.map((person) => person.id);
    // O que o ciclo colocou na fila para a pessoa (a criação da tarefa também enfileira "sua vez"; aqui só importam os lembretes).
    const lembretes = async (userId: string, taskId: string) => (await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, userId)))
      .map((row) => row.payload as { type: string; entityId?: string }).filter((payload) => payload.entityId === taskId && payload.type.startsWith("task.") && payload.type !== "task.step_ready").map((payload) => payload.type);

    const amanha = await nova("Vence amanhã", [{ title: "Fazer", assigneeId: bia.id }], { dueDate: "2026-10-21" });
    const hoje = await nova("Vence hoje", [{ title: "Primeira", assigneeId: bia.id }, { title: "Segunda", assigneeId: cris.id }], { dueDate: "2026-10-20" });
    const atrasada = await nova("Atrasada", [{ title: "Fazer", assigneeId: bia.id }], { dueDate: "2026-10-19" });
    const atrasadaMinha = await nova("Atrasada da própria Ana", [{ title: "Fazer", assigneeId: ana.id }], { dueDate: "2026-10-19" });
    const herda = await nova("Etapa sem prazo próprio", [{ title: "Fazer", assigneeId: bia.id }], { dueDate: "2026-10-21" });
    const semPrazo = await nova("Sem prazo nenhum", [{ title: "Fazer", assigneeId: bia.id }]);
    const periodo = await nova("Período", [{ title: "Fazer", assigneeId: bia.id }], { periodStart: "2026-10-18", dueDate: "2026-10-20" });
    // Tarefa que nasceu sem etapas (lote, ASA): o lembrete vale pela pessoa e pelo prazo da própria tarefa.
    const [semEtapas] = await db.insert(tasksTable).values({ organizationId: org!.id, operationId: operation!.id, title: "Sem etapas", creatorId: ana.id, assigneeId: bia.id, status: "CREATED", dueDate: "2026-10-20", origin: "PERSON" }).returning();
    const cancelada = await nova("Cancelada", [{ title: "Fazer", assigneeId: bia.id }], { dueDate: "2026-10-21" });
    await db.update(tasksTable).set({ status: "CANCELLED" }).where(eq(tasksTable.id, cancelada.id));
    const parada = await nova("Parada", [{ title: "Fazer", assigneeId: bia.id }]);
    const dispensada = await nova("Etapa dispensada", [{ title: "Fazer", assigneeId: bia.id }], { dueDate: "2026-10-21" });
    await db.update(taskStepsTable).set({ status: "DISPENSED" }).where(eq(taskStepsTable.taskId, dispensada.id));
    // O relógio do ciclo é o do teste (agora): a última atividade de tudo é "agora", menos a da tarefa parada.
    await db.update(tasksTable).set({ lastActivityAt: agora }).where(eq(tasksTable.organizationId, org!.id));
    await db.update(tasksTable).set({ lastActivityAt: new Date(agora.getTime() - 4 * 86_400_000) }).where(eq(tasksTable.id, parada.id));

    // Antes das 8h do horário local ninguém recebe lembrete.
    const cedo = await enqueueTaskReminders(new Date("2026-10-20T08:00:00Z"), org!.id);
    assert(cedo.aviso + cedo.hoje + cedo.atrasada + cedo.parada === 0, `antes das 8h locais o ciclo não manda lembrete (${JSON.stringify(cedo)})`);

    const primeira = await enqueueTaskReminders(agora, org!.id);
    assert(primeira.aviso >= 2 && primeira.hoje >= 2 && primeira.atrasada === 2 && primeira.parada === 1, `o ciclo contou os lembretes (${JSON.stringify(primeira)})`);
    assert((await lembretes(bia.id, amanha.id)).join() === "task.due_soon", `um dia antes: a pessoa da etapa ativa é lembrada (${(await lembretes(bia.id, amanha.id)).join()})`);
    assert((await lembretes(bia.id, hoje.id)).join() === "task.due_today", "no dia: o lembrete do dia");
    assert((await lembretes(cris.id, hoje.id)).length === 0, "etapa que ainda espera a vez não recebe lembrete");
    assert((await lembretes(bia.id, atrasada.id)).join() === "task.overdue" && (await lembretes(ana.id, atrasada.id)).join() === "task.overdue", "atrasada: avisa a pessoa e quem criou");
    assert((await lembretes(ana.id, atrasadaMinha.id)).length === 1, "atrasada que é da própria criadora: um aviso só, não dois");
    assert((await lembretes(bia.id, herda.id)).join() === "task.due_soon", "a etapa sem prazo próprio herda o prazo da tarefa");
    assert((await lembretes(bia.id, semPrazo.id)).length === 0, "sem prazo nenhum não há lembrete");
    assert((await lembretes(bia.id, semEtapas.id)).join() === "task.due_today", "tarefa que nasceu sem etapas: o lembrete vale pela pessoa e pelo prazo da tarefa");
    assert((await lembretes(bia.id, periodo.id)).join() === "task.due_today", "com período, o lembrete conta do fim do período");
    assert((await lembretes(bia.id, cancelada.id)).length === 0 && (await lembretes(bia.id, dispensada.id)).length === 0, "tarefa cancelada e etapa dispensada não avisam");
    assert((await lembretes(ana.id, parada.id)).join() === "task.stalled" && (await lembretes(bia.id, parada.id)).length === 0, "parada há 3 dias ou mais avisa só quem criou");

    const total = (await db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds))).length;
    await enqueueTaskReminders(agora, org!.id);
    assert((await db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds))).length === total, "rodar o ciclo de novo no mesmo dia não repete nenhum aviso");
    const amanhaDeManha = await enqueueTaskReminders(new Date("2026-10-21T15:00:00Z"), org!.id);
    assert(amanhaDeManha.hoje >= 2 && (await lembretes(bia.id, amanha.id)).includes("task.due_today"), "no dia seguinte, o lembrete \"vence hoje\" sai uma vez");
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
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Tarefas (lembretes): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
