/** Limpar o mês da grade de folgas: mês inteiro ou só algumas pessoas, poupando o que veio de pedido aprovado, com desfazer. */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  folgasTable,
  historyEventsTable,
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
  const tag = `folgalimpa${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_snow` }]).returning();
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
  const ju = await mk("ju", pat!.id, snow!.id, "MEMBER");
  const louis = await mk("louis", bai!.id, snow!.id, "MEMBER");
  const ids = [admin, deb, ju, louis].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: snow!.id, supervisorId: deb.id, active: true });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role, operationIds: [op!.id] });
    const asAdmin = token(admin, "ADMIN"), asDeb = token(deb, "SUPERVISOR_A"), asJu = token(ju, "MEMBER");
    const call = async (method: string, path: string, auth: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
    };
    const grid = async () => {
      const r = await call("GET", `/folgas/grid?operationId=${op!.id}&year=2026&month=10`, asAdmin);
      return new Map<string, any>((r.body.members as any[]).map((m) => [m.userId, m]));
    };
    const novo = (userId: string, type: string, startDate: string, endDate: string, origem: "MANUAL" | "SOLICITACAO" = "MANUAL") =>
      db.insert(folgasTable).values({ userId, operationId: op!.id, type: type as never, startDate, endDate, status: "ACTIVE", origem, createdBy: admin.id });

    await novo(ju.id, "DAY_OFF", "2026-10-05", "2026-10-07");
    await novo(ju.id, "DAY_OFF", "2026-10-20", "2026-10-20", "SOLICITACAO");
    await novo(ju.id, "RECESSO", "2026-09-28", "2026-10-02");
    await novo(louis.id, "DAY_OFF", "2026-10-10", "2026-10-10");

    // A grade passa a dizer a área e o local de cada pessoa (ela se organiza por isso, não mais por grupo).
    const g0 = await grid();
    assert(g0.get(ju.id)?.areaName === `${tag}_pat` && g0.get(ju.id)?.localName === `${tag}_snow`, "a grade devolve o nome da área e do local da pessoa");
    assert(g0.get(louis.id)?.areaName === `${tag}_bai`, "a grade devolve a área de quem é de outra área");

    // Quem pode: elenco não limpa; Supervisão não limpa o mês de todo mundo nem pessoa de fora da equipe.
    const corpo = { operationId: op!.id, year: 2026, month: 10 };
    assert((await call("POST", "/folgas/grid/limpar", asJu, { ...corpo, userIds: [ju.id] })).status === 403, "elenco não limpa folga");
    const semPessoas = await call("POST", "/folgas/grid/limpar", asDeb, corpo);
    assert(semPessoas.status === 403 && /Administração/.test(semPessoas.body.message ?? ""), "Supervisão não limpa o mês de todo mundo (a frase diz quem pode)");
    assert((await call("POST", "/folgas/grid/limpar", asDeb, { ...corpo, userIds: [louis.id] })).status === 403, "Supervisão não limpa pessoa de outra área");
    assert((await call("POST", "/folgas/grid/limpar", asAdmin, { ...corpo, userIds: [] })).status === 400, "lista de pessoas vazia: 400 com frase");
    assert((await call("POST", "/folgas/grid/limpar", asAdmin, { ...corpo, tipos: ["INVENTADO"] })).status === 400, "tipo inventado: 400");
    assert((await grid()).get(louis.id)?.days["10"] === "DAY_OFF", "recusa não apaga nada");

    // Só a equipe da Supervisão, só folgas: os dias do pedido aprovado e o recesso ficam.
    const l1 = await call("POST", "/folgas/grid/limpar", asDeb, { ...corpo, userIds: [ju.id], tipos: ["DAY_OFF"], motivo: "Recomeçar" });
    assert(l1.status === 200 && l1.body.dias === 3 && l1.body.pessoas === 1 && l1.body.diasDePedido === 1 && typeof l1.body.eventId === "string", "limpa 3 dias de folga da Ju e avisa que 1 dia de pedido ficou");
    const g1 = await grid();
    assert(!g1.get(ju.id)?.days["5"] && !g1.get(ju.id)?.days["7"], "os dias marcados à mão saíram");
    assert(g1.get(ju.id)?.days["20"] === "DAY_OFF", "a folga que veio de pedido aprovado continua na grade");
    assert(g1.get(ju.id)?.days["1"] === "RECESSO", "tipo que não foi pedido continua");
    assert(g1.get(louis.id)?.days["10"] === "DAY_OFF", "quem não foi escolhido continua");
    const [reg] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.id, l1.body.eventId), eq(historyEventsTable.action, "FOLGA_GRID_LIMPAR")));
    assert(!!reg && /Recomeçar/.test(reg.narrative), "a limpeza entrou no Registro com o motivo");

    // Mês inteiro (Administração) de recesso: o pedaço de setembro da mesma folga não é tocado.
    const l2 = await call("POST", "/folgas/grid/limpar", asAdmin, { ...corpo, tipos: ["RECESSO"] });
    assert(l2.status === 200 && l2.body.dias === 2, "mês inteiro: só os 2 dias de outubro do recesso saem");
    const setembro = await db.select().from(folgasTable).where(and(eq(folgasTable.userId, ju.id), eq(folgasTable.status, "ACTIVE"), eq(folgasTable.type, "RECESSO")));
    assert(setembro.length === 1 && setembro[0]!.startDate === "2026-09-28" && setembro[0]!.endDate === "2026-09-30", "o pedaço de setembro do recesso continua");
    const vazia = await call("POST", "/folgas/grid/limpar", asAdmin, { ...corpo, tipos: ["AFASTAMENTO"] });
    assert(vazia.status === 200 && vazia.body.dias === 0 && vazia.body.eventId === null, "nada a limpar: ok, sem Registro");

    // Desfazer: devolve, uma vez só, e não pisa em marcação nova.
    await call("POST", "/folgas/grid/toggle", asAdmin, { userId: ju.id, operationId: op!.id, date: "2026-10-06", type: "OUTRO" });
    const d1 = await call("POST", "/folgas/grid/limpar/desfazer", asDeb, { eventId: l1.body.eventId });
    assert(d1.status === 200 && d1.body.devolvidos === 2 && d1.body.jaOcupados === 1, "desfazer devolve os dias livres e respeita o dia que ganhou outra marcação");
    const g2 = await grid();
    assert(g2.get(ju.id)?.days["5"] === "DAY_OFF" && g2.get(ju.id)?.days["6"] === "OUTRO" && g2.get(ju.id)?.days["7"] === "DAY_OFF", "dias de volta, com a marcação nova no meio");
    assert((await call("POST", "/folgas/grid/limpar/desfazer", asDeb, { eventId: l1.body.eventId })).status === 409, "desfazer duas vezes: 409 com frase");
    assert((await call("POST", "/folgas/grid/limpar/desfazer", asJu, { eventId: l2.body.eventId })).status === 403, "elenco não desfaz");
    assert((await call("POST", "/folgas/grid/limpar/desfazer", asDeb, { eventId: l2.body.eventId })).status === 200, "Supervisão desfaz limpeza só com gente da própria equipe");
    assert((await call("POST", "/folgas/grid/limpar/desfazer", asAdmin, { eventId: "00000000-0000-0000-0000-000000000000" })).status === 404, "limpeza que não existe: 404 com frase");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query(`delete from history_events where actor_id = any($1::uuid[]) or mo_id in (select id from operational_changes where actor_id = any($1::uuid[]))`, [ids]);
    await pool.query(`delete from operational_changes where actor_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(folgasTable).where(eq(folgasTable.operationId, op!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.supervisorId, deb.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(locationsTable).where(eq(locationsTable.id, snow!.id));
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
