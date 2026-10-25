/**
 * Troca de pessoa no Livro do Dia: a Supervisão troca pessoas de QUALQUER área dos locais em que supervisiona alguma área (25/10/2026; antes só da própria área; a mesma
 * regra da Escala); o responsável pelo show e a Administração trocam qualquer pessoa. O "capitão delegado" não existe
 * mais: delegação de DAILY_BOOK não dá acesso ao Livro. Contra PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable,
  dailyBookScenesTable, dailyBooksTable, db, delegationsTable, historyEventsTable, locationsTable, operationalChangesTable, operationsTable,
  notificationOutboxTable, organizationsTable, pool, showBookBlocksTable, showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable, userNotificationsTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `trocaarea_${Date.now()}`;
  const date = "2026-09-26";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_patinacao` }, { organizationId: org!.id, name: `${tag}_danca` }]).returning();
  const pessoa = async (nome: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}`, areaId }).returning())[0]!;
  const admin = await pessoa("admin", null);
  const supA = await pessoa("supA", areaA!.id);
  const supB = await pessoa("supB", areaB!.id);
  const capitao = await pessoa("capitao", areaA!.id);
  const a1 = await pessoa("a1", areaA!.id), a2 = await pessoa("a2", areaA!.id), b1 = await pessoa("b1", areaB!.id);
  const todos = [admin, supA, supB, capitao, a1, a2, b1].map((p) => p.id);

  let server: http.Server | null = null;
  const showIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: supA.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: supB.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: capitao.id, operationId: operation!.id, role: "MEMBER", active: true },
      ...[a1, a2, b1].map((p) => ({ userId: p.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(areaLocalSupervisorsTable).values([
      { areaId: areaA!.id, locationId: local!.id, supervisorId: supA.id }, { areaId: areaB!.id, locationId: local!.id, supervisorId: supB.id },
    ]);
    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_show`, createdBy: admin.id }).returning();
    showIds.push(showBook!.id);
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showBook!.id, name: `${tag}_cena`, order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: `${tag}_bloco`, order: 0 }).returning();
    const [papel] = await db.insert(showBookRolesTable).values({ showBookId: showBook!.id, blockId: block!.id, name: `${tag}_posicao`, order: 0 }).returning();
    await db.insert(showBookLinesTable).values({ positionId: papel!.id, type: "FIXED_PERSON", config: { userId: a1.id }, order: 0 });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role: role as "ADMIN", operationIds: [operation!.id] });
    const requestAs = (tk: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${tk}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(token(admin, "ADMIN")), asSupA = requestAs(token(supA, "SUPERVISOR_A")), asSupB = requestAs(token(supB, "SUPERVISOR_A")), asCapitao = requestAs(token(capitao, "MEMBER"));
    const readBook = async (id: string) => (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!;

    const gen = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date }) });
    const bookId = ((await gen.json()) as { dailyBook?: { id: string } }).dailyBook!.id;
    const [posicao] = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, bookId));
    const [alocacao] = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.positionId, posicao!.id));
    const trocar = async (as: ReturnType<typeof requestAs>, userId: string | null) => {
      const r = await as(`/daily-book/${bookId}/assignments/${alocacao!.id}`, { method: "PATCH", body: JSON.stringify({ userId, expectedVersion: (await readBook(bookId)).version }) });
      return { status: r.status, body: await r.json() as { message?: string } };
    };
    assert(gen.status === 201 && alocacao?.userId === a1.id, "o Livro nasce com a pessoa fixa da área A");

    // 1 · A Supervisão da área B troca pessoa da área A (qualquer área do local).
    const deOutraArea = await trocar(asSupB, a2.id);
    assert(deOutraArea.status === 200, "Supervisão da área B troca pessoa da área A (decisão de 25/10/2026: qualquer área do local)");
    assert((await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, alocacao!.id)))[0]!.userId === a2.id, "a troca gravou a alocação");

    // 2 · A Supervisão da área A põe pessoa da área B.
    const entraDeOutraArea = await trocar(asSupA, b1.id);
    assert(entraDeOutraArea.status === 200, "Supervisão da área A põe pessoa da área B");

    // 3 · Dentro da própria área, também.
    const dentro = await trocar(asSupA, a2.id);
    assert(dentro.status === 200, "Supervisão da área A troca pessoa da área A por outra da área A")

    // 4 · Capitão delegado deixou de existir: a delegação de DAILY_BOOK não dá acesso.
    await db.insert(delegationsTable).values({ delegatorId: admin.id, delegateeId: capitao.id, operationId: operation!.id, showBookId: showBook!.id, responsibilities: ["DAILY_BOOK"], validFrom: new Date(Date.now() - 60_000) });
    const capitaoTenta = await asCapitao(`/daily-book/${bookId}/assignments/${alocacao!.id}`, { method: "PATCH", body: JSON.stringify({ userId: a1.id, expectedVersion: (await readBook(bookId)).version }) });
    assert(capitaoTenta.status === 403, "quem só tem delegação de DAILY_BOOK não troca ninguém no Livro");

    // 5 · O responsável pelo show troca qualquer pessoa, de qualquer área.
    await db.update(showBooksTable).set({ responsibleId: supB.id }).where(eq(showBooksTable.id, showBook!.id));
    const responsavel = await trocar(asSupB, b1.id);
    assert(responsavel.status === 200, "o responsável pelo show (Supervisão da área B) troca uma pessoa da área A por uma da área B");
    const outraSup = await trocar(asSupA, a1.id);
    assert(outraSup.status === 403, "com responsável definido, a outra Supervisão deixa de operar o Livro");

    // 6 · Administração sempre pode.
    const adm = await trocar(asAdmin, a2.id);
    assert(adm.status === 200, "a Administração troca qualquer pessoa");

    // 7 · A resposta de republicar avisa quando não há Escala ligada ao Livro (nada a republicar junto).
    await db.update(dailyBooksTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(dailyBooksTable.id, bookId));
    const rep = await asAdmin(`/daily-book/${bookId}/republish`, { method: "POST", body: JSON.stringify({ expectedVersion: (await readBook(bookId)).version, reason: "teste", republicarEscala: true }) });
    const repBody = await rep.json() as { escala?: unknown };
    assert(rep.status === 200 && (repBody.escala === null || repBody.escala === undefined), "republicar com republicarEscala e sem Escala ligada republica só o Livro, sem erro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(delegationsTable).where(eq(delegationsTable.operationId, operation!.id));
    const books = showIds.length ? await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(inArray(dailyBooksTable.showBookId, showIds)) : [];
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    if (showIds.length) {
      await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, showIds));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((item) => item.id)));
      await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, showIds));
      await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, showIds));
      await db.delete(showBooksTable).where(inArray(showBooksTable.id, showIds));
    }
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    // Publicar e republicar avisam pessoas: as notificações apontam para os usuários e saem antes deles.
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(areasTable).where(and(eq(areasTable.organizationId, org!.id)));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na troca de pessoa por área`);
  process.stdout.write(`daily-book-troca-por-area: ${passed} asserts passed\n`);
}

process.stdout.write("daily-book-troca-por-area: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
