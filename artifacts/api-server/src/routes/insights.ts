import { Router, type IRouter } from "express";
import { eq, and, inArray, gte, lte, isNotNull, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  operationalCheckInsTable,
  tasksTable,
  requestsTable,
  requestDecisionsTable,
  noticesTable,
  noticeRecipientsTable,
  noticeEscalationsTable,
  libraryDocumentsTable,
  libraryCategoriesTable,
  operationsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Period helpers ───────────────────────────────────────────────────────────

function periodDateStrings(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  if (period === "today") return { startDate: todayStr, endDate: todayStr };
  const days = period === "7d" ? 7 : 30;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return { startDate: d.toISOString().split("T")[0], endDate: todayStr };
}

function periodTimestamps(period: string): { startTs: Date; endTs: Date } {
  const now = new Date();
  const endTs = new Date(now); endTs.setHours(23, 59, 59, 999);
  const days = period === "today" ? 0 : period === "7d" ? 7 : 30;
  const startTs = new Date(now);
  startTs.setDate(startTs.getDate() - days);
  startTs.setHours(0, 0, 0, 0);
  return { startTs, endTs };
}

async function getOrgOperationIds(organizationId: string): Promise<{ id: string; name: string }[]> {
  return db.select({ id: operationsTable.id, name: operationsTable.name })
    .from(operationsTable)
    .where(eq(operationsTable.organizationId, organizationId));
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

// ─── GET /insights/check-ins ─────────────────────────────────────────────────

router.get("/insights/check-ins", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { period = "7d", operationId } = req.query as Record<string, string>;
  const { startDate, endDate } = periodDateStrings(period);

  try {
    let opIds: { id: string; name: string }[];
    if (operationId) {
      const op = await db.select({ id: operationsTable.id, name: operationsTable.name })
        .from(operationsTable).where(eq(operationsTable.id, operationId));
      opIds = op;
    } else if (user.role === "ADMIN") {
      opIds = await getOrgOperationIds(user.organizationId);
    } else {
      const ids = (user as any).operationIds as string[] ?? [];
      opIds = ids.length > 0
        ? await db.select({ id: operationsTable.id, name: operationsTable.name })
            .from(operationsTable).where(inArray(operationsTable.id, ids))
        : [];
    }

    const opIdList = opIds.map(o => o.id);
    if (opIdList.length === 0) {
      res.json({ period, total: 0, checkedIn: 0, late: 0, absent: 0, excused: 0, expected: 0, rates: { presence: 0, late: 0, absence: 0, excused: 0 }, byOperation: [] });
      return;
    }

    const records = await db.select({
      status: operationalCheckInsTable.status,
      operationId: operationalCheckInsTable.operationId,
    }).from(operationalCheckInsTable)
      .where(and(
        inArray(operationalCheckInsTable.operationId, opIdList),
        gte(operationalCheckInsTable.date, startDate),
        lte(operationalCheckInsTable.date, endDate),
      ));

    const counts = { CHECKED_IN: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, EXPECTED: 0 };
    const byOp = new Map<string, typeof counts>();
    opIdList.forEach(id => byOp.set(id, { CHECKED_IN: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, EXPECTED: 0 }));

    for (const r of records) {
      const s = r.status as keyof typeof counts;
      if (s in counts) {
        counts[s]++;
        const opC = byOp.get(r.operationId!);
        if (opC) opC[s]++;
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const resolved = total - counts.EXPECTED;
    const byOperation = opIds.map(op => {
      const c = byOp.get(op.id) ?? { CHECKED_IN: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, EXPECTED: 0 };
      const t = Object.values(c).reduce((a, b) => a + b, 0);
      const r = t - c.EXPECTED;
      return { operationId: op.id, operationName: op.name, total: t, checkedIn: c.CHECKED_IN, late: c.LATE, absent: c.ABSENT, excused: c.EXCUSED, presenceRate: pct(c.CHECKED_IN, r) };
    });

    res.json({
      period, total, checkedIn: counts.CHECKED_IN, late: counts.LATE,
      absent: counts.ABSENT, excused: counts.EXCUSED, expected: counts.EXPECTED,
      rates: { presence: pct(counts.CHECKED_IN, resolved), late: pct(counts.LATE, resolved), absence: pct(counts.ABSENT, resolved), excused: pct(counts.EXCUSED, resolved) },
      byOperation,
    });
  } catch (err) {
    console.error("[insights/check-ins]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /insights/requests ───────────────────────────────────────────────────

router.get("/insights/requests", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { period = "30d", operationId } = req.query as Record<string, string>;
  const { startTs } = periodTimestamps(period);

  try {
    const conditions = [gte(requestsTable.createdAt, startTs)];
    if (operationId) {
      conditions.push(eq(requestsTable.operationId, operationId));
    } else if (user.role === "ADMIN") {
      const opIds = await getOrgOperationIds(user.organizationId);
      if (opIds.length > 0) conditions.push(inArray(requestsTable.operationId, opIds.map(o => o.id)));
      else { res.json({ total: 0, byStatus: {}, byType: {}, avgResponseHours: null }); return; }
    } else {
      const ids = (user as any).operationIds as string[] ?? [];
      if (ids.length > 0) conditions.push(inArray(requestsTable.operationId, ids));
      else { res.json({ total: 0, byStatus: {}, byType: {}, avgResponseHours: null }); return; }
    }

    const reqs = await db.select({
      id: requestsTable.id,
      type: requestsTable.type,
      status: requestsTable.status,
      createdAt: requestsTable.createdAt,
    }).from(requestsTable).where(and(...conditions));

    const reqIds = reqs.map(r => r.id);
    let avgResponseHours: number | null = null;

    if (reqIds.length > 0) {
      const decisions = await db.select({
        requestId: requestDecisionsTable.requestId,
        createdAt: requestDecisionsTable.createdAt,
      }).from(requestDecisionsTable).where(inArray(requestDecisionsTable.requestId, reqIds));

      const decisionMap = new Map(decisions.map(d => [d.requestId, d.createdAt]));
      const responseTimes: number[] = [];
      for (const r of reqs) {
        const dc = decisionMap.get(r.id);
        if (dc && r.createdAt) {
          responseTimes.push((dc.getTime() - r.createdAt.getTime()) / 3600000);
        }
      }
      if (responseTimes.length > 0) {
        avgResponseHours = Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10;
      }
    }

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const r of reqs) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byType[r.type] = (byType[r.type] ?? 0) + 1;
    }

    res.json({ total: reqs.length, byStatus, byType, avgResponseHours });
  } catch (err) {
    console.error("[insights/requests]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /insights/tasks ──────────────────────────────────────────────────────

router.get("/insights/tasks", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { period = "30d", operationId } = req.query as Record<string, string>;
  const { startTs } = periodTimestamps(period);
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const conditions = [gte(tasksTable.createdAt, startTs)];
    if (operationId) {
      conditions.push(eq(tasksTable.operationId, operationId));
    } else if (user.role === "ADMIN") {
      conditions.push(eq(tasksTable.organizationId, user.organizationId));
    } else {
      const ids = (user as any).operationIds as string[] ?? [];
      if (ids.length > 0) conditions.push(inArray(tasksTable.operationId, ids));
      else { res.json({ total: 0, byStatus: {}, overdue: 0, avgCompletionHours: null, approvalRate: null, reworkRate: null }); return; }
    }

    const tasks = await db.select({
      status: tasksTable.status,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      completedAt: tasksTable.completedAt,
    }).from(tasksTable).where(and(...conditions));

    const byStatus: Record<string, number> = {};
    const ACTIVE_STATUSES = ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"];
    const DONE_STATUSES = ["APPROVED", "COMPLETED"];
    let overdue = 0, completionSum = 0, completionCount = 0, changesRequested = 0, approved = 0, totalProcessed = 0;

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (ACTIVE_STATUSES.includes(t.status) && t.dueDate < todayStr) overdue++;
      if (DONE_STATUSES.includes(t.status) && t.completedAt && t.createdAt) {
        completionSum += (t.completedAt.getTime() - t.createdAt.getTime()) / 3600000;
        completionCount++;
      }
      if (t.status === "CHANGES_REQUESTED") changesRequested++;
      if (DONE_STATUSES.includes(t.status)) { approved++; totalProcessed++; }
      if (["CANCELLED", "EXPIRED", "CHANGES_REQUESTED"].includes(t.status)) totalProcessed++;
    }

    const avgCompletionHours = completionCount > 0
      ? Math.round((completionSum / completionCount) * 10) / 10 : null;
    const approvalRate = totalProcessed > 0 ? pct(approved, totalProcessed) : null;
    const reworkRate = totalProcessed > 0 ? pct(changesRequested, totalProcessed) : null;

    res.json({ total: tasks.length, byStatus, overdue, avgCompletionHours, approvalRate, reworkRate });
  } catch (err) {
    console.error("[insights/tasks]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /insights/workload ───────────────────────────────────────────────────

router.get("/insights/workload", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { operationId } = req.query as Record<string, string>;
  const todayStr = new Date().toISOString().split("T")[0];
  const ACTIVE_STATUSES = ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"] as const;

  try {
    const taskConds: ReturnType<typeof eq>[] = [];
    const reqConds: ReturnType<typeof eq>[] = [];

    if (operationId) {
      taskConds.push(eq(tasksTable.operationId, operationId));
      reqConds.push(eq(requestsTable.operationId, operationId));
    } else if (user.role === "ADMIN") {
      taskConds.push(eq(tasksTable.organizationId, user.organizationId));
      const opIds = await getOrgOperationIds(user.organizationId);
      if (opIds.length > 0) reqConds.push(inArray(requestsTable.operationId, opIds.map(o => o.id)));
    } else {
      const ids = (user as any).operationIds as string[] ?? [];
      if (ids.length > 0) {
        taskConds.push(inArray(tasksTable.operationId, ids));
        reqConds.push(inArray(requestsTable.operationId, ids));
      }
    }

    const [activeTasks, pendingReqs, allUsers] = await Promise.all([
      db.select({
        assigneeId: tasksTable.assigneeId,
        status: tasksTable.status,
        dueDate: tasksTable.dueDate,
      }).from(tasksTable).where(and(inArray(tasksTable.status, ACTIVE_STATUSES), ...taskConds)),

      db.select({
        requesterId: requestsTable.requesterId,
      }).from(requestsTable).where(and(eq(requestsTable.status, "PENDING"), ...reqConds)),

      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable),
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u.name]));
    const byAssignee = new Map<string, { openTasks: number; overdueTasks: number; pendingRequests: number }>();

    for (const t of activeTasks) {
      if (!t.assigneeId) continue;
      const entry = byAssignee.get(t.assigneeId) ?? { openTasks: 0, overdueTasks: 0, pendingRequests: 0 };
      entry.openTasks++;
      if (t.dueDate < todayStr) entry.overdueTasks++;
      byAssignee.set(t.assigneeId, entry);
    }
    for (const r of pendingReqs) {
      const entry = byAssignee.get(r.requesterId) ?? { openTasks: 0, overdueTasks: 0, pendingRequests: 0 };
      entry.pendingRequests++;
      byAssignee.set(r.requesterId, entry);
    }

    const result = Array.from(byAssignee.entries()).map(([id, data]) => ({
      assigneeId: id,
      assigneeName: userMap.get(id) ?? "—",
      ...data,
    })).sort((a, b) => (b.overdueTasks + b.openTasks) - (a.overdueTasks + a.openTasks));

    res.json({ byAssignee: result });
  } catch (err) {
    console.error("[insights/workload]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /insights/notices ────────────────────────────────────────────────────

router.get("/insights/notices", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { period = "30d", operationId } = req.query as Record<string, string>;
  const { startTs } = periodTimestamps(period);

  try {
    const noticeConds = [gte(noticesTable.createdAt, startTs), ne(noticesTable.status, "DRAFT")];
    if (operationId) {
      noticeConds.push(eq(noticesTable.operationId, operationId));
    } else if (user.role === "ADMIN") {
      const opIds = await getOrgOperationIds(user.organizationId);
      if (opIds.length > 0) noticeConds.push(inArray(noticesTable.operationId, opIds.map(o => o.id)));
      else { res.json({ total: 0, requiresConfirmation: 0, confirmationRate: 0, viewed: 0, ignored: 0, escalated: 0, avgConfirmationHours: null }); return; }
    } else {
      const ids = (user as any).operationIds as string[] ?? [];
      if (ids.length > 0) noticeConds.push(inArray(noticesTable.operationId, ids));
      else { res.json({ total: 0, requiresConfirmation: 0, confirmationRate: 0, viewed: 0, ignored: 0, escalated: 0, avgConfirmationHours: null }); return; }
    }

    const notices = await db.select({
      id: noticesTable.id,
      requiresConfirmation: noticesTable.requiresConfirmation,
      publishedAt: noticesTable.publishedAt,
    }).from(noticesTable).where(and(...noticeConds));

    const noticeIds = notices.map(n => n.id);
    let recipients: { noticeId: string; status: string; confirmedAt: Date | null }[] = [];
    let escalations: { noticeId: string }[] = [];

    if (noticeIds.length > 0) {
      [recipients, escalations] = await Promise.all([
        db.select({
          noticeId: noticeRecipientsTable.noticeId,
          status: noticeRecipientsTable.status,
          confirmedAt: noticeRecipientsTable.confirmedAt,
        }).from(noticeRecipientsTable).where(inArray(noticeRecipientsTable.noticeId, noticeIds)),

        db.select({ noticeId: noticeEscalationsTable.noticeId })
          .from(noticeEscalationsTable).where(inArray(noticeEscalationsTable.noticeId, noticeIds)),
      ]);
    }

    const requiresConfirmation = notices.filter(n => n.requiresConfirmation).length;
    let confirmed = 0, viewed = 0, ignored = 0;
    const confirmTimes: number[] = [];
    const noticePublishedMap = new Map(notices.map(n => [n.id, n.publishedAt]));

    for (const r of recipients) {
      if (r.status === "CONFIRMED") {
        confirmed++;
        const pub = noticePublishedMap.get(r.noticeId);
        if (pub && r.confirmedAt) confirmTimes.push((r.confirmedAt.getTime() - pub.getTime()) / 3600000);
      } else if (r.status === "VIEWED") viewed++;
      else if (r.status === "PENDING") ignored++;
    }

    const confRecipients = recipients.filter(r => {
      const n = notices.find(n => n.id === r.noticeId);
      return n?.requiresConfirmation;
    });
    const confirmationRate = confRecipients.length > 0 ? pct(confirmed, confRecipients.length) : 0;
    const avgConfirmationHours = confirmTimes.length > 0
      ? Math.round((confirmTimes.reduce((a, b) => a + b, 0) / confirmTimes.length) * 10) / 10 : null;

    res.json({
      total: notices.length, requiresConfirmation, confirmationRate,
      viewed, ignored, escalated: new Set(escalations.map(e => e.noticeId)).size,
      avgConfirmationHours,
    });
  } catch (err) {
    console.error("[insights/notices]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /insights/library ────────────────────────────────────────────────────

router.get("/insights/library", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const [docs, cats] = await Promise.all([
      db.select({
        id: libraryDocumentsTable.id,
        status: libraryDocumentsTable.status,
        categoryId: libraryDocumentsTable.categoryId,
      }).from(libraryDocumentsTable).where(eq(libraryDocumentsTable.orgId, user.organizationId)),

      db.select({ id: libraryCategoriesTable.id, name: libraryCategoriesTable.name })
        .from(libraryCategoriesTable).where(eq(libraryCategoriesTable.orgId, user.organizationId)),
    ]);

    const byStatus: Record<string, number> = {};
    const byCategoryId: Record<string, number> = {};
    for (const d of docs) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      if (d.categoryId) byCategoryId[d.categoryId] = (byCategoryId[d.categoryId] ?? 0) + 1;
    }

    const byCategory = cats.map(c => ({ categoryId: c.id, categoryName: c.name, docCount: byCategoryId[c.id] ?? 0 }))
      .sort((a, b) => b.docCount - a.docCount);

    res.json({ totalDocs: docs.length, byStatus, byCategory });
  } catch (err) {
    console.error("[insights/library]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /insights/trends ─────────────────────────────────────────────────────

router.get("/insights/trends", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { operationId } = req.query as Record<string, string>;
  const now = new Date();

  try {
    let opIds: string[] = [];
    if (operationId) {
      opIds = [operationId];
    } else if (user.role === "ADMIN") {
      const ops = await getOrgOperationIds(user.organizationId);
      opIds = ops.map(o => o.id);
    } else {
      opIds = (user as any).operationIds as string[] ?? [];
    }

    const trendStart = new Date(now);
    trendStart.setDate(trendStart.getDate() - 56);
    trendStart.setHours(0, 0, 0, 0);
    const trendStartDate = trendStart.toISOString().split("T")[0];

    const [checkIns, tasks, requests] = await Promise.all([
      opIds.length > 0
        ? db.select({ date: operationalCheckInsTable.date, status: operationalCheckInsTable.status })
            .from(operationalCheckInsTable)
            .where(and(inArray(operationalCheckInsTable.operationId, opIds), gte(operationalCheckInsTable.date, trendStartDate)))
        : Promise.resolve([]),
      (user.role === "ADMIN"
        ? db.select({ createdAt: tasksTable.createdAt, status: tasksTable.status })
            .from(tasksTable).where(and(eq(tasksTable.organizationId, user.organizationId), gte(tasksTable.createdAt, trendStart)))
        : opIds.length > 0
          ? db.select({ createdAt: tasksTable.createdAt, status: tasksTable.status })
              .from(tasksTable).where(and(inArray(tasksTable.operationId, opIds), gte(tasksTable.createdAt, trendStart)))
          : Promise.resolve([])),
      opIds.length > 0
        ? db.select({ createdAt: requestsTable.createdAt, status: requestsTable.status })
            .from(requestsTable).where(and(inArray(requestsTable.operationId, opIds), gte(requestsTable.createdAt, trendStart)))
        : Promise.resolve([]),
    ]);

    function getISOWeek(d: Date): string {
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-S${String(weekNum).padStart(2, "0")}`;
    }

    function weekLabel(weekKey: string): string {
      return weekKey;
    }

    const weeklyMap = new Map<string, { label: string; checkInsPresent: number; checkInsTotal: number; tasksCreated: number; tasksCompleted: number; requestsTotal: number; requestsApproved: number }>();

    const addWeek = (key: string) => {
      if (!weeklyMap.has(key)) weeklyMap.set(key, { label: weekLabel(key), checkInsPresent: 0, checkInsTotal: 0, tasksCreated: 0, tasksCompleted: 0, requestsTotal: 0, requestsApproved: 0 });
    };

    for (const c of checkIns) {
      const d = new Date(c.date + "T12:00:00");
      const w = getISOWeek(d);
      addWeek(w);
      const entry = weeklyMap.get(w)!;
      entry.checkInsTotal++;
      if (c.status === "CHECKED_IN" || c.status === "LATE") entry.checkInsPresent++;
    }
    for (const t of tasks) {
      if (!t.createdAt) continue;
      const w = getISOWeek(t.createdAt);
      addWeek(w);
      const entry = weeklyMap.get(w)!;
      entry.tasksCreated++;
      if (t.status === "APPROVED" || t.status === "COMPLETED") entry.tasksCompleted++;
    }
    for (const r of requests) {
      if (!r.createdAt) continue;
      const w = getISOWeek(r.createdAt);
      addWeek(w);
      const entry = weeklyMap.get(w)!;
      entry.requestsTotal++;
      if (r.status === "APPROVED" || r.status === "ALTERNATIVE_ACCEPTED") entry.requestsApproved++;
    }

    const weekly = Array.from(weeklyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        ...data,
        presenceRate: pct(data.checkInsPresent, data.checkInsTotal),
      }));

    res.json({ weekly });
  } catch (err) {
    console.error("[insights/trends]", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
