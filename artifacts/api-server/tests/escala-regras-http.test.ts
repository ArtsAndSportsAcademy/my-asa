/** Regras de escala por local (16/10/2026): limite de shows por dia e intervalo de "colados" — contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaRegrasLocalTable, historyEventsTable, locationsTable, operationLocationsTable,
  operationalChangesTable, operationsTable, organizationsTable, pool, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Regras = { limiteShowsDia: number | null; intervaloMinimoMinutos: number; podeEditar: boolean };

async function run() {
  const tag = `escregras_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snowland, acqua] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: snowland!.id }, { operationId: operation!.id, locationId: acqua!.id }]);
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_A` }).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: snowland!.id,
  }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id), membro = await mk("membro", area!.id);
  const everyone = [admin, dir, sup, membro];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true }, { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true }, { userId: membro.id, operationId: operation!.id, role: "MEMBER", active: true },
  ]);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: snowland!.id, supervisorId: sup.id });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    };
    const asAdmin = as(admin.id, "ADMIN"), asDir = as(dir.id, "DIR"), asSup = as(sup.id, "SUPERVISOR_A"), asMembro = as(membro.id, "MEMBER");
    const ler = async (fn: typeof asAdmin, locationId: string) => fn(`/escala-regras?locationId=${locationId}`);
    const gravar = (fn: typeof asAdmin, body: unknown) => fn("/escala-regras", { method: "PUT", body: JSON.stringify(body) });

    // Local sem regra: padrões ("sem limite" e 20 minutos), nunca um número que bloqueie.
    const padrao = (await (await ler(asAdmin, snowland!.id)).json()) as Regras;
    assert(padrao.limiteShowsDia === null && padrao.intervaloMinimoMinutos === 20 && padrao.podeEditar === true, "local sem regra devolve 'sem limite', 20 minutos e a Administração pode editar");

    // Leitura por perfil.
    const daDirecao = (await (await ler(asDir, snowland!.id)).json()) as Regras;
    assert(daDirecao.podeEditar === false, "a Direção lê, sem editar");
    assert((await ler(asSup, snowland!.id)).status === 200 && (await ler(asSup, acqua!.id)).status === 403, "a Supervisão lê só o local em que responde por alguma área");
    assert((await ler(asMembro, snowland!.id)).status === 403, "o Elenco não vê as regras de escala");
    assert((await ler(asAdmin, "00000000-0000-0000-0000-000000000000")).status === 404, "local que não existe responde 404");

    // Gravar: só a Administração, com frase quando o número não serve.
    assert((await gravar(asSup, { locationId: snowland!.id, limiteShowsDia: 3 })).status === 403 && (await gravar(asDir, { locationId: snowland!.id, limiteShowsDia: 3 })).status === 403, "Supervisão e Direção não gravam as regras");
    const zero = await gravar(asAdmin, { locationId: snowland!.id, limiteShowsDia: 0 });
    const zeroBody = (await zero.json()) as { message?: string };
    assert(zero.status === 400 && /1 a 20 shows por dia; deixe em branco/.test(zeroBody.message ?? ""), "limite 0 é recusado com a frase (0 nunca significa 'ninguém pode')");
    assert((await gravar(asAdmin, { locationId: snowland!.id, limiteShowsDia: 21 })).status === 400 && (await gravar(asAdmin, { locationId: snowland!.id, limiteShowsDia: 2.5 })).status === 400, "limite acima de 20 ou quebrado é recusado");
    assert((await gravar(asAdmin, { locationId: snowland!.id, intervaloMinimoMinutos: 241 })).status === 400 && (await gravar(asAdmin, { locationId: snowland!.id, intervaloMinimoMinutos: -1 })).status === 400, "intervalo fora de 0 a 240 minutos é recusado");
    assert((await gravar(asAdmin, { limiteShowsDia: 3 })).status === 400, "sem o local a gravação é recusada");

    const tres = await gravar(asAdmin, { locationId: snowland!.id, limiteShowsDia: 3 });
    assert(tres.status === 200 && ((await tres.json()) as Regras).limiteShowsDia === 3, "a Administração define 3 shows por dia no Snowland");
    assert(((await (await ler(asAdmin, snowland!.id)).json()) as Regras).limiteShowsDia === 3 && ((await (await ler(asAdmin, acqua!.id)).json()) as Regras).limiteShowsDia === null, "o limite vale só para o local, o Acquamotion segue sem limite");
    const intervalo = await gravar(asAdmin, { locationId: snowland!.id, intervaloMinimoMinutos: 10 });
    const depois = (await intervalo.json()) as Regras;
    assert(intervalo.status === 200 && depois.intervaloMinimoMinutos === 10 && depois.limiteShowsDia === 3, "mudar só o intervalo não apaga o limite");
    const semLimite = await gravar(asAdmin, { locationId: snowland!.id, limiteShowsDia: null });
    assert(semLimite.status === 200 && ((await semLimite.json()) as Regras).limiteShowsDia === null, "limite em branco (null) tira o limite");

    const registro = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "escala_regras.atualizada")));
    assert(registro.length === 3, "cada gravação válida grava Registro com antes e depois");
    assert(registro.some((e) => JSON.stringify(e.beforeState).includes("\"limiteShowsDia\":3") && JSON.stringify(e.afterState).includes("\"limiteShowsDia\":null")), "o Registro guarda o valor de antes e o de depois");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const ids = everyone.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(escalaRegrasLocalTable).where(inArray(escalaRegrasLocalTable.locationId, [snowland!.id, acqua!.id]));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, snowland!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, operation!.id));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snowland!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) nas regras de escala por local`);
  process.stdout.write(`escala-regras-http: ${passed} asserts passed\n`);
}

process.stdout.write("escala-regras-http: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
