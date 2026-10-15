import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, isNull, lte, gte, or, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  messageThreadsTable,
  messageThreadParticipantsTable,
  messagesTable,
  messageReactionsTable,
  usersTable,
  userRolesTable,
  delegationsTable,
  messageThreadPreferencesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { syncAreaGroupsFor } from "../services/area-groups.js";
import { DIRETA, FIGURINHAS, GRUPO_DA_CASA, GRUPO_DA_PESSOA, MAX_INTEGRANTES, MAX_TEXTO, REACOES, avisarDoGrupo, avisarNovaMensagem, marcarAvisosLidos } from "../services/mensagens.js";

type RoleValue = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN" | "DIRECTOR" | "DIR";

const router: IRouter = Router();

function isAdminOuDirecao(req: any) { return ["ADMIN", "ADM", "DIRECTOR", "DIR", "DIRECTION"].includes(String(req.user?.role ?? "").toUpperCase()); }

/** Quem gerencia o grupo (renomear, mexer em integrantes, arquivar): o dono de um grupo de pessoa; a Administração e a Direção, nos grupos da casa. */
export function podeGerirGrupo(req: any, thread: { contextType: string | null }, meuPapel: string | null | undefined) {
  // Grupo de uma pessoa é do dono: nem a Administração mexe nele (ela só vê que existe e pode arquivar, na lista de grupos).
  if (thread.contextType === GRUPO_DA_PESSOA) return meuPapel === "INITIATOR";
  if (thread.contextType === GRUPO_DA_CASA) return isAdminOuDirecao(req);
  return false;
}

async function getUserRole(userId: string): Promise<RoleValue | null> {
  const [row] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)))
    .limit(1);
  return (row?.role as RoleValue) ?? null;
}

// ─── T006: verifica se MEMBER tem delegação ativa com OPERATIONAL_MESSAGES ────

async function hasOperationalMessagesDelegation(userId: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .select({ responsibilities: delegationsTable.responsibilities })
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.delegateeId, userId),
        isNull(delegationsTable.revokedAt),
        lte(delegationsTable.validFrom, now),
        or(isNull(delegationsTable.validUntil), gte(delegationsTable.validUntil, now)),
      )
    );
  return rows.some((r) => (r.responsibilities as string[]).includes("OPERATIONAL_MESSAGES"));
}

const previa = (texto: string, limite = 80) => texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto;

// ─── GET /messages/recipients ─────────────────────────────────────────────────

router.get(
  "/messages/recipients",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;

      const senderRole = await getUserRole(userId);
      if (!senderRole) { res.status(403).json({ error: "Papel não encontrado" }); return; }

      // Conversa direta é uma exceção consciente à hierarquia operacional:
      // qualquer pessoa pode falar com qualquer colega da mesma organização.
      // Só nome e papel: o e-mail de ninguém sai para os colegas (como no diretório do Mural).
      const members = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          role: userRolesTable.role,
        })
        .from(userRolesTable)
        .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
        .where(
          and(
            eq(userRolesTable.active, true),
            eq(usersTable.organizationId, req.user!.organizationId),
          )
        );

      const seen = new Set<string>();
      const recipients = members.filter((m) => {
        if (m.id === userId) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      res.json({ recipients });
    } catch {
      res.status(500).json({ error: "Erro ao buscar destinatários" });
    }
  }
);

// ─── POST /messages/threads ───────────────────────────────────────────────────
// Uma pessoa só, sem pedir grupo: conversa direta — se já existe uma entre as duas, é ela que volta (antes cada
// "nova conversa" criava outra). Mais de uma pessoa, ou `grupo: true`: grupo criado por quem está criando, que
// passa a ser o dono (convida, tira, renomeia e arquiva).

