/** Aceite G2/G3/G4 contra PostgreSQL real. */
import http from "node:http";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  organizationsTable,
  operationsTable,
  usersTable,
  userRolesTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  scalesTable,
  agendaEventsTable,
  recurringActivitiesTable,
  libraryCategoriesTable,
  tasksTable,
  taskEvidencesTable,
  historyEventsTable,
  deliveriesTable,
  deliveryAssignmentsTable,
  folgasTable,
  userNotificationsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

async function run() {
  const tag = `block5_integrity_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [person] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_person`, username: `${tag}_person` }).returning();
  const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin!.id }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showBook!.id, name: `${tag}_scene`, order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: `${tag}_block`, order: 0 }).returning();
  const [position] = await db.insert(showBookRolesTable).values({ showBookId: showBook!.id, blockId: block!.id, name: `${tag}_position`, order: 0 }).returning();
  const [line] = await db.insert(showBookLinesTable).values({ positionId: position!.id, type: "FIXED_PERSON", config: { userId: person!.id } }).returning();
  const [scale] = await db.insert(scalesTable).values({ operationId: operation!.id, showBookId: null, title: `${tag}_scale`, periodStart: "2026-09-20", periodEnd: "2026-09-20", status: "DRAFT", createdBy: admin!.id }).returning();
  const [agenda] = await db.insert(agendaEventsTable).values({ operationId: operation!.id, type: "MEETING", title: `${tag}_agenda`, date: "2026-09-20", status: "DRAFT", createdBy: admin!.id }).returning();
  const [activity] = await db.insert(recurringActivitiesTable).values({ organizationId: org!.id, operationId: operation!.id, title: `${tag}_activity`, active: true }).returning();
  const [category] = await db.insert(libraryCategoriesTable).values({ orgId: org!.id, name: `${tag}_category`, active: true }).returning();
  const [task] = await db.insert(tasksTable).values({
    organizationId: org!.id, operationId: operation!.id, title: `${tag}_task`, creatorId: admin!.id,
    assigneeId: person!.id, requiresApproval: false, status: "CREATED", dueDate: "2026-09-20",
  }).returning();
  const [evidence] = await db.insert(taskEvidencesTable).values({ taskId: task!.id, uploaderId: person!.id, type: "LINK", url: "https://example.test/evidence" }).returning();

  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: person!.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    const token = signAccessToken({ sub: admin!.id, jti: `${tag}_token`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const request = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    const failedScale = await request("/scales/generate", { method: "POST", body: JSON.stringify({ operationId: operation!.id, periodStart: "2026-09-21", periodEnd: "2026-09-21", title: `${tag}_rollback` }) });
    process.env.MYASA_TEST_FAIL_HISTORY = "0";
    const rollbackRows = await db.select().from(scalesTable).where(eq(scalesTable.title, `${tag}_rollback`));
    assert(failedScale.status === 500 && rollbackRows.length === 0, "falha no Registro derruba a transação e não deixa a Escala persistida");

    const deliveryTitle = `${tag}_delivery_rollback`;
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    const failedDelivery = await request("/deliveries", {
      method: "POST",
      body: JSON.stringify({
        title: deliveryTitle,
        type: "MANDATORY_READ",
        dueDate: "2026-09-22",
        maxDueDate: "2026-09-23",
      }),
    });
    process.env.MYASA_TEST_FAIL_HISTORY = "0";
    const deliveryRollbackRows = await db.select().from(deliveriesTable).where(and(
      eq(deliveriesTable.operationId, operation!.id),
      eq(deliveriesTable.title, deliveryTitle),
    ));
    assert(failedDelivery.status === 500 && deliveryRollbackRows.length === 0, "falha no Registro em Deliveries desfaz a criação da entrega");

    const folgaRollbackDate = "2026-09-22";
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    const failedFolgaGrid = await request("/folgas/grid/toggle", {
      method: "POST",
      body: JSON.stringify({ userId: person!.id, operationId: operation!.id, date: folgaRollbackDate, type: "DAY_OFF" }),
    });
    process.env.MYASA_TEST_FAIL_HISTORY = "0";
    const folgaRollbackRows = await db.select().from(folgasTable).where(and(
      eq(folgasTable.userId, person!.id),
      eq(folgasTable.operationId, operation!.id),
      eq(folgasTable.startDate, folgaRollbackDate),
      eq(folgasTable.endDate, folgaRollbackDate),
      eq(folgasTable.status, "ACTIVE"),
    ));
    assert(failedFolgaGrid.status === 500 && folgaRollbackRows.length === 0, "falha no Registro na grade de folgas desfaz a alteração da célula");

    // "Publicar mês" (desenho 18, 06/10): avisa a equipe, fica no Registro e o mapa diz se mudou depois.
    const gridMonth = () => request(`/folgas/grid?operationId=${operation!.id}&year=2026&month=9`).then(r => r.json() as Promise<{ publicacao?: { publishedAt: string | null; changedSince: boolean } }>);
    assert((await gridMonth()).publicacao?.publishedAt === null, "mapa de mês nunca publicado diz que não foi publicado");
    await request("/folgas/grid/toggle", { method: "POST", body: JSON.stringify({ userId: person!.id, operationId: operation!.id, date: "2026-09-23", type: "DAY_OFF" }) });
    const published = await request("/folgas/grid/publicar", { method: "POST", body: JSON.stringify({ operationId: operation!.id, year: 2026, month: 9 }) });
    const publishedBody = await published.json() as { avisados: number; publicacao: { publishedAt: string | null; changedSince: boolean } };
    assert(published.status === 200 && publishedBody.avisados === 1 && Boolean(publishedBody.publicacao.publishedAt) && !publishedBody.publicacao.changedSince, "publicar o mês avisa a equipe (sem avisar quem publicou)");
    const [publishedNotice] = await db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, person!.id), eq(userNotificationsTable.type, "folga.month_published")));
    assert(Boolean(publishedNotice) && publishedNotice!.actionUrl === "/folgas", "a pessoa recebe o aviso com o caminho para Folgas");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "FOLGA_MONTH_PUBLISHED")))).length === 1, "publicar o mês entra no Registro");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await request("/folgas/grid/toggle", { method: "POST", body: JSON.stringify({ userId: person!.id, operationId: operation!.id, date: "2026-09-24", type: "RECESSO" }) });
    assert((await gridMonth()).publicacao?.changedSince === true, "mexer no mapa depois de publicar aparece como \"mudou depois de publicar\"");
    const memberToken = signAccessToken({ sub: person!.id, jti: `${tag}_member`, organizationId: org!.id, role: "MEMBER", operationIds: [operation!.id] });
    const memberPublish = await fetch(`${base}/folgas/grid/publicar`, { method: "POST", headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" }, body: JSON.stringify({ operationId: operation!.id, year: 2026, month: 9 }) });
    assert(memberPublish.status === 403, "Elenco não publica o mês de folgas");

    // Show criado e troca de responsável entram no Registro (06/10).
    const novoShow = await request("/show-books", { method: "POST", body: JSON.stringify({ operationId: operation!.id, title: `${tag}_show_registro`, type: "CHARACTERS_ONLY", usesCharacters: true }) });
    const novoShowId = ((await novoShow.json()) as { showBook?: { id: string } }).showBook?.id ?? "";
    const criadoNoRegistro = novoShowId ? await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, novoShowId), eq(historyEventsTable.action, "show_book.created"))) : [];
    assert(novoShow.status === 201 && criadoNoRegistro.length === 1, "criar show entra no Registro");
    const semResponsavel = await request(`/show-books/${novoShowId}/responsible`, { method: "PATCH", body: JSON.stringify({ responsibleId: null }) });
    const trocaNoRegistro = novoShowId ? await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, novoShowId), eq(historyEventsTable.action, "show_book.responsible_changed"))) : [];
    assert(semResponsavel.status === 200 && trocaNoRegistro.length === 1, "trocar o responsável do show entra no Registro");
    const responsavelElenco = await request(`/show-books/${novoShowId}/responsible`, { method: "PATCH", body: JSON.stringify({ responsibleId: person!.id }) });
    const depoisDaRecusa = novoShowId ? await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, novoShowId), eq(historyEventsTable.action, "show_book.responsible_changed"))) : [];
    assert(responsavelElenco.status === 400 && depoisDaRecusa.length === 1, "responsável do Elenco é recusado e a recusa não entra no Registro");

    const deactivateUser = await request(`/users/${person!.id}`, { method: "DELETE", body: JSON.stringify({ reason: "encerramento de vínculo" }) });
    const [userAfter] = await db.select().from(usersTable).where(eq(usersTable.id, person!.id));
    assert(deactivateUser.status === 200 && Boolean(userAfter) && userAfter!.status === "INACTIVE" && userAfter!.personStatus === "ARCHIVED", "DELETE de pessoa vira desativação e preserva a linha");

    const archiveScale = await request(`/scales/${scale!.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: 1, reason: "escala substituída" }) });
    const [scaleAfter] = await db.select().from(scalesTable).where(eq(scalesTable.id, scale!.id));
    assert(archiveScale.status === 200 && Boolean(scaleAfter) && scaleAfter!.status === "ARCHIVED", "DELETE de Escala arquiva sem apagar a linha");

    const cancelAgenda = await request(`/agenda/events/${agenda!.id}`, { method: "DELETE", body: JSON.stringify({ reason: "evento não será realizado" }) });
    const [agendaAfter] = await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, agenda!.id));
    assert(cancelAgenda.status === 200 && Boolean(agendaAfter) && agendaAfter!.status === "CANCELLED", "DELETE de Agenda encerra o evento sem apagar a linha");

    const archiveShow = await request(`/show-books/${showBook!.id}`, { method: "DELETE", body: JSON.stringify({ reason: "Livro substituído" }) });
    const [showAfter] = await db.select().from(showBooksTable).where(eq(showBooksTable.id, showBook!.id));
    const [sceneAfter] = await db.select().from(showBookScenesTable).where(eq(showBookScenesTable.id, scene!.id));
    const [blockAfter] = await db.select().from(showBookBlocksTable).where(eq(showBookBlocksTable.id, block!.id));
    const [positionAfter] = await db.select().from(showBookRolesTable).where(eq(showBookRolesTable.id, position!.id));
    const [lineAfter] = await db.select().from(showBookLinesTable).where(eq(showBookLinesTable.id, line!.id));
    assert(archiveShow.status === 200 && showAfter?.status === "ARCHIVED" && sceneAfter?.active === false && blockAfter?.active === false && positionAfter?.active === false && lineAfter?.active === false, "DELETE de Livro do Show desativa o livro e seus filhos preservando histórico/FKs");

    const deactivateActivity = await request(`/activities/${activity!.id}`, { method: "DELETE", body: JSON.stringify({ reason: "atividade encerrada" }) });
    const [activityAfter] = await db.select().from(recurringActivitiesTable).where(eq(recurringActivitiesTable.id, activity!.id));
    assert(deactivateActivity.status === 200 && activityAfter?.active === false, "DELETE de Atividade usa active=false");

    const deactivateCategory = await request(`/library/categories/${category!.id}`, { method: "DELETE", body: JSON.stringify({ reason: "categoria descontinuada" }) });
    const [categoryAfter] = await db.select().from(libraryCategoriesTable).where(eq(libraryCategoriesTable.id, category!.id));
    assert(deactivateCategory.status === 204 && categoryAfter?.active === false, "DELETE de categoria da Biblioteca usa active=false");

    const deactivateEvidence = await request(`/tasks/${task!.id}/evidences/${evidence!.id}`, { method: "DELETE", body: JSON.stringify({ reason: "evidência substituída" }) });
    const [evidenceAfter] = await db.select().from(taskEvidencesTable).where(eq(taskEvidencesTable.id, evidence!.id));
    assert(deactivateEvidence.status === 204 && evidenceAfter?.active === false, "DELETE de evidência usa active=false");

    const historyRows = await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    assert(historyRows.length >= 5, `desativações preservam uma trilha operacional legível (eventos encontrados: ${historyRows.length})`);

    const at2130 = operationalDate(new Date("2026-09-16T00:30:00.000Z"));
    const at2330 = operationalDate(new Date("2026-09-16T02:30:00.000Z"));
    const afterMidnight = operationalDate(new Date("2026-09-16T03:30:00.000Z"));
    assert(at2130 === "2026-09-15", "evento às 21:30 de São Paulo fica no dia operacional correto");
    assert(at2330 === "2026-09-15", "check-in às 23:30 de São Paulo fica no dia operacional correto");
    assert(afterMidnight === "2026-09-16" && shiftOperationalDate("2026-09-15", 1) === "2026-09-16", "virada do dia operacional usa America/Sao_Paulo sem offset fixo");
  } finally {
    process.env.MYASA_TEST_FAIL_HISTORY = "0";
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await pool.query(
      "DELETE FROM history_relations WHERE source_event_id IN (SELECT id FROM history_events WHERE org_id = $1 OR actor_id = ANY($2::uuid[])) OR target_event_id IN (SELECT id FROM history_events WHERE org_id = $1 OR actor_id = ANY($2::uuid[]))",
      [org!.id, [admin!.id, person!.id]],
    );
    await pool.query("DELETE FROM history_events WHERE org_id = $1 OR actor_id = ANY($2::uuid[])", [org!.id, [admin!.id, person!.id]]);
    await pool.query("DELETE FROM delivery_assignments WHERE delivery_id IN (SELECT id FROM deliveries WHERE operation_id = $1)", [operation!.id]);
    await pool.query("DELETE FROM deliveries WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM folgas WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM user_notifications WHERE user_id = ANY($1::uuid[])", [[admin!.id, person!.id]]);
    await pool.query("DELETE FROM task_evidences WHERE id = $1", [evidence!.id]);
    await pool.query("DELETE FROM tasks WHERE id = $1", [task!.id]);
    await pool.query("DELETE FROM library_categories WHERE id = $1", [category!.id]);
    await pool.query("DELETE FROM recurring_activities WHERE id = $1", [activity!.id]);
    await pool.query("DELETE FROM agenda_events WHERE id = $1", [agenda!.id]);
    await pool.query("DELETE FROM scale_allocations WHERE scale_id = $1", [scale!.id]);
    await pool.query("DELETE FROM allocation_exceptions WHERE scale_id = $1", [scale!.id]);
    await pool.query("DELETE FROM allocation_candidates WHERE scale_id = $1", [scale!.id]);
    await pool.query("DELETE FROM scales WHERE id = $1", [scale!.id]);
    await pool.query("DELETE FROM show_book_lines WHERE id = $1", [line!.id]);
    await pool.query("DELETE FROM show_book_roles WHERE id = $1", [position!.id]);
    await pool.query("DELETE FROM show_book_blocks WHERE id = $1", [block!.id]);
    await pool.query("DELETE FROM show_book_scenes WHERE id = $1", [scene!.id]);
    await pool.query("DELETE FROM show_books WHERE id = $1", [showBook!.id]);
    await pool.query("DELETE FROM show_books WHERE operation_id = $1 AND title = $2", [operation!.id, `${tag}_show_registro`]);
    await pool.query("DELETE FROM user_roles WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[admin!.id, person!.id]]);
    await pool.query("DELETE FROM operations WHERE id = $1", [operation!.id]);
    await pool.query("DELETE FROM organizations WHERE id = $1", [org!.id]);
  }

  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no aceite G2/G3/G4`);
  console.log(`block5-integrity: ${passed} asserts passed`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
