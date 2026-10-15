import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, areasTable, messageThreadParticipantsTable, messageThreadsTable, messagesTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { normalizeReason, requireReason } from "../lib/reason.js";
import { GRUPO_DA_AREA, GRUPO_DA_CASA, GRUPO_DA_PESSOA, MAX_INTEGRANTES, TIPOS_DE_GRUPO, avisarDoGrupo } from "../services/mensagens.js";
import { podeGerirGrupo } from "./messages.js";

/**
 * Grupos das Mensagens. Qualquer pessoa cria grupo (em POST /messages/threads) e passa a ser a dona dele. A
 * Administração e a Direção criam os grupos da casa ("meninas", "meninos"…) e arquivam qualquer grupo, com
 * motivo. Nada aqui devolve o texto de nenhuma conversa: a Administração vê que o grupo existe e quem está
 * nele, não o que se conversa (decisão de 14/10/2026).
 */
const router: IRouter = Router();

function isAdminOuDirecao(req: any) { return ["ADMIN", "ADM", "DIRECTOR", "DIR", "DIRECTION"].includes(String(req.user?.role ?? "").toUpperCase()); }

async function carregar(req: any, threadId: string) {
  const [thread] = await db.select().from(messageThreadsTable).where(and(eq(messageThreadsTable.id, threadId), eq(messageThreadsTable.orgId, req.user.organizationId))).limit(1);
  if (!thread) return null;
  const [participacao] = await db.select().from(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, threadId), eq(messageThreadParticipantsTable.userId, req.user.sub))).limit(1);
  return { thread, participacao: participacao ?? null };
}

async function nomeDe(userId: string) {
  const [row] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.name ?? "Alguém";
}

/** Só pessoas ativas desta organização entram num grupo. */
async function pessoasValidas(orgId: string, ids: string[]) {
  if (!ids.length) return [];
  return db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, ids), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
}

const textoIds = (valor: unknown) => Array.isArray(valor) ? [...new Set(valor.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];

// ─── Lista de grupos (Administração e Direção) ────────────────────────────────

router.get("/messages/grupos", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  if (!isAdminOuDirecao(req)) { res.status(403).json({ error: "Só a Administração e a Direção veem a lista de grupos." }); return; }
  try {
    const orgId = req.user!.organizationId!;
    const dono = alias(usersTable, "dono"), arquivou = alias(usersTable, "arquivou");
    const grupos = await db.select({
      id: messageThreadsTable.id, title: messageThreadsTable.title, tipo: messageThreadsTable.contextType, status: messageThreadsTable.status, criadoEm: messageThreadsTable.createdAt,
      closedReason: messageThreadsTable.closedReason, closedAt: messageThreadsTable.closedAt, criadoPor: dono.name, arquivadoPor: arquivou.name,
    }).from(messageThreadsTable).leftJoin(dono, eq(messageThreadsTable.createdBy, dono.id)).leftJoin(arquivou, eq(messageThreadsTable.closedBy, arquivou.id))
      .where(and(eq(messageThreadsTable.orgId, orgId), inArray(messageThreadsTable.contextType, TIPOS_DE_GRUPO))).orderBy(desc(messageThreadsTable.createdAt));
    const ids = grupos.map((grupo) => grupo.id);
    const integrantes = ids.length ? await db.select({ threadId: messageThreadParticipantsTable.threadId, userId: messageThreadParticipantsTable.userId, name: usersTable.name })
      .from(messageThreadParticipantsTable).innerJoin(usersTable, eq(messageThreadParticipantsTable.userId, usersTable.id)).where(inArray(messageThreadParticipantsTable.threadId, ids)).orderBy(usersTable.name) : [];
    // Só QUANDO foi a última mensagem, nunca o quê.
    const atividade = ids.length ? await db.select({ threadId: messagesTable.threadId, ultima: sql<string>`max(${messagesTable.createdAt})` }).from(messagesTable).where(inArray(messagesTable.threadId, ids)).groupBy(messagesTable.threadId) : [];
    const ultimaPorGrupo = new Map(atividade.map((row) => [row.threadId, row.ultima]));
    res.json({
      grupos: grupos.map((grupo) => {
        const doGrupo = integrantes.filter((row) => row.threadId === grupo.id);
        return { ...grupo, integrantes: doGrupo.map((row) => ({ userId: row.userId, name: row.name })), total: doGrupo.length, ultimaMensagemEm: ultimaPorGrupo.get(grupo.id) ?? null };
      }),
    });
  } catch (error) { console.error("[messages-grupos] GET", error); res.status(500).json({ error: "Não consegui listar os grupos agora." }); }
});

