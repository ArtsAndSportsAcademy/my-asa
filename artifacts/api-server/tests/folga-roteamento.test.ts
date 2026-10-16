/**
 * Roteamento do pedido de folga (Etapa 3, tarefa 2).
 *  - Mês de folgas ainda não publicado: o pedido entra direto como prioridade (aprovado, com a folga).
 *  - Mês publicado: o pedido espera a Supervisão da área; a Administração só decide depois do prazo
 *    (3 dias corridos antes da data pedida, por padrão) ou quando a área não tem supervisão.
 *  - Ninguém decide o próprio pedido. O aviso de prazo aberto sai uma vez só.
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
import { avisarPrazoDaFolgaAberto } from "../src/services/operational-jobs.js";
import { prazoAdminAberto } from "../src/services/folga-roteamento.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

async function run() {
  const tag = `rotfolga_${Date.now()}`;
  const hoje = operationalDate();
  const perto = shiftOperationalDate(hoje, 2);      // dentro do prazo de 3 dias
  const pertoB = shiftOperationalDate(hoje, 1);
  const longe = shiftOperationalDate(hoje, 40);     // bem fora do prazo
  const dezembro = "2027-03-15";                     // mês que ninguém publicou
  const mesDe = (d: string) => ({ year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) });

  // Regra pura do prazo, em dias corridos.
  assert(prazoAdminAberto("2026-11-10", "2026-11-07", 3) === true, "faltando 3 dias corridos, o prazo da Administração abre");
  assert(prazoAdminAberto("2026-11-10", "2026-11-06", 3) === false, "faltando 4 dias, ainda não abriu");
  assert(prazoAdminAberto("2026-11-10", "2026-11-10", 3) === true, "no próprio dia, está aberto");

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_pat` }, { organizationId: org!.id, name: `${tag}_bai` }]).returning();
  const mk = async (key: string, areaId: string | null, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}_${key}`, areaId, defaultLocationId: local!.id }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, "ADMIN");
  const sup = await mk("sup", pat!.id, "SUPERVISOR_A");
  const ana = await mk("ana", pat!.id, "MEMBER");
  const bia = await mk("bia", bai!.id, "MEMBER");   // área sem Supervisão
  const ids = [admin, sup, ana, bia].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: local!.id, supervisorId: sup.id, active: true });

  let server: ReturnType<typeof app.listen> | null = null;
  try {
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const base = `http://127.0.0.1:${(server!.address() as { port: number }).port}/api`;
    const tokenFor = (u: { id: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      let resposta: Record<string, any> = {};
      try { resposta = text ? JSON.parse(text) : {}; } catch { /* corpo que não é JSON */ }
      return { status: r.status, body: resposta };
    };
    const asAdmin = tokenFor(admin, "ADMIN"), asSup = tokenFor(sup, "SUPERVISOR_A"), asAna = tokenFor(ana, "MEMBER"), asBia = tokenFor(bia, "MEMBER");
    const pedir = (token: string, date: string, reason = "Compromisso") => call("POST", "/leave-requests", token, { startDate: date, endDate: date, reason });
    const avisosDe = async (pedidoId: string) => db.select().from(notificationOutboxTable).where(like(notificationOutboxTable.deduplicationKey, `folga:${pedidoId}:%`));

    // Publica os meses das datas "publicadas"; dezembro/março de 2027 fica sem publicar.
    for (const d of new Set([perto, pertoB, longe])) {
      const { year, month } = mesDe(d);
      const pub = await call("POST", "/folgas/grid/publicar", asAdmin, { operationId: operation!.id, year, month });
      assert(pub.status === 200, `preparo: publicar o mapa de ${month}/${year}`);
    }

    // 1 · Mês não publicado: entra como prioridade.
    const prio = await pedir(asAna, dezembro);
    const prioId = prio.body.request?.id as string;
    assert(prio.status === 201 && prio.body.request?.status === "APPROVED" && prio.body.entrouComoPrioridade === true, "mês não publicado: o pedido entra aprovado, como prioridade");
    const folgaCriada = await db.select().from(folgasTable).where(and(eq(folgasTable.userId, ana.id), eq(folgasTable.startDate, dezembro), eq(folgasTable.status, "ACTIVE")));
    assert(folgaCriada.length === 1 && folgaCriada[0]!.origem === "SOLICITACAO", "a folga já existe no mapa, com origem SOLICITACAO");
    const regPrio = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, prioId), eq(historyEventsTable.action, "leave.priority")));
    assert(regPrio.length === 1, "entrou no Registro como prioridade, na mesma operação");
    const avPrio = await avisosDe(prioId);
    assert(avPrio.some((a) => a.userId === sup.id) && !avPrio.some((a) => a.userId === admin.id), "a Supervisão da área é avisada; a Administração não");
    assert((await call("POST", `/folgas/${folgaCriada[0]!.id}/cancelar`, asSup, { reason: "show especial nesse dia" })).status === 200, "a gerência desfaz a folga de prioridade com motivo");

    // 2 · Mês publicado, longe: espera a Supervisão; Administração não decide antes do prazo.
    const longeAna = await pedir(asAna, longe);
    const longeId = longeAna.body.request?.id as string;
    assert(longeAna.status === 201 && longeAna.body.request?.status === "PENDING" && !longeAna.body.entrouComoPrioridade, "mês publicado: o pedido espera a decisão");
    const avLonge = await avisosDe(longeId);
    assert(avLonge.some((a) => a.userId === sup.id) && !avLonge.some((a) => a.userId === admin.id), "só a Supervisão da área é avisada do pedido");
    const adminCedo = await call("PATCH", `/leave-requests/${longeId}`, asAdmin, { status: "APPROVED" });
    assert(adminCedo.status === 409 && /Supervisão da área tem até/.test(adminCedo.body.message ?? ""), "Administração antes do prazo: recusado com a frase de quando poderá decidir");
    const fila = await call("GET", `/leave-requests?from=${longe}&to=${longe}`, asAdmin);
    const linha = (fila.body.requests as { id: string; destino?: { quem: string; adminPodeDecidirEm: string | null } }[] | undefined)?.find((r) => r.id === longeId);
    assert(linha?.destino?.quem === "SUPERVISAO" && linha.destino.adminPodeDecidirEm === shiftOperationalDate(longe, -3), "a lista diz que está com a Supervisão e quando a Administração poderá decidir");
    assert((await call("PATCH", `/leave-requests/${longeId}`, asSup, { status: "APPROVED" })).status === 200, "a Supervisão da área decide");

    // 3 · Prazo aberto: Administração decide.
    const pertoAna = await pedir(asAna, perto);
    assert((await call("PATCH", `/leave-requests/${pertoAna.body.request.id}`, asAdmin, { status: "APPROVED" })).status === 200, "dentro do prazo, a Administração decide");

    // 4 · Área sem Supervisão: a Administração decide desde o início e é avisada.
    const biaPedido = await pedir(asBia, longe);
    const biaId = biaPedido.body.request?.id as string;
    assert((await avisosDe(biaId)).some((a) => a.userId === admin.id), "área sem Supervisão: a Administração é avisada");
    const fila2 = await call("GET", `/leave-requests?from=${longe}&to=${longe}`, asAdmin);
    const linhaBia = (fila2.body.requests as { id: string; destino?: { quem: string } }[] | undefined)?.find((r) => r.id === biaId);
    assert(linhaBia?.destino?.quem === "ADMINISTRACAO", "a lista diz que o pedido é da Administração");
    assert((await call("PATCH", `/leave-requests/${biaId}`, asAdmin, { status: "APPROVED" })).status === 200, "Administração decide pedido de área sem Supervisão antes de qualquer prazo");

    // 5 · Ninguém decide o próprio pedido.
    const supPedido = await pedir(asSup, longe, "Consulta");
    assert((await call("PATCH", `/leave-requests/${supPedido.body.request.id}`, asSup, { status: "APPROVED" })).status === 403, "a Supervisão não decide o próprio pedido");

    // 6 · O aviso de prazo aberto sai uma vez só.
    const outro = await pedir(asAna, pertoB, "Dentista");
    const outroId = outro.body.request?.id as string;
    const primeira = await avisarPrazoDaFolgaAberto();
    const segunda = await avisarPrazoDaFolgaAberto();
    const prazoAvisos = (await avisosDe(outroId)).filter((a) => a.userId === admin.id && /:prazo/.test(a.deduplicationKey ?? ""));
    assert(prazoAvisos.length === 1, "a Administração recebe um único aviso de prazo aberto, mesmo rodando o job duas vezes");
    assert(primeira.avisados >= 1 && segunda.avisados === 0, "a segunda rodada do job não avisa de novo");
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
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no roteamento do pedido de folga`);
  process.stdout.write(`folga-roteamento: ${passed} asserts passed\n`);
}

process.stdout.write("folga-roteamento: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
