/** Nada é apagado fisicamente: regeneração do Livro do Dia, tags e referências da Biblioteca. PostgreSQL real de teste. */
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
  libraryDocumentsTable,
  operationalChangesTable,
  operationsTable,
  organizationsTable,
  pool,
  scheduleConflictsTable,
  showBookBlocksTable,
  showBookLinesTable,
  showBookPositionLibraryRefsTable,
  showBookRolesTable,
  showBookScenesTable,
  showBooksTable,
  showBookTagsTable,
  userRolesTable,
  userTagsTable,
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
  const tag = `logrm_${Date.now()}`;
  const date = "2026-09-27";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [memberA] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_a`, username: `${tag}_member_a` }).returning();

  let server: http.Server | null = null;
  let showBookId: string | null = null;
  let documentId: string | null = null;
  const tagIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: memberA!.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin!.id }).returning();
    showBookId = showBook!.id;
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId, name: `${tag}_scene`, order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId, sceneId: scene!.id, name: `${tag}_block`, order: 0 }).returning();
    const [role] = await db.insert(showBookRolesTable).values({ showBookId, blockId: block!.id, name: `${tag}_position`, order: 0 }).returning();
    await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "FIXED_PERSON", config: { userId: memberA!.id }, order: 0 });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const adminToken = signAccessToken({ sub: admin!.id, jti: `${tag}_admin`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const request = (path: string, init: RequestInit = {}, token = adminToken) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const version = async (id: string) => (await db.select({ v: dailyBooksTable.version }).from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!.v;
    const rowsOf = async (id: string) => ({
      scenes: await db.select().from(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id)),
      blocks: await db.select().from(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id)),
      positions: await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id)),
      assignments: await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id)),
    });

    // ── Livro do Dia: regenerar preserva a geração anterior ──────────────────
    const generated = await request("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId, date }) });
    const bookId = ((await generated.json()) as { dailyBook?: { id: string } }).dailyBook?.id ?? "";
    assert(generated.status === 201 && Boolean(bookId), "gera o Livro do Dia de referência");
    if (!bookId) throw new Error("geração falhou");
    const first = await rowsOf(bookId);
    const firstIds = [...first.scenes, ...first.blocks, ...first.positions, ...first.assignments].map((row) => row.id);
    const oldPosition = first.positions[0]!;

    // Supervisão remove a posição no rascunho (restaurável antes da regeneração).
    const removed = await request(`/daily-book/${bookId}/positions/${oldPosition.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    assert(removed.status === 200, "remover posição no rascunho continua lógico e responde 200");

    const regenerated = await request(`/daily-book/${bookId}/regenerate`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    assert(regenerated.status === 200, "regenerar o rascunho responde 200");
    const second = await rowsOf(bookId);
    const all = [...second.scenes, ...second.blocks, ...second.positions, ...second.assignments];
    assert(firstIds.every((id) => all.some((row) => row.id === id)), "nenhuma linha da geração anterior foi apagada");
    const oldRows = all.filter((row) => firstIds.includes(row.id));
    assert(oldRows.every((row) => row.supersededAt !== null), "todas as linhas da geração anterior ficam marcadas como substituídas");
    assert([...second.scenes, ...second.blocks, ...second.positions].filter((row) => firstIds.includes(row.id)).every((row) => row.isRemoved) && second.assignments.filter((row) => firstIds.includes(row.id)).every((row) => row.status === "REMOVED"), "linhas substituídas também ficam isRemoved / REMOVED");
    const live = await rowsOf(bookId).then((rows) => ({ positions: rows.positions.filter((row) => row.supersededAt === null), scenes: rows.scenes.filter((row) => row.supersededAt === null) }));
    assert(live.positions.length === 1 && live.scenes.length === 1 && !firstIds.includes(live.positions[0]!.id), "a geração atual tem exatamente uma cena e uma posição novas");

    const read = await request(`/daily-book/${bookId}`);
    const tree = ((await read.json()) as { dailyBook?: { scenes?: Array<{ id: string; blocks: Array<{ positions: Array<{ id: string; supersededAt?: unknown }> }> }> } }).dailyBook?.scenes ?? [];
    const treePositionIds = tree.flatMap((sceneNode) => sceneNode.blocks.flatMap((blockNode) => blockNode.positions.map((position) => position.id)));
    assert(read.status === 200 && tree.length === 1 && treePositionIds.length === 1 && !treePositionIds.includes(oldPosition.id), "a árvore lida mostra só a geração atual, sem duplicar");
    assert(!JSON.stringify(tree).includes("supersededAt"), "o marcador interno não vaza para a árvore nem muda o formato do snapshot");

    const restoreOld = await request(`/daily-book/${bookId}/positions/${oldPosition.id}/restore`, { method: "PATCH", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    const oldAfter = (await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.id, oldPosition.id)))[0]!;
    assert(restoreOld.status !== 200 && oldAfter.isRemoved && oldAfter.supersededAt !== null, "restaurar uma posição substituída é recusado e ela continua preservada");

    const supersededBefore = new Map(all.filter((row) => row.supersededAt !== null).map((row) => [row.id, String(row.supersededAt)]));
    const again = await request(`/daily-book/${bookId}/regenerate`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    const third = await rowsOf(bookId);
    const thirdAll = [...third.scenes, ...third.blocks, ...third.positions, ...third.assignments];
    assert(again.status === 200 && [...supersededBefore].every(([id, at]) => String(thirdAll.find((row) => row.id === id)?.supersededAt) === at), "nova regeneração não reescreve linhas já substituídas");
    assert(third.positions.filter((row) => row.supersededAt === null).length === 1, "após duas regenerações continua havendo uma única posição viva");

    // ── Tags: desativadas, nunca apagadas ────────────────────────────────────
    const createdTag = await request(`/operations/${operation!.id}/tags`, { method: "POST", body: JSON.stringify({ category: "ARTISTIC_SKILL", label: `${tag}_patins` }) });
    const tagBody = await createdTag.json() as { tag?: { id: string } };
    const tagId = tagBody.tag?.id ?? "";
    if (tagId) tagIds.push(tagId);
    assert(createdTag.status === 201 && Boolean(tagId), "cria tag de teste");
    const assigned = await request(`/users/${memberA!.id}/tags`, { method: "POST", body: JSON.stringify({ tagId }) });
    assert(assigned.status === 201, "atribui a tag à pessoa");
    const unassigned = await request(`/users/${memberA!.id}/tags/${tagId}`, { method: "DELETE" });
    const userTagRows = await db.select().from(userTagsTable).where(and(eq(userTagsTable.userId, memberA!.id), eq(userTagsTable.tagId, tagId)));
    const listedUserTags = ((await (await request(`/users/${memberA!.id}/tags`)).json()) as { tags: unknown[] }).tags;
    assert(unassigned.status === 204 && userTagRows.length === 1 && userTagRows[0]!.active === false && listedUserTags.length === 0, "retirar tag da pessoa desativa a linha e some da listagem");
    const userTagEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, memberA!.id), eq(historyEventsTable.action, "user_tag.deactivated")));
    assert(userTagEvents.length === 1, "retirar tag da pessoa grava Registro");
    const repeated = await request(`/users/${memberA!.id}/tags/${tagId}`, { method: "DELETE" });
    assert(repeated.status === 404, "retirar de novo a mesma tag responde 404 sem novo Registro");

    const wrongOperation = await request(`/operations/${crypto.randomUUID()}/tags/${tagId}`, { method: "DELETE" });
    assert(wrongOperation.status === 404, "desativar tag por outra operação é recusado");
    const deactivatedTag = await request(`/operations/${operation!.id}/tags/${tagId}`, { method: "DELETE" });
    const tagRow = (await db.select().from(showBookTagsTable).where(eq(showBookTagsTable.id, tagId)))[0];
    const listedTags = ((await (await request(`/operations/${operation!.id}/tags`)).json()) as { tags: Array<{ id: string }> }).tags;
    const tagEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, tagId), eq(historyEventsTable.action, "show_book_tag.deactivated")));
    assert(deactivatedTag.status === 204 && tagRow?.active === false && !listedTags.some((item) => item.id === tagId) && tagEvents.length === 1, "desativar tag preserva a linha, some da listagem e grava Registro");

    // ── Referência da Biblioteca por posição ─────────────────────────────────
    const [doc] = await db.insert(libraryDocumentsTable).values({ orgId: org!.id, type: "OPERATIONAL_PROCEDURE", title: `${tag}_doc`, status: "PUBLISHED", createdBy: admin!.id }).returning();
    documentId = doc!.id;
    const addedRef = await request(`/show-books/${showBookId}/positions/${role!.id}/refs`, { method: "POST", body: JSON.stringify({ documentId }) });
    const refId = ((await addedRef.json()) as { ref?: { id: string } }).ref?.id ?? "";
    assert(addedRef.status === 201 && Boolean(refId), "vincula documento à posição");
    const removedRef = await request(`/show-books/${showBookId}/positions/${role!.id}/refs/${refId}`, { method: "DELETE" });
    const refRow = (await db.select().from(showBookPositionLibraryRefsTable).where(eq(showBookPositionLibraryRefsTable.id, refId)))[0];
    const listedRefs = ((await (await request(`/show-books/${showBookId}/refs`)).json()) as { refs: Array<{ id: string }> }).refs;
    const refEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, role!.id), eq(historyEventsTable.action, "ref_removed")));
    const refAfter = refEvents[0]?.afterState as { active?: boolean } | null | undefined;
    assert(removedRef.status === 204 && refRow?.active === false && !listedRefs.some((item) => item.id === refId), "remover referência desativa a linha e some da listagem");
    assert(refEvents.length === 1 && refAfter?.active === false, "Registro da referência guarda o estado desativado");
    const removedAgain = await request(`/show-books/${showBookId}/positions/${role!.id}/refs/${refId}`, { method: "DELETE" });
    assert(removedAgain.status === 404, "remover referência já desativada responde 404");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    // Limpeza do banco de TESTE (fixtures deste arquivo), no mesmo padrão dos demais testes.
    const actors = [admin!.id, memberA!.id];
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, actors), changes.length ? inArray(historyEventsTable.moId, changes.map((change) => change.id)) : isNull(historyEventsTable.id)));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(scheduleConflictsTable).where(eq(scheduleConflictsTable.userId, memberA!.id));
    if (showBookId) {
      await db.delete(showBookPositionLibraryRefsTable).where(eq(showBookPositionLibraryRefsTable.showBookId, showBookId));
      const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, showBookId));
      for (const { id } of books) {
        await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
        await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
        await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
        await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
        await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
      }
      await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, showBookId));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((item) => item.id)));
      await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
      await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showBookId));
      await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showBookId));
      await db.delete(showBooksTable).where(eq(showBooksTable.id, showBookId));
    }
    if (documentId) await db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, documentId));
    await db.delete(userTagsTable).where(eq(userTagsTable.userId, memberA!.id));
    if (tagIds.length) await db.delete(showBookTagsTable).where(inArray(showBookTagsTable.id, tagIds));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, actors));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na desativação lógica`);
  process.stdout.write(`logical-removal: ${passed} asserts passed\n`);
}

process.stdout.write("logical-removal: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
