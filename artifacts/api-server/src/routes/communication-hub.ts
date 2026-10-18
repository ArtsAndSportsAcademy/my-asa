import { Router, type IRouter } from "express";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, gte, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db, announcementCommentsTable, announcementReadsTable, announcementRecipientsTable, announcementsTable, areasTable, locationsTable, muralDatasEspeciaisTable, notificationOutboxTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { normalizeReason, requireReason } from "../lib/reason.js";
import { canReadAnnouncement } from "../services/announcement-access.js";
import { confirmAnnouncementRead } from "../services/announcement-confirmation.js";
import { listCommunicationPeople } from "../services/communication-directory.js";
import { announcementAudience, announcementAudienceIds } from "../services/announcement-audience.js";
import { aniversariosDaCasa } from "../services/aniversarios.js";
import { MAX_DESTINATARIOS, resolverDestinos, type Alvo } from "../services/mural-destinos.js";
import { janelaDoMural, proximasDatas } from "../services/mural-janela.js";
import type { CreateNotificationInput } from "../services/notificationService.js";
import { validarUuid } from "../lib/uuid.js";

const router: IRouter = Router();
type Scope = "HOUSE" | "AREA" | "LOCATION" | "PEOPLE";
/** NOTICE: aviso oficial da gestão. POST: publicação de qualquer pessoa. RECOGNITION: reconhecimento. */
type Kind = "NOTICE" | "RECOGNITION" | "POST";
const KINDS: Kind[] = ["NOTICE", "RECOGNITION", "POST"];
/** Reações do Mural e das Mensagens. Uma por pessoa por publicação. */
const REACOES = ["❤️", "👏", "🎉", "😂", "🙏", "🎂"];
/** O "♥" já existia (a ASA também o grava) e o site antigo ainda o manda durante um deploy: continua valendo. */
const REACOES_ACEITAS = [...REACOES, "♥"];
/** Quem derruba uma publicação tem esta janela para a notificação de remoção sair — é a mesma de 10 s do "desfazer" da casa. */
const JANELA_DESFAZER_MS = 10_000;

function role(req: any) { return String(req.user?.role ?? "MEMBER").toUpperCase(); }
function isAdmin(req: any) { return ["ADMIN", "ADM"].includes(role(req)); }
function isDirection(req: any) { return ["DIRECTOR", "DIR", "DIRECTION"].includes(role(req)); }
function isSupervisor(req: any) { return role(req).startsWith("SUPERVISOR") || role(req) === "SUP"; }
/** Aviso oficial é da gestão. Direção age como a Administração no Mural (decisão de 14/10/2026). */
const MAX_TEXTO_MURAL = 5000, MAX_TITULO_MURAL = 120, MAX_COMENTARIO_MURAL = 1000;
function isGestao(req: any) { return isAdmin(req) || isDirection(req) || isSupervisor(req); }
function isAdminOuDirecao(req: any) { return isAdmin(req) || isDirection(req); }

async function ownArea(userId: string) {
  const [row] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.areaId ?? null;
}

/**
 * Quem gerencia a publicação (remover, ver quem falta): Administração, Direção, quem publicou e a
 * Supervisão da área da publicação. Publicação da casa, de um local ou de pessoas escolhidas não
 * pertence a nenhuma área — quem não tem área (`myArea` nulo) nunca pode ser tratado como "da mesma
 * área" que ela.
 */
function managesPost(req: any, post: { authorId: string; areaId: string | null }, myArea: string | null) {
  return isAdmin(req) || isDirection(req) || post.authorId === req.user.sub
    || (isSupervisor(req) && myArea !== null && post.areaId !== null && post.areaId === myArea);
}

/** Editar: quem publicou; no aviso oficial, também a Administração e a Direção. */
function podeEditar(req: any, post: { type: string; authorId: string }) {
  return KINDS.includes(post.type as Kind) && (post.authorId === req.user.sub || (post.type === "NOTICE" && isAdminOuDirecao(req)));
}

/**
 * Um aviso no sino por pessoa e por acontecimento. Entra na mesma transação de quem publica (se a
 * publicação falhar, ninguém é avisado de nada) e a chave impede repetir se o pedido for refeito.
 */
async function avisarNoSino(tx: any, userIds: string[], chave: string, build: (userId: string) => CreateNotificationInput, dueAt = new Date()) {
  const unicos = [...new Set(userIds)];
  for (let i = 0; i < unicos.length; i += 500) {
    await tx.insert(notificationOutboxTable)
      .values(unicos.slice(i, i + 500).map(userId => ({ userId, payload: build(userId), dueAt, deduplicationKey: `${chave}:${userId}` })))
      .onConflictDoNothing();
  }
}

const resumo = (texto: string, limite = 100) => texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto;
const noMural = (extra: Pick<CreateNotificationInput, "type" | "title" | "message" | "priority" | "entityId">): Omit<CreateNotificationInput, "userId"> =>
  ({ category: "notice", entityType: "announcement", actionUrl: "/mural", ...extra });

async function nomeDe(userId: string) {
  const [row] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return row?.name ?? "Alguém";
}

