/**
 * Mediação do pedido de folga (Etapa 3, tarefa 4): quando só parte dos dias pedidos dá, a Supervisão
 * propõe à pessoa só os dias que dão. A pessoa aceita (só esses dias viram folga) ou recusa (o pedido volta
 * para a Supervisão). "A gente sempre tenta dar certo": a proposta é uma conversa, não uma recusa.
 *
 * Contra PostgreSQL real de teste, via HTTP.
 */
import {
  db, pool, organizationsTable, operationsTable, usersTable, locationsTable, areasTable, areaLocalSupervisorsTable,
  folgasTable, historyEventsTable, operationalChangesTable, userRolesTable, leaveRequestsTable, notificationOutboxTable,
} from "@workspace/db";
import { and, eq, inArray, like, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

async function run() {
  const tag = `altfolga_${Date.now()}`;
  const base = shiftOperationalDate(operationalDate(), 40);
  const dias = (inicio: string, n: number) => Array.from({ length: n }, (_, i) => shiftOperationalDate(inicio, i));
  const D1 = dias(base, 3), D2 = dias(shiftOperationalDate(base, 5), 3), D3 = dias(shiftOperationalDate(base, 10), 3);

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [pat] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_pat` }]).returning();
  const mk = async (key: string, areaId: string | null, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}_${key}`, areaId, defaultLocationId: local!.id }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, "ADMIN"), sup = await mk("sup", pat!.id, "SUPERVISOR_A"), ana = await mk("ana", pat!.id, "MEMBER");
  const ids = [admin, sup, ana].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: local!.id, supervisorId: sup.id, active: true });
  const folgasAtivas = async () => (await db.select().from(folgasTable).where(and(eq(folgasTable.userId, ana.id), eq(folgasTable.status, "ACTIVE")))).flatMap((f) => {
    const out: string[] = []; for (let t = new Date(`${f.startDate}T12:00:00Z`); t.toISOString().slice(0, 10) <= f.endDate; t.setUTCDate(t.getUTCDate() + 1)) out.push(t.toISOString().slice(0, 10)); return out;
  }).sort();

  let server: ReturnType<typeof app.listen> | null = null;
  try {
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const url = `http://127.0.0.1:${(server!.address() as { port: number }).port}/api`;
    const tokenFor = (u: { id: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const r = await fetch(`${url}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      let resposta: Record<string, any> = {};
      try { resposta = text ? JSON.parse(text) : {}; } catch { /* corpo que não é JSON */ }
      return { status: r.status, body: resposta };
    };
    const asAdmin = tokenFor(admin, "ADMIN"), asSup = tokenFor(sup, "SUPERVISOR_A"), asAna = tokenFor(ana, "MEMBER");
    for (const d of new Set([...D1, ...D2, ...D3].map((x) => x.slice(0, 7)))) {
      const [year, month] = d.split("-").map(Number);
      assert((await call("POST", "/folgas/grid/publicar", asAdmin, { operationId: operation!.id, year, month })).status === 200, `preparo: publicar ${month}/${year}`);
    }
    const pedir = async (lista: string[]) => (await call("POST", "/leave-requests", asAna, { startDate: lista[0], endDate: lista[lista.length - 1], reason: "Viagem em família" })).body.request.id as string;
    const doPedido = async (id: string, token: string) => ((await call("GET", `/leave-requests?from=${base}&to=${D3[2]}`, token)).body.requests as { id: string; status: string; alternativa?: any }[]).find((r) => r.id === id);

    // ── Pedido 1: recusa e depois aceite, concedendo só 1º e 3º dias ──────────
    const p1 = await pedir(D1);
    const proporA = (id: string, token: string, diasProp: unknown) => call("POST", `/leave-requests/${id}/alternativa`, token, { dias: diasProp });
    assert((await proporA(p1, asSup, [])).status === 400, "proposta sem nenhum dia: 400");
    assert((await proporA(p1, asSup, [shiftOperationalDate(base, 30)])).status === 400, "dia fora do período pedido: 400");
    const todos = await proporA(p1, asSup, D1);
    assert(todos.status === 400 && /todos os dias/.test(todos.body.message ?? ""), "propor todos os dias é só aprovar: 400 dizendo isso");
    assert((await proporA(p1, asAna, [D1[0]])).status === 403, "quem pediu não propõe para si mesma");
    const cedo = await proporA(p1, asAdmin, [D1[0]]);
    assert(cedo.status === 409 && /Supervisão da área tem até/.test(cedo.body.message ?? ""), "Administração antes do prazo não propõe");

    assert((await proporA(p1, asSup, [D1[0], D1[2]])).status === 200, "a Supervisão propõe só o primeiro e o terceiro dia");
    const vistaPorAna = await doPedido(p1, asAna);
    assert(vistaPorAna?.alternativa?.estado === "ESPERANDO" && vistaPorAna.alternativa.souEu === true && vistaPorAna.alternativa.dias.length === 2, "quem pediu vê a proposta esperando por ela");
    const decidirEsperando = await call("PATCH", `/leave-requests/${p1}`, asSup, { status: "APPROVED" });
    assert(decidirEsperando.status === 409 && /Esperando/.test(decidirEsperando.body.message ?? ""), "enquanto a pessoa não responde, decidir devolve 409 explicando");
    assert((await call("POST", `/leave-requests/${p1}/alternativa/resposta`, asSup, { aceita: true })).status === 403, "só quem pediu responde a proposta");
    assert((await call("POST", `/leave-requests/${p1}/alternativa/resposta`, asAna, { aceita: false, motivo: "Preciso dos três dias" })).status === 200, "a pessoa recusa a proposta");
    const aposRecusa = await doPedido(p1, asSup);
    assert(aposRecusa?.status === "PENDING" && aposRecusa.alternativa?.estado === "RECUSADA", "recusada: o pedido volta para a Supervisão");
    assert(!(await folgasAtivas()).some((d) => D1.includes(d)), "recusada: nenhuma folga foi criada");
    assert((await db.select().from(notificationOutboxTable).where(like(notificationOutboxTable.deduplicationKey, `folga:${p1}:%`))).some((a) => a.userId === sup.id && /alternativa/.test(a.deduplicationKey ?? "")), "a Supervisão é avisada da recusa");

    assert((await proporA(p1, asSup, [D1[0], D1[2]])).status === 200, "a Supervisão pode propor de novo");
    assert((await call("POST", `/leave-requests/${p1}/alternativa/resposta`, asAna, { aceita: true })).status === 200, "a pessoa aceita");
    const folgas = await folgasAtivas();
    assert(folgas.includes(D1[0]!) && folgas.includes(D1[2]!) && !folgas.includes(D1[1]!), "só os dias propostos viram folga");
    const aprovado = await doPedido(p1, asSup);
    assert(aprovado?.status === "APPROVED", "o pedido fica aprovado");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, p1), eq(historyEventsTable.action, "leave.alternative_accepted")))).length === 1, "o aceite entra no Registro, uma vez");
    assert((await call("POST", `/leave-requests/${p1}/alternativa/resposta`, asAna, { aceita: true })).status === 409, "segunda resposta devolve 409");

    // ── Pedido 2: a Supervisão retira a proposta ──────────────────────────────
    const p2 = await pedir(D2);
    await proporA(p2, asSup, [D2[1]]);
    assert((await call("POST", `/leave-requests/${p2}/alternativa/retirar`, asSup, {})).status === 200, "a Supervisão retira a proposta");
    assert((await call("POST", `/leave-requests/${p2}/alternativa/resposta`, asAna, { aceita: true })).status === 409, "proposta retirada não pode ser aceita");
    assert((await call("PATCH", `/leave-requests/${p2}`, asSup, { status: "DENIED", decisionReason: "sem cobertura" })).status === 200, "sem proposta em aberto, a Supervisão volta a decidir");

    // ── Pedido 3: a pessoa retira o pedido enquanto a proposta espera ─────────
    const p3 = await pedir(D3);
    await proporA(p3, asSup, [D3[0]]);
    assert((await call("POST", `/leave-requests/${p3}/cancelar`, asAna, {})).status === 200, "quem pediu retira o pedido enquanto a proposta espera");
    assert((await call("POST", `/leave-requests/${p3}/alternativa/resposta`, asAna, { aceita: true })).status === 409, "pedido retirado não reabre pela resposta");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, pat!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na mediação do pedido de folga`);
  process.stdout.write(`folga-alternativa: ${passed} asserts passed\n`);
}

process.stdout.write("folga-alternativa: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
