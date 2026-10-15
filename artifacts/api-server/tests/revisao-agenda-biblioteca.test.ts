/**
 * Agenda e Biblioteca — o que a revisão de 15/10/2026 pegou no servidor.
 * Agenda: cancelar e remarcar avisam só quem já sabia do compromisso; chamar para ensaio quem está de folga
 * exige motivo; proposta do Elenco em área sem supervisão cai na Administração.
 * Biblioteca: publicar e versionar avisam o público; "esperando você" é por pessoa e por versão; a Administração
 * vê quem leu; a Supervisão só mexe em documento da própria área.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { agendaEventParticipantsTable, agendaEventsTable, areasTable, db, folgasTable, historyEventsTable, libraryDocumentVersionsTable, libraryDocumentsTable, libraryViewsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };
const espera = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function run() {
  const tag = `revisao_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_A` }, { organizationId: org!.id, name: `${tag}_B` }]).returning();
  const makeUser = async (name: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, areaId, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin", null), sup = await makeUser("sup", areaA!.id), ana = await makeUser("ana", areaA!.id), bia = await makeUser("bia", areaB!.id), cris = await makeUser("cris", areaA!.id);
  const all = [admin, sup, ana, bia, cris];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      { userId: ana.id, operationId: operation!.id, role: "MEMBER", active: true },
      { userId: bia.id, operationId: operation!.id, role: "MEMBER", active: true },
      { userId: cris.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const adminApi = as(admin.id, "ADMIN"), supApi = as(sup.id, "SUPERVISOR_A"), anaApi = as(ana.id, "MEMBER");
    const post = (api: typeof adminApi, path: string, body?: unknown) => api(path, { method: "POST", body: JSON.stringify(body ?? {}) });
    const patch = (api: typeof adminApi, path: string, body: unknown) => api(path, { method: "PATCH", body: JSON.stringify(body) });
    const avisos = (userId: string, type: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, type)));
    // Os avisos saem depois da resposta; espera aparecerem (ou conclui que não vieram).
    const esperaAvisos = async (userId: string, type: string, quantos: number) => { for (let i = 0; i < 30; i++) { const rows = await avisos(userId, type); if (rows.length >= quantos) return rows; await espera(500); } return avisos(userId, type); };
    const naoChegou = async (userId: string, type: string) => { await espera(2500); return (await avisos(userId, type)).length === 0; };

    // ───────── Agenda: remarcar e cancelar ─────────
    const reuniao = await post(adminApi, "/agenda/events", { operationId: operation!.id, type: "MEETING", title: "Alinhamento", areaId: areaA!.id, date: "2026-12-02", startTime: "10:00", endTime: "11:00", participantIds: [ana.id, bia.id] });
    const reuniaoId = ((await reuniao.json()) as { event: { id: string } }).event.id;
    assert(reuniao.status === 201, `Administração marca a reunião (${reuniao.status})`);
    assert((await post(adminApi, `/agenda/events/${reuniaoId}/confirm`)).status === 200, "Administração confirma a reunião");
    await esperaAvisos(ana.id, "agenda.meeting.confirmed", 1); await esperaAvisos(bia.id, "agenda.meeting.confirmed", 1);

    const remarca = await patch(adminApi, `/agenda/events/${reuniaoId}`, { date: "2026-12-03", startTime: "14:00", endTime: "15:00", reason: "Sala ocupada" });
    assert(remarca.status === 200, `Remarcar a reunião confirmada (${remarca.status})`);
    const remarcadoAna = await esperaAvisos(ana.id, "agenda.meeting.changed", 1);
    assert(remarcadoAna.length === 1 && /2026-12-03/.test(remarcadoAna[0]?.message ?? "") && /Sala ocupada/.test(remarcadoAna[0]?.message ?? ""), `Quem foi convidada recebe um aviso de remarcação com o novo dia e o motivo: ${JSON.stringify(remarcadoAna[0]?.message)}`);
    assert((await esperaAvisos(bia.id, "agenda.meeting.changed", 1)).length === 1 && await naoChegou(cris.id, "agenda.meeting.changed"), "A outra convidada também é avisada, e quem não é participante não recebe nada");

    const cancela = await post(adminApi, `/agenda/events/${reuniaoId}/cancel`, {});
    assert(cancela.status === 200, `Cancelar sem motivo vale (${cancela.status})`);
    const canceladoAna = await esperaAvisos(ana.id, "agenda.meeting.cancelled", 1);
    assert(canceladoAna.length === 1 && !/Motivo/.test(canceladoAna[0]?.message ?? ""), `Reunião cancelada avisa os participantes, sem inventar motivo: ${JSON.stringify(canceladoAna[0]?.message)}`);
    assert((await esperaAvisos(bia.id, "agenda.meeting.cancelled", 1)).length === 1 && await naoChegou(cris.id, "agenda.meeting.cancelled"), "Cancelar não avisa a casa inteira, só quem participava");
    const [cancelRegistro] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, reuniaoId), eq(historyEventsTable.action, "cancelled")));
    assert(Boolean(cancelRegistro), "O cancelamento entrou no Registro");

    const rascunho = await post(adminApi, "/agenda/events", { operationId: operation!.id, type: "MEETING", title: "Ideia ainda sem confirmar", areaId: areaA!.id, date: "2026-12-04", startTime: "10:00", endTime: "11:00", participantIds: [cris.id] });
    const rascunhoId = ((await rascunho.json()) as { event: { id: string } }).event.id;
    assert((await post(adminApi, `/agenda/events/${rascunhoId}/cancel`, { reason: "Desisti" })).status === 200 && await naoChegou(cris.id, "agenda.meeting.cancelled"), "Cancelar rascunho não avisa ninguém, porque ninguém tinha sido avisado");

    // ───────── Agenda: ensaio na folga ─────────
    await db.insert(folgasTable).values({ userId: ana.id, operationId: operation!.id, type: "DAY_OFF", startDate: "2026-12-10", endDate: "2026-12-10", status: "ACTIVE", createdBy: admin.id });
    const corpoEnsaio = { operationId: operation!.id, type: "REHEARSAL", title: "Ensaio geral", areaId: areaA!.id, date: "2026-12-10", startTime: "09:00", endTime: "11:00", participantIds: [ana.id, cris.id] };
    const semMotivo = await post(adminApi, "/agenda/events", corpoEnsaio);
    const semMotivoCorpo = await semMotivo.json() as { code?: string; error?: string; emFolga?: string[] };
    assert(semMotivo.status === 409 && semMotivoCorpo.code === "FOLGA_EXIGE_MOTIVO" && /de folga/.test(semMotivoCorpo.error ?? "") && semMotivoCorpo.emFolga?.[0] === `${tag}_ana`, `Chamar para ensaio quem está de folga exige motivo, e a recusa diz quem (${semMotivo.status}: ${semMotivoCorpo.error})`);
    const comMotivo = await post(adminApi, "/agenda/events", { ...corpoEnsaio, reason: "Estreia na semana seguinte" });
    const ensaioId = ((await comMotivo.json()) as { event: { id: string } }).event.id;
    assert(comMotivo.status === 201, `Com o motivo escrito o ensaio é criado (${comMotivo.status})`);
    const [ensaioRegistro] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, ensaioId), eq(historyEventsTable.action, "created")));
    const metaEnsaio = ensaioRegistro?.metadata as { reason?: string; chamadasNaFolga?: string[] } | null;
    assert(metaEnsaio?.reason === "Estreia na semana seguinte" && metaEnsaio.chamadasNaFolga?.[0] === `${tag}_ana`, `O Registro guarda o motivo e quem foi chamada na folga: ${JSON.stringify(metaEnsaio)}`);
    await post(adminApi, `/agenda/events/${ensaioId}/confirm`);
    const confirmadoAna = await esperaAvisos(ana.id, "agenda.rehearsal.confirmed", 1);
    const confirmadoCris = await esperaAvisos(cris.id, "agenda.rehearsal.confirmed", 1);
    assert(/de folga/.test(confirmadoAna[0]?.message ?? "") && !/de folga/.test(confirmadoCris[0]?.message ?? ""), "Quem foi chamada na folga é avisada de que a folga foi desconsiderada de propósito; a outra não");
    const mudaParaFolga = await patch(adminApi, `/agenda/events/${ensaioId}`, { date: "2026-12-11" });
    assert(mudaParaFolga.status === 200, "Mudar o ensaio para um dia sem folga não pede motivo");
    const volta = await patch(adminApi, `/agenda/events/${ensaioId}`, { date: "2026-12-10" });
    assert(volta.status === 409, `Remarcar o ensaio de volta para o dia da folga exige motivo outra vez (${volta.status})`);

    // ───────── Agenda: proposta do Elenco em área sem supervisão ─────────
    const proposta = await post(anaApi, "/agenda/events", { operationId: operation!.id, type: "MEETING", title: "Quero propor um horário", areaId: areaA!.id, date: "2026-12-15", startTime: "10:00", endTime: "11:00", participantIds: [ana.id] });
    assert(proposta.status === 201, `Elenco propõe reunião (${proposta.status})`);
    const paraAdmin = await esperaAvisos(admin.id, "agenda.meeting.proposed", 1);
    assert(paraAdmin.length === 1 && /não tem supervisão cadastrada/.test(paraAdmin[0]?.message ?? ""), `Proposta de área sem supervisão avisa a Administração e diz por quê: ${JSON.stringify(paraAdmin[0]?.message)}`);

    // ───────── Biblioteca: publicar avisa, e a leitura é por pessoa e por versão ─────────
    const criaDoc = await post(adminApi, "/library/documents", { title: "Regras de camarim", type: "RULES_AND_POLICIES", summary: "Como usar o camarim", body: "Texto 1", requiresConfirmation: true, scopeType: "HOUSE" });
    const docId = ((await criaDoc.json()) as { document: { id: string } }).document.id;
    assert((await post(adminApi, `/library/documents/${docId}/publish`)).status === 200, "Administração publica o documento da casa");
    for (const pessoa of [sup, ana, bia, cris]) {
      const recebidos = await esperaAvisos(pessoa.id, "library.published", 1);
      assert(recebidos.length === 1 && /pede a sua leitura/.test(recebidos[0]?.message ?? ""), `${pessoa.name.replace(`${tag}_`, "")} recebe um aviso de documento novo, dizendo que pede leitura`);
    }
    assert((await avisos(admin.id, "library.published")).length === 0, "Quem publicou não é avisada do próprio documento");
    const listaDaAutora = (await (await adminApi("/library/documents")).json()) as { documents: { id: string; waitingMe: boolean }[] };
    assert(listaDaAutora.documents.find(doc => doc.id === docId)?.waitingMe === false, "Quem publicou o documento não fica 'esperando você' nele");
    const lista1 = (await (await anaApi("/library/documents")).json()) as { documents: { id: string; waitingMe: boolean; myConfirmed: boolean }[] };
    assert(lista1.documents.find(doc => doc.id === docId)?.waitingMe === true, "Antes de ler, o documento está esperando a pessoa");
    const confirma1 = await post(anaApi, `/library/documents/${docId}/confirm`);
    assert(confirma1.status === 200, `Ana confirma a leitura (${confirma1.status})`);
    const lista2 = (await (await anaApi("/library/documents")).json()) as { documents: { id: string; waitingMe: boolean; myConfirmed: boolean }[] };
    assert(lista2.documents.find(doc => doc.id === docId)?.waitingMe === false && lista2.documents.find(doc => doc.id === docId)?.myConfirmed === true, "Depois de confirmar, o pedido de leitura some para ela (antes ficava para sempre)");
    const confirma2 = await post(anaApi, `/library/documents/${docId}/confirm`);
    const confirmadas = await db.select().from(libraryViewsTable).where(and(eq(libraryViewsTable.documentId, docId), eq(libraryViewsTable.userId, ana.id)));
    assert(confirma2.status === 200 && confirmadas.filter(view => view.confirmedAt).length === 1, "Confirmar de novo não cria outra confirmação");
    const leituras1 = (await (await adminApi(`/library/documents/${docId}/leituras`)).json()) as { total: number; confirmaram: number; pessoas: { name: string; confirmou: boolean }[] };
    assert(leituras1.total === 4 && leituras1.confirmaram === 1 && leituras1.pessoas.find(p => p.name === `${tag}_ana`)?.confirmou === true, `A Administração vê quem já leu (${leituras1.confirmaram} de ${leituras1.total})`);
    assert((await anaApi(`/library/documents/${docId}/leituras`)).status === 403, "Elenco não vê quem leu");

    await espera(1200);
    const versao = await post(adminApi, `/library/documents/${docId}/version`, { title: "Regras de camarim (v2)", body: "Texto 2", summary: "Mudou o horário" });
    assert(versao.status === 200, `Administração publica a versão nova (${versao.status})`);
    const atualizado = await esperaAvisos(ana.id, "library.updated", 1);
    assert(atualizado.length === 1 && /nova leitura/.test(atualizado[0]?.message ?? ""), "Versão nova avisa o público e diz que pede nova leitura");
    const lista3 = (await (await anaApi("/library/documents")).json()) as { documents: { id: string; waitingMe: boolean }[] };
    assert(lista3.documents.find(doc => doc.id === docId)?.waitingMe === true, "Versão nova volta a pedir a leitura de quem já tinha confirmado a anterior");
    const leituras2 = (await (await adminApi(`/library/documents/${docId}/leituras`)).json()) as { confirmaram: number; version: number };
    assert(leituras2.version === 2 && leituras2.confirmaram === 0, "A contagem de quem leu recomeça na versão nova");

    // ───────── Biblioteca: Supervisão só na própria área ─────────
    const docArea = await post(supApi, "/library/documents", { title: "Regras só da área A", type: "RULES_AND_POLICIES", summary: "Só da área", body: "x", scopeType: "AREA", areaId: areaA!.id });
    const docAreaId = ((await docArea.json()) as { document: { id: string } }).document.id;
    assert(docArea.status === 201 && (await post(supApi, `/library/documents/${docAreaId}/publish`)).status === 200, "Supervisão publica documento para a própria área");
    assert((await esperaAvisos(ana.id, "library.published", 2)).length === 2 && (await esperaAvisos(cris.id, "library.published", 2)).length === 2, "O documento da área avisa quem é da área");
    await espera(1500);
    assert((await avisos(bia.id, "library.published")).length === 1, "Quem é de outra área não recebe aviso do documento da área A");
    const supEditaCasa = await patch(supApi, `/library/documents/${docId}`, { title: "Quero mudar o da casa" });
    assert(supEditaCasa.status === 403 && /não é da sua área/.test(((await supEditaCasa.json()) as { error: string }).error), `Supervisão não edita documento da casa (${supEditaCasa.status})`);
    const supMudaEscopo = await patch(supApi, `/library/documents/${docAreaId}`, { scopeType: "HOUSE" });
    assert(supMudaEscopo.status === 403, "Supervisão não amplia o documento da área para a casa inteira");
    const supPublicaCasa = await post(supApi, "/library/documents", { title: "Tentativa", type: "RULES_AND_POLICIES", summary: "x", scopeType: "HOUSE" });
    assert(supPublicaCasa.status === 403, "Supervisão não publica documento da casa inteira");
  } finally {
    if (server) { (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    const userIds = all.map(user => user.id);
    const docs = await db.select({ id: libraryDocumentsTable.id }).from(libraryDocumentsTable).where(eq(libraryDocumentsTable.orgId, org!.id));
    const docIds = docs.map(doc => doc.id);
    const eventos = await db.select({ id: agendaEventsTable.id }).from(agendaEventsTable).where(eq(agendaEventsTable.operationId, operation!.id));
    const eventoIds = eventos.map(evento => evento.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    if (docIds.length) { await db.delete(libraryViewsTable).where(inArray(libraryViewsTable.documentId, docIds)); await db.delete(libraryDocumentVersionsTable).where(inArray(libraryDocumentVersionsTable.documentId, docIds)); await db.delete(libraryDocumentsTable).where(inArray(libraryDocumentsTable.id, docIds)); }
    if (eventoIds.length) { await db.delete(agendaEventParticipantsTable).where(inArray(agendaEventParticipantsTable.eventId, eventoIds)); await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.id, eventoIds)); }
    await db.delete(folgasTable).where(inArray(folgasTable.userId, userIds));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Agenda e Biblioteca (revisão): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