/** Início do dia de hoje em São Paulo (UTC−3, sem horário de verão). */
function startOfTodaySaoPaulo(now = new Date()) {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${ymd}T00:00:00-03:00`);
}

// Desenho 22: aniversário vira um cartão no feed, com "Parabéns". Só para quem escolheu
// "mural no meu dia" (28 Perfil). Um cartão por pessoa por dia; a criação entra no Registro.
async function ensureBirthdayPosts(orgId: string) {
  const { hoje } = await aniversariosDaCasa(orgId);
  if (!hoje.length) return;
  const since = startOfTodaySaoPaulo();
  for (const person of hoje) {
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`birthday:${person.id}:${since.toISOString()}`}))`);
      const [existing] = await tx.select({ id: announcementsTable.id }).from(announcementsTable)
        .where(and(eq(announcementsTable.orgId, orgId), eq(announcementsTable.type, "BIRTHDAY"), eq(announcementsTable.recipientId, person.id), gte(announcementsTable.publishedAt, since))).limit(1);
      if (existing) return;
      const [created] = await tx.insert(announcementsTable).values({ orgId, authorId: person.id, recipientId: person.id, type: "BIRTHDAY", scope: "HOUSE", body: `Hoje é aniversário de ${person.nome}!` }).returning();
      await writeHistoryEvent({ category: "NOTICE", action: "mural.birthday_created", title: "Aniversário no Mural", narrative: `Hoje é aniversário de ${person.nome}.`, entityType: "announcement", entityId: created!.id, orgId, afterState: { id: created!.id, recipientId: person.id } }, tx as any);
    });
  }
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

router.get("/communication/mural", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId!, me = req.user!.sub;
    // Se o cartão de aniversário falhar, o Mural abre do mesmo jeito.
    await ensureBirthdayPosts(orgId).catch(error => console.error("[communication] aniversário no Mural", error));
    const todayStart = startOfTodaySaoPaulo();
    // Só o mês atual e o seguinte. Entram também: publicação com data de evento nesta janela e aviso que
    // pede ciente (o que já passou da janela só fica para quem ainda não deu ciente, filtrado abaixo).
    const janela = janelaDoMural();
    const rows = await db.select({
      id: announcementsTable.id, type: announcementsTable.type, scope: announcementsTable.scope, title: announcementsTable.title, body: announcementsTable.body,
      reason: announcementsTable.reason, requiresConfirmation: announcementsTable.requiresConfirmation, eventDate: announcementsTable.eventDate, recipientId: announcementsTable.recipientId, publishedAt: announcementsTable.publishedAt,
      editedAt: announcementsTable.editedAt, destinationLabel: announcementsTable.destinationLabel,
      areaId: announcementsTable.areaId, locationId: announcementsTable.locationId, authorId: announcementsTable.authorId, authorName: usersTable.name, areaName: areasTable.name, locationName: locationsTable.name,
    }).from(announcementsTable).innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
      .leftJoin(areasTable, eq(announcementsTable.areaId, areasTable.id)).leftJoin(locationsTable, eq(announcementsTable.locationId, locationsTable.id))
      .where(and(
        eq(announcementsTable.orgId, orgId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt),
        or(
          gte(announcementsTable.publishedAt, janela.inicio),
          and(isNotNull(announcementsTable.eventDate), gte(announcementsTable.eventDate, janela.inicioYmd)),
          // Aviso antigo só entra se ainda pede o MEU ciente; os que já confirmei saem com o mês.
          sql`(${announcementsTable.requiresConfirmation} and not exists (select 1 from announcement_reads r where r.announcement_id = ${announcementsTable.id} and r.user_id = ${me} and r.confirmed_at is not null))`,
        ),
      )).orderBy(desc(announcementsTable.publishedAt));
    const readable: typeof rows = [];
    for (const post of rows) {
      // Cartão de aniversário vale só no dia. Evento para depois do mês que vem ainda não aparece.
      if (post.type === "BIRTHDAY" && post.publishedAt < todayStart) continue;
      if (post.eventDate && post.eventDate >= janela.fimYmd) continue;
      if (await canReadAnnouncement({ userId: me, organizationId: orgId, role: req.user!.role }, post)) readable.push(post);
    }
    const mine = readable.length ? await db.select().from(announcementReadsTable).where(and(inArray(announcementReadsTable.announcementId, readable.map(post => post.id)), eq(announcementReadsTable.userId, me))) : [];
    const reads = new Map(mine.map(read => [read.announcementId, read]));
    const naJanela = (post: typeof rows[number]) => post.publishedAt >= janela.inicio || Boolean(post.eventDate && post.eventDate >= janela.inicioYmd);
    // Aviso antigo que pede ciente só continua para quem ainda precisa dar (não para quem gerencia nem para quem publicou).
    const visible = readable.filter(post => naJanela(post) || (post.requiresConfirmation && !isAdminOuDirecao(req) && post.authorId !== me && !reads.get(post.id)?.confirmedAt));
    const ids = visible.map(post => post.id);
    const comments = ids.length ? await db.select({ announcementId: announcementCommentsTable.announcementId, count: sql<number>`count(*)::int` }).from(announcementCommentsTable).where(and(inArray(announcementCommentsTable.announcementId, ids), eq(announcementCommentsTable.active, true))).groupBy(announcementCommentsTable.announcementId) : [];
    const commentCounts = new Map(comments.map(comment => [comment.announcementId, comment.count]));
    // Reações por emoji (no aniversário, o 🎂 é o "Parabéns").
    const reactionRows = ids.length ? await db.select({ announcementId: announcementReadsTable.announcementId, emoji: announcementReadsTable.reaction, count: sql<number>`count(*)::int` }).from(announcementReadsTable).where(and(inArray(announcementReadsTable.announcementId, ids), isNotNull(announcementReadsTable.reaction))).groupBy(announcementReadsTable.announcementId, announcementReadsTable.reaction) : [];
    const reactionsByPost = new Map<string, { emoji: string; count: number }[]>();
    for (const row of reactionRows) reactionsByPost.set(row.announcementId, [...(reactionsByPost.get(row.announcementId) ?? []), { emoji: row.emoji!, count: row.count }]);
    for (const list of reactionsByPost.values()) list.sort((a, b) => b.count - a.count);
    // A tela só oferece "remover" a quem o servidor deixaria remover (mesma regra da rota).
    const myArea = isSupervisor(req) ? await ownArea(me) : null;
    const canRemove = (post: typeof rows[number]) => (post.type === "NOTICE" || post.type === "RECOGNITION" || post.type === "POST") && managesPost(req, post, myArea);
    // Para quem foi: aviso para pessoas escolhidas e reconhecimento mostram os nomes (nomes de uso, sem contato).
    const namedIds = visible.filter(post => post.scope === "PEOPLE" || post.type === "RECOGNITION").map(post => post.id);
    const recipientRows = namedIds.length ? await db.select({ announcementId: announcementRecipientsTable.announcementId, name: usersTable.name }).from(announcementRecipientsTable).innerJoin(usersTable, eq(announcementRecipientsTable.userId, usersTable.id)).where(inArray(announcementRecipientsTable.announcementId, namedIds)).orderBy(usersTable.name) : [];
    const recipientNames = new Map<string, string[]>();
    for (const row of recipientRows) recipientNames.set(row.announcementId, [...(recipientNames.get(row.announcementId) ?? []), row.name]);
    // Desenho 22: quem gerencia o aviso vê "X de Y deram ciente" (a lista de quem falta vem em /cientes).
    const ackSummaries = new Map<string, { total: number; confirmados: number }>();
    for (const post of visible.filter(item => item.requiresConfirmation && canRemove(item)).slice(0, 20)) {
      const summary = await announcementAudience({ ...post, orgId });
      ackSummaries.set(post.id, { total: summary.total, confirmados: summary.confirmados });
    }
    const datas = await db.select({ id: muralDatasEspeciaisTable.id, nome: muralDatasEspeciaisTable.nome, mensagem: muralDatasEspeciaisTable.mensagem, mes: muralDatasEspeciaisTable.mes, dia: muralDatasEspeciaisTable.dia })
      .from(muralDatasEspeciaisTable).where(and(eq(muralDatasEspeciaisTable.orgId, orgId), eq(muralDatasEspeciaisTable.active, true)));
    res.json({
      posts: visible.map(post => {
        const { authorId, ...rest } = post;
        const reactions = reactionsByPost.get(post.id) ?? [];
        return {
          ...rest,
          ...(namedIds.includes(post.id) ? { recipientNames: recipientNames.get(post.id) ?? [] } : {}),
          ...(ackSummaries.has(post.id) ? { ackSummary: ackSummaries.get(post.id) } : {}),
          canCancel: canRemove(post), canEdit: podeEditar(req, post), ehMeu: authorId === me,
          mine: reads.get(post.id) ?? null, commentCount: commentCounts.get(post.id) ?? 0,
          reactions, reactionCount: reactions.reduce((total, item) => total + item.count, 0),
        };
      }),
      datasEspeciais: proximasDatas(datas),
      podeGerirDatas: isAdminOuDirecao(req),
      podeAvisar: isGestao(req),
    });
  } catch (error) { console.error("[communication] GET mural", error); res.status(500).json({ error: "Não consegui carregar o Mural" }); }
});

