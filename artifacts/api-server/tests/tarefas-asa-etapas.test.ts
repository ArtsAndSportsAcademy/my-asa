/**
 * ASA e etapas — a ASA ainda muda status, pessoa, prazo e checklist direto na linha de `tasks`. Depois de cada escrita dela,
 * as etapas são sincronizadas pelo que mudou (antes → depois), para que lembretes, Meu Dia e aprovação sigam certos.
 * Cobre: cancelar encerra as etapas; "pronta para aprovação" entrega a etapa de trabalho e abre a aprovação (que então pode
 * ser aprovada pelas rotas de sempre); trocar a pessoa move a etapa da vez e avisa a nova; mudar o prazo acompanha as etapas
 * que usavam o prazo antigo; o checklist obrigatório vale nos dois lugares (ASA e tela); tarefa criada pela ASA ganha etapas.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, taskStepsTable, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import { atualizarEtapa, concluirEtapa, criarTarefa, etapasDoCorpoAntigo, preencherEtapasDe, sincronizarEtapasDaTarefa } from "../src/services/task-steps.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `tarefas_asa_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), ana = await makeUser("ana"), bia = await makeUser("bia"), cris = await makeUser("cris");
  const todos = [admin, ana, bia, cris];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  try {
    await db.insert(userRolesTable).values([{ userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true }, ...[ana, bia, cris].map((p) => ({ userId: p.id, operationId: operation!.id, role: "MEMBER" as const, active: true }))]);
    const ator = (pessoa: typeof ana, role = "MEMBER", gestor = false) => ({ id: pessoa.id, organizationId: org!.id, role, gestor });
    const nova = async (title: string, extra: { dueDate?: string; semAprovacao?: boolean; checklist?: { id: string; label: string; completed: boolean }[] } = {}) =>
      (await db.transaction((tx) => criarTarefa(tx, ator(ana), {
        operationId: operation!.id, title, dueDate: extra.dueDate, mandatoryChecklist: extra.checklist,
        steps: etapasDoCorpoAntigo({ title, assigneeId: bia.id, approverId: admin.id, requiresApproval: !extra.semAprovacao, creatorId: ana.id, dueDate: extra.dueDate, mandatoryChecklist: extra.checklist }),
      }))).task;
    const linha = async (id: string) => (await db.select().from(tasksTable).where(eq(tasksTable.id, id)))[0]!;
    const etapas = (id: string) => db.select().from(taskStepsTable).where(eq(taskStepsTable.taskId, id)).orderBy(taskStepsTable.position);
    const estados = async (id: string) => (await etapas(id)).map((e) => e.status).join(",");
    // A ASA escreve em tasks e chama a sincronização com a linha de antes e a de depois, na mesma transação.
    const comoAAsa = async (id: string, mudanca: Partial<typeof tasksTable.$inferInsert>) => {
      const antes = await linha(id);
      await db.transaction(async (tx) => {
        const [depois] = await tx.update(tasksTable).set({ ...mudanca, updatedAt: new Date() }).where(eq(tasksTable.id, id)).returning();
        await sincronizarEtapasDaTarefa(tx, antes, depois!, { id: ana.id });
      });
    };
    const fila = (userId: string) => db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, userId)).then((rows) => rows.map((row) => row.payload as { type: string; entityId?: string }));

    // ── Cancelar ──────────────────────────────────────────────────────────────────
    const cancelada = await nova("Cancelada pela ASA");
    await comoAAsa(cancelada.id, { status: "CANCELLED", cancelledAt: new Date() });
    assert(await estados(cancelada.id) === "DISPENSED,DISPENSED", `cancelar pela ASA encerra as etapas (${await estados(cancelada.id)})`);

    // ── Pronta para aprovação ─────────────────────────────────────────────────────
    const entregue = await nova("Entregue pela ASA");
    await comoAAsa(entregue.id, { status: "READY_FOR_APPROVAL" });
    const [trabalho, aprovacao] = await etapas(entregue.id);
    assert(trabalho?.status === "DONE" && aprovacao?.status === "ACTIVE", `"pronta para aprovação" entrega a etapa de trabalho e abre a aprovação (${await estados(entregue.id)})`);
    assert((await fila(admin.id)).some((aviso) => aviso.type === "task.awaiting_approval" && aviso.entityId === entregue.id), "quem aprova é avisado");
    const aprovada = await db.transaction((tx) => concluirEtapa(tx, ator(admin, "ADMIN", true), entregue.id, aprovacao!.id));
    assert(aprovada.task.status === "APPROVED", `depois da ASA, a aprovação pelas rotas de sempre conclui a tarefa (${aprovada.task.status})`);

    // ── Concluir sem aprovação ────────────────────────────────────────────────────
    const direta = await nova("Concluída direto", { semAprovacao: true });
    await comoAAsa(direta.id, { status: "COMPLETED", completedAt: new Date() });
    assert(await estados(direta.id) === "DONE", `concluir pela ASA fecha a etapa única (${await estados(direta.id)})`);

    // ── Trocar a pessoa ───────────────────────────────────────────────────────────
    const trocada = await nova("Trocada pela ASA");
    await comoAAsa(trocada.id, { assigneeId: cris.id });
    const [etapaTrocada] = await etapas(trocada.id);
    assert(etapaTrocada?.assigneeId === cris.id, "trocar a pessoa pela ASA move a etapa da vez");
    assert((await fila(cris.id)).some((aviso) => aviso.type === "task.step_ready" && aviso.entityId === trocada.id), "a nova pessoa é avisada de que tem a vez");

    // ── Mudar o prazo ─────────────────────────────────────────────────────────────
    const comPrazo = await nova("Prazo mudado pela ASA", { dueDate: "2026-12-10" });
    await comoAAsa(comPrazo.id, { dueDate: "2026-12-20" });
    const [etapaPrazo] = await etapas(comPrazo.id);
    assert(etapaPrazo?.dueDate === "2026-12-20", `mudar o prazo pela ASA acompanha a etapa que usava o prazo antigo (${etapaPrazo?.dueDate})`);
    const propria = await nova("Etapa com prazo próprio", { dueDate: "2026-12-10" });
    await db.update(taskStepsTable).set({ dueDate: "2026-12-05" }).where(and(eq(taskStepsTable.taskId, propria.id), eq(taskStepsTable.position, 1)));
    await comoAAsa(propria.id, { dueDate: "2026-12-20" });
    assert((await etapas(propria.id))[0]?.dueDate === "2026-12-05", "a etapa que tem prazo próprio não muda com o prazo da tarefa");

    // ── Checklist obrigatório: um valor só, nos dois lugares ──────────────────────
    const itens = [{ id: "i1", label: "Conferir", completed: false }, { id: "i2", label: "Fotografar", completed: false }];
    const comChecklist = await nova("Checklist nos dois lugares", { checklist: itens });
    await comoAAsa(comChecklist.id, { mandatoryChecklist: itens.map((item) => item.id === "i1" ? { ...item, completed: true } : item) });
    const [etapaChecklist] = await etapas(comChecklist.id);
    assert(etapaChecklist?.checklist.find((item) => item.id === "i1")?.completed === true && etapaChecklist?.checklist.find((item) => item.id === "i2")?.completed === false, "marcar o item pela ASA marca o item da etapa");
    await db.transaction((tx) => atualizarEtapa(tx, ator(bia), comChecklist.id, etapaChecklist!.id, { checklist: [{ id: "i2", completed: true }] }));
    const espelhada = await linha(comChecklist.id);
    assert(espelhada.mandatoryChecklist?.find((item) => item.id === "i2")?.completed === true && espelhada.mandatoryChecklist?.find((item) => item.id === "i1")?.completed === true, "marcar o item na tela marca o item do checklist da tarefa, que a ASA confere");

    // ── Tarefa que a ASA cria direto na tabela ganha as etapas ────────────────────
    const [daAsa] = await db.insert(tasksTable).values({ organizationId: org!.id, operationId: operation!.id, title: "Criada pela ASA", creatorId: ana.id, assigneeId: bia.id, requiresApproval: true, status: "CREATED", dueDate: "2026-12-30", origin: "ASA" }).returning();
    await db.transaction((tx) => preencherEtapasDe(tx, daAsa!));
    const dasEtapas = await etapas(daAsa!.id);
    assert(dasEtapas.length === 2 && dasEtapas[0]?.assigneeId === bia.id && dasEtapas[0]?.dueDate === "2026-12-30" && dasEtapas[1]?.kind === "APPROVAL", `a tarefa criada pela ASA nasce com a etapa de trabalho e a de aprovação (${dasEtapas.length})`);
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
  console.log(`✓ ASA e etapas: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
