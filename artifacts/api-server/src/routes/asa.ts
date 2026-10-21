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
  messagesTable,
  messageThreadsTable,
  messageThreadParticipantsTable,
  announcementCommentsTable,
  announcementsTable,
  announcementReadsTable,
  areaLocalSupervisorsTable,
  areasTable,
  locationsTable,
  libraryDocumentPageCitationsTable,
  libraryCategoriesTable,
  libraryViewsTable,
  userNotificationsTable,
  operationalGroupsTable,
  recurringActivitiesTable,
  recurringActivitySchedulesTable,
  recurringActivityAssigneesTable,
} from "@workspace/db";
import { resolveScaleAllocations, computeFreeGaps } from "../services/scale-merge.js";
import { aggregateAsaLibraryGaps, createAsaLibraryGapAction } from "../services/asa-library-gaps.js";
import { selectAsaLibraryCitation } from "../services/asa-library-citations.js";
import { asaPreferenceLabel, formatAsaPreferenceValue, parseAsaPreferenceCommand, parseAsaPreferencePatch, type AsaPreferencePatch } from "../services/asa-preferences.js";
import { ASA_TASK_EVIDENCE_TYPES, ASA_UNRECOGNIZED_COMMAND_REPLY, formatAsaCapabilityReply, formatAsaCommandReply, formatAsaTaskCommentsReply, isAsaCapabilityRequest, isAsaUnrecognizedCommandResolution, normalizeAsaText, parseAsaAgendaDraftRenameRequest, parseAsaAgendaMeetingRequest, parseAsaDirectMessageRequest, parseAsaLearningApproval, parseAsaLearningRequest, parseAsaMessageReplyRequest, parseAsaMuralAckRequest, parseAsaMuralCommentRequest, parseAsaMuralReactionRequest, parseAsaNoticeDraftRequest, parseAsaNoticeDraftUpdateRequest, parseAsaTaskAssigneeUpdate, parseAsaTaskCancellationRequest, parseAsaTaskChecklistUpdateRequest, parseAsaTaskCommentRequest, parseAsaTaskCommentsQuery, parseAsaTaskCompletionRequest, parseAsaTaskDescriptionUpdate, acharPessoaPorNome, acharPessoasNoTexto, parseAsaFolgaLoteRequest, parseAsaTaskDraftRequest, parseAsaTaskDueDateUpdate, parseAsaTaskEvidenceLinkRequest, parseAsaTaskPriorityUpdate, parseAsaTaskRequirementsUpdate, parseAsaTaskResponsibilityUpdate, parseAsaTaskStartRequest, parseAsaTaskSubmitForApprovalRequest, parseAsaTaskTitleUpdate, parseAsaUnrecognizedReviewRequest, resolveAsaAgendaSupervisorScope, resolveAsaCommand, resolveAsaOperationSelection } from "../services/asa-command-engine.js";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { eventBus } from "../lib/event-bus.js";
import { createNotification, notifyMany, sendNotification } from "../services/notificationService.js";
import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";
import { aplicarFolgasEmLote, recusaDeFolgaEmLote } from "./folgas.js";
import { analisarPedidoDeFolga } from "../services/analise-folga.js";
import { mesDeFolgasPublicadoNoPeriodo } from "../services/folga-roteamento.js";
import { fraseDoLimite, limitesExcedidos } from "../services/folga-config.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { canApproveAsaMemory, canDeleteAsaMemory, canEditAsaMemory, canReadAsaMemory } from "../services/asa-memory-policy.js";
import { canReadLibraryScope, isLibraryFullReader, type LibraryRole } from "../services/library-access.js";
import { resolvePrimaryRole } from "../lib/authorization.service.js";
import { canViewDailyBook, canViewShowBook } from "../lib/show-responsibility.js";
import { canManageTasks, listTaskManagementAreaIds, resolveTaskAreaId } from "../services/task-access.js";
import { preencherEtapasDe, sincronizarEtapasDaTarefa } from "../services/task-steps.js";
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
import { displayedShiftState, shiftPlans, shiftsForDate, visibleShiftPlans } from "../services/shift-checkins.js";
import { summarizeTasks, taskPeriodDates, type TaskInsightPeriod } from "../services/task-insights.js";
type JsonFetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

