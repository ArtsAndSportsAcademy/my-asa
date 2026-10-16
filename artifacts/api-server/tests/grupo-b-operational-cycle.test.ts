/** Grupo B — Folgas, Check-in/ocorrências e Painel contra Postgres real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable,
  dailyBookCheckInVacanciesTable, dailyBookPositionsTable, dailyBooksTable, dayCheckInsTable,
  db, folgasTable, historyEventsTable, leaveRegimesTable, leaveRequestsTable, locationsTable, notificationOutboxTable, userNotificationsTable,
  operationLocationsTable, operationsTable, organizationsTable, pool, programacaoBlocosTable,
  programacoesTable, scalesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { montarEscalaDoDia } from "../src/services/escala-dia.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";

let passed = 0;
const failures: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (condition) passed++;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
};

async function run() {
  const tag = `grupo_b_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [location] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  const [area, otherArea] = await db.insert(areasTable).values([
    { organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` },
  ]).returning();
  const makeUser = async (name: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, areaId }).returning())[0]!;
  const admin = await makeUser("admin", null), sup = await makeUser("sup", area!.id), memberOnLeave = await makeUser("folga", area!.id), worker = await makeUser("worker", area!.id), outsider = await makeUser("fora", otherArea!.id);
  let server: http.Server | null = null;
  let bookId = "", scaleId = "", programId = "";
  try {
    await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: location!.id });
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      ...[memberOnLeave, worker, outsider].map((user) => ({ userId: user.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: location!.id, supervisorId: sup.id });
    const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: location!.id, title: `${tag}_show`, createdBy: admin.id, usesCharacters: false }).returning();
    const [event] = await db.insert(agendaEventsTable).values({ operationId: operation!.id, showBookId: show!.id, type: "SHOW", title: `${tag}_evento`, date, startTime: "10:00", endTime: "11:00", createdBy: admin.id }).returning();
    const [scale] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: location!.id, title: `${tag}_escala`, periodStart: date, periodEnd: date, status: "PUBLISHED", createdBy: admin.id, publishedBy: admin.id, publishedAt: new Date() }).returning();
    const [book] = await db.insert(dailyBooksTable).values({ agendaEventId: event!.id, scaleId: scale!.id, showBookId: show!.id, status: "PUBLISHED", generatedBy: admin.id }).returning();
    scaleId = scale!.id; bookId = book!.id;
    const [position] = await db.insert(dailyBookPositionsTable).values({ dailyBookId: book!.id, name: "PI 01" }).returning();
    await db.insert(dailyBookAssignmentsTable).values({ dailyBookId: book!.id, positionId: position!.id, userId: worker.id, status: "ASSIGNED" });
    const [program] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: location!.id, nome: `${tag}_programação`, vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31", createdBy: admin.id }).returning();
    programId = program!.id;
    await db.insert(programacaoBlocosTable).values({ programacaoId: program!.id, weekday: 1, inicio: "10:00", fim: "11:00", rotulo: `${tag}_SHOW`, regra: "livro", showBookId: show!.id, order: 0 });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const adminApi = as(admin.id, "ADMIN"), supApi = as(sup.id, "SUPERVISOR_A"), memberApi = as(memberOnLeave.id, "MEMBER"), outsiderApi = as(outsider.id, "MEMBER");
    const post = (api: typeof adminApi, path: string, body: unknown) => api(path, { method: "POST", body: JSON.stringify(body) });

    const regime = await post(adminApi, "/leave-regimes", { effectiveFrom: "2026-10-01", weeklyDays: 1, weekStartsOn: 4, recessRules: { note: "teste" } });
    assert(regime.status === 201, "Administração configura o regime de folgas com vigência");
    const current = await supApi(`/leave-regimes/current?date=${date}`);
    assert(current.status === 200 && ((await current.json()) as { regime: { weeklyDays: number } }).regime.weeklyDays === 1, "Supervisão lê o regime vigente");
    assert((await memberApi(`/leave-regimes/current?date=${date}`)).status === 403, "Elenco não acessa configuração de regime");

    // Folga que já passou não se pede: o servidor recusa. O pedido do dia 05 (já passado) entra direto no banco,
    // porque o que este teste quer exercitar é a decisão e o efeito dela na Escala daquele dia.
    const futuro = shiftOperationalDate(operationalDate(), 20);
    // Pedido de folga só espera decisão quando o mapa do mês já foi publicado; antes disso ele entra como
    // prioridade (Etapa 3). Estes pedidos testam a decisão, então os meses das datas usadas saem publicados.
    for (const dias of [20, 21, 22, 23]) {
      const alvo = shiftOperationalDate(operationalDate(), dias);
      await post(adminApi, "/folgas/grid/publicar", { operationId: operation!.id, year: Number(alvo.slice(0, 4)), month: Number(alvo.slice(5, 7)) });
    }
    const passado = await post(memberApi, "/leave-requests", { startDate: date, endDate: date, reason: "Compromisso" });
    assert(passado.status === 400 && ((await passado.json()) as { message: string }).message.includes("já passou"), "pedir folga de dia que já passou é recusado, com a frase certa");
    const ask = await post(memberApi, "/leave-requests", { startDate: futuro, endDate: futuro, reason: "Compromisso" });
    assert(ask.status === 201, "Elenco solicita folga para uma data futura");
    assert((await post(memberApi, `/leave-requests/${((await ask.json()) as { request: { id: string } }).request.id}/cancelar`, {})).status === 200, "e pode retirá-lo");
    const [request0] = await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: memberOnLeave.id, areaId: area!.id, startDate: date, endDate: date, reason: "Compromisso" }).returning();
    const request = { request: { id: request0!.id } };
    const approve = await supApi(`/leave-requests/${request.request.id}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED", decisionReason: "Cobertura conferida" }) });
    assert(approve.status === 200, "Supervisão aprova pedido da própria área com motivo");
    const dayAfterLeave = await montarEscalaDoDia(org!.id, location!.id, date);
    assert(!dayAfterLeave!.blocos[0]!.pessoaIds.includes(memberOnLeave.id), "folga aprovada exclui a pessoa da Escala antes da alocação");
    assert((await db.select().from(folgasTable).where(eq(folgasTable.userId, memberOnLeave.id))).length === 1, "aprovação materializa compatibilidade legada sem dispensar a fonte nova");
    const historyLeave = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, request.request.id), eq(historyEventsTable.action, "leave.approved")));
    assert(historyLeave.length === 1, "decisão de folga grava Registro");
    const direct = await post(supApi, "/leave-calendar", { userId: worker.id, startDate: "2026-10-06", endDate: "2026-10-06", reason: "Rodízio de grupo" });
    assert(direct.status === 201, "Supervisão define folga diretamente no calendário da própria área");
    const many = await post(supApi, "/leave-calendar", { userIds: [worker.id, memberOnLeave.id], startDate: "2026-10-07", endDate: "2026-10-07", reason: "Mesmo dia combinado" });
    assert(many.status === 201 && ((await many.json()) as { requests: unknown[] }).requests.length === 2, "Supervisão define a folga de duas pessoas numa ação");
    assert((await post(supApi, "/leave-calendar", { userId: outsider.id, startDate: date, endDate: date, reason: "tentativa" })).status === 403, "Supervisão não define folga para outra área");
    const pending = await post(memberApi, "/leave-requests", { startDate: shiftOperationalDate(operationalDate(), 21), endDate: shiftOperationalDate(operationalDate(), 21), reason: "Compromisso" });
    const pendingId = ((await pending.json()) as { request: { id: string } }).request.id;
    assert((await post(memberApi, `/leave-requests/${pendingId}/cancelar`, {})).status === 200, "Elenco retira o próprio pedido pendente");
    assert((await supApi(`/leave-requests/${pendingId}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED", decisionReason: "Tarde demais" }) })).status === 409, "pedido retirado não pode ser aprovado depois");

    // Aprovar não exige recado; recusar exige — a pessoa precisa saber por quê. E o intervalo ao contrário diz o que está errado.
    const semRecado = await post(memberApi, "/leave-requests", { startDate: shiftOperationalDate(operationalDate(), 22), endDate: shiftOperationalDate(operationalDate(), 22), reason: "Compromisso" });
    const semRecadoId = ((await semRecado.json()) as { request: { id: string } }).request.id;
    const recusaMuda = await supApi(`/leave-requests/${semRecadoId}`, { method: "PATCH", body: JSON.stringify({ status: "DENIED" }) });
    assert(recusaMuda.status === 400 && ((await recusaMuda.json()) as { message: string }).message === "Recusar exige motivo.", "recusar sem motivo é barrado com a frase certa");
    const aprovaMuda = await supApi(`/leave-requests/${semRecadoId}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) });
    const [aprovado] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, semRecadoId));
    assert(aprovaMuda.status === 200 && aprovado?.status === "APPROVED" && aprovado.decisionReason === "Aprovada sem observação.", "aprovar sem recado vale, e o Registro diz que foi sem observação");
    const registroSemRecado = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, semRecadoId), eq(historyEventsTable.action, "leave.approved")));
    assert(registroSemRecado.length === 1, "aprovação sem recado também entra no Registro");
    // Aprovar sobre dias que já têm folga marcada avisa e não empilha uma segunda folga por cima.
    const diaJa = shiftOperationalDate(operationalDate(), 23);
    await post(supApi, "/leave-calendar", { userId: memberOnLeave.id, startDate: diaJa, endDate: diaJa, reason: "Grupo de folga" });
    const emCima = await post(memberApi, "/leave-requests", { startDate: diaJa, endDate: diaJa, reason: "Compromisso" });
    const emCimaId = ((await emCima.json()) as { request: { id: string } }).request.id;
    const fila = (await (await supApi(`/leave-requests?from=${diaJa}&to=${diaJa}`)).json()) as { requests: { id: string; jaTemFolga?: boolean }[] };
    assert(fila.requests.find((r) => r.id === emCimaId)?.jaTemFolga === true, "a fila avisa, antes de decidir, que a pessoa já tem folga marcada nesses dias");
    const aprovaEmCima = await supApi(`/leave-requests/${emCimaId}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) });
    const aprovaEmCimaCorpo = (await aprovaEmCima.json()) as { aviso?: string };
    assert(aprovaEmCima.status === 200 && Boolean(aprovaEmCimaCorpo.aviso?.includes("já tinham folga")), "aprovar sobre folga já marcada devolve o aviso");
    const folgasDoDia = await db.select().from(folgasTable).where(and(eq(folgasTable.userId, memberOnLeave.id), eq(folgasTable.startDate, diaJa)));
    assert(folgasDoDia.length === 1, "e não duplica a folga naquele dia");
    const invertido = await post(memberApi, "/leave-requests", { startDate: "2026-10-12", endDate: "2026-10-10", reason: "Compromisso" });
    assert(invertido.status === 400 && ((await invertido.json()) as { message: string }).message.includes("último dia"), "período ao contrário diz o que está errado");

    const day = await montarEscalaDoDia(org!.id, location!.id, date);
    const block = day!.blocos.find((item) => item.dailyBookId === book!.id)!;
    assert(Boolean(block) && block.pessoaIds.includes(worker.id), "Livro publicado entra como bloco da Escala para o check-in");
    const absent = await post(supApi, "/day-checkins", { scaleId: scale!.id, sourceKey: block.key, userId: worker.id, status: "ABSENT", reason: "Não chegou", date });
    assert(absent.status === 200, "Supervisão registra falta da própria área sem bloquear o dia");
    const [risk] = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, book!.id));
    const [vacancy] = await db.select().from(dailyBookCheckInVacanciesTable).where(and(eq(dailyBookCheckInVacanciesTable.dailyBookId, book!.id), eq(dailyBookCheckInVacanciesTable.active, true)));
    assert(risk?.status === "AT_RISK" && Boolean(vacancy), "falta abre vaga no mesmo slot do Livro, sem apagar a convocação");
    const painelDoDia = (await (await supApi(`/panel-indicators?date=${date}`)).json()) as { vacancies: { open: number } };
    const painelOutroDia = (await (await supApi(`/panel-indicators?date=${shiftOperationalDate(date, 1)}`)).json()) as { vacancies: { open: number } };
    assert(painelDoDia.vacancies.open === 1 && painelOutroDia.vacancies.open === 0, "o Painel conta só as vagas do dia consultado, não as de outros dias");
    const arrived = await post(supApi, "/day-checkins", { scaleId: scale!.id, sourceKey: block.key, userId: worker.id, status: "CHECKED_IN", date });
    const [resolved] = await db.select().from(dailyBookCheckInVacanciesTable).where(eq(dailyBookCheckInVacanciesTable.id, vacancy!.id));
    const [assignedAgain] = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, risk!.id));
    assert(arrived.status === 200 && assignedAgain?.status === "ASSIGNED" && resolved?.active === false, "chegada resolve logicamente o risco do Livro");
    const late = await post(outsiderApi, "/day-checkins", { scaleId: scale!.id, sourceKey: block.key, userId: worker.id, status: "LATE", etaMinutes: 10, date });
    assert(late.status === 403, "Elenco não registra presença de outra pessoa");

    const panel = await supApi(`/panel-indicators?date=${date}`);
    const panelBody = await panel.json() as Record<string, unknown>;
    assert(panel.status === 200 && !JSON.stringify(panelBody).includes("Não chegou") && !JSON.stringify(panelBody).includes(worker.name), "Painel devolve apenas indicadores agregados, sem nome ou motivo pessoal");
    const checkInEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityType, "day_checkin"), eq(historyEventsTable.actorId, sup.id)));
    assert(checkInEvents.length >= 2, "falta e chegada gravam Registro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, [admin.id, sup.id, memberOnLeave.id, worker.id, outsider.id])));
    if (bookId) await db.delete(dailyBookCheckInVacanciesTable).where(eq(dailyBookCheckInVacanciesTable.dailyBookId, bookId));
    if (scaleId) await db.delete(dayCheckInsTable).where(eq(dayCheckInsTable.scaleId, scaleId));
    if (bookId) { await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, bookId)); await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, bookId)); await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, bookId)); }
    if (programId) await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, programId));
    await db.delete(programacoesTable).where(eq(programacoesTable.organizationId, org!.id));
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    await db.delete(leaveRegimesTable).where(eq(leaveRegimesTable.organizationId, org!.id));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, [admin.id, sup.id, memberOnLeave.id, worker.id, outsider.id]));
    // A fila entrega avisos ao sino durante o teste: eles saem antes das pessoas (chave estrangeira).
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, [admin.id, sup.id, memberOnLeave.id, worker.id, outsider.id]));
    await db.delete(folgasTable).where(inArray(folgasTable.userId, [admin.id, sup.id, memberOnLeave.id, worker.id, outsider.id]));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.operationId, operation!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, location!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, [admin.id, sup.id, memberOnLeave.id, worker.id, outsider.id]));
    await db.delete(usersTable).where(inArray(usersTable.id, [admin.id, sup.id, memberOnLeave.id, worker.id, outsider.id]));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, operation!.id));
    await db.delete(locationsTable).where(eq(locationsTable.organizationId, org!.id));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificação(ões) passaram.`); process.exit(1); }
  console.log(`✓ Grupo B: ${passed} verificações passaram.`);
}

run().catch((error) => { console.error(error); process.exit(1); });
