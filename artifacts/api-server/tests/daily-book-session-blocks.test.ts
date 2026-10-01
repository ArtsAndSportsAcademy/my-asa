/** Blocos de sessão do Livro do Dia e guarda de regeneração, contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  agendaEventsTable,
  dailyBookAssignmentsTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookScenesTable,
  dailyBooksTable,
  db,
  historyEventsTable,
  operationalChangesTable,
  operationsTable,
  organizationsTable,
  pool,
  scheduleConflictsTable,
  sessionsTable,
  showBookBlocksTable,
  showBookLinesTable,
  showBookRolesTable,
  showBookScenesTable,
  showBooksTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type SessionBlockDto = { id: string; name: string; startTime: string | null; endTime: string | null; stale: boolean };
type Warning = { code: string; blockId: string };

async function run() {
  const tag = `sessblk_${Date.now()}`;
  const date = "2026-09-24";
  const otherDate = "2026-09-25";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [memberA] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_a`, username: `${tag}_member_a` }).returning();

  let server: http.Server | null = null;
  const showIds: string[] = [];
  const dailyBookIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: memberA!.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);

    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin!.id }).returning();
    const [emptyShow] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_sem_sessao`, createdBy: admin!.id }).returning();
    showIds.push(showBook!.id, emptyShow!.id);
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showBook!.id, name: `${tag}_scene`, order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: `${tag}_block`, order: 0 }).returning();
    const [role] = await db.insert(showBookRolesTable).values({ showBookId: showBook!.id, blockId: block!.id, name: `${tag}_position`, order: 0 }).returning();
    await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "FIXED_PERSON", config: { userId: memberA!.id }, order: 0 });

    // Elegíveis em 2026-09-24: 08:00-09:00 (vigência começa na própria data) e 10:00-11:00.
    // Inelegíveis: vigência vencida, sessão inativa e vigência que só começa em 09-25.
    const [s1, sExpired, sInactive, s4, sFuture] = await db.insert(sessionsTable).values([
      { showId: showBook!.id, startTime: "10:00", endTime: "11:00" },
      { showId: showBook!.id, startTime: "16:00", endTime: "17:00", validTo: "2026-09-23" },
      { showId: showBook!.id, startTime: "12:00", endTime: "13:00", active: false },
      { showId: showBook!.id, startTime: "08:00", endTime: "09:00", validFrom: date },
      { showId: showBook!.id, startTime: "20:00", endTime: "21:00", validFrom: otherDate },
    ]).returning();
    void sExpired; void sInactive; void sFuture;

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const adminToken = signAccessToken({ sub: admin!.id, jti: `${tag}_admin`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const request = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const readBook = async (id: string) => (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!;
    const sessionRows = (id: string) => db.select().from(dailyBookBlocksTable).where(and(
      eq(dailyBookBlocksTable.dailyBookId, id), isNull(dailyBookBlocksTable.sourceBlockId), isNull(dailyBookBlocksTable.sceneId),
    ));
    const childCounts = async (id: string) => ({
      blocks: (await db.select({ id: dailyBookBlocksTable.id }).from(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id))).length,
      positions: (await db.select({ id: dailyBookPositionsTable.id }).from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id))).length,
      assignments: (await db.select({ id: dailyBookAssignmentsTable.id }).from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id))).length,
      scenes: (await db.select({ id: dailyBookScenesTable.id }).from(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id))).length,
    });
    const regenerate = async (id: string) => request(`/daily-book/${id}/regenerate`, { method: "POST", body: JSON.stringify({ expectedVersion: (await readBook(id)).version }) });
    const getBlocks = async (id: string) => {
      const response = await request(`/daily-book/${id}`);
      const body = await response.json() as { dailyBook?: { sessionBlocks?: SessionBlockDto[]; scenes?: unknown } };
      return { status: response.status, blocks: body.dailyBook?.sessionBlocks ?? [], scenes: body.dailyBook?.scenes };
    };

    // 1 · Geração: um bloco por sessão elegível, na ordem de horário.
    const generated = await request("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date }) });
    const generatedBody = await generated.json() as { dailyBook?: { id: string }; sessionBlocks?: SessionBlockDto[] };
    const bookId = generatedBody.dailyBook?.id ?? "";
    if (bookId) dailyBookIds.push(bookId);
    assert(generated.status === 201 && Boolean(bookId), "gerar Livro do Dia de show com sessões sucede");
    if (!bookId) throw new Error("geração falhou; demais verificações não fazem sentido");
    const names = (generatedBody.sessionBlocks ?? []).map((item) => item.name);
    assert(names.length === 2 && names[0] === "Sessão 08:00–09:00" && names[1] === "Sessão 10:00–11:00", "gera um bloco por sessão elegível, em ordem de horário; vencida, inativa e futura ficam de fora");
    assert((generatedBody.sessionBlocks ?? []).every((item) => !item.stale && item.startTime?.length === 5), "blocos recém-gerados não são órfãos e guardam início/fim em HH:MM");
    const rows = await sessionRows(bookId);
    const positionsInSessionBlocks = rows.length ? await db.select({ id: dailyBookPositionsTable.id }).from(dailyBookPositionsTable).where(inArray(dailyBookPositionsTable.blockId, rows.map((row) => row.id))) : [];
    assert(rows.length === 2 && positionsInSessionBlocks.length === 0, "bloco de sessão só marca horário: nenhuma posição própria");
    const showBlocks = await db.select({ id: dailyBookBlocksTable.id }).from(dailyBookBlocksTable).where(and(eq(dailyBookBlocksTable.dailyBookId, bookId), eq(dailyBookBlocksTable.sourceBlockId, block!.id)));
    assert(showBlocks.length === 1, "o bloco vindo do Livro do Show continua presente ao lado dos blocos de sessão");

    // 2 · Registro na mesma geração.
    const generatedEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "generated")));
    const generatedMeta = generatedEvents[0]?.metadata as { sessionIds?: string[]; sessionBlockIds?: string[] } | undefined;
    assert(generatedEvents.length === 1 && new Set(generatedMeta?.sessionIds).size === 2 && generatedMeta!.sessionIds!.includes(s1!.id) && generatedMeta!.sessionIds!.includes(s4!.id) && generatedMeta?.sessionBlockIds?.length === 2, "Registro da geração lista as sessões e os blocos de sessão criados");

    // 3 · Leitura: campo novo presente; árvore de cenas não muda (pendência documentada).
    const read = await getBlocks(bookId);
    assert(read.status === 200 && read.blocks.length === 2 && read.blocks.every((item) => !item.stale), "GET do Livro do Dia devolve os blocos de sessão sem marca de órfão");
    assert(!JSON.stringify(read.scenes).includes("Sessão "), "blocos de sessão continuam fora da árvore scenes (pendência anotada, não implementada)");

    // 4 · Show sem sessão cadastrada entra normalmente, sem bloco de horário.
    const emptyGenerated = await request("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: emptyShow!.id, date }) });
    const emptyBody = await emptyGenerated.json() as { dailyBook?: { id: string }; sessionBlocks?: SessionBlockDto[] };
    if (emptyBody.dailyBook?.id) dailyBookIds.push(emptyBody.dailyBook.id);
    assert(emptyGenerated.status === 201 && (emptyBody.sessionBlocks?.length ?? -1) === 0 && (await sessionRows(emptyBody.dailyBook!.id)).length === 0, "show sem sessão cadastrada é gerado normalmente, sem bloco de horário e sem inventar horário");

    // 5 · Regenerar sem mudança preserva os mesmos blocos (mesmos ids) e não avisa.
    const idsBefore = (await sessionRows(bookId)).map((row) => row.id).sort();
    const regenerated = await regenerate(bookId);
    const regeneratedBody = await regenerated.json() as { warnings?: Warning[] };
    const idsAfter = (await sessionRows(bookId)).map((row) => row.id).sort();
    assert(regenerated.status === 200 && JSON.stringify(idsBefore) === JSON.stringify(idsAfter) && (regeneratedBody.warnings?.length ?? 0) === 0, "regenerar sem mudança mantém os mesmos blocos de sessão e não avisa");
    const regenEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "regenerate")));
    const regenAfter = regenEvents[0]?.afterState as { sessionBlocks?: unknown[] } | null | undefined;
    assert(regenEvents.length === 1 && (regenAfter?.sessionBlocks?.length ?? 0) === 2, "Registro da regeneração guarda os blocos de sessão depois");

    // 6 · Sessão desativada depois da geração: regenerar só avisa, o bloco antigo fica.
    const s1Block = (await sessionRows(bookId)).find((row) => row.startTime === "10:00")!;
    const deactivated = await request(`/show-books/${showBook!.id}/sessions/${s1!.id}`, { method: "DELETE" });
    assert(deactivated.status === 200, "desativar a sessão é lógico e responde 200");
    const staleRead = await getBlocks(bookId);
    assert(staleRead.blocks.find((item) => item.id === s1Block.id)?.stale === true && staleRead.blocks.find((item) => item.startTime === "08:00")?.stale === false, "bloco da sessão desativada aparece como órfão; o outro não");
    const warned = await regenerate(bookId);
    const warnedBody = await warned.json() as { warnings?: Warning[] };
    const afterWarn = await sessionRows(bookId);
    assert(warned.status === 200 && afterWarn.some((row) => row.id === s1Block.id) && afterWarn.length === 2, "regenerar não remove o bloco órfão");
    assert(warnedBody.warnings?.length === 1 && warnedBody.warnings[0]?.code === "session_block_stale" && warnedBody.warnings[0]?.blockId === s1Block.id, "regenerar avisa sobre o bloco órfão com código e id");

    // 7 · Reativar reabre sozinho.
    const reactivated = await request(`/show-books/${showBook!.id}/sessions/${s1!.id}`, { method: "PATCH", body: JSON.stringify({ active: true }) });
    const reopenRead = await getBlocks(bookId);
    assert(reactivated.status === 200 && reopenRead.blocks.every((item) => !item.stale), "reativar a sessão remove a marca de órfão sem escrever nada");

    // 8 · Mudar o horário deixa o bloco antigo órfão e cria o novo na regeneração.
    const timeChanged = await request(`/show-books/${showBook!.id}/sessions/${s4!.id}`, { method: "PATCH", body: JSON.stringify({ endTime: "09:30" }) });
    const oldBlockStale = (await getBlocks(bookId)).blocks.find((item) => item.name === "Sessão 08:00–09:00")?.stale === true;
    const timeRegen = await regenerate(bookId);
    const timeRegenBody = await timeRegen.json() as { warnings?: Warning[] };
    const afterTime = (await sessionRows(bookId)).map((row) => row.name).sort();
    assert(timeChanged.status === 200 && oldBlockStale && timeRegen.status === 200 && afterTime.length === 3 && afterTime.includes("Sessão 08:00–09:30") && afterTime.includes("Sessão 08:00–09:00") && timeRegenBody.warnings?.length === 1, "mudar o horário: bloco antigo fica órfão e preservado, o novo nasce e a regeneração avisa");

    // 9 · Vigência vale por data: em 09-25 entram a sessão futura e as vigentes; vencida e inativa não.
    const otherGenerated = await request("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date: otherDate }) });
    const otherBody = await otherGenerated.json() as { dailyBook?: { id: string }; sessionBlocks?: SessionBlockDto[] };
    if (otherBody.dailyBook?.id) dailyBookIds.push(otherBody.dailyBook.id);
    assert(otherGenerated.status === 201 && JSON.stringify((otherBody.sessionBlocks ?? []).map((item) => item.name)) === JSON.stringify(["Sessão 08:00–09:30", "Sessão 10:00–11:00", "Sessão 20:00–21:00"]), "outra data, outra elegibilidade: entra a sessão cuja vigência começa nela");

    // 10 · Guarda de regeneração: só DRAFT passa; os quatro demais estados são recusados sem tocar nos filhos.
    const expectations: Array<[string, string]> = [["PUBLISHED", "publicado"], ["REPUBLISHED", "republicado"], ["EXECUTED", "executado"], ["CANCELLED", "cancelado"]];
    for (const [status, word] of expectations) {
      await db.update(dailyBooksTable).set({ status: status as never }).where(eq(dailyBooksTable.id, bookId));
      const beforeCounts = await childCounts(bookId);
      const beforeVersion = (await readBook(bookId)).version;
      const blocked = await regenerate(bookId);
      const blockedBody = await blocked.json() as { error?: string };
      const afterCounts = await childCounts(bookId);
      assert(blocked.status === 409 && (blockedBody.error ?? "").toLowerCase().includes(word), `regenerar Livro ${status} é recusado com 409 e mensagem própria`);
      assert(JSON.stringify(beforeCounts) === JSON.stringify(afterCounts) && (await readBook(bookId)).version === beforeVersion, `recusa de ${status} não apaga nem altera nada (filhos e versão intactos)`);
    }
    await db.update(dailyBooksTable).set({ status: "DRAFT" }).where(eq(dailyBooksTable.id, bookId));
    const draftAgain = await regenerate(bookId);
    assert(draftAgain.status === 200, "de volta a DRAFT, a regeneração volta a funcionar");

    // 11 · Atomicidade: Registro falhando desfaz a geração inteira, inclusive os blocos de sessão.
    const yetAnotherDate = "2026-09-26";
    const booksBefore = (await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, showBook!.id))).length;
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    const failing = await request("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date: yetAnotherDate }) });
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    const booksAfter = (await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, showBook!.id))).length;
    assert(failing.status === 500 && booksAfter === booksBefore, "Registro falhando desfaz a geração: nenhum Livro nem bloco de sessão sobra");
  } finally {
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const actors = [admin!.id, memberA!.id];
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, actors), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(scheduleConflictsTable).where(eq(scheduleConflictsTable.userId, memberA!.id));
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
      await db.delete(sessionsTable).where(inArray(sessionsTable.showId, showIds));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((item) => item.id)));
      await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, showIds));
      await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, showIds));
      await db.delete(showBooksTable).where(inArray(showBooksTable.id, showIds));
    }
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, actors));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) nos blocos de sessão / guarda de regeneração`);
  process.stdout.write(`daily-book-session-blocks: ${passed} asserts passed\n`);
}

process.stdout.write("daily-book-session-blocks: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
