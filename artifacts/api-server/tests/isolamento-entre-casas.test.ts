/**
 * Isolamento entre casas (organizações), revisão de segurança de 21/10/2026.
 *
 * Cria duas casas com dados mínimos. Para cada rota com id que dá para exercitar, a Administração da casa B chama a rota sobre
 * um recurso da casa A e o teste afirma que a resposta é 403 ou 404 (nunca 200, nunca 400, nunca 500) e que o recurso da casa A
 * continua exatamente como estava.
 *
 * Em rotas filhas (`/x/:id/y/:yId`) o id do filho é inventado: a recusa prova que o pai é conferido, não que o filho é. Os pais
 * são os que carregam a casa. A lista do que o teste não cobre está em docs/seguranca-2026-10-21.md.
 */
import http from "node:http";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool,
  organizationsTable, operationsTable, usersTable, userRolesTable, operationalGroupsTable, locationsTable, areasTable,
  showBooksTable, tasksTable, libraryDocumentsTable, libraryDocumentVersionsTable, requestsTable, leaveRequestsTable, folgasTable,
  folgaGruposTable, messageThreadsTable, messageThreadParticipantsTable, announcementsTable, muralDatasEspeciaisTable,
  agendaEventsTable, dailyBooksTable, scalesTable, responsibilitiesTable, restricoesHorarioTable, restrictionsTable,
  delegationsTable, charactersTable, formationsTable, occurrencesTable, programacoesTable, userNotificationsTable,
  historyEventsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

const falhas: string[] = [];
let certos = 0;
const consoleErrorOriginal = console.error;
const marcar = (ok: boolean, texto: string) => { if (ok) certos += 1; else { falhas.push(texto); console.error(`  ✗ ${texto}`); } };

const UUID_FALSO = "00000000-0000-4000-8000-0000000000aa";
type Caso = { metodo: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; caminho: string; corpo?: unknown; grupo: string };
/** Recusas explícitas além de 403/404: a geração de Escala responde 409 "a operação não existe, está em configuração ou foi arquivada" para operação de outra casa. */
/** Na criação, a rota pode recusar com 400 e uma frase que diz que o item não é desta casa (nada é gravado). */
const RECUSA_400_COM_FRASE = /Operação inválida|Área inválida|desta organização|não está ativa/;
const RECUSA_409 = new Set(["POST /scales/generate"]);