router.post(
  "/messages/threads",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const orgId = req.user!.organizationId;
      const { title, participantIds: rawIds, contextType, contextId, contextTitle, grupo } = req.body as {
        title?: string; participantIds: string[]; contextType?: string; contextId?: string; contextTitle?: string; grupo?: boolean;
      };

      const participantIds = [...new Set(Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id !== userId) : [])];
      if (participantIds.length === 0) { res.status(400).json({ error: "Escolha com quem você quer conversar." }); return; }
      if (participantIds.length + 1 > MAX_INTEGRANTES) { res.status(400).json({ error: `Um grupo tem no máximo ${MAX_INTEGRANTES} pessoas.` }); return; }

      const senderRole = await getUserRole(userId);
      if (!senderRole) { res.status(403).json({ error: "Papel não encontrado" }); return; }

      const targets = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, participantIds), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
      if (targets.length !== participantIds.length) { res.status(403).json({ error: "Alguma pessoa escolhida está fora da organização ou inativa." }); return; }

      const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = sender?.name;
      const contextual = Boolean(contextType) && !["DIRECT", "GROUP"].includes(contextType!);
      const direta = !contextual && !grupo && participantIds.length === 1;
      const nomeDoGrupo = title?.trim() ?? "";
      if (!direta && !contextual && !nomeDoGrupo) { res.status(400).json({ error: "Dê um nome ao grupo." }); return; }
      if (nomeDoGrupo.length > 80) { res.status(400).json({ error: "O nome do grupo tem no máximo 80 letras." }); return; }
      if (contextual && !title?.trim()) { res.status(400).json({ error: "title é obrigatório" }); return; }

      const resultado = await db.transaction(async (tx) => {
        if (direta) {
          const outro = targets[0]!;
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`dm:${[userId, outro.id].sort().join(":")}`}))`);
          // Conversa direta é a de exatamente duas pessoas, abertas; a mais antiga leva o histórico.
          const candidatas = await tx.select({ threadId: messageThreadParticipantsTable.threadId }).from(messageThreadParticipantsTable)
            .innerJoin(messageThreadsTable, eq(messageThreadParticipantsTable.threadId, messageThreadsTable.id))
            .where(and(eq(messageThreadsTable.orgId, orgId), eq(messageThreadsTable.contextType, DIRETA), eq(messageThreadsTable.status, "OPEN"), inArray(messageThreadParticipantsTable.userId, [userId, outro.id])))
            .groupBy(messageThreadParticipantsTable.threadId, messageThreadsTable.createdAt).having(sql`count(*) = 2`).orderBy(messageThreadsTable.createdAt);
          for (const { threadId } of candidatas) {
            const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, threadId)) as [{ total: number }];
            if (total === 2) { const [existente] = await tx.select().from(messageThreadsTable).where(eq(messageThreadsTable.id, threadId)); return { thread: existente!, existente: true }; }
          }
        }
        const [created] = await tx.insert(messageThreadsTable).values({
          orgId, title: direta ? (title?.trim() || targets[0]!.name) : (nomeDoGrupo || title!.trim()),
          contextType: contextual ? contextType! : direta ? DIRETA : GRUPO_DA_PESSOA, contextId, contextTitle, createdBy: userId, status: "OPEN",
        }).returning();
        await tx.insert(messageThreadParticipantsTable).values([
          { threadId: created!.id, userId, role: "INITIATOR" as const },
          ...participantIds.map((pid) => ({ threadId: created!.id, userId: pid, role: "PARTICIPANT" as const })),
        ]);
        await writeHistoryEvent({
          category: "MESSAGE", action: "thread_created",
          title: direta ? "Conversa criada" : `Conversa criada: ${created!.title}`,
          narrative: direta ? `${senderName ?? userId} iniciou uma conversa.` : `${senderName ?? userId} criou ${contextual ? "uma conversa" : "o grupo"} com ${participantIds.length} pessoa(s)${contextTitle ? ` sobre "${contextTitle}"` : ""}.`,
          entityType: "message_thread", entityId: created!.id, actorId: userId, actorName: senderName, orgId,
          afterState: { status: created!.status, participantIds }, metadata: { contextType: created!.contextType, participantCount: participantIds.length },
        }, tx as any);
        if (!direta) await avisarDoGrupo(tx, participantIds, `thread:${created!.id}:criado`, { threadId: created!.id, titulo: created!.title, texto: `${senderName ?? "Alguém"} adicionou você ao grupo “${created!.title}”.` });
        return { thread: created!, existente: false };
      });

      res.status(resultado.existente ? 200 : 201).json({ thread: resultado.thread, existente: resultado.existente });
    } catch {
      res.status(500).json({ error: "Erro ao criar conversa" });
    }
  }
);

// ─── GET /messages/threads ────────────────────────────────────────────────────

router.get(
  "/messages/threads",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      // Grupos automáticos da área (desenho 23). Se falhar, as conversas abrem do mesmo jeito.
      await syncAreaGroupsFor(userId, req.user!.organizationId).catch((error) => console.error("[messages] grupo da área", error));

      const participations = await db
        .select({
          threadId: messageThreadParticipantsTable.threadId,
          lastReadAt: messageThreadParticipantsTable.lastReadAt,
          role: messageThreadParticipantsTable.role,
        })
        .from(messageThreadParticipantsTable)
        .where(eq(messageThreadParticipantsTable.userId, userId));

      if (participations.length === 0) { res.json({ threads: [] }); return; }

      const threadIds = participations.map((p) => p.threadId);
      const roleMap = new Map(participations.map((p) => [p.threadId, p.role]));

      const threads = await db
        .select()
        .from(messageThreadsTable)
        .where(inArray(messageThreadsTable.id, threadIds))
        .orderBy(desc(messageThreadsTable.createdAt));

      // Fetch unread counts for all threads in a single query
      const unreadRows = await db
        .select({
          threadId: messagesTable.threadId,
          count: sql<number>`count(*)::int`,
        })
        .from(messagesTable)
        .innerJoin(
          messageThreadParticipantsTable,
          and(
            eq(messageThreadParticipantsTable.threadId, messagesTable.threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        )
        .where(
          and(
            inArray(messagesTable.threadId, threadIds),
            or(
              isNull(messageThreadParticipantsTable.lastReadAt),
              gt(messagesTable.createdAt, messageThreadParticipantsTable.lastReadAt),
            )
          )
        )
        .groupBy(messagesTable.threadId);
      const unreadMap = new Map(unreadRows.map((u) => [u.threadId, u.count]));

      // Última mensagem, integrantes e preferências de todas as conversas de uma vez (antes eram três consultas por conversa).
      const ultimas = await db.select({ threadId: messagesTable.threadId, id: messagesTable.id, content: messagesTable.content, kind: messagesTable.kind, senderName: messagesTable.senderName, createdAt: messagesTable.createdAt })
        .from(messagesTable)
        .where(and(inArray(messagesTable.threadId, threadIds), sql`${messagesTable.createdAt} = (select max(m2.created_at) from messages m2 where m2.thread_id = ${messagesTable.threadId})`));
      const ultimaPorConversa = new Map<string, typeof ultimas[number]>();
      for (const row of ultimas) if (row.threadId && !ultimaPorConversa.has(row.threadId)) ultimaPorConversa.set(row.threadId, row);
      const integrantes = await db.select({ threadId: messageThreadParticipantsTable.threadId, userId: messageThreadParticipantsTable.userId, name: usersTable.name, role: messageThreadParticipantsTable.role })
        .from(messageThreadParticipantsTable).innerJoin(usersTable, eq(messageThreadParticipantsTable.userId, usersTable.id))
        .where(inArray(messageThreadParticipantsTable.threadId, threadIds));
      const integrantesPorConversa = new Map<string, { userId: string; name: string; role: string }[]>();
      for (const row of integrantes) integrantesPorConversa.set(row.threadId, [...(integrantesPorConversa.get(row.threadId) ?? []), { userId: row.userId, name: row.name, role: row.role }]);
      const preferencias = await db.select({ threadId: messageThreadPreferencesTable.threadId, pinned: messageThreadPreferencesTable.pinned, muted: messageThreadPreferencesTable.muted })
        .from(messageThreadPreferencesTable).where(and(eq(messageThreadPreferencesTable.userId, userId), inArray(messageThreadPreferencesTable.threadId, threadIds)));
      const preferenciaPorConversa = new Map(preferencias.map((row) => [row.threadId, row]));

      const enriched = threads.map((t) => {
        const participants = integrantesPorConversa.get(t.id) ?? [];
        const ultima = ultimaPorConversa.get(t.id);
        // Conversa direta: o título é sempre o nome da OUTRA pessoa (antes era o nome que quem criou digitou, e a outra via o próprio nome).
        const outra = t.contextType === DIRETA && participants.length === 2 ? participants.find((p) => p.userId !== userId) : undefined;
        return {
          ...t,
          title: outra?.name ?? t.title,
          myRole: roleMap.get(t.id),
          lastMessage: ultima ? { id: ultima.id, content: ultima.kind === "STICKER" ? "Figurinha" : ultima.content, senderName: ultima.senderName, createdAt: ultima.createdAt } : null,
          participants,
          unreadCount: unreadMap.get(t.id) ?? 0,
          pinned: preferenciaPorConversa.get(t.id)?.pinned ?? false,
          muted: preferenciaPorConversa.get(t.id)?.muted ?? false,
          podeGerir: podeGerirGrupo(req, t, roleMap.get(t.id)),
        };
      });

      res.json({ threads: enriched });
    } catch {
      res.status(500).json({ error: "Erro ao listar conversas" });
    }
  }
);

// ─── GET /messages/threads/:threadId ─────────────────────────────────────────
// `?semLer=1` é a tela se atualizando sozinha: traz as mensagens sem marcar "visto". Só abrir a conversa (ou
// um PATCH /read, quando a aba está à vista) marca. Assim "visto" nunca mente por causa de uma aba esquecida aberta.

router.get(
  "/messages/threads/:threadId",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);
      const semLer = req.query.semLer === "1";

      const [participation] = await db
        .select()
        .from(messageThreadParticipantsTable)
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      if (!participation) { res.status(403).json({ error: "Sem acesso a esta conversa" }); return; }

      const [thread] = await db
        .select()
        .from(messageThreadsTable)
        .where(eq(messageThreadsTable.id, threadId));

      if (!thread) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

      const rows = await db
        .select({
          id: messagesTable.id,
          content: messagesTable.content,
          kind: messagesTable.kind,
          senderId: messagesTable.senderId,
          senderName: messagesTable.senderName,
          createdAt: messagesTable.createdAt,
          quotedMessageId: messagesTable.quotedMessageId,
        })
        .from(messagesTable)
        .where(eq(messagesTable.threadId, threadId))
        .orderBy(messagesTable.createdAt);

      const integrantes = await db
        .select({
          userId: messageThreadParticipantsTable.userId,
          name: usersTable.name,
          role: messageThreadParticipantsTable.role,
          lastReadAt: messageThreadParticipantsTable.lastReadAt,
        })
        .from(messageThreadParticipantsTable)
        .innerJoin(usersTable, eq(messageThreadParticipantsTable.userId, usersTable.id))
        .where(eq(messageThreadParticipantsTable.threadId, threadId));

      // Reações por mensagem, com os nomes (grupo de até 200 pessoas cabe).
      const reacoes = rows.length ? await db.select({ messageId: messageReactionsTable.messageId, userId: messageReactionsTable.userId, emoji: messageReactionsTable.emoji, name: usersTable.name })
        .from(messageReactionsTable).innerJoin(usersTable, eq(messageReactionsTable.userId, usersTable.id))
        .where(inArray(messageReactionsTable.messageId, rows.map((row) => row.id))).orderBy(messageReactionsTable.createdAt) : [];
      const reacoesPorMensagem = new Map<string, typeof reacoes>();
      for (const reacao of reacoes) reacoesPorMensagem.set(reacao.messageId, [...(reacoesPorMensagem.get(reacao.messageId) ?? []), reacao]);

      const messages = rows.map((row) => {
        const dela = reacoesPorMensagem.get(row.id) ?? [];
        const porEmoji = new Map<string, string[]>();
        for (const reacao of dela) porEmoji.set(reacao.emoji, [...(porEmoji.get(reacao.emoji) ?? []), reacao.name]);
        return {
          ...row,
          reacoes: [...porEmoji].map(([emoji, pessoas]) => ({ emoji, count: pessoas.length, pessoas })).sort((a, b) => b.count - a.count),
          minhaReacao: dela.find((reacao) => reacao.userId === userId)?.emoji ?? null,
          // "Visto por": só quem enviou vê quem já viu a própria mensagem.
          ...(row.senderId === userId ? { vistoPor: integrantes.filter((p) => p.userId !== userId && p.lastReadAt && p.lastReadAt >= row.createdAt).map((p) => p.name) } : {}),
        };
      });

      if (!semLer) {
        await db.update(messageThreadParticipantsTable).set({ lastReadAt: new Date() })
          .where(and(eq(messageThreadParticipantsTable.threadId, threadId), eq(messageThreadParticipantsTable.userId, userId)));
        await marcarAvisosLidos(db, userId, threadId);
      }

      // O horário em que cada pessoa leu não é de ninguém além dela: aos outros só chega "visto por" nas próprias mensagens.
      const participants = integrantes.map(({ lastReadAt, ...p }) => (p.userId === userId ? { ...p, lastReadAt } : p));
      res.json({ thread: { ...thread, podeGerir: podeGerirGrupo(req, thread, participation.role), souDono: participation.role === "INITIATOR" }, messages, participants });
    } catch {
      res.status(500).json({ error: "Erro ao buscar conversa" });
    }
  }
);

// ─── POST /messages/threads/:threadId/messages ────────────────────────────────

router.post(
  "/messages/threads/:threadId/messages",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);
      const { content, quotedMessageId, kind: rawKind } = req.body as { content: string; quotedMessageId?: string | null; kind?: string };
      const kind = rawKind === "STICKER" ? "STICKER" : "TEXT";
      const texto = typeof content === "string" ? content.trim() : "";

      if (!texto) { res.status(400).json({ error: "Escreva a mensagem." }); return; }
      if (texto.length > MAX_TEXTO) { res.status(400).json({ error: `A mensagem tem no máximo ${MAX_TEXTO} letras.` }); return; }
      if (kind === "STICKER" && !FIGURINHAS.includes(texto)) { res.status(400).json({ error: "Figurinha desconhecida." }); return; }

      const [participation] = await db
        .select()
        .from(messageThreadParticipantsTable)
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );

      if (!participation) { res.status(403).json({ error: "Sem acesso a esta conversa" }); return; }

      const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = sender?.name;

      const result = await db.transaction(async (tx) => {
        const [thread] = await tx.select({ status: messageThreadsTable.status, title: messageThreadsTable.title, contextType: messageThreadsTable.contextType })
          .from(messageThreadsTable).where(eq(messageThreadsTable.id, threadId)).for("update");
        if (!thread) return { status: "not_found" as const };
        if (thread.status === "CLOSED") return { status: "closed" as const };
        // Citar só vale para mensagem desta mesma conversa.
        if (quotedMessageId) {
          const [citada] = await tx.select({ id: messagesTable.id }).from(messagesTable).where(and(eq(messagesTable.id, quotedMessageId), eq(messagesTable.threadId, threadId)));
          if (!citada) return { status: "bad_quote" as const };
        }
        const [created] = await tx.insert(messagesTable).values({
          threadId,
          senderId: userId,
          senderName: senderName ?? null,
          content: texto,
          kind,
          quotedMessageId: quotedMessageId ?? null,
        }).returning();
        // O Registro guarda que houve mensagem, de quem e onde — nunca o texto: a Administração lê o Registro e não lê conversa de ninguém.
        await writeHistoryEvent({ category: "MESSAGE", action: "message_sent", title: "Mensagem enviada", narrative: `${senderName ?? "Alguém"} enviou ${kind === "STICKER" ? "uma figurinha" : "uma mensagem"}.`, entityType: "message", entityId: created!.id, actorId: userId, actorName: senderName, orgId: req.user!.organizationId, afterState: { id: created!.id, threadId, kind } }, tx as any);
        await tx.update(messageThreadParticipantsTable).set({ lastReadAt: new Date() })
          .where(and(eq(messageThreadParticipantsTable.threadId, threadId), eq(messageThreadParticipantsTable.userId, userId)));
        // Quem silenciou a conversa não recebe aviso de mensagem nova (desenho 23).
        const integrantes = await tx.select({ userId: messageThreadParticipantsTable.userId }).from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, threadId));
        const silenciados = new Set((await tx.select({ userId: messageThreadPreferencesTable.userId }).from(messageThreadPreferencesTable)
          .where(and(eq(messageThreadPreferencesTable.threadId, threadId), eq(messageThreadPreferencesTable.muted, true)))).map((row) => row.userId));
        const grupo = thread.contextType !== DIRETA;
        const resumo = kind === "STICKER" ? "enviou uma figurinha" : previa(texto);
        await avisarNovaMensagem(tx, {
          threadId, messageId: created!.id,
          titulo: grupo ? thread.title : (senderName ?? "Nova mensagem"),
          texto: grupo ? `${senderName ?? "Alguém"}: ${resumo}` : resumo,
          destinatarios: integrantes.map((p) => p.userId).filter((uid) => uid !== userId && !silenciados.has(uid)),
        });
        return { status: "created" as const, message: created! };
      });

      if (result.status === "not_found") { res.status(404).json({ error: "Conversa não encontrada" }); return; }
      if (result.status === "closed") { res.status(400).json({ error: "Esta conversa está encerrada" }); return; }
      if (result.status === "bad_quote") { res.status(400).json({ error: "A mensagem citada não é desta conversa." }); return; }

      res.status(201).json({ message: { ...result.message, reacoes: [], minhaReacao: null, vistoPor: [] } });
    } catch {
      res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
);

// ─── POST /messages/threads/:threadId/messages/:messageId/react ──────────────
// Uma reação por pessoa em cada mensagem; `reaction` nula tira. Não entra no Registro (seria ruído).
router.post("/messages/threads/:threadId/messages/:messageId/react", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub, threadId = String(req.params.threadId), messageId = String(req.params.messageId);
    const raw = req.body?.reaction;
    const tirar = raw === null || raw === "";
    const emoji = tirar ? null : String(raw ?? "").trim();
    if (!tirar && (!emoji || !REACOES.includes(emoji))) { res.status(400).json({ error: `Reação inválida. Use uma destas: ${REACOES.join(" ")}` }); return; }
    const [participant] = await db.select({ id: messageThreadParticipantsTable.id }).from(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, threadId), eq(messageThreadParticipantsTable.userId, userId)));
    if (!participant) { res.status(403).json({ error: "Sem acesso a esta conversa" }); return; }
    const [mensagem] = await db.select({ id: messagesTable.id }).from(messagesTable).where(and(eq(messagesTable.id, messageId), eq(messagesTable.threadId, threadId)));
    if (!mensagem) { res.status(404).json({ error: "Mensagem não encontrada" }); return; }
    if (emoji === null) await db.delete(messageReactionsTable).where(and(eq(messageReactionsTable.messageId, messageId), eq(messageReactionsTable.userId, userId)));
    else await db.insert(messageReactionsTable).values({ messageId, userId, emoji }).onConflictDoUpdate({ target: [messageReactionsTable.messageId, messageReactionsTable.userId], set: { emoji, createdAt: new Date() } });
    res.json({ ok: true, minhaReacao: emoji });
  } catch { res.status(500).json({ error: "Não consegui reagir agora" }); }
});

// ─── PATCH /messages/threads/:threadId/preferences ───────────────────────────
// Preferências privadas do participante: fixar e silenciar não alteram a conversa dos demais.
// (Claude, 06/10: a rota estava colada dentro do POST de mensagem e só existia depois de um envio.)
router.patch("/messages/threads/:threadId/preferences", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.sub, threadId = String(req.params.threadId);
    const [participant] = await db.select({ id: messageThreadParticipantsTable.id }).from(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, threadId), eq(messageThreadParticipantsTable.userId, userId)));
    if (!participant) { res.status(403).json({ error: "Sem acesso a esta conversa" }); return; }
    const pinned = req.body.pinned === undefined ? undefined : Boolean(req.body.pinned);
    const muted = req.body.muted === undefined ? undefined : Boolean(req.body.muted);
    const [preference] = await db.insert(messageThreadPreferencesTable).values({ threadId, userId, pinned: pinned ?? false, muted: muted ?? false }).onConflictDoUpdate({ target: [messageThreadPreferencesTable.threadId, messageThreadPreferencesTable.userId], set: { ...(pinned === undefined ? {} : { pinned }), ...(muted === undefined ? {} : { muted }), updatedAt: new Date() } }).returning();
    res.json({ preference });
  } catch { res.status(500).json({ error: "Erro ao atualizar preferências da conversa" }); }
});

// ─── PATCH /messages/threads/:threadId/read ───────────────────────────────────

router.patch(
  "/messages/threads/:threadId/read",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);

      await db
        .update(messageThreadParticipantsTable)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipantsTable.threadId, threadId),
            eq(messageThreadParticipantsTable.userId, userId),
          )
        );
      await marcarAvisosLidos(db, userId, threadId);

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erro ao marcar como lido" });
    }
  }
);

// ─── PATCH /messages/threads/:threadId/close ─────────────────────────────────
// Encerrar conversa de contexto (pedido, entrega…). Grupos se arquivam em /messages/threads/:id/arquivar.

router.patch(
  "/messages/threads/:threadId/close",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const threadId = String(req.params.threadId);

      const senderRole = await getUserRole(userId);
      if (!senderRole) { res.status(403).json({ error: "Papel não encontrado" }); return; }
      if (senderRole === "MEMBER") {
        const isCapitao = await hasOperationalMessagesDelegation(userId);
        if (!isCapitao) {
          res.status(403).json({ error: "Apenas Admin, Supervisor ou Capitão delegado pode encerrar conversas" });
          return;
        }
      }

      const [thread] = await db
        .select()
        .from(messageThreadsTable)
        .where(eq(messageThreadsTable.id, threadId));

      if (!thread) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
      if (thread.status === "CLOSED") { res.status(400).json({ error: "Conversa já encerrada" }); return; }

      const senderRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const senderName = senderRow[0]?.name;
      const updated = await db.transaction(async (tx) => {
        const [persisted] = await tx
          .update(messageThreadsTable)
          .set({ status: "CLOSED", closedAt: new Date(), closedBy: userId })
          .where(eq(messageThreadsTable.id, threadId))
          .returning();
        await writeHistoryEvent({
          category: "MESSAGE",
          action: "thread_closed",
          title: `Conversa encerrada: ${thread.title}`,
          narrative: `${senderName ?? userId} encerrou a conversa.`,
          entityType: "message_thread",
          entityId: threadId,
          actorId: userId,
          actorName: senderName,
          orgId: thread.orgId ?? undefined,
          beforeState: { status: thread.status },
          afterState: { status: persisted!.status },
        }, tx as any);
        return persisted!;
      });

      res.json({ thread: updated });
    } catch {
      res.status(500).json({ error: "Erro ao encerrar conversa" });
    }
  }
);

export default router;
