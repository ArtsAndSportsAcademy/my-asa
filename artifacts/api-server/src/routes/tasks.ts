import { Router, type IRouter } from "express";
import { eq, and, inArray, desc, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  taskStepsTable,
  tasksTable,
  taskEvidencesTable,
  taskCommentsTable,
  usersTable,
  operationsTable,
  responsibilitiesTable,
  areasTable,
} from "@workspace/db";
import {
  requireAuth,
  requireOrganization,
} from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { sendNotification } from "../services/notificationService.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { canManageTasks, listTaskManagementAreaIds, resolveTaskAreaId } from "../services/task-access.js";
import {
  TarefaError, adicionarEtapa, atualizarEtapa, concluirEtapa, criarTarefa, dispensarEtapa, etapasComNomes, etapasDoCorpoAntigo,
  iniciarEtapa, pedirAjustes, reatribuirEtapa, cancelarTarefa, garantirEtapas, pessoasAtivas, type Ator,
} from "../services/task-steps.js";
import { processNotificationOutbox } from "../services/notification-outbox.js";
import { checarCompartilhamento, lerLinkDrive } from "../services/drive-link.js";
import { exigirUuidNosParametros, validarUuid } from "../lib/uuid.js";

const router: IRouter = Router();
exigirUuidNosParametros(router, { id: "Tarefa não encontrada.", stepId: "Etapa não encontrada." });

/** Quem age, já com o "sou da gestão desta tarefa?" resolvido (Administração, Direção ou Supervisão da área). */
async function atorDa(user: NonNullable<Express.Request["user"]>, task: { operationId: string; responsibilityId: string | null; assigneeId: string }): Promise<Ator> {
  const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId);
  const gestor = await canManageTasks(user.sub, user.role as RoleValue, task.operationId, user.organizationId, areaId);
  return { id: user.sub, organizationId: user.organizationId, role: user.role, gestor };
}

/** Responde a falha de uma regra de tarefa com a frase dela; qualquer outra falha é erro do servidor. */
function responderErro(res: import("express").Response, log: ReturnType<typeof requestLogger>, err: unknown, quando: string) {
  if (err instanceof TarefaError) { res.status(err.status).json({ error: err.status === 403 ? "Forbidden" : err.status === 404 ? "Not Found" : err.status === 409 ? "Conflict" : err.status === 422 ? "Unprocessable Entity" : "Bad Request", message: err.message, ...err.extra }); return; }
  log.error({ err }, quando);
  res.status(500).json({ error: "Internal Server Error" });
}

/** Os avisos nascem na transação; depois dela saem na hora, sem esperar o próximo minuto do agendador. */
function entregarAvisos(log: ReturnType<typeof requestLogger>) {
  void processNotificationOutbox().catch((err) => log.warn({ err }, "Falha ao entregar os avisos da tarefa"));
}

/** Administração, Direção e a Supervisão da área da tarefa (a regra de sempre: canManageTasks), não qualquer Supervisão. */
async function ehGestaoDaTarefa(user: NonNullable<Express.Request["user"]>, task: { operationId: string; responsibilityId: string | null; assigneeId: string }) {
  return (await atorDa(user, task)).gestor;
}

/** Quem tem alguma etapa na tarefa participa dela (comenta, anexa), mesmo sem ter criado. */
async function temEtapa(taskId: string, userId: string) {
  const [etapa] = await db.select({ id: taskStepsTable.id }).from(taskStepsTable).where(and(eq(taskStepsTable.taskId, taskId), eq(taskStepsTable.assigneeId, userId), eq(taskStepsTable.active, true))).limit(1);
  return Boolean(etapa);
}

/** A tarefa com as etapas de cada uma (nome da pessoa incluído), para a lista e o detalhe. */
async function comEtapas<T extends { id: string }>(tasks: T[]) {
  await garantirEtapas(tasks.map((task) => task.id));
  const etapas = await etapasComNomes(tasks.map((task) => task.id));
  return tasks.map((task) => ({ ...task, steps: etapas.get(task.id) ?? [] }));
}

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN" | "DIR";
const MANAGER_ROLES: RoleValue[] = ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActorName(userId: string): Promise<string> {
  const [row] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return row?.name ?? userId;
}

// ─── GET /tasks/my — tarefas atribuídas ao usuário atual ─────────────────────

