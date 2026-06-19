import { Router, type IRouter } from "express";
import { eq, and, inArray, desc, lte, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { restrictionsTable, usersTable, userRolesTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { LOG_DOMAIN } from "@workspace/shared";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Física",
  HEALTH: "Saúde",
  SCHEDULE: "Disponibilidade",
  ROLE: "Função",
  TECHNICAL: "Técnica",
  PERSONAL: "Pessoal",
};

// ─── GET /restrictions — listar restrições ────────────────────────────────────

router.get("/restrictions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.RESTRICTIONS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Acesso restrito a supervisores" });
    return;
  }

  const { userId, operationId, status, type } = req.query as Record<string, string | undefined>;

  try {
    let memberIds: string[] = [];

    if (userId) {
      memberIds = [userId];
    } else if (operationId) {
      const roles = await db
        .select({ userId: userRolesTable.userId })
        .from(userRolesTable)
        .where(and(eq(userRolesTable.operationId, operationId), eq(userRolesTable.active, true)));
      memberIds = [...new Set(roles.map((r) => r.userId))];
    }

    const conditions = [];
    if (memberIds.length > 0) conditions.push(inArray(restrictionsTable.userId, memberIds));
    if (status) conditions.push(eq(restrictionsTable.status, status as any));
    if (type) conditions.push(eq(restrictionsTable.type, type as any));

    const rows = await db
      .select({
        id: restrictionsTable.id,
        userId: restrictionsTable.userId,
        userName: usersTable.name,
        type: restrictionsTable.type,
        periodStart: restrictionsTable.periodStart,
        periodEnd: restrictionsTable.periodEnd,
        status: restrictionsTable.status,
        notes: restrictionsTable.notes,
        createdBy: restrictionsTable.createdBy,
        createdAt: restrictionsTable.createdAt,
      })
      .from(restrictionsTable)
      .innerJoin(usersTable, eq(restrictionsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(restrictionsTable.createdAt));

    log.info({ count: rows.length }, "restrições listadas");
    res.json({ restrictions: rows });
  } catch (err) {
    log.error({ err }, "erro ao listar restrições");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /restrictions — criar restrição ─────────────────────────────────────

router.post("/restrictions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.RESTRICTIONS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem criar restrições" });
    return;
  }

  const { userId, type, periodStart, periodEnd, notes } = req.body as {
    userId: string;
    type: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  };

  if (!userId || !type || !periodStart || !periodEnd) {
    res.status(400).json({ error: "Bad Request", message: "userId, type, periodStart e periodEnd são obrigatórios" });
    return;
  }

  if (periodEnd < periodStart) {
    res.status(400).json({ error: "Bad Request", message: "periodEnd deve ser igual ou posterior a periodStart" });
    return;
  }

  const validTypes = ["PHYSICAL", "HEALTH", "SCHEDULE", "ROLE", "TECHNICAL", "PERSONAL"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: "Bad Request", message: `type deve ser: ${validTypes.join(", ")}` });
    return;
  }

  try {
    const [member] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    const [restriction] = await db
      .insert(restrictionsTable)
      .values({
        userId,
        type: type as any,
        periodStart,
        periodEnd,
        status: "ACTIVE",
        notes: notes ?? null,
        createdBy: user.sub,
      })
      .returning();

    const typeLabel = RESTRICTION_TYPE_LABELS[type] ?? type;
    writeHistoryEvent({
      category: "RESTRICTION",
      action: "restriction.created",
      title: `Restrição criada: ${typeLabel}`,
      narrative: `Restrição do tipo "${typeLabel}" criada para ${member.name} de ${periodStart} a ${periodEnd}.`,
      entityType: "restriction",
      entityId: restriction!.id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ restrictionId: restriction!.id, userId, type }, "restrição criada");
    res.status(201).json({ restriction: { ...restriction, userName: member.name } });
  } catch (err) {
    log.error({ err }, "erro ao criar restrição");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── PATCH /restrictions/:id — editar restrição ───────────────────────────────

router.patch("/restrictions/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.RESTRICTIONS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem editar restrições" });
    return;
  }

  const { periodStart, periodEnd, notes, type } = req.body;

  try {
    const [existing] = await db
      .select()
      .from(restrictionsTable)
      .where(eq(restrictionsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Restrição não encontrada" });
      return;
    }

    if (existing.status !== "ACTIVE") {
      res.status(409).json({ error: "Apenas restrições ativas podem ser editadas" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (periodStart !== undefined) updates.periodStart = periodStart;
    if (periodEnd !== undefined) updates.periodEnd = periodEnd;
    if (notes !== undefined) updates.notes = notes;
    if (type !== undefined) updates.type = type;

    const [updated] = await db
      .update(restrictionsTable)
      .set(updates as any)
      .where(eq(restrictionsTable.id, id))
      .returning();

    writeHistoryEvent({
      category: "RESTRICTION",
      action: "restriction.updated",
      title: "Restrição atualizada",
      narrative: `Restrição atualizada pelo supervisor.`,
      entityType: "restriction",
      entityId: id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ restrictionId: id }, "restrição atualizada");
    res.json({ restriction: updated });
  } catch (err) {
    log.error({ err }, "erro ao editar restrição");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /restrictions/:id/encerrar — encerrar restrição ─────────────────────

router.post("/restrictions/:id/encerrar", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.RESTRICTIONS, req.requestId, req.correlationId);
  const user = req.user!;
  const { id } = req.params as { id: string };

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas supervisores podem encerrar restrições" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(restrictionsTable)
      .where(eq(restrictionsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Restrição não encontrada" });
      return;
    }

    if (existing.status !== "ACTIVE") {
      res.status(409).json({ error: "Restrição já está encerrada" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const [updated] = await db
      .update(restrictionsTable)
      .set({ status: "EXPIRED", periodEnd: today } as any)
      .where(eq(restrictionsTable.id, id))
      .returning();

    writeHistoryEvent({
      category: "RESTRICTION",
      action: "restriction.expired",
      title: "Restrição encerrada",
      narrative: `Restrição encerrada antecipadamente pelo supervisor em ${today}.`,
      entityType: "restriction",
      entityId: id,
      actorId: user.sub,
      actorType: "HUMAN",
    }).catch(() => {});

    log.info({ restrictionId: id }, "restrição encerrada");
    res.json({ restriction: updated });
  } catch (err) {
    log.error({ err }, "erro ao encerrar restrição");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
