/**
 * O Livro do Dia é uma cópia do Livro do Show tirada quando o dia é gerado. O que o show ganha depois (cena, grupo, posição) chega ao dia só
 * por "trazer as novidades": acrescenta o que falta sem refazer o dia (troca à mão, posição tirada e conferência ficam). Também confere que
 * "Conferido" de um show não vale para os outros do mesmo dia. PostgreSQL real de teste.
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

type Posicao = { name: string; isRemoved: boolean; assignments: { userId: string | null; status: string; manual: boolean }[] };
type Livro = { version: number; status: string; novidadesDoShow: { cenas: number; grupos: number; posicoes: number } | null; scenes: { name: string; isRemoved: boolean; blocks: { isRemoved: boolean; positions: Posicao[] }[] }[] };
type Cartao = { id: string; showTitle: string; vagasSemPessoa: number; novidadesDoShow: { posicoes: number } | null; resumo: { nome: string; posicoes: { nome: string; pessoas: string[]; vazias: number }[] }[] };

async function run() {
  const tag = `sincronizar_${Date.now()}`;
  const date = "2026-09-28";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [area, areaOutra] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_patinacao` }, { organizationId: org!.id, name: `${tag}_danca` }]).returning();
  const pessoa = async (nome: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}`, areaId }).returning())[0]!;
  const admin = await pessoa("admin", null), resp = await pessoa("resp", area!.id), outra = await pessoa("outra", areaOutra!.id);
  const a1 = await pessoa("a1", area!.id), a2 = await pessoa("a2", area!.id), elenco = await pessoa("elenco", area!.id);
  const todos = [admin, resp, outra, a1, a2, elenco].map((p) => p.id);

  let server: http.Server | null = null;
  const showIds: string[] = [];
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: resp.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: outra.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      ...[a1, a2, elenco].map((p) => ({ userId: p.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(areaLocalSupervisorsTable).values([
      { areaId: area!.id, locationId: local!.id, supervisorId: resp.id }, { areaId: areaOutra!.id, locationId: local!.id, supervisorId: outra.id },
    ]);
    const novoShow = async (titulo: string) => {
      const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_${titulo}`, createdBy: admin.id, responsibleId: resp.id }).returning();
      showIds.push(show!.id);
      const [cena] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: `${titulo}_cena1`, order: 0 }).returning();
      const [grupo] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: cena!.id, name: `${titulo}_grupo1`, order: 0 }).returning();
      const [papel] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: grupo!.id, name: `${titulo}_papel1`, order: 0 }).returning();
      await db.insert(showBookLinesTable).values({ positionId: papel!.id, type: "FIXED_PERSON", config: { userId: a1.id }, order: 0 });
      return { show: show!, cena: cena!, grupo: grupo!, papel: papel! };
    };
    const s1 = await novoShow("patinacao"), s2 = await novoShow("musical");

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role: role as "ADMIN", operationIds: [operation!.id] });
    const requestAs = (tk: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${tk}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(token(admin, "ADMIN")), asResp = requestAs(token(resp, "SUPERVISOR_A")), asOutra = requestAs(token(outra, "SUPERVISOR_A")), asElenco = requestAs(token(elenco, "MEMBER"));

    const gerar = async (showBookId: string) => ((await (await asAdmin("/daily-book/generate", { method: "POST", body: JSON.stringify({ showBookId, date }) })).json()) as { dailyBook: { id: string } }).dailyBook.id;
    const id1 = await gerar(s1.show.id), id2 = await gerar(s2.show.id);
    const livro = async (id: string) => ((await (await asAdmin(`/daily-book/${id}`)).json()) as { dailyBook: Livro }).dailyBook;
    const posicoesDoDia = (l: Livro) => l.scenes.flatMap((c) => c.blocks.flatMap((g) => g.positions));
    const nomes = (l: Livro) => posicoesDoDia(l).filter((p) => !p.isRemoved).map((p) => p.name).sort();
    const cartoes = async () => ((await (await asAdmin(`/daily-book/cartoes?locationId=${local!.id}&date=${date}`)).json()) as { cartoes: Cartao[] }).cartoes;

    // ── o dia nasce igual ao show, sem novidades ──
    let d1 = await livro(id1);
    assert(nomes(d1).length === 1 && d1.novidadesDoShow?.posicoes === 0 && d1.novidadesDoShow?.cenas === 0, "o dia nasce igual ao Livro do Show, sem novidades");

    // ── o show ganha cena, grupo e posições depois; o dia ainda não sabe ──
    const [cena2] = await db.insert(showBookScenesTable).values({ showBookId: s1.show.id, name: "cena_nova", order: 1 }).returning();
    const [grupo2] = await db.insert(showBookBlocksTable).values({ showBookId: s1.show.id, sceneId: cena2!.id, name: "grupo_novo", order: 1 }).returning();
    await db.insert(showBookRolesTable).values([
      { showBookId: s1.show.id, blockId: grupo2!.id, name: "papel_novo_a", order: 1 },
      { showBookId: s1.show.id, blockId: grupo2!.id, name: "papel_novo_b", order: 2 },
      { showBookId: s1.show.id, blockId: s1.grupo.id, name: "papel_no_grupo_antigo", order: 3 },
    ]);
    d1 = await livro(id1);
    assert(d1.novidadesDoShow?.cenas === 1 && d1.novidadesDoShow?.grupos === 1 && d1.novidadesDoShow?.posicoes === 3, "o dia avisa o que o Livro do Show tem a mais (1 cena, 1 grupo, 3 posições)");
    assert((await cartoes()).find((c) => c.id === id1)?.novidadesDoShow?.posicoes === 3, "o cartão da Escala também sabe que o Livro está desatualizado");
    assert(nomes(d1).length === 1, "enquanto ninguém traz, o dia continua com a posição de antes");

    // ── uma troca à mão antes de trazer as novidades tem que sobreviver ──
    const antiga = posicoesDoDia(d1)[0]!;
    const alocacao = (await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id1)))[0]!;
    const troca = await asResp(`/daily-book/${id1}/assignments/${alocacao.id}`, { method: "PATCH", body: JSON.stringify({ userId: a2.id, expectedVersion: d1.version }) });
    assert(troca.status === 200 && antiga.name === "patinacao_papel1", "troca à mão feita antes de trazer as novidades");

    // ── quem pode trazer ──
    const versao = async () => (await livro(id1)).version;
    assert((await asElenco(`/daily-book/${id1}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: await versao() }) })).status === 403, "o Elenco não traz novidades");
    const outraTenta = await asOutra(`/daily-book/${id1}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: await versao() }) });
    assert(outraTenta.status === 403 && /responsável/.test(await outraTenta.text()), "a Supervisão que não é responsável recebe 403 dizendo que o show tem responsável");
    const semVersao = await asResp(`/daily-book/${id1}/sincronizar`, { method: "POST", body: JSON.stringify({}) });
    assert(semVersao.status === 428, "sem a versão que a pessoa tinha aberta, a API pede a versão (428)");

    // ── trazer as novidades ──
    const trouxe = await asResp(`/daily-book/${id1}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: await versao() }) });
    const trouxeCorpo = await trouxe.json() as { adicionou: { cenas: number; grupos: number; posicoes: number } };
    assert(trouxe.status === 200 && trouxeCorpo.adicionou.cenas === 1 && trouxeCorpo.adicionou.grupos === 1 && trouxeCorpo.adicionou.posicoes === 3, "o responsável traz a cena, o grupo e as 3 posições que faltavam");
    d1 = await livro(id1);
    assert(nomes(d1).join(",") === ["papel_no_grupo_antigo", "papel_novo_a", "papel_novo_b", "patinacao_papel1"].join(","), "o dia passa a ter todas as posições do show");
    assert(d1.scenes.some((c) => c.name === "cena_nova") && d1.novidadesDoShow?.posicoes === 0, "a cena nova chegou e o dia não tem mais novidades pendentes");
    const doDia = (nome: string) => posicoesDoDia(d1).find((p) => p.name === nome)!;
    assert(doDia("patinacao_papel1").assignments.some((a) => a.userId === a2.id && a.manual), "a troca feita à mão continua no lugar");
    assert(doDia("papel_novo_a").assignments.length >= 1 && doDia("papel_novo_a").assignments.every((a) => !a.userId && a.status === "OPEN"), "posição nova sem ninguém definido nasce como vaga aberta (para escolher quem faz)");
    const depois = await cartoes();
    const cartao1 = depois.find((c) => c.id === id1)!;
    assert(cartao1.vagasSemPessoa >= 3 && cartao1.novidadesDoShow?.posicoes === 0, "o cartão da Escala passa a mostrar as vagas abertas");
    assert(cartao1.resumo.some((c) => c.nome === "cena_nova" && c.posicoes.length === 2) && cartao1.resumo.some((c) => c.posicoes.some((p) => p.nome === "patinacao_papel1" && p.pessoas.length === 1)), "o cartão traz o resumo do Livro (cena, posição, quem faz) sem abrir o Livro");

    // ── repetir não duplica ──
    const repete = await asResp(`/daily-book/${id1}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: await versao() }) });
    const repeteCorpo = await repete.json() as { semNovidades?: boolean; adicionou: { posicoes: number } };
    assert(repete.status === 200 && repeteCorpo.semNovidades === true && repeteCorpo.adicionou.posicoes === 0, "trazer de novo, sem novidades, não muda nada");
    assert(nomes(await livro(id1)).length === 4, "e não duplica posição");

    // ── posição tirada do dia à mão não volta sozinha ──
    const novaB = posicoesDoDia(await livro(id1)).length;
    const dayPositionB = (await db.select().from(dailyBookPositionsTable).where(and(eq(dailyBookPositionsTable.dailyBookId, id1), eq(dailyBookPositionsTable.name, "papel_novo_b"))))[0]!;
    assert((await asResp(`/daily-book/${id1}/positions/${dayPositionB.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: await versao() }) })).status === 200, "a Supervisão tira uma posição do dia (restaurável)");
    await db.insert(showBookRolesTable).values({ showBookId: s1.show.id, blockId: grupo2!.id, name: "papel_mais_novo", order: 9 });
    const so = await asResp(`/daily-book/${id1}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: await versao() }) });
    const soCorpo = await so.json() as { adicionou: { posicoes: number } };
    d1 = await livro(id1);
    assert(soCorpo.adicionou.posicoes === 1 && posicoesDoDia(d1).length === novaB + 1 && posicoesDoDia(d1).find((p) => p.name === "papel_novo_b")?.isRemoved === true, "só entra o que é novo; a posição que o dia tinha tirado continua tirada");

    // ── dia executado é registro: não recebe novidades ──
    await db.update(dailyBooksTable).set({ status: "EXECUTED" }).where(eq(dailyBooksTable.id, id2));
    await db.insert(showBookRolesTable).values({ showBookId: s2.show.id, blockId: s2.grupo.id, name: "tarde_demais", order: 5 });
    assert((await asAdmin(`/daily-book/${id2}/sincronizar`, { method: "POST", body: JSON.stringify({ expectedVersion: (await livro(id2)).version }) })).status === 409, "dia já executado não recebe novidades (409 com frase)");

    // ── Registro ──
    const evento = (await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, id1), eq(historyEventsTable.action, "sincronizado")))).find((e) => /1 cena/.test(e.narrative ?? ""));
    assert(Boolean(evento) && /O que já estava no dia/.test(evento!.narrative ?? ""), "o Registro diz o que veio do Livro do Show e que o resto não mudou");
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
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em livro-sincronizar`);
  process.stdout.write(`livro-sincronizar: ${passed} asserts passed\n`);
}

process.stdout.write("livro-sincronizar: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