router.get("/tasks/my", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;

  try {
    const { status, priority } = req.query as Record<string, string>;
    // É minha a tarefa que criei, ou em que tenho a vez ou qualquer etapa (inclusive as já feitas): quem pede algo
    // precisa enxergar o andamento do que pediu, senão a tarefa se perde como antes.
    const conditions: SQL<unknown>[] = [
      or(
        eq(tasksTable.creatorId, user.sub),
        eq(tasksTable.assigneeId, user.sub),
        sql`exists (select 1 from ${taskStepsTable} s where s.task_id = ${tasksTable.id} and s.assignee_id = ${user.sub} and s.active)`,
      )!,
    ];

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) conditions.push(eq(tasksTable.status, statuses[0] as any));
      else if (statuses.length > 1) conditions.push(inArray(tasksTable.status, statuses as any[]));
    }
    if (priority) conditions.push(eq(tasksTable.priority, priority as any));

    const tasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        priority: tasksTable.priority,
        status: tasksTable.status,
        dueDate: tasksTable.dueDate,
        requiresApproval: tasksTable.requiresApproval,
        origin: tasksTable.origin,
        responsibilityId: tasksTable.responsibilityId,
        responsibilityTitle: responsibilitiesTable.title,
        periodStart: tasksTable.periodStart,
        ordering: tasksTable.ordering,
        lastActivityAt: tasksTable.lastActivityAt,
        operationId: tasksTable.operationId,
        operationName: operationsTable.name,
        assigneeId: tasksTable.assigneeId,
        assigneeName: usersTable.name,
        mandatoryChecklist: tasksTable.mandatoryChecklist,
        operationalChecklist: tasksTable.operationalChecklist,
        mandatoryEvidences: tasksTable.mandatoryEvidences,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
      })
      .from(tasksTable)
      .innerJoin(operationsTable, eq(tasksTable.operationId, operationsTable.id))
      .innerJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .leftJoin(responsibilitiesTable, eq(tasksTable.responsibilityId, responsibilitiesTable.id))
      .where(and(...conditions))
      .orderBy(sql`${tasksTable.dueDate} desc nulls last`, desc(tasksTable.createdAt));

    res.json({ tasks: await comEtapas(tasks) });
  } catch (err) {
    log.error({ err }, "Erro ao listar minhas tarefas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /tasks — listar tarefas (gestão) ────────────────────────────────────

router.get("/tasks", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId, status, priority, assigneeId } = req.query as Record<string, string>;

  try {
    const conditions: SQL<unknown>[] = [];

    if (user.role === "ADMIN" || user.role === "DIR") {
      conditions.push(eq(tasksTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(tasksTable.operationId, operationId));
    } else if (MANAGER_ROLES.includes(user.role as RoleValue)) {
      if ((user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B") && !operationId) {
        res.status(400).json({ error: "Bad Request", message: "operationId é obrigatório para supervisores" });
        return;
      }
      conditions.push(eq(tasksTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(tasksTable.operationId, operationId));
      if (user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B") {
        const areaIds = await listTaskManagementAreaIds(user.sub, operationId!, user.organizationId);
        if (areaIds === null) { res.status(403).json({ error: "Forbidden", message: "Operação fora do seu escopo" }); return; }
        if (areaIds.length === 0) { res.json({ tasks: [] }); return; }
        conditions.push(or(inArray(usersTable.areaId, areaIds), inArray(responsibilitiesTable.areaId, areaIds))!);
      }
    } else {
      res.status(403).json({ error: "Forbidden", message: "Use GET /tasks/my para suas tarefas" });
      return;
    }

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) conditions.push(eq(tasksTable.status, statuses[0] as any));
      else if (statuses.length > 1) conditions.push(inArray(tasksTable.status, statuses as any[]));
    }
    if (priority) conditions.push(eq(tasksTable.priority, priority as any));
    if (assigneeId) conditions.push(eq(tasksTable.assigneeId, assigneeId));

    const tasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        priority: tasksTable.priority,
        status: tasksTable.status,
        dueDate: tasksTable.dueDate,
        requiresApproval: tasksTable.requiresApproval,
        origin: tasksTable.origin,
        responsibilityId: tasksTable.responsibilityId,
        responsibilityTitle: responsibilitiesTable.title,
        areaId: responsibilitiesTable.areaId,
        periodStart: tasksTable.periodStart,
        ordering: tasksTable.ordering,
        lastActivityAt: tasksTable.lastActivityAt,
        operationId: tasksTable.operationId,
        operationName: operationsTable.name,
        assigneeId: tasksTable.assigneeId,
        assigneeName: usersTable.name,
        creatorId: tasksTable.creatorId,
        approverId: tasksTable.approverId,
        mandatoryChecklist: tasksTable.mandatoryChecklist,
        mandatoryEvidences: tasksTable.mandatoryEvidences,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
      })
      .from(tasksTable)
      .innerJoin(operationsTable, eq(tasksTable.operationId, operationsTable.id))
      .innerJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .leftJoin(responsibilitiesTable, eq(tasksTable.responsibilityId, responsibilitiesTable.id))
      .where(and(...conditions))
      .orderBy(desc(tasksTable.createdAt));

    res.json({ tasks: await comEtapas(tasks) });
  } catch (err) {
    log.error({ err }, "Erro ao listar tarefas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /tasks/assignable — as pessoas que dá para escolher numa tarefa ───────
// Qualquer pessoa cria tarefa para qualquer pessoa ativa da casa, mas /users devolve ao Elenco só os colegas da própria área
// (e sem área, ninguém). Aqui vai só o que a escolha precisa: nome e área. Nada do cadastro.

router.get("/tasks/assignable", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const pessoas = await db.select({ id: usersTable.id, name: usersTable.name, areaName: areasTable.name })
      .from(usersTable).leftJoin(areasTable, eq(areasTable.id, usersTable.areaId))
      .where(and(eq(usersTable.organizationId, req.user!.organizationId), eq(usersTable.status, "ACTIVE")))
      .orderBy(usersTable.name);
    res.json({ people: pessoas.map((pessoa) => ({ ...pessoa, displayName: pessoa.name, status: "ACTIVE" })) });
  } catch (err) {
    log.error({ err }, "Erro ao listar pessoas para escolher");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /tasks/:id — detalhe da tarefa ──────────────────────────────────────

router.get("/tasks/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, user.organizationId)))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Not Found", message: "Tarefa não encontrada" });
      return;
    }

    const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId);
    await garantirEtapas([id]);
    const etapas = (await etapasComNomes([id])).get(id) ?? [];
    const isInvolved =
      task.creatorId === user.sub ||
      task.assigneeId === user.sub ||
      task.approverId === user.sub ||
      etapas.some((step) => step.assigneeId === user.sub) ||
      user.role === "ADMIN" ||
      user.role === "DIR" ||
      await canManageTasks(user.sub, user.role as RoleValue, task.operationId, user.organizationId, areaId);

    if (!isInvolved) {
      res.status(403).json({ error: "Forbidden", message: "Esta tarefa não é sua: você não criou, não tem etapa nela e não é da gestão." });
      return;
    }

    const userIds = [task.creatorId, task.assigneeId, task.approverId].filter(
      (v): v is string => !!v
    );
    const users = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));

    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const evidences = await db
      .select()
      .from(taskEvidencesTable)
      .where(and(eq(taskEvidencesTable.taskId, id), eq(taskEvidencesTable.active, true)))
      .orderBy(taskEvidencesTable.createdAt);

    res.json({
      task: {
        ...task,
        creatorName: userMap[task.creatorId] ?? null,
        assigneeName: userMap[task.assigneeId] ?? null,
        approverName: task.approverId ? (userMap[task.approverId] ?? null) : null,
        steps: etapas,
      },
      steps: etapas,
      evidences,
    });
  } catch (err) {
    log.error({ err }, "Erro ao buscar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks — criar tarefa (qualquer pessoa cria para qualquer pessoa) ────

router.post("/tasks", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const body = (req.body ?? {}) as Record<string, any>;

  try {
    // O corpo antigo (uma pessoa, uma data, aprovação opcional) segue valendo: vira a etapa de trabalho e, se pedir, a de aprovação.
    let steps = Array.isArray(body.steps) ? body.steps : null;
    if (!steps) {
      if (!body.title || !body.operationId || !body.assigneeId || !body.dueDate) {
        res.status(400).json({ error: "Bad Request", message: "title, operationId, assigneeId e dueDate são obrigatórios (ou envie as etapas em steps)" });
        return;
      }
      steps = etapasDoCorpoAntigo({ title: body.title, assigneeId: body.assigneeId, approverId: body.approverId, requiresApproval: body.requiresApproval, creatorId: user.sub, dueDate: body.dueDate, mandatoryChecklist: body.mandatoryChecklist });
    }
    const ator: Ator = { id: user.sub, organizationId: user.organizationId, role: user.role, gestor: user.role === "ADMIN" || user.role === "DIR" };
    const resultado = await db.transaction((tx) => criarTarefa(tx, ator, {
      operationId: body.operationId, title: body.title, description: body.description, ordering: body.ordering,
      periodStart: body.periodStart, dueDate: body.dueDate, priority: body.priority, responsibilityId: body.responsibilityId,
      origin: ["PERSON", "MANUAL"].includes(body.origin) ? body.origin : "PERSON", libraryDocumentId: body.libraryDocumentId, steps,
      mandatoryChecklist: Array.isArray(body.mandatoryChecklist) ? body.mandatoryChecklist : [], mandatoryEvidences: Array.isArray(body.mandatoryEvidences) ? body.mandatoryEvidences : [],
    }));
    entregarAvisos(log);
    res.status(201).json({ task: resultado.task, steps: resultado.steps });
  } catch (err) {
    responderErro(res, log, err, "Erro ao criar tarefa");
  }
});

router.post("/tasks/batch", requireAuth, requireOrganization, async (req, res) => {
  const user = req.user!;
  const { operationId, responsibilityId, tasks } = req.body as {
    operationId?: string;
    responsibilityId?: string;
    tasks?: { title: string; assigneeId: string; dueDate: string; description?: string }[];
  };
  if (!operationId || !Array.isArray(tasks) || tasks.length === 0 || tasks.length > 50) {
    res.status(400).json({ error: "Informe a operação e de 1 a 50 tarefas para confirmar o lote" });
    return;
  }
  if (tasks.some((task) => !task.title?.trim() || !task.assigneeId || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate))) {
    res.status(400).json({ error: "Cada tarefa precisa de título, responsável e prazo válido" });
    return;
  }

  try {
    const [operation] = await db.select({ id: operationsTable.id }).from(operationsTable)
      .where(and(eq(operationsTable.id, operationId), eq(operationsTable.organizationId, user.organizationId)))
      .limit(1);
    if (!operation) { res.status(404).json({ error: "Operação não encontrada" }); return; }

    const [responsibility] = responsibilityId
      ? await db.select({ id: responsibilitiesTable.id, areaId: responsibilitiesTable.areaId, title: responsibilitiesTable.title })
        .from(responsibilitiesTable)
        .where(and(eq(responsibilitiesTable.id, responsibilityId), eq(responsibilitiesTable.orgId, user.organizationId), eq(responsibilitiesTable.active, true)))
        .limit(1)
      : [];
    if (responsibilityId && !responsibility) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    const assigneeIds = [...new Set(tasks.map((task) => task.assigneeId))];
    const assignees = await db.select({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, user.organizationId), inArray(usersTable.id, assigneeIds)));
    if (assignees.length !== assigneeIds.length) { res.status(400).json({ error: "Há responsáveis fora da organização" }); return; }

    if (user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B") {
      const areaId = responsibility?.areaId ?? assignees[0]?.areaId ?? null;
      const allowed = await canManageTasks(user.sub, user.role as RoleValue, operationId, user.organizationId, areaId);
      if (!allowed) {
        res.status(403).json({ error: "Forbidden", message: "A Supervisão distribui tarefas só para a própria área. Confira se a área e o local estão ligados a você." }); return;
      }
      if (tasks.some((task) => (assignees.find((person) => person.id === task.assigneeId)?.areaId ?? null) !== areaId)) {
        res.status(403).json({ error: "Forbidden", message: "O lote só pode ter pessoas da sua área." }); return;
      }
    } else if (user.role !== "ADMIN" && user.role !== "DIR") {
      res.status(403).json({ error: "Sem permissão para confirmar lotes" }); return;
    }

    const actorName = await getActorName(user.sub);
    const created = await db.transaction(async (tx) => {
      const rows = [];
      for (const draft of tasks) {
        const [task] = await tx.insert(tasksTable).values({
          organizationId: user.organizationId,
          operationId,
          responsibilityId: responsibility?.id ?? null,
          title: draft.title.trim(),
          description: draft.description?.trim() || null,
          creatorId: user.sub,
          assigneeId: draft.assigneeId,
          requiresApproval: false,
          priority: "MEDIUM",
          status: "CREATED",
          dueDate: draft.dueDate,
          origin: "PERSON",
        }).returning();
        if (!task) throw new Error("Tarefa do lote não foi criada");
        await writeHistoryEvent({
          category: "TASK", action: "task.created", title: `Tarefa criada: ${task.title}`,
          narrative: `${actorName} confirmou o lote${responsibility ? ` de ${responsibility.title}` : ""} e atribuiu a tarefa a ${assignees.find((person) => person.id === draft.assigneeId)?.name ?? "uma pessoa"}.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorName,
          operationId, orgId: user.organizationId,
          beforeState: null, afterState: task, metadata: { batch: true, responsibilityId: responsibility?.id ?? null },
        }, tx as any);
        rows.push(task);
      }
      return rows;
    });
    // Quem recebe tarefa precisa ficar sabendo sem abrir a tela: um aviso por pessoa e por lote
    // (e não um por tarefa), e nunca para quem confirmou o lote atribuindo a si mesma.
    const porPessoa = new Map<string, typeof created>();
    for (const task of created) porPessoa.set(task.assigneeId, [...(porPessoa.get(task.assigneeId) ?? []), task]);
    for (const [assigneeId, minhas] of porPessoa) {
      if (assigneeId === user.sub) continue;
      const prazo = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
      const primeira = minhas[0]!;
      void sendNotification({
        userId: assigneeId,
        type: "task.assigned",
        title: minhas.length === 1 ? "Nova tarefa para você" : `${minhas.length} novas tarefas para você`,
        message: minhas.length === 1
          ? `${primeira.title} — até ${prazo(primeira.dueDate!)}.`
          : `${primeira.title} — até ${prazo(primeira.dueDate!)} — e mais ${minhas.length - 1}. Veja em Tarefas.`,
        priority: "NORMAL",
        category: "responsibility",
        entityType: "task",
        entityId: primeira.id,
        actionUrl: "/responsabilidades",
      }).catch((err) => requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId).warn({ err }, "Falha ao avisar quem recebeu tarefas do lote"));
    }
    res.status(201).json({ tasks: created });
  } catch (err) {
    requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId).error({ err }, "Erro ao confirmar lote de tarefas");
    res.status(500).json({ error: "Não foi possível confirmar o lote" });
  }
});

// ─── PATCH /tasks/:id — editar tarefa ────────────────────────────────────────

router.patch("/tasks/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, user.organizationId))).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const responsibilityId = typeof req.body?.responsibilityId === "string" ? req.body.responsibilityId : task.responsibilityId ?? undefined;
    const areaId = await resolveTaskAreaId(responsibilityId, task.assigneeId, user.organizationId);
    const allowed = await canManageTasks(user.sub, user.role as RoleValue, task.operationId, user.organizationId, areaId);
    const isAssignee = task.assigneeId === user.sub;
    // Quem criou a tarefa (inclusive do Elenco) edita o que é dela: título, descrição, prazo.
    const isCreator = task.creatorId === user.sub;

    if (!allowed && !isAssignee && !isCreator) { res.status(403).json({ error: "Forbidden", message: "Só quem criou a tarefa, a pessoa da vez e a gestão podem editá-la." }); return; }

    if (["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)) {
      res.status(409).json({ error: "Conflict", message: "Tarefa encerrada não pode ser editada" });
      return;
    }

    const body = req.body as Record<string, any>;
    // A pessoa da tarefa e quem aprova precisam ser pessoas ativas desta casa (senão a tarefa iria parar na tela de quem saiu ou de outra casa).
    const novasPessoas = [body.assigneeId, body.approverId].filter((valor): valor is string => typeof valor === "string" && valor.length > 0);
    if (novasPessoas.length) await pessoasAtivas(db, user.organizationId, novasPessoas);

    // Assignee without management rights can only update operationalChecklist
    if (isAssignee && !allowed && !isCreator) {
      if (body.operationalChecklist === undefined) { res.status(403).json({ error: "Forbidden" }); return; }
      const actorName = await getActorName(user.sub);
      const [updated] = await db.transaction(async (tx) => {
        const [row] = await tx.update(tasksTable)
          .set({ operationalChecklist: body.operationalChecklist, updatedAt: new Date() })
          .where(eq(tasksTable.id, id)).returning();
        if (!row) throw new Error("Tarefa não encontrada");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Tarefa atualizada: ${task.title}`,
          narrative: `${actorName} atualizou a checklist operacional da tarefa "${task.title}".`,
          entityType: "task", entityId: id, actorId: user.sub, actorName,
          operationId: task.operationId, orgId: task.organizationId,
          beforeState: task, afterState: row, metadata: { reason: req.body?.reason ?? null },
        }, tx as any);
        return [row] as const;
      });
      res.json({ task: updated });
      return;
    }

    const updates: Partial<typeof tasksTable.$inferInsert> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;
    if (body.responsibilityId !== undefined) updates.responsibilityId = body.responsibilityId || null;
    if (body.approverId !== undefined) updates.approverId = body.approverId;
    if (body.requiresApproval !== undefined) updates.requiresApproval = body.requiresApproval;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.mandatoryChecklist !== undefined) updates.mandatoryChecklist = body.mandatoryChecklist;
    if (body.mandatoryEvidences !== undefined) updates.mandatoryEvidences = body.mandatoryEvidences;
    if (body.operationalChecklist !== undefined) updates.operationalChecklist = body.operationalChecklist;

    const actorName = await getActorName(user.sub);
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(tasksTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(tasksTable.id, id)).returning();
      if (!row) throw new Error("Tarefa não encontrada");
      // A pessoa da tarefa mudou pelo jeito antigo: a etapa de trabalho que ainda não foi feita acompanha.
      if (body.assigneeId !== undefined && body.assigneeId !== task.assigneeId) {
        const [pendente] = await tx.select({ id: taskStepsTable.id }).from(taskStepsTable).where(and(eq(taskStepsTable.taskId, id), eq(taskStepsTable.active, true), eq(taskStepsTable.kind, "WORK"), inArray(taskStepsTable.status, ["ACTIVE", "WAITING"]))).orderBy(taskStepsTable.position).limit(1);
        if (pendente) await tx.update(taskStepsTable).set({ assigneeId: body.assigneeId }).where(eq(taskStepsTable.id, pendente.id));
      }
      await writeHistoryEvent({
        category: "TASK", action: "task.updated", title: `Tarefa atualizada: ${task.title}`,
        narrative: `${actorName} atualizou a tarefa "${task.title}".`,
        entityType: "task", entityId: id, actorId: user.sub, actorName,
        operationId: task.operationId, orgId: task.organizationId,
        beforeState: task, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    res.json({ task: updated });
  } catch (err) {
    responderErro(res, log, err, "Erro ao editar tarefa");
  }
});