// Quem já deu ciente e quem falta (desenho 22). Só para quem gerencia o aviso — a mesma regra de remover.
router.get("/communication/mural/:id/cientes", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const [post] = await db.select().from(announcementsTable).where(and(eq(announcementsTable.id, String(req.params.id)), eq(announcementsTable.orgId, req.user!.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt))).limit(1);
    if (!post || post.type !== "NOTICE" || !post.requiresConfirmation) { res.status(404).json({ error: "Aviso com ciente não encontrado" }); return; }
    const manages = managesPost(req, post, isSupervisor(req) ? await ownArea(req.user!.sub) : null);
    if (!manages) { res.status(403).json({ error: "Só quem gerencia o aviso vê quem falta" }); return; }
    res.json(await announcementAudience(post));
  } catch (error) { console.error("[communication] GET cientes", error); res.status(500).json({ error: "Não consegui contar os cientes" }); }
});

router.get("/communication/people", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    // The product explicitly permits recognition and direct messaging between any
    // two colleagues. This endpoint deliberately contains only the directory data
    // needed to choose a recipient: display name and area, never contact details.
    const people = await listCommunicationPeople(req.user!.organizationId!);
    res.json({ people });
  } catch { res.status(500).json({ error: "Não consegui listar as pessoas" }); }
});

// Destinos possíveis de uma publicação (só nome): toda área ativa e todo local aberto da organização.
// Qualquer pessoa publica para o destino que quiser (o Mural é de todos; a Administração derruba o que não valer).
router.get("/communication/destinations", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const [areas, locations] = await Promise.all([
      db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(eq(areasTable.organizationId, orgId), eq(areasTable.active, true))).orderBy(areasTable.name),
      db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(eq(locationsTable.organizationId, orgId), eq(locationsTable.closed, false))).orderBy(locationsTable.name),
    ]);
    res.json({ areas, locations });
  } catch { res.status(500).json({ error: "Não consegui listar os destinos" }); }
});

// ─── Publicar ─────────────────────────────────────────────────────────────────

