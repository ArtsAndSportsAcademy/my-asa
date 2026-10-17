/**
 * Formato do palco do show (migração 0074): nasce "sem mapa", só quem edita o show muda, valor inválido é recusado e
 * o formato aparece no detalhe e na lista, para quem lê e para quem edita. Contra PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  db, historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable, operationsTable, organizationsTable, pool,
  showBookVersionsTable, showBooksTable, userRolesTable, usersTable,
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
  const tag = `palco_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id, active: true });
  const pessoa = async (nome: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}` }).returning())[0]!;
  const admin = await pessoa("admin"), membro = await pessoa("membro");
  const todos = [admin.id, membro.id];

  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: membro.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role: role as "ADMIN", operationIds: [operation!.id] });
    const requestAs = (tk: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${tk}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(token(admin, "ADMIN")), asMembro = requestAs(token(membro, "MEMBER"));
    const corpo = async (r: Response) => await r.json() as { showBook?: { id: string; stageFormat?: string }; message?: string };

    // 1 · Sem informar, o show nasce "sem mapa".
    const criado = await asAdmin("/show-books", { method: "POST", body: JSON.stringify({ locationId: local!.id, title: `${tag}_sem`, type: "COMPLETE" }) });
    const semFormato = (await corpo(criado)).showBook;
    assert(criado.status === 201 && semFormato?.stageFormat === "NONE", "show criado sem formato nasce em NONE (sem mapa)");

    // 2 · Pode nascer já com formato.
    const comFormato = await asAdmin("/show-books", { method: "POST", body: JSON.stringify({ locationId: local!.id, title: `${tag}_quad`, type: "COMPLETE", stageFormat: "QUAD" }) });
    assert(comFormato.status === 201 && (await corpo(comFormato)).showBook?.stageFormat === "QUAD", "show criado com formato QUAD guarda QUAD");

    // 3 · Valor inválido é recusado, ao criar e ao editar, com frase.
    const invalidoAoCriar = await asAdmin("/show-books", { method: "POST", body: JSON.stringify({ locationId: local!.id, title: `${tag}_x`, type: "COMPLETE", stageFormat: "triangulo" }) });
    assert(invalidoAoCriar.status === 400 && /Escolha L/.test((await corpo(invalidoAoCriar)).message ?? ""), "formato inválido ao criar é recusado com a frase dos formatos");
    const id = semFormato!.id;
    const invalidoAoEditar = await asAdmin(`/show-books/${id}`, { method: "PATCH", body: JSON.stringify({ stageFormat: "XX", reason: "teste" }) });
    assert(invalidoAoEditar.status === 400, "formato inválido ao editar é recusado");

    // 4 · Quem edita grava; quem só lê não grava.
    const gravou = await asAdmin(`/show-books/${id}`, { method: "PATCH", body: JSON.stringify({ stageFormat: "L", reason: "Formato do palco do show" }) });
    assert(gravou.status === 200 && (await corpo(gravou)).showBook?.stageFormat === "L", "a Administração grava o formato L");
    const membroTenta = await asMembro(`/show-books/${id}`, { method: "PATCH", body: JSON.stringify({ stageFormat: "RET", reason: "teste" }) });
    assert(membroTenta.status === 403, "o Elenco não muda o formato do palco");

    // 5 · Editar outra coisa não zera o formato.
    await asAdmin(`/show-books/${id}`, { method: "PATCH", body: JSON.stringify({ description: "nova descrição", reason: "teste" }) });
    const detalhe = (await corpo(await asAdmin(`/show-books/${id}`))).showBook;
    assert(detalhe?.stageFormat === "L", "editar a descrição não apaga o formato do palco");

    // 6 · O formato aparece no detalhe e na lista, também para o Elenco.
    const doElenco = (await corpo(await asMembro(`/show-books/${id}`))).showBook;
    assert(doElenco?.stageFormat === "L", "o Elenco vê o formato no detalhe do show");
    const lista = await (await asAdmin("/show-books")).json() as { showBooks?: { id: string; stageFormat?: string }[]; books?: { id: string; stageFormat?: string }[] };
    assert((lista.showBooks ?? lista.books ?? []).find((s) => s.id === id)?.stageFormat === "L", "a lista de shows traz o formato");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    const shows = await db.select({ id: showBooksTable.id }).from(showBooksTable).where(eq(showBooksTable.operationId, operation!.id));
    if (shows.length) await db.delete(showBookVersionsTable).where(inArray(showBookVersionsTable.showBookId, shows.map((s) => s.id)));
    await db.delete(showBooksTable).where(eq(showBooksTable.operationId, operation!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no formato do palco`);
  process.stdout.write(`show-book-formato-do-palco: ${passed} asserts passed\n`);
}

process.stdout.write("show-book-formato-do-palco: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