// ─── Etapas ───────────────────────────────────────────────────────────────────
// Cada ação é uma transação: grava a etapa, a tarefa, o Registro e os avisos juntos.

async function comAtor<T>(req: import("express").Request, taskId: string, acao: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ator: Ator) => Promise<T>): Promise<T> {
  if (!validarUuid(taskId)) throw new TarefaError(404, "Tarefa não encontrada");
  const user = req.user!;
  const [task] = await db.select({ operationId: tasksTable.operationId, responsibilityId: tasksTable.responsibilityId, assigneeId: tasksTable.assigneeId })
    .from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, user.organizationId))).limit(1);
  if (!task) throw new TarefaError(404, "Tarefa não encontrada");
  const ator = await atorDa(user, task);
  return db.transaction((tx) => acao(tx, ator));
}

router.post("/tasks/:id/steps", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const { afterStepId, ...etapa } = (req.body ?? {}) as Record<string, any>;
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => adicionarEtapa(tx, ator, String(req.params.id), etapa as never, afterStepId));
    entregarAvisos(log);
    res.status(201).json({ task: resultado.task, steps: resultado.steps });
  } catch (err) { responderErro(res, log, err, "Erro ao acrescentar etapa"); }
});

router.patch("/tasks/:id/steps/:stepId", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => atualizarEtapa(tx, ator, String(req.params.id), String(req.params.stepId), (req.body ?? {}) as never));
    res.json({ task: resultado.task, steps: resultado.steps });
  } catch (err) { responderErro(res, log, err, "Erro ao atualizar etapa"); }
});

