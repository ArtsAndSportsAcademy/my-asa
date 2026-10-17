/**
 * Tarefas em etapas — a parte com banco. As regras de quem tem a vez ficam em task-steps-estado.ts (puras);
 * aqui entram a validação, a gravação, o Registro e os avisos, sempre na mesma transação.
 *
 * A tabela tasks continua com status, assignee_id e due_date, porque o ASA, o Meu Dia e o Painel leem esses campos:
 * este serviço os mantém em dia (assignee_id é a pessoa que está com a vez).
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, operationsTable, responsibilitiesTable, taskCommentsTable, taskStepsTable, tasksTable, usersTable, type Task, type TaskStep } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { enqueueNotification, databaseNow, type Transaction } from "./undo.js";
import {
  aoConcluir, aoDispensar, aoPedirAjustes, aoReavaliar, statusDaTarefa, statusesIniciais,
  type Ordering, type StepKind, type StepLite, type TaskStatusValue, type Transicao,
} from "./task-steps-estado.js";

export const MAX_ETAPAS = 20;
const ENCERRADAS = ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export class TarefaError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

/** Quem age. `gestor` já vem resolvido pela rota (Administração, Direção, ou Supervisão da área da tarefa). */
export type Ator = { id: string; organizationId: string; role: string; gestor: boolean; /** Quem chama já grava o próprio Registro (a ASA): o serviço não grava um segundo evento. */ semRegistro?: boolean };
export type NovaEtapa = { kind?: StepKind; title: string; description?: string; assigneeId: string; dueDate?: string | null; checklist?: (string | { id?: string; label: string; completed?: boolean })[] };
export type NovaTarefa = {
  operationId: string; title: string; description?: string; ordering?: Ordering; periodStart?: string | null; dueDate?: string | null;
  priority?: string; responsibilityId?: string | null; origin?: string; libraryDocumentId?: string | null; steps: NovaEtapa[];
  /** Quando a tarefa nasce de um pedido aceito, quem pediu é quem criou; quem age (aceitou) é o ator. */
  creatorId?: string;
  /** Legado: o checklist obrigatório e as evidências do corpo antigo continuam gravados na tarefa. */
  mandatoryChecklist?: { id: string; label: string; completed: boolean }[]; mandatoryEvidences?: { id: string; type: string; description: string }[];
};
type Resultado = { task: Task; steps: TaskStep[] };

const ehAdministracao = (ator: Ator) => ator.role === "ADMIN" || ator.role === "DIR";
const prazoCurto = (iso?: string | null) => (iso ? ` (até ${iso.split("-").reverse().slice(0, 2).join("/")})` : "");
const lite = (steps: TaskStep[]): StepLite[] => steps.map((step) => ({ id: step.id, position: step.position, kind: step.kind, status: step.status, assigneeId: step.assigneeId, startedAt: step.startedAt }));
const itensDeChecklist = (lista: NovaEtapa["checklist"]) => (lista ?? []).map((item) => typeof item === "string"
  ? { id: randomUUID(), label: item.trim(), completed: false }
  : { id: item.id ?? randomUUID(), label: item.label.trim(), completed: Boolean(item.completed) }).filter((item) => item.label);

async function nomeDe(tx: Pick<typeof db, "select">, userId: string) {
  const [row] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.name ?? userId;
}

export async function pessoasAtivas(tx: Pick<typeof db, "select">, organizationId: string, ids: string[]) {
  const unicos = [...new Set(ids)];
  const rows = unicos.length ? await tx.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE"), inArray(usersTable.id, unicos))) : [];
  if (rows.length !== unicos.length) throw new TarefaError(400, "Há pessoa que não está ativa ou não é da casa. Escolha outra.");
}

async function carregar(tx: Transaction, organizationId: string, taskId: string): Promise<Resultado> {
  const [task] = await tx.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, organizationId))).for("update").limit(1);
  if (!task) throw new TarefaError(404, "Tarefa não encontrada");
  let steps = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position)).for("update");
  // Tarefa que nasceu sem etapas (lote, ASA, gravada direto no banco) ganha as etapas que ela já tinha ao ser mexida.
  if (!steps.length && !(ENCERRADAS as readonly string[]).includes(task.status)) steps = await preencherEtapasDe(tx, task);
  return { task, steps };
}

/** As etapas que uma tarefa sem etapas já tinha: a de trabalho (e a de aprovação, se pedia), no estado em que a tarefa está. */
export async function preencherEtapasDe(tx: Transaction, task: Task): Promise<TaskStep[]> {
  const entregue = task.status === "READY_FOR_APPROVAL";
  const linhas: (typeof taskStepsTable.$inferInsert)[] = [{
    taskId: task.id, position: 1, kind: "WORK", title: "Fazer", assigneeId: task.assigneeId, dueDate: task.dueDate, status: entregue ? "DONE" : "ACTIVE",
    checklist: task.mandatoryChecklist ?? [], startedAt: task.status === "IN_PROGRESS" ? task.updatedAt : null, doneAt: entregue ? task.updatedAt : null, doneById: entregue ? task.assigneeId : null,
  }];
  if (task.requiresApproval) linhas.push({ taskId: task.id, position: 2, kind: "APPROVAL", title: "Aprovar", assigneeId: task.approverId ?? task.creatorId, status: entregue ? "ACTIVE" : "WAITING" });
  return tx.insert(taskStepsTable).values(linhas).returning();
}

