/** Reabrir, diferenças do padrão, filtro por data e biblioteca de formações por show — contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable,
  dailyBookAssignmentsTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookScenesTable,
  dailyBooksTable,
  db,
  formationsTable,
  historyEventsTable,
  operationalChangesTable,
  operationsTable,
  organizationsTable,
  pool,
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

async function run() {
  const tag = `reopendiff_${Date.now()}`;
  const date = "2026-09-24";
  const otherDate = "2026-09-25";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [supervisor] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_sup`, username: `${tag}_sup` }).returning();
  const [memberA] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_a`, username: `${tag}_member_a` }).returning();

  let server: http.Server | null = null;
  const showIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: supervisor!.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: memberA!.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);

    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin!.id }).returning();
    showIds.push(showBook!.id);
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showBook!.id, name: `${tag}_scene`, order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: `${tag}_block`, order: 0 }).returning();
    const [role] = await db.insert(showBookRolesTable).values({ showBookId: showBook!.id, blockId: block!.id, name: `${tag}_position`, order: 0 }).returning();
    await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "FIXED_PERSON", config: { userId: memberA!.id }, order: 0 });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const adminToken = signAccessToken({ sub: admin!.id, jti: `${tag}_admin`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const supToken = signAccessToken({ sub: supervisor!.id, jti: `${tag}_sup`, organizationId: org!.id, role: "SUPERVISOR_A", operationIds: [operation!.id] });
    const requestAs = (token: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(adminToken);
    const asSup = requestAs(supToken);
    const readBook = async (id: string) => (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!;

    // 1 · Gera um Livro do Dia para hoje e outro para outra data, para testar o filtro.
    const gen1 = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date }) });
    const gen1Body = await gen1.json() as { dailyBook?: { id: string } };
    const bookId = gen1Body.dailyBook!.id;
    const gen2 = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date: otherDate }) });
    const gen2Body = await gen2.json() as { dailyBook?: { id: string } };
    const otherBookId = gen2Body.dailyBook!.id;
    assert(gen1.status === 201 && gen2.status === 201, "gera um Livro do Dia por data");

    // 2 · Filtro por data no GET de lista.
    const listToday = await asAdmin(`/daily-book?date=${date}`);
    const listTodayBody = await listToday.json() as { dailyBooks?: { id: string }[] };
    assert(listToday.status === 200 && (listTodayBody.dailyBooks ?? []).some((b) => b.id === bookId) && !(listTodayBody.dailyBooks ?? []).some((b) => b.id === otherBookId), "GET /daily-book?date= só traz os livros daquela data");

    // 3 · pattern-diff vazio quando hoje é igual ao padrão.
    const cleanDiff = await asAdmin(`/daily-book/${bookId}/pattern-diff`);
    const cleanDiffBody = await cleanDiff.json() as { diffs?: unknown[] };
    assert(cleanDiff.status === 200 && (cleanDiffBody.diffs ?? []).length === 0, "pattern-diff vazio logo após gerar (hoje == padrão)");

    // 4 · Tirar a posição do dia aparece no pattern-diff como "fora do dia".
    const positions = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, bookId));
    const positionId = positions[0]!.id;
    const removePos = await asAdmin(`/daily-book/${bookId}/positions/${positionId}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: (await readBook(bookId)).version }) });
    assert(removePos.status === 200, "tirar a posição do dia sucede");
    const dirtyDiff = await asAdmin(`/daily-book/${bookId}/pattern-diff`);
    const dirtyDiffBody = await dirtyDiff.json() as { diffs?: { hoje: string; why: string }[] };
    assert((dirtyDiffBody.diffs ?? []).some((d) => d.hoje === "fora do dia" && d.why.includes("Posição removida")), "pattern-diff mostra a posição removida como diferença de hoje, com o motivo");

    // 5 · Restaurar a posição some do diff de novo.
    const restorePos = await asAdmin(`/daily-book/${bookId}/positions/${positionId}/restore`, { method: "PATCH", body: JSON.stringify({ expectedVersion: (await readBook(bookId)).version }) });
    const restoredDiff = await asAdmin(`/daily-book/${bookId}/pattern-diff`);
    const restoredDiffBody = await restoredDiff.json() as { diffs?: unknown[] };
    assert(restorePos.status === 200 && (restoredDiffBody.diffs ?? []).length === 0, "restaurar a posição volta o pattern-diff a vazio");

    // 6 · Reabrir: recusado se o Livro não está fechado.
    const reopenDraft = await asAdmin(`/daily-book/${bookId}/reopen`, { method: "POST", body: JSON.stringify({ reason: "teste", expectedVersion: (await readBook(bookId)).version }) });
    assert(reopenDraft.status === 409, "reabrir um Livro em DRAFT é recusado — não está fechado");

    // 7 · Reabrir: motivo obrigatório.
    await db.update(dailyBooksTable).set({ status: "CANCELLED", cancelledAt: new Date(), cancelledBy: admin!.id }).where(eq(dailyBooksTable.id, bookId));
    const reopenNoReason = await asAdmin(`/daily-book/${bookId}/reopen`, { method: "POST", body: JSON.stringify({ expectedVersion: (await readBook(bookId)).version }) });
    assert(reopenNoReason.status === 400, "reabrir sem motivo é recusado");

    // 8 · Reabrir: exclusivo da Administração — supervisor não pode, mesmo sendo gestor da operação.
    const reopenAsSup = await asSup(`/daily-book/${bookId}/reopen`, { method: "POST", body: JSON.stringify({ reason: "tentativa de supervisor", expectedVersion: (await readBook(bookId)).version }) });
    assert(reopenAsSup.status === 403, "supervisor não pode reabrir — é exclusivo da Administração");
    assert((await readBook(bookId)).status === "CANCELLED", "tentativa recusada não mudou o status");

    // 9 · Reabrir com motivo, como Administração: volta a DRAFT, limpa as marcas de fechamento, fica registrado quem reabriu.
    const beforeReopenVersion = (await readBook(bookId)).version;
    const reopened = await asAdmin(`/daily-book/${bookId}/reopen`, { method: "POST", body: JSON.stringify({ reason: "Reaberto para corrigir a formação", expectedVersion: beforeReopenVersion }) });
    const reopenedBody = await reopened.json() as { dailyBook?: { status: string; cancelledAt: string | null; cancelledBy: string | null; version: number } };
    assert(reopened.status === 200 && reopenedBody.dailyBook?.status === "DRAFT" && !reopenedBody.dailyBook?.cancelledAt && !reopenedBody.dailyBook?.cancelledBy, "reabrir com motivo, como Administração, volta o Livro a DRAFT e limpa as marcas de cancelamento");
    const reopenEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "reopen")));
    assert(reopenEvents.length === 1 && (reopenEvents[0]!.afterState as { reason?: string } | null)?.reason === "Reaberto para corrigir a formação", "reabrir grava Registro com o motivo e quem reabriu (actorId)");
    assert(reopenEvents[0]!.actorId === admin!.id, "o Registro guarda quem reabriu");

    // 10 · Reabrir de novo é recusado (já está em DRAFT).
    const reopenAgain = await asAdmin(`/daily-book/${bookId}/reopen`, { method: "POST", body: JSON.stringify({ reason: "de novo", expectedVersion: (await readBook(bookId)).version }) });
    assert(reopenAgain.status === 409, "reabrir um Livro que já está em DRAFT é recusado");

    // 11 · Biblioteca de formações por show: vazia antes de salvar, cresce com o que foi salvo.
    const emptyLib = await asAdmin(`/formations/by-show/${showBook!.id}`);
    const emptyLibBody = await emptyLib.json() as { formations?: unknown[] };
    assert(emptyLib.status === 200 && (emptyLibBody.formations ?? []).length === 0, "biblioteca do show começa vazia");
    const saveFromScene = await asAdmin("/formations/from-scene", { method: "POST", body: JSON.stringify({ sceneId: scene!.id, name: `${tag}_formacao`, showId: showBook!.id }) });
    const savedFormation = await saveFromScene.json() as { formation?: { id: string; peopleCount: number } };
    assert(saveFromScene.status === 201 && savedFormation.formation?.peopleCount === 1, "salvar formação da cena com 1 papel captura peopleCount=1");
    const byShow = await asAdmin(`/formations/by-show/${showBook!.id}`);
    const byShowBody = await byShow.json() as { formations?: { id: string; name: string }[] };
    assert(byShow.status === 200 && (byShowBody.formations ?? []).some((f) => f.id === savedFormation.formation?.id), "GET /formations/by-show lista a formação recém-salva deste show");
    const byPeopleCountScoped = await asAdmin(`/formations?peopleCount=1&showId=${showBook!.id}`);
    const byPeopleCountBody = await byPeopleCountScoped.json() as { formations?: { id: string }[] };
    assert(byPeopleCountScoped.status === 200 && (byPeopleCountBody.formations ?? []).some((f) => f.id === savedFormation.formation?.id), "GET /formations?peopleCount&showId escopa a busca por show");

    // 12 · Aplicar formação "só hoje": muda a instância do Livro do Dia, nunca o Livro do Show.
    const bookBefore = await (await asAdmin(`/daily-book/${bookId}`)).json() as { dailyBook?: { scenes?: { id: string; sourceSceneId: string | null }[] } };
    const dailyBookSceneId = bookBefore.dailyBook?.scenes?.find((s) => s.sourceSceneId === scene!.id)?.id;
    assert(Boolean(dailyBookSceneId), "existe uma cena do Livro do Dia com sourceSceneId apontando para a cena do Livro do Show");
    const patternRolesBefore = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.blockId, block!.id));
    const applyToday = await asAdmin(`/daily-book/${bookId}/scenes/${dailyBookSceneId}/apply-formation`, { method: "POST", body: JSON.stringify({ formationId: savedFormation.formation!.id, expectedVersion: (await readBook(bookId)).version }) });
    const applyTodayBody = await applyToday.json() as { scenes?: { id: string; blocks: { positions: { name: string; isRemoved: boolean; assignments: { status: string; userId: string | null }[] }[] }[] }[]; positionsCreated?: number; positionsKept?: number };
    assert(applyToday.status === 200 && applyTodayBody.positionsKept === 1 && applyTodayBody.positionsCreated === 0, "aplicar a formação com o mesmo slot mantém a posição (1 mantida, 0 criada)");
    const appliedScene = applyTodayBody.scenes?.find((s) => s.id === dailyBookSceneId);
    const allPositions = appliedScene?.blocks.flatMap((b) => b.positions) ?? [];
    const livePositions = allPositions.filter((p) => !p.isRemoved);
    assert(livePositions.length === 1 && allPositions.length === 1, "a posição de mesmo código continua a mesma — nada removido, nada duplicado");
    assert(livePositions[0]!.assignments.some((a) => a.userId === memberA!.id && a.status !== "REMOVED"), "quem estava escalado no slot continua nele depois de aplicar");
    const patternRolesAfter = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.blockId, block!.id));
    assert(JSON.stringify(patternRolesBefore.map((r) => r.id).sort()) === JSON.stringify(patternRolesAfter.map((r) => r.id).sort()), "o Livro do Show (padrão) não foi tocado — só a instância do dia mudou");
    const [formationAfterApply] = await db.select().from(formationsTable).where(eq(formationsTable.id, savedFormation.formation!.id));
    assert(formationAfterApply?.timesUsed === 1 && formationAfterApply.lastUsedAt !== null, "aplicar só hoje também conta como uso da formação");
    const applyEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "formation_applied_today")));
    assert(applyEvents.length === 1, "aplicar só hoje grava Registro na instância do Livro do Dia");

    // 13 · formationId inválido é recusado.
    const applyMissing = await asAdmin(`/daily-book/${bookId}/scenes/${dailyBookSceneId}/apply-formation`, { method: "POST", body: JSON.stringify({ formationId: "00000000-0000-0000-0000-000000000000", expectedVersion: (await readBook(bookId)).version }) });
    assert(applyMissing.status === 404, "formationId inexistente é recusado com 404");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const actors = [admin!.id, supervisor!.id, memberA!.id];
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, actors), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(formationsTable).where(eq(formationsTable.showId, showIds[0]!));
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
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, actors));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em reopen / pattern-diff / filtros`);
  process.stdout.write(`daily-book-reopen-and-diff: ${passed} asserts passed\n`);
}

process.stdout.write("daily-book-reopen-and-diff: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
