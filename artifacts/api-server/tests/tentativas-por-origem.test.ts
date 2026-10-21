/** Limite de senha por origem (21/10/2026): erros de senha de usuários diferentes a partir da mesma conexão pausam a conexão; o limite por usuário segue como era. */
import http from "node:http";
import bcrypt from "bcryptjs";
import { eq, inArray, like } from "drizzle-orm";
import { db, historyEventsTable, operationsTable, organizationsTable, pool, refreshTokensTable, securityAuditLogTable, tentativasDeAcessoTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { limiteDeErrosPorOrigem, origemDaRequisicao } from "../src/lib/tentativas-de-acesso.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `orig_${Date.now()}`;
  // Origens de documentação (TEST-NET-3): nunca existem de verdade.
  const ipA = "203.0.113.7", ipB = "203.0.113.8", ipC = "203.0.113.9", ipD = "203.0.113.10";

  // Leitura da origem
  assert(origemDaRequisicao({ "x-vercel-forwarded-for": "198.51.100.4", "x-forwarded-for": "10.0.0.1" }) === "198.51.100.4", "o cabeçalho da Vercel vale primeiro");
  assert(origemDaRequisicao({ "x-forwarded-for": "198.51.100.5, 10.0.0.2, 10.0.0.3" }) === "198.51.100.5", "sem o da Vercel, vale o primeiro de x-forwarded-for");
  assert(origemDaRequisicao({}) === null && origemDaRequisicao({ "x-forwarded-for": "não é ip; drop table" }) === null, "sem cabeçalho, ou com lixo, não há origem (nunca se usa o endereço do proxy)");
  process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "5";
  assert(limiteDeErrosPorOrigem() === 5, "a variável muda o limite");
  process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "lixo";
  assert(limiteDeErrosPorOrigem() === 30, "valor inválido volta ao padrão de 30");
  process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "5";

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const hash = await bcrypt.hash("certa1234", 4);
  const [ana] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Ana", username: `${tag}_ana`, passwordHash: hash }).returning();
  await db.insert(userRolesTable).values({ userId: ana!.id, operationId: operation!.id, role: "MEMBER", active: true });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const entrar = async (username: string, password: string, ip: string | null) => {
      const r = await fetch(`${base}/auth/login`, { method: "POST", signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) }, body: JSON.stringify({ username, password }) });
      const corpo = await r.json().catch(() => ({})) as { message?: string; error?: string };
      return { status: r.status, corpo };
    };

    // 5 usuários DIFERENTES (que nem existem) errando a partir da mesma conexão: nenhum chega perto do limite por usuário
    for (let i = 1; i <= 4; i++) {
      const r = await entrar(`${tag}_fantasma${i}`, "errada", ipA);
      assert(r.status === 401, `erro ${i} de senha, usuários diferentes, mesma conexão: ainda 401 (veio ${r.status})`);
    }
    const quinto = await entrar(`${tag}_fantasma5`, "errada", ipA);
    assert(quinto.status === 429 && /desta conexão/.test(quinto.corpo.message ?? ""), `o 5º erro pausa a conexão e a frase fala da conexão (veio ${quinto.status}: ${quinto.corpo.message})`);
    const certaNaPausada = await entrar(`${tag}_ana`, "certa1234", ipA);
    assert(certaNaPausada.status === 429, `conexão pausada recusa até a senha certa (veio ${certaNaPausada.status})`);
    assert(!/senha errada|não conferem/i.test(certaNaPausada.corpo.message ?? "") && /pausada/.test(certaNaPausada.corpo.message ?? ""), "a frase diz a verdade: a conexão está pausada, não que a senha está errada");

    // Outra conexão não é afetada, e a conta da Ana não foi pausada pelos erros dos outros
    const outra = await entrar(`${tag}_ana`, "certa1234", ipB);
    assert(outra.status === 200, `outra conexão entra normalmente (veio ${outra.status})`);
    const [linhaAna] = await db.select().from(tentativasDeAcessoTable).where(eq(tentativasDeAcessoTable.chave, `login:${tag}_ana`));
    assert(!linhaAna || !linhaAna.bloqueadoAte, "a conta de quem estava só na mesma conexão não ficou pausada");

    // O limite por usuário continua valendo, de conexões que nunca chegam ao limite da origem (um erro por conexão)
    process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "30";
    let ultimo = { status: 0, corpo: {} as { message?: string } };
    for (let i = 0; i < 8; i++) ultimo = await entrar(`${tag}_ana`, "errada", `203.0.113.${100 + i}`);
    assert(ultimo.status === 429 && /conta fica pausada/.test(ultimo.corpo.message ?? ""), `8 erros na mesma conta, de conexões diferentes, pausam a CONTA (veio ${ultimo.status}: ${ultimo.corpo.message})`);

    // Sem cabeçalho de origem: só vale o limite por usuário
    process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "2";
    let semOrigem = 0;
    for (let i = 1; i <= 4; i++) semOrigem = (await entrar(`${tag}_semorigem${i}`, "errada", null)).status;
    assert(semOrigem === 401, `sem cabeçalho de origem não há limite por origem (veio ${semOrigem})`);

    // 0 desliga
    process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "0";
    let desligado = 0;
    for (let i = 1; i <= 4; i++) desligado = (await entrar(`${tag}_desl${i}`, "errada", ipC)).status;
    assert(desligado === 401, `com o limite em 0 a conexão não é pausada (veio ${desligado})`);

    // Acertar a senha não zera a conexão (senão quem tem uma conta própria apagaria a contagem)
    process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM = "4";
    for (let i = 1; i <= 2; i++) await entrar(`${tag}_zera${i}`, "errada", ipD);
    await entrar(`${tag}_ana2`, "errada", ipD).catch(() => undefined);
    const [linhaD] = await db.select().from(tentativasDeAcessoTable).where(eq(tentativasDeAcessoTable.chave, `origem:${ipD}`));
    assert((linhaD?.falhas ?? 0) >= 3, "a contagem da conexão acumula os erros de usuários diferentes");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const tente = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* sobra de teste */ } };
    await tente(() => db.delete(tentativasDeAcessoTable).where(like(tentativasDeAcessoTable.chave, `login:${tag}%`)));
    await tente(() => db.delete(tentativasDeAcessoTable).where(like(tentativasDeAcessoTable.chave, "origem:203.0.113.%")));
    await tente(() => db.delete(securityAuditLogTable).where(eq(securityAuditLogTable.actorId, ana!.id)));
    await tente(() => db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, ana!.id)));
    await tente(() => db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id)));
    await tente(() => db.delete(userRolesTable).where(inArray(userRolesTable.userId, [ana!.id])));
    await tente(() => db.delete(usersTable).where(eq(usersTable.id, ana!.id)));
    await tente(() => db.delete(operationsTable).where(eq(operationsTable.id, operation!.id)));
    await tente(() => db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id)));
    delete process.env.MYASA_LIMITE_DE_SENHA_POR_ORIGEM;
  }
  if (failures.length) throw new Error(`${failures.length} falha(s) no limite por origem`);
  process.stdout.write(`tentativas-por-origem: ${passed} verificações passaram\n`);
}

run().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => { await pool.end(); });