/** Para a lista e o detalhe: garante as etapas das tarefas abertas que ainda não têm (uma vez só, de forma idempotente). */
export async function garantirEtapas(taskIds: string[]) {
  if (!taskIds.length) return;
  const semEtapa = await db.select({ id: tasksTable.id, organizationId: tasksTable.organizationId }).from(tasksTable)
    .where(and(inArray(tasksTable.id, taskIds), notInArray(tasksTable.status, [...ENCERRADAS]), sql`not exists (select 1 from ${taskStepsTable} s where s.task_id = ${tasksTable.id} and s.active)`));
  for (const tarefa of semEtapa) await db.transaction((tx) => carregar(tx, tarefa.organizationId, tarefa.id)).catch(() => undefined);
}
const aberta = (task: Task) => { if ((ENCERRADAS as readonly string[]).includes(task.status)) throw new TarefaError(409, "Tarefa encerrada: não dá para mexer nas etapas."); };

type Aviso = "nova" | "vez" | "devolvida" | "saiu";
/** Um aviso por pessoa (e não um por etapa), nunca para quem fez a ação. */
async function avisar(tx: Transaction, ator: Ator, task: Task, steps: TaskStep[], ids: string[], quando: Aviso, now: Date) {
  const porPessoa = new Map<string, TaskStep[]>();
  for (const id of ids) {
    const step = steps.find((item) => item.id === id);
    if (step && step.assigneeId !== ator.id) porPessoa.set(step.assigneeId, [...(porPessoa.get(step.assigneeId) ?? []), step]);
  }
  for (const [userId, minhas] of porPessoa) {
    const primeira = minhas[0]!;
    const resto = minhas.length > 1 ? ` e mais ${minhas.length - 1}` : "";
    // A aprovação tem aviso próprio: quem aprova precisa saber que o trabalho já foi entregue, não só que "chegou a vez".
    const aprovar = quando !== "saiu" && quando !== "devolvida" && primeira.kind === "APPROVAL";
    const titulo = aprovar ? "Tarefa pronta para você aprovar" : quando === "nova" ? "Nova tarefa para você" : quando === "devolvida" ? "Pediram ajustes na sua etapa" : quando === "saiu" ? "Você saiu de uma etapa" : "Chegou a sua vez numa tarefa";
    await enqueueNotification(tx, {
      userId, type: quando === "saiu" ? "task.step_removed" : aprovar ? "task.awaiting_approval" : "task.step_ready", title: titulo,
      message: `${task.title} — ${primeira.title}${resto}${prazoCurto(primeira.dueDate ?? task.dueDate)}.`,
      priority: "NORMAL", category: "responsibility", entityType: "task", entityId: task.id, actionUrl: "/responsabilidades",
    }, now, { deduplicationKey: `task-step:${primeira.id}:${userId}:${quando}:${now.getTime()}` });
  }
}

type Mudanca = { transicao: Transicao; antes: TaskStep[] };
/** Grava o resultado de uma transição: estados das etapas, status e pessoa da vez na tarefa. */
async function aplicar(tx: Transaction, ator: Ator, task: Task, steps: TaskStep[], { transicao }: Mudanca, extra: Partial<TaskStep> & { alvo?: string } = {}, now = new Date()): Promise<Resultado> {
  const { alvo, ...camposAlvo } = extra;
  for (const step of steps) {
    const novo = transicao.statuses.get(step.id);
    const voltou = novo === "WAITING" || novo === "ACTIVE";
    const patch: Partial<TaskStep> = {};
    if (novo && novo !== step.status) {
      patch.status = novo;
      // Etapa que volta a ser feita (pedir ajustes) perde o "feito"; o que aconteceu fica no Registro.
      if (voltou && step.status === "DONE") { patch.doneAt = null; patch.doneById = null; }
      if (voltou && novo === "ACTIVE" && step.id === alvo) patch.startedAt = null;
    }
    if (step.id === alvo) Object.assign(patch, camposAlvo);
    if (Object.keys(patch).length) await tx.update(taskStepsTable).set(patch).where(eq(taskStepsTable.id, step.id));
  }
  const depois = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, task.id), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position));
  const status = ((): Task["status"] => {
    if (transicao.taskStatus !== "COMPLETED") return transicao.taskStatus;
    // Quem passou por uma aprovação termina em "Aprovada", como as tarefas de antes das etapas.
    return depois.some((step) => step.kind === "APPROVAL" && step.status === "DONE") ? "APPROVED" : "COMPLETED";
  })();
  const daVez = depois.find((step) => step.status === "ACTIVE");
  const aprovacao = depois.find((step) => step.kind === "APPROVAL");
  const [atualizada] = await tx.update(tasksTable).set({
    status,
    assigneeId: daVez?.assigneeId ?? task.assigneeId,
    approverId: aprovacao?.assigneeId ?? null,
    requiresApproval: Boolean(aprovacao),
    lastActivityAt: now, updatedAt: now,
    ...(status === "APPROVED" ? { approvedAt: now, completedAt: now } : status === "COMPLETED" ? { completedAt: now } : { completedAt: null, approvedAt: null }),
  }).where(eq(tasksTable.id, task.id)).returning();
  return { task: atualizada!, steps: depois };
}