// ─── Grupo da casa (Administração e Direção) ──────────────────────────────────

router.post("/messages/grupos", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  if (!isAdminOuDirecao(req)) { res.status(403).json({ error: "Só a Administração e a Direção criam grupos da casa." }); return; }
  try {
    const orgId = req.user!.organizationId!, quem = req.user!.sub;
    const nome = String(req.body?.nome ?? "").trim();
    if (!nome || nome.length > 80) { res.status(400).json({ error: "Dê um nome ao grupo, com até 80 letras." }); return; }
    const areaIds = textoIds(req.body?.areaIds);
    const pessoas = new Set(textoIds(req.body?.pessoaIds));
    if (areaIds.length) {
      const areas = await db.select({ id: areasTable.id }).from(areasTable).where(and(inArray(areasTable.id, areaIds), eq(areasTable.organizationId, orgId)));
      if (areas.length !== areaIds.length) { res.status(404).json({ error: "Alguma área escolhida não foi encontrada." }); return; }
      const daArea = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"), inArray(usersTable.areaId, areaIds)));
      for (const row of daArea) pessoas.add(row.id);
    }
    if (!pessoas.size) { res.status(400).json({ error: "Escolha pelo menos uma pessoa ou uma área para o grupo." }); return; }
    if (pessoas.size > MAX_INTEGRANTES) { res.status(400).json({ error: `Um grupo tem no máximo ${MAX_INTEGRANTES} pessoas.` }); return; }
    const validas = await pessoasValidas(orgId, [...pessoas]);
    if (validas.length !== pessoas.size) { res.status(404).json({ error: "Alguma pessoa escolhida não foi encontrada ou não está ativa." }); return; }
    const feitoPor = await nomeDe(quem);
    const thread = await db.transaction(async (tx) => {
      const [criado] = await tx.insert(messageThreadsTable).values({ orgId, title: nome, contextType: GRUPO_DA_CASA, createdBy: quem, status: "OPEN" }).returning();
      // Quem cria o grupo da casa NÃO entra nele sozinha: a Administração só lê o grupo se entrar de propósito, à vista de todos.
      await tx.insert(messageThreadParticipantsTable).values(validas.map((pessoa) => ({ threadId: criado!.id, userId: pessoa.id, role: "PARTICIPANT" as const })));
      await writeHistoryEvent({ category: "MESSAGE", action: "message.group_created", title: `Grupo da casa criado: ${nome}`, narrative: `${feitoPor} criou o grupo “${nome}” com ${validas.length} pessoa(s).`, entityType: "message_thread", entityId: criado!.id, actorId: quem, actorName: feitoPor, orgId, afterState: { id: criado!.id, title: nome }, metadata: { integrantes: validas.map((pessoa) => pessoa.id) } }, tx as any);
      await avisarDoGrupo(tx, validas.map((pessoa) => pessoa.id).filter((id) => id !== quem), `thread:${criado!.id}:criado`, { threadId: criado!.id, titulo: nome, texto: `${feitoPor} adicionou você ao grupo “${nome}”.` });
      return criado!;
    });
    res.status(201).json({ thread });
  } catch (error) { console.error("[messages-grupos] POST", error); res.status(500).json({ error: "Não consegui criar o grupo agora." }); }
});

// ─── Renomear ─────────────────────────────────────────────────────────────────