router.post("/tasks/:id/steps/:stepId/start", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => iniciarEtapa(tx, ator, String(req.params.id), String(req.params.stepId)));
    res.json({ task: resultado.task, steps: resultado.steps });
  } catch (err) { responderErro(res, log, err, "Erro ao iniciar etapa"); }
});

router.post("/tasks/:id/steps/:stepId/complete", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => concluirEtapa(tx, ator, String(req.params.id), String(req.params.stepId)));
    entregarAvisos(log);
    res.json({ task: resultado.task, steps: resultado.steps });
  } catch (err) { responderErro(res, log, err, "Erro ao concluir etapa"); }
});

router.post("/tasks/:id/steps/:stepId/dispense", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => dispensarEtapa(tx, ator, String(req.params.id), String(req.params.stepId), req.body?.reason));
    entregarAvisos(log);
    res.json({ task: resultado.task, steps: resultado.steps });
  } catch (err) { responderErro(res, log, err, "Erro ao dispensar etapa"); }
});

router.post("/tasks/:id/steps/:stepId/reassign", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => reatribuirEtapa(tx, ator, String(req.params.id), String(req.params.stepId), String(req.body?.assigneeId ?? ""), req.body?.reason));
    entregarAvisos(log);
    res.json({ task: resultado.task, steps: resultado.steps });
  } catch (err) { responderErro(res, log, err, "Erro ao passar a etapa para outra pessoa"); }
});

