import { eq, and, inArray, gte, lte, isNotNull, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scaleAllocationsTable,
  allocationCandidatesTable,
  agendaEventsTable,
  agendaEventParticipantsTable,
  showBookRolesTable,
  showBooksTable,
  dailyBooksTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
  usersTable,
  userRolesTable,
  recurringActivitiesTable,
  recurringActivityAssigneesTable,
} from "@workspace/db";
import { loadGroupMembers } from "../routes/groups.js";
import { getNonSchedulableUserIds } from "./scheduling-eligibility.js";

/**
 * Dados mínimos da escala necessários para compor as alocações.
 */
export interface ScaleForMerge {
  id: string;
  operationId: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Resolve TODAS as linhas da escala em tempo de leitura — alocações reais +
 * fontes virtuais (Fases 1–4):
 *   • Fase 1: cast do Livro do Dia publicado (isDailyBookParticipant)
 *   • Fase 2: blocos do show vêm dentro do cast do Livro do Dia (label/hora do bloco)
 *   • Fase 3: atividades recorrentes/avulsas (isRecurringActivity)
 *   • Fase 4: participantes de eventos da agenda (isAgendaParticipant)
 *
 * Esta é a MESMA composição usada pelo endpoint GET /api/scales/:id/allocations,
 * partilhada para que a ASA enxergue a escala exatamente como o ecrã. Nada é
 * gravado no banco — é puramente leitura/composição (prod-safe, sem mudar esquema).
 */
export async function resolveScaleAllocations(scale: ScaleForMerge) {
  const allocations = await db
    .select({
      id: scaleAllocationsTable.id,
      agendaEventId: scaleAllocationsTable.agendaEventId,
      positionId: scaleAllocationsTable.positionId,
      userId: scaleAllocationsTable.userId,
      status: scaleAllocationsTable.status,
      overrideReason: scaleAllocationsTable.overrideReason,
      notes: scaleAllocationsTable.notes,
      manualDate: scaleAllocationsTable.manualDate,
      manualLabel: scaleAllocationsTable.manualLabel,
      startTime: scaleAllocationsTable.startTime,
      endTime: scaleAllocationsTable.endTime,
      positionName: showBookRolesTable.name,
      userName: usersTable.name,
      eventDate: agendaEventsTable.date,
      eventTitle: agendaEventsTable.title,
      eventStartTime: agendaEventsTable.startTime,
      eventEndTime: agendaEventsTable.endTime,
    })
    .from(scaleAllocationsTable)
    .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
    .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
    .leftJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
    .where(eq(scaleAllocationsTable.scaleId, scale.id));

  // Fetch candidates per allocation
  const allocationIds = allocations.map((a) => a.id);
  const candidates =
    allocationIds.length > 0
      ? await db
          .select({
            id: allocationCandidatesTable.id,
            allocationId: allocationCandidatesTable.allocationId,
            userId: allocationCandidatesTable.userId,
            rank: allocationCandidatesTable.rank,
            eligible: allocationCandidatesTable.eligible,
            compatible: allocationCandidatesTable.compatible,
            priorityScore: allocationCandidatesTable.priorityScore,
            rejectionReason: allocationCandidatesTable.rejectionReason,
            candidateData: allocationCandidatesTable.candidateData,
            userName: usersTable.name,
          })
          .from(allocationCandidatesTable)
          .leftJoin(usersTable, eq(allocationCandidatesTable.userId, usersTable.id))
          .where(inArray(allocationCandidatesTable.allocationId, allocationIds))
      : [];

  // Administradores e membros especiais não fazem parte do elenco escalável.
  const nonSchedulable = await getNonSchedulableUserIds([
    ...allocations.map((a) => a.userId),
    ...candidates.map((c) => c.userId),
  ]);

  const candidateMap: Record<string, typeof candidates> = {};
  candidates.forEach((c) => {
    if (c.userId && nonSchedulable.has(c.userId)) return;
    if (!candidateMap[c.allocationId]) candidateMap[c.allocationId] = [];
    candidateMap[c.allocationId]!.push(c);
  });

  const allocationsWithCandidates = allocations
    .filter((a) => !(a.userId && nonSchedulable.has(a.userId)))
    .map((a) => ({
      ...a,
      candidates: (candidateMap[a.id] ?? []).sort((x, y) => x.rank - y.rank),
    }));

  // Membros válidos da operação da escala (defesa em profundidade).
  const opMemberRows = await db
    .select({ userId: userRolesTable.userId })
    .from(userRolesTable)
    .where(
      and(
        eq(userRolesTable.operationId, scale.operationId),
        eq(userRolesTable.active, true),
      ),
    );
  const opMemberIds = new Set(opMemberRows.map((r) => r.userId));

  // Dedup: chaves de alocações REAIS já existentes.
  const realKeys = new Set(
    allocationsWithCandidates.map(
      (a) => `${a.userId}|${a.manualDate ?? a.eventDate}|${a.positionId ?? ""}`,
    ),
  );
  const realAgendaKeys = new Set(
    allocationsWithCandidates
      .filter((a) => a.agendaEventId && a.userId)
      .map((a) => `${a.userId}|${a.agendaEventId}`),
  );

  // Fase 4 — participantes escolhidos diretamente no evento da agenda.
  const agendaParticipants = await db
    .select({
      eventId: agendaEventsTable.id,
      eventDate: agendaEventsTable.date,
      eventTitle: agendaEventsTable.title,
      eventStartTime: agendaEventsTable.startTime,
      eventEndTime: agendaEventsTable.endTime,
      userId: agendaEventParticipantsTable.userId,
      userName: usersTable.name,
    })
    .from(agendaEventParticipantsTable)
    .innerJoin(agendaEventsTable, eq(agendaEventParticipantsTable.eventId, agendaEventsTable.id))
    .leftJoin(usersTable, eq(agendaEventParticipantsTable.userId, usersTable.id))
    .where(
      and(
        eq(agendaEventsTable.operationId, scale.operationId),
        gte(agendaEventsTable.date, scale.periodStart),
        lte(agendaEventsTable.date, scale.periodEnd),
        ne(agendaEventsTable.status, "CANCELLED"),
      ),
    );

  const agendaNonSchedulable = await getNonSchedulableUserIds(
    agendaParticipants.map((p) => p.userId).filter((u): u is string => !!u),
  );

  const virtualRows = agendaParticipants
    .filter(
      (p) =>
        !!p.userId &&
        opMemberIds.has(p.userId) &&
        !agendaNonSchedulable.has(p.userId) &&
        !realAgendaKeys.has(`${p.userId}|${p.eventId}`),
    )
    .map((p) => ({
      id: `agp:${p.eventId}:${p.userId}`,
      agendaEventId: p.eventId,
      positionId: null,
      userId: p.userId,
      status: "AGENDA_PARTICIPANT",
      overrideReason: null,
      notes: null,
      manualDate: p.eventDate,
      manualLabel: p.eventTitle,
      startTime: p.eventStartTime,
      endTime: p.eventEndTime,
      positionName: null,
      userName: p.userName,
      eventDate: p.eventDate,
      eventTitle: p.eventTitle,
      eventStartTime: p.eventStartTime,
      eventEndTime: p.eventEndTime,
      isAgendaParticipant: true,
      candidates: [] as [],
    }));

  // Fases 1 e 2 — cast do LIVRO DO DIA publicado (com blocos do show).
  const dailyBookCast = await db
    .select({
      dailyBookId: dailyBooksTable.id,
      roleId: dailyBookPositionsTable.sourceRoleId,
      positionName: dailyBookPositionsTable.name,
      userId: dailyBookAssignmentsTable.userId,
      userName: usersTable.name,
      eventDate: agendaEventsTable.date,
      eventTitle: agendaEventsTable.title,
      eventStartTime: agendaEventsTable.startTime,
      eventEndTime: agendaEventsTable.endTime,
      showTitle: showBooksTable.title,
      blockName: dailyBookBlocksTable.name,
      blockStartTime: dailyBookBlocksTable.startTime,
      blockEndTime: dailyBookBlocksTable.endTime,
    })
    .from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .leftJoin(dailyBookBlocksTable, eq(dailyBookPositionsTable.blockId, dailyBookBlocksTable.id))
    .innerJoin(dailyBooksTable, eq(dailyBookAssignmentsTable.dailyBookId, dailyBooksTable.id))
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .leftJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .leftJoin(usersTable, eq(dailyBookAssignmentsTable.userId, usersTable.id))
    .where(
      and(
        eq(agendaEventsTable.operationId, scale.operationId),
        gte(agendaEventsTable.date, scale.periodStart),
        lte(agendaEventsTable.date, scale.periodEnd),
        inArray(dailyBooksTable.status, ["PUBLISHED", "REPUBLISHED"]),
        inArray(dailyBookAssignmentsTable.status, ["ASSIGNED", "AT_RISK"]),
        eq(dailyBookPositionsTable.isRemoved, false),
        isNotNull(dailyBookAssignmentsTable.userId),
      ),
    );

  const castNonSchedulable = await getNonSchedulableUserIds(
    dailyBookCast.map((c) => c.userId).filter((u): u is string => !!u),
  );

  const dailyBookRows = dailyBookCast
    .filter((c) => !!c.userId && !castNonSchedulable.has(c.userId))
    .filter((c) => !realKeys.has(`${c.userId}|${c.eventDate}|${c.roleId ?? ""}`))
    .map((c) => ({
      id: `db:${c.dailyBookId}:${c.userId}:${c.roleId ?? "x"}`,
      agendaEventId: null,
      positionId: c.roleId,
      userId: c.userId,
      status: "ASSIGNED",
      overrideReason: null,
      notes: null,
      manualDate: c.eventDate,
      manualLabel: c.blockName ?? c.showTitle ?? c.eventTitle ?? "SHOW",
      startTime: c.blockStartTime ?? c.eventStartTime,
      endTime: c.blockEndTime ?? c.eventEndTime,
      positionName: c.positionName,
      userName: c.userName,
      eventDate: c.eventDate,
      eventTitle: c.eventTitle,
      eventStartTime: c.eventStartTime,
      eventEndTime: c.eventEndTime,
      isDailyBookParticipant: true,
      candidates: [] as [],
    }));

  // Fase 3 — ATIVIDADES recorrentes/avulsas (direto ou via grupo).
  const recurringRows: Array<{
    id: string;
    agendaEventId: null;
    positionId: null;
    userId: string;
    status: string;
    overrideReason: null;
    notes: null;
    manualDate: string;
    manualLabel: string;
    startTime: string | null;
    endTime: string | null;
    positionName: null;
    userName: string | null;
    eventDate: string;
    eventTitle: string;
    eventStartTime: string | null;
    eventEndTime: string | null;
    isRecurringActivity: true;
    candidates: [];
  }> = [];

  const activities = await db
    .select()
    .from(recurringActivitiesTable)
    .where(
      and(
        eq(recurringActivitiesTable.operationId, scale.operationId),
        eq(recurringActivitiesTable.active, true),
      ),
    );

  if (activities.length > 0) {
    const activityIds = activities.map((a) => a.id);
    const assignees = await db
      .select()
      .from(recurringActivityAssigneesTable)
      .where(inArray(recurringActivityAssigneesTable.activityId, activityIds));

    const directUserIds = [
      ...new Set(assignees.map((a) => a.userId).filter((x): x is string => !!x)),
    ];
    const directUsers = directUserIds.length
      ? await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(inArray(usersTable.id, directUserIds))
      : [];
    const directUserName = new Map(directUsers.map((u) => [u.id, u.name]));

    const groupMembersCache = new Map<string, { id: string; name: string }[]>();
    const resolveGroup = async (groupId: string) => {
      let members = groupMembersCache.get(groupId);
      if (!members) {
        const loaded = await loadGroupMembers(groupId, [scale.operationId]);
        members = loaded.map((m) => ({ id: m.id, name: m.name }));
        groupMembersCache.set(groupId, members);
      }
      return members;
    };

    const activityUsers = new Map<string, Map<string, string | null>>();
    for (const act of activities) activityUsers.set(act.id, new Map());
    for (const a of assignees) {
      const target = activityUsers.get(a.activityId)!;
      if (a.userId) {
        if (opMemberIds.has(a.userId)) {
          target.set(a.userId, directUserName.get(a.userId) ?? null);
        }
      } else if (a.groupId) {
        const members = await resolveGroup(a.groupId);
        for (const m of members) target.set(m.id, m.name);
      }
    }

    const periodDates: string[] = [];
    const start = new Date(scale.periodStart + "T00:00:00Z");
    const end = new Date(scale.periodEnd + "T00:00:00Z");
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      periodDates.push(d.toISOString().slice(0, 10));
    }

    for (const act of activities) {
      const users = activityUsers.get(act.id)!;
      if (users.size === 0) continue;
      let dates: string[];
      if (act.weekday != null) {
        const wd = act.weekday;
        dates = periodDates.filter(
          (ds) => new Date(ds + "T00:00:00Z").getUTCDay() === wd,
        );
      } else if (act.specificDate) {
        dates =
          act.specificDate >= scale.periodStart && act.specificDate <= scale.periodEnd
            ? [act.specificDate]
            : [];
      } else {
        dates = [];
      }
      for (const ds of dates) {
        for (const [userId, userName] of users) {
          if (nonSchedulable.has(userId)) continue;
          recurringRows.push({
            id: `rec:${act.id}:${ds}:${userId}`,
            agendaEventId: null,
            positionId: null,
            userId,
            status: "RECURRING_ACTIVITY",
            overrideReason: null,
            notes: null,
            manualDate: ds,
            manualLabel: act.title,
            startTime: act.startTime,
            endTime: act.endTime,
            positionName: null,
            userName,
            eventDate: ds,
            eventTitle: act.title,
            eventStartTime: act.startTime,
            eventEndTime: act.endTime,
            isRecurringActivity: true,
            candidates: [],
          });
        }
      }
    }
  }