router.patch("/messages/threads/:threadId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const threadId = String(req.params.threadId), quem = req.user!.sub;
    const carregado = await carregar(req, threadId);
    if (!carregado) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    const { thread, participacao } = carregado;
    if (!podeGerirGrupo(req, thread, participacao?.role)) { res.status(403).json({ error: "Só quem criou o grupo (ou a Administração, nos grupos da casa) muda o nome." }); return; }
    const nome = String(req.body?.title ?? "").trim();
    if (!nome || nome.length > 80) { res.status(400).json({ error: "Dê um nome ao grupo, com até 80 letras." }); return; }
    if (nome === thread.title) { res.status(400).json({ error: "Nada mudou." }); return; }
    const feitoPor = await nomeDe(quem);
    const [atualizado] = await db.transaction(async (tx) => {
      const [row] = await tx.update(messageThreadsTable).set({ title: nome }).where(eq(messageThreadsTable.id, threadId)).returning();
      await writeHistoryEvent({ category: "MESSAGE", action: "message.group_renamed", title: "Grupo renomeado", narrative: `${feitoPor} mudou o nome do grupo de “${thread.title}” para “${nome}”.`, entityType: "message_thread", entityId: threadId, actorId: quem, actorName: feitoPor, orgId: thread.orgId ?? undefined, beforeState: { title: thread.title }, afterState: { title: nome } }, tx as any);
      return [row!] as const;
    });
    res.json({ thread: atualizado });
  } catch (error) { console.error("[messages-grupos] PATCH", error); res.status(500).json({ error: "Não consegui renomear o grupo agora." }); }
});

// ─── Integrantes ──────────────────────────────────────────────────────────────

router.post("/messages/threads/:threadId/members", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const threadId = String(req.params.threadId), quem = req.user!.sub, orgId = req.user!.organizationId!;
    const carregado = await carregar(req, threadId);
    if (!carregado) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    const { thread, participacao } = carregado;
    if (thread.contextType === GRUPO_DA_AREA) { res.status(400).json({ error: "O grupo da área acompanha o cadastro: quem entra ou sai da área entra ou sai do grupo sozinho." }); return; }
    if (!podeGerirGrupo(req, thread, participacao?.role)) { res.status(403).json({ error: "Só quem criou o grupo (ou a Administração, nos grupos da casa) convida gente." }); return; }
    if (thread.status === "CLOSED") { res.status(400).json({ error: "O grupo está arquivado. Traga-o de volta antes de convidar." }); return; }
    const pedidos = textoIds(req.body?.userIds);
    if (!pedidos.length) { res.status(400).json({ error: "Escolha quem você quer convidar." }); return; }
    const validas = await pessoasValidas(orgId, pedidos);
    if (validas.length !== pedidos.length) { res.status(404).json({ error: "Alguma pessoa escolhida não foi encontrada ou não está ativa." }); return; }
    const atuais = await db.select({ userId: messageThreadParticipantsTable.userId }).from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, threadId));
    const jaEstao = new Set(atuais.map((row) => row.userId));
    const novos = validas.filter((pessoa) => !jaEstao.has(pessoa.id));
    if (!novos.length) { res.status(400).json({ error: "Essas pessoas já estão no grupo." }); return; }
    if (jaEstao.size + novos.length > MAX_INTEGRANTES) { res.status(400).json({ error: `Um grupo tem no máximo ${MAX_INTEGRANTES} pessoas.` }); return; }
    const feitoPor = await nomeDe(quem);
    await db.transaction(async (tx) => {
      await tx.insert(messageThreadParticipantsTable).values(novos.map((pessoa) => ({ threadId, userId: pessoa.id, role: "PARTICIPANT" as const }))).onConflictDoNothing();
      await writeHistoryEvent({ category: "MESSAGE", action: "message.group_member_added", title: "Pessoas adicionadas ao grupo", narrative: `${feitoPor} adicionou ${novos.length} pessoa(s) ao grupo “${thread.title}”.`, entityType: "message_thread", entityId: threadId, actorId: quem, actorName: feitoPor, orgId, metadata: { adicionados: novos.map((pessoa) => pessoa.id) } }, tx as any);
      await avisarDoGrupo(tx, novos.map((pessoa) => pessoa.id).filter((id) => id !== quem), `thread:${threadId}:entrou:${Date.now()}`, { threadId, titulo: thread.title, texto: `${feitoPor} adicionou você ao grupo “${thread.title}”.` });
    });
    res.status(201).json({ adicionados: novos.map((pessoa) => pessoa.id) });
  } catch (error) { console.error("[messages-grupos] members POST", error); res.status(500).json({ error: "Não consegui convidar agora." }); }
});