async function run() {
  process.stdout.write("isolamento-entre-casas: iniciando\n");
  const tag = `isolamento_${Date.now()}`;
  const [casaA] = await db.insert(organizationsTable).values({ name: `${tag}_A` }).returning();
  const [casaB] = await db.insert(organizationsTable).values({ name: `${tag}_B` }).returning();
  const [opA] = await db.insert(operationsTable).values({ organizationId: casaA!.id, name: `${tag}_opA`, status: "ACTIVE" }).returning();
  const [opB] = await db.insert(operationsTable).values({ organizationId: casaB!.id, name: `${tag}_opB`, status: "ACTIVE" }).returning();
  const [localA] = await db.insert(locationsTable).values({ organizationId: casaA!.id, name: `${tag}_localA` }).returning();
  const [areaA] = await db.insert(areasTable).values({ organizationId: casaA!.id, name: `${tag}_areaA` }).returning();
  const [grupoA] = await db.insert(operationalGroupsTable).values({ organizationId: casaA!.id, operationId: opA!.id, name: `${tag}_grupoA` }).returning();
  const [adminA] = await db.insert(usersTable).values({ organizationId: casaA!.id, name: `${tag}_adminA`, username: `${tag}_adminA` }).returning();
  const [supA] = await db.insert(usersTable).values({ organizationId: casaA!.id, name: `${tag}_supA`, username: `${tag}_supA`, areaId: areaA!.id }).returning();
  const [membroA] = await db.insert(usersTable).values({ organizationId: casaA!.id, name: `${tag}_membroA`, username: `${tag}_membroA`, areaId: areaA!.id }).returning();
  const [adminB] = await db.insert(usersTable).values({ organizationId: casaB!.id, name: `${tag}_adminB`, username: `${tag}_adminB` }).returning();
  // A casa B tem duas pessoas na Administração: assim a regra "último administrador" não esconde uma remoção indevida de papel da casa A.
  const [adminB2] = await db.insert(usersTable).values({ organizationId: casaB!.id, name: `${tag}_adminB2`, username: `${tag}_adminB2` }).returning();
  const papeis = await db.insert(userRolesTable).values([
    { userId: adminB2!.id, operationId: opB!.id, role: "ADMIN", active: true },
    { userId: adminA!.id, operationId: opA!.id, role: "ADMIN", active: true },
    { userId: supA!.id, operationId: opA!.id, groupId: grupoA!.id, role: "SUPERVISOR_A", active: true },
    { userId: membroA!.id, operationId: opA!.id, groupId: grupoA!.id, role: "MEMBER", active: true },
    { userId: adminB!.id, operationId: opB!.id, role: "ADMIN", active: true },
  ]).returning();
  const papelSupA = papeis.find((p) => p.userId === supA!.id)!;

  const [livroShow] = await db.insert(showBooksTable).values({ operationId: opA!.id, title: `${tag}_show`, createdBy: adminA!.id }).returning();
  const [evento] = await db.insert(agendaEventsTable).values({ operationId: opA!.id, type: "MEETING", title: `${tag}_evento`, date: "2030-01-10", createdBy: adminA!.id } as never).returning();
  const [livroDia] = await db.insert(dailyBooksTable).values({ agendaEventId: evento!.id } as never).returning();
  const [tarefa] = await db.insert(tasksTable).values({ organizationId: casaA!.id, operationId: opA!.id, title: `${tag}_tarefa`, creatorId: adminA!.id, assigneeId: membroA!.id }).returning();
  const [documento] = await db.insert(libraryDocumentsTable).values({ orgId: casaA!.id, type: "ONBOARDING_MATERIAL", title: `${tag}_doc`, body: "privado", createdBy: adminA!.id }).returning();
  await db.insert(libraryDocumentVersionsTable).values({ documentId: documento!.id, version: 1, title: documento!.title, body: documento!.body, createdBy: adminA!.id });
  const [pedido] = await db.insert(requestsTable).values({ requesterId: membroA!.id, operationId: opA!.id, type: "LEAVE", targetDates: ["2030-02-01"], reason: "teste", organizationId: casaA!.id } as never).returning();
  const [pedidoFolga] = await db.insert(leaveRequestsTable).values({ organizationId: casaA!.id, userId: membroA!.id, startDate: "2030-02-01", endDate: "2030-02-01", reason: "teste" } as never).returning();
  const [folga] = await db.insert(folgasTable).values({ userId: membroA!.id, operationId: opA!.id, startDate: "2030-02-02", endDate: "2030-02-02", createdBy: adminA!.id } as never).returning();
  const [grupoFolga] = await db.insert(folgaGruposTable).values({ operationId: opA!.id, nome: `${tag}_gf`, pessoaIds: [membroA!.id], diasFolga: [1], createdBy: adminA!.id } as never).returning();
  const [conversa] = await db.insert(messageThreadsTable).values({ title: `${tag}_conversa`, orgId: casaA!.id } as never).returning();
  await db.insert(messageThreadParticipantsTable).values([{ threadId: conversa!.id, userId: adminA!.id }, { threadId: conversa!.id, userId: membroA!.id }] as never);
  const [aviso] = await db.insert(announcementsTable).values({ orgId: casaA!.id, authorId: adminA!.id, title: `${tag}_aviso`, body: "privado" } as never).returning();
  const [dataEspecial] = await db.insert(muralDatasEspeciaisTable).values({ orgId: casaA!.id, nome: `${tag}_data`, mes: 3, dia: 3, createdBy: adminA!.id } as never).returning();
  const [escala] = await db.insert(scalesTable).values({ operationId: opA!.id, title: `${tag}_escala`, periodStart: "2030-03-01", periodEnd: "2030-03-07", createdBy: adminA!.id } as never).returning();
  const [responsabilidade] = await db.insert(responsibilitiesTable).values({ orgId: casaA!.id, title: `${tag}_resp` } as never).returning();
  const [restricaoHorario] = await db.insert(restricoesHorarioTable).values({ userId: membroA!.id, diasSemana: [1], horaInicio: "09:00", horaFim: "10:00", periodStart: "2030-01-01", motivo: "teste", createdBy: adminA!.id } as never).returning();
  const [restricao] = await db.insert(restrictionsTable).values({ userId: membroA!.id, type: "PERSONAL", periodStart: "2030-01-01", periodEnd: "2030-01-31", createdBy: adminA!.id } as never).returning().catch(() => [undefined]);
  const [delegacao] = await db.insert(delegationsTable).values({ delegatorId: supA!.id, delegateeId: membroA!.id, operationId: opA!.id, validFrom: new Date() } as never).returning().catch(() => [undefined]);
  const [personagem] = await db.insert(charactersTable).values({ name: `${tag}_personagem`, locationId: localA!.id, mode: "titular" } as never).returning().catch(() => [undefined]);
  const [formacao] = await db.insert(formationsTable).values({ name: `${tag}_formacao`, peopleCount: 2, organizationId: casaA!.id } as never).returning().catch(() => [undefined]);
  const [ocorrencia] = await db.insert(occurrencesTable).values({ personId: membroA!.id, date: "2030-01-05", type: "teste", description: "teste", registeredBy: adminA!.id, reason: "teste" } as never).returning().catch(() => [undefined]);
  const [programacao] = await db.insert(programacoesTable).values({ organizationId: casaA!.id, locationId: localA!.id, nome: `${tag}_prog`, vigenciaInicio: "2030-01-01", vigenciaFim: "2030-12-31", createdBy: adminA!.id } as never).returning().catch(() => [undefined]);
  const [aviso2] = await db.insert(userNotificationsTable).values({ userId: membroA!.id, type: "teste", title: "t", message: "m", category: "system" } as never).returning();

  const A = {
    adminA, supA, membroA, grupoA, areaA, localA, opA, livroShow, evento, livroDia, tarefa, documento, pedido, pedidoFolga, folga,
    grupoFolga, conversa, aviso, dataEspecial, escala, responsabilidade, restricaoHorario, restricao, delegacao, personagem,
    formacao, ocorrencia, programacao, aviso2,
  };
  void A;

  let servidor: http.Server | null = null;
  try {
    servidor = http.createServer(app);
    await new Promise<void>((ok) => servidor!.listen(0, "127.0.0.1", ok));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${endereco.port}/api`;
    const tokenB = signAccessToken({ sub: adminB!.id, jti: `${tag}-b`, organizationId: casaB!.id, role: "ADMIN", operationIds: [opB!.id] });
    const cab = { authorization: `Bearer ${tokenB}`, "content-type": "application/json" };

    // Fotografia dos recursos da casa A antes e depois.
    const itens: Array<[string, any, string | undefined]> = [
      ["livro do show", showBooksTable, livroShow?.id], ["livro do dia", dailyBooksTable, livroDia?.id], ["tarefa", tasksTable, tarefa?.id],
      ["documento", libraryDocumentsTable, documento?.id], ["solicitação", requestsTable, pedido?.id], ["pedido de folga", leaveRequestsTable, pedidoFolga?.id],
      ["folga", folgasTable, folga?.id], ["grupo de folga", folgaGruposTable, grupoFolga?.id], ["conversa", messageThreadsTable, conversa?.id],
      ["aviso", announcementsTable, aviso?.id], ["data especial", muralDatasEspeciaisTable, dataEspecial?.id], ["escala", scalesTable, escala?.id],
      ["responsabilidade", responsibilitiesTable, responsabilidade?.id], ["restrição de horário", restricoesHorarioTable, restricaoHorario?.id],
      ["restrição", restrictionsTable, restricao?.id], ["delegação", delegationsTable, delegacao?.id], ["personagem", charactersTable, personagem?.id],
      ["formação", formationsTable, formacao?.id], ["ocorrência", occurrencesTable, ocorrencia?.id], ["programação", programacoesTable, programacao?.id],
      ["grupo", operationalGroupsTable, grupoA!.id], ["operação", operationsTable, opA!.id], ["evento da agenda", agendaEventsTable, evento?.id],
      ["pessoa", usersTable, membroA!.id], ["supervisora", usersTable, supA!.id], ["administradora", usersTable, adminA!.id],
      ["notificação", userNotificationsTable, aviso2?.id],
    ];
    const fotografar = async () => {
      const f: Record<string, string> = {};
      for (const [nome, tabela, id] of itens) if (id) f[nome] = JSON.stringify((await db.select().from(tabela).where(eq(tabela.id, id)))[0] ?? null);
      f["papéis da casa A"] = JSON.stringify((await db.select().from(userRolesTable).where(inArray(userRolesTable.userId, [adminA!.id, supA!.id, membroA!.id]))).map((p) => [p.id, p.role, p.active]).sort());
      return f;
    };
    const antes = await fotografar();

    const v = { expectedVersion: 1, version: 1, reason: "teste de isolamento", motivo: "teste de isolamento" };
    const casos: Caso[] = [];
    const c = (grupo: string, metodo: Caso["metodo"], caminho: string, corpo?: unknown) => casos.push({ grupo, metodo, caminho, corpo: corpo ?? (metodo === "GET" ? undefined : v) });

    // Livro do Dia
    const ld = livroDia!.id;
    c("Livro do Dia", "GET", `/daily-book/${ld}`);
    for (const acao of ["publish", "republish", "regenerate", "execute", "cancel", "reopen"]) c("Livro do Dia", "POST", `/daily-book/${ld}/${acao}`);
    c("Livro do Dia", "DELETE", `/daily-book/${ld}`);
    c("Livro do Dia", "GET", `/daily-book/${ld}/delta`); c("Livro do Dia", "GET", `/daily-book/${ld}/pattern-diff`);
    c("Livro do Dia", "DELETE", `/daily-book/${ld}/scenes/${UUID_FALSO}`); c("Livro do Dia", "PATCH", `/daily-book/${ld}/assignments/${UUID_FALSO}`);
    c("Livro do Dia", "PATCH", `/daily-book/${ld}/scenes/reorder`, { ...v, scenes: [] });
    // Livro do Show
    const ls = livroShow!.id;
    c("Livro do Show", "GET", `/show-books/${ls}`); c("Livro do Show", "GET", `/show-books/${ls}/versions`); c("Livro do Show", "GET", `/show-books/${ls}/resolve?date=2030-01-01`);
    c("Livro do Show", "PATCH", `/show-books/${ls}`, { ...v, title: "invadido" }); c("Livro do Show", "PATCH", `/show-books/${ls}/status`, { ...v, status: "PUBLISHED" });
    c("Livro do Show", "DELETE", `/show-books/${ls}`); c("Livro do Show", "POST", `/show-books/${ls}/scenes`, { ...v, name: "x", order: 1 });
    c("Livro do Show", "GET", `/show-books/${ls}/drive-links`); c("Livro do Show", "GET", `/show-books/${ls}/refs`);
    c("Livro do Show", "POST", `/show-books/${ls}/positions/${UUID_FALSO}/refs`, { ...v, documentId: documento!.id });
    c("Livro do Show", "GET", `/show-books/${ls}/sessions`.replace("/show-books/", "/show-books/"));
    // Tarefas
    const t = tarefa!.id;
    c("Tarefas", "GET", `/tasks/${t}`); c("Tarefas", "PATCH", `/tasks/${t}`, { title: "invadida" }); c("Tarefas", "GET", `/tasks/${t}/comments`);
    c("Tarefas", "POST", `/tasks/${t}/comments`, { body: "invasão" });
    for (const acao of ["start", "ready-for-approval", "approve", "request-changes", "cancel"]) c("Tarefas", "POST", `/tasks/${t}/${acao}`);
    c("Tarefas", "POST", `/tasks/${t}/steps`, { title: "x", assigneeId: adminB!.id }); c("Tarefas", "POST", `/tasks/${t}/evidences`, { description: "x" });
    // Biblioteca
    const d = documento!.id;
    c("Biblioteca", "GET", `/library/documents/${d}`); c("Biblioteca", "GET", `/library/documents/${d}/versions`); c("Biblioteca", "GET", `/library/documents/${d}/leituras`);
    c("Biblioteca", "GET", `/library/documents/${d}/file`);
    for (const acao of ["publish", "version", "archive", "restore", "confirm"]) c("Biblioteca", "POST", `/library/documents/${d}/${acao}`);
    c("Biblioteca", "PATCH", `/library/documents/${d}`, { title: "invadido" }); c("Biblioteca", "PUT", `/library/documents/${d}/citations`, { version: 1, citations: [] });
    // Solicitações e folgas
    c("Folgas", "GET", `/requests/${pedido!.id}`); c("Folgas", "PATCH", `/requests/${pedido!.id}`, { status: "ALTERNATIVE_ACCEPTED" }); c("Folgas", "POST", `/requests/${pedido!.id}/decision`, { decision: "APPROVED", ...v });
    const pf = pedidoFolga!.id;
    c("Folgas", "PATCH", `/leave-requests/${pf}`, { status: "APPROVED" }); c("Folgas", "POST", `/leave-requests/${pf}/cancelar`);
    c("Folgas", "GET", `/leave-requests/${pf}/analise`); c("Folgas", "POST", `/leave-requests/${pf}/desfazer`);
    for (const acao of ["troca", "troca/resposta", "troca/retirar", "alternativa", "alternativa/resposta", "alternativa/retirar"]) c("Folgas", "POST", `/leave-requests/${pf}/${acao}`);
    c("Folgas", "POST", `/solicitacoes/${pedido!.id}/decisao`, { decisao: "APPROVED", motivo: "invasão" }); c("Folgas", "POST", `/solicitacoes/${pedido!.id}/cancelar`); c("Folgas", "POST", `/solicitacoes/${pedido!.id}/colega`, { resposta: "ACEITA" });
    c("Folgas", "PATCH", `/folgas/${folga!.id}`, { startDate: "2030-05-05", endDate: "2030-05-05", ...v }); c("Folgas", "POST", `/folgas/${folga!.id}/cancelar`);
    c("Folgas", "PATCH", `/folgas/grupos/${grupoFolga!.id}`, { nome: "invadido", pessoaIds: [membroA!.id], diasFolga: [1] }); c("Folgas", "DELETE", `/folgas/grupos/${grupoFolga!.id}`); c("Folgas", "POST", `/folgas/grupos/${grupoFolga!.id}/restaurar`);
    if (restricaoHorario) { c("Folgas", "POST", `/restricoes-horario/${restricaoHorario.id}/encerrar`); c("Folgas", "POST", `/restricoes-horario/${restricaoHorario.id}/reabrir`); }
    if (restricao) { c("Folgas", "PATCH", `/restrictions/${restricao.id}`, { reason: "x" }); c("Folgas", "POST", `/restrictions/${restricao.id}/encerrar`); }
    // Mensagens
    const cv = conversa!.id;
    c("Mensagens", "PATCH", `/messages/threads/${cv}`, { title: "invadida" }); c("Mensagens", "POST", `/messages/threads/${cv}/members`, { userIds: [adminB!.id] });
    c("Mensagens", "DELETE", `/messages/threads/${cv}/members/${membroA!.id}`); c("Mensagens", "POST", `/messages/threads/${cv}/arquivar`); c("Mensagens", "POST", `/messages/threads/${cv}/restaurar`);
    c("Mensagens", "PATCH", `/messages/threads/${cv}/preferences`, { pinned: true });
    c("Mensagens", "POST", `/messages/threads/${cv}/messages/${UUID_FALSO}/react`, { reaction: "🎉" });
    // Mural e avisos
    const av = aviso!.id;
    c("Mural", "PATCH", `/communication/mural/${av}`, { body: "invadido" }); c("Mural", "POST", `/communication/mural/${av}/ack`); c("Mural", "POST", `/communication/mural/${av}/react`, { reaction: "🎉" });
    c("Mural", "GET", `/communication/mural/${av}/reacoes`); c("Mural", "GET", `/communication/mural/${av}/comments`); c("Mural", "GET", `/communication/mural/${av}/cientes`);
    c("Mural", "POST", `/communication/mural/${av}/comments`, { body: "invasão" }); c("Mural", "POST", `/communication/mural/${av}/cancel`); c("Mural", "POST", `/communication/mural/${av}/restore`);
    c("Mural", "PATCH", `/communication/datas-especiais/${dataEspecial!.id}`, { nome: "invadida", mes: 4, dia: 4 }); c("Mural", "DELETE", `/communication/datas-especiais/${dataEspecial!.id}`);
    c("Mural", "POST", `/communication/datas-especiais/${dataEspecial!.id}/restore`);
    for (const acao of ["publish", "cancel", "escalate", "view", "confirm"]) c("Mural", "POST", `/notices/${av}/${acao}`);
    c("Mural", "GET", `/notices/${av}`); c("Mural", "PATCH", `/notices/${av}`, { title: "invadido" });
    // Agenda
    const ev = evento!.id;
    c("Agenda", "GET", `/agenda/events/${ev}`); c("Agenda", "PATCH", `/agenda/events/${ev}`, { title: "invadido", ...v }); c("Agenda", "DELETE", `/agenda/events/${ev}`);
    for (const acao of ["confirm", "suspend", "cancel", "complete", "respond", "decision"]) c("Agenda", "POST", `/agenda/events/${ev}/${acao}`, acao === "respond" ? { response: "ACCEPTED" } : acao === "decision" ? { decision: "ACCEPT" } : undefined);
    // Escalas e programação
    const es = escala!.id;
    c("Escalas", "GET", `/scales/${es}`); c("Escalas", "GET", `/scales/${es}/allocations`); c("Escalas", "GET", `/scales/${es}/exceptions`); c("Escalas", "GET", `/scales/${es}/suggestions?date=2030-03-02`);
    c("Escalas", "PATCH", `/scales/${es}`, { title: "invadida", ...v }); c("Escalas", "DELETE", `/scales/${es}`);
    for (const acao of ["regenerate", "publish", "republish", "archive", "duplicate-previous"]) c("Escalas", "POST", `/scales/${es}/${acao}`);
    c("Escalas", "POST", `/scales/${es}/entries`, { memberId: adminB!.id, date: "2030-03-02", label: "invasão", ...v });
    for (const acao of ["publicar", "republicar", "confirmar"]) c("Escalas", "POST", `/escalas/${es}/${acao}`);
    if (programacao) { c("Escalas", "PATCH", `/programacoes/${programacao.id}`, { nome: "invadida", ...v }); c("Escalas", "POST", `/programacoes/${programacao.id}/blocos`, { weekday: 1, inicio: "09:00", rotulo: "x", regra: "x" }); }
    // Responsabilidades
    const rs = responsabilidade!.id;
    c("Responsabilidades", "GET", `/responsibilities/${rs}`); c("Responsabilidades", "PATCH", `/responsibilities/${rs}`, { title: "invadida" }); c("Responsabilidades", "DELETE", `/responsibilities/${rs}`);
    c("Responsabilidades", "POST", `/responsibilities/${rs}/assignments`, { memberId: adminB!.id, role: "PRIMARY" }); c("Responsabilidades", "GET", `/responsibilities/${rs}/requests`);
    c("Responsabilidades", "POST", `/responsibilities/${rs}/requests`, { title: "invasão" }); c("Responsabilidades", "GET", `/responsibilities/${rs}/routines`); c("Responsabilidades", "POST", `/responsibilities/${rs}/routines`, { title: "invasão" });
    // Grupos, operações, áreas, locais, pessoas
    const g = grupoA!.id;
    c("Grupos", "GET", `/operational-groups/${g}`); c("Grupos", "PATCH", `/operational-groups/${g}`, { name: "invadido" }); c("Grupos", "PATCH", `/operational-groups/${g}/status`, { status: "INACTIVE" });
    c("Grupos", "POST", `/operational-groups/${g}/members`, { userId: membroA!.id }); c("Grupos", "DELETE", `/operational-groups/${g}/members/${membroA!.id}`);
    c("Grupos", "POST", `/operational-groups/${g}/supervisors`, { userId: membroA!.id }); c("Grupos", "DELETE", `/operational-groups/${g}/supervisors/${supA!.id}`);
    c("Operações", "GET", `/operations/${opA!.id}`); c("Operações", "PATCH", `/operations/${opA!.id}`, { name: "invadida" }); c("Operações", "PATCH", `/operations/${opA!.id}/status`, { status: "PAUSED", ...v });
    c("Operações", "POST", `/operations/${opA!.id}/access`, { userIds: [adminB!.id] }); c("Operações", "GET", `/operations/${opA!.id}/locations`); c("Operações", "PUT", `/operations/${opA!.id}/locations`, { locationIds: [] });
    c("Operações", "GET", `/operations/${opA!.id}/tags`); c("Operações", "POST", `/operations/${opA!.id}/tags`, { category: "SKILL", label: "x" });
    c("Áreas", "PATCH", `/areas/${areaA!.id}`, { name: "invadida" }); c("Áreas", "DELETE", `/areas/${areaA!.id}`, {}); c("Áreas", "GET", `/areas/${areaA!.id}/local-supervisors`);
    c("Áreas", "PUT", `/areas/${areaA!.id}/locations/${localA!.id}/supervisor`, { supervisorId: supA!.id }); c("Áreas", "DELETE", `/areas/${areaA!.id}/locations/${localA!.id}/supervisor`);
    c("Áreas", "PATCH", `/locations/${localA!.id}`, { name: "invadido" }); c("Áreas", "DELETE", `/locations/${localA!.id}`);
    const p = membroA!.id;
    c("Pessoas", "GET", `/users/${p}`); c("Pessoas", "PATCH", `/users/${p}`, { fullName: "invadida" }); c("Pessoas", "PATCH", `/users/${p}/status`, { status: "INACTIVE", reason: "x" });
    c("Pessoas", "DELETE", `/users/${p}`); c("Pessoas", "POST", `/users/${p}/password-reset`); c("Pessoas", "PUT", `/users/${p}/perfil`, { perfil: "ADM" }); c("Pessoas", "PUT", `/users/${p}/cadastro`, {});
    c("Pessoas", "PUT", `/users/${p}/operational-scope`, { areaId: areaA!.id }); c("Pessoas", "GET", `/users/${p}/roles`); c("Pessoas", "POST", `/users/${p}/roles`, { operationId: opB!.id, role: "ADMIN", reason: "x" });
    c("Pessoas", "POST", `/users/${p}/roles`, { operationId: opA!.id, role: "ADMIN", reason: "x" }); c("Pessoas", "GET", `/users/${p}/tags`); c("Pessoas", "GET", `/directory/people/${p}`); c("Pessoas", "GET", `/users/${p}/photo`);
    c("Pessoas", "DELETE", `/users/${supA!.id}/roles/${papelSupA.id}`);
    c("Pessoas", "DELETE", `/users/${adminA!.id}/roles/${papeis.find((x) => x.userId === adminA!.id)!.id}`);
    // Livro do Show: rotas filhas (o pai é conferido; o id do filho é inventado)
    const F = UUID_FALSO;
    for (const [m, caminho, corpo] of [
      ["PATCH", `/show-books/${ls}/responsible`, { responsibleId: adminB!.id, ...v }], ["PATCH", `/show-books/${ls}/scenes/${F}`, { name: "x", ...v }], ["DELETE", `/show-books/${ls}/scenes/${F}`, v],
      ["POST", `/show-books/${ls}/blocks`, { sceneId: F, name: "x", order: 1, ...v }], ["PATCH", `/show-books/${ls}/blocks/${F}`, { name: "x", ...v }], ["DELETE", `/show-books/${ls}/blocks/${F}`, v],
      ["POST", `/show-books/${ls}/positions`, { blockId: F, name: "x", order: 1, ...v }], ["PATCH", `/show-books/${ls}/positions/${F}`, { name: "x", ...v }], ["DELETE", `/show-books/${ls}/positions/${F}`, v],
      ["POST", `/show-books/${ls}/positions/${F}/lines`, { type: "TITULAR_SUBSTITUTE", ...v }], ["PATCH", `/show-books/${ls}/lines/${F}`, v], ["DELETE", `/show-books/${ls}/lines/${F}`, v],
      ["GET", `/show-books/${ls}/positions/${F}/cast`], ["PUT", `/show-books/${ls}/positions/${F}/cast`, { titularId: null, substituteIds: [], ...v }],
      ["POST", `/show-books/${ls}/vagas`, { name: "x", ...v }], ["PUT", `/show-books/${ls}/vagas/order`, { positionIds: [], ...v }], ["DELETE", `/show-books/${ls}/vagas/${F}`, v],
      ["PATCH", `/show-books/${ls}/blocks/${F}/group`, { name: "x", zone: "CENTRO", prefix: "X", ...v }], ["POST", `/show-books/${ls}/drive-links`, { label: "x", type: "x", scope: "x", ...v }],
      ["PATCH", `/show-books/${ls}/drive-links/${F}`, v], ["DELETE", `/show-books/${ls}/drive-links/${F}`, v],
      ["GET", `/show-books/${ls}/positions/${F}/refs`], ["DELETE", `/show-books/${ls}/positions/${F}/refs/${F}`, v],
      ["POST", `/show-books/${ls}/scenes/${F}/keyframes`, { name: "x", ...v }], ["PATCH", `/show-books/${ls}/keyframes/${F}`, v], ["DELETE", `/show-books/${ls}/keyframes/${F}`, v],
      ["GET", `/show-books/${ls}/stage-formats/L/zones`], ["PUT", `/show-books/${ls}/stage-formats/L/zones`, { zonePositions: {}, ...v }],
    ] as Array<[Caso["metodo"], string, unknown?]>) c("Livro do Show (filhos)", m, caminho, corpo);
    // Livro do Dia: rotas filhas
    for (const [m, caminho] of [
      ["DELETE", `/daily-book/${ld}/positions/${F}`], ["DELETE", `/daily-book/${ld}/blocks/${F}`], ["PATCH", `/daily-book/${ld}/scenes/${F}/restore`],
      ["PATCH", `/daily-book/${ld}/blocks/${F}/restore`], ["PATCH", `/daily-book/${ld}/positions/${F}/restore`],
      ["POST", `/daily-book/${ld}/scenes/${F}/apply-formation`], ["POST", `/daily-book/${ld}/scenes/${F}/save-formation`],
    ] as Array<[Caso["metodo"], string]>) c("Livro do Dia (filhos)", m, caminho, { ...v, formationId: F, name: "x" });
    // Tarefas: etapas, pedidos e lista fixa
    for (const acao of ["start", "complete", "dispense", "reassign"]) c("Tarefas (filhos)", "POST", `/tasks/${t}/steps/${F}/${acao}`, { assigneeId: adminB!.id, reason: "x" });
    c("Tarefas (filhos)", "PATCH", `/tasks/${t}/steps/${F}`, { title: "x" });
    for (const acao of ["accept", "decline", "cancel"]) c("Responsabilidades", "POST", `/responsibility-requests/${F}/${acao}`, { reason: "x" });
    c("Responsabilidades", "PATCH", `/responsibilities/${rs}/routines/${F}`, { title: "x" }); c("Responsabilidades", "DELETE", `/responsibilities/${rs}/routines/${F}`, { reason: "x" });
    for (const acao of ["check", "uncheck", "restore"]) c("Responsabilidades", "POST", `/responsibilities/${rs}/routines/${F}/${acao}`);
    c("Responsabilidades", "PATCH", `/responsibilities/${rs}/assignments/${F}`, { role: "PRIMARY" }); c("Responsabilidades", "DELETE", `/responsibilities/${rs}/assignments/${F}`, {});
    // Escala: lançamentos e alocações; Biblioteca: categoria; personagens e sessões; tags
    c("Escalas (filhos)", "PATCH", `/scales/${es}/entries/${F}`, { label: "x", ...v }); c("Escalas (filhos)", "DELETE", `/scales/${es}/entries/${F}`, v); c("Escalas (filhos)", "PATCH", `/scales/${es}/allocations/${F}`, { userId: adminB!.id, ...v });
    if (programacao) c("Escalas (filhos)", "PATCH", `/programacoes/${programacao.id}/blocos/${F}`, { rotulo: "x", ...v });
    c("Biblioteca", "DELETE", `/library/categories/${F}`, v);
    c("Outros", "POST", `/show-books/${ls}/sessions`, { name: "x", ...v }); c("Outros", "PATCH", `/show-books/${ls}/sessions/${F}`, { name: "x", ...v }); c("Outros", "DELETE", `/show-books/${ls}/sessions/${F}`, v);
    c("Pessoas", "POST", `/users/${p}/tags`, { tagId: F }); c("Pessoas", "DELETE", `/users/${p}/tags/${F}`, v); c("Operações", "DELETE", `/operations/${opA!.id}/tags/${F}`, v);
    // Outros
    if (delegacao) c("Outros", "PATCH", `/delegations/${delegacao.id}/cancel`);
    if (personagem) { c("Outros", "PATCH", `/characters/${personagem.id}`, { name: "invadido" }); c("Outros", "DELETE", `/characters/${personagem.id}`); c("Outros", "GET", `/characters/${personagem.id}/cast`); c("Outros", "POST", `/characters/${personagem.id}/cast`, { personId: membroA!.id }); }
    if (formacao) { c("Outros", "PATCH", `/formations/${formacao.id}`, { name: "invadida" }); c("Outros", "POST", `/formations/${formacao.id}/deactivate`); c("Outros", "POST", `/formations/${formacao.id}/apply`, { dailyBookId: livroDia!.id }); }
    if (ocorrencia) { c("Outros", "GET", `/occurrences/${ocorrencia.id}`); c("Outros", "PATCH", `/occurrences/${ocorrencia.id}`, { description: "invadida" }); c("Outros", "PATCH", `/occurrences/${ocorrencia.id}/state`, { state: "em_analise", reason: "invasão" }); c("Outros", "DELETE", `/occurrences/${ocorrencia.id}`); }
    c("Outros", "PATCH", `/notifications/${aviso2!.id}/read`); c("Outros", "GET", `/show-books/${ls}/sessions`);
    c("Outros", "PATCH", `/check-ins/${UUID_FALSO}`, { status: "CONFIRMED" }); c("Outros", "POST", `/supervisor-requests/${UUID_FALSO}/respond`, { decision: "APPROVED" });

    // Criação: a casa B manda no corpo o código de algo da casa A (nada pode ser criado)
    const hoje = "2030-04-01";
    for (const [m, caminho, corpo] of [
      ["POST", "/folgas/grupos", { operationId: opA!.id, nome: "invasão", pessoaIds: [membroA!.id], diasFolga: [1] }],
      ["POST", "/requests", { type: "LEAVE", operationId: opA!.id, targetDates: [hoje], reason: "invasão" }],
      ["POST", "/restrictions", { userId: membroA!.id, type: "PERSONAL", periodStart: hoje, periodEnd: hoje }],
      ["POST", "/occurrences", { personId: membroA!.id, date: hoje, type: "invasão", description: "invasão", reason: "invasão" }],
      ["POST", "/tasks", { operationId: opA!.id, title: "invasão", assigneeId: membroA!.id, dueDate: "2030-04-09" }],
      ["POST", "/agenda/events", { operationId: opA!.id, type: "MEETING", title: "invasão", date: hoje, startTime: "09:00", endTime: "10:00" }],
      ["POST", "/scales/generate", { operationId: opA!.id, periodStart: hoje, periodEnd: hoje }],
      ["POST", "/daily-book/generate", { showBookId: livroShow!.id, date: hoje }],
      ["POST", "/folgas", { userId: membroA!.id, operationId: opA!.id, type: "DAY_OFF", startDate: hoje, endDate: hoje }],
      ["POST", "/delegations", { operationId: opA!.id, delegateId: membroA!.id, startDate: hoje, responsibilities: ["SCALES"] }],
      ["POST", "/operational-groups", { name: "invasão", operationId: opA!.id, scope: "OPERATION" }],
      ["POST", "/responsibilities", { title: "invasão", areaId: areaA!.id }],
      ["POST", "/restricoes-horario", { userIds: [membroA!.id], diasSemana: [1], horaInicio: "09:00", horaFim: "10:00", periodStart: hoje, motivo: "invasão" }],
      ["POST", "/show-books", { operationId: opA!.id, locationId: localA!.id, title: "invasão" }],
      ["POST", "/messages/threads", { participantIds: [membroA!.id], title: "invasão", content: "invasão" }],
      ["POST", "/supervisor-requests", { requestorOperationId: opB!.id, targetOperationId: opA!.id, memberId: membroA!.id, reason: "invasão" }],
      ["POST", "/notices", { operationId: opA!.id, title: "invasão", content: "invasão", recipientUserIds: [membroA!.id] }],
      ["POST", "/communication/mural", { type: "POST", scope: "AREA", areaId: areaA!.id, body: "invasão" }],
      ["POST", "/communication/mural", { type: "POST", scope: "PEOPLE", recipientIds: [membroA!.id], body: "invasão" }],
      ["POST", "/folgas/grid/toggle", { userId: membroA!.id, operationId: opA!.id, date: hoje }],
      ["POST", "/tasks/batch", { operationId: opA!.id, tasks: [{ title: "invasão", assigneeId: membroA!.id, dueDate: "2030-04-09" }] }],
      ["POST", "/messages/grupos", { nome: "invasão", pessoaIds: [membroA!.id] }],
      ["POST", "/messages/grupos", { nome: "invasão", areaIds: [areaA!.id] }],
      ["POST", "/characters", { name: "invasão", locationId: localA!.id, mode: "titular" }],
      ["POST", "/programacoes", { locationId: localA!.id, nome: "invasão", vigenciaInicio: "2030-01-01", vigenciaFim: "2030-12-31" }],
      ["POST", "/escalas/dia/pronta", { locationId: localA!.id, areaId: areaA!.id, date: hoje, pronta: true }],
      ["POST", "/escalas/dia/ajustes", { locationId: localA!.id, date: hoje, sourceKey: "x", userId: membroA!.id, action: "ADICIONAR" }],
      ["POST", "/users", { fullName: "Invasão Teste", areaId: areaA!.id, perfil: "MEM" }],
      ["POST", "/locations", { name: "invasão", type: "teste", operationIds: [opA!.id] }],
      ["POST", "/leave-requests", { userId: membroA!.id, startDate: "2030-06-01", endDate: "2030-06-01", reason: "invasão" }],
      ["POST", "/solicitacoes", { tipo: "SWAP", data: "2030-06-01", colegaId: membroA!.id, motivo: "invasão" }],
    ] as Array<[Caso["metodo"], string, unknown]>) c("Criação com código de outra casa no corpo", m, caminho, corpo);

    const porGrupo = new Map<string, { total: number; ok: number }>();
    const naoRecusadas: string[] = [];
    for (const caso of casos) {
      const resposta = await fetch(`${base}${caso.caminho}`, { method: caso.metodo, headers: cab, ...(caso.corpo !== undefined && caso.metodo !== "GET" ? { body: JSON.stringify(caso.corpo) } : {}) });
      const corpoDaResposta = await resposta.text().catch(() => "");
      const recusou = resposta.status === 403 || resposta.status === 404 || (resposta.status === 409 && RECUSA_409.has(`${caso.metodo} ${caso.caminho}`))
        || (resposta.status === 400 && caso.grupo === "Criação com código de outra casa no corpo" && RECUSA_400_COM_FRASE.test(corpoDaResposta));
      const g2 = porGrupo.get(caso.grupo) ?? { total: 0, ok: 0 }; g2.total += 1; if (recusou) g2.ok += 1; porGrupo.set(caso.grupo, g2);
      marcar(recusou, `${caso.metodo} ${caso.caminho.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")} (Administração da casa B sobre recurso da casa A) respondeu ${resposta.status}; esperado 403 ou 404${recusou ? "" : ` — ${corpoDaResposta.slice(0, 160)}`}`);
      if (!recusou) naoRecusadas.push(`${caso.metodo} ${caso.caminho} → ${resposta.status}`);
    }

    // Segunda parte, do mesmo tipo de defeito dentro da MESMA casa: o Elenco (sem poder de gestão) tenta o que só a gestão faz.
    const tokenMembro = signAccessToken({ sub: membroA!.id, jti: `${tag}-m`, organizationId: casaA!.id, role: "MEMBER", operationIds: [opA!.id] });
    const cabMembro = { authorization: `Bearer ${tokenMembro}`, "content-type": "application/json" };
    const gestao: Array<[Caso["metodo"], string, unknown?]> = [
      ["POST", `/scales/${escala!.id}/archive`, v], ["POST", `/scales/${escala!.id}/publish`, v], ["POST", `/scales/${escala!.id}/republish`, v],
      ["POST", `/scales/${escala!.id}/regenerate`, v], ["PATCH", `/scales/${escala!.id}`, { title: "invadida", ...v }], ["DELETE", `/scales/${escala!.id}`, v],
      ["POST", `/scales/${escala!.id}/entries`, { memberId: membroA!.id, date: "2030-03-02", label: "x", ...v }],
      ["POST", `/daily-book/${livroDia!.id}/publish`, v], ["POST", `/daily-book/${livroDia!.id}/cancel`, v], ["POST", `/daily-book/${livroDia!.id}/execute`, v], ["DELETE", `/daily-book/${livroDia!.id}`, v],
      ["PATCH", `/show-books/${livroShow!.id}`, { title: "invadido", ...v }], ["DELETE", `/show-books/${livroShow!.id}`, v], ["POST", `/show-books/${livroShow!.id}/scenes`, { name: "x", order: 1, ...v }],
      ["PATCH", `/operational-groups/${grupoA!.id}`, { name: "invadido" }], ["DELETE", `/areas/${areaA!.id}`, {}], ["PATCH", `/operations/${opA!.id}`, { name: "invadida" }],
      ["PATCH", `/users/${supA!.id}`, { fullName: "invadida" }], ["POST", `/users/${supA!.id}/password-reset`, v], ["POST", `/users/${supA!.id}/roles`, { operationId: opA!.id, role: "ADMIN", reason: "x" }],
      ["DELETE", `/users/${supA!.id}/roles/${papelSupA.id}`, v], ["POST", `/library/documents/${documento!.id}/archive`, v], ["PATCH", `/library/documents/${documento!.id}`, { title: "invadido" }],
      ["POST", `/agenda/events/${evento!.id}/cancel`, v], ["DELETE", `/agenda/events/${evento!.id}`, v], ["PATCH", `/folgas/${folga!.id}`, { startDate: "2030-05-05", endDate: "2030-05-05" }],
      ["DELETE", `/folgas/grupos/${grupoFolga!.id}`, v], ["PATCH", `/communication/mural/${aviso!.id}`, { body: "invadido" }], ["POST", `/communication/mural/${aviso!.id}/cancel`, v],
      ["DELETE", `/communication/datas-especiais/${dataEspecial!.id}`, v], ["PATCH", `/responsibilities/${responsabilidade!.id}`, { title: "invadida" }], ["DELETE", `/responsibilities/${responsabilidade!.id}`, v],
    ];
    const naoRecusadasMembro: string[] = [];
    for (const [metodo, caminho, corpo] of gestao) {
      const resposta = await fetch(`${base}${caminho}`, { method: metodo, headers: cabMembro, body: JSON.stringify(corpo ?? {}) });
      await resposta.arrayBuffer().catch(() => undefined);
      const recusou = resposta.status === 403 || resposta.status === 404;
      marcar(recusou, `${metodo} ${caminho.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")} (Elenco da mesma casa, em ação só da gestão) respondeu ${resposta.status}; esperado 403 ou 404`);
      if (!recusou) naoRecusadasMembro.push(`${metodo} ${caminho} → ${resposta.status}`);
    }
    process.stdout.write(`isolamento-entre-casas: Elenco da mesma casa em ações da gestão: ${gestao.length - naoRecusadasMembro.length}/${gestao.length} recusadas\n`);
    if (naoRecusadasMembro.length) process.stdout.write(`isolamento-entre-casas: Elenco NÃO recusado:\n  ${naoRecusadasMembro.join("\n  ")}\n`);

    // Listagens antigas: nada da casa A pode aparecer para a casa B
    {
      const porShow = await fetch(`${base}/formations/by-show/${ls}`, { headers: cab });
      const textoShow = await porShow.text();
      marcar(!formacao || !textoShow.includes(formacao.id), `GET /formations/by-show/:id da casa B não traz formação da casa A (resposta ${porShow.status})`);
    }
    if (restricao) {
      const lista = await fetch(`${base}/restrictions`, { headers: cab });
      const texto = await lista.text();
      marcar(!texto.includes(restricao.id) && !texto.includes(membroA!.name), `GET /restrictions da casa B não mostra a restrição nem o nome de gente da casa A (resposta ${lista.status})`);
    }
    const depois = await fotografar();
    for (const nome of Object.keys(antes)) marcar(antes[nome] === depois[nome], `o recurso da casa A "${nome}" não mudou depois das chamadas da casa B`);

    process.stdout.write(`isolamento-entre-casas: ${casos.length} chamadas; por assunto: ${[...porGrupo].map(([n, x]) => `${n} ${x.ok}/${x.total}`).join(", ")}\n`);
    if (naoRecusadas.length) process.stdout.write(`isolamento-entre-casas: NÃO recusadas:\n  ${naoRecusadas.join("\n  ")}\n`);
  } finally {
    if (servidor) { servidor.closeAllConnections?.(); await new Promise<void>((ok) => servidor!.close(() => ok())); }
    // Limpeza de melhor esforço: o que ficar para trás leva o prefixo do teste e a data nos nomes.
    const tente = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* sobra de teste, sem importância */ } };
    await tente(() => db.delete(delegationsTable).where(eq(delegationsTable.operationId, opA!.id)));
    await tente(() => db.delete(historyEventsTable).where(inArray(historyEventsTable.orgId, [casaA!.id, casaB!.id])));
    await tente(() => db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, [adminA!.id, supA!.id, membroA!.id, adminB!.id, adminB2!.id])));
    await tente(() => db.delete(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, conversa!.id)));
    await tente(() => db.delete(messageThreadsTable).where(eq(messageThreadsTable.id, conversa!.id)));
    for (const [tabela, id] of [
      [dailyBooksTable, livroDia?.id], [agendaEventsTable, evento?.id], [tasksTable, tarefa?.id], [libraryDocumentVersionsTable, undefined],
      [requestsTable, pedido?.id], [leaveRequestsTable, pedidoFolga?.id], [folgasTable, folga?.id], [folgaGruposTable, grupoFolga?.id],
      [announcementsTable, aviso?.id], [muralDatasEspeciaisTable, dataEspecial?.id], [scalesTable, escala?.id], [responsibilitiesTable, responsabilidade?.id],
      [restricoesHorarioTable, restricaoHorario?.id], [restrictionsTable, restricao?.id], [delegationsTable, delegacao?.id], [charactersTable, personagem?.id],
      [formationsTable, formacao?.id], [occurrencesTable, ocorrencia?.id], [programacoesTable, programacao?.id], [showBooksTable, livroShow?.id],
    ] as Array<[any, string | undefined]>) if (id) await tente(() => db.delete(tabela).where(eq(tabela.id, id)));
    await tente(() => db.delete(libraryDocumentVersionsTable).where(eq(libraryDocumentVersionsTable.documentId, documento!.id)));
    await tente(() => db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, documento!.id)));
    await tente(() => db.delete(userRolesTable).where(inArray(userRolesTable.userId, [adminA!.id, supA!.id, membroA!.id, adminB!.id, adminB2!.id])));
    await tente(() => db.delete(usersTable).where(inArray(usersTable.id, [adminA!.id, supA!.id, membroA!.id, adminB!.id, adminB2!.id])));
    await tente(() => db.delete(operationalGroupsTable).where(eq(operationalGroupsTable.id, grupoA!.id)));
    await tente(() => db.delete(areasTable).where(eq(areasTable.id, areaA!.id)));
    await tente(() => db.delete(locationsTable).where(eq(locationsTable.id, localA!.id)));
    await tente(() => db.delete(operationsTable).where(inArray(operationsTable.id, [opA!.id, opB!.id])));
    await tente(() => db.delete(organizationsTable).where(inArray(organizationsTable.id, [casaA!.id, casaB!.id])));
  }

  console.error = consoleErrorOriginal;
  if (falhas.length) throw new Error(`${falhas.length} falha(s) no isolamento entre casas`);
  process.stdout.write(`isolamento-entre-casas: ${certos} verificações passaram\n`);
}

run()
  .catch((erro) => { console.error = consoleErrorOriginal; console.error(erro); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
