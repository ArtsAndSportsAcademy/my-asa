/**
 * Fase D — tolerância de 30 s na renovação da sessão (migração 0050).
 * O app pode fechar no instante em que o servidor troca o token: o servidor trocou, o aparelho não
 * guardou o novo. O token recém-trocado ainda renova por 30 s; Sair, encerrar sessões e desligamento
 * continuam derrubando a sessão na hora. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
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
import { TOLERANCIA_RENOVACAO_MS } from "../src/lib/auth.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `renov_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (name: string, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, fullName: `${name} ${tag}`, username: `${tag}_${name}`.toLowerCase() }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role: role as never, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN");
  const julia = await mk("Julia", "MEMBER");
  const carol = await mk("Carol", "MEMBER");
  const louis = await mk("Louis", "MEMBER");
  const everyone = [barbara, julia, carol, louis].map((u) => u.id);

  // Sessão como o login cria (sem passar pela senha).
  const sessao = async (userId: string) => {
    const { token, expiresAt } = signRefreshToken(userId);
    await db.insert(refreshTokensTable).values({ userId, tokenHash: hashToken(token), expiresAt });
    return token;
  };
  const linha = async (token: string) => (await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.tokenHash, hashToken(token))))[0]!;

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tk = (u: { id: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: org!.id, role, operationIds: [op!.id] });
    const call = async (method: string, path: string, token: string | null, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
    };
    const renovar = (refreshToken: string) => call("POST", "/auth/refresh", null, { refreshToken });

    assert(TOLERANCIA_RENOVACAO_MS === 30_000, "a tolerância é de 30 segundos");

    // ── App fechou no meio da renovação: o servidor trocou, o aparelho ficou com o token antigo ──
    const r0 = await sessao(julia.id);
    const primeira = await renovar(r0);
    assert(primeira.status === 200 && typeof primeira.body.refreshToken === "string", "a primeira renovação troca o token");
    const r1 = primeira.body.refreshToken as string;
    const rotacaoOriginal = (await linha(r0)).rotatedAt;
    assert(rotacaoOriginal !== null, "o token trocado guarda quando foi trocado");
    const deNovo = await renovar(r0);
    assert(deNovo.status === 200 && typeof deNovo.body.accessToken === "string", "com o token antigo, dentro de 30 s, a sessão continua (sem pedir login)");
    const r2 = deNovo.body.refreshToken as string;
    assert(r2 !== r1, "e recebe um token novo, diferente do que se perdeu");
    assert((await linha(r0)).rotatedAt?.getTime() === rotacaoOriginal!.getTime(), "usar a tolerância não estica a janela de 30 s");
    const perdido = await linha(r1);
    assert(perdido.revokedAt === null && perdido.expiresAt.getTime() <= Date.now() + 30 * 60_000 + 5_000, "o token que se perdeu passa a valer só mais 30 min (não fica sessão órfã por 30 dias)");
    assert((await renovar(r2)).status === 200, "o token novo segue renovando normalmente");
    const renovacoes = await db.select().from(securityAuditLogTable)
      .where(and(eq(securityAuditLogTable.actorId, julia.id), eq(securityAuditLogTable.action, "TOKEN_REFRESHED")));
    const detalhes = (m: unknown) => (typeof m === "string" ? JSON.parse(m) : m) as Record<string, unknown> | null;
    assert(renovacoes.length === 3 && renovacoes.filter((a) => detalhes(a.metadata)?.tolerancia === true).length === 1, "o registro de segurança marca a renovação feita pela tolerância (só ela)");

    // ── Passados 30 s, o token antigo não vale mais ──
    await db.update(refreshTokensTable).set({ rotatedAt: new Date(Date.now() - TOLERANCIA_RENOVACAO_MS - 1_000) }).where(eq(refreshTokensTable.tokenHash, hashToken(r0)));
    assert((await renovar(r0)).status === 401, "passados 30 s da troca, o token antigo é recusado");

    // ── Duas renovações ao mesmo tempo com o mesmo token (duas abas) ──
    const c0 = await sessao(carol.id);
    const [a, b] = await Promise.all([renovar(c0), renovar(c0)]);
    assert(a.status === 200 && b.status === 200, "duas renovações simultâneas com o mesmo token: nenhuma derruba a sessão");
    assert(a.body.refreshToken !== b.body.refreshToken, "cada uma recebe o seu token");

    // ── Sair: o token encerrado não volta, nem o trocado logo antes ──
    const s0 = await sessao(carol.id);
    const s1 = (await renovar(s0)).body.refreshToken as string;
    assert((await call("POST", "/auth/logout", tk(carol, "MEMBER"), { refreshToken: s1 })).status === 204, "Carol sai do app");
    assert((await renovar(s1)).status === 401, "o token de quem saiu não renova");
    assert((await renovar(s0)).status === 401, "nem o token trocado há segundos daquela sessão (Sair encerra a sessão inteira)");
    const v0 = await sessao(carol.id);
    const v1 = (await renovar(v0)).body.refreshToken as string;
    await call("POST", "/auth/logout", tk(carol, "MEMBER"), { refreshToken: v0 });
    assert((await renovar(v0)).status === 401, "Sair com o token antigo (o app não guardou o novo): o antigo não renova");
    assert((await renovar(v1)).status === 401, "e o novo, que veio dele, também não");
    const sairDireto = await sessao(carol.id);
    await call("POST", "/auth/logout", tk(carol, "MEMBER"), { refreshToken: sairDireto });
    assert((await renovar(sairDireto)).status === 401, "Sair sem nenhuma troca antes: recusado na hora");

    // ── Encerrar as outras sessões: o celular perdido não volta pela tolerância ──
    const celular0 = await sessao(julia.id);
    const celular1 = (await renovar(celular0)).body.refreshToken as string;
    const computador = await sessao(julia.id);
    const encerrar = await call("POST", "/users/me/sessions/encerrar-outras", tk(julia, "MEMBER"), { refreshToken: computador });
    assert(encerrar.status === 200, "Julia encerra as outras sessões pelo computador");
    assert((await renovar(celular1)).status === 401, "a sessão do celular cai");
    assert((await renovar(celular0)).status === 401, "e o token trocado há segundos no celular também não renova");
    assert((await renovar(computador)).status === 200, "a sessão do computador continua (controle)");

    // ── Desligamento: nem dentro dos 30 s ──
    const l0 = await sessao(louis.id);
    assert((await renovar(l0)).status === 200, "Louis renova a sessão");
    const desligar = await call("DELETE", `/users/${louis.id}`, tk(barbara, "ADMIN"), { reason: "saiu da companhia" });
    assert(desligar.status === 200, "Administração desliga o Louis");
    assert((await renovar(l0)).status === 401, "o token trocado há segundos de quem foi desligado não renova");
    const novosDoLouis = await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.userId, louis.id));
    assert(novosDoLouis.every((t) => t.revokedAt !== null), "e nenhuma sessão nova do Louis fica aberta");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone), inArray(historyEventsTable.entityId, everyone)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, everyone));
    await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, everyone));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na tolerância de renovação`);
  process.stdout.write(`fase-d-renovacao-tolerancia: ${passed} asserts passed\n`);
}

process.stdout.write("fase-d-renovacao-tolerancia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