// Tirar alguém (quem gerencia) ou sair do próprio grupo (grupo de pessoa). Grupo da casa e da área não se deixa:
// o primeiro é da Administração, o segundo segue o cadastro.
router.delete("/messages/threads/:threadId/members/:userId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const threadId = String(req.params.threadId), alvoId = String(req.params.userId), quem = req.user!.sub;
    const carregado = await carregar(req, threadId);
    if (!carregado) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    const { thread, participacao } = carregado;
    if (thread.contextType === GRUPO_DA_AREA) { res.status(400).json({ error: "O grupo da área acompanha o cadastro: quem entra ou sai da área entra ou sai do grupo sozinho." }); return; }
    const saindo = alvoId === quem;
    if (saindo) {
      if (!participacao) { res.status(403).json({ error: "Você não está neste grupo." }); return; }
      if (thread.contextType !== GRUPO_DA_PESSOA) { res.status(403).json({ error: "Este grupo é da casa: quem organiza é a Administração. Você pode silenciar as mensagens." }); return; }
    } else if (!podeGerirGrupo(req, thread, participacao?.role)) {
      res.status(403).json({ error: "Só quem criou o grupo (ou a Administração, nos grupos da casa) tira gente." }); return;
    }
    const [alvo] = await db.select({ id: messageThreadParticipantsTable.id, role: messageThreadParticipantsTable.role }).from(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, threadId), eq(messageThreadParticipantsTable.userId, alvoId)));
    if (!alvo) { res.status(404).json({ error: "Essa pessoa não está no grupo." }); return; }
    const [feitoPor, nomeAlvo] = await Promise.all([nomeDe(quem), nomeDe(alvoId)]);
    await db.transaction(async (tx) => {
      await tx.delete(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.id, alvo.id));
      // Se a dona sai, o grupo passa para quem está há mais tempo nele — grupo sem dona não convida nem arquiva.
      let novaDona: string | null = null;
      if (alvo.role === "INITIATOR") {
        const [proxima] = await tx.select({ id: messageThreadParticipantsTable.id, userId: messageThreadParticipantsTable.userId }).from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, threadId)).orderBy(messageThreadParticipantsTable.joinedAt).limit(1);
        if (proxima) { await tx.update(messageThreadParticipantsTable).set({ role: "INITIATOR" }).where(eq(messageThreadParticipantsTable.id, proxima.id)); novaDona = proxima.userId; }
      }
      await writeHistoryEvent({ category: "MESSAGE", action: saindo ? "message.group_left" : "message.group_member_removed", title: saindo ? "Saiu do grupo" : "Pessoa tirada do grupo", narrative: saindo ? `${feitoPor} saiu do grupo “${thread.title}”.` : `${feitoPor} tirou ${nomeAlvo} do grupo “${thread.title}”.`, entityType: "message_thread", entityId: threadId, actorId: quem, actorName: feitoPor, orgId: thread.orgId ?? undefined, metadata: { pessoa: alvoId, ...(novaDona ? { novaDona } : {}) } }, tx as any);
      if (!saindo) await avisarDoGrupo(tx, [alvoId], `thread:${threadId}:saiu:${Date.now()}`, { threadId, titulo: thread.title, texto: `${feitoPor} tirou você do grupo “${thread.title}”.` });
    });
    res.json({ ok: true });
  } catch (error) { console.error("[messages-grupos] members DELETE", error); res.status(500).json({ error: "Não consegui fazer isso agora." }); }
});

// ─── Arquivar e trazer de volta ───────────────────────────────────────────────

