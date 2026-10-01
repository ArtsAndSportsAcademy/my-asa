import http from "node:http";
import { randomUUID, createECDH, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db, pool, organizationsTable, operationsTable, operationalGroupsTable, areasTable, usersTable, userRolesTable, teamMembershipsTable, requestsTable, requestDecisionsTable, formationsTable, libraryDocumentsTable, noticesTable, noticeRecipientsTable, occurrencesTable, operationalCheckInsTable, historyEventsTable, scalesTable, scaleAllocationsTable, allocationExceptionsTable, undoActionsTable, notificationOutboxTable, userNotificationsTable, pwaInstallationsTable, webPushSubscriptionsTable, agendaEventsTable, agendaEventParticipantsTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { processNotificationOutbox } from "../src/services/notification-outbox.js";
import { undoAction } from "../src/services/undo.js";
import { autoPublishScales, enqueueShiftReminders, startOperationalScheduler, stopOperationalScheduler } from "../src/services/operational-jobs.js";
import { deliverWebPush, validPushEndpoint, WEB_PUSH_TYPES } from "../src/services/web-push.js";
import { asaSearchAtTop, searchDate } from "../src/services/global-search.js";
import { executeTool } from "../src/routes/asa.js";

let passed = 0;
const failures: string[] = [];
function assert(value: unknown, message: string) { if (value) { passed++; console.log(`  ✓ ${message}`); } else { failures.push(message); console.error(`  ✗ ${message}`); } }
async function run() {
  const tag = `block7_${Date.now()}`, date = "2026-09-24";
  // Este teste prova janela de desfazer e fila sem duplicar, não o silêncio noturno (que tem teste
  // próprio em fase-c-perfil-regras). Sem isto, rodar entre 22h e 06h de São Paulo adiaria o push.
  const [org] = await db.insert(organizationsTable).values({ name: tag, regras: { silencio: { on: false, de: "22:00", ate: "06:00" }, lembreteCheckinMin: 30 } }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: tag, status: "ACTIVE" }).returning();
  const [group] = await db.insert(operationalGroupsTable).values({ organizationId: org!.id, operationId: op!.id, name: tag }).returning();
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_A` }, { organizationId: org!.id, name: `${tag}_B` }]).returning();
  const people = await db.insert(usersTable).values([
    { organizationId: org!.id, fullName: "Administração Formal", name: "Admin", username: `${tag}_admin` },
    { organizationId: org!.id, fullName: "Mariela de Souza", name: "Mariela", username: `${tag}_mariela`, areaId: areaA!.id },
    { organizationId: org!.id, fullName: "Victor Marssalai", name: "Victor M.", areaId: areaA!.id },
    { organizationId: org!.id, name: "Antônio", areaId: areaA!.id },
    { organizationId: org!.id, name: "Geovanni", areaId: areaA!.id },
    { organizationId: org!.id, fullName: "Carolina Rocha", name: "Carol", areaId: areaA!.id },
    { organizationId: org!.id, fullName: "Mariela da Costa", name: "Mariela", areaId: areaB!.id },
    { organizationId: org!.id, name: "Direção" },
    { organizationId: org!.id, name: "Supervisão A" },
    { organizationId: org!.id, name: "Supervisão B" },
    { organizationId: org!.id, name: "Treinador" },
  ]).returning();
  const [admin, member, victor, antonio, geovanni, carol, otherArea, director] = people;
  const actors = people.map(row => row.id);
  let server: http.Server | undefined;
  try {
    await db.insert(userRolesTable).values(people.map((person, i) => ({ userId: person.id, operationId: op!.id, groupId: group!.id, role: i === 0 ? "ADMIN" as const : i === 7 ? "DIR" as const : i === 8 ? "SUPERVISOR_A" as const : i === 9 ? "SUPERVISOR_B" as const : i === 10 ? "TRAINER" as const : "MEMBER" as const })));
    await db.insert(teamMembershipsTable).values({ teamId: group!.id, userId: member!.id, active: true, isPrimary: true });
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (person: typeof people[number], role: string) => signAccessToken({ sub: person.id, jti: randomUUID(), role, organizationId: org!.id, operationIds: [op!.id] });
    const auth = token(admin!, "ADMIN"), mem = token(member!, "MEMBER"), dir = token(director!, "DIR");
    const request = (path: string, bearer = auth, method = "GET", body?: unknown) => fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
    const newLeave = async () => (await db.insert(requestsTable).values({ requesterId: member!.id, operationId: op!.id, type: "LEAVE", targetDates: [date], status: "PENDING", reason: "Pedido" }).returning())[0]!;
    const deny = async (id: string) => { const response = await request(`/requests/${id}/decision`, auth, "POST", { decision: "DENIED", reason: "Necessidade operacional" }); const body = await response.json() as any; assert(response.status === 201 && body.undo?.id, "Negar folga retorna uma janela central de 10 segundos"); return body.undo as { id: string; expiresAt: string }; };
    const sent: string[] = [];
    const deliver = async (input: { entityId?: string }) => { if (input.entityId) sent.push(input.entityId); };
    const leave = await newLeave(), undo = await deny(leave.id);
    await processNotificationOutbox(deliver);
    assert(!sent.includes(leave.id), "Negar folga não envia notificação dentro da janela");
    const undone = await request(`/actions/${undo.id}/undo`, auth, "POST");
    assert(undone.status === 200, "Desfazer por HTTP sucede dentro dos 10 segundos");
    const [restored] = await db.select().from(requestsTable).where(eq(requestsTable.id, leave.id));
    const decisions = await db.select().from(requestDecisionsTable).where(eq(requestDecisionsTable.requestId, leave.id));
    const [job] = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.undoActionId, undo.id));
    assert(restored?.status === "PENDING" && decisions[0]?.revertedAt && job?.status === "cancelled", "Reversão e cancelamento persistem; a decisão original continua recuperável");
    const [history] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, leave.id), eq(historyEventsTable.action, "action.undone")));
    assert(history?.beforeState && history.afterState && history.actorId === admin!.id, "Registro do desfazimento guarda ator e antes/depois");
    const leave2 = await newLeave(), undo2 = await deny(leave2.id);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    let failed = false;
    try { await undoAction(undo2.id, admin!.id, org!.id); } catch { failed = true; }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    const [notRestored] = await db.select().from(requestsTable).where(eq(requestsTable.id, leave2.id));
    const [notCancelled] = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.undoActionId, undo2.id));
    assert(failed && notRestored?.status === "DENIED" && notCancelled?.status === "pending", "Registro falhando desfaz toda a transação de undo, inclusive cancelamento");
    const remaining = Math.max(0, Date.parse(undo2.expiresAt) - Date.now()) + 100;
    await delay(remaining); // Actual elapsed 10-second window, not a mocked clock.
    // `due_at` is compared with Postgres' clock_timestamp().  The test runner and
    // remote Postgres are not guaranteed to agree within 100 ms, so retry the
    // due-work claim briefly instead of turning clock skew into a false failure.
    for (let attempt = 0; attempt < 5 && !sent.includes(leave2.id); attempt++) {
      await processNotificationOutbox(deliver);
      if (!sent.includes(leave2.id)) await delay(250);
    }
    assert(sent.includes(leave2.id) && !sent.includes(leave.id), "Após 10 segundos envia a não desfeita; a desfeita nunca envia");
    await processNotificationOutbox(deliver);
    assert(sent.filter(id => id === leave2.id).length === 1, "Fila não duplica notificação já entregue");
    const late = await request(`/actions/${undo2.id}/undo`, auth, "POST");
    assert(late.status === 409, "Desfazer depois da janela é rejeitado no servidor");
    const forbiddenUndo = await request(`/actions/${undo.id}/undo`, mem, "POST");
    assert(forbiddenUndo.status === 403, "Outra pessoa não pode desfazer a ação");

    const [formation] = await db.insert(formationsTable).values({ organizationId: org!.id, name: tag, peopleCount: 1, positions: [{ role: "Papel", function: "Função", coordinate: { x: 1, y: 1 } }] }).returning();
    const formationResponse = await request(`/formations/${formation!.id}/deactivate`, auth, "POST");
    const formationBody = await formationResponse.json() as any;
    const formationUndo = await request(`/actions/${formationBody.undo.id}/undo`, auth, "POST");
    assert(formationResponse.status === 200 && formationUndo.status === 200 && (await db.select().from(formationsTable).where(eq(formationsTable.id, formation!.id)))[0]?.active, "Desativar formação usa o mesmo caminho e desfazer a reativa");
    const [document] = await db.insert(libraryDocumentsTable).values({ orgId: org!.id, type: "ONBOARDING_MATERIAL", title: "Documento publicado", body: "Conteúdo", status: "PUBLISHED", createdBy: admin!.id }).returning();
    await db.insert(libraryDocumentsTable).values({ orgId: org!.id, type: "ONBOARDING_MATERIAL", title: "Documento privado", body: "Rascunho", status: "DRAFT", createdBy: admin!.id });
    const archive = await request(`/library/documents/${document!.id}/archive`, auth, "POST"), archived = await archive.json() as any;
    const unarchive = await request(`/actions/${archived.undo.id}/undo`, auth, "POST");
    assert(archive.status === 200 && unarchive.status === 200 && (await db.select().from(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, document!.id)))[0]?.status === "PUBLISHED", "Arquivar e desfazer documento preservam conteúdo e publicação");
    const removed = await request(`/operational-groups/${group!.id}/members/${member!.id}`, auth, "DELETE");
    const groupUndo = JSON.parse(removed.headers.get("X-MyASA-Undo")!);
    const returned = await request(`/actions/${groupUndo.id}/undo`, auth, "POST");
    assert(removed.status === 204 && returned.status === 200 && (await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.userId, member!.id)))[0]?.isPrimary, "Remover e desfazer pessoa de grupo recuperam vínculo e primário");
    const asaRemoval = JSON.parse(await executeTool("remover_membro_grupo", { groupId: group!.id, userId: member!.id }, { userId: admin!.id, organizationId: org!.id, userRole: "ADMIN", operationId: op!.id }));
    assert(asaRemoval.undo?.id && (await request(`/actions/${asaRemoval.undo.id}/undo`, auth, "POST")).status === 200, "Remoção executada pela ASA também devolve o mesmo desfazer central");
    const [notice] = await db.insert(noticesTable).values({ authorId: admin!.id, operationId: op!.id, title: "Aviso", content: "Publicado", status: "PUBLISHED", requiresConfirmation: true }).returning();
    const blankCancel = await request(`/notices/${notice!.id}/cancel`, auth, "POST", { reason: "   " });
    const cancel = await request(`/notices/${notice!.id}/cancel`, auth, "POST", { reason: "Mudança operacional" }), cancelled = await cancel.json() as any;
    assert(blankCancel.status === 400 && cancel.status === 200 && !cancelled.undo, "Cancelar aviso publicado exige motivo não vazio e não oferece desfazer");

    const installationId = randomUUID(), ecdh = createECDH("prime256v1"); ecdh.generateKeys();
    const subscription = { endpoint: `https://fcm.googleapis.com/fcm/send/${tag}`, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") }, installationId };
    assert((await request("/web-push/subscriptions", mem, "POST", subscription)).status === 409, "Inscrição antes da abertura instalada é recusada");
    assert((await request("/pwa/installations", mem, "POST", { installationId, displayMode: "browser" })).status === 400, "Aba comum não é registrada como instalação");
    assert((await request("/pwa/installations", mem, "POST", { installationId, displayMode: "standalone" })).status === 201, "Abertura instalada é persistida");
    const subscribed = await request("/web-push/subscriptions", mem, "POST", subscription), subscriptionBody = await subscribed.json() as any;
    assert(subscribed.status === 201 && (await db.select().from(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.userId, member!.id))).length === 1, "Inscrição Web Push é gravada separada dos tokens Expo");
    assert((await request("/pwa/installations", mem)).status === 403 && (await request("/pwa/installations", dir)).status === 403, "Apenas ADM consulta quem ainda não instalou");
    const installs = await (await request("/pwa/installations")).json() as any;
    assert(installs.people.find((row: any) => row.id === member!.id)?.installed && !installs.people.find((row: any) => row.id === admin!.id)?.installed, "Pessoas distingue instalado de ainda não identificado");
    const vapid = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = vapid.publicKey; process.env.VAPID_PRIVATE_KEY = vapid.privateKey; process.env.VAPID_SUBJECT = "mailto:test@example.com";
    let transportCount = 0;
    const transport: typeof webpush.sendNotification = async (target, payload, options) => {
      transportCount++; assert(target.endpoint === subscription.endpoint && options?.vapidDetails?.publicKey === vapid.publicKey, "Transporte recebe inscrição e VAPID corretos");
      assert(!String(payload).includes("atestado") && String(payload).includes("Escala mudou"), "Payload de Web Push é mínimo e não carrega motivos privados");
      return { statusCode: 201, body: "", headers: {} };
    };
    const push = await deliverWebPush({ userId: member!.id, type: "scale.changed", title: "atestado", message: "atestado privado", category: "schedule" }, transport);
    assert(push.delivered === 1 && transportCount === 1, "Integração do remetente entrega ao transporte inscrito (não é recibo de navegador real)");
    await deliverWebPush({ userId: member!.id, type: "request.denied", title: "Folga", message: "Recusada", category: "approval" }, transport);
    assert(transportCount === 1 && WEB_PUSH_TYPES.size === 5, "Web Push restringe-se às três categorias, sem folga/ocorrência/chat");
    assert(!validPushEndpoint("https://127.0.0.1/private") && !validPushEndpoint("https://fcm.googleapis.com.evil.test/push"), "Inscrição não permite SSRF ou host que imita provedor");
    assert((await request(`/web-push/subscriptions/${subscriptionBody.subscription.id}`, auth, "DELETE")).status === 403, "Outra conta não pode remover inscrição do navegador");
    const publicTables = await pool.query(`
      select c.relname, c.relrowsecurity,
        has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
        has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
        has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
        has_table_privilege('anon', c.oid, 'DELETE') as anon_delete
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    `);
    assert(publicTables.rows.length > 0 && publicTables.rows.every(row => row.relrowsecurity && !row.anon_select && !row.anon_insert && !row.anon_update && !row.anon_delete), "Todas as tabelas do schema público têm RLS e nenhum grant efetivo para anon");
    const anonymous = await pool.connect();
    try {
      await anonymous.query("begin");
      await anonymous.query("set local role anon");
      let readRejected = false;
      try { await anonymous.query("select * from public.users limit 1"); }
      catch (error) { readRejected = (error as { code?: string }).code === "42501"; }
      assert(readRejected, "Anon do Supabase não lê nenhuma tabela operacional pela Data API");
      // Uma permissão negada aborta a transação atual no PostgreSQL. Iniciamos
      // outra para provar o bloqueio de escrita, em vez de aceitar 25P02.
      await anonymous.query("rollback");
      await anonymous.query("begin");
      await anonymous.query("set local role anon");
      let rejected = false;
      try { await anonymous.query("insert into web_push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4)", [member!.id, `${subscription.endpoint}/anonymous`, subscription.keys.p256dh, subscription.keys.auth]); }
      catch { rejected = true; }
      assert(rejected, "Anon do Supabase também não grava inscrição burlando a API");
    } finally { await anonymous.query("rollback"); anonymous.release(); }
    await db.insert(occurrencesTable).values({ personId: member!.id, date, type: "ausencia", description: "atestado privado", reason: "atestado de saúde", registeredBy: admin!.id });
    await db.insert(operationalCheckInsTable).values({ orgId: org!.id, operationId: op!.id, userId: member!.id, date, status: "EXCUSED", excuseReason: "atestado" });
    const search = async (q: string, bearer = mem) => (await (await request(`/search?q=${encodeURIComponent(q)}`, bearer)).json()) as any;
    const mar = await search("mar");
    assert(mar.groups[0].items[0]?.id === member!.id && mar.groups[0].items.some((row: any) => row.id === victor!.id), "Prefixo do nome ganha de sobrenome: Mariela antes de Victor Marssalai");
    assert(!mar.groups[0].items.some((row: any) => row.id === otherArea!.id), "MEM não recebe pessoa de outra área na busca");
    assert((await request(`/directory/people/${otherArea!.id}`, mem)).status === 403, "Diretório também recusa pessoa fora da área");
    assert((await search("antonio")).groups[0].items[0]?.id === antonio!.id, "Busca ignora acento");
    assert((await search("GEOVANI")).groups[0].items[0]?.id === geovanni!.id, "Busca ignora caixa e perdoa uma letra errada");
    assert((await search("Carol")).groups[0].items[0]?.id === carol!.id, "Apelido é pesquisável");
    assert((await search("marila")).groups[0].items[0]?.id === member!.id, "Marila encontra Mariela");
    assert(!(await search("Documento privado")).groups[3].items.length, "MEM não recebe documento não publicado");
    for (const bearer of [auth, mem, dir, token(people[8]!, "SUPERVISOR_A"), token(people[9]!, "SUPERVISOR_B"), token(people[10]!, "TRAINER")]) { const result = await search("atestado", bearer); assert(result.groups.every((item: any) => !item.items.length), "Atestado não indexa ocorrência nem motivo de falta em qualquer perfil testado"); }
    assert(searchDate("ontem", new Date("2026-09-13T02:30:00Z")) === "2026-09-11" && searchDate("12/09", new Date("2026-09-13T02:30:00Z")) === "2026-09-12" && searchDate("12 de setembro", new Date("2026-09-13T02:30:00Z")) === "2026-09-12", "Datas relativas e escritas respeitam São Paulo, inclusive às 23:30");
    assert(searchDate("31/02") === null, "Data inexistente não vira resultado");
    const dateHits = await search("12 de setembro");
    assert(dateHits.groups[1].items[0]?.id === "2026-09-12", "Data é resultado navegável, no grupo Datas");
    assert(asaSearchAtTop("quem está no show", 2) && asaSearchAtTop("programação de amanhã cedo", 2) && asaSearchAtTop("Astrid?", 2) && asaSearchAtTop("nada", 0) && !asaSearchAtTop("Carol", 1), "ASA sobe em pergunta, quatro palavras e ausência de resultado; senão fica no rodapé");
    assert(mar.groups.map((row: any) => row.label).join("|") === "Pessoas|Datas|Shows|Documentos|Avisos" && mar.groups.every((row: any) => row.items.length <= 3), "Grupos têm ordem fixa e máximo de três resultados");
    const victorByFormalName = await search("Victor Massalai", auth);
    assert(victorByFormalName.groups[0].items.some((row: any) => row.id === victor!.id && row.label === "Victor M."), "Busca encontra a pessoa pelo nome completo e devolve o nome de exibição");
    const ownProfile = await (await request(`/users/${member!.id}`, mem)).json() as any;
    const adminProfile = await (await request(`/users/${member!.id}`, auth)).json() as any;
    assert(!("fullName" in ownProfile.user) && ownProfile.user.name === "Mariela" && adminProfile.user.fullName === "Mariela de Souza", "Nome completo só aparece na ficha administrativa; a pessoa vê o nome de exibição");
    const duplicateNames = await db.select().from(usersTable).where(and(eq(usersTable.organizationId, org!.id), eq(usersTable.name, "Mariela")));
    assert(duplicateNames.length === 2, "Dois nomes de exibição iguais são aceitos sem alterar automaticamente o nome");
    const rename = await request(`/users/${member!.id}`, mem, "PATCH", { displayName: "Mari" });
    const blankRename = await request(`/users/${member!.id}`, mem, "PATCH", { displayName: "   " });
    const [renamedMember] = await db.select().from(usersTable).where(eq(usersTable.id, member!.id));
    const [renameHistory] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, member!.id), eq(historyEventsTable.action, "user.display_name_changed")));
    assert(rename.status === 200 && blankRename.status === 400 && renamedMember?.name === "Mari" && renamedMember?.fullName === "Mariela de Souza" && renameHistory?.actorName === "Mariela de Souza", "A própria pessoa altera só seu nome de exibição sem motivo; vazio é rejeitado e o Registro usa nome formal");

    const [due, future, pending] = await db.insert(scalesTable).values([
      { operationId: op!.id, title: "No prazo", periodStart: date, periodEnd: date, publishDeadline: new Date(Date.now() - 1000), createdBy: admin!.id },
      { operationId: op!.id, title: "Futura", periodStart: date, periodEnd: date, publishDeadline: new Date(Date.now() + 3600_000), createdBy: admin!.id },
      { operationId: op!.id, title: "Pendente", periodStart: date, periodEnd: date, publishDeadline: new Date(Date.now() - 1000), createdBy: admin!.id },
    ]).returning();
    await db.insert(scaleAllocationsTable).values([{ scaleId: due!.id, userId: member!.id, status: "CONFLICT", manualDate: date, manualLabel: "Turno", startTime: "10:00", endTime: "11:00" }, { scaleId: future!.id, userId: member!.id, status: "ASSIGNED", manualDate: date }, { scaleId: pending!.id, status: "OPEN", manualDate: date }]);
    const autopub = await autoPublishScales(org!.id);
    assert(autopub.published.includes(due!.id), "Publicação automática executa no prazo, mesmo com alerta de conflito");
    assert(autopub.pending.includes(pending!.id) && (await db.select().from(scalesTable).where(eq(scalesTable.id, pending!.id)))[0]?.status === "DRAFT", "Pendência aberta trava intencionalmente a publicação automática");
    assert((await db.select().from(scalesTable).where(eq(scalesTable.id, future!.id)))[0]?.status === "DRAFT", "Prazo futuro não publica antes da hora");
    assert(!(await autoPublishScales(org!.id)).published.includes(due!.id), "Segundo ciclo não republica escala já publicada");
    const print = await request(`/scales/print-day?date=${date}`, mem), printBody = await print.json() as any;
    assert(print.status === 200 && printBody.entries.length === 1 && !JSON.stringify(printBody).includes("atestado"), "Impressão contém escala publicada e nenhuma ocorrência/motivo privado");
    const [rehearsal] = await db.insert(agendaEventsTable).values({ operationId: op!.id, type: "REHEARSAL", title: "Ensaio de impressão", date, startTime: "13:00", endTime: "13:30", status: "CONFIRMED", createdBy: admin!.id }).returning();
    await db.insert(agendaEventParticipantsTable).values({ eventId: rehearsal!.id, userId: member!.id });
    const composedPrint = await (await request(`/scales/print-day?date=${date}`, mem)).json() as any;
    assert(composedPrint.entries.length === 2 && composedPrint.entries.some((entry: any) => entry.label === "Ensaio de impressão"), "Impressão inclui também os compromissos compostos da Agenda, sem inventar outra escala");
    await enqueueShiftReminders(new Date(`${date}T13:05:00Z`), org!.id);
    await enqueueShiftReminders(new Date(`${date}T13:06:00Z`), org!.id);
    const reminders = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, member!.id));
    assert(reminders.filter(row => (row.payload as any).type === "checkin.shift_reminder").length === 1, "Lembrete do turno é agendado uma só vez, mesmo com dois ciclos");
    await enqueueShiftReminders(new Date(`${date}T16:05:00Z`), org!.id);
    const composedReminders = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, member!.id));
    assert(composedReminders.some(row => (row.payload as any).entityId === `agp:${rehearsal!.id}:${member!.id}`), "Lembrete do turno também alcança compromisso composto da Agenda");
    const edit = await request(`/scales/${due!.id}/entries`, auth, "POST", { memberId: member!.id, date, label: "Turno extra", startTime: "14:00", endTime: "15:00", expectedVersion: 2 });
    const changedJobs = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, member!.id));
    assert(edit.status === 201 && changedJobs.some(row => (row.payload as any).type === "scale.changed" && (row.payload as any).entityId === due!.id), "Editar escala já publicada agenda Web Push na mesma transação da mudança");
    const deadline = new Date(Date.now() + 3000);
    const [clocked] = await db.insert(scalesTable).values({ operationId: op!.id, title: "Agendador real", periodStart: date, periodEnd: date, publishDeadline: deadline, createdBy: admin!.id }).returning();
    await db.insert(scaleAllocationsTable).values({ scaleId: clocked!.id, userId: member!.id, status: "ASSIGNED", manualDate: date });
    startOperationalScheduler({ organizationId: org!.id, deliver });
    let publishedAt: Date | null = null;
    try {
      const timeout = Date.now() + 20_000;
      while (Date.now() < timeout) {
        const [observed] = await db.select().from(scalesTable).where(eq(scalesTable.id, clocked!.id));
        if (observed?.status === "PUBLISHED") { publishedAt = observed.publishedAt; break; }
        await delay(250);
      }
    } finally { await stopOperationalScheduler(); }
    assert(publishedAt && publishedAt >= deadline && publishedAt.getTime() - deadline.getTime() < 20_000, "Agendador em execução publica após o prazo, sem chamada manual à publicação");
    assert((await db.select().from(scalesTable).where(eq(scalesTable.id, pending!.id)))[0]?.status === "DRAFT", "Agendador em execução preserva escala com pendência aberta");
    const expiredTransport: typeof webpush.sendNotification = async () => { throw Object.assign(new Error("Expired"), { statusCode: 410 }); };
    let expirationRolledBack = false;
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    try { await deliverWebPush({ userId: member!.id, type: "scale.changed", title: "Escala", message: "Mudança", category: "schedule" }, expiredTransport); }
    catch { expirationRolledBack = true; }
    finally { delete process.env.MYASA_TEST_FAIL_HISTORY; }
    assert(expirationRolledBack && (await db.select().from(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.id, subscriptionBody.subscription.id)))[0]?.active, "Inscrição expirada também só é desativada se o Registro grava na mesma transação");
    await deliverWebPush({ userId: member!.id, type: "scale.changed", title: "Escala", message: "Mudança", category: "schedule" }, expiredTransport);
    assert(!(await db.select().from(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.id, subscriptionBody.subscription.id)))[0]?.active && (await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, subscriptionBody.subscription.id), eq(historyEventsTable.action, "web_push.expired")))).length === 1, "410 do provedor mantém a inscrição histórica e registra sua desativação automática");
    const endpoints = [ ["POST", `/actions/${undo.id}/undo`], ["GET", "/search?q=Carol"], ["GET", `/directory/people/${member!.id}`], ["GET", "/web-push/config"], ["POST", "/pwa/installations"], ["GET", "/pwa/installations"], ["POST", "/web-push/subscriptions"], ["DELETE", `/web-push/subscriptions/${subscriptionBody.subscription.id}`], ["GET", `/scales/print-day?date=${date}`] ];
    for (const [method, path] of endpoints) assert((await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000) })).status === 401, `${method} ${path!.split("?")[0]} sem autenticação → 401`);
    console.log(`block7 HTTP: ${endpoints.length}/${endpoints.length} rotas novas cobertas para 401; escopos/403 testados por operação.`);
    console.log("Web Push REAL: pendente de navegador inscrito e chaves de implantação; teste acima usa transporte controlado, não comprova recebimento no aparelho.");
  } finally {
    await stopOperationalScheduler();
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, actors));
    await db.delete(undoActionsTable).where(eq(undoActionsTable.organizationId, org!.id));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, actors));
    await db.delete(pwaInstallationsTable).where(inArray(pwaInstallationsTable.userId, actors));
    await db.delete(webPushSubscriptionsTable).where(inArray(webPushSubscriptionsTable.userId, actors));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    await db.delete(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    await db.delete(occurrencesTable).where(inArray(occurrencesTable.personId, actors));
    await db.delete(noticeRecipientsTable).where(inArray(noticeRecipientsTable.userId, actors));
    await db.delete(noticesTable).where(eq(noticesTable.operationId, op!.id));
    await db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.orgId, org!.id));
    await db.delete(formationsTable).where(eq(formationsTable.organizationId, org!.id));
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, op!.id));
    if (scales.length) { await db.delete(allocationExceptionsTable).where(inArray(allocationExceptionsTable.scaleId, scales.map(row => row.id))); await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, scales.map(row => row.id))); }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    const agenda = await db.select({ id: agendaEventsTable.id }).from(agendaEventsTable).where(eq(agendaEventsTable.operationId, op!.id));
    if (agenda.length) await db.delete(agendaEventParticipantsTable).where(inArray(agendaEventParticipantsTable.eventId, agenda.map(row => row.id)));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.operationId, op!.id));
    const requests = await db.select({ id: requestsTable.id }).from(requestsTable).where(eq(requestsTable.operationId, op!.id));
    if (requests.length) await db.delete(requestDecisionsTable).where(inArray(requestDecisionsTable.requestId, requests.map(row => row.id)));
    await db.delete(requestsTable).where(eq(requestsTable.operationId, op!.id));
    await db.delete(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, group!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, actors));
    await db.delete(usersTable).where(inArray(usersTable.id, actors));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(operationalGroupsTable).where(eq(operationalGroupsTable.id, group!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length) throw new Error(`${failures.length} testes do Bloco 7 falharam`);
  console.log(`block7-integrity: ${passed} asserts passed`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
