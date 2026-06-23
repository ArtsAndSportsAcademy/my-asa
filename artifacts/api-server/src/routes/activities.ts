import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  recurringActivitiesTable,
  recurringActivityAssigneesTable,
  operationsTable,
  usersTable,
  userRolesTable,
  operationalGroupsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { supervisedOperationIds, groupCoveredOperationIds, loadGroupInOrg } from "./groups.js";

const router: IRouter = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTime(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

type AssigneeInput = { userId?: string | null; groupId?: string | null };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Operações que o utilizador pode gerir: ADMIN→todas da org; supervisor→as suas. */
async function manageableOperationIds(
  role: string,
  userId: string,
  organizationId: string,
): Promise<string[]> {
  if (role === "ADMIN") {
    const ops = await db.query.operationsTable.findMany({
      where: eq(operationsTable.organizationId, organizationId),
    });
    return ops.map((o) => o.id);
  }
  return supervisedOperationIds(userId);
}

/** Carrega uma atividade dentro do escopo gerível do utilizador, ou null. */
async function loadManageableActivity(
  activityId: string,
  allowedOps: string[],
): Promise<typeof recurringActivitiesTable.$inferSelect | null> {
  if (allowedOps.length === 0) return null;
  const [row] = await db
    .select()
    .from(recurringActivitiesTable)
    .where(
      and(
        eq(recurringActivitiesTable.id, activityId),
        inArray(recurringActivitiesTable.operationId, allowedOps),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Verifica se algum designado está fora da operação da atividade.
 * - utilizador: precisa de papel ativo na operação;
 * - grupo: precisa de cobrir a operação (OPERATION/MULTI/ALL).
 * Devolve `true` se houver pelo menos um designado fora do escopo.
 */
async function assigneesOutOfScope(
  operationId: string,
  organizationId: string,
  assignees: AssigneeInput[],
): Promise<boolean> {
  const userIds = [...new Set(assignees.map((a) => a.userId).filter((x): x is string => !!x))];
  const groupIds = [...new Set(assignees.map((a) => a.groupId).filter((x): x is string => !!x))];

  if (userIds.length > 0) {
    const rows = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .where(
        and(
          inArray(userRolesTable.userId, userIds),
          eq(userRolesTable.operationId, operationId),
          eq(userRolesTable.active, true),
        ),
      );
    const valid = new Set(rows.map((r) => r.userId));
    if (userIds.some((id) => !valid.has(id))) return true;
  }

  if (groupIds.length > 0) {
    // Resolver cada grupo via loadGroupInOrg: garante pertença à org de forma
    // SEGURA, tolerando grupos OPERATION legados com organization_id NULL (caem
    // para a operação na org), mas REJEITANDO ALL/MULTI sem org (evita IDOR
    // cross-org, pois groupCoveredOperationIds(ALL) usa a org do caller).
    for (const groupId of groupIds) {
      const g = await loadGroupInOrg(groupId, organizationId);
      if (!g) return true;
      const covered = await groupCoveredOperationIds(g, organizationId);
      if (!covered.includes(operationId)) return true;
    }
  }
  return false;
}

/** Substitui os designados de uma atividade dentro de uma transação. */
async function replaceAssignees(
  tx: Tx,
  activityId: string,
  assignees: AssigneeInput[],
): Promise<void> {
  await tx
    .delete(recurringActivityAssigneesTable)
    .where(eq(recurringActivityAssigneesTable.activityId, activityId));
  const rows = assignees
    .map((a) => ({
      activityId,
      userId: a.userId ?? null,
      groupId: a.groupId ?? null,
    }))
    .filter((r) => r.userId || r.groupId);
  if (rows.length > 0) {
    await tx.insert(recurringActivityAssigneesTable).values(rows);
  }
}

/** Hidrata as atividades com a lista de designados (nomes de utilizadores/grupos). */
async function hydrate(activities: (typeof recurringActivitiesTable.$inferSelect)[]) {
  if (activities.length === 0) return [];
  const ids = activities.map((a) => a.id);
  const assignees = await db
    .select()
    .from(recurringActivityAssigneesTable)
    .where(inArray(recurringActivityAssigneesTable.activityId, ids));

  const userIds = [...new Set(assignees.map((a) => a.userId).filter((x): x is string => !!x))];
  const groupIds = [...new Set(assignees.map((a) => a.groupId).filter((x): x is string => !!x))];

  const users = userIds.length
    ? await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
    : [];
  const groups = groupIds.length
    ? await db
        .select({ id: operationalGroupsTable.id, name: operationalGroupsTable.name })
        .from(operationalGroupsTable)
        .where(inArray(operationalGroupsTable.id, groupIds))
    : [];
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  return activities.map((a) => ({
    ...a,
    assignees: assignees
      .filter((x) => x.activityId === a.id)
      .map((x) => ({
        id: x.id,
        userId: x.userId,
        groupId: x.groupId,
        userName: x.userId ? userName.get(x.userId) ?? null : null,
        groupName: x.groupId ? groupName.get(x.groupId) ?? null : null,
      })),
  }));
}

// GET /api/activities — lista atividades das operações que o utilizador pode gerir
router.get("/activities", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.ACTIVITIES, req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const operationId = req.query["operationId"] as string | undefined;
  try {
    if (!MANAGER_ROLES.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    let allowed = await manageableOperationIds(role, sub, organizationId);
    if (operationId) allowed = allowed.filter((o) => o === operationId);
    if (allowed.length === 0) {
      res.json({ activities: [] });
      return;
    }
    const rows = await db
      .select()
      .from(recurringActivitiesTable)
      .where(inArray(recurringActivitiesTable.operationId, allowed));
    const activities = await hydrate(rows);
    res.json({ activities });
  } catch (err) {
    log.error({ err }, "erro ao listar atividades");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/activities — cria atividade recorrente ou avulsa
router.post(
  "/activities",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.ACTIVITIES, req.requestId, req.correlationId);
    const { role, sub, organizationId } = req.user!;
    const { operationId, title, weekday, specificDate, startTime, endTime, active, assignees } =
      req.body ?? {};
    try {
      if (!operationId || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "operationId e title são obrigatórios" });
        return;
      }
      const hasWeekday = typeof weekday === "number";
      const hasDate = typeof specificDate === "string" && DATE_RE.test(specificDate);
      if (hasWeekday === hasDate) {
        res.status(400).json({ error: "Informe weekday (0-6) OU specificDate (YYYY-MM-DD)" });
        return;
      }
      if (hasWeekday && (weekday < 0 || weekday > 6)) {
        res.status(400).json({ error: "weekday deve ser 0 (domingo) a 6 (sábado)" });
        return;
      }
      if (startTime != null && !isValidTime(startTime)) {
        res.status(400).json({ error: "startTime inválido (use HH:MM)" });
        return;
      }
      if (endTime != null && !isValidTime(endTime)) {
        res.status(400).json({ error: "endTime inválido (use HH:MM)" });
        return;
      }
      const allowed = await manageableOperationIds(role, sub, organizationId);
      if (!allowed.includes(operationId)) {
        res.status(403).json({ error: "Sem permissão nesta operação" });
        return;
      }
      if (
        Array.isArray(assignees) &&
        assignees.length > 0 &&
        (await assigneesOutOfScope(operationId, organizationId, assignees))
      ) {
        res.status(400).json({ error: "Designados fora da operação selecionada" });
        return;
      }

      const created = await db.transaction(async (tx) => {
        const [activity] = await tx
          .insert(recurringActivitiesTable)
          .values({
            organizationId,
            operationId,
            title: title.trim(),
            weekday: hasWeekday ? weekday : null,
            specificDate: hasDate ? specificDate : null,
            startTime: startTime ?? null,
            endTime: endTime ?? null,
            active: active === false ? false : true,
          })
          .returning();
        if (Array.isArray(assignees)) {
          await replaceAssignees(tx, activity!.id, assignees);
        }
        return activity!;
      });

      const [hydrated] = await hydrate([created]);
      res.status(201).json({ activity: hydrated });
    } catch (err) {
      log.error({ err }, "erro ao criar atividade");
      res.status(500).json({ error: "Erro ao criar atividade" });
    }
  },
);

// PATCH /api/activities/:id — atualiza campos e (opcional) designados
router.patch(
  "/activities/:id",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.ACTIVITIES, req.requestId, req.correlationId);
    const { role, sub, organizationId } = req.user!;
    const id = req.params["id"] as string;
    const { title, weekday, specificDate, startTime, endTime, active, assignees } = req.body ?? {};
    try {
      const allowed = await manageableOperationIds(role, sub, organizationId);
      const existing = await loadManageableActivity(id, allowed);
      if (!existing) {
        res.status(404).json({ error: "Atividade não encontrada" });
        return;
      }
      if (startTime != null && startTime !== "" && !isValidTime(startTime)) {
        res.status(400).json({ error: "startTime inválido (use HH:MM)" });
        return;
      }
      if (endTime != null && endTime !== "" && !isValidTime(endTime)) {
        res.status(400).json({ error: "endTime inválido (use HH:MM)" });
        return;
      }
      if (
        Array.isArray(assignees) &&
        assignees.length > 0 &&
        (await assigneesOutOfScope(existing.operationId, organizationId, assignees))
      ) {
        res.status(400).json({ error: "Designados fora da operação selecionada" });
        return;
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof title === "string" && title.trim()) patch["title"] = title.trim();
      if (typeof active === "boolean") patch["active"] = active;
      if (startTime !== undefined) patch["startTime"] = startTime || null;
      if (endTime !== undefined) patch["endTime"] = endTime || null;
      if (typeof weekday === "number" && weekday >= 0 && weekday <= 6) {
        patch["weekday"] = weekday;
        patch["specificDate"] = null;
      } else if (typeof specificDate === "string" && DATE_RE.test(specificDate)) {
        patch["specificDate"] = specificDate;
        patch["weekday"] = null;
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(recurringActivitiesTable)
          .set(patch)
          .where(eq(recurringActivitiesTable.id, id))
          .returning();
        if (Array.isArray(assignees)) {
          await replaceAssignees(tx, id, assignees);
        }
        return row!;
      });

      const [hydrated] = await hydrate([updated]);
      res.json({ activity: hydrated });
    } catch (err) {
      log.error({ err }, "erro ao atualizar atividade");
      res.status(500).json({ error: "Erro ao atualizar atividade" });
    }
  },
);

// DELETE /api/activities/:id — remove atividade (e designados em cascade)
router.delete(
  "/activities/:id",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.ACTIVITIES, req.requestId, req.correlationId);
    const { role, sub, organizationId } = req.user!;
    const id = req.params["id"] as string;
    try {
      const allowed = await manageableOperationIds(role, sub, organizationId);
      const existing = await loadManageableActivity(id, allowed);
      if (!existing) {
        res.status(404).json({ error: "Atividade não encontrada" });
        return;
      }
      await db.delete(recurringActivitiesTable).where(eq(recurringActivitiesTable.id, id));
      res.json({ ok: true });
    } catch (err) {
      log.error({ err }, "erro ao remover atividade");
      res.status(500).json({ error: "Erro ao remover atividade" });
    }
  },
);

export default router;
