import { Router, type IRouter } from "express";
import { eq, and, inArray, gte, lte, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  agendaEventsTable,
  scalesTable,
  scaleAllocationsTable,
  allocationExceptionsTable,
  dailyBooksTable,
  operationsTable,
  operationalGroupsTable,
  showBookRolesTable,
  operationalCheckInsTable,
  occurrencesTable,
  usersTable,
  userRolesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";
import { canSupervisorAccessPerson } from "../services/area-local-scope.js";

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

type CoverageStatus = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
type HealthStatus = "HEALTHY" | "ATTENTION" | "RISK" | "CRITICAL";

function coverageStatus(pct: number): CoverageStatus {
  if (pct >= 100) return "COMPLETE";
  if (pct >= 60) return "PARTIAL";
  return "INSUFFICIENT";
}

function computeHealth(params: {
  overallPct: number;
  openCount: number;
  conflictCount: number;
  pendingBooksCount: number;
  criticalEventsCount: number; // events in next 48h with no published book
}): { status: HealthStatus; reasons: string[] } {
  const reasons: string[] = [];

  if (params.criticalEventsCount > 0) {
    reasons.push(
      `${params.criticalEventsCount} evento(s) nas próximas 48h sem Livro do Dia publicado`
    );
  }
  if (params.overallPct < 30) {
    reasons.push(`Cobertura geral crítica: ${params.overallPct.toFixed(0)}%`);
  } else if (params.overallPct < 60) {
    reasons.push(`Cobertura insuficiente: ${params.overallPct.toFixed(0)}%`);
  } else if (params.overallPct < 80) {
    reasons.push(`Cobertura parcial: ${params.overallPct.toFixed(0)}%`);
  }
  if (params.conflictCount > 0) {
    reasons.push(`${params.conflictCount} alocação(ões) em conflito`);
  }
  if (params.openCount > 5) {
    reasons.push(`${params.openCount} posições abertas sem candidato`);
  } else if (params.openCount > 0) {
    reasons.push(`${params.openCount} posição(ões) em aberto`);
  }
  if (params.pendingBooksCount > 0) {
    reasons.push(`${params.pendingBooksCount} Livro(s) do Dia não publicado(s)`);
  }

  if (params.criticalEventsCount > 0 || params.overallPct < 30) {
    return { status: "CRITICAL", reasons };
  }
  if (params.overallPct < 60 || params.conflictCount > 3) {
    return { status: "RISK", reasons };
  }
  if (
    params.overallPct < 80 ||
    params.openCount > 0 ||
    params.pendingBooksCount > 0
  ) {
    return { status: "ATTENTION", reasons };
  }

  reasons.push("Todas as operações dentro do esperado");
  return { status: "HEALTHY", reasons };
}

// ─── GET /api/operational-panel ───────────────────────────────────────────────

router.get(
  "/operational-panel",
  requireAuth,
  requireOrganization,
  async (req, res) => {
    const log = requestLogger(LOG_DOMAIN.OPERATIONAL_PANEL, req.requestId, req.correlationId);

    const {
      from: fromParam,
      to: toParam,
      operationId: opIdParam,
      groupId: grpIdParam,
    } = req.query as Record<string, string | undefined>;

    const today = operationalDate();
    const twoWeeks = shiftOperationalDate(today, 14);

    const from = fromParam ?? today;
    const to = toParam ?? twoWeeks;

    try {
      const actor = req.user!;
      const canReadPanel = actor.role === "ADMIN" || actor.role === "DIR" || actor.role === "SUPERVISOR_A" || actor.role === "SUPERVISOR_B";
      if (!canReadPanel) { res.status(403).json({ error: "Forbidden" }); return; }

      const organizationOperations = await db.select({ id: operationsTable.id }).from(operationsTable)
        .where(eq(operationsTable.organizationId, actor.organizationId));
      const organizationOperationIds = organizationOperations.map((operation) => operation.id);
      let allowedOperationIds = organizationOperationIds;
      if (actor.role === "SUPERVISOR_A" || actor.role === "SUPERVISOR_B") {
        const supervisorRoles = await db.select({ operationId: userRolesTable.operationId })
          .from(userRolesTable)
          .where(and(
            eq(userRolesTable.userId, actor.sub),
            eq(userRolesTable.active, true),
            inArray(userRolesTable.role, ["SUPERVISOR_A", "SUPERVISOR_B"] as any),
          ));
        allowedOperationIds = [...new Set(supervisorRoles.map((role) => role.operationId))]
          .filter((id) => organizationOperationIds.includes(id));
      }
      if (opIdParam && !organizationOperationIds.includes(opIdParam)) { res.status(404).json({ error: "Operação não encontrada" }); return; }
      if (opIdParam && !allowedOperationIds.includes(opIdParam)) { res.status(403).json({ error: "Forbidden" }); return; }

      // ── 1. Upcoming agenda events ──────────────────────────────────────────
      const eventConditions: any[] = [
        gte(agendaEventsTable.date, from),
        lte(agendaEventsTable.date, to),
      ];
      if (opIdParam) eventConditions.push(eq(agendaEventsTable.operationId, opIdParam));
      else eventConditions.push(inArray(agendaEventsTable.operationId, allowedOperationIds));
      if (grpIdParam) eventConditions.push(eq(agendaEventsTable.groupId, grpIdParam));

      const events = await db
        .select()
        .from(agendaEventsTable)
        .where(and(...eventConditions));

      const eventIds = events.map((e) => e.id);

      // ── 2. Active scales (PUBLISHED or REPUBLISHED) for those events ───────
      let scales: (typeof scalesTable.$inferSelect)[] = [];
      if (eventIds.length > 0) {
        const scaleConditions: any[] = [
          inArray(scalesTable.agendaEventId, eventIds),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"] as any[]),
        ];
        if (opIdParam) scaleConditions.push(eq(scalesTable.operationId, opIdParam));
        if (grpIdParam) scaleConditions.push(eq(scalesTable.groupId, grpIdParam));

        scales = await db
          .select()
          .from(scalesTable)
          .where(and(...scaleConditions));
      }

      const scaleIds = scales.map((s) => s.id);

      // ── 3. Allocations for those scales ────────────────────────────────────
      let allocations: (typeof scaleAllocationsTable.$inferSelect)[] = [];
      if (scaleIds.length > 0) {
        allocations = await db
          .select()
          .from(scaleAllocationsTable)
          .where(and(inArray(scaleAllocationsTable.scaleId, scaleIds), eq(scaleAllocationsTable.active, true)));
      }

      // ── 4. Exceptions (unresolved) for those scales ────────────────────────
      let rawExceptions: (typeof allocationExceptionsTable.$inferSelect)[] = [];
      if (scaleIds.length > 0) {
        rawExceptions = await db
          .select()
          .from(allocationExceptionsTable)
          .where(
            and(
              inArray(allocationExceptionsTable.scaleId, scaleIds),
              isNull(allocationExceptionsTable.resolvedAt),
              eq(allocationExceptionsTable.active, true)
            )
          );
      }

      // ── 5. Daily books for those events ────────────────────────────────────
      let dailyBooks: (typeof dailyBooksTable.$inferSelect)[] = [];
      if (eventIds.length > 0) {
        dailyBooks = await db
          .select()
          .from(dailyBooksTable)
          .where(inArray(dailyBooksTable.agendaEventId, eventIds));
      }

      // ── 6. Groups & Operations for display names ───────────────────────────
      const groupIds = [
        ...new Set([
          ...scales.map((s) => s.groupId).filter(Boolean) as string[],
          ...events.map((e) => e.groupId).filter(Boolean) as string[],
        ]),
      ];
      const [groups, operations] = await Promise.all([
        groupIds.length > 0
          ? db
              .select()
              .from(operationalGroupsTable)
              .where(inArray(operationalGroupsTable.id, groupIds))
          : Promise.resolve([] as (typeof operationalGroupsTable.$inferSelect)[]),
        opIdParam
          ? db.select().from(operationsTable).where(and(eq(operationsTable.id, opIdParam), eq(operationsTable.organizationId, actor.organizationId)))
          : db.select().from(operationsTable).where(inArray(operationsTable.id, allowedOperationIds)),
      ]);

      // ── 7. Position names for exceptions ──────────────────────────────────
      const positionIds = [
        ...new Set(rawExceptions.map((e) => e.positionId).filter(Boolean) as string[]),
      ];
      let positions: { id: string; name: string | null }[] = [];
      if (positionIds.length > 0) {
        positions = await db
          .select({ id: showBookRolesTable.id, name: showBookRolesTable.name })
          .from(showBookRolesTable)
          .where(inArray(showBookRolesTable.id, positionIds));
      }

      // ── 8. Build lookup maps ───────────────────────────────────────────────
      const groupMap = new Map(groups.map((g) => [g.id, g.name]));
      const eventMap = new Map(events.map((e) => [e.id, e]));
      const scaleMap = new Map(scales.map((s) => [s.id, s]));
      const positionMap = new Map(positions.map((p) => [p.id, p.name ?? "—"]));

      // ── 9. Coverage computation ────────────────────────────────────────────
      // By event
      const coverageByEventId = new Map<
        string,
        { total: number; covered: number }
      >();
      for (const alloc of allocations) {
        const scale = scaleMap.get(alloc.scaleId);
        if (!scale?.agendaEventId) continue;
        const eid = scale.agendaEventId;
        const cur = coverageByEventId.get(eid) ?? { total: 0, covered: 0 };
        cur.total += 1;
        if (alloc.status === "ASSIGNED") cur.covered += 1;
        coverageByEventId.set(eid, cur);
      }

      // By group
      const coverageByGroupId = new Map<
        string,
        { total: number; covered: number; groupName: string }
      >();
      for (const alloc of allocations) {
        const scale = scaleMap.get(alloc.scaleId);
        if (!scale?.groupId) continue;
        const gid = scale.groupId;
        const cur = coverageByGroupId.get(gid) ?? {
          total: 0,
          covered: 0,
          groupName: groupMap.get(gid) ?? "—",
        };
        cur.total += 1;
        if (alloc.status === "ASSIGNED") cur.covered += 1;
        coverageByGroupId.set(gid, cur);
      }

      const totalAllocs = allocations.length;
      const totalCovered = allocations.filter((a) => a.status === "ASSIGNED").length;
      const overallPct = totalAllocs > 0 ? (totalCovered / totalAllocs) * 100 : 100;

      const coverage = {
        overall: {
          total: totalAllocs,
          covered: totalCovered,
          pct: parseFloat(overallPct.toFixed(1)),
          status: coverageStatus(overallPct),
        },
        byGroup: [...coverageByGroupId.entries()].map(([groupId, v]) => {
          const pct = v.total > 0 ? (v.covered / v.total) * 100 : 100;
          return {
            groupId,
            groupName: v.groupName,
            total: v.total,
            covered: v.covered,
            pct: parseFloat(pct.toFixed(1)),
            status: coverageStatus(pct),
          };
        }),
        byEvent: [...coverageByEventId.entries()].map(([eventId, v]) => {
          const ev = eventMap.get(eventId);
          const pct = v.total > 0 ? (v.covered / v.total) * 100 : 100;
          return {
            eventId,
            eventTitle: ev?.title ?? "—",
            eventDate: ev?.date ?? "—",
            total: v.total,
            covered: v.covered,
            pct: parseFloat(pct.toFixed(1)),
            status: coverageStatus(pct),
          };
        }),
      };

      // ── 10. Consolidated exceptions ────────────────────────────────────────
      const exceptions: object[] = [];

      // From allocationExceptionsTable
      for (const ex of rawExceptions) {
        const scale = scaleMap.get(ex.scaleId);
        const ev = ex.agendaEventId ? eventMap.get(ex.agendaEventId) : null;
        exceptions.push({
          id: ex.id,
          type: "ALLOCATION_EXCEPTION",
          reason: "Exceção de alocação pendente de análise",
          impact: null,
          date: ev?.date ?? scale?.periodStart ?? "—",
          origin: scale?.title ?? "—",
          scaleTitle: scale?.title ?? null,
          positionName: ex.positionId ? (positionMap.get(ex.positionId) ?? null) : null,
          eventTitle: ev?.title ?? null,
          operationId: scale?.operationId ?? "",
        });
      }

      // From open/conflict allocations
      for (const alloc of allocations) {
        if (alloc.status !== "OPEN" && alloc.status !== "CONFLICT" && alloc.status !== "MANUAL_OVERRIDE") continue;
        const scale = scaleMap.get(alloc.scaleId);
        const ev = alloc.agendaEventId ? eventMap.get(alloc.agendaEventId) : null;
        const typeMap: Record<string, string> = {
          OPEN: "OPEN_POSITION",
          CONFLICT: "CONFLICT",
          MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
        };
        const reasonMap: Record<string, string> = {
          OPEN: "Posição sem candidato alocado",
          CONFLICT: "Conflito de alocação detectado",
          MANUAL_OVERRIDE: "Substituição manual aplicada",
        };
        exceptions.push({
          id: alloc.id,
          type: typeMap[alloc.status],
          reason: reasonMap[alloc.status] ?? alloc.status,
          impact: null,
          date: ev?.date ?? scale?.periodStart ?? "—",
          origin: scale?.title ?? "—",
          scaleTitle: scale?.title ?? null,
          positionName: alloc.positionId ? (positionMap.get(alloc.positionId) ?? null) : null,
          eventTitle: ev?.title ?? null,
          operationId: scale?.operationId ?? "",
        });
      }

      // ── 11. Pending books ──────────────────────────────────────────────────
      const dailyBookByEventId = new Map(dailyBooks.map((b) => [b.agendaEventId, b]));
      const pendingBooks = dailyBooks
        .filter((b) => b.status === "DRAFT")
        .map((b) => {
          const ev = eventMap.get(b.agendaEventId);
          return {
            id: b.id,
            eventTitle: ev?.title ?? "—",
            eventDate: ev?.date ?? "—",
            status: b.status,
            version: b.version,
            operationId: ev?.operationId ?? "",
            scaleId: b.scaleId ?? null,
          };
        });

      // ── 12. Upcoming events enriched ──────────────────────────────────────
      const h48 = shiftOperationalDate(today, 2);

      const upcomingEvents = events
        .filter((e) => e.status !== "CANCELLED" && e.status !== "COMPLETED")
        .map((e) => {
          const scale = scales.find((s) => s.agendaEventId === e.id);
          const book = dailyBookByEventId.get(e.id);
          const covData = coverageByEventId.get(e.id);
          return {
            id: e.id,
            title: e.title,
            type: e.type,
            date: e.date,
            startTime: e.startTime ?? null,
            endTime: e.endTime ?? null,
            status: e.status,
            operationId: e.operationId,
            hasScale: !!scale,
            hasDailyBook: !!book && book.status !== "DRAFT",
            coveragePct: covData
              ? parseFloat(((covData.covered / covData.total) * 100).toFixed(1))
              : null,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      // ── 13. Health computation ─────────────────────────────────────────────
      const criticalEventsCount = upcomingEvents.filter(
        (e) => e.date <= h48 && !e.hasDailyBook
      ).length;

      const openCount = allocations.filter((a) => a.status === "OPEN").length;
      const conflictCount = allocations.filter((a) => a.status === "CONFLICT").length;

      const health = computeHealth({
        overallPct,
        openCount,
        conflictCount,
        pendingBooksCount: pendingBooks.length,
        criticalEventsCount,
      });

      // ── 14. Check-ins e ocorrências: agregados, sem nomes ou motivos ───────
      const checkInRows = allowedOperationIds.length === 0 ? [] : await db
        .select({ status: operationalCheckInsTable.status, personId: operationalCheckInsTable.userId })
        .from(operationalCheckInsTable)
        .where(and(
          eq(operationalCheckInsTable.orgId, actor.organizationId),
          inArray(operationalCheckInsTable.operationId, opIdParam ? [opIdParam] : allowedOperationIds),
          gte(operationalCheckInsTable.date, from),
          lte(operationalCheckInsTable.date, to),
        ));
      const checkIns = [] as typeof checkInRows;
      for (const row of checkInRows) {
        if (actor.role === "ADMIN" || actor.role === "DIR" || await canSupervisorAccessPerson({
          supervisorId: actor.sub, organizationId: actor.organizationId, personId: row.personId,
        })) checkIns.push(row);
      }
      const checkInSummary = {
        total: checkIns.length,
        expected: checkIns.filter((entry) => entry.status === "EXPECTED").length,
        checkedIn: checkIns.filter((entry) => entry.status === "CHECKED_IN").length,
        late: checkIns.filter((entry) => entry.status === "LATE").length,
        absent: checkIns.filter((entry) => entry.status === "ABSENT").length,
        excused: checkIns.filter((entry) => entry.status === "EXCUSED").length,
      };
      const occurrenceRows = await db
        .select({ occurrence: { personId: occurrencesTable.personId, state: occurrencesTable.state } })
        .from(occurrencesTable)
        .innerJoin(usersTable, eq(occurrencesTable.personId, usersTable.id))
        .where(and(
          eq(usersTable.organizationId, actor.organizationId),
          eq(occurrencesTable.active, true),
          gte(occurrencesTable.date, from),
          lte(occurrencesTable.date, to),
        ));
      const visibleOccurrences = [] as typeof occurrenceRows;
      for (const row of occurrenceRows) {
        if (actor.role === "ADMIN" || actor.role === "DIR" || await canSupervisorAccessPerson({
          supervisorId: actor.sub, organizationId: actor.organizationId, personId: row.occurrence.personId,
        })) visibleOccurrences.push(row);
      }
      const occurrenceSummary = {
        total: visibleOccurrences.length,
        aberta: visibleOccurrences.filter((row) => row.occurrence.state === "aberta").length,
        emAnalise: visibleOccurrences.filter((row) => row.occurrence.state === "em_analise").length,
        resolvida: visibleOccurrences.filter((row) => row.occurrence.state === "resolvida").length,
      };

      // ── 15. Response ───────────────────────────────────────────────────────
      res.json({
        generatedAt: new Date().toISOString(),
        health,
        coverage,
        exceptions,
        pendingBooks,
        upcomingEvents,
        checkIns: checkInSummary,
        occurrences: occurrenceSummary,
      });
    } catch (err) {
      log.error({ err }, "erro ao montar painel operacional");
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

export default router;
