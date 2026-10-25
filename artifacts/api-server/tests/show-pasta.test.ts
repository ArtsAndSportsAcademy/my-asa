/**
 * Pasta do show (24/10/2026): pasta livre dentro do local, pela rota PATCH /show-books/:id/pasta.
 * - mover grava a pasta sem espaços sobrando e aparece na lista de shows;
 * - nome longo demais ou que não é texto é 400 com frase; pasta vazia tira o show da pasta;
 * - mover de pasta NÃO troca a versão do livro, mas entra no Registro dizendo de onde saiu e para onde foi;
 * - repetir a mesma pasta não grava de novo; Elenco recebe 403. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  db, historyEventsTable, locationsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, securityAuditLogTable,
  showBooksTable, showBookVersionsTable, userRolesTable, usersTable,
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
  const tag = `pst_${Date.now()}`;
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

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [op!.id] });
      const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
      return {
        pasta: async (body: Record<string, unknown>) => {
          const r = await fetch(`${base}/show-books/${livro!.id}/pasta`, { method: "PATCH", signal: AbortSignal.timeout(60_000), headers, body: JSON.stringify(body) });
          const text = await r.text();
          return { status: r.status, text };
        },
        lista: async () => {
          const r = await fetch(`${base}/show-books`, { signal: AbortSignal.timeout(60_000), headers });
          return ((await r.json()) as { showBooks: { id: string; folder: string | null }[] }).showBooks;
        },
      };
    };
    const asAdm = as(adm, "ADMIN"), asElenco = as(elenco, "MEMBER");
    const atual = async () => (await db.select().from(showBooksTable).where(eq(showBooksTable.id, livro!.id)))[0]!;
    const movimentos = async () => (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, livro!.id))).filter((e) => e.action === "show_book.folder_changed");

    assert((await asElenco.pasta({ folder: "Natal 2026" })).status === 403, "Elenco não move show de pasta");
    const longa = await asAdm.pasta({ folder: "x".repeat(61) });
    assert(longa.status === 400 && /60 letras/.test(longa.text), "nome de pasta longo demais é 400 com frase");
    const numero = await asAdm.pasta({ folder: 7 });
    assert(numero.status === 400 && /texto/.test(numero.text), "pasta que não é texto é 400 com frase");
    assert((await atual()).folder === null && (await movimentos()).length === 0, "as recusas não mudaram nada");

    const versaoAntes = (await atual()).version;
    const move = await asAdm.pasta({ folder: "   Natal    2026  " });
    assert(move.status === 200 && (await atual()).folder === "Natal 2026", "mover grava o nome sem espaços sobrando");
    assert((await atual()).version === versaoAntes, "mover de pasta não troca a versão do livro");
    const naLista = (await asAdm.lista()).find((b) => b.id === livro!.id);
    assert(naLista?.folder === "Natal 2026", "a lista de shows devolve a pasta");
    const ev = await movimentos();
    assert(ev.length === 1 && /de Sem pasta para "Natal 2026"/.test(ev[0]!.narrative ?? ""), "o Registro diz de onde saiu e para onde foi");

    await asAdm.pasta({ folder: "Natal 2026" });
    assert((await movimentos()).length === 1, "repetir a mesma pasta não grava de novo no Registro");

    const tira = await asAdm.pasta({ folder: "" });
    assert(tira.status === 200 && (await atual()).folder === null, "pasta vazia tira o show da pasta");
    assert((await movimentos()).some((e) => /de "Natal 2026" para Sem pasta/.test(e.narrative ?? "")), "o Registro diz que voltou para Sem pasta");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(showBookVersionsTable).where(eq(showBookVersionsTable.showBookId, livro!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, livro!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em show-pasta`);
  process.stdout.write(`show-pasta: ${passed} asserts passed\n`);
}

process.stdout.write("show-pasta: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