router.post("/communication/mural", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const { type = "NOTICE", scope = "HOUSE", areaId = null, locationId = null, recipientId = null, recipientIds: rawRecipientIds = [], destinos = null, eventDate: rawEventDate = null, title = null, body, reason = null, requiresConfirmation = false } = req.body as { eventDate?: unknown; type?: Kind; scope?: Scope; areaId?: string | null; locationId?: string | null; recipientId?: string | null; recipientIds?: unknown; destinos?: Record<string, unknown> | null; title?: string | null; body?: string; reason?: string | null; requiresConfirmation?: boolean };
    const orgId = req.user!.organizationId!, authorId = req.user!.sub;
    if (!body?.trim()) { res.status(400).json({ error: "Escreva a publicação" }); return; }
    if (typeof body !== "string" || body.length > MAX_TEXTO_MURAL) { res.status(400).json({ error: `A publicação tem no máximo ${MAX_TEXTO_MURAL} letras.` }); return; }
    if (typeof title === "string" && title.trim().length > MAX_TITULO_MURAL) { res.status(400).json({ error: `O título tem no máximo ${MAX_TITULO_MURAL} letras.` }); return; }
    if (!KINDS.includes(type) || !["HOUSE", "AREA", "LOCATION", "PEOPLE"].includes(scope)) { res.status(400).json({ error: "Publicação inválida" }); return; }
    // Aviso oficial é da gestão. Qualquer pessoa publica (POST) e reconhece.
    if (type === "NOTICE" && !isGestao(req)) { res.status(403).json({ error: "Aviso oficial é da Administração, da Direção e da Supervisão. Para falar com a casa, use Publicar." }); return; }
    // Data do evento (0057, desenho 22): opcional, em aviso e publicação, no formato AAAA-MM-DD.
    const eventDate = type !== "RECOGNITION" && typeof rawEventDate === "string" && rawEventDate.trim() ? rawEventDate.trim() : null;
    if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(`${eventDate}T12:00:00Z`)))) { res.status(400).json({ error: "Data do evento inválida" }); return; }
    if (type === "RECOGNITION") { const required = requireReason(res, reason, "publicar um reconhecimento"); if (!required) return; }

    // Para quem vai. Forma nova: `destinos` (casa, áreas, locais e pessoas, misturados). Forma antiga: scope + ids.
    let alvo: Alvo;
    if (destinos && typeof destinos === "object") {
      const resolvido = await resolverDestinos({ orgId, autorId: authorId, destinos, permitirCasa: type !== "RECOGNITION", expandir: type === "RECOGNITION" });
      if (!resolvido.ok) { res.status(resolvido.status).json({ error: resolvido.error }); return; }
      alvo = resolvido.alvo;
    } else if (type === "RECOGNITION") {
      if (scope === "PEOPLE") { res.status(400).json({ error: "Só aviso vai para pessoas escolhidas" }); return; }
      if (!recipientId) { res.status(400).json({ error: "Escolha quem você quer reconhecer" }); return; }
      alvo = { scope: "HOUSE", areaId: null, locationId: null, pessoaIds: [recipientId], label: null };
    } else {
      // Pessoas escolhidas (02/10): todas precisam ser desta organização e estar ativas.
      const recipientIds = scope === "PEOPLE" ? [...new Set(Array.isArray(rawRecipientIds) ? rawRecipientIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [])] : [];
      if (scope === "AREA" && !areaId || scope === "LOCATION" && !locationId) { res.status(400).json({ error: "Complete o destino da publicação" }); return; }
      if (scope === "PEOPLE") {
        if (!recipientIds.length) { res.status(400).json({ error: "Escolha pelo menos uma pessoa" }); return; }
        if (recipientIds.length > MAX_DESTINATARIOS) { res.status(400).json({ error: `Escolha no máximo ${MAX_DESTINATARIOS} pessoas. Para mais gente, mande para uma área ou para toda a casa.` }); return; }
        const found = await db.select({ id: usersTable.id }).from(usersTable).where(and(inArray(usersTable.id, recipientIds), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")));
        if (found.length !== recipientIds.length) { res.status(404).json({ error: "Alguma pessoa escolhida não foi encontrada ou não está ativa" }); return; }
      }
      // O destino precisa ser desta organização.
      if (scope === "AREA") { const [found] = await db.select({ id: areasTable.id }).from(areasTable).where(and(eq(areasTable.id, areaId!), eq(areasTable.organizationId, orgId))).limit(1); if (!found) { res.status(404).json({ error: "Área não encontrada" }); return; } }
      if (scope === "LOCATION") { const [found] = await db.select({ id: locationsTable.id }).from(locationsTable).where(and(eq(locationsTable.id, locationId!), eq(locationsTable.organizationId, orgId))).limit(1); if (!found) { res.status(404).json({ error: "Local não encontrado" }); return; } }
      alvo = { scope, areaId: scope === "AREA" ? areaId : null, locationId: scope === "LOCATION" ? locationId : null, pessoaIds: recipientIds, label: null };
    }
    if (type === "RECOGNITION") {
      // O reconhecimento é visto por todos; as pessoas reconhecidas ficam só na lista de "para quem".
      // Reconhecimento é para os colegas (decisão de 19/10/2026): quem publica não entra na lista. Se sobrar
      // gente (reconhecer uma área em que a própria pessoa está), segue para os outros; se só sobrar a própria pessoa, recusa.
      const colegas = alvo.pessoaIds.filter(id => id !== authorId);
      if (!colegas.length) { res.status(400).json({ error: "Reconhecimento é para os colegas. Escolha outra pessoa." }); return; }
      alvo = { ...alvo, scope: "HOUSE", areaId: null, locationId: null, pessoaIds: colegas };
      const [recipient] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, alvo.pessoaIds[0] ?? ""), eq(usersTable.organizationId, orgId))).limit(1);
      if (!recipient) { res.status(404).json({ error: "Pessoa não encontrada" }); return; }
    }

    // Quem precisa ficar sabendo (sem quem publicou). Aviso oficial: o público dele, pela mesma regra que decide quem lê.
    // Publicação: só quem foi marcado ou o público de uma área/local — a casa inteira não recebe push de publicação.
    // Reconhecimento: as pessoas reconhecidas.
    const doPublico = () => alvo.scope === "PEOPLE" ? alvo.pessoaIds.filter(id => id !== authorId) : announcementAudienceIds({ id: "", orgId, authorId, scope: alvo.scope, areaId: alvo.areaId, locationId: alvo.locationId });
    const quemSabe = type === "RECOGNITION" ? alvo.pessoaIds.filter(id => id !== authorId)
      : type === "POST" && alvo.scope === "HOUSE" ? []
      : await doPublico();
    const autor = type !== "NOTICE" && quemSabe.length ? await nomeDe(authorId) : "";
    const [post] = await db.transaction(async tx => {
      const [created] = await tx.insert(announcementsTable).values({ orgId, authorId, type, scope: alvo.scope, areaId: alvo.areaId, locationId: alvo.locationId, recipientId: type === "RECOGNITION" ? alvo.pessoaIds[0]! : recipientId, title: title?.trim() || null, body: body.trim(), reason: type === "RECOGNITION" ? normalizeReason(reason) : null, requiresConfirmation: type === "NOTICE" && Boolean(requiresConfirmation), eventDate, destinationLabel: alvo.label }).returning();
      const guardarPessoas = alvo.scope === "PEOPLE" || type === "RECOGNITION";
      if (guardarPessoas && alvo.pessoaIds.length) await tx.insert(announcementRecipientsTable).values(alvo.pessoaIds.map(userId => ({ announcementId: created!.id, userId })));
      await writeHistoryEvent({
        category: "NOTICE",
        action: type === "RECOGNITION" ? "mural.recognition_created" : type === "POST" ? "mural.post_created" : "mural.notice_created",
        title: type === "RECOGNITION" ? "Reconhecimento publicado" : type === "POST" ? "Publicação no Mural" : "Aviso publicado",
        narrative: created!.title ?? created!.body.slice(0, 120), entityType: "announcement", entityId: created!.id, actorId: authorId, orgId, afterState: created,
        metadata: { reason: created!.reason, avisados: quemSabe.length, ...(guardarPessoas && alvo.pessoaIds.length ? { recipientIds: alvo.pessoaIds } : {}), ...(alvo.label ? { destino: alvo.label } : {}) },
      }, tx as any);
      const assunto = resumo(created!.title ?? created!.body);
      await avisarNoSino(tx, quemSabe, `mural:${created!.id}:publicado`, userId => ({
        userId, entityId: created!.id,
        ...(type === "RECOGNITION"
          ? noMural({ type: "notice.recognition", title: "Reconhecimento no Mural", message: `${autor} publicou um reconhecimento para você: ${resumo(created!.reason ?? created!.body)}`, priority: "NORMAL" })
          : type === "POST"
            ? noMural({ type: "notice.post", title: "Nova publicação no Mural", message: `${autor}: ${assunto}`, priority: "NORMAL" })
            : created!.requiresConfirmation
              // "notice.requires_ack" é o tipo que também sai como push; o aviso que pede ciente não pode passar batido.
              ? noMural({ type: "notice.requires_ack", title: "Aviso que pede ciente", message: assunto, priority: "IMPORTANT" })
              : noMural({ type: "notice.published", title: "Novo aviso no Mural", message: assunto, priority: "NORMAL" })),
      }));
      return [created] as const;
    });
    res.status(201).json({ post });
  } catch (error) { console.error("[communication] POST mural", error); res.status(500).json({ error: "Não consegui publicar agora" }); }
});

