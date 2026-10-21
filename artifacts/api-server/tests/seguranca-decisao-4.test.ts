/** Decisão 4 da revisão de segurança (21/10/2026): limite por conexão no "esqueci minha senha", rota de relatório de CSP e a política só-relatar no site. */
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray, like } from "drizzle-orm";
import { db, historyEventsTable, operationsTable, organizationsTable, pool, securityAuditLogTable, tentativasDeAcessoTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `dec4_${Date.now()}`;
  process.env.MYASA_LIMITE_DE_ESQUECI_POR_ORIGEM = "3";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (nome: string, role: "ADMIN" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: nome, username: `${tag}_${nome}`.toLowerCase() }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const admin = await mk("Admin", "ADMIN");
  const pessoas = [await mk("P1", "MEMBER"), await mk("P2", "MEMBER"), await mk("P3", "MEMBER"), await mk("P4", "MEMBER"), await mk("P5", "MEMBER")];
  const ipX = "203.0.113.50", ipY = "203.0.113.51";

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const esqueci = async (username: string, ip: string | null) => {
      const r = await fetch(`${base}/auth/esqueci-senha`, { method: "POST", signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) }, body: JSON.stringify({ username }) });
      return { status: r.status, texto: await r.text() };
    };
    const avisadas = async () => (await db.select({ id: historyEventsTable.entityId }).from(historyEventsTable).where(eq(historyEventsTable.action, "user.password_reset_requested"))).map((x) => x.id);

    const respostas = [] as string[];
    for (const p of pessoas.slice(0, 4)) {
      const r = await esqueci(p.username!, ipX);
      respostas.push(`${r.status} ${r.texto}`);
    }
    const foram = await avisadas();
    assert(foram.includes(pessoas[0]!.id) && foram.includes(pessoas[1]!.id), "os primeiros pedidos da conexão avisam a Administração");
    assert(!foram.includes(pessoas[2]!.id) && !foram.includes(pessoas[3]!.id), "depois do limite a conexão não gera mais avisos nem Registro");
    assert(new Set(respostas).size === 1 && respostas[0]!.startsWith("200"), "a resposta é a mesma, passando ou não do limite (quem está de fora não descobre nada)");
    const avisosAdmin = await db.select({ e: userNotificationsTable.entityId }).from(userNotificationsTable).where(eq(userNotificationsTable.userId, admin.id));
    assert(!avisosAdmin.some((a) => a.e === pessoas[3]!.id), "o sino da Administração não recebe aviso da conexão pausada");

    const outra = await esqueci(pessoas[2]!.username!, ipY);
    assert(outra.status === 200 && (await avisadas()).includes(pessoas[2]!.id), "outra conexão segue funcionando");
    await esqueci(pessoas[4]!.username!, null);
    assert((await avisadas()).includes(pessoas[4]!.id), "sem origem conhecida não há limite por origem");

    // Relatório de CSP: público, sempre 204, sem exigir login
    const ok = await fetch(`${base}/auth/csp-report`, { method: "POST", headers: { "content-type": "application/csp-report" }, body: JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "https://exemplo.test/x.js?token=segredo", "document-uri": "https://app.test/escalas?q=nome" } }) });
    assert(ok.status === 204, `relatório de CSP válido responde 204 (veio ${ok.status})`);
    const lixo = await fetch(`${base}/auth/csp-report`, { method: "POST", headers: { "content-type": "application/csp-report" }, body: "isto não é json" });
    assert(lixo.status === 204 || lixo.status === 400, `relatório quebrado não vira erro 500 (veio ${lixo.status})`);
    const vazio = await fetch(`${base}/auth/csp-report`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert(vazio.status === 204, `relatório vazio responde 204 (veio ${vazio.status})`);

    // A política do site é só-relatar: se alguém trocar por uma política que bloqueia, este teste avisa para conferir antes
    const vercel = JSON.parse(readFileSync(path.resolve(process.cwd(), "../web-admin/vercel.json"), "utf8")) as { headers: { headers: { key: string; value: string }[] }[] };
    const cabecalhos = vercel.headers.flatMap((h) => h.headers);
    const somenteRelatar = cabecalhos.find((h) => h.key === "Content-Security-Policy-Report-Only");
    assert(Boolean(somenteRelatar) && !cabecalhos.some((h) => h.key === "Content-Security-Policy"), "o site envia a CSP em modo só-relatar (ainda não bloqueia nada)");
    assert(Boolean(somenteRelatar?.value.includes("frame-src https://drive.google.com https://docs.google.com")) && Boolean(somenteRelatar?.value.includes("report-uri /api/auth/csp-report")), "a política libera o Drive embutido e manda os relatórios para a API");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const tente = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* sobra de teste */ } };
    const ids = [admin.id, ...pessoas.map((p) => p.id)];
    await tente(() => db.delete(tentativasDeAcessoTable).where(like(tentativasDeAcessoTable.chave, "esqueci:203.0.113.%")));
    await tente(() => db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, ids)));
    await tente(() => db.delete(securityAuditLogTable).where(like(securityAuditLogTable.targetResource, "esqueci_senha_por_origem%")));
    await tente(() => db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id)));
    await tente(() => db.delete(userRolesTable).where(inArray(userRolesTable.userId, ids)));
    await tente(() => db.delete(usersTable).where(inArray(usersTable.id, ids)));
    await tente(() => db.delete(operationsTable).where(eq(operationsTable.id, operation!.id)));
    await tente(() => db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id)));
    delete process.env.MYASA_LIMITE_DE_ESQUECI_POR_ORIGEM;
  }
  if (failures.length) throw new Error(`${failures.length} falha(s) na decisão 4`);
  process.stdout.write(`seguranca-decisao-4: ${passed} verificações passaram\n`);
}

run().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => { await pool.end(); });
