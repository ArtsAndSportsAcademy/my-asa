/** "Guardar no padrão" guarda a formação de hoje (já ajustada) e "Aplicar só hoje" leva as pessoas junto — contra PostgreSQL real de teste. */
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

type TreePosition = { id: string; name: string; isRemoved: boolean; assignments: { status: string; userId: string | null }[] };
type TreeScene = { id: string; sourceSceneId: string | null; blocks: { positions: TreePosition[] }[] };

async function run() {
  const tag = `formtoday_${Date.now()}`;
  const dayA = "2026-10-01";
  const dayB = "2026-10-02";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mkUser = async (suffix: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}` }).returning())[0]!;
  const admin = await mkUser("admin");
  const m1 = await mkUser("m1");
  const m2 = await mkUser("m2");
  const m3 = await mkUser("m3");
  const outsider = await mkUser("fora");

  let server: http.Server | null = null;
  const showIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      ...[m1, m2, m3, outsider].map((m) => ({ userId: m.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);

    // Livro do Show: cena com BL 01 (m1), BL 02 (m2) no bastidor esquerdo e BR 01 (m3) no direito.
    const [showBook] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: `${tag}_show`, createdBy: admin.id }).returning();
    showIds.push(showBook!.id);
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: showBook!.id, name: `${tag}_Molduras`, order: 0 }).returning();
    const [blockL] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
    const [blockR] = await db.insert(showBookBlocksTable).values({ showBookId: showBook!.id, sceneId: scene!.id, name: "Backstage right", zone: "BACKSTAGE RIGHT", order: 1 }).returning();
    const roleRows = await db.insert(showBookRolesTable).values([
      { showBookId: showBook!.id, blockId: blockL!.id, name: "BL 01", order: 0, positionJson: { side: "BL", coordinate: { x: 10, y: 10 } } },
      { showBookId: showBook!.id, blockId: blockL!.id, name: "BL 02", order: 1 },
      { showBookId: showBook!.id, blockId: blockR!.id, name: "BR 01", order: 0 },
    ]).returning();
    const roleByName = new Map(roleRows.map((r) => [r.name, r]));
    await db.insert(showBookLinesTable).values([
      { positionId: roleByName.get("BL 01")!.id, type: "FIXED_PERSON", config: { userId: m1.id }, order: 0 },
      { positionId: roleByName.get("BL 02")!.id, type: "FIXED_PERSON", config: { userId: m2.id }, order: 0 },
      { positionId: roleByName.get("BR 01")!.id, type: "FIXED_PERSON", config: { userId: m3.id }, order: 0 },
    ]);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tokenFor = (userId: string, role: string) => signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] });
    const requestAs = (token: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(tokenFor(admin.id, "ADMIN"));
    const asMember = requestAs(tokenFor(m1.id, "MEMBER"));
    const version = async (id: string) => (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, id)).limit(1))[0]!.version;
    const sceneOf = async (bookId: string) => {
      const body = await (await asAdmin(`/daily-book/${bookId}`)).json() as { dailyBook: { scenes: TreeScene[] } };
      return body.dailyBook.scenes.find((s) => s.sourceSceneId === scene!.id)!;
    };
    const positionsOf = (s: TreeScene) => s.blocks.flatMap((b) => b.positions);
    const liveBySlot = (s: TreeScene) => new Map(positionsOf(s).filter((p) => !p.isRemoved).map((p) => [p.name, p]));
    const peopleIn = (p: TreePosition | undefined) => (p?.assignments ?? []).filter((a) => a.status !== "REMOVED" && a.userId).map((a) => a.userId);

    const genA = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date: dayA }) });
    const bookA = ((await genA.json()) as { dailyBook: { id: string } }).dailyBook.id;
    const sceneA0 = await sceneOf(bookA);
    assert(genA.status === 201 && liveBySlot(sceneA0).size === 3, "Livro do Dia A nasce com as 3 posições do padrão");
    assert(peopleIn(liveBySlot(sceneA0).get("BL 02"))[0] === m2.id, "BL 02 nasce com m2 (quem o padrão escala)");

    // ---------- 1 · Guardar no padrão guarda a formação de HOJE ----------
    const bl02 = liveBySlot(sceneA0).get("BL 02")!;
    const removed = await asAdmin(`/daily-book/${bookA}/positions/${bl02.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: await version(bookA) }) });
    assert(removed.status === 200, "tirar BL 02 do dia A sucede");

    const noName = await asAdmin(`/daily-book/${bookA}/scenes/${sceneA0.id}/save-formation`, { method: "POST", body: JSON.stringify({ name: "  " }) });
    assert(noName.status === 400, "guardar sem nome é recusado");
    const asMemberSave = await asMember(`/daily-book/${bookA}/scenes/${sceneA0.id}/save-formation`, { method: "POST", body: JSON.stringify({ name: "tentativa" }) });
    assert(asMemberSave.status === 403, "Elenco não guarda formação");

    const bookVersionBeforeSave = await version(bookA);
    const rolesBefore = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBook!.id));
    const save = await asAdmin(`/daily-book/${bookA}/scenes/${sceneA0.id}/save-formation`, { method: "POST", body: JSON.stringify({ name: `${tag}_Molduras 2` }) });
    const saved = (await save.json() as { formation?: { id: string; peopleCount: number; sceneId: string; showId: string; positions: { role: string; side?: string; roleId?: string; coordinate?: unknown }[] } }).formation;
    assert(save.status === 201 && saved?.peopleCount === 2, "a formação guardada tem as 2 posições de hoje, não as 3 do Livro do Show");
    assert(JSON.stringify(saved?.positions.map((p) => p.role).sort()) === JSON.stringify(["BL 01", "BR 01"]), "a formação guarda os códigos de slot de hoje (BL 01, BR 01) — sem o BL 02 que saiu");
    assert(saved?.positions.find((p) => p.role === "BL 01")?.side === "BL" && saved?.positions.find((p) => p.role === "BR 01")?.side === "BR", "cada posição guarda o lado do palco, vindo do bloco de origem");
    assert(saved?.positions.find((p) => p.role === "BL 01")?.roleId === roleByName.get("BL 01")!.id, "cada posição guarda o papel de origem no Livro do Show");
    assert(JSON.stringify(saved?.positions.find((p) => p.role === "BL 01")?.coordinate) === JSON.stringify({ x: 10, y: 10 }), "coordenada do papel de origem vai junto");
    assert(saved?.sceneId === scene!.id && saved?.showId === showBook!.id, "entra na biblioteca daquela cena daquele show");
    const library = await (await asAdmin(`/formations/by-show/${showBook!.id}`)).json() as { formations: { id: string; sceneName: string | null }[] };
    assert(library.formations.some((f) => f.id === saved?.id && f.sceneName === scene!.name), "aparece na biblioteca do show, agrupável pela cena");
    const rolesAfter = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBook!.id));
    assert(rolesBefore.length === rolesAfter.length, "guardar não mexe no Livro do Show");
    assert(await version(bookA) === bookVersionBeforeSave, "guardar não mexe no Livro do Dia (versão igual)");
    const formationEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, saved!.id), eq(historyEventsTable.action, "formation.created")));
    assert(formationEvents.length === 1 && formationEvents[0]!.actorId === admin.id, "guardar grava Registro da formação com quem guardou");
    const dayEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookA), eq(historyEventsTable.action, "formation_saved_from_day")));
    assert(dayEvents.length === 1, "guardar grava Registro no Livro do Dia de origem");

    // ---------- 2 · Aplicar só hoje leva as pessoas junto ----------
    const genB = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showBook!.id, date: dayB }) });
    const bookB = ((await genB.json()) as { dailyBook: { id: string } }).dailyBook.id;
    const sceneB0 = await sceneOf(bookB);
    const idsBefore = new Map([...liveBySlot(sceneB0)].map(([slot, p]) => [slot, p.id]));
    const apply = await asAdmin(`/daily-book/${bookB}/scenes/${sceneB0.id}/apply-formation`, { method: "POST", body: JSON.stringify({ formationId: saved!.id, expectedVersion: await version(bookB) }) });
    const applyBody = await apply.json() as { positionsKept?: number; positionsCreated?: number; positionsRemoved?: number };
    assert(apply.status === 200 && applyBody.positionsKept === 2 && applyBody.positionsCreated === 0 && applyBody.positionsRemoved === 1, "aplicar a de 2 num dia com 3: 2 mantidas, 0 criadas, 1 sai do dia");
    const sceneB1 = await sceneOf(bookB);
    const liveB1 = liveBySlot(sceneB1);
    assert(peopleIn(liveB1.get("BL 01"))[0] === m1.id && peopleIn(liveB1.get("BR 01"))[0] === m3.id, "quem estava em BL 01 e BR 01 continua na mesma posição");
    assert(liveB1.get("BL 01")?.id === idsBefore.get("BL 01") && liveB1.get("BR 01")?.id === idsBefore.get("BR 01"), "é a mesma posição do dia, não uma cópia");
    const bl02B = positionsOf(sceneB1).find((p) => p.name === "BL 02");
    assert(Boolean(bl02B?.isRemoved) && (bl02B?.assignments ?? []).every((a) => a.status === "REMOVED"), "BL 02, que a formação não tem, sai do dia (soft-remove, reversível)");
    assert(!liveB1.has("BL 02") && liveB1.size === 2, "a cena fica com exatamente as 2 posições da formação");

    // Formação com um slot que não existe hoje: esse vira vaga, e ninguém é puxado para ele.
    const [mixed] = await db.insert(formationsTable).values({
      name: `${tag}_misto`, peopleCount: 2, showId: showBook!.id, sceneId: scene!.id, organizationId: org!.id, active: true,
      positions: [{ role: "BL 01", function: "BL 01", coordinate: null }, { role: "PER 09", function: "PER 09", coordinate: null }],
    }).returning();
    const apply2 = await asAdmin(`/daily-book/${bookB}/scenes/${sceneB0.id}/apply-formation`, { method: "POST", body: JSON.stringify({ formationId: mixed!.id, expectedVersion: await version(bookB) }) });
    const apply2Body = await apply2.json() as { positionsKept?: number; positionsCreated?: number; positionsRemoved?: number };
    assert(apply2.status === 200 && apply2Body.positionsKept === 1 && apply2Body.positionsCreated === 1 && apply2Body.positionsRemoved === 1, "formação com slot novo: 1 mantida, 1 vaga criada, 1 sai");
    const liveB2 = liveBySlot(await sceneOf(bookB));
    assert(peopleIn(liveB2.get("BL 01"))[0] === m1.id, "BL 01 continua com m1");
    const per09 = liveB2.get("PER 09");
    assert(Boolean(per09) && peopleIn(per09).length === 0 && per09!.assignments.every((a) => a.status === "OPEN"), "o slot sem correspondência nasce vago (OPEN, sem ninguém)");
    const everyone = [...liveB2.values()].flatMap(peopleIn);
    assert(!everyone.includes(outsider.id) && !everyone.includes(m2.id) && !everyone.includes(m3.id), "ninguém é escalado pela ação: m3 não é movido para a vaga, quem não estava no dia não entra");
    const applyEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookB), eq(historyEventsTable.action, "formation_applied_today")));
    assert(applyEvents.length === 2, "cada aplicação grava Registro no Livro do Dia");
    const [usage] = await db.select().from(formationsTable).where(eq(formationsTable.id, saved!.id));
    assert(usage?.timesUsed === 1 && usage.lastUsedAt !== null, "aplicar conta uso da formação");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const actors = [admin.id, m1.id, m2.id, m3.id, outsider.id];
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, actors), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    if (showIds.length) await db.delete(formationsTable).where(inArray(formationsTable.showId, showIds));
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
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em guardar/aplicar formação do dia`);
  process.stdout.write(`daily-book-formation-today: ${passed} asserts passed\n`);
}

process.stdout.write("daily-book-formation-today: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
