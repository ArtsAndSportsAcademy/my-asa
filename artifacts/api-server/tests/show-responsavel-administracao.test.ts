/**
 * Responsável por um show (25/10/2026): a Administração também pode ser a pessoa responsável, pela rota PATCH /show-books/:id/responsible.
 * - Administração da mesma casa é aceita; Supervisão da operação continua aceita;
 * - Elenco e Administração de OUTRA casa são recusados com 400 e uma frase que diz quem pode;
 * - só a Administração troca o responsável (o Elenco recebe 403); a troca entra no Registro. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  db, historyEventsTable, locationsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, securityAuditLogTable,
  showBooksTable, showBookVersionsTable, userNotificationsTable, userRolesTable, usersTable,
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
  const tag = `rsp_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [opOutra] = await db.insert(operationsTable).values({ organizationId: outraOrg!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const mk = async (orgId: string, opId: string, nome: string, role: "ADMIN" | "MEMBER" | "SUPERVISOR_A") => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name: `${tag}_${nome}`, username: `${tag}_${nome}` }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: opId, role, active: true });
    return u!;
  };
  const adm = await mk(org!.id, op!.id, "adm", "ADMIN");
  const babi = await mk(org!.id, op!.id, "babi", "ADMIN");
  const sup = await mk(org!.id, op!.id, "sup", "SUPERVISOR_A");
  const elenco = await mk(org!.id, op!.id, "elenco", "MEMBER");
  const admOutra = await mk(outraOrg!.id, opOutra!.id, "admoutra", "ADMIN");
  const todos = [adm.id, babi.id, sup.id, elenco.id, admOutra.id];
  const [livro] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: adm.id, type: "COMPLETE" }).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const como = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [op!.id] });
      return async (responsibleId: string | null) => {
        const r = await fetch(`${base}/show-books/${livro!.id}/responsible`, { method: "PATCH", signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ responsibleId }) });
        return { status: r.status, text: await r.text() };
      };
    };
    const comoAdm = como(adm, "ADMIN"), comoElenco = como(elenco, "MEMBER");
    const atual = async () => (await db.select().from(showBooksTable).where(eq(showBooksTable.id, livro!.id)))[0]!.responsibleId;

    assert((await comoElenco(babi.id)).status === 403, "Elenco não troca o responsável do show");
    assert((await atual()) === null, "a recusa do Elenco não mudou nada");

    const paraAdm = await comoAdm(babi.id);
    assert(paraAdm.status === 200 && (await atual()) === babi.id, "a Administração pode ser a pessoa responsável pelo show");

    const paraSup = await comoAdm(sup.id);
    assert(paraSup.status === 200 && (await atual()) === sup.id, "a Supervisão da operação continua podendo ser responsável");

    const paraElenco = await comoAdm(elenco.id);
    assert(paraElenco.status === 400 && /Supervisão .* ou da Administração/.test(paraElenco.text) && (await atual()) === sup.id, "Elenco não pode ser responsável: 400 com a frase de quem pode, e nada muda");

    const paraOutraCasa = await comoAdm(admOutra.id);
    assert(paraOutraCasa.status === 400 && (await atual()) === sup.id, "a Administração de outra casa não pode ser responsável");

    const tira = await comoAdm(null);
    assert(tira.status === 200 && (await atual()) === null, "tirar o responsável continua funcionando");

    const eventos = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, livro!.id))).filter((e) => /responsável/i.test(e.title + " " + e.narrative));
    assert(eventos.length >= 3, "cada troca de responsável entra no Registro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, todos));
    await db.delete(showBookVersionsTable).where(eq(showBookVersionsTable.showBookId, livro!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, livro!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, todos));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [op!.id, opOutra!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em show-responsavel-administracao`);
  process.stdout.write(`show-responsavel-administracao: ${passed} asserts passed\n`);
}

process.stdout.write("show-responsavel-administracao: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