  return [
    ...allocationsWithCandidates,
    ...virtualRows,
    ...dailyBookRows,
    ...recurringRows,
  ];
}

// ─── Fase 5 — Tempo livre (deteção de buracos) ──────────────────────────────
// MANTER EM SINCRONIA com artifacts/web-admin/src/pages/admin/scales.tsx
// (WORK_DAY_START_MIN / WORK_DAY_END_MIN / MIN_FREE_GAP_MIN e computeFreeGaps).
export const WORK_DAY_START_MIN = 7 * 60 + 40; // 07:40
export const WORK_DAY_END_MIN = 18 * 60; // 18:00
export const MIN_FREE_GAP_MIN = 60; // só sugerir buracos de pelo menos 1 hora

export interface FreeGap {
  start: string; // HH:MM
  end: string; // HH:MM
}

function hhmmToMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * A partir dos blocos de um membro num dia, calcula os intervalos livres dentro
 * da janela padrão. Se algum bloco não tiver horário, devolve [] (não dá para
 * saber o tempo realmente livre) — mesmo comportamento da grelha do ecrã.
 */
export function computeFreeGaps(
  blocks: Array<{ startTime?: string | null; endTime?: string | null }>,
): FreeGap[] {
  const intervals: { s: number; e: number }[] = [];
  for (const b of blocks) {
    const s = hhmmToMin(b.startTime);
    const en = hhmmToMin(b.endTime);
    if (s == null || en == null) return [];
    const cs = Math.max(s, WORK_DAY_START_MIN);
    const ce = Math.min(en, WORK_DAY_END_MIN);
    if (ce > cs) intervals.push({ s: cs, e: ce });
  }
  intervals.sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e);
    else merged.push({ ...iv });
  }
  const gaps: FreeGap[] = [];
  let cursor = WORK_DAY_START_MIN;
  for (const iv of merged) {
    if (iv.s - cursor >= MIN_FREE_GAP_MIN) {
      gaps.push({ start: minToHHMM(cursor), end: minToHHMM(iv.s) });
    }
    cursor = Math.max(cursor, iv.e);
  }
  if (WORK_DAY_END_MIN - cursor >= MIN_FREE_GAP_MIN) {
    gaps.push({ start: minToHHMM(cursor), end: minToHHMM(WORK_DAY_END_MIN) });
  }
  return gaps;
}