async function loadAccessiblePost(req: any, id: string) {
  if (!validarUuid(id)) return null;
  const [post] = await db.select().from(announcementsTable).where(and(eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt))).limit(1);
  return post && await canReadAnnouncement({ userId: req.user.sub, organizationId: req.user.organizationId, role: req.user.role }, post) ? post : null;
}

// ─── Editar ───────────────────────────────────────────────────────────────────

// Quem publicou edita o que publicou; Administração e Direção também editam o aviso oficial. O cartão passa a
// mostrar "editado". No aviso que pede ciente, quem edita escolhe se o ciente de todo mundo vale de novo, e se
// o sino avisa da mudança — por padrão a edição é silenciosa (corrigir uma vírgula não acorda ninguém).
router.patch("/communication/mural/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id), orgId = req.user!.organizationId!, quem = req.user!.sub;
    const { title, body, eventDate: rawEventDate, reason, pedirCienteDeNovo, avisar } = (req.body ?? {}) as { title?: unknown; body?: unknown; eventDate?: unknown; reason?: unknown; pedirCienteDeNovo?: unknown; avisar?: unknown };
    const post = await loadAccessiblePost(req, id);
    if (!post || !KINDS.includes(post.type as Kind)) { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    if (!podeEditar(req, post)) { res.status(403).json({ error: "Só quem publicou pode editar. A Administração e a Direção também editam o aviso oficial." }); return; }
    const mudanca: Partial<typeof announcementsTable.$inferInsert> = {};
    if (body !== undefined) {
      const texto = typeof body === "string" ? body.trim() : "";
      if (!texto) { res.status(400).json({ error: "O texto não pode ficar vazio" }); return; }
      if (texto.length > MAX_TEXTO_MURAL) { res.status(400).json({ error: `A publicação tem no máximo ${MAX_TEXTO_MURAL} letras.` }); return; }
      if (texto !== post.body) mudanca.body = texto;
    }
    if (title !== undefined && post.type !== "RECOGNITION") {
      const novo = typeof title === "string" ? title.trim() || null : null;
      if (novo !== post.title) mudanca.title = novo;
    }
    if (rawEventDate !== undefined && post.type !== "RECOGNITION") {
      const novo = typeof rawEventDate === "string" && rawEventDate.trim() ? rawEventDate.trim() : null;
      if (novo && (!/^\d{4}-\d{2}-\d{2}$/.test(novo) || Number.isNaN(Date.parse(`${novo}T12:00:00Z`)))) { res.status(400).json({ error: "Data do evento inválida" }); return; }
      if (novo !== post.eventDate) mudanca.eventDate = novo;
    }
    if (reason !== undefined && post.type === "RECOGNITION") {
      const novo = normalizeReason(reason);
      if (!novo) { res.status(400).json({ error: "O motivo do reconhecimento não pode ficar vazio" }); return; }
      if (novo !== post.reason) mudanca.reason = novo;
    }
    if (!Object.keys(mudanca).length) { res.status(400).json({ error: "Nada mudou" }); return; }
    const pedir = post.type === "NOTICE" && post.requiresConfirmation && pedirCienteDeNovo === true;
    const avisarDaMudanca = post.type === "NOTICE" && (avisar === true || pedir);
    // O público do aviso e, quando foi outra pessoa que editou, quem o publicou; quem editou já sabe.
    const quemSabe = avisarDaMudanca ? [...await announcementAudienceIds({ ...post, orgId }), post.authorId].filter(userId => userId !== quem) : [];
    const agora = new Date();
    const [updated] = await db.transaction(async tx => {
      const [row] = await tx.update(announcementsTable).set({ ...mudanca, editedAt: agora, updatedAt: agora })
        .where(and(eq(announcementsTable.id, id), isNull(announcementsTable.cancelledAt))).returning();
      if (!row) throw new Error("A publicação foi removida enquanto você editava");
      if (pedir) await tx.update(announcementReadsTable).set({ confirmedAt: null }).where(eq(announcementReadsTable.announcementId, id));
      await writeHistoryEvent({ category: "NOTICE", action: "mural.edited", title: post.type === "NOTICE" ? "Aviso editado" : post.type === "POST" ? "Publicação editada" : "Reconhecimento editado", narrative: row.title ?? row.body.slice(0, 120), entityType: "announcement", entityId: id, actorId: quem, orgId, beforeState: post, afterState: row, metadata: { campos: Object.keys(mudanca), pedirCienteDeNovo: pedir, avisados: quemSabe.length } }, tx as any);
      await avisarNoSino(tx, quemSabe, `mural:${id}:editado:${agora.getTime()}`, userId => ({
        userId, entityId: id,
        ...(pedir
          ? noMural({ type: "notice.requires_ack", title: "Aviso mudou: confirme de novo", message: resumo(row.title ?? row.body), priority: "IMPORTANT" })
          : noMural({ type: "notice.updated", title: "Aviso atualizado", message: resumo(row.title ?? row.body), priority: "NORMAL" })),
      }));
      return [row] as const;
    });
    res.json({ post: updated });
  } catch (error) { console.error("[communication] PATCH mural", error); res.status(500).json({ error: "Não consegui salvar a edição agora" }); }
});