// ─── Rotas de antes das etapas: agem na etapa que está com a vez ───────────────

// POST /tasks/:id/start — a pessoa da vez (ou a gestão) começa a etapa ativa
router.post("/tasks/:id/start", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  try {
    await garantirEtapas([String(req.params.id)], req.user!.organizationId);
    const resultado = await comAtor(req, String(req.params.id), async (tx, ator) => {
      const ativas = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, String(req.params.id)), eq(taskStepsTable.active, true), eq(taskStepsTable.status, "ACTIVE"))).orderBy(taskStepsTable.position);
      const minha = ativas.find((step) => step.assigneeId === user.sub) ?? (ator.gestor ? ativas[0] : undefined);
      if (!minha) throw new TarefaError(ativas.length ? 403 : 409, ativas.length ? "Esta etapa não é sua." : "Tarefa não pode ser iniciada neste estado");
      return iniciarEtapa(tx, ator, String(req.params.id), minha.id);
    });
    res.json({ task: resultado.task });
  } catch (err) { responderErro(res, log, err, "Erro ao iniciar tarefa"); }
});

// POST /tasks/:id/ready-for-approval — conclui a etapa de trabalho da pessoa; se a próxima é a aprovação, a tarefa fica aguardando
router.post("/tasks/:id/ready-for-approval", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  try {
    await garantirEtapas([String(req.params.id)], req.user!.organizationId);
    const resultado = await comAtor(req, String(req.params.id), async (tx, ator) => {
      const [task] = await tx.select().from(tasksTable).where(eq(tasksTable.id, String(req.params.id))).limit(1);
      const ativas = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, String(req.params.id)), eq(taskStepsTable.active, true), eq(taskStepsTable.status, "ACTIVE"), eq(taskStepsTable.kind, "WORK"))).orderBy(taskStepsTable.position);
      const minha = ativas.find((step) => step.assigneeId === user.sub);
      if (!minha) throw new TarefaError(task && (ativas.length || task.status === "READY_FOR_APPROVAL") ? 403 : 409, "Apenas o responsável pela etapa da vez pode concluí-la");
      // Checklist obrigatório e evidências do corpo antigo continuam valendo para as tarefas criadas por ele.
      const incompleto = (task?.mandatoryChecklist ?? []).filter((item) => !item.completed);
      if (incompleto.length) throw new TarefaError(422, `Checklist obrigatório incompleto: ${incompleto.length} item(s) pendente(s)`, { incomplete: incompleto.map((item) => item.label) });
      const exigidas = task?.mandatoryEvidences ?? [];
      if (exigidas.length) {
        const enviadas = await tx.select({ ref: taskEvidencesTable.mandatoryEvidenceRefId }).from(taskEvidencesTable).where(and(eq(taskEvidencesTable.taskId, String(req.params.id)), eq(taskEvidencesTable.isRequired, true), eq(taskEvidencesTable.active, true)));
        const refs = new Set(enviadas.map((item) => item.ref));
        const faltam = exigidas.filter((item) => !refs.has(item.id));
        if (faltam.length) throw new TarefaError(422, `Evidências obrigatórias faltando: ${faltam.length} item(s)`, { missing: faltam.map((item) => item.description) });
      }
      return concluirEtapa(tx, ator, String(req.params.id), minha.id);
    });
    entregarAvisos(log);
    res.json({ task: resultado.task });
  } catch (err) { responderErro(res, log, err, "Erro ao submeter tarefa"); }
});

