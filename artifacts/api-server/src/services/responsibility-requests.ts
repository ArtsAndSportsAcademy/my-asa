/**
 * Pedidos às responsabilidades. Alguém pede algo escolhendo a responsabilidade ("Perucas"), sem precisar saber quem
 * cuida dela. O pedido vai para quem cuida (principal, participante e o substituto dentro do período; nunca quem só
 * lê). Basta UMA pessoa aceitar: ela fica com o pedido, ele vira uma tarefa, e as outras são avisadas. Se a
 * responsabilidade não tem ninguém, o pedido vai para a Administração, dizendo por quê.
 */
import { and, eq, inArray, isNull, lte, or, gte } from "drizzle-orm";
import { db, responsibilitiesTable, responsibilityAssignmentsTable, responsibilityRequestRecipientsTable, responsibilityRequestsTable, userRolesTable, usersTable, type ResponsibilityRequest } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { enqueueNotification, databaseNow, type Transaction } from "./undo.js";
import { TarefaError, criarTarefa, type Ator } from "./task-steps.js";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
export { TarefaError as PedidoError };

async function nomeDe(tx: Pick<typeof db, "select">, userId: string) {
  const [row] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.name ?? userId;
}

/** Quem recebe o pedido: principal, participantes e o substituto dentro do período; sem ninguém, a Administração. */
export async function destinatariosDoPedido(tx: Pick<typeof db, "select">, responsibilityId: string, organizationId: string, quando: Date): Promise<{ userIds: string[]; semDono: boolean }> {
  const vigentes = await tx.select({ memberId: responsibilityAssignmentsTable.memberId, substituteMemberId: responsibilityAssignmentsTable.substituteMemberId })
    .from(responsibilityAssignmentsTable)
    .where(and(
      eq(responsibilityAssignmentsTable.responsibilityId, responsibilityId), eq(responsibilityAssignmentsTable.active, true),
      inArray(responsibilityAssignmentsTable.role, ["PRIMARY", "SECONDARY"]),
      or(isNull(responsibilityAssignmentsTable.startsAt), lte(responsibilityAssignmentsTable.startsAt, quando)),
      or(isNull(responsibilityAssignmentsTable.endsAt), gte(responsibilityAssignmentsTable.endsAt, quando)),
    ));
  const candidatos = [...new Set(vigentes.flatMap((linha) => [linha.memberId, linha.substituteMemberId]).filter((id): id is string => Boolean(id)))];
  const ativos = candidatos.length ? await tx.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE"), inArray(usersTable.id, candidatos))) : [];
  if (ativos.length) return { userIds: ativos.map((pessoa) => pessoa.id), semDono: false };
  const administracao = await tx.select({ id: usersTable.id }).from(userRolesTable).innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(and(eq(usersTable.organizationId, organizationId), eq(usersTable.status, "ACTIVE"), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true)));
  return { userIds: [...new Set(administracao.map((pessoa) => pessoa.id))], semDono: true };
}

type Aviso = { userId: string; type: string; title: string; message: string };
async function avisar(tx: Transaction, request: Pick<ResponsibilityRequest, "id">, avisos: Aviso[], now: Date, ator: string) {
  for (const aviso of avisos) {
    if (aviso.userId === ator) continue;
    await enqueueNotification(tx, { ...aviso, priority: "NORMAL", category: "responsibility", entityType: "responsibility_request", entityId: request.id, actionUrl: "/responsabilidades" }, now, { deduplicationKey: `${aviso.type}:${request.id}:${aviso.userId}` });
  }
}

async function registrar(tx: Transaction, ator: Ator, nome: string, orgId: string, request: ResponsibilityRequest, action: string, titulo: string, narrativa: string, metadata: Record<string, unknown> = {}) {
  await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action, title: titulo, narrative: narrativa, entityType: "responsibility_request", entityId: request.id, actorId: ator.id, actorName: nome, orgId, metadata: { responsibilityId: request.responsibilityId, ...metadata } }, tx as never);
}

