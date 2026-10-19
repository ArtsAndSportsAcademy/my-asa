/**
 * Mural — quem fica sabendo e quem pode cancelar.
 * Cobre o que o crivo das "coisinhas" pegou na revisão do Mural: aviso publicado ou cancelado não
 * tocava o sino de ninguém, e a Supervisão sem área conseguia cancelar aviso da casa inteira.
 */
import http from "node:http";
import { and, eq, inArray, like } from "drizzle-orm";
import { announcementCommentsTable, announcementReadsTable, announcementRecipientsTable, announcementsTable, areasTable, db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

type Payload = { type: string; title: string; message: string; priority: string; category: string; actionUrl: string; entityId: string };

async function run() {
  const tag = `mural_avisos_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_A` }, { organizationId: org!.id, name: `${tag}_B` }]).returning();
  const makeUser = async (name: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, areaId, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin", null), sup = await makeUser("sup", areaA!.id), supSemArea = await makeUser("sup_sem_area", null), mem = await makeUser("mem", areaA!.id), outra = await makeUser("outra", areaB!.id);
  const all = [admin, sup, supSemArea, mem, outra];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    // O papel de cada pessoa vem daqui, não do token: é o que a rota enxerga de verdade.
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: supSemArea.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: mem.id, operationId: operation!.id, role: "MEMBER", active: true },
      { userId: outra.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const adminApi = as(admin.id, "ADMIN"), supApi = as(sup.id, "SUPERVISOR_A"), supSemAreaApi = as(supSemArea.id, "SUPERVISOR_A"), memApi = as(mem.id, "MEMBER");
    const post = (api: typeof adminApi, path: string, body?: unknown) => api(path, { method: "POST", body: JSON.stringify(body ?? {}) });
    const avisosDe = async (chave: string) => (await db.select().from(notificationOutboxTable).where(like(notificationOutboxTable.deduplicationKey, `${chave}:%`)));
    const quem = (rows: { userId: string }[]) => rows.map(row => row.userId).sort().join(",");
    const ids = (...users: { id: string }[]) => users.map(user => user.id).sort().join(",");

    // ── Aviso da casa que pede ciente: todo mundo, menos quem publicou ──
    const casa = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", title: "Reunião de quinta", body: "Chamada às 9h30", requiresConfirmation: true });
    const casaId = ((await casa.json()) as { post: { id: string } }).post.id;
    const casaAvisos = await avisosDe(`mural:${casaId}:publicado`);
    assert(quem(casaAvisos) === ids(sup, supSemArea, mem, outra), `Aviso da casa chega ao sino de todos, menos de quem publicou (${casaAvisos.length} avisos)`);
    const casaPayload = casaAvisos[0]?.payload as Payload | undefined;
    assert(casaPayload?.type === "notice.requires_ack" && casaPayload.priority === "IMPORTANT" && casaPayload.actionUrl === "/mural" && casaPayload.message === "Reunião de quinta", `Aviso que pede ciente sai como tipo de push e importante, levando ao Mural: ${JSON.stringify(casaPayload)}`);
    const [casaRegistro] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, casaId), eq(historyEventsTable.action, "mural.notice_created")));
    assert((casaRegistro?.metadata as { avisados?: number } | null)?.avisados === 4, "O Registro diz quantas pessoas foram avisadas");

    // ── Aviso comum não vira push, e sem título o assunto é o começo do texto ──
    const comum = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", body: "Lembrete simples" });
    const comumId = ((await comum.json()) as { post: { id: string } }).post.id;
    const comumPayload = (await avisosDe(`mural:${comumId}:publicado`))[0]?.payload as Payload | undefined;
    assert(comumPayload?.type === "notice.published" && comumPayload.priority === "NORMAL" && comumPayload.message === "Lembrete simples", `Aviso comum é normal, sem push: ${JSON.stringify(comumPayload)}`);

    // ── Aviso de uma área: só quem é da área ──
    const daArea = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "AREA", areaId: areaA!.id, body: `${tag} só da área A` });
    const daAreaId = ((await daArea.json()) as { post: { id: string } }).post.id;
    assert(quem(await avisosDe(`mural:${daAreaId}:publicado`)) === ids(sup, mem), "Aviso de uma área avisa só quem é da área");

    // ── Aviso para pessoas escolhidas: só elas ──
    const escolhidas = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "PEOPLE", recipientIds: [mem.id, outra.id], body: `${tag} só duas pessoas` });
    const escolhidasId = ((await escolhidas.json()) as { post: { id: string } }).post.id;
    assert(quem(await avisosDe(`mural:${escolhidasId}:publicado`)) === ids(mem, outra), "Aviso para pessoas escolhidas avisa só as escolhidas");

    // ── Reconhecimento: a pessoa reconhecida sabe quem a reconheceu e por quê ──
    const reconhecimento = await post(memApi, "/communication/mural", { type: "RECOGNITION", scope: "HOUSE", recipientId: outra.id, reason: "Cuidado com a equipe", body: "Obrigada!" });
    const reconhecimentoId = ((await reconhecimento.json()) as { post: { id: string } }).post.id;
    const reconhecimentoAvisos = await avisosDe(`mural:${reconhecimentoId}:publicado`);
    const reconhecimentoPayload = reconhecimentoAvisos[0]?.payload as Payload | undefined;
    assert(quem(reconhecimentoAvisos) === ids(outra) && reconhecimentoPayload?.type === "notice.recognition" && reconhecimentoPayload.message.includes(`${tag}_mem`) && reconhecimentoPayload.message.includes("Cuidado com a equipe"), `Quem é reconhecido é avisado, com o nome de quem reconheceu e o motivo: ${JSON.stringify(reconhecimentoPayload)}`);
    const proprio = await post(memApi, "/communication/mural", { type: "RECOGNITION", scope: "HOUSE", recipientId: mem.id, reason: "Eu mesma", body: "Teste" });
    assert(proprio.status === 400, "Reconhecimento de si mesma é recusado (decisão de 19/10/2026)");
    const proprioCorpo = (await proprio.json()) as { error?: string };
    assert(Boolean(proprioCorpo.error?.includes("colegas")), `A recusa diz que reconhecimento é para os colegas: ${JSON.stringify(proprioCorpo)}`);

    // ── Publicação recusada não avisa ninguém ──
    const recusado = await post(adminApi, "/communication/mural", { type: "NOTICE", scope: "AREA", areaId: "00000000-0000-4000-8000-000000000000", body: "Área que não existe" });
    assert(recusado.status === 404, "Aviso para área inexistente continua recusado");

    // ── Quem pode cancelar: Supervisão sem área não cancela aviso da casa ──
    const semAreaCancela = await post(supSemAreaApi, `/communication/mural/${casaId}/cancel`, { reason: "Tentando cancelar o que não é meu" });
    const semAreaErro = await semAreaCancela.json() as { error?: string };
    assert(semAreaCancela.status === 403 && /pode remover/.test(semAreaErro.error ?? ""), `Supervisão sem área não cancela aviso da casa, e a recusa explica quem pode (${semAreaCancela.status}: ${semAreaErro.error})`);
    const semAreaCientes = await supSemAreaApi(`/communication/mural/${casaId}/cientes`);
    assert(semAreaCientes.status === 403, "Supervisão sem área também não vê quem falta no aviso da casa");
    const feedSemArea = ((await (await supSemAreaApi("/communication/mural")).json()) as { posts: { id: string; canCancel: boolean }[] }).posts;
    assert(feedSemArea.find(item => item.id === casaId)?.canCancel === false, "O Mural não oferece 'cancelar aviso' à Supervisão sem área");
    const supCancelaCasa = await post(supApi, `/communication/mural/${casaId}/cancel`, { reason: "Não é da minha área" });
    assert(supCancelaCasa.status === 403, "Supervisão de uma área não cancela aviso da casa de outra pessoa");
    assert((await db.select({ cancelledAt: announcementsTable.cancelledAt }).from(announcementsTable).where(eq(announcementsTable.id, casaId)))[0]?.cancelledAt === null, "Nada foi cancelado pelas tentativas recusadas");
    assert((await avisosDe(`mural:${casaId}:cancelado`)).length === 0, "Cancelamento recusado não avisa ninguém");

    // ── Cancelar: Supervisão da área cancela o aviso da área; quem recebeu e quem publicou ficam sabendo ──
    const supCancela = await post(supApi, `/communication/mural/${daAreaId}/cancel`, { reason: "Mudou o horário" });
    assert(supCancela.status === 200, `Supervisão da área cancela o aviso da área (${supCancela.status})`);
    const cancelados = await avisosDe(`mural:${daAreaId}:cancelado`);
    assert(quem(cancelados) === ids(admin, mem), `Cancelar avisa quem recebeu e quem publicou, menos quem cancelou (${cancelados.length} avisos)`);
    const canceladoPayload = cancelados[0]?.payload as Payload | undefined;
    assert(canceladoPayload?.type === "notice.cancelled" && canceladoPayload.message.includes("Mudou o horário") && canceladoPayload.actionUrl === "/mural", `O aviso de cancelamento diz o motivo: ${JSON.stringify(canceladoPayload)}`);
    const [cancelRegistro] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, daAreaId), eq(historyEventsTable.action, "mural.notice_cancelled")));
    assert((cancelRegistro?.metadata as { avisados?: number; reason?: string } | null)?.avisados === 2 && (cancelRegistro?.metadata as { reason?: string }).reason === "Mudou o horário", "O Registro guarda o motivo e quantos foram avisados do cancelamento");
    const adminCancela = await post(adminApi, `/communication/mural/${casaId}/cancel`, { reason: "Reunião adiada" });
    assert(adminCancela.status === 200, "Administração cancela o aviso da casa");
    assert(quem(await avisosDe(`mural:${casaId}:cancelado`)) === ids(sup, supSemArea, mem, outra), "Cancelar o aviso da casa avisa todo mundo que o recebeu");

    // ── Comentário devolve o nome de quem comentou (o site não tem de adivinhar) ──
    const comentario = await post(memApi, `/communication/mural/${comumId}/comments`, { body: "Combinado" });
    const comentarioBody = await comentario.json() as { comment?: { authorName?: string } };
    assert(comentario.status === 201 && comentarioBody.comment?.authorName === `${tag}_mem`, `Comentário novo volta com o nome de quem comentou (${JSON.stringify(comentarioBody)})`);
  } finally {
    if (server) { (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    const userIds = all.map(user => user.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    await db.delete(announcementCommentsTable).where(inArray(announcementCommentsTable.authorId, userIds));
    await db.delete(announcementReadsTable).where(inArray(announcementReadsTable.userId, userIds));
    await db.delete(announcementRecipientsTable).where(inArray(announcementRecipientsTable.userId, userIds));
    await db.delete(announcementsTable).where(eq(announcementsTable.orgId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Mural (avisos e cancelamento): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
