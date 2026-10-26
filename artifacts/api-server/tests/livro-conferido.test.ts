/**
 * O "Conferido" saiu do app (26/10/2026): as rotas de conferir não existem mais e nenhuma resposta traz marca de conferência. O cartão
 * dos Livros do dia continua servindo à janela de publicar (vagas sem ninguém, resumo, novidades), com o mesmo recorte de quem vê.
 * Contra PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable,
  dailyBookScenesTable, dailyBooksTable, db, historyEventsTable, locationsTable, operationalChangesTable, operationsTable,
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

type Cartao = { id: string; conferido?: unknown; conferidoPor?: unknown; conferenciaCaiu?: unknown; podeConferir?: unknown; vagas: number; vagasSemPessoa: number; responsavel: { id: string } | null };

async function run() {
  const tag = `conferido_${Date.now()}`;
  const date = "2026-09-27";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [area, areaOutra] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_patinacao` }, { organizationId: org!.id, name: `${tag}_danca` }]).returning();
  const pessoa = async (nome: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}`, areaId }).returning())[0]!;
  const admin = await pessoa("admin", null);
  const direcao = await pessoa("direcao", null);
  const resp = await pessoa("resp", area!.id);
  const outra = await pessoa("outra", area!.id);
  const a1 = await pessoa("a1", area!.id), a2 = await pessoa("a2", area!.id), elenco = await pessoa("elenco", area!.id);
  const todos = [admin, direcao, resp, outra, a1, a2, elenco].map((p) => p.id);

  let server: http.Server | null = null;
  const showIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: direcao.id, operationId: operation!.id, role: "DIR", active: true },
      { userId: resp.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: outra.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      ...[a1, a2, elenco].map((p) => ({ userId: p.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(areaLocalSupervisorsTable).values([
      { areaId: area!.id, locationId: local!.id, supervisorId: resp.id }, { areaId: areaOutra!.id, locationId: local!.id, supervisorId: outra.id },
    ]);
    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_show`, createdBy: admin.id, responsibleId: resp.id }).returning();
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
    const asAdmin = requestAs(token(admin, "ADMIN")), asDir = requestAs(token(direcao, "DIR")), asResp = requestAs(token(resp, "SUPERVISOR_A"));
    const asOutra = requestAs(token(outra, "SUPERVISOR_A")), asElenco = requestAs(token(elenco, "MEMBER"));
    const readBook = async (id: string) => (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!;

    const gen = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date }) });
    const bookId = ((await gen.json()) as { dailyBook?: { id: string } }).dailyBook!.id;
    const [posicao] = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, bookId));
    const [alocacao] = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.positionId, posicao!.id));
    const cartoes = async (as: ReturnType<typeof requestAs>) => ((await (await as(`/daily-book/cartoes?locationId=${local!.id}&date=${date}`)).json()) as { cartoes: Cartao[] }).cartoes;
    const trocar = async (as: ReturnType<typeof requestAs>, userId: string | null) =>
      (await as(`/daily-book/${bookId}/assignments/${alocacao!.id}`, { method: "PATCH", body: JSON.stringify({ userId, expectedVersion: (await readBook(bookId)).version }) })).status;

    // 1 · Quem vê o cartão: Administração, Direção (só lê) e o responsável; a outra Supervisão e o Elenco não.
    const doResp = await cartoes(asResp);
    assert(gen.status === 201 && doResp.length === 1 && doResp[0]!.id === bookId, "o responsável vê o cartão do Livro do dia");
    assert(doResp[0]!.vagas === 1 && doResp[0]!.vagasSemPessoa === 0, "o cartão diz 1 vaga preenchida");
    assert((await cartoes(asAdmin)).length === 1, "a Administração vê o cartão");
    assert((await cartoes(asDir)).length === 1, "a Direção vê o cartão (só lê)");
    assert((await cartoes(asOutra)).length === 0, "com responsável definido, a outra Supervisão não vê o cartão");
    assert((await cartoes(asElenco)).length === 0, "o Elenco não vê cartão");
    const semLocal = await asResp(`/daily-book/cartoes?date=${date}`);
    assert(semLocal.status === 400, "sem o local, o pedido responde 400 com frase");

    // 2 · Sem "Conferido": nem o cartão nem o Livro trazem marca de conferência, e as rotas antigas não existem.
    assert(!("conferido" in doResp[0]!) && !("conferenciaCaiu" in doResp[0]!) && !("podeConferir" in doResp[0]!), "o cartão não traz mais marca de conferência");
    const detalhe = await (await asAdmin(`/daily-book/${bookId}`)).json() as { dailyBook: Record<string, unknown> };
    assert(!("conferencia" in detalhe.dailyBook) && !("conferredFingerprint" in detalhe.dailyBook) && !("conferredBy" in detalhe.dailyBook), "o Livro não devolve conferência nem o retrato interno");
    for (const [nome, as] of [["a Administração", asAdmin], ["o responsável", asResp]] as const) {
      const marcar = await as(`/daily-book/${bookId}/conferir`, { method: "POST" });
      const tirar = await as(`/daily-book/${bookId}/conferir`, { method: "DELETE" });
      assert(marcar.status === 404 && tirar.status === 404, `${nome} não encontra mais as rotas de conferir (404)`);
    }
    const eventos = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "conferido")));
    assert(eventos.length === 0, "nada de conferido no Registro");

    // 3 · Trocar a pessoa de um papel segue funcionando para quem opera o Livro (antes carregava o retrato da conferência).
    assert((await trocar(asAdmin, a2.id)) === 200, "a Administração troca a pessoa do papel");
    assert((await trocar(asResp, a1.id)) === 200, "o responsável troca a pessoa do papel");
    assert((await trocar(asOutra, a2.id)) === 403, "a outra Supervisão continua sem poder trocar (403)");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
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
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(areasTable).where(and(eq(areasTable.organizationId, org!.id)));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na conferência do Livro do Dia`);
  process.stdout.write(`livro-conferido: ${passed} asserts passed\n`);
}

process.stdout.write("livro-conferido: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