async function registrar(tx: Transaction, ator: Ator, nome: string, task: Task, action: string, titulo: string, narrativa: string, metadata: Record<string, unknown> = {}, antes?: unknown, depois?: unknown) {
  if (ator.semRegistro) return;
  await writeHistoryEvent({
    category: "TASK", action, title: titulo, narrative: narrativa, entityType: "task", entityId: task.id,
    actorId: ator.id, actorName: nome, operationId: task.operationId, orgId: task.organizationId,
    metadata, beforeState: antes as Record<string, unknown> | null | undefined, afterState: depois as Record<string, unknown> | null | undefined,
  }, tx as never);
}

// ─── Criar ────────────────────────────────────────────────────────────────────

export async function criarTarefa(tx: Transaction, ator: Ator, entrada: NovaTarefa): Promise<Resultado> {
  const title = entrada.title?.trim();
  if (!title) throw new TarefaError(400, "Dê um título à tarefa.");
  if (!entrada.steps?.length) throw new TarefaError(400, "A tarefa precisa de pelo menos uma etapa, com a pessoa que faz.");
  if (entrada.steps.length > MAX_ETAPAS) throw new TarefaError(400, `Uma tarefa aceita até ${MAX_ETAPAS} etapas. Divida em duas tarefas.`);
  if (entrada.steps.some((step) => !step.title?.trim() || !step.assigneeId)) throw new TarefaError(400, "Toda etapa precisa de um nome e de uma pessoa.");
  for (const data of [entrada.dueDate, entrada.periodStart, ...entrada.steps.map((step) => step.dueDate)]) if (data && !DATA.test(data)) throw new TarefaError(400, "Data inválida. Use o formato do calendário.");
  if (entrada.periodStart && entrada.dueDate && entrada.dueDate < entrada.periodStart) throw new TarefaError(400, "O fim do período não pode ser antes do começo.");
  if (entrada.priority && !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(entrada.priority)) throw new TarefaError(400, "Prioridade inválida. Escolha baixa, média, alta ou crítica.");
  const [operation] = await tx.select({ id: operationsTable.id }).from(operationsTable).where(and(eq(operationsTable.id, entrada.operationId), eq(operationsTable.organizationId, ator.organizationId))).limit(1);
  if (!operation) throw new TarefaError(400, "Operação inválida.");
  if (entrada.responsibilityId) {
    const [responsabilidade] = await tx.select({ id: responsibilitiesTable.id }).from(responsibilitiesTable).where(and(eq(responsibilitiesTable.id, entrada.responsibilityId), eq(responsibilitiesTable.orgId, ator.organizationId))).limit(1);
    if (!responsabilidade) throw new TarefaError(400, "Responsabilidade inválida.");
  }
  await pessoasAtivas(tx, ator.organizationId, entrada.steps.map((step) => step.assigneeId));

  const ordering: Ordering = entrada.ordering === "FREE" ? "FREE" : "SEQUENTIAL";
  const ids = entrada.steps.map(() => randomUUID());
  const iniciais = statusesIniciais(ordering, entrada.steps.map((step, i) => ({ id: ids[i]!, position: i + 1, kind: step.kind === "APPROVAL" ? "APPROVAL" : "WORK" })));
  const primeiraAtiva = entrada.steps.find((_, i) => iniciais.get(ids[i]!) === "ACTIVE")!;
  const aprovacao = entrada.steps.find((step) => step.kind === "APPROVAL");
  const now = await databaseNow(tx);

  const [task] = await tx.insert(tasksTable).values({
    organizationId: ator.organizationId, operationId: entrada.operationId, responsibilityId: entrada.responsibilityId ?? null,
    title, description: entrada.description?.trim() || null, creatorId: entrada.creatorId ?? ator.id, assigneeId: primeiraAtiva.assigneeId, approverId: aprovacao?.assigneeId ?? null,
    requiresApproval: Boolean(aprovacao), priority: (entrada.priority as Task["priority"]) ?? "MEDIUM",
    // Se a primeira etapa na vez já é a aprovação, a tarefa nasce aguardando aprovação.
    status: primeiraAtiva.kind === "APPROVAL" ? "READY_FOR_APPROVAL" : "CREATED",
    dueDate: entrada.dueDate ?? null, periodStart: entrada.periodStart ?? null, ordering, lastActivityAt: now,
    mandatoryChecklist: entrada.mandatoryChecklist ?? [], mandatoryEvidences: entrada.mandatoryEvidences ?? [],
    origin: (entrada.origin as Task["origin"]) ?? "PERSON", libraryDocumentId: entrada.libraryDocumentId ?? null,
  }).returning();
  const steps = await tx.insert(taskStepsTable).values(entrada.steps.map((step, i) => ({
    id: ids[i]!, taskId: task!.id, position: i + 1, kind: step.kind === "APPROVAL" ? "APPROVAL" as const : "WORK" as const, title: step.title.trim(),
    description: step.description?.trim() || null, assigneeId: step.assigneeId, dueDate: step.dueDate ?? null,
    status: iniciais.get(ids[i]!)!, checklist: itensDeChecklist(step.checklist),
  }))).returning();
  const nome = await nomeDe(tx, ator.id);
  const doPedido = entrada.creatorId && entrada.creatorId !== ator.id ? await nomeDe(tx, entrada.creatorId) : null;
  await registrar(tx, ator, nome, task!, "task.created", `Tarefa criada: ${task!.title}`,
    `${doPedido ? `${nome} aceitou o pedido de ${doPedido}: a tarefa "${task!.title}" nasceu com` : `${nome} criou a tarefa "${task!.title}" com`} ${steps.length} ${steps.length === 1 ? "etapa" : "etapas"}${task!.dueDate ? `, prazo ${task!.dueDate}` : ", sem prazo"}.`,
    { ordering, steps: steps.map((step) => ({ title: step.title, assigneeId: step.assigneeId, kind: step.kind })) });
  await avisar(tx, ator, task!, steps, steps.filter((step) => step.status === "ACTIVE").map((step) => step.id), "nova", now);
  return { task: task!, steps };
}