// ─── Ciente, reação, comentário ───────────────────────────────────────────────

router.post("/communication/mural/:id/ack", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const result = await db.transaction(async tx => {
      const confirmation = await confirmAnnouncementRead({ userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, String(req.params.id), tx);
      if (confirmation.status !== "confirmed") return confirmation;
      await writeHistoryEvent({ category: "NOTICE", action: "mural.acknowledged", title: "Ciente registrado", narrative: confirmation.post.title ?? confirmation.post.body.slice(0, 120), entityType: "announcement", entityId: confirmation.post.id, actorId: req.user!.sub, orgId: req.user!.organizationId, afterState: confirmation.read }, tx as any);
      return confirmation;
    });
    if (result.status === "unavailable") { res.status(404).json({ error: "Aviso não encontrado" }); return; }
    if (result.status === "stale") { res.status(409).json({ error: "O aviso mudou. Abra-o novamente antes de confirmar." }); return; }
    res.json({ read: result.read });
  } catch { res.status(500).json({ error: "Não consegui confirmar agora" }); }
});

// Uma reação por pessoa em cada publicação. `reaction` nula tira a reação. Reagir não entra no Registro
// (decisão de 14/10/2026: seria ruído; o que importa fica nos avisos e nas publicações).
router.post("/communication/mural/:id/react", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const raw = req.body?.reaction;
    const tirar = raw === null || raw === "";
    const reaction = tirar ? null : String(raw ?? "").trim();
    if (!tirar && (!reaction || !REACOES_ACEITAS.includes(reaction))) { res.status(400).json({ error: `Reação inválida. Use uma destas: ${REACOES.join(" ")}` }); return; }
    const result = await db.transaction(async tx => {
      const [post] = await tx.select().from(announcementsTable).where(and(
        eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user!.organizationId),
        eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt),
      )).for("update").limit(1);
      if (!post || !(await canReadAnnouncement(
        { userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, post, tx,
      ))) return { status: "unavailable" as const };
      const now = new Date();
      const [read] = await tx.insert(announcementReadsTable).values({
        announcementId: post.id, userId: req.user!.sub, readAt: now, reaction, reactedAt: reaction ? now : null,
      }).onConflictDoUpdate({
        target: [announcementReadsTable.announcementId, announcementReadsTable.userId],
        set: { readAt: now, reaction, reactedAt: reaction ? now : null },
      }).returning();
      return { status: "saved" as const, read };
    });
    if (result.status === "unavailable") { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    res.json({ read: result.read });
  } catch { res.status(500).json({ error: "Não consegui reagir agora" }); }
});