// POST /tasks/:id/approve — conclui a etapa de aprovação que está com a vez
router.post("/tasks/:id/approve", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    await garantirEtapas([String(req.params.id)], req.user!.organizationId);
    const resultado = await comAtor(req, String(req.params.id), async (tx, ator) => {
      const [aprovacao] = await tx.select().from(taskStepsTable).where(and(eq(taskStepsTable.taskId, String(req.params.id)), eq(taskStepsTable.active, true), eq(taskStepsTable.status, "ACTIVE"), eq(taskStepsTable.kind, "APPROVAL"))).limit(1);
      if (!aprovacao) throw new TarefaError(409, "Tarefa não está pronta para aprovação");
      if (aprovacao.assigneeId !== ator.id && ator.role !== "ADMIN" && ator.role !== "DIR") throw new TarefaError(403, "Apenas o aprovador designado pode aprovar");
      return concluirEtapa(tx, ator, String(req.params.id), aprovacao.id);
    });
    entregarAvisos(log);
    res.json({ task: resultado.task });
  } catch (err) { responderErro(res, log, err, "Erro ao aprovar tarefa"); }
});

// POST /tasks/:id/request-changes — devolve a tarefa a uma etapa de trabalho (backToStepId; padrão: a última feita)
router.post("/tasks/:id/request-changes", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => pedirAjustes(tx, ator, String(req.params.id), { comment: req.body?.comment, backToStepId: req.body?.backToStepId }));
    entregarAvisos(log);
    res.json({ task: resultado.task });
  } catch (err) { responderErro(res, log, err, "Erro ao solicitar ajustes"); }
});

