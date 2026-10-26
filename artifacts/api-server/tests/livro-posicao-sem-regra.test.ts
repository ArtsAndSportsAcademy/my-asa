/**
 * Posição do Livro do Show que nasce sem ninguém para escalar sozinha (papel de "função", como Produção, ou personagem sem fila ainda)
 * tem que chegar ao Livro do Dia como VAGA ABERTA: é a vaga que a Escala lista e que a Supervisão preenche com "Escolher". Antes ela
 * nascia sem nenhuma linha de vaga: o Livro mostrava "sem ninguém", sem botão, e a Escala não a enxergava. Posição que "não atua neste
 * dia da semana" (linha de dia da semana inativa) continua sem vaga. PostgreSQL real de teste.
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

type Posicao = { name: string; sourceRoleId: string | null; isRemoved: boolean; assignments: { id: string; userId: string | null; status: string }[] };
type Livro = { version: number; novidadesDoShow: { cenas: number; grupos: number; posicoes: number } | null; scenes: { blocks: { positions: Posicao[] }[] }[] };

async function run() {
  const tag = `semregra_${Date.now()}`;
  const date = "2026-10-27"; // terça
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_area` }]).returning();
  const pessoa = async (nome: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}`, areaId }).returning())[0]!;
  const admin = await pessoa("admin", null), resp = await pessoa("resp", area!.id), a1 = await pessoa("a1", area!.id), prod = await pessoa("prod", area!.id);
  const todos = [admin, resp, a1, prod].map((p) => p.id);

  let server: http.Server | null = null;
  let showId = "";
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: resp.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      ...[a1, prod].map((p) => ({ userId: p.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(areaLocalSupervisorsTable).values([{ areaId: area!.id, locationId: local!.id, supervisorId: resp.id }]);
    const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_opening`, type: "CHARACTERS_ONLY", createdBy: admin.id, responsibleId: resp.id }).returning();
    showId = show!.id;
    const [cena] = await db.insert(showBookScenesTable).values({ showBookId: showId, name: "personagens", order: 0 }).returning();
    const [grupo] = await db.insert(showBookBlocksTable).values({ showBookId: showId, sceneId: cena!.id, name: "elenco", order: 0 }).returning();
    const papel = async (nome: string, order: number) => (await db.insert(showBookRolesTable).values({ showBookId: showId, blockId: grupo!.id, name: nome, order }).returning())[0]!;
    const mergulhador = await papel("MERGULHADOR", 0);
    await db.insert(showBookLinesTable).values({ positionId: mergulhador.id, type: "FIXED_PERSON", config: { userId: a1.id }, order: 0 });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role: role as "ADMIN", operationIds: [operation!.id] });
    const asAdmin = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token(admin, "ADMIN")}`, "content-type": "application/json", ...(init.headers ?? {}) } });

    // ── dia gerado ANTES de a Produção existir; depois o show ganha a posição (como no uso real) ──
    const gerado = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showId, date }) });
    const id = ((await gerado.json()) as { dailyBook: { id: string } }).dailyBook.id;
    const livro = async () => ((await (await asAdmin(`/daily-book/${id}`)).json()) as { dailyBook: Livro }).dailyBook;
    const posicoes = (l: Livro) => l.scenes.flatMap((c) => c.blocks.flatMap((g) => g.positions));
    const doDia = (l: Livro, nome: string) => posicoes(l).find((p) => p.name === nome);

    const producao = await papel("PRODUCAO", 1);
    await db.insert(showBookLinesTable).values({ positionId: producao.id, type: "FUNCTION", config: { functionLabel: "Produção" }, order: 0 });
    const semFila = await papel("PERSONAGEM_SEM_FILA", 2);
    await db.insert(showBookLinesTable).values({ positionId: semFila.id, type: "CHARACTER", config: { characterName: "Sem fila" }, order: 0 });
    const soNaQuarta = await papel("SO_NA_QUARTA", 3);
    await db.insert(showBookLinesTable).values({ positionId: soNaQuarta.id, type: "DAY_OF_WEEK", config: { dayAssignments: { "3": prod.id } }, order: 0 });
    const semNada = await papel("SEM_LINHA", 4);
    void semNada;

    let d = await livro();
    assert(d.novidadesDoShow?.posicoes === 4, `o dia avisa as 4 posições novas (veio ${d.novidadesDoShow?.posicoes})`);
    const sync = await asAdmin(`/daily-book/${id}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: d.version }) });
    assert(sync.status === 200, "trazer as novidades responde 200");
    d = await livro();
    assert(d.novidadesDoShow?.posicoes === 0, `depois de trazer, o aviso de novidades some (veio ${d.novidadesDoShow?.posicoes})`);
    const abertas = (nome: string) => doDia(d, nome)?.assignments.filter((a) => !a.userId && a.status === "OPEN").length ?? 0;
    assert(abertas("PRODUCAO") === 1, "Produção (função) chega como UMA vaga aberta, para escolher quem faz");
    assert(abertas("PERSONAGEM_SEM_FILA") === 1, "personagem sem fila chega como vaga aberta");
    assert(abertas("SEM_LINHA") === 1, "papel sem nenhuma linha chega como vaga aberta");
    assert((doDia(d, "SO_NA_QUARTA")?.assignments.length ?? 0) === 0, "papel que só atua na quarta não ganha vaga numa terça (continua sem vaga, de propósito)");

    // ── a Escala enxerga a vaga e dá para escolher ──
    const escala = await (await asAdmin(`/escalas/dia?locationId=${local!.id}&date=${date}`)).json() as { dia: { blocos: { dailyBookId: string | null; vagas?: { assignmentId: string; personagem: string; userId: string | null }[] }[] } };
    const bloco = escala.dia.blocos.find((b) => b.dailyBookId === id);
    const vagaProducao = bloco?.vagas?.find((v) => v.personagem === "PRODUCAO");
    assert(Boolean(vagaProducao) && vagaProducao!.userId === null, "a Escala do dia lista a vaga aberta de Produção");
    const vaga = doDia(d, "PRODUCAO")?.assignments[0];
    const escolhe = await asAdmin(`/daily-book/${id}/assignments/${vaga!.id}`, { method: "PATCH", body: JSON.stringify({ userId: prod.id, expectedVersion: d.version }) });
    assert(escolhe.status === 200, `escolher alguém para a Produção funciona (${escolhe.status})`);
    d = await livro();
    assert(doDia(d, "PRODUCAO")?.assignments.some((a) => a.userId === prod.id) === true, "a pessoa escolhida aparece na posição de Produção");
    const depois = await (await asAdmin(`/escalas/dia?locationId=${local!.id}&date=${date}`)).json() as { dia: { blocos: { dailyBookId: string | null; pessoaIds: string[] }[] } };
    assert(depois.dia.blocos.find((b) => b.dailyBookId === id)?.pessoaIds.includes(prod.id) === true, "e a pessoa passa a constar no bloco do show na Escala do dia");

    // ── geração normal (dia nascendo com a Produção já no show) dá o mesmo ──
    await db.update(dailyBooksTable).set({ status: "CANCELLED" }).where(eq(dailyBooksTable.id, id));
    const outroDia = "2026-10-28"; // quarta
    const g2 = await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId: showId, date: outroDia }) });
    const id2 = ((await g2.json()) as { dailyBook: { id: string } }).dailyBook.id;
    const l2 = ((await (await asAdmin(`/daily-book/${id2}`)).json()) as { dailyBook: Livro }).dailyBook;
    const nasceu = (nome: string) => doDia(l2, nome)?.assignments.filter((a) => !a.userId && a.status === "OPEN").length ?? 0;
    assert(nasceu("PRODUCAO") === 1 && nasceu("PERSONAGEM_SEM_FILA") === 1 && nasceu("SEM_LINHA") === 1, "gerar o dia já com essas posições também deixa uma vaga aberta em cada");
    assert(doDia(l2, "SO_NA_QUARTA")?.assignments.some((a) => a.userId === prod.id) === true, "e a posição da quarta recebe a pessoa na quarta");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    const books = showId ? await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, showId)) : [];
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    if (showId) {
      await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, showId));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showId));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((item) => item.id)));
      await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showId));
      await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showId));
      await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showId));
      await db.delete(showBooksTable).where(eq(showBooksTable.id, showId));
    }
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em livro-posicao-sem-regra`);
  process.stdout.write(`livro-posicao-sem-regra: ${passed} asserts passed\n`);
}

process.stdout.write("livro-posicao-sem-regra: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
