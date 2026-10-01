import assert from "node:assert/strict";
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  aiMessages, agendaEventParticipantsTable, agendaEventsTable, announcementCommentsTable, announcementReadsTable, announcementsTable, areaLocalSupervisorsTable, areasTable, asaAuditLogTable, asaUserPreferencesTable, conversations, db, folgasTable,
  delegationsTable, historyEventsTable, locationsTable, noticeRecipientsTable, noticesTable, showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable, taskEvidencesTable,
  messageThreadsTable, messageThreadParticipantsTable, messagesTable, taskCommentsTable,
  libraryCategoriesTable, libraryDocumentsTable, libraryDocumentPageCitationsTable, libraryViewsTable,
  operationLocationsTable, operationsTable, organizationsTable, pool, recurringActivitiesTable, recurringActivityAssigneesTable, responsibilitiesTable, responsibilityAssignmentsTable,
  recurringActivitySchedulesTable, tasksTable, userNotificationsTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate } from "../src/lib/operational-date.js";

type Proposal = { id: string; actionType: string; recipientName?: string; recipientNames?: string[]; title?: string; content?: string; announcementContent?: string; reaction?: string; previousReaction?: string | null; recipientCount?: number; previousDueDate?: string; previousAssigneeName?: string; previousPriority?: string; previousDescription?: string | null; previousTitle?: string; previousResponsibilityTitle?: string | null; newResponsibilityTitle?: string | null; previousStatus?: string; expectedStatus?: string; previousDate?: string; previousStartTime?: string | null; previousEndTime?: string | null; date?: string; startTime?: string; endTime?: string; newTitle?: string; description?: string; responsibilityTitle?: string; assigneeName?: string; checklistLabels?: string[]; checklistKind?: "mandatory" | "operational"; mandatoryEvidences?: Array<{ type: string; description: string }>; dueDate?: string; priority?: string; previousMode?: string; mode?: string; previousNotes?: string | null; notes?: string; changes?: Array<{ key: string; label: string; before: string; after: string }>; expiresAt: string };
async function run() {
  const tag = `asa_actions_${Date.now()}`;
  const orgIds: string[] = [], userIds: string[] = [], conversationIds: number[] = [], messageThreadIds: string[] = [], muralPostIds: string[] = [], libraryCategoryIds: string[] = [], libraryDocumentIds: string[] = [], showBookIds: string[] = [], showBookSceneIds: string[] = [], showBookBlockIds: string[] = [], showBookPositionIds: string[] = [];
  let server: http.Server | undefined;
  let passed = 0;
  const failures: string[] = [];
  const check = (condition: unknown, label: string) => {
    if (condition) passed++;
    else { failures.push(label); console.error(`FAIL: ${label}`); }
  };
  try {
    const orgs = await db.insert(organizationsTable).values([{ name: tag }, { name: `${tag}_foreign` }]).returning();
    orgIds.push(...orgs.map(org => org.id));
    const [operation, otherOperation, foreignOperation] = await db.insert(operationsTable).values([
      { organizationId: orgs[0]!.id, name: `${tag}_main`, status: "ACTIVE" },
      { organizationId: orgs[0]!.id, name: `${tag}_other`, status: "ACTIVE" },
      { organizationId: orgs[1]!.id, name: `${tag}_foreign`, status: "ACTIVE" },
    ]).returning();
    const [area, otherArea] = await db.insert(areasTable).values([{ organizationId: orgs[0]!.id, name: "Own" }, { organizationId: orgs[0]!.id, name: "Other" }]).returning();
    const [location, otherLocation, foreignLocation] = await db.insert(locationsTable).values([
      { organizationId: orgs[0]!.id, name: tag },
      { organizationId: orgs[0]!.id, name: `${tag}_other` },
      { organizationId: orgs[1]!.id, name: `${tag}_foreign` },
    ]).returning();
    await db.insert(operationLocationsTable).values([
      { operationId: operation!.id, locationId: location!.id },
      { operationId: operation!.id, locationId: otherLocation!.id },
    ]);
    const [libraryCategory] = await db.insert(libraryCategoriesTable).values({
      orgId: orgs[0]!.id, name: `${tag}_category`, active: true,
    }).returning();
    libraryCategoryIds.push(libraryCategory!.id);
    const makeUser = async (name: string, role: "ADMIN" | "DIR" | "MEMBER" | "SUPERVISOR_A", areaId: string | null = null, foreign = false) => {
      const [user] = await db.insert(usersTable).values({ organizationId: orgs[foreign ? 1 : 0]!.id, name, fullName: name, username: `${tag}_${name}`, areaId }).returning();
      userIds.push(user!.id);
      const [membership] = await db.insert(userRolesTable).values({ userId: user!.id, operationId: foreign ? foreignOperation!.id : operation!.id, role, active: true }).returning();
      return { ...user!, role, membershipId: membership!.id };
    };
    const admin = await makeUser("Admin", "ADMIN");
    const director = await makeUser("Director", "DIR");
    const supervisor = await makeUser("Supervisor", "SUPERVISOR_A", area!.id);
    const member = await makeUser("Member", "MEMBER", area!.id);
    const mixedRoleMember = await makeUser("MixedRole", "MEMBER", area!.id);
    await db.insert(userRolesTable).values({ userId: mixedRoleMember.id, operationId: otherOperation!.id, role: "DIR", active: true });
    const outsider = await makeUser("Outside", "MEMBER", otherArea!.id);
    const foreign = await makeUser("Foreign", "ADMIN", null, true);
    const [scope] = await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: location!.id, supervisorId: supervisor.id }).returning();
    const [foreignArea] = await db.insert(areasTable).values({ organizationId: orgs[1]!.id, name: "Foreign" }).returning();
    const responsibilityFixtures = await db.insert(responsibilitiesTable).values([
      { orgId: orgs[0]!.id, operationId: operation!.id, areaId: area!.id, ownerId: admin.id, title: `${tag}_responsibility_visible` },
      { orgId: orgs[0]!.id, operationId: operation!.id, areaId: otherArea!.id, ownerId: admin.id, title: `${tag}_responsibility_other_area` },
      { orgId: orgs[0]!.id, operationId: otherOperation!.id, areaId: area!.id, ownerId: admin.id, title: `${tag}_responsibility_other_operation` },
      { orgId: orgs[1]!.id, operationId: foreignOperation!.id, areaId: foreignArea!.id, ownerId: foreign.id, title: `${tag}_responsibility_foreign_org` },
      { orgId: orgs[0]!.id, operationId: operation!.id, areaId: area!.id, ownerId: admin.id, title: `${tag}_responsibility_inactive`, active: false },
      { orgId: orgs[0]!.id, operationId: operation!.id, areaId: area!.id, ownerId: admin.id, title: `${tag}_responsibility_unassigned` },
      { orgId: orgs[0]!.id, operationId: operation!.id, areaId: area!.id, ownerId: admin.id, title: `${tag}_responsibility_expired_assignment` },
    ]).returning({ id: responsibilitiesTable.id, title: responsibilitiesTable.title });
    const responsibilityIds = new Map(responsibilityFixtures.map((item) => [item.title, item.id]));
    await db.insert(responsibilityAssignmentsTable).values([
      { responsibilityId: responsibilityIds.get(`${tag}_responsibility_visible`)!, memberId: member.id, role: "PRIMARY", active: true },
      { responsibilityId: responsibilityIds.get(`${tag}_responsibility_other_area`)!, memberId: outsider.id, role: "PRIMARY", active: true },
      { responsibilityId: responsibilityIds.get(`${tag}_responsibility_other_operation`)!, memberId: member.id, role: "PRIMARY", active: true },
      { responsibilityId: responsibilityIds.get(`${tag}_responsibility_foreign_org`)!, memberId: foreign.id, role: "PRIMARY", active: true },
      { responsibilityId: responsibilityIds.get(`${tag}_responsibility_expired_assignment`)!, memberId: member.id, role: "PRIMARY", active: true, endsAt: new Date(Date.now() - 60_000) },
    ]);
    const libraryLocationDocs = await db.insert(libraryDocumentsTable).values([
      { orgId: orgs[0]!.id, categoryId: libraryCategory!.id, title: `${tag}_library_main_location`, type: "OPERATIONAL_PROCEDURE", body: "Procedimentos de segurança no gelo para o local principal.", summary: "Orientação local", tags: [`${tag}_resgate`], scopeType: "LOCATION", locationId: location!.id, status: "PUBLISHED", createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_library_other_location`, type: "OPERATIONAL_PROCEDURE", body: "Procedimentos de segurança no gelo para outro local.", summary: "Orientação de outro local", scopeType: "LOCATION", locationId: otherLocation!.id, status: "PUBLISHED", createdBy: admin.id },
      { orgId: orgs[1]!.id, title: `${tag}_library_foreign_location`, type: "OPERATIONAL_PROCEDURE", body: "Procedimentos de segurança no gelo de outra organização.", summary: "Orientação externa", scopeType: "LOCATION", locationId: foreignLocation!.id, status: "PUBLISHED", createdBy: foreign.id },
    ]).returning({ id: libraryDocumentsTable.id });
    libraryDocumentIds.push(...libraryLocationDocs.map((document) => document.id));
    const citationScopeDocs = await db.insert(libraryDocumentsTable).values([
      { orgId: orgs[0]!.id, title: `${tag}_citation_own_area`, type: "OPERATIONAL_PROCEDURE", body: "Referência de citação da área autorizada.", scopeType: "AREA", areaId: area!.id, status: "PUBLISHED", createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_citation_other_area`, type: "OPERATIONAL_PROCEDURE", body: "Referência de citação de outra área.", scopeType: "AREA", areaId: otherArea!.id, status: "PUBLISHED", createdBy: admin.id },
    ]).returning({ id: libraryDocumentsTable.id });
    libraryDocumentIds.push(...citationScopeDocs.map((document) => document.id));
    const pendingReadDocs = await db.insert(libraryDocumentsTable).values([
      { orgId: orgs[0]!.id, title: `${tag}_required_unread`, type: "OPERATIONAL_PROCEDURE", body: "Leitura obrigatória ainda pendente.", scopeType: "HOUSE", status: "PUBLISHED", requiresConfirmation: true, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_required_confirmed_by_member`, type: "OPERATIONAL_PROCEDURE", body: "Leitura obrigatória já confirmada pela própria pessoa.", scopeType: "AREA", areaId: area!.id, status: "UPDATED", requiresConfirmation: true, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_required_confirmed_by_other`, type: "OPERATIONAL_PROCEDURE", body: "Leitura obrigatória confirmada somente por outra pessoa.", scopeType: "HOUSE", status: "PUBLISHED", requiresConfirmation: true, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_required_other_area`, type: "OPERATIONAL_PROCEDURE", body: "Leitura de outra área.", scopeType: "AREA", areaId: otherArea!.id, status: "PUBLISHED", requiresConfirmation: true, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_required_location`, type: "OPERATIONAL_PROCEDURE", body: "Leitura vinculada a local.", scopeType: "LOCATION", locationId: location!.id, status: "PUBLISHED", requiresConfirmation: true, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_optional_read`, type: "OPERATIONAL_PROCEDURE", body: "Documento sem ciente obrigatório.", scopeType: "HOUSE", status: "PUBLISHED", requiresConfirmation: false, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_draft_required`, type: "OPERATIONAL_PROCEDURE", body: "Rascunho não visível.", scopeType: "HOUSE", status: "DRAFT", requiresConfirmation: true, createdBy: admin.id },
      { orgId: orgs[0]!.id, title: `${tag}_archived_required`, type: "OPERATIONAL_PROCEDURE", body: "Documento arquivado.", scopeType: "HOUSE", status: "PUBLISHED", requiresConfirmation: true, archivedAt: new Date(), createdBy: admin.id },
      { orgId: orgs[1]!.id, title: `${tag}_foreign_required`, type: "OPERATIONAL_PROCEDURE", body: "Documento de outra organização.", scopeType: "HOUSE", status: "PUBLISHED", requiresConfirmation: true, createdBy: foreign.id },
    ]).returning({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title });
    libraryDocumentIds.push(...pendingReadDocs.map((document) => document.id));
    const pendingReadByTitle = new Map(pendingReadDocs.map((document) => [document.title, document.id]));
    await db.insert(libraryViewsTable).values([
      { documentId: pendingReadByTitle.get(`${tag}_required_confirmed_by_member`)!, userId: member.id, orgId: orgs[0]!.id, viewedAt: new Date(), confirmedAt: new Date() },
      { documentId: pendingReadByTitle.get(`${tag}_required_confirmed_by_other`)!, userId: outsider.id, orgId: orgs[0]!.id, viewedAt: new Date(), confirmedAt: new Date() },
    ]);
    const [visibleActivity, otherOperationActivity, foreignActivity, inactiveActivity] = await db.insert(recurringActivitiesTable).values([
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_visible_activity`, active: true },
      { organizationId: orgs[0]!.id, operationId: otherOperation!.id, title: `${tag}_other_operation_activity`, active: true },
      { organizationId: orgs[1]!.id, operationId: foreignOperation!.id, title: `${tag}_foreign_activity`, active: true },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_inactive_activity`, active: false },
    ]).returning();
    await db.insert(recurringActivitySchedulesTable).values({ activityId: visibleActivity!.id, weekday: 1, startTime: "18:00", endTime: "19:30" });
    await db.insert(recurringActivityAssigneesTable).values([
      { activityId: visibleActivity!.id, userId: member.id },
      { activityId: visibleActivity!.id, userId: foreign.id },
    ]);
    const [showBookLegacy, showBookAssigned, showBookOtherOperation, showBookForeign, showBookArchived] = await db.insert(showBooksTable).values([
      { operationId: operation!.id, title: `${tag}_show_legacy`, status: "PUBLISHED", createdBy: admin.id },
      { operationId: operation!.id, title: `${tag}_show_assigned`, status: "DRAFT", responsibleId: admin.id, createdBy: admin.id },
      { operationId: otherOperation!.id, title: `${tag}_show_other_operation`, status: "PUBLISHED", createdBy: admin.id },
      { operationId: foreignOperation!.id, title: `${tag}_show_foreign`, status: "PUBLISHED", createdBy: foreign.id },
      { operationId: operation!.id, title: `${tag}_show_archived`, status: "ARCHIVED", createdBy: admin.id },
    ]).returning();
    showBookIds.push(showBookLegacy!.id, showBookAssigned!.id, showBookOtherOperation!.id, showBookForeign!.id, showBookArchived!.id);
    const [showScene] = await db.insert(showBookScenesTable).values({ showBookId: showBookLegacy!.id, name: `${tag}_scene`, order: 1, active: true }).returning();
    showBookSceneIds.push(showScene!.id);
    const [showBlock] = await db.insert(showBookBlocksTable).values({ showBookId: showBookLegacy!.id, sceneId: showScene!.id, name: `${tag}_block`, order: 1, active: true }).returning();
    showBookBlockIds.push(showBlock!.id);
    const [showPosition] = await db.insert(showBookRolesTable).values({ showBookId: showBookLegacy!.id, blockId: showBlock!.id, name: `${tag}_position`, order: 1, minimumCoverage: 1, active: true }).returning();
    const [unassignedShowPosition] = await db.insert(showBookRolesTable).values({ showBookId: showBookLegacy!.id, blockId: null, name: `${tag}_unassigned_position`, order: 2, minimumCoverage: 2, active: true }).returning();
    showBookPositionIds.push(showPosition!.id, unassignedShowPosition!.id);

    server = http.createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const api = (user: typeof admin) => (path: string, body?: unknown, method = "POST") => fetch(`${base}${path}`, {
      method, signal: AbortSignal.timeout(60_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, role: user.role, organizationId: user.organizationId!, operationIds: [operation!.id] })}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const manager = api(admin), direction = api(director), sup = api(supervisor), mine = api(member), outside = api(outsider), mixedRole = api({ ...mixedRoleMember, role: "DIR" }), foreignApi = api(foreign);
    const today = operationalDate();
    const date = today.split("-").reverse().join("/");
    const nextDueDate = new Date(`${today}T12:00:00Z`);
    nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 1);
    const nextDue = nextDueDate.toISOString().slice(0, 10);
    const dueSoonDate = new Date(`${today}T12:00:00Z`);
    dueSoonDate.setUTCDate(dueSoonDate.getUTCDate() + 3);
    const dueSoon = dueSoonDate.toISOString().slice(0, 10);
    const outsideSoonWindowDate = new Date(`${today}T12:00:00Z`);
    outsideSoonWindowDate.setUTCDate(outsideSoonWindowDate.getUTCDate() + 4);
    const outsideSoonWindow = outsideSoonWindowDate.toISOString().slice(0, 10);
    const previousDueDate = new Date(`${today}T12:00:00Z`);
    previousDueDate.setUTCDate(previousDueDate.getUTCDate() - 1);
    const previousDue = previousDueDate.toISOString().slice(0, 10);
    await db.insert(asaUserPreferencesTable).values({ userId: member.id, mode: "PROACTIVE" });
    await db.insert(tasksTable).values([
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_overdue_self`, creatorId: admin.id, assigneeId: member.id, dueDate: previousDue, status: "CREATED" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_today_self`, creatorId: admin.id, assigneeId: member.id, dueDate: today, status: "IN_PROGRESS" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_overdue_other`, creatorId: admin.id, assigneeId: outsider.id, dueDate: previousDue, status: "CREATED" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_overdue_waiting_approval`, creatorId: admin.id, assigneeId: member.id, dueDate: previousDue, status: "READY_FOR_APPROVAL" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_soon_self`, creatorId: admin.id, assigneeId: member.id, dueDate: dueSoon, status: "CHANGES_REQUESTED" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_soon_other`, creatorId: admin.id, assigneeId: outsider.id, dueDate: dueSoon, status: "CREATED" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_soon_waiting_approval`, creatorId: admin.id, assigneeId: member.id, dueDate: dueSoon, status: "READY_FOR_APPROVAL" },
      { organizationId: orgs[0]!.id, operationId: operation!.id, title: `${tag}_outside_soon_window`, creatorId: admin.id, assigneeId: member.id, dueDate: outsideSoonWindow, status: "CREATED" },
    ]);
    const proactiveResponse = await mine("/asa/proactive-suggestions", undefined, "GET");
    const proactiveCounts = await proactiveResponse.json() as { overdueCount: number; dueTodayCount: number; dueSoonCount: number };
    check(proactiveResponse.status === 200 && proactiveCounts.overdueCount === 1 && proactiveCounts.dueTodayCount === 1 && proactiveCounts.dueSoonCount === 1,
      "Proactive task nudge counts only the member's overdue, due-today, and next-three-day actionable tasks");
    await db.update(asaUserPreferencesTable).set({ mode: "SILENT" }).where(eq(asaUserPreferencesTable.userId, member.id));
    const silentResponse = await mine("/asa/proactive-suggestions", undefined, "GET");
    const silentCounts = await silentResponse.json() as { overdueCount: number; dueTodayCount: number; dueSoonCount: number };
    check(silentResponse.status === 200 && silentCounts.overdueCount === 0 && silentCounts.dueTodayCount === 0 && silentCounts.dueSoonCount === 0,
      "Proactive summary stays silent when the account has paused suggestions");
    await db.update(asaUserPreferencesTable).set({ mode: "PROACTIVE" }).where(eq(asaUserPreferencesTable.userId, member.id));
    const taskText = (title: string, person = member.name, checklistLabels?: string[], mandatoryEvidences?: Array<{ type: string; description: string }>, description?: string, responsibilityTitle?: string) => {
      const descriptionPart = description ? ` com descrição "${description}"` : "";
      const responsibilityPart = responsibilityTitle ? ` vinculada à responsabilidade "${responsibilityTitle}"` : "";
      const checklist = checklistLabels?.length ? ` com checklist obrigatória "${checklistLabels.join("; ")}"` : "";
      const evidence = mandatoryEvidences?.length
        ? `${checklist ? " e" : " com"} evidências obrigatórias "${mandatoryEvidences.map((item) => `${item.type}: ${item.description}`).join("; ")}"`
        : "";
      return `crie uma tarefa "${title}" para "${person}" até ${date} prioridade alta${descriptionPart}${responsibilityPart}${checklist}${evidence}`;
    };
    const changeDueText = (title: string, dueDate: string) => `altere o prazo da tarefa "${title}" para ${dueDate.split("-").reverse().join("/")}`;
    const changeAssigneeText = (title: string, person: string) => `altere o responsável da tarefa "${title}" para "${person}"`;
    const changePriorityText = (title: string, priority: string) => `altere a prioridade da tarefa "${title}" para ${priority}`;
    const changeDescriptionText = (title: string, description: string) => `altere a descrição da tarefa "${title}" para "${description}"`;
    const changeTitleText = (title: string, newTitle: string) => `altere o título da tarefa "${title}" para "${newTitle}"`;
    const startTaskText = (title: string) => `inicie a tarefa "${title}"`;
    const cancelTaskText = (title: string, reason: string) => `cancele a tarefa "${title}" motivo "${reason}"`;
    const commentTaskText = (title: string, content: string) => `comente na tarefa "${title}" com o texto "${content}"`;
    const evidenceLinkText = (url: string, title: string, description: string) => `anexe o link "${url}" à tarefa "${title}" com a descrição "${description}"`;
    const submitTaskText = (title: string) => `envie a tarefa "${title}" para aprovação`;
    const completeTaskText = (title: string) => `conclua minha tarefa ${title}`;
    const agendaMeetingText = (title: string, scope = "") => `agende uma reunião "${title}" em ${date} das 14:00 às 15:00${scope}`;
    const noticeText = (title: string) => `crie um rascunho de aviso "${title}" "Texto completo do aviso"`;
    const ask = async (client: typeof manager, content: string, operationId = operation!.id) => {
      const created = await client("/asa/conversations", { title: tag });
      assert.equal(created.status, 201);
      const conversation = await created.json() as { id: number };
      conversationIds.push(conversation.id);
      const response = await client(`/asa/chat/${conversation.id}/messages`, { content, context: { operationId } });
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.ok(!body.includes('"error":'), body);
      const line = body.split(/\r?\n/).find(item => item.startsWith("data: ") && item.includes('"proposal"'));
      return { proposal: line ? (JSON.parse(line.slice(6)) as { proposal: Proposal }).proposal : undefined, conversationId: conversation.id, body };
    };
    const memberShowBooks = await ask(mine, "Quais Livros do Show estão disponíveis?");
    check(memberShowBooks.body.includes(showBookLegacy!.title)
      && memberShowBooks.body.includes(showBookAssigned!.title)
      && !memberShowBooks.body.includes(showBookOtherOperation!.title)
      && !memberShowBooks.body.includes(showBookForeign!.title)
      && !memberShowBooks.body.includes(showBookArchived!.title),
    "Show-book query gives a member visible books in their operation without exposing other operations, organizations, or archived books");
    const adminTeamResponsibilities = await ask(manager, "Mostre as responsabilidades da equipe");
    check(adminTeamResponsibilities.body.includes(`${tag}_responsibility_visible`)
      && adminTeamResponsibilities.body.includes(`${tag}_responsibility_other_area`)
      && !adminTeamResponsibilities.body.includes(`${tag}_responsibility_other_operation`)
      && !adminTeamResponsibilities.body.includes(`${tag}_responsibility_foreign_org`)
      && !adminTeamResponsibilities.body.includes(`${tag}_responsibility_inactive`)
      && adminTeamResponsibilities.body.includes(member.name),
    "Admin sees active responsibility definitions and current assignments only in the selected operation and organization");
    const supervisorTeamResponsibilities = await ask(sup, "Mostre as responsabilidades da equipe");
    check(supervisorTeamResponsibilities.body.includes(`${tag}_responsibility_visible`)
      && !supervisorTeamResponsibilities.body.includes(`${tag}_responsibility_other_area`)
      && !supervisorTeamResponsibilities.body.includes(`${tag}_responsibility_other_operation`)
      && !supervisorTeamResponsibilities.body.includes(`${tag}_responsibility_foreign_org`),
    "Supervisor responsibility query is restricted to the authorized area and selected operation");
    const unassignedResponsibilities = await ask(manager, "Quais responsabilidades da equipe estão sem responsável?");
    check(unassignedResponsibilities.body.includes(`${tag}_responsibility_unassigned`)
      && unassignedResponsibilities.body.includes(`${tag}_responsibility_expired_assignment`)
      && !unassignedResponsibilities.body.includes(`${tag}_responsibility_visible`)
      && !unassignedResponsibilities.body.includes(`${tag}_responsibility_other_area`)
      && !unassignedResponsibilities.body.includes(`${tag}_responsibility_other_operation`)
      && !unassignedResponsibilities.body.includes(`${tag}_responsibility_foreign_org`)
      && !unassignedResponsibilities.body.includes(`${tag}_responsibility_inactive`),
    "Unassigned responsibility query includes no-current-assignee and expired-assignment records without crossing operation, organization, area, or active-status boundaries");
    const memberTeamResponsibilities = await ask(mine, "Mostre as responsabilidades da equipe");
    check(memberTeamResponsibilities.body.includes("Administração, Direção e Supervisão")
      && !memberTeamResponsibilities.body.includes(`${tag}_responsibility_visible`),
    "Members cannot query team responsibility assignments");
    const memberShowBookDetail = await ask(mine, `Mostre a estrutura do Livro do Show "${showBookLegacy!.title}"`);
    check(memberShowBookDetail.body.includes(`${tag}_scene`) && memberShowBookDetail.body.includes(`${tag}_block`)
      && memberShowBookDetail.body.includes(`${tag}_position`) && memberShowBookDetail.body.includes(`${tag}_unassigned_position`)
      && memberShowBookDetail.body.includes("Posições sem bloco ativo") && memberShowBookDetail.body.includes("mínimo 2")
      && !memberShowBookDetail.body.includes(showScene!.id)
      && !memberShowBookDetail.body.includes(member.id),
    "Show-book detail returns an authorized book's grouped and unassigned positions without record or member identifiers");
    const deniedShowBookDetail = await ask(sup, `Mostre as cenas do Livro do Show "${showBookAssigned!.title}"`);
    check(deniedShowBookDetail.body.includes("Não encontrei um Livro do Show") && !deniedShowBookDetail.body.includes(`${tag}_scene`),
      "Show-book detail hides a book outside the supervisor's official visibility policy");
    const supervisorLibraryLocal = await ask(sup, `Busque na Biblioteca procedimentos de segurança no gelo no local "${tag}"`);
    check(supervisorLibraryLocal.body.includes(`${tag}_library_main_location`)
      && supervisorLibraryLocal.body.includes("v1")
      && supervisorLibraryLocal.body.includes(`${tag}_category`)
      && !supervisorLibraryLocal.body.includes(`${tag}_library_other_location`)
      && supervisorLibraryLocal.body.includes(`Local: ${tag}`),
    "ASA library search returns source version/category and resolves a supervisor's authorized location only");
    const mainLibraryDocumentId = libraryLocationDocs[0]!.id;
    const savedPageCitation = await manager(`/library/documents/${mainLibraryDocumentId}/citations`, {
      version: 1,
      citations: [{ pageNumber: 9, excerpt: "Procedimentos de segurança no gelo para o local principal." }],
    }, "PUT");
    check(savedPageCitation.status === 200, "library manager can save page citations for the current source version");
    const supervisorOwnPageCitation = await sup(`/library/documents/${citationScopeDocs[0]!.id}/citations`, {
      version: 1, citations: [{ pageNumber: 2, excerpt: "Referência de citação da área autorizada." }],
    }, "PUT");
    const supervisorOtherPageCitation = await sup(`/library/documents/${citationScopeDocs[1]!.id}/citations`, {
      version: 1, citations: [{ pageNumber: 2, excerpt: "Referência de citação de outra área." }],
    }, "PUT");
    check(supervisorOwnPageCitation.status === 200 && supervisorOtherPageCitation.status === 403,
      "supervisor can manage citations only for documents in the supervisor's own area");
    const memberPageCitation = await mine(`/library/documents/${mainLibraryDocumentId}/citations`, {
      version: 1, citations: [{ pageNumber: 9, excerpt: "Procedimentos de segurança no gelo para o local principal." }],
    }, "PUT");
    const stalePageCitation = await manager(`/library/documents/${mainLibraryDocumentId}/citations`, { version: 0, citations: [] }, "PUT");
    check(memberPageCitation.status === 403 && stalePageCitation.status === 409,
      "page citations reject non-managers and stale source versions");
    const citedLibrarySearch = await ask(sup, `Busque na Biblioteca procedimentos de segurança no gelo no local "${tag}"`);
    check(citedLibrarySearch.body.includes("Fonte: p. 9 · v1")
      && citedLibrarySearch.body.includes("Procedimentos de segurança no gelo para o local principal.")
      && !citedLibrarySearch.body.includes("Orientação local"),
    "ASA cites only the exact registered excerpt and its verified page and version");
    const supervisorLibraryByTag = await ask(sup, `Busque na Biblioteca ${tag}_resgate`);
    check(supervisorLibraryByTag.body.includes(`${tag}_library_main_location`)
      && !supervisorLibraryByTag.body.includes(`${tag}_library_other_location`),
    "ASA library search matches document tags while preserving the member's official scope");
    const managerLibraryByCategory = await ask(manager, `Busque na Biblioteca ${tag}_category`);
    check(managerLibraryByCategory.body.includes(`${tag}_library_main_location`)
      && managerLibraryByCategory.body.includes(`${tag}_category`),
    "ASA library search matches and identifies an active organization-scoped category");
    const supervisorLibraryOutOfScope = await ask(sup, `Busque na Biblioteca procedimentos de segurança no gelo no local "${tag}_other"`);
    check(supervisorLibraryOutOfScope.body.includes("dentro do seu escopo autorizado")
      && !supervisorLibraryOutOfScope.body.includes(`${tag}_library_other_location`),
    "ASA library search rejects a location outside the supervisor's assigned area/local scopes");
    const managerLibraryOtherLocal = await ask(manager, `Busque na Biblioteca procedimentos de segurança no gelo no local "${tag}_other"`);
    check(managerLibraryOtherLocal.body.includes(`${tag}_library_other_location`)
      && !managerLibraryOtherLocal.body.includes(`${tag}_library_main_location`),
    "ASA library search filters administration results to the exact requested location");
    const managerForeignLibraryLocal = await ask(manager, `Busque na Biblioteca procedimentos de segurança no gelo no local "${tag}_foreign"`);
    check(managerForeignLibraryLocal.body.includes("dentro do seu escopo autorizado")
      && !managerForeignLibraryLocal.body.includes(`${tag}_library_foreign_location`),
    "ASA library search cannot resolve a location belonging to another organization");
    const memberLibraryLocal = await ask(mine, `Busque na Biblioteca procedimentos de segurança no gelo no local "${tag}"`);
    check(memberLibraryLocal.body.includes("não tem acesso autorizado a documentos vinculados a locais")
      && !memberLibraryLocal.body.includes(`${tag}_library_main_location`),
    "ASA library search does not let a member gain access to location documents by naming a location");
    await ask(mine, `Busque na Biblioteca ${tag}_missing_topic`);
    await ask(mine, `Busque na Biblioteca ${tag}_missing_topic`);
    await ask(foreignApi, `Busque na Biblioteca ${tag}_missing_topic`);
    const libraryGapsResponse = await manager("/asa/library-gaps", undefined, "GET");
    const libraryGaps = await libraryGapsResponse.json() as { signals: Array<{ topic: string; count: number }>; windowDays: number };
    const missingTopicSignal = libraryGaps.signals.find((signal) => signal.topic.endsWith("missing topic"));
    check(libraryGapsResponse.status === 200 && libraryGaps.windowDays === 90 && missingTopicSignal?.count === 2
      && !JSON.stringify(libraryGaps).includes(member.id)
      && !JSON.stringify(libraryGaps).includes(foreign.id),
    "Library gap dashboard aggregates unanswered search topics within the authenticated organization without exposing identities");
    const memberLibraryGaps = await mine("/asa/library-gaps", undefined, "GET");
    const directorLibraryGaps = await direction("/asa/library-gaps", undefined, "GET");
    check(memberLibraryGaps.status === 403 && directorLibraryGaps.status === 403,
      "Library gap signals are restricted to Administration rather than exposing queries to members or Direction");
    const pendingLibraryReads = await ask(mine, "Quais leituras estão pendentes na Biblioteca?");
    check(pendingLibraryReads.body.includes(`${tag}_required_unread`)
      && pendingLibraryReads.body.includes(`${tag}_required_confirmed_by_other`)
      && !pendingLibraryReads.body.includes(`${tag}_required_confirmed_by_member`)
      && !pendingLibraryReads.body.includes(`${tag}_required_other_area`)
      && !pendingLibraryReads.body.includes(`${tag}_required_location`)
      && !pendingLibraryReads.body.includes(`${tag}_optional_read`)
      && !pendingLibraryReads.body.includes(`${tag}_draft_required`)
      && !pendingLibraryReads.body.includes(`${tag}_archived_required`)
      && !pendingLibraryReads.body.includes(`${tag}_foreign_required`),
    "ASA pending library reads include only own unconfirmed published required docs in the member's official scope and organization");
    const memberConfirmationsBefore = await db.select().from(libraryViewsTable).where(and(eq(libraryViewsTable.orgId, orgs[0]!.id), eq(libraryViewsTable.userId, member.id)));
    check(memberConfirmationsBefore.length === 1 && memberConfirmationsBefore[0]!.confirmedAt !== null,
      "ASA pending library read query does not write a view or confirmation");
    const supervisorShowBooks = await ask(sup, "Quais Livros do Show estão disponíveis?");
    check(supervisorShowBooks.body.includes(showBookLegacy!.title)
      && !supervisorShowBooks.body.includes(showBookAssigned!.title),
    "Show-book query limits supervisors to books they can operate when a responsible supervisor is assigned");
    const adminShowBooks = await ask(manager, "Quais Livros do Show estão disponíveis?");
    check(adminShowBooks.body.includes(showBookLegacy!.title)
      && adminShowBooks.body.includes(showBookAssigned!.title)
      && !adminShowBooks.body.includes(showBookOtherOperation!.title)
      && !adminShowBooks.body.includes(showBookForeign!.title),
    "Show-book query lets administration read the selected operation within the organization boundary");
    const unselectedOperationShowBooks = await ask(mine, "Quais Livros do Show estão disponíveis?", otherOperation!.id);
    check(!unselectedOperationShowBooks.body.includes(showBookOtherOperation!.title),
      "Show-book query rejects an operation outside the authenticated account's active operation list");
    const preferenceCancel = await ask(mine, "Pause minhas sugestões da ASA");
    assert.equal(preferenceCancel.proposal?.actionType, "ASA_PREFERENCE_UPDATE", preferenceCancel.body);
    check((await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "PROACTIVE",
      "ASA preference preview does not change the current mode");
    const preferenceCancelResult = await mine(`/asa/actions/${preferenceCancel.proposal!.id}/cancel`, {});
    check(preferenceCancelResult.status === 200
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "PROACTIVE",
    "Cancelling a personal preference proposal leaves the current mode unchanged");
    const stalePreference = await ask(mine, "Pause minhas sugestões da ASA");
    await db.update(asaUserPreferencesTable).set({ mode: "BALANCED", updatedAt: new Date() })
      .where(eq(asaUserPreferencesTable.userId, member.id));
    const stalePreferenceResult = await mine(`/asa/actions/${stalePreference.proposal!.id}/confirm`, {});
    check(stalePreferenceResult.status === 409
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "BALANCED",
    "A preference changed after preview invalidates confirmation instead of overwriting the newer choice");
    const pausePreference = await ask(mine, "Pause minhas sugestões da ASA");
    const pausePreferenceResult = await mine(`/asa/actions/${pausePreference.proposal!.id}/confirm`, {});
    check(pausePreferenceResult.status === 200
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "SILENT",
    "Confirming a personal ASA preference proposal pauses suggestions for the authenticated account");
    const resumePreference = await ask(mine, "Retome as sugestões da ASA");
    const resumePreferenceResult = await mine(`/asa/actions/${resumePreference.proposal!.id}/confirm`, {});
    check(resumePreferenceResult.status === 200
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "BALANCED",
    "Confirming a resume proposal restores balanced suggestions for the authenticated account");
    const proactivePreference = await ask(mine, "Ative sugestões proativas da ASA");
    const proactivePreferenceResult = await mine(`/asa/actions/${proactivePreference.proposal!.id}/confirm`, {});
    check(proactivePreferenceResult.status === 200
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "PROACTIVE",
    "A natural-language preference proposal can enable the proactive suggestion mode");
    const balancedPreference = await ask(mine, "Retome as sugestões da ASA");
    check((await mine(`/asa/actions/${balancedPreference.proposal!.id}/confirm`, {})).status === 200
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.mode === "BALANCED",
    "The member can return from proactive to balanced suggestions through the same confirmation flow");
    const frequencyPreview = await ask(mine, "Mude a frequência da ASA para semanal");
    check(frequencyPreview.proposal?.actionType === "ASA_PREFERENCE_UPDATE"
      && frequencyPreview.proposal.changes?.[0]?.after === "Semanal"
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.messageFrequency === "DAILY",
    "A frequency proposal previews the change without altering the stored preference");
    check((await mine(`/asa/actions/${frequencyPreview.proposal!.id}/cancel`, {})).status === 200,
      "A person can cancel a proposed frequency change");
    const reminderPreview = await ask(mine, "Desative meus lembretes da ASA");
    const reminderConfirm = await mine(`/asa/actions/${reminderPreview.proposal!.id}/confirm`, {});
    const updatedPreferences = (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0];
    check(reminderConfirm.status === 200 && updatedPreferences?.reminders === false && updatedPreferences.mode === "BALANCED",
      "Confirming a reminder preference changes only the requested personal field");
    await db.update(asaUserPreferencesTable).set({ goodNightTime: null, updatedAt: new Date() })
      .where(eq(asaUserPreferencesTable.userId, member.id));
    const timePreview = await ask(mine, "Altere o horário da saudação da noite para 21:30");
    check(timePreview.proposal?.changes?.[0]?.before === "Não definido"
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.goodNightTime === null,
    "A null schedule is previewed as unset and remains unchanged before confirmation");
    const timeConfirm = await mine(`/asa/actions/${timePreview.proposal!.id}/confirm`, {});
    check(timeConfirm.status === 200
      && (await db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, member.id)))[0]?.goodNightTime === "21:30",
    "A schedule preference stored as null can be updated after explicit confirmation");
    const directMessageTitle = `${tag}_direct_message`;
    const directPreview = await ask(mine, `Crie uma conversa com "${admin.name}" com o título "${directMessageTitle}" e a mensagem "Mensagem exata para confirmar."`);
    const previewThreads = await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.title, directMessageTitle));
    check(directPreview.proposal?.actionType === "MESSAGE_DIRECT_CREATE"
      && directPreview.proposal.recipientName === admin.name
      && directPreview.body.includes("Mensagem exata para confirmar.")
      && previewThreads.length === 0,
    "Direct-message preview identifies recipient and exact text without creating a conversation");
    const directConfirm = await mine(`/asa/actions/${directPreview.proposal!.id}/confirm`, {});
    const createdThreads = await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.title, directMessageTitle));
    const createdThread = createdThreads[0];
    if (createdThread) messageThreadIds.push(createdThread.id);
    const createdParticipants = createdThread ? await db.select().from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, createdThread.id)) : [];
    const createdMessages = createdThread ? await db.select().from(messagesTable).where(eq(messagesTable.threadId, createdThread.id)) : [];
    const directHistory = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, orgs[0]!.id)))
      .filter(row => row.metadata?.proposalId === directPreview.proposal!.id);
    check(directConfirm.status === 200 && createdThread?.orgId === orgs[0]!.id && createdThread.contextType === "DIRECT"
      && createdParticipants.length === 2 && createdMessages.length === 1
      && createdMessages[0]?.senderId === member.id && createdMessages[0]?.content === "Mensagem exata para confirmar."
      && directHistory.length === 2,
    "Confirmed direct message creates one scoped conversation and message with two Registry events");
    const cancelledMessage = await ask(mine, `Envie uma mensagem para "${admin.name}" com o título "${tag}_cancelled" e o texto "Não enviar"`);
    const cancelResult = await mine(`/asa/actions/${cancelledMessage.proposal!.id}/cancel`, {});
    check(cancelResult.status === 200
      && (await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.title, `${tag}_cancelled`))).length === 0,
    "Cancelling a direct-message proposal sends nothing and creates no conversation");
    const replyTitle = `${tag}_existing_thread`;
    const [replyThread] = await db.insert(messageThreadsTable).values({
      orgId: orgs[0]!.id, title: replyTitle, contextType: "DIRECT", createdBy: admin.id, status: "OPEN",
    }).returning();
    messageThreadIds.push(replyThread!.id);
    await db.insert(messageThreadParticipantsTable).values([
      { threadId: replyThread!.id, userId: admin.id, role: "INITIATOR" },
      { threadId: replyThread!.id, userId: member.id, role: "PARTICIPANT" },
    ]);
    await db.insert(messagesTable).values({
      threadId: replyThread!.id, senderId: admin.id, senderName: admin.name, content: "Contexto anterior.",
    });
    const replyPreview = await ask(mine, `Responda na conversa "${replyTitle}" com a mensagem "Resposta exata da ASA."`);
    let replyMessages = await db.select().from(messagesTable).where(eq(messagesTable.threadId, replyThread!.id));
    check(replyPreview.proposal?.actionType === "MESSAGE_REPLY"
      && replyPreview.proposal.recipientNames?.includes(admin.name)
      && replyPreview.body.includes("Resposta exata da ASA.")
      && replyMessages.length === 1,
    "Reply preview names existing recipients and does not send or create another thread");
    const replyConfirm = await mine(`/asa/actions/${replyPreview.proposal!.id}/confirm`, {});
    replyMessages = await db.select().from(messagesTable).where(eq(messagesTable.threadId, replyThread!.id));
    const replyHistory = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, orgs[0]!.id)))
      .filter(row => row.metadata?.proposalId === replyPreview.proposal!.id);
    check(replyConfirm.status === 200 && replyMessages.length === 2
      && replyMessages.some(row => row.senderId === member.id && row.content === "Resposta exata da ASA.")
      && replyHistory.length === 1,
    "Confirmed reply appends the exact text to the existing thread and records one Registry event");
    const cancelledReply = await ask(mine, `Responda na conversa "${replyTitle}" com a mensagem "Resposta que não deve sair."`);
    const cancelReplyResult = await mine(`/asa/actions/${cancelledReply.proposal!.id}/cancel`, {});
    replyMessages = await db.select().from(messagesTable).where(eq(messagesTable.threadId, replyThread!.id));
    check(cancelReplyResult.status === 200 && replyMessages.length === 2,
    "Cancelling a reply proposal leaves the existing conversation unchanged");
    const staleReply = await ask(mine, `Responda na conversa "${replyTitle}" com a mensagem "Resposta com contexto antigo."`);
    const interveningMessage = await manager(`/messages/threads/${replyThread!.id}/messages`, { content: "Nova informação desde a prévia." });
    const staleReplyConfirm = await mine(`/asa/actions/${staleReply.proposal!.id}/confirm`, {});
    replyMessages = await db.select().from(messagesTable).where(eq(messagesTable.threadId, replyThread!.id));
    check(interveningMessage.status === 201 && staleReplyConfirm.status === 409 && replyMessages.length === 3
      && !replyMessages.some(row => row.content === "Resposta com contexto antigo."),
    "Reply confirmation becomes stale after another participant adds a message");
    const muralTitle = `${tag}_mural_reaction`;
    const [muralPost] = await db.insert(announcementsTable).values({
      orgId: orgs[0]!.id, authorId: admin.id, type: "NOTICE", scope: "HOUSE",
      title: muralTitle, body: "Publicação visível para a organização.",
    }).returning();
    muralPostIds.push(muralPost!.id);
    const hiddenMuralTitle = `${tag}_hidden_mural_reaction`;
    const [hiddenMuralPost] = await db.insert(announcementsTable).values({
      orgId: orgs[0]!.id, authorId: admin.id, type: "NOTICE", scope: "LOCATION",
      locationId: otherLocation!.id, title: hiddenMuralTitle, body: "Publicação restrita a outro local.",
    }).returning();
    muralPostIds.push(hiddenMuralPost!.id);
    const hiddenReaction = await ask(mine, `Reaja ao aviso "${hiddenMuralTitle}"`);
    check(!hiddenReaction.proposal && !hiddenReaction.body.includes("Publicação restrita a outro local."),
      "Mural reaction intent does not reveal a publication outside the member's location scope");
    const hiddenComment = await ask(mine, `Comente na publicação "${hiddenMuralTitle}" com o comentário "Não revelar."`);
    check(!hiddenComment.proposal && !hiddenComment.body.includes("Publicação restrita a outro local."),
      "Mural comment intent does not reveal a publication outside the member's location scope");
    const cancelledReaction = await ask(mine, `Reaja ao aviso "${muralTitle}"`);
    const cancelledReactionResult = await mine(`/asa/actions/${cancelledReaction.proposal!.id}/cancel`, {});
    const reactionsAfterCancel = await db.select().from(announcementReadsTable).where(and(
      eq(announcementReadsTable.announcementId, muralPost!.id), eq(announcementReadsTable.userId, member.id),
    ));
    check(cancelledReaction.proposal?.actionType === "MURAL_REACT" && cancelledReactionResult.status === 200
      && reactionsAfterCancel.length === 0,
    "Cancelling a Mural reaction proposal does not write a reaction");
    const staleReaction = await ask(mine, `Reaja ao aviso "${muralTitle}"`);
    await db.update(announcementsTable).set({ body: "Publicação alterada após a prévia.", updatedAt: new Date() })
      .where(eq(announcementsTable.id, muralPost!.id));
    const staleReactionResult = await mine(`/asa/actions/${staleReaction.proposal!.id}/confirm`, {});
    const reactionsAfterStale = await db.select().from(announcementReadsTable).where(and(
      eq(announcementReadsTable.announcementId, muralPost!.id), eq(announcementReadsTable.userId, member.id),
    ));
    check(staleReactionResult.status === 409 && reactionsAfterStale.length === 0,
      "Changing a Mural publication after preview invalidates the reaction proposal");
    const freshReaction = await ask(mine, `Curta a publicação "${muralTitle}"`);
    const freshReactionResult = await mine(`/asa/actions/${freshReaction.proposal!.id}/confirm`, {});
    const savedReaction = await db.select().from(announcementReadsTable).where(and(
      eq(announcementReadsTable.announcementId, muralPost!.id), eq(announcementReadsTable.userId, member.id),
    ));
    const reactionHistory = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, orgs[0]!.id)))
      .filter(row => row.metadata?.proposalId === freshReaction.proposal!.id);
    check(freshReaction.proposal?.actionType === "MURAL_REACT" && freshReaction.body.includes("Publicação alterada após a prévia.")
      && freshReaction.proposal.reaction === "♥" && freshReactionResult.status === 200
      && savedReaction[0]?.reaction === "♥" && reactionHistory.length === 1,
    "Confirmed Mural reaction uses the current preview and records the heart plus one Registry event");
    const cancelledComment = await ask(mine, `Comente na publicação "${muralTitle}" com o comentário "Comentário cancelado."`);
    const cancelledCommentResult = await mine(`/asa/actions/${cancelledComment.proposal!.id}/cancel`, {});
    check(cancelledComment.proposal?.actionType === "MURAL_COMMENT_CREATE" && cancelledCommentResult.status === 200
      && (await db.select().from(announcementCommentsTable).where(eq(announcementCommentsTable.announcementId, muralPost!.id))).length === 0,
    "Cancelling a Mural comment proposal leaves no published comment");
    const staleComment = await ask(mine, `Comente na publicação "${muralTitle}" com o comentário "Comentário fora de contexto."`);
    await db.update(announcementsTable).set({ body: "Publicação atualizada antes do comentário.", updatedAt: new Date() })
      .where(eq(announcementsTable.id, muralPost!.id));
    const staleCommentResult = await mine(`/asa/actions/${staleComment.proposal!.id}/confirm`, {});
    check(staleCommentResult.status === 409
      && (await db.select().from(announcementCommentsTable).where(eq(announcementCommentsTable.announcementId, muralPost!.id))).length === 0,
    "Changing a Mural publication after preview invalidates its comment proposal");
    const freshComment = await ask(mine, `Escreva um comentário na publicação "${muralTitle}" com o texto "Comentário aprovado pela pessoa."`);
    const freshCommentResult = await mine(`/asa/actions/${freshComment.proposal!.id}/confirm`, {});
    const savedComments = await db.select().from(announcementCommentsTable).where(eq(announcementCommentsTable.announcementId, muralPost!.id));
    const commentHistory = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, orgs[0]!.id)))
      .filter(row => row.metadata?.proposalId === freshComment.proposal!.id);
    check(freshComment.proposal?.actionType === "MURAL_COMMENT_CREATE"
      && freshComment.proposal.content === "Comentário aprovado pela pessoa."
      && freshComment.proposal.announcementContent === "Publicação atualizada antes do comentário."
      && freshCommentResult.status === 200 && savedComments.length === 1
      && savedComments[0]?.body === "Comentário aprovado pela pessoa." && commentHistory.length === 1,
    "Confirmed Mural comment publishes the exact preview content and records one Registry event");
    const requirementsTitle = `${tag}_requirements_task`;
    const [requirementsTask] = await db.insert(tasksTable).values({
      organizationId: orgs[0]!.id,
      operationId: operation!.id,
      title: requirementsTitle,
      creatorId: admin.id,
      assigneeId: member.id,
      dueDate: nextDue,
      status: "IN_PROGRESS",
      mandatoryChecklist: [
        { id: "step_pending", label: "Conferir etiquetas", completed: false },
        { id: "step_done", label: "Separar peças", completed: true },
      ],
      mandatoryEvidences: [
        { id: "evidence_initial", type: "PHOTO", description: "Foto inicial" },
        { id: "evidence_final", type: "PHOTO", description: "Foto final" },
      ],
    }).returning();
    await db.insert(taskEvidencesTable).values({
      taskId: requirementsTask!.id,
      uploaderId: member.id,
      type: "PHOTO",
      url: `https://example.test/${tag}/initial.jpg`,
      isRequired: true,
      mandatoryEvidenceRefId: "evidence_initial",
    });
    const requirementsQuery = await ask(mine, `O que falta para concluir a tarefa "${requirementsTitle}"?`);
    check(requirementsQuery.body.includes("Conferir etiquetas")
      && requirementsQuery.body.includes("Foto final")
      && !requirementsQuery.body.includes("Foto inicial")
      && !requirementsQuery.body.includes("Separar peças"),
    "Personal task requirements query returns only incomplete mandatory checklist and missing evidence");
    const otherPersonRequirements = await ask(outside, `O que falta para concluir a tarefa "${requirementsTitle}"?`);
    check(otherPersonRequirements.body.includes("Não encontrei uma tarefa aberta")
      && !otherPersonRequirements.body.includes("Conferir etiquetas")
      && !otherPersonRequirements.body.includes("Foto final"),
    "Task requirements query does not disclose another person's assignments");
    await db.update(tasksTable).set({ mandatoryChecklist: [
      { id: "step_pending", label: "Conferir etiquetas", completed: true },
      { id: "step_done", label: "Separar peças", completed: true },
    ] }).where(eq(tasksTable.id, requirementsTask!.id));
    await db.insert(taskEvidencesTable).values({
      taskId: requirementsTask!.id,
      uploaderId: member.id,
      type: "PHOTO",
      url: `https://example.test/${tag}/final.jpg`,
      isRequired: true,
      mandatoryEvidenceRefId: "evidence_final",
    });
    const fulfilledRequirements = await ask(mine, `O que falta para concluir a tarefa "${requirementsTitle}"?`);
    check(fulfilledRequirements.body.includes("requisitos registrados")
      && fulfilledRequirements.body.includes("aprovação")
      && !fulfilledRequirements.body.includes("Foto final"),
    "Task requirements query reports readiness only after checklist and required evidence are complete");
    const activitiesQuery = await ask(manager, "Quais atividades recorrentes temos?");
    check(activitiesQuery.body.includes(`${tag}_visible_activity`)
      && activitiesQuery.body.includes("Seg 18:00–19:30")
      && activitiesQuery.body.includes(member.name)
      && !activitiesQuery.body.includes(`${tag}_other_operation_activity`)
      && !activitiesQuery.body.includes(`${tag}_foreign_activity`)
      && !activitiesQuery.body.includes(`${tag}_inactive_activity`)
      && !activitiesQuery.body.includes(foreign.name),
    "Recurring activity query returns only active activities and same-organization assignees from the selected operation");
    const memberActivitiesQuery = await ask(mine, "atividades recorrentes");
    check(memberActivitiesQuery.body.includes("somente para Administração e Supervisão")
      && !memberActivitiesQuery.body.includes(`${tag}_visible_activity`),
    "Recurring activity query denies members without disclosing activity titles");
    const directorActivitiesQuery = await ask(direction, "atividades recorrentes");
    check(directorActivitiesQuery.body.includes("somente para Administração e Supervisão")
      && !directorActivitiesQuery.body.includes(`${tag}_visible_activity`),
    "Recurring activity query denies Direction because the official activities route does not grant that role");
    const otherOperationActivitiesQuery = await ask(manager, "atividades recorrentes", otherOperation!.id);
    check(!otherOperationActivitiesQuery.body.includes(`${tag}_other_operation_activity`)
      && !otherOperationActivitiesQuery.body.includes("Atividades recorrentes ativas em"),
    "Recurring activity query refuses an operation outside the authenticated operation list");
    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, supervisor.membershipId));
    const revokedSupervisorActivitiesQuery = await ask(sup, "atividades recorrentes");
    await db.update(userRolesTable).set({ active: true }).where(eq(userRolesTable.id, supervisor.membershipId));
    check(revokedSupervisorActivitiesQuery.body.includes("Seu acesso de gestão a esta operação não está ativo")
      && !revokedSupervisorActivitiesQuery.body.includes(`${tag}_visible_activity`),
    "Recurring activity query revalidates supervisor membership before returning data");
    const dueSoonInquiry = await ask(mine, "Quais tarefas tenho com prazo nos próximos 3 dias?");
    check(dueSoonInquiry.body.includes(`${tag}_soon_self`)
      && !dueSoonInquiry.body.includes(`${tag}_soon_other`)
      && !dueSoonInquiry.body.includes(`${tag}_soon_waiting_approval`)
      && !dueSoonInquiry.body.includes(`${tag}_outside_soon_window`),
    "Next-three-day task query matches the personal actionable summary window and excludes other people, approval, and later dates");
    await db.insert(folgasTable).values([
      { userId: member.id, operationId: operation!.id, startDate: today, endDate: today, createdBy: admin.id, notes: `${tag}_own_leave` },
      { userId: outsider.id, operationId: operation!.id, startDate: today, endDate: today, createdBy: admin.id, notes: `${tag}_other_person_leave` },
      { userId: foreign.id, operationId: foreignOperation!.id, startDate: today, endDate: today, createdBy: foreign.id, notes: `${tag}_foreign_org_leave` },
    ]);
    const ownLeaveInquiry = await ask(mine, "minhas folgas hoje");
    check(ownLeaveInquiry.body.includes(`${tag}_own_leave`)
      && !ownLeaveInquiry.body.includes(`${tag}_other_person_leave`)
      && !ownLeaveInquiry.body.includes(`${tag}_foreign_org_leave`),
    "ASA personal leave lookup is restricted to the authenticated user and organization");

    const agendaVisibilityFixtures = await db.insert(agendaEventsTable).values([
      { operationId: operation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_member_participant`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_member_nonparticipant`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_member_management_only`, date: today, status: "CONFIRMED", visibility: "MANAGEMENT", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_member_completed`, date: today, status: "COMPLETED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_member_created_confirmed`, date: today, status: "CONFIRMED", visibility: "MANAGEMENT", createdBy: member.id },
      { operationId: otherOperation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_member_other_operation`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: location!.id, type: "MEETING", title: `${tag}_supervisor_in_scope`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: otherArea!.id, locationId: location!.id, type: "MEETING", title: `${tag}_supervisor_other_area`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: otherLocation!.id, type: "MEETING", title: `${tag}_supervisor_other_location`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
      { operationId: operation!.id, areaId: area!.id, locationId: null, type: "MEETING", title: `${tag}_supervisor_area_unlocated`, date: today, status: "CONFIRMED", visibility: "OPERATION", createdBy: admin.id },
    ]).returning();
    await db.insert(agendaEventParticipantsTable).values([
      { eventId: agendaVisibilityFixtures[0]!.id, userId: member.id },
      { eventId: agendaVisibilityFixtures[2]!.id, userId: member.id },
      { eventId: agendaVisibilityFixtures[3]!.id, userId: member.id },
      { eventId: agendaVisibilityFixtures[5]!.id, userId: member.id },
    ]);
    const memberAgendaInquiry = await ask(mine, "agenda da operação");
    check(memberAgendaInquiry.body.includes(`${tag}_member_participant`)
      && memberAgendaInquiry.body.includes(`${tag}_member_created_confirmed`)
      && !memberAgendaInquiry.body.includes(`${tag}_member_nonparticipant`)
      && !memberAgendaInquiry.body.includes(`${tag}_member_management_only`)
      && !memberAgendaInquiry.body.includes(`${tag}_member_completed`)
      && !memberAgendaInquiry.body.includes(`${tag}_member_other_operation`),
    "ASA member agenda follows the official participant, visibility, status, own-event, and operation scope");
    const supervisorAgendaInquiry = await ask(sup, "agenda da operação");
    check(supervisorAgendaInquiry.body.includes(`${tag}_supervisor_in_scope`)
      && supervisorAgendaInquiry.body.includes(`${tag}_supervisor_area_unlocated`)
      && !supervisorAgendaInquiry.body.includes(`${tag}_supervisor_other_area`)
      && !supervisorAgendaInquiry.body.includes(`${tag}_supervisor_other_location`),
    "ASA supervisor agenda follows the official area-plus-location scope, including area-wide events");

    await db.insert(agendaEventsTable).values([
      { operationId: operation!.id, type: "MEETING", title: `${tag}_own_proposed`, date: today, status: "PROPOSED", visibility: "OPERATION", createdBy: member.id },
      { operationId: operation!.id, type: "MEETING", title: `${tag}_own_rejected`, date: today, status: "REJECTED", visibility: "OPERATION", createdBy: member.id, reason: "Conflito de horário", alternativeDetails: "Tentar após as 16h" },
      { operationId: operation!.id, type: "MEETING", title: `${tag}_other_proposed`, date: today, status: "PROPOSED", visibility: "OPERATION", createdBy: outsider.id },
      { operationId: otherOperation!.id, type: "MEETING", title: `${tag}_other_operation_proposed`, date: today, status: "PROPOSED", visibility: "OPERATION", createdBy: member.id },
    ]);
    const ownProposalInquiry = await ask(mine, "Quais são minhas propostas de reunião?");
    check(ownProposalInquiry.body.includes(`${tag}_own_proposed`) && ownProposalInquiry.body.includes(`${tag}_own_rejected`)
      && ownProposalInquiry.body.includes("Conflito de horário") && ownProposalInquiry.body.includes("Tentar após as 16h")
      && !ownProposalInquiry.body.includes(`${tag}_other_proposed`)
      && !ownProposalInquiry.body.includes(`${tag}_other_operation_proposed`),
    "ASA proposal lookup is limited to the member's own pending and rejected meetings in the selected operation");

    const preview = async (kind: "TASK_CREATE" | "NOTICE_DRAFT_CREATE", title: string, client = manager, checklistLabels?: string[], mandatoryEvidences?: Array<{ type: string; description: string }>, description?: string, responsibilityTitle?: string) => {
      const answer = await ask(client, kind === "TASK_CREATE" ? taskText(title, member.name, checklistLabels, mandatoryEvidences, description, responsibilityTitle) : noticeText(title));
      assert.equal(answer.proposal?.actionType, kind, answer.body);
      return answer.proposal!;
    };
    const targets = async (kind: string, title: string) => kind === "TASK_CREATE"
      ? db.select().from(tasksTable).where(and(eq(tasksTable.operationId, operation!.id), eq(tasksTable.title, title)))
      : db.select().from(noticesTable).where(and(eq(noticesTable.operationId, operation!.id), eq(noticesTable.title, title)));
    const audit = async (id: string) => (await db.select().from(asaAuditLogTable).where(eq(asaAuditLogTable.id, id)))[0]!;
    const state = async (id: string) => (await audit(id)).actionsExecuted?.find(item => item.action === "ASA_ACTION_PROPOSAL")?.state;
    const history = async (id: string) => (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, orgs[0]!.id))).filter(row => row.metadata?.proposalId === id);

    const editNoticeDraft = (title: string, newTitle: string, content: string) =>
      `edite o rascunho de aviso "${title}" para "${newTitle}" com o texto "${content}"`;
    const [draftToEdit] = await db.insert(noticesTable).values({
      authorId: admin.id, operationId: operation!.id, title: `${tag}_editable_notice`,
      content: "Texto original do rascunho", status: "DRAFT", urgency: "IMPORTANT", type: "INFORMATIVE",
    }).returning();
    const draftUpdatePreview = await ask(manager, editNoticeDraft(draftToEdit!.title!, `${tag}_updated_notice`, "Texto novo do rascunho"));
    check(draftUpdatePreview.proposal?.actionType === "NOTICE_DRAFT_UPDATE"
      && draftUpdatePreview.body.includes("Texto original do rascunho")
      && draftUpdatePreview.body.includes("Texto novo do rascunho")
      && draftUpdatePreview.body.includes("não será publicado")
      && (await db.select().from(noticesTable).where(eq(noticesTable.id, draftToEdit!.id)))[0]?.content === "Texto original do rascunho",
    "Notice draft update preview shows exact before/after and does not write or publish");
    const draftUpdateProposal = draftUpdatePreview.proposal!;
    const draftUpdateResult = await manager(`/asa/actions/${draftUpdateProposal.id}/confirm`, {});
    const updatedDraft = (await db.select().from(noticesTable).where(eq(noticesTable.id, draftToEdit!.id)))[0];
    check(draftUpdateResult.status === 200 && updatedDraft?.title === `${tag}_updated_notice`
      && updatedDraft.content === "Texto novo do rascunho" && updatedDraft.status === "DRAFT"
      && (await history(draftUpdateProposal.id)).length === 1
      && (await audit(draftUpdateProposal.id)).confirmedByUser,
    "Confirmed notice draft update changes only title/content, keeps DRAFT status, and records one Registry event");

    const [staleDraft] = await db.insert(noticesTable).values({
      authorId: admin.id, operationId: operation!.id, title: `${tag}_stale_notice_draft`,
      content: "Texto antes da concorrência", status: "DRAFT", urgency: "IMPORTANT", type: "INFORMATIVE",
    }).returning();
    const staleDraftPreview = await ask(manager, editNoticeDraft(staleDraft!.title!, `${tag}_should_not_apply`, "Novo texto"));
    await db.update(noticesTable).set({ content: "Alteração concorrente" }).where(eq(noticesTable.id, staleDraft!.id));
    const staleDraftConfirm = await manager(`/asa/actions/${staleDraftPreview.proposal!.id}/confirm`, {});
    const staleDraftAfter = (await db.select().from(noticesTable).where(eq(noticesTable.id, staleDraft!.id)))[0];
    check(staleDraftConfirm.status === 409 && staleDraftAfter?.title === staleDraft!.title
      && staleDraftAfter.content === "Alteração concorrente"
      && (await state(staleDraftPreview.proposal!.id)) === "STALE",
    "Concurrent notice draft content change invalidates the preview without overwriting it");

    const [cancelDraft] = await db.insert(noticesTable).values({
      authorId: admin.id, operationId: operation!.id, title: `${tag}_cancel_notice_draft`,
      content: "Texto que deve permanecer", status: "DRAFT", urgency: "IMPORTANT", type: "INFORMATIVE",
    }).returning();
    const cancelDraftPreview = await ask(manager, editNoticeDraft(cancelDraft!.title!, "Não aplicar", "Texto não aplicado"));
    const cancelDraftResult = await manager(`/asa/actions/${cancelDraftPreview.proposal!.id}/cancel`, {});
    const cancelledDraft = (await db.select().from(noticesTable).where(eq(noticesTable.id, cancelDraft!.id)))[0];
    check(cancelDraftResult.status === 200 && cancelledDraft?.title === cancelDraft!.title
      && cancelledDraft.content === "Texto que deve permanecer"
      && (await state(cancelDraftPreview.proposal!.id)) === "CANCELLED",
    "Cancelling a notice draft update leaves its title and content unchanged");

    const [duplicateDraftOne, duplicateDraftTwo] = await db.insert(noticesTable).values([
      { authorId: admin.id, operationId: operation!.id, title: `${tag}_duplicate_notice_draft`, content: "Primeiro", status: "DRAFT", urgency: "IMPORTANT", type: "INFORMATIVE" },
      { authorId: admin.id, operationId: operation!.id, title: `${tag}_duplicate_notice_draft`, content: "Segundo", status: "DRAFT", urgency: "IMPORTANT", type: "INFORMATIVE" },
    ]).returning();
    const duplicateDraftAsk = await ask(manager, editNoticeDraft(duplicateDraftOne!.title!, "Título escolhido", "Texto novo"));
    check(!duplicateDraftAsk.proposal && duplicateDraftAsk.body.includes("mais de um rascunho")
      && (await db.select().from(noticesTable).where(inArray(noticesTable.id, [duplicateDraftOne!.id, duplicateDraftTwo!.id]))).every((row) => row.content === (row.id === duplicateDraftOne!.id ? "Primeiro" : "Segundo")),
    "Duplicate exact-title drafts require clarification and are never changed");

    const [meetingDraft] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id, type: "MEETING", title: `${tag}_editable_meeting`, date: today,
      startTime: "14:00", endTime: "15:00", status: "DRAFT", createdBy: admin.id,
    }).returning();
    const renameMeeting = (title: string, newTitle: string) =>
      `renomeie o rascunho da reunião "${title}" para "${newTitle}"`;
    const renameMeetingPreview = await ask(manager, renameMeeting(meetingDraft!.title, `${tag}_renamed_meeting`));
    check(renameMeetingPreview.proposal?.actionType === "AGENDA_DRAFT_RENAME"
      && renameMeetingPreview.body.includes(`${tag}_editable_meeting → ${tag}_renamed_meeting`)
      && renameMeetingPreview.body.includes("continuará como rascunho")
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0]?.title === meetingDraft!.title,
    "Agenda draft rename preview compares exact title and leaves the event untouched");
    const renamedMeetingResult = await manager(`/asa/actions/${renameMeetingPreview.proposal!.id}/confirm`, {});
    const renamedMeeting = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(renamedMeetingResult.status === 200 && renamedMeeting?.title === `${tag}_renamed_meeting`
      && renamedMeeting.status === "DRAFT" && renamedMeeting.date === today
      && renamedMeeting.startTime === "14:00:00" && renamedMeeting.endTime === "15:00:00"
      && (await history(renameMeetingPreview.proposal!.id)).length === 1,
    "Confirmed Agenda draft rename changes only its title and records one Registry event");

    const moveMeetingTime = (title: string, newDate: string, startTime: string, endTime: string) =>
      `altere a data e o horário do rascunho da reunião "${title}" para ${newDate} das ${startTime} às ${endTime}`;
    const cancelledSchedulePreview = await ask(manager, moveMeetingTime(renamedMeeting!.title, nextDue, "08:00", "09:00"));
    const cancelledScheduleResult = await manager(`/asa/actions/${cancelledSchedulePreview.proposal!.id}/cancel`, {});
    const unchangedMeetingAfterCancel = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(cancelledScheduleResult.status === 200 && unchangedMeetingAfterCancel?.date === today
      && unchangedMeetingAfterCancel.startTime === "14:00:00"
      && (await state(cancelledSchedulePreview.proposal!.id)) === "CANCELLED",
    "Cancelling an Agenda schedule proposal leaves the event untouched");
    const directorScheduleProposal = await ask(direction, moveMeetingTime(renamedMeeting!.title, nextDue, "08:30", "09:30"));
    let directorProposalCancelStatus = 0;
    if (directorScheduleProposal.proposal) {
      directorProposalCancelStatus = (await direction(`/asa/actions/${directorScheduleProposal.proposal.id}/cancel`, {})).status;
    }
    check(directorScheduleProposal.proposal?.actionType === "AGENDA_DRAFT_SCHEDULE_UPDATE"
      && directorScheduleProposal.body.includes("Prévia para alterar a data e o horário")
      && directorScheduleProposal.body.includes(renamedMeeting!.title) && directorProposalCancelStatus === 200,
    "Direction can prepare Agenda draft schedule changes under the official Agenda role policy");
    const meetingSchedulePreview = await ask(manager, moveMeetingTime(renamedMeeting!.title, nextDue, "09:30", "10:15"));
    check(meetingSchedulePreview.proposal?.actionType === "AGENDA_DRAFT_SCHEDULE_UPDATE"
      && meetingSchedulePreview.proposal.previousDate === today && meetingSchedulePreview.proposal.date === nextDue
      && meetingSchedulePreview.body.includes("14:00:00–15:00:00 → 09:30–10:15")
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0]?.date === today,
    "Agenda schedule preview shows before/after date and time without changing the draft");
    const meetingScheduleResult = await manager(`/asa/actions/${meetingSchedulePreview.proposal!.id}/confirm`, {});
    const movedMeeting = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(meetingScheduleResult.status === 200 && movedMeeting?.date === nextDue
      && movedMeeting.startTime === "09:30:00" && movedMeeting.endTime === "10:15:00"
      && movedMeeting.status === "DRAFT" && movedMeeting.title === `${tag}_renamed_meeting`
      && (await history(meetingSchedulePreview.proposal!.id)).length === 1,
    "Confirmed Agenda schedule update changes date/time only and records one Registry event");

    const updateMeetingNotes = (title: string, notes: string) =>
      `altere as observações do rascunho da reunião "${title}" para "${notes}"`;
    const notesPreview = await ask(manager, updateMeetingNotes(movedMeeting!.title, "Levar figurinos e confirmar a sala"));
    const meetingBeforeNotesConfirm = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(notesPreview.proposal?.actionType === "AGENDA_DRAFT_NOTES_UPDATE"
      && notesPreview.body.includes("Observações atuais: nenhuma")
      && notesPreview.body.includes("Levar figurinos e confirmar a sala")
      && notesPreview.body.includes("continuará como rascunho")
      && (meetingBeforeNotesConfirm?.notes ?? null) === null,
    "Agenda draft notes preview shows before/after and does not write");
    const notesUpdateResult = await manager(`/asa/actions/${notesPreview.proposal!.id}/confirm`, {});
    const meetingAfterNotesConfirm = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(notesUpdateResult.status === 200 && meetingAfterNotesConfirm?.notes === "Levar figurinos e confirmar a sala"
      && meetingAfterNotesConfirm.title === movedMeeting!.title && meetingAfterNotesConfirm.date === movedMeeting!.date
      && meetingAfterNotesConfirm.startTime === movedMeeting!.startTime && meetingAfterNotesConfirm.endTime === movedMeeting!.endTime
      && meetingAfterNotesConfirm.status === "DRAFT" && (await history(notesPreview.proposal!.id)).length === 1,
    "Confirmed Agenda notes update changes notes only and records one Registry event");

    const notesCancelPreview = await ask(manager, updateMeetingNotes(movedMeeting!.title, "Texto que não deve ser aplicado"));
    const notesCancelResult = await manager(`/asa/actions/${notesCancelPreview.proposal!.id}/cancel`, {});
    const meetingAfterNotesCancel = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(notesCancelResult.status === 200 && meetingAfterNotesCancel?.notes === "Levar figurinos e confirmar a sala"
      && (await state(notesCancelPreview.proposal!.id)) === "CANCELLED",
    "Cancelling an Agenda notes proposal leaves the current notes unchanged");

    const noOpNotes = await ask(manager, updateMeetingNotes(movedMeeting!.title, "Levar figurinos e confirmar a sala"));
    check(!noOpNotes.proposal && noOpNotes.body.includes("já estão assim")
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0]?.notes === "Levar figurinos e confirmar a sala",
    "An identical Agenda notes update returns without creating a confirmation proposal");

    const clearNotesText = (title: string) => `remova as observações do rascunho da reunião "${title}"`;
    const clearNotesPreview = await ask(manager, clearNotesText(movedMeeting!.title));
    check(clearNotesPreview.proposal?.actionType === "AGENDA_DRAFT_NOTES_UPDATE"
      && clearNotesPreview.proposal.notes === null
      && clearNotesPreview.body.includes("nenhuma (serão removidas)")
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0]?.notes === "Levar figurinos e confirmar a sala",
    "Clearing Agenda draft notes requires a proposal and leaves notes unchanged before confirmation");
    const clearNotesResult = await manager(`/asa/actions/${clearNotesPreview.proposal!.id}/confirm`, {});
    const meetingAfterClearNotes = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, meetingDraft!.id)))[0];
    check(clearNotesResult.status === 200 && meetingAfterClearNotes?.notes === null
      && meetingAfterClearNotes.title === movedMeeting!.title && meetingAfterClearNotes.date === movedMeeting!.date
      && meetingAfterClearNotes.status === "DRAFT" && (await history(clearNotesPreview.proposal!.id)).length === 1,
    "Confirmed Agenda notes removal clears only notes and records one Registry event");

    const [staleNotesMeeting] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id, type: "MEETING", title: `${tag}_stale_notes`, date: today,
      startTime: "11:00", endTime: "12:00", notes: "Observação anterior", status: "DRAFT", createdBy: admin.id,
    }).returning();
    const staleNotesPreview = await ask(manager, updateMeetingNotes(staleNotesMeeting!.title, "Atualização que não deve sobrescrever"));
    await db.update(agendaEventsTable).set({ notes: "Alteração concorrente" }).where(eq(agendaEventsTable.id, staleNotesMeeting!.id));
    const staleNotesResult = await manager(`/asa/actions/${staleNotesPreview.proposal!.id}/confirm`, {});
    const staleNotesAfter = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, staleNotesMeeting!.id)))[0];
    check(staleNotesResult.status === 409 && staleNotesAfter?.notes === "Alteração concorrente"
      && (await state(staleNotesPreview.proposal!.id)) === "STALE",
    "Concurrent Agenda notes change invalidates the preview without overwriting it");

    const notesCancelForDirector = await ask(direction, updateMeetingNotes(movedMeeting!.title, "Teste de permissão"));
    const directorNotesCancelStatus = notesCancelForDirector.proposal
      ? (await direction(`/asa/actions/${notesCancelForDirector.proposal.id}/cancel`, {})).status : 0;
    check(notesCancelForDirector.proposal?.actionType === "AGENDA_DRAFT_NOTES_UPDATE" && directorNotesCancelStatus === 200,
    "Direction can cancel an Agenda draft notes proposal under the official role policy");
    const memberNotesAttempt = await ask(mine, updateMeetingNotes(movedMeeting!.title, "Não permitido"));
    check(!memberNotesAttempt.proposal && memberNotesAttempt.body.includes("apenas para gestores autorizados"),
    "Members cannot create a proposal to update Agenda draft notes");

    const [staleScheduleMeeting] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id, type: "MEETING", title: `${tag}_stale_schedule`, date: today,
      startTime: "11:00", endTime: "12:00", status: "DRAFT", createdBy: admin.id,
    }).returning();
    const staleSchedulePreview = await ask(manager, moveMeetingTime(staleScheduleMeeting!.title, nextDue, "13:00", "14:00"));
    await db.update(agendaEventsTable).set({ endTime: "12:30" }).where(eq(agendaEventsTable.id, staleScheduleMeeting!.id));
    const staleScheduleResult = await manager(`/asa/actions/${staleSchedulePreview.proposal!.id}/confirm`, {});
    const staleScheduleAfter = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, staleScheduleMeeting!.id)))[0];
    check(staleScheduleResult.status === 409 && staleScheduleAfter?.date === today
      && staleScheduleAfter.endTime === "12:30:00" && (await state(staleSchedulePreview.proposal!.id)) === "STALE",
    "Concurrent Agenda schedule change invalidates the preview without overwriting it");

    const memberScheduleAttempt = await ask(mine, moveMeetingTime(renamedMeeting!.title, nextDue, "13:00", "14:00"));
    check(!memberScheduleAttempt.proposal && memberScheduleAttempt.body.includes("apenas para gestores autorizados"),
    "Members cannot create a proposal to update an Agenda draft schedule");

    const [staleMeeting] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id, type: "MEETING", title: `${tag}_stale_meeting`, date: today,
      startTime: "16:00", endTime: "17:00", status: "DRAFT", createdBy: admin.id,
    }).returning();
    const staleMeetingPreview = await ask(manager, renameMeeting(staleMeeting!.title, `${tag}_must_not_rename`));
    await db.update(agendaEventsTable).set({ startTime: "16:30" }).where(eq(agendaEventsTable.id, staleMeeting!.id));
    const staleMeetingResult = await manager(`/asa/actions/${staleMeetingPreview.proposal!.id}/confirm`, {});
    const staleMeetingAfter = (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, staleMeeting!.id)))[0];
    check(staleMeetingResult.status === 409 && staleMeetingAfter?.title === staleMeeting!.title
      && (await state(staleMeetingPreview.proposal!.id)) === "STALE",
    "Concurrent Agenda event change invalidates the preview without overwriting it");

    const [duplicateMeetingOne, duplicateMeetingTwo] = await db.insert(agendaEventsTable).values([
      { operationId: operation!.id, type: "MEETING", title: `${tag}_duplicate_meeting`, date: today, status: "DRAFT", createdBy: admin.id },
      { operationId: operation!.id, type: "MEETING", title: `${tag}_duplicate_meeting`, date: today, status: "DRAFT", createdBy: admin.id },
    ]).returning();
    const duplicateMeetingAsk = await ask(manager, renameMeeting(duplicateMeetingOne!.title, "Título escolhido"));
    check(!duplicateMeetingAsk.proposal && duplicateMeetingAsk.body.includes("mais de um rascunho")
      && (await db.select().from(agendaEventsTable).where(inArray(agendaEventsTable.id, [duplicateMeetingOne!.id, duplicateMeetingTwo!.id])))
        .every((event) => event.title === `${tag}_duplicate_meeting`),
    "Duplicate Agenda draft titles require clarification and remain unchanged");

    const [confirmedMeeting] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id, type: "MEETING", title: `${tag}_confirmed_meeting`, date: today,
      status: "CONFIRMED", createdBy: admin.id,
    }).returning();
    const confirmedMeetingAsk = await ask(manager, renameMeeting(confirmedMeeting!.title, "Não alterar confirmado"));
    check(!confirmedMeetingAsk.proposal && confirmedMeetingAsk.body.includes("não encontrei")
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, confirmedMeeting!.id)))[0]?.title === confirmedMeeting!.title,
    "Confirmed Agenda events are excluded from the draft rename action");

    const memberRenameAttempt = await ask(mine, renameMeeting(meetingDraft!.title, "Não renomear"));
    check(!memberRenameAttempt.proposal && memberRenameAttempt.body.includes("apenas para gestores autorizados"),
    "Members cannot create a proposal to rename an Agenda draft");

    const [publishedNotice] = await db.insert(noticesTable).values({
      authorId: admin.id, operationId: operation!.id, title: `${tag}_published_notice`,
      content: "Aviso publicado", status: "PUBLISHED", publishedAt: new Date(), urgency: "IMPORTANT", type: "INFORMATIVE",
    }).returning();
    const publishedEdit = await ask(manager, editNoticeDraft(publishedNotice!.title!, `${tag}_wrong_edit`, "Texto"));
    check(!publishedEdit.proposal && publishedEdit.body.includes("não encontrei")
      && (await db.select().from(noticesTable).where(eq(noticesTable.id, publishedNotice!.id)))[0]?.content === "Aviso publicado",
    "ASA refuses editing published notices through the draft-update command");
    const memberEdit = await ask(mine, editNoticeDraft(draftToEdit!.title!, "Alteração sem permissão", "Texto"));
    check(!memberEdit.proposal && memberEdit.body.includes("gestores autorizados"),
    "Notice draft update is restricted to manager profiles");

    const checklistTitle = `${tag}_checklist_task`;
    const responsibilityTitle = `${tag}_responsibility`;
    const [taskResponsibility] = await db.insert(responsibilitiesTable).values({
      orgId: orgs[0]!.id, operationId: operation!.id, areaId: area!.id,
      title: responsibilityTitle, category: "OPERAÇÃO", active: true,
    }).returning();
    await db.insert(responsibilitiesTable).values({
      orgId: orgs[0]!.id, operationId: null, areaId: area!.id,
      title: responsibilityTitle, category: "OPERAÇÃO", active: true,
    });
    const otherOperationResponsibilityTitle = `${tag}_other_operation_responsibility`;
    await db.insert(responsibilitiesTable).values({
      orgId: orgs[0]!.id, operationId: otherOperation!.id, areaId: area!.id,
      title: otherOperationResponsibilityTitle, category: "OPERAÇÃO", active: true,
    });
    const outOfScopeTaskTitle = `${tag}_out_of_scope_responsibility_task`;
    const outOfScopeResponsibilityAsk = await ask(manager, taskText(outOfScopeTaskTitle, member.name, undefined, undefined, undefined, otherOperationResponsibilityTitle));
    check(!outOfScopeResponsibilityAsk.proposal && outOfScopeResponsibilityAsk.body.includes("Não encontrei uma responsabilidade ativa")
      && (await targets("TASK_CREATE", outOfScopeTaskTitle)).length === 0,
    "Task creation cannot link a responsibility from another operation");
    const requestedChecklist = ["Separar peças", "Conferir etiquetas"];
    const requestedEvidence = [{ type: "PHOTO", description: "imagem final" }, { type: "PDF", description: "relatório assinado" }];
    const requestedDescription = "Conferir os dados antes de fechar a tarefa.";
    const checklistProposal = await preview("TASK_CREATE", checklistTitle, manager, requestedChecklist, requestedEvidence, requestedDescription, responsibilityTitle);
    check(checklistProposal.checklistLabels?.join("|") === requestedChecklist.join("|")
      && checklistProposal.mandatoryEvidences?.map(item => `${item.type}:${item.description}`).join("|") === requestedEvidence.map(item => `${item.type}:${item.description}`).join("|")
      && checklistProposal.description === requestedDescription
      && checklistProposal.responsibilityTitle === responsibilityTitle
      && checklistProposal.expiresAt
      && (await audit(checklistProposal.id)).response.includes("Checklist obrigatória")
      && (await audit(checklistProposal.id)).response.includes("Conferir etiquetas")
      && (await audit(checklistProposal.id)).response.includes("FOTO: imagem final")
      && (await audit(checklistProposal.id)).response.includes("PDF: relatório assinado")
      && (await audit(checklistProposal.id)).response.includes(requestedDescription)
      && (await audit(checklistProposal.id)).response.includes(`Responsabilidade: ${responsibilityTitle}`)
      && (await targets("TASK_CREATE", checklistTitle)).length === 0,
    "Task creation preview shows explicit checklist and typed evidence requirements without creating a task");
    const checklistConfirmation = await manager(`/asa/actions/${checklistProposal.id}/confirm`, {});
    const checklistRows = await targets("TASK_CREATE", checklistTitle);
    const savedChecklist = (checklistRows[0] as typeof tasksTable.$inferSelect | undefined)?.mandatoryChecklist ?? [];
    const savedEvidence = (checklistRows[0] as typeof tasksTable.$inferSelect | undefined)?.mandatoryEvidences ?? [];
    check(checklistConfirmation.status === 200
      && (checklistRows[0] as typeof tasksTable.$inferSelect | undefined)?.description === requestedDescription
      && (checklistRows[0] as typeof tasksTable.$inferSelect | undefined)?.responsibilityId === taskResponsibility!.id
      && savedChecklist.length === requestedChecklist.length
      && savedChecklist.map(item => item.label).join("|") === requestedChecklist.join("|")
      && savedChecklist.every(item => !item.completed)
      && savedEvidence.length === requestedEvidence.length
      && savedEvidence.map(item => `${item.type}:${item.description}`).join("|") === requestedEvidence.map(item => `${item.type}:${item.description}`).join("|")
      && savedEvidence.every(item => item.id.length > 0)
      && new Set(savedEvidence.map(item => item.id)).size === savedEvidence.length
      && (await history(checklistProposal.id)).length === 1,
    "Confirmed task creation saves incomplete checklist items, typed evidence requirements, and one Registry event");

    const newResponsibilityTitle = `${tag}_responsibility_target`;
    const [targetResponsibility] = await db.insert(responsibilitiesTable).values({
      orgId: orgs[0]!.id, operationId: operation!.id, areaId: area!.id,
      title: newResponsibilityTitle, category: "OPERAÇÃO", active: true,
    }).returning();
    const foreignResponsibilityChange = await ask(manager, `Altere a responsabilidade da tarefa "${checklistTitle}" para "${otherOperationResponsibilityTitle}"`);
    check(!foreignResponsibilityChange.proposal && foreignResponsibilityChange.body.includes("Não encontrei uma responsabilidade ativa")
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect | undefined)?.responsibilityId === taskResponsibility!.id,
    "Task responsibility update cannot target a responsibility from another operation");
    const cancelledResponsibility = await ask(manager, `Altere a responsabilidade da tarefa "${checklistTitle}" para "${responsibilityTitle}"`);
    assert.equal(cancelledResponsibility.proposal?.actionType, "TASK_UPDATE_RESPONSIBILITY", cancelledResponsibility.body);
    const responsibilityCancellation = await manager(`/asa/actions/${cancelledResponsibility.proposal!.id}/cancel`, {});
    check(responsibilityCancellation.status === 200
      && (await state(cancelledResponsibility.proposal!.id)) === "CANCELLED"
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect).responsibilityId === taskResponsibility!.id,
    "Task responsibility proposal can be cancelled by its author without changing the task");
    const staleResponsibility = await ask(manager, `Altere a responsabilidade da tarefa "${checklistTitle}" para "${newResponsibilityTitle}"`);
    assert.equal(staleResponsibility.proposal?.actionType, "TASK_UPDATE_RESPONSIBILITY", staleResponsibility.body);
    const currentResponsibilityTask = (await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect;
    await db.update(tasksTable).set({ updatedAt: new Date(Date.now() + 1000) }).where(eq(tasksTable.id, currentResponsibilityTask.id));
    const staleResponsibilityConfirm = await manager(`/asa/actions/${staleResponsibility.proposal!.id}/confirm`, {});
    check(staleResponsibilityConfirm.status === 409
      && (await state(staleResponsibility.proposal!.id)) === "STALE"
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect).responsibilityId === taskResponsibility!.id,
    "Concurrent task update invalidates its responsibility proposal without changing the link");
    const inactiveAreaTitle = `${tag}_inactive_area_responsibility`;
    const [inactiveAreaTarget] = await db.insert(areasTable).values({
      organizationId: orgs[0]!.id, name: `${tag}_inactive_target_area`, active: true,
    }).returning();
    const [inactiveAreaResponsibility] = await db.insert(responsibilitiesTable).values({
      orgId: orgs[0]!.id, operationId: operation!.id, areaId: inactiveAreaTarget!.id,
      title: inactiveAreaTitle, category: "OPERAÇÃO", active: true,
    }).returning();
    const inactiveAreaPreview = await ask(manager, `Altere a responsabilidade da tarefa "${checklistTitle}" para "${inactiveAreaTitle}"`);
    assert.equal(inactiveAreaPreview.proposal?.actionType, "TASK_UPDATE_RESPONSIBILITY", inactiveAreaPreview.body);
    await db.update(areasTable).set({ active: false, updatedAt: new Date() }).where(eq(areasTable.id, inactiveAreaTarget!.id));
    const inactiveAreaConfirm = await manager(`/asa/actions/${inactiveAreaPreview.proposal!.id}/confirm`, {});
    check(inactiveAreaConfirm.status === 409 && (await state(inactiveAreaPreview.proposal!.id)) === "STALE"
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect).responsibilityId === taskResponsibility!.id,
    "Task responsibility proposal is rejected if its destination area is deactivated after preview");
    const changeResponsibility = await ask(manager, `Altere a responsabilidade da tarefa "${checklistTitle}" para "${newResponsibilityTitle}"`);
    assert.equal(changeResponsibility.proposal?.actionType, "TASK_UPDATE_RESPONSIBILITY", changeResponsibility.body);
    check(changeResponsibility.body.includes(responsibilityTitle) && changeResponsibility.body.includes(newResponsibilityTitle)
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect | undefined)?.responsibilityId === taskResponsibility!.id,
    "Task responsibility preview shows current and target values without changing the task");
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let responsibilityRollback: Response;
    try { responsibilityRollback = await manager(`/asa/actions/${changeResponsibility.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    check(responsibilityRollback!.status === 500
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect | undefined)?.responsibilityId === taskResponsibility!.id
      && (await state(changeResponsibility.proposal!.id)) === "PENDING",
    "Registry failure rolls back the responsibility update and leaves its proposal retryable");
    const responsibilityConfirmation = await manager(`/asa/actions/${changeResponsibility.proposal!.id}/confirm`, {});
    const taskWithUpdatedResponsibility = (await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect;
    check(responsibilityConfirmation.status === 200 && taskWithUpdatedResponsibility.responsibilityId === targetResponsibility!.id
      && (await history(changeResponsibility.proposal!.id)).length === 1,
    "Confirmed responsibility update changes only the responsibility link and writes one Registry event");
    const unlinkResponsibility = await ask(manager, `Remova a responsabilidade da tarefa "${checklistTitle}" para "nenhuma"`);
    assert.equal(unlinkResponsibility.proposal?.actionType, "TASK_UPDATE_RESPONSIBILITY", unlinkResponsibility.body);
    const unlinkConfirmation = await manager(`/asa/actions/${unlinkResponsibility.proposal!.id}/confirm`, {});
    check(unlinkConfirmation.status === 200
      && ((await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect | undefined)?.responsibilityId === null
      && (await history(unlinkResponsibility.proposal!.id)).length === 1,
    "Confirmed responsibility removal clears the task link and writes one Registry event");

    const beforeChecklistId = savedChecklist[0]!.id;
    const beforePhotoId = savedEvidence.find(item => item.type === "PHOTO")!.id;
    const changedChecklist = ["Separar peças", "Adicionar conferência final"];
    const changedEvidence = [{ type: "PHOTO", description: "imagem final" }, { type: "LINK", description: "link da revisão" }];
    const requirementsUpdate = await ask(manager, `Atualize os requisitos da tarefa "${checklistTitle}" para checklist obrigatória "${changedChecklist.join("; ")}" e evidências obrigatórias "${changedEvidence.map(item => `${item.type}: ${item.description}`).join("; ")}"`);
    assert.equal(requirementsUpdate.proposal?.actionType, "TASK_UPDATE_REQUIREMENTS", requirementsUpdate.body);
    const unmodifiedTask = (await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect;
    check(requirementsUpdate.body.includes("Checklist atual") && requirementsUpdate.body.includes("Novas evidências")
      && unmodifiedTask.mandatoryChecklist?.length === requestedChecklist.length
      && unmodifiedTask.mandatoryEvidences?.length === requestedEvidence.length,
    "Task requirements preview shows the replacement while leaving the task unchanged");
    const requirementsConfirmation = await manager(`/asa/actions/${requirementsUpdate.proposal!.id}/confirm`, {});
    const updatedRequirementsTask = (await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect;
    check(requirementsConfirmation.status === 200
      && updatedRequirementsTask.mandatoryChecklist?.map(item => item.label).join("|") === changedChecklist.join("|")
      && updatedRequirementsTask.mandatoryChecklist?.[0]?.id === beforeChecklistId
      && updatedRequirementsTask.mandatoryChecklist?.[1]?.completed === false
      && updatedRequirementsTask.mandatoryEvidences?.map(item => `${item.type}:${item.description}`).join("|") === changedEvidence.map(item => `${item.type}:${item.description}`).join("|")
      && updatedRequirementsTask.mandatoryEvidences?.[0]?.id === beforePhotoId
      && new Set(updatedRequirementsTask.mandatoryEvidences?.map(item => item.id)).size === changedEvidence.length
      && (await history(requirementsUpdate.proposal!.id)).length === 1,
    "Confirmed task requirements update preserves stable IDs, resets only new checklist items, and writes one Registry event");
    await db.insert(taskEvidencesTable).values({
      taskId: updatedRequirementsTask.id, uploaderId: member.id, type: "PHOTO",
      url: "https://example.invalid/task-evidence.png", isRequired: false,
    });
    const evidenceBlockedUpdate = await ask(manager, `Atualize os requisitos da tarefa "${checklistTitle}" para checklist obrigatória "nenhuma" e evidências obrigatórias "nenhuma"`);
    const taskAfterBlockedUpdate = (await targets("TASK_CREATE", checklistTitle))[0] as typeof tasksTable.$inferSelect;
    check(!evidenceBlockedUpdate.proposal && evidenceBlockedUpdate.body.includes("já tem evidência anexada")
      && taskAfterBlockedUpdate.mandatoryChecklist?.map(item => item.label).join("|") === changedChecklist.join("|")
      && taskAfterBlockedUpdate.mandatoryEvidences?.map(item => `${item.type}:${item.description}`).join("|") === changedEvidence.map(item => `${item.type}:${item.description}`).join("|"),
    "Task requirements cannot be replaced after evidence has been attached");
    const evidenceBlockedResponsibility = await ask(manager, `Altere a responsabilidade da tarefa "${checklistTitle}" para "${responsibilityTitle}"`);
    check(!evidenceBlockedResponsibility.proposal && evidenceBlockedResponsibility.body.includes("já tem evidência anexada"),
      "Task responsibility cannot be changed after evidence has been attached");
    const startedRequirementsTaskTitle = `${tag}_started_requirements`;
    await db.insert(tasksTable).values({
      organizationId: orgs[0]!.id, operationId: operation!.id,
      title: startedRequirementsTaskTitle, creatorId: admin.id, assigneeId: member.id,
      dueDate: today, status: "IN_PROGRESS", mandatoryChecklist: [], mandatoryEvidences: [],
    });
    const startedRequirementsUpdate = await ask(manager, `Atualize os requisitos da tarefa "${startedRequirementsTaskTitle}" para checklist obrigatória "Conferir" e evidências obrigatórias "PDF: relatório"`);
    check(!startedRequirementsUpdate.proposal && startedRequirementsUpdate.body.includes("já foi iniciada"),
      "Task requirements cannot be changed after work has started");
    const startedResponsibilityUpdate = await ask(manager, `Altere a responsabilidade da tarefa "${startedRequirementsTaskTitle}" para "${responsibilityTitle}"`);
    check(!startedResponsibilityUpdate.proposal && startedResponsibilityUpdate.body.includes("já foi iniciada"),
      "Task responsibility cannot be changed after work has started");

    const adminAgenda = await ask(manager, agendaMeetingText(`${tag}_admin_meeting`));
    assert.equal(adminAgenda.proposal?.actionType, "AGENDA_MEETING_CREATE", adminAgenda.body);
    check(adminAgenda.proposal.expectedStatus === "DRAFT",
      "Agenda meeting preview for administration creates only an unpublished draft proposal");
    check((await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.title, `${tag}_admin_meeting`))).length === 0,
      "Agenda meeting preview has no database side effect");
    check((await direction(`/asa/actions/${adminAgenda.proposal!.id}/confirm`, {})).status === 404,
      "Another person cannot confirm an Agenda meeting proposal");
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let agendaRollback: Response;
    try { agendaRollback = await manager(`/asa/actions/${adminAgenda.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    check(agendaRollback!.status === 500
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.title, `${tag}_admin_meeting`))).length === 0
      && (await state(adminAgenda.proposal!.id)) === "PENDING",
      "Registry failure rolls back Agenda event creation and leaves the proposal retryable");
    const adminAgendaConfirm = await manager(`/asa/actions/${adminAgenda.proposal!.id}/confirm`, {});
    const [adminAgendaEvent] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.title, `${tag}_admin_meeting`)).limit(1);
    check(adminAgendaConfirm.status === 200 && adminAgendaEvent?.status === "DRAFT"
      && (await history(adminAgenda.proposal!.id)).length === 1,
      "Administration confirmation creates an Agenda draft and Registry entry atomically");

    const memberAgenda = await ask(mine, agendaMeetingText(`${tag}_member_meeting`));
    assert.equal(memberAgenda.proposal?.actionType, "AGENDA_MEETING_CREATE", memberAgenda.body);
    check(memberAgenda.proposal.expectedStatus === "PROPOSED",
      "Member Agenda preview is a proposal in their own area");
    const memberAgendaConfirm = await mine(`/asa/actions/${memberAgenda.proposal!.id}/confirm`, {});
    const [memberAgendaEvent] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.title, `${tag}_member_meeting`)).limit(1);
    const memberAgendaParticipants = memberAgendaEvent
      ? await db.select().from(agendaEventParticipantsTable).where(eq(agendaEventParticipantsTable.eventId, memberAgendaEvent.id)) : [];
    check(memberAgendaConfirm.status === 200 && memberAgendaEvent?.status === "PROPOSED"
      && memberAgendaEvent.areaId === area!.id && memberAgendaParticipants.some(row => row.userId === member.id)
      && (await history(memberAgenda.proposal!.id)).length === 1,
      "Member confirmation submits a scoped Agenda proposal with self-participant and Registry entry");

    const supervisorAgenda = await ask(sup, agendaMeetingText(`${tag}_supervisor_meeting`, ` na área "Own" no local "${tag}"`));
    assert.equal(supervisorAgenda.proposal?.actionType, "AGENDA_MEETING_CREATE", supervisorAgenda.body);
    check(supervisorAgenda.proposal.expectedStatus === "DRAFT",
      "Supervisor can prepare a meeting draft only with an exact area/local pair in their scope");
    const supervisorAgendaConfirm = await sup(`/asa/actions/${supervisorAgenda.proposal!.id}/confirm`, {});
    const [supervisorAgendaEvent] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.title, `${tag}_supervisor_meeting`)).limit(1);
    check(supervisorAgendaConfirm.status === 200 && supervisorAgendaEvent?.status === "DRAFT"
      && supervisorAgendaEvent.areaId === area!.id && supervisorAgendaEvent.locationId === location!.id,
      "Supervisor Agenda confirmation revalidates and preserves area/local scope");

    const revokedAgenda = await ask(sup, agendaMeetingText(`${tag}_revoked_scope_meeting`, ` na área "Own" no local "${tag}"`));
    assert.equal(revokedAgenda.proposal?.actionType, "AGENDA_MEETING_CREATE", revokedAgenda.body);
    await db.update(areaLocalSupervisorsTable).set({ active: false }).where(eq(areaLocalSupervisorsTable.id, scope!.id));
    const revokedAgendaConfirm = await sup(`/asa/actions/${revokedAgenda.proposal!.id}/confirm`, {});
    await db.update(areaLocalSupervisorsTable).set({ active: true }).where(eq(areaLocalSupervisorsTable.id, scope!.id));
    check(revokedAgendaConfirm.status === 403
      && (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.title, `${tag}_revoked_scope_meeting`))).length === 0,
      "Revoked supervisor area/local scope prevents Agenda meeting confirmation");

    const outsideAgenda = await ask(foreignApi, agendaMeetingText(`${tag}_outside_meeting`));
    check(!outsideAgenda.proposal && outsideAgenda.body.includes("operação"),
      "Member without access to the selected operation cannot prepare an Agenda proposal");

    const memberPreferencesResponse = await mine("/asa/preferences", undefined, "GET");
    const memberPreferences = await memberPreferencesResponse.json() as { mode: string; messageFrequency: string; proactivityLevel: string };
    check(memberPreferencesResponse.status === 200 && memberPreferences.mode === "BALANCED"
      && memberPreferences.messageFrequency === "DAILY" && memberPreferences.proactivityLevel === "MEDIUM",
      "ASA preference defaults are private to the authenticated member");
    const savedPreferencesResponse = await manager("/asa/preferences", { mode: "SILENT", messageFrequency: "WEEKLY", proactivityLevel: "LOW" }, "PATCH");
    const savedPreferences = await savedPreferencesResponse.json() as { mode: string; messageFrequency: string; proactivityLevel: string };
    check(savedPreferencesResponse.status === 200 && savedPreferences.mode === "SILENT"
      && savedPreferences.messageFrequency === "WEEKLY" && savedPreferences.proactivityLevel === "LOW",
      "ASA suggestion preferences persist the selected mode, frequency, and level");
    const invalidPreferences = await manager("/asa/preferences", { mode: "ALWAYS_MESSAGE" }, "PATCH");
    const unchangedPreferencesResponse = await manager("/asa/preferences", undefined, "GET");
    const unchangedPreferences = await unchangedPreferencesResponse.json() as { mode: string; messageFrequency: string };
    check(invalidPreferences.status === 400 && unchangedPreferences.mode === "SILENT"
      && unchangedPreferences.messageFrequency === "WEEKLY", "Invalid preference values are rejected without overwriting saved choices");
    const privatePreferencesResponse = await mine("/asa/preferences", undefined, "GET");
    const privatePreferences = await privatePreferencesResponse.json() as { mode: string; messageFrequency: string };
    check(privatePreferences.mode === "BALANCED" && privatePreferences.messageFrequency === "DAILY",
      "One member cannot change another member's ASA preference record");
    const massAssignment = await manager("/asa/preferences", { userId: member.id, mode: "PROACTIVE" }, "PATCH");
    const managerAfterMassAssignmentResponse = await manager("/asa/preferences", undefined, "GET");
    const managerAfterMassAssignment = await managerAfterMassAssignmentResponse.json() as { mode: string };
    check(massAssignment.status === 400 && managerAfterMassAssignment.mode === "SILENT"
      && privatePreferences.mode === "BALANCED", "Preference updates reject unlisted fields and never reassign record ownership");

    const managerUnknownPhrase = `qual é a densidade de constelações ${tag}`;
    const memberUnknownPhrase = `como calculo marés artificiais ${tag}`;
    const managerUnknown = await ask(manager, managerUnknownPhrase);
    const memberUnknown = await ask(mine, memberUnknownPhrase);
    const [managerUnknownAudit] = await db.select().from(asaAuditLogTable).where(eq(asaAuditLogTable.conversationId, String(managerUnknown.conversationId))).limit(1);
    const [memberUnknownAudit] = await db.select().from(asaAuditLogTable).where(eq(asaAuditLogTable.conversationId, String(memberUnknown.conversationId))).limit(1);
    check(managerUnknownAudit?.actionsExecuted?.some(action => action.action === "ASA_UNRECOGNIZED_QUERY_V1") === true
      && memberUnknownAudit?.actionsExecuted?.some(action => action.action === "ASA_UNRECOGNIZED_QUERY_V1") === true,
      "Only generic unrecognized queries are tagged for private review");
    const managerReview = await ask(manager, "Quais pedidos você não reconheceu?");
    check(managerReview.body.includes(managerUnknownPhrase) && !managerReview.body.includes(memberUnknownPhrase)
      && managerReview.body.includes("privada"), "Unrecognized-query review shows only the current person's own phrases");
    const memberReview = await ask(mine, "Mostre minhas frases não reconhecidas");
    check(memberReview.body.includes(memberUnknownPhrase) && !memberReview.body.includes(managerUnknownPhrase),
      "Member review is isolated from manager query history");
    const knownDenied = await ask(mine, "tarefas da equipe");
    const [knownDeniedAudit] = await db.select().from(asaAuditLogTable).where(eq(asaAuditLogTable.conversationId, String(knownDenied.conversationId))).limit(1);
    check(knownDeniedAudit?.actionsExecuted?.some(action => action.action === "ASA_UNRECOGNIZED_QUERY_V1") !== true,
      "Recognized requests refused by role are not mislabeled as unrecognized");

    const conversation = await ask(manager, "minhas tarefas");
    const messagesPath = `/asa/conversations/${conversation.conversationId}/messages`;
    const chatPath = `/asa/chat/${conversation.conversationId}/messages`;
    const ownHistory = await manager(messagesPath, undefined, "GET");
    check(ownHistory.status === 200 && (await ownHistory.json() as { messages: unknown[] }).messages.length === 2, "Author can restore the conversation in the current organization");
    check((await fetch(`${base}${messagesPath}`)).status === 401, "Anonymous requests cannot restore conversation history");
    check((await mine(messagesPath, undefined, "GET")).status === 404, "Colleagues cannot read another person's conversation");
    check((await foreignApi(messagesPath, undefined, "GET")).status === 404, "Conversation history is not exposed to another organization");
    check((await mine(chatPath, { content: "minhas tarefas" })).status === 404, "Colleagues cannot post in another person's conversation");
    check((await manager(`/asa/chat/${conversation.conversationId}abc/messages`, { content: "minhas tarefas" })).status === 400, "Malformed conversation IDs are not partially parsed");
    check((await manager(chatPath, { content: { text: "Invalid body" } })).status === 400, "Non-text messages are refused before persistence");
    check((await manager("/asa/conversations", { title: 123 })).status === 400, "Non-text conversation titles are refused");
    const [temporaryRole] = await db.insert(userRolesTable).values({ userId: admin.id, operationId: foreignOperation!.id, role: "MEMBER", active: true }).returning();
    try {
      await db.update(usersTable).set({ organizationId: orgs[1]!.id }).where(eq(usersTable.id, admin.id));
      check((await manager(messagesPath, undefined, "GET")).status === 404, "Moving organization prevents reading the old organization's conversation");
      check((await manager(chatPath, { content: "minhas tarefas" })).status === 404, "Moving organization prevents appending to the old conversation");
    } finally {
      await db.update(usersTable).set({ organizationId: orgs[0]!.id }).where(eq(usersTable.id, admin.id));
      await db.delete(userRolesTable).where(eq(userRolesTable.id, temporaryRole!.id));
    }
    const unchangedMessages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversation.conversationId));
    check(unchangedMessages.length === 2, "Refused history/chat requests leave the conversation unchanged");

    for (const kind of ["TASK_CREATE", "NOTICE_DRAFT_CREATE"] as const) {
      const title = `${tag}_${kind}`;
      const proposal = await preview(kind, title);
      check((await targets(kind, title)).length === 0, `${kind}: preview creates no target record`);
      check((await fetch(`${base}/asa/actions/${proposal.id}/confirm`, { method: "POST" })).status === 401, `${kind}: anonymous confirmation is refused`);
      check((await mine(`/asa/actions/${proposal.id}/confirm`, {})).status === 404, `${kind}: another person cannot confirm the proposal`);
      check((await foreignApi(`/asa/actions/${proposal.id}/confirm`, {})).status === 404, `${kind}: another organization cannot confirm the proposal`);
      const results = await Promise.all([manager(`/asa/actions/${proposal.id}/confirm`, {}), manager(`/asa/actions/${proposal.id}/confirm`, {})]);
      check(results.map(result => result.status).sort().join(",") === "200,409", `${kind}: concurrent confirmation has exactly one success`);
      const rows = await targets(kind, title);
      check(rows.length === 1 && rows[0]?.status === (kind === "TASK_CREATE" ? "CREATED" : "DRAFT"), `${kind}: exactly one target in the initial state`);
      check((await state(proposal.id)) === "CONFIRMED" && (await audit(proposal.id)).confirmedByUser && (await history(proposal.id)).length === 1, `${kind}: confirmation and Registry are recorded once`);
      if (kind === "TASK_CREATE") {
        const task = rows[0] as typeof tasksTable.$inferSelect | undefined;
        check(task?.assigneeId === member.id && task.dueDate === today && task.priority === "HIGH" && task.requiresApproval && task.origin === "ASA", "Task uses the preview fields and retains completion approval");
      } else {
        const notice = rows[0] as typeof noticesTable.$inferSelect | undefined;
        const recipients = notice ? await db.select().from(noticeRecipientsTable).where(eq(noticeRecipientsTable.noticeId, notice.id)) : [];
        check(notice?.publishedAt === null && recipients.length === proposal.recipientCount && recipients.every(row => row.status === "PENDING" && row.sentAt === null), "Notice is only a draft and sends nothing");
      }

      const cancelledTitle = `${title}_cancelled`;
      const cancelled = await preview(kind, cancelledTitle);
      check((await mine(`/asa/actions/${cancelled.id}/cancel`, {})).status === 404, `${kind}: another person cannot cancel the proposal`);
      check((await manager(`/asa/actions/${cancelled.id}/cancel`, {})).status === 200 && (await state(cancelled.id)) === "CANCELLED", `${kind}: author can cancel`);
      check((await manager(`/asa/actions/${cancelled.id}/confirm`, {})).status === 409 && (await targets(kind, cancelledTitle)).length === 0, `${kind}: cancelled proposal never creates a target`);

      const expiredTitle = `${title}_expired`;
      const expired = await preview(kind, expiredTitle);
      const beforeExpiry = await audit(expired.id);
      await db.update(asaAuditLogTable).set({ actionsExecuted: beforeExpiry.actionsExecuted!.map(item => ({ ...item, expiresAt: new Date(Date.now() - 1).toISOString() })) }).where(eq(asaAuditLogTable.id, expired.id));
      check((await manager(`/asa/actions/${expired.id}/confirm`, {})).status === 410 && (await state(expired.id)) === "EXPIRED" && (await targets(kind, expiredTitle)).length === 0, `${kind}: expiration prevents writes`);

      const rollbackTitle = `${title}_rollback`;
      const rollback = await preview(kind, rollbackTitle);
      let rejected: Response;
      process.env.MYASA_TEST_FAIL_HISTORY = "1";
      try { rejected = await manager(`/asa/actions/${rollback.id}/confirm`, {}); }
      finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
      check(rejected.status === 500 && (await targets(kind, rollbackTitle)).length === 0 && (await history(rollback.id)).length === 0 && (await state(rollback.id)) === "PENDING", `${kind}: Registry failure rolls back target and confirmation`);
      check((await manager(`/asa/actions/${rollback.id}/confirm`, {})).status === 200 && (await targets(kind, rollbackTitle)).length === 1, `${kind}: rolled-back confirmation can be retried safely`);

      const raceTitle = `${title}_cancel_race`;
      const race = await preview(kind, raceTitle);
      const competing = await Promise.all([manager(`/asa/actions/${race.id}/confirm`, {}), manager(`/asa/actions/${race.id}/cancel`, {})]);
      const finalState = await state(race.id);
      const targetCount = (await targets(kind, raceTitle)).length;
      check(competing.map(result => result.status).sort().join(",") === "200,409" && ((finalState === "CONFIRMED" && targetCount === 1) || (finalState === "CANCELLED" && targetCount === 0)), `${kind}: confirmation/cancellation race has one consistent outcome`);

      const roleTitle = `${title}_role_revoked`;
      const roleProposal = await preview(kind, roleTitle);
      await db.update(userRolesTable).set({ role: "MEMBER" }).where(eq(userRolesTable.id, admin.membershipId));
      const revoked = await manager(`/asa/actions/${roleProposal.id}/confirm`, {});
      await db.update(userRolesTable).set({ role: "ADMIN" }).where(eq(userRolesTable.id, admin.membershipId));
      check(revoked.status === 403 && (await targets(kind, roleTitle)).length === 0, `${kind}: current role overrides the old token and preview`);

      const renamedTitle = `${title}_operation_renamed`;
      const renamed = await preview(kind, renamedTitle);
      await db.update(operationsTable).set({ name: `${operation!.name}_renamed` }).where(eq(operationsTable.id, operation!.id));
      const renamedResult = await manager(`/asa/actions/${renamed.id}/confirm`, {});
      await db.update(operationsTable).set({ name: operation!.name }).where(eq(operationsTable.id, operation!.id));
      check(renamedResult.status === 409 && (await targets(kind, renamedTitle)).length === 0, `${kind}: changed operation invalidates the preview`);

      const pausedTitle = `${title}_paused`;
      const paused = await preview(kind, pausedTitle);
      await db.update(operationsTable).set({ status: "PAUSED" }).where(eq(operationsTable.id, operation!.id));
      const pausedResult = await manager(`/asa/actions/${paused.id}/confirm`, {});
      await db.update(operationsTable).set({ status: "ACTIVE" }).where(eq(operationsTable.id, operation!.id));
      check(pausedResult.status === 409 && (await targets(kind, pausedTitle)).length === 0, `${kind}: paused operation prevents confirmation`);
    }

    for (const text of ["crie uma tarefa", "crie um rascunho de aviso", `não ${taskText(`${tag}_negated`)}`, `não ${noticeText(`${tag}_negated_notice`)}`]) {
      check(!(await ask(manager, text)).proposal, "Incomplete or negated commands do not propose an action");
    }

    for (const [index, operationId] of [otherOperation!.id, foreignOperation!.id].entries()) {
      const task = await ask(manager, taskText(`${tag}_bad_operation_${index}`), operationId);
      const notice = await ask(manager, noticeText(`${tag}_bad_notice_operation_${index}`), operationId);
      check(!task.proposal && !notice.proposal, "No proposal for an unassigned or foreign operation");
    }
    check(!(await ask(mine, taskText(`${tag}_member_task`))).proposal && !(await ask(mine, noticeText(`${tag}_member_notice`))).proposal, "Member cannot prepare manager actions");
    const directorTask = await preview("TASK_CREATE", `${tag}_director_task`, direction);
    check((await direction(`/asa/actions/${directorTask.id}/confirm`, {})).status === 200, "Direction can create tasks under the official policy");
    check(!(await ask(direction, noticeText(`${tag}_director_notice`))).proposal, "Direction does not gain notice creation beyond the official policy");

    for (const [suffix, changes] of [
      ["inactive", { status: "INACTIVE" as const }],
      ["renamed", { name: "Changed member" }],
      ["foreign", { organizationId: orgs[1]!.id }],
    ] as const) {
      const title = `${tag}_assignee_${suffix}`;
      const proposal = await preview("TASK_CREATE", title);
      await db.update(usersTable).set(changes).where(eq(usersTable.id, member.id));
      const response = await manager(`/asa/actions/${proposal.id}/confirm`, {});
      await db.update(usersTable).set({ status: "ACTIVE", name: member.name, organizationId: orgs[0]!.id }).where(eq(usersTable.id, member.id));
      check(response.status === 409 && (await targets("TASK_CREATE", title)).length === 0, `Task refuses a ${suffix} assignee after preview`);
    }
    const memberRoleTitle = `${tag}_assignee_revoked`;
    const memberRoleProposal = await preview("TASK_CREATE", memberRoleTitle);
    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, member.membershipId));
    const memberRoleResult = await manager(`/asa/actions/${memberRoleProposal.id}/confirm`, {});
    await db.update(userRolesTable).set({ active: true }).where(eq(userRolesTable.id, member.membershipId));
    check(memberRoleResult.status === 409 && (await targets("TASK_CREATE", memberRoleTitle)).length === 0, "Task refuses an assignee removed from the operation");

    check(!(await ask(sup, taskText(`${tag}_no_delegation`))).proposal, "Supervisor needs task delegation even inside own area");
    const [delegation] = await db.insert(delegationsTable).values({ delegatorId: admin.id, delegateeId: supervisor.id, operationId: operation!.id, validFrom: new Date(Date.now() - 60_000), responsibilities: ["TASK_APPROVALS"] }).returning();
    check(!(await ask(sup, taskText(`${tag}_wrong_area`, outsider.name))).proposal, "Delegated supervisor cannot prepare a task for another area");
    for (const revoke of ["delegation", "scope", "assignee_area"] as const) {
      const title = `${tag}_supervisor_${revoke}`;
      const proposal = await preview("TASK_CREATE", title, sup);
      if (revoke === "delegation") await db.update(delegationsTable).set({ revokedAt: new Date() }).where(eq(delegationsTable.id, delegation!.id));
      if (revoke === "scope") await db.update(areaLocalSupervisorsTable).set({ active: false }).where(eq(areaLocalSupervisorsTable.id, scope!.id));
      if (revoke === "assignee_area") await db.update(usersTable).set({ areaId: otherArea!.id }).where(eq(usersTable.id, member.id));
      const response = await sup(`/asa/actions/${proposal.id}/confirm`, {});
      await db.update(delegationsTable).set({ revokedAt: null }).where(eq(delegationsTable.id, delegation!.id));
      await db.update(areaLocalSupervisorsTable).set({ active: true }).where(eq(areaLocalSupervisorsTable.id, scope!.id));
      await db.update(usersTable).set({ areaId: area!.id }).where(eq(usersTable.id, member.id));
      check(response.status === 403 && (await targets("TASK_CREATE", title)).length === 0, `Supervisor confirmation revalidates ${revoke}`);
    }
    const supervised = await preview("TASK_CREATE", `${tag}_supervised`, sup);
    check((await sup(`/asa/actions/${supervised.id}/confirm`, {})).status === 200, "Supervisor can confirm within active delegation and area");

    const editableTitle = `${tag}_TASK_CREATE`;
    const [editableTask] = await db.select().from(tasksTable).where(and(eq(tasksTable.operationId, operation!.id), eq(tasksTable.title, editableTitle))).limit(1);
    assert.ok(editableTask, "Created synthetic task should be available for the due-date update case");
    const cancellationTitle = `${tag}_cancellation_target`;
    const cancellationReason = "Atividade suspensa pela produção";
    const [cancellationTask] = await db.insert(tasksTable).values({
      organizationId: orgs[0]!.id, operationId: operation!.id, title: cancellationTitle,
      creatorId: admin.id, assigneeId: member.id, description: "Tarefa para teste de cancelamento",
      dueDate: today, priority: "MEDIUM", status: "IN_PROGRESS", requiresApproval: true,
    }).returning();
    const deniedCancellation = await ask(mine, cancelTaskText(cancellationTitle, cancellationReason));
    check(!deniedCancellation.proposal && deniedCancellation.body.includes("apenas para gestores autorizados"),
      "Member cannot prepare a task-cancellation proposal");
    const cancellationPreview = await ask(manager, cancelTaskText(cancellationTitle, cancellationReason));
    assert.equal(cancellationPreview.proposal?.actionType, "TASK_CANCEL", cancellationPreview.body);
    const [beforeCancellation] = await db.select().from(tasksTable).where(eq(tasksTable.id, cancellationTask!.id)).limit(1);
    check(cancellationPreview.body.includes(cancellationReason) && beforeCancellation?.status === "IN_PROGRESS"
      && beforeCancellation.cancelledAt === null && beforeCancellation.cancelledById === null,
    "Task-cancellation preview shows the reason and does not write task state");
    const cancelOnlyPreview = await manager(`/asa/actions/${cancellationPreview.proposal!.id}/cancel`, {});
    const [afterCancelOnlyPreview] = await db.select().from(tasksTable).where(eq(tasksTable.id, cancellationTask!.id)).limit(1);
    check(cancelOnlyPreview.status === 200 && afterCancelOnlyPreview?.status === "IN_PROGRESS"
      && afterCancelOnlyPreview.cancelledAt === null && (await state(cancellationPreview.proposal!.id)) === "CANCELLED",
    "Cancelling a task-cancellation preview leaves the task untouched");

    const staleCancellationPreview = await ask(manager, cancelTaskText(cancellationTitle, cancellationReason));
    await db.update(tasksTable).set({ priority: "HIGH" }).where(eq(tasksTable.id, cancellationTask!.id));
    const staleCancellationResult = await manager(`/asa/actions/${staleCancellationPreview.proposal!.id}/confirm`, {});
    const [afterStaleCancellation] = await db.select().from(tasksTable).where(eq(tasksTable.id, cancellationTask!.id)).limit(1);
    check(staleCancellationResult.status === 409 && afterStaleCancellation?.status === "IN_PROGRESS"
      && (await state(staleCancellationPreview.proposal!.id)) === "STALE",
    "Concurrent task edit invalidates cancellation preview without changing task status");

    const rollbackCancellation = await ask(manager, cancelTaskText(cancellationTitle, cancellationReason));
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackCancellationResult: Response;
    try { rollbackCancellationResult = await manager(`/asa/actions/${rollbackCancellation.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterCancellationRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, cancellationTask!.id)).limit(1);
    check(rollbackCancellationResult!.status === 500 && afterCancellationRollback?.status === "IN_PROGRESS"
      && afterCancellationRollback.cancelledAt === null && (await state(rollbackCancellation.proposal!.id)) === "PENDING",
    "History failure rolls back task cancellation and leaves its proposal retryable");
    const cancellationConfirm = await manager(`/asa/actions/${rollbackCancellation.proposal!.id}/confirm`, {});
    const [cancelledTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, cancellationTask!.id)).limit(1);
    const cancellationHistory = await history(rollbackCancellation.proposal!.id);
    check(cancellationConfirm.status === 200 && cancelledTask?.status === "CANCELLED"
      && cancelledTask.cancelledAt instanceof Date && cancelledTask.cancelledById === admin.id
      && (await state(rollbackCancellation.proposal!.id)) === "CONFIRMED" && cancellationHistory.length === 1
      && cancellationHistory[0]?.metadata?.reason === cancellationReason,
    "Manager confirms task cancellation with actor, reason, and one atomic Registry event");

    const commentContent = "Confirmei a lista de materiais.";
    const memberCommentPreview = await ask(mine, commentTaskText(editableTitle, commentContent));
    assert.equal(memberCommentPreview.proposal?.actionType, "TASK_COMMENT_CREATE", memberCommentPreview.body);
    const commentPreviewRows = await db.select().from(taskCommentsTable).where(eq(taskCommentsTable.taskId, editableTask.id));
    check(memberCommentPreview.body.includes(commentContent) && commentPreviewRows.length === 0,
      "Task-comment preview shows the literal message without inserting a comment");
    const outsiderComment = await ask(outside, commentTaskText(editableTitle, "Detalhe privado do comentário."));
    check(!outsiderComment.proposal && outsiderComment.body.includes("dentro do seu escopo")
      && !outsiderComment.body.includes("Detalhe privado do comentário"),
    "Person outside task scope cannot prepare a comment or learn task details");
    const memberCommentCancelled = await mine(`/asa/actions/${memberCommentPreview.proposal!.id}/cancel`, {});
    check(memberCommentCancelled.status === 200 && (await db.select().from(taskCommentsTable)
      .where(eq(taskCommentsTable.taskId, editableTask.id))).length === 0,
    "Cancelling a task-comment proposal publishes nothing");
    const memberCommentConfirmPreview = await ask(mine, commentTaskText(editableTitle, commentContent));
    check((await manager(`/asa/actions/${memberCommentConfirmPreview.proposal!.id}/confirm`, {})).status === 404,
      "Another user cannot confirm the task-comment proposal");
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let commentRollback: Response;
    try { commentRollback = await mine(`/asa/actions/${memberCommentConfirmPreview.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    check(commentRollback!.status === 500 && (await db.select().from(taskCommentsTable)
      .where(eq(taskCommentsTable.taskId, editableTask.id))).length === 0
      && (await state(memberCommentConfirmPreview.proposal!.id)) === "PENDING",
    "History failure rolls back task-comment insertion and keeps the preview retryable");
    const memberCommentConfirm = await mine(`/asa/actions/${memberCommentConfirmPreview.proposal!.id}/confirm`, {});
    const taskComments = await db.select().from(taskCommentsTable).where(eq(taskCommentsTable.taskId, editableTask.id));
    check(memberCommentConfirm.status === 200 && taskComments.length === 1 && taskComments[0]?.body === commentContent
      && taskComments[0]?.authorId === member.id && (await state(memberCommentConfirmPreview.proposal!.id)) === "CONFIRMED"
      && (await history(memberCommentConfirmPreview.proposal!.id)).length === 1,
    "Task assignee confirms a literal comment with one atomic Registry event");
    const readTaskComments = await ask(mine, `Mostre os comentários da tarefa "${editableTitle}"`);
    check(!readTaskComments.proposal && readTaskComments.body.includes(commentContent)
      && readTaskComments.body.includes(member.name),
    "Task assignee can read recent comments with author and timestamp");
    const deniedTaskComments = await ask(outside, `Mostre os comentários da tarefa "${editableTitle}"`);
    check(!deniedTaskComments.proposal && !deniedTaskComments.body.includes(commentContent)
      && deniedTaskComments.body.includes("dentro do seu escopo"),
    "Person outside task scope cannot read task comments");
    const mixedRoleTaskComment = await ask(mixedRole, commentTaskText(editableTitle, "Não deve ser exposto."));
    check(!mixedRoleTaskComment.proposal && !mixedRoleTaskComment.body.includes("Não deve ser exposto."),
      "A role held in another operation cannot grant task-comment access in the selected operation");
    const mixedRoleEvidence = await ask(mixedRole, evidenceLinkText("https://evidence.example.test/private", editableTitle, "fora do escopo"));
    check(!mixedRoleEvidence.proposal && !mixedRoleEvidence.body.includes("https://evidence.example.test/private"),
      "A role held in another operation cannot prepare task evidence in the selected operation");

    const evidenceUrl = "https://evidence.example.test/final-report.pdf";
    const evidenceDescription = "Relatório complementar final";
    const evidencePreview = await ask(mine, evidenceLinkText(evidenceUrl, editableTitle, evidenceDescription));
    assert.equal(evidencePreview.proposal?.actionType, "TASK_EVIDENCE_LINK_ADD", evidencePreview.body);
    check(evidencePreview.body.includes(evidenceUrl) && evidencePreview.body.includes("não será marcado como evidência obrigatória")
      && (await db.select().from(taskEvidencesTable).where(eq(taskEvidencesTable.taskId, editableTask.id))).length === 0,
    "Task-evidence preview displays the exact supplemental URL without writing or satisfying mandatory requirements");
    const outsideEvidencePreview = await ask(outside, evidenceLinkText("https://evidence.example.test/secret", editableTitle, "arquivo privado"));
    check(!outsideEvidencePreview.proposal && !outsideEvidencePreview.body.includes("https://evidence.example.test/secret"),
      "Person outside task scope cannot prepare evidence or expose its URL");
    const cancelledEvidencePreview = await mine(`/asa/actions/${evidencePreview.proposal!.id}/cancel`, {});
    check(cancelledEvidencePreview.status === 200 && (await db.select().from(taskEvidencesTable)
      .where(eq(taskEvidencesTable.taskId, editableTask.id))).length === 0,
    "Cancelling supplemental-evidence preview attaches nothing");
    const evidenceConfirmPreview = await ask(mine, evidenceLinkText(evidenceUrl, editableTitle, evidenceDescription));
    check((await manager(`/asa/actions/${evidenceConfirmPreview.proposal!.id}/confirm`, {})).status === 404,
      "Another user cannot confirm a task-evidence proposal");
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let evidenceRollback: Response;
    try { evidenceRollback = await mine(`/asa/actions/${evidenceConfirmPreview.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    check(evidenceRollback!.status === 500 && (await db.select().from(taskEvidencesTable)
      .where(eq(taskEvidencesTable.taskId, editableTask.id))).length === 0
      && (await state(evidenceConfirmPreview.proposal!.id)) === "PENDING",
    "History failure rolls back supplemental-evidence attachment and leaves the proposal retryable");
    const evidenceConfirm = await mine(`/asa/actions/${evidenceConfirmPreview.proposal!.id}/confirm`, {});
    const addedEvidence = await db.select().from(taskEvidencesTable).where(eq(taskEvidencesTable.taskId, editableTask.id));
    check(evidenceConfirm.status === 200 && addedEvidence.length === 1 && addedEvidence[0]?.url === evidenceUrl
      && addedEvidence[0]?.description === evidenceDescription && addedEvidence[0]?.type === "LINK"
      && addedEvidence[0]?.isRequired === false && addedEvidence[0]?.mandatoryEvidenceRefId === null
      && addedEvidence[0]?.uploaderId === member.id && (await history(evidenceConfirmPreview.proposal!.id)).length === 1,
    "Task assignee confirms a complementary LINK with no mandatory-evidence flag and one atomic Registry event");

    const mandatoryChecklistItem = { id: `${tag}_mandatory_item`, label: "Conferir documentos", completed: false };
    const operationalChecklistItem = { id: `${tag}_operational_item`, label: "Separar materiais", completed: false };
    await db.update(tasksTable).set({ mandatoryChecklist: [mandatoryChecklistItem], operationalChecklist: [operationalChecklistItem] })
      .where(eq(tasksTable.id, editableTask.id));
    const checklistText = (kind: "obrigatório" | "operacional", label: string, completed: boolean) =>
      `${completed ? "marque" : "desmarque"} o item ${kind} da checklist "${label}" da tarefa "${editableTitle}" como ${completed ? "concluído" : "pendente"}`;
    const checklistPreview = await ask(mine, checklistText("obrigatório", mandatoryChecklistItem.label, true));
    assert.equal(checklistPreview.proposal?.actionType, "TASK_CHECKLIST_UPDATE", checklistPreview.body);
    const [beforeChecklistConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(checklistPreview.body.includes("Conferir documentos") && beforeChecklistConfirm?.mandatoryChecklist?.[0]?.completed === false,
      "Task checklist preview identifies the exact required item and does not write");
    const outsideChecklist = await ask(outside, checklistText("obrigatório", mandatoryChecklistItem.label, true));
    check(!outsideChecklist.proposal, "Person other than the assignee cannot prepare a checklist update");
    const cancelledChecklist = await mine(`/asa/actions/${checklistPreview.proposal!.id}/cancel`, {});
    check(cancelledChecklist.status === 200 && (await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id))
      .then(rows => rows[0]?.mandatoryChecklist?.[0]?.completed)) === false,
    "Cancelling checklist preview leaves the item unchanged");
    const checklistConfirmPreview = await ask(mine, checklistText("obrigatório", mandatoryChecklistItem.label, true));
    check((await manager(`/asa/actions/${checklistConfirmPreview.proposal!.id}/confirm`, {})).status === 404,
      "Another user cannot confirm an assignee checklist proposal");
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let checklistRollback: Response;
    try { checklistRollback = await mine(`/asa/actions/${checklistConfirmPreview.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    check(checklistRollback!.status === 500 && (await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id))
      .then(rows => rows[0]?.mandatoryChecklist?.[0]?.completed)) === false
      && (await state(checklistConfirmPreview.proposal!.id)) === "PENDING",
    "History failure rolls back checklist state and leaves the proposal retryable");
    const checklistConfirm = await mine(`/asa/actions/${checklistConfirmPreview.proposal!.id}/confirm`, {});
    const [afterChecklistConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(checklistConfirm.status === 200 && afterChecklistConfirm?.mandatoryChecklist?.[0]?.completed === true
      && (await history(checklistConfirmPreview.proposal!.id)).length === 1,
    "Assignee confirms a mandatory checklist item with one atomic Registry event");
    const operationalPreview = await ask(mine, checklistText("operacional", operationalChecklistItem.label, true));
    assert.equal(operationalPreview.proposal?.checklistKind, "operational", operationalPreview.body);
    const operationalConfirm = await mine(`/asa/actions/${operationalPreview.proposal!.id}/confirm`, {});
    const [afterOperationalChecklist] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(operationalConfirm.status === 200 && afterOperationalChecklist?.operationalChecklist?.[0]?.completed === true
      && afterOperationalChecklist?.mandatoryChecklist?.[0]?.completed === true,
    "Operational checklist update preserves required checklist state");

    const [duplicateStartTask] = await db.insert(tasksTable).values({
      organizationId: editableTask.organizationId, operationId: editableTask.operationId, title: editableTask.title,
      creatorId: editableTask.creatorId, assigneeId: editableTask.assigneeId, responsibilityId: editableTask.responsibilityId,
      description: editableTask.description, dueDate: editableTask.dueDate, priority: editableTask.priority,
      status: "CREATED", requiresApproval: editableTask.requiresApproval,
    }).returning();
    const ambiguousStart = await ask(mine, startTaskText(editableTitle));
    check(!ambiguousStart.proposal && ambiguousStart.body.includes("mais de uma tarefa"), "Duplicate visible task titles require clarification before start");
    await db.delete(tasksTable).where(eq(tasksTable.id, duplicateStartTask!.id));
    const outsideStart = await ask(outside, startTaskText(editableTitle));
    check(!outsideStart.proposal && outsideStart.body.includes("dentro do seu escopo"), "Person outside task scope cannot prepare task start or learn that the task exists");
    const memberStartPreview = await ask(mine, startTaskText(editableTitle));
    assert.equal(memberStartPreview.proposal?.actionType, "TASK_START", memberStartPreview.body);
    check(memberStartPreview.proposal?.previousStatus === "CREATED" && memberStartPreview.proposal?.assigneeName === member.name,
      "Task-start preview identifies the exact current status and assignee");
    const [beforeStartConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforeStartConfirm?.status === "CREATED", "Task-start preview does not change task status");
    const cancelledStart = await mine(`/asa/actions/${memberStartPreview.proposal!.id}/cancel`, {});
    check(cancelledStart.status === 200 && (await state(memberStartPreview.proposal!.id)) === "CANCELLED"
      && (await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).then(rows => rows[0]?.status)) === "CREATED",
      "Cancelling task-start preview leaves task pending");
    const expiredStart = await ask(manager, startTaskText(editableTitle));
    assert.equal(expiredStart.proposal?.actionType, "TASK_START", expiredStart.body);
    const expiredStartAudit = await audit(expiredStart.proposal!.id);
    await db.update(asaAuditLogTable).set({ actionsExecuted: expiredStartAudit.actionsExecuted!
      .map(item => ({ ...item, expiresAt: new Date(Date.now() - 1).toISOString() })) })
      .where(eq(asaAuditLogTable.id, expiredStart.proposal!.id));
    const expiredStartResult = await manager(`/asa/actions/${expiredStart.proposal!.id}/confirm`, {});
    check(expiredStartResult.status === 410 && (await state(expiredStart.proposal!.id)) === "EXPIRED"
      && (await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).then(rows => rows[0]?.status)) === "CREATED",
      "Expired task-start preview cannot change task status");
    const revokedMembershipStart = await ask(mine, startTaskText(editableTitle));
    assert.equal(revokedMembershipStart.proposal?.actionType, "TASK_START", revokedMembershipStart.body);
    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, member.membershipId));
    const revokedMembershipStartResult = await mine(`/asa/actions/${revokedMembershipStart.proposal!.id}/confirm`, {});
    await db.update(userRolesTable).set({ active: true }).where(eq(userRolesTable.id, member.membershipId));
    const [afterRevokedStart] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(revokedMembershipStartResult.status === 403 && afterRevokedStart?.status === "CREATED"
      && (await state(revokedMembershipStart.proposal!.id)) === "PENDING", "Revoked operation membership prevents assignee from confirming task start");
    const memberStart = await ask(mine, startTaskText(editableTitle));
    assert.equal(memberStart.proposal?.actionType, "TASK_START", memberStart.body);
    check((await manager(`/asa/actions/${memberStart.proposal!.id}/confirm`, {})).status === 404,
      "Task-start proposal can only be confirmed by its author");
    const memberStartConfirm = await mine(`/asa/actions/${memberStart.proposal!.id}/confirm`, {});
    const [startedByMember] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(memberStartConfirm.status === 200 && startedByMember?.status === "IN_PROGRESS"
      && (await state(memberStart.proposal!.id)) === "CONFIRMED" && (await history(memberStart.proposal!.id)).length === 1,
      "Assignee confirms task start with one atomic Registry event");

    const requiredEvidenceId = `${tag}_required_evidence`;
    await db.update(tasksTable).set({
      mandatoryChecklist: [{ id: `${tag}_check`, label: "Revisar montagem", completed: false }],
      mandatoryEvidences: [{ id: requiredEvidenceId, type: "LINK", description: "Link da revisão" }],
    }).where(eq(tasksTable.id, editableTask.id));
    const blockedSubmission = await ask(mine, submitTaskText(editableTitle));
    check(!blockedSubmission.proposal && blockedSubmission.body.includes("Checklist: Revisar montagem")
      && blockedSubmission.body.includes("Evidência: Link da revisão"),
      "Task submission refuses incomplete mandatory checklist and evidence without creating a proposal");
    await db.update(tasksTable).set({
      mandatoryChecklist: [{ id: `${tag}_check`, label: "Revisar montagem", completed: true }],
    }).where(eq(tasksTable.id, editableTask.id));
    const stillMissingEvidence = await ask(mine, submitTaskText(editableTitle));
    check(!stillMissingEvidence.proposal && stillMissingEvidence.body.includes("Evidência: Link da revisão"),
      "Task submission requires every mandatory evidence to be active before preview");
    const [requiredEvidence] = await db.insert(taskEvidencesTable).values({
      taskId: editableTask.id, uploaderId: member.id, type: "LINK", url: `https://example.test/${tag}`,
      isRequired: true, mandatoryEvidenceRefId: requiredEvidenceId, active: true,
    }).returning();
    const staleSubmission = await ask(mine, submitTaskText(editableTitle));
    assert.equal(staleSubmission.proposal?.actionType, "TASK_READY_FOR_APPROVAL", staleSubmission.body);
    const [beforeSubmissionConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforeSubmissionConfirm?.status === "IN_PROGRESS", "Task submission preview does not change status");
    check((await manager(`/asa/actions/${staleSubmission.proposal!.id}/confirm`, {})).status === 404,
      "Task submission proposal can only be confirmed by its author");
    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, member.membershipId));
    const revokedSubmissionResult = await mine(`/asa/actions/${staleSubmission.proposal!.id}/confirm`, {});
    await db.update(userRolesTable).set({ active: true }).where(eq(userRolesTable.id, member.membershipId));
    check(revokedSubmissionResult.status === 403 && (await state(staleSubmission.proposal!.id)) === "PENDING",
      "Revoked operation membership prevents assignee from submitting task");
    await db.update(taskEvidencesTable).set({ active: false }).where(eq(taskEvidencesTable.id, requiredEvidence!.id));
    const staleSubmissionResult = await mine(`/asa/actions/${staleSubmission.proposal!.id}/confirm`, {});
    const [afterStaleSubmission] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(staleSubmissionResult.status === 409 && afterStaleSubmission?.status === "IN_PROGRESS"
      && (await state(staleSubmission.proposal!.id)) === "STALE",
      "Removing required evidence after preview invalidates task submission");
    await db.update(taskEvidencesTable).set({ active: true }).where(eq(taskEvidencesTable.id, requiredEvidence!.id));
    const submission = await ask(mine, submitTaskText(editableTitle));
    assert.equal(submission.proposal?.actionType, "TASK_READY_FOR_APPROVAL", submission.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let submissionRollback: Response;
    try { submissionRollback = await mine(`/asa/actions/${submission.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterSubmissionRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(submissionRollback!.status === 500 && afterSubmissionRollback?.status === "IN_PROGRESS"
      && (await state(submission.proposal!.id)) === "PENDING",
      "Registry failure rolls back task submission and leaves its proposal retryable");
    const submissionConfirm = await mine(`/asa/actions/${submission.proposal!.id}/confirm`, {});
    const [submittedTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(submissionConfirm.status === 200 && submittedTask?.status === "READY_FOR_APPROVAL"
      && (await state(submission.proposal!.id)) === "CONFIRMED" && (await history(submission.proposal!.id)).length === 1,
      "Assignee confirms submission after revalidated checklist/evidence with one Registry event");
    await db.update(tasksTable).set({ status: "IN_PROGRESS", requiresApproval: false }).where(eq(tasksTable.id, editableTask.id));
    const noApprovalTask = await ask(mine, submitTaskText(editableTitle));
    const [stillInProgress] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(!noApprovalTask.proposal && noApprovalTask.body.includes("não exige aprovação")
      && stillInProgress?.status === "IN_PROGRESS", "Task without approval policy is never completed by submission command");
    await db.update(tasksTable).set({ requiresApproval: true }).where(eq(tasksTable.id, editableTask.id));
    const approvalRequiredCompletion = await ask(mine, completeTaskText(editableTitle));
    check(!approvalRequiredCompletion.proposal && approvalRequiredCompletion.body.includes("exige aprovação")
      && (await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).then(rows => rows[0]?.status)) === "IN_PROGRESS",
      "Task completion command refuses tasks that require approval");
    await db.update(tasksTable).set({ requiresApproval: false }).where(eq(tasksTable.id, editableTask.id));
    const staleCompletionPreview = await ask(mine, completeTaskText(editableTitle));
    assert.equal(staleCompletionPreview.proposal?.actionType, "TASK_COMPLETE", staleCompletionPreview.body);
    await db.update(tasksTable).set({ mandatoryChecklist: [{ id: `${tag}_check`, label: "Revisar montagem", completed: false }] })
      .where(eq(tasksTable.id, editableTask.id));
    const staleCompletionResult = await mine(`/asa/actions/${staleCompletionPreview.proposal!.id}/confirm`, {});
    check(staleCompletionResult.status === 409 && (await state(staleCompletionPreview.proposal!.id)) === "STALE"
      && (await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).then(rows => rows[0]?.status)) === "IN_PROGRESS",
      "Checklist changes after completion preview prevent task completion");
    await db.update(tasksTable).set({ mandatoryChecklist: [{ id: `${tag}_check`, label: "Revisar montagem", completed: true }] })
      .where(eq(tasksTable.id, editableTask.id));
    const completionPreview = await ask(mine, completeTaskText(editableTitle));
    assert.equal(completionPreview.proposal?.actionType, "TASK_COMPLETE", completionPreview.body);
    const [beforeCompletionConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforeCompletionConfirm?.status === "IN_PROGRESS", "Task completion preview does not change task status");
    check((await manager(`/asa/actions/${completionPreview.proposal!.id}/confirm`, {})).status === 404,
      "Only the task assignee can confirm task completion");
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let completionRollback: Response;
    try { completionRollback = await mine(`/asa/actions/${completionPreview.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterCompletionRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(completionRollback!.status === 500 && afterCompletionRollback?.status === "IN_PROGRESS"
      && (await state(completionPreview.proposal!.id)) === "PENDING",
      "Registry failure rolls back task completion and leaves its proposal retryable");
    const completionConfirm = await mine(`/asa/actions/${completionPreview.proposal!.id}/confirm`, {});
    const [completedByMember] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(completionConfirm.status === 200 && completedByMember?.status === "COMPLETED"
      && completedByMember.completedAt !== null && (await state(completionPreview.proposal!.id)) === "CONFIRMED"
      && (await history(completionPreview.proposal!.id)).length === 1,
      "Assignee confirms task completion with revalidated requirements and one atomic Registry event");
    await db.update(tasksTable).set({ status: "CREATED", requiresApproval: true, mandatoryChecklist: [], mandatoryEvidences: [] }).where(eq(tasksTable.id, editableTask.id));
    await db.delete(taskEvidencesTable).where(eq(taskEvidencesTable.id, requiredEvidence!.id));
    await db.update(tasksTable).set({ status: "CREATED" }).where(eq(tasksTable.id, editableTask.id));

    const staleStart = await ask(manager, startTaskText(editableTitle));
    assert.equal(staleStart.proposal?.actionType, "TASK_START", staleStart.body);
    await db.update(tasksTable).set({ priority: "CRITICAL" }).where(eq(tasksTable.id, editableTask.id));
    const staleStartResult = await manager(`/asa/actions/${staleStart.proposal!.id}/confirm`, {});
    const [afterStaleStart] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(staleStartResult.status === 409 && afterStaleStart?.status === "CREATED"
      && (await state(staleStart.proposal!.id)) === "STALE", "Concurrent task edit invalidates task-start preview");
    await db.update(tasksTable).set({ priority: "HIGH" }).where(eq(tasksTable.id, editableTask.id));

    const rollbackStart = await ask(manager, startTaskText(editableTitle));
    assert.equal(rollbackStart.proposal?.actionType, "TASK_START", rollbackStart.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackStartResult: Response;
    try { rollbackStartResult = await manager(`/asa/actions/${rollbackStart.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterStartRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(rollbackStartResult!.status === 500 && afterStartRollback?.status === "CREATED"
      && (await state(rollbackStart.proposal!.id)) === "PENDING", "Registry failure rolls back task start and proposal confirmation");
    check((await manager(`/asa/actions/${rollbackStart.proposal!.id}/confirm`, {})).status === 200,
      "Task start can be retried after transactional rollback");
    await db.update(tasksTable).set({ status: "CREATED" }).where(eq(tasksTable.id, editableTask.id));

    const beforeDueDate = editableTask.dueDate;
    const dueDatePreview = await ask(manager, changeDueText(editableTitle, nextDue));
    assert.equal(dueDatePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", dueDatePreview.body);
    check((await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).then(rows => rows[0]?.dueDate)) === beforeDueDate, "Due-date preview does not change the task");
    check(dueDatePreview.proposal?.previousDueDate === beforeDueDate && dueDatePreview.proposal?.dueDate === nextDue, "Due-date preview shows the before and after values");
    check((await mine(`/asa/actions/${dueDatePreview.proposal!.id}/confirm`, {})).status === 404, "Another person cannot confirm a due-date change");
    const dueDateConfirmation = await manager(`/asa/actions/${dueDatePreview.proposal!.id}/confirm`, {});
    const [updatedTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(dueDateConfirmation.status === 200 && updatedTask?.dueDate === nextDue, "Confirmed due-date change updates only the selected task");
    check((await state(dueDatePreview.proposal!.id)) === "CONFIRMED" && (await history(dueDatePreview.proposal!.id)).length === 1, "Due-date change and Registry event are recorded once");

    const staleDueDate = nextDueDate;
    staleDueDate.setUTCDate(staleDueDate.getUTCDate() + 1);
    const staleDue = staleDueDate.toISOString().slice(0, 10);
    const staleDuePreview = await ask(manager, changeDueText(editableTitle, staleDue));
    assert.equal(staleDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", staleDuePreview.body);
    await db.update(tasksTable).set({ dueDate: today }).where(eq(tasksTable.id, editableTask.id));
    const staleDueResult = await manager(`/asa/actions/${staleDuePreview.proposal!.id}/confirm`, {});
    const [unchangedAfterStale] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(staleDueResult.status === 409 && unchangedAfterStale?.dueDate === today && (await state(staleDuePreview.proposal!.id)) === "STALE", "Concurrent task change invalidates a due-date preview");

    const rollbackDueDate = new Date(`${staleDue}T12:00:00Z`);
    rollbackDueDate.setUTCDate(rollbackDueDate.getUTCDate() + 1);
    const rollbackDue = rollbackDueDate.toISOString().slice(0, 10);
    const rollbackDuePreview = await ask(manager, changeDueText(editableTitle, rollbackDue));
    assert.equal(rollbackDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", rollbackDuePreview.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackDueResult: Response;
    try { rollbackDueResult = await manager(`/asa/actions/${rollbackDuePreview.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterDueRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(rollbackDueResult.status === 500 && afterDueRollback?.dueDate === today && (await history(rollbackDuePreview.proposal!.id)).length === 0 && (await state(rollbackDuePreview.proposal!.id)) === "PENDING", "Registry failure rolls back due-date update and proposal confirmation");
    check((await manager(`/asa/actions/${rollbackDuePreview.proposal!.id}/confirm`, {})).status === 200, "Due-date change can be retried after transactional rollback");

    const memberDuePreview = await ask(mine, changeDueText(editableTitle, today));
    check(!memberDuePreview.proposal, "Member cannot prepare a task due-date change");
    const duplicateTask = await db.insert(tasksTable).values({
      organizationId: orgs[0]!.id, operationId: operation!.id, title: editableTitle,
      creatorId: admin.id, assigneeId: member.id, dueDate: today, status: "CREATED",
    }).returning();
    try {
      const ambiguousDuePreview = await ask(manager, changeDueText(editableTitle, today));
      check(!ambiguousDuePreview.proposal && /mais de uma tarefa/.test(ambiguousDuePreview.body), "Duplicate task titles require clarification instead of an arbitrary edit");
    } finally {
      await db.delete(tasksTable).where(eq(tasksTable.id, duplicateTask[0]!.id));
    }

    const cancelledDuePreview = await ask(manager, changeDueText(editableTitle, today));
    assert.equal(cancelledDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", cancelledDuePreview.body);
    const cancelDueResponse = await manager(`/asa/actions/${cancelledDuePreview.proposal!.id}/cancel`, {});
    const confirmCancelledDue = await manager(`/asa/actions/${cancelledDuePreview.proposal!.id}/confirm`, {});
    const [afterCancelledDue] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(cancelDueResponse.status === 200 && confirmCancelledDue.status === 409 && afterCancelledDue?.dueDate === rollbackDue && (await state(cancelledDuePreview.proposal!.id)) === "CANCELLED", "Cancelled due-date preview cannot change the task");

    const expiredDuePreview = await ask(manager, changeDueText(editableTitle, today));
    assert.equal(expiredDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", expiredDuePreview.body);
    const expiredDueAudit = await audit(expiredDuePreview.proposal!.id);
    await db.update(asaAuditLogTable).set({ actionsExecuted: expiredDueAudit.actionsExecuted!.map(item => ({ ...item, expiresAt: new Date(Date.now() - 1).toISOString() })) }).where(eq(asaAuditLogTable.id, expiredDuePreview.proposal!.id));
    const expiredDueResult = await manager(`/asa/actions/${expiredDuePreview.proposal!.id}/confirm`, {});
    const [afterExpiredDue] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(expiredDueResult.status === 410 && afterExpiredDue?.dueDate === rollbackDue && (await state(expiredDuePreview.proposal!.id)) === "EXPIRED", "Expired due-date preview cannot change the task");

    const raceDueDate = new Date(`${rollbackDue}T12:00:00Z`);
    raceDueDate.setUTCDate(raceDueDate.getUTCDate() + 1);
    const raceDue = raceDueDate.toISOString().slice(0, 10);
    const raceDuePreview = await ask(manager, changeDueText(editableTitle, raceDue));
    assert.equal(raceDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", raceDuePreview.body);
    const dueConfirmRace = await Promise.all([
      manager(`/asa/actions/${raceDuePreview.proposal!.id}/confirm`, {}),
      manager(`/asa/actions/${raceDuePreview.proposal!.id}/confirm`, {}),
    ]);
    const [afterDueRace] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(dueConfirmRace.map(response => response.status).sort().join(",") === "200,409" && afterDueRace?.dueDate === raceDue && (await history(raceDuePreview.proposal!.id)).length === 1, "Concurrent due-date confirmation succeeds once and writes one Registry event");

    const revokedDuePreview = await ask(manager, changeDueText(editableTitle, today));
    assert.equal(revokedDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", revokedDuePreview.body);
    await db.update(userRolesTable).set({ role: "MEMBER" }).where(eq(userRolesTable.id, admin.membershipId));
    const revokedDueResult = await manager(`/asa/actions/${revokedDuePreview.proposal!.id}/confirm`, {});
    await db.update(userRolesTable).set({ role: "ADMIN" }).where(eq(userRolesTable.id, admin.membershipId));
    const [afterRevokedDue] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(revokedDueResult.status === 403 && afterRevokedDue?.dueDate === raceDue, "Revoked manager permission prevents due-date confirmation");

    const reassignedDuePreview = await ask(manager, changeDueText(editableTitle, today));
    assert.equal(reassignedDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", reassignedDuePreview.body);
    await db.update(tasksTable).set({ assigneeId: outsider.id }).where(eq(tasksTable.id, editableTask.id));
    const reassignedDueResult = await manager(`/asa/actions/${reassignedDuePreview.proposal!.id}/confirm`, {});
    const [afterReassignedDue] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(reassignedDueResult.status === 409 && afterReassignedDue?.dueDate === raceDue && (await state(reassignedDuePreview.proposal!.id)) === "STALE", "Reassignment invalidates a due-date preview");
    await db.update(tasksTable).set({ assigneeId: member.id }).where(eq(tasksTable.id, editableTask.id));

    const closedDuePreview = await ask(manager, changeDueText(editableTitle, today));
    assert.equal(closedDuePreview.proposal?.actionType, "TASK_UPDATE_DUE_DATE", closedDuePreview.body);
    await db.update(tasksTable).set({ status: "APPROVED" }).where(eq(tasksTable.id, editableTask.id));
    const closedDueResult = await manager(`/asa/actions/${closedDuePreview.proposal!.id}/confirm`, {});
    const [afterClosedDue] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(closedDueResult.status === 409 && afterClosedDue?.dueDate === raceDue && (await state(closedDuePreview.proposal!.id)) === "STALE", "Task closed after preview cannot have its due date changed");
    await db.update(tasksTable).set({ status: "CREATED" }).where(eq(tasksTable.id, editableTask.id));

    const assignmentPreview = await ask(manager, changeAssigneeText(editableTitle, director.name));
    assert.equal(assignmentPreview.proposal?.actionType, "TASK_UPDATE_ASSIGNEE", assignmentPreview.body);
    check(assignmentPreview.proposal?.previousAssigneeName === member.name && assignmentPreview.proposal?.assigneeName === director.name,
      "Assignee preview names the exact before and after people");
    const [beforeAssigneeConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforeAssigneeConfirm?.assigneeId === member.id, "Assignee preview does not write before confirmation");
    const memberAssignmentAttempt = await ask(mine, changeAssigneeText(editableTitle, director.name));
    check(!memberAssignmentAttempt.proposal && memberAssignmentAttempt.body.includes("gestores autorizados"), "Non-manager cannot prepare an assignee change");
    const assignmentConfirm = await manager(`/asa/actions/${assignmentPreview.proposal!.id}/confirm`, {});
    const [afterAssigneeConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(assignmentConfirm.status === 200 && afterAssigneeConfirm?.assigneeId === director.id, "Confirmed assignee change updates only the selected task");
    check((await state(assignmentPreview.proposal!.id)) === "CONFIRMED" && (await history(assignmentPreview.proposal!.id)).length === 1,
      "Assignee change and Registry event are recorded once");

    const cancelledAssignee = await ask(manager, changeAssigneeText(editableTitle, member.name));
    assert.equal(cancelledAssignee.proposal?.actionType, "TASK_UPDATE_ASSIGNEE", cancelledAssignee.body);
    const cancelAssigneeResult = await manager(`/asa/actions/${cancelledAssignee.proposal!.id}/cancel`, {});
    const [afterAssigneeCancel] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(cancelAssigneeResult.status === 200 && afterAssigneeCancel?.assigneeId === director.id
      && (await state(cancelledAssignee.proposal!.id)) === "CANCELLED", "Cancelling an assignee change leaves the task unchanged");

    const staleAssignee = await ask(manager, changeAssigneeText(editableTitle, supervisor.name));
    assert.equal(staleAssignee.proposal?.actionType, "TASK_UPDATE_ASSIGNEE", staleAssignee.body);
    await db.update(tasksTable).set({ assigneeId: member.id }).where(eq(tasksTable.id, editableTask.id));
    const staleAssigneeResult = await manager(`/asa/actions/${staleAssignee.proposal!.id}/confirm`, {});
    const [afterStaleAssignee] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(staleAssigneeResult.status === 409 && afterStaleAssignee?.assigneeId === member.id
      && (await state(staleAssignee.proposal!.id)) === "STALE", "Concurrent task reassignment invalidates an old assignee preview");
    await db.update(tasksTable).set({ assigneeId: director.id }).where(eq(tasksTable.id, editableTask.id));

    const revokedTarget = await ask(manager, changeAssigneeText(editableTitle, supervisor.name));
    assert.equal(revokedTarget.proposal?.actionType, "TASK_UPDATE_ASSIGNEE", revokedTarget.body);
    await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, supervisor.membershipId));
    const revokedTargetResult = await manager(`/asa/actions/${revokedTarget.proposal!.id}/confirm`, {});
    await db.update(userRolesTable).set({ active: true }).where(eq(userRolesTable.id, supervisor.membershipId));
    const [afterRevokedTarget] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(revokedTargetResult.status === 409 && afterRevokedTarget?.assigneeId === director.id
      && (await state(revokedTarget.proposal!.id)) === "STALE", "Assignee must retain active operation membership through confirmation");

    const rollbackAssignee = await ask(manager, changeAssigneeText(editableTitle, supervisor.name));
    assert.equal(rollbackAssignee.proposal?.actionType, "TASK_UPDATE_ASSIGNEE", rollbackAssignee.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackAssigneeResult: Response;
    try { rollbackAssigneeResult = await manager(`/asa/actions/${rollbackAssignee.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterAssigneeRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(rollbackAssigneeResult!.status === 500 && afterAssigneeRollback?.assigneeId === director.id
      && (await state(rollbackAssignee.proposal!.id)) === "PENDING", "Registry failure rolls back assignee update and proposal confirmation");

    const priorityPreview = await ask(manager, changePriorityText(editableTitle, "baixa"));
    assert.equal(priorityPreview.proposal?.actionType, "TASK_UPDATE_PRIORITY", priorityPreview.body);
    check(priorityPreview.proposal?.previousPriority === "HIGH" && priorityPreview.proposal?.priority === "LOW",
      "Priority preview shows the exact before and after values");
    const [beforePriorityConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforePriorityConfirm?.priority === "HIGH", "Priority preview does not write before confirmation");
    const memberPriorityAttempt = await ask(mine, changePriorityText(editableTitle, "baixa"));
    check(!memberPriorityAttempt.proposal && memberPriorityAttempt.body.includes("gestores autorizados"), "Member cannot prepare a task priority change");
    const priorityConfirm = await manager(`/asa/actions/${priorityPreview.proposal!.id}/confirm`, {});
    const [afterPriorityConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(priorityConfirm.status === 200 && afterPriorityConfirm?.priority === "LOW"
      && afterPriorityConfirm.assigneeId === beforePriorityConfirm?.assigneeId
      && afterPriorityConfirm.dueDate === beforePriorityConfirm?.dueDate
      && afterPriorityConfirm.status === beforePriorityConfirm?.status,
      "Confirmation changes only priority and preserves the task's other fields");
    check((await state(priorityPreview.proposal!.id)) === "CONFIRMED" && (await history(priorityPreview.proposal!.id)).length === 1,
      "Priority change and Registry event are recorded once");

    const cancelledPriority = await ask(manager, changePriorityText(editableTitle, "crítica"));
    assert.equal(cancelledPriority.proposal?.actionType, "TASK_UPDATE_PRIORITY", cancelledPriority.body);
    const cancelPriorityResult = await manager(`/asa/actions/${cancelledPriority.proposal!.id}/cancel`, {});
    const [afterPriorityCancel] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(cancelPriorityResult.status === 200 && afterPriorityCancel?.priority === "LOW"
      && (await state(cancelledPriority.proposal!.id)) === "CANCELLED", "Cancelling a priority change leaves the task unchanged");

    const stalePriority = await ask(manager, changePriorityText(editableTitle, "alta"));
    assert.equal(stalePriority.proposal?.actionType, "TASK_UPDATE_PRIORITY", stalePriority.body);
    await db.update(tasksTable).set({ priority: "MEDIUM" }).where(eq(tasksTable.id, editableTask.id));
    const stalePriorityResult = await manager(`/asa/actions/${stalePriority.proposal!.id}/confirm`, {});
    const [afterStalePriority] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(stalePriorityResult.status === 409 && afterStalePriority?.priority === "MEDIUM"
      && (await state(stalePriority.proposal!.id)) === "STALE", "Concurrent priority change invalidates the old preview");
    await db.update(tasksTable).set({ priority: "LOW" }).where(eq(tasksTable.id, editableTask.id));

    const duplicatePriorityTask = await db.insert(tasksTable).values({
      organizationId: orgs[0]!.id, operationId: operation!.id, title: editableTitle,
      creatorId: admin.id, assigneeId: director.id, dueDate: today, status: "CREATED",
    }).returning();
    try {
      const ambiguousPriority = await ask(manager, changePriorityText(editableTitle, "média"));
      check(!ambiguousPriority.proposal && /mais de uma tarefa/.test(ambiguousPriority.body),
        "Duplicate task titles require clarification before changing priority");
    } finally {
      await db.delete(tasksTable).where(eq(tasksTable.id, duplicatePriorityTask[0]!.id));
    }

    const rollbackPriority = await ask(manager, changePriorityText(editableTitle, "crítica"));
    assert.equal(rollbackPriority.proposal?.actionType, "TASK_UPDATE_PRIORITY", rollbackPriority.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackPriorityResult: Response;
    try { rollbackPriorityResult = await manager(`/asa/actions/${rollbackPriority.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterPriorityRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(rollbackPriorityResult!.status === 500 && afterPriorityRollback?.priority === "LOW"
      && (await state(rollbackPriority.proposal!.id)) === "PENDING", "Registry failure rolls back the priority update and proposal confirmation");
    check((await manager(`/asa/actions/${rollbackPriority.proposal!.id}/confirm`, {})).status === 200,
      "Priority update can be retried after transactional rollback");

    const descriptionPreview = await ask(manager, changeDescriptionText(editableTitle, "Separar, etiquetar e guardar os figurinos."));
    assert.equal(descriptionPreview.proposal?.actionType, "TASK_UPDATE_DESCRIPTION", descriptionPreview.body);
    check(descriptionPreview.proposal?.previousDescription === null
      && descriptionPreview.proposal?.description === "Separar, etiquetar e guardar os figurinos.",
      "Description preview shows the exact before and after text");
    const [beforeDescriptionConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforeDescriptionConfirm?.description === null, "Description preview does not write before confirmation");
    const memberDescriptionAttempt = await ask(mine, changeDescriptionText(editableTitle, "texto sem autorização"));
    check(!memberDescriptionAttempt.proposal && memberDescriptionAttempt.body.includes("gestores autorizados"), "Member cannot prepare a task description change");
    const descriptionConfirm = await manager(`/asa/actions/${descriptionPreview.proposal!.id}/confirm`, {});
    const [afterDescriptionConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(descriptionConfirm.status === 200 && afterDescriptionConfirm?.description === "Separar, etiquetar e guardar os figurinos."
      && afterDescriptionConfirm.title === beforeDescriptionConfirm?.title
      && afterDescriptionConfirm.assigneeId === beforeDescriptionConfirm?.assigneeId
      && afterDescriptionConfirm.dueDate === beforeDescriptionConfirm?.dueDate
      && afterDescriptionConfirm.priority === beforeDescriptionConfirm?.priority
      && afterDescriptionConfirm.status === beforeDescriptionConfirm?.status,
      "Confirmation changes only description and preserves all other task fields");
    check((await state(descriptionPreview.proposal!.id)) === "CONFIRMED" && (await history(descriptionPreview.proposal!.id)).length === 1,
      "Description change and Registry event are recorded once");

    const cancelledDescription = await ask(manager, changeDescriptionText(editableTitle, "texto que será cancelado"));
    assert.equal(cancelledDescription.proposal?.actionType, "TASK_UPDATE_DESCRIPTION", cancelledDescription.body);
    const cancelDescriptionResult = await manager(`/asa/actions/${cancelledDescription.proposal!.id}/cancel`, {});
    const [afterDescriptionCancel] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(cancelDescriptionResult.status === 200 && afterDescriptionCancel?.description === "Separar, etiquetar e guardar os figurinos."
      && (await state(cancelledDescription.proposal!.id)) === "CANCELLED", "Cancelling a description change leaves the task unchanged");

    const staleDescription = await ask(manager, changeDescriptionText(editableTitle, "descrição nova"));
    assert.equal(staleDescription.proposal?.actionType, "TASK_UPDATE_DESCRIPTION", staleDescription.body);
    await db.update(tasksTable).set({ description: "edição concorrente" }).where(eq(tasksTable.id, editableTask.id));
    const staleDescriptionResult = await manager(`/asa/actions/${staleDescription.proposal!.id}/confirm`, {});
    const [afterStaleDescription] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(staleDescriptionResult.status === 409 && afterStaleDescription?.description === "edição concorrente"
      && (await state(staleDescription.proposal!.id)) === "STALE", "Concurrent description change invalidates the old preview");

    const rollbackDescription = await ask(manager, changeDescriptionText(editableTitle, "nova descrição revisada"));
    assert.equal(rollbackDescription.proposal?.actionType, "TASK_UPDATE_DESCRIPTION", rollbackDescription.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackDescriptionResult: Response;
    try { rollbackDescriptionResult = await manager(`/asa/actions/${rollbackDescription.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterDescriptionRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(rollbackDescriptionResult!.status === 500 && afterDescriptionRollback?.description === "edição concorrente"
      && (await state(rollbackDescription.proposal!.id)) === "PENDING", "Registry failure rolls back the description update and proposal confirmation");
    check((await manager(`/asa/actions/${rollbackDescription.proposal!.id}/confirm`, {})).status === 200,
      "Description update can be retried after transactional rollback");

    const renamedTitle = `${tag}_renamed_task`;
    const titlePreview = await ask(manager, changeTitleText(editableTitle, renamedTitle));
    assert.equal(titlePreview.proposal?.actionType, "TASK_UPDATE_TITLE", titlePreview.body);
    check(titlePreview.proposal?.previousTitle === editableTitle && titlePreview.proposal?.newTitle === renamedTitle,
      "Title preview shows the exact before and after values");
    const [beforeTitleConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(beforeTitleConfirm?.title === editableTitle, "Title preview does not write before confirmation");
    const memberTitleAttempt = await ask(mine, changeTitleText(editableTitle, `${tag}_unauthorized_title`));
    check(!memberTitleAttempt.proposal && memberTitleAttempt.body.includes("gestores autorizados"), "Member cannot prepare a task title change");
    const titleConfirm = await manager(`/asa/actions/${titlePreview.proposal!.id}/confirm`, {});
    const [afterTitleConfirm] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(titleConfirm.status === 200 && afterTitleConfirm?.title === renamedTitle
      && afterTitleConfirm.description === beforeTitleConfirm?.description
      && afterTitleConfirm.assigneeId === beforeTitleConfirm?.assigneeId
      && afterTitleConfirm.dueDate === beforeTitleConfirm?.dueDate
      && afterTitleConfirm.priority === beforeTitleConfirm?.priority
      && afterTitleConfirm.status === beforeTitleConfirm?.status,
      "Confirmation changes only the title and preserves all other task fields");
    check((await state(titlePreview.proposal!.id)) === "CONFIRMED" && (await history(titlePreview.proposal!.id)).length === 1,
      "Title change and Registry event are recorded once");

    const cancelledTitle = await ask(manager, changeTitleText(renamedTitle, `${tag}_cancelled_title`));
    assert.equal(cancelledTitle.proposal?.actionType, "TASK_UPDATE_TITLE", cancelledTitle.body);
    const cancelTitleResult = await manager(`/asa/actions/${cancelledTitle.proposal!.id}/cancel`, {});
    const [afterTitleCancel] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(cancelTitleResult.status === 200 && afterTitleCancel?.title === renamedTitle
      && (await state(cancelledTitle.proposal!.id)) === "CANCELLED", "Cancelling a title change leaves the task unchanged");

    const staleTitle = await ask(manager, changeTitleText(renamedTitle, `${tag}_stale_title`));
    assert.equal(staleTitle.proposal?.actionType, "TASK_UPDATE_TITLE", staleTitle.body);
    await db.update(tasksTable).set({ description: "mudança concorrente antes do título" }).where(eq(tasksTable.id, editableTask.id));
    const staleTitleResult = await manager(`/asa/actions/${staleTitle.proposal!.id}/confirm`, {});
    const [afterStaleTitle] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(staleTitleResult.status === 409 && afterStaleTitle?.title === renamedTitle
      && afterStaleTitle.description === "mudança concorrente antes do título"
      && (await state(staleTitle.proposal!.id)) === "STALE", "Concurrent task edit invalidates the title preview");

    const rollbackTitle = await ask(manager, changeTitleText(renamedTitle, `${tag}_rollback_title`));
    assert.equal(rollbackTitle.proposal?.actionType, "TASK_UPDATE_TITLE", rollbackTitle.body);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let rollbackTitleResult: Response;
    try { rollbackTitleResult = await manager(`/asa/actions/${rollbackTitle.proposal!.id}/confirm`, {}); }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [afterTitleRollback] = await db.select().from(tasksTable).where(eq(tasksTable.id, editableTask.id)).limit(1);
    check(rollbackTitleResult!.status === 500 && afterTitleRollback?.title === renamedTitle
      && (await state(rollbackTitle.proposal!.id)) === "PENDING", "Registry failure rolls back the title update and proposal confirmation");
    check((await manager(`/asa/actions/${rollbackTitle.proposal!.id}/confirm`, {})).status === 200,
      "Title update can be retried after transactional rollback");

    // Separate proposals in one operation must not deadlock on authorization locks.
    const independentTask = await preview("TASK_CREATE", `${tag}_parallel_task`);
    const independentNotice = await preview("NOTICE_DRAFT_CREATE", `${tag}_parallel_notice`);
    const independent = await Promise.all([manager(`/asa/actions/${independentTask.id}/confirm`, {}), manager(`/asa/actions/${independentNotice.id}/confirm`, {})]);
    check(independent.every(response => response.status === 200), "Different proposals in the same operation can be confirmed concurrently");

    for (const change of ["role", "inactive", "organization"] as const) {
      const title = `${tag}_audience_${change}`;
      const proposal = await preview("NOTICE_DRAFT_CREATE", title);
      if (change === "role") await db.update(userRolesTable).set({ active: false }).where(eq(userRolesTable.id, member.membershipId));
      if (change === "inactive") await db.update(usersTable).set({ status: "INACTIVE" }).where(eq(usersTable.id, member.id));
      if (change === "organization") await db.update(usersTable).set({ organizationId: orgs[1]!.id }).where(eq(usersTable.id, member.id));
      const response = await manager(`/asa/actions/${proposal.id}/confirm`, {});
      await db.update(userRolesTable).set({ active: true }).where(eq(userRolesTable.id, member.membershipId));
      await db.update(usersTable).set({ status: "ACTIVE", organizationId: orgs[0]!.id }).where(eq(usersTable.id, member.id));
      check(response.status === 409 && (await targets("NOTICE_DRAFT_CREATE", title)).length === 0, `Notice refuses changed audience: ${change}`);
    }
    await db.update(usersTable).set({ status: "INACTIVE" }).where(eq(usersTable.id, outsider.id));
    await db.insert(userRolesTable).values({ userId: foreign.id, operationId: operation!.id, role: "MEMBER", active: true });
    const boundedAudience = await preview("NOTICE_DRAFT_CREATE", `${tag}_bounded_audience`);
    const boundedResponse = await manager(`/asa/actions/${boundedAudience.id}/confirm`, {});
    const boundedTarget = (await targets("NOTICE_DRAFT_CREATE", `${tag}_bounded_audience`))[0];
    const boundedRecipients = boundedTarget ? await db.select().from(noticeRecipientsTable).where(eq(noticeRecipientsTable.noticeId, boundedTarget.id)) : [];
    check(boundedResponse.status === 200 && boundedAudience.recipientCount === 4 && boundedRecipients.length === 4 && !boundedRecipients.some(row => [outsider.id, foreign.id].includes(row.userId)), "Notice audience excludes inactive people and stale foreign memberships");
  } finally {
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); }
    if (conversationIds.length) {
      await db.delete(aiMessages).where(inArray(aiMessages.conversationId, conversationIds));
      await db.delete(conversations).where(inArray(conversations.id, conversationIds));
    }
    if (messageThreadIds.length) {
      await db.delete(messagesTable).where(inArray(messagesTable.threadId, messageThreadIds));
      await db.delete(messageThreadParticipantsTable).where(inArray(messageThreadParticipantsTable.threadId, messageThreadIds));
      await db.delete(messageThreadsTable).where(inArray(messageThreadsTable.id, messageThreadIds));
    }
    if (muralPostIds.length) {
      await db.delete(announcementCommentsTable).where(inArray(announcementCommentsTable.announcementId, muralPostIds));
      await db.delete(announcementReadsTable).where(inArray(announcementReadsTable.announcementId, muralPostIds));
      await db.delete(announcementsTable).where(inArray(announcementsTable.id, muralPostIds));
    }
    if (orgIds.length) {
      if (libraryDocumentIds.length) {
        await db.delete(libraryViewsTable).where(inArray(libraryViewsTable.documentId, libraryDocumentIds));
        await db.delete(libraryDocumentsTable).where(inArray(libraryDocumentsTable.id, libraryDocumentIds));
      }
      if (libraryCategoryIds.length) await db.delete(libraryCategoriesTable).where(inArray(libraryCategoriesTable.id, libraryCategoryIds));
      const operations = await db.select({ id: operationsTable.id }).from(operationsTable).where(inArray(operationsTable.organizationId, orgIds));
      const ids = operations.map(item => item.id);
      await db.delete(historyEventsTable).where(inArray(historyEventsTable.orgId, orgIds));
      await db.delete(asaAuditLogTable).where(inArray(asaAuditLogTable.organizationId, orgIds));
      if (ids.length) {
        const notices = await db.select({ id: noticesTable.id }).from(noticesTable).where(inArray(noticesTable.operationId, ids));
        if (notices.length) await db.delete(noticeRecipientsTable).where(inArray(noticeRecipientsTable.noticeId, notices.map(item => item.id)));
        await db.delete(noticesTable).where(inArray(noticesTable.operationId, ids));
        await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.operationId, ids));
        await db.delete(folgasTable).where(inArray(folgasTable.operationId, ids));
        await db.delete(recurringActivitiesTable).where(inArray(recurringActivitiesTable.operationId, ids));
        await db.delete(tasksTable).where(inArray(tasksTable.operationId, ids));
        await db.delete(delegationsTable).where(inArray(delegationsTable.operationId, ids));
        await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.operationId, ids));
      }
      const testResponsibilities = await db.select({ id: responsibilitiesTable.id }).from(responsibilitiesTable).where(inArray(responsibilitiesTable.orgId, orgIds));
      if (testResponsibilities.length) {
        await db.delete(responsibilityAssignmentsTable).where(inArray(responsibilityAssignmentsTable.responsibilityId, testResponsibilities.map((item) => item.id)));
      }
      await db.delete(responsibilitiesTable).where(inArray(responsibilitiesTable.orgId, orgIds));
      if (userIds.length) {
        await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
        await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.supervisorId, userIds));
        await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
        if (showBookPositionIds.length) await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.id, showBookPositionIds));
        if (showBookBlockIds.length) await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.id, showBookBlockIds));
        if (showBookSceneIds.length) await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.id, showBookSceneIds));
        if (showBookIds.length) await db.delete(showBooksTable).where(inArray(showBooksTable.id, showBookIds));
        await db.delete(usersTable).where(inArray(usersTable.id, userIds));
      }
      await db.delete(areasTable).where(inArray(areasTable.organizationId, orgIds));
      await db.delete(locationsTable).where(inArray(locationsTable.organizationId, orgIds));
      await db.delete(operationsTable).where(inArray(operationsTable.organizationId, orgIds));
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, orgIds));
    }
    await pool.end();
  }
  console.log(`ASA actions HTTP: ${passed} passed, ${failures.length} failed`);
  assert.equal(failures.length, 0, failures.join("\n"));
}

run().catch(error => { console.error(error); process.exitCode = 1; });
