import { randomUUID } from "node:crypto";
import { Router } from "express";
import { canManageAsaAgenda, parseAsaAgendaDraftNotesRequest, parseAsaAgendaDraftScheduleRequest } from "../services/asa-command-engine.js";
import { eq, and, asc, desc, gt, gte, lte, ne, ilike, or, sql, inArray, isNull, isNotNull, notExists } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversations,
  aiMessages,
  agendaEventParticipantsTable,
  asaMemoriesTable,
  asaUserPreferencesTable,
  asaAuditLogTable,
  recognitionsTable,
  usersTable,
  userRolesTable,
  agendaEventsTable,
  operationalCheckInsTable,
  scalesTable,
  scaleAllocationsTable,
  responsibilitiesTable,
  responsibilityAssignmentsTable,
  dailyBooksTable,
  dailyBookScenesTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  notificationsTable,
  noticesTable,
  noticeRecipientsTable,
  tasksTable,
  taskCommentsTable,
  taskEvidencesTable,
  deliveriesTable,
  deliveryAssignmentsTable,
  operationsTable,
  folgasTable,
  requestsTable,
  libraryDocumentsTable,
  organizationsTable,
  messagesTable,
  messageThreadsTable,
  messageThreadParticipantsTable,
  announcementCommentsTable,
  announcementsTable,
  announcementReadsTable,
  areaLocalSupervisorsTable,
  areasTable,
  locationsTable,
  libraryDocumentVersionsTable,
  libraryDocumentPageCitationsTable,
  libraryCategoriesTable,
  libraryViewsTable,
  userNotificationsTable,
  operationalGroupsTable,
  groupOperationsTable,
  recurringActivitiesTable,
  recurringActivitySchedulesTable,
  recurringActivityAssigneesTable,
} from "@workspace/db";
import { resolveScaleAllocations, computeFreeGaps } from "../services/scale-merge.js";
import { aggregateAsaLibraryGaps, createAsaLibraryGapAction } from "../services/asa-library-gaps.js";
import { selectAsaLibraryCitation } from "../services/asa-library-citations.js";
import { asaPreferenceLabel, formatAsaPreferenceValue, parseAsaPreferenceCommand, parseAsaPreferencePatch, type AsaPreferencePatch } from "../services/asa-preferences.js";
import { ASA_TASK_EVIDENCE_TYPES, ASA_UNRECOGNIZED_COMMAND_REPLY, formatAsaCapabilityReply, formatAsaCommandReply, formatAsaTaskCommentsReply, isAsaCapabilityRequest, isAsaUnrecognizedCommandResolution, normalizeAsaText, parseAsaAgendaDraftRenameRequest, parseAsaAgendaMeetingRequest, parseAsaDirectMessageRequest, parseAsaLearningApproval, parseAsaLearningRequest, parseAsaMessageReplyRequest, parseAsaMuralAckRequest, parseAsaMuralCommentRequest, parseAsaMuralReactionRequest, parseAsaNoticeDraftRequest, parseAsaNoticeDraftUpdateRequest, parseAsaTaskAssigneeUpdate, parseAsaTaskCancellationRequest, parseAsaTaskChecklistUpdateRequest, parseAsaTaskCommentRequest, parseAsaTaskCommentsQuery, parseAsaTaskCompletionRequest, parseAsaTaskDescriptionUpdate, parseAsaTaskDraftRequest, parseAsaTaskDueDateUpdate, parseAsaTaskEvidenceLinkRequest, parseAsaTaskPriorityUpdate, parseAsaTaskRequirementsUpdate, parseAsaTaskResponsibilityUpdate, parseAsaTaskStartRequest, parseAsaTaskSubmitForApprovalRequest, parseAsaTaskTitleUpdate, parseAsaUnrecognizedReviewRequest, resolveAsaAgendaSupervisorScope, resolveAsaCommand, resolveAsaOperationSelection } from "../services/asa-command-engine.js";
import {
  GroupActionError,
  createGroupCore,
  renameGroupCore,
  setGroupStatusCore,
  addGroupMemberCore,
  removeGroupMemberCore,
  supervisedOperationIds,
} from "./groups.js";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { eventBus } from "../lib/event-bus.js";
import { createNotification, notifyMany, sendNotification } from "../services/notificationService.js";
import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { canApproveAsaMemory, canDeleteAsaMemory, canEditAsaMemory, canReadAsaMemory } from "../services/asa-memory-policy.js";
import { canReadLibraryScope, isLibraryFullReader, type LibraryRole } from "../services/library-access.js";
import { resolvePrimaryRole } from "../lib/authorization.service.js";
import { canViewDailyBook, canViewShowBook } from "../lib/show-responsibility.js";
import { canManageTasks, listTaskManagementAreaIds, resolveTaskAreaId } from "../services/task-access.js";
import { hasScaleAuthority } from "../services/scale-access.js";
import { canManageCheckInsForOperation } from "../services/checkin-access.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { hasActiveResponsibility } from "../lib/delegation-check.js";
import { isAsaProposalExpired } from "../services/asa-proposal-state.js";
import { canReadAnnouncement } from "../services/announcement-access.js";
import { announcementConfirmationVersion, confirmAnnouncementRead } from "../services/announcement-confirmation.js";
import { listCommunicationPeople } from "../services/communication-directory.js";
import { listReadableLocations } from "../services/location-directory.js";
import { checkInPeriodDates, summarizeCheckIns, type CheckInInsightPeriod } from "../services/checkin-insights.js";
import { summarizeTasks, taskPeriodDates, type TaskInsightPeriod } from "../services/task-insights.js";
import { resolveAsaSummaryTeamOperation } from "../services/asa-summary-policy.js";
type JsonFetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

const router = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];
const TASK_MANAGER_ROLES = [...MANAGER_ROLES, "DIR"];
const ASA_PROPOSAL_ACTION_TYPES = new Set([
  "NOTICE_DRAFT_CREATE", "NOTICE_DRAFT_UPDATE", "TASK_CREATE", "TASK_CANCEL", "TASK_START", "TASK_READY_FOR_APPROVAL",
  "TASK_COMPLETE", "TASK_COMMENT_CREATE", "TASK_EVIDENCE_LINK_ADD", "TASK_CHECKLIST_UPDATE", "AGENDA_MEETING_CREATE", "AGENDA_DRAFT_RENAME", "AGENDA_DRAFT_SCHEDULE_UPDATE", "AGENDA_DRAFT_NOTES_UPDATE",
  "TASK_UPDATE_DUE_DATE", "TASK_UPDATE_ASSIGNEE", "TASK_UPDATE_PRIORITY", "TASK_UPDATE_DESCRIPTION",
  "TASK_UPDATE_TITLE", "TASK_UPDATE_REQUIREMENTS", "TASK_UPDATE_RESPONSIBILITY", "MURAL_ACK", "MURAL_REACT",
  "MURAL_COMMENT_CREATE", "MESSAGE_DIRECT_CREATE", "MESSAGE_REPLY", "ASA_PREFERENCE_UPDATE",
]);

async function activeAsaRoleForOperation(
  userId: string,
  organizationId: string,
  operationId: string,
): Promise<string | null> {
  const roles = await db.select({ role: userRolesTable.role })
    .from(userRolesTable)
    .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
    .where(and(
      eq(userRolesTable.userId, userId), eq(userRolesTable.operationId, operationId),
      eq(userRolesTable.active, true), eq(operationsTable.organizationId, organizationId),
      eq(operationsTable.status, "ACTIVE"),
    ));
  return resolvePrimaryRole(roles);
}

// ────────────────────────────────────────────────────────────────────────────
// Daily Summary Helper
// ────────────────────────────────────────────────────────────────────────────

function weatherCodeToLabel(code: number): { emoji: string; description: string } {
  if ([1, 2, 3].includes(code)) return { emoji: "⛅", description: "Parcialmente nublado" };
  if ([45, 48].includes(code)) return { emoji: "🌫️", description: "Neblina" };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { emoji: "🌧️", description: "Chuva" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { emoji: "❄️", description: "Neve" };
  if ([95, 96, 99].includes(code)) return { emoji: "⛈️", description: "Tempestade" };
  return { emoji: "☀️", description: "Céu limpo" };
}

async function assembleResumoDodia(
  userId: string,
  organizationId: string | null,
  userRole: string = "MEMBER",
  authorizedTeamOperationId: string | null = null,
): Promise<{
  greeting: string; greetingEmoji: string; firstName: string;
  items: { emoji: string; text: string }[];
  clima: { temp: number; description: string; emoji: string } | null;
  birthdaysToday: string[]; mode: string;
  avatarState: "feliz" | "duvida" | "comemoracao" | "atencao" | "sugestao" | "boanoite" | "bomdia";
  milestones: { name: string; label: string }[];
}> {
  const today = operationalDate();
  const hour  = new Date().getHours();

  const greeting      = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const greetingEmoji = hour < 12 ? "☀️"      : hour < 18 ? "🌤️"       : "🌙";

  const [[userRow], [prefs]] = await Promise.all([
    db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, userId)).limit(1),
  ]);

  const firstName = userRow?.name?.split(" ")[0] ?? "";
  const mode      = prefs?.mode ?? "BALANCED";
  let teamOperationId = authorizedTeamOperationId;
  if (teamOperationId && organizationId && userRole !== "ADMIN") {
    const [activeRole] = await db.select({ id: userRolesTable.id })
      .from(userRolesTable)
      .where(and(
        eq(userRolesTable.userId, userId),
        eq(userRolesTable.operationId, teamOperationId),
        eq(userRolesTable.role, userRole as never),
        eq(userRolesTable.active, true),
      ))
      .limit(1);
    if (!activeRole) teamOperationId = null;
  }

  const items: { emoji: string; text: string }[] = [];

  // Today's manual scale allocations for this user
  const allocations = await db
    .select({ label: scaleAllocationsTable.manualLabel, startTime: scaleAllocationsTable.startTime })
    .from(scaleAllocationsTable)
    .where(and(
      eq(scaleAllocationsTable.userId,   userId),
      eq(scaleAllocationsTable.manualDate, today),
      eq(scaleAllocationsTable.active, true),
    ))
    .limit(5);
  for (const a of allocations) {
    const time = a.startTime ? ` ${a.startTime.slice(0, 5)}` : "";
    items.push({ emoji: "📅", text: `${a.label ?? "Atividade"}${time}` });
  }

  // Pending / overdue tasks
  if (organizationId) {
    const tasks = await db
      .select({ status: tasksTable.status, dueDate: tasksTable.dueDate })
      .from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, userId), eq(tasksTable.organizationId, organizationId)))
      .limit(50);
    const pending = tasks.filter(t => ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(t.status));
    const overdue = pending.filter(t => t.dueDate < today);
    if (overdue.length > 0) {
      items.push({ emoji: "⚠️", text: `${overdue.length} tarefa${overdue.length !== 1 ? "s" : ""} atrasada${overdue.length !== 1 ? "s" : ""}` });
    } else if (pending.length > 0) {
      items.push({ emoji: "📌", text: `${pending.length} tarefa${pending.length !== 1 ? "s" : ""} pendente${pending.length !== 1 ? "s" : ""}` });
    }
  }

  // Team availability is shown only inside an explicitly authorized manager scope.
  if (teamOperationId && organizationId && MANAGER_ROLES.includes(userRole)) {
    const folgasRows = await db
      .select({ userName: usersTable.name, userId: folgasTable.userId })
      .from(folgasTable)
      .innerJoin(usersTable, eq(folgasTable.userId, usersTable.id))
      .innerJoin(operationsTable, eq(folgasTable.operationId, operationsTable.id))
      .where(and(
        eq(folgasTable.operationId, teamOperationId),
        eq(operationsTable.organizationId, organizationId),
        eq(usersTable.organizationId, organizationId),
        eq(operationsTable.status, "ACTIVE"),
        eq(folgasTable.status,      "ACTIVE"),
        lte(folgasTable.startDate, today),
        gte(folgasTable.endDate,   today),
      ))
      .limit(6);
    const others = folgasRows.filter(f => f.userId !== userId);
    for (const f of others.slice(0, 3)) {
      if (f.userName) items.push({ emoji: "🌴", text: `${f.userName.split(" ")[0]} de folga` });
    }
    if (others.length > 3) items.push({ emoji: "🌴", text: `+${others.length - 3} outros de folga` });
  }

  // Birthdays — 1) from usersTable.birthDate (DB), 2) from memories (backward compat)
  const birthdaysToday: string[] = [];
  if (organizationId && (prefs?.birthdayAlerts ?? true)) {
    const month = parseInt(today.slice(5, 7));
    const day   = parseInt(today.slice(8, 10));

    // Primary: query users with birthDate matching today's month+day
    const dbBirthdays = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(and(
        eq(usersTable.organizationId, organizationId),
        sql`${usersTable.birthDate} IS NOT NULL`,
        sql`EXTRACT(MONTH FROM ${usersTable.birthDate}) = ${month}`,
        sql`EXTRACT(DAY FROM ${usersTable.birthDate}) = ${day}`,
      ));

    for (const u of dbBirthdays) {
      const firstName = u.name.split(" ")[0]!;
      birthdaysToday.push(firstName);
      items.push({ emoji: "🎉", text: `${firstName} faz aniversário hoje!` });
    }

    // Fallback: memories with birthday pattern (for orgs that taught ASA manually)
    const todayMD = `${today.slice(8, 10)}/${today.slice(5, 7)}`; // DD/MM
    const memories = await db
      .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
      .from(asaMemoriesTable)
      .where(and(
        eq(asaMemoriesTable.organizationId, organizationId),
        eq(asaMemoriesTable.status, "APPROVED"),
        eq(asaMemoriesTable.type,   "PERSONAL"),
      ))
      .limit(100);
    const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const m of memories) {
      const kn = normStr(m.key);
      if (kn.includes("aniversario") || kn.includes("nascimento") || kn.includes("birthday")) {
        if (m.value.trim().startsWith(todayMD)) {
          const match = m.key.match(/(?:de\s+|:\s*)(.+?)(?:\s*$)/i);
          const name  = match?.[1]?.trim() ?? m.key;
          // Skip if already detected from DB to avoid duplicates
          if (!birthdaysToday.some(n => n.toLowerCase() === name.toLowerCase())) {
            birthdaysToday.push(name);
            items.push({ emoji: "🎉", text: `${name} faz aniversário hoje!` });
          }
        }
      }
    }
  }

  // Weather — BALANCED shows clima but not in items; PROACTIVE adds item
  let clima: { temp: number; description: string; emoji: string } | null = null;
  if (mode !== "SILENT") {
    try {
      const wr = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current=temperature_2m,weathercode&timezone=America/Sao_Paulo",
        { signal: AbortSignal.timeout(4000) },
      ) as unknown as JsonFetchResponse;
      if (wr.ok) {
        const wj = await wr.json() as { current: { temperature_2m: number; weathercode: number } };
        const { temperature_2m: temp, weathercode: code } = wj.current;
        const { emoji: wEmoji, description } = weatherCodeToLabel(code);
        clima = { temp: Math.round(temp), description, emoji: wEmoji };
        if (mode === "PROACTIVE") items.push({ emoji: wEmoji, text: `${Math.round(temp)}°C — ${description}` });
      }
    } catch { /* weather unavailable */ }
  }

  // Milestones — time at company (anniversaries)
  const milestones: { name: string; label: string }[] = [];
  if (organizationId) {
    const isManagerRole = MANAGER_ROLES.includes(userRole);
    const orgUsersForMilestones = isManagerRole
      ? await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
          .from(usersTable)
          .where(and(eq(usersTable.organizationId, organizationId), ne(usersTable.id, userId)))
          .limit(50)
      : await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
          .from(usersTable)
          .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, organizationId)))
          .limit(1);

    const todayDate = new Date();
    for (const u of orgUsersForMilestones) {
      const created = new Date(u.createdAt);
      if (created.getDate() !== todayDate.getDate() || created.getMonth() !== todayDate.getMonth()) continue;
      const years = todayDate.getFullYear() - created.getFullYear();
      const totalMonths = years * 12 + (todayDate.getMonth() - created.getMonth());
      const fn = u.name.split(" ")[0]!;
      if (years >= 1 && years <= 10) {
        const label = `${years} ano${years > 1 ? "s" : ""} na ASA`;
        milestones.push({ name: fn, label });
        items.push({ emoji: "🎖️", text: `${fn} completa ${label} hoje!` });
      } else if (totalMonths === 3 || totalMonths === 6) {
        const label = `${totalMonths} meses na ASA`;
        milestones.push({ name: fn, label });
        items.push({ emoji: "⭐", text: `${fn} completa ${label} hoje!` });
      }
    }
  }

  // Operational suggestions for managers — users on folga with pending tasks
  if (MANAGER_ROLES.includes(userRole) && organizationId && teamOperationId) {
    const todayFolgas = await db
      .select({ userId: folgasTable.userId, userName: usersTable.name })
      .from(folgasTable)
      .innerJoin(usersTable, eq(folgasTable.userId, usersTable.id))
      .innerJoin(operationsTable, eq(folgasTable.operationId, operationsTable.id))
      .where(and(
        eq(folgasTable.operationId, teamOperationId),
        eq(operationsTable.organizationId, organizationId),
        eq(usersTable.organizationId, organizationId),
        eq(operationsTable.status, "ACTIVE"),
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, today),
        gte(folgasTable.endDate, today),
      ))
      .limit(10);

    for (const f of todayFolgas) {
      if (!f.userId || f.userId === userId) continue;
      const pendingTasks = await db
        .select({ id: tasksTable.id })
        .from(tasksTable)
        .where(and(
          eq(tasksTable.assigneeId, f.userId),
          eq(tasksTable.organizationId, organizationId),
          eq(tasksTable.operationId, teamOperationId),
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
        ))
        .limit(3);
      if (pendingTasks.length > 0) {
        const fn = f.userName?.split(" ")[0] ?? "Membro";
        items.push({ emoji: "💡", text: `${fn} está de folga com ${pendingTasks.length} tarefa${pendingTasks.length > 1 ? "s" : ""} pendente${pendingTasks.length > 1 ? "s" : ""}` });
      }
    }
  }

  // Determine avatar state
  let avatarState: "feliz" | "duvida" | "comemoracao" | "atencao" | "sugestao" | "boanoite" | "bomdia" = "feliz";
  if (birthdaysToday.length > 0 || milestones.length > 0) {
    avatarState = "comemoracao";
  } else if (items.some(i => i.emoji === "⚠️")) {
    avatarState = "atencao";
  } else if (items.some(i => i.emoji === "💡")) {
    avatarState = "sugestao";
  } else if (hour < 12) {
    avatarState = "bomdia";
  } else if (hour >= 18) {
    avatarState = "boanoite";
  }

  return { greeting, greetingEmoji, firstName, items, clima, birthdaysToday, mode, avatarState, milestones };
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers — resolução multi-membro + cores de operação (single + lote)
// ────────────────────────────────────────────────────────────────────────────

type ToolCtx = { userId: string; organizationId: string | null; userRole: string; operationId: string | null; operationIds?: string[] };

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Quebra uma query de membros em nomes individuais. Aceita vírgula, ponto-e-vírgula,
 * o conectivo "e" (com espaços ao redor) e quebras de linha.
 * Ex.: "João, Pedro e Ana" → ["João", "Pedro", "Ana"]
 */
function splitMemberQueries(raw: string): string[] {
  const parts = raw
    .split(/\s*,\s*|\s*;\s*|\s+e\s+|\n+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  // Deduplicate preserving order (case-insensitive)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = normalizeName(p);
    if (key && !seen.has(key)) { seen.add(key); out.push(p); }
  }
  return out;
}

type MemberMatch = { id: string; name: string };
type MemberResolution = {
  query: string;
  found: boolean;
  ambiguous: boolean;
  member: MemberMatch | null;
  members: MemberMatch[];
  message: string;
};

/**
 * Resolve um único nome contra a lista de usuários, usando as memórias para apelidos.
 * Não aborta — sempre devolve um resultado estruturado (encontrado / ambíguo / não encontrado).
 */
function resolveOneMember(
  query: string,
  users: MemberMatch[],
  memories: { key: string; value: string }[],
): MemberResolution {
  const normQuery = normalizeName(query);
  let resolvedQuery = normQuery;
  for (const m of memories) {
    if (normalizeName(m.key) === normQuery) { resolvedQuery = normalizeName(m.value); break; }
  }

  const scored = users
    .map((u) => {
      const normName = normalizeName(u.name);
      let score = 0;
      if (normName === resolvedQuery) score = 100;
      else {
        const nameWords = normName.split(" ");
        const qWords = resolvedQuery.split(" ").filter(Boolean);
        for (const qw of qWords) {
          for (const nw of nameWords) {
            if (nw === qw) score += 40;
            else if (nw.startsWith(qw) && qw.length >= 3) score += 25;
            else if (nw.includes(qw) && qw.length >= 3) score += 12;
          }
        }
      }
      return { id: u.id, name: u.name, score };
    })
    .filter((u) => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return {
      query, found: false, ambiguous: false, member: null, members: [],
      message: `Nenhum membro encontrado para "${query}".`,
    };
  }

  const isAmbiguous = scored.length > 1 && scored[0]!.score === scored[1]!.score;
  return {
    query,
    found: true,
    ambiguous: isAmbiguous,
    member: isAmbiguous ? null : { id: scored[0]!.id, name: scored[0]!.name },
    members: scored.map((u) => ({ id: u.id, name: u.name })),
    message: isAmbiguous
      ? `"${query}": encontrei ${scored.length} membros com nomes similares. Qual você quer dizer?`
      : `"${query}": ${scored[0]!.name}`,
  };
}

/**
 * Carrega os usuários ativos visíveis ao solicitante + memórias aprovadas (para apelidos).
 * Escopo: ADMIN enxerga toda a organização; demais (supervisores/membros) enxergam TODAS
 * as operações onde têm papel ativo — não só a "operação atual" — para que um gestor de
 * várias operações consiga encontrar membros de qualquer uma delas.
 */
async function loadOrgMembersAndMemories(ctx: ToolCtx): Promise<{ users: MemberMatch[]; memories: { key: string; value: string }[] }> {
  let memberRows: MemberMatch[];
  if (ctx.userRole === "ADMIN" && ctx.organizationId) {
    memberRows = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(and(
        eq(usersTable.organizationId, ctx.organizationId),
        ne(usersTable.status, "INACTIVE"),
      ));
  } else {
    const myOpRows = await db
      .select({ operationId: userRolesTable.operationId })
      .from(userRolesTable)
      .where(and(eq(userRolesTable.userId, ctx.userId), eq(userRolesTable.active, true)));
    const myOpIds = Array.from(
      new Set(myOpRows.map((r) => r.operationId).filter((x): x is string => !!x))
    );
    memberRows = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(
        myOpIds.length > 0
          ? inArray(userRolesTable.operationId, myOpIds)
          : (ctx.operationId ? eq(userRolesTable.operationId, ctx.operationId) : sql`true`),
        ne(usersTable.status, "INACTIVE"),
      ));
  }
  const userMap = new Map<string, MemberMatch>();
  for (const u of memberRows) userMap.set(u.id, u);

  const memories = ctx.organizationId
    ? await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.status, "APPROVED"),
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
        ))
        .limit(100)
    : [];

  return { users: [...userMap.values()], memories };
}

type GroupMatch = { id: string; name: string; scope: string };

/** Operações cobertas por um grupo (OPERATION→[operationId]; MULTI→group_operations; ALL→todas da org). */
async function groupCoverageOps(group: GroupMatch, organizationId: string): Promise<string[]> {
  if (group.scope === "ALL") {
    const ops = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(eq(operationsTable.organizationId, organizationId));
    return ops.map((o) => o.id);
  }
  if (group.scope === "MULTI") {
    const links = await db
      .select({ operationId: groupOperationsTable.operationId })
      .from(groupOperationsTable)
      .where(eq(groupOperationsTable.groupId, group.id));
    return links.map((l) => l.operationId);
  }
  const [g] = await db
    .select({ operationId: operationalGroupsTable.operationId })
    .from(operationalGroupsTable)
    .where(eq(operationalGroupsTable.id, group.id))
    .limit(1);
  return g?.operationId ? [g.operationId] : [];
}

/**
 * Resolve um grupo pelo nome dentro do escopo da operação atual e devolve os membros ativos.
 * Considera grupos da operação (OPERATION) e grupos amplos (MULTI/ALL) que cobrem a operação atual.
 * Não aborta — devolve sempre um resultado estruturado.
 */
async function coreResolverGrupo(
  ctx: ToolCtx,
  query: string,
): Promise<{
  found: boolean;
  ambiguous: boolean;
  group: GroupMatch | null;
  groups: GroupMatch[];
  members: MemberMatch[];
  message: string;
}> {
  if (!ctx.organizationId) {
    return { found: false, ambiguous: false, group: null, groups: [], members: [], message: "Organização não configurada" };
  }

  // Operações da organização (para mapear grupos amplos/ALL).
  const orgOps = await db
    .select({ id: operationsTable.id })
    .from(operationsTable)
    .where(eq(operationsTable.organizationId, ctx.organizationId));
  const orgOpIds = new Set(orgOps.map((o) => o.id));

  // Todos os grupos ativos visíveis à organização.
  const allGroups = await db
    .select({
      id: operationalGroupsTable.id,
      name: operationalGroupsTable.name,
      scope: operationalGroupsTable.scope,
      organizationId: operationalGroupsTable.organizationId,
      operationId: operationalGroupsTable.operationId,
    })
    .from(operationalGroupsTable)
    .where(eq(operationalGroupsTable.status, "ACTIVE"));

  // Mantém apenas grupos da organização atual que cobrem a operação atual.
  const inScope: GroupMatch[] = [];
  for (const g of allGroups) {
    const belongsToOrg =
      g.organizationId === ctx.organizationId || (g.operationId ? orgOpIds.has(g.operationId) : false);
    if (!belongsToOrg) continue;
    const match: GroupMatch = { id: g.id, name: g.name, scope: g.scope };
    if (ctx.operationId) {
      const covered = await groupCoverageOps(match, ctx.organizationId);
      if (!covered.includes(ctx.operationId)) continue;
    }
    inScope.push(match);
  }

  // Pontuação por nome (reaproveita normalizeName).
  const normQuery = normalizeName(query);
  const scored = inScope
    .map((g) => {
      const normName = normalizeName(g.name);
      let score = 0;
      if (normName === normQuery) score = 100;
      else {
        const nameWords = normName.split(" ");
        const qWords = normQuery.split(" ").filter(Boolean);
        for (const qw of qWords) {
          for (const nw of nameWords) {
            if (nw === qw) score += 40;
            else if (nw.startsWith(qw) && qw.length >= 3) score += 25;
            else if (nw.includes(qw) && qw.length >= 3) score += 12;
          }
        }
      }
      return { ...g, score };
    })
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return {
      found: false, ambiguous: false, group: null, groups: [], members: [],
      message: `Nenhum grupo encontrado para "${query}" nesta operação.`,
    };
  }

  const ambiguous = scored.length > 1 && scored[0]!.score === scored[1]!.score;
  if (ambiguous) {
    return {
      found: true, ambiguous: true, group: null,
      groups: scored.map((g) => ({ id: g.id, name: g.name, scope: g.scope })),
      members: [],
      message: `Encontrei ${scored.length} grupos com nomes parecidos com "${query}". Qual você quer dizer?`,
    };
  }

  const top = scored[0]!;
  const group: GroupMatch = { id: top.id, name: top.name, scope: top.scope };

  // Membros ativos do grupo (user_roles role=MEMBER, groupId, active).
  // Quando há operação atual, restringe aos membros dessa operação — para montar escala
  // da operação corrente não faz sentido trazer membros de outra operação (grupos amplos).
  const memberConds = [
    eq(userRolesTable.groupId, group.id),
    eq(userRolesTable.role, "MEMBER"),
    eq(userRolesTable.active, true),
    ne(usersTable.status, "INACTIVE"),
  ];
  if (ctx.operationId) {
    memberConds.push(eq(userRolesTable.operationId, ctx.operationId));
  }
  const memberRows = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(userRolesTable)
    .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(and(...memberConds));
  const memberMap = new Map<string, MemberMatch>();
  for (const m of memberRows) memberMap.set(m.id, m);
  const members = [...memberMap.values()];

  return {
    found: true,
    ambiguous: false,
    group,
    groups: [group],
    members,
    message: members.length > 0
      ? `Grupo "${group.name}": ${members.length} membro(s) — ${members.map((m) => m.name).join(", ")}`
      : `Grupo "${group.name}" não tem membros ativos.`,
  };
}

// ── Cores de operação (lançam Error com mensagem amigável em caso de falha) ──────

async function coreCriarTarefa(
  ctx: ToolCtx,
  p: { title?: string; description?: string; assigneeId?: string; dueDate?: string; priority?: string },
): Promise<{ id: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  if (!ctx.operationId) throw new Error("Operação não configurada");
  if (!p.title || !p.assigneeId || !p.dueDate) throw new Error("title, assigneeId e dueDate são obrigatórios");
  const priority = (p.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") ?? "MEDIUM";
  const [task] = await db
    .insert(tasksTable)
    .values({
      organizationId: ctx.organizationId,
      operationId: ctx.operationId,
      title: p.title,
      description: p.description ?? undefined,
      creatorId: ctx.userId,
      assigneeId: p.assigneeId,
      priority,
      dueDate: p.dueDate,
      status: "CREATED",
      origin: "AI",
      requiresApproval: true,
    })
    .returning();
  return { id: task!.id };
}

async function coreRegistrarAusencia(
  ctx: ToolCtx,
  p: { userId?: string; startDate?: string; endDate?: string; date?: string; type?: string; reason?: string },
): Promise<{ id: string; startDate: string; endDate: string; type: string; isSingleDay: boolean }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  if (!p.userId) throw new Error("userId é obrigatório");
  // A folga deve ficar na operação do MEMBRO (não na operação atual do gestor),
  // para que gestores de várias operações registrem no lugar certo.
  const [memberRole] = await db
    .select({ operationId: userRolesTable.operationId })
    .from(userRolesTable)
    .where(and(eq(userRolesTable.userId, p.userId), eq(userRolesTable.active, true)))
    .limit(1);
  const targetOperationId = memberRole?.operationId ?? ctx.operationId;
  if (!targetOperationId) throw new Error("Não foi possível determinar a operação do membro");
  const startDate = ((p.startDate ?? p.date) as string | undefined) ?? "";
  if (!startDate) throw new Error("startDate é obrigatório");
  const endDate = (p.endDate ?? startDate) as string;
  const isSingleDay = startDate === endDate;
  const defaultType = isSingleDay ? "DAY_OFF" : "AFASTAMENTO";
  const absType = ((p.type as string | undefined) ?? defaultType) as typeof folgasTable.$inferInsert["type"];
  const [folga] = await db.insert(folgasTable).values({
    userId: p.userId,
    operationId: targetOperationId,
    type: absType,
    startDate,
    endDate,
    status: "ACTIVE",
    origem: "MANUAL",
    createdBy: ctx.userId,
    notes: p.reason ?? `Registrado pela ASA em ${new Date().toLocaleDateString("pt-BR")}`,
  }).returning();
  return { id: folga!.id, startDate, endDate, type: absType as string, isSingleDay };
}

async function coreCriarReconhecimento(
  ctx: ToolCtx,
  p: { userId?: string; type?: string; title?: string; message?: string },
): Promise<{ id: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  if (!p.userId || !p.type || !p.title || !p.message)
    throw new Error("userId, type, title e message são obrigatórios");
  const [recTarget] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, p.userId), eq(usersTable.organizationId, ctx.organizationId)))
    .limit(1);
  if (!recTarget) throw new Error("Membro não encontrado nesta organização");
  const [rec] = await db.insert(recognitionsTable).values({
    organizationId: ctx.organizationId,
    userId: p.userId,
    type: p.type,
    title: p.title,
    message: p.message,
    createdBy: ctx.userId,
    publishedAt: new Date(),
  }).returning();
  try {
    await sendNotification({
      userId: p.userId,
      type: "RECOGNITION_RECEIVED",
      title: "🎉 Você recebeu um reconhecimento!",
      message: p.title,
      priority: "IMPORTANT",
      category: "system",
      entityType: "recognition",
      entityId: rec!.id,
    });
  } catch (err) { console.error("Falha ao notificar reconhecimento", { targetUserId: p.userId, recognitionId: rec!.id, err }); }
  return { id: rec!.id };
}

async function coreCriarEntradaEscala(
  ctx: ToolCtx,
  p: {
    userId?: string; userName?: string; date?: string; label?: string;
    startTime?: string; endTime?: string; notes?: string; agendaEventId?: string | null;
  },
): Promise<{ id: string; scaleId: string; scaleName: string; warning: string | null }> {
  if (!ctx.operationId) throw new Error("Operação não configurada");
  if (!p.userId || !p.date || !p.label) throw new Error("userId, date e label são obrigatórios");

  const scales = await db
    .select({ id: scalesTable.id, title: scalesTable.title, status: scalesTable.status })
    .from(scalesTable)
    .where(and(
      eq(scalesTable.operationId, ctx.operationId),
      lte(scalesTable.periodStart, p.date),
      gte(scalesTable.periodEnd, p.date),
    ))
    .orderBy(desc(scalesTable.updatedAt))
    .limit(5);

  const active = scales.filter((s) => ["DRAFT", "PUBLISHED", "REPUBLISHED"].includes(s.status));
  if (active.length === 0)
    throw new Error(`Nenhuma escala ativa cobre a data ${p.date}. Crie ou gere uma escala que inclua essa data primeiro.`);

  const scale = active[0]!;

  const folgas = await db
    .select({ id: folgasTable.id, type: folgasTable.type })
    .from(folgasTable)
    .where(and(
      eq(folgasTable.userId, p.userId),
      eq(folgasTable.status, "ACTIVE"),
      lte(folgasTable.startDate, p.date),
      gte(folgasTable.endDate, p.date),
    ))
    .limit(1);

  const [entry] = await db
    .insert(scaleAllocationsTable)
    .values({
      scaleId: scale.id,
      agendaEventId: p.agendaEventId ?? null,
      userId: p.userId,
      status: "MANUAL_OVERRIDE",
      manualDate: p.date,
      manualLabel: p.label,
      startTime: p.startTime ?? null,
      endTime: p.endTime ?? null,
      notes: p.notes ?? null,
      overriddenBy: ctx.userId,
      overrideReason: "Criado via ASA",
    })
    .returning();

  const warning = folgas.length > 0
    ? `⚠️ ${p.userName ?? "Este membro"} tem folga registrada em ${p.date} (${folgas[0]!.type}).`
    : null;

  return { id: entry!.id, scaleId: scale.id, scaleName: scale.title, warning };
}

// ── Cores de cancelamento / remoção (reusados por single + desfazer_lote) ───────

async function coreCancelarTarefa(
  ctx: ToolCtx,
  taskId: string,
  acao: string = "CANCELAR",
): Promise<{ id: string; novoStatus: string; title: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  const novoStatus = acao.toUpperCase() === "CONCLUIR" ? "COMPLETED" : "CANCELLED";
  const [existing] = await db
    .select({ id: tasksTable.id, status: tasksTable.status, title: tasksTable.title })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, ctx.organizationId)))
    .limit(1);
  if (!existing) throw new Error("Tarefa não encontrada");
  if (existing.status === "CANCELLED" || existing.status === "COMPLETED")
    throw new Error(`Tarefa já está no status ${existing.status}`);
  await db.update(tasksTable).set({ status: novoStatus as typeof existing.status, updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
  return { id: taskId, novoStatus, title: existing.title };
}

async function coreCancelarAusencia(
  _ctx: ToolCtx,
  folgaId: string,
): Promise<{ id: string; startDate: string }> {
  const [existing] = await db
    .select({ id: folgasTable.id, status: folgasTable.status, startDate: folgasTable.startDate })
    .from(folgasTable)
    .where(eq(folgasTable.id, folgaId))
    .limit(1);
  if (!existing) throw new Error("Ausência não encontrada com esse ID");
  if (existing.status === "CANCELLED") throw new Error("Esta ausência já está cancelada");
  await db.update(folgasTable).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(folgasTable.id, folgaId));
  return { id: folgaId, startDate: existing.startDate };
}

async function coreRemoverEntradaEscala(
  _ctx: ToolCtx,
  allocationId: string,
): Promise<{ id: string; label: string }> {
  const [existing] = await db
    .select({ id: scaleAllocationsTable.id, status: scaleAllocationsTable.status, manualLabel: scaleAllocationsTable.manualLabel })
    .from(scaleAllocationsTable)
    .where(eq(scaleAllocationsTable.id, allocationId))
    .limit(1);
  if (!existing) throw new Error("Entrada de escala não encontrada");
  if (existing.status !== "MANUAL_OVERRIDE")
    throw new Error(`Apenas entradas manuais podem ser removidas via ASA. Esta entrada tem status "${existing.status}".`);
  await db.update(scaleAllocationsTable)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(scaleAllocationsTable.id, allocationId), eq(scaleAllocationsTable.active, true)));
  return { id: allocationId, label: existing.manualLabel ?? allocationId };
}

async function coreRemoverReconhecimento(
  ctx: ToolCtx,
  recognitionId: string,
): Promise<{ id: string; title: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  const [existing] = await db
    .select({ id: recognitionsTable.id, title: recognitionsTable.title })
    .from(recognitionsTable)
    .where(and(eq(recognitionsTable.id, recognitionId), eq(recognitionsTable.organizationId, ctx.organizationId)))
    .limit(1);
  if (!existing) throw new Error("Reconhecimento não encontrado");
  await db.delete(recognitionsTable).where(eq(recognitionsTable.id, recognitionId));
  return { id: recognitionId, title: existing.title };
}

// ── Runner resiliente de lote ───────────────────────────────────────────────────

type BatchItemResult = { ref: string; ok: boolean; id?: string; warning?: string | null; error?: string };

/**
 * Processa uma lista item a item, continuando mesmo quando um item falha.
 * Devolve resultados estruturados por item.
 */
async function runBatch<T>(
  items: T[],
  refOf: (item: T, index: number) => string,
  handler: (item: T) => Promise<{ id?: string; warning?: string | null }>,
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const ref = refOf(items[i]!, i);
    try {
      const out = await handler(items[i]!);
      results.push({ ref, ok: true, id: out.id, warning: out.warning ?? null });
    } catch (err) {
      results.push({ ref, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

/** Monta um resumo padrão de um resultado de lote. */
function summarizeBatch(noun: string, results: BatchItemResult[]): { total: number; sucessos: number; falhas: number; itens: BatchItemResult[]; message: string } {
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const okLine = ok.length > 0 ? `✓ ${ok.length} ${noun}: ${ok.map((r) => r.ref).join(", ")}` : "";
  const failLine = fail.length > 0 ? `⚠ ${fail.length} falha(s): ${fail.map((r) => `${r.ref} (${r.error})`).join("; ")}` : "";
  const message = [okLine, failLine].filter(Boolean).join("\n") || "Nenhum item processado.";
  return { total: results.length, sucessos: ok.length, falhas: fail.length, itens: results, message };
}

// ────────────────────────────────────────────────────────────────────────────
// Tool Executor
// ────────────────────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { userId: string; organizationId: string | null; userRole: string; operationId: string | null; operationIds?: string[] }
): Promise<string> {
  const isManager = MANAGER_ROLES.includes(ctx.userRole);

  try {
    if (name === "consultar_agenda") {
      if (!ctx.organizationId || !ctx.operationId) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar a Agenda." });
      const dateFrom = (input.dateFrom as string) ?? operationalDate();
      const dateTo = (input.dateTo as string) ?? shiftOperationalDate(dateFrom, 30);
      const limit = Math.min(Math.max(Number(input.limit) || 30, 1), 50);
      const conditions = [
        eq(agendaEventsTable.operationId, ctx.operationId),
        eq(operationsTable.organizationId, ctx.organizationId),
        eq(operationsTable.status, "ACTIVE"),
        gte(agendaEventsTable.date, dateFrom),
        lte(agendaEventsTable.date, dateTo),
      ];
      const orgManager = ["ADMIN", "DIR", "DIRECTOR"].includes(ctx.userRole);
      const supervisor = ctx.userRole === "SUPERVISOR_A" || ctx.userRole === "SUPERVISOR_B";
      if (orgManager || supervisor) {
        conditions.push(inArray(agendaEventsTable.status, ["CONFIRMED", "COMPLETED"]));
        conditions.push(eq(agendaEventsTable.visibility, "OPERATION"));
        if (supervisor) {
          const scopes = await listAreaLocalScopes(ctx.userId, ctx.organizationId);
          const scopeConditions = scopes.map((scope) => and(
            eq(agendaEventsTable.areaId, scope.areaId),
            or(eq(agendaEventsTable.locationId, scope.locationId), isNull(agendaEventsTable.locationId)),
          ));
          conditions.push(scopeConditions.length
            ? or(...scopeConditions)!
            : eq(agendaEventsTable.id, "00000000-0000-0000-0000-000000000000"));
        }
      } else {
        const participantRows = await db.select({ eventId: agendaEventParticipantsTable.eventId })
          .from(agendaEventParticipantsTable)
          .where(eq(agendaEventParticipantsTable.userId, ctx.userId));
        const participantIds = participantRows.map((row) => row.eventId);
        conditions.push(or(
          and(eq(agendaEventsTable.createdBy, ctx.userId), eq(agendaEventsTable.status, "CONFIRMED")),
          and(
            eq(agendaEventsTable.status, "CONFIRMED"),
            eq(agendaEventsTable.visibility, "OPERATION"),
            participantIds.length
              ? inArray(agendaEventsTable.id, participantIds)
              : eq(agendaEventsTable.id, "00000000-0000-0000-0000-000000000000"),
          ),
        )!);
      }
      const events = await db
        .select({
          title: agendaEventsTable.title,
          date: agendaEventsTable.date,
          startTime: agendaEventsTable.startTime,
          endTime: agendaEventsTable.endTime,
          location: agendaEventsTable.location,
        })
        .from(agendaEventsTable)
        .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
        .where(and(...conditions))
        .orderBy(agendaEventsTable.date, agendaEventsTable.startTime)
        .limit(limit);
      return JSON.stringify({ eventos: events });
    }

    if (name === "consultar_minhas_propostas_agenda") {
      if (!ctx.organizationId || !ctx.operationId) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar suas propostas na Agenda." });
      const proposals = await db.select({
        title: agendaEventsTable.title,
        date: agendaEventsTable.date,
        startTime: agendaEventsTable.startTime,
        endTime: agendaEventsTable.endTime,
        status: agendaEventsTable.status,
        reason: agendaEventsTable.reason,
        alternativeDetails: agendaEventsTable.alternativeDetails,
      }).from(agendaEventsTable).innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id)).where(and(
        eq(agendaEventsTable.operationId, ctx.operationId),
        eq(operationsTable.organizationId, ctx.organizationId),
        eq(operationsTable.status, "ACTIVE"),
        eq(agendaEventsTable.createdBy, ctx.userId),
        eq(agendaEventsTable.type, "MEETING"),
        inArray(agendaEventsTable.status, ["PROPOSED", "REJECTED"]),
      )).orderBy(agendaEventsTable.date, agendaEventsTable.startTime).limit(20);
      return JSON.stringify({ propostas: proposals });
    }

    if (name === "consultar_livro_do_dia") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar o Livro do Dia." });
      const date = typeof input.date === "string" ? input.date : operationalDate();
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
      const rows = await db.select({
        id: dailyBooksTable.id,
        status: dailyBooksTable.status,
        showBookId: dailyBooksTable.showBookId,
        operationId: agendaEventsTable.operationId,
        operationName: operationsTable.name,
        eventTitle: agendaEventsTable.title,
        eventDate: agendaEventsTable.date,
        startTime: agendaEventsTable.startTime,
        endTime: agendaEventsTable.endTime,
        showTitle: showBooksTable.title,
        responsibleId: showBooksTable.responsibleId,
      }).from(dailyBooksTable)
        .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
        .innerJoin(operationsTable, eq(agendaEventsTable.operationId, operationsTable.id))
        .leftJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
        .where(and(
          eq(operationsTable.organizationId, ctx.organizationId),
          eq(agendaEventsTable.operationId, ctx.operationId),
          eq(agendaEventsTable.date, date),
          ne(dailyBooksTable.status, "CANCELLED"),
        ))
        .orderBy(agendaEventsTable.startTime);
      const actor = { sub: ctx.userId, role: ctx.userRole, operationIds: ctx.operationIds ?? [] };
      const visibleRows = await Promise.all(rows.map(async (book) => ({
        book,
        visible: await canViewDailyBook(actor, book.operationId, book.status,
          book.showBookId ? { id: book.showBookId, responsibleId: book.responsibleId } : null),
      })));
      const visibleBooks = visibleRows.filter((row) => row.visible).slice(0, limit).map((row) => row.book);
      if (!visibleBooks.length) {
        return JSON.stringify({ date, livros: [], message: `Não encontrei Livros do Dia visíveis para sua conta nessa operação em ${date}.` });
      }

      const livros = await Promise.all(visibleBooks.map(async (book) => {
        const [scenes, blocks, allPositions] = await Promise.all([
          db.select({ id: dailyBookScenesTable.id, name: dailyBookScenesTable.name, order: dailyBookScenesTable.order })
            .from(dailyBookScenesTable)
            .where(and(eq(dailyBookScenesTable.dailyBookId, book.id), eq(dailyBookScenesTable.isRemoved, false), isNull(dailyBookScenesTable.supersededAt)))
            .orderBy(dailyBookScenesTable.order),
          db.select({ id: dailyBookBlocksTable.id, sceneId: dailyBookBlocksTable.sceneId, name: dailyBookBlocksTable.name, startTime: dailyBookBlocksTable.startTime, endTime: dailyBookBlocksTable.endTime, order: dailyBookBlocksTable.order })
            .from(dailyBookBlocksTable)
            .where(and(eq(dailyBookBlocksTable.dailyBookId, book.id), eq(dailyBookBlocksTable.isRemoved, false), isNull(dailyBookBlocksTable.supersededAt)))
            .orderBy(dailyBookBlocksTable.order),
          db.select({ id: dailyBookPositionsTable.id, blockId: dailyBookPositionsTable.blockId, name: dailyBookPositionsTable.name })
            .from(dailyBookPositionsTable)
            .where(and(eq(dailyBookPositionsTable.dailyBookId, book.id), eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt))),
        ]);
        const liveSceneIds = new Set(scenes.map((scene) => scene.id));
        const liveBlocks = blocks.filter((block) => !block.sceneId || liveSceneIds.has(block.sceneId));
        const liveBlockIds = new Set(liveBlocks.map((block) => block.id));
        const positions = allPositions.filter((position) => !position.blockId || liveBlockIds.has(position.blockId));
        const assignmentRows = positions.length ? await db.select({
          positionId: dailyBookAssignmentsTable.positionId,
          userName: usersTable.name,
          status: dailyBookAssignmentsTable.status,
        }).from(dailyBookAssignmentsTable)
          .leftJoin(usersTable, eq(dailyBookAssignmentsTable.userId, usersTable.id))
          .where(and(
            eq(dailyBookAssignmentsTable.dailyBookId, book.id),
            inArray(dailyBookAssignmentsTable.positionId, positions.map((position) => position.id)),
            ne(dailyBookAssignmentsTable.status, "REMOVED"),
            isNull(dailyBookAssignmentsTable.supersededAt),
          )) : [];
        const entries = positions.map((position) => {
          const block = liveBlocks.find((item) => item.id === position.blockId);
          const scene = scenes.find((item) => item.id === block?.sceneId);
          const people = assignmentRows.filter((assignment) => assignment.positionId === position.id && assignment.userName)
            .map((assignment) => assignment.userName!);
          return {
            sceneName: scene?.name ?? null,
            blockName: block?.name ?? null,
            startTime: block?.startTime ?? null,
            endTime: block?.endTime ?? null,
            positionName: position.name,
            people,
            open: people.length === 0,
          };
        });
        return {
          eventTitle: book.eventTitle,
          eventDate: book.eventDate,
          startTime: book.startTime,
          endTime: book.endTime,
          operationName: book.operationName,
          showTitle: book.showTitle,
          status: book.status,
          scenes: scenes.map((scene) => scene.name),
          entries,
        };
      }));
      return JSON.stringify({ date, livros });
    }

    if (name === "consultar_livros_do_show") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId || !(ctx.operationIds ?? []).includes(ctx.operationId)) {
        return JSON.stringify({ error: "Selecione uma operação autorizada para consultar os Livros do Show." });
      }
      const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 20);
      const rows = await db.select({
        id: showBooksTable.id,
        title: showBooksTable.title,
        description: showBooksTable.description,
        type: showBooksTable.type,
        status: showBooksTable.status,
        version: showBooksTable.version,
        responsibleId: showBooksTable.responsibleId,
        operationId: showBooksTable.operationId,
        locationName: locationsTable.name,
      }).from(showBooksTable)
        .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
        .leftJoin(locationsTable, and(
          eq(showBooksTable.locationId, locationsTable.id),
          eq(locationsTable.organizationId, ctx.organizationId),
        ))
        .where(and(
          eq(showBooksTable.operationId, ctx.operationId),
          eq(operationsTable.organizationId, ctx.organizationId),
          eq(operationsTable.status, "ACTIVE"),
          ne(showBooksTable.status, "ARCHIVED"),
        ))
        .orderBy(asc(showBooksTable.title));
      const actor = { sub: ctx.userId, role: ctx.userRole, operationIds: ctx.operationIds ?? [] };
      const visibleRows = await Promise.all(rows.map(async (book) => ({
        book,
        visible: await canViewShowBook(actor, { id: book.id, responsibleId: book.responsibleId }, book.operationId),
      })));
      if (typeof input.title === "string" && input.title.trim()) {
        const matches = visibleRows.filter(({ book, visible }) => visible
          && normalizeAsaText(book.title) === normalizeAsaText(input.title as string));
        if (matches.length === 0) return JSON.stringify({ message: "Não encontrei um Livro do Show com esse título visível para sua conta nessa operação." });
        if (matches.length > 1) return JSON.stringify({ message: "Encontrei mais de um Livro do Show visível com esse título. Peça à gestão para diferenciar os títulos antes de eu consultar a estrutura." });
        const selected = matches[0]!.book;
        const scenes = await db.select({ id: showBookScenesTable.id, name: showBookScenesTable.name })
          .from(showBookScenesTable)
          .where(and(eq(showBookScenesTable.showBookId, selected.id), eq(showBookScenesTable.active, true)))
          .orderBy(asc(showBookScenesTable.order), asc(showBookScenesTable.id));
        const blocks = await db.select({ id: showBookBlocksTable.id, sceneId: showBookBlocksTable.sceneId, name: showBookBlocksTable.name })
          .from(showBookBlocksTable)
          .where(and(eq(showBookBlocksTable.showBookId, selected.id), eq(showBookBlocksTable.active, true)))
          .orderBy(asc(showBookBlocksTable.order), asc(showBookBlocksTable.id));
        const positions = await db.select({ blockId: showBookRolesTable.blockId, name: showBookRolesTable.name, minimumCoverage: showBookRolesTable.minimumCoverage })
          .from(showBookRolesTable)
          .where(and(eq(showBookRolesTable.showBookId, selected.id), eq(showBookRolesTable.active, true)))
          .orderBy(asc(showBookRolesTable.order), asc(showBookRolesTable.id));
        const activeBlockIds = new Set(blocks.map((block) => block.id));
        const positionsWithoutActiveBlock = positions.filter((position) => !position.blockId || !activeBlockIds.has(position.blockId));
        const structure = scenes.slice(0, 20).map((scene) => {
          const sceneBlocks = blocks.filter((block) => block.sceneId === scene.id);
          return {
            name: scene.name,
            totalBlocks: sceneBlocks.length,
            omittedBlocks: Math.max(0, sceneBlocks.length - 12),
            blocks: sceneBlocks.slice(0, 12).map((block) => {
              const blockPositions = positions.filter((position) => position.blockId === block.id);
              return {
                name: block.name,
                totalPositions: blockPositions.length,
                omittedPositions: Math.max(0, blockPositions.length - 20),
                positions: blockPositions.slice(0, 20).map((position) => ({
                  name: position.name,
                  minimumCoverage: position.minimumCoverage,
                })),
              };
            }),
          };
        });
        return JSON.stringify({ book: {
          title: selected.title,
          totalScenes: scenes.length,
          omittedScenes: Math.max(0, scenes.length - 20),
          scenes: structure,
          totalUnassignedPositions: positionsWithoutActiveBlock.length,
          omittedUnassignedPositions: Math.max(0, positionsWithoutActiveBlock.length - 20),
          unassignedPositions: positionsWithoutActiveBlock.slice(0, 20).map((position) => ({
            name: position.name,
            minimumCoverage: position.minimumCoverage,
          })),
        } });
      }
      const books = visibleRows.filter((row) => row.visible).slice(0, limit).map(({ book }) => ({
        title: book.title,
        description: book.description?.slice(0, 240) ?? null,
        type: book.type,
        status: book.status,
        version: book.version,
        locationName: book.locationName,
      }));
      return JSON.stringify({
        books,
        message: books.length ? undefined : "Não encontrei Livros do Show visíveis para sua conta nessa operação.",
      });
    }

    if (name === "consultar_meu_checkin") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId || !(ctx.operationIds ?? []).includes(ctx.operationId)) {
        return JSON.stringify({ error: "Selecione uma operação autorizada para consultar seu check-in." });
      }
      const date = typeof input.date === "string" ? input.date : operationalDate();
      const [operation] = await db.select({ id: operationsTable.id })
        .from(operationsTable)
        .where(and(eq(operationsTable.id, ctx.operationId), eq(operationsTable.organizationId, ctx.organizationId), eq(operationsTable.status, "ACTIVE")))
        .limit(1);
      if (!operation) return JSON.stringify({ error: "Operação não encontrada ou inativa." });

      const [allocation] = await db.select({ operationId: scalesTable.operationId })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .innerJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
        .where(and(
          eq(scaleAllocationsTable.userId, ctx.userId),
          eq(scaleAllocationsTable.active, true),
          eq(scalesTable.operationId, ctx.operationId),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          eq(agendaEventsTable.operationId, ctx.operationId),
          eq(agendaEventsTable.date, date),
        ))
        .limit(1);
      if (!allocation) return JSON.stringify({ date, message: `Você não tem atividade publicada com check-in previsto em ${date}.` });

      const [checkIn] = await db.select({ status: operationalCheckInsTable.status, checkedInAt: operationalCheckInsTable.checkedInAt })
        .from(operationalCheckInsTable)
        .where(and(
          eq(operationalCheckInsTable.orgId, ctx.organizationId),
          eq(operationalCheckInsTable.operationId, allocation.operationId),
          eq(operationalCheckInsTable.userId, ctx.userId),
          eq(operationalCheckInsTable.date, date),
        ))
        .limit(1);
      return JSON.stringify({ date, status: checkIn?.status ?? "EXPECTED", checkedInAt: checkIn?.checkedInAt ?? null });
    }

    if (name === "consultar_checkins_equipe") {
      if (!MANAGER_ROLES.includes(ctx.userRole)) return JSON.stringify({ error: "A consulta de check-ins da equipe está disponível somente para gestores." });
      if (!ctx.organizationId || !ctx.operationId) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar os check-ins." });
      const authorized = await canManageCheckInsForOperation({
        sub: ctx.userId,
        role: ctx.userRole,
        organizationId: ctx.organizationId,
        operationIds: ctx.operationIds ?? [],
      }, ctx.operationId);
      if (!authorized) return JSON.stringify({ error: "Operação fora do escopo de check-ins." });
      const date = typeof input.date === "string" ? input.date : operationalDate();
      const expectedUsers = await db.selectDistinct({
        userId: scaleAllocationsTable.userId,
        userName: usersTable.name,
        earliestStart: sql<string>`min(${agendaEventsTable.startTime})`,
      }).from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .innerJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
        .innerJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
        .where(and(
          eq(agendaEventsTable.date, date),
          eq(agendaEventsTable.operationId, ctx.operationId),
          eq(scalesTable.operationId, ctx.operationId),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          eq(scaleAllocationsTable.active, true),
          sql`${scaleAllocationsTable.userId} IS NOT NULL`,
        ))
        .groupBy(scaleAllocationsTable.userId, usersTable.name)
        .orderBy(asc(usersTable.name));
      if (!expectedUsers.length) return JSON.stringify({ date, checkIns: [], message: `Ninguém está previsto para check-in em ${date}.` });
      const records = await db.select({ userId: operationalCheckInsTable.userId, status: operationalCheckInsTable.status, checkedInAt: operationalCheckInsTable.checkedInAt })
        .from(operationalCheckInsTable)
        .where(and(eq(operationalCheckInsTable.orgId, ctx.organizationId), eq(operationalCheckInsTable.operationId, ctx.operationId), eq(operationalCheckInsTable.date, date)));
      const byUser = new Map(records.map((record) => [record.userId, record]));
      return JSON.stringify({
        date,
        checkIns: expectedUsers.map((person) => {
          const record = byUser.get(person.userId!);
          return { userName: person.userName, earliestStart: person.earliestStart, status: record?.status ?? "EXPECTED", checkedInAt: record?.checkedInAt ?? null };
        }),
      });
    }

    if (name === "consultar_escalas" || name === "consultar_meu_dia") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today = operationalDate();
      const dateFrom = (input.dateFrom as string) ?? today;
      const dateTo   = (input.dateTo   as string) ?? shiftOperationalDate(today, 14);
      const limit    = (input.limit    as number) ?? 20;

      // Managers can query another user's allocations; otherwise always current user
      const targetUserId = (isManager && input.userId) ? (input.userId as string) : ctx.userId;

      // Find scales covering the requested period
      const scales = await db
        .select({ id: scalesTable.id, title: scalesTable.title, operationId: scalesTable.operationId, periodStart: scalesTable.periodStart, periodEnd: scalesTable.periodEnd, status: scalesTable.status })
        .from(scalesTable)
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, isManager && name === "consultar_escalas" ? ["DRAFT", "PUBLISHED", "REPUBLISHED"] : ["PUBLISHED", "REPUBLISHED"]),
          lte(scalesTable.periodStart, dateTo),
          gte(scalesTable.periodEnd,   dateFrom),
        ))
        .orderBy(desc(scalesTable.periodStart))
        .limit(10);

      if (scales.length === 0) {
        return JSON.stringify({ found: false, message: `Nenhuma escala ativa encontrada para ${dateFrom} → ${dateTo}.`, entradas: [] });
      }

      // Compõe a escala EXATAMENTE como o ecrã (alocações reais + Livro do Dia +
      // agenda + atividades recorrentes) e filtra para o membro e a janela pedida.
      const entries: Array<{
        id: string; escala: string; periodo: string; data: string;
        atividade: string | null; inicio: string | null; fim: string | null; funcao: string | null;
        status: string; origem: string; obs: string | null;
      }> = [];
      for (const s of scales) {
        if (!s.operationId) continue;
        const merged = await resolveScaleAllocations({
          id: s.id, operationId: s.operationId, periodStart: s.periodStart, periodEnd: s.periodEnd,
        });
        for (const row of merged) {
          const r = row as Record<string, any>;
          if (r["userId"] !== targetUserId) continue;
          const data = (r["manualDate"] ?? r["eventDate"]) as string | null;
          if (!data || data < dateFrom || data > dateTo) continue;
          entries.push({
            id:        String(r["id"]),
            escala:    s.title,
            periodo:   `${s.periodStart} → ${s.periodEnd}`,
            data,
            atividade: (r["manualLabel"] ?? r["eventTitle"]) ?? null,
            inicio:    (r["startTime"] ?? r["eventStartTime"]) ?? null,
            fim:       (r["endTime"] ?? r["eventEndTime"]) ?? null,
            funcao:    (r["positionName"] ?? null) as string | null,
            status:    String(r["status"]),
            origem:    r["isDailyBookParticipant"] ? "Livro do Dia"
                     : r["isAgendaParticipant"]    ? "Agenda"
                     : r["isRecurringActivity"]    ? "Atividade recorrente"
                     : "Escala (manual/fixo)",
            obs:       (r["notes"] ?? null) as string | null,
          });
        }
      }

      entries.sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const limited = entries.slice(0, limit);

      if (limited.length === 0) {
        const userName = targetUserId === ctx.userId ? "Você não está" : "Este membro não está";
        return JSON.stringify({ found: false, message: `${userName} alocado(a) em nenhuma escala entre ${dateFrom} e ${dateTo}.`, entradas: [] });
      }

      return JSON.stringify({ found: true, total: limited.length, dateFrom, dateTo, entradas: limited });
    }

    if (name === "consultar_tempo_livre") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId)   return JSON.stringify({ error: "Operação não configurada" });
      if (!(ctx.operationIds ?? []).includes(ctx.operationId)
        && !(await hasActiveResponsibility(ctx.userId, ctx.operationId, "SCALES"))) {
        return JSON.stringify({ error: "Operação fora do seu acesso autorizado." });
      }
      const date = (input.date as string) ?? operationalDate();
      const teamRoles = ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"];
      const personalQuery = input.mine === true || !teamRoles.includes(ctx.userRole);
      if (!personalQuery && !teamRoles.includes(ctx.userRole)) return JSON.stringify({ error: "Sem permissão para consultar intervalos da equipe." });
      const [operation] = await db.select({ id: operationsTable.id })
        .from(operationsTable)
        .where(and(eq(operationsTable.id, ctx.operationId), eq(operationsTable.organizationId, ctx.organizationId), eq(operationsTable.status, "ACTIVE")))
        .limit(1);
      if (!operation) return JSON.stringify({ error: "Operação não encontrada ou inativa." });
      if (!personalQuery && ctx.userRole !== "ADMIN" && ctx.userRole !== "DIR"
        && !(await hasScaleAuthority(ctx.userId, ctx.operationId, undefined, undefined, undefined, true))) {
        return JSON.stringify({ error: "Você não tem autoridade de leitura da Escala nesta operação." });
      }
      const onlyUserId = personalQuery ? ctx.userId : null;

      const [scale] = await db
        .select({ id: scalesTable.id, operationId: scalesTable.operationId, periodStart: scalesTable.periodStart, periodEnd: scalesTable.periodEnd })
        .from(scalesTable)
        .where(and(
          eq(scalesTable.operationId, ctx.operationId),
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          lte(scalesTable.periodStart, date),
          gte(scalesTable.periodEnd,   date),
        ))
        .orderBy(desc(scalesTable.periodStart))
        .limit(1);

      if (!scale || !scale.operationId) {
        return JSON.stringify({ found: false, date, mine: personalQuery, message: `Nenhuma escala publicada cobre ${date} nessa operação.`, membros: [] });
      }

      const merged = await resolveScaleAllocations({
        id: scale.id, operationId: scale.operationId, periodStart: scale.periodStart, periodEnd: scale.periodEnd,
      });

      // Agrupa blocos do dia por membro
      const byUser = new Map<string, { name: string | null; blocks: Array<{ startTime: string | null; endTime: string | null; label: string | null }> }>();
      for (const row of merged) {
        const r = row as Record<string, any>;
        const d = (r["manualDate"] ?? r["eventDate"]) as string | null;
        if (d !== date) continue;
        const uid = r["userId"] as string | null;
        if (!uid) continue;
        if (onlyUserId && uid !== onlyUserId) continue;
        let u = byUser.get(uid);
        if (!u) { u = { name: (r["userName"] ?? null) as string | null, blocks: [] }; byUser.set(uid, u); }
        u.blocks.push({
          startTime: (r["startTime"] ?? r["eventStartTime"]) ?? null,
          endTime:   (r["endTime"] ?? r["eventEndTime"]) ?? null,
          label:     (r["manualLabel"] ?? r["eventTitle"]) ?? null,
        });
      }

      if (byUser.size === 0) {
        return JSON.stringify({ found: false, date, mine: personalQuery, message: onlyUserId ? `Você não tem blocos na escala publicada em ${date}.` : `Ninguém está escalado em ${date}.`, membros: [] });
      }

      // Folgas ACTIVE que cobrem a data → membro indisponível (não conta tempo livre)
      const folgaRows = await db
        .select({ userId: folgasTable.userId, type: folgasTable.type })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.operationId, scale.operationId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate,   date),
        ));
      const unavailable = new Set(folgaRows.map(f => f.userId).filter((x): x is string => !!x));

      const membros: Array<{ nome: string | null; livres: Array<{ inicio: string; fim: string }>; blocos: Array<{ inicio: string; fim: string; atividade: string | null }> }> = [];
      for (const [userId, info] of byUser) {
        if (unavailable.has(userId)) continue;
        const gaps = computeFreeGaps(info.blocks);
        if (gaps.length === 0) continue;
        membros.push({
          nome: info.name,
          livres: gaps.map(g => ({ inicio: g.start, fim: g.end })),
          blocos: info.blocks
            .filter(b => b.startTime && b.endTime)
            .map(b => ({ inicio: b.startTime as string, fim: b.endTime as string, atividade: b.label })),
        });
      }

      membros.sort((a, b) => String(a.nome ?? "").localeCompare(String(b.nome ?? "")));

      if (membros.length === 0) {
        return JSON.stringify({ found: false, date, mine: personalQuery, criterio: "intervalos livres de pelo menos uma hora entre atividades da escala publicada; pessoas com folga ativa são excluídas", message: onlyUserId ? `Você não tem intervalos livres de pelo menos uma hora entre atividades em ${date}.` : `Ninguém tem intervalos livres de pelo menos uma hora entre atividades em ${date}.`, membros: [] });
      }

      return JSON.stringify({ found: true, date, mine: personalQuery, criterio: "intervalos livres de pelo menos uma hora entre atividades da escala publicada; pessoas com folga ativa são excluídas", total: membros.length, membros: membros.slice(0, 50) });
    }

    if (name === "consultar_responsabilidades") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (input.mine) {
        const now = new Date();
        const assigned = await db
          .select({
            name: responsibilitiesTable.title,
            category: responsibilitiesTable.category,
            role: responsibilityAssignmentsTable.role,
            startsAt: responsibilityAssignmentsTable.startsAt,
            endsAt: responsibilityAssignmentsTable.endsAt,
          })
          .from(responsibilityAssignmentsTable)
          .innerJoin(responsibilitiesTable, eq(responsibilitiesTable.id, responsibilityAssignmentsTable.responsibilityId))
          .where(and(
            eq(responsibilitiesTable.orgId, ctx.organizationId),
            eq(responsibilitiesTable.active, true),
            eq(responsibilityAssignmentsTable.memberId, ctx.userId),
            eq(responsibilityAssignmentsTable.active, true),
            sql`(${responsibilityAssignmentsTable.startsAt} IS NULL OR ${responsibilityAssignmentsTable.startsAt} <= ${now})`,
            sql`(${responsibilityAssignmentsTable.endsAt} IS NULL OR ${responsibilityAssignmentsTable.endsAt} >= ${now})`,
          ))
          .orderBy(responsibilitiesTable.title)
          .limit(50);
        return JSON.stringify({ responsabilidades: assigned });
      }
      return JSON.stringify({ error: "A consulta individual exige escopo pessoal explícito." });
    }

    if (name === "consultar_responsabilidades_equipe") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const isDefinitionManager = ctx.userRole === "ADMIN" || ctx.userRole === "DIR";
      const isSupervisor = ctx.userRole === "SUPERVISOR_A" || ctx.userRole === "SUPERVISOR_B";
      if (!isDefinitionManager && !isSupervisor) {
        return JSON.stringify({ error: "A consulta de responsabilidades da equipe está disponível somente para Administração, Direção e Supervisão dentro do próprio escopo." });
      }
      const now = new Date();
      if (ctx.operationId && !(ctx.operationIds ?? []).includes(ctx.operationId)) {
        return JSON.stringify({ error: "Selecione uma operação autorizada para consultar responsabilidades." });
      }
      const conditions = [
        eq(responsibilitiesTable.orgId, ctx.organizationId),
        eq(responsibilitiesTable.active, true),
      ];
      if (ctx.operationId) conditions.push(eq(responsibilitiesTable.operationId, ctx.operationId));
      if (input.unassigned === true) {
        const currentAssignment = db.select({ id: responsibilityAssignmentsTable.id })
          .from(responsibilityAssignmentsTable)
          .innerJoin(usersTable, eq(usersTable.id, responsibilityAssignmentsTable.memberId))
          .where(and(
            eq(responsibilityAssignmentsTable.responsibilityId, responsibilitiesTable.id),
            eq(responsibilityAssignmentsTable.active, true),
            eq(usersTable.organizationId, ctx.organizationId),
            ne(usersTable.status, "INACTIVE"),
            or(isNull(responsibilityAssignmentsTable.startsAt), lte(responsibilityAssignmentsTable.startsAt, now))!,
            or(isNull(responsibilityAssignmentsTable.endsAt), gte(responsibilityAssignmentsTable.endsAt, now))!,
          )).limit(1);
        conditions.push(notExists(currentAssignment));
      }
      if (isSupervisor) {
        if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar responsabilidades." });
        const scopes = await listAreaLocalScopes(ctx.userId, ctx.organizationId);
        const areaIds = [...new Set(scopes.map((scope) => scope.areaId))];
        if (!areaIds.length) return JSON.stringify({ message: "Não há responsabilidades no seu escopo de área nesta operação.", responsabilidades: [] });
        conditions.push(inArray(responsibilitiesTable.areaId, areaIds));
      }
      const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
      const rows = await db.select({
        id: responsibilitiesTable.id,
        name: responsibilitiesTable.title,
        category: responsibilitiesTable.category,
        areaName: areasTable.name,
      }).from(responsibilitiesTable)
        .leftJoin(areasTable, eq(responsibilitiesTable.areaId, areasTable.id))
        .where(and(...conditions))
        .orderBy(asc(responsibilitiesTable.title))
        .limit(limit);
      if (!rows.length) return JSON.stringify({ message: "Não encontrei responsabilidades ativas no escopo autorizado.", responsabilidades: [] });
      const assignments = await db.select({
        responsibilityId: responsibilityAssignmentsTable.responsibilityId,
        name: usersTable.name,
        role: responsibilityAssignmentsTable.role,
      }).from(responsibilityAssignmentsTable)
        .innerJoin(usersTable, eq(usersTable.id, responsibilityAssignmentsTable.memberId))
        .where(and(
          inArray(responsibilityAssignmentsTable.responsibilityId, rows.map((item) => item.id)),
          eq(responsibilityAssignmentsTable.active, true),
          eq(usersTable.organizationId, ctx.organizationId),
          ne(usersTable.status, "INACTIVE"),
          or(isNull(responsibilityAssignmentsTable.startsAt), lte(responsibilityAssignmentsTable.startsAt, now))!,
          or(isNull(responsibilityAssignmentsTable.endsAt), gte(responsibilityAssignmentsTable.endsAt, now))!,
        ));
      const assignmentsByResponsibility = new Map<string, Array<{ name: string; role: string }>>();
      for (const assignment of assignments) {
        const current = assignmentsByResponsibility.get(assignment.responsibilityId) ?? [];
        current.push({ name: assignment.name, role: assignment.role });
        assignmentsByResponsibility.set(assignment.responsibilityId, current);
      }
      return JSON.stringify({ responsabilidades: rows.map(({ id, ...item }) => ({
        ...item,
        responsaveis: assignmentsByResponsibility.get(id) ?? [],
      })) });
    }

    if (name === "consultar_notificacoes") {
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
      const now = new Date();
      const conditions = [
        eq(userNotificationsTable.userId, ctx.userId),
        or(isNull(userNotificationsTable.expiresAt), gte(userNotificationsTable.expiresAt, now))!,
        ...(input.unreadOnly ? [isNull(userNotificationsTable.readAt)] : []),
      ];
      const notifs = await db
        .select({
          type: userNotificationsTable.type,
          title: userNotificationsTable.title,
          body: userNotificationsTable.message,
          priority: userNotificationsTable.priority,
          readAt: userNotificationsTable.readAt,
          createdAt: userNotificationsTable.createdAt,
        })
        .from(userNotificationsTable)
        .where(and(...conditions))
        .orderBy(desc(userNotificationsTable.createdAt))
        .limit(limit);
      return JSON.stringify(notifs);
    }

    if (name === "consultar_mensagens") {
      if (!ctx.organizationId) return JSON.stringify({ mensagens: [] });
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
      const searchTerm = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
      const senderName = typeof input.senderName === "string" ? input.senderName.trim().slice(0, 120) : "";
      const escapedSearchTerm = searchTerm.replace(/[\\%_]/g, "\\$&");
      const escapedSenderName = senderName.replace(/[\\%_]/g, "\\$&");
      const filters = [
        eq(messageThreadParticipantsTable.userId, ctx.userId),
        eq(messageThreadsTable.orgId, ctx.organizationId),
        ...(input.unreadOnly === true
          ? [or(
              isNull(messageThreadParticipantsTable.lastReadAt),
              gt(messagesTable.createdAt, messageThreadParticipantsTable.lastReadAt),
            )!]
          : []),
        ...(searchTerm
          ? [or(
              ilike(messagesTable.content, `%${escapedSearchTerm}%`),
              ilike(messageThreadsTable.title, `%${escapedSearchTerm}%`),
            )!]
          : []),
        ...(senderName ? [ilike(messagesTable.senderName, `%${escapedSenderName}%`)] : []),
      ];
      const mensagens = await db
        .select({
          threadTitle: messageThreadsTable.title,
          senderName: messagesTable.senderName,
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .innerJoin(messageThreadParticipantsTable, eq(messageThreadParticipantsTable.threadId, messagesTable.threadId))
        .innerJoin(messageThreadsTable, eq(messageThreadsTable.id, messagesTable.threadId))
        .where(and(...filters))
        .orderBy(desc(messagesTable.createdAt))
        .limit(limit);
      return JSON.stringify({ mensagens, unreadOnly: input.unreadOnly === true });
    }

    if (name === "consultar_mural") {
      if (!ctx.organizationId) return JSON.stringify({ posts: [], message: "Organização não configurada." });
      const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
      const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
      const candidates = await db.select({
        id: announcementsTable.id,
        type: announcementsTable.type,
        scope: announcementsTable.scope,
        areaId: announcementsTable.areaId,
        areaName: areasTable.name,
        locationId: announcementsTable.locationId,
        locationName: locationsTable.name,
        title: announcementsTable.title,
        body: announcementsTable.body,
        authorName: usersTable.name,
        publishedAt: announcementsTable.publishedAt,
        requiresConfirmation: announcementsTable.requiresConfirmation,
      }).from(announcementsTable)
        .innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
        .leftJoin(areasTable, eq(announcementsTable.areaId, areasTable.id))
        .leftJoin(locationsTable, eq(announcementsTable.locationId, locationsTable.id))
        .where(and(
          eq(announcementsTable.orgId, ctx.organizationId),
          eq(announcementsTable.active, true),
          isNull(announcementsTable.cancelledAt),
          ...(query ? [or(ilike(announcementsTable.title, `%${escapedQuery}%`), ilike(announcementsTable.body, `%${escapedQuery}%`))!] : []),
        ))
        .orderBy(desc(announcementsTable.publishedAt));
      const actor = { userId: ctx.userId, organizationId: ctx.organizationId, role: ctx.userRole };
      const visible = [];
      for (const post of candidates) if (await canReadAnnouncement(actor, post)) visible.push(post);
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
      const limited = visible.slice(0, limit);
      const reads = limited.length ? await db.select({ announcementId: announcementReadsTable.announcementId, confirmedAt: announcementReadsTable.confirmedAt })
        .from(announcementReadsTable)
        .where(and(eq(announcementReadsTable.userId, ctx.userId), inArray(announcementReadsTable.announcementId, limited.map((post) => post.id)))) : [];
      const readById = new Map(reads.map((read) => [read.announcementId, read]));
      return JSON.stringify({ posts: limited.map((post) => ({ ...post, confirmedAt: readById.get(post.id)?.confirmedAt ?? null })) });
    }

    if (name === "consultar_pessoas") {
      if (!ctx.organizationId) return JSON.stringify({ pessoas: [], message: "Organização não configurada." });
      const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
      if (!query) return JSON.stringify({ pessoas: [], message: "Diga o nome ou a área que você quer buscar." });
      const pessoas = await listCommunicationPeople(ctx.organizationId, query, 20);
      return JSON.stringify({ pessoas: pessoas.map(({ name, areaName }) => ({ name, areaName })) });
    }

    if (name === "consultar_locais") {
      if (!ctx.organizationId) return JSON.stringify({ locais: [], message: "Organização não configurada." });
      const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : undefined;
      const locais = await listReadableLocations(ctx.organizationId, ctx.userId, ctx.userRole, query, 20);
      if (!locais) return JSON.stringify({ locais: [], message: "A consulta de locais está disponível somente para Administração, Direção e Supervisão." });
      return JSON.stringify({ locais: locais.map(({ name, type }) => ({ name, type })) });
    }

    if (name === "consultar_entregas") {
      if (!ctx.organizationId) return JSON.stringify({ entregas: [], message: "Organização não configurada." });
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
      if (input.scope === "team") {
        if (!["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(ctx.userRole)) {
          return JSON.stringify({ scope: "team", entregas: [], message: "A consulta de entregas da equipe está disponível somente para Administração e Supervisão." });
        }
        if (!ctx.operationId || !(ctx.operationIds ?? []).includes(ctx.operationId)) {
          return JSON.stringify({ scope: "team", entregas: [], message: "Selecione uma operação autorizada para consultar as entregas da equipe." });
        }
        const entregas = await db.select({
          title: deliveriesTable.title,
          type: deliveriesTable.type,
          dueDate: deliveriesTable.dueDate,
          assignedCount: sql<number>`count(distinct ${deliveryAssignmentsTable.id})::int`,
          completedCount: sql<number>`count(distinct ${deliveryAssignmentsTable.id}) filter (where ${deliveryAssignmentsTable.status} = 'COMPLETED')::int`,
        }).from(deliveryAssignmentsTable)
          .innerJoin(deliveriesTable, eq(deliveryAssignmentsTable.deliveryId, deliveriesTable.id))
          .innerJoin(operationsTable, eq(deliveriesTable.operationId, operationsTable.id))
          .innerJoin(usersTable, eq(deliveryAssignmentsTable.userId, usersTable.id))
          .innerJoin(userRolesTable, and(
            eq(userRolesTable.userId, usersTable.id),
            eq(userRolesTable.operationId, deliveriesTable.operationId),
            eq(userRolesTable.active, true),
          ))
          .where(and(
            eq(operationsTable.organizationId, ctx.organizationId),
            eq(operationsTable.id, ctx.operationId),
            eq(operationsTable.status, "ACTIVE"),
            eq(usersTable.organizationId, ctx.organizationId),
            eq(usersTable.status, "ACTIVE"),
            eq(deliveriesTable.status, "PUBLISHED"),
            isNotNull(deliveriesTable.publishedAt),
            isNull(deliveriesTable.cancelledAt),
          ))
          .groupBy(deliveriesTable.id, deliveriesTable.title, deliveriesTable.type, deliveriesTable.dueDate)
          .orderBy(desc(deliveriesTable.publishedAt))
          .limit(limit);
        return JSON.stringify({ scope: "team", entregas });
      }
      const entregas = await db.select({
        title: deliveriesTable.title,
        type: deliveriesTable.type,
        dueDate: deliveriesTable.dueDate,
        status: deliveryAssignmentsTable.status,
      }).from(deliveryAssignmentsTable)
        .innerJoin(deliveriesTable, eq(deliveryAssignmentsTable.deliveryId, deliveriesTable.id))
        .innerJoin(operationsTable, eq(deliveriesTable.operationId, operationsTable.id))
        .where(and(
          eq(deliveryAssignmentsTable.userId, ctx.userId),
          eq(operationsTable.organizationId, ctx.organizationId),
        ))
        .orderBy(desc(deliveriesTable.publishedAt))
        .limit(limit);
      return JSON.stringify({ entregas });
    }

    if (name === "consultar_relatorio_checkins") {
      if (ctx.userRole !== "ADMIN") return JSON.stringify({ error: "O resumo agregado de check-ins está disponível somente para Administração." });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada." });
      const period = (["today", "7d", "30d"].includes(String(input.period)) ? String(input.period) : "7d") as CheckInInsightPeriod;
      const { startDate, endDate } = checkInPeriodDates(period);
      const operations = await db.select({ id: operationsTable.id }).from(operationsTable).where(eq(operationsTable.organizationId, ctx.organizationId));
      const operationIds = operations.map((operation) => operation.id);
      const records = operationIds.length ? await db.select({ status: operationalCheckInsTable.status })
        .from(operationalCheckInsTable)
        .where(and(
          eq(operationalCheckInsTable.orgId, ctx.organizationId),
          inArray(operationalCheckInsTable.operationId, operationIds),
          gte(operationalCheckInsTable.date, startDate),
          lte(operationalCheckInsTable.date, endDate),
        )) : [];
      return JSON.stringify({ period, startDate, endDate, ...summarizeCheckIns(records) });
    }

    if (name === "consultar_relatorio_tarefas") {
      if (ctx.userRole !== "ADMIN" && ctx.userRole !== "DIR") return JSON.stringify({ error: "O resumo agregado de tarefas está disponível somente para Administração e Direção." });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada." });
      const period = (["today", "7d", "30d"].includes(String(input.period)) ? String(input.period) : "7d") as TaskInsightPeriod;
      const { startDate, endDate } = taskPeriodDates(period, operationalDate());
      const conditions = [eq(tasksTable.organizationId, ctx.organizationId), gte(tasksTable.dueDate, startDate), lte(tasksTable.dueDate, endDate)];
      if (ctx.operationId) {
        if (!(ctx.operationIds ?? []).includes(ctx.operationId)) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar as tarefas." });
        conditions.push(eq(tasksTable.operationId, ctx.operationId));
      }
      const rows = await db.select({ status: tasksTable.status, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(...conditions))
        .groupBy(tasksTable.status);
      return JSON.stringify({ period, startDate, endDate, ...summarizeTasks(rows) });
    }

    if (name === "consultar_avisos") {
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
      if (!ctx.organizationId) return JSON.stringify({ avisos: [], message: "Organização não configurada" });
      const now = new Date();
      const notices = await db
        .select({
          title: noticesTable.title,
          content: noticesTable.content,
          urgency: noticesTable.urgency,
          publishedAt: noticesTable.publishedAt,
          expiresAt: noticesTable.expiresAt,
          recipientStatus: noticeRecipientsTable.status,
          viewedAt: noticeRecipientsTable.viewedAt,
          confirmedAt: noticeRecipientsTable.confirmedAt,
        })
        .from(noticesTable)
        .innerJoin(noticeRecipientsTable, eq(noticeRecipientsTable.noticeId, noticesTable.id))
        .innerJoin(operationsTable, eq(operationsTable.id, noticesTable.operationId))
        .where(and(
          eq(noticeRecipientsTable.userId, ctx.userId),
          eq(operationsTable.organizationId, ctx.organizationId),
          eq(noticesTable.status, "PUBLISHED"),
          or(isNull(noticesTable.expiresAt), gte(noticesTable.expiresAt, now)),
        ))
        .orderBy(desc(noticesTable.publishedAt))
        .limit(limit);
      return JSON.stringify({ avisos: notices });
    }

    if (name === "consultar_tarefas") {
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      // Managers can query any user's tasks; members see only their own
      const targetUserId = (isManager && input.userId) ? (input.userId as string) : ctx.userId;

      const conditions: ReturnType<typeof eq>[] = [
        eq(tasksTable.organizationId, ctx.organizationId),
        eq(tasksTable.assigneeId, targetUserId),
      ];
      if (input.status === "PENDING") {
        conditions.push(inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]));
      } else if (input.status === "ACTIONABLE") {
        conditions.push(inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]));
      } else if (input.status) {
        conditions.push(eq(tasksTable.status, input.status as any));
      }
      if (typeof input.dateFrom === "string") conditions.push(gte(tasksTable.dueDate, input.dateFrom));
      if (typeof input.dateTo === "string") conditions.push(lte(tasksTable.dueDate, input.dateTo));

      const tasks = await db
        .select({
          id:          tasksTable.id,
          title:       tasksTable.title,
          description: tasksTable.description,
          status:      tasksTable.status,
          priority:    tasksTable.priority,
          dueDate:     tasksTable.dueDate,
          origin:      tasksTable.origin,
          responsibilityTitle: responsibilitiesTable.title,
          operationName: operationsTable.name,
        })
        .from(tasksTable)
        .leftJoin(responsibilitiesTable, eq(tasksTable.responsibilityId, responsibilitiesTable.id))
        .innerJoin(operationsTable, eq(tasksTable.operationId, operationsTable.id))
        .where(and(...conditions))
        .orderBy(tasksTable.dueDate, desc(tasksTable.createdAt))
        .limit(limit);

      if (tasks.length === 0) {
        const isSelf = targetUserId === ctx.userId;
        return JSON.stringify({ found: false, message: isSelf ? "Você não tem tarefas atribuídas no momento." : "Este membro não tem tarefas atribuídas.", tarefas: [] });
      }

      return JSON.stringify({ found: true, total: tasks.length, tarefas: tasks });
    }

    if (name === "consultar_tarefa_requisitos") {
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!ctx.organizationId || !ctx.operationId || !title) return JSON.stringify({ found: false, message: "Selecione uma operação autorizada e diga o título exato da sua tarefa entre aspas." });
      const matches = await db.select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        requiresApproval: tasksTable.requiresApproval,
        mandatoryChecklist: tasksTable.mandatoryChecklist,
        mandatoryEvidences: tasksTable.mandatoryEvidences,
      }).from(tasksTable)
        .innerJoin(operationsTable, and(
          eq(operationsTable.id, tasksTable.operationId),
          eq(operationsTable.id, ctx.operationId),
          eq(operationsTable.organizationId, ctx.organizationId),
          eq(operationsTable.status, "ACTIVE"),
        ))
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          eq(tasksTable.operationId, ctx.operationId),
          eq(tasksTable.assigneeId, ctx.userId),
          eq(tasksTable.title, title),
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
        ))
        .limit(2);
      const task = matches[0];
      if (!task) return JSON.stringify({ found: false, message: "Não encontrei uma tarefa aberta com esse título entre as suas atribuições." });
      if (matches.length > 1) return JSON.stringify({ found: false, message: "Encontrei mais de uma tarefa aberta sua com esse título nesta operação. Inclua outro detalhe para diferenciá-las." });

      const requirements = task.mandatoryEvidences ?? [];
      const uploaded = requirements.length ? await db.select({ referenceId: taskEvidencesTable.mandatoryEvidenceRefId })
        .from(taskEvidencesTable)
        .where(and(
          eq(taskEvidencesTable.taskId, task.id),
          eq(taskEvidencesTable.isRequired, true),
          eq(taskEvidencesTable.active, true),
        )) : [];
      const fulfilled = new Set(uploaded.map((item) => item.referenceId).filter((id): id is string => id !== null));
      return JSON.stringify({
        found: true,
        title: task.title,
        status: task.status,
        requiresApproval: task.requiresApproval,
        itensPendentes: (task.mandatoryChecklist ?? []).filter((item) => !item.completed).map((item) => item.label),
        evidenciasPendentes: requirements.filter((item) => !fulfilled.has(item.id)).map((item) => item.description || item.type),
      });
    }

    if (name === "consultar_tarefas_equipe") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const teamManagerRoles = ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"];
      if (!teamManagerRoles.includes(ctx.userRole)) return JSON.stringify({ error: "A consulta de tarefas da equipe está disponível somente para gestores." });
      const conditions: ReturnType<typeof eq>[] = [eq(tasksTable.organizationId, ctx.organizationId)];
      if (ctx.operationId) conditions.push(eq(tasksTable.operationId, ctx.operationId));

      if (ctx.userRole === "SUPERVISOR_A" || ctx.userRole === "SUPERVISOR_B") {
        if (!ctx.operationId || !(ctx.operationIds ?? []).includes(ctx.operationId)) {
          return JSON.stringify({ error: "Selecione uma operação autorizada para consultar as tarefas." });
        }
        const areaIds = await listTaskManagementAreaIds(ctx.userId, ctx.operationId, ctx.organizationId);
        if (areaIds === null) return JSON.stringify({ error: "Você não tem a delegação necessária para consultar tarefas nesta operação." });
        if (areaIds.length === 0) return JSON.stringify({ found: false, message: "Não há tarefas no seu escopo de área nesta operação.", tarefas: [] });
        conditions.push(or(inArray(usersTable.areaId, areaIds), inArray(responsibilitiesTable.areaId, areaIds))!);
      }

      if (input.status === "PENDING") {
        conditions.push(inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]));
      } else if (input.status === "ACTIONABLE") {
        conditions.push(inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]));
      } else if (input.status) {
        conditions.push(eq(tasksTable.status, input.status as any));
      }
      if (typeof input.dateFrom === "string") conditions.push(gte(tasksTable.dueDate, input.dateFrom));
      if (typeof input.dateTo === "string") conditions.push(lte(tasksTable.dueDate, input.dateTo));

      const tasks = await db.select({
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        origin: tasksTable.origin,
        responsibilityTitle: responsibilitiesTable.title,
        operationName: operationsTable.name,
        assigneeName: usersTable.name,
      }).from(tasksTable)
        .innerJoin(operationsTable, eq(tasksTable.operationId, operationsTable.id))
        .innerJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .leftJoin(responsibilitiesTable, eq(tasksTable.responsibilityId, responsibilitiesTable.id))
        .where(and(...conditions))
        .orderBy(tasksTable.dueDate, desc(tasksTable.createdAt))
        .limit(Math.min(Math.max(Number(input.limit) || 20, 1), 50));

      if (!tasks.length) return JSON.stringify({ found: false, message: "Não encontrei tarefas no escopo autorizado para esse filtro.", tarefas: [] });
      return JSON.stringify({ found: true, total: tasks.length, tarefas: tasks });
    }

    if (name === "consultar_memorias") {
      const conditions = [eq(asaMemoriesTable.status, "APPROVED")];
      if (input.type) {
        conditions.push(eq(asaMemoriesTable.type, input.type as "PERSONAL" | "OPERATIONAL" | "OFFICIAL"));
      }
      if (ctx.organizationId) {
        conditions.push(eq(asaMemoriesTable.organizationId, ctx.organizationId));
      }
      const memories = await db
        .select()
        .from(asaMemoriesTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .limit(30);
      return JSON.stringify(memories.map(m => ({ key: m.key, value: m.value, type: m.type })));
    }

    if (name === "criar_aviso_rascunho") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar avisos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar avisos" });
      const [notice] = await db.insert(noticesTable).values({
        title: input.title as string,
        content: input.content as string,
        type: (input.type as "INFORMATIVE" | "IMPORTANT" | "PERSISTENT" | "ESCALATED") ?? "INFORMATIVE",
        urgency: (input.urgency as "INFORMATIVE" | "IMPORTANT" | "CRITICAL") ?? "IMPORTANT",
        operationId: ctx.operationId,
        authorId: ctx.userId,
        status: "DRAFT",
      }).returning();
      return JSON.stringify({
        created: true,
        id: notice.id,
        status: "DRAFT",
        message: "Aviso criado como rascunho. Para publicar, acesse a seção de Avisos e clique em Publicar.",
      });
    }

    if (name === "criar_ensaio_rascunho") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar ensaios" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar ensaios" });
      const rawDate = (input.date as string | undefined) ?? operationalDate();
      const [event] = await db.insert(agendaEventsTable).values({
        title: input.title as string,
        type: "REHEARSAL",
        date: rawDate,
        startTime: (input.startTime as string | undefined) ?? null,
        endTime: (input.endTime as string | undefined) ?? null,
        location: (input.location as string | undefined) ?? null,
        notes: (input.description as string | undefined) ?? null,
        operationId: ctx.operationId,
        createdBy: ctx.userId,
        status: "DRAFT",
        visibility: "MANAGEMENT",
      }).returning();
      return JSON.stringify({
        created: true,
        id: event.id,
        status: "DRAFT",
        message: "Ensaio criado. Para confirmar e tornar visível à equipe, acesse a Agenda e confirme o evento.",
      });
    }

    if (name === "sugerir_memoria") {
      const [memory] = await db.insert(asaMemoriesTable).values({
        type: input.type as "PERSONAL" | "OPERATIONAL" | "OFFICIAL",
        key: input.key as string,
        value: input.value as string,
        scope: ctx.userId,
        organizationId: ctx.organizationId ?? undefined,
        createdBy: ctx.userId,
        status: "PENDING",
      }).returning();
      return JSON.stringify({ suggested: true, id: memory.id, status: "PENDING", message: "Memória sugerida. Aguarda aprovação." });
    }

    if (name === "consultar_folgas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today = operationalDate();
      const dateFrom = (input.dateFrom as string) ?? today;
      const dateTo   = (input.dateTo   as string) ?? dateFrom;
      const limit    = Math.min(Math.max(Number(input.limit) || 20, 1), 50);

      const conditions: any[] = [
        eq(folgasTable.userId, ctx.userId),
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, dateTo),
        gte(folgasTable.endDate,   dateFrom),
      ];
      if (input.type)   conditions.push(eq(folgasTable.type,     input.type   as any));

      const rows = await db
        .select({
          type:      folgasTable.type,
          startDate: folgasTable.startDate,
          endDate:   folgasTable.endDate,
          origem:    folgasTable.origem,
          notes:     folgasTable.notes,
        })
        .from(folgasTable)
        .innerJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .innerJoin(operationsTable, eq(folgasTable.operationId, operationsTable.id))
        .where(and(...conditions, eq(usersTable.organizationId, ctx.organizationId), eq(operationsTable.organizationId, ctx.organizationId)))
        .orderBy(folgasTable.startDate)
        .limit(limit);

      return JSON.stringify({ total: rows.length, folgas: rows });
    }

    if (name === "consultar_solicitacoes") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const rows = await db.select({
        type: requestsTable.type,
        status: requestsTable.status,
        targetDates: requestsTable.targetDates,
        operationName: operationsTable.name,
      }).from(requestsTable)
        .innerJoin(operationsTable, eq(requestsTable.operationId, operationsTable.id))
        .where(and(
          eq(requestsTable.requesterId, ctx.userId),
          eq(operationsTable.organizationId, ctx.organizationId),
        ))
        .orderBy(desc(requestsTable.createdAt))
        .limit(Math.min(Math.max(Number(input.limit) || 20, 1), 20));
      return JSON.stringify({ solicitacoes: rows });
    }

    if (name === "consultar_ausencias_do_dia") {
      if (!isManager) return JSON.stringify({ error: "A lista de folgas da equipe está disponível somente para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId || !(ctx.operationIds ?? []).includes(ctx.operationId)) return JSON.stringify({ error: "Selecione uma operação autorizada para consultar as folgas" });
      const [operation] = await db.select({ id: operationsTable.id })
        .from(operationsTable)
        .where(and(eq(operationsTable.id, ctx.operationId), eq(operationsTable.organizationId, ctx.organizationId), eq(operationsTable.status, "ACTIVE")))
        .limit(1);
      if (!operation) return JSON.stringify({ error: "Operação não encontrada ou inativa." });
      if (ctx.userRole !== "ADMIN") {
        const [activeRole] = await db.select({ id: userRolesTable.id })
          .from(userRolesTable)
          .where(and(
            eq(userRolesTable.userId, ctx.userId),
            eq(userRolesTable.operationId, ctx.operationId),
            eq(userRolesTable.active, true),
          ))
          .limit(1);
        if (!activeRole) return JSON.stringify({ error: "Você não tem acesso ativo a esta operação." });
      }
      const date = (input.date as string) ?? operationalDate();

      const rows = await db
        .select({
          id:        folgasTable.id,
          type:      folgasTable.type,
          startDate: folgasTable.startDate,
          endDate:   folgasTable.endDate,
          origem:    folgasTable.origem,
          userName:  usersTable.name,
          userId:    folgasTable.userId,
        })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(
          eq(folgasTable.operationId, ctx.operationId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate,   date),
        ))
        .orderBy(usersTable.name);

      if (rows.length === 0) {
        return JSON.stringify({ date, message: `Nenhum membro está de folga em ${date}.`, ausencias: [] });
      }
      return JSON.stringify({
        date,
        total: rows.length,
        message: `${rows.length} membro(s) ausente(s) em ${date}.`,
        ausencias: rows,
      });
    }

    if (name === "consultar_disponibilidade") {
      const { userId: targetId, date } = input as { userId: string; date: string };
      const folgas = await db
        .select({ id: folgasTable.id, type: folgasTable.type, startDate: folgasTable.startDate, endDate: folgasTable.endDate })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.userId, targetId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate,   date),
        ))
        .limit(1);

      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, targetId));
      const userName = user?.name ?? targetId;

      if (folgas.length === 0) {
        return JSON.stringify({ disponivel: true,  message: `${userName} está disponível em ${date} (sem folga registrada).` });
      }
      return JSON.stringify({ disponivel: false, message: `${userName} está de folga em ${date} (${folgas[0]!.type}: ${folgas[0]!.startDate} → ${folgas[0]!.endDate}).` });
    }

    // ── consultar_minhas_leituras_pendentes_biblioteca ───────────────────────
    if (name === "consultar_minhas_leituras_pendentes_biblioteca") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const [roleRow] = await db.select({ role: userRolesTable.role })
        .from(userRolesTable)
        .where(and(eq(userRolesTable.userId, ctx.userId), eq(userRolesTable.active, true)))
        .limit(1);
      const role = (roleRow?.role as LibraryRole | undefined) ?? null;
      const fullReader = isLibraryFullReader(role);
      const [person] = fullReader
        ? []
        : await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, ctx.userId)).limit(1);
      const areaId = person?.areaId ?? null;
      let docs = await db.select({
        id: libraryDocumentsTable.id,
        title: libraryDocumentsTable.title,
        summary: libraryDocumentsTable.summary,
        scopeType: libraryDocumentsTable.scopeType,
        areaId: libraryDocumentsTable.areaId,
        locationId: libraryDocumentsTable.locationId,
      })
        .from(libraryDocumentsTable)
        .where(and(
          eq(libraryDocumentsTable.orgId, ctx.organizationId),
          inArray(libraryDocumentsTable.status, ["PUBLISHED", "UPDATED"]),
          eq(libraryDocumentsTable.requiresConfirmation, true),
          isNull(libraryDocumentsTable.archivedAt),
        ))
        .orderBy(desc(libraryDocumentsTable.updatedAt));
      docs = docs.filter((document) => canReadLibraryScope(document, fullReader, areaId));
      if (!docs.length) return JSON.stringify({ docs: [] });

      const confirmations = await db.select({ documentId: libraryViewsTable.documentId })
        .from(libraryViewsTable)
        .where(and(
          eq(libraryViewsTable.orgId, ctx.organizationId),
          eq(libraryViewsTable.userId, ctx.userId),
          isNotNull(libraryViewsTable.confirmedAt),
          inArray(libraryViewsTable.documentId, docs.map((document) => document.id)),
        ));
      const confirmedIds = new Set(confirmations.map((item) => item.documentId));
      return JSON.stringify({ docs: docs.filter((document) => !confirmedIds.has(document.id)).slice(0, 10) });
    }

    // ── consultar_biblioteca ──────────────────────────────────────────────────
    if (name === "consultar_biblioteca") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const query = (input.query as string | undefined) ?? "";
      const typeFilter = input.type as string | undefined;
      const resultLimit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
      const [roleRow] = await db.select({ role: userRolesTable.role })
        .from(userRolesTable)
        .where(and(eq(userRolesTable.userId, ctx.userId), eq(userRolesTable.active, true)))
        .limit(1);
      const role = (roleRow?.role as LibraryRole | undefined) ?? null;
      const fullReader = isLibraryFullReader(role);
      const [person] = fullReader
        ? []
        : await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, ctx.userId)).limit(1);
      const areaId = person?.areaId ?? null;
      let selectedLocation: { id: string; name: string } | null = null;
      if (typeof input.locationName === "string" && input.locationName.trim()) {
        const availableLocations = await listReadableLocations(ctx.organizationId, ctx.userId, ctx.userRole);
        if (!availableLocations) {
          return JSON.stringify({ error: "Sua conta não tem acesso autorizado a documentos vinculados a locais. Posso pesquisar os documentos gerais e da sua área." });
        }
        const locationMatches = availableLocations.filter((location) => normalizeAsaText(location.name) === normalizeAsaText(input.locationName as string));
        if (locationMatches.length === 0) {
          return JSON.stringify({ error: "Não encontrei um local com esse nome dentro do seu escopo autorizado." });
        }
        if (locationMatches.length > 1) {
          return JSON.stringify({ error: "Encontrei mais de um local acessível com esse nome. Informe um nome distinto para pesquisar a Biblioteca." });
        }
        selectedLocation = { id: locationMatches[0]!.id, name: locationMatches[0]!.name };
      }

      const conditions: ReturnType<typeof eq>[] = [
        eq(libraryDocumentsTable.orgId, ctx.organizationId),
        inArray(libraryDocumentsTable.status, ["PUBLISHED", "UPDATED"]),
      ];
      if (typeFilter) conditions.push(eq(libraryDocumentsTable.type, typeFilter as never));
      if (!fullReader) {
        conditions.push(areaId
          ? or(
              eq(libraryDocumentsTable.scopeType, "HOUSE"),
              and(eq(libraryDocumentsTable.scopeType, "AREA"), eq(libraryDocumentsTable.areaId, areaId)),
            )!
          : eq(libraryDocumentsTable.scopeType, "HOUSE"));
      }

      let docs = await db
        .select({
          id:      libraryDocumentsTable.id,
          title:   libraryDocumentsTable.title,
          type:    libraryDocumentsTable.type,
          summary: libraryDocumentsTable.summary,
          body:    libraryDocumentsTable.body,
          version: libraryDocumentsTable.version,
          tags:    libraryDocumentsTable.tags,
          scopeType: libraryDocumentsTable.scopeType,
          areaId: libraryDocumentsTable.areaId,
          locationId: libraryDocumentsTable.locationId,
          categoryName: libraryCategoriesTable.name,
        })
        .from(libraryDocumentsTable)
        .leftJoin(libraryCategoriesTable, and(
          eq(libraryCategoriesTable.id, libraryDocumentsTable.categoryId),
          eq(libraryCategoriesTable.orgId, ctx.organizationId),
          eq(libraryCategoriesTable.active, true),
        ))
        .where(and(...conditions, isNull(libraryDocumentsTable.archivedAt)))
        .orderBy(desc(libraryDocumentsTable.updatedAt));
      docs = docs.filter((document) => canReadLibraryScope(document, fullReader, areaId));
      if (selectedLocation) {
        docs = docs.filter((document) => document.scopeType !== "LOCATION" || document.locationId === selectedLocation!.id);
      }

      const citations = docs.length
        ? await db.select({ documentId: libraryDocumentPageCitationsTable.documentId, version: libraryDocumentPageCitationsTable.version, pageNumber: libraryDocumentPageCitationsTable.pageNumber, excerpt: libraryDocumentPageCitationsTable.excerpt })
            .from(libraryDocumentPageCitationsTable)
            .where(inArray(libraryDocumentPageCitationsTable.documentId, docs.map((document) => document.id)))
        : [];
      const currentCitations = new Map(docs.map((doc) => [doc.id, citations.filter((citation) => citation.documentId === doc.id && citation.version === doc.version)]));

      // Search can use internal content, but replies cite only manually anchored source excerpts.
      if (query.trim()) {
        const normQ = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const terms = normQ.split(/\s+/).filter(term => term.length > 2 && !["com", "das", "dos", "para", "por", "uma", "uns", "nas", "nos"].includes(term));
        docs = docs.filter(d => {
          const haystack = [d.title, d.summary ?? "", d.body, d.categoryName ?? "", ...d.tags, ...(currentCitations.get(d.id) ?? []).map((citation) => citation.excerpt)]
            .join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return terms.length > 0 ? terms.every(term => haystack.includes(term)) : haystack.includes(normQ);
        });
      }

      if (docs.length === 0) {
        return JSON.stringify({
          found: false,
          message: query
            ? `Eu não encontrei nenhum documento publicado sobre "${query}" na biblioteca.`
            : "Eu não encontrei nenhum documento publicado na biblioteca.",
          docs: [],
        });
      }

      return JSON.stringify({
        found: true,
        count: docs.length,
        docs: docs.slice(0, resultLimit).map(d => ({
          id: d.id,
          title: d.title,
          type: d.type,
          version: d.version,
          categoryName: d.categoryName,
          citation: selectAsaLibraryCitation(query, currentCitations.get(d.id) ?? []),
          ...(selectedLocation && d.scopeType === "LOCATION" && d.locationId === selectedLocation.id ? { locationName: selectedLocation.name } : {}),
        })),
      });
    }

    if (name === "consultar_estado_biblioteca") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada." });
      const activeManagerRoles = await db.select({ role: userRolesTable.role }).from(userRolesTable).where(and(
        eq(userRolesTable.userId, ctx.userId),
        eq(userRolesTable.active, true),
        inArray(userRolesTable.role, ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]),
      ));
      if (!activeManagerRoles.length) {
        return JSON.stringify({ error: "O estado geral da Biblioteca está disponível somente para Administração e Supervisão." });
      }
      const isAdmin = activeManagerRoles.some(({ role }) => role === "ADMIN");
      const [person] = isAdmin
        ? []
        : await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, ctx.userId)).limit(1);
      if (!isAdmin && !person?.areaId) return JSON.stringify({ scope: "area", staleCount: 0, republishCount: 0, draftCount: 0, stale: [], republish: [], drafts: [] });
      const conditions = [eq(libraryDocumentsTable.orgId, ctx.organizationId), isNull(libraryDocumentsTable.archivedAt)];
      if (!isAdmin) conditions.push(eq(libraryDocumentsTable.scopeType, "AREA"), eq(libraryDocumentsTable.areaId, person!.areaId!));
      const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 10);
      const [staleCountRow, republishCountRow, draftCountRow, stale, republish, drafts] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(libraryDocumentsTable)
          .where(and(...conditions, eq(libraryDocumentsTable.status, "PUBLISHED"), lte(libraryDocumentsTable.updatedAt, staleDate))),
        db.select({ count: sql<number>`count(*)::int` }).from(libraryDocumentsTable)
          .where(and(...conditions, eq(libraryDocumentsTable.status, "UPDATED"))),
        db.select({ count: sql<number>`count(*)::int` }).from(libraryDocumentsTable)
          .where(and(...conditions, eq(libraryDocumentsTable.status, "DRAFT"))),
        db.select({ title: libraryDocumentsTable.title, updatedAt: libraryDocumentsTable.updatedAt }).from(libraryDocumentsTable)
          .where(and(...conditions, eq(libraryDocumentsTable.status, "PUBLISHED"), lte(libraryDocumentsTable.updatedAt, staleDate)))
          .orderBy(libraryDocumentsTable.updatedAt).limit(limit),
        db.select({ title: libraryDocumentsTable.title, updatedAt: libraryDocumentsTable.updatedAt }).from(libraryDocumentsTable)
          .where(and(...conditions, eq(libraryDocumentsTable.status, "UPDATED")))
          .orderBy(desc(libraryDocumentsTable.updatedAt)).limit(limit),
        db.select({ title: libraryDocumentsTable.title, updatedAt: libraryDocumentsTable.updatedAt }).from(libraryDocumentsTable)
          .where(and(...conditions, eq(libraryDocumentsTable.status, "DRAFT")))
          .orderBy(desc(libraryDocumentsTable.createdAt)).limit(limit),
      ]);
      return JSON.stringify({
        scope: isAdmin ? "organization" : "area",
        staleCount: staleCountRow[0]?.count ?? 0,
        republishCount: republishCountRow[0]?.count ?? 0,
        draftCount: draftCountRow[0]?.count ?? 0,
        stale,
        republish,
        drafts,
      });
    }

    // ── consultar_membros ─────────────────────────────────────────────────────
    if (name === "consultar_membros") {
      const rawQuery = ((input.query as string) ?? "").trim();
      if (!rawQuery) return JSON.stringify({ error: "query é obrigatória" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const { users, memories } = await loadOrgMembersAndMemories(ctx);

      // Aceita listas: "João, Pedro e Ana" → resolve cada nome separadamente
      const queries = splitMemberQueries(rawQuery);
      const resolutions = queries.map((q) => resolveOneMember(q, users, memories));

      // ── Caso simples: um único nome → mantém o formato legado (retrocompatível) ──
      if (resolutions.length <= 1) {
        const r = resolutions[0] ?? resolveOneMember(rawQuery, users, memories);
        if (!r.found) {
          return JSON.stringify({
            found: false,
            message: `Nenhum membro encontrado para "${r.query}". Verifique o nome ou tente parte do nome.`,
            members: [],
            resultados: [r],
          });
        }
        return JSON.stringify({
          found: true,
          ambiguous: r.ambiguous,
          message: r.ambiguous
            ? `Encontrei ${r.members.length} membros com nomes similares. Qual você quer dizer?`
            : `Encontrado: ${r.member!.name}`,
          member: r.member,
          members: r.members,
          resultados: [r],
        });
      }

      // ── Vários nomes: resolve todos, segue em frente mesmo quando um falha ──
      const encontrados = resolutions.filter((r) => r.found && !r.ambiguous);
      const ambiguos    = resolutions.filter((r) => r.found && r.ambiguous);
      const naoEncontrados = resolutions.filter((r) => !r.found);

      const parts: string[] = [];
      if (encontrados.length > 0)
        parts.push(`✓ Encontrados (${encontrados.length}): ${encontrados.map((r) => r.member!.name).join(", ")}`);
      if (ambiguos.length > 0)
        parts.push(`❓ Ambíguos (${ambiguos.length}): ${ambiguos.map((r) => `"${r.query}"`).join(", ")} — preciso que você escolha.`);
      if (naoEncontrados.length > 0)
        parts.push(`⚠ Não encontrados (${naoEncontrados.length}): ${naoEncontrados.map((r) => `"${r.query}"`).join(", ")}`);

      return JSON.stringify({
        multi: true,
        total: resolutions.length,
        encontrados: encontrados.length,
        ambiguos: ambiguos.length,
        naoEncontrados: naoEncontrados.length,
        message: parts.join("\n"),
        resultados: resolutions,
        // Lista pronta de membros resolvidos sem ambiguidade (para ações em lote)
        membrosResolvidos: encontrados.map((r) => r.member),
      });
    }

    // ── criar_grupo / editar_grupo / remover_grupo / membros ────────────────────
    if (
      name === "criar_grupo" ||
      name === "editar_grupo" ||
      name === "remover_grupo" ||
      name === "adicionar_membro_grupo" ||
      name === "remover_membro_grupo"
    ) {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para gerenciar grupos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const actor = { role: ctx.userRole, userId: ctx.userId, organizationId: ctx.organizationId };
      try {
        if (name === "criar_grupo") {
          const scope = ((input.scope as string) ?? "OPERATION").toUpperCase();
          const group = await createGroupCore(actor, {
            name: input.name as string,
            scope,
            // Supervisor cria sempre na operação atual; ADMIN usa operationIds para MULTI.
            operationId: scope === "OPERATION" ? ctx.operationId : undefined,
            operationIds: Array.isArray(input.operationIds) ? (input.operationIds as string[]) : [],
          });
          return JSON.stringify({ success: true, message: `Grupo "${group.name}" criado.`, group: { id: group.id, name: group.name, scope: group.scope, status: group.status } });
        }
        if (name === "editar_grupo") {
          const groupId = input.groupId as string;
          if (!groupId) return JSON.stringify({ error: "groupId é obrigatório" });
          let group;
          if (input.name) group = await renameGroupCore(actor, groupId, input.name as string);
          if (input.status) group = await setGroupStatusCore(actor, groupId, (input.status as string).toUpperCase());
          if (!group) return JSON.stringify({ error: "Informe ao menos name ou status para editar" });
          return JSON.stringify({ success: true, message: `Grupo "${group.name}" atualizado.`, group: { id: group.id, name: group.name, scope: group.scope, status: group.status } });
        }
        if (name === "remover_grupo") {
          const groupId = input.groupId as string;
          if (!groupId) return JSON.stringify({ error: "groupId é obrigatório" });
          const group = await setGroupStatusCore(actor, groupId, "ARCHIVED");
          return JSON.stringify({ success: true, message: `Grupo "${group.name}" arquivado (removido).`, group: { id: group.id, name: group.name, status: group.status } });
        }
        if (name === "adicionar_membro_grupo") {
          const groupId = input.groupId as string;
          const userId = input.userId as string;
          if (!groupId || !userId) return JSON.stringify({ error: "groupId e userId são obrigatórios" });
          const { group } = await addGroupMemberCore(actor, groupId, userId);
          return JSON.stringify({ success: true, message: `Membro adicionado ao grupo "${group.name}".` });
        }
        // remover_membro_grupo
        const groupId = input.groupId as string;
        const userId = input.userId as string;
        if (!groupId || !userId) return JSON.stringify({ error: "groupId e userId são obrigatórios" });
        const group = await removeGroupMemberCore(actor, groupId, userId);
        return JSON.stringify({ success: true, message: `Membro removido do grupo "${group.name}".`, undo: group.undo });
      } catch (err) {
        if (err instanceof GroupActionError) return JSON.stringify({ error: err.message });
        return JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao gerenciar grupo" });
      }
    }

    // ── consultar_grupo ───────────────────────────────────────────────────────
    if (name === "consultar_grupo") {
      const rawQuery = ((input.query as string) ?? "").trim();
      if (!rawQuery) return JSON.stringify({ error: "query é obrigatória" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const r = await coreResolverGrupo(ctx, rawQuery);
      return JSON.stringify({
        found: r.found,
        ambiguous: r.ambiguous,
        message: r.message,
        group: r.group,
        groups: r.groups,
        members: r.members,
        // Lista pronta de membros (para montar escala em lote, um criar_entrada_escala por membro)
        membrosResolvidos: r.members,
      });
    }

    // ── criar_entrada_escala ──────────────────────────────────────────────────
    if (name === "criar_entrada_escala") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar entradas na escala" });
      if (!ctx.operationId)  return JSON.stringify({ error: "Operação não configurada" });

      const userName  = input.userName  as string | undefined;
      const date      = input.date      as string;
      const label     = input.label     as string;
      const startTime = input.startTime as string | undefined;
      const endTime   = input.endTime   as string | undefined;
      const notes     = input.notes     as string | undefined;

      try {
        const res = await coreCriarEntradaEscala(ctx, {
          userId: input.userId as string,
          userName, date, label, startTime, endTime, notes,
        });
        return JSON.stringify({
          created:   true,
          entryId:   res.id,
          scaleId:   res.scaleId,
          scaleName: res.scaleName,
          warning:   res.warning,
          message:
            `✅ Entrada criada na escala "${res.scaleName}":\n` +
            `• Membro: ${userName ?? input.userId}\n` +
            `• Atividade: ${label}\n` +
            `• Data: ${date}\n` +
            (startTime ? `• Início: ${startTime}\n` : "") +
            (endTime   ? `• Fim: ${endTime}\n`   : "") +
            (notes     ? `• Obs: ${notes}\n`      : "") +
            (res.warning ? `\n${res.warning}`      : ""),
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── criar_tarefa ──────────────────────────────────────────────────────────
    if (name === "criar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar tarefas" });

      const title        = input.title        as string;
      const assigneeName = input.assigneeName as string | undefined;
      const dueDate      = input.dueDate      as string;
      const priority     = (input.priority    as string) ?? "MEDIUM";

      try {
        const res = await coreCriarTarefa(ctx, {
          title,
          description: input.description as string | undefined,
          assigneeId:  input.assigneeId  as string,
          dueDate,
          priority,
        });
        return JSON.stringify({
          created: true,
          id: res.id,
          message:
            `✅ Tarefa criada:\n` +
            `• Título: ${title}\n` +
            `• Responsável: ${assigneeName ?? input.assigneeId}\n` +
            `• Prazo: ${dueDate}\n` +
            `• Prioridade: ${priority}\n` +
            `• Status: Em criação — requer aprovação`,
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── consultar_reconhecimentos ─────────────────────────────────────────────
    if (name === "consultar_reconhecimentos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limit = (input.limit as number | undefined) ?? 10;
      const conditions: ReturnType<typeof eq>[] = [eq(recognitionsTable.organizationId, ctx.organizationId)];
      if (input.userId) conditions.push(eq(recognitionsTable.userId, input.userId as string));
      const recs = await db
        .select()
        .from(recognitionsTable)
        .where(and(...conditions))
        .orderBy(desc(recognitionsTable.createdAt))
        .limit(limit);
      if (recs.length === 0) return JSON.stringify({ total: 0, message: "Nenhum reconhecimento registrado ainda.", reconhecimentos: [] });
      return JSON.stringify({ total: recs.length, reconhecimentos: recs });
    }

    // ── criar_reconhecimento ──────────────────────────────────────────────────
    if (name === "criar_reconhecimento") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar reconhecimentos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const recTitle  = input.title   as string;
      try {
        const res = await coreCriarReconhecimento(ctx, {
          userId:  input.userId  as string,
          type:    input.type    as string,
          title:   recTitle,
          message: input.message as string,
        });
        return JSON.stringify({
          created: true,
          id: res.id,
          message: `🎉 Reconhecimento "${recTitle}" criado com sucesso!`,
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── enviar_push ───────────────────────────────────────────────────────────
    if (name === "enviar_push") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para enviar notificações" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const rawUserIds = input.userIds;
      const userIds = Array.isArray(rawUserIds)
        ? (rawUserIds as unknown[]).map((u) => String(u)).filter(Boolean)
        : typeof rawUserIds === "string"
        ? [rawUserIds]
        : [];
      const pushTitle   = input.title   as string;
      const pushMessage = input.message as string;
      const pushPriority = (["LOW", "NORMAL", "IMPORTANT", "CRITICAL"].includes(String(input.priority))
        ? input.priority
        : "NORMAL") as "LOW" | "NORMAL" | "IMPORTANT" | "CRITICAL";

      if (userIds.length === 0) return JSON.stringify({ error: "Informe ao menos um membro (userIds)" });
      if (!pushTitle || !pushMessage) return JSON.stringify({ error: "title e message são obrigatórios" });

      // Validate the targets belong to the same organization (avoid IDOR).
      const targets = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(and(eq(usersTable.organizationId, ctx.organizationId), inArray(usersTable.id, userIds)));
      if (targets.length === 0) return JSON.stringify({ error: "Nenhum membro válido encontrado nesta organização" });

      let sent = 0;
      let inAppOnly = 0;
      for (const t of targets) {
        try {
          const { push } = await sendNotification({
            userId:   t.id,
            type:     "ASA_PUSH",
            title:    pushTitle,
            message:  pushMessage,
            priority: pushPriority,
            category: "system",
          });
          if (push.sent > 0) sent += 1; else inAppOnly += 1;
        } catch {
          inAppOnly += 1;
        }
      }

      return JSON.stringify({
        sent: true,
        total: targets.length,
        delivered: sent,
        inAppOnly,
        message: `📲 Notificação enviada para ${targets.length} membro(s). ${sent} receberam push no celular${inAppOnly > 0 ? `, ${inAppOnly} ficaram só no histórico in-app (sem dispositivo registrado)` : ""}.`,
      });
    }

    // ── detectar_marcos ───────────────────────────────────────────────────────
    if (name === "detectar_marcos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const todayDate = new Date();
      const orgUsers = await db
        .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
        .from(usersTable)
        .where(eq(usersTable.organizationId, ctx.organizationId))
        .limit(100);
      const marcos: { userId: string; name: string; type: string; label: string }[] = [];
      for (const u of orgUsers) {
        const created = new Date(u.createdAt);
        if (created.getDate() !== todayDate.getDate() || created.getMonth() !== todayDate.getMonth()) continue;
        const years = todayDate.getFullYear() - created.getFullYear();
        const totalMonths = years * 12 + (todayDate.getMonth() - created.getMonth());
        if (years >= 1 && years <= 10) {
          marcos.push({ userId: u.id, name: u.name, type: "TIME_OF_HOUSE", label: `${years} ano${years > 1 ? "s" : ""} na ASA` });
        } else if (totalMonths === 3 || totalMonths === 6) {
          marcos.push({ userId: u.id, name: u.name, type: "TIME_OF_HOUSE", label: `${totalMonths} meses na ASA` });
        }
      }
      if (marcos.length === 0) return JSON.stringify({ total: 0, message: "Nenhum marco especial hoje.", marcos: [] });
      return JSON.stringify({
        total: marcos.length,
        message: `${marcos.length} marco(s) detectado(s) hoje! Considere criar um reconhecimento para cada um.`,
        marcos,
      });
    }

    // ── gerar_resumo_do_dia ───────────────────────────────────────────────────
    if (name === "gerar_resumo_do_dia") {
      const teamOperationId = resolveAsaSummaryTeamOperation(ctx.userRole, ctx.operationId, ctx.operationIds);
      const resumo = await assembleResumoDodia(ctx.userId, ctx.organizationId ?? null, ctx.userRole, teamOperationId);
      return JSON.stringify(resumo);
    }

    // ── consultar_aniversarios ────────────────────────────────────────────────
    if (name === "consultar_aniversarios") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const date    = (input.date as string | undefined) ?? operationalDate();
      const mm      = date.slice(5, 7); const dd = date.slice(8, 10);
      const todayMD = `${dd}/${mm}`;
      const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // 1. Query usersTable.birthDate (canonical source)
      const birthdays: { nome: string; source: string }[] = [];
      const userBdays = await db
        .select({ name: usersTable.name, birthDate: usersTable.birthDate })
        .from(usersTable)
        .where(and(
          eq(usersTable.organizationId, ctx.organizationId),
          eq(usersTable.status, "ACTIVE"),
          sql`to_char(${usersTable.birthDate}::date, 'MM-DD') = ${`${mm}-${dd}`}`,
        ))
        .limit(20);
      for (const u of userBdays) birthdays.push({ nome: u.name, source: "db" });

      // 2. Memories fallback (for orgs without birthDate set)
      const memories = await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
          eq(asaMemoriesTable.status, "APPROVED"),
          eq(asaMemoriesTable.type, "PERSONAL"),
        ))
        .limit(200);
      for (const m of memories) {
        const kn = normStr(m.key);
        if (kn.includes("aniversario") || kn.includes("nascimento") || kn.includes("birthday")) {
          if (m.value.trim().startsWith(todayMD)) {
            const match = m.key.match(/(?:de\s+|:\s*)(.+?)(?:\s*$)/i);
            const nome  = match?.[1]?.trim() ?? m.key;
            if (!birthdays.some(b => normStr(b.nome) === normStr(nome))) birthdays.push({ nome, source: "memory" });
          }
        }
      }

      const names = birthdays.map(b => b.nome);
      const msg   = names.length > 0
        ? `🎉 ${names.join(", ")} faz${names.length > 1 ? "em" : ""} aniversário hoje (${todayMD})! Que tal criar um reconhecimento?`
        : `Nenhum aniversário registrado para ${todayMD}.`;

      return JSON.stringify({ date, dayMonth: todayMD, birthdays: names, count: names.length, message: msg });
    }

    // ── consultar_clima ───────────────────────────────────────────────────────
    if (name === "consultar_clima") {
      try {
        const wr = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current=temperature_2m,weathercode,precipitation,windspeed_10m&hourly=precipitation_probability&timezone=America/Sao_Paulo&forecast_days=1",
          { signal: AbortSignal.timeout(5000) },
        ) as unknown as JsonFetchResponse;
        if (!wr.ok) return JSON.stringify({ error: "Serviço de clima indisponível" });
        const wj = await wr.json() as {
          current: { temperature_2m: number; weathercode: number; precipitation: number; windspeed_10m: number };
          hourly: { precipitation_probability: number[] };
        };
        const { temperature_2m: temp, weathercode: code, precipitation, windspeed_10m: wind } = wj.current;
        const rainChance = Math.max(...(wj.hourly.precipitation_probability.slice(0, 12) ?? [0]));
        const { emoji, description } = weatherCodeToLabel(code);
        const advice = temp < 15 ? "🧥 Recomendo agasalho hoje." : temp > 28 ? "💧 Hidratação importante!" : rainChance > 50 ? "☂️ Leve um guarda-chuva." : "";

        return JSON.stringify({
          temp: Math.round(temp), weatherCode: code, description, emoji,
          wind: Math.round(wind), precipitation: Math.round(precipitation * 10) / 10,
          rainChancePercent: Math.round(rainChance), advice,
          message: `${emoji} ${Math.round(temp)}°C — ${description}. Vento ${Math.round(wind)} km/h.${rainChance > 30 ? ` Chance de chuva: ${Math.round(rainChance)}%.` : ""} ${advice}`.trim(),
        });
      } catch {
        return JSON.stringify({ error: "Não foi possível consultar o clima agora." });
      }
    }

    // ── Cancelamentos / Remoções ──────────────────────────────────────────────
    if (name === "cancelar_ausencia") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem cancelar ausências" });
      try {
        const r = await coreCancelarAusencia(ctx, input.folgaId as string);
        return JSON.stringify({ success: true, message: `✅ Ausência de ${r.startDate} cancelada com sucesso. O membro volta a estar disponível nessa data.`, id: r.id });
      } catch (err) {
        return JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
    }

    if (name === "cancelar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem cancelar tarefas" });
      try {
        const r = await coreCancelarTarefa(ctx, input.taskId as string, (input.acao as string | undefined) ?? "CANCELAR");
        const label = r.novoStatus === "COMPLETED" ? "concluída" : "cancelada";
        return JSON.stringify({ success: true, message: `✅ Tarefa "${r.title}" ${label} com sucesso.`, id: r.id, novoStatus: r.novoStatus });
      } catch (err) {
        return JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
    }

    if (name === "remover_entrada_escala") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem remover entradas da escala" });
      try {
        const r = await coreRemoverEntradaEscala(ctx, input.allocationId as string);
        return JSON.stringify({ success: true, message: `✅ Entrada manual "${r.label}" removida da escala com sucesso.`, id: r.id });
      } catch (err) {
        return JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── Publicação ───────────────────────────────────────────────────────────
    if (name === "publicar_aviso") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem publicar avisos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const noticeId = input.noticeId as string;
      const [existing] = await db
        .select({ id: noticesTable.id, status: noticesTable.status, title: noticesTable.title })
        .from(noticesTable)
        .where(eq(noticesTable.id, noticeId))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Aviso não encontrado. Verifique o ID." });
      if (existing.status === "PUBLISHED") return JSON.stringify({ success: false, message: "Este aviso já está publicado." });
      if (existing.status !== "DRAFT") return JSON.stringify({ success: false, message: `Não é possível publicar um aviso com status "${existing.status}".` });
      await db.update(noticesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(noticesTable.id, noticeId));
      return JSON.stringify({ success: true, message: `✅ Aviso "${existing.title ?? "(sem título)"}" publicado com sucesso. Os destinatários já podem visualizá-lo.`, id: noticeId });
    }

    if (name === "publicar_escala") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem publicar escalas" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de publicar escalas" });
      const scaleId = input.scaleId as string;
      const [existing] = await db
        .select({ id: scalesTable.id, status: scalesTable.status, title: scalesTable.title, periodStart: scalesTable.periodStart, periodEnd: scalesTable.periodEnd })
        .from(scalesTable)
        .where(and(eq(scalesTable.id, scaleId), eq(scalesTable.operationId, ctx.operationId)))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Escala não encontrada. Use consultar_escalas para verificar o ID." });
      if (existing.status === "PUBLISHED" || existing.status === "REPUBLISHED") return JSON.stringify({ success: false, message: "Esta escala já está publicada." });
      if (existing.status === "ARCHIVED") return JSON.stringify({ success: false, message: "Não é possível publicar uma escala arquivada." });
      await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, scaleId));
      return JSON.stringify({ success: true, message: `✅ Escala "${existing.title}" publicada (${existing.periodStart} → ${existing.periodEnd}). Os membros já podem ver suas alocações.`, id: scaleId });
    }

    // ── Blocos Operacionais ───────────────────────────────────────────────────
    if (name === "criar_bloco_agenda") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem criar blocos na agenda" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar blocos" });
      const titulo     = input.titulo     as string;
      const data       = input.data       as string;
      const horaInicio = input.horaInicio as string | undefined;
      const horaFim    = input.horaFim    as string | undefined;
      const descricao  = input.descricao  as string | undefined;
      const local      = input.local      as string | undefined;
      const [event] = await db.insert(agendaEventsTable).values({
        operationId:    ctx.operationId,
        type:           "OPERATIONAL_BLOCK",
        title:          titulo,
        date:           data,
        startTime:      horaInicio ?? null,
        endTime:        horaFim    ?? null,
        location:       local      ?? null,
        notes:          descricao  ?? null,
        status:         "DRAFT",
        visibility:     "OPERATION",
        createdBy:      ctx.userId,
      }).returning({ id: agendaEventsTable.id });
      const horaStr = horaInicio ? ` às ${horaInicio}${horaFim ? `–${horaFim}` : ""}` : "";
      return JSON.stringify({ success: true, message: `✅ Bloco "${titulo}" criado na agenda para ${data}${horaStr}. Confirme no web admin (Agenda) para torná-lo visível aos membros.`, id: event.id });
    }

    // ── Biblioteca — Rastreamento de Leitura ─────────────────────────────────
    if (name === "consultar_leituras_biblioteca") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem consultar leituras" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const documentId      = input.documentId      as string | undefined;
      const tituloFiltro    = input.titulo           as string | undefined;
      const mostrarNaoLeram = input.mostrarNaoLeram  as boolean | undefined;
      let docId = documentId;

      if (!docId && tituloFiltro) {
        const [found] = await db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId), ilike(libraryDocumentsTable.title, `%${tituloFiltro}%`)))
          .limit(1);
        if (!found) return JSON.stringify({ success: false, message: `Nenhum documento encontrado com o título "${tituloFiltro}".` });
        docId = found.id;
      }

      if (docId) {
        const [doc] = await db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, ctx.organizationId)))
          .limit(1);
        if (!doc) return JSON.stringify({ success: false, message: "Documento não encontrado." });

        const views = await db
          .select({ userId: libraryViewsTable.userId, userName: usersTable.name, viewedAt: libraryViewsTable.viewedAt })
          .from(libraryViewsTable)
          .leftJoin(usersTable, eq(libraryViewsTable.userId, usersTable.id))
          .where(eq(libraryViewsTable.documentId, docId))
          .orderBy(desc(libraryViewsTable.viewedAt))
          .limit(200);

        const uniqueReaders = [...new Map(views.map(v => [v.userId, v])).values()];

        if (mostrarNaoLeram) {
          const allMembers = await db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.organizationId, ctx.organizationId))
            .limit(300);
          const readerIds = new Set(uniqueReaders.map(r => r.userId));
          const naoLeram  = allMembers.filter(m => !readerIds.has(m.id));
          return JSON.stringify({
            documentTitle: doc.title, totalLeituras: views.length, leitoresUnicos: uniqueReaders.length,
            naoLeram: naoLeram.map(m => m.name),
            message: naoLeram.length === 0
              ? `✅ Todos os membros leram "${doc.title}".`
              : `📋 ${naoLeram.length} membro(s) ainda não leu "${doc.title}": ${naoLeram.map(m => m.name).join(", ")}.`,
          });
        }
        return JSON.stringify({
          documentTitle: doc.title, totalLeituras: views.length, leitoresUnicos: uniqueReaders.length,
          ultimasLeituras: uniqueReaders.slice(0, 10).map(r => ({ nome: r.userName, em: r.viewedAt })),
          message: `📚 "${doc.title}" foi lido ${uniqueReaders.length} vez(es) por pessoa(s) única(s).`,
        });
      }

      const topDocs = await db
        .select({ documentId: libraryViewsTable.documentId, leitores: sql<number>`count(distinct ${libraryViewsTable.userId})::int` })
        .from(libraryViewsTable)
        .where(eq(libraryViewsTable.orgId, ctx.organizationId))
        .groupBy(libraryViewsTable.documentId)
        .orderBy(desc(sql<number>`count(distinct ${libraryViewsTable.userId})`))
        .limit(10);
      return JSON.stringify({ topDocumentos: topDocs, message: topDocs.length === 0 ? "Nenhuma leitura registrada ainda." : `📊 Top ${topDocs.length} documentos mais lidos da organização.` });
    }

    // ── Sprint 11 — Aprendizado Organizacional ───────────────────────────────
    const DOW_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const periodoDays = (p?: string) => {
      if (p === "90d") return 90; if (p === "6m") return 180; if (p === "12m") return 365; return 30;
    };

    // ── consultar_tendencias (Sprint 11) ──────────────────────────────────────
    if (name === "consultar_tendencias") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const dias  = periodoDays(input.periodo as string | undefined);
      const from  = shiftOperationalDate(operationalDate(), -dias);
      const to    = operationalDate();
      const tipo  = (input.tipo as string | undefined) ?? "TODOS";

      const results: Record<string, unknown> = { periodo: { dias, de: from, ate: to } };

      if (tipo === "AUSENCIAS" || tipo === "TODOS") {
        // Absences by day of week
        const absDow = await db
          .select({ dow: sql<number>`EXTRACT(DOW FROM ${folgasTable.startDate})::int`, count: sql<number>`count(*)::int` })
          .from(folgasTable)
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(sql`EXTRACT(DOW FROM ${folgasTable.startDate})`)
          .orderBy(desc(sql`count(*)`));

        // Monthly trend
        const absMes = await db
          .select({ mes: sql<string>`TO_CHAR(${folgasTable.startDate}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
          .from(folgasTable)
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from)))
          .groupBy(sql`TO_CHAR(${folgasTable.startDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${folgasTable.startDate}, 'YYYY-MM')`);

        const piorDia = absDow[0];
        results.ausencias = {
          por_dia_semana: absDow.map(r => ({ dia: DOW_LABELS[r.dow] ?? r.dow, ausencias: r.count })),
          por_mes:        absMes,
          insight: piorDia ? `⚠️ ${DOW_LABELS[piorDia.dow] ?? "Dia " + piorDia.dow} concentra mais ausências (${piorDia.count} no período).` : "Sem dados suficientes.",
        };
      }

      if (tipo === "TAREFAS" || tipo === "TODOS") {
        // Task delays by day of week (day due_date fell)
        const taskDow = await db
          .select({ dow: sql<number>`EXTRACT(DOW FROM ${tasksTable.dueDate})::int`, count: sql<number>`count(*)::int` })
          .from(tasksTable)
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, to), gte(tasksTable.dueDate, from)))
          .groupBy(sql`EXTRACT(DOW FROM ${tasksTable.dueDate})`)
          .orderBy(desc(sql`count(*)`));

        // Task completion trend by month
        const taskMes = await db
          .select({ mes: sql<string>`TO_CHAR(${tasksTable.createdAt}, 'YYYY-MM')`, total: sql<number>`count(*)::int`, concluidas: sql<number>`sum(CASE WHEN status='DONE' THEN 1 ELSE 0 END)::int` })
          .from(tasksTable)
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(${tasksTable.createdAt}) between ${from} and ${to}`))
          .groupBy(sql`TO_CHAR(${tasksTable.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${tasksTable.createdAt}, 'YYYY-MM')`);

        const piorDia = taskDow[0];
        results.tarefas = {
          atrasos_por_dia_semana: taskDow.map(r => ({ dia: DOW_LABELS[r.dow] ?? r.dow, atrasos: r.count })),
          tendencia_mensal:       taskMes.map(r => ({ mes: r.mes, total: r.total, concluidas: r.concluidas, taxa: r.total > 0 ? `${Math.round((r.concluidas / r.total) * 100)}%` : "—" })),
          insight: piorDia ? `📌 ${DOW_LABELS[piorDia.dow] ?? "Dia " + piorDia.dow} concentra mais prazos vencidos (${piorDia.count} no período).` : "Sem dados de atrasos.",
        };
      }

      if (tipo === "ATIVIDADES" || tipo === "TODOS") {
        const actMes = await db
          .select({ mes: sql<string>`TO_CHAR(${scaleAllocationsTable.manualDate}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable)
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(sql`TO_CHAR(${scaleAllocationsTable.manualDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${scaleAllocationsTable.manualDate}, 'YYYY-MM')`);

        const actDow = await db
          .select({ dow: sql<number>`EXTRACT(DOW FROM ${scaleAllocationsTable.manualDate})::int`, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable)
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(sql`EXTRACT(DOW FROM ${scaleAllocationsTable.manualDate})`)
          .orderBy(desc(sql`count(*)`));

        const pico = actDow[0];
        results.atividades = {
          por_mes:       actMes,
          por_dia_semana: actDow.map(r => ({ dia: DOW_LABELS[r.dow] ?? r.dow, atividades: r.count })),
          insight: pico ? `📈 ${DOW_LABELS[pico.dow] ?? "Dia " + pico.dow} é o dia mais ativo (${pico.count} alocações).` : "Sem dados.",
        };
      }

      results.instrucao = "Interprete as tendências e gere insights operacionais. Destaque padrões claros, dias críticos e evolução mensal. Se houver correlação entre ausências e atividades no mesmo dia → aponte o risco.";
      return JSON.stringify(results);
    }

    // ── consultar_padroes (Sprint 11) ──────────────────────────────────────────
    if (name === "consultar_padroes") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from   = (input.dateFrom as string | undefined) ?? shiftOperationalDate(operationalDate(), -90);
      const to     = (input.dateTo   as string | undefined) ?? operationalDate();
      const limite = (input.limite   as number | undefined) ?? 5;

      const [ausenciasMembro, sobrecarregados, atrasadosCronicos, trocasMembro] = await Promise.all([
        // Most absent members
        db.select({ userId: folgasTable.userId, nome: usersTable.name, total: sql<number>`count(*)::int`, noShow: sql<number>`sum(CASE WHEN type='NO_SHOW' THEN 1 ELSE 0 END)::int` })
          .from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(folgasTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
        // Most active members (workload)
        db.select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable).leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(scaleAllocationsTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
        // Chronically delayed task assignees
        db.select({ assigneeId: tasksTable.assigneeId, nome: usersTable.name, atrasadas: sql<number>`count(*)::int` })
          .from(tasksTable).leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, to), gte(tasksTable.dueDate, from)))
          .groupBy(tasksTable.assigneeId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
        // Members with most swap requests
        db.select({ userId: folgasTable.userId, nome: usersTable.name, trocas: sql<number>`count(*)::int` })
          .from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.type, "DAY_OFF"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(folgasTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
      ]);

      // Avg to detect outliers
      const mediaAbs  = ausenciasMembro.length > 0 ? ausenciasMembro.reduce((s, r) => s + r.total, 0) / ausenciasMembro.length : 0;
      const mediaCarga = sobrecarregados.length > 0 ? sobrecarregados.reduce((s, r) => s + r.count, 0) / sobrecarregados.length : 0;

      return JSON.stringify({
        periodo: { de: from, ate: to },
        instrucao: "Identifique padrões críticos. Destaque anomalias (membros muito acima da média), correlações (quem falta mais também está sobrecarregado?) e sugira ações corretivas específicas.",
        ausencias_por_membro: {
          media_periodo: Math.round(mediaAbs * 10) / 10,
          membros: ausenciasMembro.map(r => ({ nome: r.nome ?? r.userId, total: r.total, no_show: r.noShow, acima_da_media: r.total > mediaAbs * 1.5 })),
        },
        carga_por_membro: {
          media_periodo: Math.round(mediaCarga * 10) / 10,
          membros: sobrecarregados.map(r => ({ nome: r.nome ?? r.userId, atividades: r.count, sobrecarga: r.count > mediaCarga * 1.5 })),
        },
        atrasos_cronicos: atrasadosCronicos.map(r => ({ nome: r.nome ?? r.assigneeId, tarefas_atrasadas: r.atrasadas })),
        trocas_frequentes: trocasMembro.map(r => ({ nome: r.nome ?? r.userId, trocas: r.trocas })),
      });
    }

    // ── consultar_aprendizados (Sprint 11) ────────────────────────────────────
    if (name === "consultar_aprendizados") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const scopeFilter = input.scope as string | undefined;

      const memorias = await db
        .select({ id: asaMemoriesTable.id, type: asaMemoriesTable.type, key: asaMemoriesTable.key, value: asaMemoriesTable.value, scope: asaMemoriesTable.scope, createdAt: asaMemoriesTable.createdAt })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
          eq(asaMemoriesTable.status, "APPROVED"),
          scopeFilter ? eq(asaMemoriesTable.scope, scopeFilter) : sql`true`,
        ))
        .orderBy(desc(asaMemoriesTable.createdAt))
        .limit(20);

      // Quick derived stats as "learned patterns"
      const today11 = operationalDate();
      const from90  = shiftOperationalDate(today11, -90);

      const [[totalAbs], [totalTasks], [txDone], [totalAct]] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(folgasTable).where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId!) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from90))!),
        db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), sql`date(${tasksTable.createdAt}) >= ${from90}`)!),
        db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"), sql`date(${tasksTable.updatedAt}) >= ${from90}`)!),
        db.select({ count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from90} and ${today11}`)!),
      ]);

      const txConclusao = (totalTasks?.count ?? 0) > 0 ? Math.round(((txDone?.count ?? 0) / (totalTasks?.count ?? 1)) * 100) : 0;

      return JSON.stringify({
        memorias_institucionais: {
          total: memorias.length,
          itens: memorias.map(m => ({ tipo: m.type, chave: m.key, valor: m.value, escopo: m.scope, registrado: m.createdAt })),
        },
        padroes_derivados_90d: {
          total_ausencias:      totalAbs?.count ?? 0,
          total_atividades:     totalAct?.count ?? 0,
          total_tarefas:        totalTasks?.count ?? 0,
          taxa_conclusao:       `${txConclusao}%`,
          insight_geral:        txConclusao >= 70 ? "✅ Taxa de conclusão saudável (≥70%)" : txConclusao >= 50 ? "⚠️ Taxa de conclusão moderada (50–70%)" : "🔴 Taxa de conclusão baixa (<50%) — risco operacional",
        },
        instrucao: "Apresente os aprendizados da ASA: primeiro as memórias institucionais registradas (o que foi formalmente capturado), depois os padrões derivados dos dados. Conclua com 1-3 recomendações baseadas nos padrões observados.",
      });
    }

    // ── consultar_riscos_recorrentes (Sprint 11) ───────────────────────────────
    if (name === "consultar_riscos_recorrentes") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from    = (input.dateFrom as string | undefined) ?? shiftOperationalDate(operationalDate(), -90);
      const to      = (input.dateTo   as string | undefined) ?? operationalDate();
      const today11 = operationalDate();

      const [altaAusencia, sobrecarregados, atrasadosCronicos, posicoesAbertas] = await Promise.all([
        // Members with ≥3 absences in period → HIGH risk
        db.select({ userId: folgasTable.userId, nome: usersTable.name, total: sql<number>`count(*)::int`, noShow: sql<number>`sum(CASE WHEN type='NO_SHOW' THEN 1 ELSE 0 END)::int` })
          .from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(folgasTable.userId, usersTable.name)
          .having(sql`count(*) >= 3`)
          .orderBy(desc(sql`count(*)`)).limit(10),
        // Overloaded members (activity count > 2× average)
        db.select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable).leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(scaleAllocationsTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(10),
        // Chronically delayed tasks (due_date passed, still open)
        db.select({ assigneeId: tasksTable.assigneeId, nome: usersTable.name, atrasadas: sql<number>`count(*)::int` })
          .from(tasksTable).leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, today11)))
          .groupBy(tasksTable.assigneeId, usersTable.name)
          .having(sql`count(*) >= 2`)
          .orderBy(desc(sql`count(*)`)).limit(10),
        // Open positions in active scales
        db.select({ scaleId: scaleAllocationsTable.scaleId, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable).innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
          .where(and(ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`, inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), eq(scaleAllocationsTable.status, "OPEN"), eq(scaleAllocationsTable.active, true)))
          .groupBy(scaleAllocationsTable.scaleId).orderBy(desc(sql`count(*)`)).limit(5),
      ]);

      // Classify workload risk
      const mediaAtv = sobrecarregados.length > 0 ? sobrecarregados.reduce((s, r) => s + r.count, 0) / sobrecarregados.length : 0;
      const riscosCarga = sobrecarregados
        .filter(r => r.count > mediaAtv * 1.3)
        .map(r => ({ nome: r.nome ?? r.userId, atividades: r.count, risco: r.count > mediaAtv * 2 ? "ALTO" : "MÉDIO" }));

      const totalPosAbertas = posicoesAbertas.reduce((s, r) => s + r.count, 0);

      return JSON.stringify({
        periodo: { de: from, ate: to },
        instrucao: "Apresente os riscos em ordem de severidade (ALTO → MÉDIO → BAIXO). Para cada risco, explique a consequência operacional e sugira uma ação preventiva concreta.",
        riscos_ausencia: {
          nivel:  altaAusencia.length > 3 ? "ALTO" : altaAusencia.length > 0 ? "MÉDIO" : "BAIXO",
          alerta: altaAusencia.length > 0 ? `${altaAusencia.length} membro(s) com ≥3 ausências no período` : "Nenhuma ausência recorrente detectada",
          membros: altaAusencia.map(r => ({ nome: r.nome ?? r.userId, total: r.total, no_show: r.noShow, nivel: r.noShow >= 2 ? "ALTO" : "MÉDIO" })),
        },
        riscos_carga: {
          nivel:  riscosCarga.some(r => r.risco === "ALTO") ? "ALTO" : riscosCarga.length > 0 ? "MÉDIO" : "BAIXO",
          alerta: riscosCarga.length > 0 ? `${riscosCarga.length} membro(s) com carga acima da média` : "Carga equilibrada",
          membros: riscosCarga,
        },
        riscos_tarefas: {
          nivel:  atrasadosCronicos.length > 3 ? "ALTO" : atrasadosCronicos.length > 0 ? "MÉDIO" : "BAIXO",
          alerta: atrasadosCronicos.length > 0 ? `${atrasadosCronicos.length} membro(s) com ≥2 tarefas atrasadas` : "Sem atrasos crônicos",
          membros: atrasadosCronicos.map(r => ({ nome: r.nome ?? r.assigneeId, tarefas_atrasadas: r.atrasadas, nivel: r.atrasadas >= 4 ? "ALTO" : "MÉDIO" })),
        },
        riscos_cobertura: {
          nivel:  totalPosAbertas > 5 ? "ALTO" : totalPosAbertas > 0 ? "MÉDIO" : "BAIXO",
          alerta: totalPosAbertas > 0 ? `${totalPosAbertas} posição(ões) abertas em escalas publicadas` : "Todas as posições preenchidas",
          total_posicoes_abertas: totalPosAbertas,
        },
      });
    }

    // ── gerar_relatorio_asa (Sprint 11) ────────────────────────────────────────
    if (name === "gerar_relatorio_asa") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tipo     = ((input.tipo as string | undefined) ?? "SEMANAL").toUpperCase();
      const today11  = operationalDate();
      const diasBack = tipo === "MENSAL" ? 30 : 7;
      const from     = (input.dateFrom as string | undefined) ?? shiftOperationalDate(today11, -diasBack);
      const to       = (input.dateTo   as string | undefined) ?? today11;

      const [[actTotal], taskStats, [absTotal], [recTotal], [openPos], topActivity, topAbs, atrasadas] = await Promise.all([
        // Activities
        db.select({ count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)),
        // Tasks by status
        db.select({ status: tasksTable.status, count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(${tasksTable.createdAt}) between ${from} and ${to}`)).groupBy(tasksTable.status),
        // Absences
        db.select({ count: sql<number>`count(*)::int` }).from(folgasTable).where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to))),
        // Recognitions
        db.select({ count: sql<number>`count(*)::int` }).from(recognitionsTable).where(and(eq(recognitionsTable.organizationId, ctx.organizationId), sql`date(${recognitionsTable.createdAt}) between ${from} and ${to}`)),
        // Open positions
        db.select({ count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id)).where(and(ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`, inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), eq(scaleAllocationsTable.status, "OPEN"), eq(scaleAllocationsTable.active, true))),
        // Top performer
        db.select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id)).where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)).groupBy(scaleAllocationsTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(3),
        // Top absent
        db.select({ userId: folgasTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` }).from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id)).where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to))).groupBy(folgasTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(3),
        // Overdue tasks
        db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, today11))),
      ]);

      const taskMap    = Object.fromEntries(taskStats.map(t => [t.status, t.count]));
      const taskTotal  = taskStats.reduce((s, t) => s + t.count, 0);
      const taskDone   = taskMap["DONE"] ?? 0;
      const txConc     = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
      const atrasadasN = atrasadas[0]?.count ?? 0;

      return JSON.stringify({
        tipo, periodo: { de: from, ate: to }, dias: diasBack,
        instrucao: `Gere um relatório ${tipo} executivo completo com as seções abaixo. Use emojis, bullets e linguagem direta. Conclua com 1-3 aprendizados e 1-2 recomendações para o próximo período.`,
        secoes: {
          "📈 Atividades":     { total: actTotal?.count ?? 0 },
          "📌 Tarefas":        { total: taskTotal, concluidas: taskDone, taxa_conclusao: `${txConc}%`, atrasadas: atrasadasN },
          "🌴 Ausências":      { total: absTotal?.count ?? 0 },
          "🏆 Reconhecimentos":{ total: recTotal?.count ?? 0 },
          "⚠️ Posições Abertas":{ total: openPos?.count ?? 0 },
          "🌟 Destaques":      { top_performer: topActivity.slice(0, 3).map(r => ({ nome: r.nome ?? r.userId, atividades: r.count })), mais_ausencias: topAbs.slice(0, 3).map(r => ({ nome: r.nome ?? r.userId, ausencias: r.count })) },
          "💡 Saúde da Operação": {
            status: txConc >= 70 && (openPos?.count ?? 0) === 0 ? "✅ SAUDÁVEL" : txConc >= 50 && (openPos?.count ?? 0) <= 2 ? "⚠️ ATENÇÃO" : "🔴 CRÍTICA",
            sinais: [txConc < 50 ? "Taxa de conclusão de tarefas abaixo de 50%" : null, (openPos?.count ?? 0) > 3 ? "Muitas posições abertas em escalas publicadas" : null, (absTotal?.count ?? 0) > (actTotal?.count ?? 1) * 0.2 ? "Alta taxa de ausências no período" : null].filter(Boolean),
          },
        },
      });
    }

    // ── Sprint 10 — Biblioteca Inteligente e Conhecimento ────────────────────
    const BODY_LIMIT = 3000; // limite de conteúdo documental retornado por consulta

    const findDoc = async (docId?: string, titulo?: string) => {
      if (!ctx.organizationId) return null;
      if (docId) {
        const [d] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, ctx.organizationId))).limit(1);
        return d ?? null;
      }
      if (titulo) {
        const [d] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId), ilike(libraryDocumentsTable.title, `%${titulo}%`), ne(libraryDocumentsTable.status, "ARCHIVED"))).orderBy(desc(libraryDocumentsTable.updatedAt)).limit(1);
        return d ?? null;
      }
      return null;
    };

    // ── resumir_documento (Sprint 10) ─────────────────────────────────────────
    if (name === "resumir_documento") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const doc = await findDoc(input.documentId as string | undefined, input.titulo as string | undefined);
      if (!doc) return JSON.stringify({ found: false, message: "Documento não encontrado. Verifique o título ou use consultar_documentos_populares para listar documentos disponíveis." });
      const bodySnippet = doc.body.length > BODY_LIMIT ? doc.body.slice(0, BODY_LIMIT) + "\n\n[... conteúdo truncado ...]" : doc.body;
      return JSON.stringify({
        found: true,
        id:       doc.id,
        titulo:   doc.title,
        tipo:     doc.type,
        status:   doc.status,
        versao:   doc.version,
        resumo:   doc.summary ?? null,
        publicado: doc.publishedAt,
        atualizado: doc.updatedAt,
        instrucao: "Resuma este documento em linguagem clara e operacional. Destaque: propósito, regras principais, exceções e quem é afetado.",
        conteudo: bodySnippet,
      });
    }

    // ── comparar_documentos (Sprint 10) ───────────────────────────────────────
    if (name === "comparar_documentos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const id1 = input.documentId1 as string | undefined;
      const id2 = input.documentId2 as string | undefined;
      const t1  = input.titulo1 as string | undefined;
      const t2  = input.titulo2 as string | undefined;
      const v1  = input.versao1 as number | undefined;
      const v2  = input.versao2 as number | undefined;

      // Compare two versions of the same document
      if ((id1 || t1) && !id2 && !t2) {
        const doc = await findDoc(id1, t1);
        if (!doc) return JSON.stringify({ found: false, message: "Documento não encontrado." });
        const versions = await db.select().from(libraryDocumentVersionsTable).where(eq(libraryDocumentVersionsTable.documentId, doc.id)).orderBy(desc(libraryDocumentVersionsTable.version)).limit(5);
        if (versions.length < 2) return JSON.stringify({ found: true, message: `O documento "${doc.title}" tem apenas 1 versão registrada — não há versão anterior para comparar.`, versao_atual: doc.version });
        const verA = v1 ? versions.find(v => v.version === v1) : versions[1];
        const verB = v2 ? versions.find(v => v.version === v2) : versions[0];
        return JSON.stringify({
          found: true,
          instrucao: "Compare as duas versões abaixo. Destaque: o que foi adicionado, removido ou alterado. Use bullets para clareza.",
          documento: doc.title,
          versao_antiga: { versao: verA?.version, body: (verA?.body ?? "").slice(0, BODY_LIMIT) },
          versao_nova:   { versao: verB?.version, body: (verB?.body ?? "").slice(0, BODY_LIMIT) },
        });
      }

      // Compare two different documents
      const [doc1, doc2] = await Promise.all([findDoc(id1, t1), findDoc(id2, t2)]);
      if (!doc1 || !doc2) return JSON.stringify({ found: false, message: `${!doc1 ? "Primeiro" : "Segundo"} documento não encontrado.` });
      return JSON.stringify({
        found: true,
        instrucao: "Compare os dois documentos abaixo. Destaque diferenças de escopo, regras, público-alvo e aplicabilidade. Use bullets para clareza.",
        documento_1: { titulo: doc1.title, tipo: doc1.type, versao: doc1.version, status: doc1.status, body: doc1.body.slice(0, BODY_LIMIT) },
        documento_2: { titulo: doc2.title, tipo: doc2.type, versao: doc2.version, status: doc2.status, body: doc2.body.slice(0, BODY_LIMIT) },
      });
    }

    // ── consultar_perguntas_frequentes (Sprint 10) ────────────────────────────
    if (name === "consultar_perguntas_frequentes") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tipoFilter = input.tipo as string | undefined;
      const docs = await db
        .select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, version: libraryDocumentsTable.version, status: libraryDocumentsTable.status, summary: libraryDocumentsTable.summary, updatedAt: libraryDocumentsTable.updatedAt })
        .from(libraryDocumentsTable)
        .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId), tipoFilter ? eq(libraryDocumentsTable.type, tipoFilter as typeof libraryDocumentsTable.type._.data) : ne(libraryDocumentsTable.status, "ARCHIVED")))
        .orderBy(desc(libraryDocumentsTable.version), desc(libraryDocumentsTable.updatedAt))
        .limit(30);

      if (docs.length === 0) return JSON.stringify({ total: 0, message: "Nenhum documento publicado encontrado na biblioteca.", documentos: [] });

      // Group by type
      const byType = docs.reduce<Record<string, typeof docs>>((acc, d) => { acc[d.type] = acc[d.type] ?? []; acc[d.type].push(d); return acc; }, {});
      const moreVersions = docs.filter(d => d.version > 1).sort((a, b) => b.version - a.version).slice(0, 5);

      const TYPE_LABELS: Record<string, string> = {
        OPERATIONAL_PROCEDURE: "Procedimentos Operacionais",
        RULES_AND_POLICIES:    "Regras e Políticas",
        CHARACTER_REFERENCE:   "Referências de Personagem",
        COSTUME_REFERENCE:     "Referências de Figurino",
        ONBOARDING_MATERIAL:   "Material de Integração",
        SAFETY_PROCEDURE:      "Procedimentos de Segurança",
      };

      return JSON.stringify({
        total: docs.length,
        instrucao: "Apresente os tópicos mais relevantes da biblioteca. Destaque quais documentos têm múltiplas versões (mais atualizados) e ofereça resumir_documento para o que o usuário quiser saber mais.",
        por_tipo: Object.entries(byType).map(([t, ds]) => ({ tipo: TYPE_LABELS[t] ?? t, quantidade: ds.length, documentos: ds.map(d => ({ id: d.id, titulo: d.title, versao: d.version, status: d.status })) })),
        mais_atualizados: moreVersions.map(d => ({ id: d.id, titulo: d.title, versao: d.version })),
      });
    }

    // ── consultar_documentos_populares (Sprint 10) ────────────────────────────
    if (name === "consultar_documentos_populares") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limite = (input.limite as number | undefined) ?? 5;
      const staleDate = new Date(Date.now() - 90 * 86400000);

      const [recentlyUpdated, stale, drafts, archived] = await Promise.all([
        // Recently updated
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, version: libraryDocumentsTable.version, updatedAt: libraryDocumentsTable.updatedAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "UPDATED"))!)
          .orderBy(desc(libraryDocumentsTable.updatedAt)).limit(limite),
        // Stale: PUBLISHED but not touched in 90 days
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, version: libraryDocumentsTable.version, publishedAt: libraryDocumentsTable.publishedAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "PUBLISHED"), lte(libraryDocumentsTable.updatedAt, staleDate))!)
          .orderBy(libraryDocumentsTable.updatedAt).limit(limite),
        // Drafts
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, createdAt: libraryDocumentsTable.createdAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "DRAFT"))!)
          .orderBy(desc(libraryDocumentsTable.createdAt)).limit(limite),
        // Archived
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, archivedAt: libraryDocumentsTable.archivedAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "ARCHIVED"))!)
          .orderBy(desc(libraryDocumentsTable.archivedAt)).limit(limite),
      ]);

      return JSON.stringify({
        instrucao: "Apresente o estado da biblioteca. Destaque documentos que precisam de revisão (desatualizados), rascunhos pendentes e o que foi recém-atualizado. Ofereça ações concretas ao gestor.",
        recem_atualizados: { quantidade: recentlyUpdated.length, documentos: recentlyUpdated },
        desatualizados:    { quantidade: stale.length, alerta: stale.length > 0 ? "⚠️ Documentos sem revisão há mais de 90 dias" : null, documentos: stale },
        rascunhos_pendentes: { quantidade: drafts.length, alerta: drafts.length > 0 ? "📝 Rascunhos aguardando publicação" : null, documentos: drafts },
        arquivados:        { quantidade: archived.length, documentos: archived },
      });
    }

    // ── sugerir_leituras (Sprint 10) ──────────────────────────────────────────
    if (name === "sugerir_leituras") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tema  = input.tema as string;
      const tipo  = input.tipo as string | undefined;
      const limit = (input.limit as number | undefined) ?? 5;

      const docs = await db
        .select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, summary: libraryDocumentsTable.summary, status: libraryDocumentsTable.status, version: libraryDocumentsTable.version })
        .from(libraryDocumentsTable)
        .where(and(
          eq(libraryDocumentsTable.orgId, ctx.organizationId),
          ne(libraryDocumentsTable.status, "ARCHIVED"),
          tipo ? eq(libraryDocumentsTable.type, tipo as typeof libraryDocumentsTable.type._.data) : sql`true`,
          or(ilike(libraryDocumentsTable.title, `%${tema}%`), ilike(libraryDocumentsTable.summary, `%${tema}%`), ilike(libraryDocumentsTable.body, `%${tema}%`)),
        ))
        .orderBy(desc(libraryDocumentsTable.updatedAt))
        .limit(limit);

      if (docs.length === 0) return JSON.stringify({ found: false, tema, message: `Nenhum documento encontrado sobre "${tema}". Tente consultar_documentos_populares para ver todos os documentos disponíveis.` });
      return JSON.stringify({
        tema,
        total: docs.length,
        instrucao: `Apresente as ${docs.length} sugestão(ões) de leitura sobre "${tema}". Para cada uma, explique brevemente por que é relevante e ofereça resumir_documento.`,
        sugestoes: docs.map(d => ({ id: d.id, titulo: d.title, tipo: d.type, status: d.status, versao: d.version, resumo: d.summary ?? null })),
      });
    }

    // ── Sprint 09 helpers ─────────────────────────────────────────────────────
    const today09   = operationalDate();
    const month09   = today09.slice(0, 7) + "-01";
    const days30ago = shiftOperationalDate(today09, -30);
    const days90ago = shiftOperationalDate(today09, -90);

    // ── consultar_estatisticas (Sprint 09) ────────────────────────────────────
    if (name === "consultar_estatisticas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from = (input.dateFrom as string | undefined) ?? month09;
      const to   = (input.dateTo   as string | undefined) ?? today09;
      const opFilter = ctx.operationId ? sql`and operation_id = ${ctx.operationId}` : sql``;

      // Activities
      const [actTotal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true),
          sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`,
        ));

      // Tasks by status
      const taskStats = await db
        .select({ status: tasksTable.status, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(created_at) between ${from} and ${to}`))
        .groupBy(tasksTable.status);

      // Absences
      const [absTotal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, to),
          gte(folgasTable.endDate, from),
        ));

      // Recognitions
      const [recTotal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(recognitionsTable)
        .where(and(eq(recognitionsTable.organizationId, ctx.organizationId), sql`date(created_at) between ${from} and ${to}`));

      // Open positions
      const [openPos] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          eq(scaleAllocationsTable.status, "OPEN"), eq(scaleAllocationsTable.active, true),
        ));

      const taskMap = Object.fromEntries(taskStats.map(t => [t.status, t.count]));
      const taskDone = taskMap["DONE"] ?? 0;
      const taskTotal = taskStats.reduce((s, t) => s + t.count, 0);
      const completionRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

      return JSON.stringify({
        periodo: { de: from, ate: to },
        atividades: actTotal?.count ?? 0,
        tarefas: { total: taskTotal, concluidas: taskDone, pendentes: (taskMap["CREATED"] ?? 0) + (taskMap["IN_PROGRESS"] ?? 0), atrasadas: taskMap["CHANGES_REQUESTED"] ?? 0, taxa_conclusao: `${completionRate}%` },
        ausencias: absTotal?.count ?? 0,
        reconhecimentos: recTotal?.count ?? 0,
        posicoes_abertas: openPos?.count ?? 0,
        message: `📈 Período ${from} → ${to}: ${actTotal?.count ?? 0} atividades, ${taskTotal} tarefas (${completionRate}% concluídas), ${absTotal?.count ?? 0} ausências, ${recTotal?.count ?? 0} reconhecimentos.`,
      });
    }

    // ── consultar_indicadores (Sprint 09) ─────────────────────────────────────
    if (name === "consultar_indicadores") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from = (input.dateFrom as string | undefined) ?? days30ago;
      const to   = (input.dateTo   as string | undefined) ?? today09;

      // Top performer: most activities
      const topActivity = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
        .groupBy(scaleAllocationsTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      // Most absences
      const topAbsence = await db
        .select({ userId: folgasTable.userId, count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId!) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from))!)
        .groupBy(folgasTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      // Task completion
      const [totalTasks] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), sql`date(created_at) between ${from} and ${to}`)!);
      const [doneTasks]  = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"), sql`date(updated_at) between ${from} and ${to}`)!);
      const completionRate = totalTasks?.count > 0 ? Math.round(((doneTasks?.count ?? 0) / totalTasks.count) * 100) : 0;

      // Resolve names
      const allIds = [...new Set([...topActivity.map(a => a.userId), ...topAbsence.map(a => a.userId)].filter(Boolean))] as string[];
      const nameMap = new Map((await (allIds.length > 0 ? db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, allIds)) : Promise.resolve([]))).map(u => [u.id, u.name]));

      return JSON.stringify({
        periodo: { de: from, ate: to },
        top_performer: topActivity.map(a => ({ nome: nameMap.get(a.userId!) ?? a.userId, atividades: a.count })),
        mais_ausencias: topAbsence.map(a => ({ nome: nameMap.get(a.userId!) ?? a.userId, ausencias: a.count })),
        taxa_conclusao_tarefas: `${completionRate}%`,
        total_tarefas: totalTasks?.count ?? 0,
        tarefas_concluidas: doneTasks?.count ?? 0,
        message: `📊 KPIs ${from} → ${to}: top performer ${nameMap.get(topActivity[0]?.userId!) ?? "—"} (${topActivity[0]?.count ?? 0} atividades), taxa conclusão de tarefas ${completionRate}%, ${topAbsence[0]?.count ?? 0} ausências máx./membro.`,
      });
    }

    // ── consultar_desempenho (Sprint 09) ──────────────────────────────────────
    if (name === "consultar_desempenho") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days30ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 10;
      const uid   = input.userId as string | undefined;

      const actFilter = uid
        ? and(eq(scaleAllocationsTable.userId, uid), inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)
        : and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`);
      const allocByMember = await db
        .select({ userId: scaleAllocationsTable.userId, atividades: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(actFilter!)
        .groupBy(scaleAllocationsTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const doneTskFilter = uid
        ? and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.assigneeId, uid), eq(tasksTable.status, "COMPLETED"), sql`date(updated_at) between ${from} and ${to}`)
        : and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"), sql`date(updated_at) between ${from} and ${to}`);
      const doneByMember = await db
        .select({ assigneeId: tasksTable.assigneeId, concluidas: sql<number>`count(*)::int` })
        .from(tasksTable).where(doneTskFilter!).groupBy(tasksTable.assigneeId).limit(limit);
      const doneMap = new Map(doneByMember.map(t => [t.assigneeId, t.concluidas]));

      const delayedByMember = await db
        .select({ assigneeId: tasksTable.assigneeId, atrasadas: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId!), uid ? eq(tasksTable.assigneeId, uid) : sql`true`, inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), sql`${tasksTable.dueDate} < ${today09}`)!)
        .groupBy(tasksTable.assigneeId).limit(limit);
      const delayMap = new Map(delayedByMember.map(t => [t.assigneeId, t.atrasadas]));

      const absFilter = uid
        ? and(eq(folgasTable.userId, uid), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from))
        : and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from));
      const absByMember = await db
        .select({ userId: folgasTable.userId, ausencias: sql<number>`count(*)::int` })
        .from(folgasTable).where(absFilter!).groupBy(folgasTable.userId).limit(limit);
      const absMap = new Map(absByMember.map(f => [f.userId, f.ausencias]));

      const userIds = [...new Set(allocByMember.map(a => a.userId).filter(Boolean))] as string[];
      const nameMap = new Map((userIds.length > 0 ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds)) : []).map(u => [u.id, u.name]));

      const desempenho = allocByMember.filter(a => a.userId).map(a => ({
        membro:     nameMap.get(a.userId!) ?? a.userId,
        atividades: a.atividades,
        concluidas: doneMap.get(a.userId!) ?? 0,
        atrasadas:  delayMap.get(a.userId!) ?? 0,
        ausencias:  absMap.get(a.userId!) ?? 0,
        score:      a.atividades + (doneMap.get(a.userId!) ?? 0) - (delayMap.get(a.userId!) ?? 0) * 2 - (absMap.get(a.userId!) ?? 0),
      })).sort((a, b) => b.score - a.score);

      if (desempenho.length === 0) return JSON.stringify({ total: 0, message: "Nenhum dado de desempenho encontrado.", desempenho: [] });
      return JSON.stringify({ total: desempenho.length, periodo: { de: from, ate: to }, message: `📊 Desempenho de ${desempenho.length} membro(s) — ${from} → ${to}.`, desempenho });
    }

    // ── consultar_ausencias_historicas (Sprint 09) ────────────────────────────
    if (name === "consultar_ausencias_historicas") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days90ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 10;

      const byMember = await db
        .select({ userId: folgasTable.userId, userName: usersTable.name, total: sql<number>`count(*)::int`, noShow: sql<number>`sum(case when type='NO_SHOW' then 1 else 0 end)::int`, dayOff: sql<number>`sum(case when type='DAY_OFF' then 1 else 0 end)::int` })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from)))
        .groupBy(folgasTable.userId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [totalRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from)));

      if (byMember.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma ausência registrada no período.", ranking: [] });
      return JSON.stringify({
        total: totalRow?.count ?? 0,
        periodo: { de: from, ate: to },
        message: `🌴 ${totalRow?.count ?? 0} ausência(s) no período. Top: ${byMember[0]?.userName ?? "—"} com ${byMember[0]?.total} ausências.`,
        ranking: byMember.map(r => ({ membro: r.userName ?? r.userId, total: r.total, no_show: r.noShow, day_off: r.dayOff })),
      });
    }

    // ── consultar_tarefas_historicas (Sprint 09) ──────────────────────────────
    if (name === "consultar_tarefas_historicas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days30ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 10;

      const byMember = await db
        .select({
          assigneeId: tasksTable.assigneeId,
          nome:       usersTable.name,
          total:      sql<number>`count(*)::int`,
          concluidas: sql<number>`sum(case when status='DONE' then 1 else 0 end)::int`,
          atrasadas:  sql<number>`sum(case when status in ('CREATED','IN_PROGRESS') and due_date < ${today09} then 1 else 0 end)::int`,
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), ctx.operationId ? eq(tasksTable.operationId, ctx.operationId) : sql`true`, sql`date(${tasksTable.createdAt}) between ${from} and ${to}`))
        .groupBy(tasksTable.assigneeId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [totals] = await db
        .select({
          total:      sql<number>`count(*)::int`,
          concluidas: sql<number>`sum(case when status='DONE' then 1 else 0 end)::int`,
          atrasadas:  sql<number>`sum(case when status in ('CREATED','IN_PROGRESS') and due_date < ${today09} then 1 else 0 end)::int`,
        })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(${tasksTable.createdAt}) between ${from} and ${to}`));

      const txConc = totals?.total > 0 ? Math.round(((totals?.concluidas ?? 0) / totals.total) * 100) : 0;
      return JSON.stringify({
        total: totals?.total ?? 0,
        concluidas: totals?.concluidas ?? 0,
        atrasadas: totals?.atrasadas ?? 0,
        taxa_conclusao: `${txConc}%`,
        periodo: { de: from, ate: to },
        message: `📌 ${totals?.total ?? 0} tarefas no período: ${txConc}% concluídas, ${totals?.atrasadas ?? 0} atrasadas.`,
        por_membro: byMember.map(r => ({ membro: r.nome ?? r.assigneeId ?? "—", total: r.total, concluidas: r.concluidas, atrasadas: r.atrasadas, taxa: r.total > 0 ? `${Math.round((r.concluidas / r.total) * 100)}%` : "—" })),
      });
    }

    // ── consultar_carga_historica (Sprint 09) ─────────────────────────────────
    if (name === "consultar_carga_historica") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days30ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 15;

      const byMember = await db
        .select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, atividades: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
        .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
        .groupBy(scaleAllocationsTable.userId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [avgRow] = await db
        .select({ media: sql<number>`avg(cnt)::numeric(6,1)` })
        .from(
          db.select({ userId: scaleAllocationsTable.userId, cnt: sql<number>`count(*)` })
            .from(scaleAllocationsTable)
            .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
            .groupBy(scaleAllocationsTable.userId)
            .as("sub"),
        );

      if (byMember.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma atividade registrada no período.", carga: [] });
      const max = byMember[0]?.atividades ?? 0;
      const min = byMember[byMember.length - 1]?.atividades ?? 0;
      return JSON.stringify({
        periodo: { de: from, ate: to },
        membros: byMember.length,
        media_atividades: Number(avgRow?.media ?? 0),
        max_atividades:   max,
        min_atividades:   min,
        desequilibrio:    max - min > (Number(avgRow?.media ?? 0) * 0.5) ? "⚠️ Desequilíbrio de carga detectado" : "✅ Carga relativamente equilibrada",
        message: `📊 Carga ${from} → ${to}: média ${avgRow?.media ?? 0} atividades/membro. Top: ${byMember[0]?.nome ?? "—"} com ${max}. Menor: ${byMember[byMember.length - 1]?.nome ?? "—"} com ${min}.`,
        carga: byMember.map(r => ({ membro: r.nome ?? r.userId ?? "—", atividades: r.atividades })),
      });
    }

    // ── Sprint 08 shared helper ───────────────────────────────────────────────
    const fetchMsgs = async (opts: { threadId?: string; groupId?: string; limit?: number; sinceHours?: number }) => {
      const limit      = opts.limit ?? 30;
      const sinceMs    = (opts.sinceHours ?? 48) * 3_600_000;
      const since      = new Date(Date.now() - sinceMs);
      const conditions: ReturnType<typeof eq>[] = [];
      if (opts.threadId) conditions.push(eq(messagesTable.threadId, opts.threadId));
      if (opts.groupId)  conditions.push(eq(messagesTable.groupId, opts.groupId));
      // Scope to org via threads when no direct filter
      if (!opts.threadId && !opts.groupId && ctx.organizationId) {
        const orgThreadIds = await db
          .select({ id: messageThreadsTable.id })
          .from(messageThreadsTable)
          .where(eq(messageThreadsTable.orgId, ctx.organizationId))
          .limit(50);
        if (orgThreadIds.length > 0) {
          conditions.push(inArray(messagesTable.threadId, orgThreadIds.map(t => t.id)));
        }
      }
      conditions.push(gte(messagesTable.createdAt, since));
      return db
        .select({
          id:        messagesTable.id,
          sender:    messagesTable.senderName,
          content:   messagesTable.content,
          createdAt: messagesTable.createdAt,
          threadId:  messagesTable.threadId,
          groupId:   messagesTable.groupId,
        })
        .from(messagesTable)
        .where(conditions.length > 0 ? and(...conditions) : gte(messagesTable.createdAt, since))
        .orderBy(desc(messagesTable.createdAt))
        .limit(limit);
    };

    // ── analisar_conversa (Sprint 08) ─────────────────────────────────────────
    if (name === "analisar_conversa") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 30, sinceHours: (input.sinceHours as number | undefined) ?? 48 });
      if (msgs.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma mensagem encontrada no período.", mensagens: [] });
      const participantes = [...new Set(msgs.map(m => m.sender).filter(Boolean))];
      return JSON.stringify({
        total: msgs.length,
        participantes,
        message: `${msgs.length} mensagem(ns) encontrada(s) de ${participantes.length} participante(s). Analise o conteúdo abaixo.`,
        mensagens: msgs.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_eventos (Sprint 08) ──────────────────────────────────────────
    if (name === "detectar_eventos") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const EVENTO_KW = /ensaio|reunião|reuniao|apresentação|apresentacao|show|treino|aula|sessão|sessao|\d{1,2}h|\d{1,2}:\d{2}|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo/i;
      const filtered = msgs.filter(m => EVENTO_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a evento/ensaio encontrada nas mensagens.", eventos: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis eventos detectados. Extraia data, hora e tipo de cada um.`,
        sugestao: "Se identificar um ensaio ou evento confirmado, use criar_ensaio_rascunho para criar um rascunho e peça confirmação.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_tarefas (Sprint 08) ──────────────────────────────────────────
    if (name === "detectar_tarefas") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const TAREFA_KW = /precisa|fica responsável|fica responsavel|responsável por|responsavel por|entregar|terminar|concluir|fazer|criar|alguém pode|alguem pode|quem pode|prazo|até|ate|deadline/i;
      const filtered = msgs.filter(m => TAREFA_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a tarefa encontrada nas mensagens.", tarefas: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis tarefas detectadas. Extraia responsável, descrição e prazo.`,
        sugestao: "Para cada tarefa identificada, pergunte se deseja criar via criar_solicitacao_troca ou registrar como tarefa formal.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_ausencias (Sprint 08) ────────────────────────────────────────
    if (name === "detectar_ausencias") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const AUSENCIA_KW = /não vai vir|nao vai vir|vai faltar|não virá|nao vira|não vem|nao vem|afastado|ausente|falta|não consegue|nao consegue|não pode|nao pode|está de folga|esta de folga|saiu|licença|licenca/i;
      const filtered = msgs.filter(m => AUSENCIA_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a ausência encontrada nas mensagens.", ausencias: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis ausências detectadas. Identifique o membro e a data.`,
        sugestao: "Para cada ausência identificada, resolva o nome via consultar_membros e pergunte se deseja registrar via registrar_ausencia.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_trocas (Sprint 08) ───────────────────────────────────────────
    if (name === "detectar_trocas") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const TROCA_KW = /troca|trocar|cobrir|cobre|substitui|substituir|vai no lugar|no lugar de|cede|ceder/i;
      const filtered = msgs.filter(m => TROCA_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a troca de escala encontrada.", trocas: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis trocas detectadas. Identifique os dois membros e a data.`,
        sugestao: "Para cada troca identificada, resolva os nomes via consultar_membros e pergunte se deseja abrir via criar_solicitacao_troca.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── resumir_conversa (Sprint 08) ──────────────────────────────────────────
    if (name === "resumir_conversa") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 48 });
      if (msgs.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma mensagem encontrada para resumir.", mensagens: [] });
      const participantes = [...new Set(msgs.map(m => m.sender).filter(Boolean))];
      const oldest = msgs[msgs.length - 1]?.createdAt;
      const newest = msgs[0]?.createdAt;
      return JSON.stringify({
        instrucao: "Gere um resumo operacional estruturado com: participantes, assuntos principais, decisões, ensaios/eventos mencionados, ausências, trocas e tarefas implícitas. Use emojis para categorias.",
        total: msgs.length,
        participantes,
        periodo: { de: oldest, ate: newest },
        message: `${msgs.length} mensagem(ns) de ${participantes.length} participante(s). Gere o resumo abaixo.`,
        mensagens: msgs.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── destacar_itens (Sprint 08) ────────────────────────────────────────────
    if (name === "destacar_itens") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      if (msgs.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma mensagem encontrada.", itens: [] });

      const KW_CATS = [
        { cat: "📅 EVENTO",   re: /ensaio|reunião|reuniao|apresentação|apresentacao|show|\d{1,2}h|\d{1,2}:\d{2}/i },
        { cat: "🌴 AUSÊNCIA", re: /faltar|não vai vir|nao vai vir|afastado|ausente|folga|não vem|nao vem/i },
        { cat: "🔄 TROCA",    re: /troca|trocar|cobrir|cobre|substitui/i },
        { cat: "📌 TAREFA",   re: /precisa|responsável|responsavel|entregar|terminar|fazer|prazo/i },
        { cat: "🎉 SOCIAL",   re: /aniversário|aniversario|parabéns|parabens|feliz|conquista|marco/i },
        { cat: "⚠️ ATENÇÃO",  re: /urgente|atenção|atencao|importante|crítico|critico|problema|erro/i },
      ];

      const itens: { categoria: string; remetente: string; conteudo: string; horario: unknown; sugestao: string }[] = [];
      const SUGESTOES: Record<string, string> = {
        "📅 EVENTO":   "Pergunte se deseja criar um evento ou ensaio via criar_ensaio_rascunho.",
        "🌴 AUSÊNCIA / AFASTAMENTO / FÉRIAS": "Confirme o membro e as datas (início e fim). Para período multi-dia: startDate + endDate em registrar_ausencia (tipo AFASTAMENTO ou RECESSO). Para folga de um dia: apenas startDate (tipo DAY_OFF). SEMPRE confirme antes de executar.",
        "🔄 TROCA":    "Confirme os dois membros, depois ofereça criar_solicitacao_troca.",
        "📌 TAREFA":   "Confirme responsável e prazo, depois ofereça criar uma tarefa formal.",
        "🎉 SOCIAL":   "Considere criar um reconhecimento ou aviso comemorativo.",
        "⚠️ ATENÇÃO":  "Destaque ao supervisor. Verifique se requer ação imediata.",
      };

      for (const m of msgs) {
        for (const { cat, re } of KW_CATS) {
          if (re.test(m.content)) {
            itens.push({ categoria: cat, remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt, sugestao: SUGESTOES[cat] ?? "" });
            break;
          }
        }
      }

      if (itens.length === 0) return JSON.stringify({ total: 0, message: "Nenhum item operacional detectado nas mensagens.", itens: [] });
      return JSON.stringify({
        total: itens.length,
        de_total: msgs.length,
        message: `${itens.length} item(ns) relevante(s) de ${msgs.length} mensagem(ns). Apresente por categoria e sugira ações.`,
        itens,
      });
    }

    // ── detectar_conquistas (Sprint 07) ──────────────────────────────────────
    if (name === "detectar_conquistas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limit    = (input.limit as number | undefined) ?? 20;
      const MILESTONES = [50, 100, 200, 500];

      // Scale allocations count per user
      const allocFilter = input.userId
        ? and(eq(scaleAllocationsTable.userId, input.userId as string), inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true))
        : and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true));
      const allocCounts = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(allocFilter!)
        .groupBy(scaleAllocationsTable.userId)
        .limit(limit);

      // Completed tasks count per user
      const taskFilter = input.userId
        ? and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.assigneeId, input.userId as string), eq(tasksTable.status, "COMPLETED"))
        : and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"));
      const taskCounts = await db
        .select({ assigneeId: tasksTable.assigneeId, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(taskFilter!)
        .groupBy(tasksTable.assigneeId)
        .limit(limit);

      const taskMap = new Map(taskCounts.map(t => [t.assigneeId, t.count]));
      const userIds = [...new Set(allocCounts.map(a => a.userId).filter(Boolean))] as string[];
      const userRows = userIds.length > 0
        ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, ctx.organizationId)))
        : [];
      const nameMap = new Map(userRows.map(u => [u.id, u.name]));

      const conquistas: { membro: string; tipo: string; marco: number; label: string }[] = [];
      for (const a of allocCounts) {
        if (!a.userId) continue;
        const nome = nameMap.get(a.userId) ?? a.userId;
        for (const m of MILESTONES) {
          if (a.count === m) conquistas.push({ membro: nome, tipo: "ATIVIDADES", marco: m, label: `🏆 ${nome} atingiu ${m} atividades escaladas!` });
        }
        const tasks = taskMap.get(a.userId) ?? 0;
        for (const m of MILESTONES) {
          if (tasks === m) conquistas.push({ membro: nome, tipo: "TAREFAS", marco: m, label: `🏆 ${nome} concluiu ${m} tarefas!` });
        }
      }

      if (conquistas.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma conquista de marco atingida no momento.", conquistas: [] });
      return JSON.stringify({ total: conquistas.length, message: `${conquistas.length} conquista(s) de marco detectada(s)!`, conquistas });
    }

    // ── consultar_marcos (Sprint 07) ──────────────────────────────────────────
    if (name === "consultar_marcos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const daysAhead = (input.daysAhead as number | undefined) ?? 7;
      const today     = new Date();
      const marcos: { userId: string; nome: string; tipo: string; label: string; data: string }[] = [];

      const orgUsers = await db
        .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt, birthDate: usersTable.birthDate })
        .from(usersTable)
        .where(and(eq(usersTable.organizationId, ctx.organizationId), eq(usersTable.status, "ACTIVE")))
        .limit(200);

      for (let offset = 0; offset <= daysAhead; offset++) {
        const d = new Date(today); d.setDate(d.getDate() + offset);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateStr = `${d.getFullYear()}-${mm}-${dd}`;

        for (const u of orgUsers) {
          // Time of house milestones
          const joined = new Date(u.createdAt);
          const years  = d.getFullYear() - joined.getFullYear();
          const months = (d.getFullYear() - joined.getFullYear()) * 12 + (d.getMonth() - joined.getMonth());
          if (joined.getDate() === d.getDate() && joined.getMonth() === d.getMonth()) {
            if (years > 0 && years <= 10) marcos.push({ userId: u.id, nome: u.name, tipo: "TIME_OF_HOUSE", label: `${years} ano${years > 1 ? "s" : ""} na ASA`, data: dateStr });
            else if (months === 3 || months === 6) marcos.push({ userId: u.id, nome: u.name, tipo: "TIME_OF_HOUSE", label: `${months} meses na ASA`, data: dateStr });
          }
          // Birthdays
          if (u.birthDate) {
            const bm = u.birthDate.slice(5, 7); const bd = u.birthDate.slice(8, 10);
            if (bm === mm && bd === dd) marcos.push({ userId: u.id, nome: u.name, tipo: "BIRTHDAY", label: `🎉 Aniversário`, data: dateStr });
          }
        }
      }

      if (marcos.length === 0) return JSON.stringify({ total: 0, message: `Nenhum marco nos próximos ${daysAhead} dias.`, marcos: [] });
      return JSON.stringify({ total: marcos.length, daysAhead, message: `${marcos.length} marco(s) nos próximos ${daysAhead} dias.`, marcos });
    }

    // ── criar_reconhecimento_automatico (Sprint 07) ───────────────────────────
    if (name === "criar_reconhecimento_automatico") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar reconhecimentos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const recUserId      = input.userId       as string;
      const recUserName    = input.userName     as string;
      const triggerType    = input.triggerType  as string;
      const triggerLabel   = input.triggerLabel as string;
      const customMessage  = input.customMessage as string | undefined;

      const autoMessages: Record<string, string> = {
        BIRTHDAY:      `🎉 Hoje é um dia especial — é o aniversário de ${recUserName}! Em nome de toda a equipe, parabéns! Sua dedicação e energia fazem toda a diferença na nossa operação.`,
        TIME_OF_HOUSE: `⭐ ${recUserName} completa ${triggerLabel} com a gente! Obrigado por sua trajetória, comprometimento e por fazer parte desta equipe incrível.`,
        ACHIEVEMENT:   `🏆 ${recUserName} atingiu um marco: ${triggerLabel}! Uma conquista que reflete esforço, dedicação e presença constante. Parabéns!`,
      };
      const message = customMessage ?? autoMessages[triggerType] ?? `🎖️ Reconhecimento especial para ${recUserName}: ${triggerLabel}.`;
      const title   = triggerType === "BIRTHDAY" ? `🎂 Feliz aniversário, ${recUserName.split(" ")[0]}!` : `${triggerType === "TIME_OF_HOUSE" ? "⭐" : "🏆"} ${triggerLabel} — ${recUserName.split(" ")[0]}`;

      const [autoTarget] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.id, recUserId), eq(usersTable.organizationId, ctx.organizationId)))
        .limit(1);
      if (!autoTarget) return JSON.stringify({ error: "Membro não encontrado nesta organização" });
      const [rec] = await db.insert(recognitionsTable).values({
        organizationId: ctx.organizationId,
        userId:         recUserId,
        type:           `AUTO_${triggerType}`,
        title,
        message,
        createdBy:      ctx.userId,
        publishedAt:    new Date(),
      }).returning();
      try {
        await sendNotification({
          userId:     recUserId,
          type:       "RECOGNITION_RECEIVED",
          title:      "🎉 Você recebeu um reconhecimento!",
          message:    title,
          priority:   "IMPORTANT",
          category:   "system",
          entityType: "recognition",
          entityId:   rec.id,
        });
      } catch (err) { console.error("Falha ao notificar reconhecimento automático", { targetUserId: recUserId, recognitionId: rec.id, err }); }

      return JSON.stringify({
        created: true,
        id: rec.id,
        title,
        message,
        trigger: triggerLabel,
        displayMessage: `🎖️ Reconhecimento "${title}" criado e publicado! ${recUserName} pode ver no Mural da Equipe.`,
      });
    }

    // ── consultar_historico_membro (Sprint 07) ────────────────────────────────
    if (name === "consultar_historico_membro") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const memberId   = input.userId   as string;
      const memberName = (input.userName as string | undefined) ?? memberId;

      const [userRow] = await db
        .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt, birthDate: usersTable.birthDate })
        .from(usersTable)
        .where(and(eq(usersTable.id, memberId), eq(usersTable.organizationId, ctx.organizationId)))
        .limit(1);

      if (!userRow) return JSON.stringify({ error: "Membro não encontrado" });

      const today   = new Date();
      const joined  = new Date(userRow.createdAt);
      const months  = (today.getFullYear() - joined.getFullYear()) * 12 + (today.getMonth() - joined.getMonth());
      const years   = Math.floor(months / 12);
      const tempoDeCasa = years >= 1 ? `${years} ano${years > 1 ? "s" : ""}` : `${months} mês${months !== 1 ? "es" : ""}`;

      const recRows = await db
        .select({ id: recognitionsTable.id, type: recognitionsTable.type, title: recognitionsTable.title, publishedAt: recognitionsTable.publishedAt })
        .from(recognitionsTable)
        .where(and(eq(recognitionsTable.userId, memberId), eq(recognitionsTable.organizationId, ctx.organizationId)))
        .orderBy(desc(recognitionsTable.createdAt))
        .limit(10);

      const [activityCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.userId, memberId), inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true)));

      const [tasksDone] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.assigneeId, memberId), eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"))!);

      return JSON.stringify({
        membro: userRow.name,
        aniversario: userRow.birthDate ?? "não registrado",
        tempoDeCasa,
        mesesNaASA: months,
        reconhecimentos: recRows.map(r => ({ titulo: r.title, tipo: r.type, data: r.publishedAt })),
        totalReconhecimentos: recRows.length,
        atividadesRealizadas: activityCount?.count ?? 0,
        tarefasConcluidas: tasksDone?.count ?? 0,
        message: `📋 Histórico de ${userRow.name}: ${tempoDeCasa} na ASA, ${activityCount?.count ?? 0} atividades, ${tasksDone?.count ?? 0} tarefas concluídas, ${recRows.length} reconhecimento(s).`,
      });
    }

    // ── consultar_riscos_operacionais (Sprint 06) ─────────────────────────────
    if (name === "consultar_riscos_operacionais") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today = operationalDate();
      const date  = (input.date as string | undefined) ?? today;
      const risks: { severity: string; type: string; message: string; userId?: string; userName?: string }[] = [];

      // 1. Overdue tasks
      const overdueTasks = await db
        .select({ title: tasksTable.title, dueDate: tasksTable.dueDate, assigneeName: usersTable.name, assigneeId: tasksTable.assigneeId })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          ctx.operationId ? eq(tasksTable.operationId, ctx.operationId) : sql`true`,
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
          sql`${tasksTable.dueDate} < ${today}`,
        ))
        .limit(10);
      for (const t of overdueTasks) {
        risks.push({ severity: "HIGH", type: "TAREFA_ATRASADA", message: `Tarefa "${t.title}" atrasada (venceu em ${t.dueDate}).`, userId: t.assigneeId ?? undefined, userName: t.assigneeName ?? undefined });
      }

      // 2. Members on folga with scale allocations on that date
      const folgasToday = await db
        .select({ userId: folgasTable.userId, userName: usersTable.name })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate, date),
        ))
        .limit(20);
      if (folgasToday.length > 0) {
        const folgaUserIds = folgasToday.map(f => f.userId).filter(Boolean) as string[];
        const conflictAllocs = await db
          .select({ userId: scaleAllocationsTable.userId, label: scaleAllocationsTable.manualLabel })
          .from(scaleAllocationsTable)
          .where(and(
            inArray(scaleAllocationsTable.userId, folgaUserIds),
            eq(scaleAllocationsTable.manualDate, date),
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true),
          ))
          .limit(20);
        for (const a of conflictAllocs) {
          const fn = folgasToday.find(f => f.userId === a.userId);
          risks.push({ severity: "HIGH", type: "FOLGA_COM_ATIVIDADE", message: `${fn?.userName ?? "Membro"} está de folga mas tem atividade "${a.label ?? "—"}" em ${date}.`, userId: a.userId ?? undefined, userName: fn?.userName ?? undefined });
        }
      }

      // 3. Open slots in active scales
      const openSlots = await db
        .select({ id: scaleAllocationsTable.id })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          eq(scaleAllocationsTable.status, "OPEN"), eq(scaleAllocationsTable.active, true),
        ))
        .limit(5);
      if (openSlots.length > 0) {
        risks.push({ severity: "MEDIUM", type: "POSICOES_ABERTAS", message: `${openSlots.length} posição(ões) em aberto na escala. Cobertura necessária.` });
      }

      if (risks.length === 0) return JSON.stringify({ total: 0, message: "Nenhum risco operacional detectado para esta data. ✅", risks: [] });
      return JSON.stringify({ total: risks.length, date, message: `${risks.length} risco(s) detectado(s) em ${date}.`, risks });
    }

    // ── consultar_posicoes_abertas (Sprint 06) ────────────────────────────────
    if (name === "consultar_posicoes_abertas") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limit = (input.limit as number | undefined) ?? 20;

      const rows = await db
        .select({
          allocId:   scaleAllocationsTable.id,
          scaleId:   scalesTable.id,
          scaleTitle: scalesTable.title,
          eventId:   scaleAllocationsTable.agendaEventId,
          manualDate: scaleAllocationsTable.manualDate,
          manualLabel: scaleAllocationsTable.manualLabel,
        })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED", "DRAFT"]),
          eq(scaleAllocationsTable.status, "OPEN"), eq(scaleAllocationsTable.active, true),
        ))
        .orderBy(scalesTable.periodStart)
        .limit(limit);

      if (rows.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma posição em aberto nas escalas ativas. ✅", posicoes: [] });
      return JSON.stringify({
        total: rows.length,
        message: `${rows.length} posição(ões) em aberto.`,
        posicoes: rows.map(r => ({
          escala: r.scaleTitle,
          data: r.manualDate,
          atividade: r.manualLabel ?? "—",
        })),
      });
    }

    // ── consultar_tarefas_criticas (Sprint 06) ────────────────────────────────
    if (name === "consultar_tarefas_criticas") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today     = operationalDate();
      const daysAhead = (input.daysAhead as number | undefined) ?? 2;
      const limit     = (input.limit    as number | undefined) ?? 15;
      const future    = shiftOperationalDate(today, daysAhead);

      const rows = await db
        .select({
          id:           tasksTable.id,
          title:        tasksTable.title,
          dueDate:      tasksTable.dueDate,
          status:       tasksTable.status,
          priority:     tasksTable.priority,
          assigneeName: usersTable.name,
          assigneeId:   tasksTable.assigneeId,
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          ctx.operationId ? eq(tasksTable.operationId, ctx.operationId) : sql`true`,
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
          sql`${tasksTable.dueDate} <= ${future}`,
        ))
        .orderBy(tasksTable.dueDate)
        .limit(limit);

      const tarefas = rows.map(t => ({
        id:        t.id,
        titulo:    t.title,
        vencimento: t.dueDate,
        status:    t.status,
        prioridade: t.priority,
        responsavel: t.assigneeName ?? "—",
        urgencia:  t.dueDate < today ? "ATRASADA" : t.dueDate === today ? "HOJE" : "AMANHA",
      }));

      if (tarefas.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma tarefa crítica nos próximos dias. ✅", tarefas: [] });
      const atrasadas = tarefas.filter(t => t.urgencia === "ATRASADA").length;
      return JSON.stringify({
        total: tarefas.length,
        atrasadas,
        message: `${tarefas.length} tarefa(s) crítica(s)${atrasadas > 0 ? ` — ${atrasadas} já atrasada(s)` : ""}.`,
        tarefas,
      });
    }

    // ── consultar_conflitos (Sprint 06) ───────────────────────────────────────
    if (name === "consultar_conflitos") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today    = operationalDate();
      const dateFrom = (input.dateFrom as string | undefined) ?? today;
      const dateTo   = (input.dateTo   as string | undefined) ?? shiftOperationalDate(today, 7);

      const folgas = await db
        .select({ userId: folgasTable.userId, userName: usersTable.name, startDate: folgasTable.startDate, endDate: folgasTable.endDate, type: folgasTable.type })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, dateTo),
          gte(folgasTable.endDate, dateFrom),
        ))
        .limit(30);

      const conflitos: { tipo: string; membro: string; data: string; detalhe: string }[] = [];
      for (const f of folgas) {
        if (!f.userId) continue;
        const allocs = await db
          .select({ date: scaleAllocationsTable.manualDate, label: scaleAllocationsTable.manualLabel })
          .from(scaleAllocationsTable)
          .where(and(
            eq(scaleAllocationsTable.userId, f.userId),
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true),
            sql`${scaleAllocationsTable.manualDate} BETWEEN ${dateFrom} AND ${dateTo}`,
          ))
          .limit(5);
        for (const a of allocs) {
          if (!a.date) continue;
          if (a.date >= f.startDate && a.date <= f.endDate) {
            conflitos.push({ tipo: "FOLGA_COM_ATIVIDADE", membro: f.userName ?? f.userId, data: a.date, detalhe: `${f.userName ?? "Membro"} está de folga (${f.type}) mas tem atividade "${a.label ?? "—"}" nessa data.` });
          }
        }
      }

      if (conflitos.length === 0) return JSON.stringify({ total: 0, message: `Nenhum conflito detectado entre ${dateFrom} e ${dateTo}. ✅`, conflitos: [] });
      return JSON.stringify({ total: conflitos.length, message: `${conflitos.length} conflito(s) detectado(s).`, conflitos });
    }

    // ── sugerir_cobertura (Sprint 06) ─────────────────────────────────────────
    if (name === "sugerir_cobertura") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const date          = input.date          as string;
      const activityLabel = input.activityLabel as string | undefined;
      const excludeUserId = input.excludeUserId as string | undefined;

      // All members in this operation
      const opFilter = ctx.operationId
        ? eq(userRolesTable.operationId, ctx.operationId)
        : sql`true`;

      const allMembers = await db
        .selectDistinct({ userId: usersTable.id, userName: usersTable.name })
        .from(usersTable)
        .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
        .where(and(opFilter, eq(usersTable.status, "ACTIVE")))
        .limit(50);

      // Members on folga that day
      const folgasOnDate = await db
        .select({ userId: folgasTable.userId })
        .from(folgasTable)
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate, date),
        ));
      const onFolgaIds = new Set(folgasOnDate.map(f => f.userId).filter(Boolean) as string[]);

      // Members already allocated that day
      const allocatedThatDay = await db
        .select({ userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(
          eq(scaleAllocationsTable.manualDate, date),
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true),
        ));
      const allocatedIds = new Set(allocatedThatDay.map(a => a.userId).filter(Boolean) as string[]);

      // Experience: who has done this activity before
      const experiencedIds = new Set<string>();
      if (activityLabel) {
        const experienced = await db
          .select({ userId: scaleAllocationsTable.userId })
          .from(scaleAllocationsTable)
          .where(and(
            ilike(scaleAllocationsTable.manualLabel, `%${activityLabel}%`),
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true),
          ))
          .limit(50);
        experienced.forEach(e => { if (e.userId) experiencedIds.add(e.userId); });
      }

      const suggestions = allMembers
        .filter(m => m.userId !== excludeUserId && !onFolgaIds.has(m.userId))
        .map(m => ({
          userId:      m.userId,
          nome:        m.userName,
          disponivel:  !allocatedIds.has(m.userId),
          experiencia: experiencedIds.has(m.userId),
          score:       (experiencedIds.has(m.userId) ? 2 : 0) + (!allocatedIds.has(m.userId) ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (suggestions.length === 0) return JSON.stringify({ total: 0, message: "Nenhum membro disponível encontrado para cobertura.", sugestoes: [] });
      return JSON.stringify({
        total: suggestions.length,
        data: date,
        atividade: activityLabel ?? "não especificada",
        message: `${suggestions.length} sugestão(ões) de cobertura para ${date}.`,
        sugestoes: suggestions.map(s => ({
          nome: s.nome,
          disponivel: s.disponivel ? "✅ Livre neste dia" : "⚠️ Já tem atividade",
          experiencia: s.experiencia ? "✅ Já realizou esta atividade" : "—",
        })),
      });
    }

    // ── consultar_carga_operacional (Sprint 06) ───────────────────────────────
    if (name === "consultar_carga_operacional") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today    = operationalDate();
      const dateFrom = (input.dateFrom as string | undefined) ?? today;
      const dateTo   = (input.dateTo   as string | undefined) ?? shiftOperationalDate(today, 7);
      const limit    = (input.limit    as number | undefined) ?? 20;

      // Count scale allocations per member in the range
      const allocCounts = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), eq(scaleAllocationsTable.active, true),
          sql`${scaleAllocationsTable.manualDate} BETWEEN ${dateFrom} AND ${dateTo}`,
        ))
        .groupBy(scaleAllocationsTable.userId)
        .limit(limit);

      // Count pending tasks per member
      const taskCounts = await db
        .select({ assigneeId: tasksTable.assigneeId, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
        ))
        .groupBy(tasksTable.assigneeId)
        .limit(limit);

      const taskMap = new Map(taskCounts.map(t => [t.assigneeId, t.count]));
      const userIds = [...new Set(allocCounts.map(a => a.userId).filter(Boolean))] as string[];
      const userNames = userIds.length > 0
        ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))
        : [];
      const nameMap = new Map(userNames.map(u => [u.id, u.name]));

      const carga = allocCounts
        .filter(a => a.userId)
        .map(a => ({
          membro:      nameMap.get(a.userId!) ?? a.userId,
          atividades:  a.count,
          tarefas_pendentes: taskMap.get(a.userId!) ?? 0,
          carga_total: a.count + (taskMap.get(a.userId!) ?? 0),
        }))
        .sort((a, b) => b.carga_total - a.carga_total);

      if (carga.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma atividade registrada no período.", carga: [] });
      return JSON.stringify({
        total: carga.length,
        periodo: `${dateFrom} → ${dateTo}`,
        message: `Carga operacional de ${carga.length} membro(s) no período.`,
        carga,
      });
    }

    // ── registrar_ausencia (Sprint 05) ───────────────────────────────────────
    if (name === "registrar_ausencia") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para registrar ausências" });

      const displayName = (input.userName as string | undefined) ?? (input.userId as string);
      const fmt = (d: string) => d.split("-").reverse().join("/");

      try {
        const res = await coreRegistrarAusencia(ctx, {
          userId:    input.userId    as string,
          startDate: input.startDate as string | undefined,
          endDate:   input.endDate   as string | undefined,
          date:      input.date      as string | undefined,
          type:      input.type      as string | undefined,
          reason:    input.reason    as string | undefined,
        });
        const periodoLabel = res.isSingleDay
          ? `para ${fmt(res.startDate)}`
          : `de ${fmt(res.startDate)} até ${fmt(res.endDate)} (${res.type === "AFASTAMENTO" ? "afastamento" : (res.type ?? "ausência").toLowerCase()})`;
        return JSON.stringify({
          registered: true,
          id:         res.id,
          member:     displayName,
          startDate:  res.startDate,
          endDate:    res.endDate,
          type:       res.type,
          message:    `📋 ${res.isSingleDay ? "Ausência" : "Período"} de ${displayName} registrado ${periodoLabel}. Acompanhe na página de Folgas.`,
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── criar_solicitacao_troca (Sprint 05) ──────────────────────────────────
    if (name === "criar_solicitacao_troca") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar solicitações de troca" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar solicitações" });

      const n1   = input.userName1 as string;
      const n2   = input.userName2 as string;
      const date = input.date      as string;
      const notes = input.notes    as string | undefined;

      const [task] = await db.insert(tasksTable).values({
        organizationId: ctx.organizationId,
        operationId:    ctx.operationId,
        title:          `🔄 Troca de escala: ${n1} ↔ ${n2}`,
        description:    [
          `Solicitação de troca de escala detectada pela ASA.`,
          ``,
          `• Membros: ${n1} e ${n2}`,
          `• Data: ${date}`,
          notes ? `• Detalhes: ${notes}` : null,
          ``,
          `Verifique as escalas e confirme ou ajuste a troca conforme necessário.`,
        ].filter(Boolean).join("\n"),
        creatorId:      ctx.userId,
        assigneeId:     ctx.userId,
        dueDate:        date,
        status:         "CREATED",
        priority:       "MEDIUM",
        origin:         "MANUAL",
      }).returning();

      return JSON.stringify({
        created: true,
        id: task.id,
        members: [n1, n2],
        date,
        message: `🔄 Solicitação de troca entre ${n1} e ${n2} registrada para ${date}. Uma tarefa foi criada para acompanhamento — você pode gerenciá-la na página de Tarefas.`,
      });
    }

    // ── Sprint 12 — Operações em lote ─────────────────────────────────────────
    if (name === "criar_tarefas_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar tarefas" });
      const tarefas = (input.tarefas as Array<Record<string, unknown>> | undefined) ?? [];
      if (tarefas.length === 0) return JSON.stringify({ error: "Nenhuma tarefa informada" });

      const results = await runBatch(
        tarefas,
        (t) => (t.assigneeName as string | undefined) ?? (t.title as string | undefined) ?? "tarefa",
        async (t) => {
          const r = await coreCriarTarefa(ctx, {
            title:       t.title       as string,
            description: t.description as string | undefined,
            assigneeId:  t.assigneeId  as string,
            dueDate:     t.dueDate     as string,
            priority:    t.priority    as string | undefined,
          });
          return { id: r.id };
        },
      );
      return JSON.stringify({ batch: true, tipo: "tarefas", ...summarizeBatch("tarefa(s) criada(s)", results) });
    }

    if (name === "registrar_ausencias_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para registrar ausências" });
      const ausencias = (input.ausencias as Array<Record<string, unknown>> | undefined) ?? [];
      if (ausencias.length === 0) return JSON.stringify({ error: "Nenhuma ausência informada" });

      const results = await runBatch(
        ausencias,
        (a) => (a.userName as string | undefined) ?? (a.userId as string | undefined) ?? "membro",
        async (a) => {
          const r = await coreRegistrarAusencia(ctx, {
            userId:    a.userId    as string,
            startDate: a.startDate as string | undefined,
            endDate:   a.endDate   as string | undefined,
            date:      a.date      as string | undefined,
            type:      a.type      as string | undefined,
            reason:    a.reason    as string | undefined,
          });
          return { id: r.id };
        },
      );
      return JSON.stringify({ batch: true, tipo: "ausencias", ...summarizeBatch("ausência(s) registrada(s)", results) });
    }

    if (name === "criar_reconhecimentos_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar reconhecimentos" });
      const reconhecimentos = (input.reconhecimentos as Array<Record<string, unknown>> | undefined) ?? [];
      if (reconhecimentos.length === 0) return JSON.stringify({ error: "Nenhum reconhecimento informado" });

      const results = await runBatch(
        reconhecimentos,
        (r) => (r.userName as string | undefined) ?? (r.userId as string | undefined) ?? "membro",
        async (r) => {
          const out = await coreCriarReconhecimento(ctx, {
            userId:  r.userId  as string,
            type:    r.type    as string,
            title:   r.title   as string,
            message: r.message as string,
          });
          return { id: out.id };
        },
      );
      return JSON.stringify({ batch: true, tipo: "reconhecimentos", ...summarizeBatch("reconhecimento(s) criado(s)", results) });
    }

    if (name === "criar_entradas_escala_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar entradas na escala" });
      const entradas = (input.entradas as Array<Record<string, unknown>> | undefined) ?? [];
      if (entradas.length === 0) return JSON.stringify({ error: "Nenhuma entrada informada" });

      const results = await runBatch(
        entradas,
        (e) => (e.userName as string | undefined) ?? (e.userId as string | undefined) ?? "membro",
        async (e) => {
          const r = await coreCriarEntradaEscala(ctx, {
            userId:    e.userId    as string,
            userName:  e.userName  as string | undefined,
            date:      e.date      as string,
            label:     e.label     as string,
            startTime: e.startTime as string | undefined,
            endTime:   e.endTime   as string | undefined,
            notes:     e.notes     as string | undefined,
          });
          return { id: r.id, warning: r.warning };
        },
      );
      return JSON.stringify({ batch: true, tipo: "entradas_escala", ...summarizeBatch("entrada(s) criada(s)", results) });
    }

    if (name === "adicionar_participantes_evento") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para adicionar participantes" });
      if (!ctx.operationId) return JSON.stringify({ error: "Operação não configurada" });
      const participantes = (input.participantes as Array<Record<string, unknown>> | undefined) ?? [];
      if (participantes.length === 0) return JSON.stringify({ error: "Nenhum participante informado" });

      const eventId      = input.eventId      as string | undefined;
      const eventoTitulo = input.eventoTitulo as string | undefined;
      const dataInput    = input.data         as string | undefined;

      // Localiza o evento por id, ou por título + data
      let event: { id: string; title: string; startTime: Date | string | null } | undefined;
      if (eventId) {
        const [ev] = await db
          .select({ id: agendaEventsTable.id, title: agendaEventsTable.title, startTime: agendaEventsTable.startTime })
          .from(agendaEventsTable)
          .where(and(
            eq(agendaEventsTable.id, eventId),
            ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`,
          ))
          .limit(1);
        event = ev;
      } else if (eventoTitulo) {
        const candidates = await db
          .select({ id: agendaEventsTable.id, title: agendaEventsTable.title, startTime: agendaEventsTable.startTime })
          .from(agendaEventsTable)
          .where(ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`)
          .orderBy(agendaEventsTable.startTime)
          .limit(50);
        const normTitle = normalizeName(eventoTitulo);
        event = candidates.find((c) => {
          const matchTitle = normalizeName(c.title).includes(normTitle) || normTitle.includes(normalizeName(c.title));
          const matchDate = dataInput
            ? (c.startTime ? operationalDate(new Date(c.startTime)) === dataInput : false)
            : true;
          return matchTitle && matchDate;
        });
      }

      if (!event) {
        return JSON.stringify({ error: "Evento não encontrado. Use consultar_agenda para obter o eventId, ou informe eventoTitulo + data." });
      }

      const eventDate = dataInput
        ?? (event.startTime ? operationalDate(new Date(event.startTime)) : undefined);
      if (!eventDate) {
        return JSON.stringify({ error: "Não foi possível determinar a data do evento. Informe a data (YYYY-MM-DD)." });
      }

      const results = await runBatch(
        participantes,
        (p) => (p.userName as string | undefined) ?? (p.userId as string | undefined) ?? "membro",
        async (p) => {
          const r = await coreCriarEntradaEscala(ctx, {
            userId:        p.userId   as string,
            userName:      p.userName as string | undefined,
            date:          eventDate,
            label:         event!.title,
            agendaEventId: event!.id,
          });
          return { id: r.id, warning: r.warning };
        },
      );
      const summary = summarizeBatch("participante(s) adicionado(s)", results);
      return JSON.stringify({
        batch: true,
        tipo: "participantes_evento",
        evento: { id: event.id, titulo: event.title, data: eventDate },
        ...summary,
        message: `Evento "${event.title}" (${eventDate}):\n${summary.message}`,
      });
    }

    if (name === "desfazer_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para desfazer operações em lote" });
      const tipoRaw = (input.tipo as string | undefined) ?? "";
      const tipo = tipoRaw.toLowerCase().trim();
      const ids = ((input.ids as unknown[] | undefined) ?? []).map((v) => String(v)).filter(Boolean);
      if (ids.length === 0) return JSON.stringify({ error: "Nenhum ID informado para desfazer" });

      const undoers: Record<string, (id: string) => Promise<{ id?: string }>> = {
        tarefas:              (id) => coreCancelarTarefa(ctx, id),
        tarefa:               (id) => coreCancelarTarefa(ctx, id),
        ausencias:            (id) => coreCancelarAusencia(ctx, id),
        ausencia:             (id) => coreCancelarAusencia(ctx, id),
        reconhecimentos:      (id) => coreRemoverReconhecimento(ctx, id),
        reconhecimento:       (id) => coreRemoverReconhecimento(ctx, id),
        entradas_escala:      (id) => coreRemoverEntradaEscala(ctx, id),
        entrada_escala:       (id) => coreRemoverEntradaEscala(ctx, id),
        participantes_evento: (id) => coreRemoverEntradaEscala(ctx, id),
        participante_evento:  (id) => coreRemoverEntradaEscala(ctx, id),
      };
      const undoer = undoers[tipo];
      if (!undoer) return JSON.stringify({ error: `Tipo de lote desconhecido para desfazer: "${tipoRaw}". Use tarefas | ausencias | reconhecimentos | entradas_escala | participantes_evento.` });

      const results = await runBatch(
        ids,
        (id) => id,
        async (id) => {
          const r = await undoer(id);
          return { id: r.id };
        },
      );
      return JSON.stringify({ batch: true, desfazer: true, tipo, ...summarizeBatch("item(ns) desfeito(s)", results) });
    }

    // ── Edição de entidades por conversa ──────────────────────────────────────
    if (name === "editar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar tarefas" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const taskId = input.taskId as string;
      const [existing] = await db
        .select({ id: tasksTable.id, status: tasksTable.status, title: tasksTable.title, description: tasksTable.description, assigneeId: tasksTable.assigneeId, dueDate: tasksTable.dueDate, priority: tasksTable.priority })
        .from(tasksTable)
        .where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, ctx.organizationId)))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Tarefa não encontrada. Use consultar_tarefas para obter o ID." });
      if (["APPROVED", "COMPLETED", "CANCELLED"].includes(existing.status))
        return JSON.stringify({ success: false, message: `Tarefa com status "${existing.status}" não pode ser editada (encerrada).` });

      const updates: Partial<typeof tasksTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.title !== undefined) { before.title = existing.title; after.title = input.title; updates.title = input.title as string; }
      if (input.description !== undefined) { before.description = existing.description; after.description = input.description; updates.description = input.description as string; }
      if (input.assigneeId !== undefined) { before.assigneeId = existing.assigneeId; after.assigneeId = input.assigneeId; updates.assigneeId = input.assigneeId as string; }
      if (input.dueDate !== undefined) { before.dueDate = existing.dueDate; after.dueDate = input.dueDate; updates.dueDate = input.dueDate as string; }
      if (input.priority !== undefined) { before.priority = existing.priority; after.priority = input.priority; updates.priority = input.priority as typeof existing.priority; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      updates.updatedAt = new Date();
      await db.update(tasksTable).set(updates).where(eq(tasksTable.id, taskId));
      return JSON.stringify({ success: true, id: taskId, antes: before, depois: after, message: `✅ Tarefa "${existing.title}" atualizada com sucesso.` });
    }

    if (name === "editar_ausencia") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar ausências" });
      const folgaId = input.folgaId as string;
      const [existing] = await db
        .select({ id: folgasTable.id, status: folgasTable.status, startDate: folgasTable.startDate, endDate: folgasTable.endDate, type: folgasTable.type, notes: folgasTable.notes })
        .from(folgasTable)
        .where(eq(folgasTable.id, folgaId))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Ausência não encontrada. Use consultar_folgas para obter o ID." });
      if (existing.status === "CANCELLED") return JSON.stringify({ success: false, message: "Esta ausência está cancelada e não pode ser editada." });

      const updates: Partial<typeof folgasTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.startDate !== undefined) { before.startDate = existing.startDate; after.startDate = input.startDate; updates.startDate = input.startDate as string; }
      if (input.endDate !== undefined) { before.endDate = existing.endDate; after.endDate = input.endDate; updates.endDate = input.endDate as string; }
      if (input.type !== undefined) { before.type = existing.type; after.type = input.type; updates.type = input.type as typeof existing.type; }
      if (input.reason !== undefined) { before.notes = existing.notes; after.notes = input.reason; updates.notes = input.reason as string; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      // Coerência: se só startDate mudou e a folga era de um dia, alinha endDate
      if (updates.startDate !== undefined && updates.endDate === undefined && existing.startDate === existing.endDate) {
        updates.endDate = updates.startDate;
        after.endDate = updates.startDate;
      }
      updates.updatedAt = new Date();
      await db.update(folgasTable).set(updates).where(eq(folgasTable.id, folgaId));
      return JSON.stringify({ success: true, id: folgaId, antes: before, depois: after, message: `✅ Ausência atualizada com sucesso.` });
    }

    if (name === "editar_evento_agenda") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar eventos da agenda" });
      const eventId = input.eventId as string;
      const [existing] = await db
        .select({ id: agendaEventsTable.id, status: agendaEventsTable.status, title: agendaEventsTable.title, date: agendaEventsTable.date, endDate: agendaEventsTable.endDate, startTime: agendaEventsTable.startTime, endTime: agendaEventsTable.endTime, location: agendaEventsTable.location, notes: agendaEventsTable.notes })
        .from(agendaEventsTable)
        .where(and(
          eq(agendaEventsTable.id, eventId),
          ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`,
        ))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Evento não encontrado. Use consultar_agenda para obter o ID." });
      if (["CANCELLED", "COMPLETED"].includes(existing.status))
        return JSON.stringify({ success: false, message: `Evento com status "${existing.status}" não pode ser editado.` });

      const updates: Partial<typeof agendaEventsTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.titulo !== undefined) { before.titulo = existing.title; after.titulo = input.titulo; updates.title = input.titulo as string; }
      if (input.data !== undefined) { before.data = existing.date; after.data = input.data; updates.date = input.data as string; }
      if (input.dataFim !== undefined) { before.dataFim = existing.endDate; after.dataFim = input.dataFim; updates.endDate = input.dataFim as string; }
      if (input.horaInicio !== undefined) { before.horaInicio = existing.startTime; after.horaInicio = input.horaInicio; updates.startTime = input.horaInicio as string; }
      if (input.horaFim !== undefined) { before.horaFim = existing.endTime; after.horaFim = input.horaFim; updates.endTime = input.horaFim as string; }
      if (input.local !== undefined) { before.local = existing.location; after.local = input.local; updates.location = input.local as string; }
      if (input.descricao !== undefined) { before.descricao = existing.notes; after.descricao = input.descricao; updates.notes = input.descricao as string; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      updates.updatedAt = new Date();
      await db.update(agendaEventsTable).set(updates).where(eq(agendaEventsTable.id, eventId));
      return JSON.stringify({ success: true, id: eventId, antes: before, depois: after, message: `✅ Evento "${existing.title}" atualizado com sucesso.` });
    }

    if (name === "editar_aviso") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar avisos" });
      const noticeId = input.noticeId as string;
      const [existing] = await db
        .select({ id: noticesTable.id, status: noticesTable.status, title: noticesTable.title, content: noticesTable.content, type: noticesTable.type, urgency: noticesTable.urgency, requiresConfirmation: noticesTable.requiresConfirmation })
        .from(noticesTable)
        .where(and(
          eq(noticesTable.id, noticeId),
          ctx.operationId ? eq(noticesTable.operationId, ctx.operationId) : sql`true`,
        ))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Aviso não encontrado. Use consultar_avisos para obter o ID." });
      if (existing.status !== "DRAFT")
        return JSON.stringify({ success: false, message: `Apenas avisos em rascunho podem ser editados. Este aviso está com status "${existing.status}".` });

      const updates: Partial<typeof noticesTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.title !== undefined) { before.title = existing.title; after.title = input.title; updates.title = input.title as string; }
      if (input.content !== undefined) { before.content = existing.content; after.content = input.content; updates.content = input.content as string; }
      if (input.type !== undefined) { before.type = existing.type; after.type = input.type; updates.type = input.type as typeof existing.type; }
      if (input.urgency !== undefined) { before.urgency = existing.urgency; after.urgency = input.urgency; updates.urgency = input.urgency as typeof existing.urgency; }
      if (input.requiresConfirmation !== undefined) { before.requiresConfirmation = existing.requiresConfirmation; after.requiresConfirmation = input.requiresConfirmation; updates.requiresConfirmation = input.requiresConfirmation as boolean; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      await db.update(noticesTable).set(updates).where(eq(noticesTable.id, noticeId));
      return JSON.stringify({ success: true, id: noticeId, antes: before, depois: after, message: `✅ Aviso "${existing.title ?? "(sem título)"}" (rascunho) atualizado com sucesso.` });
    }

    if (name === "editar_reconhecimento") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar reconhecimentos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const recognitionId = input.recognitionId as string;
      const [existing] = await db
        .select({ id: recognitionsTable.id, type: recognitionsTable.type, title: recognitionsTable.title, message: recognitionsTable.message })
        .from(recognitionsTable)
        .where(and(eq(recognitionsTable.id, recognitionId), eq(recognitionsTable.organizationId, ctx.organizationId)))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Reconhecimento não encontrado. Use consultar_reconhecimentos para obter o ID." });

      const updates: Partial<typeof recognitionsTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.type !== undefined) { before.type = existing.type; after.type = input.type; updates.type = input.type as string; }
      if (input.title !== undefined) { before.title = existing.title; after.title = input.title; updates.title = input.title as string; }
      if (input.message !== undefined) { before.message = existing.message; after.message = input.message; updates.message = input.message as string; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      updates.updatedAt = new Date();
      await db.update(recognitionsTable).set(updates).where(eq(recognitionsTable.id, recognitionId));
      return JSON.stringify({ success: true, id: recognitionId, antes: before, depois: after, message: `🎉 Reconhecimento "${existing.title}" atualizado com sucesso.` });
    }

    // ── Atividades recorrentes ────────────────────────────────────────────────
    if (name === "consultar_atividades") {
      if (!MANAGER_ROLES.includes(ctx.userRole)) return JSON.stringify({ error: "Apenas Administração e Supervisão podem consultar atividades" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId || !(ctx.operationIds ?? []).includes(ctx.operationId)) {
        return JSON.stringify({ error: "Selecione uma operação ativa autorizada para consultar as atividades." });
      }
      const [operation] = await db.select({ id: operationsTable.id, name: operationsTable.name })
        .from(operationsTable)
        .where(and(
          eq(operationsTable.id, ctx.operationId),
          eq(operationsTable.organizationId, ctx.organizationId),
          eq(operationsTable.status, "ACTIVE"),
        ))
        .limit(1);
      if (!operation) return JSON.stringify({ error: "Operação não encontrada ou inativa." });
      const [activeRole] = await db.select({ id: userRolesTable.id })
        .from(userRolesTable)
        .where(and(
          eq(userRolesTable.userId, ctx.userId),
          eq(userRolesTable.operationId, operation.id),
          eq(userRolesTable.role, ctx.userRole as never),
          eq(userRolesTable.active, true),
        ))
        .limit(1);
      if (!activeRole) return JSON.stringify({ error: "Seu acesso de gestão a esta operação não está ativo." });

      const rows = await db.select({
        id: recurringActivitiesTable.id,
        title: recurringActivitiesTable.title,
        operationId: recurringActivitiesTable.operationId,
      }).from(recurringActivitiesTable)
        .where(and(
          eq(recurringActivitiesTable.operationId, operation.id),
          eq(recurringActivitiesTable.active, true),
        ))
        .orderBy(asc(recurringActivitiesTable.title))
        .limit(Math.min(Math.max(Number(input.limit) || 50, 1), 100));
      if (rows.length === 0) return JSON.stringify({ atividades: [], message: "Nenhuma atividade encontrada." });

      const ids = rows.map(r => r.id);
      const [schedules, assignees] = await Promise.all([
        db.select().from(recurringActivitySchedulesTable)
          .where(inArray(recurringActivitySchedulesTable.activityId, ids)),
        db.select().from(recurringActivityAssigneesTable)
          .where(inArray(recurringActivityAssigneesTable.activityId, ids)),
      ]);

      const userIds = [...new Set(assignees.map(a => a.userId).filter((x): x is string => !!x))];
      const groupIds = [...new Set(assignees.map(a => a.groupId).filter((x): x is string => !!x))];
      const [users, groups] = await Promise.all([
        userIds.length ? db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, ctx.organizationId))) : Promise.resolve([]),
        groupIds.length ? db.select({ id: operationalGroupsTable.id, name: operationalGroupsTable.name }).from(operationalGroupsTable).where(and(inArray(operationalGroupsTable.id, groupIds), eq(operationalGroupsTable.organizationId, ctx.organizationId))) : Promise.resolve([]),
      ]);
      const userName = new Map(users.map(u => [u.id, u.name]));
      const groupName = new Map(groups.map(g => [g.id, g.name]));

      const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
      const atividades = rows.map(a => ({
        id: a.id,
        titulo: a.title,
        operationId: a.operationId,
        operationName: operation.name,
        horarios: schedules.filter(s => s.activityId === a.id).map(s => ({
          id: s.id,
          diaSemana: s.weekday != null ? DOW[s.weekday] : null,
          weekday: s.weekday,
          dataEspecifica: s.specificDate,
          inicio: s.startTime,
          fim: s.endTime,
        })),
        designados: assignees.filter(x => x.activityId === a.id).map(x => ({
          userId: x.userId,
          nome: x.userId ? userName.get(x.userId) ?? null : null,
          groupId: x.groupId,
          grupo: x.groupId ? groupName.get(x.groupId) ?? null : null,
        })),
      }));
      return JSON.stringify({ atividades, total: atividades.length });
    }

    if (name === "criar_atividade") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem criar atividades" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const title = (input.title as string | undefined)?.trim();
      if (!title) return JSON.stringify({ success: false, message: "O título da atividade é obrigatório." });

      const schedulesRaw = (input.schedules as unknown[] | undefined) ?? [];
      if (!Array.isArray(schedulesRaw) || schedulesRaw.length === 0)
        return JSON.stringify({ success: false, message: "schedules deve ser um array não-vazio. Informe pelo menos um horário com weekday (0-6) ou specificDate (YYYY-MM-DD)." });

      // Validar schedules
      const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
      const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      for (const s of schedulesRaw as Record<string, unknown>[]) {
        const hasWeekday = typeof s["weekday"] === "number";
        const hasDate = typeof s["specificDate"] === "string" && DATE_RE.test(s["specificDate"] as string);
        if (!hasWeekday && !hasDate) return JSON.stringify({ success: false, message: "Cada schedule precisa de weekday (0-6) ou specificDate (YYYY-MM-DD)." });
        if (hasWeekday && hasDate) return JSON.stringify({ success: false, message: "Informe weekday OU specificDate em cada schedule, não ambos." });
        if (hasWeekday && ((s["weekday"] as number) < 0 || (s["weekday"] as number) > 6)) return JSON.stringify({ success: false, message: "weekday deve ser 0 (Dom) a 6 (Sáb)." });
        if (s["startTime"] != null && !TIME_RE.test(s["startTime"] as string)) return JSON.stringify({ success: false, message: "startTime inválido — use HH:MM." });
        if (s["endTime"] != null && !TIME_RE.test(s["endTime"] as string)) return JSON.stringify({ success: false, message: "endTime inválido — use HH:MM." });
      }

      // Determina operação
      let operationId = (input.operationId as string | undefined) ?? ctx.operationId;
      if (!operationId) return JSON.stringify({ success: false, message: "Operação não configurada. Informe operationId." });

      // Verifica permissão na operação (ADMIN→todas da org; supervisor→só ops com papel SUPERVISOR_A/B nesta org)
      let allowedOps: string[];
      if (ctx.userRole === "ADMIN") {
        const ops = await db.select({ id: operationsTable.id }).from(operationsTable)
          .where(eq(operationsTable.organizationId, ctx.organizationId));
        allowedOps = ops.map(o => o.id);
      } else {
        const roles = await db.select({ operationId: userRolesTable.operationId })
          .from(userRolesTable)
          .innerJoin(operationsTable, eq(operationsTable.id, userRolesTable.operationId))
          .where(and(
            eq(userRolesTable.userId, ctx.userId),
            eq(userRolesTable.active, true),
            or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
            eq(operationsTable.organizationId, ctx.organizationId),
          ));
        allowedOps = [...new Set(roles.map(r => r.operationId).filter((x): x is string => !!x))];
      }
      if (!allowedOps.includes(operationId)) return JSON.stringify({ success: false, message: "Sem permissão nesta operação." });

      const created = await db.transaction(async (tx) => {
        const [activity] = await tx.insert(recurringActivitiesTable).values({
          organizationId: ctx.organizationId!,
          operationId,
          title,
          active: input.active === false ? false : true,
        }).returning();
        await tx.delete(recurringActivitySchedulesTable)
          .where(eq(recurringActivitySchedulesTable.activityId, activity!.id));
        await tx.insert(recurringActivitySchedulesTable).values(
          (schedulesRaw as Record<string, unknown>[]).map(s => ({
            activityId: activity!.id,
            weekday: typeof s["weekday"] === "number" ? s["weekday"] as number : null,
            specificDate: typeof s["specificDate"] === "string" ? s["specificDate"] as string : null,
            startTime: (s["startTime"] as string | undefined) ?? null,
            endTime: (s["endTime"] as string | undefined) ?? null,
          })),
        );
        const assigneesRaw = (input.assignees as unknown[] | undefined) ?? [];
        if (Array.isArray(assigneesRaw) && assigneesRaw.length > 0) {
          const rows = (assigneesRaw as Record<string, unknown>[])
            .map(a => ({ activityId: activity!.id, userId: (a["userId"] as string | undefined) ?? null, groupId: (a["groupId"] as string | undefined) ?? null }))
            .filter(r => r.userId || r.groupId);
          if (rows.length > 0) await tx.insert(recurringActivityAssigneesTable).values(rows);
        }
        return activity!;
      });

      const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
      const schedulesInserted = await db.select().from(recurringActivitySchedulesTable)
        .where(eq(recurringActivitySchedulesTable.activityId, created.id));
      const horariosDesc = schedulesInserted.map(s =>
        s.weekday != null
          ? `${DOW[s.weekday]}${s.startTime ? ` ${s.startTime}` : ""}${s.endTime ? `–${s.endTime}` : ""}`
          : `${s.specificDate}${s.startTime ? ` ${s.startTime}` : ""}${s.endTime ? `–${s.endTime}` : ""}`
      ).join(", ");
      return JSON.stringify({
        success: true,
        id: created.id,
        titulo: created.title,
        ativa: created.active,
        horarios: horariosDesc,
        message: `✅ Atividade "${created.title}" criada com sucesso! Horários: ${horariosDesc}.`,
      });
    }

    if (name === "atualizar_atividade") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem atualizar atividades" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const activityId = input.activityId as string;
      if (!activityId) return JSON.stringify({ success: false, message: "activityId é obrigatório." });

      // Carrega atividade verificando escopo (ADMIN→todas da org; supervisor→só ops com papel SUPERVISOR_A/B nesta org)
      let allowedOps: string[];
      if (ctx.userRole === "ADMIN") {
        const ops = await db.select({ id: operationsTable.id }).from(operationsTable)
          .where(eq(operationsTable.organizationId, ctx.organizationId));
        allowedOps = ops.map(o => o.id);
      } else {
        const roles = await db.select({ operationId: userRolesTable.operationId })
          .from(userRolesTable)
          .innerJoin(operationsTable, eq(operationsTable.id, userRolesTable.operationId))
          .where(and(
            eq(userRolesTable.userId, ctx.userId),
            eq(userRolesTable.active, true),
            or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
            eq(operationsTable.organizationId, ctx.organizationId),
          ));
        allowedOps = [...new Set(roles.map(r => r.operationId).filter((x): x is string => !!x))];
      }

      const [existing] = allowedOps.length > 0
        ? await db.select().from(recurringActivitiesTable)
            .where(and(eq(recurringActivitiesTable.id, activityId), inArray(recurringActivitiesTable.operationId, allowedOps)))
            .limit(1)
        : [];
      if (!existing) return JSON.stringify({ success: false, message: "Atividade não encontrada ou sem permissão. Use consultar_atividades para obter o ID correto." });

      const schedulesRaw = input.schedules as unknown[] | undefined;
      const assigneesRaw = input.assignees as unknown[] | undefined;

      if (schedulesRaw !== undefined) {
        const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        if (!Array.isArray(schedulesRaw) || schedulesRaw.length === 0)
          return JSON.stringify({ success: false, message: "schedules deve ser um array não-vazio quando informado." });
        for (const s of schedulesRaw as Record<string, unknown>[]) {
          const hasWeekday = typeof s["weekday"] === "number";
          const hasDate = typeof s["specificDate"] === "string" && DATE_RE.test(s["specificDate"] as string);
          if (!hasWeekday && !hasDate) return JSON.stringify({ success: false, message: "Cada schedule precisa de weekday (0-6) ou specificDate (YYYY-MM-DD)." });
          if (hasWeekday && hasDate) return JSON.stringify({ success: false, message: "Informe weekday OU specificDate em cada schedule, não ambos." });
          if (hasWeekday && ((s["weekday"] as number) < 0 || (s["weekday"] as number) > 6)) return JSON.stringify({ success: false, message: "weekday deve ser 0 (Dom) a 6 (Sáb)." });
          if (s["startTime"] != null && !TIME_RE.test(s["startTime"] as string)) return JSON.stringify({ success: false, message: "startTime inválido — use HH:MM." });
          if (s["endTime"] != null && !TIME_RE.test(s["endTime"] as string)) return JSON.stringify({ success: false, message: "endTime inválido — use HH:MM." });
        }
      }

      // Determine what changes before executing — validate at least one field provided
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      const before: Record<string, unknown> = { titulo: existing.title, ativa: existing.active };
      const after: Record<string, unknown> = {};
      if (typeof input.title === "string" && (input.title as string).trim()) { patch["title"] = (input.title as string).trim(); after.titulo = patch["title"]; }
      if (typeof input.active === "boolean") { patch["active"] = input.active; after.ativa = input.active; }
      if (Array.isArray(schedulesRaw)) after.horarios = "(novo)"; // will be filled after tx
      if (Array.isArray(assigneesRaw)) after.designados = `${assigneesRaw.length} designado(s)`;
      if (Object.keys(after).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
      await db.transaction(async (tx) => {
        if (Object.keys(patch).length > 1) {
          await tx.update(recurringActivitiesTable).set(patch).where(eq(recurringActivitiesTable.id, activityId));
        }
        if (Array.isArray(schedulesRaw)) {
          await tx.delete(recurringActivitySchedulesTable)
            .where(eq(recurringActivitySchedulesTable.activityId, activityId));
          await tx.insert(recurringActivitySchedulesTable).values(
            (schedulesRaw as Record<string, unknown>[]).map(s => ({
              activityId,
              weekday: typeof s["weekday"] === "number" ? s["weekday"] as number : null,
              specificDate: typeof s["specificDate"] === "string" ? s["specificDate"] as string : null,
              startTime: (s["startTime"] as string | undefined) ?? null,
              endTime: (s["endTime"] as string | undefined) ?? null,
            })),
          );
          after.horarios = (schedulesRaw as Record<string, unknown>[]).map(s =>
            s["weekday"] != null
              ? `${DOW[s["weekday"] as number]}${s["startTime"] ? ` ${s["startTime"]}` : ""}${s["endTime"] ? `–${s["endTime"]}` : ""}`
              : `${s["specificDate"]}${s["startTime"] ? ` ${s["startTime"]}` : ""}${s["endTime"] ? `–${s["endTime"]}` : ""}`
          ).join(", ");
        }
        if (Array.isArray(assigneesRaw)) {
          await tx.delete(recurringActivityAssigneesTable)
            .where(eq(recurringActivityAssigneesTable.activityId, activityId));
          const rows = (assigneesRaw as Record<string, unknown>[])
            .map(a => ({ activityId, userId: (a["userId"] as string | undefined) ?? null, groupId: (a["groupId"] as string | undefined) ?? null }))
            .filter(r => r.userId || r.groupId);
          if (rows.length > 0) await tx.insert(recurringActivityAssigneesTable).values(rows);
        }
      });

      return JSON.stringify({ success: true, id: activityId, antes: before, depois: after, message: `✅ Atividade "${existing.title}" atualizada com sucesso.` });
    }

    return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
  } catch (err) {
    return JSON.stringify({ error: `Erro ao executar ferramenta: ${String(err)}` });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Chat Endpoint (SSE Streaming)
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/context", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const operations = user.organizationId && user.operationIds.length > 0
    ? await db.select({ id: operationsTable.id, name: operationsTable.name })
        .from(operationsTable)
        .where(and(
          eq(operationsTable.organizationId, user.organizationId),
          eq(operationsTable.status, "ACTIVE"),
          inArray(operationsTable.id, user.operationIds),
        ))
        .orderBy(operationsTable.name)
    : [];
  res.json({ operations });
});

router.post("/asa/conversations", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const rawTitle = (req.body ?? {}).title;
  if (rawTitle !== undefined && typeof rawTitle !== "string") {
    res.status(400).json({ error: "Título inválido" });
    return;
  }
  const title = rawTitle?.trim();
  const [conversation] = await db.insert(conversations).values({
    title: title || "Conversa com a ASA",
    userId: user.sub,
    organizationId: user.organizationId!,
  }).returning();
  res.status(201).json(conversation);
});

router.get("/asa/conversations/:conversationId/messages", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const conversationId = Number(req.params["conversationId"]);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Identificador de conversa inválido" });
    return;
  }

  const [conversation] = await db.select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.sub), eq(conversations.organizationId, user.organizationId!)))
    .limit(1);
  if (!conversation) {
    res.status(404).json({ error: "NOT_FOUND", message: "Conversa não encontrada" });
    return;
  }

  const messages = await db.select({ id: aiMessages.id, role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.id))
    .limit(200);
  const orderedMessages = messages.reverse();
  const proposalAudits = await db.select({ id: asaAuditLogTable.id, response: asaAuditLogTable.response, actionsExecuted: asaAuditLogTable.actionsExecuted })
    .from(asaAuditLogTable)
    .where(and(
      eq(asaAuditLogTable.conversationId, String(conversationId)),
      eq(asaAuditLogTable.userId, user.sub),
      eq(asaAuditLogTable.organizationId, user.organizationId!),
    ))
    .orderBy(asc(asaAuditLogTable.createdAt));
  const proposalsByResponse = new Map<string, Array<Record<string, unknown>>>();
  for (const audit of proposalAudits) {
    const proposal = (Array.isArray(audit.actionsExecuted) ? audit.actionsExecuted : [])
      .find((item) => item.action === "ASA_ACTION_PROPOSAL" && ASA_PROPOSAL_ACTION_TYPES.has(String(item.actionType)));
    if (!proposal) continue;
    const items = proposalsByResponse.get(audit.response) ?? [];
    items.push({
      id: audit.id,
      actionType: proposal.actionType,
      title: proposal.title,
      newTitle: proposal.newTitle,
      previousTitle: proposal.previousTitle,
      recipientName: proposal.recipientName,
      recipientNames: Array.isArray(proposal.recipientNames) ? proposal.recipientNames : undefined,
      description: typeof proposal.description === "string" ? proposal.description : undefined,
      responsibilityTitle: typeof proposal.responsibilityTitle === "string" ? proposal.responsibilityTitle : undefined,
      content: proposal.content,
      previousContent: proposal.previousContent,
      reaction: proposal.reaction,
      previousReaction: proposal.previousReaction,
      announcementContent: proposal.announcementContent,
      operationName: proposal.operationName,
      recipientCount: Array.isArray(proposal.recipientUserIds) ? proposal.recipientUserIds.length : undefined,
      assigneeName: proposal.assigneeName,
      previousStatus: proposal.previousStatus,
      expectedStatus: proposal.expectedStatus,
      previousAssigneeName: proposal.previousAssigneeName,
      date: proposal.date,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      dueDate: proposal.dueDate,
      checklistLabels: Array.isArray(proposal.checklistLabels) ? proposal.checklistLabels : [],
      mandatoryEvidences: Array.isArray(proposal.mandatoryEvidences) ? proposal.mandatoryEvidences : [],
      previousChecklistLabels: Array.isArray(proposal.previousMandatoryChecklist) ? proposal.previousMandatoryChecklist.map((item: { label?: string }) => item.label ?? "") : undefined,
      previousMandatoryEvidences: Array.isArray(proposal.previousMandatoryEvidences) ? proposal.previousMandatoryEvidences.map((item: { type?: string; description?: string }) => ({ type: item.type, description: item.description })) : undefined,
      previousResponsibilityTitle: proposal.previousResponsibilityTitle,
      newResponsibilityTitle: proposal.newResponsibilityTitle,
      previousDueDate: proposal.previousDueDate,
      previousPriority: proposal.previousPriority,
      priority: proposal.priority,
      previousMode: proposal.previousMode,
      mode: proposal.mode,
      changes: Array.isArray(proposal.changes) ? proposal.changes : [],
      expiresAt: proposal.expiresAt,
      state: proposal.state,
    });
    proposalsByResponse.set(String(proposal.previewResponse ?? audit.response), items);
  }
  res.json({ messages: orderedMessages.map((message) => {
    const proposals = proposalsByResponse.get(message.content);
    const proposal = message.role === "assistant" ? proposals?.shift() : undefined;
    return proposal ? { ...message, proposal } : message;
  }) });
});

router.post("/asa/chat/:conversationId/messages", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const conversationId = Number(req.params["conversationId"]);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Identificador de conversa inválido" });
    return;
  }
  const { content, context } = (req.body ?? {}) as { content: string; context?: { page?: string; operationId?: string } };

  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Mensagem não pode estar vazia" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.sub), eq(conversations.organizationId, user.organizationId!)));

  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }

  await db.insert(aiMessages).values({
    conversationId,
    role: "user",
    content,
  });

  const accessibleOperations = user.organizationId && user.operationIds.length > 0
    ? await db.select({ id: operationsTable.id, name: operationsTable.name })
        .from(operationsTable)
        .where(and(
          eq(operationsTable.organizationId, user.organizationId),
          eq(operationsTable.status, "ACTIVE"),
          inArray(operationsTable.id, user.operationIds),
        ))
    : [];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const toolsUsed: string[] = [];
    const actionsExecuted: Record<string, unknown>[] = [];
    const isManager = MANAGER_ROLES.includes(user.role);
    const isAgendaManager = canManageAsaAgenda(user.role);
    const preferenceCommand = parseAsaPreferenceCommand(content);
    const agendaDraftNotes = parseAsaAgendaDraftNotesRequest(content);
    const agendaDraftSchedule = parseAsaAgendaDraftScheduleRequest(content);
    const agendaDraftRename = parseAsaAgendaDraftRenameRequest(content);
    const agendaMeeting = parseAsaAgendaMeetingRequest(content);
    const muralAck = parseAsaMuralAckRequest(content);
    const muralReaction = parseAsaMuralReactionRequest(content);
    const muralComment = parseAsaMuralCommentRequest(content);
    const messageReply = parseAsaMessageReplyRequest(content);
    const directMessage = parseAsaDirectMessageRequest(content);
    const noticeDraftUpdate = parseAsaNoticeDraftUpdateRequest(content);
    const noticeDraft = parseAsaNoticeDraftRequest(content);
    const taskDraft = parseAsaTaskDraftRequest(content);
    const taskDueDateUpdate = parseAsaTaskDueDateUpdate(content);
    const taskAssigneeUpdate = parseAsaTaskAssigneeUpdate(content);
    const taskPriorityUpdate = parseAsaTaskPriorityUpdate(content);
    const taskDescriptionUpdate = parseAsaTaskDescriptionUpdate(content);
    const taskTitleUpdate = parseAsaTaskTitleUpdate(content);
    const taskRequirementsUpdate = parseAsaTaskRequirementsUpdate(content);
    const taskResponsibilityUpdate = parseAsaTaskResponsibilityUpdate(content);
    const taskCancellation = parseAsaTaskCancellationRequest(content);
    const taskComment = parseAsaTaskCommentRequest(content);
    const taskCommentsQuery = parseAsaTaskCommentsQuery(content);
    const taskEvidenceLink = parseAsaTaskEvidenceLinkRequest(content);
    const taskChecklistUpdate = parseAsaTaskChecklistUpdateRequest(content);
    const taskStart = parseAsaTaskStartRequest(content);
    const taskCompletion = parseAsaTaskCompletionRequest(content);
    const taskSubmitForApproval = parseAsaTaskSubmitForApprovalRequest(content);
    const unrecognizedReviewRequest = parseAsaUnrecognizedReviewRequest(content);
    const capabilityRequest = isAsaCapabilityRequest(content);
    const learning = parseAsaLearningRequest(content);
    const approval = parseAsaLearningApproval(content);
    let interpretationText = content;
    let fullResponse = "";
    let proposalEvent: Record<string, unknown> | null = null;
    let proposalAuditCreated = false;

    if (agendaDraftNotes.kind === "incomplete") {
      fullResponse = 'Para alterar as observações, use: altere as observações do rascunho da reunião "título exato" para "texto". Para removê-las, use: remova as observações do rascunho da reunião "título exato".';
    } else if (agendaDraftNotes.kind === "request") {
      if (!isAgendaManager) {
        fullResponse = "Alterar ou remover observações de rascunhos da Agenda está disponível apenas para gestores autorizados. Nada foi alterado.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select().from(agendaEventsTable).where(and(
            eq(agendaEventsTable.operationId, operationSelection.operationId),
            eq(agendaEventsTable.type, "MEETING"),
            eq(agendaEventsTable.title, agendaDraftNotes.title),
            eq(agendaEventsTable.status, "DRAFT"),
          ));
          if (candidates.length !== 1) {
            fullResponse = candidates.length > 1
              ? "Encontrei mais de um rascunho de reunião com esse título na operação. Nada foi alterado; especifique melhor o título."
              : "Não encontrei um rascunho de reunião com esse título na operação selecionada. Reuniões propostas ou confirmadas não podem ser alteradas por este comando.";
          } else {
            const event = candidates[0]!;
            const previousNotes = event.notes ?? null;
            const requestedNotes = agendaDraftNotes.notes;
            if ((previousNotes ?? "").trim() === (requestedNotes ?? "").trim()) {
              fullResponse = `As observações do rascunho “${event.title}” já estão assim. Não há alteração para confirmar.`;
            } else {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "AGENDA_DRAFT_NOTES_UPDATE", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                eventId: event.id, title: event.title, expectedStatus: "DRAFT", type: "MEETING",
                previousNotes, notes: requestedNotes,
                date: event.date, startTime: event.startTime, endTime: event.endTime, expiresAt,
              };
              fullResponse = `Prévia para ${requestedNotes === null ? "remover as observações" : "atualizar as observações"} do rascunho da Agenda\nOperação: ${operation?.name ?? "Operação"}\nReunião: ${event.title}\nObservações atuais: ${previousNotes || "nenhuma"}\nNovas observações: ${requestedNotes ?? "nenhuma (serão removidas)"}\n\nSomente as observações serão alteradas; a reunião continuará como rascunho.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.agenda_draft.notes.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = { id: audit.id, actionType: "AGENDA_DRAFT_NOTES_UPDATE", title: event.title,
                  previousNotes, notes: requestedNotes, operationName: operation?.name ?? "Operação", expiresAt };
              }
            }
          }
        }
      }
    } else if (agendaDraftSchedule.kind === "incomplete") {
      fullResponse = 'Para mudar a data e o horário de uma reunião em rascunho, use: altere a data e o horário do rascunho da reunião "título exato" para 01/10/2026 das 14:00 às 15:00. Só eventos ainda em rascunho podem ser alterados por este comando.';
    } else if (agendaDraftSchedule.kind === "request") {
      if (!isAgendaManager) {
        fullResponse = "Alterar a data e o horário de rascunhos da Agenda está disponível apenas para gestores autorizados. Nada foi alterado.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select().from(agendaEventsTable).where(and(
            eq(agendaEventsTable.operationId, operationSelection.operationId),
            eq(agendaEventsTable.type, "MEETING"),
            eq(agendaEventsTable.title, agendaDraftSchedule.title),
            eq(agendaEventsTable.status, "DRAFT"),
          ));
          if (candidates.length !== 1) {
            fullResponse = candidates.length > 1
              ? "Encontrei mais de um rascunho de reunião com esse título na operação. Nada foi alterado; especifique melhor o título."
              : "Não encontrei um rascunho de reunião com esse título na operação selecionada. Propostas enviadas e reuniões confirmadas não podem ser editadas por este comando.";
          } else {
            const event = candidates[0]!;
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL", actionType: "AGENDA_DRAFT_SCHEDULE_UPDATE", state: "PENDING",
              operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
              eventId: event.id, title: event.title, expectedStatus: "DRAFT", type: "MEETING",
              previousDate: event.date, previousStartTime: event.startTime, previousEndTime: event.endTime,
              date: agendaDraftSchedule.date, startTime: agendaDraftSchedule.startTime, endTime: agendaDraftSchedule.endTime,
              expiresAt,
            };
            fullResponse = `Prévia para alterar a data e o horário do rascunho da Agenda\nOperação: ${operation?.name ?? "Operação"}\nReunião: ${event.title}\nData: ${event.date} → ${agendaDraftSchedule.date}\nHorário: ${event.startTime ?? "não definido"}–${event.endTime ?? "não definido"} → ${agendaDraftSchedule.startTime}–${agendaDraftSchedule.endTime}\n\nO evento continuará como rascunho e não será confirmado nem publicado.`;
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.agenda_draft.schedule.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
              question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = { id: audit.id, actionType: "AGENDA_DRAFT_SCHEDULE_UPDATE", title: event.title,
                date: agendaDraftSchedule.date, startTime: agendaDraftSchedule.startTime, endTime: agendaDraftSchedule.endTime,
                previousDate: event.date, previousStartTime: event.startTime, previousEndTime: event.endTime,
                operationName: operation?.name ?? "Operação", expiresAt };
            }
          }
        }
      }
    } else if (agendaDraftRename.kind === "incomplete") {
      fullResponse = 'Para renomear um rascunho de reunião, use: renomeie o rascunho da reunião "título atual" para "novo título". Só eventos ainda em rascunho podem ser alterados por este comando.';
    } else if (agendaDraftRename.kind === "request") {
      if (!isAgendaManager) {
        fullResponse = "Renomear rascunhos da Agenda está disponível apenas para gestores autorizados. Nada foi alterado.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select().from(agendaEventsTable).where(and(
            eq(agendaEventsTable.operationId, operationSelection.operationId),
            eq(agendaEventsTable.type, "MEETING"),
            eq(agendaEventsTable.title, agendaDraftRename.title),
            eq(agendaEventsTable.status, "DRAFT"),
          ));
          if (candidates.length !== 1) {
            fullResponse = candidates.length > 1
              ? "Encontrei mais de um rascunho de reunião com esse título na operação. Nada foi alterado; especifique melhor o título."
              : "Não encontrei um rascunho de reunião com esse título na operação selecionada. Propostas enviadas e reuniões confirmadas não podem ser renomeadas por este comando.";
          } else {
            const event = candidates[0]!;
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL", actionType: "AGENDA_DRAFT_RENAME", state: "PENDING",
              operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
              eventId: event.id, title: event.title, previousTitle: event.title,
              newTitle: agendaDraftRename.newTitle, expectedStatus: "DRAFT", type: "MEETING",
              date: event.date, startTime: event.startTime, endTime: event.endTime, expiresAt,
            };
            fullResponse = `Prévia para renomear rascunho da Agenda\nOperação: ${operation?.name ?? "Operação"}\nReunião: ${event.title} → ${agendaDraftRename.newTitle}\nData e horário permanecem: ${event.date}, ${event.startTime}–${event.endTime}\n\nNada foi alterado. O evento continuará como rascunho.`;
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.agenda_draft.rename.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
              question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = { id: audit.id, actionType: "AGENDA_DRAFT_RENAME", title: event.title,
                previousTitle: event.title, newTitle: agendaDraftRename.newTitle, date: event.date,
                startTime: event.startTime, endTime: event.endTime, operationName: operation?.name ?? "Operação", expiresAt };
            }
          }
        }
      }
    } else if (preferenceCommand.kind === "incomplete") {
      fullResponse = 'Posso ajustar suas preferências pessoais. Exemplos: “pause minhas sugestões da ASA”, “ative a saudação da manhã”, “mude a frequência da ASA para semanal” ou “altere o horário da saudação da noite para 21:30”. Vou mostrar a prévia antes de salvar.';
    } else if (preferenceCommand.kind === "request") {
      const [preferences] = await db.select().from(asaUserPreferencesTable)
        .where(eq(asaUserPreferencesTable.userId, user.sub)).limit(1);
      const preferencePatch = preferenceCommand.patch;
      const defaults: Record<keyof AsaPreferencePatch, unknown> = {
        mode: "BALANCED", morningGreeting: true, eveningGreeting: false, reminders: true,
        birthdayAlerts: true, notificationsEnabled: true, goodMorningTime: "07:00", goodNightTime: "22:00",
        messageFrequency: "DAILY", proactivityLevel: "MEDIUM",
      };
      const preferenceKeys = Object.keys(preferencePatch) as (keyof AsaPreferencePatch)[];
      const previousValues = Object.fromEntries(preferenceKeys.map((key) => [key, preferences ? preferences[key] : defaults[key]]));
      const changes = preferenceKeys.map((key) => ({
        key, label: asaPreferenceLabel(key), before: formatAsaPreferenceValue(key, previousValues[key]),
        after: formatAsaPreferenceValue(key, preferencePatch[key]),
      }));
      if (preferenceKeys.every((key) => previousValues[key] === preferencePatch[key])) {
        fullResponse = `Essa preferência já está como você pediu: ${changes[0]!.label} · ${changes[0]!.after}. Não alterei nada.`;
      } else {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const action: Record<string, unknown> = {
          action: "ASA_ACTION_PROPOSAL", actionType: "ASA_PREFERENCE_UPDATE", state: "PENDING",
          title: "Preferências pessoais da ASA", preferencePatch, previousValues, changes,
          previousMode: preferencePatch.mode ? previousValues.mode : undefined,
          mode: preferencePatch.mode,
          expectedUpdatedAt: preferences?.updatedAt.toISOString() ?? null, expiresAt,
        };
        const changeLines = changes.map((change) => `${change.label}: ${change.before} → ${change.after}`).join("\n");
        fullResponse = `Prévia das suas preferências da ASA\n${changeLines}\n\nNada foi alterado. Confirme para salvar somente as suas preferências pessoais.`;
        action.previewResponse = fullResponse;
        toolsUsed.push("asa.preferences.preview");
        actionsExecuted.push(action);
        const [audit] = await db.insert(asaAuditLogTable).values({
          userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
          question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
        }).returning({ id: asaAuditLogTable.id });
        if (audit) {
          proposalAuditCreated = true;
          proposalEvent = { id: audit.id, actionType: "ASA_PREFERENCE_UPDATE", title: action.title,
            previousMode: action.previousMode, mode: action.mode, changes, expiresAt };
        }
      }
    } else if (capabilityRequest) {
      toolsUsed.push("asa.capabilities.list");
      actionsExecuted.push({ action: "ASA_CAPABILITY_HELP" });
      fullResponse = formatAsaCapabilityReply(user.role);
    } else if (unrecognizedReviewRequest) {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const auditRows = await db.select({ question: asaAuditLogTable.question, response: asaAuditLogTable.response, actionsExecuted: asaAuditLogTable.actionsExecuted })
        .from(asaAuditLogTable)
        .where(and(
          eq(asaAuditLogTable.userId, user.sub),
          eq(asaAuditLogTable.organizationId, user.organizationId!),
          gte(asaAuditLogTable.createdAt, since),
        ))
        .orderBy(desc(asaAuditLogTable.createdAt))
        .limit(1000);
      const groups = new Map<string, { phrase: string; count: number }>();
      for (const row of auditRows) {
        const isUnrecognized = row.response === ASA_UNRECOGNIZED_COMMAND_REPLY
          || (Array.isArray(row.actionsExecuted)
            && row.actionsExecuted.some((action) => action.action === "ASA_UNRECOGNIZED_QUERY_V1"));
        if (!isUnrecognized) continue;
        const key = normalizeAsaText(row.question);
        if (!key) continue;
        const existing = groups.get(key);
        if (existing) existing.count += 1;
        else groups.set(key, { phrase: row.question.replace(/\s+/g, " ").trim().slice(0, 180), count: 1 });
      }
      const phrases = [...groups.values()].sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase, "pt-BR"));
      if (phrases.length === 0) {
        fullResponse = "Ainda não encontrei pedidos seus sem reconhecimento nos últimos 90 dias. Esta revisão é privada e só consulta suas próprias mensagens.";
      } else {
        const details = phrases.slice(0, 10).map((item) => `• ${item.phrase} (${item.count}x)`).join("\n");
        fullResponse = `Encontrei ${phrases.length} frase(s) sua(s) que ainda não reconheço nos últimos 90 dias. A lista é privada e só você pode consultá-la:\n${details}${phrases.length > 10 ? `\nMostrando as 10 mais frequentes de ${phrases.length}.` : ""}`;
      }
    } else if (agendaMeeting.kind === "incomplete") {
      fullResponse = "Para preparar uma reunião, informe um título entre aspas, uma data completa e o horário: agende uma reunião \"título\" em 01/10/2026 das 14:00 às 15:00. Supervisão também deve indicar área e local entre aspas quando tiver mais de um escopo.";
    } else if (agendaMeeting.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const agendaOrgManager = ["ADMIN", "DIR", "DIRECTOR"].includes(user.role);
        const agendaSupervisor = user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B";
        let areaId: string | null = null;
        let locationId: string | null = null;
        let areaLabel: string | null = null;
        let locationLabel: string | null = null;
        let scopeError: string | null = null;
        if (agendaOrgManager && agendaMeeting.areaName && agendaMeeting.locationName) {
          const areaMatches = await db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(
            eq(areasTable.organizationId, user.organizationId!), eq(areasTable.active, true),
          ));
          const locationMatches = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(
            eq(locationsTable.organizationId, user.organizationId!), eq(locationsTable.closed, false),
          ));
          const foundAreas = areaMatches.filter((item) => normalizeAsaText(item.name) === normalizeAsaText(agendaMeeting.areaName!));
          const foundLocations = locationMatches.filter((item) => normalizeAsaText(item.name) === normalizeAsaText(agendaMeeting.locationName!));
          if (foundAreas.length !== 1 || foundLocations.length !== 1) scopeError = "Não encontrei uma área e um local ativos com esses nomes exatos nesta organização. Nada foi criado.";
          else {
            areaId = foundAreas[0]!.id;
            locationId = foundLocations[0]!.id;
            areaLabel = foundAreas[0]!.name;
            locationLabel = foundLocations[0]!.name;
          }
        } else if (agendaOrgManager && (agendaMeeting.areaName || agendaMeeting.locationName)) {
          scopeError = "Para vincular área e local, informe os dois nomes exatos entre aspas. Você também pode omitir ambos.";
        } else if (agendaSupervisor) {
          const membership = await db.select({ role: userRolesTable.role }).from(userRolesTable).where(and(
            eq(userRolesTable.userId, user.sub), eq(userRolesTable.operationId, operationSelection.operationId),
            eq(userRolesTable.active, true), or(eq(userRolesTable.role, "SUPERVISOR_A"), eq(userRolesTable.role, "SUPERVISOR_B")),
          )).limit(1);
          const scopes = membership.length ? await listAreaLocalScopes(user.sub, user.organizationId!) : [];
          const scopeIds = new Set(scopes.map((scope) => scope.areaId));
          const locationIds = new Set(scopes.map((scope) => scope.locationId));
          const scopeRows = scopes.length ? await db.select({ areaId: areasTable.id, areaName: areasTable.name, locationId: locationsTable.id, locationName: locationsTable.name })
            .from(areasTable).innerJoin(locationsTable, eq(locationsTable.organizationId, areasTable.organizationId))
            .where(and(inArray(areasTable.id, [...scopeIds]), inArray(locationsTable.id, [...locationIds]))) : [];
          const eligibleScopes = scopeRows.filter((row) => scopes.some((scope) => scope.areaId === row.areaId && scope.locationId === row.locationId));
          const scopeResolution = resolveAsaAgendaSupervisorScope(membership.length > 0, eligibleScopes,
            agendaMeeting.areaName, agendaMeeting.locationName);
          if (scopeResolution.kind !== "selected") {
            scopeError = scopeResolution.kind === "unavailable"
              ? "Esta operação não tem uma combinação de área e local autorizada para sua Supervisão. Nada foi criado."
              : "Para criar pela ASA, informe a área e o local exatos entre aspas, ambos dentro do seu escopo; nada foi criado.";
          } else {
            areaId = scopeResolution.scope.areaId;
            locationId = scopeResolution.scope.locationId;
            areaLabel = scopeResolution.scope.areaName;
            locationLabel = scopeResolution.scope.locationName;
          }
        } else {
          if (agendaMeeting.areaName || agendaMeeting.locationName) {
            scopeError = "Elenco pode propor reunião somente na própria área e sem escolher um local em nome da operação. Nada foi criado.";
          } else {
            const [member] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(and(
              eq(usersTable.id, user.sub), eq(usersTable.organizationId, user.organizationId!), eq(usersTable.status, "ACTIVE"),
            )).limit(1);
            const [area] = member?.areaId ? await db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(
              eq(areasTable.id, member.areaId), eq(areasTable.organizationId, user.organizationId!), eq(areasTable.active, true),
            )).limit(1) : [];
            if (!area) scopeError = "Não encontrei sua área ativa para registrar a proposta de reunião. Nada foi criado.";
            else { areaId = area.id; areaLabel = area.name; }
          }
        }
        if (scopeError) {
          fullResponse = scopeError;
        } else {
          const memberProposal = !agendaOrgManager && !agendaSupervisor;
          const status = memberProposal ? "PROPOSED" : "DRAFT";
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "AGENDA_MEETING_CREATE", state: "PENDING",
            operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
            title: agendaMeeting.title, date: agendaMeeting.date, startTime: agendaMeeting.startTime,
            endTime: agendaMeeting.endTime, type: "MEETING", areaId, locationId,
            expectedStatus: status, visibility: "OPERATION", expiresAt: expiresAt.toISOString(),
          };
          const statusLabel = memberProposal ? "Proposta pendente de análise da Supervisão" : "Rascunho da Agenda";
          fullResponse = `Prévia de reunião na Agenda\nOperação: ${operation?.name ?? "Operação"}\nTítulo: ${agendaMeeting.title}\nData: ${agendaMeeting.date.split("-").reverse().join("/")}\nHorário: ${agendaMeeting.startTime} às ${agendaMeeting.endTime}\nÁrea: ${areaLabel ?? "não informada"}\nLocal: ${locationLabel ?? "não informado"}\n\nNada foi gravado. Ao confirmar, vou criar somente ${statusLabel}; a reunião não será publicada nem convocará participantes.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.agenda_meeting.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = { id: audit.id, actionType: "AGENDA_MEETING_CREATE", title: agendaMeeting.title,
              operationName: operation?.name ?? "Operação", date: agendaMeeting.date, startTime: agendaMeeting.startTime,
              endTime: agendaMeeting.endTime, expectedStatus: status, expiresAt: expiresAt.toISOString() };
          }
        }
      }
    } else if (muralAck.kind === "incomplete") {
      fullResponse = "Para registrar ciente, informe o título exato entre aspas: dê ciente do aviso \"título do aviso\". Vou mostrar uma prévia antes de confirmar.";
    } else if (muralAck.kind === "request") {
      const candidates = await db.select({
        id: announcementsTable.id,
        title: announcementsTable.title,
        body: announcementsTable.body,
        scope: announcementsTable.scope,
        areaId: announcementsTable.areaId,
        locationId: announcementsTable.locationId,
        updatedAt: announcementsTable.updatedAt,
      }).from(announcementsTable).where(and(
        eq(announcementsTable.orgId, user.organizationId!),
        eq(announcementsTable.active, true),
        isNull(announcementsTable.cancelledAt),
        eq(announcementsTable.requiresConfirmation, true),
      ));
      const matching: typeof candidates = [];
      for (const post of candidates) {
        if (normalizeAsaText(post.title ?? "") !== normalizeAsaText(muralAck.title)) continue;
        if (await canReadAnnouncement({ userId: user.sub, organizationId: user.organizationId!, role: user.role }, post)) matching.push(post);
      }
      if (matching.length !== 1) {
        fullResponse = matching.length > 1
          ? `Encontrei mais de um aviso acessível com o título “${muralAck.title}”. Peça à gestão para diferenciá-los; nenhum ciente foi registrado.`
          : `Não encontrei um aviso ativo, que exija confirmação, com esse título e visível para você. Nenhum ciente foi registrado.`;
      } else {
        const post = matching[0]!;
        const [existingRead] = await db.select({ confirmedAt: announcementReadsTable.confirmedAt })
          .from(announcementReadsTable)
          .where(and(eq(announcementReadsTable.announcementId, post.id), eq(announcementReadsTable.userId, user.sub)))
          .limit(1);
        if (existingRead?.confirmedAt) {
          fullResponse = `Você já confirmou ciente do aviso “${post.title ?? muralAck.title}”. Não fiz nenhuma alteração.`;
        } else {
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "MURAL_ACK", state: "PENDING",
            announcementId: post.id, title: post.title ?? muralAck.title, expiresAt,
            content: post.body, announcementVersion: announcementConfirmationVersion(post),
          };
          fullResponse = `Prévia de confirmação de ciente\nAviso: ${post.title ?? muralAck.title}\n\n${post.body}\n\nAinda não registrei seu ciente. Confirme pelo botão para registrar sua confirmação no Mural.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.mural_ack.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = { id: audit.id, actionType: "MURAL_ACK", title: post.title ?? muralAck.title, content: post.body, operationName: "Mural", expiresAt };
          }
        }
      }
    } else if (muralReaction.kind === "incomplete") {
      fullResponse = 'Para reagir, informe o título exato entre aspas: reaja ao aviso "título do aviso". Vou mostrar a publicação e a reação de coração antes de confirmar.';
    } else if (muralReaction.kind === "request") {
      const candidates = await db.select().from(announcementsTable).where(and(
        eq(announcementsTable.orgId, user.organizationId!),
        eq(announcementsTable.active, true),
        isNull(announcementsTable.cancelledAt),
      ));
      const matching = [] as typeof candidates;
      for (const post of candidates) {
        if (normalizeAsaText(post.title ?? "") !== normalizeAsaText(muralReaction.title)) continue;
        if (await canReadAnnouncement({ userId: user.sub, organizationId: user.organizationId!, role: user.role }, post)) matching.push(post);
      }
      if (matching.length !== 1) {
        fullResponse = matching.length > 1
          ? `Encontrei mais de uma publicação acessível com o título “${muralReaction.title}”. Peça à gestão para diferenciá-las; nenhuma reação foi registrada.`
          : `Não encontrei uma publicação ativa com esse título e visível para você. Nenhuma reação foi registrada.`;
      } else {
        const post = matching[0]!;
        const [existingRead] = await db.select({ reaction: announcementReadsTable.reaction })
          .from(announcementReadsTable)
          .where(and(eq(announcementReadsTable.announcementId, post.id), eq(announcementReadsTable.userId, user.sub)))
          .limit(1);
        if (existingRead?.reaction === "♥") {
          fullResponse = `Você já reagiu com coração à publicação “${post.title ?? muralReaction.title}”. Não fiz nenhuma alteração.`;
        } else {
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "MURAL_REACT", state: "PENDING",
            announcementId: post.id, title: post.title ?? muralReaction.title, content: post.body,
            reaction: "♥", previousReaction: existingRead?.reaction ?? null,
            announcementVersion: announcementConfirmationVersion(post), expiresAt,
          };
          fullResponse = `Prévia de reação no Mural\nPublicação: ${post.title ?? muralReaction.title}\nReação: ♥ (coração)${existingRead?.reaction ? ` · substitui ${existingRead.reaction}` : ""}\n\n${post.body}\n\nNada foi gravado. Confirme para reagir.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.mural_reaction.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = { id: audit.id, actionType: "MURAL_REACT", title: post.title ?? muralReaction.title,
              content: post.body, operationName: "Mural", reaction: "♥", previousReaction: existingRead?.reaction ?? null, expiresAt };
          }
        }
      }
    } else if (taskChecklistUpdate.kind === "incomplete") {
      fullResponse = 'Para atualizar um item, diga se ele é obrigatório ou operacional e informe os rótulos exatos: marque o item obrigatório da checklist "rótulo do item" da tarefa "título exato" como concluído; use “desmarque” e “pendente” para reabrir.';
    } else if (taskChecklistUpdate.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const operationRole = await activeAsaRoleForOperation(user.sub, user.organizationId!, operationSelection.operationId);
        const candidates = operationRole ? await db.select().from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationSelection.operationId),
          eq(tasksTable.title, taskChecklistUpdate.title),
        )) : [];
        const tasks = candidates.filter((task) => task.assigneeId === user.sub
          && !["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status));
        if (tasks.length !== 1) {
          fullResponse = tasks.length > 1
            ? `Encontrei mais de uma tarefa chamada “${taskChecklistUpdate.title}” atribuída a você. Especifique melhor; nenhum item foi alterado.`
            : `Não encontrei uma tarefa aberta chamada “${taskChecklistUpdate.title}” atribuída a você nesta operação.`;
        } else {
          const task = tasks[0]!;
          const checklist = taskChecklistUpdate.checklistKind === "mandatory"
            ? task.mandatoryChecklist ?? [] : task.operationalChecklist ?? [];
          const items = checklist.filter((item) => item.label === taskChecklistUpdate.itemLabel);
          if (items.length !== 1) {
            fullResponse = items.length > 1
              ? `O item “${taskChecklistUpdate.itemLabel}” aparece mais de uma vez nessa checklist. Nada foi alterado.`
              : `Não encontrei o item “${taskChecklistUpdate.itemLabel}” nessa checklist da tarefa “${task.title}”.`;
          } else if (items[0]!.completed === taskChecklistUpdate.completed) {
            fullResponse = `O item “${items[0]!.label}” da tarefa “${task.title}” já está ${taskChecklistUpdate.completed ? "concluído" : "pendente"}. Nada foi alterado.`;
          } else {
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL", actionType: "TASK_CHECKLIST_UPDATE", state: "PENDING",
              operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
              taskId: task.id, title: task.title, assigneeId: task.assigneeId,
              checklistKind: taskChecklistUpdate.checklistKind, checklistItemId: items[0]!.id,
              checklistItemLabel: items[0]!.label, checklistCompleted: taskChecklistUpdate.completed,
              previousChecklistCompleted: items[0]!.completed, expectedChecklist: JSON.stringify(checklist),
              expectedStatus: task.status, expectedUpdatedAt: task.updatedAt.toISOString(), expiresAt,
            };
            fullResponse = `Prévia da checklist da tarefa\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nChecklist: ${taskChecklistUpdate.checklistKind === "mandatory" ? "obrigatória" : "operacional"}\nItem: ${items[0]!.label}\nEstado: ${items[0]!.completed ? "concluído" : "pendente"} → ${taskChecklistUpdate.completed ? "concluído" : "pendente"}\n\nNada foi alterado. Confirme para atualizar este item.`;
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.task_checklist.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
              question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = { id: audit.id, actionType: "TASK_CHECKLIST_UPDATE", title: task.title,
                operationName: operation?.name ?? "Operação", checklistKind: taskChecklistUpdate.checklistKind,
                checklistItemLabel: items[0]!.label, checklistCompleted: taskChecklistUpdate.completed,
                previousChecklistCompleted: items[0]!.completed, expiresAt };
            }
          }
        }
      }
    } else if (taskEvidenceLink.kind === "incomplete") {
      fullResponse = 'Para anexar um link complementar, informe o URL, o título exato da tarefa e uma descrição: anexe o link "https://exemplo.test/arquivo.pdf" à tarefa "título exato" com a descrição "o que este link contém". O link não contará como evidência obrigatória.';
    } else if (taskEvidenceLink.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const operationRole = await activeAsaRoleForOperation(user.sub, user.organizationId!, operationSelection.operationId);
        const candidates = operationRole ? await db.select().from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationSelection.operationId),
          eq(tasksTable.title, taskEvidenceLink.title),
        )) : [];
        const matches = [] as typeof candidates;
        for (const task of candidates) {
          const managerCanManage = TASK_MANAGER_ROLES.includes(operationRole ?? "")
            && await canManageTasks(
              user.sub, operationRole!, operationSelection.operationId, user.organizationId!,
              await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!),
            );
          const involved = task.creatorId === user.sub || task.assigneeId === user.sub;
          if ((managerCanManage || involved) && !["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)) matches.push(task);
        }
        if (matches.length !== 1) {
          fullResponse = matches.length > 1
            ? `Encontrei mais de uma tarefa chamada “${taskEvidenceLink.title}” em que você pode anexar um link. Especifique melhor; nada foi anexado.`
            : `Não encontrei uma tarefa aberta chamada “${taskEvidenceLink.title}” em que você possa anexar evidências. Nada foi alterado.`;
        } else {
          const task = matches[0]!;
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "TASK_EVIDENCE_LINK_ADD", state: "PENDING",
            operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
            taskId: task.id, title: task.title, evidenceUrl: taskEvidenceLink.url,
            evidenceDescription: taskEvidenceLink.description, evidenceType: "LINK",
            expectedStatus: task.status, expectedUpdatedAt: task.updatedAt.toISOString(),
            creatorId: task.creatorId, assigneeId: task.assigneeId, responsibilityId: task.responsibilityId,
            expiresAt,
          };
          fullResponse = `Prévia de link complementar na tarefa\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nTipo: LINK complementar\nDescrição: ${taskEvidenceLink.description}\nURL: ${taskEvidenceLink.url}\n\nNada foi anexado. Este link não será marcado como evidência obrigatória. Confirme para anexar.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.task_evidence_link.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = { id: audit.id, actionType: "TASK_EVIDENCE_LINK_ADD", title: task.title,
              evidenceUrl: taskEvidenceLink.url, evidenceDescription: taskEvidenceLink.description,
              operationName: operation?.name ?? "Operação", expiresAt };
          }
        }
      }
    } else if (taskCommentsQuery.kind === "incomplete") {
      fullResponse = 'Para consultar comentários, informe o título exato entre aspas: mostre os comentários da tarefa "título exato".';
    } else if (taskCommentsQuery.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operationRole = await activeAsaRoleForOperation(user.sub, user.organizationId!, operationSelection.operationId);
        if (!operationRole) {
          fullResponse = "Seu vínculo ativo com esta operação não está disponível. Não consultei os comentários.";
        } else {
          const candidates = await db.select().from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            eq(tasksTable.title, taskCommentsQuery.title),
          ));
          const visibleTasks = [] as typeof candidates;
          for (const task of candidates) {
            const managerCanManage = TASK_MANAGER_ROLES.includes(operationRole ?? "")
              && await canManageTasks(
                user.sub, operationRole!, operationSelection.operationId, user.organizationId!,
                await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!),
              );
            const involved = [task.creatorId, task.assigneeId, task.approverId].includes(user.sub);
            if (managerCanManage || involved) visibleTasks.push(task);
          }
          if (visibleTasks.length !== 1) {
            fullResponse = visibleTasks.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskCommentsQuery.title}” que você pode consultar. Especifique melhor.`
              : "Não encontrei uma tarefa com esse título dentro do seu escopo para consultar comentários.";
          } else {
            const task = visibleTasks[0]!;
            const comments = await db.select({
              body: taskCommentsTable.body, createdAt: taskCommentsTable.createdAt, authorName: usersTable.name,
            }).from(taskCommentsTable)
              .innerJoin(usersTable, eq(taskCommentsTable.authorId, usersTable.id))
              .where(eq(taskCommentsTable.taskId, task.id))
              .orderBy(desc(taskCommentsTable.createdAt))
              .limit(10);
            fullResponse = formatAsaTaskCommentsReply(task.title, comments);
            toolsUsed.push("asa.task_comments.read");
            actionsExecuted.push({ action: "ASA_TASK_COMMENTS_READ", taskId: task.id, count: comments.length });
          }
        }
      }
    } else if (taskComment.kind === "incomplete") {
      fullResponse = 'Para comentar uma tarefa, informe o título exato e o texto: comente na tarefa "título exato" com o texto "comentário". Vou mostrar a prévia antes de publicar.';
    } else if (taskComment.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const operationRole = await activeAsaRoleForOperation(user.sub, user.organizationId!, operationSelection.operationId);
        const candidates = operationRole ? await db.select().from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationSelection.operationId),
          eq(tasksTable.title, taskComment.title),
        )) : [];
        const matches = [] as typeof candidates;
        for (const task of candidates) {
          const managerCanManage = TASK_MANAGER_ROLES.includes(operationRole ?? "")
            && await canManageTasks(
              user.sub, operationRole!, operationSelection.operationId, user.organizationId!,
              await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!),
            );
          const involved = [task.creatorId, task.assigneeId, task.approverId].includes(user.sub);
          if (managerCanManage || involved) matches.push(task);
        }
        if (matches.length !== 1) {
          fullResponse = matches.length > 1
            ? `Encontrei mais de uma tarefa chamada “${taskComment.title}” em que você pode comentar. Especifique melhor; nenhum comentário foi publicado.`
            : `Não encontrei uma tarefa chamada “${taskComment.title}” em que você tenha acesso para comentar. Nada foi alterado.`;
        } else {
          const task = matches[0]!;
          const [actor] = await db.select({ name: usersTable.name }).from(usersTable)
            .where(and(eq(usersTable.id, user.sub), eq(usersTable.organizationId, user.organizationId!))).limit(1);
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "TASK_COMMENT_CREATE", state: "PENDING",
            operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
            taskId: task.id, title: task.title, content: taskComment.content,
            expectedStatus: task.status, expectedUpdatedAt: task.updatedAt.toISOString(),
            creatorId: task.creatorId, assigneeId: task.assigneeId, approverId: task.approverId,
            responsibilityId: task.responsibilityId, expiresAt,
          };
          fullResponse = `Prévia de comentário na tarefa\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nComentário de ${actor?.name ?? "você"}:\n${taskComment.content}\n\nNada foi publicado. Confirme para registrar o comentário.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.task_comment.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = { id: audit.id, actionType: "TASK_COMMENT_CREATE", title: task.title,
              content: taskComment.content, operationName: operation?.name ?? "Operação", expiresAt };
          }
        }
      }
    } else if (muralComment.kind === "incomplete") {
      fullResponse = 'Para comentar, informe o título exato e o texto: comente na publicação "título" com o comentário "texto completo". Vou mostrar tudo antes de publicar.';
    } else if (muralComment.kind === "request") {
      const candidates = await db.select().from(announcementsTable).where(and(
        eq(announcementsTable.orgId, user.organizationId!),
        eq(announcementsTable.active, true),
        isNull(announcementsTable.cancelledAt),
      ));
      const matching = [] as typeof candidates;
      for (const post of candidates) {
        if (normalizeAsaText(post.title ?? "") !== normalizeAsaText(muralComment.title)) continue;
        if (await canReadAnnouncement({ userId: user.sub, organizationId: user.organizationId!, role: user.role }, post)) matching.push(post);
      }
      if (matching.length !== 1) {
        fullResponse = matching.length > 1
          ? `Encontrei mais de uma publicação acessível com o título “${muralComment.title}”. Peça à gestão para diferenciá-las; nenhum comentário foi publicado.`
          : `Não encontrei uma publicação ativa com esse título e visível para você. Nenhum comentário foi publicado.`;
      } else {
        const post = matching[0]!;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const action: Record<string, unknown> = {
          action: "ASA_ACTION_PROPOSAL", actionType: "MURAL_COMMENT_CREATE", state: "PENDING",
          announcementId: post.id, title: post.title ?? muralComment.title, content: muralComment.content,
          announcementContent: post.body, announcementVersion: announcementConfirmationVersion(post), expiresAt,
        };
        fullResponse = `Prévia de comentário no Mural\nPublicação: ${post.title ?? muralComment.title}\nConteúdo atual:\n${post.body}\n\nComentário:\n${muralComment.content}\n\nNada foi publicado. Confirme para comentar.`;
        action.previewResponse = fullResponse;
        toolsUsed.push("asa.mural_comment.preview");
        actionsExecuted.push(action);
        const [audit] = await db.insert(asaAuditLogTable).values({
          userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
          question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
        }).returning({ id: asaAuditLogTable.id });
        if (audit) {
          proposalAuditCreated = true;
          proposalEvent = { id: audit.id, actionType: "MURAL_COMMENT_CREATE", title: post.title ?? muralComment.title,
            content: muralComment.content, announcementContent: post.body, operationName: "Mural", expiresAt };
        }
      }
    } else if (messageReply.kind === "incomplete") {
      fullResponse = 'Para responder, escreva: responda na conversa "Título exato" com a mensagem "Texto da resposta". Vou mostrar quem receberá e só enviar após sua confirmação.';
    } else if (messageReply.kind === "proposal") {
      const openThreads = await db.select({ id: messageThreadsTable.id, title: messageThreadsTable.title })
        .from(messageThreadsTable)
        .innerJoin(messageThreadParticipantsTable, and(
          eq(messageThreadParticipantsTable.threadId, messageThreadsTable.id),
          eq(messageThreadParticipantsTable.userId, user.sub),
        ))
        .where(and(
          eq(messageThreadsTable.orgId, user.organizationId!),
          eq(messageThreadsTable.status, "OPEN"),
        ))
        .orderBy(desc(messageThreadsTable.createdAt))
        .limit(1000);
      const matches = openThreads.filter((thread) => normalizeAsaText(thread.title) === normalizeAsaText(messageReply.threadTitle));
      if (matches.length !== 1) {
        fullResponse = matches.length > 1
          ? "Encontrei mais de uma conversa aberta com esse título. Informe um título que identifique uma única conversa; nada foi enviado."
          : "Não encontrei uma conversa aberta com esse título entre as suas conversas. Confira o título; nada foi enviado.";
      } else {
        const thread = matches[0]!;
        const participantIds = (await db.select({ userId: messageThreadParticipantsTable.userId })
          .from(messageThreadParticipantsTable)
          .where(eq(messageThreadParticipantsTable.threadId, thread.id))
          .orderBy(asc(messageThreadParticipantsTable.userId)))
          .map((participant) => participant.userId);
        const members = participantIds.length
          ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(
            inArray(usersTable.id, participantIds),
            eq(usersTable.organizationId, user.organizationId!),
            eq(usersTable.status, "ACTIVE"),
          ))
          : [];
        const memberById = new Map(members.map((member) => [member.id, member]));
        const participantSnapshot = participantIds.map((userId) => ({ id: userId, name: memberById.get(userId)?.name ?? "" }));
        const recipientNames = participantSnapshot.filter((participant) => participant.id !== user.sub).map((participant) => participant.name);
        if (!participantSnapshot.some((participant) => participant.id === user.sub)
          || members.length !== participantIds.length || recipientNames.length === 0
          || participantSnapshot.some((participant) => !participant.name)) {
          fullResponse = "Essa conversa não está disponível para resposta no momento. Nenhuma mensagem foi enviada.";
        } else {
          const [lastMessage] = await db.select({ id: messagesTable.id }).from(messagesTable)
            .where(eq(messagesTable.threadId, thread.id)).orderBy(desc(messagesTable.createdAt), desc(messagesTable.id)).limit(1);
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "MESSAGE_REPLY", state: "PENDING",
            threadId: thread.id, title: thread.title, content: messageReply.content,
            participants: participantSnapshot, lastMessageId: lastMessage?.id ?? null,
            recipientNames, expiresAt,
          };
          fullResponse = `Prévia da resposta\nConversa: ${thread.title}\nDestinatários: ${recipientNames.join(", ")}\nMensagem:\n${messageReply.content}\n\nNada foi enviado. Confirme abaixo para adicionar exatamente esta resposta à conversa.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.message_reply.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = { id: audit.id, actionType: "MESSAGE_REPLY", title: thread.title,
              content: messageReply.content, recipientNames, expiresAt };
          }
        }
      }
    } else if (directMessage.kind === "incomplete") {
      fullResponse = 'Para preparar uma mensagem direta, escreva: crie uma conversa com "Nome completo" com o título "Assunto" e a mensagem "Texto exato". Vou mostrar a prévia e só enviar após sua confirmação.';
    } else if (directMessage.kind === "proposal") {
      const recipientRows = await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
        .innerJoin(operationsTable, eq(operationsTable.id, userRolesTable.operationId))
        .where(and(
          eq(usersTable.organizationId, user.organizationId!),
          eq(usersTable.status, "ACTIVE"),
          eq(userRolesTable.active, true),
          eq(operationsTable.status, "ACTIVE"),
          eq(operationsTable.organizationId, user.organizationId!),
        ));
      const normalizedRecipient = normalizeAsaText(directMessage.recipientName);
      const recipients = [...new Map(recipientRows
        .filter((row) => row.id !== user.sub && normalizeAsaText(row.name ?? "") === normalizedRecipient)
        .map((row) => [row.id, row])).values()];
      if (recipients.length !== 1) {
        fullResponse = recipients.length > 1
          ? "Encontrei mais de uma pessoa com esse nome. Informe um nome que diferencie o destinatário. Nenhuma conversa foi criada."
          : "Não encontrei uma pessoa ativa da sua organização com esse nome. Confira o nome e tente novamente. Nenhuma conversa foi criada.";
      } else {
        const recipient = recipients[0]!;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const action: Record<string, unknown> = {
          action: "ASA_ACTION_PROPOSAL", actionType: "MESSAGE_DIRECT_CREATE", state: "PENDING",
          recipientUserId: recipient.id, recipientName: recipient.name,
          title: directMessage.title, content: directMessage.content, expiresAt,
        };
        fullResponse = `Prévia da mensagem direta\nPara: ${recipient.name}\nAssunto: ${directMessage.title}\nMensagem:\n${directMessage.content}\n\nNada foi enviado. Confirme abaixo para criar a conversa e enviar exatamente esta mensagem.`;
        action.previewResponse = fullResponse;
        toolsUsed.push("asa.message_direct.preview");
        actionsExecuted.push(action);
        const [audit] = await db.insert(asaAuditLogTable).values({
          userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
          question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
        }).returning({ id: asaAuditLogTable.id });
        if (audit) {
          proposalAuditCreated = true;
          proposalEvent = { id: audit.id, actionType: "MESSAGE_DIRECT_CREATE", title: directMessage.title,
            content: directMessage.content, recipientName: recipient.name, expiresAt };
        }
      }
    } else if (noticeDraftUpdate.kind === "incomplete") {
      fullResponse = "Para editar um rascunho, use: edite o rascunho de aviso \"título atual\" para \"novo título\" com o texto \"novo conteúdo\". Vou mostrar a comparação; a publicação não será feita pela ASA.";
    } else if (noticeDraftUpdate.kind === "request") {
      if (!isManager) {
        fullResponse = "A edição de rascunhos de aviso está disponível para gestores autorizados. Nenhum aviso foi alterado.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: noticesTable.id, title: noticesTable.title, content: noticesTable.content,
            status: noticesTable.status, autoGenerated: noticesTable.autoGenerated, cancelledAt: noticesTable.cancelledAt,
          }).from(noticesTable).where(and(
            eq(noticesTable.operationId, operationSelection.operationId),
            eq(noticesTable.title, noticeDraftUpdate.title),
          ));
          const drafts = candidates.filter((notice) => notice.status === "DRAFT" && !notice.autoGenerated && !notice.cancelledAt);
          if (drafts.length !== 1) {
            fullResponse = drafts.length > 1
              ? "Encontrei mais de um rascunho com esse título na operação. Nada foi alterado; informe um título que diferencie o aviso."
              : "Não encontrei um rascunho ativo com esse título exato na operação selecionada. Avisos publicados não podem ser editados por este comando.";
          } else {
            const draft = drafts[0]!;
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL", actionType: "NOTICE_DRAFT_UPDATE", state: "PENDING",
              operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
              noticeId: draft.id, title: noticeDraftUpdate.title, previousTitle: draft.title,
              newTitle: noticeDraftUpdate.newTitle, previousContent: draft.content,
              content: noticeDraftUpdate.content, expectedStatus: draft.status, expiresAt,
            };
            fullResponse = `Prévia da edição do rascunho de aviso\nOperação: ${operation?.name ?? "Operação"}\nTítulo: ${draft.title} → ${noticeDraftUpdate.newTitle}\n\nTexto atual:\n${draft.content}\n\nNovo texto:\n${noticeDraftUpdate.content}\n\nNada foi alterado. Ao confirmar, o aviso continuará como rascunho; não será publicado.`;
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.notice_draft.update.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
              question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = {
                id: audit.id, actionType: "NOTICE_DRAFT_UPDATE", title: noticeDraftUpdate.title,
                previousTitle: draft.title, newTitle: noticeDraftUpdate.newTitle,
                previousContent: draft.content, content: noticeDraftUpdate.content,
                operationName: operation?.name ?? "Operação", expiresAt,
              };
            }
          }
        }
      }
    } else if (noticeDraft.kind === "incomplete") {
      fullResponse = "Para preparar um rascunho, escreva: crie um rascunho de aviso: \"título\" \"texto completo\". A ASA mostrará a operação e o público antes de gravar; nada será publicado.";
    } else if (noticeDraft.kind === "proposal") {
      if (!isManager) {
        fullResponse = "A criação de rascunho de aviso está disponível para gestores. Nenhum aviso foi criado.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const targetRoles = await db.select({ userId: userRolesTable.userId })
            .from(userRolesTable)
            .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
            .where(and(
              eq(userRolesTable.operationId, operationSelection.operationId),
              eq(userRolesTable.active, true),
              eq(usersTable.organizationId, user.organizationId!),
              eq(usersTable.status, "ACTIVE"),
            ));
          const recipientUserIds = [...new Set(targetRoles.map((row) => row.userId))];
          if (!recipientUserIds.length) {
            fullResponse = `A operação ${operation?.name ?? "selecionada"} não tem destinatários ativos. Nenhum rascunho foi criado.`;
          } else {
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL",
              actionType: "NOTICE_DRAFT_CREATE",
              state: "PENDING",
              operationId: operationSelection.operationId,
              operationName: operation?.name ?? "Operação",
              title: noticeDraft.title,
              content: noticeDraft.content,
              urgency: "IMPORTANT",
              type: "INFORMATIVE",
              recipientUserIds,
              expiresAt: expiresAt.toISOString(),
            };
            fullResponse = `Prévia do rascunho de aviso\nOperação: ${operation?.name ?? "Operação"}\nTítulo: ${noticeDraft.title}\nTexto: ${noticeDraft.content}\nPúblico: ${recipientUserIds.length} pessoa(s) ativa(s) da operação.\n\nAinda não foi gravado nem publicado. Confirme pelo botão para criar somente o rascunho.`;
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.notice_draft.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub,
              conversationId: String(conversationId),
              organizationId: user.organizationId!,
              question: content,
              response: fullResponse,
              toolsUsed,
              actionsExecuted,
              confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = {
                id: audit.id,
                actionType: "NOTICE_DRAFT_CREATE",
                title: noticeDraft.title,
                content: noticeDraft.content,
                operationName: operation?.name ?? "Operação",
                recipientCount: recipientUserIds.length,
                expiresAt: expiresAt.toISOString(),
              };
            }
          }
        }
      }
    } else if (taskDraft.kind === "incomplete") {
      fullResponse = "Para preparar uma tarefa, use: crie uma tarefa \"título\" para \"nome completo\" até DD/MM/AAAA prioridade alta. A prioridade é opcional. Se precisar, acrescente: com descrição \"detalhes\", vinculada à responsabilidade \"título exato\", checklist obrigatória \"item 1; item 2\" e evidências obrigatórias \"FOTO: imagem final; PDF: relatório\". A responsabilidade precisa estar ativa na operação selecionada. A ASA mostra a prévia antes de gravar.";
    } else if (taskDraft.kind === "proposal") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A criação de tarefas pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi criada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.selectDistinct({ id: usersTable.id, name: usersTable.name })
            .from(userRolesTable)
            .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
            .where(and(
              eq(userRolesTable.operationId, operationSelection.operationId),
              eq(userRolesTable.active, true),
              eq(usersTable.organizationId, user.organizationId!),
              ne(usersTable.status, "INACTIVE"),
            ));
          const matches = candidates.filter((candidate) => normalizeAsaText(candidate.name) === normalizeAsaText(taskDraft.assigneeName));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma pessoa chamada ${taskDraft.assigneeName} nessa operação. Nenhuma tarefa foi criada; informe o nome completo ou escolha outra operação.`
              : `Não encontrei ${taskDraft.assigneeName} como pessoa ativa da operação ${operation?.name ?? "selecionada"}. Nenhuma tarefa foi criada.`;
          } else {
            const assignee = matches[0]!;
            const responsibilityCandidates = taskDraft.responsibilityTitle ? await db.select({
              id: responsibilitiesTable.id, title: responsibilitiesTable.title,
              areaId: responsibilitiesTable.areaId, operationId: responsibilitiesTable.operationId,
            }).from(responsibilitiesTable).where(and(
              eq(responsibilitiesTable.orgId, user.organizationId!),
              eq(responsibilitiesTable.active, true),
              or(eq(responsibilitiesTable.operationId, operationSelection.operationId), isNull(responsibilitiesTable.operationId)),
            )) : [];
            const exactResponsibilities = responsibilityCandidates.filter((item) =>
              normalizeAsaText(item.title) === normalizeAsaText(taskDraft.responsibilityTitle ?? ""));
            const operationResponsibilities = exactResponsibilities.filter((item) => item.operationId === operationSelection.operationId);
            const eligibleResponsibilities = operationResponsibilities.length ? operationResponsibilities
              : exactResponsibilities.filter((item) => item.operationId === null);
            const linkedResponsibility = taskDraft.responsibilityTitle
              ? eligibleResponsibilities.length === 1 ? eligibleResponsibilities[0] : null
              : null;
            if (taskDraft.responsibilityTitle && !linkedResponsibility) {
              fullResponse = eligibleResponsibilities.length > 1
                ? `Encontrei mais de uma responsabilidade ativa chamada “${taskDraft.responsibilityTitle}” na operação. Nada foi criado; use um título que identifique uma única responsabilidade.`
                : `Não encontrei uma responsabilidade ativa chamada “${taskDraft.responsibilityTitle}” na operação ${operation?.name ?? "selecionada"}. Nada foi criado.`;
            }
            const areaId = await resolveTaskAreaId(linkedResponsibility?.id, assignee.id, user.organizationId!);
            const allowed = await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId);
            if (!fullResponse && !allowed) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma tarefa foi criada.";
            } else if (!fullResponse) {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const priorityLabel = { LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" }[taskDraft.priority];
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL",
                actionType: "TASK_CREATE",
                state: "PENDING",
                operationId: operationSelection.operationId,
                operationName: operation?.name ?? "Operação",
                title: taskDraft.title,
                description: taskDraft.description ?? null,
                responsibilityId: linkedResponsibility?.id ?? null,
                responsibilityTitle: linkedResponsibility?.title ?? null,
                responsibilityAreaId: linkedResponsibility?.areaId ?? null,
                responsibilityOperationId: linkedResponsibility?.operationId ?? null,
                assigneeId: assignee.id,
                assigneeName: assignee.name,
                dueDate: taskDraft.dueDate,
                priority: taskDraft.priority,
                checklistLabels: taskDraft.checklistLabels,
                mandatoryEvidences: taskDraft.mandatoryEvidences,
                expiresAt: expiresAt.toISOString(),
              };
              const checklistPreview = taskDraft.checklistLabels.length
                ? `\nChecklist obrigatória:\n${taskDraft.checklistLabels.map((label) => `• ${label}`).join("\n")}`
                : "";
              const evidencePreview = taskDraft.mandatoryEvidences.length
                ? `\nEvidências obrigatórias:\n${taskDraft.mandatoryEvidences.map((item) => `• ${item.type}: ${item.description}`).join("\n")}`
                : "";
              const descriptionPreview = taskDraft.description ? `\nDescrição: ${taskDraft.description}` : "";
              const responsibilityPreview = linkedResponsibility ? `\nResponsabilidade: ${linkedResponsibility.title}` : "";
              fullResponse = `Prévia da tarefa\nOperação: ${operation?.name ?? "Operação"}\nTítulo: ${taskDraft.title}\nResponsável: ${assignee.name}${responsibilityPreview}\nPrazo: ${taskDraft.dueDate.split("-").reverse().join("/")}\nPrioridade: ${priorityLabel}${descriptionPreview}${checklistPreview}${evidencePreview}\n\nNada foi gravado. Confirme pelo botão para criar a tarefa; a conclusão seguirá o fluxo de aprovação.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub,
                conversationId: String(conversationId),
                organizationId: user.organizationId!,
                question: content,
                response: fullResponse,
                toolsUsed,
                actionsExecuted,
                confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id,
                  actionType: "TASK_CREATE",
                  title: taskDraft.title,
                  description: taskDraft.description,
                  responsibilityTitle: linkedResponsibility?.title,
                  operationName: operation?.name ?? "Operação",
                  assigneeName: assignee.name,
                  dueDate: taskDraft.dueDate,
                  priority: taskDraft.priority,
                  checklistLabels: taskDraft.checklistLabels,
                  mandatoryEvidences: taskDraft.mandatoryEvidences,
                  expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (taskDueDateUpdate.kind === "incomplete") {
      fullResponse = "Para alterar o prazo, informe o título exato da tarefa entre aspas e a nova data: altere o prazo da tarefa \"título exato\" para DD/MM/AAAA. Vou mostrar uma prévia antes de gravar.";
    } else if (taskDueDateUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de prazo pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const taskCandidates = await db.select({
            id: tasksTable.id,
            title: tasksTable.title,
            dueDate: tasksTable.dueDate,
            status: tasksTable.status,
            assigneeId: tasksTable.assigneeId,
            responsibilityId: tasksTable.responsibilityId,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matches = taskCandidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskDueDateUpdate.title));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskDueDateUpdate.title}” nessa operação. Inclua outro detalhe para diferenciá-las; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskDueDateUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId))) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma alteração foi feita.";
            } else if (task.dueDate === taskDueDateUpdate.dueDate) {
              fullResponse = `O prazo da tarefa “${task.title}” já é ${task.dueDate.split("-").reverse().join("/")}. Nenhuma alteração foi feita.`;
            } else {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_DUE_DATE", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                taskId: task.id, title: task.title, expectedDueDate: task.dueDate,
                previousDueDate: task.dueDate, dueDate: taskDueDateUpdate.dueDate,
                assigneeId: task.assigneeId, responsibilityId: task.responsibilityId, expectedStatus: task.status,
                expiresAt: expiresAt.toISOString(),
              };
              fullResponse = `Prévia de alteração do prazo\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nPrazo atual: ${task.dueDate.split("-").reverse().join("/")}\nNovo prazo: ${taskDueDateUpdate.dueDate.split("-").reverse().join("/")}\n\nNada foi alterado. Confirme pelo botão para atualizar somente o prazo.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task_due_date.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id, actionType: "TASK_UPDATE_DUE_DATE", title: task.title,
                  operationName: operation?.name ?? "Operação", previousDueDate: task.dueDate,
                  dueDate: taskDueDateUpdate.dueDate, expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (taskAssigneeUpdate.kind === "incomplete") {
      fullResponse = "Para trocar o responsável, informe o título exato da tarefa e o nome completo da pessoa, ambos entre aspas: altere o responsável da tarefa \"título exato\" para \"nome completo\". Vou mostrar uma prévia antes de gravar.";
    } else if (taskAssigneeUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de responsável pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: tasksTable.id, title: tasksTable.title, status: tasksTable.status,
            assigneeId: tasksTable.assigneeId, responsibilityId: tasksTable.responsibilityId,
            dueDate: tasksTable.dueDate,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matchingTasks = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskAssigneeUpdate.title));
          if (matchingTasks.length !== 1) {
            fullResponse = matchingTasks.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskAssigneeUpdate.title}” nessa operação. Inclua outro detalhe para diferenciá-las; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskAssigneeUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matchingTasks[0]!;
            const activeMembers = await db.selectDistinct({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId })
              .from(userRolesTable)
              .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
              .where(and(
                eq(userRolesTable.operationId, operationSelection.operationId),
                eq(userRolesTable.active, true),
                eq(usersTable.organizationId, user.organizationId!),
                eq(usersTable.status, "ACTIVE"),
              ));
            const assigneeMatches = activeMembers.filter((person) => normalizeAsaText(person.name) === normalizeAsaText(taskAssigneeUpdate.assigneeName));
            if (assigneeMatches.length !== 1) {
              fullResponse = assigneeMatches.length > 1
                ? `Encontrei mais de uma pessoa chamada ${taskAssigneeUpdate.assigneeName} nessa operação. Nenhuma tarefa foi alterada; informe outro detalhe para diferenciá-las.`
                : `Não encontrei ${taskAssigneeUpdate.assigneeName} como pessoa ativa da operação ${operation?.name ?? "selecionada"}. Nenhuma tarefa foi alterada.`;
            } else {
              const assignee = assigneeMatches[0]!;
              const taskAreaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
              const targetAreaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, assignee.id, user.organizationId!);
              const taskAllowed = await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, taskAreaId);
              const targetAllowed = await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, targetAreaId);
              if (!taskAllowed || !targetAllowed) {
                fullResponse = "Esta tarefa ou a pessoa escolhida está fora da sua área de gestão. Nenhuma alteração foi feita.";
              } else if (task.assigneeId === assignee.id) {
                fullResponse = `${assignee.name} já é responsável pela tarefa “${task.title}”. Nenhuma alteração foi feita.`;
              } else {
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                const action: Record<string, unknown> = {
                  action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_ASSIGNEE", state: "PENDING",
                  operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                  taskId: task.id, title: task.title, expectedAssigneeId: task.assigneeId,
                  previousAssigneeName: activeMembers.find((person) => person.id === task.assigneeId)?.name ?? "Responsável atual",
                  assigneeId: assignee.id, assigneeName: assignee.name, responsibilityId: task.responsibilityId,
                  dueDate: task.dueDate, expectedStatus: task.status, expiresAt: expiresAt.toISOString(),
                };
                fullResponse = `Prévia de alteração do responsável\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nResponsável atual: ${String(action.previousAssigneeName)}\nNovo responsável: ${assignee.name}\n\nNada foi alterado. Confirme pelo botão para atualizar somente o responsável.`;
                action.previewResponse = fullResponse;
                toolsUsed.push("asa.task_assignee.preview");
                actionsExecuted.push(action);
                const [audit] = await db.insert(asaAuditLogTable).values({
                  userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                  question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
                }).returning({ id: asaAuditLogTable.id });
                if (audit) {
                  proposalAuditCreated = true;
                  proposalEvent = {
                    id: audit.id, actionType: "TASK_UPDATE_ASSIGNEE", title: task.title,
                    operationName: operation?.name ?? "Operação", previousAssigneeName: action.previousAssigneeName,
                    assigneeName: assignee.name, expiresAt: expiresAt.toISOString(),
                  };
                }
              }
            }
          }
        }
      }
    } else if (taskPriorityUpdate.kind === "incomplete") {
      fullResponse = "Para alterar a prioridade, informe o título exato da tarefa entre aspas e escolha baixa, média, alta ou crítica: altere a prioridade da tarefa \"título exato\" para alta. Vou mostrar uma prévia antes de gravar.";
    } else if (taskPriorityUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de prioridade pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: tasksTable.id, title: tasksTable.title, priority: tasksTable.priority, status: tasksTable.status,
            assigneeId: tasksTable.assigneeId, responsibilityId: tasksTable.responsibilityId, dueDate: tasksTable.dueDate,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskPriorityUpdate.title));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskPriorityUpdate.title}” nessa operação. Inclua outro detalhe para diferenciá-las; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskPriorityUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId))) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma alteração foi feita.";
            } else if (task.priority === taskPriorityUpdate.priority) {
              fullResponse = `A tarefa “${task.title}” já tem prioridade ${({ LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" } as const)[task.priority]}. Nenhuma alteração foi feita.`;
            } else {
              const priorityLabel = { LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" } as const;
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_PRIORITY", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                taskId: task.id, title: task.title, expectedPriority: task.priority,
                previousPriority: task.priority, priority: taskPriorityUpdate.priority,
                assigneeId: task.assigneeId, responsibilityId: task.responsibilityId,
                dueDate: task.dueDate, expectedStatus: task.status, expiresAt: expiresAt.toISOString(),
              };
              fullResponse = `Prévia de alteração da prioridade\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nPrioridade atual: ${priorityLabel[task.priority]}\nNova prioridade: ${priorityLabel[taskPriorityUpdate.priority]}\n\nNada foi alterado. Confirme pelo botão para atualizar somente a prioridade.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task_priority.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id, actionType: "TASK_UPDATE_PRIORITY", title: task.title,
                  operationName: operation?.name ?? "Operação", previousPriority: task.priority,
                  priority: taskPriorityUpdate.priority, expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (taskCancellation.kind === "incomplete") {
      fullResponse = 'Para cancelar uma tarefa, informe o título exato e o motivo: cancele a tarefa "título exato" motivo "motivo da decisão". A ASA mostrará uma prévia; a tarefa só muda após confirmação.';
    } else if (taskCancellation.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "Cancelar tarefas está disponível apenas para gestores autorizados. Nenhuma alteração foi feita.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select().from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const titleMatches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskCancellation.title));
          const matches = [];
          for (const task of titleMatches) {
            const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId)) matches.push(task);
          }
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskCancellation.title}” no seu escopo nessa operação. Inclua outro detalhe; nada foi cancelado.`
              : `Não encontrei uma tarefa aberta chamada “${taskCancellation.title}” dentro do seu escopo. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const [assignee] = await db.select({ name: usersTable.name }).from(usersTable)
              .where(and(eq(usersTable.id, task.assigneeId), eq(usersTable.organizationId, user.organizationId!))).limit(1);
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL", actionType: "TASK_CANCEL", state: "PENDING",
              operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
              taskId: task.id, title: task.title, reason: taskCancellation.reason,
              expectedStatus: task.status, previousStatus: task.status, expectedUpdatedAt: task.updatedAt.toISOString(),
              assigneeId: task.assigneeId, responsibilityId: task.responsibilityId,
              dueDate: task.dueDate, priority: task.priority, description: task.description,
              requiresApproval: task.requiresApproval, expiresAt: expiresAt.toISOString(),
            };
            fullResponse = `Prévia para cancelar tarefa\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nResponsável: ${assignee?.name ?? "Responsável"}\nEstado atual: ${task.status}\nMotivo: ${taskCancellation.reason}\n\nNada foi alterado. Confirme pelo botão para cancelar a tarefa.`;
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.task_cancel.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
              question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = {
                id: audit.id, actionType: "TASK_CANCEL", title: task.title,
                operationName: operation?.name ?? "Operação", assigneeName: assignee?.name ?? "Responsável",
                previousStatus: task.status, reason: taskCancellation.reason, expiresAt: expiresAt.toISOString(),
              };
            }
          }
        }
      }
    } else if (taskStart.kind === "incomplete") {
      fullResponse = "Para iniciar uma tarefa, informe o título exato entre aspas: inicie a tarefa \"título exato\". Vou mostrar o estado e pedir confirmação antes de iniciar.";
    } else if (taskStart.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const candidates = await db.select({
          id: tasksTable.id, title: tasksTable.title, description: tasksTable.description, status: tasksTable.status,
          assigneeId: tasksTable.assigneeId, responsibilityId: tasksTable.responsibilityId,
          dueDate: tasksTable.dueDate, priority: tasksTable.priority,
        }).from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationSelection.operationId),
          inArray(tasksTable.status, ["CREATED", "CHANGES_REQUESTED"]),
        ));
        const titleMatches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskStart.title));
        const matches: typeof candidates = [];
        for (const task of titleMatches) {
          if (task.assigneeId === user.sub) {
            matches.push(task);
            continue;
          }
          if (!TASK_MANAGER_ROLES.includes(user.role)) continue;
          const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
          if (await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId)) matches.push(task);
        }
        if (matches.length !== 1) {
          fullResponse = matches.length > 1
            ? `Encontrei mais de uma tarefa chamada “${taskStart.title}” nessa operação. Inclua outro detalhe; nada foi iniciado.`
            : `Não encontrei uma tarefa pronta para iniciar chamada “${taskStart.title}” dentro do seu escopo. Nada foi alterado.`;
        } else {
          const task = matches[0]!;
          const [assignee] = await db.select({ name: usersTable.name }).from(usersTable)
            .where(and(eq(usersTable.id, task.assigneeId), eq(usersTable.organizationId, user.organizationId!))).limit(1);
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          const action: Record<string, unknown> = {
            action: "ASA_ACTION_PROPOSAL", actionType: "TASK_START", state: "PENDING",
            operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
            taskId: task.id, title: task.title, previousStatus: task.status,
            assigneeId: task.assigneeId, assigneeName: assignee?.name ?? "Responsável",
            responsibilityId: task.responsibilityId, dueDate: task.dueDate,
            priority: task.priority, description: task.description, expectedStatus: task.status,
            expiresAt: expiresAt.toISOString(),
          };
          fullResponse = `Prévia para iniciar tarefa\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nResponsável: ${assignee?.name ?? "Responsável"}\nEstado atual: ${task.status === "CREATED" ? "Pendente" : "Ajustes solicitados"}\nNovo estado: Em andamento\n\nNada foi alterado. Confirme pelo botão para iniciar a tarefa.`;
          action.previewResponse = fullResponse;
          toolsUsed.push("asa.task_start.preview");
          actionsExecuted.push(action);
          const [audit] = await db.insert(asaAuditLogTable).values({
            userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
            question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
          }).returning({ id: asaAuditLogTable.id });
          if (audit) {
            proposalAuditCreated = true;
            proposalEvent = {
              id: audit.id, actionType: "TASK_START", title: task.title,
              operationName: operation?.name ?? "Operação", assigneeName: assignee?.name ?? "Responsável",
              previousStatus: task.status, expiresAt: expiresAt.toISOString(),
            };
          }
        }
      }
    } else if (taskCompletion.kind === "incomplete") {
      fullResponse = "Para concluir uma tarefa, informe o título exato entre aspas: conclua a tarefa \"título exato\". Só posso propor a conclusão depois de conferir checklist e evidências obrigatórias.";
    } else if (taskCompletion.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const candidates = await db.select().from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationSelection.operationId),
          eq(tasksTable.status, "IN_PROGRESS"),
        ));
        const matches = candidates.filter((task) => task.assigneeId === user.sub
          && normalizeAsaText(task.title) === normalizeAsaText(taskCompletion.title));
        if (matches.length !== 1) {
          fullResponse = matches.length > 1
            ? `Encontrei mais de uma tarefa sua chamada “${taskCompletion.title}” nessa operação. Inclua outro detalhe; nada foi concluído.`
            : `Não encontrei uma tarefa sua em andamento chamada “${taskCompletion.title}” nessa operação. Nada foi alterado.`;
        } else {
          const task = matches[0]!;
          if (task.requiresApproval) {
            fullResponse = `A tarefa “${task.title}” exige aprovação. Use o pedido “envie a tarefa \"${task.title}\" para aprovação”; não posso concluí-la diretamente.`;
          } else {
            const checklist = task.mandatoryChecklist ?? [];
            const requiredEvidence = task.mandatoryEvidences ?? [];
            const uploaded = requiredEvidence.length
              ? await db.select({ refId: taskEvidencesTable.mandatoryEvidenceRefId })
                .from(taskEvidencesTable)
                .where(and(
                  eq(taskEvidencesTable.taskId, task.id),
                  eq(taskEvidencesTable.isRequired, true),
                  eq(taskEvidencesTable.active, true),
                ))
              : [];
            const requiredIds = new Set(requiredEvidence.map((item) => item.id));
            const uploadedIds = uploaded.map((item) => item.refId)
              .filter((id): id is string => id !== null && requiredIds.has(id))
              .sort();
            const uploadedSet = new Set(uploadedIds);
            const missingChecklist = checklist.filter((item) => !item.completed);
            const missingEvidence = requiredEvidence.filter((item) => !uploadedSet.has(item.id));
            if (missingChecklist.length || missingEvidence.length) {
              const missing = [
                ...missingChecklist.map((item) => `Checklist: ${item.label}`),
                ...missingEvidence.map((item) => `Evidência: ${item.description}`),
              ];
              fullResponse = `Ainda não posso concluir “${task.title}”. Falta concluir:\n${missing.map((item) => `• ${item}`).join("\n")}\n\nNada foi alterado.`;
            } else {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "TASK_COMPLETE", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                taskId: task.id, title: task.title, assigneeId: task.assigneeId,
                responsibilityId: task.responsibilityId, dueDate: task.dueDate, priority: task.priority,
                description: task.description, expectedStatus: task.status, expectedRequiresApproval: false,
                expectedMandatoryChecklist: checklist.map((item) => ({ id: item.id, completed: item.completed })),
                expectedMandatoryEvidenceIds: requiredEvidence.map((item) => item.id).sort(),
                fulfilledEvidenceIds: uploadedIds, expiresAt: expiresAt.toISOString(),
              };
              fullResponse = `Prévia para concluir tarefa\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nResponsável: você\nChecklist obrigatório: ${checklist.length}/${checklist.length} concluído\nEvidências obrigatórias: ${requiredEvidence.length}/${requiredEvidence.length} anexada(s)\nNovo estado: Concluída\n\nNada foi alterado. Confirme pelo botão para concluir esta tarefa.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task_complete.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id, actionType: "TASK_COMPLETE", title: task.title,
                  operationName: operation?.name ?? "Operação", expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (taskSubmitForApproval.kind === "incomplete") {
      fullResponse = "Para enviar uma tarefa para aprovação, informe o título exato entre aspas: envie a tarefa \"título exato\" para aprovação. Só posso propor o envio depois de conferir os itens obrigatórios.";
    } else if (taskSubmitForApproval.kind === "request") {
      const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
      if (operationSelection.kind !== "selected") {
        fullResponse = operationSelection.message;
      } else {
        const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
        const candidates = await db.select({
          id: tasksTable.id, title: tasksTable.title, status: tasksTable.status,
          assigneeId: tasksTable.assigneeId, requiresApproval: tasksTable.requiresApproval,
          mandatoryChecklist: tasksTable.mandatoryChecklist, mandatoryEvidences: tasksTable.mandatoryEvidences,
        }).from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationSelection.operationId),
          eq(tasksTable.status, "IN_PROGRESS"),
        ));
        const titleMatches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskSubmitForApproval.title));
        const matches = titleMatches.filter((task) => task.assigneeId === user.sub);
        if (matches.length !== 1) {
          fullResponse = matches.length > 1
            ? `Encontrei mais de uma tarefa sua chamada “${taskSubmitForApproval.title}” nessa operação. Inclua outro detalhe; nada foi enviado.`
            : `Não encontrei uma tarefa sua em andamento chamada “${taskSubmitForApproval.title}” nessa operação. Nada foi alterado.`;
        } else {
          const task = matches[0]!;
          const checklist = task.mandatoryChecklist ?? [];
          const requiredEvidence = task.mandatoryEvidences ?? [];
          if (!task.requiresApproval) {
            fullResponse = `A tarefa “${task.title}” não exige aprovação. A ASA não vai concluí-la com um pedido de envio para aprovação; use o fluxo oficial de conclusão.`;
          } else {
            const uploaded = requiredEvidence.length
              ? await db.select({ refId: taskEvidencesTable.mandatoryEvidenceRefId })
                .from(taskEvidencesTable)
                .where(and(
                  eq(taskEvidencesTable.taskId, task.id),
                  eq(taskEvidencesTable.isRequired, true),
                  eq(taskEvidencesTable.active, true),
                ))
              : [];
            const requiredIds = new Set(requiredEvidence.map((item) => item.id));
            const uploadedIds = uploaded.map((item) => item.refId)
              .filter((id): id is string => id !== null && requiredIds.has(id))
              .sort();
            const uploadedSet = new Set(uploadedIds);
            const missingChecklist = checklist.filter((item) => !item.completed);
            const missingEvidence = requiredEvidence.filter((item) => !uploadedSet.has(item.id));
            if (missingChecklist.length || missingEvidence.length) {
              const missing = [
                ...missingChecklist.map((item) => `Checklist: ${item.label}`),
                ...missingEvidence.map((item) => `Evidência: ${item.description}`),
              ];
              fullResponse = `Ainda não posso enviar “${task.title}” para aprovação. Falta concluir:\n${missing.map((item) => `• ${item}`).join("\n")}\n\nNada foi alterado.`;
            } else {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "TASK_READY_FOR_APPROVAL", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                taskId: task.id, title: task.title, assigneeId: task.assigneeId,
                expectedStatus: task.status, expectedRequiresApproval: true,
                expectedMandatoryChecklist: checklist.map((item) => ({ id: item.id, completed: item.completed })),
                expectedMandatoryEvidenceIds: requiredEvidence.map((item) => item.id).sort(),
                fulfilledEvidenceIds: uploadedIds, expiresAt: expiresAt.toISOString(),
              };
              fullResponse = `Prévia para enviar tarefa à aprovação\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nResponsável: você\nChecklist obrigatório: ${checklist.length}/${checklist.length} concluído\nEvidências obrigatórias: ${requiredEvidence.length}/${requiredEvidence.length} anexada(s)\nNovo estado: Aguardando aprovação\n\nNada foi alterado. Confirme pelo botão para enviar esta tarefa ao aprovador designado.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task_ready_for_approval.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id, actionType: "TASK_READY_FOR_APPROVAL", title: task.title,
                  operationName: operation?.name ?? "Operação", expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (taskResponsibilityUpdate.kind === "incomplete") {
      fullResponse = "Para mudar o vínculo, informe o título exato da tarefa e da responsabilidade: altere a responsabilidade da tarefa \"tarefa\" para \"responsabilidade\". Use \"nenhuma\" para remover o vínculo. Só posso fazer isso antes do início e sem evidências anexadas.";
    } else if (taskResponsibilityUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de responsabilidade pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: tasksTable.id, title: tasksTable.title, status: tasksTable.status, assigneeId: tasksTable.assigneeId,
            responsibilityId: tasksTable.responsibilityId, updatedAt: tasksTable.updatedAt,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskResponsibilityUpdate.title));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskResponsibilityUpdate.title}” nessa operação. Inclua outro detalhe; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskResponsibilityUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const oldAreaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, oldAreaId))) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma alteração foi feita.";
            } else if (task.status !== "CREATED") {
              fullResponse = `A tarefa “${task.title}” já foi iniciada. Só posso mudar a responsabilidade antes do início.`;
            } else {
              const evidence = await db.select({ id: taskEvidencesTable.id }).from(taskEvidencesTable)
                .where(eq(taskEvidencesTable.taskId, task.id)).limit(1);
              if (evidence.length) {
                fullResponse = `A tarefa “${task.title}” já tem evidência anexada. Não alterei seu vínculo.`;
              } else {
                const responsibilities = await db.select({
                  id: responsibilitiesTable.id, title: responsibilitiesTable.title,
                  areaId: responsibilitiesTable.areaId, operationId: responsibilitiesTable.operationId,
                  updatedAt: responsibilitiesTable.updatedAt,
                }).from(responsibilitiesTable).where(and(
                  eq(responsibilitiesTable.orgId, user.organizationId!), eq(responsibilitiesTable.active, true),
                  or(eq(responsibilitiesTable.operationId, operationSelection.operationId), isNull(responsibilitiesTable.operationId)),
                ));
                const targetMatches = taskResponsibilityUpdate.responsibilityTitle === null ? []
                  : responsibilities.filter((item) => normalizeAsaText(item.title) === normalizeAsaText(taskResponsibilityUpdate.responsibilityTitle!));
                const operationTargets = targetMatches.filter((item) => item.operationId === operationSelection.operationId);
                const eligibleTargets = operationTargets.length ? operationTargets : targetMatches.filter((item) => item.operationId === null);
                const target = eligibleTargets.length === 1 ? eligibleTargets[0] : undefined;
                if (taskResponsibilityUpdate.responsibilityTitle !== null && !target) {
                  fullResponse = eligibleTargets.length
                    ? `Encontrei mais de uma responsabilidade chamada “${taskResponsibilityUpdate.responsibilityTitle}”. Especifique melhor; nada foi alterado.`
                    : `Não encontrei a responsabilidade ativa “${taskResponsibilityUpdate.responsibilityTitle}” nessa operação. Nada foi alterado.`;
                } else if ((target?.id ?? null) === (task.responsibilityId ?? null)) {
                  fullResponse = `A tarefa “${task.title}” já está vinculada a essa responsabilidade. Nada foi alterado.`;
                } else {
                  const newAreaId = target?.areaId ?? await resolveTaskAreaId(undefined, task.assigneeId, user.organizationId!);
                  const targetAreaValid = !target?.areaId || (await db.select({ id: areasTable.id }).from(areasTable).where(and(
                    eq(areasTable.id, target.areaId), eq(areasTable.organizationId, user.organizationId!), eq(areasTable.active, true),
                  )).limit(1)).length === 1;
                  if (!targetAreaValid) {
                    fullResponse = "A área dessa responsabilidade não está ativa nesta organização. Nenhuma alteração foi feita.";
                  } else if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, newAreaId))) {
                    fullResponse = "A responsabilidade de destino está fora da sua área de gestão. Nenhuma alteração foi feita.";
                  } else {
                    const oldResponsibility = responsibilities.find((item) => item.id === task.responsibilityId);
                    if (task.responsibilityId && !oldResponsibility) {
                      fullResponse = "A responsabilidade atual não está mais ativa. Nenhuma alteração foi feita.";
                    } else {
                      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                      const action: Record<string, unknown> = {
                        action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_RESPONSIBILITY", state: "PENDING",
                        operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                        taskId: task.id, title: task.title, assigneeId: task.assigneeId,
                        expectedUpdatedAt: task.updatedAt.toISOString(), expectedStatus: task.status,
                        previousResponsibilityId: task.responsibilityId ?? null,
                        previousResponsibilityTitle: oldResponsibility?.title ?? null,
                        previousResponsibilityUpdatedAt: oldResponsibility?.updatedAt.toISOString() ?? null,
                        newResponsibilityId: target?.id ?? null, newResponsibilityTitle: target?.title ?? null,
                        newResponsibilityUpdatedAt: target?.updatedAt.toISOString() ?? null,
                        expiresAt: expiresAt.toISOString(),
                      };
                      fullResponse = `Prévia de alteração da responsabilidade\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nVínculo atual: ${oldResponsibility?.title ?? "nenhuma"}\nNovo vínculo: ${target?.title ?? "nenhuma"}\n\nNada foi alterado. Confirme pelo botão para atualizar esta tarefa.`;
                      action.previewResponse = fullResponse;
                      toolsUsed.push("asa.task_responsibility.preview");
                      actionsExecuted.push(action);
                      const [audit] = await db.insert(asaAuditLogTable).values({
                        userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                        question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
                      }).returning({ id: asaAuditLogTable.id });
                      if (audit) {
                        proposalAuditCreated = true;
                        proposalEvent = { id: audit.id, actionType: "TASK_UPDATE_RESPONSIBILITY", title: task.title,
                          operationName: operation?.name ?? "Operação", previousResponsibilityTitle: oldResponsibility?.title ?? null,
                          newResponsibilityTitle: target?.title ?? null, expiresAt: expiresAt.toISOString() };
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else if (taskTitleUpdate.kind === "incomplete") {
      fullResponse = "Para renomear uma tarefa, informe o título exato atual e o novo título entre aspas: altere o título da tarefa \"título atual\" para \"novo título\". Vou mostrar uma prévia antes de gravar.";
    } else if (taskTitleUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de título pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: tasksTable.id, title: tasksTable.title, description: tasksTable.description, status: tasksTable.status,
            assigneeId: tasksTable.assigneeId, responsibilityId: tasksTable.responsibilityId,
            dueDate: tasksTable.dueDate, priority: tasksTable.priority,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskTitleUpdate.title));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskTitleUpdate.title}” nessa operação. Inclua outro detalhe para diferenciá-las; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskTitleUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId))) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma alteração foi feita.";
            } else if (normalizeAsaText(task.title) === normalizeAsaText(taskTitleUpdate.newTitle)) {
              fullResponse = `A tarefa “${task.title}” já tem esse título. Nenhuma alteração foi feita.`;
            } else if (candidates.some((candidate) => candidate.id !== task.id
              && normalizeAsaText(candidate.title) === normalizeAsaText(taskTitleUpdate.newTitle))) {
              fullResponse = `Já existe uma tarefa aberta chamada “${taskTitleUpdate.newTitle}” nessa operação. Escolha outro título; nada foi alterado.`;
            } else {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_TITLE", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                taskId: task.id, title: task.title, expectedDescription: task.description,
                previousTitle: task.title, newTitle: taskTitleUpdate.newTitle,
                assigneeId: task.assigneeId, responsibilityId: task.responsibilityId,
                dueDate: task.dueDate, priority: task.priority, expectedStatus: task.status,
                expiresAt: expiresAt.toISOString(),
              };
              fullResponse = `Prévia de alteração do título\nOperação: ${operation?.name ?? "Operação"}\nTítulo atual: ${task.title}\nNovo título: ${taskTitleUpdate.newTitle}\n\nNada foi alterado. Confirme pelo botão para renomear somente esta tarefa.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task_title.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id, actionType: "TASK_UPDATE_TITLE", title: task.title,
                  operationName: operation?.name ?? "Operação", previousTitle: task.title,
                  newTitle: taskTitleUpdate.newTitle, expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (taskRequirementsUpdate.kind === "incomplete") {
      fullResponse = "Para alterar os requisitos, informe o título exato e os dois campos: atualize os requisitos da tarefa \"título\" para checklist obrigatória \"item 1; item 2\" e evidências obrigatórias \"PDF: descrição; FOTO: descrição\". Use \"nenhuma\" para limpar uma lista. A tarefa precisa ainda não ter sido iniciada.";
    } else if (taskRequirementsUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de checklist e evidências obrigatórias está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: tasksTable.id, title: tasksTable.title, status: tasksTable.status,
            assigneeId: tasksTable.assigneeId, responsibilityId: tasksTable.responsibilityId,
            mandatoryChecklist: tasksTable.mandatoryChecklist, mandatoryEvidences: tasksTable.mandatoryEvidences,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskRequirementsUpdate.title));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskRequirementsUpdate.title}” nessa operação. Inclua outro detalhe; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskRequirementsUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId))) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma alteração foi feita.";
            } else if (task.status !== "CREATED") {
              fullResponse = `A tarefa “${task.title}” já foi iniciada. Checklist e evidências obrigatórias só podem ser alteradas antes do início.`;
            } else {
              const attached = await db.select({ id: taskEvidencesTable.id }).from(taskEvidencesTable)
                .where(eq(taskEvidencesTable.taskId, task.id)).limit(1);
              if (attached.length) {
                fullResponse = `A tarefa “${task.title}” já tem evidência anexada. Para preservar as referências existentes, não alterei seus requisitos.`;
              } else {
                const previousChecklist = task.mandatoryChecklist ?? [];
                const previousEvidence = task.mandatoryEvidences ?? [];
                const sameChecklist = previousChecklist.length === taskRequirementsUpdate.checklistLabels.length
                  && previousChecklist.every((item, index) => normalizeAsaText(item.label) === normalizeAsaText(taskRequirementsUpdate.checklistLabels[index] ?? ""));
                const sameEvidence = previousEvidence.length === taskRequirementsUpdate.mandatoryEvidences.length
                  && previousEvidence.every((item, index) => item.type === taskRequirementsUpdate.mandatoryEvidences[index]?.type
                    && normalizeAsaText(item.description) === normalizeAsaText(taskRequirementsUpdate.mandatoryEvidences[index]?.description ?? ""));
                if (sameChecklist && sameEvidence) {
                  fullResponse = `Os requisitos da tarefa “${task.title}” já correspondem ao que você informou. Nada foi alterado.`;
                } else {
                  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                  const checklistText = (labels: string[]) => labels.length ? labels.join("; ") : "nenhuma";
                  const evidenceText = (items: Array<{ type: string; description: string }>) => items.length
                    ? items.map((item) => `${item.type}: ${item.description}`).join("; ") : "nenhuma";
                  const action: Record<string, unknown> = {
                    action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_REQUIREMENTS", state: "PENDING",
                    operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                    taskId: task.id, title: task.title, assigneeId: task.assigneeId,
                    responsibilityId: task.responsibilityId, expectedStatus: task.status,
                    previousMandatoryChecklist: previousChecklist, previousMandatoryEvidences: previousEvidence,
                    checklistLabels: taskRequirementsUpdate.checklistLabels,
                    mandatoryEvidences: taskRequirementsUpdate.mandatoryEvidences,
                    expiresAt: expiresAt.toISOString(),
                  };
                  fullResponse = `Prévia de alteração dos requisitos\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nChecklist atual: ${checklistText(previousChecklist.map((item) => item.label))}\nNova checklist: ${checklistText(taskRequirementsUpdate.checklistLabels)}\nEvidências atuais: ${evidenceText(previousEvidence)}\nNovas evidências: ${evidenceText(taskRequirementsUpdate.mandatoryEvidences)}\n\nNada foi alterado. Confirme pelo botão para atualizar os requisitos enquanto a tarefa ainda não foi iniciada.`;
                  action.previewResponse = fullResponse;
                  toolsUsed.push("asa.task_requirements.preview");
                  actionsExecuted.push(action);
                  const [audit] = await db.insert(asaAuditLogTable).values({
                    userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                    question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
                  }).returning({ id: asaAuditLogTable.id });
                  if (audit) {
                    proposalAuditCreated = true;
                    proposalEvent = {
                      id: audit.id, actionType: "TASK_UPDATE_REQUIREMENTS", title: task.title,
                      operationName: operation?.name ?? "Operação", checklistLabels: taskRequirementsUpdate.checklistLabels,
                      mandatoryEvidences: taskRequirementsUpdate.mandatoryEvidences,
                      previousMandatoryChecklist: previousChecklist, previousMandatoryEvidences: previousEvidence,
                      expiresAt: expiresAt.toISOString(),
                    };
                  }
                }
              }
            }
          }
        }
      }
    } else if (taskDescriptionUpdate.kind === "incomplete") {
      fullResponse = "Para alterar a descrição, informe o título exato e a nova descrição entre aspas: altere a descrição da tarefa \"título exato\" para \"nova descrição\". Vou mostrar uma prévia antes de gravar.";
    } else if (taskDescriptionUpdate.kind === "request") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A alteração de descrição pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi alterada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.select({
            id: tasksTable.id, title: tasksTable.title, description: tasksTable.description, status: tasksTable.status,
            assigneeId: tasksTable.assigneeId, responsibilityId: tasksTable.responsibilityId,
            dueDate: tasksTable.dueDate, priority: tasksTable.priority,
          }).from(tasksTable).where(and(
            eq(tasksTable.organizationId, user.organizationId!),
            eq(tasksTable.operationId, operationSelection.operationId),
            inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
          ));
          const matches = candidates.filter((task) => normalizeAsaText(task.title) === normalizeAsaText(taskDescriptionUpdate.title));
          if (matches.length !== 1) {
            fullResponse = matches.length > 1
              ? `Encontrei mais de uma tarefa chamada “${taskDescriptionUpdate.title}” nessa operação. Inclua outro detalhe para diferenciá-las; nada foi alterado.`
              : `Não encontrei uma tarefa aberta chamada “${taskDescriptionUpdate.title}” nessa operação. Nada foi alterado.`;
          } else {
            const task = matches[0]!;
            const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!);
            if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaId))) {
              fullResponse = "Esta tarefa está fora da sua área de gestão. Nenhuma alteração foi feita.";
            } else if (task.description === taskDescriptionUpdate.description) {
              fullResponse = `A descrição da tarefa “${task.title}” já está igual. Nenhuma alteração foi feita.`;
            } else {
              const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
              const action: Record<string, unknown> = {
                action: "ASA_ACTION_PROPOSAL", actionType: "TASK_UPDATE_DESCRIPTION", state: "PENDING",
                operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
                taskId: task.id, title: task.title, expectedDescription: task.description,
                previousDescription: task.description, description: taskDescriptionUpdate.description,
                assigneeId: task.assigneeId, responsibilityId: task.responsibilityId,
                dueDate: task.dueDate, priority: task.priority, expectedStatus: task.status,
                expiresAt: expiresAt.toISOString(),
              };
              fullResponse = `Prévia de alteração da descrição\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nDescrição atual: ${task.description || "sem descrição"}\nNova descrição: ${taskDescriptionUpdate.description}\n\nNada foi alterado. Confirme pelo botão para atualizar somente a descrição.`;
              action.previewResponse = fullResponse;
              toolsUsed.push("asa.task_description.preview");
              actionsExecuted.push(action);
              const [audit] = await db.insert(asaAuditLogTable).values({
                userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
                question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
              }).returning({ id: asaAuditLogTable.id });
              if (audit) {
                proposalAuditCreated = true;
                proposalEvent = {
                  id: audit.id, actionType: "TASK_UPDATE_DESCRIPTION", title: task.title,
                  operationName: operation?.name ?? "Operação", previousDescription: task.description,
                  description: taskDescriptionUpdate.description, expiresAt: expiresAt.toISOString(),
                };
              }
            }
          }
        }
      }
    } else if (learning.kind === "incomplete") {
      fullResponse = "Para propor um atalho, escreva: ensine que \"frase curta\" significa \"consulta que já funciona\". Nada será ativado sem sua aprovação explícita.";
    } else if (learning.kind === "proposal") {
      const targetResolution = resolveAsaCommand(learning.target, operationalDate(), isManager);
      if (targetResolution.kind !== "command") {
        fullResponse = "Só posso aprender atalhos para consultas que já funcionam. Diga uma consulta suportada como destino; nenhuma regra foi salva.";
      } else {
        const key = `ASA_COMMAND_ALIAS:${learning.phrase}`;
        const [existing] = await db.select({ id: asaMemoriesTable.id, status: asaMemoriesTable.status, value: asaMemoriesTable.value })
          .from(asaMemoriesTable)
          .where(and(
            eq(asaMemoriesTable.organizationId, user.organizationId!),
            eq(asaMemoriesTable.createdBy, user.sub),
            eq(asaMemoriesTable.type, "PERSONAL"),
            eq(asaMemoriesTable.scope, user.sub),
            eq(asaMemoriesTable.key, key),
          ))
          .limit(1);
        if (existing && existing.value === learning.target.trim() && existing.status === "APPROVED") {
          fullResponse = `O atalho “${learning.phrase}” já está aprovado para consultar “${existing.value}”. Nenhuma alteração foi feita.`;
        } else if (existing && existing.value === learning.target.trim() && existing.status === "PENDING") {
          fullResponse = `A proposta para “${learning.phrase}” já está aguardando aprovação. Nenhuma alteração foi feita.`;
        } else {
          let proposalSaved = true;
          if (existing) {
            const updated = await db.update(asaMemoriesTable).set({
              value: learning.target.trim(), status: "PENDING", approvedBy: null, approvedAt: null, updatedAt: new Date(),
            }).where(and(
              eq(asaMemoriesTable.id, existing.id),
              eq(asaMemoriesTable.createdBy, user.sub),
              eq(asaMemoriesTable.organizationId, user.organizationId!),
              eq(asaMemoriesTable.status, existing.status),
              eq(asaMemoriesTable.value, existing.value),
            )).returning({ id: asaMemoriesTable.id });
            proposalSaved = updated.length === 1;
          } else {
            await db.insert(asaMemoriesTable).values({
              type: "PERSONAL",
              key,
              value: learning.target.trim(),
              scope: user.sub,
              organizationId: user.organizationId!,
              createdBy: user.sub,
              status: "PENDING",
            });
          }
          if (proposalSaved) {
            toolsUsed.push("asa_alias.propose");
            actionsExecuted.push({ action: existing ? "ASA_COMMAND_ALIAS_UPDATED" : "ASA_COMMAND_ALIAS_PROPOSED", phrase: learning.phrase });
            fullResponse = `${existing ? "Proposta atualizada" : "Proposta de atalho pessoal"}: “${learning.phrase}” consultará “${learning.target.trim()}”. Está inativa até aprovação. Para aprovar exatamente esta regra, envie: aprovo o atalho “${learning.phrase}”.`;
          } else {
            fullResponse = "Esse atalho mudou durante o pedido. Não substituí a versão atual; confira seus aprendizados e tente novamente.";
          }
        }
      }
    } else if (approval.kind === "incomplete") {
      fullResponse = "Para aprovar, indique exatamente o atalho entre aspas: aprovo o atalho \"frase curta\". Não aprovei nenhuma regra.";
    } else if (approval.kind === "approval") {
      const key = `ASA_COMMAND_ALIAS:${approval.phrase}`;
      const [pending] = await db.select({ id: asaMemoriesTable.id, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, user.organizationId!),
          eq(asaMemoriesTable.createdBy, user.sub),
          eq(asaMemoriesTable.type, "PERSONAL"),
          eq(asaMemoriesTable.scope, user.sub),
          eq(asaMemoriesTable.key, key),
          eq(asaMemoriesTable.status, "PENDING"),
        ))
        .limit(1);
      if (!pending) {
        fullResponse = `Não encontrei uma proposta pendente sua para o atalho “${approval.phrase}”. Nenhuma regra foi ativada.`;
      } else {
        const [approved] = await db.update(asaMemoriesTable).set({
          status: "APPROVED",
          approvedBy: user.sub,
          approvedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(
          eq(asaMemoriesTable.id, pending.id),
          eq(asaMemoriesTable.organizationId, user.organizationId!),
          eq(asaMemoriesTable.createdBy, user.sub),
          eq(asaMemoriesTable.scope, user.sub),
          eq(asaMemoriesTable.type, "PERSONAL"),
          eq(asaMemoriesTable.key, key),
          eq(asaMemoriesTable.status, "PENDING"),
          eq(asaMemoriesTable.value, pending.value),
        )).returning({ id: asaMemoriesTable.id });
        if (!approved) {
          fullResponse = "A proposta mudou antes da confirmação. Ela continua inativa; confira a lista de aprendizados e tente novamente.";
        } else {
          toolsUsed.push("asa_alias.approve");
          actionsExecuted.push({ action: "ASA_COMMAND_ALIAS_APPROVED", memoryId: approved.id, phrase: approval.phrase, confirmedByUser: true });
          fullResponse = `Atalho “${approval.phrase}” aprovado. Quando você escrever essa frase, vou consultar “${pending.value}”.`;
        }
      }
    }

    if (!fullResponse) {
      const aliases = await db.select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, user.organizationId!),
          eq(asaMemoriesTable.createdBy, user.sub),
          eq(asaMemoriesTable.type, "PERSONAL"),
          eq(asaMemoriesTable.scope, user.sub),
          eq(asaMemoriesTable.status, "APPROVED"),
        ));
      let resolution = resolveAsaCommand(content, operationalDate(), isManager, context?.page, user.role);
      if (resolution.kind === "unsupported") {
        const normalizedContent = normalizeAsaText(content);
        const alias = aliases.find((memory) => memory.key.startsWith("ASA_COMMAND_ALIAS:")
          && memory.key.slice("ASA_COMMAND_ALIAS:".length) === normalizedContent);
        if (alias) {
          interpretationText = alias.value;
          resolution = resolveAsaCommand(interpretationText, operationalDate(), isManager, context?.page, user.role);
        }
      }
      if (isAsaUnrecognizedCommandResolution(resolution)) {
        actionsExecuted.push({ action: "ASA_UNRECOGNIZED_QUERY_V1" });
      }
      fullResponse = resolution.kind === "command" ? "" : resolution.message;

    if (resolution.kind === "command") {
      const { command } = resolution;
      let operationId: string | null = null;
      const supervisorTaskQuery = command.tool === "consultar_tarefas_equipe" && (user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B");
      const supervisorResponsibilitiesQuery = command.tool === "consultar_responsabilidades_equipe" && (user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B");
      if (command.tool === "consultar_agenda" || command.tool === "consultar_livro_do_dia" || command.tool === "consultar_livros_do_show" || command.tool === "consultar_escalas" || command.tool === "consultar_meu_dia" || command.tool === "consultar_meu_checkin" || command.tool === "consultar_checkins_equipe" || command.tool === "consultar_ausencias_do_dia" || command.tool === "consultar_tempo_livre" || command.tool === "consultar_atividades" || command.tool === "consultar_tarefa_requisitos" || supervisorTaskQuery || supervisorResponsibilitiesQuery || (command.tool === "consultar_entregas" && command.input.scope === "team")) {
        let selection = resolveAsaOperationSelection(interpretationText, accessibleOperations, context?.operationId);
        const delegatedResponsibility = command.tool === "consultar_checkins_equipe" ? "CHECK_INS"
          : command.tool === "consultar_tempo_livre" ? "SCALES" : null;
        if (selection.kind !== "selected" && delegatedResponsibility
          && context?.operationId && user.organizationId
          && (user.role === "SUPERVISOR_A" || user.role === "SUPERVISOR_B")
          && await hasActiveResponsibility(user.sub, context.operationId, delegatedResponsibility)) {
          const [delegatedOperation] = await db.select({ id: operationsTable.id })
            .from(operationsTable)
            .where(and(
              eq(operationsTable.id, context.operationId),
              eq(operationsTable.organizationId, user.organizationId),
              eq(operationsTable.status, "ACTIVE"),
            ))
            .limit(1);
          if (delegatedOperation) selection = { kind: "selected", operationId: delegatedOperation.id };
        }
        if (selection.kind !== "selected") {
          fullResponse = selection.message;
        } else {
          operationId = selection.operationId;
        }
      } else if ((command.tool === "consultar_tarefas_equipe" || command.tool === "consultar_relatorio_tarefas") && context?.operationId) {
        const selection = resolveAsaOperationSelection(interpretationText, accessibleOperations, context.operationId);
        if (selection.kind !== "selected") fullResponse = selection.message;
        else operationId = selection.operationId;
      } else if (command.tool === "consultar_responsabilidades_equipe"
        && (context?.operationId || /\boperacao\b/.test(normalizeAsaText(interpretationText)))) {
        const selection = resolveAsaOperationSelection(interpretationText, accessibleOperations, context?.operationId);
        if (selection.kind !== "selected") fullResponse = selection.message;
        else operationId = selection.operationId;
      }

      if (!fullResponse) {
        toolsUsed.push(command.tool);
        res.write(`data: ${JSON.stringify({ tool: command.tool })}\n\n`);
        const commandInput = command.tool === "consultar_folgas"
          ? { ...command.input, userId: user.sub }
          : command.input;
        const result = await executeTool(command.tool, commandInput, {
          userId: user.sub,
          organizationId: user.organizationId ?? null,
          userRole: user.role,
          operationId,
          operationIds: user.operationIds,
        });
        if (command.tool === "consultar_biblioteca") {
          const libraryResult = JSON.parse(result) as { found?: boolean };
          if (libraryResult.found === false) {
            const gap = createAsaLibraryGapAction(
              String(command.input.query ?? ""),
              typeof command.input.locationName === "string" ? command.input.locationName : undefined,
            );
            if (gap) actionsExecuted.push(gap);
          }
        }
        const reversible = JSON.parse(result) as { undo?: { id: string; expiresAt: string; windowSeconds: number } } | null;
        if (reversible?.undo) res.write(`data: ${JSON.stringify({ undo: reversible.undo })}\n\n`);
        fullResponse = formatAsaCommandReply(command.tool, result);
      }
    }
    }

    if (proposalEvent) res.write(`data: ${JSON.stringify({ proposal: proposalEvent })}\n\n`);
    res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);

    await db.insert(aiMessages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    await db.update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    if (!proposalAuditCreated) {
      await db.insert(asaAuditLogTable).values({
        userId: user.sub,
        conversationId: String(conversationId),
        organizationId: user.organizationId ?? undefined,
        question: content,
        response: fullResponse,
        toolsUsed,
        actionsExecuted,
        confirmedByUser: actionsExecuted.some((action) => action.confirmedByUser === true),
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Não consegui concluir essa consulta agora. Tente novamente." })}\n\n`);
    res.end();
  }
});

router.post("/asa/actions/:proposalId/confirm", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const proposalId = String(req.params.proposalId);
  if (!/^[0-9a-f-]{36}$/i.test(proposalId)) { res.status(400).json({ error: "Proposta inválida" }); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const [audit] = await tx.select().from(asaAuditLogTable).where(and(
        eq(asaAuditLogTable.id, proposalId),
        eq(asaAuditLogTable.userId, user.sub),
        eq(asaAuditLogTable.organizationId, user.organizationId!),
      )).for("update").limit(1);
      if (!audit) return { status: "not_found" as const };
      const actions = Array.isArray(audit.actionsExecuted) ? audit.actionsExecuted : [];
      const proposal = actions.find((item) => item.action === "ASA_ACTION_PROPOSAL" && ASA_PROPOSAL_ACTION_TYPES.has(String(item.actionType)));
      if (!proposal || audit.confirmedByUser || proposal.state !== "PENDING") return { status: "not_pending" as const };
      if (isAsaProposalExpired(proposal.expiresAt)) {
        const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "EXPIRED" } : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: "A proposta expirou sem alterações.",
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "expired" as const };
      }

      if (proposal.actionType === "ASA_PREFERENCE_UPDATE") {
        const fallbackPatch = proposal.mode === "SILENT" || proposal.mode === "BALANCED" || proposal.mode === "PROACTIVE"
          ? { mode: proposal.mode }
          : undefined;
        const parsedPatch = parseAsaPreferencePatch(proposal.preferencePatch ?? fallbackPatch);
        const expectedUpdatedAt = proposal.expectedUpdatedAt;
        const patch = parsedPatch.ok ? parsedPatch.value : {};
        const keys = Object.keys(patch) as (keyof AsaPreferencePatch)[];
        const rawPreviousValues = proposal.previousValues && typeof proposal.previousValues === "object"
          ? proposal.previousValues as Record<string, unknown>
          : proposal.previousMode ? { mode: proposal.previousMode } : {};
        if (!parsedPatch.ok || keys.length !== 1 || (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== "string")
          || keys.some((key) => !Object.prototype.hasOwnProperty.call(rawPreviousValues, key))) {
          return { status: "not_pending" as const };
        }
        let [preferences] = await tx.select().from(asaUserPreferencesTable)
          .where(eq(asaUserPreferencesTable.userId, user.sub)).for("update").limit(1);
        if (!preferences && expectedUpdatedAt === null) {
          await tx.insert(asaUserPreferencesTable).values({ userId: user.sub }).onConflictDoNothing();
          [preferences] = await tx.select().from(asaUserPreferencesTable)
            .where(eq(asaUserPreferencesTable.userId, user.sub)).for("update").limit(1);
        }
        const stale = !preferences
          || (expectedUpdatedAt !== null && preferences.updatedAt.toISOString() !== expectedUpdatedAt)
          || keys.some((key) => preferences?.[key] !== rawPreviousValues[key]);
        if (stale) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "Suas preferências mudaram desde a prévia. Nada foi alterado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        await tx.update(asaUserPreferencesTable).set({ ...patch, updatedAt: new Date() })
          .where(eq(asaUserPreferencesTable.userId, user.sub));
        const summary = keys.map((key) => `${asaPreferenceLabel(key)}: ${formatAsaPreferenceValue(key, patch[key])}`).join("; ");
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt: new Date().toISOString() } : item),
          response: `Preferências pessoais atualizadas. ${summary}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "asa_preferences_updated" as const, summary };
      }

      if (proposal.actionType === "MESSAGE_REPLY") {
        const stale = async (response: string) => {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({ actionsExecuted: updatedActions, response }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        const threadId = typeof proposal.threadId === "string" ? proposal.threadId : "";
        const expectedTitle = typeof proposal.title === "string" ? proposal.title : "";
        const content = typeof proposal.content === "string" ? proposal.content.trim() : "";
        const expectedLastMessageId = typeof proposal.lastMessageId === "string" || proposal.lastMessageId === null
          ? proposal.lastMessageId as string | null
          : undefined;
        const rawParticipants = Array.isArray(proposal.participants) ? proposal.participants : [];
        const expectedParticipants = rawParticipants.filter((participant): participant is { id: string; name: string } =>
          Boolean(participant) && typeof participant.id === "string" && typeof participant.name === "string");
        const participantIds = expectedParticipants.map((participant) => participant.id).sort();
        if (!threadId || !expectedTitle || expectedTitle.length > 160 || !content || content.length > 2000
          || expectedLastMessageId === undefined || expectedParticipants.length !== rawParticipants.length
          || !participantIds.includes(user.sub) || new Set(participantIds).size !== participantIds.length) {
          return stale("A prévia da resposta ficou inválida. Nada foi enviado; prepare outra.");
        }

        const [thread] = await tx.select({ id: messageThreadsTable.id, title: messageThreadsTable.title })
          .from(messageThreadsTable).where(and(
            eq(messageThreadsTable.id, threadId),
            eq(messageThreadsTable.orgId, user.organizationId!),
            eq(messageThreadsTable.status, "OPEN"),
          )).for("update").limit(1);
        if (!thread || thread.title !== expectedTitle) {
          return stale("A conversa foi fechada ou alterada desde a prévia. Nada foi enviado; prepare outra.");
        }

        const currentParticipants = await tx.select({ userId: messageThreadParticipantsTable.userId })
          .from(messageThreadParticipantsTable)
          .where(eq(messageThreadParticipantsTable.threadId, thread.id))
          .orderBy(asc(messageThreadParticipantsTable.userId))
          .for("share");
        const currentParticipantIds = currentParticipants.map((participant) => participant.userId).sort();
        if (JSON.stringify(currentParticipantIds) !== JSON.stringify(participantIds)) {
          return stale("Os participantes da conversa mudaram desde a prévia. Nada foi enviado; prepare outra.");
        }

        const currentMembers = await tx.select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable).where(and(
            inArray(usersTable.id, participantIds),
            eq(usersTable.organizationId, user.organizationId!),
            eq(usersTable.status, "ACTIVE"),
          )).for("share");
        const currentMemberById = new Map(currentMembers.map((member) => [member.id, member]));
        if (currentMembers.length !== expectedParticipants.length
          || expectedParticipants.some((participant) => currentMemberById.get(participant.id)?.name !== participant.name)) {
          return stale("Uma pessoa da conversa não está mais ativa ou teve o nome alterado. Nada foi enviado; prepare outra.");
        }

        const [lastMessage] = await tx.select({ id: messagesTable.id }).from(messagesTable)
          .where(eq(messagesTable.threadId, thread.id))
          .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
          .limit(1);
        if ((lastMessage?.id ?? null) !== expectedLastMessageId) {
          return stale("A conversa recebeu uma nova mensagem desde a prévia. Revise o contexto antes de responder novamente.");
        }

        const sender = currentMemberById.get(user.sub)!;
        const recipients = expectedParticipants.filter((participant) => participant.id !== user.sub);
        const [message] = await tx.insert(messagesTable).values({
          threadId: thread.id, senderId: user.sub, senderName: sender.name ?? null, content,
        }).returning();
        if (!message) throw new Error("Não foi possível enviar a resposta");
        await tx.update(messageThreadParticipantsTable).set({ lastReadAt: new Date() }).where(and(
          eq(messageThreadParticipantsTable.threadId, thread.id), eq(messageThreadParticipantsTable.userId, user.sub),
        ));
        await writeHistoryEvent({
          category: "MESSAGE", action: "message_sent", title: "Resposta enviada", narrative: content.slice(0, 120),
          entityType: "message", entityId: message.id, actorId: user.sub, actorName: sender.name,
          orgId: user.organizationId!, afterState: message,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt, resultId: message.id }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: `Resposta enviada na conversa ${thread.title}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return {
          status: "message_direct_replied" as const, threadId: thread.id, messageId: message.id,
          title: thread.title, content, recipientUserIds: recipients.map((participant) => participant.id),
          recipientNames: recipients.map((participant) => participant.name), senderName: sender.name ?? "Alguém",
        };
      }

      if (proposal.actionType === "MESSAGE_DIRECT_CREATE") {
        const recipientUserId = typeof proposal.recipientUserId === "string" ? proposal.recipientUserId : "";
        const expectedRecipientName = typeof proposal.recipientName === "string" ? proposal.recipientName : "";
        const title = typeof proposal.title === "string" ? proposal.title.trim() : "";
        const content = typeof proposal.content === "string" ? proposal.content.trim() : "";
        if (!recipientUserId || recipientUserId === user.sub || !expectedRecipientName
          || !title || title.length > 160 || !content || content.length > 2000) return { status: "stale" as const };

        const [sender] = await tx.select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable).where(and(
            eq(usersTable.id, user.sub), eq(usersTable.organizationId, user.organizationId!), eq(usersTable.status, "ACTIVE"),
          )).for("share").limit(1);
        const [recipient] = await tx.select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable).where(and(
            eq(usersTable.id, recipientUserId), eq(usersTable.organizationId, user.organizationId!), eq(usersTable.status, "ACTIVE"),
          )).for("share").limit(1);
        if (!sender || !recipient || normalizeAsaText(recipient.name ?? "") !== normalizeAsaText(expectedRecipientName)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "O destinatário não está mais disponível com os mesmos dados. Nenhuma mensagem foi enviada; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }

        const activeRoles = await tx.select({ userId: userRolesTable.userId })
          .from(userRolesTable)
          .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
          .where(and(
            inArray(userRolesTable.userId, [user.sub, recipientUserId]),
            eq(userRolesTable.active, true), eq(operationsTable.status, "ACTIVE"),
            eq(operationsTable.organizationId, user.organizationId!),
          )).for("share", { of: userRolesTable });
        const activeRoleUserIds = new Set(activeRoles.map((row) => row.userId));
        if (!activeRoleUserIds.has(user.sub) || !activeRoleUserIds.has(recipientUserId)) return { status: "stale" as const };

        const [thread] = await tx.insert(messageThreadsTable).values({
          orgId: user.organizationId!, title, contextType: "DIRECT", createdBy: user.sub, status: "OPEN",
        }).returning();
        if (!thread) throw new Error("Não foi possível criar a conversa");
        await tx.insert(messageThreadParticipantsTable).values([
          { threadId: thread.id, userId: user.sub, role: "INITIATOR" },
          { threadId: thread.id, userId: recipientUserId, role: "PARTICIPANT" },
        ]);
        const [message] = await tx.insert(messagesTable).values({
          threadId: thread.id, senderId: user.sub, senderName: sender.name ?? null, content,
        }).returning();
        if (!message) throw new Error("Não foi possível enviar a mensagem");
        await tx.update(messageThreadParticipantsTable).set({ lastReadAt: new Date() }).where(and(
          eq(messageThreadParticipantsTable.threadId, thread.id), eq(messageThreadParticipantsTable.userId, user.sub),
        ));
        await writeHistoryEvent({
          category: "MESSAGE", action: "thread_created", title: `Conversa criada: ${thread.title}`,
          narrative: `${sender.name ?? user.sub} iniciou uma conversa.`, entityType: "message_thread", entityId: thread.id,
          actorId: user.sub, actorName: sender.name, orgId: user.organizationId!,
          afterState: { status: thread.status, participantIds: [recipientUserId] },
          metadata: { contextType: "DIRECT", participantCount: 1, source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        await writeHistoryEvent({
          category: "MESSAGE", action: "message_sent", title: "Mensagem enviada", narrative: content.slice(0, 120),
          entityType: "message", entityId: message.id, actorId: user.sub, actorName: sender.name,
          orgId: user.organizationId!, afterState: message,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt, resultId: thread.id, messageId: message.id }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: `Mensagem enviada para ${recipient.name}. Conversa: ${thread.title}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "message_direct_created" as const, threadId: thread.id, messageId: message.id, title, content, recipientName: recipient.name ?? expectedRecipientName, senderName: sender.name ?? "Alguém", recipientUserId };
      }

      if (proposal.actionType === "MURAL_COMMENT_CREATE") {
        const announcementId = typeof proposal.announcementId === "string" ? proposal.announcementId : "";
        const commentBody = typeof proposal.content === "string" ? proposal.content.trim() : "";
        if (!announcementId || !commentBody || commentBody.length > 2000
          || typeof proposal.announcementVersion !== "string" || !/^[a-f0-9]{64}$/.test(proposal.announcementVersion)) {
          return { status: "stale" as const };
        }
        const [post] = await tx.select().from(announcementsTable).where(and(
          eq(announcementsTable.id, announcementId), eq(announcementsTable.orgId, user.organizationId!),
          eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt),
        )).for("update").limit(1);
        if (!post || !(await canReadAnnouncement(
          { userId: user.sub, organizationId: user.organizationId!, role: user.role }, post, tx,
        )) || announcementConfirmationVersion(post) !== proposal.announcementVersion) return { status: "stale" as const };
        const [comment] = await tx.insert(announcementCommentsTable).values({
          announcementId: post.id, authorId: user.sub, body: commentBody,
        }).returning();
        if (!comment) throw new Error("Não foi possível publicar o comentário");
        await writeHistoryEvent({
          category: "NOTICE", action: "mural.comment_created", title: "Comentário no Mural",
          narrative: commentBody.slice(0, 120), entityType: "announcement_comment", entityId: comment.id,
          actorId: user.sub, orgId: user.organizationId!, afterState: comment,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt, resultId: comment.id }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: `Comentário publicado em “${post.title ?? "Publicação do Mural"}”.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "mural_comment_created" as const, title: post.title ?? "Publicação", content: commentBody };
      }

      if (proposal.actionType === "MURAL_REACT") {
        const announcementId = typeof proposal.announcementId === "string" ? proposal.announcementId : "";
        const reaction = proposal.reaction === "♥" ? "♥" : "";
        const previousReaction = typeof proposal.previousReaction === "string" ? proposal.previousReaction : null;
        if (!announcementId || !reaction || typeof proposal.announcementVersion !== "string"
          || !/^[a-f0-9]{64}$/.test(proposal.announcementVersion)) return { status: "stale" as const };
        const [post] = await tx.select().from(announcementsTable).where(and(
          eq(announcementsTable.id, announcementId),
          eq(announcementsTable.orgId, user.organizationId!),
          eq(announcementsTable.active, true),
          isNull(announcementsTable.cancelledAt),
        )).for("update").limit(1);
        if (!post || !(await canReadAnnouncement(
          { userId: user.sub, organizationId: user.organizationId!, role: user.role }, post, tx,
        )) || announcementConfirmationVersion(post) !== proposal.announcementVersion) return { status: "stale" as const };
        const [existingRead] = await tx.select({ reaction: announcementReadsTable.reaction })
          .from(announcementReadsTable)
          .where(and(eq(announcementReadsTable.announcementId, post.id), eq(announcementReadsTable.userId, user.sub)))
          .for("update").limit(1);
        if ((existingRead?.reaction ?? null) !== previousReaction) return { status: "stale" as const };
        const now = new Date();
        const [read] = await tx.insert(announcementReadsTable).values({
          announcementId: post.id, userId: user.sub, readAt: now, reaction, reactedAt: now,
        }).onConflictDoUpdate({
          target: [announcementReadsTable.announcementId, announcementReadsTable.userId],
          set: { readAt: now, reaction, reactedAt: now },
        }).returning();
        if (!read) throw new Error("Não foi possível reagir à publicação");
        await writeHistoryEvent({
          category: "NOTICE", action: "mural.reacted", title: "Reação no Mural",
          narrative: `${reaction} · ${post.title ?? post.body.slice(0, 120)}`,
          entityType: "announcement", entityId: post.id, actorId: user.sub,
          orgId: user.organizationId!, afterState: read,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: `Reação de coração registrada na publicação “${post.title ?? "Mural"}”.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "mural_reacted" as const, title: post.title ?? "Publicação" };
      }

      if (proposal.actionType === "MURAL_ACK") {
        if (typeof proposal.announcementVersion !== "string" || !/^[a-f0-9]{64}$/.test(proposal.announcementVersion)) return { status: "stale" as const };
        const confirmation = await confirmAnnouncementRead(
          { userId: user.sub, organizationId: user.organizationId!, role: user.role },
          String(proposal.announcementId ?? ""),
          tx,
          proposal.announcementVersion,
        );
        if (confirmation.status !== "confirmed") return { status: "stale" as const };
        await writeHistoryEvent({
          category: "NOTICE",
          action: "mural.acknowledged",
          title: "Ciente registrado",
          narrative: confirmation.post.title ?? confirmation.post.body.slice(0, 120),
          entityType: "announcement",
          entityId: confirmation.post.id,
          actorId: user.sub,
          orgId: user.organizationId!,
          afterState: confirmation.read,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: `Ciente registrado para o aviso “${confirmation.post.title ?? "Aviso"}”.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "mural_acknowledged" as const, title: confirmation.post.title ?? "Aviso" };
      }

      const isTaskAssigneeProposal = proposal.actionType === "TASK_START" || proposal.actionType === "TASK_READY_FOR_APPROVAL" || proposal.actionType === "TASK_COMPLETE";
      const isTaskCommentProposal = proposal.actionType === "TASK_COMMENT_CREATE";
      const isTaskEvidenceLinkProposal = proposal.actionType === "TASK_EVIDENCE_LINK_ADD";
      const isTaskChecklistProposal = proposal.actionType === "TASK_CHECKLIST_UPDATE";
      const isAgendaEventProposal = proposal.actionType === "AGENDA_MEETING_CREATE";
      const isAgendaDraftRenameProposal = proposal.actionType === "AGENDA_DRAFT_RENAME";
      const isAgendaDraftScheduleProposal = proposal.actionType === "AGENDA_DRAFT_SCHEDULE_UPDATE";
      const isAgendaDraftNotesProposal = proposal.actionType === "AGENDA_DRAFT_NOTES_UPDATE";
      const isAgendaDraftUpdateProposal = isAgendaDraftRenameProposal || isAgendaDraftScheduleProposal || isAgendaDraftNotesProposal;
      if (!TASK_MANAGER_ROLES.includes(user.role) && !isTaskAssigneeProposal && !isTaskCommentProposal && !isTaskEvidenceLinkProposal && !isTaskChecklistProposal && !isAgendaEventProposal && !isAgendaDraftUpdateProposal) return { status: "forbidden" as const };

      const operationId = String(proposal.operationId ?? "");
      // Lock memberships only; upgrading locks on joined operations can deadlock other proposals.
      const currentRoleRows = await tx.select({ role: userRolesTable.role, operationId: userRolesTable.operationId })
        .from(userRolesTable)
        .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
        .where(and(
          eq(userRolesTable.userId, user.sub),
          eq(userRolesTable.active, true),
          eq(operationsTable.organizationId, user.organizationId!),
        ))
        .for("share", { of: userRolesTable });
      const currentRole = resolvePrimaryRole(currentRoleRows);
      if (!currentRole || (!TASK_MANAGER_ROLES.includes(currentRole) && !isTaskAssigneeProposal && !isTaskCommentProposal && !isTaskEvidenceLinkProposal && !isTaskChecklistProposal && !isAgendaEventProposal && !isAgendaDraftUpdateProposal)
        || !currentRoleRows.some((row) => row.operationId === operationId)) return { status: "forbidden" as const };
      if ((proposal.actionType === "NOTICE_DRAFT_CREATE" || proposal.actionType === "NOTICE_DRAFT_UPDATE")
        && !MANAGER_ROLES.includes(currentRole)) return { status: "forbidden" as const };
      if (isAgendaDraftUpdateProposal && !canManageAsaAgenda(currentRole)) return { status: "forbidden" as const };
      const [operation] = await tx.select({ id: operationsTable.id, name: operationsTable.name })
        .from(operationsTable)
        .where(and(
          eq(operationsTable.id, operationId),
          eq(operationsTable.organizationId, user.organizationId!),
          eq(operationsTable.status, "ACTIVE"),
        ))
        .for("update")
        .limit(1);
      if (!operation) return { status: "stale" as const };
      if (proposal.actionType === "NOTICE_DRAFT_CREATE" || proposal.actionType === "NOTICE_DRAFT_UPDATE") {
        const operationRole = resolvePrimaryRole(currentRoleRows.filter((row) => row.operationId === operationId));
        if (!operationRole || !MANAGER_ROLES.includes(operationRole)) return { status: "forbidden" as const };
      }

      if (proposal.actionType === "TASK_CHECKLIST_UPDATE") {
        const stale = async () => {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa ou checklist mudou desde a prévia. Nada foi alterado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        const taskId = typeof proposal.taskId === "string" ? proposal.taskId : "";
        const itemId = typeof proposal.checklistItemId === "string" ? proposal.checklistItemId : "";
        const itemLabel = typeof proposal.checklistItemLabel === "string" ? proposal.checklistItemLabel : "";
        const expectedUpdatedAt = typeof proposal.expectedUpdatedAt === "string" ? proposal.expectedUpdatedAt : "";
        const checklistKind = proposal.checklistKind === "mandatory" || proposal.checklistKind === "operational" ? proposal.checklistKind : null;
        const completed = typeof proposal.checklistCompleted === "boolean" ? proposal.checklistCompleted : null;
        let expectedChecklist: Array<{ id: string; label: string; completed: boolean }> | null = null;
        try {
          const parsed = JSON.parse(String(proposal.expectedChecklist ?? ""));
          if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.id === "string"
            && typeof item.label === "string" && typeof item.completed === "boolean")) expectedChecklist = parsed;
        } catch { expectedChecklist = null; }
        if (!taskId || !itemId || !itemLabel || !expectedUpdatedAt || !checklistKind || completed === null
          || !expectedChecklist || operation.name !== proposal.operationName) return stale();
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId), eq(tasksTable.organizationId, user.organizationId!), eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        const currentChecklist = task
          ? checklistKind === "mandatory" ? task.mandatoryChecklist ?? [] : task.operationalChecklist ?? []
          : [];
        const checklistSnapshotMatches = currentChecklist.length === expectedChecklist?.length
          && currentChecklist.every((item, index) => item.id === expectedChecklist![index]!.id
            && item.label === expectedChecklist![index]!.label && item.completed === expectedChecklist![index]!.completed);
        if (!task || task.title !== proposal.title || task.assigneeId !== user.sub || task.assigneeId !== proposal.assigneeId
          || ["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status) || task.status !== proposal.expectedStatus
          || task.updatedAt.toISOString() !== expectedUpdatedAt || !checklistSnapshotMatches) return stale();
        const matches = currentChecklist.filter((item) => item.id === itemId && item.label === itemLabel);
        if (matches.length !== 1 || matches[0]!.completed !== proposal.previousChecklistCompleted || matches[0]!.completed === completed) return stale();
        const updatedChecklist = currentChecklist.map((item) => item.id === itemId ? { ...item, completed } : item);
        const [updated] = await tx.update(tasksTable).set({
          ...(checklistKind === "mandatory" ? { mandatoryChecklist: updatedChecklist } : { operationalChecklist: updatedChecklist }),
          updatedAt: new Date(),
        }).where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar o item da checklist");
        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        await writeHistoryEvent({
          category: "TASK", action: "task.checklist_item_updated", title: `Checklist atualizada: ${task.title}`,
          narrative: `${actor?.fullName ?? "A pessoa responsável"} marcou “${itemLabel}” como ${completed ? "concluído" : "pendente"} na tarefa “${task.title}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id, checklistKind, checklistItemId: itemId, checklistItemLabel: itemLabel },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id }
            : item),
          response: `Item “${itemLabel}” da tarefa “${task.title}” marcado como ${completed ? "concluído" : "pendente"}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_checklist_updated" as const, taskId: task.id, title: task.title, itemLabel, completed };
      }

      if (proposal.actionType === "TASK_EVIDENCE_LINK_ADD") {
        const stale = async () => {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa mudou ou foi encerrada desde a prévia. Nada foi anexado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        const taskId = typeof proposal.taskId === "string" ? proposal.taskId : "";
        const url = typeof proposal.evidenceUrl === "string" ? proposal.evidenceUrl : "";
        const description = typeof proposal.evidenceDescription === "string" ? proposal.evidenceDescription.trim() : "";
        const expectedUpdatedAt = typeof proposal.expectedUpdatedAt === "string" ? proposal.expectedUpdatedAt : "";
        let parsedUrl: URL | null = null;
        try { parsedUrl = new URL(url); } catch { parsedUrl = null; }
        if (!taskId || !parsedUrl || (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:")
          || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password || !description || description.length > 240
          || proposal.evidenceType !== "LINK" || !expectedUpdatedAt || operation.name !== proposal.operationName) return stale();
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId), eq(tasksTable.organizationId, user.organizationId!), eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.status !== proposal.expectedStatus
          || ["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status)
          || task.updatedAt.toISOString() !== expectedUpdatedAt || task.creatorId !== proposal.creatorId
          || task.assigneeId !== proposal.assigneeId || task.responsibilityId !== (proposal.responsibilityId ?? null)) return stale();
        const operationRole = resolvePrimaryRole(currentRoleRows.filter((row) => row.operationId === operationId));
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        const managerCanManage = TASK_MANAGER_ROLES.includes(operationRole ?? "")
          && await canManageTasks(user.sub, operationRole!, operationId, user.organizationId!, areaId, tx);
        const involved = task.creatorId === user.sub || task.assigneeId === user.sub;
        if (!managerCanManage && !involved) return { status: "forbidden" as const };
        const [evidence] = await tx.insert(taskEvidencesTable).values({
          taskId: task.id, uploaderId: user.sub, type: "LINK", url: parsedUrl.toString(),
          description, isRequired: false, mandatoryEvidenceRefId: null,
        }).returning();
        if (!evidence) throw new Error("Não foi possível anexar o link");
        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        await writeHistoryEvent({
          category: "TASK", action: "task.evidence_added", title: `Link complementar anexado: ${task.title}`,
          narrative: `${actor?.fullName ?? "Uma pessoa envolvida"} adicionou um link complementar à tarefa “${task.title}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, afterState: evidence,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id, evidenceId: evidence.id, isRequired: false },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: evidence.id }
            : item),
          response: `Link complementar anexado à tarefa “${task.title}”. Não conta como evidência obrigatória.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_evidence_link_added" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_COMMENT_CREATE") {
        const stale = async () => {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa mudou desde a prévia. Nada foi publicado; prepare um comentário novo.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        const taskId = typeof proposal.taskId === "string" ? proposal.taskId : "";
        const content = typeof proposal.content === "string" ? proposal.content.trim() : "";
        const expectedUpdatedAt = typeof proposal.expectedUpdatedAt === "string" ? proposal.expectedUpdatedAt : "";
        if (!taskId || !content || content.length > 2000 || !expectedUpdatedAt || operation.name !== proposal.operationName) return stale();
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.status !== proposal.expectedStatus
          || task.updatedAt.toISOString() !== expectedUpdatedAt || task.creatorId !== proposal.creatorId
          || task.assigneeId !== proposal.assigneeId || task.approverId !== (proposal.approverId ?? null)
          || task.responsibilityId !== (proposal.responsibilityId ?? null)) return stale();
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        const operationRole = resolvePrimaryRole(currentRoleRows.filter((row) => row.operationId === operationId));
        const managerCanManage = TASK_MANAGER_ROLES.includes(operationRole ?? "")
          && await canManageTasks(user.sub, operationRole!, operationId, user.organizationId!, areaId, tx);
        const involved = [task.creatorId, task.assigneeId, task.approverId].includes(user.sub);
        if (!managerCanManage && !involved) return { status: "forbidden" as const };
        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        const [comment] = await tx.insert(taskCommentsTable).values({
          taskId: task.id, authorId: user.sub, body: content,
        }).returning();
        if (!comment) throw new Error("Não foi possível registrar o comentário");
        await writeHistoryEvent({
          category: "TASK", action: "task.comment_added", title: `Comentário em: ${task.title}`,
          narrative: `${actor?.fullName ?? "Uma pessoa envolvida"} comentou na tarefa “${task.title}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, afterState: comment,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id, commentId: comment.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: comment.id }
            : item),
          response: `Comentário registrado na tarefa “${task.title}”.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_comment_created" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_CANCEL") {
        const stale = async () => {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa mudou ou deixou de estar aberta desde a prévia. Nada foi cancelado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        const taskId = typeof proposal.taskId === "string" ? proposal.taskId : "";
        const reason = typeof proposal.reason === "string" ? proposal.reason.trim() : "";
        const expectedUpdatedAt = typeof proposal.expectedUpdatedAt === "string" ? proposal.expectedUpdatedAt : "";
        if (!taskId || !reason || reason.length > 500 || !expectedUpdatedAt || operation.name !== proposal.operationName) return stale();
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.status !== proposal.expectedStatus
          || task.status !== proposal.previousStatus || task.updatedAt.toISOString() !== expectedUpdatedAt
          || task.assigneeId !== proposal.assigneeId || task.responsibilityId !== (proposal.responsibilityId ?? null)
          || task.dueDate !== (proposal.dueDate ?? null) || task.priority !== proposal.priority
          || task.description !== (proposal.description ?? null) || task.requiresApproval !== proposal.requiresApproval
          || !["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"].includes(task.status)) return stale();
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        if (!TASK_MANAGER_ROLES.includes(currentRole)
          || !(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        const cancelledAt = new Date();
        const [updated] = await tx.update(tasksTable).set({
          status: "CANCELLED", cancelledAt, cancelledById: user.sub, updatedAt: cancelledAt,
        }).where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível cancelar a tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.cancelled", title: `Tarefa cancelada: ${task.title}`,
          narrative: `${actor?.fullName ?? "Uma pessoa gestora"} cancelou a tarefa “${task.title}”. Motivo: ${reason}`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id, reason },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id }
            : item),
          response: `Tarefa “${task.title}” cancelada. Motivo: ${reason}`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_cancelled" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "NOTICE_DRAFT_UPDATE") {
        const noticeId = typeof proposal.noticeId === "string" ? proposal.noticeId : "";
        const [notice] = await tx.select().from(noticesTable).where(and(
          eq(noticesTable.id, noticeId),
          eq(noticesTable.operationId, operationId),
        )).for("update").limit(1);
        const stale = async () => {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "O rascunho mudou ou deixou de estar disponível desde a prévia. Nada foi alterado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        if (!notice || operation.name !== proposal.operationName || notice.status !== "DRAFT"
          || notice.autoGenerated || notice.cancelledAt
          || notice.title !== proposal.previousTitle || notice.title !== proposal.title
          || notice.content !== proposal.previousContent || proposal.expectedStatus !== "DRAFT") return stale();
        const newTitle = typeof proposal.newTitle === "string" ? proposal.newTitle.trim() : "";
        const newContent = typeof proposal.content === "string" ? proposal.content.trim() : "";
        if (!newTitle || newTitle.length > 120 || !newContent || newContent.length > 2000) return stale();
        const [updated] = await tx.update(noticesTable).set({ title: newTitle, content: newContent })
          .where(eq(noticesTable.id, notice.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar o rascunho");
        await writeHistoryEvent({
          category: "NOTICE", action: "updated", title: `Rascunho atualizado: ${newTitle}`,
          narrative: `Rascunho de aviso “${notice.title ?? "sem título"}” atualizado; continua não publicado.`,
          entityType: "notice", entityId: notice.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: notice, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: notice.id } : item),
          response: `Rascunho de aviso atualizado: ${newTitle}. Ele continua não publicado.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "notice_draft_updated" as const, noticeId: notice.id, title: newTitle };
      }

      if (isAgendaDraftUpdateProposal) {
        const operationRole = resolvePrimaryRole(currentRoleRows.filter((row) => row.operationId === operationId));
        if (!operationRole || !canManageAsaAgenda(operationRole)) return { status: "forbidden" as const };
        const eventId = String(proposal.eventId ?? "");
        const [event] = await tx.select().from(agendaEventsTable).where(and(
          eq(agendaEventsTable.id, eventId),
          eq(agendaEventsTable.operationId, operationId),
        )).for("update").limit(1);
        const newTitle = typeof proposal.newTitle === "string" ? proposal.newTitle.trim() : "";
        const stale = async () => {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "O rascunho da reunião mudou ou deixou de estar disponível desde a prévia. Nada foi alterado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        };
        const isStale = !event || operation.name !== proposal.operationName || event.type !== "MEETING" || event.status !== "DRAFT"
          || event.title !== proposal.title || proposal.expectedStatus !== "DRAFT"
          || (isAgendaDraftRenameProposal && (event.title !== proposal.previousTitle
            || event.date !== proposal.date || event.startTime !== proposal.startTime || event.endTime !== proposal.endTime
            || !newTitle || newTitle.length > 160 || normalizeAsaText(newTitle) === normalizeAsaText(event.title)))
          || (isAgendaDraftScheduleProposal && (event.date !== proposal.previousDate
            || event.startTime !== proposal.previousStartTime || event.endTime !== proposal.previousEndTime
            || typeof proposal.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.date)
            || typeof proposal.startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(proposal.startTime)
            || typeof proposal.endTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(proposal.endTime)
            || proposal.startTime >= proposal.endTime))
          || (isAgendaDraftNotesProposal && (event.notes !== proposal.previousNotes
            || (proposal.notes !== null && (typeof proposal.notes !== "string" || !proposal.notes.trim() || proposal.notes.length > 2000))));
        if (isStale) return stale();
        const updates = isAgendaDraftRenameProposal
          ? { title: newTitle, updatedAt: new Date() }
          : isAgendaDraftScheduleProposal
            ? { date: String(proposal.date), startTime: String(proposal.startTime), endTime: String(proposal.endTime), updatedAt: new Date() }
            : { notes: proposal.notes === null ? null : String(proposal.notes).trim(), updatedAt: new Date() };
        const [updated] = await tx.update(agendaEventsTable).set(updates)
          .where(and(eq(agendaEventsTable.id, event.id), eq(agendaEventsTable.status, "DRAFT"))).returning();
        if (!updated) return stale();
        await writeHistoryEvent({
          category: "AGENDA", action: "updated", title: isAgendaDraftRenameProposal ? "Rascunho de reunião renomeado" : isAgendaDraftScheduleProposal ? "Data e horário do rascunho de reunião alterados" : "Observações do rascunho de reunião atualizadas",
          narrative: isAgendaDraftRenameProposal
            ? `Rascunho de reunião renomeado de “${event.title}” para “${updated.title}”; continua não confirmado.`
            : isAgendaDraftScheduleProposal
              ? `Data e horário do rascunho “${event.title}” alterados; continua não confirmado.`
              : updated.notes
                ? `Observações do rascunho “${event.title}” atualizadas; continua não confirmado.`
                : `Observações do rascunho “${event.title}” removidas; continua não confirmado.`,
          entityType: "agenda_event", entityId: event.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: event, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: event.id } : item),
          response: isAgendaDraftRenameProposal
            ? `Rascunho de reunião renomeado para “${updated.title}”; continua não confirmado.`
            : isAgendaDraftScheduleProposal
              ? `Data e horário do rascunho “${updated.title}” atualizados; continua não confirmado.`
              : updated.notes
                ? `Observações do rascunho “${updated.title}” atualizadas; continua não confirmado.`
                : `Observações do rascunho “${updated.title}” removidas; continua não confirmado.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        if (isAgendaDraftRenameProposal) return { status: "agenda_draft_renamed" as const, eventId: event.id, title: updated.title };
        if (isAgendaDraftScheduleProposal) return { status: "agenda_draft_schedule_updated" as const, eventId: event.id, title: updated.title, date: updated.date, startTime: updated.startTime, endTime: updated.endTime };
        return { status: "agenda_draft_notes_updated" as const, eventId: event.id, title: updated.title, notes: updated.notes ?? null };
      }

      if (isAgendaEventProposal) {
        const title = String(proposal.title ?? "").trim();
        const date = String(proposal.date ?? "");
        const startTime = String(proposal.startTime ?? "");
        const endTime = String(proposal.endTime ?? "");
        const areaId = typeof proposal.areaId === "string" ? proposal.areaId : null;
        const locationId = typeof proposal.locationId === "string" ? proposal.locationId : null;
        const orgManager = ["ADMIN", "DIR", "DIRECTOR"].includes(currentRole);
        const supervisor = currentRole === "SUPERVISOR_A" || currentRole === "SUPERVISOR_B";
        const expectedStatus = supervisor || orgManager ? "DRAFT" : "PROPOSED";
        if (operation.name !== proposal.operationName || !title || title.length > 160
          || !/^\d{4}-\d{2}-\d{2}$/.test(date)
          || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
          || startTime >= endTime || proposal.type !== "MEETING" || proposal.expectedStatus !== expectedStatus
          || (!areaId && !orgManager) || (supervisor && !locationId)) return { status: "stale" as const };
        if (areaId) {
          const [area] = await tx.select({ id: areasTable.id }).from(areasTable).where(and(
            eq(areasTable.id, areaId), eq(areasTable.organizationId, user.organizationId!), eq(areasTable.active, true),
          )).for("share").limit(1);
          if (!area) return { status: "stale" as const };
        }
        if (locationId) {
          const [location] = await tx.select({ id: locationsTable.id }).from(locationsTable).where(and(
            eq(locationsTable.id, locationId), eq(locationsTable.organizationId, user.organizationId!), eq(locationsTable.closed, false),
          )).for("share").limit(1);
          if (!location) return { status: "stale" as const };
        }
        if (supervisor) {
          const scopes = await listAreaLocalScopes(user.sub, user.organizationId!, tx);
          if (!scopes.some((scope) => scope.areaId === areaId && scope.locationId === locationId)
            || !currentRoleRows.some((row) => row.operationId === operationId && ["SUPERVISOR_A", "SUPERVISOR_B"].includes(row.role))) {
            return { status: "forbidden" as const };
          }
        } else if (!orgManager) {
          const [member] = await tx.select({ areaId: usersTable.areaId }).from(usersTable).where(and(
            eq(usersTable.id, user.sub), eq(usersTable.organizationId, user.organizationId!), eq(usersTable.status, "ACTIVE"),
          )).for("share").limit(1);
          if (!member?.areaId || member.areaId !== areaId || locationId !== null || currentRole === "ADMIN" || currentRole === "DIR") {
            return { status: "forbidden" as const };
          }
        }
        const [created] = await tx.insert(agendaEventsTable).values({
          operationId, type: "MEETING", title, date, startTime, endTime,
          areaId, locationId, status: expectedStatus, visibility: "OPERATION", createdBy: user.sub,
        }).returning();
        if (!created) throw new Error("Não foi possível criar a reunião na Agenda");
        if (expectedStatus === "PROPOSED") {
          await tx.insert(agendaEventParticipantsTable).values({ eventId: created.id, userId: user.sub, response: "PENDING" });
        }
        await writeHistoryEvent({
          category: "AGENDA", action: "created", title: "Reunião criada pela ASA",
          narrative: `Reunião ${created.title} criada para ${created.date}.`, entityType: "agenda_event", entityId: created.id,
          actorId: user.sub, operationId, orgId: user.organizationId!, beforeState: null, afterState: created,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: created.id }
            : item),
          response: expectedStatus === "PROPOSED"
            ? `Proposta de reunião “${created.title}” enviada para análise da Supervisão.`
            : `Rascunho da reunião “${created.title}” criado na Agenda.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "agenda_meeting_created" as const, eventId: created.id, operationId, title: created.title,
          date: created.date, startTime: created.startTime, endTime: created.endTime,
          proposed: expectedStatus === "PROPOSED", areaId };
      }

      if (proposal.actionType === "TASK_START") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.status !== proposal.expectedStatus
          || task.status !== proposal.previousStatus || task.assigneeId !== proposal.assigneeId
          || task.responsibilityId !== (proposal.responsibilityId ?? null)
          || task.dueDate !== (proposal.dueDate ?? null) || task.priority !== proposal.priority
          || task.description !== (proposal.description ?? null)
          || !["CREATED", "CHANGES_REQUESTED"].includes(task.status)) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa mudou desde a prévia. Nada foi iniciado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        const assignedToRequester = task.assigneeId === user.sub;
        const canManage = TASK_MANAGER_ROLES.includes(currentRole)
          && await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx);
        if (!assignedToRequester && !canManage) return { status: "forbidden" as const };
        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        const [updated] = await tx.update(tasksTable).set({ status: "IN_PROGRESS", updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível iniciar a tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.started", title: `Tarefa iniciada: ${task.title}`,
          narrative: `${actor?.fullName ?? "A pessoa responsável"} iniciou a execução da tarefa “${task.title}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id }
            : item),
          response: `Tarefa “${task.title}” iniciada.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_started" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_READY_FOR_APPROVAL") {
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || operation.name !== proposal.operationName || task.title !== proposal.title
          || task.assigneeId !== user.sub || task.status !== "IN_PROGRESS"
          || task.status !== proposal.expectedStatus || task.requiresApproval !== proposal.expectedRequiresApproval
          || !task.requiresApproval) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa mudou desde a prévia ou não exige aprovação. Nada foi enviado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }

        const checklist = task.mandatoryChecklist ?? [];
        const checklistSnapshot = checklist.map((item) => ({ id: item.id, completed: item.completed }))
          .sort((a, b) => a.id.localeCompare(b.id));
        const expectedChecklist = Array.isArray(proposal.expectedMandatoryChecklist)
          ? proposal.expectedMandatoryChecklist
            .map((item) => ({ id: String(item.id), completed: item.completed === true }))
            .sort((a, b) => a.id.localeCompare(b.id))
          : null;
        const requiredEvidence = task.mandatoryEvidences ?? [];
        const evidenceIds = requiredEvidence.map((item) => item.id).sort();
        const expectedEvidenceIds = Array.isArray(proposal.expectedMandatoryEvidenceIds)
          ? [...proposal.expectedMandatoryEvidenceIds].map(String).sort()
          : null;
        const uploaded = requiredEvidence.length
          ? await tx.select({ refId: taskEvidencesTable.mandatoryEvidenceRefId })
            .from(taskEvidencesTable)
            .where(and(
              eq(taskEvidencesTable.taskId, task.id),
              eq(taskEvidencesTable.isRequired, true),
              eq(taskEvidencesTable.active, true),
            ))
            .for("share")
          : [];
        const requiredIdSet = new Set(evidenceIds);
        const fulfilledIds = uploaded.map((item) => item.refId)
          .filter((id): id is string => id !== null && requiredIdSet.has(id))
          .sort();
        const expectedFulfilledIds = Array.isArray(proposal.fulfilledEvidenceIds)
          ? [...proposal.fulfilledEvidenceIds].map(String).sort()
          : null;
        const requirementsUnchanged = expectedChecklist !== null
          && JSON.stringify(checklistSnapshot) === JSON.stringify(expectedChecklist)
          && expectedEvidenceIds !== null
          && JSON.stringify(evidenceIds) === JSON.stringify(expectedEvidenceIds)
          && expectedFulfilledIds !== null
          && JSON.stringify(fulfilledIds) === JSON.stringify(expectedFulfilledIds);
        const missingChecklist = checklist.filter((item) => !item.completed);
        const fulfilledSet = new Set(fulfilledIds);
        const missingEvidence = requiredEvidence.filter((item) => !fulfilledSet.has(item.id));
        if (!requirementsUnchanged || missingChecklist.length || missingEvidence.length) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "Checklist ou evidências mudaram ou estão incompletos. Nada foi enviado; conclua os itens pendentes e prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }

        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        const [updated] = await tx.update(tasksTable).set({ status: "READY_FOR_APPROVAL", updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível enviar a tarefa para aprovação");
        await writeHistoryEvent({
          category: "TASK", action: "task.ready_for_approval", title: `Tarefa pronta para aprovação: ${task.title}`,
          narrative: `${actor?.fullName ?? "A pessoa responsável"} enviou a tarefa “${task.title}” para aprovação.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id }
            : item),
          response: `Tarefa “${task.title}” enviada para aprovação.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_ready_for_approval" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_COMPLETE") {
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || operation.name !== proposal.operationName || task.title !== proposal.title
          || task.assigneeId !== user.sub || task.status !== "IN_PROGRESS"
          || task.status !== proposal.expectedStatus || task.requiresApproval !== false
          || task.responsibilityId !== (proposal.responsibilityId ?? null)
          || task.dueDate !== (proposal.dueDate ?? null) || task.priority !== proposal.priority
          || task.description !== (proposal.description ?? null)) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A tarefa mudou desde a prévia ou exige aprovação. Nada foi concluído; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const checklist = task.mandatoryChecklist ?? [];
        const checklistSnapshot = checklist.map((item) => ({ id: item.id, completed: item.completed }))
          .sort((a, b) => a.id.localeCompare(b.id));
        const expectedChecklist = Array.isArray(proposal.expectedMandatoryChecklist)
          ? proposal.expectedMandatoryChecklist
            .map((item) => ({ id: String(item.id), completed: item.completed === true }))
            .sort((a, b) => a.id.localeCompare(b.id))
          : null;
        const requiredEvidence = task.mandatoryEvidences ?? [];
        const evidenceIds = requiredEvidence.map((item) => item.id).sort();
        const expectedEvidenceIds = Array.isArray(proposal.expectedMandatoryEvidenceIds)
          ? [...proposal.expectedMandatoryEvidenceIds].map(String).sort()
          : null;
        const uploaded = requiredEvidence.length
          ? await tx.select({ refId: taskEvidencesTable.mandatoryEvidenceRefId })
            .from(taskEvidencesTable)
            .where(and(
              eq(taskEvidencesTable.taskId, task.id),
              eq(taskEvidencesTable.isRequired, true),
              eq(taskEvidencesTable.active, true),
            ))
            .for("share")
          : [];
        const requiredIdSet = new Set(evidenceIds);
        const fulfilledIds = uploaded.map((item) => item.refId)
          .filter((id): id is string => id !== null && requiredIdSet.has(id))
          .sort();
        const expectedFulfilledIds = Array.isArray(proposal.fulfilledEvidenceIds)
          ? [...proposal.fulfilledEvidenceIds].map(String).sort()
          : null;
        const missingChecklist = checklist.some((item) => !item.completed);
        const fulfilledSet = new Set(fulfilledIds);
        const missingEvidence = requiredEvidence.some((item) => !fulfilledSet.has(item.id));
        const requirementsUnchanged = expectedChecklist !== null
          && JSON.stringify(checklistSnapshot) === JSON.stringify(expectedChecklist)
          && expectedEvidenceIds !== null
          && JSON.stringify(evidenceIds) === JSON.stringify(expectedEvidenceIds)
          && expectedFulfilledIds !== null
          && JSON.stringify(fulfilledIds) === JSON.stringify(expectedFulfilledIds);
        if (!requirementsUnchanged || missingChecklist || missingEvidence) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "Checklist ou evidências mudaram ou estão incompletos. Nada foi concluído; atualize os itens e prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const [actor] = await tx.select({ fullName: usersTable.fullName }).from(usersTable)
          .where(eq(usersTable.id, user.sub)).for("share").limit(1);
        const [updated] = await tx.update(tasksTable).set({
          status: "COMPLETED", completedAt: new Date(), updatedAt: new Date(),
        }).where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível concluir a tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.completed", title: `Tarefa concluída: ${task.title}`,
          narrative: `${actor?.fullName ?? "A pessoa responsável"} concluiu a tarefa “${task.title}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal
            ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id }
            : item),
          response: `Tarefa “${task.title}” concluída.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_completed" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_CREATE") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const title = String(proposal.title ?? "").trim();
        const assigneeId = String(proposal.assigneeId ?? "");
        const dueDate = String(proposal.dueDate ?? "");
        const priority = String(proposal.priority ?? "MEDIUM");
        const description = proposal.description === undefined || proposal.description === null
          ? null : typeof proposal.description === "string" ? proposal.description.trim() : "invalid";
        const rawChecklist = proposal.checklistLabels;
        const checklistLabels = rawChecklist === undefined ? []
          : Array.isArray(rawChecklist) ? rawChecklist.map((item) => typeof item === "string" ? item.trim() : "") : null;
        const rawMandatoryEvidences = proposal.mandatoryEvidences;
        const mandatoryEvidences = rawMandatoryEvidences === undefined ? []
          : Array.isArray(rawMandatoryEvidences) ? rawMandatoryEvidences.map((item) => ({
            type: typeof item?.type === "string" ? item.type : "",
            description: typeof item?.description === "string" ? item.description.trim() : "",
          })) : null;
        if (!title || title.length > 160 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
          || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)
          || description === "invalid" || description === "" || (description !== null && description.length > 2000)
          || checklistLabels === null || checklistLabels.length > 12
          || checklistLabels.some((label) => !label || label.length > 160)
          || new Set(checklistLabels.map(normalizeAsaText)).size !== checklistLabels.length
          || mandatoryEvidences === null || mandatoryEvidences.length > 12
          || mandatoryEvidences.some((item) => !(ASA_TASK_EVIDENCE_TYPES as readonly string[]).includes(item.type)
            || !item.description || item.description.length > 180)
          || new Set(mandatoryEvidences.map((item) => `${item.type}:${normalizeAsaText(item.description)}`)).size !== mandatoryEvidences.length) return { status: "stale" as const };
        const [assignee] = await tx.select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .innerJoin(userRolesTable, and(eq(userRolesTable.userId, usersTable.id), eq(userRolesTable.operationId, operationId), eq(userRolesTable.active, true)))
          .where(and(eq(usersTable.id, assigneeId), eq(usersTable.organizationId, user.organizationId!), ne(usersTable.status, "INACTIVE")))
          .for("share")
          .limit(1);
        if (!assignee || assignee.name !== proposal.assigneeName) return { status: "stale" as const };
        const responsibilityId = proposal.responsibilityId === null || proposal.responsibilityId === undefined
          ? null : String(proposal.responsibilityId);
        let linkedResponsibility: typeof responsibilitiesTable.$inferSelect | null = null;
        if (responsibilityId) {
          const [responsibility] = await tx.select().from(responsibilitiesTable).where(and(
            eq(responsibilitiesTable.id, responsibilityId),
            eq(responsibilitiesTable.orgId, user.organizationId!),
            eq(responsibilitiesTable.active, true),
            or(eq(responsibilitiesTable.operationId, operationId), isNull(responsibilitiesTable.operationId)),
          )).for("update").limit(1);
          if (!responsibility || responsibility.title !== proposal.responsibilityTitle
            || responsibility.operationId !== (proposal.responsibilityOperationId ?? null)
            || responsibility.areaId !== (proposal.responsibilityAreaId ?? null)) return { status: "stale" as const };
          linkedResponsibility = responsibility;
        } else if (proposal.responsibilityTitle !== null && proposal.responsibilityTitle !== undefined) {
          return { status: "stale" as const };
        }
        const areaId = await resolveTaskAreaId(linkedResponsibility?.id, assignee.id, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const [task] = await tx.insert(tasksTable).values({
          organizationId: user.organizationId!,
          operationId,
          responsibilityId: linkedResponsibility?.id ?? null,
          title,
          description,
          creatorId: user.sub,
          assigneeId: assignee.id,
          requiresApproval: true,
          priority: priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          status: "CREATED",
          dueDate,
          mandatoryChecklist: checklistLabels.map((label) => ({ id: randomUUID(), label, completed: false })),
          mandatoryEvidences: mandatoryEvidences.map((item) => ({ id: randomUUID(), type: item.type, description: item.description })),
          origin: "ASA",
        }).returning();
        if (!task) throw new Error("Não foi possível criar a tarefa");
        await writeHistoryEvent({
          category: "TASK",
          action: "task.created",
          title: `Tarefa criada: ${task.title}`,
          narrative: `${assignee.name} recebeu a tarefa "${task.title}" com prioridade ${priority} e prazo ${dueDate}${linkedResponsibility ? ` vinculada à responsabilidade “${linkedResponsibility.title}”` : ""}${task.description ? ` e descrição: ${task.description}` : ""}${checklistLabels.length ? ` e ${checklistLabels.length} item(ns) obrigatório(s) na checklist` : ""}${mandatoryEvidences.length ? ` e ${mandatoryEvidences.length} evidência(s) obrigatória(s)` : ""}.`,
          entityType: "task",
          entityId: task.id,
          actorId: user.sub,
          actorType: "HUMAN",
          operationId,
          orgId: user.organizationId!,
          beforeState: null,
          afterState: task,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt, resultId: task.id }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: `Tarefa criada: ${task.title}. A conclusão deverá passar por aprovação.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_created" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_UPDATE_DUE_DATE") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.dueDate !== proposal.expectedDueDate
          || task.assigneeId !== proposal.assigneeId || task.responsibilityId !== (proposal.responsibilityId ?? null)
          || task.status !== proposal.expectedStatus
          || ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "A tarefa mudou ou foi encerrada desde a prévia. Nenhuma alteração foi feita; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const dueDate = String(proposal.dueDate ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { status: "stale" as const };
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const [updated] = await tx.update(tasksTable).set({ dueDate, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar o prazo da tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Prazo atualizado: ${task.title}`,
          narrative: `Prazo da tarefa “${task.title}” alterado de ${task.dueDate} para ${updated.dueDate}.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Prazo da tarefa “${task.title}” atualizado para ${updated.dueDate}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_due_date_updated" as const, taskId: task.id, title: task.title, dueDate: updated.dueDate };
      }

      if (proposal.actionType === "TASK_UPDATE_ASSIGNEE") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.assigneeId !== proposal.expectedAssigneeId
          || task.responsibilityId !== (proposal.responsibilityId ?? null)
          || task.dueDate !== proposal.dueDate || task.status !== proposal.expectedStatus
          || !["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"].includes(task.status)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "A tarefa mudou ou foi encerrada desde a prévia. Nenhuma alteração foi feita; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const [assignee] = await tx.select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .innerJoin(userRolesTable, and(
            eq(userRolesTable.userId, usersTable.id),
            eq(userRolesTable.operationId, operationId),
            eq(userRolesTable.active, true),
          ))
          .where(and(
            eq(usersTable.id, String(proposal.assigneeId ?? "")),
            eq(usersTable.organizationId, user.organizationId!),
            eq(usersTable.status, "ACTIVE"),
            eq(usersTable.name, String(proposal.assigneeName ?? "")),
          )).for("share").limit(1);
        if (!assignee) {
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item),
            response: "A pessoa escolhida deixou de ter vínculo ativo na operação desde a prévia. Nenhuma alteração foi feita; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const currentAreaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        const targetAreaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, assignee.id, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, currentAreaId, tx))
          || !(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, targetAreaId, tx))) return { status: "forbidden" as const };
        const [updated] = await tx.update(tasksTable).set({ assigneeId: assignee.id, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar o responsável da tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Responsável atualizado: ${task.title}`,
          narrative: `Responsável da tarefa “${task.title}” alterado de ${String(proposal.previousAssigneeName ?? "Responsável atual")} para ${assignee.name}.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Responsável da tarefa “${task.title}” atualizado para ${assignee.name}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_assignee_updated" as const, taskId: task.id, title: task.title, assigneeName: assignee.name };
      }

      if (proposal.actionType === "TASK_UPDATE_PRIORITY") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.priority !== proposal.expectedPriority
          || task.assigneeId !== proposal.assigneeId || task.responsibilityId !== (proposal.responsibilityId ?? null)
          || task.dueDate !== proposal.dueDate || task.status !== proposal.expectedStatus
          || !["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"].includes(task.status)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "A tarefa mudou ou foi encerrada desde a prévia. Nenhuma alteração foi feita; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const priority = String(proposal.priority ?? "");
        if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) return { status: "stale" as const };
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const [updated] = await tx.update(tasksTable).set({ priority: priority as typeof task.priority, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar a prioridade da tarefa");
        const priorityLabels = { LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" } as const;
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Prioridade atualizada: ${task.title}`,
          narrative: `Prioridade da tarefa “${task.title}” alterada de ${priorityLabels[task.priority]} para ${priorityLabels[updated.priority]}.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Prioridade da tarefa “${task.title}” atualizada para ${priorityLabels[updated.priority]}.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_priority_updated" as const, taskId: task.id, title: task.title, priority: updated.priority };
      }

      if (proposal.actionType === "TASK_UPDATE_RESPONSIBILITY") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId), eq(tasksTable.organizationId, user.organizationId!), eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.assigneeId !== proposal.assigneeId
          || task.status !== "CREATED" || task.status !== proposal.expectedStatus
          || task.responsibilityId !== (proposal.previousResponsibilityId ?? null)
          || task.updatedAt.toISOString() !== proposal.expectedUpdatedAt) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({ actionsExecuted: updatedActions,
            response: "A tarefa mudou ou foi iniciada desde a prévia. Nada foi alterado; prepare uma nova prévia." })
            .where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const evidence = await tx.select({ id: taskEvidencesTable.id }).from(taskEvidencesTable)
          .where(eq(taskEvidencesTable.taskId, task.id)).limit(1);
        if (evidence.length) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({ actionsExecuted: updatedActions,
            response: "Uma evidência foi anexada desde a prévia. Nada foi alterado; prepare uma nova prévia." })
            .where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const responsibilityIds = [...new Set([proposal.previousResponsibilityId, proposal.newResponsibilityId]
          .filter((id): id is string => typeof id === "string"))].sort();
        const lockedResponsibilities = responsibilityIds.length ? await tx.select({
          id: responsibilitiesTable.id, title: responsibilitiesTable.title, areaId: responsibilitiesTable.areaId,
          operationId: responsibilitiesTable.operationId, updatedAt: responsibilitiesTable.updatedAt, active: responsibilitiesTable.active,
        }).from(responsibilitiesTable).where(and(
          inArray(responsibilitiesTable.id, responsibilityIds), eq(responsibilitiesTable.orgId, user.organizationId!),
        )).orderBy(responsibilitiesTable.id).for("update") : [];
        const previousId = typeof proposal.previousResponsibilityId === "string" ? proposal.previousResponsibilityId : null;
        const newId = typeof proposal.newResponsibilityId === "string" ? proposal.newResponsibilityId : null;
        const previous = previousId ? lockedResponsibilities.find((item) => item.id === previousId) ?? null : null;
        const target = newId ? lockedResponsibilities.find((item) => item.id === newId) ?? null : null;
        const validResponsibility = (item: typeof lockedResponsibilities[number] | null, title: unknown, updatedAt: unknown) =>
          item !== null && item.active && (item.operationId === null || item.operationId === operationId)
          && item.title === title && item.updatedAt.toISOString() === updatedAt;
        if ((previousId && !validResponsibility(previous, proposal.previousResponsibilityTitle, proposal.previousResponsibilityUpdatedAt))
          || (newId && !validResponsibility(target, proposal.newResponsibilityTitle, proposal.newResponsibilityUpdatedAt))
          || (!previousId && proposal.previousResponsibilityTitle !== null)
          || (!newId && proposal.newResponsibilityTitle !== null)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({ actionsExecuted: updatedActions,
            response: "Uma responsabilidade foi alterada ou deixou de estar ativa desde a prévia. Nada foi feito; prepare uma nova prévia." })
            .where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const responsibilityAreaIds = [...new Set([previous?.areaId, target?.areaId]
          .filter((id): id is string => typeof id === "string"))].sort();
        const activeAreas = responsibilityAreaIds.length ? await tx.select({ id: areasTable.id })
          .from(areasTable).where(and(
            inArray(areasTable.id, responsibilityAreaIds), eq(areasTable.organizationId, user.organizationId!), eq(areasTable.active, true),
          )).orderBy(areasTable.id).for("update") : [];
        if (activeAreas.length !== responsibilityAreaIds.length) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({ actionsExecuted: updatedActions,
            response: "A área de uma responsabilidade deixou de estar ativa nesta organização. Nada foi feito; prepare uma nova prévia." })
            .where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const oldAreaId = await resolveTaskAreaId(previousId ?? undefined, task.assigneeId, user.organizationId!, tx);
        const newAreaId = target?.areaId ?? await resolveTaskAreaId(undefined, task.assigneeId, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, oldAreaId, tx))
          || !(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, newAreaId, tx))) return { status: "forbidden" as const };
        const [updated] = await tx.update(tasksTable).set({ responsibilityId: newId, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar a responsabilidade da tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Responsabilidade atualizada: ${task.title}`,
          narrative: `Responsabilidade da tarefa “${task.title}” alterada de “${previous?.title ?? "nenhuma"}” para “${target?.title ?? "nenhuma"}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Responsabilidade da tarefa “${task.title}” atualizada.`, confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_responsibility_updated" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_UPDATE_REQUIREMENTS") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.assigneeId !== proposal.assigneeId
          || task.responsibilityId !== (proposal.responsibilityId ?? null) || task.status !== "CREATED"
          || JSON.stringify(task.mandatoryChecklist ?? []) !== JSON.stringify(proposal.previousMandatoryChecklist)
          || JSON.stringify(task.mandatoryEvidences ?? []) !== JSON.stringify(proposal.previousMandatoryEvidences)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "A tarefa ou seus requisitos mudaram desde a prévia. Nada foi alterado; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const attached = await tx.select({ id: taskEvidencesTable.id }).from(taskEvidencesTable)
          .where(eq(taskEvidencesTable.taskId, task.id)).limit(1);
        if (attached.length) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "Uma evidência foi anexada desde a prévia. Nada foi alterado; requisitos com evidências vinculadas não podem ser substituídos.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const rawChecklist = proposal.checklistLabels;
        const rawEvidences = proposal.mandatoryEvidences;
        if (!Array.isArray(rawChecklist) || rawChecklist.length > 12
          || rawChecklist.some((label) => typeof label !== "string" || !label.trim() || label.trim().length > 160)
          || new Set(rawChecklist.map((label) => normalizeAsaText(String(label)))).size !== rawChecklist.length
          || !Array.isArray(rawEvidences) || rawEvidences.length > 12
          || rawEvidences.some((item) => !item || !(ASA_TASK_EVIDENCE_TYPES as readonly string[]).includes(String(item.type))
            || typeof item.description !== "string" || !item.description.trim() || item.description.trim().length > 180)
          || new Set(rawEvidences.map((item) => `${item.type}:${normalizeAsaText(item.description)}`)).size !== rawEvidences.length) {
          return { status: "stale" as const };
        }
        const oldChecklist = task.mandatoryChecklist ?? [];
        const oldEvidences = task.mandatoryEvidences ?? [];
        const checklistByLabel = new Map(oldChecklist.map((item) => [normalizeAsaText(item.label), item]));
        const evidenceByKey = new Map(oldEvidences.map((item) => [`${item.type}:${normalizeAsaText(item.description)}`, item]));
        const mandatoryChecklist = rawChecklist.map((value) => {
          const label = String(value).trim();
          const existing = checklistByLabel.get(normalizeAsaText(label));
          return existing ? { ...existing, label } : { id: randomUUID(), label, completed: false };
        });
        const mandatoryEvidences = rawEvidences.map((item) => {
          const type = String(item.type);
          const description = String(item.description).trim();
          const existing = evidenceByKey.get(`${type}:${normalizeAsaText(description)}`);
          return { id: existing?.id ?? randomUUID(), type, description };
        });
        const [updated] = await tx.update(tasksTable).set({ mandatoryChecklist, mandatoryEvidences, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar os requisitos da tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Requisitos atualizados: ${task.title}`,
          narrative: `Checklist e evidências obrigatórias da tarefa “${task.title}” foram atualizadas.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Requisitos da tarefa “${task.title}” atualizados.`, confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_requirements_updated" as const, taskId: task.id, title: task.title };
      }

      if (proposal.actionType === "TASK_UPDATE_TITLE") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.previousTitle || task.title !== proposal.title
          || task.description !== (proposal.expectedDescription ?? null)
          || task.priority !== proposal.priority || task.assigneeId !== proposal.assigneeId
          || task.responsibilityId !== (proposal.responsibilityId ?? null) || task.dueDate !== proposal.dueDate
          || task.status !== proposal.expectedStatus
          || !["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"].includes(task.status)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "A tarefa mudou ou foi encerrada desde a prévia. Nenhuma alteração foi feita; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const newTitle = String(proposal.newTitle ?? "").trim();
        if (!newTitle || newTitle.length > 160 || normalizeAsaText(newTitle) === normalizeAsaText(task.title)) return { status: "stale" as const };
        const openTasks = await tx.select({ id: tasksTable.id, title: tasksTable.title }).from(tasksTable).where(and(
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"]),
        ));
        if (openTasks.some((candidate) => candidate.id !== task.id && normalizeAsaText(candidate.title) === normalizeAsaText(newTitle))) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "Já existe uma tarefa aberta com esse título. Nenhuma alteração foi feita; prepare uma nova proposta.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const [updated] = await tx.update(tasksTable).set({ title: newTitle, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar o título da tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Título atualizado: ${task.title}`,
          narrative: `Título da tarefa alterado de “${task.title}” para “${updated.title}”.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Título da tarefa atualizado para “${updated.title}”.`, confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_title_updated" as const, taskId: task.id, title: updated.title };
      }

      if (proposal.actionType === "TASK_UPDATE_DESCRIPTION") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        const taskId = String(proposal.taskId ?? "");
        const [task] = await tx.select().from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, user.organizationId!),
          eq(tasksTable.operationId, operationId),
        )).for("update").limit(1);
        if (!task || task.title !== proposal.title || task.description !== (proposal.expectedDescription ?? null)
          || task.priority !== proposal.priority || task.assigneeId !== proposal.assigneeId
          || task.responsibilityId !== (proposal.responsibilityId ?? null) || task.dueDate !== proposal.dueDate
          || task.status !== proposal.expectedStatus
          || !["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"].includes(task.status)) {
          const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
          await tx.update(asaAuditLogTable).set({
            actionsExecuted: updatedActions,
            response: "A tarefa mudou ou foi encerrada desde a prévia. Nenhuma alteração foi feita; prepare uma nova prévia.",
          }).where(eq(asaAuditLogTable.id, audit.id));
          return { status: "stale" as const };
        }
        const description = String(proposal.description ?? "").trim();
        if (!description || description.length > 2000) return { status: "stale" as const };
        const areaId = await resolveTaskAreaId(task.responsibilityId ?? undefined, task.assigneeId, user.organizationId!, tx);
        if (!(await canManageTasks(user.sub, currentRole, operationId, user.organizationId!, areaId, tx))) return { status: "forbidden" as const };
        const [updated] = await tx.update(tasksTable).set({ description, updatedAt: new Date() })
          .where(eq(tasksTable.id, task.id)).returning();
        if (!updated) throw new Error("Não foi possível atualizar a descrição da tarefa");
        await writeHistoryEvent({
          category: "TASK", action: "task.updated", title: `Descrição atualizada: ${task.title}`,
          narrative: `Descrição da tarefa “${task.title}” atualizada.`,
          entityType: "task", entityId: task.id, actorId: user.sub, actorType: "HUMAN",
          operationId, orgId: user.organizationId!, beforeState: task, afterState: updated,
          metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
        }, tx as any);
        const confirmedAt = new Date().toISOString();
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt, resultId: task.id } : item),
          response: `Descrição da tarefa “${task.title}” atualizada.`, confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_description_updated" as const, taskId: task.id, title: task.title };
      }

      const currentRecipients = await tx.select({ userId: userRolesTable.userId })
        .from(userRolesTable)
        .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
        .where(and(
          eq(userRolesTable.operationId, operationId),
          eq(userRolesTable.active, true),
          eq(usersTable.organizationId, user.organizationId!),
          eq(usersTable.status, "ACTIVE"),
        )).for("share");
      const recipientIds = [...new Set(currentRecipients.map((row) => row.userId))].sort();
      const previewRecipientIds = Array.isArray(proposal.recipientUserIds)
        ? (proposal.recipientUserIds as unknown[]).filter((id): id is string => typeof id === "string").sort()
        : [];
      if (operation.name !== proposal.operationName || JSON.stringify(recipientIds) !== JSON.stringify(previewRecipientIds)) {
        const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "STALE" } : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: "A operação ou seu público mudou desde a prévia. Nenhum aviso foi criado; prepare uma nova prévia.",
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "stale" as const };
      }

      const [notice] = await tx.insert(noticesTable).values({
        authorId: user.sub,
        operationId,
        title: String(proposal.title),
        content: String(proposal.content),
        urgency: "IMPORTANT",
        type: "INFORMATIVE",
        status: "DRAFT",
        requiresConfirmation: false,
      }).returning();
      if (!notice) throw new Error("Não foi possível criar o rascunho");
      await tx.insert(noticeRecipientsTable).values(recipientIds.map((userId) => ({
        noticeId: notice.id, userId, groupId: null, status: "PENDING" as const,
      })));
      await writeHistoryEvent({
        category: "NOTICE",
        action: "created",
        title: "Aviso criado",
        narrative: `Rascunho de aviso criado: ${notice.title ?? "sem título"}.`,
        entityType: "notice",
        entityId: notice.id,
        actorId: user.sub,
        actorType: "HUMAN",
        operationId,
        orgId: user.organizationId!,
        beforeState: null,
        afterState: notice,
        metadata: { source: "ASA_CONFIRMED_PROPOSAL", proposalId: audit.id },
      }, tx as any);

      const completedAt = new Date().toISOString();
      const updatedActions = actions.map((item) => item === proposal
        ? { ...item, state: "CONFIRMED", confirmedAt: completedAt, resultId: notice.id }
        : item);
      await tx.update(asaAuditLogTable).set({
        actionsExecuted: updatedActions,
        response: `Rascunho de aviso criado: ${notice.title}. Ele não foi publicado.`,
        confirmedByUser: true,
      }).where(eq(asaAuditLogTable.id, audit.id));
      return { status: "created" as const, noticeId: notice.id, title: notice.title };
    });

    if (result.status === "not_found") { res.status(404).json({ error: "Proposta não encontrada" }); return; }
    if (result.status === "forbidden") { res.status(403).json({ error: "Operação ou ação fora do seu escopo" }); return; }
    if (result.status === "not_pending") { res.status(409).json({ error: "Esta proposta não está mais pendente" }); return; }
    if (result.status === "expired") { res.status(410).json({ error: "A prévia expirou. Nenhuma alteração foi aplicada." }); return; }
    if (result.status === "stale") { res.status(409).json({ error: "Os dados, a operação ou as permissões mudaram. Prepare uma nova prévia." }); return; }
    if (result.status === "asa_preferences_updated") {
      res.json({ success: true, message: `Preferências atualizadas: ${result.summary}.` });
      return;
    }
    if (result.status === "notice_draft_updated") {
      res.json({ success: true, noticeId: result.noticeId, message: `Rascunho de aviso “${result.title}” atualizado. Continua não publicado.` });
      return;
    }
    if (result.status === "agenda_draft_renamed") {
      eventBus.emit("agenda.event.changed", { eventId: result.eventId, changedFields: ["title"] });
      res.json({ success: true, eventId: result.eventId, message: `Rascunho de reunião renomeado para “${result.title}”. Continua não confirmado.` });
      return;
    }
    if (result.status === "agenda_draft_schedule_updated") {
      eventBus.emit("agenda.event.changed", { eventId: result.eventId, changedFields: ["date", "startTime", "endTime"] });
      res.json({ success: true, eventId: result.eventId, message: `Data e horário do rascunho “${result.title}” atualizados para ${result.date}, ${result.startTime}–${result.endTime}. Continua não confirmado.` });
      return;
    }
    if (result.status === "agenda_draft_notes_updated") {
      eventBus.emit("agenda.event.changed", { eventId: result.eventId, changedFields: ["notes"] });
      res.json({ success: true, eventId: result.eventId, message: `Observações do rascunho “${result.title}” ${result.notes === null ? "removidas" : "atualizadas"}. Continua não confirmado.` });
      return;
    }
    if (result.status === "agenda_meeting_created") {
      eventBus.emit("agenda.event.created", { eventId: result.eventId, operationId: result.operationId, type: "MEETING", date: result.date });
      if (result.proposed && result.areaId) {
        const supervisors = await db.select({ id: areaLocalSupervisorsTable.supervisorId })
          .from(areaLocalSupervisorsTable).innerJoin(areasTable, eq(areaLocalSupervisorsTable.areaId, areasTable.id))
          .where(and(eq(areaLocalSupervisorsTable.areaId, result.areaId), eq(areaLocalSupervisorsTable.active, true), eq(areasTable.organizationId, user.organizationId!)));
        const supervisorIds = [...new Set(supervisors.map((row) => row.id).filter((id) => id !== user.sub))];
        void notifyMany(supervisorIds, {
          type: "agenda.meeting.proposed", title: `Nova proposta de reunião: ${result.title}`,
          message: `Uma pessoa do elenco propôs ${result.date} das ${result.startTime} às ${result.endTime}. Revise a proposta na Agenda.`,
          priority: "NORMAL", category: "approval", entityType: "agenda_event", entityId: result.eventId, actionUrl: "/agenda",
        }).catch(() => undefined);
        res.json({ success: true, eventId: result.eventId, message: `Proposta de reunião “${result.title}” enviada para análise da Supervisão.` });
      } else {
        res.json({ success: true, eventId: result.eventId, message: `Rascunho da reunião “${result.title}” criado na Agenda; ainda não foi publicado.` });
      }
      return;
    }
    if (result.status === "message_direct_created") {
      void notifyMany([result.recipientUserId], {
        type: "message.new", title: "Nova mensagem",
        message: `${result.senderName}: ${result.content.slice(0, 80)}${result.content.length > 80 ? "…" : ""}`,
        priority: "NORMAL", category: "message", entityType: "thread", entityId: result.threadId,
        actionUrl: "/(tabs)/mensagens",
      }).catch(() => undefined);
      res.json({ success: true, threadId: result.threadId, messageId: result.messageId, message: `Mensagem enviada para ${result.recipientName}.` });
      return;
    }
    if (result.status === "message_direct_replied") {
      void notifyMany(result.recipientUserIds, {
        type: "message.new", title: "Nova mensagem",
        message: `${result.senderName}: ${result.content.slice(0, 80)}${result.content.length > 80 ? "…" : ""}`,
        priority: "NORMAL", category: "message", entityType: "thread", entityId: result.threadId,
        actionUrl: "/(tabs)/mensagens",
      }).catch(() => undefined);
      res.json({ success: true, threadId: result.threadId, messageId: result.messageId, message: `Resposta enviada na conversa “${result.title}”.` });
      return;
    }
    if (result.status === "mural_acknowledged") { res.json({ success: true, message: `Ciente registrado para “${result.title}”.` }); return; }
    if (result.status === "mural_reacted") { res.json({ success: true, message: `Reação de coração registrada em “${result.title}”.` }); return; }
    if (result.status === "mural_comment_created") { res.json({ success: true, message: `Comentário publicado em “${result.title}”.` }); return; }
    if (result.status === "task_created") { res.json({ success: true, taskId: result.taskId, message: `Tarefa “${result.title}” criada. A conclusão deverá passar por aprovação.` }); return; }
    if (result.status === "task_comment_created") { res.json({ success: true, taskId: result.taskId, message: `Comentário registrado na tarefa “${result.title}”.` }); return; }
    if (result.status === "task_evidence_link_added") { res.json({ success: true, taskId: result.taskId, message: `Link complementar anexado à tarefa “${result.title}”. Não conta como evidência obrigatória.` }); return; }
    if (result.status === "task_checklist_updated") { res.json({ success: true, taskId: result.taskId, message: `Item “${result.itemLabel}” da tarefa “${result.title}” marcado como ${result.completed ? "concluído" : "pendente"}.` }); return; }
    if (result.status === "task_cancelled") { res.json({ success: true, taskId: result.taskId, message: `Tarefa “${result.title}” cancelada.` }); return; }
    if (result.status === "task_started") { res.json({ success: true, taskId: result.taskId, message: `Tarefa “${result.title}” iniciada.` }); return; }
    if (result.status === "task_ready_for_approval") { res.json({ success: true, taskId: result.taskId, message: `Tarefa “${result.title}” enviada para aprovação.` }); return; }
    if (result.status === "task_completed") { res.json({ success: true, taskId: result.taskId, message: `Tarefa “${result.title}” concluída.` }); return; }
    if (result.status === "task_due_date_updated") { res.json({ success: true, taskId: result.taskId, message: `Prazo da tarefa “${result.title}” atualizado para ${result.dueDate}.` }); return; }
    if (result.status === "task_assignee_updated") { res.json({ success: true, taskId: result.taskId, message: `Responsável da tarefa “${result.title}” atualizado para ${result.assigneeName}.` }); return; }
    if (result.status === "task_priority_updated") { res.json({ success: true, taskId: result.taskId, message: `Prioridade da tarefa “${result.title}” atualizada para ${result.priority}.` }); return; }
    if (result.status === "task_description_updated") { res.json({ success: true, taskId: result.taskId, message: `Descrição da tarefa “${result.title}” atualizada.` }); return; }
    if (result.status === "task_title_updated") { res.json({ success: true, taskId: result.taskId, message: `Título da tarefa atualizado para “${result.title}”.` }); return; }
    if (result.status === "task_requirements_updated") { res.json({ success: true, taskId: result.taskId, message: `Checklist e evidências obrigatórias da tarefa “${result.title}” atualizadas.` }); return; }
    if (result.status === "task_responsibility_updated") { res.json({ success: true, taskId: result.taskId, message: `Responsabilidade da tarefa “${result.title}” atualizada.` }); return; }
    res.json({ success: true, noticeId: result.noticeId, message: `Rascunho “${result.title ?? "Aviso"}” criado sem publicação.` });
  } catch {
    res.status(500).json({ error: "Não consegui confirmar a proposta. Nenhuma alteração foi concluída." });
  }
});

router.post("/asa/actions/:proposalId/cancel", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const proposalId = String(req.params.proposalId);
  if (!/^[0-9a-f-]{36}$/i.test(proposalId)) { res.status(400).json({ error: "Proposta inválida" }); return; }
  const result = await db.transaction(async (tx) => {
    const [audit] = await tx.select().from(asaAuditLogTable).where(and(
      eq(asaAuditLogTable.id, proposalId),
      eq(asaAuditLogTable.userId, user.sub),
      eq(asaAuditLogTable.organizationId, user.organizationId!),
    )).for("update").limit(1);
    if (!audit) return "not_found" as const;
    const actions = Array.isArray(audit.actionsExecuted) ? audit.actionsExecuted : [];
      const proposal = actions.find((item) => item.action === "ASA_ACTION_PROPOSAL" && ASA_PROPOSAL_ACTION_TYPES.has(String(item.actionType)));
    if (!proposal || audit.confirmedByUser || proposal.state !== "PENDING") return "not_pending" as const;
    if ((proposal.actionType === "NOTICE_DRAFT_CREATE" || proposal.actionType === "NOTICE_DRAFT_UPDATE")
      && !MANAGER_ROLES.includes(user.role)) return "forbidden" as const;
    if (proposal.actionType !== "ASA_PREFERENCE_UPDATE" && proposal.actionType !== "MURAL_ACK" && proposal.actionType !== "MURAL_REACT" && proposal.actionType !== "MURAL_COMMENT_CREATE" && proposal.actionType !== "TASK_COMMENT_CREATE" && proposal.actionType !== "TASK_EVIDENCE_LINK_ADD" && proposal.actionType !== "TASK_CHECKLIST_UPDATE" && proposal.actionType !== "MESSAGE_DIRECT_CREATE" && proposal.actionType !== "MESSAGE_REPLY" && proposal.actionType !== "TASK_START"
      && proposal.actionType !== "TASK_READY_FOR_APPROVAL" && proposal.actionType !== "TASK_COMPLETE" && proposal.actionType !== "AGENDA_MEETING_CREATE" && proposal.actionType !== "AGENDA_DRAFT_RENAME" && proposal.actionType !== "AGENDA_DRAFT_SCHEDULE_UPDATE" && proposal.actionType !== "AGENDA_DRAFT_NOTES_UPDATE" && !TASK_MANAGER_ROLES.includes(user.role)) return "forbidden" as const;
    const updatedActions = actions.map((item) => item === proposal ? { ...item, state: "CANCELLED", cancelledAt: new Date().toISOString() } : item);
    await tx.update(asaAuditLogTable).set({
      actionsExecuted: updatedActions,
      response: "Proposta cancelada pela pessoa. Nenhuma alteração foi feita.",
    }).where(eq(asaAuditLogTable.id, audit.id));
    return "cancelled" as const;
  });
  if (result === "not_found") { res.status(404).json({ error: "Proposta não encontrada" }); return; }
  if (result === "forbidden") { res.status(403).json({ error: "Apenas gestores podem cancelar esta proposta" }); return; }
  if (result === "not_pending") { res.status(409).json({ error: "Esta proposta não está mais pendente" }); return; }
  res.json({ success: true, message: "Proposta cancelada. Nenhuma alteração foi feita." });
});

// ────────────────────────────────────────────────────────────────────────────
// Memories
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/memories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const { type, status } = req.query as { type?: string; status?: string };

  const rows = await db
    .select()
    .from(asaMemoriesTable)
    .where(eq(asaMemoriesTable.organizationId, user.organizationId!))
    .orderBy(desc(asaMemoriesTable.createdAt));

  const filtered = rows.filter(r => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    return canReadAsaMemory(user.sub, user.role, r);
  });

  res.json(filtered);
});

router.post("/asa/memories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const { type, key, value } = req.body as {
    type: "PERSONAL" | "OPERATIONAL" | "OFFICIAL";
    key: string;
    value: string;
  };

  if (!["PERSONAL", "OPERATIONAL", "OFFICIAL"].includes(type)
    || typeof key !== "string" || !key.trim() || key.trim().length > 120
    || typeof value !== "string" || !value.trim() || value.trim().length > 2000) {
    res.status(400).json({ error: "Tipo, chave ou conteúdo inválido" });
    return;
  }
  if (type !== "PERSONAL" && !MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Somente gestores podem propor memórias compartilhadas" });
    return;
  }

  const mem = await db.transaction(async (tx) => {
    const [created] = await tx.insert(asaMemoriesTable).values({
      type,
      key: key.trim(),
      value: value.trim(),
      scope: type === "PERSONAL" ? user.sub : user.organizationId!,
      organizationId: user.organizationId!,
      createdBy: user.sub,
      status: "PENDING",
    }).returning();
    if (!created) throw new Error("Não foi possível criar a memória da ASA");

    await tx.insert(asaAuditLogTable).values({
      userId: user.sub,
      organizationId: user.organizationId!,
      question: "Proposta de memória da ASA",
      response: "Memória criada como pendente de aprovação.",
      toolsUsed: ["asa.memory.propose"],
      actionsExecuted: [{ action: "ASA_MEMORY_PROPOSED", memoryId: created.id, type }],
      confirmedByUser: false,
    });
    return created;
  });

  res.status(201).json(mem);
});

router.patch("/asa/memories/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const id = req.params["id"] as string;
  const { status, value } = req.body as { status?: "APPROVED" | "REJECTED" | "DISABLED"; value?: string };

  if (status !== undefined && !["APPROVED", "REJECTED", "DISABLED"].includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }
  if ((value === undefined && status === undefined) || (value !== undefined && status !== undefined)) {
    res.status(400).json({ error: "Edite o conteúdo e confirme a aprovação em pedidos separados." });
    return;
  }

  if (value !== undefined && (typeof value !== "string" || !value.trim() || value.trim().length > 2000)) {
    res.status(400).json({ error: "Conteúdo inválido" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [memory] = await tx.select().from(asaMemoriesTable).where(and(
      eq(asaMemoriesTable.id, id),
      eq(asaMemoriesTable.organizationId, user.organizationId!),
    )).for("update").limit(1);
    if (!memory) return { kind: "missing" as const };
    if (!canEditAsaMemory(user.sub, user.role, memory)
      || (status && !canApproveAsaMemory(user.sub, user.role, memory))) {
      return { kind: "forbidden" as const };
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) {
      updates.status = status;
      updates.approvedBy = status === "APPROVED" ? user.sub : null;
      updates.approvedAt = status === "APPROVED" ? new Date() : null;
    }
    if (value !== undefined) {
      updates.value = value.trim();
      if (!status) {
        updates.status = "PENDING";
        updates.approvedBy = null;
        updates.approvedAt = null;
      }
    }

    const [updated] = await tx.update(asaMemoriesTable)
      .set(updates as any)
      .where(and(eq(asaMemoriesTable.id, id), eq(asaMemoriesTable.organizationId, user.organizationId!)))
      .returning();
    if (!updated) return { kind: "missing" as const };

    await tx.insert(asaAuditLogTable).values({
      userId: user.sub,
      organizationId: user.organizationId!,
      question: status === "APPROVED" ? "Aprovação explícita de memória da ASA" : status === "REJECTED" ? "Rejeição de memória da ASA" : status === "DISABLED" ? "Desativação de memória da ASA" : "Edição de memória da ASA",
      response: status === "APPROVED" ? "Memória aprovada." : status === "REJECTED" ? "Memória rejeitada." : status === "DISABLED" ? "Memória desativada." : "Conteúdo atualizado e aprovação anterior removida.",
      toolsUsed: ["asa.memory.update"],
      actionsExecuted: [{ action: status === "APPROVED" ? "ASA_MEMORY_APPROVED" : status === "REJECTED" ? "ASA_MEMORY_REJECTED" : status === "DISABLED" ? "ASA_MEMORY_DISABLED" : "ASA_MEMORY_EDITED", memoryId: updated.id, type: updated.type }],
      confirmedByUser: status === "APPROVED" || status === "DISABLED",
    });
    return { kind: "updated" as const, memory: updated };
  });

  if (result.kind === "missing") {
    res.status(404).json({ error: "Memória não encontrada" });
    return;
  }
  if (result.kind === "forbidden") {
    res.status(403).json({ error: "Sem permissão para alterar esta memória" });
    return;
  }
  res.json(result.memory);
});

router.delete("/asa/memories/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const id = req.params["id"] as string;

  const result = await db.transaction(async (tx) => {
    const [mem] = await tx.select().from(asaMemoriesTable).where(and(
      eq(asaMemoriesTable.id, id),
      eq(asaMemoriesTable.organizationId, user.organizationId!),
    )).for("update").limit(1);
    if (!mem) return "missing" as const;
    if (!canDeleteAsaMemory(user.sub, user.role, mem)) return "forbidden" as const;

    await tx.delete(asaMemoriesTable).where(and(
      eq(asaMemoriesTable.id, id),
      eq(asaMemoriesTable.organizationId, user.organizationId!),
    ));
    await tx.insert(asaAuditLogTable).values({
      userId: user.sub,
      organizationId: user.organizationId!,
      question: "Remoção de memória da ASA",
      response: "Memória removida.",
      toolsUsed: ["asa.memory.delete"],
      actionsExecuted: [{ action: "ASA_MEMORY_DELETED", memoryId: mem.id, type: mem.type }],
      confirmedByUser: false,
    });
    return "deleted" as const;
  });
  if (result === "missing") {
    res.status(404).json({ error: "Memória não encontrada" });
    return;
  }
  if (result === "forbidden") {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  res.status(204).send();
});

// ────────────────────────────────────────────────────────────────────────────
// Preferences
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/proactive-suggestions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const [preferences] = await db.select({ mode: asaUserPreferencesTable.mode })
    .from(asaUserPreferencesTable)
    .where(eq(asaUserPreferencesTable.userId, user.sub))
    .limit(1);
  if (preferences?.mode !== "PROACTIVE") {
    res.json({ overdueCount: 0, dueTodayCount: 0, dueSoonCount: 0 });
    return;
  }

  const today = operationalDate();
  const dueSoonThrough = shiftOperationalDate(today, 3);
  const [summary] = await db.select({
    overdueCount: sql<number>`count(*) filter (where ${tasksTable.dueDate} < ${today})::int`,
    dueTodayCount: sql<number>`count(*) filter (where ${tasksTable.dueDate} = ${today})::int`,
    dueSoonCount: sql<number>`count(*) filter (where ${tasksTable.dueDate} > ${today} and ${tasksTable.dueDate} <= ${dueSoonThrough})::int`,
  }).from(tasksTable).where(and(
    eq(tasksTable.organizationId, user.organizationId!),
    eq(tasksTable.assigneeId, user.sub),
    inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
    lte(tasksTable.dueDate, dueSoonThrough),
  ));

  res.json({
    overdueCount: Number(summary?.overdueCount ?? 0),
    dueTodayCount: Number(summary?.dueTodayCount ?? 0),
    dueSoonCount: Number(summary?.dueSoonCount ?? 0),
  });
});

router.get("/asa/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  let [prefs] = await db
    .select()
    .from(asaUserPreferencesTable)
    .where(eq(asaUserPreferencesTable.userId, user.sub));

  if (!prefs) {
    [prefs] = await db.insert(asaUserPreferencesTable).values({
      userId: user.sub,
      mode: "BALANCED",
    }).returning();
  }

  res.json(prefs);
});

router.patch("/asa/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const parsed = parseAsaPreferencePatch(req.body);
  if (parsed.ok === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const updates = parsed.value;

  const [existing] = await db
    .select()
    .from(asaUserPreferencesTable)
    .where(eq(asaUserPreferencesTable.userId, user.sub));

  if (!existing) {
    const [created] = await db.insert(asaUserPreferencesTable).values({
      userId: user.sub,
      mode: "BALANCED",
      ...updates,
    }).returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(asaUserPreferencesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(asaUserPreferencesTable.userId, user.sub))
    .returning();

  res.json(updated);
});

// ────────────────────────────────────────────────────────────────────────────
// Mural da Equipe REST Endpoint
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/mural", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user   = req.user!;
  const orgId  = user.organizationId!;
  const today  = new Date();
  const mm     = String(today.getMonth() + 1).padStart(2, "0");
  const dd     = String(today.getDate()).padStart(2, "0");

  // Upcoming birthdays (next 30 days) from usersTable.birthDate
  const upcoming_birthdays: { name: string; date: string; daysUntil: number }[] = [];
  const allUsers = await db
    .select({ id: usersTable.id, name: usersTable.name, birthDate: usersTable.birthDate, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")))
    .limit(200);

  for (const u of allUsers) {
    if (!u.birthDate) continue;
    const bm = u.birthDate.slice(5, 7); const bd = u.birthDate.slice(8, 10);
    // Check next 30 days
    for (let offset = 0; offset <= 30; offset++) {
      const d = new Date(today); d.setDate(d.getDate() + offset);
      const cm = String(d.getMonth() + 1).padStart(2, "0");
      const cd = String(d.getDate()).padStart(2, "0");
      if (bm === cm && bd === cd) {
        upcoming_birthdays.push({ name: u.name, date: `${cd}/${cm}`, daysUntil: offset });
        break;
      }
    }
  }
  upcoming_birthdays.sort((a, b) => a.daysUntil - b.daysUntil);

  // Upcoming time-of-house milestones (next 30 days)
  const MILESTONE_MONTHS = [3, 6, 12, 24, 60, 120];
  const upcoming_milestones: { name: string; label: string; date: string; daysUntil: number }[] = [];
  for (const u of allUsers) {
    const joined = new Date(u.createdAt);
    for (let offset = 0; offset <= 30; offset++) {
      const d = new Date(today); d.setDate(d.getDate() + offset);
      if (joined.getDate() !== d.getDate() || joined.getMonth() !== d.getMonth()) continue;
      const totalMonths = (d.getFullYear() - joined.getFullYear()) * 12 + (d.getMonth() - joined.getMonth());
      if (MILESTONE_MONTHS.includes(totalMonths)) {
        const label = totalMonths < 12
          ? `${totalMonths} meses na equipe`
          : `${totalMonths / 12} ano${totalMonths / 12 > 1 ? "s" : ""} na equipe`;
        upcoming_milestones.push({ name: u.name, label, date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, daysUntil: offset });
      }
    }
  }
  upcoming_milestones.sort((a, b) => a.daysUntil - b.daysUntil);

  // Recent recognitions (last 15)
  const recent_recognitions = await db
    .select({
      id:          recognitionsTable.id,
      type:        recognitionsTable.type,
      title:       recognitionsTable.title,
      message:     recognitionsTable.message,
      publishedAt: recognitionsTable.publishedAt,
      memberName:  usersTable.name,
    })
    .from(recognitionsTable)
    .leftJoin(usersTable, eq(recognitionsTable.userId, usersTable.id))
    .where(eq(recognitionsTable.organizationId, orgId))
    .orderBy(desc(recognitionsTable.createdAt))
    .limit(15);

  // Recent published notices (last 8, across all operations of the org)
  const recentNoticesAlias = usersTable;
  const recent_notices = await db
    .select({
      id:          noticesTable.id,
      title:       noticesTable.title,
      content:     noticesTable.content,
      urgency:     noticesTable.urgency,
      publishedAt: noticesTable.publishedAt,
      authorName:  recentNoticesAlias.name,
    })
    .from(noticesTable)
    .innerJoin(operationsTable, eq(noticesTable.operationId, operationsTable.id))
    .leftJoin(recentNoticesAlias, eq(noticesTable.authorId, recentNoticesAlias.id))
    .where(and(
      eq(operationsTable.organizationId, orgId),
      eq(noticesTable.status, "PUBLISHED"),
    ))
    .orderBy(desc(noticesTable.publishedAt))
    .limit(8);

  // Members with overdue tasks (status pending + dueDate in the past)
  const todayStr = `${today.getFullYear()}-${mm}-${dd}`;
  const overdueRows = await db
    .select({
      assigneeId: tasksTable.assigneeId,
      name:       usersTable.name,
      status:     tasksTable.status,
      dueDate:    tasksTable.dueDate,
    })
    .from(tasksTable)
    .innerJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(eq(tasksTable.organizationId, orgId))
    .limit(500);

  const overdueCounts = new Map<string, { name: string; count: number }>();
  for (const t of overdueRows) {
    if (!["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(t.status)) continue;
    if (!(t.dueDate < todayStr)) continue;
    const entry = overdueCounts.get(t.assigneeId) ?? { name: t.name, count: 0 };
    entry.count += 1;
    overdueCounts.set(t.assigneeId, entry);
  }
  const overdue_members = [...overdueCounts.values()].sort((a, b) => b.count - a.count);

  res.json({ upcoming_birthdays, upcoming_milestones, recent_recognitions, recent_notices, overdue_members });
});

// ────────────────────────────────────────────────────────────────────────────
// Daily Summary REST Endpoint
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/resumo-do-dia", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const resumo = await assembleResumoDodia(user.sub, user.organizationId ?? null, user.role);
  res.json(resumo);
});

// ────────────────────────────────────────────────────────────────────────────
// Recognitions REST Endpoints
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/recognitions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const limit = parseInt(String(req.query.limit ?? "50"));
  const userId = req.query.userId as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(recognitionsTable.organizationId, user.organizationId!)];
  if (userId) conditions.push(eq(recognitionsTable.userId, userId));

  const recs = await db
    .select()
    .from(recognitionsTable)
    .where(and(...conditions))
    .orderBy(desc(recognitionsTable.createdAt))
    .limit(limit);

  res.json({ recognitions: recs });
});

router.post("/asa/recognitions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Apenas gestores podem criar reconhecimentos" });
    return;
  }

  const { userId, type, title, message } = req.body as { userId: string; type: string; title: string; message: string };
  if (!userId || !type || !title || !message) {
    res.status(400).json({ error: "BAD_REQUEST", message: "userId, type, title e message são obrigatórios" });
    return;
  }

  const [postTarget] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, user.organizationId!)))
    .limit(1);
  if (!postTarget) {
    res.status(404).json({ error: "NOT_FOUND", message: "Membro não encontrado nesta organização" });
    return;
  }

  const [rec] = await db.insert(recognitionsTable).values({
    organizationId: user.organizationId!,
    userId,
    type,
    title,
    message,
    createdBy: user.sub,
    publishedAt: new Date(),
  }).returning();

  try {
    await createNotification({
      userId,
      type:       "RECOGNITION_RECEIVED",
      title:      "🎉 Você recebeu um reconhecimento!",
      message:    title,
      priority:   "IMPORTANT",
      category:   "system",
      entityType: "recognition",
      entityId:   rec.id,
    });
  } catch (err) { console.error("Falha ao notificar reconhecimento", { targetUserId: userId, recognitionId: rec.id, err }); }

  res.status(201).json({ recognition: rec });
});

// ────────────────────────────────────────────────────────────────────────────
// Audit Log
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/audit", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Apenas gestores podem acessar o log de auditoria da ASA" });
    return;
  }

  const limit = parseInt(String(req.query.limit ?? "50"));
  const userId = req.query.userId as string | undefined;

  const conditions = [eq(asaAuditLogTable.organizationId, user.organizationId!)];
  if (userId) conditions.push(eq(asaAuditLogTable.userId, userId));

  const rows = await db
    .select()
    .from(asaAuditLogTable)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(asaAuditLogTable.createdAt))
    .limit(limit);

  res.json(rows);
});

router.get("/asa/library-gaps", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Apenas Administração pode consultar temas sem documento correspondente." });
    return;
  }
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db.select({ actionsExecuted: asaAuditLogTable.actionsExecuted, createdAt: asaAuditLogTable.createdAt })
    .from(asaAuditLogTable)
    .where(and(eq(asaAuditLogTable.organizationId, user.organizationId!), gte(asaAuditLogTable.createdAt, since)))
    .orderBy(desc(asaAuditLogTable.createdAt))
    .limit(5000);
  res.json({ signals: aggregateAsaLibraryGaps(rows, 50), windowDays: 90 });
});

export default router;