export async function criarPedido(tx: Transaction, ator: Ator, entrada: { responsibilityId: string; title?: string; details?: string; dueDate?: string | null }) {
  const title = entrada.title?.trim();
  if (!title) throw new TarefaError(400, "Diga o que você precisa.");
  if (entrada.dueDate && !DATA.test(entrada.dueDate)) throw new TarefaError(400, "Data inválida. Use o formato do calendário.");
  const [responsabilidade] = await tx.select({ id: responsibilitiesTable.id, title: responsibilitiesTable.title }).from(responsibilitiesTable)
    .where(and(eq(responsibilitiesTable.id, entrada.responsibilityId), eq(responsibilitiesTable.orgId, ator.organizationId), eq(responsibilitiesTable.active, true))).limit(1);
  if (!responsabilidade) throw new TarefaError(404, "Responsabilidade não encontrada ou desativada.");
  const now = await databaseNow(tx);
  const { userIds, semDono } = await destinatariosDoPedido(tx, responsabilidade.id, ator.organizationId, now);
  const [request] = await tx.insert(responsibilityRequestsTable).values({
    orgId: ator.organizationId, responsibilityId: responsabilidade.id, requesterId: ator.id, title, details: entrada.details?.trim() || null, dueDate: entrada.dueDate || null, semDono,
  }).returning();
  if (userIds.length) await tx.insert(responsibilityRequestRecipientsTable).values(userIds.map((userId) => ({ requestId: request!.id, userId })));
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, ator.organizationId, request!, "responsibility.request_created", `Pedido a ${responsabilidade.title}`,
    `${nome} pediu a ${responsabilidade.title}: "${title}"${semDono ? " (a responsabilidade ainda não tem dono, o pedido foi para a Administração)" : ""}.`, { recipients: userIds, semDono });
  await avisar(tx, request!, userIds.map((userId) => ({
    userId, type: "responsibility.request", title: `Pedido novo: ${responsabilidade.title}`,
    message: `${nome} pediu: ${title}${entrada.dueDate ? ` (até ${entrada.dueDate.split("-").reverse().slice(0, 2).join("/")})` : ""}.${semDono ? " Esta responsabilidade ainda não tem dono, por isso o pedido veio para a Administração." : ""}`,
  })), now, ator.id);
  return request!;
}

async function carregarPedido(tx: Transaction, organizationId: string, requestId: string) {
  const [request] = await tx.select().from(responsibilityRequestsTable).where(and(eq(responsibilityRequestsTable.id, requestId), eq(responsibilityRequestsTable.orgId, organizationId))).for("update").limit(1);
  if (!request) throw new TarefaError(404, "Pedido não encontrado.");
  const destinatarios = await tx.select().from(responsibilityRequestRecipientsTable).where(eq(responsibilityRequestRecipientsTable.requestId, requestId));
  return { request, destinatarios };
}
async function motivoDe(request: ResponsibilityRequest, tx: Transaction) {
  if (request.status === "ACCEPTED" && request.acceptedById) return `Já foi aceito por ${await nomeDe(tx, request.acceptedById)}.`;
  return request.status === "CANCELLED" ? "Esse pedido foi cancelado." : request.status === "DECLINED" ? "Todas as pessoas recusaram esse pedido." : "Este pedido não está mais aberto.";
}

export async function aceitarPedido(tx: Transaction, ator: Ator, requestId: string, entrada: { dueDate?: string | null } = {}) {
  const { request, destinatarios } = await carregarPedido(tx, ator.organizationId, requestId);
  const meu = destinatarios.find((linha) => linha.userId === ator.id);
  if (!meu) throw new TarefaError(403, "Este pedido não foi enviado para você.");
  if (request.status !== "OPEN") throw new TarefaError(409, await motivoDe(request, tx));
  if (meu.declinedAt) throw new TarefaError(409, "Você já recusou este pedido. Se mudou de ideia, peça a quem pediu para enviar de novo.");
  const [responsabilidade] = await tx.select({ title: responsibilitiesTable.title, operationId: responsibilitiesTable.operationId }).from(responsibilitiesTable).where(eq(responsibilitiesTable.id, request.responsibilityId)).limit(1);
  const operationId = responsabilidade?.operationId ?? (await tx.select({ operationId: userRolesTable.operationId }).from(userRolesTable).where(and(eq(userRolesTable.userId, ator.id), eq(userRolesTable.active, true))).limit(1))[0]?.operationId;
  if (!operationId) throw new TarefaError(400, "Não achei a operação deste pedido. Fale com a Administração.");
  const now = await databaseNow(tx);
  const prazo = entrada.dueDate ?? request.dueDate ?? null;
  const { task } = await criarTarefa(tx, ator, {
    operationId, title: request.title, description: request.details ?? undefined, dueDate: prazo, responsibilityId: request.responsibilityId, origin: "REQUEST",
    creatorId: request.requesterId, steps: [{ kind: "WORK", title: "Fazer", assigneeId: ator.id, dueDate: prazo }],
  });
  const [aceito] = await tx.update(responsibilityRequestsTable).set({ status: "ACCEPTED", acceptedById: ator.id, acceptedAt: now, taskId: task.id }).where(eq(responsibilityRequestsTable.id, requestId)).returning();
  const nome = await nomeDe(tx, ator.id), quemPediu = await nomeDe(tx, request.requesterId);
  await registrar(tx, ator, nome, ator.organizationId, aceito!, "responsibility.request_accepted", `Pedido aceito: ${request.title}`, `${nome} aceitou o pedido de ${quemPediu} a ${responsabilidade?.title ?? "uma responsabilidade"}: "${request.title}".`, { taskId: task.id });
  await avisar(tx, aceito!, [
    { userId: request.requesterId, type: "responsibility.request_accepted", title: "Seu pedido foi aceito", message: `${nome} aceitou: ${request.title}.` },
    ...destinatarios.filter((linha) => linha.userId !== ator.id).map((linha) => ({ userId: linha.userId, type: "responsibility.request_taken", title: "Pedido já aceito por outra pessoa", message: `O pedido de ${quemPediu} (${request.title}) já foi aceito por ${nome}. Você não precisa fazer nada.` })),
  ], now, ator.id);
  return { request: aceito!, task };
}

