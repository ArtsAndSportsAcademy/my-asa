/** Grupo C — Mural, Mensagens e Biblioteca contra Postgres real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import { aiMessages, agendaEventsTable, announcementCommentsTable, announcementReadsTable, announcementRecipientsTable, announcementsTable, areaLocalSupervisorsTable, areasTable, conversations, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable, db, delegationsTable, deliveriesTable, deliveryAssignmentsTable, folgasTable, historyEventsTable, libraryDocumentFilesTable, libraryDocumentVersionsTable, libraryDocumentsTable, libraryViewsTable, locationsTable, messageThreadParticipantsTable, messageThreadsTable, messagesTable, operationalCheckInsTable, operationLocationsTable, operationsTable, organizationsTable, pool, scaleAllocationsTable, scalesTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate } from "../src/lib/operational-date.js";
import { tasksTable } from "@workspace/db";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `grupo_c_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [foreignOrg] = await db.insert(organizationsTable).values({ name: `${tag}_foreign_org` }).returning();
  const [operation, otherOperation] = await db.insert(operationsTable).values([{ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }, { organizationId: org!.id, name: `${tag}_other_op`, status: "ACTIVE" }]).returning();
  const [foreignOperation] = await db.insert(operationsTable).values({ organizationId: foreignOrg!.id, name: `${tag}_foreign_op`, status: "ACTIVE" }).returning();
  const [location, unassignedLocation] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Outro` }]).returning();
  const [area, otherArea] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }]).returning();
  const makeUser = async (name: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, areaId, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin", null), director = await makeUser("dir", null), sup = await makeUser("sup", area!.id), member = await makeUser("mem", area!.id), outsider = await makeUser("other", otherArea!.id);
  const all = [admin, director, sup, member, outsider]; const asaConversationIds: number[] = []; const dailyBookIds: string[] = []; const agendaEventIds: string[] = []; let server: http.Server | null = null;
  try {
    await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: location!.id });
    await db.insert(userRolesTable).values([{ userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true }, { userId: director.id, operationId: operation!.id, role: "DIR", active: true }, { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true }, { userId: sup.id, operationId: otherOperation!.id, role: "SUPERVISOR_A", active: true }, ...[member, outsider].map(user => ({ userId: user.id, operationId: operation!.id, role: "MEMBER" as const, active: true }))]);
    const [memberDelivery, outsiderDelivery] = await db.insert(deliveriesTable).values([
      { creatorId: admin.id, operationId: operation!.id, title: `${tag}_entrega_mem`, type: "MANDATORY_READ", content: {}, dueDate: "2026-10-15", maxDueDate: "2026-10-20", status: "PUBLISHED", publishedAt: new Date() },
      { creatorId: admin.id, operationId: operation!.id, title: `${tag}_entrega_other`, type: "VIDEO", content: {}, dueDate: "2026-10-16", maxDueDate: "2026-10-21", status: "PUBLISHED", publishedAt: new Date() },
    ]).returning();
    await db.insert(deliveryAssignmentsTable).values([{ deliveryId: memberDelivery!.id, userId: member.id }, { deliveryId: outsiderDelivery!.id, userId: outsider.id }]);
    const dailyBookDate = operationalDate();
    const [publishedEvent, draftEvent] = await db.insert(agendaEventsTable).values([
      { operationId: operation!.id, type: "SHOW", title: `${tag}_show_publicado`, date: dailyBookDate, startTime: "14:00:00", endTime: "15:00:00", status: "CONFIRMED", createdBy: admin.id },
      { operationId: operation!.id, type: "SHOW", title: `${tag}_show_rascunho`, date: dailyBookDate, status: "CONFIRMED", createdBy: admin.id },
    ]).returning();
    agendaEventIds.push(publishedEvent!.id, draftEvent!.id);
    const [publishedBook] = await db.insert(dailyBooksTable).values([
      { agendaEventId: publishedEvent!.id, status: "PUBLISHED", publishedAt: new Date(), publishedBy: admin.id },
    ]).returning();
    const [draftBook] = await db.insert(dailyBooksTable).values([
      { agendaEventId: draftEvent!.id, status: "DRAFT", generatedBy: admin.id },
    ]).returning();
    dailyBookIds.push(publishedBook!.id, draftBook!.id);
    const [scene] = await db.insert(dailyBookScenesTable).values({ dailyBookId: publishedBook!.id, name: `${tag}_cena`, order: 1 }).returning();
    const [block] = await db.insert(dailyBookBlocksTable).values({ dailyBookId: publishedBook!.id, sceneId: scene!.id, name: `${tag}_bloco`, order: 1, startTime: "10:00:00", endTime: "10:30:00" }).returning();
    const [position] = await db.insert(dailyBookPositionsTable).values({ dailyBookId: publishedBook!.id, blockId: block!.id, name: `${tag}_posicao` }).returning();
    await db.insert(dailyBookAssignmentsTable).values({ dailyBookId: publishedBook!.id, positionId: position!.id, userId: member.id, status: "ASSIGNED" });
    await db.insert(operationalCheckInsTable).values([
      { orgId: org!.id, operationId: operation!.id, userId: member.id, date: operationalDate(), status: "CHECKED_IN", registeredBy: admin.id },
      { orgId: org!.id, operationId: operation!.id, userId: sup.id, date: operationalDate(), status: "LATE", registeredBy: admin.id },
      { orgId: org!.id, operationId: operation!.id, userId: outsider.id, date: operationalDate(), status: "ABSENT", registeredBy: admin.id },
      { orgId: org!.id, operationId: operation!.id, userId: director.id, date: operationalDate(), status: "EXPECTED", registeredBy: admin.id },
    ]);
    await db.insert(tasksTable).values([
      { organizationId: org!.id, operationId: operation!.id, creatorId: admin.id, assigneeId: member.id, title: `${tag}_tarefa_pendente`, dueDate: operationalDate(), status: "CREATED" },
      { organizationId: org!.id, operationId: operation!.id, creatorId: admin.id, assigneeId: outsider.id, title: `${tag}_tarefa_andamento`, dueDate: operationalDate(), status: "IN_PROGRESS" },
      { organizationId: org!.id, operationId: operation!.id, creatorId: admin.id, assigneeId: sup.id, title: `${tag}_tarefa_concluida`, dueDate: operationalDate(), status: "COMPLETED" },
    ]);
    await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: location!.id, supervisorId: sup.id });
    const [scale] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: location!.id, title: `${tag}_scale`, periodStart: "2026-10-05", periodEnd: "2026-10-05", status: "PUBLISHED", createdBy: admin.id }).returning();
    await db.insert(scaleAllocationsTable).values({ scaleId: scale!.id, userId: member.id, status: "ASSIGNED" });
    const [todayScale] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: location!.id, title: `${tag}_today_scale`, periodStart: dailyBookDate, periodEnd: dailyBookDate, status: "PUBLISHED", createdBy: admin.id }).returning();
    await db.insert(scaleAllocationsTable).values({ scaleId: todayScale!.id, agendaEventId: publishedEvent!.id, userId: member.id, status: "ASSIGNED" });
    await db.insert(scaleAllocationsTable).values([
      { scaleId: todayScale!.id, userId: member.id, status: "ASSIGNED", manualDate: dailyBookDate, startTime: "09:00", endTime: "10:00", manualLabel: `${tag}_ensaio_1` },
      { scaleId: todayScale!.id, userId: member.id, status: "ASSIGNED", manualDate: dailyBookDate, startTime: "12:00", endTime: "13:00", manualLabel: `${tag}_ensaio_2` },
      { scaleId: todayScale!.id, userId: sup.id, status: "ASSIGNED", manualDate: dailyBookDate, startTime: "09:00", endTime: "10:00", manualLabel: `${tag}_ensaio_sup_1` },
      { scaleId: todayScale!.id, userId: sup.id, status: "ASSIGNED", manualDate: dailyBookDate, startTime: "12:00", endTime: "13:00", manualLabel: `${tag}_ensaio_sup_2` },
    ]);
    await db.insert(folgasTable).values({ userId: sup.id, operationId: operation!.id, type: "DAY_OFF", startDate: dailyBookDate, endDate: dailyBookDate, status: "ACTIVE", createdBy: admin.id });
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou"); const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const adminApi = as(admin.id, "ADMIN"), directorApi = as(director.id, "DIR"), supApi = as(sup.id, "SUPERVISOR_A"), memApi = as(member.id, "MEMBER"), outsideApi = as(outsider.id, "MEMBER");
    const supNoOperationApi = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: sup.id, jti: `${tag}_${sup.id}_no_operation`, organizationId: org!.id, role: "SUPERVISOR_A", operationIds: [] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const post = (api: typeof adminApi, path: string, body?: unknown) => api(path, { method: "POST", body: JSON.stringify(body ?? {}) });
    const askAsa = async (api: typeof adminApi, content: string, context?: Record<string, unknown>) => {
      const created = await post(api, "/asa/conversations", { title: `${tag}_ASA` });
      const conversation = await created.json() as { id: number };
      if (created.status !== 201 || !conversation.id) throw new Error("Não foi possível criar conversa sintética da ASA");
      asaConversationIds.push(conversation.id);
      const response = await post(api, `/asa/chat/${conversation.id}/messages`, { content, ...(context ? { context } : {}) });
      return { status: response.status, body: await response.text(), conversationId: conversation.id };
    };
    const proposalFrom = (body: string) => {
      const line = body.split(/\r?\n/).find(item => item.startsWith("data: ") && item.includes('"proposal"'));
      return line ? (JSON.parse(line.slice(6)) as { proposal?: { id?: string; content?: string } }).proposal : undefined;
    };

    const directoryResponse = await memApi("/communication/people");
    const directoryBody = await directoryResponse.json() as { people: Array<Record<string, unknown>> };
    assert(directoryResponse.status === 200 && directoryBody.people?.some(person => person.name === `${tag}_mem` && person.areaName === `${tag}_Patinadores`), `Diretório oficial lista somente nome e área para colegas da organização (HTTP ${directoryResponse.status}: ${JSON.stringify(directoryBody)})`);
    assert(directoryBody.people.every(person => Object.keys(person).every(key => ["id", "name", "areaName"].includes(key))), "Diretório não expõe contatos ou campos adicionais");
    const asaPeopleSearch = await askAsa(memApi, `buscar pessoas por ‘${tag}_Bailarinos’`);
    assert(asaPeopleSearch.status === 200 && asaPeopleSearch.body.includes(`${tag}_other · ${tag}_Bailarinos`) && !asaPeopleSearch.body.includes(`${tag}_mem`), "ASA busca colegas por área sem listar resultados fora do filtro");
    assert(!asaPeopleSearch.body.includes(outsider.id) && !asaPeopleSearch.body.includes("email"), "Resposta da ASA omite identificadores e contatos");
    const memberLocations = await memApi("/locations");
    const supervisorLocations = await supApi("/locations");
    const supervisorLocationBody = await supervisorLocations.json() as { locations: Array<{ id: string }> };
    assert(memberLocations.status === 403, "Diretório de locais mantém bloqueio para integrantes comuns");
    assert(supervisorLocations.status === 200 && supervisorLocationBody.locations.length === 1 && supervisorLocationBody.locations[0]?.id === location!.id && !supervisorLocationBody.locations.some(item => item.id === unassignedLocation!.id), "Supervisão recebe somente locais das designações ativas");
    const asaSupervisorLocations = await askAsa(supApi, "mostrar locais");
    const asaMemberLocations = await askAsa(memApi, "mostrar locais");
    assert(asaSupervisorLocations.status === 200 && asaSupervisorLocations.body.includes(`${tag}_Snowland`) && !asaSupervisorLocations.body.includes(`${tag}_Outro`), "ASA aplica à Supervisão o mesmo escopo da rota oficial de locais");
    assert(asaMemberLocations.status === 200 && asaMemberLocations.body.includes("somente para Administração, Direção e Supervisão"), "ASA não contorna a permissão oficial de consulta de locais");
    const ownDeliveryFeed = await memApi("/deliveries/my");
    const ownDeliveryBody = await ownDeliveryFeed.json() as { assignments: Array<{ deliveryTitle: string }> };
    const asaOwnDeliveries = await askAsa(memApi, "Minhas entregas");
    const asaTeamDeliveries = await askAsa(adminApi, "entregas da equipe", { operationId: operation!.id });
    const asaSupervisorDeliveries = await askAsa(supApi, "entregas da operação", { operationId: operation!.id });
    const asaMemberTeamDeliveries = await askAsa(memApi, "entregas da equipe", { operationId: operation!.id });
    const asaForeignOperationDeliveries = await askAsa(adminApi, "entregas da equipe", { operationId: "00000000-0000-4000-8000-000000000000" });
    const asaAdminDailyBook = await askAsa(adminApi, "mostra o Livro do Dia", { operationId: operation!.id });
    const asaSupervisorDailyBook = await askAsa(supApi, "mostra o Livro do Dia", { operationId: operation!.id });
    const asaMemberDailyBook = await askAsa(memApi, "mostra o Livro do Dia", { operationId: operation!.id });
    const asaForeignOperationDailyBook = await askAsa(adminApi, "mostra o Livro do Dia", { operationId: "00000000-0000-4000-8000-000000000000" });
    assert(ownDeliveryFeed.status === 200 && ownDeliveryBody.assignments.some(item => item.deliveryTitle === `${tag}_entrega_mem`) && !ownDeliveryBody.assignments.some(item => item.deliveryTitle === `${tag}_entrega_other`), "Rota oficial de entregas lista apenas atribuições da própria pessoa");
    assert(asaOwnDeliveries.status === 200 && asaOwnDeliveries.body.includes(`${tag}_entrega_mem`) && !asaOwnDeliveries.body.includes(`${tag}_entrega_other`), "ASA consulta apenas entregas atribuídas à pessoa autenticada");
    assert(asaTeamDeliveries.status === 200 && asaTeamDeliveries.body.includes(`${tag}_entrega_mem`) && asaTeamDeliveries.body.includes(`${tag}_entrega_other`) && asaTeamDeliveries.body.includes("1 pessoa atribuída") && !asaTeamDeliveries.body.includes(member.name) && !asaTeamDeliveries.body.includes(outsider.name), "Administração consulta entregas publicadas da operação com contagens agregadas sem nomes");
    assert(asaSupervisorDeliveries.status === 200 && asaSupervisorDeliveries.body.includes(`${tag}_entrega_mem`) && asaSupervisorDeliveries.body.includes(`${tag}_entrega_other`), "Supervisão autorizada consulta entregas agregadas da operação selecionada");
    assert(asaMemberTeamDeliveries.status === 200 && asaMemberTeamDeliveries.body.includes("somente para Administração e Supervisão") && !asaMemberTeamDeliveries.body.includes(`${tag}_entrega_other`), "Integrante comum não consulta entregas da equipe");
    assert(asaForeignOperationDeliveries.status === 200 && asaForeignOperationDeliveries.body.includes("operação") && !asaForeignOperationDeliveries.body.includes(`${tag}_entrega_mem`), "Consulta de equipe recusa operação fora do escopo");
    assert(asaAdminDailyBook.status === 200 && asaAdminDailyBook.body.includes(`${tag}_show_publicado`) && asaAdminDailyBook.body.includes(`${tag}_show_rascunho`), "Administração consulta Livro do Dia publicado e rascunho no escopo autorizado");
    assert(asaSupervisorDailyBook.status === 200 && asaSupervisorDailyBook.body.includes(`${tag}_show_publicado`) && asaSupervisorDailyBook.body.includes(`${tag}_show_rascunho`), "Supervisão consulta Livro do Dia sem responsável definido na sua operação");
    assert(asaMemberDailyBook.status === 200 && asaMemberDailyBook.body.includes(`${tag}_show_publicado`) && !asaMemberDailyBook.body.includes(`${tag}_show_rascunho`) && asaMemberDailyBook.body.includes(`${tag}_posicao`) && asaMemberDailyBook.body.includes(`${tag}_mem`), "Integrante consulta somente Livro do Dia publicado com cenas e convocação");
    assert(asaForeignOperationDailyBook.status === 200 && asaForeignOperationDailyBook.body.includes("operação") && !asaForeignOperationDailyBook.body.includes(`${tag}_show_publicado`), "Consulta do Livro do Dia recusa operação fora do escopo");
    const adminAttendanceReport = await askAsa(adminApi, "Resumo de check-ins da equipe dos últimos 7 dias");
    const memberAttendanceReport = await askAsa(memApi, "Resumo de check-ins dos últimos 7 dias");
    const adminTaskReport = await askAsa(adminApi, "Resumo das tarefas da equipe dos últimos 7 dias", { operationId: operation!.id });
    const memberTaskReport = await askAsa(memApi, "Resumo das tarefas dos últimos 7 dias");
    const unavailableTaskReport = await askAsa(adminApi, "Resumo das tarefas da equipe dos últimos 7 dias", { operationId: "00000000-0000-4000-8000-000000000000" });
    assert(adminAttendanceReport.status === 200 && adminAttendanceReport.body.includes("1 presentes, 1 atrasados, 1 ausentes") && adminAttendanceReport.body.includes("33.3%"), "ASA apresenta percentuais agregados de check-in usando o cálculo oficial");
    assert(memberAttendanceReport.status === 200 && memberAttendanceReport.body.includes("somente para Administração"), "ASA impede relatórios agregados para perfis sem permissão");
    assert(adminTaskReport.status === 200 && adminTaskReport.body.includes("3 no total, 2 pendentes, 1 em andamento") && adminTaskReport.body.includes("1 concluídas/aprovadas"), "ASA resume tarefas da organização por estado e período");
    assert(!adminTaskReport.body.includes(`${tag}_tarefa`) && !adminTaskReport.body.includes(`${tag}_mem`) && !adminTaskReport.body.includes(`${tag}_other`), "Resumo de tarefas não expõe títulos nem nomes de responsáveis");
    assert(memberTaskReport.status === 200 && memberTaskReport.body.includes("somente para Administração e Direção"), "ASA impede resumo agregado de tarefas para integrantes");
    assert(adminTaskReport.body.includes("3 no total") && !unavailableTaskReport.body.includes("3 no total") && unavailableTaskReport.body.includes("operação"), "Resumo respeita a operação selecionada e recusa operação fora do escopo");

    const memberCheckIn = await askAsa(memApi, "qual meu check-in hoje?", { operationId: operation!.id });
    const outsiderCheckIn = await askAsa(outsideApi, "qual meu check-in hoje?", { operationId: operation!.id });
    const adminTeamCheckIns = await askAsa(adminApi, "mostra os check-ins da equipe hoje", { operationId: operation!.id });
    const memberTeamCheckIns = await askAsa(memApi, "mostra os check-ins da equipe hoje", { operationId: operation!.id });
    const foreignOperationCheckIns = await askAsa(adminApi, "mostra os check-ins da equipe hoje", { operationId: "00000000-0000-4000-8000-000000000000" });
    const foreignOrganizationCheckIns = await askAsa(adminApi, "mostra os check-ins da equipe hoje", { operationId: foreignOperation!.id });
    await db.update(operationsTable).set({ status: "PAUSED" }).where(eq(operationsTable.id, operation!.id));
    const pausedOperationCheckIns = await askAsa(adminApi, "mostra os check-ins da equipe hoje", { operationId: operation!.id });
    await db.update(operationsTable).set({ status: "ACTIVE" }).where(eq(operationsTable.id, operation!.id));
    assert(memberCheckIn.status === 200 && memberCheckIn.body.includes("está registrado"), "Integrante consulta apenas o próprio check-in previsto na escala publicada");
    assert(outsiderCheckIn.status === 200 && outsiderCheckIn.body.includes("não tem atividade publicada") && !outsiderCheckIn.body.includes(`${tag}_mem`), "Check-in pessoal não expõe registro nem escala de outra pessoa sem atividade prevista");
    assert(adminTeamCheckIns.status === 200 && adminTeamCheckIns.body.includes(`${tag}_mem`) && adminTeamCheckIns.body.includes("presente"), "Administração consulta check-ins apenas das pessoas previstas na escala da operação selecionada");
    assert(memberTeamCheckIns.status === 200 && memberTeamCheckIns.body.includes("somente para gestores") && !memberTeamCheckIns.body.includes(`${tag}_mem`), "Integrante não consulta check-ins da equipe");
    assert(foreignOperationCheckIns.status === 200 && foreignOperationCheckIns.body.includes("operação") && !foreignOperationCheckIns.body.includes(`${tag}_mem`), "Check-ins da equipe recusam operação fora do escopo");
    assert(foreignOrganizationCheckIns.status === 200 && foreignOrganizationCheckIns.body.includes("não está mais disponível") && !foreignOrganizationCheckIns.body.includes(`${tag}_mem`), "Check-ins não aceitam operação de outra organização");
    assert(pausedOperationCheckIns.status === 200 && pausedOperationCheckIns.body.includes("operação") && !pausedOperationCheckIns.body.includes(`${tag}_mem`), "Check-ins da equipe recusam operação pausada mesmo com vínculo ativo");
    const [checkInDelegation] = await db.insert(delegationsTable).values({ delegatorId: admin.id, delegateeId: sup.id, operationId: operation!.id, validFrom: new Date(Date.now() - 60_000), responsibilities: ["CHECK_INS"] }).returning();
    await db.update(userRolesTable).set({ active: false }).where(and(eq(userRolesTable.userId, sup.id), eq(userRolesTable.operationId, operation!.id)));
    const delegatedTeamCheckIns = await askAsa(supNoOperationApi, "mostra os check-ins da equipe hoje", { operationId: operation!.id });
    await db.update(delegationsTable).set({ revokedAt: new Date() }).where(eq(delegationsTable.id, checkInDelegation!.id));
    const revokedTeamCheckIns = await askAsa(supNoOperationApi, "mostra os check-ins da equipe hoje", { operationId: operation!.id });
    await db.update(delegationsTable).set({ revokedAt: null }).where(eq(delegationsTable.id, checkInDelegation!.id));
    await db.update(userRolesTable).set({ active: true }).where(and(eq(userRolesTable.userId, sup.id), eq(userRolesTable.operationId, operation!.id)));
    assert(delegatedTeamCheckIns.status === 200 && delegatedTeamCheckIns.body.includes(`${tag}_mem`), `Supervisão delegada com responsabilidade CHECK_INS consulta check-ins da operação autorizada: ${delegatedTeamCheckIns.body}`);
    assert(revokedTeamCheckIns.status === 200 && revokedTeamCheckIns.body.includes("não está mais disponível") && !revokedTeamCheckIns.body.includes(`${tag}_mem`), `Delegação CHECK_INS revogada deixa de autorizar consulta da equipe: ${revokedTeamCheckIns.body}`);
    await db.update(scalesTable).set({ status: "DRAFT" }).where(eq(scalesTable.id, todayScale!.id));
    const unpublishedCheckIns = await askAsa(adminApi, "mostra os check-ins da equipe hoje", { operationId: operation!.id });
    await db.update(scalesTable).set({ status: "PUBLISHED" }).where(eq(scalesTable.id, todayScale!.id));
    assert(unpublishedCheckIns.status === 200 && unpublishedCheckIns.body.includes("Ninguém está previsto") && !unpublishedCheckIns.body.includes(`${tag}_mem`), "Check-ins da equipe não usam alocações de escala não publicada");
    const [scaleDelegation] = await db.insert(delegationsTable).values({ delegatorId: admin.id, delegateeId: sup.id, operationId: operation!.id, validFrom: new Date(Date.now() - 60_000), responsibilities: ["SCALES"] }).returning();
    await db.update(userRolesTable).set({ active: false }).where(and(eq(userRolesTable.userId, sup.id), eq(userRolesTable.operationId, operation!.id)));
    const delegatedTeamFreeTime = await askAsa(supNoOperationApi, "intervalos livres da equipe hoje", { operationId: operation!.id });
    await db.update(delegationsTable).set({ revokedAt: new Date() }).where(eq(delegationsTable.id, scaleDelegation!.id));
    const revokedTeamFreeTime = await askAsa(supNoOperationApi, "intervalos livres da equipe hoje", { operationId: operation!.id });
    await db.update(delegationsTable).set({ revokedAt: null }).where(eq(delegationsTable.id, scaleDelegation!.id));
    await db.update(userRolesTable).set({ active: true }).where(and(eq(userRolesTable.userId, sup.id), eq(userRolesTable.operationId, operation!.id)));
    assert(delegatedTeamFreeTime.status === 200 && delegatedTeamFreeTime.body.includes(`${tag}_mem`), `Supervisão delegada com responsabilidade SCALES consulta os intervalos da equipe: ${delegatedTeamFreeTime.body}`);
    assert(revokedTeamFreeTime.status === 200 && revokedTeamFreeTime.body.includes("não está mais disponível") && !revokedTeamFreeTime.body.includes(`${tag}_mem`), `Delegação SCALES revogada deixa de autorizar a consulta: ${revokedTeamFreeTime.body}`);
    const memberFreeTime = await askAsa(memApi, "meus intervalos livres hoje", { operationId: operation!.id });
    const teamFreeTime = await askAsa(adminApi, "intervalos livres da equipe hoje", { operationId: operation!.id });
    const memberTeamFreeTime = await askAsa(memApi, "intervalos livres da equipe hoje", { operationId: operation!.id });
    const adminTeamAbsences = await askAsa(adminApi, "folgas da equipe hoje", { operationId: operation!.id });
    const memberTeamAbsences = await askAsa(memApi, "folgas da equipe hoje", { operationId: operation!.id });
    await db.update(scalesTable).set({ status: "DRAFT" }).where(eq(scalesTable.id, todayScale!.id));
    const unpublishedTeamFreeTime = await askAsa(adminApi, "intervalos livres da equipe hoje", { operationId: operation!.id });
    await db.update(scalesTable).set({ status: "PUBLISHED" }).where(eq(scalesTable.id, todayScale!.id));
    await db.update(operationsTable).set({ status: "PAUSED" }).where(eq(operationsTable.id, operation!.id));
    const pausedTeamFreeTime = await askAsa(adminApi, "intervalos livres da equipe hoje", { operationId: operation!.id });
    const pausedTeamAbsences = await askAsa(adminApi, "folgas da equipe hoje", { operationId: operation!.id });
    await db.update(operationsTable).set({ status: "ACTIVE" }).where(eq(operationsTable.id, operation!.id));
    const foreignOperationTeamAbsences = await askAsa(adminApi, "folgas da equipe hoje", { operationId: foreignOperation!.id });
    assert(memberFreeTime.status === 200 && memberFreeTime.body.includes("Seus intervalos livres") && memberFreeTime.body.includes("10:00–12:00") && !memberFreeTime.body.includes(`${tag}_other`), "Integrante recebe sua janela calculada da escala publicada sem dados de colegas");
    assert(teamFreeTime.status === 200 && teamFreeTime.body.includes(`${tag}_mem`) && !teamFreeTime.body.includes(`${tag}_sup`), "Consulta de equipe exclui pessoa com folga ativa da disponibilidade");
    assert(memberTeamFreeTime.status === 200 && memberTeamFreeTime.body.includes("somente para gestores") && !memberTeamFreeTime.body.includes(`${tag}_sup`), "Integrante não consulta disponibilidade da equipe");
    assert(unpublishedTeamFreeTime.status === 200 && unpublishedTeamFreeTime.body.includes("Nenhuma escala publicada") && !unpublishedTeamFreeTime.body.includes(`${tag}_mem`), `Disponibilidade da equipe não usa escala em rascunho: ${unpublishedTeamFreeTime.body}`);
    assert(pausedTeamFreeTime.status === 200 && pausedTeamFreeTime.body.includes("Não encontrei uma operação ativa no seu perfil") && !pausedTeamFreeTime.body.includes(`${tag}_mem`), `Disponibilidade da equipe recusa operação pausada: ${pausedTeamFreeTime.body}`);
    assert(adminTeamAbsences.status === 200 && adminTeamAbsences.body.includes(`${tag}_sup`) && adminTeamAbsences.body.includes("Folgas registradas para"), "Administração consulta somente folgas ativas da operação e data escolhidas");
    assert(memberTeamAbsences.status === 200 && memberTeamAbsences.body.includes("somente para gestores") && !memberTeamAbsences.body.includes(`${tag}_sup`), "Integrante não consulta lista de folgas da equipe");
    assert(pausedTeamAbsences.status === 200 && pausedTeamAbsences.body.includes("Não encontrei uma operação ativa no seu perfil") && !pausedTeamAbsences.body.includes(`${tag}_sup`), `Folgas da equipe recusam operação pausada: ${pausedTeamAbsences.body}`);
    assert(foreignOperationTeamAbsences.status === 200 && foreignOperationTeamAbsences.body.includes("operação") && !foreignOperationTeamAbsences.body.includes(`${tag}_sup`), "Folgas da equipe recusam operação fora do escopo e de outra organização");

    const notice = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", title: "Teste", body: "Aviso para a casa", requiresConfirmation: true });
    const noticeBody = await notice.json() as { post: { id: string } }; assert(notice.status === 201, "Administração publica aviso para toda a casa");
    const memberFeed = await memApi("/communication/mural"); const feed = await memberFeed.json() as { posts: { id: string }[] }; assert(memberFeed.status === 200 && feed.posts.some(post => post.id === noticeBody.post.id), "Elenco recebe apenas post do seu acesso");
    assert((await post(memApi, `/communication/mural/${noticeBody.post.id}/ack`)).status === 200, "Elenco confirma leitura do aviso");
    const asaAckNotice = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", title: `${tag}_ciente_asa`, body: "Confirmação via ASA", requiresConfirmation: true });
    const asaAckNoticeBody = await asaAckNotice.json() as { post: { id: string } };
    const asaAckPreview = await askAsa(memApi, `dê ciente do aviso "${tag}_ciente_asa"`);
    const proposalId = proposalFrom(asaAckPreview.body)?.id;
    const [beforeAsaAck] = await db.select({ confirmedAt: announcementReadsTable.confirmedAt }).from(announcementReadsTable).where(and(eq(announcementReadsTable.announcementId, asaAckNoticeBody.post.id), eq(announcementReadsTable.userId, member.id))).limit(1);
    assert(asaAckPreview.status === 200 && Boolean(proposalId) && !beforeAsaAck?.confirmedAt, "ASA mostra a prévia sem registrar ciente antes da confirmação explícita");
    assert(proposalFrom(asaAckPreview.body)?.content === "Confirmação via ASA", "Prévia de ciente inclui o conteúdo completo do aviso");
    const unauthorizedAck = await post(outsideApi, `/asa/actions/${proposalId}/confirm`);
    assert(unauthorizedAck.status === 404, "Outra pessoa não confirma proposta de ciente alheia");
    const confirmedAck = await post(memApi, `/asa/actions/${proposalId}/confirm`);
    const [afterAsaAck] = await db.select({ confirmedAt: announcementReadsTable.confirmedAt }).from(announcementReadsTable).where(and(eq(announcementReadsTable.announcementId, asaAckNoticeBody.post.id), eq(announcementReadsTable.userId, member.id))).limit(1);
    assert(confirmedAck.status === 200 && Boolean(afterAsaAck?.confirmedAt), "Confirmação da ASA registra ciente individual no aviso acessível");
    const asaAckHistory = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.entityId, asaAckNoticeBody.post.id), eq(historyEventsTable.action, "mural.acknowledged")));
    assert(asaAckHistory.length === 1, "Ciente confirmado pela ASA grava evento no Registro na mesma transação");
    const repeatedAck = await post(memApi, `/asa/actions/${proposalId}/confirm`);
    const repeatedAckHistory = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, asaAckNoticeBody.post.id), eq(historyEventsTable.action, "mural.acknowledged")));
    assert(repeatedAck.status === 409 && repeatedAckHistory.length === 1, "Repetir a confirmação não duplica o ciente nem o Registro");
    const restoredAck = await memApi(`/asa/conversations/${asaAckPreview.conversationId}/messages`);
    const restoredAckBody = await restoredAck.json() as { messages: Array<{ proposal?: { id: string; content: string; state: string } }> };
    const restoredProposal = restoredAckBody.messages.find(message => message.proposal?.id === proposalId)?.proposal;
    assert(restoredAck.status === 200 && restoredProposal?.state === "CONFIRMED" && restoredProposal.content === "Confirmação via ASA", "Histórico restaura o conteúdo e o estado confirmado da prévia de ciente");
    const cancelledAckNotice = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", title: `${tag}_ciente_cancelar`, body: "Prévia cancelável", requiresConfirmation: true });
    const cancelledAckPreview = await askAsa(memApi, `dê ciente do aviso "${tag}_ciente_cancelar"`);
    const cancelProposalId = proposalFrom(cancelledAckPreview.body)?.id;
    const cancelAck = await post(memApi, `/asa/actions/${cancelProposalId}/cancel`);
    const cancelledAckBody = await cancelledAckNotice.json() as { post: { id: string } };
    const [afterCancelledAck] = await db.select({ confirmedAt: announcementReadsTable.confirmedAt }).from(announcementReadsTable).where(and(eq(announcementReadsTable.announcementId, cancelledAckBody.post.id), eq(announcementReadsTable.userId, member.id))).limit(1);
    assert(cancelAck.status === 200 && !afterCancelledAck?.confirmedAt, "Cancelar a prévia de ciente não altera o Mural");
    const changedCases: Array<{ name: string; changes: Partial<typeof announcementsTable.$inferInsert> }> = [
      { name: "título", changes: { title: `${tag}_titulo_alterado` } },
      { name: "texto", changes: { body: "Novo conteúdo que a pessoa ainda não confirmou" } },
      { name: "público", changes: { scope: "AREA", areaId: area!.id } },
      { name: "acesso", changes: { scope: "AREA", areaId: otherArea!.id } },
      { name: "cancelamento", changes: { cancelledAt: new Date() } },
      { name: "confirmação dispensada", changes: { requiresConfirmation: false } },
    ];
    for (const [index, changedCase] of changedCases.entries()) {
      const title = `${tag}_ciente_alterado_${index}`;
      const created = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", title, body: "Texto mostrado na prévia", requiresConfirmation: true });
      const { post: changedNotice } = await created.json() as { post: { id: string } };
      const preview = await askAsa(memApi, `dê ciente do aviso "${title}"`);
      const changedProposalId = proposalFrom(preview.body)?.id;
      // Leave updatedAt untouched to prove content/scope changes are checked too.
      await db.update(announcementsTable).set(changedCase.changes).where(eq(announcementsTable.id, changedNotice.id));
      const staleConfirmation = await post(memApi, `/asa/actions/${changedProposalId}/confirm`);
      const changedReads = await db.select().from(announcementReadsTable).where(and(eq(announcementReadsTable.announcementId, changedNotice.id), eq(announcementReadsTable.userId, member.id)));
      const changedHistory = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, changedNotice.id), eq(historyEventsTable.action, "mural.acknowledged")));
      assert(Boolean(changedProposalId) && staleConfirmation.status === 409 && changedReads.length === 0 && changedHistory.length === 0, `Mudança de ${changedCase.name} invalida a prévia sem gravar leitura, ciente ou Registro`);
      if (changedCase.name === "texto") {
        const freshPreview = await askAsa(memApi, `dê ciente do aviso "${title}"`);
        const freshProposal = proposalFrom(freshPreview.body);
        const freshConfirmation = await post(memApi, `/asa/actions/${freshProposal?.id}/confirm`);
        assert(freshProposal?.content === changedCase.changes.body && freshConfirmation.status === 200, "Nova prévia do texto atualizado permite confirmação explícita");
      }
    }
    // Decisão de 02/10: Supervisão publica aviso como a Administração — toda a casa, qualquer área ou qualquer local.
    assert((await post(supApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", body: "Aviso da supervisão para a casa" })).status === 201, "Supervisão publica aviso para a casa toda");
    assert((await post(supApi, "/communication/mural", { type: "NOTICE", scope: "AREA", areaId: otherArea!.id, body: "Aviso para outra área" })).status === 201, "Supervisão publica aviso para outra área");
    assert((await post(supApi, "/communication/mural", { type: "NOTICE", scope: "LOCATION", locationId: unassignedLocation!.id, body: "Aviso para outro local" })).status === 201, "Supervisão publica aviso para um local que não supervisiona");
    assert((await post(memApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", body: "Elenco tentando avisar" })).status === 403, "Elenco não publica aviso");
    assert((await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "AREA", areaId: "00000000-0000-4000-8000-000000000000", body: "Área inexistente" })).status === 404, "Aviso para área de fora da organização é recusado");
    const destinations = await supApi("/communication/destinations");
    const destinationsBody = await destinations.json() as { areas: { id: string }[]; locations: { id: string }[] };
    assert(destinations.status === 200 && [area!.id, otherArea!.id].every(id => destinationsBody.areas.some(item => item.id === id)) && [location!.id, unassignedLocation!.id].every(id => destinationsBody.locations.some(item => item.id === id)), "Supervisão recebe todas as áreas e locais como destino de aviso");
    assert((await memApi("/communication/destinations")).status === 403, "Elenco não recebe a lista de destinos de aviso");
    const areaNotice = await post(supApi, "/communication/mural", { type: "NOTICE", scope: "AREA", areaId: area!.id, body: "Somente patinadores" }); assert(areaNotice.status === 201, "Supervisão publica para sua própria área");
    const outsiderFeed = await outsideApi("/communication/mural"); const outsiderPosts = await outsiderFeed.json() as { posts: { id: string }[] }; const areaNoticeId = ((await areaNotice.clone().json()) as { post: { id: string } }).post.id; assert(!outsiderPosts.posts.some(post => post.id === areaNoticeId), "Mural não vaza aviso de outra área");
    const feedOf = async (api: typeof adminApi) => ((await (await api("/communication/mural")).json()) as { posts: Array<{ id: string; canCancel?: boolean; authorId?: string }> }).posts;
    const supPosts = await feedOf(supApi), memPosts = await feedOf(memApi), adminPosts = await feedOf(adminApi);
    assert(supPosts.find(item => item.id === areaNoticeId)?.canCancel === true && adminPosts.find(item => item.id === areaNoticeId)?.canCancel === true && memPosts.find(item => item.id === areaNoticeId)?.canCancel === false, "Mural diz a cada perfil se pode cancelar o aviso: Supervisão da área e Administração sim, Elenco não");
    assert(memPosts.length > 0 && memPosts.every(item => item.authorId === undefined), "Feed do Mural não expõe o id de quem publicou");
    // Desenho 22 (06/10): "X de Y deram ciente", quem falta, data do evento e aniversário com Parabéns.
    const ackNotice = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "AREA", areaId: area!.id, body: `${tag}_ciente_area`, requiresConfirmation: true, eventDate: "2026-12-24" });
    const ackNoticeId = ((await ackNotice.json()) as { post: { id: string; eventDate?: string } }).post.id;
    assert(ackNotice.status === 201, "Aviso com data do evento é publicado");
    assert((await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", body: "data ruim", eventDate: "24/12/2026" })).status === 400, "Data do evento em formato errado é recusada");
    await post(memApi, `/communication/mural/${ackNoticeId}/ack`);
    const adminAck = ((await (await adminApi("/communication/mural")).json()) as { posts: Array<{ id: string; ackSummary?: { total: number; confirmados: number }; eventDate?: string }> }).posts.find(item => item.id === ackNoticeId);
    assert(adminAck?.eventDate === "2026-12-24", "O feed devolve a data do evento");
    assert(adminAck?.ackSummary?.total === 2 && adminAck.ackSummary.confirmados === 1, `Administração vê "1 de 2 deram ciente" no aviso da área (sup e mem): ${JSON.stringify(adminAck?.ackSummary)}`);
    const memAck = ((await (await memApi("/communication/mural")).json()) as { posts: Array<{ id: string; ackSummary?: unknown }> }).posts.find(item => item.id === ackNoticeId);
    assert(Boolean(memAck) && memAck!.ackSummary === undefined, "Elenco não vê a contagem de cientes");
    const cientes = await adminApi(`/communication/mural/${ackNoticeId}/cientes`);
    const cientesBody = await cientes.json() as { total: number; confirmados: number; faltam: { id: string }[] };
    assert(cientes.status === 200 && cientesBody.faltam.length === 1 && cientesBody.faltam[0]!.id === sup.id, "Quem falta lista só quem ainda não deu ciente");
    assert((await memApi(`/communication/mural/${ackNoticeId}/cientes`)).status === 403, "Elenco não vê quem falta");
    const todaySp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    await db.update(usersTable).set({ birthDate: `1995-${todaySp.slice(5)}` }).where(eq(usersTable.id, outsider.id));
    const withBirthday = ((await (await memApi("/communication/mural")).json()) as { posts: Array<{ id: string; type: string; recipientId?: string; reactionCount?: number }> }).posts;
    const birthday = withBirthday.filter(item => item.type === "BIRTHDAY" && item.recipientId === outsider.id);
    assert(birthday.length === 1, "No dia, o aniversário vira um cartão no feed");
    await adminApi("/communication/mural");
    assert(((await (await adminApi("/communication/mural")).json()) as { posts: Array<{ type: string; recipientId?: string }> }).posts.filter(item => item.type === "BIRTHDAY" && item.recipientId === outsider.id).length === 1, "Abrir o Mural de novo não repete o cartão de aniversário");
    assert((await post(memApi, `/communication/mural/${birthday[0]!.id}/react`, { reaction: "🎂" })).status === 200, "Dar parabéns usa a reação");
    const afterCongrats = ((await (await adminApi("/communication/mural")).json()) as { posts: Array<{ id: string; reactionCount?: number }> }).posts.find(item => item.id === birthday[0]!.id);
    assert(afterCongrats?.reactionCount === 1, "O cartão conta os parabéns");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, birthday[0]!.id), eq(historyEventsTable.action, "mural.birthday_created")))).length === 1, "O cartão de aniversário entra no Registro");
    // Aviso para pessoas escolhidas (0053, decisão de 02/10).
    const peopleNotice = await post(supApi, "/communication/mural", { type: "NOTICE", scope: "PEOPLE", recipientIds: [member.id], title: `${tag}_pessoas_escolhidas`, body: `${tag}_so_para_mem`, requiresConfirmation: true });
    const peopleNoticeId = ((await peopleNotice.json()) as { post: { id: string } }).post?.id;
    assert(peopleNotice.status === 201 && Boolean(peopleNoticeId), "Supervisão manda aviso para pessoas escolhidas");
    const memWithPeople = await feedOf(memApi), outsiderWithPeople = await feedOf(outsideApi), supWithPeople = await feedOf(supApi);
    assert(memWithPeople.some(item => item.id === peopleNoticeId), "Pessoa escolhida recebe o aviso");
    assert(!outsiderWithPeople.some(item => item.id === peopleNoticeId), "Quem não foi escolhido não vê o aviso, mesmo sendo da mesma operação");
    assert(supWithPeople.some(item => item.id === peopleNoticeId), "Quem publicou vê o próprio aviso");
    assert(((memWithPeople.find(item => item.id === peopleNoticeId) as { recipientNames?: string[] } | undefined)?.recipientNames ?? []).includes(`${tag}_mem`), "Aviso mostra para quem foi");
    assert((await post(outsideApi, `/communication/mural/${peopleNoticeId}/ack`)).status === 404, "Quem não foi escolhido não dá ciente");
    const peopleAck = await askAsa(memApi, `dê ciente do aviso "${tag}_pessoas_escolhidas"`);
    const authorAck = await askAsa(supApi, `dê ciente do aviso "${tag}_pessoas_escolhidas"`);
    const excludedAck = await askAsa(outsideApi, `dê ciente do aviso "${tag}_pessoas_escolhidas"`);
    const peopleProposal = proposalFrom(peopleAck.body);
    assert(Boolean(peopleProposal?.id) && peopleAck.body.includes(`${tag}_so_para_mem`), "ASA permite prévia de ciente PEOPLE para quem recebe");
    assert(Boolean(proposalFrom(authorAck.body)?.id), "ASA permite prévia de ciente PEOPLE para quem publicou sem ser destinatário");
    assert(!proposalFrom(excludedAck.body) && !excludedAck.body.includes(`${tag}_so_para_mem`), "ASA não revela conteúdo nem oferece ciente PEOPLE para quem não recebe");
    assert((await post(memApi, `/asa/actions/${peopleProposal?.id}/confirm`)).status === 200, "ASA confirma ciente PEOPLE pela política oficial");
    // A prévia não concede acesso permanente: revogar o destino invalida a confirmação.
    const revokedPeopleNotice = await post(supApi, "/communication/mural", { type: "NOTICE", scope: "PEOPLE", recipientIds: [member.id], title: `${tag}_destino_revogado`, body: "Destino alterado após a prévia", requiresConfirmation: true });
    const revokedPeopleId = ((await revokedPeopleNotice.json()) as { post: { id: string } }).post.id;
    const revokedPeoplePreview = proposalFrom((await askAsa(memApi, `dê ciente do aviso "${tag}_destino_revogado"`)).body);
    await db.delete(announcementRecipientsTable).where(eq(announcementRecipientsTable.announcementId, revokedPeopleId));
    const revokedPeopleConfirm = await post(memApi, `/asa/actions/${revokedPeoplePreview?.id}/confirm`);
    const revokedPeopleReads = await db.select().from(announcementReadsTable).where(eq(announcementReadsTable.announcementId, revokedPeopleId));
    assert(Boolean(revokedPeoplePreview?.id) && revokedPeopleConfirm.status === 409 && revokedPeopleReads.length === 0, "ASA revalida destinatário PEOPLE na confirmação sem gravar ciente após revogação");
    assert((await post(memApi, `/communication/mural/${peopleNoticeId}/ack`)).status === 200, "Pessoa escolhida dá ciente");
    assert((await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "PEOPLE", recipientIds: [], body: "ninguém" })).status === 400, "Aviso para pessoas sem ninguém marcado é recusado");
    assert((await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "PEOPLE", recipientIds: [member.id, "00000000-0000-4000-8000-000000000000"], body: "com estranho" })).status === 404, "Aviso com pessoa que não é da organização é recusado");
    assert((await post(memApi, "/communication/mural", { type: "RECOGNITION", scope: "PEOPLE", recipientIds: [admin.id], recipientId: admin.id, reason: "Cuidado", body: "Obrigada" })).status === 400, "Reconhecimento não vai para pessoas escolhidas");
    const [peopleEvent] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, peopleNoticeId!), eq(historyEventsTable.action, "mural.notice_created")));
    assert(JSON.stringify((peopleEvent?.metadata as { recipientIds?: string[] } | null)?.recipientIds ?? []) === JSON.stringify([member.id]), "A lista de quem recebe entra no Registro");
    const locationNotice = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "LOCATION", locationId: location!.id, body: "Orientação exclusiva do Snowland" });
    assert(locationNotice.status === 201, "Administração publica para um local específico");
    const memberMural = await askAsa(memApi, "Mostra o Mural");
    const searchedMural = await askAsa(memApi, "Busque no Mural por ‘Somente patinadores’");
    const outsiderMural = await askAsa(outsideApi, "Mostra o Mural");
    const supervisorMural = await askAsa(supApi, "Mostra o Mural");
    assert(memberMural.body.includes(`${tag}_so_para_mem`) && supervisorMural.body.includes(`${tag}_so_para_mem`), "Consulta do Mural pela ASA inclui PEOPLE para destinatário e autoria");
    assert(!outsiderMural.body.includes(`${tag}_so_para_mem`), "Consulta do Mural pela ASA não revela PEOPLE para outra pessoa");
    assert(memberMural.status === 200 && memberMural.body.includes("Somente patinadores") && memberMural.body.includes("Orientação exclusiva do Snowland"), "ASA mostra Mural da própria área e local de escala publicada");
    assert(outsiderMural.status === 200 && !outsiderMural.body.includes("Somente patinadores") && !outsiderMural.body.includes("Orientação exclusiva do Snowland"), "ASA não mostra publicações de outra área ou local sem vínculo");
    assert(supervisorMural.status === 200 && supervisorMural.body.includes("Somente patinadores") && supervisorMural.body.includes("Orientação exclusiva do Snowland"), "ASA respeita área própria e designação de supervisor para local");
    assert(memberMural.body.includes("ciente registrado"), "ASA informa o ciente pessoal registrado no Mural");
    assert(searchedMural.status === 200 && searchedMural.body.includes("Somente patinadores") && !searchedMural.body.includes("Orientação exclusiva do Snowland"), "Pesquisa do Mural filtra texto sem ultrapassar o escopo visível");
    assert((await post(memApi, "/communication/mural", { type: "RECOGNITION", scope: "HOUSE", recipientId: admin.id, body: "Obrigada" })).status === 400, "Reconhecimento sem motivo é recusado");
    const recognition = await post(memApi, "/communication/mural", { type: "RECOGNITION", scope: "HOUSE", recipientId: admin.id, body: "Obrigada por organizar", reason: "Cuidado com a casa" }); const recognitionBody = await recognition.json() as { post: { id: string } }; assert(recognition.status === 201, "Qualquer perfil reconhece colega com motivo");
    assert((await post(memApi, `/communication/mural/${recognitionBody.post.id}/react`, { reaction: "♥" })).status === 200, "Elenco reage no Mural");
    assert((await post(memApi, `/communication/mural/${recognitionBody.post.id}/comments`, { body: "Merecido!" })).status === 201, "Elenco comenta no Mural");
    const comments = await memApi(`/communication/mural/${recognitionBody.post.id}/comments`); const commentsBody = await comments.json() as { comments: { body: string }[] }; assert(comments.status === 200 && commentsBody.comments.some(comment => comment.body === "Merecido!"), "Comentários legíveis respeitam o escopo do Mural");
    assert((await post(adminApi, `/communication/mural/${noticeBody.post.id}/cancel`, { reason: "   " })).status === 400, "Cancelar aviso sem motivo é recusado");
    assert((await post(adminApi, `/communication/mural/${noticeBody.post.id}/cancel`, { reason: "Aviso substituído" })).status === 200, "Cancelar aviso registra motivo em uma só etapa");
    const eventRows = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.entityType, "announcement"))); assert(eventRows.length >= 2, "Aviso e reconhecimento gravam Registro");

    const recipients = await memApi("/messages/recipients"); const recipientBody = await recipients.json() as { recipients: { id: string }[] }; assert(recipients.status === 200 && recipientBody.recipients.some(person => person.id === director.id), "Elenco pode iniciar conversa com Direção");
    // Desenho 23 (06/10): grupo automático da área nas Mensagens.
    const memThreads = await memApi("/messages/threads");
    const memThreadsBody = await memThreads.json() as { threads: Array<{ id: string; contextType?: string; contextId?: string; participants: { userId: string }[] }> };
    const areaGroup = memThreadsBody.threads.find(thread => thread.contextType === "AREA_GROUP" && thread.contextId === area!.id);
    assert(memThreads.status === 200 && Boolean(areaGroup), "Quem é da área ganha o grupo da área nas Mensagens");
    const groupMembers = new Set(areaGroup?.participants.map(item => item.userId) ?? []);
    assert(groupMembers.has(member.id) && groupMembers.has(sup.id) && !groupMembers.has(outsider.id), "O grupo da área tem a área e quem a supervisiona, e não tem gente de outra área");
    await memApi("/messages/threads");
    assert((await db.select().from(messageThreadsTable).where(and(eq(messageThreadsTable.orgId, org!.id), eq(messageThreadsTable.contextType, "AREA_GROUP"), eq(messageThreadsTable.contextId, area!.id)))).length === 1, "Abrir Mensagens de novo não cria outro grupo da área");
    const prefs = await memApi(`/messages/threads/${areaGroup!.id}/preferences`, { method: "PATCH", body: JSON.stringify({ muted: true, pinned: true }) });
    assert(prefs.status === 200, "Fixar e silenciar funcionam antes de qualquer mensagem na conversa");
    assert((await post(supApi, `/messages/threads/${areaGroup!.id}/messages`, { content: `${tag}_no_grupo` })).status === 201, "Supervisão escreve no grupo da área");
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mutedNotices = await db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, member.id), eq(userNotificationsTable.entityId, areaGroup!.id)));
    assert(mutedNotices.length === 0, "Quem silenciou a conversa não recebe aviso de mensagem nova");
    await db.update(usersTable).set({ areaId: otherArea!.id }).where(eq(usersTable.id, member.id));
    await memApi("/messages/threads");
    const afterMove = await db.select().from(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, areaGroup!.id), eq(messageThreadParticipantsTable.userId, member.id)));
    assert(afterMove.length === 0, "Quem muda de área sai do grupo da área antiga");
    await db.update(usersTable).set({ areaId: area!.id }).where(eq(usersTable.id, member.id));
    const threadResponse = await post(memApi, "/messages/threads", { title: "Direção", participantIds: [director.id] }); const threadBody = await threadResponse.json() as { thread: { id: string } }; assert(threadResponse.status === 201, "Elenco cria conversa direta");
    const messageResponse = await post(memApi, `/messages/threads/${threadBody.thread.id}/messages`, { content: "Posso tirar uma dúvida?" }); assert(messageResponse.status === 201, "Elenco envia mensagem direta");
    const senderMessage = await post(directorApi, `/messages/threads/${threadBody.thread.id}/messages`, { content: `${tag}_trecho_restrito` });
    const outsiderThreadResponse = await post(outsideApi, "/messages/threads", { title: `${tag}_conversa_externa`, participantIds: [admin.id] });
    const outsiderThreadBody = await outsiderThreadResponse.json() as { thread: { id: string } };
    const outsiderMessage = await post(outsideApi, `/messages/threads/${outsiderThreadBody.thread.id}/messages`, { content: `${tag}_trecho_restrito` });
    const asaSenderSearch = await askAsa(memApi, `mensagens de ${tag}_dir`);
    const asaQuotedSearch = await askAsa(memApi, `busque nas mensagens por ‘${tag}_trecho_restrito’`);
    assert(senderMessage.status === 201 && outsiderThreadResponse.status === 201 && outsiderMessage.status === 201, "Mensagens de duas conversas sintéticas são preparadas para testar isolamento da ASA");
    assert(asaSenderSearch.status === 200 && asaSenderSearch.body.includes(`${tag}_trecho_restrito`) && asaSenderSearch.body.includes("Direção"), "ASA localiza mensagens da pessoa citada apenas em conversas das quais participa");
    assert(asaQuotedSearch.status === 200 && asaQuotedSearch.body.includes(`${tag}_trecho_restrito`) && asaQuotedSearch.body.includes("Direção") && !asaQuotedSearch.body.includes(`${tag}_conversa_externa`), "Busca por trecho não revela conversa da qual a pessoa não participa, mesmo quando o texto coincide");
    const directorThread = await as(director.id, "DIR")(`/messages/threads/${threadBody.thread.id}`); assert(directorThread.status === 200, "Direção lê conversa da qual participa");

    const createDoc = await post(adminApi, "/library/documents", { title: "Regra institucional", type: "RULES_AND_POLICIES", body: "Conteúdo oficial", summary: "Documento para teste", tags: ["conduta"], requiresConfirmation: true, scopeType: "HOUSE" }); const docBody = await createDoc.json() as { document: { id: string } }; assert(createDoc.status === 201, "Administração cria documento institucional");
    const staleAt = new Date(Date.now() - 120 * 86400000);
    await db.insert(libraryDocumentsTable).values([
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_house_antigo`, type: "RULES_AND_POLICIES", scopeType: "HOUSE", status: "PUBLISHED", updatedAt: staleAt },
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_area_propria_antigo`, type: "RULES_AND_POLICIES", scopeType: "AREA", areaId: area!.id, status: "PUBLISHED", updatedAt: staleAt },
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_outra_area_antigo`, type: "RULES_AND_POLICIES", scopeType: "AREA", areaId: otherArea!.id, status: "PUBLISHED", updatedAt: staleAt },
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_alterado_proprio`, type: "RULES_AND_POLICIES", scopeType: "AREA", areaId: area!.id, status: "UPDATED" },
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_alterado_outra_area`, type: "RULES_AND_POLICIES", scopeType: "AREA", areaId: otherArea!.id, status: "UPDATED" },
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_rascunho_proprio`, type: "RULES_AND_POLICIES", scopeType: "AREA", areaId: area!.id, status: "DRAFT" },
      { orgId: org!.id, createdBy: admin.id, title: `${tag}_estado_rascunho_outra_area`, type: "RULES_AND_POLICIES", scopeType: "AREA", areaId: otherArea!.id, status: "DRAFT" },
    ]);
    const adminLibraryState = await askAsa(adminApi, "qual o estado da biblioteca?");
    const supervisorLibraryState = await askAsa(supApi, "quais documentos estao desatualizados na biblioteca?");
    const memberLibraryState = await askAsa(memApi, "qual o estado da biblioteca?");
    assert(adminLibraryState.status === 200 && adminLibraryState.body.includes(`${tag}_estado_house_antigo`) && adminLibraryState.body.includes(`${tag}_estado_outra_area_antigo`) && adminLibraryState.body.includes(`${tag}_estado_alterado_outra_area`) && adminLibraryState.body.includes(`${tag}_estado_rascunho_outra_area`), "Administração consulta o estado da Biblioteca em todos os escopos da organização");
    assert(supervisorLibraryState.status === 200 && supervisorLibraryState.body.includes(`${tag}_estado_area_propria_antigo`) && supervisorLibraryState.body.includes(`${tag}_estado_alterado_proprio`) && supervisorLibraryState.body.includes(`${tag}_estado_rascunho_proprio`) && !supervisorLibraryState.body.includes(`${tag}_estado_house_antigo`) && !supervisorLibraryState.body.includes(`${tag}_estado_outra_area`) && !supervisorLibraryState.body.includes(`${tag}_estado_rascunho_outra_area`), "Supervisão recebe somente amostras de documentos e rascunhos da própria área");
    assert(memberLibraryState.status === 200 && memberLibraryState.body.includes("somente para Administração e Supervisão") && !memberLibraryState.body.includes(`${tag}_estado_`), "Integrante não acessa o estado gerencial nem títulos de rascunhos");
    const existingSupervisorConversation = await post(supApi, "/asa/conversations", { title: `${tag}_ASA_revogada` });
    const existingSupervisorConversationBody = await existingSupervisorConversation.json() as { id: number };
    if (existingSupervisorConversation.status !== 201 || !existingSupervisorConversationBody.id) throw new Error("Não foi possível abrir a conversa sintética antes da revogação");
    asaConversationIds.push(existingSupervisorConversationBody.id);
    await db.update(userRolesTable).set({ active: false }).where(and(eq(userRolesTable.userId, sup.id), eq(userRolesTable.role, "SUPERVISOR_A")));
    const revokedSupervisorResponse = await post(supApi, `/asa/chat/${existingSupervisorConversationBody.id}/messages`, { content: "qual o estado da biblioteca?" });
    const revokedSupervisorLibraryState = { status: revokedSupervisorResponse.status, body: await revokedSupervisorResponse.text() };
    assert(revokedSupervisorLibraryState.status === 403 && !revokedSupervisorLibraryState.body.includes(`${tag}_estado_`), "Rota recusa sessão de Supervisão já revogada sem consultar nem revelar estado da Biblioteca");
    await db.update(userRolesTable).set({ active: true }).where(and(eq(userRolesTable.userId, sup.id), eq(userRolesTable.role, "SUPERVISOR_A")));
    const uploadedPdf = await adminApi(`/library/documents/${docBody.document.id}/file`, { method: "PUT", body: Buffer.from("%PDF-1.4\n% teste MyASA\n"), headers: { "content-type": "application/pdf", "x-file-name": "regra institucional.pdf" } }); assert(uploadedPdf.status === 201, "Administração envia PDF institucional pela API");
    assert((await post(adminApi, `/library/documents/${docBody.document.id}/publish`)).status === 200, "Administração publica documento");
    const documents = await memApi("/library/documents"); const documentsBody = await documents.json() as { documents: { id: string; fileName?: string; requiresConfirmation?: boolean }[] }; assert(documents.status === 200 && documentsBody.documents.some(doc => doc.id === docBody.document.id && doc.fileName === "regra institucional.pdf" && doc.requiresConfirmation), "Elenco recebe somente documento publicado no escopo");
    const downloadedPdf = await memApi(`/library/documents/${docBody.document.id}/file`); assert(downloadedPdf.status === 200 && (await downloadedPdf.text()).startsWith("%PDF-"), "Elenco abre PDF autenticado dentro do escopo");
    assert((await post(memApi, `/library/documents/${docBody.document.id}/confirm`)).status === 200, "Elenco confirma leitura do documento");
    const locationDoc = await post(adminApi, "/library/documents", { title: "Documento do local", type: "OPERATIONAL_PROCEDURE", body: "Conteúdo do local", summary: "Para leitura da Direção", scopeType: "LOCATION", locationId: location!.id }); const locationDocBody = await locationDoc.json() as { document: { id: string } }; await post(adminApi, `/library/documents/${locationDocBody.document.id}/publish`);
    const directorDocuments = await directorApi("/library/documents"); const directorDocumentsBody = await directorDocuments.json() as { documents: { id: string }[] }; assert(directorDocuments.status === 200 && directorDocumentsBody.documents.some(doc => doc.id === locationDocBody.document.id), "Direção lê documento de qualquer escopo sem receber escrita");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); }
    if (asaConversationIds.length) { await db.delete(aiMessages).where(inArray(aiMessages.conversationId, asaConversationIds)); await db.delete(conversations).where(inArray(conversations.id, asaConversationIds)); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, all.map(user => user.id))));
    await db.delete(announcementCommentsTable).where(inArray(announcementCommentsTable.authorId, all.map(user => user.id)));
    await db.delete(announcementReadsTable).where(inArray(announcementReadsTable.userId, all.map(user => user.id)));
    await db.delete(announcementRecipientsTable).where(inArray(announcementRecipientsTable.userId, all.map(user => user.id)));
    await db.delete(announcementsTable).where(eq(announcementsTable.orgId, org!.id));
    await db.delete(libraryViewsTable).where(eq(libraryViewsTable.orgId, org!.id));
    const libraryIds = (await db.select({ id: libraryDocumentsTable.id }).from(libraryDocumentsTable).where(eq(libraryDocumentsTable.orgId, org!.id))).map(row => row.id);
    if (libraryIds.length) { await db.delete(libraryDocumentFilesTable).where(inArray(libraryDocumentFilesTable.documentId, libraryIds)); await db.delete(libraryDocumentVersionsTable).where(inArray(libraryDocumentVersionsTable.documentId, libraryIds)); }
    await db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.orgId, org!.id));
    await db.delete(messagesTable).where(inArray(messagesTable.senderId, all.map(user => user.id)));
    await db.delete(messageThreadParticipantsTable).where(inArray(messageThreadParticipantsTable.userId, all.map(user => user.id)));
    await db.delete(messageThreadsTable).where(eq(messageThreadsTable.orgId, org!.id));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, all.map(user => user.id)));
    await db.delete(delegationsTable).where(eq(delegationsTable.operationId, operation!.id));
    await db.delete(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    if (dailyBookIds.length) {
      await db.delete(dailyBookAssignmentsTable).where(inArray(dailyBookAssignmentsTable.dailyBookId, dailyBookIds));
      await db.delete(dailyBookPositionsTable).where(inArray(dailyBookPositionsTable.dailyBookId, dailyBookIds));
      await db.delete(dailyBookBlocksTable).where(inArray(dailyBookBlocksTable.dailyBookId, dailyBookIds));
      await db.delete(dailyBookScenesTable).where(inArray(dailyBookScenesTable.dailyBookId, dailyBookIds));
      await db.delete(dailyBooksTable).where(inArray(dailyBooksTable.id, dailyBookIds));
    }
    const operationScaleIds = (await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id))).map(row => row.id);
    if (operationScaleIds.length) await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, operationScaleIds));
    if (agendaEventIds.length) await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.id, agendaEventIds));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, location!.id));
    const deliveryIds = (await db.select({ id: deliveriesTable.id }).from(deliveriesTable).where(eq(deliveriesTable.operationId, operation!.id))).map(row => row.id);
    if (deliveryIds.length) { await db.delete(deliveryAssignmentsTable).where(inArray(deliveryAssignmentsTable.deliveryId, deliveryIds)); await db.delete(deliveriesTable).where(inArray(deliveriesTable.id, deliveryIds)); }
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, all.map(user => user.id)));
    await db.delete(usersTable).where(inArray(usersTable.id, all.map(user => user.id)));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id)); await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, operation!.id)); await db.delete(locationsTable).where(eq(locationsTable.organizationId, org!.id)); await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id)); await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id)); await db.delete(operationsTable).where(eq(operationsTable.organizationId, foreignOrg!.id)); await db.delete(organizationsTable).where(eq(organizationsTable.id, foreignOrg!.id)); await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Grupo C: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
