import { Router, type IRouter } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tasksTable,
  taskEvidencesTable,
  taskCommentsTable,
  usersTable,
  operationsTable,
} from "@workspace/db";
import {
  requireAuth,
  requireOrganization,
} from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { hasActiveResponsibility } from "../lib/delegation-check.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";

const router: IRouter = Router();

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN";
const MANAGER_ROLES: RoleValue[] = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActorName(userId: string): Promise<string> {
  const [row] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return row?.name ?? userId;
}

async function canManageTasks(
  userId: string,
  role: RoleValue,
  operationId: string
): Promise<boolean> {
  if (MANAGER_ROLES.includes(role)) return true;
  return hasActiveResponsibility(userId, operationId, "TASK_APPROVALS");
}

// ─── GET /tasks/my — tarefas atribuídas ao usuário atual ─────────────────────

router.get("/tasks/my", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;

  try {
    const { status, priority } = req.query as Record<string, string>;
    const conditions: SQL<unknown>[] = [
      eq(tasksTable.assigneeId, user.sub),
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
      .where(and(...conditions))
      .orderBy(desc(tasksTable.dueDate));

    res.json({ tasks });
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

    if (user.role === "ADMIN") {
      conditions.push(eq(tasksTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(tasksTable.operationId, operationId));
    } else if (MANAGER_ROLES.includes(user.role as RoleValue)) {
      if (!operationId) {
        res.status(400).json({ error: "Bad Request", message: "operationId é obrigatório para supervisores" });
        return;
      }
      conditions.push(eq(tasksTable.operationId, operationId));
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
      .where(and(...conditions))
      .orderBy(desc(tasksTable.createdAt));

    res.json({ tasks });
  } catch (err) {
    log.error({ err }, "Erro ao listar tarefas");
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
      .where(eq(tasksTable.id, id))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Not Found", message: "Tarefa não encontrada" });
      return;
    }

    const isInvolved =
      task.creatorId === user.sub ||
      task.assigneeId === user.sub ||
      task.approverId === user.sub ||
      user.role === "ADMIN" ||
      MANAGER_ROLES.includes(user.role as RoleValue);

    if (!isInvolved) {
      res.status(403).json({ error: "Forbidden" });
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
      .where(eq(taskEvidencesTable.taskId, id))
      .orderBy(taskEvidencesTable.createdAt);

    res.json({
      task: {
        ...task,
        creatorName: userMap[task.creatorId] ?? null,
        assigneeName: userMap[task.assigneeId] ?? null,
        approverName: task.approverId ? (userMap[task.approverId] ?? null) : null,
      },
      evidences,
    });
  } catch (err) {
    log.error({ err }, "Erro ao buscar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks — criar tarefa ───────────────────────────────────────────────

router.post("/tasks", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;

  try {
    const {
      title,
      description,
      operationId,
      assigneeId,
      approverId,
      requiresApproval = true,
      priority = "MEDIUM",
      dueDate,
      mandatoryChecklist = [],
      mandatoryEvidences = [],
      origin = "MANUAL",
      libraryDocumentId,
    } = req.body as {
      title?: string;
      description?: string;
      operationId?: string;
      assigneeId?: string;
      approverId?: string;
      requiresApproval?: boolean;
      priority?: string;
      dueDate?: string;
      mandatoryChecklist?: { id: string; label: string; completed: boolean }[];
      mandatoryEvidences?: { id: string; type: string; description: string }[];
      origin?: string;
      libraryDocumentId?: string;
    };

    if (!title || !operationId || !assigneeId || !dueDate) {
      res.status(400).json({ error: "Bad Request", message: "title, operationId, assigneeId e dueDate são obrigatórios" });
      return;
    }

    const allowed = await canManageTasks(user.sub, user.role as RoleValue, operationId);
    if (!allowed) {
      res.status(403).json({ error: "Forbidden", message: "Apenas gestores podem criar tarefas" });
      return;
    }

    const [task] = await db
      .insert(tasksTable)
      .values({
        organizationId: user.organizationId,
        operationId,
        title,
        description,
        creatorId: user.sub,
        assigneeId,
        approverId: requiresApproval ? (approverId ?? null) : null,
        requiresApproval: !!requiresApproval,
        priority: priority as any,
        status: "CREATED",
        dueDate,
        mandatoryChecklist,
        operationalChecklist: [],
        mandatoryEvidences,
        origin: origin as any,
        libraryDocumentId: libraryDocumentId ?? null,
      })
      .returning();

    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.created",
      title: `Tarefa criada: ${task.title}`,
      narrative: `${actorName} criou a tarefa "${task.title}" com prioridade ${priority}, prazo ${dueDate}.`,
      entityType: "task",
      entityId: task.id,
      actorId: user.sub,
      actorName,
      operationId,
      orgId: user.organizationId,
    });

    res.status(201).json({ task });
  } catch (err) {
    log.error({ err }, "Erro ao criar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /tasks/:id — editar tarefa ────────────────────────────────────────

router.patch("/tasks/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const allowed = await canManageTasks(user.sub, user.role as RoleValue, task.operationId);
    const isAssignee = task.assigneeId === user.sub;

    if (!allowed && !isAssignee) { res.status(403).json({ error: "Forbidden" }); return; }

    if (["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)) {
      res.status(409).json({ error: "Conflict", message: "Tarefa encerrada não pode ser editada" });
      return;
    }

    const body = req.body as Record<string, any>;

    // Assignee without management rights can only update operationalChecklist
    if (isAssignee && !allowed) {
      if (body.operationalChecklist === undefined) { res.status(403).json({ error: "Forbidden" }); return; }
      const [updated] = await db
        .update(tasksTable)
        .set({ operationalChecklist: body.operationalChecklist, updatedAt: new Date() })
        .where(eq(tasksTable.id, id))
        .returning();
      res.json({ task: updated });
      return;
    }

    const updates: Partial<typeof tasksTable.$inferInsert> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;
    if (body.approverId !== undefined) updates.approverId = body.approverId;
    if (body.requiresApproval !== undefined) updates.requiresApproval = body.requiresApproval;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.mandatoryChecklist !== undefined) updates.mandatoryChecklist = body.mandatoryChecklist;
    if (body.mandatoryEvidences !== undefined) updates.mandatoryEvidences = body.mandatoryEvidences;
    if (body.operationalChecklist !== undefined) updates.operationalChecklist = body.operationalChecklist;

    const [updated] = await db
      .update(tasksTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    res.json({ task: updated });
  } catch (err) {
    log.error({ err }, "Erro ao editar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks/:id/start — iniciar execução ─────────────────────────────────

router.post("/tasks/:id/start", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    if (task.assigneeId !== user.sub && !MANAGER_ROLES.includes(user.role as RoleValue)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (task.status !== "CREATED" && task.status !== "CHANGES_REQUESTED") {
      res.status(409).json({ error: "Conflict", message: "Tarefa não pode ser iniciada neste estado" }); return;
    }

    const [updated] = await db
      .update(tasksTable)
      .set({ status: "IN_PROGRESS", updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.started",
      title: `Tarefa iniciada: ${task.title}`,
      narrative: `${actorName} iniciou a execução da tarefa "${task.title}".`,
      entityType: "task",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: task.operationId,
      orgId: task.organizationId,
    });

    res.json({ task: updated });
  } catch (err) {
    log.error({ err }, "Erro ao iniciar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks/:id/ready-for-approval ───────────────────────────────────────

router.post(
  "/tasks/:id/ready-for-approval",
  requireAuth,
  requireOrganization,
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
    const user = req.user!;
    const { id } = req.params as { id: string };

    try {
      const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
      if (!task) { res.status(404).json({ error: "Not Found" }); return; }

      if (task.assigneeId !== user.sub) {
        res.status(403).json({ error: "Forbidden", message: "Apenas o responsável pode submeter para aprovação" });
        return;
      }
      if (task.status !== "IN_PROGRESS") {
        res.status(409).json({ error: "Conflict", message: "Tarefa deve estar Em Andamento para submeter" });
        return;
      }

      // Validate mandatory checklist
      const checklist = task.mandatoryChecklist ?? [];
      const incomplete = checklist.filter((item) => !item.completed);
      if (incomplete.length > 0) {
        res.status(422).json({
          error: "Unprocessable Entity",
          message: `Checklist obrigatório incompleto: ${incomplete.length} item(s) pendente(s)`,
          incomplete: incomplete.map((i) => i.label),
        });
        return;
      }

      // Validate mandatory evidences
      const requiredEvs = task.mandatoryEvidences ?? [];
      if (requiredEvs.length > 0) {
        const uploaded = await db
          .select({ mandatoryEvidenceRefId: taskEvidencesTable.mandatoryEvidenceRefId })
          .from(taskEvidencesTable)
          .where(
            and(
              eq(taskEvidencesTable.taskId, id),
              eq(taskEvidencesTable.isRequired, true)
            )
          );
        const uploadedRefs = new Set(uploaded.map((u) => u.mandatoryEvidenceRefId));
        const missing = requiredEvs.filter((ev) => !uploadedRefs.has(ev.id));
        if (missing.length > 0) {
          res.status(422).json({
            error: "Unprocessable Entity",
            message: `Evidências obrigatórias faltando: ${missing.length} item(s)`,
            missing: missing.map((m) => m.description),
          });
          return;
        }
      }

      // If no approval required, complete directly
      if (!task.requiresApproval) {
        const [updated] = await db
          .update(tasksTable)
          .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
          .where(eq(tasksTable.id, id))
          .returning();

        const actorName = await getActorName(user.sub);
        await writeHistoryEvent({
          category: "TASK",
          action: "task.completed",
          title: `Tarefa concluída: ${task.title}`,
          narrative: `${actorName} concluiu a tarefa "${task.title}" (sem aprovação obrigatória).`,
          entityType: "task",
          entityId: id,
          actorId: user.sub,
          actorName,
          operationId: task.operationId,
          orgId: task.organizationId,
        });

        res.json({ task: updated });
        return;
      }

      const [updated] = await db
        .update(tasksTable)
        .set({ status: "READY_FOR_APPROVAL", updatedAt: new Date() })
        .where(eq(tasksTable.id, id))
        .returning();

      const actorName = await getActorName(user.sub);
      await writeHistoryEvent({
        category: "TASK",
        action: "task.ready_for_approval",
        title: `Tarefa pronta para aprovação: ${task.title}`,
        narrative: `${actorName} submeteu a tarefa "${task.title}" para aprovação.`,
        entityType: "task",
        entityId: id,
        actorId: user.sub,
        actorName,
        operationId: task.operationId,
        orgId: task.organizationId,
      });

      res.json({ task: updated });
    } catch (err) {
      log.error({ err }, "Erro ao submeter tarefa");
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// ─── POST /tasks/:id/approve ──────────────────────────────────────────────────

router.post("/tasks/:id/approve", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isApprover = task.approverId === user.sub || user.role === "ADMIN";
    if (!isApprover) {
      res.status(403).json({ error: "Forbidden", message: "Apenas o aprovador designado pode aprovar" });
      return;
    }
    if (task.status !== "READY_FOR_APPROVAL") {
      res.status(409).json({ error: "Conflict", message: "Tarefa não está pronta para aprovação" });
      return;
    }

    const [updated] = await db
      .update(tasksTable)
      .set({ status: "APPROVED", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.approved",
      title: `Tarefa aprovada: ${task.title}`,
      narrative: `${actorName} aprovou a tarefa "${task.title}".`,
      entityType: "task",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: task.operationId,
      orgId: task.organizationId,
    });

    res.json({ task: updated });
  } catch (err) {
    log.error({ err }, "Erro ao aprovar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks/:id/request-changes ──────────────────────────────────────────

router.post(
  "/tasks/:id/request-changes",
  requireAuth,
  requireOrganization,
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
    const user = req.user!;
    const { id } = req.params as { id: string };

    try {
      const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
      if (!task) { res.status(404).json({ error: "Not Found" }); return; }

      const isApprover = task.approverId === user.sub || user.role === "ADMIN";
      if (!isApprover) { res.status(403).json({ error: "Forbidden" }); return; }
      if (task.status !== "READY_FOR_APPROVAL") {
        res.status(409).json({ error: "Conflict", message: "Tarefa não está pronta para aprovação" }); return;
      }

      const { comment } = req.body as { comment?: string };
      if (!comment?.trim()) {
        res.status(400).json({ error: "Bad Request", message: "Um comentário explicando os ajustes é obrigatório" });
        return;
      }

      const [updated] = await db
        .update(tasksTable)
        .set({ status: "CHANGES_REQUESTED", updatedAt: new Date() })
        .where(eq(tasksTable.id, id))
        .returning();

      await db.insert(taskCommentsTable).values({
        taskId: id,
        authorId: user.sub,
        body: `[Ajustes solicitados] ${comment}`,
      });

      const actorName = await getActorName(user.sub);
      await writeHistoryEvent({
        category: "TASK",
        action: "task.changes_requested",
        title: `Ajustes solicitados: ${task.title}`,
        narrative: `${actorName} solicitou ajustes na tarefa "${task.title}": ${comment}`,
        entityType: "task",
        entityId: id,
        actorId: user.sub,
        actorName,
        operationId: task.operationId,
        orgId: task.organizationId,
      });

      res.json({ task: updated });
    } catch (err) {
      log.error({ err }, "Erro ao solicitar ajustes");
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// ─── POST /tasks/:id/cancel ───────────────────────────────────────────────────

router.post("/tasks/:id/cancel", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const allowed = await canManageTasks(user.sub, user.role as RoleValue, task.operationId);
    if (!allowed) {
      res.status(403).json({ error: "Forbidden", message: "Apenas gestores podem cancelar tarefas" });
      return;
    }
    if (["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)) {
      res.status(409).json({ error: "Conflict", message: "Tarefa já encerrada" }); return;
    }

    const { reason } = req.body as { reason?: string };

    const [updated] = await db
      .update(tasksTable)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: user.sub,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, id))
      .returning();

    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.cancelled",
      title: `Tarefa cancelada: ${task.title}`,
      narrative: `${actorName} cancelou a tarefa "${task.title}". Motivo: ${reason ?? "não informado"}.`,
      entityType: "task",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: task.operationId,
      orgId: task.organizationId,
    });

    res.json({ task: updated });
  } catch (err) {
    log.error({ err }, "Erro ao cancelar tarefa");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /tasks/:id/evidences ────────────────────────────────────────────────

router.post("/tasks/:id/evidences", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.TASKS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  try {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isInvolved =
      task.assigneeId === user.sub ||
      task.creatorId === user.sub ||
      MANAGER_ROLES.includes(user.role as RoleValue);
    if (!isInvolved) { res.status(403).json({ error: "Forbidden" }); return; }

    if (["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)) {
      res.status(409).json({ error: "Conflict", message: "Tarefa encerrada" }); return;
    }

    const { type, url, description, isRequired = false, mandatoryEvidenceRefId } = req.body as {
      type?: string;
      url?: string;
      description?: string;
      isRequired?: boolean;
      mandatoryEvidenceRefId?: string;
    };
    if (!type || !url) {
      res.status(400).json({ error: "Bad Request", message: "type e url são obrigatórios" }); return;
    }

    const [evidence] = await db
      .insert(taskEvidencesTable)
      .values({
        taskId: id,
        uploaderId: user.sub,
        type: type as any,
        url,
        description,
        isRequired: !!isRequired,
        mandatoryEvidenceRefId: mandatoryEvidenceRefId ?? null,
      })
      .returning();

    const actorName = await getActorName(user.sub);
    await writeHistoryEvent({
      category: "TASK",
      action: "task.evidence_added",
      title: `Evidência adicionada: ${task.title}`,
      narrative: `${actorName} adicionou uma evidência (${type}) à tarefa "${task.title}".`,
      entityType: "task",
      entityId: id,
      actorId: user.sub,
      actorName,
      operationId: task.operationId,
      orgId: task.organizationId,
    });

    res.status(201).json({ evidence });
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
      const [evidence] = await db
        .select()
        .from(taskEvidencesTable)
        .where(and(eq(taskEvidencesTable.id, evidenceId), eq(taskEvidencesTable.taskId, id)))
        .limit(1);

      if (!evidence) { res.status(404).json({ error: "Not Found" }); return; }

      const canDelete = evidence.uploaderId === user.sub || MANAGER_ROLES.includes(user.role as RoleValue);
      if (!canDelete) { res.status(403).json({ error: "Forbidden" }); return; }

      await db.delete(taskEvidencesTable).where(eq(taskEvidencesTable.id, evidenceId));
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
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isInvolved =
      task.creatorId === user.sub ||
      task.assigneeId === user.sub ||
      task.approverId === user.sub ||
      MANAGER_ROLES.includes(user.role as RoleValue);
    if (!isInvolved) { res.status(403).json({ error: "Forbidden" }); return; }

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
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not Found" }); return; }

    const isInvolved =
      task.creatorId === user.sub ||
      task.assigneeId === user.sub ||
      task.approverId === user.sub ||
      MANAGER_ROLES.includes(user.role as RoleValue);
    if (!isInvolved) { res.status(403).json({ error: "Forbidden" }); return; }

    const { body } = req.body as { body?: string };
    if (!body?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "Comentário não pode ser vazio" }); return;
    }

    const [comment] = await db
      .insert(taskCommentsTable)
      .values({ taskId: id, authorId: user.sub, body })
      .returning();

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
