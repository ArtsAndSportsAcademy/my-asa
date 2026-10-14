/**
 * O Livro do Dia vivo (14/10): a vaga sem `manual=true` é recalculada na leitura com o mesmo
 * motor da geração — titular, depois rodízio, sem quem está de folga. `manual=true` é a exceção
 * do dia (gerência trocou à mão) e fica como está, com aviso se a pessoa entrar de folga depois,
 * sem desfazer sozinho. Publicado continua preservado para o Elenco até a republicação, e
 * executar grava de vez — nunca mais recalcula.
 *
 * Contra PostgreSQL real de teste, via HTTP (rota real), como os outros testes do Livro do Dia.
 */
import {
  db,
  pool,
  organizationsTable,
  operationsTable,
  usersTable,
  locationsTable,
  charactersTable,
  characterCastTable,
  rotationDailyAdvancesTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  folgasTable,
  scalesTable,
  agendaEventsTable,
  historyEventsTable,
  operationalChangesTable,
  dailyBooksTable,
  dailyBookScenesTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
  userRolesTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

type TreePosition = { id: string; name: string; assignments: { id: string; userId: string | null; userName: string | null; status: string; manual: boolean; alerta?: string }[] };
type TreeScene = { blocks: { positions: TreePosition[] }[] };

async function run() {
  const tag = `dbvivo_${Date.now()}`;
  const date = "2026-11-10";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mkUser = async (suffix: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}` }).returning())[0]!;
  const admin = await mkUser("admin");
  const m1 = await mkUser("m1"); // rodízio A, titular
  const m2 = await mkUser("m2"); // rodízio A, substituto
  const m3 = await mkUser("m3"); // rodízio B, titular
  const m4 = await mkUser("m4"); // rodízio B, trocado à mão

  let showId: string | null = null;
  let locationId: string | null = null;
  const charIds: string[] = [];
  const folgaIds: string[] = [];
  let server: ReturnType<typeof app.listen> | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      ...[m1, m2, m3, m4].map((m) => ({ userId: m.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);

    // Personagem de verdade (não só memberIds soltos): é como todo outro teste de rodízio já faz
    // — uma linha ROTATION sem characterId cai num caminho legado com bug conhecido e anterior a
    // esta mudança (tenta usar "legacy-line:<uuid>" como chave uuid na tabela de avanço do
    // rodízio); fora do escopo do Livro do Dia vivo, sinalizado à parte.
    const [location] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
    locationId = location!.id;
    const [charA] = await db.insert(charactersTable).values({ name: `${tag}_charA`, locationId: location!.id, mode: "rodizio" }).returning();
    const [charB] = await db.insert(charactersTable).values({ name: `${tag}_charB`, locationId: location!.id, mode: "rodizio" }).returning();
    charIds.push(charA!.id, charB!.id);
    await db.insert(characterCastTable).values([
      { characterId: charA!.id, personId: m1.id, order: 0, timesDone: 0 },
      { characterId: charA!.id, personId: m2.id, order: 1, timesDone: 0 },
      { characterId: charB!.id, personId: m3.id, order: 0, timesDone: 0 },
      { characterId: charB!.id, personId: m4.id, order: 1, timesDone: 0 },
    ]);

    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin.id }).returning();
    showId = showBook!.id;
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showId, name: "Cena", order: 0 }).returning();
    const [blockA] = await db.insert(showBookBlocksTable).values({ showBookId: showId, sceneId: scene!.id, name: "A", order: 0 }).returning();
    const [blockB] = await db.insert(showBookBlocksTable).values({ showBookId: showId, sceneId: scene!.id, name: "B", order: 1 }).returning();
    const [roleA] = await db.insert(showBookRolesTable).values({ showBookId: showId, blockId: blockA!.id, name: "Rodizio A", order: 0 }).returning();
    const [roleB] = await db.insert(showBookRolesTable).values({ showBookId: showId, blockId: blockB!.id, name: "Rodizio B", order: 0 }).returning();
    await db.insert(showBookLinesTable).values([
      { positionId: roleA!.id, characterId: charA!.id, type: "ROTATION" as any, config: { characterId: charA!.id, memberIds: [m1.id, m2.id] } as any, order: 0 },
      { positionId: roleB!.id, characterId: charB!.id, type: "ROTATION" as any, config: { characterId: charB!.id, memberIds: [m3.id, m4.id] } as any, order: 0 },
    ]);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/api`;
    const tokenFor = (userId: string, role: string) => signAccessToken({ sub: userId, jti: `${tag}_${userId}_${role}`, organizationId: org!.id, role, operationIds: [operation!.id] });
    const requestAs = (token: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(tokenFor(admin.id, "ADMIN"));
    const asMember = requestAs(tokenFor(m2.id, "MEMBER")); // m2 não é gestor: vê a versão preservada

    const addFolga = async (userId: string) => {
      const [f] = await db.insert(folgasTable).values({ userId, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, status: "ACTIVE", createdBy: admin.id }).returning();
      folgaIds.push(f!.id);
      return f!.id;
    };
    const clearFolga = async (id: string) => { await db.delete(folgasTable).where(eq(folgasTable.id, id)); folgaIds.splice(folgaIds.indexOf(id), 1); };

    const version = async (id: string) => (await db.select({ v: dailyBooksTable.version }).from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!.v;
    const getBook = async (requester = asAdmin) => {
      const r = await requester(`/daily-book/${bookId}`);
      const body = await r.json() as { dailyBook: { status: string; scenes: TreeScene[] } };
      return { status: r.status, scenes: body.dailyBook.scenes, bookStatus: body.dailyBook.status };
    };
    const posByName = (scenes: TreeScene[], name: string) => scenes.flatMap((s) => s.blocks.flatMap((b) => b.positions)).find((p) => p.name === name)!;
    const whoOf = (p: TreePosition) => p.assignments.filter((a) => a.status !== "REMOVED")[0];

    // 1 · Gerar: A → m1 (titular do rodízio, contagem zerada), B → m3.
    const gen = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showId, date }) });
    const genBody = await gen.json() as { dailyBook: { id: string } };
    assert(gen.status === 201, "gerar o Livro do Dia: 201");
    const bookId = genBody.dailyBook.id;

    const g0 = await getBook();
    assert(whoOf(posByName(g0.scenes, "Rodizio A")).userId === m1.id, "A nasce com m1 (vencedor do rodízio)");
    assert(whoOf(posByName(g0.scenes, "Rodizio A")).manual === false, "A nasce sem manual (vaga viva)");
    assert(whoOf(posByName(g0.scenes, "Rodizio B")).userId === m3.id, "B nasce com m3");

    // 2 · Folga de m1 DEPOIS de gerar: a leitura mostra m2 ao vivo, sem reescrever o banco.
    const folgaM1 = await addFolga(m1.id);
    const g1 = await getBook();
    const posA1 = posByName(g1.scenes, "Rodizio A");
    assert(whoOf(posA1).userId === m2.id, "folga de m1 depois de gerar: a leitura já mostra m2, sem precisar regenerar");
    const stored1 = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, whoOf(posA1).id)).limit(1);
    assert(stored1[0]!.userId === m1.id, "o banco continua com m1 — a troca é só na leitura, não escreve sozinha");

    // 3 · Troca à mão em B (m3 → m4): vira manual, e passa a ignorar o rodízio.
    const posB0 = posByName(g1.scenes, "Rodizio B");
    const swap = await asAdmin(`/daily-book/${bookId}/assignments/${whoOf(posB0).id}`, { method: "PATCH", body: JSON.stringify({ userId: m4.id, expectedVersion: await version(bookId) }) });
    assert(swap.status === 200, "trocar B à mão: 200");
    const storedB = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, whoOf(posB0).id)).limit(1);
    assert(storedB[0]!.manual === true && storedB[0]!.userId === m4.id, "a troca à mão grava manual=true e o novo userId");

    // 4 · Folga de m4 (quem está manual em B): a troca continua valendo, com aviso — não desfaz sozinho.
    const folgaM4 = await addFolga(m4.id);
    const g2 = await getBook();
    const posB1 = posByName(g2.scenes, "Rodizio B");
    assert(whoOf(posB1).userId === m4.id, "m4 de folga: a vaga manual continua com m4 (não desfaz sozinho)");
    assert(typeof whoOf(posB1).alerta === "string" && whoOf(posB1).alerta!.length > 0, "a vaga manual com a pessoa de folga ganha um aviso visível");
    assert(whoOf(posByName(g2.scenes, "Rodizio A")).userId === m2.id, "A, que não é manual, continua recalculando (m1 segue de folga)");

    // 5 · Folga de m1 some: A volta a m1 sozinho (acompanha nos dois sentidos).
    await clearFolga(folgaM1);
    const g3 = await getBook();
    assert(whoOf(posByName(g3.scenes, "Rodizio A")).userId === m1.id, "m1 disponível de novo: A volta para m1 sozinho, sem ninguém mexer");

    // 6 · Publicar (a Escala da operação precisa estar publicada antes).
    await clearFolga(folgaM4);
    await db.insert(scalesTable).values({ operationId: operation!.id, title: `${tag}_escala`, periodStart: date, periodEnd: date, status: "PUBLISHED", publishedAt: new Date(), createdBy: admin.id });
    const pub = await asAdmin(`/daily-book/${bookId}/publish`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    assert(pub.status === 200, "publicar: 200");

    const pAdmin = await getBook(asAdmin);
    const pMember = await getBook(asMember);
    assert(whoOf(posByName(pAdmin.scenes, "Rodizio A")).userId === m1.id && whoOf(posByName(pMember.scenes, "Rodizio A")).userId === m1.id, "logo após publicar, gestão e Elenco veem o mesmo (m1 em A) — publicar não troca o rodízio sozinho");

    // 7 · Drift depois de publicar: folga de m1. Gestão vê ao vivo; Elenco continua vendo a foto publicada.
    const folgaM1depois = await addFolga(m1.id);
    const afterPub = await getBook(asAdmin);
    const afterPubMember = await getBook(asMember);
    assert(whoOf(posByName(afterPub.scenes, "Rodizio A")).userId === m2.id, "gestão vê m2 ao vivo depois da folga de m1");
    assert(whoOf(posByName(afterPubMember.scenes, "Rodizio A")).userId === m1.id, "Elenco continua vendo m1 — a publicação preserva até a republicação");

    const delta = await asAdmin(`/daily-book/${bookId}/delta`);
    const deltaBody = await delta.json() as { hasLiveChanges: boolean };
    assert(deltaBody.hasLiveChanges === true, "o delta acusa mudança mesmo sem ninguém ter mexido à mão (só a folga)");

    // 8 · Republicar: a nova foto já é m2: agora o Elenco também vê m2.
    const rep = await asAdmin(`/daily-book/${bookId}/republish`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    assert(rep.status === 200, "republicar: 200");
    const postRep = await getBook(asMember);
    assert(whoOf(posByName(postRep.scenes, "Rodizio A")).userId === m2.id, "depois de republicar, o Elenco já vê m2");

    // 9 · Executar com A sem ninguém disponível (m1 e m2 de folga): grava OPEN de vez.
    const folgaM2 = await addFolga(m2.id);
    const exec = await asAdmin(`/daily-book/${bookId}/execute`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(bookId) }) });
    assert(exec.status === 200, "executar: 200");
    await clearFolga(folgaM1depois);
    await clearFolga(folgaM2);
    const afterExec = await getBook(asAdmin);
    assert(afterExec.bookStatus === "EXECUTED", "o livro fica EXECUTED");
    const posAExec = posByName(afterExec.scenes, "Rodizio A");
    assert(!whoOf(posAExec) || whoOf(posAExec).userId === null, "executado com ninguém disponível: grava a vaga aberta de vez");
    const storedExec = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.positionId, posAExec.id));
    assert(storedExec.every((a) => a.userId === null && a.status === "OPEN"), "o banco já grava a vaga aberta — não é só a leitura");
    const afterExecAgain = await getBook(asAdmin);
    assert(!whoOf(posByName(afterExecAgain.scenes, "Rodizio A"))?.userId, "mesmo com m1/m2 livres de novo, executado nunca mais recalcula");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    if (charIds.length) await db.delete(rotationDailyAdvancesTable).where(inArray(rotationDailyAdvancesTable.characterId, charIds));
    if (showId) {
      const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, showId));
      for (const { id } of books) {
        await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
        await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
        await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
        await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
        await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
      }
      await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, showId));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showId));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
      await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showId));
      await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showId));
      await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showId));
      await db.delete(showBooksTable).where(eq(showBooksTable.id, showId));
    }
    for (const id of folgaIds.splice(0)) await db.delete(folgasTable).where(eq(folgasTable.id, id));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (charIds.length) {
      await db.delete(characterCastTable).where(inArray(characterCastTable.characterId, charIds));
      await db.delete(charactersTable).where(inArray(charactersTable.id, charIds));
    }
    if (locationId) await db.delete(locationsTable).where(eq(locationsTable.id, locationId));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    const actors = [admin.id, m1.id, m2.id, m3.id, m4.id];
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, actors), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [actors]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [actors]).catch(() => undefined);
    await db.delete(usersTable).where(inArray(usersTable.id, actors));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no Livro do Dia vivo`);
  process.stdout.write(`daily-book-vivo: ${passed} asserts passed\n`);
}

process.stdout.write("daily-book-vivo: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
