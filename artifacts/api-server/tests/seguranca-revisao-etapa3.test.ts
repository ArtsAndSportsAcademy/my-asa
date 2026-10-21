/**
 * Regressões da revisão de segurança de 21/10/2026 (Etapa 3). Cada caso reproduz um defeito achado na leitura do código e
 * afirma o comportamento certo. O teste de isolamento entre casas cobre as rotas com id em bloco; aqui ficam os casos que
 * precisam de um estado especial (a casa B com os próprios dados, texto de mensagem no registro da ASA, etapas da tarefa).
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, pool, organizationsTable, operationsTable, usersTable, userRolesTable, showBooksTable, showBookRolesTable, showBookPositionLibraryRefsTable,
  messageThreadsTable, messageThreadParticipantsTable, messagesTable, libraryDocumentsTable, libraryDocumentVersionsTable, tasksTable, taskStepsTable, asaAuditLogTable, historyEventsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { semConteudoDeMensagem } from "../src/routes/asa.js";

const falhas: string[] = [];
let certos = 0;
const marcar = (ok: boolean, texto: string) => { if (ok) certos += 1; else { falhas.push(texto); console.error(`  ✗ ${texto}`); } };

async function run() {
  const tag = `seg_etapa3_${Date.now()}`;
  const [casaA] = await db.insert(organizationsTable).values({ name: `${tag}_A` }).returning();
  const [casaB] = await db.insert(organizationsTable).values({ name: `${tag}_B` }).returning();
  const [opA] = await db.insert(operationsTable).values({ organizationId: casaA!.id, name: `${tag}_opA`, status: "ACTIVE" }).returning();
  const [opB] = await db.insert(operationsTable).values({ organizationId: casaB!.id, name: `${tag}_opB`, status: "ACTIVE" }).returning();
  const [adminA] = await db.insert(usersTable).values({ organizationId: casaA!.id, name: `${tag}_adminA`, username: `${tag}_adminA` }).returning();
  const [membroA] = await db.insert(usersTable).values({ organizationId: casaA!.id, name: `${tag}_membroA`, username: `${tag}_membroA` }).returning();
  const [adminB] = await db.insert(usersTable).values({ organizationId: casaB!.id, name: `${tag}_adminB`, username: `${tag}_adminB` }).returning();
  await db.insert(userRolesTable).values([
    { userId: adminA!.id, operationId: opA!.id, role: "ADMIN", active: true },
    { userId: membroA!.id, operationId: opA!.id, role: "MEMBER", active: true },
    { userId: adminB!.id, operationId: opB!.id, role: "ADMIN", active: true },
  ]);
  const [docA] = await db.insert(libraryDocumentsTable).values({ orgId: casaA!.id, type: "ONBOARDING_MATERIAL", title: `${tag}_docA`, body: "privado da casa A", createdBy: adminA!.id, status: "PUBLISHED" } as never).returning();
  await db.insert(libraryDocumentVersionsTable).values({ documentId: docA!.id, version: 1, title: docA!.title, body: docA!.body, createdBy: adminA!.id });
  const [livroB] = await db.insert(showBooksTable).values({ operationId: opB!.id, title: `${tag}_showB`, createdBy: adminB!.id }).returning();
  const [posicaoB] = await db.insert(showBookRolesTable).values({ showBookId: livroB!.id, name: `${tag}_posicao` } as never).returning();
  const [tarefaA] = await db.insert(tasksTable).values({ organizationId: casaA!.id, operationId: opA!.id, title: `${tag}_tarefa`, creatorId: adminA!.id, assigneeId: membroA!.id }).returning();
  const [linhaDoRegistro] = await db.insert(asaAuditLogTable).values({ userId: membroA!.id, organizationId: casaA!.id, question: "minhas mensagens", response: `SEGREDO_${tag}`, toolsUsed: ["consultar_mensagens"], actionsExecuted: [] } as never).returning();

  const [conversaA] = await db.insert(messageThreadsTable).values({ title: `${tag}_conversa`, orgId: casaA!.id } as never).returning();
  await db.insert(messageThreadParticipantsTable).values([{ threadId: conversaA!.id, userId: adminA!.id }, { threadId: conversaA!.id, userId: membroA!.id }] as never);
  await db.insert(messagesTable).values({ threadId: conversaA!.id, senderId: adminA!.id, senderName: `${tag}_adminA`, content: `MENSAGEM_PRIVADA_${tag}` } as never);

  let servidor: http.Server | null = null;
  try {
    servidor = http.createServer(app);
    await new Promise<void>((ok) => servidor!.listen(0, "127.0.0.1", ok));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${endereco.port}/api`;
    const cab = (sub: string, org: string, role: string, ops: string[]) => ({ authorization: `Bearer ${signAccessToken({ sub, jti: `${tag}-${sub}`, organizationId: org, role, operationIds: ops })}`, "content-type": "application/json" });
    const cabB = cab(adminB!.id, casaB!.id, "ADMIN", [opB!.id]);
    const cabA = cab(adminA!.id, casaA!.id, "ADMIN", [opA!.id]);

    // 1. Documento da casa A não se liga a posição de um show da casa B.
    const ligar = await fetch(`${base}/show-books/${livroB!.id}/positions/${posicaoB!.id}/refs`, { method: "POST", headers: cabB, body: JSON.stringify({ documentId: docA!.id }) });
    marcar(ligar.status === 404, `ligar documento de outra casa a uma posição respondeu ${ligar.status}; esperado 404`);
    const vinculos = await db.select().from(showBookPositionLibraryRefsTable).where(eq(showBookPositionLibraryRefsTable.positionId, posicaoB!.id));
    marcar(vinculos.length === 0, "nenhum vínculo com o documento de outra casa foi gravado");
    const lerRefs = await fetch(`${base}/show-books/${livroB!.id}/refs`, { headers: cabB });
    marcar(!(await lerRefs.text()).includes(`${tag}_docA`), "a lista de referências do show da casa B não mostra o título do documento da casa A");

    // 2. Mexer numa tarefa de outra casa não cria etapas nela (antes as etapas eram criadas antes da checagem de acesso).
    for (const acao of ["start", "ready-for-approval", "approve"]) {
      const r = await fetch(`${base}/tasks/${tarefaA!.id}/${acao}`, { method: "POST", headers: cabB, body: "{}" });
      marcar(r.status === 404, `POST /tasks/:id/${acao} de outra casa respondeu ${r.status}; esperado 404`);
    }
    const etapas = await db.select({ id: taskStepsTable.id }).from(taskStepsTable).where(eq(taskStepsTable.taskId, tarefaA!.id));
    marcar(etapas.length === 0, `a tarefa da casa A não ganhou etapas por chamadas da casa B (ganhou ${etapas.length})`);

    // 3. O registro da ASA não mostra o texto de conversas, nem para a Administração da própria casa.
    const registro = await fetch(`${base}/asa/audit?limit=200`, { headers: cabA });
    const texto = await registro.text();
    marcar(registro.status === 200, `GET /asa/audit pela Administração respondeu ${registro.status}`);
    marcar(!texto.includes(`SEGREDO_${tag}`), "o registro da ASA não devolve o texto guardado de uma consulta de mensagens");
    // 3b. Perguntar à ASA "minhas mensagens": a pessoa vê o texto no chat dela, mas o registro da casa não guarda.
    const cabMembro = cab(membroA!.id, casaA!.id, "MEMBER", [opA!.id]);
    const nova = await fetch(`${base}/asa/conversations`, { method: "POST", headers: cabMembro, body: "{}" });
    const conversaAsa = ((await nova.json()) as { id?: number; conversation?: { id: number } });
    const idConversa = conversaAsa.id ?? conversaAsa.conversation?.id;
    const chat = await fetch(`${base}/asa/chat/${idConversa}/messages`, { method: "POST", headers: cabMembro, body: JSON.stringify({ content: "minhas mensagens não lidas" }) });
    const fluxo = await chat.text();
    marcar(fluxo.includes(`MENSAGEM_PRIVADA_${tag}`), `a pessoa vê o texto das próprias mensagens no chat da ASA (resposta: ${fluxo.slice(0, 400)})`);
    const linhas = await db.select().from(asaAuditLogTable).where(eq(asaAuditLogTable.userId, membroA!.id));
    const comMensagens = linhas.filter((linha) => (linha.toolsUsed ?? []).includes("consultar_mensagens"));
    marcar(comMensagens.length > 0 && comMensagens.every((linha) => !linha.response.includes(`MENSAGEM_PRIVADA_${tag}`)), "o registro da ASA não guarda o texto das mensagens mostradas");
    for (const linha of linhas) await db.delete(asaAuditLogTable).where(eq(asaAuditLogTable.id, linha.id)).catch(() => undefined);
    const mascarada = semConteudoDeMensagem({ question: "q", response: "texto de conversa", toolsUsed: ["asa.message_reply.preview"], actionsExecuted: [{ action: "ASA_ACTION_PROPOSAL", actionType: "MESSAGE_REPLY", content: "texto de conversa" }] });
    marcar(!JSON.stringify(mascarada).includes("texto de conversa"), "resposta de mensagem e conteúdo da proposta saem do registro da ASA");
    const preservada = semConteudoDeMensagem({ question: "q", response: "agenda de hoje", toolsUsed: ["consultar_agenda"], actionsExecuted: [] });
    marcar(preservada.response === "agenda de hoje", "consulta que não é de mensagens segue como estava");
  } finally {
    if (servidor) { servidor.closeAllConnections?.(); await new Promise<void>((ok) => servidor!.close(() => ok())); }
    const tente = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* sobra de teste */ } };
    await tente(() => db.delete(messagesTable).where(eq(messagesTable.threadId, conversaA!.id)));
    await tente(() => db.delete(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, conversaA!.id)));
    await tente(() => db.delete(messageThreadsTable).where(eq(messageThreadsTable.id, conversaA!.id)));
    await tente(() => db.delete(asaAuditLogTable).where(eq(asaAuditLogTable.id, linhaDoRegistro!.id)));
    await tente(() => db.delete(historyEventsTable).where(inArray(historyEventsTable.orgId, [casaA!.id, casaB!.id])));
    await tente(() => db.delete(taskStepsTable).where(eq(taskStepsTable.taskId, tarefaA!.id)));
    await tente(() => db.delete(tasksTable).where(eq(tasksTable.id, tarefaA!.id)));
    await tente(() => db.delete(showBookPositionLibraryRefsTable).where(eq(showBookPositionLibraryRefsTable.positionId, posicaoB!.id)));
    await tente(() => db.delete(showBookRolesTable).where(eq(showBookRolesTable.id, posicaoB!.id)));
    await tente(() => db.delete(showBooksTable).where(eq(showBooksTable.id, livroB!.id)));
    await tente(() => db.delete(libraryDocumentVersionsTable).where(eq(libraryDocumentVersionsTable.documentId, docA!.id)));
    await tente(() => db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, docA!.id)));
    await tente(() => db.delete(userRolesTable).where(inArray(userRolesTable.userId, [adminA!.id, membroA!.id, adminB!.id])));
    await tente(() => db.delete(usersTable).where(inArray(usersTable.id, [adminA!.id, membroA!.id, adminB!.id])));
    await tente(() => db.delete(operationsTable).where(inArray(operationsTable.id, [opA!.id, opB!.id])));
    await tente(() => db.delete(organizationsTable).where(inArray(organizationsTable.id, [casaA!.id, casaB!.id])));
  }
  if (falhas.length) throw new Error(`${falhas.length} falha(s) nas regressões de segurança`);
  process.stdout.write(`seguranca-revisao-etapa3: ${certos} verificações passaram\n`);
}

void and;
run()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
