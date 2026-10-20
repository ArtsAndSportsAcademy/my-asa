/** Biblioteca (20/10/2026): restaurar documento arquivado, histórico de versões para a Direção e temas sem documento para a Supervisão. PostgreSQL real de teste. */
import http from "node:http";
import bcrypt from "bcryptjs";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  db,
  historyEventsTable,
  libraryDocumentsTable,
  libraryDocumentVersionsTable,
  libraryViewsTable,
  operationsTable,
  organizationsTable,
  pool,
  undoActionsTable,
  userNotificationsTable,
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

async function run() {
  const tag = `bibres_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const hash = await bcrypt.hash("senha1234", 4);
  const mk = async (name: string, role: "ADMIN" | "SUPERVISOR_A" | "DIR" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, username: `${tag}_${name}`.toLowerCase(), passwordHash: hash }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const admin = await mk("Admin", "ADMIN");
  const sup = await mk("Sup", "SUPERVISOR_A");
  const dir = await mk("Dir", "DIR");
  const mem = await mk("Mem", "MEMBER");
  const everyone = [admin, sup, dir, mem].map((u) => u.id);

  const [doc] = await db.insert(libraryDocumentsTable).values({
    orgId: org!.id, type: "OPERATIONAL_PROCEDURE", title: `${tag} Procedimento`, summary: "Como fazer", body: "Texto original do procedimento.",
    status: "PUBLISHED", version: 1, publishedAt: new Date(), createdBy: admin.id, requiresConfirmation: true,
  }).returning();
  await db.insert(libraryDocumentVersionsTable).values({ documentId: doc!.id, version: 1, title: doc!.title, body: doc!.body, summary: doc!.summary, createdBy: admin.id });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tokenDe = (u: { id: string; organizationId: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: u.organizationId, role, operationIds: [operation!.id] } as any);
    const t = { admin: tokenDe(admin, "ADMIN"), sup: tokenDe(sup, "SUPERVISOR_A"), dir: tokenDe(dir, "DIR"), mem: tokenDe(mem, "MEMBER") };
    const call = async (method: string, path: string, access: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", authorization: `Bearer ${access}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
    };
    const estado = async () => (await db.select().from(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, doc!.id)))[0]!;
    const avisos = async () => db.select().from(userNotificationsTable).where(and(inArray(userNotificationsTable.userId, everyone), eq(userNotificationsTable.entityId, doc!.id)));
    const listaDe = async (access: string) => ((await call("GET", "/library/documents", access)).body.documents ?? []) as { id: string; status: string }[];

    // ---------- restaurar: só o que está arquivado, só a Administração, sempre como rascunho e sem aviso ----------
    assert((await call("POST", `/library/documents/${doc!.id}/restore`, t.admin)).status === 409, "documento que não está arquivado não tem o que restaurar (409)");
    const arquivou = await call("POST", `/library/documents/${doc!.id}/archive`, t.admin);
    assert(arquivou.status === 200 && (await estado()).status === "ARCHIVED", "a Administração arquiva");
    const detalheArquivado = await call("GET", `/library/documents/${doc!.id}`, t.admin);
    assert(detalheArquivado.body.canRestore === true && detalheArquivado.body.canArchive === false, "o detalhe do arquivado diz à tela que a Administração pode restaurar (e não arquivar de novo)");
    const avisosAntes = (await avisos()).length;

    for (const [quem, token] of [["Supervisão", t.sup], ["Direção", t.dir], ["Elenco", t.mem]] as const) {
      const r = await call("POST", `/library/documents/${doc!.id}/restore`, token);
      assert(r.status === 403 && /Administração/.test(r.body.message ?? ""), `${quem} não restaura e recebe um "não" que explica (${r.status} ${r.body.message})`);
    }
    assert((await estado()).status === "ARCHIVED", "as recusas não mudam o documento");
    assert((await call("POST", `/library/documents/undefined/restore`, t.admin)).status === 404, "id quebrado dá 404, não 500");

    const restaurou = await call("POST", `/library/documents/${doc!.id}/restore`, t.admin);
    const depois = await estado();
    assert(restaurou.status === 200 && depois.status === "DRAFT" && depois.archivedAt === null, `restaurar devolve como rascunho e limpa a data de arquivamento (${restaurou.status} ${depois.status})`);
    assert(depois.body === "Texto original do procedimento." && depois.version === 1, "o texto e a versão continuam como estavam");
    assert((await avisos()).length === avisosAntes, "restaurar não avisa ninguém (nem Elenco, nem Direção, nem Supervisão)");
    const registro = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, doc!.id), eq(historyEventsTable.action, "library.restored")));
    assert(registro.length === 1 && /rascunho/.test(String(registro[0]!.narrative)), "o Registro guarda a restauração dizendo que voltou como rascunho");
    const segunda = await call("POST", `/library/documents/${doc!.id}/restore`, t.admin);
    assert(segunda.status === 409 && /não está arquivado/.test(segunda.body.message ?? ""), "restaurar duas vezes: a segunda recebe 409 com frase (um clique a mais não duplica o Registro)");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, doc!.id), eq(historyEventsTable.action, "library.restored")))).length === 1, "continua um Registro só");

    // ---------- rascunho: o Elenco não vê; a Administração vê; publicar de novo traz de volta ----------
    assert(!(await listaDe(t.mem)).some((d) => d.id === doc!.id), "o Elenco não vê o rascunho restaurado");
    assert((await listaDe(t.admin)).find((d) => d.id === doc!.id)?.status === "DRAFT", "a Administração vê o documento como rascunho");
    const publicou = await call("POST", `/library/documents/${doc!.id}/publish`, t.admin);
    assert(publicou.status === 200 && (await estado()).status === "PUBLISHED", "publicar de novo é uma decisão da Administração e funciona");
    assert((await listaDe(t.mem)).some((d) => d.id === doc!.id), "depois de publicar, o Elenco volta a ver");

    // ---------- histórico de versões: a Direção lê; o Elenco não ----------
    for (const [quem, token, esperado] of [["Administração", t.admin, 200], ["Supervisão", t.sup, 200], ["Direção", t.dir, 200], ["Elenco", t.mem, 403]] as const) {
      const r = await call("GET", `/library/documents/${doc!.id}/versions`, token);
      assert(r.status === esperado, `${quem} no histórico de versões: ${esperado} (veio ${r.status})`);
    }
    assert(Array.isArray((await call("GET", `/library/documents/${doc!.id}/versions`, t.dir)).body.versions), "a Direção recebe a lista de versões");
    const semDireitoVersoes = await call("GET", `/library/documents/${doc!.id}/versions`, t.mem);
    assert(/Elenco/.test(semDireitoVersoes.body.message ?? "") || /versões/.test(semDireitoVersoes.body.message ?? ""), "o 'não' do Elenco explica que o histórico é da gestão");
    assert((await call("POST", `/library/documents/${doc!.id}/version`, t.dir, { title: "x", summary: "y", body: "z" })).status === 403, "a Direção continua só lendo: não cria versão nova");
    assert((await call("POST", `/library/documents/${doc!.id}/archive`, t.dir)).status === 403, "a Direção continua sem arquivar");

    // ---------- temas que a ASA não achou: Administração e Supervisão ----------
    for (const [quem, token, esperado] of [["Administração", t.admin, 200], ["Supervisão", t.sup, 200], ["Direção", t.dir, 403], ["Elenco", t.mem, 403]] as const) {
      const r = await call("GET", "/asa/library-gaps", token);
      assert(r.status === esperado, `${quem} nos temas sem documento: ${esperado} (veio ${r.status})`);
    }
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [everyone]);
    await db.delete(undoActionsTable).where(eq(undoActionsTable.organizationId, org!.id));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, everyone));
    await db.delete(libraryViewsTable).where(eq(libraryViewsTable.documentId, doc!.id));
    await db.delete(libraryDocumentVersionsTable).where(eq(libraryDocumentVersionsTable.documentId, doc!.id));
    await db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.orgId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em restaurar documento da Biblioteca`);
  process.stdout.write(`biblioteca-restaurar: ${passed} asserts passed\n`);
}

process.stdout.write("biblioteca-restaurar: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
