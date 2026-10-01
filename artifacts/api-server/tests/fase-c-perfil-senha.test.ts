/** Fase C (C4/C5) — trocar a própria senha, sessões abertas e Administração redefinindo senha. PostgreSQL real de teste. */
import http from "node:http";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  historyEventsTable,
  operationsTable,
  organizationsTable,
  pool,
  refreshTokensTable,
  securityAuditLogTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { hashToken, signAccessToken, signRefreshToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `perfil_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [outraOp] = await db.insert(operationsTable).values({ organizationId: outraOrg!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const velha = await bcrypt.hash("velha123", 4);
  const mk = async (name: string, role: "ADMIN" | "SUPERVISOR_A" | "MEMBER", orgId = org!.id, opId = operation!.id) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name, username: `${tag}_${name}`.toLowerCase(), passwordHash: velha }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: opId, role, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN");
  const deborah = await mk("Deborah", "SUPERVISOR_A");
  const julia = await mk("Julia", "MEMBER");
  const deFora = await mk("Fora", "MEMBER", outraOrg!.id, outraOp!.id);
  const everyone = [barbara, deborah, julia, deFora].map((u) => u.id);

  const sessao = async (userId: string) => { const { token, expiresAt } = signRefreshToken(userId); await db.insert(refreshTokensTable).values({ userId, tokenHash: hashToken(token), expiresAt }); return token; };
  const abertas = async (userId: string) => (await db.select({ id: refreshTokensTable.id }).from(refreshTokensTable).where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt)))).length;
  const registro = async (entityId: string, action: string) => db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, entityId), eq(historyEventsTable.action, action)));

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tokenDe = (user: { id: string; organizationId: string }, role: string, opId = operation!.id) => signAccessToken({ sub: user.id, jti: `${tag}_${Math.random()}`, organizationId: user.organizationId, role, operationIds: [opId] });
    const call = async (method: string, path: string, access: string | null, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", ...(access ? { authorization: `Bearer ${access}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
    };
    const login = (username: string, password: string) => call("POST", "/auth/login", null, { username, password });
    const refresh = (refreshToken: string) => call("POST", "/auth/refresh", null, { refreshToken });

    // ---------- C4: trocar a própria senha ----------
    const juliaAqui = await sessao(julia.id);
    const juliaOutro = await sessao(julia.id);
    const asJulia = tokenDe(julia, "MEMBER");
    assert((await call("GET", "/users/me/sessions", asJulia)).body.abertas === 2, "Perfil mostra 2 sessões abertas (este aparelho e outro)");
    assert((await call("POST", "/users/me/password", asJulia, { currentPassword: "errada", newPassword: "nova1234", refreshToken: juliaAqui })).status === 401, "senha atual errada é recusada");
    assert((await call("POST", "/users/me/password", asJulia, { currentPassword: "velha123", newPassword: "velha123", refreshToken: juliaAqui })).status === 400, "nova senha igual à atual é recusada");
    assert((await call("POST", "/users/me/password", asJulia, { currentPassword: "velha123", newPassword: "abc", refreshToken: juliaAqui })).status === 400, "nova senha curta demais é recusada");
    assert((await registro(julia.id, "user.password_changed")).length === 0, "tentativas recusadas não entram no Registro");
    const troca = await call("POST", "/users/me/password", asJulia, { currentPassword: "velha123", newPassword: "nova1234", refreshToken: juliaAqui });
    assert(troca.status === 200 && troca.body.sessoesEncerradas === 1, "troca de senha responde 200 e encerra 1 sessão (a do outro aparelho)");
    assert((await refresh(juliaOutro)).status === 401, "a sessão do outro aparelho deixa de valer");
    const renovada = await refresh(juliaAqui);
    assert(renovada.status === 200, "a sessão deste aparelho continua valendo");
    assert((await login(julia.username!, "velha123")).status === 401, "a senha antiga não entra mais");
    const entrou = await login(julia.username!, "nova1234");
    assert(entrou.status === 200, "a senha nova entra");
    const [evTroca] = await registro(julia.id, "user.password_changed");
    assert(Boolean(evTroca) && evTroca!.actorId === julia.id && (evTroca!.afterState as any)?.sessoesEncerradas === 1, "a troca entra no Registro com quem fez e quantas sessões caíram");
    assert(!JSON.stringify(evTroca ?? {}).includes("$2") && !JSON.stringify(evTroca ?? {}).includes("nova1234"), "o Registro não guarda senha nem hash");

    // ---------- Registro nunca guarda hash de senha ----------
    assert((await call("PATCH", `/users/${julia.id}`, asJulia, { displayName: "Ju", phone: "11 90000-0000", contactVisibility: { email: true, phone: false } })).status === 200, "a pessoa edita nome de uso, telefone e visibilidade no Perfil");
    const [evNome] = await registro(julia.id, "user.display_name_changed");
    assert(Boolean(evNome) && !JSON.stringify(evNome!.beforeState).includes("passwordHash") && !JSON.stringify(evNome!.afterState).includes("passwordHash") && !JSON.stringify(evNome).includes("$2"), "editar o cadastro não leva o hash da senha para o Registro");
    assert((evNome!.afterState as any)?.name === "Ju" && (evNome!.afterState as any)?.contactVisibility?.phone === false, "o Registro continua com o antes/depois do que mudou");
    const criada = await call("POST", "/users", tokenDe(barbara, "ADMIN"), { fullName: `${tag} Nova Pessoa`, username: `${tag}_nova`, password: "provisoria1", reason: "entrada no elenco" });
    const novaId = String(criada.body.user?.id ?? "");
    if (novaId) everyone.push(novaId);
    const [evCriada] = novaId ? await registro(novaId, "user.created") : [];
    assert(criada.status === 201 && Boolean(evCriada) && !JSON.stringify(evCriada).includes("passwordHash") && !JSON.stringify(evCriada).includes("$2"), "criar pessoa com senha não leva o hash para o Registro");

    // ---------- C4: encerrar as outras sessões ----------
    const aqui = renovada.body.refreshToken as string;
    assert((await call("GET", "/users/me/sessions", asJulia)).body.abertas === 2, "depois do novo login, 2 sessões abertas");
    assert((await call("POST", "/users/me/sessions/encerrar-outras", asJulia, {})).status === 400, "encerrar as outras sem dizer qual é este aparelho é recusado");
    const encerrar = await call("POST", "/users/me/sessions/encerrar-outras", asJulia, { refreshToken: aqui });
    assert(encerrar.status === 200 && encerrar.body.sessoesEncerradas === 1, "encerrar as outras derruba só a outra sessão");
    assert((await refresh(entrou.body.refreshToken as string)).status === 401 && (await abertas(julia.id)) === 1, "sobra só a sessão deste aparelho");
    assert((await registro(julia.id, "user.sessions_revoked")).length === 1, "encerrar sessões entra no Registro");

    // ---------- C5: Administração redefine a senha ----------
    await sessao(julia.id);
    const asBarbara = tokenDe(barbara, "ADMIN");
    assert((await call("POST", `/users/${deborah.id}/password-reset`, asJulia, { reason: "esqueceu" })).status === 403, "Elenco não redefine senha");
    assert((await call("POST", `/users/${julia.id}/password-reset`, tokenDe(deborah, "SUPERVISOR_A"), { reason: "esqueceu" })).status === 403, "Supervisão não redefine senha");
    assert((await call("POST", `/users/${barbara.id}/password-reset`, asBarbara, { reason: "teste" })).status === 400, "a Administração não redefine a própria senha por aqui");
    assert((await call("POST", `/users/${julia.id}/password-reset`, asBarbara, {})).status === 400, "sem motivo, a redefinição é recusada");
    assert((await call("POST", `/users/${deFora.id}/password-reset`, asBarbara, { reason: "esqueceu" })).status === 404, "pessoa de outra organização não é encontrada");
    const reset = await call("POST", `/users/${julia.id}/password-reset`, asBarbara, { reason: "esqueceu a senha no camarim" });
    const provisoria = String(reset.body.senhaProvisoria ?? "");
    assert(reset.status === 200 && /^[a-hj-km-np-z]{4}-[2-9]{4}$/.test(provisoria), "redefinição devolve uma senha provisória legível");
    assert(reset.body.sessoesEncerradas === 2 && (await abertas(julia.id)) === 0, "redefinir encerra todas as sessões da pessoa");
    const [evReset] = await registro(julia.id, "user.password_reset");
    assert(Boolean(evReset) && evReset!.actorId === barbara.id && (evReset!.metadata as any)?.reason === "esqueceu a senha no camarim", "a redefinição entra no Registro com quem fez e o motivo");
    assert(!JSON.stringify(evReset ?? {}).includes(provisoria), "o Registro não guarda a senha provisória");
    assert((await login(julia.username!, "nova1234")).status === 401, "a senha anterior deixa de entrar");
    const provisorio = await login(julia.username!, provisoria);
    assert(provisorio.status === 200 && provisorio.body.user?.mustChangePassword === true, "a senha provisória entra e obriga a troca");
    const bloqueado = await call("GET", "/meu-dia", provisorio.body.accessToken as string);
    assert(bloqueado.status === 403 && bloqueado.body.error === "MUST_CHANGE_PASSWORD", "com senha provisória, o resto do app fica bloqueado");
    const definitiva = await call("POST", "/users/me/password", provisorio.body.accessToken as string, { currentPassword: provisoria, newPassword: "minha5678", refreshToken: provisorio.body.refreshToken });
    assert(definitiva.status === 200 && (await call("GET", "/meu-dia", provisorio.body.accessToken as string)).status === 200, "depois de trocar a provisória, o app libera");
    assert((await db.select({ m: usersTable.mustChangePassword }).from(usersTable).where(eq(usersTable.id, julia.id)))[0]?.m === false, "a obrigação de troca some do cadastro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(inArray(historyEventsTable.orgId, [org!.id, outraOrg!.id]), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, everyone));
    await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, everyone));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [operation!.id, outraOp!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no Perfil/senha`);
  process.stdout.write(`fase-c-perfil-senha: ${passed} asserts passed\n`);
}

process.stdout.write("fase-c-perfil-senha: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
