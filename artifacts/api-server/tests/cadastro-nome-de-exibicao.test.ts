/**
 * A Administração muda o nome de exibição da pessoa pelo cadastro (PUT /users/:id/cadastro, campo displayName).
 * Entra no Registro com o nome de antes e o de depois; Supervisão e Elenco recebem um "não" que explica.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, historyEventsTable, operationsTable, organizationsTable, pool, securityAuditLogTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `exib_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (name: string, role: "ADMIN" | "SUPERVISOR_A" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, fullName: `${name} Sobrenome ${tag}`, username: `${tag}_${name}`.toLowerCase() }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role, active: true });
    return u!;
  };
  const admin = await mk("Barbara", "ADMIN");
  const sup = await mk("Deborah", "SUPERVISOR_A");
  const julia = await mk("Julia", "MEMBER");
  const everyone = [admin, sup, julia].map((u) => u.id);
  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const put = async (quem: { id: string }, role: string, body: Record<string, unknown>) => {
      const token = signAccessToken({ sub: quem.id, jti: `${tag}_${quem.id}_${Math.random()}`, organizationId: org!.id, role, operationIds: [op!.id] });
      const r = await fetch(`http://127.0.0.1:${address.port}/api/users/${julia.id}/cadastro`, { method: "PUT", signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      return { status: r.status, body: (await r.json()) as { mudou?: boolean; message?: string; antes?: { displayName?: string } } };
    };
    const nome = async () => (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, julia.id)))[0]!.name;

    const ok = await put(admin, "ADMIN", { displayName: "  Ju  " });
    assert(ok.status === 200 && ok.body.mudou === true, "a Administração muda o nome de exibição");
    assert((await nome()) === "Ju", "o nome gravado é o digitado, sem espaços nas pontas");
    assert(ok.body.antes?.displayName === "Julia", "a resposta devolve o nome de antes (para o desfazer)");
    const evento = (await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, julia.id), eq(historyEventsTable.action, "user.cadastro_changed"))))[0];
    assert(Boolean(evento) && String(evento!.narrative).includes('nome de exibição de "Julia" para "Ju"'), "entra no Registro dizendo de que nome para qual");
    const igual = await put(admin, "ADMIN", { displayName: "Ju" });
    assert(igual.status === 200 && igual.body.mudou === false, "mandar o mesmo nome não muda nem registra nada");
    const vazio = await put(admin, "ADMIN", { displayName: "   " });
    assert(vazio.status === 400 && /nome de exibição/i.test(vazio.body.message ?? ""), "nome vazio é 400 com a frase");
    const longo = await put(admin, "ADMIN", { displayName: "x".repeat(61) });
    assert(longo.status === 400, "nome com mais de 60 letras é 400");
    const supervisao = await put(sup, "SUPERVISOR_A", { displayName: "Outro" });
    assert(supervisao.status === 403 && /Administração/.test(supervisao.body.message ?? ""), "a Supervisão recebe um não que diz quem pode");
    const elenco = await put(julia, "MEMBER", { displayName: "Outro" });
    assert(elenco.status === 403, "o Elenco também não muda por aqui");
    assert((await nome()) === "Ju", "e nada mudou depois das recusas");
    const volta = await put(admin, "ADMIN", { displayName: ok.body.antes!.displayName });
    assert(volta.status === 200 && (await nome()) === "Julia", "desfazer: mandar o nome de antes devolve o nome");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone), inArray(historyEventsTable.entityId, everyone)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, everyone));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s)`);
  process.stdout.write(`cadastro-nome-de-exibicao: ${passed} asserts passed\n`);
}

try { await run(); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