// ─── Mexer ────────────────────────────────────────────────────────────────────

export async function iniciarEtapa(tx: Transaction, ator: Ator, taskId: string, stepId: string): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  const etapa = steps.find((step) => step.id === stepId);
  if (!etapa) throw new TarefaError(404, "Etapa não encontrada");
  if (etapa.assigneeId !== ator.id && !ator.gestor) throw new TarefaError(403, "Esta etapa não é sua.");
  if (etapa.status !== "ACTIVE") throw new TarefaError(409, "Esta etapa ainda não tem a vez (ou já foi encerrada).");
  const now = await databaseNow(tx);
  if (!etapa.startedAt) await tx.update(taskStepsTable).set({ startedAt: now }).where(eq(taskStepsTable.id, etapa.id));
  const depois = steps.map((step) => step.id === etapa.id ? { ...step, startedAt: step.startedAt ?? now } : step);
  const resultado = await aplicar(tx, ator, task, depois, { transicao: { statuses: new Map(depois.map((step) => [step.id, step.status])), novasAtivas: [], taskStatus: statusDaTarefa(lite(depois), task.status as TaskStatusValue) }, antes: steps }, {}, now);
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.step_started", `Etapa iniciada: ${etapa.title}`, `${nome} começou a etapa "${etapa.title}" da tarefa "${task.title}".`, { stepId });
  return resultado;
}

export async function concluirEtapa(tx: Transaction, ator: Ator, taskId: string, stepId: string): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  const etapa = steps.find((step) => step.id === stepId);
  if (!etapa) throw new TarefaError(404, "Etapa não encontrada");
  if (etapa.assigneeId !== ator.id && !ehAdministracao(ator)) throw new TarefaError(403, "Esta etapa não é sua. Só a pessoa dela (ou a Administração) pode concluí-la.");
  if (etapa.status !== "ACTIVE") throw new TarefaError(409, "Esta etapa ainda não tem a vez (ou já foi encerrada).");
  const faltam = etapa.checklist.filter((item) => !item.completed);
  if (faltam.length) throw new TarefaError(422, `Falta marcar ${faltam.length} ${faltam.length === 1 ? "item" : "itens"} do checklist desta etapa.`, { incomplete: faltam.map((item) => item.label) });
  const now = await databaseNow(tx);
  const transicao = aoConcluir(task.ordering, lite(steps), stepId);
  const resultado = await aplicar(tx, ator, task, steps, { transicao, antes: steps }, { alvo: stepId, doneAt: now, doneById: ator.id }, now);
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, etapa.kind === "APPROVAL" ? "task.approved" : "task.step_completed",
    `${etapa.kind === "APPROVAL" ? "Tarefa aprovada" : "Etapa concluída"}: ${etapa.title}`,
    `${nome} ${etapa.kind === "APPROVAL" ? "aprovou" : "concluiu a etapa"} "${etapa.title}" da tarefa "${task.title}".`, { stepId, novasAtivas: transicao.novasAtivas }, task, resultado.task);
  await avisar(tx, ator, resultado.task, resultado.steps, transicao.novasAtivas, "vez", now);
  await avisarFim(tx, ator, task, resultado.task, now);
  return resultado;
}

/** Quem criou a tarefa fica sabendo quando ela termina (por conclusão ou por dispensa), menos se foi ela mesma quem terminou. */
async function avisarFim(tx: Transaction, ator: Ator, antes: Task, depois: Task, now: Date) {
  if ((depois.status !== "APPROVED" && depois.status !== "COMPLETED") || antes.creatorId === ator.id) return;
  await enqueueNotification(tx, {
    userId: antes.creatorId, type: "task.completed", title: "Tarefa concluída", message: `${antes.title} terminou: todas as etapas foram feitas.`,
    priority: "NORMAL", category: "responsibility", entityType: "task", entityId: antes.id, actionUrl: "/responsabilidades",
  }, now, { deduplicationKey: `task-completed:${antes.id}` });
}

function exigirGestao(ator: Ator, task: Task) {
  if (!ator.gestor && task.creatorId !== ator.id) throw new TarefaError(403, "Só quem criou a tarefa, a Administração, a Direção e a Supervisão da área podem fazer isso.");
}
function exigirMotivo(motivo: unknown, o: string) {
  if (typeof motivo !== "string" || !motivo.trim()) throw new TarefaError(400, `Escreva o motivo para ${o}. Ele fica no Registro.`);
  return motivo.trim();
}

