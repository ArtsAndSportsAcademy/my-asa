/**
 * Troca de folga com colega (Etapa 3, tarefa 3). Só existe quando o colega JÁ está de folga no dia pedido:
 * a pessoa fica com o dia pedido e o colega fica com um dia de folga dela. A Supervisão propõe; o colega
 * aceita ou recusa (com motivo); recusa volta para a Supervisão. A conta de folgas de cada um não muda.
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
  const tag = `trocafolga_${Date.now()}`;
  const base = shiftOperationalDate(operationalDate(), 40);
  const X = [0, 1, 2, 3].map((i) => shiftOperationalDate(base, i));       // dias pedidos
  const Y = [0, 1, 2, 3].map((i) => shiftOperationalDate(base, 10 + i));  // dias de folga da Ana, que o colega recebe
  const mesDe = (d: string) => ({ year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) });

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [pat] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_pat` }]).returning();
  const mk = async (key: string, areaId: string | null, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}_${key}`, areaId, defaultLocationId: local!.id }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, "ADMIN");
  const sup = await mk("sup", pat!.id, "SUPERVISOR_A");
  const ana = await mk("ana", pat!.id, "MEMBER");
  const colegas = [await mk("carol", pat!.id, "MEMBER"), await mk("dani", pat!.id, "MEMBER"), await mk("eva", pat!.id, "MEMBER"), await mk("fabi", pat!.id, "MEMBER")];
  const trabalha = await mk("trabalha", pat!.id, "MEMBER"); // não está de folga em nenhum dia
  const ids = [admin, sup, ana, trabalha, ...colegas].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: local!.id, supervisorId: sup.id, active: true });
  const folga = (userId: string, date: string) => db.insert(folgasTable).values({ userId, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, status: "ACTIVE", createdBy: admin.id }).returning();
  for (let i = 0; i < 4; i++) { await folga(ana.id, Y[i]!); await folga(colegas[i]!.id, X[i]!); }
  const folgasAtivas = async (userId: string) => (await db.select().from(folgasTable).where(and(eq(folgasTable.userId, userId), eq(folgasTable.status, "ACTIVE")))).map((f) => f.startDate).sort();

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
    const asAdmin = tokenFor(admin, "ADMIN"), asSup = tokenFor(sup, "SUPERVISOR_A"), asAna = tokenFor(ana, "MEMBER"), asTrabalha = tokenFor(trabalha, "MEMBER");
    const asColega = colegas.map((c) => tokenFor(c, "MEMBER"));

    for (const d of new Set([...X, ...Y].map((x) => `${mesDe(x).year}-${mesDe(x).month}`))) {
      const [year, month] = d.split("-").map(Number);
      assert((await call("POST", "/folgas/grid/publicar", asAdmin, { operationId: operation!.id, year, month })).status === 200, `preparo: publicar ${month}/${year}`);
    }
    const pedir = async (date: string) => (await call("POST", "/leave-requests", asAna, { startDate: date, endDate: date, reason: "Motivo particular da Ana" })).body.request.id as string;
    const avisosDe = async (id: string) => db.select().from(notificationOutboxTable).where(like(notificationOutboxTable.deduplicationKey, `folga:${id}:%`));
    const doPedido = async (id: string, token: string) => ((await call("GET", `/leave-requests?from=${X[0]}&to=${Y[3]}`, token)).body.requests as { id: string; reason?: string; troca?: any; status: string }[]).find((r) => r.id === id);

    // ── Pedido 1: recusa e depois aceite ──────────────────────────────────────
    const p1 = await pedir(X[0]!);
    const naoEstaDeFolga = await call("POST", `/leave-requests/${p1}/troca`, asSup, { peerId: trabalha.id, diaDevolvido: Y[0] });
    assert(naoEstaDeFolga.status === 400 && /não está de folga/.test(naoEstaDeFolga.body.message ?? ""), "colega que não está de folga no dia: 400 explicando que é cobertura, não troca");
    const diaErrado = await call("POST", `/leave-requests/${p1}/troca`, asSup, { peerId: colegas[0]!.id, diaDevolvido: shiftOperationalDate(base, 20) });
    assert(diaErrado.status === 400 && /folga de/.test(diaErrado.body.message ?? ""), "dia devolvido que não é folga de quem pediu: 400");
    assert((await call("POST", `/leave-requests/${p1}/troca`, asAna, { peerId: colegas[0]!.id, diaDevolvido: Y[0] })).status === 403, "quem pediu não propõe a própria troca");
    const cedo = await call("POST", `/leave-requests/${p1}/troca`, asAdmin, { peerId: colegas[0]!.id, diaDevolvido: Y[0] });
    assert(cedo.status === 409 && /Supervisão da área tem até/.test(cedo.body.message ?? ""), "Administração antes do prazo não propõe troca");

    const prop = await call("POST", `/leave-requests/${p1}/troca`, asSup, { peerId: colegas[0]!.id, diaDevolvido: Y[0] });
    assert(prop.status === 200, "a Supervisão propõe a troca ao colega que está de folga no dia");
    const visaoColega = await doPedido(p1, asColega[0]!);
    assert(visaoColega?.troca?.souEu === true && visaoColega.troca.estado === "ESPERANDO" && visaoColega.reason == null, "o colega vê a troca esperando por ele, sem o motivo particular de quem pediu");
    assert(!(await doPedido(p1, asColega[1]!)), "outro colega não vê o pedido");
    const decidirEsperando = await call("PATCH", `/leave-requests/${p1}`, asSup, { status: "APPROVED" });
    assert(decidirEsperando.status === 409 && /Esperando/.test(decidirEsperando.body.message ?? ""), "enquanto o colega não responde, aprovar/recusar devolve 409 explicando");
    assert((await call("POST", `/leave-requests/${p1}/troca/resposta`, asColega[1]!, { aceita: true })).status === 403, "só o colega escolhido responde");
    const semMotivo = await call("POST", `/leave-requests/${p1}/troca/resposta`, asColega[0]!, { aceita: false });
    assert(semMotivo.status === 400, "recusar sem motivo: 400");
    assert((await call("POST", `/leave-requests/${p1}/troca/resposta`, asColega[0]!, { aceita: false, motivo: "Viajo nesse dia" })).status === 200, "o colega recusa com motivo");
    const depoisRecusa = await doPedido(p1, asSup);
    assert(depoisRecusa?.status === "PENDING" && depoisRecusa.troca?.estado === "RECUSADA" && depoisRecusa.troca.motivoRecusa === "Viajo nesse dia", "a recusa volta o pedido para a Supervisão, com o motivo");
    assert((await avisosDe(p1)).some((a) => a.userId === sup.id && /troca/.test(a.deduplicationKey ?? "")), "a Supervisão é avisada da recusa");
    assert((await folgasAtivas(ana.id)).includes(Y[0]!) && !(await folgasAtivas(ana.id)).includes(X[0]!), "recusada: as folgas de quem pediu não mudaram");

    assert((await call("POST", `/leave-requests/${p1}/troca`, asSup, { peerId: colegas[0]!.id, diaDevolvido: Y[0] })).status === 200, "a Supervisão pode propor de novo depois da recusa");
    const antesAna = (await folgasAtivas(ana.id)).length, antesCarol = (await folgasAtivas(colegas[0]!.id)).length;
    assert((await call("POST", `/leave-requests/${p1}/troca/resposta`, asColega[0]!, { aceita: true })).status === 200, "o colega aceita");
    const ana1 = await folgasAtivas(ana.id), carol1 = await folgasAtivas(colegas[0]!.id);
    assert(ana1.includes(X[0]!) && !ana1.includes(Y[0]!), "aceita: quem pediu ganha o dia pedido e devolve o dia combinado");
    assert(carol1.includes(Y[0]!) && !carol1.includes(X[0]!), "aceita: o colega trabalha o dia pedido e ganha o dia devolvido");
    assert(ana1.length === antesAna && carol1.length === antesCarol, "a conta de folgas de cada um continua a mesma");
    const aprovado = await doPedido(p1, asSup);
    assert(aprovado?.status === "APPROVED", "o pedido fica aprovado");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, p1), eq(historyEventsTable.action, "leave.swapped")))).length === 1, "a troca entra no Registro, uma vez");
    assert((await avisosDe(p1)).some((a) => a.userId === ana.id), "quem pediu é avisada de que a troca foi feita");
    assert((await call("POST", `/leave-requests/${p1}/troca/resposta`, asColega[0]!, { aceita: true })).status === 409, "segunda resposta devolve 409");

    // ── Pedido 2: cancelado enquanto o colega pensa ───────────────────────────
    const p2 = await pedir(X[1]!);
    assert((await call("POST", `/leave-requests/${p2}/troca`, asSup, { peerId: colegas[1]!.id, diaDevolvido: Y[1] })).status === 200, "pedido 2: proposta feita");
    assert((await call("POST", `/leave-requests/${p2}/cancelar`, asAna, {})).status === 200, "quem pediu retira o pedido enquanto o colega não respondeu");
    assert((await call("POST", `/leave-requests/${p2}/troca/resposta`, asColega[1]!, { aceita: true })).status === 409, "pedido cancelado não reabre pela resposta do colega");
    assert((await folgasAtivas(colegas[1]!.id)).includes(X[1]!), "o colega continua com a folga dele");

    // ── Pedido 3: a Supervisão retira a proposta (colega que some) ────────────
    const p3 = await pedir(X[2]!);
    await call("POST", `/leave-requests/${p3}/troca`, asSup, { peerId: colegas[2]!.id, diaDevolvido: Y[2] });
    assert((await call("POST", `/leave-requests/${p3}/troca/retirar`, asSup, {})).status === 200, "a Supervisão retira a proposta que ficou sem resposta");
    assert((await call("POST", `/leave-requests/${p3}/troca/resposta`, asColega[2]!, { aceita: true })).status === 409, "proposta retirada não pode ser aceita");
    assert((await call("PATCH", `/leave-requests/${p3}`, asSup, { status: "DENIED", decisionReason: "sem troca possível" })).status === 200, "sem proposta em aberto, a Supervisão volta a decidir");

    // ── Pedido 4: a folga do colega mudou antes da resposta ───────────────────
    const p4 = await pedir(X[3]!);
    await call("POST", `/leave-requests/${p4}/troca`, asSup, { peerId: colegas[3]!.id, diaDevolvido: Y[3] });
    await db.delete(folgasTable).where(and(eq(folgasTable.userId, colegas[3]!.id), eq(folgasTable.startDate, X[3]!)));
    const mudou = await call("POST", `/leave-requests/${p4}/troca/resposta`, asColega[3]!, { aceita: true });
    assert(mudou.status === 409 && /mudou/.test(mudou.body.message ?? ""), "se a folga mudou antes da resposta, 409 dizendo que a Supervisão precisa propor de novo");
    assert(!(await folgasAtivas(ana.id)).includes(X[3]!), "nada foi trocado nesse caso");

    // ── Troca é de um dia por vez ─────────────────────────────────────────────
    const longo = await call("POST", "/leave-requests", asAna, { startDate: shiftOperationalDate(base, 20), endDate: shiftOperationalDate(base, 22), reason: "Viagem" });
    const longoTroca = await call("POST", `/leave-requests/${longo.body.request.id}/troca`, asSup, { peerId: colegas[0]!.id, diaDevolvido: Y[0] });
    assert(longoTroca.status === 400 && /um dia/.test(longoTroca.body.message ?? ""), "pedido de vários dias: a troca é de um dia por vez");
    assert((await call("GET", `/leave-requests?from=${base}&to=${base}`, asTrabalha)).status === 200, "Elenco que não está na troca só vê o que é dele");
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
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na troca de folga`);
  process.stdout.write(`folga-troca: ${passed} asserts passed\n`);
}

process.stdout.write("folga-troca: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
