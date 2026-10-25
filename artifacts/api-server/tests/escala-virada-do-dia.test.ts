/**
 * Qual dia a Escala mostra ao abrir (0082, 24/10/2026): cada local guarda a hora em que a Escala passa a abrir no dia seguinte (padrão 18:00)
 * e a hora em que volta a abrir em hoje (padrão 05:00). Só a Administração muda; a Direção lê; Supervisão e Elenco são recusados com a frase
 * de quem pode. Hora que não existe, horas iguais e horas trocadas são 400 com frase, nunca 500. Cada mudança entra no Registro com o valor
 * antigo e o novo. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Resposta = { status: number; text: string; body: Record<string, any> };

async function run() {
  const tag = `vir_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [pat] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("direcao", null), sup = await mk("deborah", pat!.id), jeff = await mk("jeff", pat!.id);
  const todos = [admin, dir, sup, jeff];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: jeff.id, operationId: operation!.id, role: "MEMBER", active: true },
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: pat!.id, locationId: local!.id, supervisorId: sup.id }]);

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown): Promise<Resposta> => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asJeff = as(jeff, "MEMBER");
    const caminho = `/locations/${local!.id}/virada-do-dia`;
    const doLocal = async (fn: typeof asAdmin) => ((await fn("GET", "/escalas/locais")).body.locais as { id: string; viradaDoDia?: { abreAmanhaAPartirDe: string; voltaAHojeAPartirDe: string } }[] | undefined)?.find((l) => l.id === local!.id);
    const eventos = async () => (await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, local!.id), eq(historyEventsTable.action, "location.virada_do_dia_alterada"))));

    // ── o padrão: local sem escolha nasce com 18:00 e 05:00, e a Escala conhece a hora ──
    const padrao = await doLocal(asAdmin);
    assert(padrao?.viradaDoDia?.abreAmanhaAPartirDe === "18:00" && padrao?.viradaDoDia?.voltaAHojeAPartirDe === "05:00", "local sem escolha tem o padrão 18:00 e 05:00 na lista da Escala");
    const cadastro = (await asAdmin("GET", "/locations")).body.locations as { id: string; viradaDoDia?: { abreAmanhaAPartirDe: string } }[] | undefined;
    assert(cadastro?.find((l) => l.id === local!.id)?.viradaDoDia?.abreAmanhaAPartirDe === "18:00", "a lista de Locais (cadastro) também devolve a hora para a Administração");
    const lidoPelaDirecao = (await asDir("GET", "/locations")).body.locations as { id: string; viradaDoDia?: { voltaAHojeAPartirDe: string } }[] | undefined;
    assert(lidoPelaDirecao?.find((l) => l.id === local!.id)?.viradaDoDia?.voltaAHojeAPartirDe === "05:00", "a Direção lê a hora (somente leitura)");
    assert((await doLocal(asSup))?.viradaDoDia?.abreAmanhaAPartirDe === "18:00", "a Supervisão recebe a hora na Escala (precisa dela para abrir no dia certo)");

    // ── quem pode: só a Administração, e os outros recebem a frase de quem pode ──
    for (const [nome, fn, perfil] of [["Supervisão", asSup, /Supervisão/], ["Direção", asDir, /Direção/], ["Elenco", asJeff, /Elenco/]] as const) {
      const r = await fn("PUT", caminho, { abreAmanhaAPartirDe: "17:00", voltaAHojeAPartirDe: "04:00" });
      assert(r.status === 403 && /Administração/.test(r.text) && perfil.test(r.text) && !/Role .* is not authorized/.test(r.text), `${nome} é recusada com a frase de quem pode e do perfil de quem tentou`);
    }
    assert((await doLocal(asAdmin))?.viradaDoDia?.abreAmanhaAPartirDe === "18:00" && (await eventos()).length === 0, "as recusas não gravaram nada nem entraram no Registro");

    // ── erro de quem digitou é 400 com a frase do que vale ──
    const feia = await asAdmin("PUT", caminho, { abreAmanhaAPartirDe: "25:99", voltaAHojeAPartirDe: "05:00" });
    assert(feia.status === 400 && /HH:MM/.test(feia.text), "hora que não existe é 400 com a frase do formato");
    const faltando = await asAdmin("PUT", caminho, { abreAmanhaAPartirDe: "18:00" });
    assert(faltando.status === 400 && /HH:MM/.test(faltando.text), "faltar uma das horas é 400 com frase");
    const iguais = await asAdmin("PUT", caminho, { abreAmanhaAPartirDe: "18:00", voltaAHojeAPartirDe: "18:00" });
    assert(iguais.status === 400 && /precisam ser diferentes/.test(iguais.text), "horas iguais são 400: \"as duas horas precisam ser diferentes\"");
    const trocadas = await asAdmin("PUT", caminho, { abreAmanhaAPartirDe: "05:00", voltaAHojeAPartirDe: "18:00" });
    assert(trocadas.status === 400 && /precisa vir antes/.test(trocadas.text), "voltar a hoje depois de abrir amanhã é 400 com exemplo");
    assert((await doLocal(asAdmin))?.viradaDoDia?.abreAmanhaAPartirDe === "18:00" && (await eventos()).length === 0, "os erros de digitação não gravaram nada");

    // ── local que não existe ──
    const semLocal = await asAdmin("PUT", `/locations/00000000-0000-4000-8000-000000000000/virada-do-dia`, { abreAmanhaAPartirDe: "17:00", voltaAHojeAPartirDe: "04:00" });
    assert(semLocal.status === 404 && /Local não encontrado/.test(semLocal.text), "local que não existe é 404 com frase");
    const idQuebrado = await asAdmin("PUT", `/locations/nao-e-um-id/virada-do-dia`, { abreAmanhaAPartirDe: "17:00", voltaAHojeAPartirDe: "04:00" });
    assert(idQuebrado.status === 404, "id quebrado na URL é 404, não 500");

    // ── a Administração muda: aparece na Escala e no Registro com antes e depois ──
    const muda = await asAdmin("PUT", caminho, { abreAmanhaAPartirDe: "17:30", voltaAHojeAPartirDe: "04:00" });
    assert(muda.status === 200 && muda.body.alterado === true && muda.body.viradaDoDia?.abreAmanhaAPartirDe === "17:30", "a Administração muda as duas horas");
    assert((await doLocal(asSup))?.viradaDoDia?.abreAmanhaAPartirDe === "17:30" && (await doLocal(asSup))?.viradaDoDia?.voltaAHojeAPartirDe === "04:00", "a Escala (de quem a prepara) já enxerga as horas novas");
    const registrados = await eventos();
    assert(registrados.length === 1 && /17:30/.test(registrados[0]?.narrative ?? "") && /era 18:00/.test(registrados[0]?.narrative ?? "") && /04:00/.test(registrados[0]?.narrative ?? "") && /era 05:00/.test(registrados[0]?.narrative ?? ""), "entrou no Registro dizendo a hora nova e a antiga");

    // ── repetir o mesmo valor não muda nem grava outro evento ──
    const repete = await asAdmin("PUT", caminho, { abreAmanhaAPartirDe: "17:30", voltaAHojeAPartirDe: "04:00" });
    assert(repete.status === 200 && repete.body.alterado === false && (await eventos()).length === 1, "repetir o mesmo valor não grava outro evento");

    // ── voltar ao padrão ──
    const volta = await asAdmin("PUT", caminho, { padrao: true });
    assert(volta.status === 200 && volta.body.viradaDoDia?.abreAmanhaAPartirDe === "18:00" && volta.body.viradaDoDia?.voltaAHojeAPartirDe === "05:00", "voltar ao padrão devolve 18:00 e 05:00");
    const todosEventos = await eventos();
    assert(todosEventos.length === 2 && todosEventos.some((e) => /Voltou ao padrão/.test(e.narrative ?? "")), "voltar ao padrão também entrou no Registro, dizendo que voltou ao padrão");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, pat!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-virada-do-dia`);
  process.stdout.write(`escala-virada-do-dia: ${passed} asserts passed\n`);
}

process.stdout.write("escala-virada-do-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
