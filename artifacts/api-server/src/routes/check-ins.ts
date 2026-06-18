import { Router, type IRouter } from "express";
import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  operationalCheckInsTable,
  scaleAllocationsTable,
  scalesTable,
  agendaEventsTable,
  usersTable,
  operationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];
const LATE_THRESHOLD_MINUTES_DEFAULT = 15;
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

// ─── Helper: minutes since midnight in a given timezone ──────────────────────

function getLocalMinutes(date: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

// ─── Helper: get users expected today in an operation ────────────────────────

async function getExpectedUsers(operationId: string, date: string) {
  const rows = await db
    .selectDistinct({
      userId: scaleAllocationsTable.userId,
      userName: usersTable.name,
      userPhotoUrl: usersTable.photoUrl,
      earliestStart: sql<string>`min(${agendaEventsTable.startTime})`,
    })
    .from(scaleAllocationsTable)
    .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
    .innerJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
    .where(
      and(
        eq(agendaEventsTable.date, date),
        eq(scalesTable.operationId, operationId),
        inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
        sql`${scaleAllocationsTable.userId} IS NOT NULL`,
      )
    )
    .groupBy(scaleAllocationsTable.userId, usersTable.name, usersTable.photoUrl)
    .orderBy(asc(usersTable.name));

  return rows;
}

// ─── GET /check-ins — lista do dia (supervisor) ───────────────────────────────

router.get("/check-ins", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.CHECK_IN, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Acesso restrito a supervisores" });
    return;
  }

  const { date, operationId } = req.query as Record<string, string>;
  if (!date || !operationId) {
    res.status(400).json({ error: "Bad Request", message: "date e operationId são obrigatórios" });
    return;
  }

  try {
    const [expectedUsers, checkInRecords] = await Promise.all([
      getExpectedUsers(operationId, date),
      db
        .select()
        .from(operationalCheckInsTable)
        .where(
          and(
            eq(operationalCheckInsTable.operationId, operationId),
            eq(operationalCheckInsTable.date, date),
          )
        ),
    ]);

    const checkInMap = new Map(checkInRecords.map((c) => [c.userId, c]));

    const items = expectedUsers.map((u) => {
      const record = checkInMap.get(u.userId!);
      return {
        userId: u.userId,
        userName: u.userName,
        userPhotoUrl: u.userPhotoUrl,
        earliestStart: u.earliestStart,
        checkInId: record?.id ?? null,
        status: record?.status ?? "EXPECTED",
        checkedInAt: record?.checkedInAt ?? null,
        excuseReason: record?.excuseReason ?? null,
        registeredBy: record?.registeredBy ?? null,
      };
    });

    log.info({ date, operationId, count: items.length }, "check-ins listed");
    res.json({ checkIns: items });
  } catch (err) {
    log.error({ err }, "Error listing check-ins");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /check-ins/summary — resumo para o painel ───────────────────────────

router.get("/check-ins/summary", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.CHECK_IN, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { date, operationId } = req.query as Record<string, string>;
  if (!date || !operationId) {
    res.status(400).json({ error: "Bad Request", message: "date e operationId são obrigatórios" });
    return;
  }

  try {
    const [expectedUsers, checkInRecords] = await Promise.all([
      getExpectedUsers(operationId, date),
      db
        .select()
        .from(operationalCheckInsTable)
        .where(
          and(
            eq(operationalCheckInsTable.operationId, operationId),
            eq(operationalCheckInsTable.date, date),
          )
        ),
    ]);

    const total = expectedUsers.length;
    const statusMap = new Map(checkInRecords.map((c) => [c.userId, c.status]));

    let checkedIn = 0, late = 0, absent = 0, excused = 0, expected = 0;
    for (const u of expectedUsers) {
      const status = statusMap.get(u.userId!) ?? "EXPECTED";
      if (status === "CHECKED_IN") checkedIn++;
      else if (status === "LATE") late++;
      else if (status === "ABSENT") absent++;
      else if (status === "EXCUSED") excused++;
      else expected++;
    }

    log.info({ date, operationId, total, checkedIn }, "check-in summary");
    res.json({ summary: { total, checkedIn, late, absent, excused, expected } });
  } catch (err) {
    log.error({ err }, "Error fetching check-in summary");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /check-ins/my-status — status do membro hoje ────────────────────────

router.get("/check-ins/my-status", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.CHECK_IN, req.requestId, req.correlationId);
  const userId = req.user!.sub;
  const orgId = req.user!.organizationId;

  const date = (req.query["date"] as string) || new Date().toISOString().slice(0, 10);

  try {
    // Find which operation this user has allocations in today
    const allocRows = await db
      .select({ operationId: scalesTable.operationId })
      .from(scaleAllocationsTable)
      .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
      .innerJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
      .where(
        and(
          eq(scaleAllocationsTable.userId, userId),
          eq(agendaEventsTable.date, date),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
        )
      )
      .limit(1);

    if (allocRows.length === 0) {
      res.json({ status: null, checkIn: null, message: "Sem atividades escaladas para hoje" });
      return;
    }

    const operationId = allocRows[0]!.operationId;

    const existing = await db
      .select()
      .from(operationalCheckInsTable)
      .where(
        and(
          eq(operationalCheckInsTable.userId, userId),
          eq(operationalCheckInsTable.operationId, operationId),
          eq(operationalCheckInsTable.date, date),
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.json({ status: "EXPECTED", checkIn: null, operationId });
      return;
    }

    const record = existing[0]!;
    res.json({
      status: record.status,
      checkIn: {
        id: record.id,
        status: record.status,
        checkedInAt: record.checkedInAt,
        excuseReason: record.excuseReason,
        date: record.date,
        operationId: record.operationId,
      },
      operationId,
    });
  } catch (err) {
    log.error({ err }, "Error fetching my check-in status");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /check-ins/my — membro realiza check-in ────────────────────────────

router.post("/check-ins/my", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.CHECK_IN, req.requestId, req.correlationId);
  const userId = req.user!.sub;
  const orgId = req.user!.organizationId;

  const date = new Date().toISOString().slice(0, 10);
  const nowUTC = new Date();

  try {
    // Find operation + earliest event startTime today
    const allocRows = await db
      .select({
        operationId: scalesTable.operationId,
        startTime: agendaEventsTable.startTime,
      })
      .from(scaleAllocationsTable)
      .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
      .innerJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
      .where(
        and(
          eq(scaleAllocationsTable.userId, userId),
          eq(agendaEventsTable.date, date),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
        )
      )
      .orderBy(asc(agendaEventsTable.startTime))
      .limit(1);

    if (allocRows.length === 0) {
      res.status(400).json({ error: "Bad Request", message: "Nenhuma atividade escalada para hoje" });
      return;
    }

    const { operationId, startTime } = allocRows[0]!;

    // Fetch operation config (orgId + check-in policy)
    const [opRow] = await db
      .select({
        organizationId: operationsTable.organizationId,
        lateThresholdMinutes: operationsTable.lateThresholdMinutes,
        timezone: operationsTable.timezone,
      })
      .from(operationsTable)
      .where(eq(operationsTable.id, operationId))
      .limit(1);

    const resolvedOrgId = opRow?.organizationId ?? orgId;
    const thresholdMinutes = opRow?.lateThresholdMinutes ?? LATE_THRESHOLD_MINUTES_DEFAULT;
    const opTimezone = opRow?.timezone ?? DEFAULT_TIMEZONE;

    // Determine if late using operation's local timezone and configurable threshold
    let status: "CHECKED_IN" | "LATE" = "CHECKED_IN";
    if (startTime) {
      const [h, m] = startTime.split(":").map(Number) as [number, number];
      const eventMinutes = h * 60 + m;
      const localNowMinutes = getLocalMinutes(nowUTC, opTimezone);
      if (localNowMinutes > eventMinutes + thresholdMinutes) {
        status = "LATE";
      }
    }

    // Upsert check-in
    const [record] = await db
      .insert(operationalCheckInsTable)
      .values({
        orgId: resolvedOrgId,
        operationId,
        userId,
        date,
        status,
        checkedInAt: nowUTC,
        registeredBy: userId,
      })
      .onConflictDoUpdate({
        target: [
          operationalCheckInsTable.userId,
          operationalCheckInsTable.operationId,
          operationalCheckInsTable.date,
        ],
        set: {
          status,
          checkedInAt: nowUTC,
          registeredBy: userId,
          updatedAt: nowUTC,
        },
      })
      .returning();

    void writeHistoryEvent({
      category: "CHECK_IN",
      action: status === "LATE" ? "checkin.late" : "checkin.created",
      title: status === "LATE" ? "Check-in registrado com atraso" : "Check-in realizado",
      narrative: `Membro registrou presença${status === "LATE" ? " com atraso" : ""} em ${date}`,
      entityType: "check_in",
      entityId: record!.id,
      actorId: userId,
      operationId,
      orgId: resolvedOrgId,
    });

    log.info({ userId, operationId, status, date }, "member checked in");
    res.status(201).json({
      checkIn: {
        id: record!.id,
        status: record!.status,
        checkedInAt: record!.checkedInAt,
        date: record!.date,
        operationId: record!.operationId,
      },
    });
  } catch (err) {
    log.error({ err }, "Error performing check-in");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /check-ins/:id — supervisor registra presença/ausência/justificativa

router.patch("/check-ins/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.CHECK_IN, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Acesso restrito a supervisores" });
    return;
  }

  const checkInId = req.params["id"] as string;
  const { status, excuseReason, userId, operationId, date } = req.body as {
    status?: string;
    excuseReason?: string;
    userId?: string;
    operationId?: string;
    date?: string;
  };

  const validStatuses = ["CHECKED_IN", "LATE", "ABSENT", "EXCUSED"];

  try {
    const nowUTC = new Date();

    // Upsert pattern: if id is "new", create; otherwise update
    if (checkInId === "new") {
      // Supervisor creating a record for a user who has no check-in yet
      if (!userId || !operationId || !date || !status) {
        res.status(400).json({ error: "Bad Request", message: "userId, operationId, date e status obrigatórios" });
        return;
      }
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Bad Request", message: "Status inválido" });
        return;
      }

      const [opRow] = await db
        .select({ organizationId: operationsTable.organizationId })
        .from(operationsTable)
        .where(eq(operationsTable.id, operationId))
        .limit(1);

      if (!opRow) {
        res.status(404).json({ error: "Not Found", message: "Operação não encontrada" });
        return;
      }

      const [record] = await db
        .insert(operationalCheckInsTable)
        .values({
          orgId: opRow.organizationId,
          operationId,
          userId,
          date,
          status: status as any,
          checkedInAt: ["CHECKED_IN", "LATE"].includes(status) ? nowUTC : null,
          registeredBy: user.sub,
          excuseReason: excuseReason ?? null,
        })
        .onConflictDoUpdate({
          target: [
            operationalCheckInsTable.userId,
            operationalCheckInsTable.operationId,
            operationalCheckInsTable.date,
          ],
          set: {
            status: status as any,
            checkedInAt: ["CHECKED_IN", "LATE"].includes(status) ? nowUTC : null,
            registeredBy: user.sub,
            excuseReason: excuseReason ?? null,
            updatedAt: nowUTC,
          },
        })
        .returning();

      void writeHistoryEvent({
        category: "CHECK_IN",
        action: getHistoryAction(status),
        title: getHistoryTitle(status),
        narrative: `Supervisor registrou status "${status}" para o membro em ${date}`,
        entityType: "check_in",
        entityId: record!.id,
        actorId: user.sub,
        operationId,
        orgId: opRow.organizationId,
      });

      log.info({ checkInId: record!.id, status, registeredBy: user.sub }, "check-in created by supervisor");
      res.json({ checkIn: record });
      return;
    }

    // Update existing record
    const existing = await db
      .select()
      .from(operationalCheckInsTable)
      .where(eq(operationalCheckInsTable.id, checkInId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Not Found", message: "Check-in não encontrado" });
      return;
    }

    const current = existing[0]!;

    const updates: Record<string, unknown> = { updatedAt: nowUTC, registeredBy: user.sub };
    if (status) {
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Bad Request", message: "Status inválido" });
        return;
      }
      updates["status"] = status;
      if (["CHECKED_IN", "LATE"].includes(status) && !current.checkedInAt) {
        updates["checkedInAt"] = nowUTC;
      }
    }
    if (excuseReason !== undefined) updates["excuseReason"] = excuseReason;

    const [updated] = await db
      .update(operationalCheckInsTable)
      .set(updates as any)
      .where(eq(operationalCheckInsTable.id, checkInId))
      .returning();

    void writeHistoryEvent({
      category: "CHECK_IN",
      action: status ? getHistoryAction(status) : "checkin.corrected",
      title: status ? getHistoryTitle(status) : "Check-in corrigido",
      narrative: `Supervisor atualizou check-in para "${status ?? "correção"}" em ${current.date}`,
      entityType: "check_in",
      entityId: checkInId,
      actorId: user.sub,
      operationId: current.operationId,
      orgId: current.orgId,
    });

    log.info({ checkInId, status, registeredBy: user.sub }, "check-in updated by supervisor");
    res.json({ checkIn: updated });
  } catch (err) {
    log.error({ err }, "Error updating check-in");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function getHistoryAction(status: string): string {
  switch (status) {
    case "CHECKED_IN": return "checkin.created";
    case "LATE": return "checkin.late";
    case "ABSENT": return "checkin.absent";
    case "EXCUSED": return "checkin.excused";
    default: return "checkin.corrected";
  }
}

function getHistoryTitle(status: string): string {
  switch (status) {
    case "CHECKED_IN": return "Presença registrada";
    case "LATE": return "Atraso registrado";
    case "ABSENT": return "Ausência registrada";
    case "EXCUSED": return "Ausência justificada";
    default: return "Check-in corrigido";
  }
}

export default router;