export async function dispensarEtapa(tx: Transaction, ator: Ator, taskId: string, stepId: string, motivoBruto: unknown): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  exigirGestao(ator, task);
  const motivo = exigirMotivo(motivoBruto, "dispensar a etapa");
  const etapa = steps.find((step) => step.id === stepId);
  if (!etapa) throw new TarefaError(404, "Etapa não encontrada");
  if (etapa.status !== "ACTIVE" && etapa.status !== "WAITING") throw new TarefaError(409, "Só se dispensa uma etapa que ainda não foi feita.");
  const now = await databaseNow(tx);
  const transicao = aoDispensar(task.ordering, lite(steps), stepId);
  const resultado = await aplicar(tx, ator, task, steps, { transicao, antes: steps }, { alvo: stepId, dispensedReason: motivo }, now);
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.step_dispensed", `Etapa dispensada: ${etapa.title}`, `${nome} dispensou a etapa "${etapa.title}" da tarefa "${task.title}". Motivo: ${motivo}.`, { stepId, reason: motivo });
  await avisar(tx, ator, resultado.task, resultado.steps, transicao.novasAtivas, "vez", now);
  await avisarFim(tx, ator, task, resultado.task, now);
  return resultado;
}

export async function reatribuirEtapa(tx: Transaction, ator: Ator, taskId: string, stepId: string, novaPessoaId: string, motivoBruto: unknown): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  exigirGestao(ator, task);
  const motivo = exigirMotivo(motivoBruto, "passar a etapa para outra pessoa");
  const etapa = steps.find((step) => step.id === stepId);
  if (!etapa) throw new TarefaError(404, "Etapa não encontrada");
  if (etapa.status === "DONE" || etapa.status === "DISPENSED") throw new TarefaError(409, "Etapa já encerrada: não muda de pessoa.");
  await pessoasAtivas(tx, ator.organizationId, [novaPessoaId]);
  const now = await databaseNow(tx);
  await tx.update(taskStepsTable).set({ assigneeId: novaPessoaId }).where(eq(taskStepsTable.id, stepId));
  const depois = steps.map((step) => step.id === stepId ? { ...step, assigneeId: novaPessoaId } : step);
  const resultado = await aplicar(tx, ator, task, depois, { transicao: { statuses: new Map(depois.map((step) => [step.id, step.status])), novasAtivas: [], taskStatus: statusDaTarefa(lite(depois), task.status as TaskStatusValue) }, antes: steps }, {}, now);
  const [antigo, novo] = [await nomeDe(tx, etapa.assigneeId), await nomeDe(tx, novaPessoaId)];
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.step_reassigned", `Etapa passada para outra pessoa: ${etapa.title}`, `${nome} passou a etapa "${etapa.title}" da tarefa "${task.title}" de ${antigo} para ${novo}. Motivo: ${motivo}.`, { stepId, from: etapa.assigneeId, to: novaPessoaId, reason: motivo });
  if (etapa.status === "ACTIVE") {
    await avisar(tx, ator, resultado.task, resultado.steps, [stepId], "vez", now);
    await avisar(tx, ator, resultado.task, [{ ...etapa }], [stepId], "saiu", now);
  }
  return resultado;
}

export async function adicionarEtapa(tx: Transaction, ator: Ator, taskId: string, nova: NovaEtapa, depoisDeStepId?: string): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  exigirGestao(ator, task);
  if (!nova.title?.trim() || !nova.assigneeId) throw new TarefaError(400, "Toda etapa precisa de um nome e de uma pessoa.");
  if (steps.length >= MAX_ETAPAS) throw new TarefaError(400, `Uma tarefa aceita até ${MAX_ETAPAS} etapas.`);
  if (nova.dueDate && !DATA.test(nova.dueDate)) throw new TarefaError(400, "Data inválida. Use o formato do calendário.");
  await pessoasAtivas(tx, ator.organizationId, [nova.assigneeId]);
  // Sem etapa de referência, a nova etapa de trabalho entra antes da aprovação que ainda não foi feita (senão a tarefa seria
  // aprovada sem ninguém ver o trabalho novo); sem aprovação pendente, entra no fim.
  const aprovacaoPendente = steps.find((step) => step.kind === "APPROVAL" && (step.status === "ACTIVE" || step.status === "WAITING"));
  const ancora = depoisDeStepId ? steps.find((step) => step.id === depoisDeStepId) : steps[steps.length - 1];
  if (!ancora) throw new TarefaError(404, "Etapa de referência não encontrada");
  const posicao = !depoisDeStepId && aprovacaoPendente && nova.kind !== "APPROVAL" ? aprovacaoPendente.position : ancora.position + 1;
  const now = await databaseNow(tx);
  // Abre espaço sem esbarrar no índice único de posição: desloca para longe e volta.
  await tx.update(taskStepsTable).set({ position: sql`${taskStepsTable.position} + 1000` }).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.active, true), sql`${taskStepsTable.position} >= ${posicao}`));
  await tx.update(taskStepsTable).set({ position: sql`${taskStepsTable.position} - 999` }).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.active, true), sql`${taskStepsTable.position} >= 1000`));
  const [criada] = await tx.insert(taskStepsTable).values({
    taskId, position: posicao, kind: nova.kind === "APPROVAL" ? "APPROVAL" : "WORK", title: nova.title.trim(), description: nova.description?.trim() || null,
    assigneeId: nova.assigneeId, dueDate: nova.dueDate ?? null, status: "WAITING", checklist: itensDeChecklist(nova.checklist),
  }).returning();
  const todas = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position));
  const transicao = aoReavaliar(task.ordering, lite(todas), task.status as TaskStatusValue);
  const resultado = await aplicar(tx, ator, task, todas, { transicao, antes: todas }, {}, now);
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.step_added", `Etapa acrescentada: ${criada!.title}`, `${nome} acrescentou a etapa "${criada!.title}" à tarefa "${task.title}".`, { stepId: criada!.id, assigneeId: criada!.assigneeId });
  await avisar(tx, ator, resultado.task, resultado.steps, transicao.novasAtivas, "vez", now);
  return resultado;
}

