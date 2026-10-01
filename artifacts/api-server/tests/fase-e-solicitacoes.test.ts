/**
 * Solicitações (01/10): horário na escala, troca com colega, mudança de horário, restrição e outro.
 * Escopo da Supervisão por área, motivo para recusar, ninguém decide o próprio pedido, horário aprovado
 * entra na Escala do dia, colega aceita a troca antes, Direção sem detalhe de saúde, avisos pela fila,
 * Registro em cada escrita. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, like, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, leaveRequestsTable, locationsTable,
  notificationOutboxTable, operationLocationsTable, operationsTable, organizationsTable, pool,
  requestDecisionsTable, requestsTable, restrictionsTable, userNotificationsTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { montarEscalaDoDia } from "../src/services/escala-dia.js";
import { pedidosEsperando } from "../src/services/solicitacoes.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `sol_${Date.now()}`;
  const dia = shiftOperationalDate(operationalDate(), 3), dia2 = shiftOperationalDate(operationalDate(), 4);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [opOutra] = await db.insert(operationsTable).values({ organizationId: outraOrg!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const [snow] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: op!.id, locationId: snow!.id });
  const [pat] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const [bai] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Bailarinos` }).returning();
  const mk = async (name: string, role: string, areaId: string | null, orgId = org!.id, opId = op!.id) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name, fullName: `${name} ${tag}`, username: `${tag}_${name}`.toLowerCase(), areaId, defaultLocationId: orgId === org!.id ? snow!.id : null }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: opId, role: role as never, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN", null);
  const cris = await mk("Cris", "DIR", null);
  const deborah = await mk("Deborah", "SUPERVISOR_A", pat!.id);
  const victor = await mk("Victor", "SUPERVISOR_A", bai!.id);
  const julia = await mk("Julia", "MEMBER", pat!.id);
  const carol = await mk("Carol", "MEMBER", pat!.id);
  const louis = await mk("Louis", "MEMBER", bai!.id);
  const intrusa = await mk("Intrusa", "ADMIN", null, outraOrg!.id, opOutra!.id);
  const everyone = [barbara, cris, deborah, victor, julia, carol, louis, intrusa].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: snow!.id, supervisorId: deborah.id },
    { areaId: bai!.id, locationId: snow!.id, supervisorId: victor.id },
  ]);

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tk = (u: { id: string; organizationId: string }, role: string, opId = op!.id) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: u.organizationId, role, operationIds: [opId] });
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
    };
    const asJulia = tk(julia, "MEMBER"), asCarol = tk(carol, "MEMBER"), asLouis = tk(louis, "MEMBER"), asDeborah = tk(deborah, "SUPERVISOR_A"), asVictor = tk(victor, "SUPERVISOR_A"), asBarbara = tk(barbara, "ADMIN"), asCris = tk(cris, "DIR"), asIntrusa = tk(intrusa, "ADMIN", opOutra!.id);
    const avisosPara = async (userId: string, requestId: string) => db.select().from(notificationOutboxTable).where(and(eq(notificationOutboxTable.userId, userId), like(notificationOutboxTable.deduplicationKey, `sol:${requestId}:%`)));
    const lista = async (token: string) => ((await call("GET", "/solicitacoes", token)).body.pedidos ?? []) as Record<string, any>[];

    // ── Validação ──
    assert((await call("POST", "/solicitacoes", asJulia, { tipo: "ESCALA_SLOT", data: dia, inicio: "14:00", fim: "14:30" })).status === 400, "horário na escala sem dizer para quê: recusado");
    assert((await call("POST", "/solicitacoes", asJulia, { tipo: "ESCALA_SLOT", data: dia, inicio: "15:00", fim: "14:30", assunto: "Peruca" })).status === 400, "horário que termina antes de começar: recusado");
    assert((await call("POST", "/solicitacoes", asJulia, { tipo: "ESCALA_SLOT", data: shiftOperationalDate(operationalDate(), -1), inicio: "14:00", fim: "14:30", assunto: "Peruca" })).status === 400, "data que já passou: recusada");
    assert((await call("POST", "/solicitacoes", asJulia, { tipo: "LEAVE", data: dia, motivo: "x" })).status === 400, "folga não entra por aqui (é a tela Folgas)");
    assert((await call("POST", "/solicitacoes", asCris, { tipo: "OTHER", assunto: "x", motivo: "y" })).status === 403, "Direção acompanha, não abre pedido");

    // ── Horário na escala ──
    const criado = await call("POST", "/solicitacoes", asJulia, { tipo: "ESCALA_SLOT", data: dia, inicio: "14:00", fim: "14:30", assunto: "Peruca", motivo: "ajuste da peruca nova" });
    assert(criado.status === 201 && criado.body.pedido?.estado === "PENDING" && criado.body.pedido?.local === snow!.name, "Julia pede horário de peruca; vai para análise, no local dela");
    const slot = criado.body.pedido.id as string;
    assert((await avisosPara(deborah.id, slot)).length === 1 && (await avisosPara(victor.id, slot)).length === 0, "o aviso vai para a supervisão da área dela (Deborah), não para a de outra área");
    const [registroCriacao] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, slot), eq(historyEventsTable.action, "solicitacao.criada")));
    assert(Boolean(registroCriacao), "o pedido entra no Registro");

    assert((await lista(asJulia)).some((p) => p.id === slot), "Julia vê o próprio pedido");
    assert(!(await lista(asCarol)).some((p) => p.id === slot), "Carol não vê o pedido da Julia");
    assert(!(await lista(asVictor)).some((p) => p.id === slot), "Victor (Bailarinos) não vê pedido de Patinadores");
    assert((await lista(asDeborah)).some((p) => p.id === slot && p.pode.decidir === true), "Deborah vê e pode decidir");
    assert((await lista(asCris)).some((p) => p.id === slot && p.pode.decidir === false), "Direção vê, sem decidir");
    assert(!(await lista(asIntrusa)).some((p) => p.id === slot), "outra organização não vê");

    assert((await call("POST", `/solicitacoes/${slot}/decisao`, asVictor, { decisao: "APPROVED" })).status === 403, "Victor não decide pedido de outra área");
    assert((await call("POST", `/solicitacoes/${slot}/decisao`, asJulia, { decisao: "APPROVED" })).status === 403, "ninguém decide o próprio pedido");
    assert((await call("POST", `/solicitacoes/${slot}/decisao`, asIntrusa, { decisao: "APPROVED" })).status === 404, "Administração de outra organização nem encontra o pedido");
    assert((await call("POST", `/solicitacoes/${slot}/decisao`, asDeborah, { decisao: "DENIED" })).status === 400, "recusar sem motivo: recusado");
    assert((await call("POST", `/solicitacoes/${slot}/decisao`, asDeborah, { decisao: "APPROVED", inicio: "14:30", fim: "15:00" })).status === 400, "aprovar em outro horário sem motivo: recusado");
    const esperando = await pedidosEsperando({ sub: deborah.id, organizationId: org!.id, role: "SUPERVISOR_A" });
    assert(esperando.paraDecidir === 1, "o Meu Dia da Deborah mostra 1 pedido a decidir");
    // Duas decisões ao mesmo tempo: só uma vale.
    const [d1, d2] = await Promise.all([
      call("POST", `/solicitacoes/${slot}/decisao`, asDeborah, { decisao: "APPROVED", inicio: "14:30", fim: "15:00", motivo: "às 14h a Julia está no ensaio" }),
      call("POST", `/solicitacoes/${slot}/decisao`, asBarbara, { decisao: "DENIED", motivo: "sem sala" }),
    ]);
    const vencedora = d1.status === 200 ? d1 : d2;
    assert([d1.status, d2.status].sort().join(",") === "200,409", "duas decisões ao mesmo tempo: uma vale, a outra recebe conflito");
    if (vencedora === d2) { // a ordem não é garantida: refaz o cenário esperado para o resto do teste
      await db.update(requestsTable).set({ status: "PENDING", decidedAt: null, decidedBy: null, decisionReason: null }).where(eq(requestsTable.id, slot));
      await call("POST", `/solicitacoes/${slot}/decisao`, asDeborah, { decisao: "APPROVED", inicio: "14:30", fim: "15:00", motivo: "às 14h a Julia está no ensaio" });
    }
    const [aprovado] = await db.select().from(requestsTable).where(eq(requestsTable.id, slot));
    assert(aprovado?.status === "APPROVED" && aprovado.startTime?.slice(0, 5) === "14:30" && aprovado.endTime?.slice(0, 5) === "15:00", "aprovado em outro horário: 14:30–15:00");
    assert((await avisosPara(julia.id, slot)).length === 1, "Julia recebe o aviso da decisão");
    const escala = await montarEscalaDoDia(org!.id, snow!.id, dia);
    const bloco = escala?.blocos.find((b) => b.key === `s:${slot}`);
    assert(Boolean(bloco) && bloco!.inicio === "14:30" && bloco!.fim === "15:00" && bloco!.rotulo === "Peruca" && bloco!.pessoaIds.join() === julia.id, "o horário aprovado entra sozinho na Escala do dia, só para a Julia");
    assert((await call("POST", `/solicitacoes/${slot}/decisao`, asBarbara, { decisao: "DENIED", motivo: "x" })).status === 409, "pedido já decidido não é decidido de novo");

    // Folga vence: horário aprovado num dia de folga não aparece.
    const outro = (await call("POST", "/solicitacoes", asJulia, { tipo: "ESCALA_SLOT", data: dia2, inicio: "10:00", fim: "10:30", assunto: "Vídeo do Dia das Mães" })).body.pedido.id as string;
    await call("POST", `/solicitacoes/${outro}/decisao`, asDeborah, { decisao: "APPROVED" });
    assert(Boolean((await montarEscalaDoDia(org!.id, snow!.id, dia2))?.blocos.some((b) => b.key === `s:${outro}`)), "segundo horário (vídeo) aprovado, na escala");
    await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: julia.id, areaId: pat!.id, startDate: dia2, endDate: dia2, reason: `${tag} folga`, status: "APPROVED", decidedBy: deborah.id, decidedAt: new Date(), decisionReason: "ok" });
    assert(!(await montarEscalaDoDia(org!.id, snow!.id, dia2))?.blocos.some((b) => b.key === `s:${outro}`), "com folga aprovada no dia, o horário não aparece (folga vence)");

    // ── Troca com colega ──
    const troca = await call("POST", "/solicitacoes", asJulia, { tipo: "SWAP", data: dia, colegaId: carol.id, motivo: "eu faço o show das 16h dela, ela faz o meu das 19h" });
    assert(troca.status === 201 && troca.body.pedido.estado === "WAITING_PEER", "troca começa esperando a colega");
    const trocaId = troca.body.pedido.id as string;
    assert((await avisosPara(carol.id, trocaId)).length === 1 && (await avisosPara(deborah.id, trocaId)).length === 0, "aviso vai para a Carol; a supervisão ainda não");
    assert((await lista(asCarol)).some((p) => p.id === trocaId && p.pode.responderColega === true), "Carol vê a troca e pode responder");
    assert((await pedidosEsperando({ sub: carol.id, organizationId: org!.id, role: "MEMBER" })).colegaEspera === 1, "o Meu Dia da Carol mostra a troca esperando por ela");
    assert((await call("POST", `/solicitacoes/${trocaId}/decisao`, asDeborah, { decisao: "APPROVED" })).status === 409, "a Supervisão não decide antes da colega responder");
    assert((await call("POST", `/solicitacoes/${trocaId}/colega`, asLouis, { aceita: true })).status === 403, "só a colega da troca responde");
    assert((await call("POST", `/solicitacoes/${trocaId}/colega`, asCarol, { aceita: true })).body.pedido?.estado === "PENDING", "Carol aceita: vai para a Supervisão");
    assert((await avisosPara(deborah.id, trocaId)).length === 1, "agora a Deborah recebe o aviso");
    const trocaOk = await call("POST", `/solicitacoes/${trocaId}/decisao`, asDeborah, { decisao: "APPROVED" });
    assert(trocaOk.status === 200 && trocaOk.body.pedido.estado === "APPROVED", "Deborah aprova a troca");
    assert((await avisosPara(carol.id, trocaId)).length === 2, "Carol também é avisada da decisão");
    const trocaNao = (await call("POST", "/solicitacoes", asJulia, { tipo: "SWAP", data: dia2, colegaId: carol.id, motivo: "troca de turno" })).body.pedido.id as string;
    assert((await call("POST", `/solicitacoes/${trocaNao}/colega`, asCarol, { aceita: false })).status === 400, "não aceitar sem dizer por quê: recusado");
    assert((await call("POST", `/solicitacoes/${trocaNao}/colega`, asCarol, { aceita: false, motivo: "tenho médico" })).body.pedido?.estado === "DENIED", "Carol não aceita: a troca acaba");

    // ── Cancelar ──
    const mudanca = (await call("POST", "/solicitacoes", asJulia, { tipo: "SCHEDULE_CHANGE", data: dia, inicio: "09:00", motivo: "preciso entrar às 9h" })).body.pedido.id as string;
    assert((await call("POST", `/solicitacoes/${mudanca}/cancelar`, asCarol)).status === 403, "só quem pediu cancela");
    assert((await call("POST", `/solicitacoes/${mudanca}/cancelar`, asJulia)).body.pedido?.estado === "CANCELLED", "Julia desiste antes da decisão");
    assert((await call("POST", `/solicitacoes/${mudanca}/decisao`, asDeborah, { decisao: "APPROVED" })).status === 409, "pedido cancelado não é decidido");
    assert((await call("POST", `/solicitacoes/${slot}/cancelar`, asJulia)).status === 409, "pedido já decidido não se cancela");

    // ── Restrição: dado de saúde ──
    const saude = (await call("POST", "/solicitacoes", asJulia, { tipo: "HEALTH_RESTRICTION", data: dia, ate: dia2, motivo: "tendinite no tornozelo" })).body.pedido.id as string;
    const vistaDirecao = (await lista(asCris)).find((p) => p.id === saude);
    assert(Boolean(vistaDirecao) && vistaDirecao!.oculto === true && vistaDirecao!.motivo === null && !JSON.stringify(vistaDirecao).includes("tendinite"), "Direção vê que existe, sem o detalhe de saúde");
    assert((await lista(asDeborah)).find((p) => p.id === saude)?.motivo === "tendinite no tornozelo", "a supervisão da área lê o detalhe");
    const [registroSaude] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, saude), eq(historyEventsTable.action, "solicitacao.criada")));
    assert(Boolean(registroSaude) && !JSON.stringify(registroSaude).includes("tendinite"), "o Registro não guarda o detalhe de saúde");
    await call("POST", `/solicitacoes/${saude}/decisao`, asBarbara, { decisao: "APPROVED" });
    const [restricao] = await db.select().from(restrictionsTable).where(and(eq(restrictionsTable.userId, julia.id), eq(restrictionsTable.notes, `Pedido ${saude}`)));
    assert(restricao?.type === "HEALTH" && restricao.periodStart === dia && restricao.periodEnd === dia2, "aprovada, a restrição fica registrada na pessoa, no período pedido");

    // ── Quem decide também pede: o próprio pedido é decidido por outra pessoa ──
    const daDeborah = (await call("POST", "/solicitacoes", asDeborah, { tipo: "OTHER", assunto: "Treino extra", motivo: "quero usar a pista às 8h" })).body.pedido.id as string;
    assert((await lista(asDeborah)).find((p) => p.id === daDeborah)?.pode.decidir === false, "a supervisora não vê o botão de decidir o próprio pedido");
    assert((await call("POST", `/solicitacoes/${daDeborah}/decisao`, asDeborah, { decisao: "APPROVED" })).status === 403, "a supervisora não aprova o próprio pedido");
    assert((await call("POST", `/solicitacoes/${daDeborah}/decisao`, asBarbara, { decisao: "APPROVED" })).status === 200, "a Administração decide o pedido da supervisora");

    // ── Outro assunto ──
    const outroAssunto = await call("POST", "/solicitacoes", asLouis, { tipo: "OTHER", assunto: "Figurino", motivo: "o figurino rasgou" });
    assert(outroAssunto.status === 201 && (await avisosPara(victor.id, outroAssunto.body.pedido.id)).length === 1, "Louis pede outro assunto; aviso para o Victor");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const pedidos = (await db.select({ id: requestsTable.id }).from(requestsTable).where(inArray(requestsTable.requesterId, everyone))).map((r) => r.id);
    if (pedidos.length) await db.delete(requestDecisionsTable).where(inArray(requestDecisionsTable.requestId, pedidos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, everyone));
    // Um servidor ligado no mesmo banco de teste pode ter entregado a fila no meio do teste.
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, everyone));
    await db.delete(restrictionsTable).where(inArray(restrictionsTable.userId, everyone));
    await db.delete(requestsTable).where(inArray(requestsTable.requesterId, everyone));
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    await db.delete(historyEventsTable).where(or(inArray(historyEventsTable.orgId, [org!.id, outraOrg!.id]), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, snow!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, snow!.id));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [op!.id, opOutra!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em Solicitações`);
  process.stdout.write(`fase-e-solicitacoes: ${passed} asserts passed\n`);
}

process.stdout.write("fase-e-solicitacoes: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
