import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  folgasTable,
  usersTable,
  operationsTable,
  userRolesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { sendNotification } from "../services/notificationService.js";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offsetDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Validate that the calling user can manage the given operationId.
 * ADMIN: operationId must belong to their org.
 * SUPERVISOR: they must have an active role in that operationId.
 * Optionally validates that targetUserId has an active role in the operation.
 * Returns an error message string if denied, null if allowed.
 */
async function validateManagerScope(
  user: { role: string; organizationId: string; sub: string },
  operationId: string,
  targetUserId?: string
): Promise<string | null> {
  if (user.role === "ADMIN") {
    const [op] = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(and(
        eq(operationsTable.id, operationId),
        eq(operationsTable.organizationId, user.organizationId)
      ));
    if (!op) return "Operação não pertence à sua organização";
  } else {
    const [role] = await db
      .select({ id: userRolesTable.id })
      .from(userRolesTable)
      .where(and(
        eq(userRolesTable.userId, user.sub),
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true)
      ));
    if (!role) return "Você não tem acesso a esta operação";
  }

  if (targetUserId) {
    const [membership] = await db
      .select({ id: userRolesTable.id })
      .from(userRolesTable)
      .where(and(
        eq(userRolesTable.userId, targetUserId),
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true)
      ));
    if (!membership) return "Membro não pertence a esta operação";
  }

  return null;
}

/**
 * Cancel a folga record that overlaps a month range, preserving days outside the range
 * by creating left and/or right fragments.
 */
async function cancelAndSplitRange(
  f: {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    userId: string;
    operationId: string;
    notes: string | null;
  },
  firstDay: string,
  lastDay: string,
  createdBy: string
): Promise<void> {
  await db
    .update(folgasTable)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(folgasTable.id, f.id));

  if (f.startDate < firstDay) {
    await db.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: f.startDate,
      endDate: offsetDate(firstDay, -1),
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }

  if (f.endDate > lastDay) {
    await db.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: offsetDate(lastDay, 1),
      endDate: f.endDate,
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }
}

/**
 * Cancel a folga record and, if it spans more than the target date,
 * create left and/or right fragments to preserve the days not being edited.
 */
async function cancelAndSplit(
  f: {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    userId: string;
    operationId: string;
    notes: string | null;
  },
  targetDate: string,
  createdBy: string
): Promise<void> {
  await db
    .update(folgasTable)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(folgasTable.id, f.id));

  if (f.startDate < targetDate) {
    await db.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: f.startDate,
      endDate: offsetDate(targetDate, -1),
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }

  if (f.endDate > targetDate) {
    await db.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: offsetDate(targetDate, 1),
      endDate: f.endDate,
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }
}

// ─── GET /folgas — listar (baseado em papel) ──────────────────────────────────

