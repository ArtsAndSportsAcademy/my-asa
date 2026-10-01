/**
 * Fase D (D3) — a lista do doc 12 (12-seguranca-antes-do-lancamento.md), item por item, com teste.
 * PostgreSQL real de teste. Cada bloco cita o item do doc.
 */
import http from "node:http";
import bcrypt from "bcryptjs";
import pino from "pino";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  historyEventsTable,
  leaveRequestsTable,
  locationsTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  refreshTokensTable,
  scalesTable,
  securityAuditLogTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { getRefreshTTLSeconds, signAccessToken } from "../src/lib/jwt.service.js";
import { logger, serializarErro } from "../src/lib/logger.js";
import { montarEscalaDoDia } from "../src/services/escala-dia.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `seg_${Date.now()}`;
  const date = "2026-10-14";
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const SENHA = "senha-de-teste-123";
  const hash = await bcrypt.hash(SENHA, 4);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  const [acqua] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Acquamotion` }).returning();
  await db.insert(operationLocationsTable).values([{ operationId: op!.id, locationId: snow!.id }, { operationId: op!.id, locationId: acqua!.id }]);
  const [pat] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const [bai] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Bailarinos` }).returning();
  const mk = async (name: string, role: string, areaId: string | null) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, fullName: `${name} ${tag}`, username: `${tag}_${name}`.toLowerCase(), areaId, passwordHash: hash }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role: role as never, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN", null);
  const cris = await mk("Cris", "DIR", null);
  const deborah = await mk("Deborah", "SUPERVISOR_A", pat!.id);
  const victor = await mk("Victor", "SUPERVISOR_A", bai!.id);
  const stephani = await mk("Stephani", "SUPERVISOR_A", bai!.id);
  const julia = await mk("Julia", "MEMBER", pat!.id);
  const carol = await mk("Carol", "MEMBER", pat!.id);
  const louis = await mk("Louis", "MEMBER", bai!.id);
  const everyone = [barbara, cris, deborah, victor, stephani, julia, carol, louis].map((u) => u.id);
  // Bailarinos tem supervisão diferente por local: Victor em Snowland, Stephani em Acquamotion (doc 12, "caso torto").
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: snow!.id, supervisorId: deborah.id },
    { areaId: bai!.id, locationId: snow!.id, supervisorId: victor.id },
    { areaId: bai!.id, locationId: acqua!.id, supervisorId: stephani.id },
  ]);
  const progs = await db.insert(programacoesTable).values([
    { organizationId: org!.id, locationId: snow!.id, nome: `${tag}_snow`, vigenciaInicio: date, vigenciaFim: date, createdBy: barbara.id },
    { organizationId: org!.id, locationId: acqua!.id, nome: `${tag}_acqua`, vigenciaInicio: date, vigenciaFim: date, createdBy: barbara.id },
  ]).returning();
  await db.insert(programacaoBlocosTable).values([
    { programacaoId: progs[0]!.id, weekday, inicio: "09:40", fim: "11:00", rotulo: "ENSAIO", regra: "area", areaIds: [bai!.id] },
    { programacaoId: progs[1]!.id, weekday, inicio: "09:40", fim: "11:00", rotulo: "ENSAIO", regra: "area", areaIds: [bai!.id] },
  ]);
  const [escala] = await db.insert(scalesTable).values({ operationId: op!.id, locationId: snow!.id, title: `${tag}_escala`, periodStart: date, periodEnd: date, status: "DRAFT", createdBy: barbara.id }).returning();
  const blocoSnow = (await montarEscalaDoDia(org!.id, snow!.id, date))!.blocos[0]!;
  const [pedidoJulia] = await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: julia.id, areaId: pat!.id, startDate: "2026-10-20", endDate: "2026-10-20", reason: `${tag} consulta médica` }).returning();
  await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: carol.id, areaId: pat!.id, startDate: "2026-10-20", endDate: "2026-10-20", reason: `${tag} assunto pessoal da Carol` });

  // Captura tudo o que o logger escreve durante o teste (doc 12: senha nunca em log).
  const streamSym = (pino as unknown as { symbols: { streamSym: symbol } }).symbols.streamSym;
  const loggerComStream = logger as unknown as Record<symbol, { write: (s: string) => void }>;
  const streamOriginal = loggerComStream[streamSym];
  let logs = "";
  loggerComStream[streamSym] = { write: (s: string) => { logs += s; } };

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
      return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
    };
    const asJulia = tk(julia, "MEMBER"), asDeborah = tk(deborah, "SUPERVISOR_A"), asVictor = tk(victor, "SUPERVISOR_A"), asStephani = tk(stephani, "SUPERVISOR_A"), asCris = tk(cris, "DIR"), asBarbara = tk(barbara, "ADMIN");

    // ── Item "Permissão checada no servidor": Elenco pedindo dado de outra pessoa → 403 ──
    assert((await call("GET", `/users/${carol.id}`, asJulia)).status === 403, "Elenco não abre a ficha de outra pessoa");
    assert((await call("PATCH", `/users/${carol.id}`, asJulia, { phone: "123" })).status === 403, "Elenco não edita outra pessoa");
    assert((await call("POST", "/day-checkins", asJulia, { scaleId: escala!.id, sourceKey: blocoSnow.key, userId: carol.id, status: "CHECKED_IN" })).status === 403, "Elenco não marca presença de outra pessoa");
    const pedidos = await call("GET", `/leave-requests?from=2026-10-01&to=2026-10-31`, asJulia);
    assert(pedidos.status === 200 && pedidos.body.requests.length === 1 && pedidos.body.requests[0].userId === julia.id && !pedidos.text.includes("assunto pessoal da Carol"), "Elenco vê só o próprio pedido de folga — nunca o motivo de outra pessoa");
    assert((await call("PATCH", `/leave-requests/${pedidoJulia!.id}`, asJulia, { status: "APPROVED", decisionReason: "eu mesma" })).status === 403, "Elenco não decide pedido de folga, nem o próprio");
    assert((await call("GET", `/day-checkins?locationId=${snow!.id}`, asJulia)).status === 403, "Elenco não vê o check-in do local inteiro");
    assert((await call("GET", `/escalas/dia?locationId=${snow!.id}&date=${date}`, asJulia)).status === 403, "Elenco não vê a grade do local (só a própria escala)");
    assert((await call("POST", "/escalas/dia/pronta", asJulia, { locationId: snow!.id, date, areaId: pat!.id, pronta: true })).status === 403, "Elenco não marca área pronta");
    assert((await call("GET", "/history", asJulia)).status === 403, "Elenco não lê o Registro");

    // ── Item "Escopo do supervisor é real" ──
    assert((await call("POST", "/escalas/dia/pronta", asDeborah, { locationId: snow!.id, date, areaId: bai!.id, pronta: true })).status === 403, "Deborah (Patinadores) não marca Bailarinos como pronta");
    assert((await call("POST", "/escalas/dia/ajustes", asDeborah, { locationId: snow!.id, date, sourceKey: blocoSnow.key, userId: louis.id, action: "REMOVER" })).status === 403, "Deborah não mexe na escala de quem é de Bailarinos");
    assert((await call("POST", "/escalas/dia/pronta", asVictor, { locationId: acqua!.id, date, areaId: bai!.id, pronta: true })).status === 403, "Victor (Bailarinos em Snowland) não escreve em Acquamotion");
    assert((await call("POST", "/escalas/dia/ajustes", asVictor, { locationId: acqua!.id, date, sourceKey: blocoSnow.key, userId: louis.id, action: "REMOVER" })).status === 403, "Victor não ajusta a escala de Acquamotion");
    assert((await call("GET", `/escalas/dia?locationId=${acqua!.id}&date=${date}`, asVictor)).status === 403, "Victor não lê a grade de Acquamotion");
    assert((await call("PATCH", `/programacoes/${progs[1]!.id}`, asVictor, { nome: "invadido" })).status === 403, "Victor não muda a Programação de Acquamotion");
    assert((await call("POST", "/escalas/dia/pronta", asStephani, { locationId: acqua!.id, date, areaId: bai!.id, pronta: true })).status === 200, "Stephani, que responde por Bailarinos em Acquamotion, marca a área pronta lá (controle positivo)");
    assert((await call("PATCH", `/leave-requests/${pedidoJulia!.id}`, asVictor, { status: "APPROVED", decisionReason: "ok" })).status === 403, "Victor não decide folga de quem é de Patinadores");

    // ── Item "Direção é leitura" ──
    assert((await call("GET", `/escalas/dia?locationId=${snow!.id}&date=${date}`, asCris)).status === 200, "Direção lê a escala");
    assert((await call("POST", "/escalas/dia/pronta", asCris, { locationId: snow!.id, date, areaId: pat!.id, pronta: true })).status === 403, "Direção não marca área pronta");
    assert((await call("POST", "/escalas/dia/ajustes", asCris, { locationId: snow!.id, date, sourceKey: blocoSnow.key, userId: louis.id, action: "REMOVER" })).status === 403, "Direção não ajusta escala");
    assert((await call("POST", `/escalas/${escala!.id}/publicar`, asCris, { expectedVersion: escala!.version })).status === 403, "Direção não publica escala");
    assert((await call("POST", "/escalas/dia/gerar", asCris, { locationId: snow!.id, date })).status === 403, "Direção não gera o dia");
    assert((await call("PATCH", `/programacoes/${progs[0]!.id}`, asCris, { nome: "x" })).status === 403, "Direção não muda a Programação");
    assert((await call("POST", "/leave-calendar", asCris, { userId: julia.id, startDate: "2026-10-21", endDate: "2026-10-21", reason: "x" })).status === 403, "Direção não lança folga");
    assert((await call("PATCH", `/users/${julia.id}`, asCris, { phone: "1" })).status === 403, "Direção não edita cadastro");
    assert((await call("POST", "/users", asCris, { fullName: "Alguém" })).status === 403, "Direção não cria conta");

    // ── Seção 3: conta é criada pela Administração; trocar perfil exige motivo ──
    assert((await call("POST", "/users", asDeborah, { fullName: "Alguém" })).status === 403, "Supervisão não cria conta");
    assert((await call("POST", "/users", null, { fullName: "Alguém" })).status === 401, "sem autocadastro: sem sessão não cria conta");
    const semMotivo = await call("POST", `/users/${julia.id}/roles`, asBarbara, { operationId: op!.id, role: "SUPERVISOR_A" });
    assert(semMotivo.status === 400 && semMotivo.body.error === "REASON_REQUIRED", "trocar o perfil de alguém exige motivo");

    // ── Item "Senha nunca em texto puro" ──
    const [linha] = await db.select({ h: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, julia.id));
    assert(Boolean(linha?.h?.startsWith("$2")) && linha?.h !== SENHA, "no banco, a senha é hash bcrypt");
    const errada = await call("POST", "/auth/login", null, { username: julia.username, password: "segredo-errado-XYZ" });
    assert(errada.status === 401 && !errada.text.includes("segredo-errado-XYZ"), "resposta de login errado não devolve a senha");
    const certa = await call("POST", "/auth/login", null, { username: julia.username, password: SENHA });
    assert(certa.status === 200 && !certa.text.includes(SENHA) && !certa.text.includes("$2"), "resposta de login certo não traz senha nem hash");
    const troca = await call("POST", "/users/me/password", certa.body.accessToken, { currentPassword: SENHA, newPassword: "nova-senha-ABC987", refreshToken: certa.body.refreshToken });
    assert(troca.status === 200 && !troca.text.includes("nova-senha-ABC987"), "trocar senha não devolve a senha");
    logger.info({ body: { password: "plain-ZZZ-1", nested: { refreshToken: "tok-ZZZ-2" } } }, "teste de máscara");
    logger.error({ err: Object.assign(new Error(`Failed query: insert into "users" ("password_hash") values ($1)\nparams: $2b$12$hashDeTesteZZZ`), { params: ["$2b$12$hashDeTesteZZZ"] }) }, "teste de erro de consulta");
    const erroSerializado = JSON.stringify(serializarErro(Object.assign(new Error("Failed query: x\nparams: segredo-param-ZZZ"), { params: ["segredo-param-ZZZ"] })));
    assert(!erroSerializado.includes("segredo-param-ZZZ") && erroSerializado.includes("[ocultos]"), "erro de consulta vai para o log sem os parâmetros");
    for (const segredo of [SENHA, "segredo-errado-XYZ", "nova-senha-ABC987", "plain-ZZZ-1", "tok-ZZZ-2", "$2b$12$hashDeTesteZZZ"]) {
      assert(!logs.includes(segredo), `o log não contém "${segredo.slice(0, 12)}…"`);
    }
    assert(logs.length > 0 && logs.includes("teste de erro de consulta"), "o log foi de fato capturado (controle)");

    // ── Item "Sessão expira" (decidido: 30 dias sem abrir o app; cada uso renova) ──
    assert(getRefreshTTLSeconds() === 30 * 24 * 60 * 60, "a sessão vale 30 dias sem uso, como decidido");
    const sessao = await call("POST", "/auth/login", null, { username: carol.username, password: SENHA });
    await db.update(refreshTokensTable).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(refreshTokensTable.userId, carol.id));
    assert((await call("POST", "/auth/refresh", null, { refreshToken: sessao.body.refreshToken })).status === 401, "sessão vencida não renova: pede login de novo");

    // ── Seção 3 "Desligamento": sessão aberta cai na hora ──
    const aberta = await call("POST", "/auth/login", null, { username: louis.username, password: SENHA });
    assert((await call("GET", "/meu-dia", aberta.body.accessToken)).status === 200, "Louis está com a sessão aberta");
    assert((await call("DELETE", `/users/${louis.id}`, asBarbara, { reason: "saiu da companhia" })).status === 200, "Administração desliga o Louis, com motivo");
    assert((await call("GET", "/meu-dia", aberta.body.accessToken)).status === 401, "a próxima chamada do Louis falha na hora, sem esperar o token vencer");
    assert((await call("POST", "/auth/refresh", null, { refreshToken: aberta.body.refreshToken })).status === 401, "e a sessão não renova");
    const [louisDepois] = await db.select({ status: usersTable.status }).from(usersTable).where(eq(usersTable.id, louis.id));
    assert(louisDepois?.status === "INACTIVE", "a pessoa não é apagada: fica inativa, com o histórico");
    const blocoDepois = (await montarEscalaDoDia(org!.id, snow!.id, date))!.blocos[0]!;
    assert(!blocoDepois.pessoaIds.includes(louis.id), "quem foi desligado sai da escala");

    // ── Item 1, RLS: toda tabela do public com RLS e sem acesso anônimo ──
    const expostas = await pool.query<{ table_name: string }>(`
      SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
        AND (NOT c.relrowsecurity OR has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE'))`);
    assert(expostas.rows.length === 0, `todas as tabelas com RLS e sem acesso anônimo (expostas: ${expostas.rows.map((r) => r.table_name).join(", ") || "nenhuma"})`);
  } finally {
    loggerComStream[streamSym] = streamOriginal;
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone), inArray(historyEventsTable.entityId, everyone)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, everyone));
    await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, everyone));
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, op!.id));
    if (scales.length) {
      const ids = scales.map((s) => s.id);
      await pool.query("delete from escala_areas_prontas where scale_id = any($1::uuid[])", [ids]).catch(() => undefined);
      await pool.query("delete from escala_bloco_ajustes where scale_id = any($1::uuid[])", [ids]).catch(() => undefined);
      await pool.query("delete from day_check_ins where scale_id = any($1::uuid[])", [ids]).catch(() => undefined);
      await db.delete(scalesTable).where(inArray(scalesTable.id, ids));
    }
    await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(inArray(programacoesTable.id, progs.map((p) => p.id)));
    await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na lista de segurança do doc 12`);
  process.stdout.write(`fase-d-seguranca: ${passed} asserts passed\n`);
}

process.stdout.write("fase-d-seguranca: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
