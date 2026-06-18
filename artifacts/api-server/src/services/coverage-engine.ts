import { db } from "@workspace/db";
import {
  usersTable,
  userRolesTable,
  restrictionsTable,
  showBookRolesTable,
  userTagsTable,
  agendaEventsTable,
  scaleAllocationsTable,
  allocationCandidatesTable,
  allocationExceptionsTable,
} from "@workspace/db";
import { eq, and, lte, gte, inArray } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface CandidateAnalysis {
  userId: string;
  userName: string;
  eligible: boolean;
  compatible: boolean;
  priorityScore: number;
  rank: number;
  rejectionReason?: string;
  tags: string[];
}

export interface PositionResult {
  positionId: string;
  positionName: string;
  minimumCoverage: number;
  selectedCandidates: CandidateAnalysis[];
  allCandidates: CandidateAnalysis[];
  status: "ASSIGNED" | "OPEN" | "CONFLICT";
  exception?: {
    type: "NO_CANDIDATE" | "RESTRICTION" | "CONFLICT" | "INSUFFICIENT_COVERAGE" | "SUPERVISOR_OVERRIDE";
    reason: string;
    impact: string;
  };
}

export interface CoverageEngineResult {
  agendaEventId: string;
  showBookId: string;
  positions: PositionResult[];
  totalPositions: number;
  assignedPositions: number;
  openPositions: number;
  conflictPositions: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Engine
// ────────────────────────────────────────────────────────────────────────────

export async function runCoverageEngine(
  agendaEventId: string,
  showBookId: string,
  operationId: string,
  groupId?: string
): Promise<CoverageEngineResult> {
  // Fetch event
  const [event] = await db
    .select()
    .from(agendaEventsTable)
    .where(eq(agendaEventsTable.id, agendaEventId))
    .limit(1);

  if (!event) throw new Error(`Evento ${agendaEventId} não encontrado`);

  const eventDate = event.date;

  // Fetch positions from show book
  const positions = await db
    .select()
    .from(showBookRolesTable)
    .where(eq(showBookRolesTable.showBookId, showBookId))
    .orderBy(showBookRolesTable.order);

  // Fetch eligible members (Layer 1 base query)
  // Members are users who have a MEMBER/SUPERVISOR role in the operation
  const roleQuery = groupId
    ? and(
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.groupId, groupId),
        eq(userRolesTable.active, true)
      )
    : and(
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true)
      );

  const memberRoles = await db
    .select({
      userId: userRolesTable.userId,
      role: userRolesTable.role,
      groupId: userRolesTable.groupId,
    })
    .from(userRolesTable)
    .where(roleQuery!);

  // Get unique user IDs
  const memberIds = [...new Set(memberRoles.map((r) => r.userId))];

  if (memberIds.length === 0) {
    return {
      agendaEventId,
      showBookId,
      positions: positions.map((p) => ({
        positionId: p.id,
        positionName: p.name,
        minimumCoverage: p.minimumCoverage,
        selectedCandidates: [],
        allCandidates: [],
        status: "OPEN",
        exception: {
          type: "NO_CANDIDATE",
          reason: "Nenhum membro encontrado para a operação/grupo",
          impact: "Posição fica em aberto",
        },
      })),
      totalPositions: positions.length,
      assignedPositions: 0,
      openPositions: positions.length,
      conflictPositions: 0,
    };
  }

  // Fetch users
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, status: usersTable.status })
    .from(usersTable)
    .where(inArray(usersTable.id, memberIds));

  // Fetch active restrictions for event date
  const restrictions = await db
    .select({ userId: restrictionsTable.userId, type: restrictionsTable.type })
    .from(restrictionsTable)
    .where(
      and(
        inArray(restrictionsTable.userId, memberIds),
        eq(restrictionsTable.status, "ACTIVE"),
        lte(restrictionsTable.periodStart, eventDate),
        gte(restrictionsTable.periodEnd, eventDate)
      )
    );

  const restrictedUserIds = new Set(restrictions.map((r) => r.userId));

  // Fetch user tags
  const userTags = await db
    .select({ userId: userTagsTable.userId, tagId: userTagsTable.tagId })
    .from(userTagsTable)
    .where(inArray(userTagsTable.userId, memberIds));

  const userTagMap: Record<string, string[]> = {};
  userTags.forEach((ut) => {
    if (!userTagMap[ut.userId]) userTagMap[ut.userId] = [];
    userTagMap[ut.userId]!.push(ut.tagId);
  });

  // Build user lookup
  const userMap: Record<string, { id: string; name: string; status: string }> = {};
  users.forEach((u) => { userMap[u.id] = u; });

  const positionResults: PositionResult[] = [];

  // Process each position
  for (const position of positions) {
    const requiredTags: string[] = Array.isArray(position.tagsJson) ? position.tagsJson : [];
    const candidates: CandidateAnalysis[] = [];

    for (const userId of memberIds) {
      const user = userMap[userId];
      if (!user) continue;

      // ── Layer 1: Mandatory Eligibility ──
      const isActive = user.status === "ACTIVE";
      const hasNoRestriction = !restrictedUserIds.has(userId);
      const eligible = isActive && hasNoRestriction;

      let rejectionReason: string | undefined;
      if (!isActive) rejectionReason = "Usuário inativo";
      else if (!hasNoRestriction) rejectionReason = "Restrição ativa no período";

      // ── Layer 2: Operational Compatibility ──
      const userHasTags = userTagMap[userId] ?? [];
      const hasRequiredTags =
        requiredTags.length === 0 ||
        requiredTags.every((tagId) => userHasTags.includes(tagId));

      const compatible = eligible && hasRequiredTags;
      if (eligible && !hasRequiredTags) {
        rejectionReason = `Tags insuficientes (requer: ${requiredTags.join(", ")})`;
      }

      // ── Layer 3: Prioritization Score ──
      let priorityScore = 0;
      if (compatible) {
        // Score based on extra matching tags (beyond requirements)
        priorityScore += userHasTags.filter((t) => requiredTags.includes(t)).length * 10;
        // Extra tags (broader expertise)
        priorityScore += Math.min(userHasTags.length * 2, 20);
        // Base eligible score
        priorityScore += 50;
      }

      candidates.push({
        userId,
        userName: user.name,
        eligible,
        compatible,
        priorityScore,
        rank: 0, // assigned after sort
        rejectionReason,
        tags: userHasTags,
      });
    }

    // Sort by: compatible first, then priorityScore desc
    candidates.sort((a, b) => {
      if (a.compatible && !b.compatible) return -1;
      if (!a.compatible && b.compatible) return 1;
      return b.priorityScore - a.priorityScore;
    });

    // Assign ranks (1-based)
    candidates.forEach((c, idx) => { c.rank = idx + 1; });

    const eligibleCandidates = candidates.filter((c) => c.compatible);
    const needed = position.minimumCoverage;
    const selected = eligibleCandidates.slice(0, needed);

    let status: "ASSIGNED" | "OPEN" | "CONFLICT";
    let exception: PositionResult["exception"] | undefined;

    if (selected.length >= needed) {
      status = "ASSIGNED";
    } else if (selected.length > 0 && selected.length < needed) {
      status = "CONFLICT";
      exception = {
        type: "INSUFFICIENT_COVERAGE",
        reason: `Cobertura insuficiente: ${selected.length}/${needed} candidatos disponíveis`,
        impact: `Posição "${position.name}" com cobertura parcial (${selected.length}/${needed})`,
      };
    } else {
      status = "OPEN";
      exception = {
        type: "NO_CANDIDATE",
        reason: eligible_count(candidates) === 0
          ? "Nenhum membro elegível para esta posição"
          : "Nenhum membro compatível com os requisitos de tags",
        impact: `Posição "${position.name}" fica em aberto — cobertura 0/${needed}`,
      };
    }

    positionResults.push({
      positionId: position.id,
      positionName: position.name,
      minimumCoverage: needed,
      selectedCandidates: selected,
      allCandidates: candidates,
      status,
      exception,
    });
  }

  const assignedPositions = positionResults.filter((p) => p.status === "ASSIGNED").length;
  const openPositions = positionResults.filter((p) => p.status === "OPEN").length;
  const conflictPositions = positionResults.filter((p) => p.status === "CONFLICT").length;

  return {
    agendaEventId,
    showBookId,
    positions: positionResults,
    totalPositions: positions.length,
    assignedPositions,
    openPositions,
    conflictPositions,
  };
}