// Arquivar é o grupo parar de receber mensagem (continua legível para quem está nele) e vai para o Registro com o
// motivo. Quem arquiva: o dono do grupo, ou a Administração/Direção (qualquer grupo, exceto o da área, que é automático).
router.post("/messages/threads/:threadId/arquivar", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const threadId = String(req.params.threadId), quem = req.user!.sub;
    const carregado = await carregar(req, threadId);
    if (!carregado) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    const { thread, participacao } = carregado;
    if (!TIPOS_DE_GRUPO.includes(thread.contextType ?? "") || thread.contextType === GRUPO_DA_AREA) { res.status(400).json({ error: "Só grupos criados por pessoas ou pela casa se arquivam. O grupo da área é automático." }); return; }
    const dono = thread.contextType === GRUPO_DA_PESSOA && participacao?.role === "INITIATOR";
    if (!dono && !isAdminOuDirecao(req)) { res.status(403).json({ error: "Só quem criou o grupo, a Administração ou a Direção arquivam." }); return; }
    if (thread.status === "CLOSED") { res.status(400).json({ error: "O grupo já está arquivado." }); return; }
    const motivo = requireReason(res, req.body?.reason, "arquivar um grupo"); if (!motivo) return;
    const feitoPor = await nomeDe(quem);
    const integrantes = await db.select({ userId: messageThreadParticipantsTable.userId }).from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, threadId));
    const [arquivado] = await db.transaction(async (tx) => {
      const [row] = await tx.update(messageThreadsTable).set({ status: "CLOSED", closedAt: new Date(), closedBy: quem, closedReason: normalizeReason(motivo) }).where(eq(messageThreadsTable.id, threadId)).returning();
      await writeHistoryEvent({ category: "MESSAGE", action: "message.group_archived", title: `Grupo arquivado: ${thread.title}`, narrative: `${feitoPor} arquivou o grupo “${thread.title}”.`, entityType: "message_thread", entityId: threadId, actorId: quem, actorName: feitoPor, orgId: thread.orgId ?? undefined, beforeState: { status: thread.status }, afterState: { status: "CLOSED" }, metadata: { reason: normalizeReason(motivo), integrantes: integrantes.length } }, tx as any);
      await avisarDoGrupo(tx, integrantes.map((row2) => row2.userId).filter((id) => id !== quem), `thread:${threadId}:arquivado:${Date.now()}`, { threadId, titulo: thread.title, texto: `O grupo “${thread.title}” foi arquivado por ${feitoPor}. Motivo: ${normalizeReason(motivo)}` });
      return [row!] as const;
    });
    res.json({ thread: arquivado });
  } catch (error) { console.error("[messages-grupos] arquivar", error); res.status(500).json({ error: "Não consegui arquivar agora." }); }
});

router.post("/messages/threads/:threadId/restaurar", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const threadId = String(req.params.threadId), quem = req.user!.sub;
    const carregado = await carregar(req, threadId);
    if (!carregado) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    const { thread, participacao } = carregado;
    if (thread.status !== "CLOSED" || !TIPOS_DE_GRUPO.includes(thread.contextType ?? "")) { res.status(400).json({ error: "Esse grupo não está arquivado." }); return; }
    const dono = thread.contextType === GRUPO_DA_PESSOA && participacao?.role === "INITIATOR" && (thread.closedBy === quem || thread.closedBy === null);
    if (!dono && !isAdminOuDirecao(req)) { res.status(403).json({ error: thread.contextType === GRUPO_DA_PESSOA && participacao?.role === "INITIATOR" ? "Quem arquivou foi a Administração ou a Direção; só elas trazem o grupo de volta." : "Só quem criou o grupo, a Administração ou a Direção traz de volta." }); return; }
    const feitoPor = await nomeDe(quem);
    const [restaurado] = await db.transaction(async (tx) => {
      const [row] = await tx.update(messageThreadsTable).set({ status: "OPEN", closedAt: null, closedBy: null, closedReason: null }).where(eq(messageThreadsTable.id, threadId)).returning();
      await writeHistoryEvent({ category: "MESSAGE", action: "message.group_restored", title: `Grupo trazido de volta: ${thread.title}`, narrative: `${feitoPor} trouxe de volta o grupo “${thread.title}”.`, entityType: "message_thread", entityId: threadId, actorId: quem, actorName: feitoPor, orgId: thread.orgId ?? undefined, beforeState: { status: "CLOSED" }, afterState: { status: "OPEN" } }, tx as any);
      return [row!] as const;
    });
    res.json({ thread: restaurado });
  } catch (error) { console.error("[messages-grupos] restaurar", error); res.status(500).json({ error: "Não consegui trazer de volta agora." }); }
});

export default router;