// ─── POST /tasks/:id/cancel ───────────────────────────────────────────────────

router.post("/tasks/:id/cancel", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  try {
    const resultado = await comAtor(req, String(req.params.id), (tx, ator) => cancelarTarefa(tx, ator, String(req.params.id), req.body?.reason));
    entregarAvisos(log);
    res.json({ task: resultado.task });
  } catch (err) { responderErro(res, log, err, "Erro ao cancelar tarefa"); }
});

// ─── POST /tasks/check-link — o app confere o link antes de salvar ─────────────

router.post("/tasks/check-link", requireAuth, requireOrganization, async (req, res) => {
  const link = lerLinkDrive(String(req.body?.url ?? ""));
  if (!link.ok) { res.json({ valid: false, shared: null, embedUrl: null, openUrl: null, message: link.motivo }); return; }
  const shared = await checarCompartilhamento(link.openUrl);
  res.json({
    valid: true, shared, kind: link.kind, embedUrl: link.embedUrl, openUrl: link.openUrl,
    message: shared === false ? "Esse arquivo não está compartilhado. Quem for abrir vai ver um pedido de acesso; compartilhe o arquivo com quem precisa." : shared === null ? "Não consegui conferir se o arquivo está compartilhado. Confira no Drive." : "Link do Drive ok.",
  });
});

// ─── POST /tasks/:id/evidences ────────────────────────────────────────────────

