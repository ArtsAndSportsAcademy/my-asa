/**
 * Regras do pedido de folga que a Administração ajusta (Etapa 3, tarefa 5): o prazo da Supervisão e o
 * limite de folgas por dia em cada área. O limite só AVISA na análise do pedido; nunca trava a decisão.
 *
 * Contra PostgreSQL real de teste, via HTTP.
 */
import {
  db, pool, organizationsTable, operationsTable, usersTable, locationsTable, areasTable, areaLocalSupervisorsTable,
  folgasTable, historyEventsTable, operationalChangesTable, userRolesTable, leaveRequestsTable, notificationOutboxTable, folgaConfigTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";
import { lembrarRespostasDeFolga } from "../src/services/operational-jobs.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

async function run() {
  const tag = `cfgfolga_${Date.now()}`;
  const hoje = operationalDate();
  const quatroDias = shiftOperationalDate(hoje, 4);   // fora do prazo de 3, dentro do de 5
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [pat] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_pat` }]).returning();
  const [areaDeFora] = await db.insert(areasTable).values([{ organizationId: outraOrg!.id, name: `${tag}_fora` }]).returning();
  const mk = async (key: string, areaId: string | null, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}_${key}`, areaId, defaultLocationId: local!.id }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, "ADMIN"), dir = await mk("dir", null, "DIR"), sup = await mk("sup", pat!.id, "SUPERVISOR_A");
  const ana = await mk("ana", pat!.id, "MEMBER"), bia = await mk("bia", pat!.id, "MEMBER"), cris = await mk("cris", pat!.id, "MEMBER");
  const ids = [admin, dir, sup, ana, bia, cris].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: local!.id, supervisorId: sup.id, active: true });

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
    const asAdmin = tokenFor(admin, "ADMIN"), asDir = tokenFor(dir, "DIR"), asSup = tokenFor(sup, "SUPERVISOR_A"), asAna = tokenFor(ana, "MEMBER"), asCris = tokenFor(cris, "MEMBER");
    const [ano, mes] = quatroDias.split("-").map(Number);
    assert((await call("POST", "/folgas/grid/publicar", asAdmin, { operationId: operation!.id, year: ano, month: mes })).status === 200, "preparo: publicar o mapa do mês");

    // 1 · Padrões e quem lê.
    const padrao = await call("GET", "/folga-config", asAdmin);
    assert(padrao.status === 200 && padrao.body.config?.prazoSupervisaoDias === 3 && Object.keys(padrao.body.config?.limiteFolgaPorArea ?? {}).length === 0, "sem configuração salva, valem o prazo de 3 dias e nenhum limite");
    assert((padrao.body.areas as { id: string }[] | undefined)?.some((a) => a.id === pat!.id) && !(padrao.body.areas as { id: string }[]).some((a) => a.id === areaDeFora!.id), "a lista de áreas é só da própria organização");
    assert((await call("GET", "/folga-config", asDir)).status === 200 && (await call("GET", "/folga-config", asSup)).status === 200, "Direção e Supervisão leem as regras");
    const elenco = await call("GET", "/folga-config", asAna);
    assert(elenco.status === 403 && (elenco.body.message ?? "").length > 10, "Elenco recebe 403 com uma frase");

    // 2 · Quem grava e o que vale.
    assert((await call("PUT", "/folga-config", asSup, { prazoSupervisaoDias: 5 })).status === 403, "Supervisão não altera as regras");
    assert((await call("PUT", "/folga-config", asDir, { prazoSupervisaoDias: 5 })).status === 403, "Direção só lê as regras");
    for (const [corpo, quando] of [[{ prazoSupervisaoDias: -1 }, "prazo negativo"], [{ prazoSupervisaoDias: 31 }, "prazo acima de 30"], [{ prazoSupervisaoDias: "tres" }, "prazo em texto"], [{ limiteFolgaPorArea: { [areaDeFora!.id]: 2 } }, "limite para área de outra organização"], [{ limiteFolgaPorArea: { [pat!.id]: -2 } }, "limite negativo"]] as const) {
      const r = await call("PUT", "/folga-config", asAdmin, corpo);
      assert(r.status === 400 && (r.body.message ?? "").length > 10, `${quando}: 400 com frase`);
    }

    // 3 · O prazo muda a regra da Administração.
    const pedido = await call("POST", "/leave-requests", asAna, { startDate: quatroDias, endDate: quatroDias, reason: "Compromisso" });
    const pedidoId = pedido.body.request.id as string;
    const cedo = await call("PATCH", `/leave-requests/${pedidoId}`, asAdmin, { status: "APPROVED" });
    assert(cedo.status === 409, "com o prazo de 3 dias, faltando 4 a Administração ainda não decide");
    const salvo = await call("PUT", "/folga-config", asAdmin, { prazoSupervisaoDias: 5 });
    assert(salvo.status === 200 && salvo.body.config?.prazoSupervisaoDias === 5, "a Administração muda o prazo para 5 dias");
    assert((await call("GET", "/folga-config", asSup)).body.config?.prazoSupervisaoDias === 5, "a mudança vale para quem lê");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "folga.config_changed")))).length === 1, "a mudança entra no Registro, uma vez");

    // 4 · O limite por área só avisa.
    await db.insert(folgasTable).values({ userId: bia.id, operationId: operation!.id, type: "DAY_OFF", startDate: quatroDias, endDate: quatroDias, status: "ACTIVE", createdBy: admin.id });
    const semLimite = await call("GET", `/leave-requests/${pedidoId}/analise`, asSup);
    assert(semLimite.status === 200 && semLimite.body.dias?.[0]?.aviso === null, "sem limite configurado, a análise não avisa");
    assert((await call("PUT", "/folga-config", asAdmin, { limiteFolgaPorArea: { [pat!.id]: 1 } })).status === 200, "a Administração define o limite da área");
    const comLimite = await call("GET", `/leave-requests/${pedidoId}/analise`, asSup);
    assert(/limite é 1/.test(comLimite.body.dias?.[0]?.aviso ?? ""), "com limite 1 e uma colega já de folga, a análise avisa");
    assert((await call("PATCH", `/leave-requests/${pedidoId}`, asAdmin, { status: "APPROVED", decisionReason: "A Supervisão não respondeu." })).status === 200, "o aviso nunca trava: a decisão continua possível, e agora dentro do prazo de 5 dias");
    const guardado = await db.select().from(folgaConfigTable).where(eq(folgaConfigTable.organizationId, org!.id));
    assert(guardado.length === 1 && guardado[0]!.prazoSupervisaoDias === 5, "guardar o limite não desfaz o prazo salvo antes");

    // 5 · Limite total da casa e limite por área: cada um liga e desliga, e cada um só avisa ou exige motivo.
    assert((await call("PUT", "/folga-config", asAdmin, { limiteTotalAtivo: true })).status === 400, "ligar o limite total sem dizer o número é recusado com uma frase");
    for (const [corpo, quando] of [[{ limiteTotal: -1 }, "limite total negativo"], [{ limiteTotal: 2001 }, "limite total acima de 2000"], [{ limiteTotalModo: "TRAVA" }, "modo que não existe"], [{ limiteAreaAtivo: "sim" }, "liga/desliga em texto"], [{ lembreteRespostaHoras: 169 }, "lembrete acima de 168 horas"]] as const) {
      const rr = await call("PUT", "/folga-config", asAdmin, corpo);
      assert(rr.status === 400 && (rr.body.message ?? "").length > 10, `${quando}: 400 com frase`);
    }
    const ligado = await call("PUT", "/folga-config", asAdmin, { limiteTotalAtivo: true, limiteTotal: 2, limiteTotalModo: "REFERENCIA" });
    assert(ligado.status === 200 && ligado.body.config?.limiteTotalAtivo === true && ligado.body.config?.limiteTotal === 2 && ligado.body.config?.limiteFolgaPorArea?.[pat!.id] === 1, "a Administração liga o limite total de 2 pessoas sem desfazer o limite da área");
    const pedidoCris = await call("POST", "/leave-requests", asCris, { startDate: quatroDias, endDate: quatroDias, reason: "Consulta" });
    const pedidoCrisId = pedidoCris.body.request.id as string;
    const avisoTotal = await call("GET", `/leave-requests/${pedidoCrisId}/analise`, asSup);
    assert(/limite total é 2/.test(avisoTotal.body.dias?.[0]?.aviso ?? "") && /limite é 1/.test(avisoTotal.body.dias?.[0]?.aviso ?? ""), "a análise avisa os dois limites: o total (casa toda) e o da área");
    const modoMotivo = await call("PUT", "/folga-config", asAdmin, { limiteTotalModo: "EXIGE_MOTIVO", limiteAreaAtivo: false });
    assert(modoMotivo.status === 200 && modoMotivo.body.config?.limiteTotalModo === "EXIGE_MOTIVO" && modoMotivo.body.config?.limiteAreaAtivo === false, "o total vai para 'exige motivo' e o da área é desligado");
    const semAreaNoAviso = await call("GET", `/leave-requests/${pedidoCrisId}/analise`, asSup);
    assert(/limite total é 2/.test(semAreaNoAviso.body.dias?.[0]?.aviso ?? "") && !/limite é 1/.test(semAreaNoAviso.body.dias?.[0]?.aviso ?? ""), "com o limite por área desligado, só o total aparece");
    const semMotivo = await call("PATCH", `/leave-requests/${pedidoCrisId}`, asSup, { status: "APPROVED" });
    assert(semMotivo.status === 400 && /exige motivo/.test(semMotivo.body.message ?? ""), "no modo 'exige motivo', aprovar passando do limite total pede o porquê escrito");
    const comMotivo = await call("PATCH", `/leave-requests/${pedidoCrisId}`, asSup, { status: "APPROVED", decisionReason: "Consulta médica marcada; a Cris cobre outra data." });
    assert(comMotivo.status === 200, "com o motivo escrito, a decisão passa: o limite nunca é uma trava absoluta");
    assert((await call("PUT", "/folga-config", asAdmin, { limiteTotalAtivo: false })).status === 200, "a Administração desliga o limite total");
    const desligado = await call("GET", `/leave-requests/${pedidoCrisId}/analise`, asSup);
    assert(!/limite total/.test(desligado.body.dias?.[0]?.aviso ?? ""), "desligado, o limite total deixa de aparecer");

    // 6 · Lembrete de resposta: uma vez, só depois do tempo combinado, só para quem precisa responder.
    const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000);
    const [esperandoColega] = await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: ana.id, areaId: pat!.id, startDate: shiftOperationalDate(hoje, 20), endDate: shiftOperationalDate(hoje, 20), reason: "Troca", status: "PENDING", peerId: bia.id, peerProposedBy: sup.id, peerAccepted: null, swapReturnDate: shiftOperationalDate(hoje, 30), updatedAt: horasAtras(30) }).returning();
    const [recemProposta] = await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: cris.id, areaId: pat!.id, startDate: shiftOperationalDate(hoje, 21), endDate: shiftOperationalDate(hoje, 21), reason: "Troca", status: "PENDING", peerId: bia.id, peerProposedBy: sup.id, peerAccepted: null, swapReturnDate: shiftOperationalDate(hoje, 31), updatedAt: horasAtras(2) }).returning();
    const [esperandoPessoa] = await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: bia.id, areaId: pat!.id, startDate: shiftOperationalDate(hoje, 22), endDate: shiftOperationalDate(hoje, 23), reason: "Viagem", status: "PENDING", alternativeDates: [shiftOperationalDate(hoje, 22)], alternativeProposedBy: sup.id, alternativeAccepted: null, updatedAt: horasAtras(30) }).returning();
    const lembretesDe = async (userId: string) => (await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, userId))).filter((linha) => (linha.payload as { type?: string }).type === "leave.reminder");
    const primeira = await lembrarRespostasDeFolga(new Date(), org!.id);
    assert(primeira.lembrados === 2, "depois de 24 horas sem resposta, o colega da troca e a pessoa da proposta de dias ganham um lembrete cada; a proposta de 2 horas espera");
    assert((await lembretesDe(bia.id)).length === 2, "a Bia recebeu os dois lembretes que lhe cabem (a troca da Ana e a proposta de dias dela)");
    assert((await lembretesDe(sup.id)).length === 0 && (await lembretesDe(ana.id)).length === 0, "quem propôs e quem pediu a troca não são lembrados");
    assert((await lembrarRespostasDeFolga(new Date(), org!.id)).lembrados === 0, "o ciclo roda a cada minuto, mas o lembrete sai uma vez só");
    assert((await call("PUT", "/folga-config", asAdmin, { lembreteRespostaHoras: 0 })).status === 200, "a Administração desliga o lembrete");
    await db.update(leaveRequestsTable).set({ updatedAt: horasAtras(40) }).where(eq(leaveRequestsTable.id, recemProposta!.id));
    assert((await lembrarRespostasDeFolga(new Date(), org!.id)).lembrados === 0, "com o lembrete desligado (0 horas), ninguém é lembrado");
    assert(Boolean(esperandoColega && esperandoPessoa), "preparo do lembrete conferido");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(folgaConfigTable).where(eq(folgaConfigTable.organizationId, org!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, areaDeFora!.id]));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) nas regras do pedido de folga`);
  process.stdout.write(`folga-config: ${passed} asserts passed\n`);
}

process.stdout.write("folga-config: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