router.get("/folgas", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId, userId, type, status, dateFrom, dateTo } = req.query as Record<string, string>;

  try {
    const conditions: SQL<unknown>[] = [];

    if (user.role === "ADMIN") {
      conditions.push(eq(operationsTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(folgasTable.operationId, operationId));
      if (userId) conditions.push(eq(folgasTable.userId, userId));
    } else if (MANAGER_ROLES.includes(user.role)) {
      if (!operationId) {
        res.status(400).json({ error: "Bad Request", message: "operationId é obrigatório para supervisores" });
        return;
      }
      const scopeErr = await validateManagerScope(user, operationId);
      if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
      conditions.push(eq(folgasTable.operationId, operationId));
      if (userId) conditions.push(eq(folgasTable.userId, userId));
    } else {
      conditions.push(eq(folgasTable.userId, user.sub));
    }

    if (type) conditions.push(eq(folgasTable.type, type as any));
    if (status) conditions.push(eq(folgasTable.status, status as any));
    if (dateFrom) conditions.push(gte(folgasTable.startDate, dateFrom));
    if (dateTo) conditions.push(lte(folgasTable.endDate, dateTo));

    const rows = await db
      .select({
        id:            folgasTable.id,
        userId:        folgasTable.userId,
        userName:      usersTable.name,
        operationId:   folgasTable.operationId,
        operationName: operationsTable.name,
        type:          folgasTable.type,
        startDate:     folgasTable.startDate,
        endDate:       folgasTable.endDate,
        status:        folgasTable.status,
        origem:        folgasTable.origem,
        requestId:     folgasTable.requestId,
        createdBy:     folgasTable.createdBy,
        notes:         folgasTable.notes,
        createdAt:     folgasTable.createdAt,
        updatedAt:     folgasTable.updatedAt,
      })
      .from(folgasTable)
      .innerJoin(usersTable, eq(folgasTable.userId, usersTable.id))
      .innerJoin(operationsTable, eq(folgasTable.operationId, operationsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(folgasTable.startDate));

    log.info({ count: rows.length, role: user.role }, "folgas listadas");
    res.json({ folgas: rows });
  } catch (err) {
    log.error({ err }, "erro ao listar folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /folgas/grid — grade mensal ──────────────────────────────────────────

router.get("/folgas/grid", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId, year, month } = req.query as Record<string, string>;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!operationId || !year || !month) {
    res.status(400).json({ error: "Bad Request", message: "operationId, year e month são obrigatórios" });
    return;
  }

  const yr = parseInt(year, 10);
  const mo = parseInt(month, 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) {
    res.status(400).json({ error: "Bad Request", message: "year e month inválidos" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }

  try {
    const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01`;
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const lastDay = `${yr}-${String(mo).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const members = await db
      .select({
        userId: userRolesTable.userId,
        name:   usersTable.name,
      })
      .from(userRolesTable)
      .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true),
      ))
      .orderBy(usersTable.name);

    const memberIds = members.map((m) => m.userId);

    const folgas = memberIds.length > 0
      ? await db
          .select({
            userId:    folgasTable.userId,
            type:      folgasTable.type,
            startDate: folgasTable.startDate,
            endDate:   folgasTable.endDate,
          })
          .from(folgasTable)
          .where(and(
            eq(folgasTable.operationId, operationId),
            eq(folgasTable.status, "ACTIVE"),
            lte(folgasTable.startDate, lastDay),
            gte(folgasTable.endDate, firstDay),
            inArray(folgasTable.userId, memberIds),
          ))
      : [];

    const daysMap: Record<string, Record<string, string>> = {};
    for (const f of folgas) {
      const sDate = new Date(f.startDate + "T00:00:00Z");
      const eDate = new Date(f.endDate + "T00:00:00Z");

      const startDay =
        sDate.getUTCFullYear() === yr && sDate.getUTCMonth() + 1 === mo
          ? sDate.getUTCDate()
          : 1;
      const endDay =
        eDate.getUTCFullYear() === yr && eDate.getUTCMonth() + 1 === mo
          ? eDate.getUTCDate()
          : daysInMonth;

      if (!daysMap[f.userId]) daysMap[f.userId] = {};
      for (let d = startDay; d <= endDay; d++) {
        daysMap[f.userId][String(d)] = f.type;
      }
    }

    const result = members.map((m) => {
      const days = daysMap[m.userId] ?? {};
      const totals: Record<string, number> = {
        NO_SHOW: 0, RECESSO: 0, OUTRO: 0, DAY_OFF: 0, AFASTAMENTO: 0, RESTRICAO: 0,
      };
      for (const type of Object.values(days)) {
        if (type in totals) totals[type]++;
      }
      return { userId: m.userId, name: m.name, days, totals };
    });

    log.info({ operationId, yr, mo, members: result.length }, "grade de folgas gerada");
    res.json({ members: result, daysInMonth });
  } catch (err) {
    log.error({ err }, "erro ao gerar grade de folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas/grid/toggle — alternar célula ───────────────────────────────

router.post("/folgas/grid/toggle", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId, operationId, date, type } = req.body as {
    userId: string; operationId: string; date: string; type?: string | null;
  };

  if (!userId || !operationId || !date) {
    res.status(400).json({ error: "Bad Request", message: "userId, operationId e date são obrigatórios" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId, userId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }

  try {
    const existing = await db
      .select({
        id: folgasTable.id,
        startDate: folgasTable.startDate,
        endDate: folgasTable.endDate,
        type: folgasTable.type,
        userId: folgasTable.userId,
        operationId: folgasTable.operationId,
        notes: folgasTable.notes,
      })
      .from(folgasTable)
      .where(and(
        eq(folgasTable.userId, userId),
        eq(folgasTable.operationId, operationId),
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, date),
        gte(folgasTable.endDate, date),
      ));

    for (const f of existing) {
      await cancelAndSplit(f, date, user.sub);
    }

    if (type) {
      await db.insert(folgasTable).values({
        userId,
        operationId,
        type: type as any,
        startDate: date,
        endDate: date,
        status: "ACTIVE",
        origem: "MANUAL",
        createdBy: user.sub,
      });

      await writeHistoryEvent({
        category: "ABSENCE",
        action: "FOLGA_GRID_SET",
        title: `Folga ${type} registrada em ${date}`,
        narrative: `Gestor registrou ausência tipo ${type} para o membro no dia ${date}.`,
        entityType: "folga",
        entityId: `${userId}:${date}`,
        actorId: user.sub,
        operationId,
      }).catch(() => {});
    } else if (existing.length > 0) {
      await writeHistoryEvent({
        category: "ABSENCE",
        action: "FOLGA_GRID_CLEAR",
        title: `Folga removida em ${date}`,
        narrative: `Gestor removeu ausência do membro no dia ${date}.`,
        entityType: "folga",
        entityId: `${userId}:${date}`,
        actorId: user.sub,
        operationId,
      }).catch(() => {});
    }

    log.info({ userId, date, type: type ?? "clear" }, "célula da grade alterada");
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "erro ao alternar célula da grade");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas/grid/bulk — preencher múltiplas células ─────────────────────

router.post("/folgas/grid/bulk", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId, operationId, dates, type } = req.body as {
    userId: string; operationId: string; dates: string[]; type?: string | null;
  };

  if (!userId || !operationId || !Array.isArray(dates) || dates.length === 0) {
    res.status(400).json({ error: "Bad Request", message: "userId, operationId e dates[] são obrigatórios" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId, userId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }

  try {
    const sortedDates = [...dates].sort();

    for (const date of sortedDates) {
      const existing = await db
        .select({
          id: folgasTable.id,
          startDate: folgasTable.startDate,
          endDate: folgasTable.endDate,
          type: folgasTable.type,
          userId: folgasTable.userId,
          operationId: folgasTable.operationId,
          notes: folgasTable.notes,
        })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.userId, userId),
          eq(folgasTable.operationId, operationId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate, date),
        ));

      for (const f of existing) {
        await cancelAndSplit(f, date, user.sub);
      }

      if (type) {
        await db.insert(folgasTable).values({
          userId,
          operationId,
          type: type as any,
          startDate: date,
          endDate: date,
          status: "ACTIVE",
          origem: "MANUAL",
          createdBy: user.sub,
        });
      }
    }

    await writeHistoryEvent({
      category: "ABSENCE",
      action: "FOLGA_GRID_BULK",
      title: `Bulk de folgas: ${dates.length} dia(s) ${type ?? "limpos"}`,
      narrative: `Gestor aplicou ${type ?? "limpeza"} em ${dates.length} dia(s) para o membro.`,
      entityType: "folga",
      entityId: userId,
      actorId: user.sub,
      operationId,
      metadata: { dates, type: type ?? null },
    }).catch(() => {});

    log.info({ userId, count: dates.length, type: type ?? "clear" }, "bulk de folgas aplicado");
    res.json({ ok: true, processed: dates.length });
  } catch (err) {
    log.error({ err }, "erro ao aplicar bulk de folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE /folgas/grid/reset — resetar mês inteiro ─────────────────────────

router.delete("/folgas/grid/reset", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden", message: "Apenas Admin pode resetar o mês" });
    return;
  }

  const { operationId, year, month } = req.query as Record<string, string>;

  if (!operationId || !year || !month) {
    res.status(400).json({ error: "Bad Request", message: "operationId, year e month são obrigatórios" });
    return;
  }

  const yr = parseInt(year, 10);
  const mo = parseInt(month, 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) {
    res.status(400).json({ error: "Bad Request", message: "year e month inválidos" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }

  try {
    const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01`;
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const lastDay = `${yr}-${String(mo).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const toCancel = await db
      .select({
        id: folgasTable.id,
        startDate: folgasTable.startDate,
        endDate: folgasTable.endDate,
        type: folgasTable.type,
        userId: folgasTable.userId,
        operationId: folgasTable.operationId,
        notes: folgasTable.notes,
      })
      .from(folgasTable)
      .where(and(
        eq(folgasTable.operationId, operationId),
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, lastDay),
        gte(folgasTable.endDate, firstDay),
      ));

    for (const f of toCancel) {
      await cancelAndSplitRange(f, firstDay, lastDay, user.sub);
    }

    await writeHistoryEvent({
      category: "ABSENCE",
      action: "FOLGA_GRID_RESET",
      title: `Grade de folgas resetada — ${mo}/${yr}`,
      narrative: `Admin resetou todas as folgas do mês ${mo}/${yr} na operação.`,
      entityType: "folga",
      entityId: operationId,
      actorId: user.sub,
      operationId,
      metadata: { year: yr, month: mo, cancelled: toCancel.length },
    }).catch(() => {});

    log.info({ operationId, yr, mo, cancelled: toCancel.length }, "mês de folgas resetado");
    res.json({ ok: true, cancelled: toCancel.length });
  } catch (err) {
    log.error({ err }, "erro ao resetar mês de folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas — criar folga manual ────────────────────────────────────────

router.post("/folgas", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas gestores podem criar folgas manualmente" });
    return;
  }

  const { userId, operationId, type, startDate, endDate, notes } = req.body as {
    userId: string; operationId: string; type: string;
    startDate: string; endDate: string; notes?: string;
  };

  if (!userId || !operationId || !type || !startDate || !endDate) {
    res.status(400).json({ error: "Bad Request", message: "userId, operationId, type, startDate e endDate são obrigatórios" });
    return;
  }

  try {
    const [folga] = await db
      .insert(folgasTable)
      .values({
        userId,
        operationId,
        type: type as any,
        startDate,
        endDate,
        status: "ACTIVE",
        origem: "MANUAL",
        createdBy: user.sub,
        notes: notes ?? null,
      })
      .returning();

    await sendNotification({
      userId,
      type: "folga.created",
      title: "Nova folga registrada",
      message: `Uma folga foi registrada para você de ${startDate} a ${endDate}.`,
      category: "absence",
      entityType: "folga",
      entityId: folga!.id,
    });

    await writeHistoryEvent({
      category: "ABSENCE",
      action: "FOLGA_CREATED",
      title: `Folga ${type} registrada`,
      narrative: `Gestor registrou folga manual do tipo ${type} de ${startDate} a ${endDate}.`,
      entityType: "folga",
      entityId: folga!.id,
      actorId: user.sub,
      operationId,
    }).catch(() => {});

    log.info({ folgaId: folga!.id, userId, type }, "folga criada");
    res.status(201).json(folga);
  } catch (err) {
    log.error({ err }, "erro ao criar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /folgas/:id — editar folga ─────────────────────────────────────────

router.patch("/folgas/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const id = req.params.id as string;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { type, startDate, endDate, notes } = req.body as {
    type?: string; startDate?: string; endDate?: string; notes?: string;
  };

  try {
    const [existing] = await db.select().from(folgasTable).where(eq(folgasTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not Found" }); return; }
    if (existing.status === "CANCELLED") {
      res.status(400).json({ error: "Bad Request", message: "Folga cancelada não pode ser editada" });
      return;
    }

    const updates: Partial<typeof folgasTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (type) updates.type = type as any;
    if (startDate) updates.startDate = startDate;
    if (endDate) updates.endDate = endDate;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db.update(folgasTable).set(updates).where(eq(folgasTable.id, id)).returning();
    log.info({ folgaId: id }, "folga atualizada");
    res.json(updated);
  } catch (err) {
    log.error({ err }, "erro ao editar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas/:id/cancelar — cancelar folga ───────────────────────────────

router.post("/folgas/:id/cancelar", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const id = req.params.id as string;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const [existing] = await db.select().from(folgasTable).where(eq(folgasTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not Found" }); return; }

    const [updated] = await db
      .update(folgasTable)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(folgasTable.id, id))
      .returning();

    await sendNotification({
      userId: existing.userId,
      type: "folga.cancelled",
      title: "Folga cancelada",
      message: `Sua folga de ${existing.startDate} a ${existing.endDate} foi cancelada.`,
      category: "absence",
      entityType: "folga",
      entityId: id,
    });

    await writeHistoryEvent({
      category: "ABSENCE",
      action: "FOLGA_CANCELLED",
      title: "Folga cancelada",
      narrative: `Gestor cancelou folga de ${existing.startDate} a ${existing.endDate}.`,
      entityType: "folga",
      entityId: id,
      actorId: user.sub,
      operationId: existing.operationId,
    }).catch(() => {});

    log.info({ folgaId: id }, "folga cancelada");
    res.json(updated);
  } catch (err) {
    log.error({ err }, "erro ao cancelar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