function eligible_count(candidates: CandidateAnalysis[]): number {
  return candidates.filter((c) => c.eligible).length;
}

// ────────────────────────────────────────────────────────────────────────────
// Persist engine result to DB
// ────────────────────────────────────────────────────────────────────────────

export async function persistEngineResult(
  scaleId: string,
  agendaEventId: string,
  result: CoverageEngineResult
): Promise<void> {
  for (const pos of result.positions) {
    // Create allocation
    const [alloc] = await db
      .insert(scaleAllocationsTable)
      .values({
        scaleId,
        agendaEventId,
        positionId: pos.positionId,
        userId: pos.selectedCandidates[0]?.userId ?? null as any,
        status: pos.status,
      })
      .returning();

    if (!alloc) continue;

    // Persist candidates
    if (pos.allCandidates.length > 0) {
      await db.insert(allocationCandidatesTable).values(
        pos.allCandidates.map((c) => ({
          scaleId,
          allocationId: alloc.id,
          userId: c.userId,
          rank: c.rank,
          eligible: c.eligible,
          compatible: c.compatible,
          priorityScore: c.priorityScore,
          rejectionReason: c.rejectionReason ?? null,
          candidateData: { tags: c.tags, userName: c.userName },
        }))
      );
    }

    // Persist exception if any
    if (pos.exception) {
      await db.insert(allocationExceptionsTable).values({
        scaleId,
        agendaEventId,
        positionId: pos.positionId,
        type: pos.exception.type,
        reason: pos.exception.reason,
        impact: pos.exception.impact ?? null,
        candidatesAnalyzed: pos.allCandidates.map((c) => ({
          userId: c.userId,
          name: c.userName,
          eligible: c.eligible,
          compatible: c.compatible,
          rejectionReason: c.rejectionReason,
        })),
      });
    }
  }
}