export type AjusteDeEtapa = { title?: string; description?: string | null; dueDate?: string | null; checklist?: { id?: string; label?: string; completed?: boolean }[] };
export async function atualizarEtapa(tx: Transaction, ator: Ator, taskId: string, stepId: string, patch: AjusteDeEtapa): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  const etapa = steps.find((step) => step.id === stepId);
  if (!etapa) throw new TarefaError(404, "Etapa não encontrada");
  const dono = etapa.assigneeId === ator.id;
  const estrutura = patch.title !== undefined || patch.description !== undefined || patch.dueDate !== undefined || (patch.checklist ?? []).some((item) => item.label !== undefined && !etapa.checklist.some((antigo) => antigo.id === item.id && antigo.label === item.label));
  if (!dono && !ator.gestor && task.creatorId !== ator.id) throw new TarefaError(403, "Esta etapa não é sua.");
  if (estrutura && !ator.gestor && task.creatorId !== ator.id) throw new TarefaError(403, "A pessoa da etapa só marca o checklist. Mudar nome, prazo ou itens é de quem criou a tarefa ou da gestão.");
  if (patch.dueDate && !DATA.test(patch.dueDate)) throw new TarefaError(400, "Data inválida. Use o formato do calendário.");
  const campos: Partial<TaskStep> = {};
  if (patch.title !== undefined) { if (!patch.title.trim()) throw new TarefaError(400, "A etapa precisa de um nome."); campos.title = patch.title.trim(); }
  if (patch.description !== undefined) campos.description = patch.description?.trim() || null;
  if (patch.dueDate !== undefined) campos.dueDate = patch.dueDate || null;
  if (patch.checklist) {
    const porId = new Map(patch.checklist.filter((item) => item.id).map((item) => [item.id!, item]));
    const mantidos = etapa.checklist.map((item) => ({ ...item, completed: porId.has(item.id) ? Boolean(porId.get(item.id)!.completed) : item.completed }));
    campos.checklist = estrutura ? [...mantidos, ...patch.checklist.filter((item) => !item.id && item.label?.trim()).map((item) => ({ id: randomUUID(), label: item.label!.trim(), completed: false }))] : mantidos;
  }
  const now = await databaseNow(tx);
  await tx.update(taskStepsTable).set(campos).where(eq(taskStepsTable.id, stepId));
  const depois = (await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position)));
  // O checklist obrigatório de tarefa antiga existe na tarefa (a ASA confere) e na primeira etapa de trabalho (a tela marca):
  // marcar de um lado marca do outro, pelo id do item.
  const primeiraDeTrabalho = depois.find((step) => step.kind === "WORK");
  let espelho: Task["mandatoryChecklist"] | undefined;
  if (campos.checklist && primeiraDeTrabalho?.id === stepId && task.mandatoryChecklist?.length) {
    const novo = task.mandatoryChecklist.map((item) => { const feito = campos.checklist!.find((outro) => outro.id === item.id); return feito ? { ...item, completed: feito.completed } : item; });
    if (JSON.stringify(novo) !== JSON.stringify(task.mandatoryChecklist)) espelho = novo;
  }
  const [atualizada] = await tx.update(tasksTable).set({ lastActivityAt: now, updatedAt: now, ...(espelho ? { mandatoryChecklist: espelho } : {}) }).where(eq(tasksTable.id, taskId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.step_updated", `Etapa atualizada: ${etapa.title}`, `${nome} atualizou a etapa "${etapa.title}" da tarefa "${task.title}".`, { stepId, campos: Object.keys(campos) });
  return { task: atualizada!, steps: depois };
}

export async function pedirAjustes(tx: Transaction, ator: Ator, taskId: string, entrada: { comment?: string; backToStepId?: string }): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId); aberta(task);
  const aprovacao = steps.find((step) => step.kind === "APPROVAL" && step.status === "ACTIVE");
  if (!aprovacao) throw new TarefaError(409, "Tarefa não está pronta para aprovação.");
  if (aprovacao.assigneeId !== ator.id && !ehAdministracao(ator)) throw new TarefaError(403, "Só quem aprova (ou a Administração) pede ajustes.");
  const comentario = entrada.comment?.trim();
  if (!comentario) throw new TarefaError(400, "Um comentário explicando os ajustes é obrigatório.");
  const destino = entrada.backToStepId
    ? steps.find((step) => step.id === entrada.backToStepId)
    : [...steps].reverse().find((step) => step.kind === "WORK" && step.position < aprovacao.position && step.status === "DONE");
  if (!destino) throw new TarefaError(400, "Escolha para qual etapa a tarefa volta.");
  let transicao: Transicao;
  try { transicao = aoPedirAjustes(lite(steps), aprovacao.id, destino.id, task.ordering); } catch (error) { throw new TarefaError(400, (error as Error).message); }
  const now = await databaseNow(tx);
  const resultado = await aplicar(tx, ator, task, steps, { transicao, antes: steps }, { alvo: destino.id }, now);
  await tx.insert(taskCommentsTable).values({ taskId, authorId: ator.id, body: `[Ajustes solicitados] ${comentario}` });
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.changes_requested", `Ajustes solicitados: ${task.title}`, `${nome} pediu ajustes na tarefa "${task.title}" e a devolveu à etapa "${destino.title}": ${comentario}`, { stepId: destino.id, reason: comentario });
  await avisar(tx, ator, resultado.task, resultado.steps, [destino.id], "devolvida", now);
  return resultado;
}