export async function recusarPedido(tx: Transaction, ator: Ator, requestId: string, motivoBruto: unknown) {
  const { request, destinatarios } = await carregarPedido(tx, ator.organizationId, requestId);
  if (!destinatarios.some((linha) => linha.userId === ator.id)) throw new TarefaError(403, "Este pedido não foi enviado para você.");
  if (request.status !== "OPEN") throw new TarefaError(409, await motivoDe(request, tx));
  const motivo = typeof motivoBruto === "string" ? motivoBruto.trim() : "";
  if (!motivo) throw new TarefaError(400, "Escreva o motivo da recusa. Quem pediu vai ler.");
  const now = await databaseNow(tx);
  await tx.update(responsibilityRequestRecipientsTable).set({ declinedAt: now, declineReason: motivo }).where(and(eq(responsibilityRequestRecipientsTable.requestId, requestId), eq(responsibilityRequestRecipientsTable.userId, ator.id)));
  const todasRecusaram = destinatarios.every((linha) => linha.userId === ator.id || linha.declinedAt);
  const nome = await nomeDe(tx, ator.id);
  let atual = request;
  if (todasRecusaram) [atual] = await tx.update(responsibilityRequestsTable).set({ status: "DECLINED" }).where(eq(responsibilityRequestsTable.id, requestId)).returning() as [ResponsibilityRequest];
  await registrar(tx, ator, nome, ator.organizationId, atual, "responsibility.request_declined", `Pedido recusado: ${request.title}`, `${nome} recusou o pedido "${request.title}". Motivo: ${motivo}.`, { reason: motivo, todasRecusaram });
  if (todasRecusaram) {
    const motivos = [...destinatarios.filter((linha) => linha.userId !== ator.id).map((linha) => linha.declineReason).filter(Boolean), motivo];
    const nomes = await Promise.all(destinatarios.map((linha) => nomeDe(tx, linha.userId)));
    await avisar(tx, atual, [{ userId: request.requesterId, type: "responsibility.request_declined", title: "Ninguém pôde aceitar seu pedido", message: `${request.title}: ${motivos.join(" · ")} (${nomes.join(", ")}).` }], now, ator.id);
  }
  return atual;
}

export async function cancelarPedido(tx: Transaction, ator: Ator, requestId: string, motivoBruto: unknown) {
  const { request, destinatarios } = await carregarPedido(tx, ator.organizationId, requestId);
  if (request.requesterId !== ator.id && ator.role !== "ADMIN" && ator.role !== "DIR") throw new TarefaError(403, "Só quem fez o pedido (ou a Administração) pode cancelá-lo.");
  if (request.status !== "OPEN") throw new TarefaError(409, await motivoDe(request, tx));
  const motivo = typeof motivoBruto === "string" ? motivoBruto.trim() : "";
  if (!motivo) throw new TarefaError(400, "Escreva o motivo do cancelamento. Quem recebeu o pedido vai ler.");
  const now = await databaseNow(tx);
  const [cancelado] = await tx.update(responsibilityRequestsTable).set({ status: "CANCELLED" }).where(eq(responsibilityRequestsTable.id, requestId)).returning();
  const nome = await nomeDe(tx, ator.id);
  await registrar(tx, ator, nome, ator.organizationId, cancelado!, "responsibility.request_cancelled", `Pedido cancelado: ${request.title}`, `${nome} cancelou o pedido "${request.title}". Motivo: ${motivo}.`, { reason: motivo });
  await avisar(tx, cancelado!, destinatarios.map((linha) => ({ userId: linha.userId, type: "responsibility.request_cancelled", title: "Pedido cancelado", message: `${nome} cancelou o pedido "${request.title}". Motivo: ${motivo}.` })), now, ator.id);
  return cancelado!;
}
