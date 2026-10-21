/** Limite de tentativas de senha (20/10/2026): login, troca de senha, usuário que não existe, zerar, janela, Administração e corrida. PostgreSQL real de teste. */
import http from "node:http";
import bcrypt from "bcryptjs";
import { and, eq, gte, inArray, isNull, like, or } from "drizzle-orm";
import {
  db,
  historyEventsTable,
  operationsTable,
  organizationsTable,
  pool,
  refreshTokensTable,
  securityAuditLogTable,
  tentativasDeAcessoTable,
  userNotificationsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { LIMITE_DE_ERROS } from "../src/lib/tentativas-de-acesso.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const inicio = new Date();
  const tag = `tent_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const hash = await bcrypt.hash("certa1234", 4);
  const mk = async (name: string, role: "ADMIN" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, username: `${tag}_${name}`.toLowerCase(), passwordHash: hash }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const admin = await mk("Admin", "ADMIN");
  const admin2 = await mk("Admin2", "ADMIN");
  const ana = await mk("Ana", "MEMBER");
  const bia = await mk("Bia", "MEMBER");
  const cris = await mk("Cris", "MEMBER");
  const dan = await mk("Dan", "MEMBER");
  const eva = await mk("Eva", "MEMBER");
  const everyone = [admin, admin2, ana, bia, cris, dan, eva].map((u) => u.id);
  const usuarioDe = (u: { username: string | null }) => u.username!;
  const fantasma = `${tag}_ninguem`;
  const chaves = () => [...everyone.map((id) => `troca:${id}`), ...[admin, admin2, ana, bia, cris, dan, eva].map((u) => `login:${usuarioDe(u)}`), `login:${fantasma}`];

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const call = async (method: string, path: string, access: string | null, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", ...(access ? { authorization: `Bearer ${access}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
    };
    const login = (username: string, password: string) => call("POST", "/auth/login", null, { username, password });
    const tokenDe = (u: { id: string; organizationId: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: u.organizationId, role, operationIds: [operation!.id] } as any);
    const linha = async (chave: string) => (await db.select().from(tentativasDeAcessoTable).where(eq(tentativasDeAcessoTable.chave, chave)))[0];
    const registrosDe = async (userId: string) => db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, userId), eq(historyEventsTable.action, "user.access_locked")));
    const avisosDe = async (userId: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, "user.access_locked")));
    const erradas = async (username: string, quantas: number) => { const out = []; for (let i = 0; i < quantas; i++) out.push(await login(username, "errada999")); return out; };

    // ---------- 1) login: 7 erros seguem sendo "não confere"; o 8º pausa; a senha certa na pausa também é recusada ----------
    const seteErros = await erradas(usuarioDe(ana), LIMITE_DE_ERROS - 1);
    assert(seteErros.every((r) => r.status === 401 && r.body.error === "INVALID_CREDENTIALS"), "os 7 primeiros erros de senha seguem respondendo 401 INVALID_CREDENTIALS");
    const oitavo = await login(usuarioDe(ana), "errada999");
    assert(oitavo.status === 429 && oitavo.body.error === "TENTATIVAS_DEMAIS", `o 8º erro pausa a conta: 429 TENTATIVAS_DEMAIS (veio ${oitavo.status} ${oitavo.body.error})`);
    assert(/15 minutos/.test(oitavo.body.message ?? "") && /Esqueci minha senha/.test(oitavo.body.message ?? "") && /Administração/.test(oitavo.body.message ?? ""), `a frase diz por quanto tempo e o que fazer (${oitavo.body.message})`);
    const certaNaPausa = await login(usuarioDe(ana), "certa1234");
    assert(certaNaPausa.status === 429, "durante a pausa nem a senha certa entra (senão quem adivinha continuaria tentando)");
    assert((await login(usuarioDe(bia), "certa1234")).status === 200, "a pausa de uma conta não atrapalha as outras");
    assert((await registrosDe(ana.id)).length === 1, "a pausa entra no Registro, uma vez");
    assert((await avisosDe(admin.id)).length === 1 && (await avisosDe(admin2.id)).length === 1, "cada pessoa da Administração recebe um aviso no sino");
    assert((await avisosDe(ana.id)).length === 0, "a própria pessoa pausada não recebe aviso (ela já viu a frase na tela)");
    await login(usuarioDe(ana), "errada999"); await login(usuarioDe(ana), "errada999");
    assert((await registrosDe(ana.id)).length === 1 && (await avisosDe(admin.id)).length === 1, "tentar de novo durante a pausa não repete Registro nem aviso (um por pausa, não um por clique)");
    const auditoria = await db.select().from(securityAuditLogTable).where(and(eq(securityAuditLogTable.actorId, ana.id), like(securityAuditLogTable.metadata, "%account_locked%")));
    assert(auditoria.length === 1, "o log de segurança guarda a pausa");

    // ---------- 2) usuário que não existe se comporta igual (não revela quem existe) ----------
    const fantasmaErros = await erradas(fantasma, LIMITE_DE_ERROS - 1);
    assert(fantasmaErros.every((r) => r.status === 401 && r.body.error === "INVALID_CREDENTIALS"), "usuário que não existe: 7 erros respondem 401 como qualquer outro");
    const fantasmaOitavo = await login(fantasma, "errada999");
    assert(fantasmaOitavo.status === 429 && fantasmaOitavo.body.error === "TENTATIVAS_DEMAIS" && /15 minutos/.test(fantasmaOitavo.body.message ?? ""), "usuário que não existe também é pausado no 8º erro, com a mesma frase");
    // Só o que ESTE teste gerou (o banco de teste é compartilhado e pode ter pausas de outras execuções): todas são de gente que existe.
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.action, "user.access_locked"), gte(historyEventsTable.createdAt, inicio)))).every((e) => everyone.includes(e.entityId as string)), "pausa de usuário que não existe não vai para o Registro de ninguém");

    // ---------- 3) acertar a senha zera a contagem ----------
    await erradas(usuarioDe(bia), LIMITE_DE_ERROS - 1);
    assert((await login(usuarioDe(bia), "certa1234")).status === 200, "7 erros e depois a senha certa: entra");
    assert(!(await linha(`login:${usuarioDe(bia)}`)), "acertar a senha apaga a contagem");
    const depois = await erradas(usuarioDe(bia), LIMITE_DE_ERROS - 1);
    assert(depois.every((r) => r.status === 401), "depois de acertar, mais 7 erros não pausam (a contagem recomeçou do zero)");

    // ---------- 4) o tempo vence a janela e a pausa ----------
    await db.update(tentativasDeAcessoTable).set({ janelaInicio: new Date(Date.now() - 20 * 60_000) }).where(eq(tentativasDeAcessoTable.chave, `login:${usuarioDe(bia)}`));
    const aposJanela = await login(usuarioDe(bia), "errada999");
    assert(aposJanela.status === 401, "erros com mais de 15 minutos não somam: o próximo erro volta a ser só 'não confere'");
    assert((await linha(`login:${usuarioDe(bia)}`))?.falhas === 1, "a contagem recomeçou em 1");
    await db.update(tentativasDeAcessoTable).set({ bloqueadoAte: new Date(Date.now() - 1000) }).where(eq(tentativasDeAcessoTable.chave, `login:${usuarioDe(ana)}`));
    assert((await login(usuarioDe(ana), "certa1234")).status === 200, "passada a pausa, a senha certa entra");

    // ---------- 5) a Administração redefinindo a senha acaba com a pausa ----------
    await erradas(usuarioDe(cris), LIMITE_DE_ERROS);
    assert((await login(usuarioDe(cris), "certa1234")).status === 429, "Cris está pausada");
    const redefiniu = await call("POST", `/users/${cris.id}/password-reset`, tokenDe(admin, "ADMIN"), { reason: "esqueceu a senha" });
    assert(redefiniu.status === 200 && typeof redefiniu.body.senhaProvisoria === "string", "a Administração redefine a senha da pessoa pausada");
    assert((await login(usuarioDe(cris), redefiniu.body.senhaProvisoria)).status === 200, "com a provisória a pessoa entra: a pausa acabou junto");

    // ---------- 6) troca de senha: a senha atual errada também conta ----------
    const asDan = tokenDe(dan, "MEMBER");
    const trocas: number[] = [];
    for (let i = 0; i < LIMITE_DE_ERROS; i++) trocas.push((await call("POST", "/users/me/password", asDan, { currentPassword: "errada999", newPassword: "nova12345" })).status);
    assert(trocas.slice(0, LIMITE_DE_ERROS - 1).every((s) => s === 401) && trocas[LIMITE_DE_ERROS - 1] === 429, `troca de senha: 7 erros dão 401 e o 8º pausa com 429 (${trocas.join(",")})`);
    const certaNaTroca = await call("POST", "/users/me/password", asDan, { currentPassword: "certa1234", newPassword: "nova12345" });
    assert(certaNaTroca.status === 429 && certaNaTroca.body.error === "TENTATIVAS_DEMAIS", "na pausa a troca de senha recusa até a senha atual certa");
    assert((await registrosDe(dan.id)).length === 1 && /troca de senha/.test(String((await registrosDe(dan.id))[0]!.narrative)), "a pausa da troca de senha entra no Registro dizendo que foi na troca");
    assert((await login(usuarioDe(dan), "certa1234")).status === 200, "a pausa da troca não impede o login normal (são chaves separadas)");

    // ---------- 7) corrida: 10 erros ao mesmo tempo contam um de cada vez ----------
    const juntos = await Promise.all(Array.from({ length: 10 }, () => login(usuarioDe(eva), "errada999")));
    assert(juntos.filter((r) => r.status === 429).length === 1, `10 erros simultâneos: só um é o que passa do limite (429 = ${juntos.filter((r) => r.status === 429).length})`);
    assert((await linha(`login:${usuarioDe(eva)}`))?.falhas === LIMITE_DE_ERROS, "a contagem parou no limite, sem passar dele por corrida");
    assert((await registrosDe(eva.id)).length === 1 && (await avisosDe(admin.id)).filter((a) => a.entityId === eva.id).length === 1, "corrida: um Registro e um aviso por pausa");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(tentativasDeAcessoTable).where(inArray(tentativasDeAcessoTable.chave, chaves()));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(securityAuditLogTable).where(or(inArray(securityAuditLogTable.actorId, everyone), and(isNull(securityAuditLogTable.actorId), like(securityAuditLogTable.metadata, "%account_locked%"), gte(securityAuditLogTable.createdAt, inicio))));
    await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, everyone));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, everyone));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no limite de tentativas de senha`);
  process.stdout.write(`tentativas-de-acesso: ${passed} asserts passed\n`);
}

process.stdout.write("tentativas-de-acesso: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