/** Cancelar: tudo na mesma transação. As etapas pendentes são encerradas e quem tinha o que fazer, e quem criou, são avisados. */
export async function cancelarTarefa(tx: Transaction, ator: Ator, taskId: string, motivoBruto?: unknown): Promise<Resultado> {
  const { task, steps } = await carregar(tx, ator.organizationId, taskId);
  if ((ENCERRADAS as readonly string[]).includes(task.status)) throw new TarefaError(409, "Tarefa já encerrada.");
  exigirGestao(ator, task);
  const motivo = typeof motivoBruto === "string" && motivoBruto.trim() ? motivoBruto.trim() : null;
  const now = await databaseNow(tx);
  const pendentes = steps.filter((step) => step.status === "ACTIVE" || step.status === "WAITING");
  if (pendentes.length) await tx.update(taskStepsTable).set({ status: "DISPENSED", dispensedReason: "Tarefa cancelada" }).where(inArray(taskStepsTable.id, pendentes.map((step) => step.id)));
  const [cancelada] = await tx.update(tasksTable).set({ status: "CANCELLED", cancelledAt: now, cancelledById: ator.id, lastActivityAt: now, updatedAt: now }).where(eq(tasksTable.id, taskId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, task, "task.cancelled", `Tarefa cancelada: ${task.title}`, `${nome} cancelou a tarefa "${task.title}". ${motivo ? `Motivo: ${motivo}.` : "Sem motivo informado."}`, { reason: motivo }, task, cancelada);
  const avisados = new Set([task.creatorId, ...pendentes.map((step) => step.assigneeId)]);
  for (const userId of avisados) {
    if (userId === ator.id) continue;
    await enqueueNotification(tx, {
      userId, type: "task.cancelled", title: "Tarefa cancelada", message: `${task.title} foi cancelada.${motivo ? ` Motivo: ${motivo}` : ""}`,
      priority: "NORMAL", category: "responsibility", entityType: "task", entityId: task.id, actionUrl: "/responsabilidades",
    }, now, { deduplicationKey: `task-cancelled:${task.id}:${userId}` });
  }
  return { task: cancelada!, steps: await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position)) };
}

/**
 * Para quem escreve direto na linha de tasks (a ASA): depois da escrita, as etapas acompanham o que mudou (antes → depois),
 * na mesma transação. Cancelar e concluir encerram as etapas; "pronta para aprovação" entrega a etapa de trabalho e abre a
 * aprovação (avisando quem aprova); trocar a pessoa move a etapa da vez e avisa a nova; mudar o prazo acompanha as etapas
 * que usavam o prazo antigo; o checklist obrigatório vale nos dois lugares. Nunca lança por falta de etapa: sem etapa, não faz nada.
 */
export async function sincronizarEtapasDaTarefa(tx: Transaction, antes: Task, depois: Task, quem: { id: string }): Promise<void> {
  const steps = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, depois.id), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position));
  if (!steps.length) return; // sem etapas: elas nascem ao criar (preencherEtapasDe) ou ao mexer (carregar)
  const now = await databaseNow(tx);
  const ator: Ator = { id: quem.id, organizationId: depois.organizationId, role: "ADMIN", gestor: true, semRegistro: true };
  const pendente = (step: TaskStep) => step.status === "ACTIVE" || step.status === "WAITING";
  const mudouStatus = antes.status !== depois.status;
  const mudar = async (ids: string[], patch: Partial<TaskStep>) => { if (ids.length) await tx.update(taskStepsTable).set(patch).where(inArray(taskStepsTable.id, ids)); };
  let avisarVez: string[] = [];

  if (mudouStatus && (depois.status === "CANCELLED" || depois.status === "EXPIRED")) {
    await mudar(steps.filter(pendente).map((step) => step.id), { status: "DISPENSED", dispensedReason: "Tarefa cancelada" });
  } else if (mudouStatus && (depois.status === "COMPLETED" || depois.status === "APPROVED")) {
    await mudar(steps.filter((step) => step.status === "ACTIVE").map((step) => step.id), { status: "DONE", doneAt: now, doneById: quem.id });
    await mudar(steps.filter((step) => step.status === "WAITING").map((step) => step.id), { status: "DISPENSED", dispensedReason: "Tarefa concluída direto" });
  } else if (mudouStatus && depois.status === "READY_FOR_APPROVAL") {
    const trabalho = steps.find((step) => step.status === "ACTIVE" && step.kind === "WORK");
    if (trabalho) {
      const transicao = aoConcluir(depois.ordering, lite(steps), trabalho.id);
      for (const step of steps) {
        const novo = transicao.statuses.get(step.id);
        if (novo && novo !== step.status) await tx.update(taskStepsTable).set({ status: novo, ...(step.id === trabalho.id ? { doneAt: now, doneById: quem.id } : {}) }).where(eq(taskStepsTable.id, step.id));
      }
      avisarVez = transicao.novasAtivas;
    }
  } else if (mudouStatus && depois.status === "IN_PROGRESS") {
    const ativa = steps.find((step) => step.status === "ACTIVE" && step.kind === "WORK" && !step.startedAt);
    if (ativa) await tx.update(taskStepsTable).set({ startedAt: now }).where(eq(taskStepsTable.id, ativa.id));
  }

  if (antes.assigneeId !== depois.assigneeId) {
    const alvo = steps.find((step) => step.status === "ACTIVE" && step.kind === "WORK") ?? steps.find((step) => step.status === "WAITING" && step.kind === "WORK");
    if (alvo && alvo.assigneeId !== depois.assigneeId) {
      await tx.update(taskStepsTable).set({ assigneeId: depois.assigneeId }).where(eq(taskStepsTable.id, alvo.id));
      if (alvo.status === "ACTIVE") avisarVez.push(alvo.id);
    }
  }

  if (antes.dueDate !== depois.dueDate) {
    const usavaOPrazoAntigo = antes.dueDate === null ? isNull(taskStepsTable.dueDate) : eq(taskStepsTable.dueDate, antes.dueDate);
    await tx.update(taskStepsTable).set({ dueDate: depois.dueDate }).where(and(eq(taskStepsTable.taskId, depois.id), eq(taskStepsTable.active, true), inArray(taskStepsTable.status, ["ACTIVE", "WAITING"]), usavaOPrazoAntigo));
  }

  if (JSON.stringify(antes.mandatoryChecklist ?? []) !== JSON.stringify(depois.mandatoryChecklist ?? [])) {
    const primeira = steps.find((step) => step.kind === "WORK" && step.status !== "DISPENSED");
    if (primeira) await tx.update(taskStepsTable).set({ checklist: depois.mandatoryChecklist ?? [] }).where(eq(taskStepsTable.id, primeira.id));
  }

  if (avisarVez.length) {
    const atuais = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, depois.id), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position));
    await avisar(tx, ator, depois, atuais, avisarVez, "vez", now);
  }
  await tx.update(tasksTable).set({ lastActivityAt: now }).where(eq(tasksTable.id, depois.id));
}

