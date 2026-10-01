/** Fase D (D2) — primeira Administração sem apagar nada; o antigo reset não apaga mais o banco. PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { db, historyEventsTable, operationsTable, organizationsTable, pool, refreshTokensTable, securityAuditLogTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { criarPrimeiraAdministracao, JaTemAdministracao } from "../src/services/primeira-administracao.js";
import { runProdBootstrap } from "../src/lib/bootstrap.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}
const contar = async () => ({
  orgs: Number((await pool.query("select count(*)::int n from organizations")).rows[0].n),
  users: Number((await pool.query("select count(*)::int n from users")).rows[0].n),
});

async function run() {
  const tag = `primeira_${Date.now()}`;
  const orgNome = `${tag} Arts and Sports Academy`;
  const orgsCriadas: string[] = [];
  let server: http.Server | null = null;
  try {
    const antes = await contar();
    const r = await criarPrimeiraAdministracao({ organizacao: orgNome, operacao: "Snowland", nomeCompleto: `Barbara ${tag}`, nomeDeUso: "Barbara" });
    orgsCriadas.push(r.organizationId);
    const depois = await contar();
    assert(depois.orgs === antes.orgs + 1 && depois.users === antes.users + 1, "cria a organização e uma pessoa, sem apagar nada do que já existia");
    const [pessoa] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
    const [papel] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, r.userId));
    assert(pessoa?.mustChangePassword === true && pessoa.name === "Barbara" && papel?.role === "ADMIN" && papel.operationId === r.operationId, "a conta nasce ADMIN, com nome de uso e troca de senha obrigatória");
    assert(/^[a-hj-km-np-z]{4}-[2-9]{4}$/.test(r.senhaProvisoria), "a senha provisória é legível");
    const [ev] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, r.userId), eq(historyEventsTable.action, "organization.primeira_administracao")));
    assert(Boolean(ev) && !JSON.stringify(ev).includes(r.senhaProvisoria) && !JSON.stringify(ev).includes("$2"), "a criação entra no Registro, sem senha nem hash");

    let recusou = false;
    try { await criarPrimeiraAdministracao({ organizacao: orgNome, operacao: "Snowland", nomeCompleto: `Outra ${tag}` }); } catch (e) { recusou = e instanceof JaTemAdministracao; }
    assert(recusou && (await contar()).users === depois.users, "rodar de novo não cria outra conta: a organização já tem Administração");

    // Organização que já existe, sem Administração: a conta entra nela, e ninguém mais é tocado.
    const [existente] = await db.insert(organizationsTable).values({ name: `${tag} Existente` }).returning();
    orgsCriadas.push(existente!.id);
    const [opExistente] = await db.insert(operationsTable).values({ organizationId: existente!.id, name: "Acquamotion", status: "ACTIVE" }).returning();
    const [membro] = await db.insert(usersTable).values({ organizationId: existente!.id, name: "Julia", fullName: `Julia ${tag}`, username: `${tag}_julia` }).returning();
    await db.insert(userRolesTable).values({ userId: membro!.id, operationId: opExistente!.id, role: "MEMBER", active: true });
    const r2 = await criarPrimeiraAdministracao({ organizacao: `${tag} Existente`, operacao: "Acquamotion", nomeCompleto: `Cris ${tag}` });
    assert(r2.organizationId === existente!.id && r2.operationId === opExistente!.id, "com a organização e a operação já criadas, usa as mesmas");
    assert((await db.select().from(usersTable).where(eq(usersTable.id, membro!.id)))[0]?.fullName === `Julia ${tag}`, "quem já estava cadastrado continua igual");

    // Login com a senha provisória obriga a troca.
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const login = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: r.username, password: r.senhaProvisoria }) });
    const body = (await login.json()) as { user?: { mustChangePassword?: boolean } };
    assert(login.status === 200 && body.user?.mustChangePassword === true, "a primeira Administração entra com a senha provisória e o app pede a troca");

    // O antigo reset não apaga mais nada, nem com a variável ligada.
    const antesReset = await contar();
    process.env.RESET_PROD_DB = "1"; process.env.BOOTSTRAP_ADMIN_PASSWORD = "qualquer";
    await runProdBootstrap();
    delete process.env.RESET_PROD_DB; delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const depoisReset = await contar();
    assert(depoisReset.orgs === antesReset.orgs && depoisReset.users === antesReset.users, "RESET_PROD_DB=1 não apaga o banco nem cria administrador genérico");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const pessoas = (await db.select({ id: usersTable.id }).from(usersTable).where(or(inArray(usersTable.organizationId, orgsCriadas.length ? orgsCriadas : ["00000000-0000-4000-8000-000000000000"]), like(usersTable.fullName, `%${tag}%`)))).map((p) => p.id);
    if (pessoas.length) {
      await db.delete(historyEventsTable).where(or(inArray(historyEventsTable.entityId, pessoas), inArray(historyEventsTable.actorId, pessoas)));
      await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, pessoas));
      await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, pessoas));
      await db.delete(userRolesTable).where(inArray(userRolesTable.userId, pessoas));
      await db.delete(usersTable).where(inArray(usersTable.id, pessoas));
    }
    if (orgsCriadas.length) {
      await db.delete(historyEventsTable).where(inArray(historyEventsTable.orgId, orgsCriadas));
      await db.delete(operationsTable).where(inArray(operationsTable.organizationId, orgsCriadas));
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, orgsCriadas));
    }
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na primeira Administração`);
  process.stdout.write(`fase-d-primeira-administracao: ${passed} asserts passed\n`);
}

process.stdout.write("fase-d-primeira-administracao: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
