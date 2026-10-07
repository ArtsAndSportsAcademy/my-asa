/** Personagens e vagas por show (0059), contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  characterCastTable,
  charactersTable,
  db,
  historyEventsTable,
  locationsTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  pool,
  showBookBlocksTable,
  showBookLinesTable,
  showBookRolesTable,
  showBookScenesTable,
  showBookVersionsTable,
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

type ResolvedLine = { status: string; people: { userId: string }[]; note?: string };
type Resolution = { scenes: { name: string; blocks: { positions: { name: string; lines: ResolvedLine[] }[] }[] }[] };
type CharacterDto = { id: string; name: string; showBookId: string | null; shows: { id: string; title: string }[] };

async function run() {
  const tag = `vagas${Date.now()}`;
  const date = "2026-10-08";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, other] = await db.insert(locationsTable).values([
    { organizationId: org!.id, name: `${tag}_snow` },
    { organizationId: org!.id, name: `${tag}_outro` },
  ]).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: snow!.id });
  const users = await db.insert(usersTable).values(["admin", "m1", "m2", "m3", "m4"].map((key) => ({
    organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}${key}`,
  }))).returning();
  const [admin, m1, m2, m3, m4] = users;
  const userIds = users.map((user) => user!.id);
  let server: http.Server | null = null;
  const showIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      ...[m1, m2, m3, m4].map((member) => ({ userId: member!.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    const [teatro, musical, formacao] = await db.insert(showBooksTable).values([
      { operationId: operation!.id, locationId: snow!.id, title: `${tag}_Teatro`, type: "CHARACTERS_ONLY", createdBy: admin!.id },
      { operationId: operation!.id, locationId: snow!.id, title: `${tag}_Musical`, type: "CHARACTERS_ONLY", createdBy: admin!.id },
      { operationId: operation!.id, locationId: snow!.id, title: `${tag}_Formacao`, type: "SIMPLE", createdBy: admin!.id },
    ]).returning();
    showIds.push(teatro!.id, musical!.id, formacao!.id);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tokenOf = (userId: string, role: string) => signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] });
    const adminToken = tokenOf(admin!.id, "ADMIN");
    const request = (path: string, init: RequestInit = {}, token = adminToken) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const post = (path: string, body: unknown, token?: string) => request(path, { method: "POST", body: JSON.stringify(body) }, token);
    const versionOf = async (id: string) => (await db.select({ version: showBooksTable.version }).from(showBooksTable).where(eq(showBooksTable.id, id)))[0]!.version;

    // 1 · Vaga exclusiva: personagem do show, fila, cena reservada, Registro e versão nova.
    const v0 = await versionOf(teatro!.id);
    const p1 = await post(`/show-books/${teatro!.id}/vagas`, { name: "P1", mode: "rodizio", memberIds: [m1!.id, m2!.id] });
    const p1Body = await p1.json() as { position?: { id: string }; character?: { id: string; showBookId: string; mode: string } };
    assert(p1.status === 201 && p1Body.character?.showBookId === teatro!.id && p1Body.character.mode === "rodizio", "cria vaga exclusiva ligada ao show");
    const p1Cast = await db.select().from(characterCastTable).where(eq(characterCastTable.characterId, p1Body.character!.id)).orderBy(characterCastTable.order);
    assert(p1Cast.map((row) => row.personId).join() === [m1!.id, m2!.id].join(), "fila da vaga gravada na ordem enviada");
    const rosters = await db.select().from(showBookScenesTable).where(and(eq(showBookScenesTable.showBookId, teatro!.id), eq(showBookScenesTable.isCastRoster, true)));
    assert(rosters.length === 1, "cria uma única cena reservada de personagens");
    const [p1Line] = await db.select().from(showBookLinesTable).where(eq(showBookLinesTable.positionId, p1Body.position!.id));
    assert(p1Line?.type === "CHARACTER" && p1Line.characterId === p1Body.character!.id, "a vaga é uma posição com linha CHARACTER do personagem");
    const created = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, p1Body.position!.id), eq(historyEventsTable.action, "show_book.vaga.created")));
    assert(created.length === 1 && (await versionOf(teatro!.id)) === v0 + 1, "criar vaga entra no Registro e sobe a versão do show");

    const p2 = await post(`/show-books/${teatro!.id}/vagas`, { name: "P2", mode: "rodizio", memberIds: [m2!.id, m3!.id] });
    const p2Body = await p2.json() as { position?: { id: string } };
    assert(p2.status === 201, "segunda vaga no mesmo show reaproveita a cena reservada");
    assert((await db.select().from(showBookScenesTable).where(and(eq(showBookScenesTable.showBookId, teatro!.id), eq(showBookScenesTable.isCastRoster, true)))).length === 1, "continua uma só cena reservada");

    // 2 · Nome: único no show, livre em outro show do mesmo local.
    const dup = await post(`/show-books/${teatro!.id}/vagas`, { name: "P1", mode: "titular", memberIds: [m3!.id] });
    assert(dup.status === 409, "nome repetido no mesmo show é recusado (409)");
    const otherP1 = await post(`/show-books/${musical!.id}/vagas`, { name: "P1", mode: "titular", memberIds: [m3!.id] });
    assert(otherP1.status === 201, "o mesmo nome pode existir como vaga de outro show do local");

    // 3 · Validação e permissão.
    assert((await post(`/show-books/${teatro!.id}/vagas`, { name: "X", mode: "rodizio", memberIds: [] })).status === 400, "vaga sem fila é recusada");
    assert((await post(`/show-books/${teatro!.id}/vagas`, { name: "X", mode: "outro", memberIds: [m1!.id] })).status === 400, "tipo inválido é recusado");
    assert((await post(`/show-books/${teatro!.id}/scenes`, { name: "Entrada", order: 1 })).status === 400, "show só de personagens não aceita cena do mapa");
    assert((await post(`/show-books/${formacao!.id}/vagas`, { name: "X", mode: "rodizio", memberIds: [m1!.id] })).status === 400, "show de formação não recebe vaga");
    assert((await post(`/show-books/${teatro!.id}/vagas`, { name: "X", mode: "rodizio", memberIds: [m1!.id] }, tokenOf(m1!.id, "MEMBER"))).status === 403, "elenco não cria vaga (403)");

    // 4 · Compartilhado: criado na aba Personagens, entra nos dois shows; nunca em show de outro local.
    const astridRes = await post(`/characters`, { name: "Astrid", locationId: snow!.id, mode: "titular" });
    const astrid = (await astridRes.json() as { character: { id: string } }).character;
    for (const [order, member] of [m2, m4].entries()) await post(`/characters/${astrid.id}/cast`, { personId: member!.id, order, timesDone: 0 });
    const link1 = await post(`/show-books/${teatro!.id}/vagas`, { characterId: astrid.id });
    assert(link1.status === 201, "liga personagem compartilhado ao show");
    // Lê já: o limite de 60 s do pedido também vale para ler a resposta mais tarde.
    const astridPosition = (await link1.json() as { position: { id: string } }).position.id;
    assert((await post(`/show-books/${teatro!.id}/vagas`, { characterId: astrid.id })).status === 409, "o mesmo personagem não entra duas vezes no show");
    assert((await post(`/show-books/${musical!.id}/vagas`, { characterId: astrid.id })).status === 201, "o compartilhado entra em outro show do local");
    assert((await post(`/show-books/${musical!.id}/vagas`, { characterId: p1Body.character!.id })).status === 409, "vaga exclusiva de um show não entra em outro");
    const [foreign] = await db.insert(charactersTable).values({ name: `${tag}_fora`, locationId: other!.id, mode: "rodizio" }).returning();
    assert((await post(`/show-books/${teatro!.id}/vagas`, { characterId: foreign!.id })).status === 404, "personagem de outro local não entra no show");

    const listed = await (await request(`/characters?locationId=${snow!.id}`)).json() as { characters: CharacterDto[] };
    const astridDto = listed.characters.find((item) => item.id === astrid.id);
    const p1Dto = listed.characters.find((item) => item.id === p1Body.character!.id);
    assert(astridDto?.showBookId === null && astridDto.shows.map((show) => show.id).sort().join() === [teatro!.id, musical!.id].sort().join(), "GET /characters diz em quais shows o compartilhado está");
    assert(p1Dto?.showBookId === teatro!.id && p1Dto.shows.length === 1 && p1Dto.shows[0]!.id === teatro!.id, "vaga exclusiva aparece só no próprio show");
    const tree = await (await request(`/show-books/${teatro!.id}`)).json() as { showBook: { scenes: { isCastRoster: boolean; blocks: { positions: unknown[] }[] }[] } };
    assert(tree.showBook.scenes.filter((scene) => scene.isCastRoster).length === 1 && tree.showBook.scenes[0]!.blocks[0]!.positions.length === 3, "o Livro do Show traz a cena reservada com as 3 vagas");

    // 5 · Livro do Dia: rodízio pela contagem, titular pela ordem, sem repetir pessoa no show.
    await db.update(characterCastTable).set({ timesDone: 5 }).where(and(eq(characterCastTable.characterId, p1Body.character!.id), eq(characterCastTable.personId, m1!.id)));
    const resolved = await (await request(`/show-books/${teatro!.id}/resolve?date=${date}`)).json() as { resolution: Resolution };
    const roster = resolved.resolution.scenes.find((scene) => scene.blocks.some((block) => block.positions.some((position) => position.name === "P1")));
    const who = (name: string) => roster?.blocks.flatMap((block) => block.positions).find((position) => position.name === name)?.lines[0];
    const astridLine = who("Astrid");
    assert(astridLine?.status === "COVERED" && astridLine.people[0]?.userId === m2!.id && !astridLine.note, "titular tem prioridade: Astrid fica com m2 mesmo cadastrada depois de P1 e P2");
    assert(who("P1")?.people[0]?.userId === m1!.id, "P1 (rodízio) pula m2, já com a titular, e usa m1");
    assert(who("P2")?.people[0]?.userId === m3!.id, "P2 pula m2 e usa m3: ninguém repete no show");
    const rainha = await post(`/show-books/${musical!.id}/vagas`, { name: "Rainha", mode: "rodizio", memberIds: [m1!.id, m4!.id] });
    const rainhaId = (await rainha.json() as { character: { id: string } }).character.id;
    await db.update(characterCastTable).set({ timesDone: 3 }).where(and(eq(characterCastTable.characterId, rainhaId), eq(characterCastTable.personId, m1!.id)));
    const musicalResolved = await (await request(`/show-books/${musical!.id}/resolve?date=${date}`)).json() as { resolution: Resolution };
    const musicalWho = (name: string) => musicalResolved.resolution.scenes.flatMap((scene) => scene.blocks).flatMap((block) => block.positions).find((position) => position.name === name)?.lines[0];
    const musicalAstrid = musicalWho("Astrid");
    assert(musicalAstrid?.people[0]?.userId === m2!.id && !musicalAstrid.note, "titular livre fica com o primeiro da fila (m2)");
    assert(musicalWho("Rainha")?.people[0]?.userId === m4!.id, "rodízio escolhe quem fez menos (m4 com 0, m1 com 3)");
    assert(musicalWho("P1")?.people[0]?.userId === m3!.id, "titular exclusiva do Musical fica com a própria titular (m3)");
    // Duas titulares disputando a mesma pessoa: vale a ordem das vagas no show.
    assert((await post(`/show-books/${teatro!.id}/vagas`, { name: "Anterior", mode: "titular", memberIds: [m2!.id] })).status === 201, "cria segunda titular com a mesma pessoa");
    const busyTitular = (await (await request(`/show-books/${teatro!.id}/resolve?date=${date}`)).json() as { resolution: Resolution })
      .resolution.scenes.flatMap((scene) => scene.blocks).flatMap((block) => block.positions);
    const anterior = busyTitular.find((position) => position.name === "Anterior")?.lines[0];
    const astridDepois = busyTitular.find((position) => position.name === "Astrid")?.lines[0];
    assert(astridDepois?.people[0]?.userId === m2!.id && anterior?.people[0]?.userId === undefined && Boolean(anterior?.status === "UNCOVERED"), "entre duas titulares, vale a ordem das vagas: a primeira (Astrid) fica com m2; a outra fica descoberta");
    await db.update(characterCastTable).set({ timesDone: 9 }).where(and(eq(characterCastTable.characterId, astrid.id), eq(characterCastTable.personId, m2!.id)));
    const again = await (await request(`/show-books/${musical!.id}/resolve?date=${date}`)).json() as { resolution: Resolution };
    const againAstrid = again.resolution.scenes.flatMap((scene) => scene.blocks).flatMap((block) => block.positions).find((position) => position.name === "Astrid")?.lines[0];
    assert(againAstrid?.people[0]?.userId === m2!.id, "titular não troca por contagem");

    // 5b · Reordenar: a ordem decide quem fica com a pessoa entre duas titulares.
    const rosterIds = async () => (await db.select({ id: showBookRolesTable.id, name: showBookRolesTable.name }).from(showBookRolesTable)
      .innerJoin(showBookBlocksTable, eq(showBookRolesTable.blockId, showBookBlocksTable.id))
      .innerJoin(showBookScenesTable, eq(showBookBlocksTable.sceneId, showBookScenesTable.id))
      .where(and(eq(showBookRolesTable.showBookId, teatro!.id), eq(showBookRolesTable.active, true), eq(showBookScenesTable.isCastRoster, true)))
      .orderBy(showBookRolesTable.order, showBookRolesTable.id));
    const before = await rosterIds();
    assert(before.map((row) => row.name).join() === "P1,P2,Astrid,Anterior", "vagas saem na ordem em que foram criadas");
    const put = (ids: string[], token?: string) => request(`/show-books/${teatro!.id}/vagas/order`, { method: "PUT", body: JSON.stringify({ positionIds: ids }) }, token);
    const byName = (name: string) => before.find((row) => row.name === name)!.id;
    assert((await put([byName("P1"), byName("P2")])).status === 400, "reordenar sem todas as vagas é recusado");
    assert((await put([byName("Anterior"), byName("P1"), byName("P2"), byName("Astrid")], tokenOf(m1!.id, "MEMBER"))).status === 403, "elenco não reordena (403)");
    const v1 = await versionOf(teatro!.id);
    assert((await put([byName("Anterior"), byName("P1"), byName("P2"), byName("Astrid")])).status === 200, "reordena as vagas");
    assert((await rosterIds()).map((row) => row.name).join() === "Anterior,P1,P2,Astrid" && (await versionOf(teatro!.id)) === v1 + 1, "nova ordem gravada e versão nova");
    const reordered = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, teatro!.id), eq(historyEventsTable.action, "show_book.vaga.reordered")));
    assert(reordered.length === 1, "reordenar entra no Registro");
    const afterOrder = (await (await request(`/show-books/${teatro!.id}/resolve?date=${date}`)).json() as { resolution: Resolution })
      .resolution.scenes.flatMap((scene) => scene.blocks).flatMap((block) => block.positions);
    assert(afterOrder.find((p) => p.name === "Anterior")?.lines[0]?.people[0]?.userId === m2!.id && afterOrder.find((p) => p.name === "Astrid")?.lines[0]?.people[0]?.userId === m4!.id, "com Anterior primeiro, ela fica com m2 e a Astrid usa o substituto m4");
    assert((await put([byName("Anterior"), byName("P1"), byName("P2"), byName("Astrid")])).status === 200 && reordered.length === (await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, teatro!.id), eq(historyEventsTable.action, "show_book.vaga.reordered")))).length, "mesma ordem não grava nada");

    // 6 · Tirar do show: exclusiva é desativada; compartilhado continua no outro show.
    const removeP2 = await request(`/show-books/${teatro!.id}/vagas/${p2Body.position!.id}`, { method: "DELETE" });
    const p2Character = (await db.select({ characterId: showBookLinesTable.characterId }).from(showBookLinesTable).where(eq(showBookLinesTable.positionId, p2Body.position!.id)))[0]!.characterId!;
    const [p2After] = await db.select().from(charactersTable).where(eq(charactersTable.id, p2Character));
    assert(removeP2.status === 204 && p2After?.active === false, "tirar vaga exclusiva desativa o personagem dela");
    assert((await request(`/show-books/${teatro!.id}/vagas/${astridPosition}`, { method: "DELETE" })).status === 204, "tira o compartilhado do show");
    const [astridAfter] = await db.select().from(charactersTable).where(eq(charactersTable.id, astrid.id));
    const afterList = await (await request(`/characters?locationId=${snow!.id}`)).json() as { characters: CharacterDto[] };
    assert(astridAfter?.active === true && afterList.characters.find((item) => item.id === astrid.id)?.shows.map((show) => show.id).join() === musical!.id, "o compartilhado continua ativo e só no outro show");
    const removed = await db.select().from(historyEventsTable).where(and(inArray(historyEventsTable.entityId, [p2Body.position!.id, astridPosition]), eq(historyEventsTable.action, "show_book.vaga.removed")));
    assert(removed.length === 2, "tirar vaga entra no Registro");
    assert((await request(`/show-books/${teatro!.id}/vagas/${astridPosition}`, { method: "DELETE" })).status === 404, "tirar de novo a mesma vaga dá 404");
    const recreate = await post(`/show-books/${teatro!.id}/vagas`, { name: "P2", mode: "rodizio", memberIds: [m1!.id] });
    assert(recreate.status === 201, "depois de tirada, a vaga pode ser criada de novo com o mesmo nome");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query(`delete from history_events where actor_id = any($1::uuid[]) or mo_id in (select id from operational_changes where actor_id = any($1::uuid[]))`, [userIds]);
    await pool.query(`delete from operational_changes where actor_id = any($1::uuid[])`, [userIds]);
    if (showIds.length) {
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((role) => role.id)));
      await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, showIds));
      await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, showIds));
      await db.delete(showBookVersionsTable).where(inArray(showBookVersionsTable.showBookId, showIds));
    }
    const characters = await db.select({ id: charactersTable.id }).from(charactersTable).where(inArray(charactersTable.locationId, [snow!.id, other!.id]));
    if (characters.length) {
      await db.delete(characterCastTable).where(inArray(characterCastTable.characterId, characters.map((item) => item.id)));
      await db.delete(charactersTable).where(inArray(charactersTable.id, characters.map((item) => item.id)));
    }
    if (showIds.length) await db.delete(showBooksTable).where(inArray(showBooksTable.id, showIds));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, operation!.id));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, other!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
}

await (async () => {
  try {
    await run();
  } catch (err) {
    console.error("Erro inesperado nos testes:", err);
    failures.push(`erro inesperado: ${(err as Error)?.message ?? err}`);
  } finally {
    await pool.end();
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length) {
    console.log("FALHAS:");
    for (const failure of failures) console.log(` - ${failure}`);
    process.exit(1);
  }
})();