const router = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];
const TASK_MANAGER_ROLES = [...MANAGER_ROLES, "DIR"];
const TASK_EVIDENCE_LABELS: Record<string, string> = {
  PHOTO: "FOTO", VIDEO: "VÍDEO", DOCUMENT: "DOCUMENTO", PDF: "PDF",
  LINK: "LINK", AUDIO: "ÁUDIO", PRESENTATION: "APRESENTAÇÃO",
};
const ASA_PROPOSAL_ACTION_TYPES = new Set([
  "NOTICE_DRAFT_CREATE", "NOTICE_DRAFT_UPDATE", "TASK_CREATE", "TASK_CANCEL", "TASK_START", "TASK_READY_FOR_APPROVAL",
  "TASK_COMPLETE", "TASK_COMMENT_CREATE", "TASK_EVIDENCE_LINK_ADD", "TASK_CHECKLIST_UPDATE", "AGENDA_MEETING_CREATE", "AGENDA_DRAFT_RENAME", "AGENDA_DRAFT_SCHEDULE_UPDATE", "AGENDA_DRAFT_NOTES_UPDATE",
  "TASK_UPDATE_DUE_DATE", "TASK_UPDATE_ASSIGNEE", "TASK_UPDATE_PRIORITY", "TASK_UPDATE_DESCRIPTION",
  "TASK_UPDATE_TITLE", "TASK_UPDATE_REQUIREMENTS", "TASK_UPDATE_RESPONSIBILITY", "MURAL_ACK", "MURAL_REACT",
  "MURAL_COMMENT_CREATE", "MESSAGE_DIRECT_CREATE", "MESSAGE_REPLY", "ASA_PREFERENCE_UPDATE", "FOLGA_LOTE",
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
    const overdue = pending.filter(t => t.dueDate !== null && t.dueDate < today);
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




// ── Runner resiliente de lote ───────────────────────────────────────────────────


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

      if ((await shiftsForDate(ctx.organizationId, date)).length) {
        const plans = (await shiftPlans(ctx.organizationId, date)).filter(plan => plan.userId === ctx.userId && plan.operationId === ctx.operationId);
        if (!plans.length) return JSON.stringify({ date, message: `Você não tem atividade publicada com check-in previsto em ${date}.`, turnos: [] });
        const records = await db.select().from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.orgId, ctx.organizationId), eq(operationalCheckInsTable.userId, ctx.userId), eq(operationalCheckInsTable.date, date), isNotNull(operationalCheckInsTable.shiftId)));
        return JSON.stringify({ date, turnos: plans.map(plan => {
          const row = records.find(record => record.shiftId === plan.shiftId);
          return { turno: plan.shiftName, estado: displayedShiftState(row, plan.closesAt, new Date()), chegada: row?.checkedInAt ?? null, atividades: plan.activities.map(activity => activity.label) };
        }), actionUrl: "/check-in" });
      }

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
      if ((await shiftsForDate(ctx.organizationId, date)).length) {
        const plans = (await visibleShiftPlans({ sub: ctx.userId, organizationId: ctx.organizationId, role: ctx.userRole }, await shiftPlans(ctx.organizationId, date))).filter(plan => plan.operationId === ctx.operationId);
        const records = await db.select().from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.orgId, ctx.organizationId), eq(operationalCheckInsTable.operationId, ctx.operationId), eq(operationalCheckInsTable.date, date), isNotNull(operationalCheckInsTable.shiftId)));
        return JSON.stringify({ date, checkIns: plans.map(plan => {
          const row = records.find(record => record.userId === plan.userId && record.shiftId === plan.shiftId);
          return { userName: plan.userName, turno: plan.shiftName, status: displayedShiftState(row, plan.closesAt, new Date()), checkedInAt: row?.checkedInAt ?? null };
        }), actionUrl: "/check-in" });
      }
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
        authorId: announcementsTable.authorId,
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
      return JSON.stringify({ posts: limited.map(({ authorId: _authorId, ...post }) => ({ ...post, confirmedAt: readById.get(post.id)?.confirmedAt ?? null })) });
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
      recipientNames: Array.isArray(proposal.recipientNames) ? proposal.recipientNames
        : proposal.actionType === "FOLGA_LOTE" && Array.isArray(proposal.pessoas) ? proposal.pessoas.map((pessoa: { name?: string }) => pessoa.name ?? "") : undefined,
      ...(proposal.actionType === "FOLGA_LOTE" ? {
        title: proposal.tipo === null ? "Tirar a marcação" : `Marcar ${proposal.tipo === "DAY_OFF" ? "folga" : proposal.tipo === "RECESSO" ? "recesso" : proposal.tipo === "AFASTAMENTO" ? "afastamento" : "ausência"}`,
        tipo: proposal.tipo, dias: Array.isArray(proposal.dates) ? proposal.dates : [], motivo: proposal.motivo ?? undefined,
      } : {}),
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
    const taskDraft = parseAsaTaskDraftRequest(content, operationalDate());
    const folgaLote = parseAsaFolgaLoteRequest(content, operationalDate());
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
        } else if (!agendaOrgManager) {
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
        authorId: announcementsTable.authorId,
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
    } else if (folgaLote.kind === "incomplete") {
      const faltouNaFolga = folgaLote.faltou === "data" ? "Faltou dizer o dia. "
        : folgaLote.faltou === "data_invalida" ? "Não entendi uma das datas (ela existe no calendário? o período está na ordem certa?). "
        : folgaLote.faltou === "pessoas" ? "Não entendi quem: confira os nomes (sem repetir). " : "";
      fullResponse = `${faltouNaFolga}Posso marcar folga ou recesso de várias pessoas de uma vez. Diga quem e quando, do seu jeito: põe a Carol e a Julia de folga amanhã · coloque de folga "Ana Souza" nos dias 20, 21 e 25 · Bia de recesso de segunda a quarta · de folga do dia 20 ao 24 de novembro. Para tirar: tire a folga da Carol dia 20. Se o mês de folgas já estiver publicado, acrescente o motivo: porque ... ou com motivo "texto". Vou mostrar uma prévia antes de gravar.`;
    } else if (folgaLote.kind === "proposal") {
      if (!MANAGER_ROLES.includes(user.role)) {
        fullResponse = user.role === "DIR"
          ? "A Direção acompanha as folgas, mas só a Administração e a Supervisão da área marcam folga. Nada foi marcado."
          : "Folga de outras pessoas só a Administração e a Supervisão da área marcam. Para pedir a sua, use Pedir folga na tela Folgas. Nada foi marcado.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidatos = await db.selectDistinct({ id: usersTable.id, name: usersTable.name, fullName: usersTable.fullName, preferredName: usersTable.preferredName })
            .from(userRolesTable)
            .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
            .where(and(
              eq(userRolesTable.operationId, operationSelection.operationId),
              eq(userRolesTable.active, true),
              eq(usersTable.organizationId, user.organizationId!),
              ne(usersTable.status, "INACTIVE"),
            ));
          const pessoas: Array<{ id: string; name: string }> = [];
          const entendidos: string[] = [];
          const problemas: string[] = [];
          if (!folgaLote.names.length) {
            // Sem aspas: procura na frase quem é da lista de pessoas da operação (nome curto, primeiro nome, formal).
            const nasFrase = acharPessoasNoTexto(candidatos, folgaLote.procurarNoTexto ?? "");
            for (const ambigua of nasFrase.ambiguas) problemas.push(`${ambigua.palavra} pode ser ${ambigua.opcoes.slice(0, 5).map((pessoa) => pessoa.fullName || pessoa.name).join(", ")}: diga o nome completo`);
            if (nasFrase.pessoas.length > 20) problemas.push("são pessoas demais para um pedido só (no máximo 20)");
            else pessoas.push(...nasFrase.pessoas);
            if (!nasFrase.pessoas.length && !nasFrase.ambiguas.length) problemas.push(`não identifiquei quem deve ficar de folga na operação ${operation?.name ?? "selecionada"}: escreva o nome (pode ser o nome curto, o primeiro nome ou um sobrenome)`);
          }
          for (const nome of folgaLote.names) {
            const achado = acharPessoaPorNome(candidatos, nome);
            if (achado.kind === "varias") problemas.push(`${nome} pode ser ${achado.pessoas.slice(0, 5).map((pessoa) => pessoa.fullName || pessoa.name).join(", ")}${achado.pessoas.length > 5 ? " e outras" : ""}: use o nome completo`);
            else if (achado.kind === "nenhuma") problemas.push(`não encontrei ${nome} como pessoa ativa da operação ${operation?.name ?? "selecionada"}`);
            else { pessoas.push(achado.pessoa); if (achado.aproximado) entendidos.push(`“${nome}” como ${achado.pessoa.fullName || achado.pessoa.name}`); }
          }
          const recusa = problemas.length ? null : await recusaDeFolgaEmLote({ role: user.role, organizationId: user.organizationId!, sub: user.sub }, operationSelection.operationId, pessoas.map((pessoa) => pessoa.id));
          const primeiroDia = folgaLote.dates[0]!;
          const ultimoDia = folgaLote.dates[folgaLote.dates.length - 1]!;
          const mesPublicado = problemas.length || recusa ? false : await mesDeFolgasPublicadoNoPeriodo(operationSelection.operationId, primeiroDia, ultimoDia);
          // Limites de folga por dia (total da casa e por área): avisam; no modo "exige motivo" pedem o porquê escrito.
          const comArea = problemas.length || recusa ? [] : await db.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable).where(inArray(usersTable.id, pessoas.map((pessoa) => pessoa.id)));
          const excedidos = problemas.length || recusa || folgaLote.tipo === null ? [] : await limitesExcedidos({ organizationId: user.organizationId!, pessoas: comArea, dates: folgaLote.dates });
          const nomesDasAreas = new Map((excedidos.length ? await db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(inArray(areasTable.id, [...new Set(excedidos.map((e) => e.areaId).filter((id): id is string => Boolean(id)))].concat(["00000000-0000-0000-0000-000000000000"]))) : []).map((area) => [area.id, area.name]));
          const exigeMotivoDoLimite = excedidos.find((e) => e.modo === "EXIGE_MOTIVO");
          if (problemas.length) {
            fullResponse = `Nada foi marcado: ${problemas.join("; ")}.`;
          } else if (recusa) {
            fullResponse = `${recusa}. Nada foi marcado.`;
          } else if (exigeMotivoDoLimite && !folgaLote.motivo) {
            fullResponse = `${fraseDoLimite(exigeMotivoDoLimite, exigeMotivoDoLimite.areaId ? nomesDasAreas.get(exigeMotivoDoLimite.areaId) : undefined)} Esse limite foi combinado como "exige motivo": peça de novo acrescentando com motivo "texto". Nada foi marcado.`;
          } else if (mesPublicado && !folgaLote.motivo) {
            fullResponse = "Esse período está num mês de folgas já publicado. Mexer depois de publicado precisa de motivo escrito: peça de novo acrescentando com motivo \"texto\". Nada foi marcado.";
          } else {
            const diaCurto = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
            const idsDasPessoas = pessoas.map((pessoa) => pessoa.id);
            const jaMarcadas = await db.select({ userId: folgasTable.userId, startDate: folgasTable.startDate, endDate: folgasTable.endDate, type: folgasTable.type })
              .from(folgasTable)
              .where(and(
                inArray(folgasTable.userId, idsDasPessoas), eq(folgasTable.operationId, operationSelection.operationId),
                eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, ultimoDia), gte(folgasTable.endDate, primeiroDia),
              ));
            const nomeDoTipo = (tipo: string) => tipo === "DAY_OFF" ? "folga" : tipo === "RECESSO" ? "recesso" : tipo === "AFASTAMENTO" ? "afastamento" : "ausência";
            const substituidas: string[] = [];
            for (const pessoa of pessoas) {
              for (const dia of folgaLote.dates) {
                const existente = jaMarcadas.find((linha) => linha.userId === pessoa.id && linha.startDate <= dia && linha.endDate >= dia);
                if (existente && existente.type !== folgaLote.tipo) substituidas.push(`${pessoa.name} (${diaCurto(dia)}: já era ${nomeDoTipo(existente.type)})`);
              }
            }
            // Cobertura: só avisa. Quem decide é a gerência; a análise é a mesma que a Supervisão vê no pedido.
            const atencao: string[] = excedidos.map((e) => fraseDoLimite(e, e.areaId ? nomesDasAreas.get(e.areaId) : undefined));
            let semAnalise = false;
            if (folgaLote.tipo !== null) {
              const dias = Math.round((Date.parse(`${ultimoDia}T12:00:00Z`) - Date.parse(`${primeiroDia}T12:00:00Z`)) / 86_400_000) + 1;
              if (dias > 14) semAnalise = true;
              else for (const pessoa of pessoas) {
                const analise = await analisarPedidoDeFolga({ organizationId: user.organizationId!, userId: pessoa.id, startDate: primeiroDia, endDate: ultimoDia });
                for (const dia of analise.dias) {
                  if (folgaLote.dates.includes(dia.date) && !dia.resultado.da) atencao.push(`${pessoa.name} em ${diaCurto(dia.date)}: ${dia.resultado.frase}`);
                }
              }
            }
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const acao = folgaLote.tipo === null ? "Tirar a marcação" : `Marcar ${nomeDoTipo(folgaLote.tipo)}`;
            const nomes = pessoas.map((pessoa) => pessoa.name).join(", ");
            const diasTexto = folgaLote.dates.map(diaCurto).join(", ");
            const action: Record<string, unknown> = {
              action: "ASA_ACTION_PROPOSAL", actionType: "FOLGA_LOTE", state: "PENDING",
              operationId: operationSelection.operationId, operationName: operation?.name ?? "Operação",
              tipo: folgaLote.tipo, pessoas: pessoas.map((pessoa) => ({ id: pessoa.id, name: pessoa.name })),
              dates: folgaLote.dates, motivo: folgaLote.motivo ?? null, mesPublicado, expiresAt: expiresAt.toISOString(),
            };
            fullResponse = `${pessoas.length > 1 || folgaLote.dates.length > 1 ? "Prévia de folga em lote" : "Prévia da folga"}\nOperação: ${operation?.name ?? "Operação"}\n${acao}\nPessoas (${pessoas.length}): ${nomes}\nDias (${folgaLote.dates.length}): ${diasTexto}`
              + (entendidos.length ? `\nEntendi ${entendidos.join("; ")}.` : "")
              + (folgaLote.motivo ? `\nMotivo: ${folgaLote.motivo}` : "")
              + (substituidas.length ? `\nVai substituir: ${substituidas.slice(0, 8).join("; ")}${substituidas.length > 8 ? ` e mais ${substituidas.length - 8}` : ""}.` : "")
              + (atencao.length ? `\nAtenção na cobertura (só aviso; você decide):\n${atencao.slice(0, 8).map((linha) => `• ${linha}`).join("\n")}${atencao.length > 8 ? `\n• e mais ${atencao.length - 8}.` : ""}` : "")
              + (semAnalise ? "\nO período passa de 14 dias: não conferi a cobertura dia a dia." : "")
              + (mesPublicado ? "\nO mês já está publicado: a mudança aparece como \"mudou depois de publicar\" e a Administração é avisada de que há o que republicar." : "")
              + "\n\nNada foi gravado. Confirme pelo botão para aplicar; dá para desfazer pedindo \"tire a folga\" dos mesmos dias.";
            action.previewResponse = fullResponse;
            toolsUsed.push("asa.folga_lote.preview");
            actionsExecuted.push(action);
            const [audit] = await db.insert(asaAuditLogTable).values({
              userId: user.sub, conversationId: String(conversationId), organizationId: user.organizationId!,
              question: content, response: fullResponse, toolsUsed, actionsExecuted, confirmedByUser: false,
            }).returning({ id: asaAuditLogTable.id });
            if (audit) {
              proposalAuditCreated = true;
              proposalEvent = {
                id: audit.id, actionType: "FOLGA_LOTE", title: acao, operationName: operation?.name ?? "Operação",
                recipientNames: pessoas.map((pessoa) => pessoa.name), tipo: folgaLote.tipo, dias: folgaLote.dates,
                motivo: folgaLote.motivo, expiresAt: expiresAt.toISOString(),
              };
            }
          }
        }
      }
    } else if (taskDraft.kind === "incomplete") {
      fullResponse = "Para preparar uma tarefa, use: crie uma tarefa \"título\" para \"nome completo\" até DD/MM/AAAA prioridade alta. Para mais de uma pessoa, liste os nomes: para \"Ana Souza\" e \"Bia Lima\" (ou: para mim e \"Bia Lima\"); crio uma tarefa para cada uma. A prioridade é opcional. Se precisar, acrescente: com descrição \"detalhes\", vinculada à responsabilidade \"título exato\", checklist obrigatória \"item 1; item 2\" e evidências obrigatórias \"FOTO: imagem final; PDF: relatório\". A responsabilidade precisa estar ativa na operação selecionada. A ASA mostra a prévia antes de gravar.";
    } else if (taskDraft.kind === "proposal") {
      if (!TASK_MANAGER_ROLES.includes(user.role)) {
        fullResponse = "A criação de tarefas pela ASA está disponível para gestores autorizados. Nenhuma tarefa foi criada.";
      } else {
        const operationSelection = resolveAsaOperationSelection(content, accessibleOperations, context?.operationId);
        if (operationSelection.kind !== "selected") {
          fullResponse = operationSelection.message;
        } else {
          const operation = accessibleOperations.find((item) => item.id === operationSelection.operationId);
          const candidates = await db.selectDistinct({ id: usersTable.id, name: usersTable.name, fullName: usersTable.fullName, preferredName: usersTable.preferredName })
            .from(userRolesTable)
            .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
            .where(and(
              eq(userRolesTable.operationId, operationSelection.operationId),
              eq(userRolesTable.active, true),
              eq(usersTable.organizationId, user.organizationId!),
              ne(usersTable.status, "INACTIVE"),
            ));
          // Uma tarefa para cada pessoa citada; "para mim" inclui quem pediu. Se qualquer nome falhar, nada é criado.
          const resolvidos: Array<{ id: string; name: string }> = [];
          const entendidos: string[] = [];
          const problemas: string[] = [];
          if (!taskDraft.assigneeNames.length && !taskDraft.includeSelf) {
            // Sem aspas nos nomes: procura na frase quem é da lista de pessoas da operação.
            const nasFrase = acharPessoasNoTexto(candidates, taskDraft.procurarNoTexto ?? "");
            for (const ambigua of nasFrase.ambiguas) problemas.push(`${ambigua.palavra} pode ser ${ambigua.opcoes.slice(0, 5).map((pessoa) => pessoa.fullName || pessoa.name).join(", ")}: diga o nome completo`);
            if (nasFrase.pessoas.length > 20) problemas.push("são pessoas demais para um pedido só (no máximo 20)");
            else resolvidos.push(...nasFrase.pessoas);
            if (!nasFrase.pessoas.length && !nasFrase.ambiguas.length) problemas.push(`não identifiquei quem vai receber a tarefa na operação ${operation?.name ?? "selecionada"}: escreva o nome (pode ser o nome curto, o primeiro nome ou um sobrenome) ou diga "para mim"`);
          }
          for (const nome of taskDraft.assigneeNames) {
            const achado = acharPessoaPorNome(candidates, nome);
            if (achado.kind === "varias") problemas.push(`${nome} pode ser ${achado.pessoas.slice(0, 5).map((pessoa) => pessoa.fullName || pessoa.name).join(", ")}${achado.pessoas.length > 5 ? " e outras" : ""}: use o nome completo`);
            else if (achado.kind === "nenhuma") problemas.push(`não encontrei ${nome} como pessoa ativa da operação ${operation?.name ?? "selecionada"}`);
            else { resolvidos.push(achado.pessoa); if (achado.aproximado) entendidos.push(`“${nome}” como ${achado.pessoa.fullName || achado.pessoa.name}`); }
          }
          if (taskDraft.includeSelf) {
            const eu = candidates.find((candidate) => candidate.id === user.sub);
            if (eu) resolvidos.unshift(eu); else problemas.push(`você não está como pessoa ativa da operação ${operation?.name ?? "selecionada"}`);
          }
          const repetidas = resolvidos.filter((pessoa, indice) => resolvidos.findIndex((outra) => outra.id === pessoa.id) !== indice);
          if (repetidas.length) problemas.push(`${repetidas[0]!.name} aparece mais de uma vez`);
          if (problemas.length) {
            fullResponse = `Nenhuma tarefa foi criada: ${problemas.join("; ")}.`;
          } else {
            const assignees = resolvidos;
            const assignee = assignees[0]!;
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
            // Cada pessoa tem a sua área: a Supervisão só cria para quem é da área que ela cuida.
            const foraDaArea: string[] = [];
            for (const pessoa of assignees) {
              const areaDaPessoa = await resolveTaskAreaId(linkedResponsibility?.id, pessoa.id, user.organizationId!);
              if (!(await canManageTasks(user.sub, user.role, operationSelection.operationId, user.organizationId!, areaDaPessoa))) foraDaArea.push(pessoa.name);
            }
            if (!fullResponse && foraDaArea.length) {
              fullResponse = assignees.length === 1
                ? "Esta tarefa está fora da sua área de gestão. Nenhuma tarefa foi criada."
                : `Fora da sua área de gestão: ${foraDaArea.join(", ")}. Nenhuma tarefa foi criada; tire essas pessoas do pedido e peça de novo.`;
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
                assignees: assignees.map((pessoa) => ({ id: pessoa.id, name: pessoa.name })),
                dueDate: taskDraft.dueDate,
                priority: taskDraft.priority,
                checklistLabels: taskDraft.checklistLabels,
                mandatoryEvidences: taskDraft.mandatoryEvidences,
                expiresAt: expiresAt.toISOString(),
              };
              const nomesDosResponsaveis = assignees.map((pessoa) => pessoa.name).join(", ");
              const checklistPreview = taskDraft.checklistLabels.length
                ? `\nChecklist obrigatória:\n${taskDraft.checklistLabels.map((label) => `• ${label}`).join("\n")}`
                : "";
              const evidencePreview = taskDraft.mandatoryEvidences.length
                ? `\nEvidências obrigatórias:\n${taskDraft.mandatoryEvidences.map((item) => `• ${TASK_EVIDENCE_LABELS[item.type] ?? item.type}: ${item.description}`).join("\n")}`
                : "";
              const descriptionPreview = taskDraft.description ? `\nDescrição: ${taskDraft.description}` : "";
              const responsibilityPreview = linkedResponsibility ? `\nResponsabilidade: ${linkedResponsibility.title}` : "";
              fullResponse = `Prévia da tarefa\nOperação: ${operation?.name ?? "Operação"}\nTítulo: ${taskDraft.title}\n${assignees.length > 1 ? `Responsáveis (${assignees.length}): ${nomesDosResponsaveis}\nSerão criadas ${assignees.length} tarefas, uma para cada pessoa.` : `Responsável: ${assignee.name}`}${entendidos.length ? `\nEntendi ${entendidos.join("; ")}.` : ""}${responsibilityPreview}\nPrazo: ${taskDraft.dueDate.split("-").reverse().join("/")}\nPrioridade: ${priorityLabel}${descriptionPreview}${checklistPreview}${evidencePreview}\n\nNada foi gravado. Confirme pelo botão para criar a tarefa; a conclusão seguirá o fluxo de aprovação.`;
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
                  assigneeName: nomesDosResponsaveis,
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
              fullResponse = `Prévia de alteração do prazo\nOperação: ${operation?.name ?? "Operação"}\nTarefa: ${task.title}\nPrazo atual: ${task.dueDate ? task.dueDate.split("-").reverse().join("/") : "sem prazo"}\nNovo prazo: ${taskDueDateUpdate.dueDate.split("-").reverse().join("/")}\n\nNada foi alterado. Confirme pelo botão para atualizar somente o prazo.`;
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
      if (command.tool === "consultar_agenda" || command.tool === "consultar_minhas_propostas_agenda" || command.tool === "consultar_livro_do_dia" || command.tool === "consultar_livros_do_show" || command.tool === "consultar_escalas" || command.tool === "consultar_meu_dia" || command.tool === "consultar_meu_checkin" || command.tool === "consultar_checkins_equipe" || command.tool === "consultar_ausencias_do_dia" || command.tool === "consultar_tempo_livre" || command.tool === "consultar_atividades" || command.tool === "consultar_tarefa_requisitos" || supervisorTaskQuery || supervisorResponsibilitiesQuery || (command.tool === "consultar_entregas" && command.input.scope === "team")) {
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
      // O texto das mensagens que a ASA mostra a quem perguntou fica no chat dessa pessoa (aiMessages), nunca no registro da casa.
      const usouMensagens = toolsUsed.some((nome) => nome === "consultar_mensagens");
      await db.insert(asaAuditLogTable).values({
        userId: user.sub,
        conversationId: String(conversationId),
        organizationId: user.organizationId ?? undefined,
        question: content,
        response: usouMensagens ? TEXTO_DE_CONVERSA_FORA_DO_REGISTRO : fullResponse,
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
          category: "MESSAGE", action: "message_sent", title: "Resposta enviada", narrative: "Mensagem enviada.",
          entityType: "message", entityId: message.id, actorId: user.sub, actorName: sender.name,
          // O Registro guarda só quem, onde e quando: o texto da conversa não é de quem lê o Registro.
          orgId: user.organizationId!, afterState: { id: message.id, threadId: thread.id, kind: message.kind },
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
          category: "MESSAGE", action: "message_sent", title: "Mensagem enviada", narrative: "Mensagem enviada.",
          entityType: "message", entityId: message.id, actorId: user.sub, actorName: sender.name,
          orgId: user.organizationId!, afterState: { id: message.id, threadId: thread.id, kind: message.kind },
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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

      if (proposal.actionType === "FOLGA_LOTE") {
        if (operation.name !== proposal.operationName) return { status: "stale" as const };
        // Só a Administração e a Supervisão da área marcam folga de outras pessoas; a Direção só lê.
        if (!MANAGER_ROLES.includes(currentRole)) return { status: "forbidden" as const };
        const tipo = proposal.tipo === null || proposal.tipo === undefined ? null : String(proposal.tipo);
        const datas = Array.isArray(proposal.dates) ? proposal.dates.map(String) : [];
        const previstas: Array<{ id: string; name: string }> = Array.isArray(proposal.pessoas)
          ? proposal.pessoas.map((item: { id?: unknown; name?: unknown }) => ({ id: String(item?.id ?? ""), name: String(item?.name ?? "") })) : [];
        const motivoDoLote = typeof proposal.motivo === "string" && proposal.motivo.trim() ? proposal.motivo.trim() : null;
        if ((tipo !== null && tipo !== "DAY_OFF" && tipo !== "RECESSO") || !previstas.length || previstas.length > 20
          || !datas.length || datas.length > 31 || datas.some((dia) => !/^\d{4}-\d{2}-\d{2}$/.test(dia))
          || new Set(previstas.map((item) => item.id)).size !== previstas.length) return { status: "stale" as const };
        for (const prevista of previstas) {
          const [pessoa] = await tx.select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .innerJoin(userRolesTable, and(eq(userRolesTable.userId, usersTable.id), eq(userRolesTable.operationId, operationId), eq(userRolesTable.active, true)))
            .where(and(eq(usersTable.id, prevista.id), eq(usersTable.organizationId, user.organizationId!), ne(usersTable.status, "INACTIVE")))
            .for("share")
            .limit(1);
          if (!pessoa || pessoa.name !== prevista.name) return { status: "stale" as const };
        }
        const recusaAgora = await recusaDeFolgaEmLote({ role: currentRole, organizationId: user.organizationId!, sub: user.sub }, operationId, previstas.map((item) => item.id));
        if (recusaAgora) return { status: "forbidden" as const };
        // Entre a prévia e o "sim" o mês pode ter sido publicado: sem motivo escrito, a prévia perdeu a validade.
        if (!motivoDoLote && await mesDeFolgasPublicadoNoPeriodo(operationId, [...datas].sort()[0]!, [...datas].sort()[datas.length - 1]!)) return { status: "stale" as const };
        if (!motivoDoLote && tipo !== null) {
          const comAreaAgora = await tx.select({ id: usersTable.id, areaId: usersTable.areaId }).from(usersTable).where(inArray(usersTable.id, previstas.map((item) => item.id)));
          if ((await limitesExcedidos({ organizationId: user.organizationId!, pessoas: comAreaAgora, dates: datas })).some((e) => e.modo === "EXIGE_MOTIVO")) return { status: "stale" as const };
        }
        await aplicarFolgasEmLote(tx, {
          user: { sub: user.sub, organizationId: user.organizationId! }, operationId,
          pessoas: previstas.map((item) => item.id), dates: datas, type: tipo, motivo: motivoDoLote, via: "ASA",
        });
        const confirmadoEm = new Date().toISOString();
        const resumo = tipo === null
          ? `Marcação tirada de ${previstas.length === 1 ? "1 pessoa" : `${previstas.length} pessoas`} em ${datas.length === 1 ? "1 dia" : `${datas.length} dias`}.`
          : `${tipo === "RECESSO" ? "Recesso marcado" : "Folga marcada"} para ${previstas.length === 1 ? "1 pessoa" : `${previstas.length} pessoas`} em ${datas.length === 1 ? "1 dia" : `${datas.length} dias`}.`;
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: actions.map((item) => item === proposal ? { ...item, state: "CONFIRMED", confirmedAt: confirmadoEm } : item),
          response: resumo,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "folga_lote" as const, message: resumo };
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
        // Prévias antigas têm um responsável só (assigneeId); as novas trazem a lista em `assignees`.
        const previstos: Array<{ id: string; name: string }> = Array.isArray(proposal.assignees) && proposal.assignees.length
          ? proposal.assignees.map((item: { id?: unknown; name?: unknown }) => ({ id: String(item?.id ?? ""), name: String(item?.name ?? "") }))
          : [{ id: assigneeId, name: String(proposal.assigneeName ?? "") }];
        if (previstos.length > 20 || new Set(previstos.map((item) => item.id)).size !== previstos.length) return { status: "stale" as const };
        const responsaveis: Array<{ id: string; name: string }> = [];
        for (const previsto of previstos) {
          const [pessoa] = await tx.select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .innerJoin(userRolesTable, and(eq(userRolesTable.userId, usersTable.id), eq(userRolesTable.operationId, operationId), eq(userRolesTable.active, true)))
            .where(and(eq(usersTable.id, previsto.id), eq(usersTable.organizationId, user.organizationId!), ne(usersTable.status, "INACTIVE")))
            .for("share")
            .limit(1);
          if (!pessoa || pessoa.name !== previsto.name) return { status: "stale" as const };
          responsaveis.push(pessoa);
        }
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
        const tarefas: Array<typeof tasksTable.$inferSelect> = [];
        for (const assignee of responsaveis) {
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
          await preencherEtapasDe(tx as any, task);
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
        tarefas.push(task);
        }
        const [task] = tarefas;
        if (!task) throw new Error("Não foi possível criar a tarefa");
        const completedAt = new Date().toISOString();
        const updatedActions = actions.map((item) => item === proposal
          ? { ...item, state: "CONFIRMED", confirmedAt: completedAt, resultId: task.id, resultIds: tarefas.map((item) => item.id) }
          : item);
        await tx.update(asaAuditLogTable).set({
          actionsExecuted: updatedActions,
          response: tarefas.length > 1 ? `${tarefas.length} tarefas criadas: ${task.title} (${responsaveis.map((pessoa) => pessoa.name).join(", ")}). A conclusão de cada uma deverá passar por aprovação.` : `Tarefa criada: ${task.title}. A conclusão deverá passar por aprovação.`,
          confirmedByUser: true,
        }).where(eq(asaAuditLogTable.id, audit.id));
        return { status: "task_created" as const, taskId: task.id, title: task.title, dueDate, count: tarefas.length, assignees: tarefas.map((item) => ({ userId: item.assigneeId, taskId: item.id })) };
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
        await sincronizarEtapasDaTarefa(tx as any, task, updated, { id: user.sub });
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
    if (result.status === "folga_lote") { res.json({ success: true, message: result.message }); return; }
    if (result.status === "task_created") {
      // Quem recebe tarefa precisa ficar sabendo sem abrir a tela: um aviso por pessoa, e nenhum para quem pediu para si mesma.
      const prazo = result.dueDate.split("-").reverse().slice(0, 2).join("/");
      for (const destino of result.assignees) {
        if (destino.userId === user.sub) continue;
        void sendNotification({
          userId: destino.userId, type: "task.assigned", title: "Nova tarefa para você",
          message: `${result.title} — até ${prazo}.`, priority: "NORMAL", category: "responsibility",
          entityType: "task", entityId: destino.taskId, actionUrl: "/responsabilidades",
        }).catch(() => undefined);
      }
      res.json({
        success: true, taskId: result.taskId,
        message: result.count > 1
          ? `${result.count} tarefas “${result.title}” criadas, uma para cada pessoa. A conclusão de cada uma deverá passar por aprovação.`
          : `Tarefa “${result.title}” criada. A conclusão deverá passar por aprovação.`,
      });
      return;
    }
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
    if (!(t.dueDate && t.dueDate < todayStr)) continue;
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

  const rec = await db.transaction(async (tx) => {
    const [created] = await tx.insert(recognitionsTable).values({
      organizationId: user.organizationId!,
      userId,
      type,
      title,
      message,
      createdBy: user.sub,
      publishedAt: new Date(),
    }).returning();
    await writeHistoryEvent({
      category: "NOTICE", action: "recognition.created", title: "Reconhecimento dado",
      narrative: `Reconhecimento "${title}" dado a uma pessoa da equipe.`, entityType: "recognition", entityId: created!.id,
      actorId: user.sub, orgId: user.organizationId!, beforeState: null, afterState: created, metadata: { userId, type },
    }, tx as any);
    return created!;
  });

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

/** Frase que ocupa o lugar do texto de conversas no registro da ASA. */
export const TEXTO_DE_CONVERSA_FORA_DO_REGISTRO = "O conteúdo de conversas não aparece no registro da ASA.";

/** Linha do registro da ASA sem o texto de conversas privadas (consulta de mensagens e respostas de mensagem). */
export function semConteudoDeMensagem<T extends { question: string; response: string; toolsUsed: string[] | null; actionsExecuted: Record<string, unknown>[] | null }>(row: T): T {
  const usouMensagens = (row.toolsUsed ?? []).some((nome) => /mensage|message/i.test(String(nome)))
    || (row.actionsExecuted ?? []).some((acao) => /^MESSAGE_/.test(String(acao.actionType ?? "")));
  if (!usouMensagens) return row;
  return { ...row, question: "(consulta de mensagens)", response: TEXTO_DE_CONVERSA_FORA_DO_REGISTRO, actionsExecuted: (row.actionsExecuted ?? []).map((acao) => ({ action: acao.action, actionType: acao.actionType, state: acao.state })) };
}

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

  // A Administração e a Supervisão não leem conversa de ninguém. Quando a pessoa pediu "minhas mensagens", a resposta guardada traz o texto das mensagens;
  // aqui sai só que a consulta aconteceu, não o conteúdo (vale também para linhas antigas, gravadas antes deste filtro).
  res.json(rows.map(semConteudoDeMensagem));
});

router.get("/asa/library-gaps", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  // A Supervisão cuida da Biblioteca junto com a Administração, então vê o que a ASA não achou em documento.
  if (!["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(user.role)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Os temas que a ASA não achou na Biblioteca são da Administração e da Supervisão." });
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
