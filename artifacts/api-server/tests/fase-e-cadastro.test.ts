/**
 * Cadastro pela tela Pessoas/Áreas/Locais (01/10): pessoa nasce com perfil, área, login e senha provisória;
 * troca de perfil com motivo; supervisão por área e local; local novo já ligado à operação.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, operationLocationsTable,
  operationsTable, organizationsTable, pool, refreshTokensTable, securityAuditLogTable, userRolesTable, usersTable,
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
  const tag = `cad_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [op2] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const [pausada] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_pausada`, status: "PAUSED" }).returning();
  const [pat] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const [barbara] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Barbara", fullName: `Barbara ${tag}`, username: `${tag}_barbara` }).returning();
  await db.insert(userRolesTable).values({ userId: barbara!.id, operationId: op!.id, role: "ADMIN", active: true });
  const [deb] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Deborah", fullName: `Deborah ${tag}`, username: `${tag}_deborah`, areaId: pat!.id }).returning();
  await db.insert(userRolesTable).values({ userId: deb!.id, operationId: op!.id, role: "SUPERVISOR_A", active: true });
  const criados: string[] = [];
  const locaisCriados: string[] = [];

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
    const asBarbara = tk(barbara!, "ADMIN"), asDeb = tk(deb!, "SUPERVISOR_A");

    // ── Criar pessoa com perfil ──
    assert((await call("POST", "/users", asDeb, { fullName: "Alguém", perfil: "MEM", areaId: pat!.id })).status === 403, "Supervisão não cadastra pessoa");
    assert((await call("POST", "/users", asBarbara, { fullName: "Alguém", perfil: "CHEFE", areaId: pat!.id })).status === 400, "perfil inválido é recusado");
    assert((await call("POST", "/users", asBarbara, { fullName: "Alguém Sem Área", perfil: "MEM" })).status === 400, "Elenco sem área é recusado");
    assert((await call("POST", "/users", asBarbara, { fullName: "Alguém", perfil: "MEM", areaId: "00000000-0000-4000-8000-000000000000" })).status === 400, "área de fora é recusada");
    const julia = await call("POST", "/users", asBarbara, { fullName: `Julia Teste ${tag}`, perfil: "MEM", areaId: pat!.id });
    assert(julia.status === 201 && typeof julia.body.username === "string" && typeof julia.body.senhaProvisoria === "string" && julia.body.user?.profile === "MEM", "Elenco criado com área, login e senha provisória");
    criados.push(julia.body.user.id);
    const papeis = await db.select().from(userRolesTable).where(and(eq(userRolesTable.userId, julia.body.user.id), eq(userRolesTable.active, true)));
    assert(papeis.length === 2 && papeis.every((p) => p.role === "MEMBER") && !papeis.some((p) => p.operationId === pausada!.id), "o perfil vale em cada operação ativa (e não na pausada)");
    const [linhaJulia] = await db.select().from(usersTable).where(eq(usersTable.id, julia.body.user.id));
    assert(linhaJulia?.areaId === pat!.id && linhaJulia.mustChangePassword === true && linhaJulia.status === "ACTIVE", "nasce ativa, na área, com troca de senha obrigatória");
    const login = await call("POST", "/auth/login", null, { username: julia.body.username, password: julia.body.senhaProvisoria });
    assert(login.status === 200 && Array.isArray(login.body.roles) && login.body.roles.some((r: { role: string }) => r.role === "MEMBER"), "a pessoa entra no app com o login e a senha gerados");
    const [registroCriacao] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, julia.body.user.id), eq(historyEventsTable.action, "user.created")));
    assert(Boolean(registroCriacao) && registroCriacao!.narrative.includes("Elenco") && !JSON.stringify(registroCriacao).includes(julia.body.senhaProvisoria), "o cadastro entra no Registro com o perfil, sem a senha");
    // Cadastro inicial (06/10): login e nome de uso que a casa já usa.
    const loginCasa = `simon.${Date.now()}`;
    const simon = await call("POST", "/users", asBarbara, { fullName: `Claudio Simon Teste ${tag}`, perfil: "MEM", areaId: pat!.id, login: loginCasa, nomeDeUso: "Simon" });
    assert(simon.status === 201 && simon.body.username === loginCasa, "a Administração pode trazer o login que a casa já usa");
    if (simon.body.user?.id) criados.push(simon.body.user.id);
    const [linhaSimon] = simon.body.user?.id ? await db.select().from(usersTable).where(eq(usersTable.id, simon.body.user.id)) : [];
    assert(linhaSimon?.name === "Simon", "e o nome de uso inicial (depois a pessoa muda no Perfil)");
    assert((await call("POST", "/users", asBarbara, { fullName: `Outro ${tag}`, perfil: "MEM", areaId: pat!.id, login: loginCasa })).status === 409, "login repetido é recusado");
    const dir = await call("POST", "/users", asBarbara, { fullName: `Cris Teste ${tag}`, perfil: "DIR" });
    assert(dir.status === 201 && dir.body.user?.profile === "DIR", "Direção pode nascer sem área");
    criados.push(dir.body.user.id);
    const lista = await call("GET", "/users", asBarbara);
    const naLista = (lista.body.users as { id: string; profile: string | null; username: string | null }[]).find((u) => u.id === julia.body.user.id);
    assert(naLista?.profile === "MEM" && naLista.username === julia.body.username, "a lista da Administração mostra perfil e login");
    // Como a tela antiga criava: com senha e sem perfil (a pessoa existia, mas não entrava).
    const semPerfil = await call("POST", "/users", asBarbara, { fullName: `Sem Perfil ${tag}`, password: "senha-antiga-123" });
    criados.push(semPerfil.body.user.id);
    assert((lista.body.users as { profile: string | null }[]).length > 0 && (await call("GET", "/users", asBarbara)).body.users.find((u: { id: string }) => u.id === semPerfil.body.user.id)?.profile === null, "cadastro antigo, sem perfil, aparece como sem perfil");

    // ── Trocar perfil ──
    assert((await call("PUT", `/users/${julia.body.user.id}/perfil`, asBarbara, { perfil: "SUP" })).status === 400, "trocar perfil sem motivo é recusado");
    assert((await call("PUT", `/users/${julia.body.user.id}/perfil`, asDeb, { perfil: "SUP", reason: "x" })).status === 403, "Supervisão não troca perfil");
    assert((await call("PUT", `/users/${barbara!.id}/perfil`, asBarbara, { perfil: "MEM", reason: "x" })).status === 403, "ninguém troca o próprio perfil");
    const troca = await call("PUT", `/users/${julia.body.user.id}/perfil`, asBarbara, { perfil: "SUP", reason: "assumiu a supervisão" });
    assert(troca.status === 200 && troca.body.anterior === "MEM", "Elenco vira Supervisão, com motivo");
    const depois = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, julia.body.user.id));
    assert(depois.filter((p) => p.active).every((p) => p.role === "SUPERVISOR_A") && depois.filter((p) => p.active).length === 2 && depois.filter((p) => !p.active && p.role === "MEMBER").length === 2, "o vínculo antigo fica desativado (não apagado) e o novo vale nas operações ativas");
    const [registroTroca] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, julia.body.user.id), eq(historyEventsTable.action, "user.perfil_changed")));
    assert(Boolean(registroTroca) && registroTroca!.narrative.includes("assumiu a supervisão"), "a troca entra no Registro com o motivo");
    assert((await call("PUT", `/users/${semPerfil.body.user.id}/perfil`, asBarbara, { perfil: "DIR" })).status === 200, "dar perfil a quem não tinha não exige motivo");

    // ── Local novo e supervisão por área e local ──
    const local = await call("POST", "/locations", asBarbara, { name: `${tag}_Snowland` });
    assert(local.status === 201, "Administração cria local");
    locaisCriados.push(local.body.location.id);
    const ligacoes = await db.select().from(operationLocationsTable).where(and(eq(operationLocationsTable.locationId, local.body.location.id), eq(operationLocationsTable.active, true)));
    assert(ligacoes.length === 2 && ligacoes.every((l) => [op!.id, op2!.id].includes(l.operationId)), "local novo já fica ligado às operações ativas");
    assert((await call("PUT", `/areas/${pat!.id}/locations/${local.body.location.id}/supervisor`, asBarbara, { supervisorId: dir.body.user.id })).status === 400, "quem não tem perfil Supervisão não supervisiona");
    const sup = await call("PUT", `/areas/${pat!.id}/locations/${local.body.location.id}/supervisor`, asBarbara, { supervisorId: julia.body.user.id });
    assert(sup.status === 201, "Supervisão é definida para a área naquele local");
    const mapa = await call("GET", `/areas/${pat!.id}/local-supervisors`, asBarbara);
    assert(mapa.body.supervisors?.some((s: { supervisorId: string; locationId: string }) => s.supervisorId === julia.body.user.id && s.locationId === local.body.location.id), "a supervisão aparece no mapa da área");
    assert((await call("DELETE", `/areas/${pat!.id}/locations/${local.body.location.id}/supervisor`, asBarbara)).status === 200, "supervisão pode ser retirada");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const todos = [barbara!.id, deb!.id, ...criados];
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, todos));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.areaId, pat!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, todos));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.operationId, [op!.id, op2!.id, pausada!.id]));
    if (locaisCriados.length) await db.delete(locationsTable).where(inArray(locationsTable.id, locaisCriados));
    await db.delete(areasTable).where(eq(areasTable.id, pat!.id));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [op!.id, op2!.id, pausada!.id]));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no cadastro`);
  process.stdout.write(`fase-e-cadastro: ${passed} asserts passed\n`);
}

process.stdout.write("fase-e-cadastro: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