// Quem reagiu com o quê (só nomes), para quem pode ler a publicação.
router.get("/communication/mural/:id/reacoes", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const post = await loadAccessiblePost(req, String(req.params.id));
    if (!post) { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    const rows = await db.select({ emoji: announcementReadsTable.reaction, name: usersTable.name }).from(announcementReadsTable)
      .innerJoin(usersTable, eq(announcementReadsTable.userId, usersTable.id))
      .where(and(eq(announcementReadsTable.announcementId, post.id), isNotNull(announcementReadsTable.reaction)))
      .orderBy(announcementReadsTable.reactedAt);
    const porEmoji = new Map<string, string[]>();
    for (const row of rows) porEmoji.set(row.emoji!, [...(porEmoji.get(row.emoji!) ?? []), row.name]);
    res.json({ reacoes: [...porEmoji].map(([emoji, pessoas]) => ({ emoji, pessoas })).sort((a, b) => b.pessoas.length - a.pessoas.length) });
  } catch { res.status(500).json({ error: "Não consegui ver quem reagiu" }); }
});

router.post("/communication/mural/:id/comments", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const body = String(req.body?.body ?? "").trim();
    if (!body) { res.status(400).json({ error: "Escreva um comentário" }); return; }
    if (body.length > MAX_COMENTARIO_MURAL) { res.status(400).json({ error: `O comentário tem no máximo ${MAX_COMENTARIO_MURAL} letras.` }); return; }
    const result = await db.transaction(async tx => {
      const [post] = await tx.select().from(announcementsTable).where(and(
        eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user!.organizationId),
        eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt),
      )).for("update").limit(1);
      if (!post || !(await canReadAnnouncement(
        { userId: req.user!.sub, organizationId: req.user!.organizationId!, role: req.user!.role }, post, tx,
      ))) return { status: "unavailable" as const };
      const [comment] = await tx.insert(announcementCommentsTable).values({
        announcementId: post.id, authorId: req.user!.sub, body,
      }).returning();
      if (!comment) throw new Error("Não foi possível publicar o comentário");
      const [author] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.sub)).limit(1);
      await writeHistoryEvent({
        category: "NOTICE", action: "mural.comment_created", title: "Comentário no Mural",
        narrative: body.slice(0, 120), entityType: "announcement_comment", entityId: comment.id,
        actorId: req.user!.sub, orgId: req.user!.organizationId, afterState: comment,
      }, tx as any);
      return { status: "created" as const, comment: { ...comment, authorName: author?.name ?? "" } };
    });
    if (result.status === "unavailable") { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    res.status(201).json({ comment: result.comment });
  } catch { res.status(500).json({ error: "Não consegui comentar agora" }); }
});

// Comments are loaded only after the parent post has passed the same server-side
// audience check as the feed. A count alone is not enough: the thread needs to be
// readable in the product as well.
router.get("/communication/mural/:id/comments", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const post = await loadAccessiblePost(req, String(req.params.id));
    if (!post) { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    const comments = await db.select({ id: announcementCommentsTable.id, body: announcementCommentsTable.body, createdAt: announcementCommentsTable.createdAt, authorName: usersTable.name })
      .from(announcementCommentsTable).innerJoin(usersTable, eq(announcementCommentsTable.authorId, usersTable.id))
      .where(and(eq(announcementCommentsTable.announcementId, post.id), eq(announcementCommentsTable.active, true)))
      .orderBy(announcementCommentsTable.createdAt);
    res.json({ comments });
  } catch { res.status(500).json({ error: "Não consegui carregar os comentários" }); }
});

// ─── Remover e trazer de volta ────────────────────────────────────────────────

// Remover é lógico (cancelledAt + motivo + quem removeu) e sempre pode voltar. Vale para aviso, publicação e
// reconhecimento; aniversário não se remove. Quem pode: a mesma regra de gerenciar (quem publicou, a
// Administração, a Direção e a Supervisão da área). A notificação de quem precisa saber só sai depois da janela
// de 10 s do "desfazer", e some se a pessoa desfizer.
router.post("/communication/mural/:id/cancel", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const reason = requireReason(res, req.body?.reason, "remover uma publicação do Mural");
    if (!reason) return;
    const [post] = await db.select().from(announcementsTable)
      .where(and(eq(announcementsTable.id, id), eq(announcementsTable.orgId, req.user!.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt))).limit(1);
    if (!post || !KINDS.includes(post.type as Kind)) { res.status(404).json({ error: "Publicação não encontrada" }); return; }
    const allowed = managesPost(req, post, isSupervisor(req) ? await ownArea(req.user!.sub) : null);
    if (!allowed) { res.status(403).json({ error: "Só a Administração, a Direção, quem publicou ou a Supervisão da área pode remover" }); return; }
    const orgId = req.user!.organizationId!, quem = req.user!.sub;
    const motivo = normalizeReason(reason)!;
    // Aviso oficial e publicação para um público: quem recebeu precisa saber que não vale mais. Reconhecimento: as pessoas
    // reconhecidas não precisam (o reconhecimento some do Mural sem alarde). Em todos, o autor sabe quando foi outra pessoa.
    const publico = post.type === "RECOGNITION" || (post.type === "POST" && post.scope === "HOUSE") ? [] : await announcementAudienceIds({ ...post, orgId });
    const quemSabe = [...publico, post.authorId].filter(userId => userId !== quem);
    const removedor = quemSabe.length ? await nomeDe(quem) : "";
    const agora = new Date();
    const [cancelled] = await db.transaction(async tx => {
      const [updated] = await tx.update(announcementsTable).set({ cancelledAt: agora, cancellationReason: motivo, removedBy: quem, updatedAt: agora })
        .where(and(eq(announcementsTable.id, id), isNull(announcementsTable.cancelledAt))).returning();
      if (!updated) throw new Error("Já foi removida");
      await writeHistoryEvent({ category: "NOTICE", action: "mural.notice_cancelled", title: post.type === "NOTICE" ? "Aviso cancelado" : post.type === "POST" ? "Publicação removida" : "Reconhecimento removido", narrative: updated.title ?? updated.body.slice(0, 120), entityType: "announcement", entityId: id, actorId: quem, orgId, beforeState: post, afterState: updated, metadata: { reason: motivo, avisados: new Set(quemSabe).size } }, tx as any);
      await avisarNoSino(tx, quemSabe, `mural:${id}:cancelado:${agora.getTime()}`, userId => ({
        userId, entityId: id,
        ...noMural({
          type: "notice.cancelled", title: post.type === "NOTICE" ? "Aviso cancelado" : "Publicação removida",
          message: `“${resumo(updated.title ?? updated.body, 70)}” foi ${post.type === "NOTICE" ? "cancelado" : "removida"}${userId === post.authorId && quem !== post.authorId ? ` por ${removedor}` : ""}. Motivo: ${resumo(motivo, 120)}`,
          priority: updated.requiresConfirmation ? "IMPORTANT" : "NORMAL",
        }),
      }), new Date(agora.getTime() + JANELA_DESFAZER_MS));
      return [updated] as const;
    });
    res.json({ post: cancelled });
  } catch (error) { console.error("[communication] POST mural cancel", error); res.status(500).json({ error: "Não consegui remover agora" }); }
});

