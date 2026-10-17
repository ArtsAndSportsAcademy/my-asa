/**
 * Pedidos às responsabilidades — alguém pede algo escolhendo a responsabilidade ("Perucas"), sem saber quem cuida dela.
 * Cobre: para quem o pedido vai (principal, participante, substituto; nunca quem só lê); responsabilidade sem dono vai
 * para a Administração, dizendo por quê; em grupo basta uma pessoa aceitar e as outras são avisadas; dois aceites ao
 * mesmo tempo dão uma tarefa só; recusa pede motivo e, quando todas recusam, quem pediu recebe os motivos; quem é de
 * fora não vê a caixa; cancelar pede motivo e avisa quem recebeu.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, responsibilitiesTable, responsibilityAssignmentsTable, responsibilityRequestRecipientsTable, responsibilityRequestsTable, taskStepsTable, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { processNotificationOutbox } from "../src/services/notification-outbox.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `resp_pedidos_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), dir = await makeUser("dir"), ana = await makeUser("ana"), bia = await makeUser("bia"), cris = await makeUser("cris"), dan = await makeUser("dan"), eva = await makeUser("eva"), fora = await makeUser("fora");
  const todos = [admin, dir, ana, bia, cris, dan, eva, fora];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const resp = async (title: string, active = true) => (await db.insert(responsibilitiesTable).values({ orgId: org!.id, operationId: operation!.id, title, active }).returning())[0]!;
  const perucas = await resp("Perucas"), midias = await resp("Mídias"), semDono = await resp("Sem dono"), antiga = await resp("Antiga", false);
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
      ...[ana, bia, cris, dan, eva, fora].map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(responsibilityAssignmentsTable).values([
      // Perucas: Ana é a principal, Cris é a substituta dela, Eva só acompanha.
      { responsibilityId: perucas.id, memberId: ana.id, role: "PRIMARY", substituteMemberId: cris.id, active: true },
      { responsibilityId: perucas.id, memberId: eva.id, role: "VIEWER", active: true },
      // Mídias: três pessoas.
      { responsibilityId: midias.id, memberId: bia.id, role: "PRIMARY", active: true },
      { responsibilityId: midias.id, memberId: cris.id, role: "SECONDARY", active: true },
      { responsibilityId: midias.id, memberId: ana.id, role: "SECONDARY", active: true },
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const response = await fetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json" } });
      const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, json };
    };
    const adminApi = as(admin.id, "ADMIN"), dirApi = as(dir.id, "DIR"), anaApi = as(ana.id, "MEMBER"), biaApi = as(bia.id, "MEMBER"), crisApi = as(cris.id, "MEMBER"), danApi = as(dan.id, "MEMBER"), evaApi = as(eva.id, "MEMBER"), foraApi = as(fora.id, "MEMBER");
    const userIds = todos.map((person) => person.id);
    const entrega = async () => {
      for (let i = 0; i < 60; i++) {
        await processNotificationOutbox(async () => {});
        const faltam = await db.select({ id: notificationOutboxTable.id }).from(notificationOutboxTable).where(and(inArray(notificationOutboxTable.userId, userIds), inArray(notificationOutboxTable.status, ["pending", "sending"])));
        if (!faltam.length) return;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    };
    const avisos = (userId: string, type: string, requestId?: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, type))).then((rows) => requestId ? rows.filter((row) => row.entityId === requestId) : rows);

    // ── Para quem o pedido vai ─────────────────────────────────────────────────────
    const pedido = await danApi(`/responsibilities/${perucas.id}/requests`, { method: "POST", body: { title: "Refazer a peruca da Nona", details: "Ficou torta", dueDate: "2026-10-28" } });
    const pedidoId: string = pedido.json?.request?.id;
    assert(pedido.status === 201 && pedido.json?.request?.status === "OPEN", `qualquer pessoa pede algo a uma responsabilidade (${pedido.status} ${JSON.stringify(pedido.json).slice(0, 160)})`);
    const destinos = await db.select().from(responsibilityRequestRecipientsTable).where(eq(responsibilityRequestRecipientsTable.requestId, pedidoId));
    assert(destinos.map((linha) => linha.userId).sort().join() === [ana.id, cris.id].sort().join(), `vai para a principal e para a substituta, não para quem só acompanha (${destinos.length})`);
    await entrega();
    assert((await avisos(ana.id, "responsibility.request", pedidoId)).length === 1 && (await avisos(cris.id, "responsibility.request", pedidoId)).length === 1, "quem recebe o pedido é avisada");
    assert((await avisos(dan.id, "responsibility.request", pedidoId)).length === 0 && (await avisos(eva.id, "responsibility.request", pedidoId)).length === 0, "quem pediu e quem só acompanha não recebem aviso");

    // ── Sem dono: vai para a Administração, dizendo por quê ──────────────────────────
    const sem = await danApi(`/responsibilities/${semDono.id}/requests`, { method: "POST", body: { title: "Alguém para consertar o banco" } });
    await entrega();
    const avisoAdmin = await avisos(admin.id, "responsibility.request", sem.json?.request?.id);
    assert(sem.status === 201 && sem.json?.request?.semDono === true && avisoAdmin.length === 1 && /ainda não tem dono/i.test(avisoAdmin[0]?.message ?? ""), `responsabilidade sem dono: o pedido vai para a Administração e o aviso explica (${sem.status} ${avisoAdmin[0]?.message})`);
    const inativa = await danApi(`/responsibilities/${antiga.id}/requests`, { method: "POST", body: { title: "x" } });
    const semTitulo = await danApi(`/responsibilities/${perucas.id}/requests`, { method: "POST", body: { title: "  " } });
    assert(inativa.status === 404 && semTitulo.status === 400, `responsabilidade desativada e pedido sem título são recusados (${inativa.status} ${semTitulo.status})`);

    // ── Quem vê a caixa ──────────────────────────────────────────────────────────────
    const deFora = await foraApi(`/responsibilities/${perucas.id}/requests`);
    assert(deFora.status === 403 && /cuida|Administração/i.test(deFora.json?.message ?? ""), `quem é de fora não vê a caixa, com a frase (${deFora.status} ${deFora.json?.message})`);
    const veAna = await anaApi(`/responsibilities/${perucas.id}/requests`), veAdmin = await adminApi(`/responsibilities/${perucas.id}/requests`), veDir = await dirApi(`/responsibilities/${perucas.id}/requests`);
    assert(veAna.status === 200 && veAdmin.status === 200 && veDir.status === 200 && veAna.json?.requests?.some((item: any) => item.id === pedidoId), "quem cuida, a Administração e a Direção veem a caixa");
    const minhas = await danApi("/responsibility-requests/mine");
    assert(minhas.status === 200 && minhas.json?.requests?.some((item: any) => item.id === pedidoId), "quem pediu acompanha o próprio pedido");

    // ── Em grupo: basta uma aceitar; dois aceites ao mesmo tempo dão uma tarefa só ────
    const grupo = await danApi(`/responsibilities/${midias.id}/requests`, { method: "POST", body: { title: "Vídeo de Natal", dueDate: "2026-12-01" } });
    const grupoId: string = grupo.json?.request?.id;
    const corrida = await Promise.all([biaApi(`/responsibility-requests/${grupoId}/accept`, { method: "POST", body: {} }), crisApi(`/responsibility-requests/${grupoId}/accept`, { method: "POST", body: {} })]);
    const aceitos = corrida.filter((resposta) => resposta.status === 200), recusados = corrida.filter((resposta) => resposta.status === 409);
    assert(aceitos.length === 1 && recusados.length === 1 && /já foi aceito/i.test(recusados[0]?.json?.message ?? ""), `dois aceites ao mesmo tempo: um vence, o outro recebe "já foi aceito" (${corrida.map((resposta) => resposta.status).join(",")})`);
    const tarefas = await db.select().from(tasksTable).where(and(eq(tasksTable.organizationId, org!.id), eq(tasksTable.responsibilityId, midias.id)));
    assert(tarefas.length === 1 && tarefas[0]?.creatorId === dan.id && tarefas[0]?.dueDate === "2026-12-01" && tarefas[0]?.origin === "REQUEST", `nasce uma tarefa só, criada por quem pediu, com o prazo do pedido (${tarefas.length})`);
    const quemAceitou = aceitos[0]?.json?.task?.assigneeId as string;
    const etapas = await db.select().from(taskStepsTable).where(eq(taskStepsTable.taskId, tarefas[0]!.id));
    assert(etapas.length === 1 && etapas[0]?.assigneeId === quemAceitou, "a tarefa tem uma etapa, para quem aceitou");
    await entrega();
    const perdedora = quemAceitou === bia.id ? cris : bia, ouvinte = ana;
    assert((await avisos(perdedora.id, "responsibility.request_taken", grupoId)).length === 1 && (await avisos(ouvinte.id, "responsibility.request_taken", grupoId)).length === 1, "as outras pessoas do grupo são avisadas de que o pedido já foi aceito");
    assert((await avisos(quemAceitou === bia.id ? bia.id : cris.id, "responsibility.request_taken", grupoId)).length === 0, "quem aceitou não recebe o aviso de \"já foi aceito\"");
    assert((await avisos(dan.id, "responsibility.request_accepted", grupoId)).length === 1, "quem pediu é avisada de quem aceitou");
    const tarde = await anaApi(`/responsibility-requests/${grupoId}/accept`, { method: "POST", body: {} });
    assert(tarde.status === 409, `aceitar um pedido que já foi aceito dá 409 (${tarde.status})`);
    const naoDestinatario = await evaApi(`/responsibility-requests/${grupoId}/accept`, { method: "POST", body: {} });
    assert(naoDestinatario.status === 403, `quem não recebeu o pedido não o aceita (${naoDestinatario.status})`);

    // ── Recusar ─────────────────────────────────────────────────────────────────────
    const recusavel = await danApi(`/responsibilities/${midias.id}/requests`, { method: "POST", body: { title: "Reels do ensaio" } });
    const recusavelId: string = recusavel.json?.request?.id;
    const semMotivo = await anaApi(`/responsibility-requests/${recusavelId}/decline`, { method: "POST", body: {} });
    assert(semMotivo.status === 400, `recusar sem motivo é recusado (${semMotivo.status})`);
    await anaApi(`/responsibility-requests/${recusavelId}/decline`, { method: "POST", body: { reason: "Estou de folga essa semana" } });
    const aindaAberto = await db.select().from(responsibilityRequestsTable).where(eq(responsibilityRequestsTable.id, recusavelId));
    assert(aindaAberto[0]?.status === "OPEN", "uma recusa não fecha o pedido: ele segue aberto para as outras");
    await biaApi(`/responsibility-requests/${recusavelId}/decline`, { method: "POST", body: { reason: "Sem agenda" } });
    await crisApi(`/responsibility-requests/${recusavelId}/decline`, { method: "POST", body: { reason: "Já tenho três vídeos" } });
    const fechado = await db.select().from(responsibilityRequestsTable).where(eq(responsibilityRequestsTable.id, recusavelId));
    await entrega();
    const recusaAviso = await avisos(dan.id, "responsibility.request_declined", recusavelId);
    assert(fechado[0]?.status === "DECLINED" && recusaAviso.length === 1 && /Já tenho três vídeos/.test(recusaAviso[0]?.message ?? ""), `quando todas recusam, quem pediu recebe os motivos (${fechado[0]?.status} ${recusaAviso[0]?.message})`);

    // ── Cancelar ────────────────────────────────────────────────────────────────────
    const paraCancelar = await danApi(`/responsibilities/${perucas.id}/requests`, { method: "POST", body: { title: "Peruca do Papai Noel" } });
    const cancelarId: string = paraCancelar.json?.request?.id;
    const cancelaSemMotivo = await danApi(`/responsibility-requests/${cancelarId}/cancel`, { method: "POST", body: {} });
    const outraCancela = await anaApi(`/responsibility-requests/${cancelarId}/cancel`, { method: "POST", body: { reason: "quero" } });
    const cancelou = await danApi(`/responsibility-requests/${cancelarId}/cancel`, { method: "POST", body: { reason: "Já resolvi com a Marisa" } });
    await entrega();
    assert(cancelaSemMotivo.status === 400 && outraCancela.status === 403 && cancelou.status === 200, `só quem pediu cancela, e com motivo (${cancelaSemMotivo.status} ${outraCancela.status} ${cancelou.status})`);
    assert((await avisos(ana.id, "responsibility.request_cancelled", cancelarId)).length === 1, "quem tinha recebido o pedido é avisada do cancelamento");

    // ── Registro ────────────────────────────────────────────────────────────────────
    const registro = await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    const acoes = new Set(registro.map((evento) => evento.action));
    assert(["responsibility.request_created", "responsibility.request_accepted", "responsibility.request_declined", "responsibility.request_cancelled"].every((acao) => acoes.has(acao)), `cada passo gravou no Registro (${[...acoes].filter((acao) => acao.startsWith("responsibility.")).join(", ")})`);
    assert(registro.some((evento) => evento.action === "responsibility.request_cancelled" && JSON.stringify(evento.metadata).includes("Já resolvi com a Marisa")), "o motivo do cancelamento está no Registro");
  } finally {
    const orgTasks = await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    const ids = orgTasks.map((task) => task.id); const userIds = todos.map((person) => person.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    const pedidos = await db.select({ id: responsibilityRequestsTable.id }).from(responsibilityRequestsTable).where(eq(responsibilityRequestsTable.orgId, org!.id));
    if (pedidos.length) {
      await db.delete(responsibilityRequestRecipientsTable).where(inArray(responsibilityRequestRecipientsTable.requestId, pedidos.map((pedidoLinha) => pedidoLinha.id)));
      await db.delete(responsibilityRequestsTable).where(eq(responsibilityRequestsTable.orgId, org!.id));
    }
    if (ids.length) await db.delete(taskStepsTable).where(inArray(taskStepsTable.taskId, ids));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    await db.delete(responsibilityAssignmentsTable).where(inArray(responsibilityAssignmentsTable.responsibilityId, [perucas.id, midias.id, semDono.id, antiga.id]));
    await db.delete(responsibilitiesTable).where(eq(responsibilitiesTable.orgId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Pedidos às responsabilidades: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
