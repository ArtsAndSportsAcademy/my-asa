/** Fase C (C6) — Registro: só ADM/DIR, sempre recortado pela organização, filtros e nenhum segredo na leitura. PostgreSQL real de teste. */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  db,
  historyEventsTable,
  historyNarrativesTable,
  operationsTable,
  organizationsTable,
  pool,
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
  const tag = `registro_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outra] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [op2] = await db.insert(operationsTable).values({ organizationId: outra!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const mk = async (name: string, role: string, orgId = org!.id, opId = op!.id) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name, fullName: `${name} ${tag}`, username: `${tag}_${name}`.toLowerCase() }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: opId, role: role as never, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN");
  const cris = await mk("Cris", "DIR");
  const deborah = await mk("Deborah", "SUPERVISOR_A");
  const julia = await mk("Julia", "MEMBER");
  const alheia = await mk("Alheia", "ADMIN", outra!.id, op2!.id);
  const everyone = [barbara, cris, deborah, julia, alheia].map((u) => u.id);

  const ev = async (values: Partial<typeof historyEventsTable.$inferInsert>) => (await db.insert(historyEventsTable).values({ category: "OPERATIONAL_CHANGE", title: "", narrative: "", entityType: "user", entityId: julia.id, action: "user.updated", ...values }).returning())[0]!;
  // Linha antiga gravada antes do filtro de escrita: traz hash no antes/depois.
  const antiga = await ev({ orgId: org!.id, actorId: barbara.id, actorName: barbara.fullName, title: "Cadastro de pessoa atualizado", narrative: `O cadastro de Julia foi atualizado.`, beforeState: { name: "Julia", passwordHash: "$2b$12$abcdefghijklmnopqrstuv" }, afterState: { name: "Ju", passwordHash: "$2b$12$abcdefghijklmnopqrstuv" }, occurredAt: new Date("2026-10-01T12:00:00Z") });
  const semOrg = await ev({ orgId: null, actorId: julia.id, actorName: julia.fullName, title: "Figurino entregue", narrative: "Julia entregou o figurino do YETI.", entityType: "delivery", entityId: "d1", action: "delivery.created", occurredAt: new Date("2026-10-02T12:00:00Z") });
  const deFora = await ev({ orgId: outra!.id, actorId: alheia.id, actorName: alheia.fullName, title: "Evento de outra organização", narrative: "Não pode vazar.", entityType: "scale", entityId: "s1", action: "escala.publicada", occurredAt: new Date("2026-10-03T12:00:00Z") });
  await ev({ orgId: org!.id, actorId: cris.id, actorName: cris.fullName, title: "Escala publicada", narrative: "Escala de Snowland publicada.", entityType: "scale", entityId: "s2", action: "escala.publicada", occurredAt: new Date("2026-10-04T12:00:00Z") });
  const [narrativaFora] = await db.insert(historyNarrativesTable).values({ orgId: outra!.id, title: `${tag} narrativa de fora`, createdBy: alheia.id }).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const as = (user: { id: string; organizationId: string }, role: string, opId = op!.id) => signAccessToken({ sub: user.id, jti: `${tag}_${Math.random()}`, organizationId: user.organizationId, role, operationIds: [opId] });
    const get = async (path: string, token: string) => {
      const r = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}` } });
      return { status: r.status, body: (await r.json()) as Record<string, any> };
    };
    const asBarbara = as(barbara, "ADMIN");

    // Quem lê
    const adm = await get("/history?limit=200", asBarbara);
    assert(adm.status === 200, "Administração lê o Registro");
    assert((await get("/history", as(cris, "DIR"))).status === 200, "Direção lê o Registro");
    assert((await get("/history", as(deborah, "SUPERVISOR_A"))).status === 403, "Supervisão não lê o Registro (contém o antes de tudo)");
    assert((await get("/history", as(julia, "MEMBER"))).status === 403, "Elenco não lê o Registro");

    // Recorte por organização
    const ids = (adm.body.events as { id: string }[]).map((e) => e.id);
    assert(!ids.includes(deFora.id), "evento de outra organização não aparece");
    assert(ids.includes(antiga.id) && ids.includes(semOrg.id), "eventos da organização aparecem, inclusive os antigos sem org_id (pelo ator)");
    assert((await get(`/history/${deFora.id}`, asBarbara)).status === 404, "abrir evento de outra organização responde 404");
    assert((await get(`/history/${antiga.id}`, asBarbara)).status === 200, "abrir evento da própria organização responde 200");
    assert((await get("/history/narratives", asBarbara)).body.narratives.every((n: { id: string }) => n.id !== narrativaFora!.id), "narrativa de outra organização não aparece");
    assert((await get(`/history/narratives/${narrativaFora!.id}`, asBarbara)).status === 404, "abrir narrativa de outra organização responde 404");

    // Segredos
    const lida = (adm.body.events as { id: string }[]).find((e) => e.id === antiga.id);
    assert(Boolean(lida) && !JSON.stringify(lida).includes("passwordHash") && !JSON.stringify(lida).includes("$2b$"), "linha antiga com hash sai sem o hash na lista");
    assert(!JSON.stringify((await get(`/history/${antiga.id}`, asBarbara)).body).includes("$2b$"), "linha antiga com hash sai sem o hash no detalhe");
    assert((lida as any)?.afterState?.name === "Ju" && (lida as any)?.beforeState?.name === "Julia", "o antes/depois do que mudou continua legível");

    // Filtros
    const busca = await get(`/history?q=figurino`, asBarbara);
    assert(busca.body.events.length === 1 && busca.body.events[0].id === semOrg.id, "busca por texto acha pelo título/narrativa");
    const porAtor = await get(`/history?actorId=${cris.id}`, asBarbara);
    assert(porAtor.body.events.length === 1 && porAtor.body.events[0].action === "escala.publicada", "filtro por quem fez");
    const porAcao = await get(`/history?action=escala.`, asBarbara);
    assert(porAcao.body.events.length === 1, "filtro por tipo de ação (prefixo), sem trazer a de outra organização");
    const porAssunto = await get(`/history?entityType=user,delivery`, asBarbara);
    assert(porAssunto.body.events.length === 2 && porAssunto.body.events.every((e: { entityType: string }) => ["user", "delivery"].includes(e.entityType)), "filtro por assunto aceita vários tipos");
    const porPeriodo =await get(`/history?dateFrom=2026-10-02T00:00:00Z&dateTo=2026-10-03T23:59:59Z`, asBarbara);
    assert(porPeriodo.body.events.length === 1 && porPeriodo.body.events[0].id === semOrg.id, "filtro por período");
    const pagina = await get(`/history?limit=2`, asBarbara);
    assert(pagina.body.events.length === 2 && pagina.body.hasMore === true, "paginação avisa que há mais");
    assert((await get(`/history?limit=2&offset=2`, asBarbara)).body.hasMore === false, "última página avisa que acabou");
    assert((await get(`/history?q=${encodeURIComponent("%")}`, asBarbara)).status === 200, "caractere curinga na busca não quebra a consulta");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(inArray(historyEventsTable.orgId, [org!.id, outra!.id]), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(historyNarrativesTable).where(inArray(historyNarrativesTable.orgId, [org!.id, outra!.id]));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [op!.id, op2!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outra!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no Registro`);
  process.stdout.write(`fase-c-registro: ${passed} asserts passed\n`);
}

process.stdout.write("fase-c-registro: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
