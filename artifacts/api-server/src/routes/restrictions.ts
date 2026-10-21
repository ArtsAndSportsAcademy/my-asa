import { Router, type IRouter } from "express";
import { eq, and, inArray, desc, lte, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { restrictionsTable, usersTable, userRolesTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { operationalDate } from "../lib/operational-date.js";
import { exigirUuidNosParametros } from "../lib/uuid.js";
import { canSupervisorAccessPerson } from "../services/area-local-scope.js";

// Sem tela desde 20/10/2026: nenhum arquivo vivo do site chama estas rotas (levantamento da revisão 4, docs/revisao-4-codigo-sem-uso-2026-10-20.md).
// Ficam porque os testes, a ASA ou outros roteadores ainda usam; tirá-las mexe em permission-matrix e em testes, e vale uma etapa própria.
const router: IRouter = Router();
exigirUuidNosParametros(router, { id: "Restrição não encontrada." });
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

/**
 * Restrição guarda dado de saúde e de limite físico de pessoas. Antes de 21/10/2026 estas rotas não olhavam a casa de ninguém: a Administração
 * (ou a Supervisão) de uma casa listava, criava, editava e encerrava restrição de pessoas de outra casa. Agora a pessoa dona da restrição tem de ser
 * da casa de quem pede, e a Supervisão só mexe em pessoas da própria área (a Administração mexe em toda a casa).
 */
async function podeMexerNaPessoa(user: { sub: string; role: string; organizationId: string }, personId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  return canSupervisorAccessPerson({ supervisorId: user.sub, organizationId: user.organizationId, personId });
}

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

    const conditions = [eq(usersTable.organizationId, user.organizationId)];
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
      .where(and(...conditions))
      .orderBy(desc(restrictionsTable.createdAt));

    const pessoasVisiveis = new Map<string, boolean>();
    for (const personId of new Set(rows.map((row) => row.userId))) pessoasVisiveis.set(personId, await podeMexerNaPessoa(user, personId));
    const visiveis = rows.filter((row) => pessoasVisiveis.get(row.userId));

    log.info({ count: visiveis.length }, "restrições listadas");
    res.json({ restrictions: visiveis });
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
      .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, user.organizationId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    if (!(await podeMexerNaPessoa(user, userId))) {
      res.status(403).json({ error: "Forbidden", message: "A Supervisão só cria restrição de pessoas da própria área." });
      return;
    }

    const typeLabel = RESTRICTION_TYPE_LABELS[type] ?? type;
    const [restriction] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(restrictionsTable).values({
        userId, type: type as any, periodStart, periodEnd,
        status: "ACTIVE", notes: notes ?? null, createdBy: user.sub,
      }).returning();
      if (!row) throw new Error("Não foi possível criar restrição");
      await writeHistoryEvent({
        category: "RESTRICTION", action: "restriction.created",
        title: `Restrição criada: ${typeLabel}`,
        narrative: `Restrição do tipo "${typeLabel}" criada para ${member.name} de ${periodStart} a ${periodEnd}.`,
        entityType: "restriction", entityId: row.id,
        actorId: user.sub, actorType: "HUMAN", orgId: user.organizationId,
        beforeState: null, afterState: row,
      }, tx as any);
      return [row] as const;
    });

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
    const [achada] = await db
      .select({ restriction: restrictionsTable })
      .from(restrictionsTable)
      .innerJoin(usersTable, eq(restrictionsTable.userId, usersTable.id))
      .where(and(eq(restrictionsTable.id, id), eq(usersTable.organizationId, user.organizationId)))
      .limit(1);
    const existing = achada?.restriction;

    if (!existing) {
      res.status(404).json({ error: "Restrição não encontrada" });
      return;
    }
    if (!(await podeMexerNaPessoa(user, existing.userId))) {
      res.status(403).json({ error: "Forbidden", message: "A Supervisão só mexe em restrição de pessoas da própria área." });
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

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(restrictionsTable).set(updates as any)
        .where(eq(restrictionsTable.id, id)).returning();
      if (!row) throw new Error("Restrição não encontrada");
      await writeHistoryEvent({
        category: "RESTRICTION", action: "restriction.updated", title: "Restrição atualizada",
        narrative: "Restrição atualizada pelo supervisor.", entityType: "restriction", entityId: id,
        actorId: user.sub, actorType: "HUMAN", orgId: user.organizationId,
        beforeState: existing, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

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
    const [achada] = await db
      .select({ restriction: restrictionsTable })
      .from(restrictionsTable)
      .innerJoin(usersTable, eq(restrictionsTable.userId, usersTable.id))
      .where(and(eq(restrictionsTable.id, id), eq(usersTable.organizationId, user.organizationId)))
      .limit(1);
    const existing = achada?.restriction;

    if (!existing) {
      res.status(404).json({ error: "Restrição não encontrada" });
      return;
    }
    if (!(await podeMexerNaPessoa(user, existing.userId))) {
      res.status(403).json({ error: "Forbidden", message: "A Supervisão só mexe em restrição de pessoas da própria área." });
      return;
    }

    if (existing.status !== "ACTIVE") {
      res.status(409).json({ error: "Restrição já está encerrada" });
      return;
    }

  const today = operationalDate();
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(restrictionsTable)
        .set({ status: "EXPIRED", periodEnd: today } as any)
        .where(eq(restrictionsTable.id, id)).returning();
      if (!row) throw new Error("Restrição não encontrada");
      await writeHistoryEvent({
        category: "RESTRICTION", action: "restriction.expired", title: "Restrição encerrada",
        narrative: `Restrição encerrada antecipadamente pelo supervisor em ${today}.`,
        entityType: "restriction", entityId: id, actorId: user.sub,
        actorType: "HUMAN", orgId: user.organizationId,
        beforeState: existing, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    log.info({ restrictionId: id }, "restrição encerrada");
    res.json({ restriction: updated });
  } catch (err) {
    log.error({ err }, "erro ao encerrar restrição");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