router.post("/tasks/:id/evidences", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, user.organizationId))).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isInvolved =
      task.assigneeId === user.sub ||
      task.creatorId === user.sub ||
      await ehGestaoDaTarefa(user, task) ||
      await temEtapa(id, user.sub);
    if (!isInvolved) { res.status(403).json({ error: "Forbidden", message: "Esta tarefa não é sua: você não criou e não tem etapa nela." }); return; }

    if (["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)) {
      res.status(409).json({ error: "Conflict", message: "Tarefa encerrada" }); return;
    }

    // Anexo é só link do Drive (o Supabase gratuito não comporta arquivo).
    const { url, description, isRequired = false, mandatoryEvidenceRefId, stepId } = req.body as {
      url?: string;
      description?: string;
      isRequired?: boolean;
      mandatoryEvidenceRefId?: string;
      stepId?: string;
    };
    const link = lerLinkDrive(url ?? "");
    if (!link.ok) { res.status(400).json({ error: "Bad Request", message: link.motivo }); return; }
    const type = "LINK";
    if (stepId) {
      const [etapa] = await db.select({ id: taskStepsTable.id }).from(taskStepsTable).where(and(eq(taskStepsTable.id, stepId), eq(taskStepsTable.taskId, id), eq(taskStepsTable.active, true))).limit(1);
      if (!etapa) { res.status(400).json({ error: "Bad Request", message: "Essa etapa não é desta tarefa." }); return; }
    }

    const [evidence] = await db
      .insert(taskEvidencesTable)
      .values({
        taskId: id,
        uploaderId: user.sub,
        type,
        url: link.openUrl,
        description,
        isRequired: !!isRequired,
        mandatoryEvidenceRefId: mandatoryEvidenceRefId ?? null,
        stepId: stepId ?? null,
      })
      .returning();

    await db.update(tasksTable).set({ lastActivityAt: new Date() }).where(eq(tasksTable.id, id));
    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.evidence_added",
      title: `Evidência adicionada: ${task.title}`,
      narrative: `${actorName} anexou um link do Drive à tarefa "${task.title}".`,
      entityType: "task",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: task.operationId,
      orgId: task.organizationId,
    });

    // O aviso de "não está compartilhado" é melhor esforço e nunca bloqueia: o link já foi salvo.
    const shared = await checarCompartilhamento(link.openUrl);
    res.status(201).json({ evidence, shared, embedUrl: link.embedUrl, openUrl: link.openUrl });
  } catch (err) {
    log.error({ err }, "Erro ao adicionar evidência");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE /tasks/:id/evidences/:evidenceId ──────────────────────────────────

router.delete(
  "/tasks/:id/evidences/:evidenceId",
  requireAuth,
  requireOrganization,
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
    const user = req.user!;
    const { id, evidenceId } = req.params as { id: string; evidenceId: string };

    try {
      const [task] = await db
        .select()
        .from(tasksTable)
        .where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, user.organizationId)))
        .limit(1);
      if (!task) { res.status(404).json({ error: "Not Found" }); return; }

      const [evidence] = await db
        .select()
        .from(taskEvidencesTable)
        .where(and(eq(taskEvidencesTable.id, evidenceId), eq(taskEvidencesTable.taskId, id), eq(taskEvidencesTable.active, true)))
        .limit(1);

      if (!evidence) { res.status(404).json({ error: "Not Found" }); return; }

      const canDelete = evidence.uploaderId === user.sub || (await ehGestaoDaTarefa(user, task));
      if (!canDelete) { res.status(403).json({ error: "Forbidden" }); return; }

      const actorName = await getActorName(user.sub);
      await db.transaction(async (tx) => {
        const [updated] = await tx.update(taskEvidencesTable)
          .set({ active: false })
          .where(and(eq(taskEvidencesTable.id, evidenceId), eq(taskEvidencesTable.active, true)))
          .returning();
        if (!updated) throw new Error("Evidência não encontrada");
        await writeHistoryEvent({
          category: "TASK", action: "task.evidence_deactivated",
          title: `Evidência desativada: ${evidence.description ?? evidence.type}`,
          narrative: `${actorName} desativou uma evidência da tarefa.`, entityType: "task_evidence",
          entityId: evidenceId, actorId: user.sub, actorName, orgId: task.organizationId,
          beforeState: evidence, afterState: updated, metadata: { reason: req.body?.reason ?? null },
        }, tx as any);
      });
      res.status(204).send();
    } catch (err) {
      log.error({ err }, "Erro ao remover evidência");
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// ─── GET /tasks/:id/comments ──────────────────────────────────────────────────

router.get("/tasks/:id/comments", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, user.organizationId))).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isInvolved =
      task.creatorId === user.sub ||
      task.assigneeId === user.sub ||
      task.approverId === user.sub ||
      await ehGestaoDaTarefa(user, task) ||
      await temEtapa(id, user.sub);
    if (!isInvolved) { res.status(403).json({ error: "Forbidden", message: "Esta tarefa não é sua: você não criou e não tem etapa nela." }); return; }

    const comments = await db
      .select({
        id: taskCommentsTable.id,
        taskId: taskCommentsTable.taskId,
        authorId: taskCommentsTable.authorId,
        authorName: usersTable.name,
        body: taskCommentsTable.body,
        createdAt: taskCommentsTable.createdAt,
      })
      .from(taskCommentsTable)
      .innerJoin(usersTable, eq(taskCommentsTable.authorId, usersTable.id))
      .where(eq(taskCommentsTable.taskId, id))
      .orderBy(taskCommentsTable.createdAt);

    res.json({ comments });
  } catch (err) {
    log.error({ err }, "Erro ao buscar comentários");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks/:id/comments ─────────────────────────────────────────────────

router.post("/tasks/:id/comments", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, user.organizationId))).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isInvolved =
      task.creatorId === user.sub ||
      task.assigneeId === user.sub ||
      task.approverId === user.sub ||
      await ehGestaoDaTarefa(user, task) ||
      await temEtapa(id, user.sub);
    if (!isInvolved) { res.status(403).json({ error: "Forbidden", message: "Esta tarefa não é sua: você não criou e não tem etapa nela." }); return; }

    const { body } = req.body as { body?: string };
    if (!body?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "Comentário não pode ser vazio" }); return;
    }

    const [comment] = await db
      .insert(taskCommentsTable)
      .values({ taskId: id, authorId: user.sub, body })
      .returning();

    await db.update(tasksTable).set({ lastActivityAt: new Date() }).where(eq(tasksTable.id, id));
    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.comment_added",
      title: `Comentário em: ${task.title}`,
      narrative: `${actorName} comentou na tarefa "${task.title}".`,
      entityType: "task",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: task.operationId,
      orgId: task.organizationId,
    });

    res.status(201).json({ comment: { ...comment, authorName: actorName } });
  } catch (err) {
    log.error({ err }, "Erro ao adicionar comentário");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