// Traz de volta o que foi removido. A Administração e a Direção restauram qualquer uma; quem publicou restaura
// só o que ele mesmo removeu (não desfaz a decisão da Administração).
router.post("/communication/mural/:id/restore", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id), orgId = req.user!.organizationId!, quem = req.user!.sub;
    const [post] = await db.select().from(announcementsTable)
      .where(and(eq(announcementsTable.id, id), eq(announcementsTable.orgId, orgId), eq(announcementsTable.active, true), isNotNull(announcementsTable.cancelledAt))).limit(1);
    if (!post || !KINDS.includes(post.type as Kind)) { res.status(404).json({ error: "Essa publicação não está removida" }); return; }
    const podeVoltar = isAdminOuDirecao(req) || (post.authorId === quem && (post.removedBy === quem || post.removedBy === null));
    if (!podeVoltar) { res.status(403).json({ error: post.authorId === quem ? "Quem removeu foi a Administração ou a Direção; só elas trazem de volta." : "Só a Administração, a Direção ou quem publicou traz de volta." }); return; }
    const agora = new Date();
    const [restored] = await db.transaction(async tx => {
      const [updated] = await tx.update(announcementsTable).set({ cancelledAt: null, cancellationReason: null, removedBy: null, updatedAt: agora })
        .where(and(eq(announcementsTable.id, id), isNotNull(announcementsTable.cancelledAt))).returning();
      if (!updated) throw new Error("Já tinha voltado");
      // Quem ainda não tinha sido avisado da remoção não será mais; quem já foi avisado recebe o "voltou".
      await tx.update(notificationOutboxTable).set({ status: "cancelled" })
        .where(and(like(notificationOutboxTable.deduplicationKey, `mural:${id}:cancelado:%`), eq(notificationOutboxTable.status, "pending")));
      const jaAvisados = await tx.select({ userId: notificationOutboxTable.userId }).from(notificationOutboxTable)
        .where(and(like(notificationOutboxTable.deduplicationKey, `mural:${id}:cancelado:%`), eq(notificationOutboxTable.status, "delivered")));
      await writeHistoryEvent({ category: "NOTICE", action: "mural.restored", title: "Publicação restaurada", narrative: updated.title ?? updated.body.slice(0, 120), entityType: "announcement", entityId: id, actorId: quem, orgId, beforeState: post, afterState: updated, metadata: { avisados: jaAvisados.length } }, tx as any);
      await avisarNoSino(tx, jaAvisados.map(row => row.userId).filter(userId => userId !== quem), `mural:${id}:restaurado:${agora.getTime()}`, userId => ({
        userId, entityId: id, ...noMural({ type: "notice.restored", title: "Voltou ao Mural", message: `“${resumo(updated.title ?? updated.body, 70)}” voltou ao Mural.`, priority: "NORMAL" }),
      }));
      return [updated] as const;
    });
    res.json({ post: restored });
  } catch (error) { console.error("[communication] POST mural restore", error); res.status(500).json({ error: "Não consegui trazer de volta agora" }); }
});

// O que foi removido nos últimos 60 dias: a Administração e a Direção veem tudo; as demais pessoas, só o que elas
// mesmas publicaram (com quem removeu e o motivo). É de onde se traz de volta.
router.get("/communication/mural/removidos", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId!, me = req.user!.sub;
    const desde = new Date(Date.now() - 60 * 86_400_000);
    const removedor = alias(usersTable, "removedor");
    const rows = await db.select({
      id: announcementsTable.id, type: announcementsTable.type, title: announcementsTable.title, body: announcementsTable.body, cancelledAt: announcementsTable.cancelledAt,
      motivo: announcementsTable.cancellationReason, authorId: announcementsTable.authorId, removedBy: announcementsTable.removedBy, authorName: usersTable.name, removidoPor: removedor.name,
    }).from(announcementsTable).innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id)).leftJoin(removedor, eq(announcementsTable.removedBy, removedor.id))
      .where(and(eq(announcementsTable.orgId, orgId), eq(announcementsTable.active, true), isNotNull(announcementsTable.cancelledAt), gte(announcementsTable.cancelledAt, desde), inArray(announcementsTable.type, KINDS), ...(isAdminOuDirecao(req) ? [] : [eq(announcementsTable.authorId, me)])))
      .orderBy(desc(announcementsTable.cancelledAt)).limit(100);
    res.json({ removidos: rows.map(({ authorId, removedBy, ...row }) => ({ ...row, canRestore: isAdminOuDirecao(req) || (authorId === me && (removedBy === me || removedBy === null)) })) });
  } catch (error) { console.error("[communication] GET removidos", error); res.status(500).json({ error: "Não consegui listar o que foi removido" }); }
});

export default router;
