/** Aceite HTTP do Bloco 6 contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  characterCastTable,
  charactersTable,
  dailyBookAssignmentsTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookScenesTable,
  dailyBooksTable,
  db,
  historyEventsTable,
  locationsTable,
  occurrencesTable,
  operationsTable,
  organizationsTable,
  pool,
  scaleAllocationsTable,
  scalesTable,
  sessionsTable,
  showBookBlocksTable,
  showBookLinesTable,
  showBookRolesTable,
  showBookScenesTable,
  showBooksTable,
  userRolesTable,
  usersTable,
  operationalGroupsTable,
  agendaEventsTable,
  scheduleConflictsTable,
  operationalChangesTable,
  operationalCheckInsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { verifyBlock6HttpRoutes } from "./block6-http-matrix.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `block6_${Date.now()}`;
  const date = "2026-09-23";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [group] = await db.insert(operationalGroupsTable).values({ organizationId: org!.id, operationId: operation!.id, name: "Bailarinos" }).returning();
  const [snowland] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_snowland`, type: "parque" }).returning();
  const [acquamotion] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_acquamotion`, type: "parque" }).returning();
  const [bailarinos] = await db.insert(areasTable).values({ organizationId: org!.id, name: "Bailarinos", active: true }).returning();
  const [patinadores] = await db.insert(areasTable).values({ organizationId: org!.id, name: "Patinadores", active: true }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [victor] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Victor Oliveira", username: `${tag}_victor` }).returning();
  const [stephani] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Stephani", username: `${tag}_stephani` }).returning();
  const [memberA] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_a`, username: `${tag}_member_a`, areaId: bailarinos!.id, defaultLocationId: snowland!.id }).returning();
  const [memberB] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_b`, username: `${tag}_member_b`, areaId: bailarinos!.id, defaultLocationId: snowland!.id }).returning();
  const [memberOtherArea] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_other`, username: `${tag}_member_other`, areaId: patinadores!.id, defaultLocationId: acquamotion!.id }).returning();
  const [director] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_director`, username: `${tag}_director` }).returning();

  let server: http.Server | null = null;
  let showBookId: string | null = null;
  let dailyBookId: string | null = null;
  let agendaEventId: string | null = null;
  let characterId: string | null = null;
  const scaleIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: victor!.id, operationId: operation!.id, groupId: group!.id, role: "SUPERVISOR_A", active: true },
      { userId: stephani!.id, operationId: operation!.id, groupId: group!.id, role: "SUPERVISOR_B", active: true },
      { userId: memberA!.id, operationId: operation!.id, groupId: group!.id, role: "MEMBER", active: true },
      { userId: memberB!.id, operationId: operation!.id, groupId: group!.id, role: "MEMBER", active: true },
      { userId: memberOtherArea!.id, operationId: operation!.id, role: "MEMBER", active: true },
      { userId: director!.id, operationId: operation!.id, role: "DIR", active: true },
    ]);
    await db.insert(areaLocalSupervisorsTable).values([
      { areaId: bailarinos!.id, locationId: snowland!.id, supervisorId: victor!.id, active: true },
      { areaId: bailarinos!.id, locationId: acquamotion!.id, supervisorId: stephani!.id, active: true },
    ]);

    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin!.id }).returning();
    showBookId = showBook!.id;
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showBook!.id, name: `${tag}_scene`, order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: `${tag}_block`, order: 0 }).returning();
    const [role] = await db.insert(showBookRolesTable).values({ showBookId: showBook!.id, blockId: block!.id, name: `${tag}_position`, order: 0 }).returning();
    await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "FIXED_PERSON", config: { userId: memberA!.id }, order: 0 });

    const [character] = await db.insert(charactersTable).values({ name: "Astrid", locationId: snowland!.id, mode: "rodizio", active: true }).returning();
    characterId = character!.id;
    const characterCast = await db.insert(characterCastTable).values([
      { characterId: character!.id, personId: memberA!.id, order: 0, timesDone: 2, active: true },
      { characterId: character!.id, personId: memberB!.id, order: 1, timesDone: 0, active: true },
    ]).returning();

    const [overlapScale] = await db.insert(scalesTable).values({
      operationId: operation!.id, areaId: bailarinos!.id, locationId: snowland!.id,
      title: `${tag}_hotelaria`, periodStart: date, periodEnd: date, status: "DRAFT", createdBy: admin!.id,
    }).returning();
    scaleIds.push(overlapScale!.id);
    await db.insert(scaleAllocationsTable).values({
      scaleId: overlapScale!.id, userId: memberA!.id, status: "ASSIGNED", manualDate: date,
      manualLabel: "Turno de hotelaria", startTime: "10:30", endTime: "11:30",
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
    const headers = (value: string) => ({ authorization: `Bearer ${value}`, "content-type": "application/json" });
    const adminToken = token(admin!, "ADMIN");
    const victorToken = token(victor!, "SUPERVISOR_A");
    const stephaniToken = token(stephani!, "SUPERVISOR_B");
    const memberToken = token(memberB!, "MEMBER");
    const directorToken = token(director!, "DIR");
    const request = (path: string, authToken: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { ...headers(authToken), ...(init.headers ?? {}) } });

    const session = await request(`/show-books/${showBook!.id}/sessions`, adminToken, { method: "POST", body: JSON.stringify({ startTime: "10:00", endTime: "11:00", callTime: "09:30" }) });
    const sessionBody = await session.json() as { session?: { id: string; startTime: string; endTime: string } };
    assert(session.status === 201 && sessionBody.session?.startTime === "10:00:00" && sessionBody.session?.endTime === "11:00:00", "Sessão é criada por HTTP com início e fim obrigatórios");
    const invalidSession = await request(`/show-books/${showBook!.id}/sessions`, adminToken, { method: "POST", body: JSON.stringify({ startTime: "11:00", endTime: "11:00" }) });
    assert(invalidSession.status === 400, "fim <= início é rejeitado pela constraint do banco exposta pela rota");

    const createdOccurrence = await request("/occurrences", adminToken, { method: "POST", body: JSON.stringify({ personId: memberA!.id, date, type: "ausencia", description: "Ocorrência sem check-in", reason: "Registro inicial" }) });
    const createdOccurrenceBody = await createdOccurrence.json() as { occurrence?: { id: string; state: string } };
    assert(createdOccurrence.status === 201 && createdOccurrenceBody.occurrence?.state === "aberta", "Ocorrência nasce sem check-in associado e com estado aberta");
    const occurrenceId = createdOccurrenceBody.occurrence!.id;
    const blankTransition = await request(`/occurrences/${occurrenceId}/state`, adminToken, { method: "PATCH", body: JSON.stringify({ state: "em_analise", reason: "   " }) });
    const analysing = await request(`/occurrences/${occurrenceId}/state`, adminToken, { method: "PATCH", body: JSON.stringify({ state: "em_analise", reason: "Supervisão iniciou análise" }) });
    const resolved = await request(`/occurrences/${occurrenceId}/state`, adminToken, { method: "PATCH", body: JSON.stringify({ state: "resolvida", reason: "Tratativa concluída" }) });
    assert(blankTransition.status === 400 && analysing.status === 200 && resolved.status === 200, "cada transição de ocorrência exige motivo e percorre aberta → em_analise → resolvida");

    const otherOccurrence = await request("/occurrences", adminToken, { method: "POST", body: JSON.stringify({ personId: memberOtherArea!.id, date, type: "atraso", description: "Outro escopo", reason: "Registro de outra área" }) });
    const otherOccurrenceId = ((await otherOccurrence.json()) as { occurrence: { id: string } }).occurrence.id;
    const memberOther = await request(`/occurrences/${occurrenceId}`, memberToken);
    const supervisorOtherArea = await request(`/occurrences/${otherOccurrenceId}`, victorToken);
    assert(memberOther.status === 403 && supervisorOtherArea.status === 403, "MEM não lê ocorrência alheia e SUP não lê ocorrência de outra área/local");

    const characterResolution = await request(`/characters/${character!.id}/resolve?operationId=${operation!.id}&date=${date}`, adminToken);
    const characterBody = await characterResolution.json() as { selected?: { personId: string } };
    assert(characterResolution.status === 200 && characterBody.selected?.personId === memberB!.id, "Personagem de rodízio resolve a menor fila por personagem, coerente com o ledger do Bloco 1");

    const historyBeforeNoop = await db.select({ id: historyEventsTable.id }).from(historyEventsTable).where(eq(historyEventsTable.entityId, character!.id));
    const noChange = await request(`/characters/${character!.id}/cast-order`, adminToken, { method: "PUT", body: JSON.stringify({
      queue: characterCast.map((entry) => ({ id: entry.id, personId: entry.personId, timesDone: entry.timesDone })),
    }) });
    const noChangeBody = await noChange.json() as { unchanged?: boolean; cast?: Array<{ id: string; order: number }> };
    const historyAfterNoop = await db.select({ id: historyEventsTable.id }).from(historyEventsTable).where(eq(historyEventsTable.entityId, character!.id));
    assert(noChange.status === 200 && noChangeBody.unchanged === true && historyAfterNoop.length === historyBeforeNoop.length && noChangeBody.cast?.every((entry, index) => entry.id === characterCast[index]?.id && entry.order === index), "abrir e salvar fila sem mudança preserva a ordem e não cria Registro");

    const showPreview = await request(`/show-books/${showBook!.id}/resolve?date=${date}`, adminToken);
    const showPreviewBody = await showPreview.json() as { conflicts?: unknown[] };
    assert(showPreview.status === 200 && (showPreviewBody.conflicts?.length ?? 0) > 0, "montagem do Livro do Show devolve alerta de conflito sem bloquear");

    const snowScale = await request("/scales/generate", victorToken, { method: "POST", body: JSON.stringify({ operationId: operation!.id, groupId: group!.id, areaId: bailarinos!.id, locationId: snowland!.id, periodStart: date, periodEnd: date }) });
    const victorAcqua = await request("/scales/generate", victorToken, { method: "POST", body: JSON.stringify({ operationId: operation!.id, groupId: group!.id, areaId: bailarinos!.id, locationId: acquamotion!.id, periodStart: date, periodEnd: date }) });
    const stephaniSnow = await request("/scales/generate", stephaniToken, { method: "POST", body: JSON.stringify({ operationId: operation!.id, groupId: group!.id, areaId: bailarinos!.id, locationId: snowland!.id, periodStart: date, periodEnd: date }) });
    const acquaScale = await request("/scales/generate", stephaniToken, { method: "POST", body: JSON.stringify({ operationId: operation!.id, groupId: group!.id, areaId: bailarinos!.id, locationId: acquamotion!.id, periodStart: date, periodEnd: date }) });
    assert(snowScale.status === 201 && victorAcqua.status === 403 && stephaniSnow.status === 403 && acquaScale.status === 201, "matriz ÁreaLocalSupervisor: Victor só salva Snowland e Stephani só Acquamotion");
    for (const response of [snowScale, acquaScale]) {
      const body = await response.json() as { scale?: { id?: string } };
      if (body.scale?.id) scaleIds.push(body.scale.id);
    }
    for (const [scaleId, allowedToken, deniedToken] of [[scaleIds[1]!, victorToken, stephaniToken], [scaleIds[2]!, stephaniToken, victorToken]]) {
      const save = await request(`/scales/${scaleId}`, allowedToken, { method: "PATCH", body: JSON.stringify({ title: `${tag}_saved`, expectedVersion: 1 }) });
      const denied = await request(`/scales/${scaleId}`, deniedToken, { method: "PATCH", body: JSON.stringify({ title: "não deve salvar", expectedVersion: 2 }) });
      assert(save.status === 200 && denied.status === 403, "salvar Escala existente: próprio local 200, outro local 403");
    }
    const missingScope = await request("/scales/generate", victorToken, { method: "POST", body: JSON.stringify({ operationId: operation!.id, groupId: group!.id, periodStart: date, periodEnd: date }) });
    assert(missingScope.status === 403, "omitir área/local não contorna AreaLocalSupervisor");

    const generated = await request("/daily-book/generate", adminToken, { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date }) });
    const generatedBody = await generated.json() as { dailyBook?: { id: string; version: number }; conflicts?: Array<{ id: string; severity: string }> };
    dailyBookId = generatedBody.dailyBook?.id ?? null;
    assert(generated.status === 201 && Boolean(dailyBookId) && (generatedBody.conflicts?.length ?? 0) > 0, "gerar Livro do Dia com conflito sucede e devolve o alerta");
    const regenerated = await request(`/daily-book/${dailyBookId}/regenerate`, adminToken, { method: "POST", body: JSON.stringify({ expectedVersion: generatedBody.dailyBook!.version }) });
    const regeneratedBody = await regenerated.json() as { conflicts?: Array<{ id: string }> };
    assert(regenerated.status === 200 && (regeneratedBody.conflicts?.length ?? 0) > 0, "regenerar Livro do Dia também devolve conflito sem bloquear");
    const conflictId = regeneratedBody.conflicts![0]!.id;
    const acknowledge = await request(`/schedule-conflicts/${conflictId}/acknowledge`, adminToken, { method: "POST", body: JSON.stringify({ reason: "Sobreposição conhecida pela operação" }) });
    const acknowledgedPreview = await request(`/show-books/${showBook!.id}/resolve?date=${date}`, adminToken);
    const acknowledgedBody = await acknowledgedPreview.json() as { conflicts: Array<{ id: string; alerting: boolean }> };
    assert(acknowledge.status === 200 && acknowledgedBody.conflicts.some((conflict) => conflict.id === conflictId && !conflict.alerting), "montar show preserva ciente para a mesma combinação de horários");
    await request(`/show-books/${showBook!.id}/sessions/${sessionBody.session!.id}`, adminToken, { method: "PATCH", body: JSON.stringify({ endTime: "11:10" }) });
    const changedPreview = await request(`/show-books/${showBook!.id}/resolve?date=${date}`, adminToken);
    const changedBody = await changedPreview.json() as { conflicts: Array<{ id: string; alerting: boolean }> };
    assert(changedBody.conflicts.some((conflict) => conflict.id === conflictId && conflict.alerting), "alteração de horário reativa alerta na montagem");

    const [agenda] = await db.select().from(agendaEventsTable).where(and(eq(agendaEventsTable.showBookId, showBook!.id), eq(agendaEventsTable.date, date))).limit(1);
    agendaEventId = agenda?.id ?? null;
    await db.insert(operationalCheckInsTable).values([
      { orgId: org!.id, operationId: operation!.id, userId: memberA!.id, date, status: "ABSENT", excuseReason: "Motivo privado de falta" },
      { orgId: org!.id, operationId: operation!.id, userId: memberOtherArea!.id, date, status: "CHECKED_IN" },
    ]);
    const panel = await request(`/operational-panel?from=${date}&to=${date}`, directorToken);
    const panelBody = await panel.json() as { occurrences?: Record<string, unknown>; checkIns?: Record<string, unknown> };
    const occurrencePayload = panelBody.occurrences ?? {};
    assert(panel.status === 200 && Number(occurrencePayload.total) >= 2 && !Object.prototype.hasOwnProperty.call(occurrencePayload, "reason") && !Object.prototype.hasOwnProperty.call(occurrencePayload, "personId"), "Painel agrega ocorrências para DIR sem nome ou motivo");
    assert(!JSON.stringify(panelBody).includes("Registro inicial") && !JSON.stringify(panelBody).includes("Motivo privado de falta") && panelBody.checkIns?.total === 2, "Painel unifica cobertura/check-ins/ocorrências sem vazar motivos");
    const supervisorPanel = await request(`/operational-panel?from=${date}&to=${date}`, victorToken);
    const supervisorPanelBody = await supervisorPanel.json() as { checkIns: { total: number }; occurrences: { total: number } };
    assert(supervisorPanel.status === 200 && supervisorPanelBody.checkIns.total === 1 && supervisorPanelBody.occurrences.total === 1, "Painel da supervisão limita novos agregados à área/local");
    await verifyBlock6HttpRoutes({ request, assert, orgId: org!.id, operationId: operation!.id,
      areaId: bailarinos!.id, snowId: snowland!.id, acquaId: acquamotion!.id, showId: showBook!.id,
      personId: memberB!.id, otherPersonId: memberOtherArea!.id, supervisorId: victor!.id,
      tokens: { ADMIN: adminToken, DIR: directorToken, SUPERVISOR_A: victorToken, SUPERVISOR_B: stephaniToken, MEMBER: memberToken }, date });
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const testActors = [admin!.id, victor!.id, stephani!.id, memberA!.id, memberB!.id, memberOtherArea!.id, director!.id];
    const testChanges = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, testActors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, testActors), inArray(historyEventsTable.moId, testChanges.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, [admin!.id, victor!.id, stephani!.id]));
    await db.delete(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    await db.delete(scheduleConflictsTable).where(inArray(scheduleConflictsTable.userId, [memberA!.id, memberB!.id, memberOtherArea!.id]));
    if (dailyBookId) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, dailyBookId));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, dailyBookId));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, dailyBookId));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, dailyBookId));
    }
    if (agendaEventId) await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, agendaEventId));
    if (scaleIds.length > 0) {
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, scaleIds));
      await db.delete(scalesTable).where(inArray(scalesTable.id, scaleIds));
    }
    if (showBookId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.showId, showBookId));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
      if (roles.length > 0) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((role) => role.id)));
      await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
      await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showBookId));
      await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showBookId));
      await db.delete(showBooksTable).where(eq(showBooksTable.id, showBookId));
    }
    if (characterId) {
      await db.delete(characterCastTable).where(eq(characterCastTable.characterId, characterId));
      await db.delete(charactersTable).where(eq(charactersTable.id, characterId));
    }
    await db.delete(occurrencesTable).where(inArray(occurrencesTable.personId, [memberA!.id, memberOtherArea!.id]));
    await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.supervisorId, [victor!.id, stephani!.id]));
    await db.update(usersTable).set({ areaId: null, defaultLocationId: null }).where(inArray(usersTable.id, [memberA!.id, memberB!.id, memberOtherArea!.id]));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, [admin!.id, victor!.id, stephani!.id, memberA!.id, memberB!.id, memberOtherArea!.id, director!.id]));
    await db.delete(operationalGroupsTable).where(eq(operationalGroupsTable.id, group!.id));
    await db.delete(areasTable).where(inArray(areasTable.id, [bailarinos!.id, patinadores!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snowland!.id, acquamotion!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no Bloco 6`);
  process.stdout.write(`block6-integrity: ${passed} asserts passed\n`);
}

process.stdout.write("block6-integrity: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