// ─── Ler ──────────────────────────────────────────────────────────────────────

/** Etapas ativas da pessoa em tarefas abertas: é o que o Meu Dia e a ASA contam como "tarefa dela". */
export async function etapasAbertasDe(userId: string, organizationId: string, executor: Pick<typeof db, "select"> = db): Promise<{ taskId: string; stepId: string | null; dueDate: string | null; mandatoryEvidences: Task["mandatoryEvidences"] }[]> {
  const dasEtapas = await executor.select({ taskId: tasksTable.id, stepId: taskStepsTable.id, dueDate: sql<string | null>`coalesce(${taskStepsTable.dueDate}, ${tasksTable.dueDate})`, mandatoryEvidences: tasksTable.mandatoryEvidences })
    .from(taskStepsTable).innerJoin(tasksTable, eq(tasksTable.id, taskStepsTable.taskId))
    .where(and(eq(taskStepsTable.assigneeId, userId), eq(taskStepsTable.active, true), eq(taskStepsTable.status, "ACTIVE"), eq(tasksTable.organizationId, organizationId), notInArray(tasksTable.status, [...ENCERRADAS])));
  // Tarefa que nasceu sem etapas (gravada direto no banco por rotina antiga) segue valendo pela pessoa da tarefa.
  const antigas = await executor.select({ taskId: tasksTable.id, dueDate: tasksTable.dueDate, mandatoryEvidences: tasksTable.mandatoryEvidences })
    .from(tasksTable)
    .where(and(eq(tasksTable.assigneeId, userId), eq(tasksTable.organizationId, organizationId), notInArray(tasksTable.status, [...ENCERRADAS]), sql`not exists (select 1 from ${taskStepsTable} s where s.task_id = ${tasksTable.id} and s.active)`));
  return [...dasEtapas, ...antigas.map((tarefa) => ({ ...tarefa, stepId: null }))];
}

export async function etapasComNomes(taskIds: string[], executor: Pick<typeof db, "select"> = db) {
  if (!taskIds.length) return new Map<string, (TaskStep & { assigneeName: string })[]>();
  const rows = await executor.select({ step: taskStepsTable, assigneeName: usersTable.name }).from(taskStepsTable)
    .innerJoin(usersTable, eq(usersTable.id, taskStepsTable.assigneeId))
    .where(and(inArray(taskStepsTable.taskId, taskIds), eq(taskStepsTable.active, true))).orderBy(asc(taskStepsTable.position));
  const porTarefa = new Map<string, (TaskStep & { assigneeName: string })[]>();
  for (const row of rows) porTarefa.set(row.step.taskId, [...(porTarefa.get(row.step.taskId) ?? []), { ...row.step, assigneeName: row.assigneeName }]);
  return porTarefa;
}

/** Migra para etapas uma tarefa que nasceu pelo corpo antigo (uma pessoa, uma data, aprovação opcional). */
export function etapasDoCorpoAntigo(corpo: { title: string; assigneeId: string; approverId?: string | null; requiresApproval?: boolean; creatorId: string; dueDate?: string | null; mandatoryChecklist?: { id: string; label: string; completed: boolean }[] }): NovaEtapa[] {
  const etapas: NovaEtapa[] = [{ kind: "WORK", title: "Fazer", assigneeId: corpo.assigneeId, dueDate: corpo.dueDate ?? null, checklist: corpo.mandatoryChecklist }];
  if (corpo.requiresApproval !== false) etapas.push({ kind: "APPROVAL", title: "Aprovar", assigneeId: corpo.approverId ?? corpo.creatorId });
  return etapas;
}
