/** Folgas por equipe (08/10): Supervisão vê todo mundo, altera só a própria equipe e nunca a própria folga. */
import http from "node:http";
import { eq, inArray } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  folgasTable,
  locationsTable,
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
  const tag = `folgaeq${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, acqua] = await db.insert(locationsTable).values([
    { organizationId: org!.id, name: `${tag}_snow` }, { organizationId: org!.id, name: `${tag}_acqua` },
  ]).returning();
  const [pat, bai] = await db.insert(areasTable).values([
    { organizationId: org!.id, name: `${tag}_pat` }, { organizationId: org!.id, name: `${tag}_bai` },
  ]).returning();
  const mk = async (key: string, areaId: string | null, locationId: string | null, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}${key}`, areaId, defaultLocationId: locationId }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, null, "ADMIN");
  const deb = await mk("deb", pat!.id, snow!.id, "SUPERVISOR_A");
  const ju = await mk("ju", pat!.id, snow!.id, "MEMBER");          // equipe da Deb
  const semLocal = await mk("semlocal", pat!.id, null, "MEMBER");  // área dela, sem local: vale a área
  const louis = await mk("louis", bai!.id, snow!.id, "MEMBER");    // outra área
  const lela = await mk("lela", bai!.id, acqua!.id, "MEMBER");     // outra área e outro local
  const patAcqua = await mk("patacqua", pat!.id, acqua!.id, "MEMBER"); // mesma área, outro local
  const ids = [admin, deb, ju, semLocal, louis, lela, patAcqua].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: snow!.id, supervisorId: deb.id, active: true });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role, operationIds: [op!.id] });
    const asDeb = token(deb, "SUPERVISOR_A"), asAdmin = token(admin, "ADMIN");
    const call = async (method: string, path: string, auth: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
    };
    const toggle = (auth: string, userId: string, date = "2026-10-20") => call("POST", "/folgas/grid/toggle", auth, { userId, operationId: op!.id, date, type: "DAY_OFF" });

    assert((await toggle(asDeb, ju.id)).status === 200, "Supervisão altera folga de quem é da sua área no seu local");
    assert((await toggle(asDeb, semLocal.id)).status === 200, "pessoa da área sem local de costume: vale a área");
    assert((await toggle(asDeb, louis.id)).status === 403, "outra área: recusado (403)");
    assert((await toggle(asDeb, lela.id)).status === 403, "outra área e outro local: recusado (403)");
    assert((await toggle(asDeb, patAcqua.id)).status === 403, "mesma área em outro local: recusado (403)");
    const propria = await toggle(asDeb, deb.id);
    assert(propria.status === 403 && /própria folga/.test(propria.body.message ?? ""), "a própria folga só a Administração altera");
    assert((await toggle(asAdmin, deb.id)).status === 200, "Administração altera a folga do supervisor");
    assert((await call("POST", "/folgas/grid/bulk", asDeb, { userId: lela.id, operationId: op!.id, dates: ["2026-10-21"], type: "DAY_OFF" })).status === 403, "lote para quem não é da equipe: recusado");
    assert((await call("POST", "/folgas/grid/bulk", asDeb, { userId: ju.id, operationId: op!.id, dates: ["2026-10-22"], type: "DAY_OFF" })).status === 200, "lote para a própria equipe: ok");

    const [folgaLela] = await db.insert(folgasTable).values({ userId: lela.id, operationId: op!.id, type: "DAY_OFF", startDate: "2026-10-23", endDate: "2026-10-23", createdBy: admin.id }).returning();
    assert((await call("PATCH", `/folgas/${folgaLela!.id}`, asDeb, { notes: "x" })).status === 403, "editar folga de quem não é da equipe: recusado");
    assert((await call("POST", `/folgas/${folgaLela!.id}/cancelar`, asDeb, { reason: "x" })).status === 403, "cancelar folga de quem não é da equipe: recusado");

    const grid = await call("GET", `/folgas/grid?operationId=${op!.id}&year=2026&month=10`, asDeb);
    const flag = (userId: string) => (grid.body.members as { userId: string; editable: boolean }[]).find((m) => m.userId === userId)?.editable;
    assert(grid.status === 200 && (grid.body.members as unknown[]).length >= 6, "Supervisão vê o mapa de todo mundo");
    assert(flag(ju.id) === true && flag(semLocal.id) === true, "a grade marca a equipe como editável");
    assert(flag(lela.id) === false && flag(louis.id) === false && flag(patAcqua.id) === false && flag(deb.id) === false, "a grade trava quem não é da equipe e a própria linha");
    const gridAdmin = await call("GET", `/folgas/grid?operationId=${op!.id}&year=2026&month=10`, asAdmin);
    assert((gridAdmin.body.members as { editable: boolean }[]).every((m) => m.editable), "Administração edita todas as linhas");

    for (const [method, path, body] of [["POST", "/folgas/grid/publicar", { operationId: op!.id, year: 2026, month: 10 }], ["POST", "/folgas/grid/repeat", { operationId: op!.id, year: 2026, month: 11 }], ["DELETE", `/folgas/grid/reset?operationId=${op!.id}&year=2026&month=10`, { operationId: op!.id, year: 2026, month: 10 }]] as const) {
      assert((await call(method, path, asDeb, body)).status === 403, `${path.split("?")[0]} no mês inteiro é só da Administração`);
    }
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query(`delete from history_events where actor_id = any($1::uuid[]) or mo_id in (select id from operational_changes where actor_id = any($1::uuid[]))`, [ids]);
    await pool.query(`delete from operational_changes where actor_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await db.delete(folgasTable).where(eq(folgasTable.operationId, op!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.supervisorId, deb.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
}

await (async () => {
  try {
    await run();
  } catch (err) {
    console.error("Erro inesperado nos testes:", err);
    failures.push(`erro inesperado: ${(err as Error)?.message ?? err}`);
  } finally {
    await pool.end();
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length) {
    console.log("FALHAS:");
    for (const failure of failures) console.log(` - ${failure}`);
    process.exit(1);
  }
})();
