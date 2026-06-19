import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  folgasTable,
  usersTable,
  operationsTable,
  requestsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { sendNotification } from "../services/notificationService.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

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

    await writeHistoryEvent({
      organizationId: user.organizationId,
      operationId,
      actorId: user.sub,
      domain: "folgas",
      eventType: "folga.created",
      title: "Folga criada manualmente",
      narrative: `Folga do tipo ${type} registrada para o período ${startDate} a ${endDate}.`,
      metadata: { folgaId: folga!.id, type, startDate, endDate },
    });

    await sendNotification({
      recipientId: userId,
      type: "folga.created",
      title: "Nova folga registrada",
      body: `Uma folga foi registrada para você de ${startDate} a ${endDate}.`,
      data: { folgaId: folga!.id },
    });

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
      recipientId: existing.userId,
      type: "folga.cancelled",
      title: "Folga cancelada",
      body: `Sua folga de ${existing.startDate} a ${existing.endDate} foi cancelada.`,
      data: { folgaId: id },
    });

    log.info({ folgaId: id }, "folga cancelada");
    res.json(updated);
  } catch (err) {
    log.error({ err }, "erro ao cancelar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
