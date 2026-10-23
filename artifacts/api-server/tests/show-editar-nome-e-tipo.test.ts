/**
 * Editar o show (23/10/2026): nome e tipo (completo, só formação, só personagens) pela rota PATCH /show-books/:id.
 * - nome vazio ou longo demais e tipo inventado são 400 com frase;
 * - o tipo novo não pode conviver com o que o show já tem: só personagens recusa show com cenas, só formação recusa show com vagas
 *   de personagem (409 com a frase do que tirar antes); a cena reservada dos personagens não conta como cena;
 * - quem não pode editar o show recebe 403; a mudança entra no Registro dizendo o que mudou. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  charactersTable, db, historyEventsTable, locationsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, securityAuditLogTable,
  showBookBlocksTable, showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable, showBookVersionsTable, userRolesTable, usersTable,
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
  const tag = `edt_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const mk = async (nome: string, role: "ADMIN" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}` }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role, active: true });
    return u!;
  };
  const adm = await mk("adm", "ADMIN"), elenco = await mk("elenco", "MEMBER");
  const todos = [adm.id, elenco.id];
  const [livro] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: adm.id, type: "COMPLETE" }).returning();
  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Abertura", order: 0 }).returning();
  const [roster] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Personagens do show", order: 1, isCastRoster: true }).returning();
  let personagem: { id: string } | undefined;

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [op!.id] });
      return async (body: Record<string, unknown>) => {
        const r = await fetch(`${base}/show-books/${livro!.id}`, { method: "PATCH", signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdm = as(adm, "ADMIN"), asElenco = as(elenco, "MEMBER");
    const atual = async () => (await db.select().from(showBooksTable).where(eq(showBooksTable.id, livro!.id)))[0]!;
    const razao = "Nome e tipo do show editados";

    assert((await asElenco({ title: "Outro nome", reason: razao })).status === 403, "Elenco não edita o show");
    assert((await asAdm({ title: "Sem motivo" })).status === 400, "sem motivo (reason) é recusado, como antes");
    const vazio = await asAdm({ title: "   ", reason: razao });
    assert(vazio.status === 400 && /não pode ficar vazio/.test(vazio.text), "nome vazio é 400 com frase");
    const longo = await asAdm({ title: "x".repeat(121), reason: razao });
    assert(longo.status === 400 && /120 letras/.test(longo.text), "nome longo demais é 400 com frase");
    const inventado = await asAdm({ type: "OUTRO", reason: razao });
    assert(inventado.status === 400 && /completo, só formação ou só personagens/.test(inventado.text), "tipo inventado é 400 com frase");
    assert((await atual()).title === `${tag}_Show` && (await atual()).type === "COMPLETE", "as recusas não mudaram nada");

    // ── renomear ──
    const novoNome = `${tag}_Show Natal`;
    const renomeia = await asAdm({ title: `  ${novoNome}  `, reason: razao });
    assert(renomeia.status === 200 && (await atual()).title === novoNome, "renomear grava o nome sem espaços nas pontas");
    const eventos = async () => (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, livro!.id))).filter((e) => e.action === "show_book.updated");
    assert((await eventos()).some((e) => /mudou nome de .* para ".*Show Natal"/.test(e.narrative ?? "")), "o Registro diz o nome antigo e o novo");

    // ── tipo: só formação (sem vagas de personagem) ──
    const formacao = await asAdm({ type: "SIMPLE", reason: razao });
    assert(formacao.status === 200 && (await atual()).type === "SIMPLE", "completo vira só formação quando não há vagas de personagem");
    assert((await eventos()).some((e) => /tipo de Completo para Só formação/.test(e.narrative ?? "")), "o Registro diz o tipo antigo e o novo");

    // ── tipo: só personagens recusa show com cena; a cena reservada não conta ──
    const recusaCena = await asAdm({ type: "CHARACTERS_ONLY", reason: razao });
    assert(recusaCena.status === 409 && /1 cena/.test(recusaCena.text) && /Tire as cenas/.test(recusaCena.text) && (await atual()).type === "SIMPLE", "show com cena não vira só personagens: 409 com a frase do que tirar");
    await db.update(showBookScenesTable).set({ active: false }).where(eq(showBookScenesTable.id, cena!.id));
    const soPersonagens = await asAdm({ type: "CHARACTERS_ONLY", reason: razao });
    assert(soPersonagens.status === 200 && (await atual()).type === "CHARACTERS_ONLY", "sem cenas (só a cena reservada dos personagens), vira só personagens");

    // ── voltar a completo e recusar só formação com vaga de personagem ──
    assert((await asAdm({ type: "COMPLETE", reason: razao })).status === 200 && (await atual()).type === "COMPLETE", "só personagens volta a completo");
    const [p] = await db.insert(charactersTable).values({ name: `${tag}_Astrid`, locationId: local!.id, mode: "titular" }).returning();
    personagem = p;
    const [bloco] = await db.insert(showBookBlocksTable).values({ showBookId: livro!.id, sceneId: roster!.id, name: "Vagas", order: 0 }).returning();
    const [vaga] = await db.insert(showBookRolesTable).values({ showBookId: livro!.id, blockId: bloco!.id, name: "Astrid", order: 0 }).returning();
    await db.insert(showBookLinesTable).values({ positionId: vaga!.id, characterId: p!.id, type: "CHARACTER", config: {}, order: 0 });
    const recusaVaga = await asAdm({ type: "SIMPLE", reason: razao });
    assert(recusaVaga.status === 409 && /1 vaga de personagem/.test(recusaVaga.text) && /Tire as vagas/.test(recusaVaga.text) && (await atual()).type === "COMPLETE", "show com vaga de personagem não vira só formação: 409 com a frase do que tirar");

    // mudar só o nome, sem mexer no tipo, continua funcionando num show com vagas
    assert((await asAdm({ title: `${tag}_Show Natal 2`, reason: razao })).status === 200, "renomear um show com vagas continua funcionando");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, livro!.id));
    if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, livro!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, livro!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, livro!.id));
    await db.delete(showBookVersionsTable).where(eq(showBookVersionsTable.showBookId, livro!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, livro!.id));
    if (personagem) await db.delete(charactersTable).where(eq(charactersTable.id, personagem.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em show-editar-nome-e-tipo`);
  process.stdout.write(`show-editar-nome-e-tipo: ${passed} asserts passed\n`);
}

process.stdout.write("show-editar-nome-e-tipo: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
