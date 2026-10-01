/**
 * 15 Escalas — Escala do dia (uma por local e dia) e Programação (molde do local).
 *
 * Quem faz o quê (07-o-que-falta.md, "15 Escalas — decisões"):
 * - Supervisão marca a parte da área dela como pronta, só dentro da área dela;
 * - Administração publica o dia, manualmente (publicação automática adiada — decisão 6);
 * - Direção lê; Elenco vê só a própria escala, e só depois de publicada.
 * Toda escrita entra no Registro na mesma transação.
 */
import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  db,
  dailyBooksTable,
  historyEventsTable,
  escalaAreasProntasTable,
  escalaBlocoAjustesTable,
  escalaConfirmacoesTable,
  locationsTable,
  programacaoBlocosTable,
  programacoesTable,
  REGRAS_BLOCO,
  scalesTable,
  showBooksTable,
  usersTable,
  type RegraBloco,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { convocacaoPorPessoa, escalaPublicada, findEscalaDoDia, montarEscalaDoDia, operationForLocation, pessoasAfetadas } from "../services/escala-dia.js";
import { enqueueNotification } from "../services/undo.js";
import { APP_ROUTES } from "../lib/app-routes.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataPorExtenso = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m! - 1]}`; };
import { generateDailyBookDraftForScale } from "./daily-book.js";

const router: IRouter = Router();
const SUPERVISOR = ["SUPERVISOR_A", "SUPERVISOR_B"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
type Actor = { sub: string; role: string; organizationId: string };

async function supervisedAreas(actor: Actor, locationId: string) {
  const rows = await db.select({ areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable).where(and(
    eq(areaLocalSupervisorsTable.supervisorId, actor.sub), eq(areaLocalSupervisorsTable.locationId, locationId), eq(areaLocalSupervisorsTable.active, true),
  ));
  return rows.map((r) => r.areaId);
}
/** Vê a grade inteira do local: Administração e Direção em qualquer local;
 * Supervisão apenas no local no qual responde por alguma área. */
async function canReadLocal(actor: Actor, locationId: string) {
  if (actor.role === "ADMIN" || actor.role === "DIR") return true;
  if (!SUPERVISOR.includes(actor.role)) return false;
  return (await supervisedAreas(actor, locationId)).length > 0;
}
/** Edita a Programação do local: Administração, ou Supervisão de alguma área do local. */
async function canManageLocal(actor: Actor, locationId: string) {
  if (actor.role === "ADMIN") return true;
  return SUPERVISOR.includes(actor.role) && (await supervisedAreas(actor, locationId)).length > 0;
}
async function locationInOrg(locationId: string, organizationId: string) {
  const [row] = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId))).limit(1);
  return row ?? null;
}
const dateParam = (value: unknown) => typeof value === "string" && DATE.test(value) ? value : operationalDate();
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

router.get("/escalas/locais", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const all = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable)
    .where(and(eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false))).orderBy(asc(locationsTable.name));
  const visible = [];
  for (const location of all) if (await canReadLocal(actor, location.id)) visible.push({ ...location, podeEditar: await canManageLocal(actor, location.id), areasSupervisionadas: await supervisedAreas(actor, location.id) });
  res.json({ locais: visible });
});

router.get("/escalas/dia", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  const date = dateParam(req.query.date);
  if (!locationId || !(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "Local não encontrado" }); return; }
  if (!(await canReadLocal(actor, locationId))) { res.status(403).json({ error: "Forbidden", message: "A escala deste local não está no seu acesso" }); return; }
  try {
    const dia = await montarEscalaDoDia(actor.organizationId, locationId, date);
    res.json({ dia, areasSupervisionadas: await supervisedAreas(actor, locationId), podePublicar: actor.role === "ADMIN" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao montar a Escala do dia" });
  }
});

/** Minha escala: só os blocos da própria pessoa, e só de escala publicada. */
router.get("/escalas/minha", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const date = dateParam(req.query.date);
  try {
    const locations = await db.select({ id: locationsTable.id }).from(locationsTable).where(and(
      eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false),
    ));
    const escalas = [];
    for (const location of locations) {
      const dia = await montarEscalaDoDia(actor.organizationId, location.id, date);
      if (!dia || !escalaPublicada(dia.escala?.status)) continue;
      const blocos = dia.blocos.filter((b) => b.pessoaIds.includes(actor.sub)).map(({ pessoaIds: _p, ...b }) => b);
      const me = dia.pessoas.find((p) => p.id === actor.sub) ?? null;
      if (!blocos.length && !me?.folga) continue;
      const [confirmacao] = await db.select().from(escalaConfirmacoesTable).where(and(
        eq(escalaConfirmacoesTable.scaleId, dia.escala!.id), eq(escalaConfirmacoesTable.userId, actor.sub),
      )).limit(1);
      escalas.push({
        location: dia.location, publishedAt: dia.escala!.publishedAt ?? null, folga: me?.folga ?? null,
        escalaId: dia.escala!.id, escalaVersion: dia.escala!.version,
        confirmada: confirmacao?.version === dia.escala!.version, confirmedAt: confirmacao?.confirmedAt ?? null, blocos,
      });
    }
    // `escalas` é o contrato completo: uma pessoa pode trabalhar em mais de
    // um local no mesmo dia. Os campos abaixo mantêm o cliente anterior
    // funcional enquanto ele passa a renderizar a lista completa.
    const primary = escalas[0];
    res.json({
      date, publicada: escalas.length > 0, escalas,
      location: primary?.location ?? null, publishedAt: primary?.publishedAt ?? null,
      folga: primary?.folga ?? null, escalaId: primary?.escalaId ?? null,
      escalaVersion: primary?.escalaVersion ?? null, confirmada: primary?.confirmada ?? false,
      confirmedAt: primary?.confirmedAt ?? null,
      blocos: primary?.blocos ?? [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao montar a sua escala" });
  }
});

/**
 * Prepara o dia, sem convocar ninguém ainda: a Escala nasce em rascunho e cada
 * Show referenciado pela Programação cria o seu Livro do Dia também em rascunho.
 * A Programação fornece horário e Show; posições e elenco continuam vindo do
 * Livro do Show, nunca de nomes digitados na grade.
 */
router.post("/escalas/dia/gerar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date: rawDate } = req.body ?? {};
  const date = typeof rawDate === "string" && DATE.test(rawDate) ? rawDate : null;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "Forbidden", message: "A Administração gera o dia operacional" }); return; }
  if (typeof locationId !== "string" || !date) { res.status(400).json({ error: "locationId e date são obrigatórios" }); return; }
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) { res.status(404).json({ error: "Local não encontrado" }); return; }
  try {
    let scale = await findEscalaDoDia(locationId, date);
    if (scale && scale.status !== "DRAFT") { res.status(409).json({ error: "ESCALA_JA_PUBLICADA", message: "O dia já foi publicado; use republicação para uma alteração posterior." }); return; }
    const operationId = scale?.operationId ?? await operationForLocation(locationId);
    if (!operationId) { res.status(409).json({ error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." }); return; }
    if (!scale) {
      scale = await db.transaction(async (tx) => {
        const [created] = await tx.insert(scalesTable).values({
          operationId, locationId, title: `Escala do dia · ${location.name} · ${date}`, periodStart: date, periodEnd: date,
          status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
        }).returning();
        await writeHistoryEvent({
          category: "SCALE", action: "escala.gerada", title: "Escala do dia gerada",
          narrative: `Escala em rascunho de ${location.name} para ${date} gerada a partir da Programação.`,
          entityType: "scale", entityId: created!.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
          beforeState: null, afterState: { scale: created },
        }, tx as unknown as HistoryExecutor);
        return created!;
      });
    }
    const [programacao] = await db.select().from(programacoesTable).where(and(
      eq(programacoesTable.locationId, locationId), eq(programacoesTable.active, true),
      eq(programacoesTable.organizationId, actor.organizationId),
      lte(programacoesTable.vigenciaInicio, date), gte(programacoesTable.vigenciaFim, date),
    )).orderBy(asc(programacoesTable.vigenciaFim), asc(programacoesTable.createdAt)).limit(1);
    const blocos = programacao ? await db.select().from(programacaoBlocosTable).where(and(
      eq(programacaoBlocosTable.programacaoId, programacao.id), eq(programacaoBlocosTable.weekday, weekdayOf(date)),
      eq(programacaoBlocosTable.regra, "livro"), eq(programacaoBlocosTable.active, true),
    )) : [];
    const showIds = [...new Set(blocos.map((b) => b.showBookId).filter((id): id is string => Boolean(id)))];
    const validShows = showIds.length ? await db.select({ id: showBooksTable.id }).from(showBooksTable).where(and(
      inArray(showBooksTable.id, showIds), eq(showBooksTable.locationId, locationId), eq(showBooksTable.operationId, operationId),
    )) : [];
    if (validShows.length !== showIds.length) { res.status(409).json({ error: "SHOW_FORA_DO_LOCAL", message: "A Programação referencia um Show que não pertence a este local." }); return; }
    const books = [];
    for (const show of validShows) books.push(await generateDailyBookDraftForScale({ showBookId: show.id, date, scaleId: scale.id, actorId: actor.sub, organizationId: actor.organizationId, reason: "Geração da Escala do dia" }));
    res.status(201).json({ escala: scale, livros: books.map((book) => ({ id: book.dailyBook.id, showBookId: book.dailyBook.showBookId, generated: book.generated, conflicts: book.conflicts })), dia: await montarEscalaDoDia(actor.organizationId, locationId, date) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar a Escala e os Livros do Dia" });
  }
});

/** Ajusta uma célula só neste dia; não muda a Programação nem o Livro do Dia. */
router.post("/escalas/dia/ajustes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date, sourceKey, userId, action } = req.body ?? {};
  if (typeof locationId !== "string" || typeof date !== "string" || !DATE.test(date) || typeof sourceKey !== "string" || !sourceKey || typeof userId !== "string" || !["ADICIONAR", "REMOVER"].includes(action)) {
    res.status(400).json({ error: "locationId, date, sourceKey, userId e action são obrigatórios" }); return;
  }
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) { res.status(404).json({ error: "Local não encontrado" }); return; }
  if (!(await canManageLocal(actor, locationId))) { res.status(403).json({ error: "Forbidden", message: "Você não ajusta a Escala deste local" }); return; }
  const diaAntes = await montarEscalaDoDia(actor.organizationId, locationId, date);
  const bloco = diaAntes?.blocos.find((b) => b.key === sourceKey);
  if (!bloco) { res.status(404).json({ error: "Bloco não encontrado nesta Escala" }); return; }
  const [pessoa] = await db.select({ id: usersTable.id, areaId: usersTable.areaId, name: usersTable.name }).from(usersTable).where(and(
    eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId),
  )).limit(1);
  if (!pessoa) { res.status(404).json({ error: "Pessoa não encontrada neste local" }); return; }
  const minhasAreas = await supervisedAreas(actor, locationId);
  if (actor.role !== "ADMIN" && (!pessoa.areaId || !minhasAreas.includes(pessoa.areaId))) {
    res.status(403).json({ error: "Forbidden", message: "Supervisão ajusta somente pessoas da própria área" }); return;
  }
  try {
    let scale = await findEscalaDoDia(locationId, date);
    const operationId = scale?.operationId ?? await operationForLocation(locationId);
    if (!operationId) { res.status(409).json({ error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." }); return; }
    await db.transaction(async (tx) => {
      if (!scale) {
        const [created] = await tx.insert(scalesTable).values({
          operationId, locationId, title: `Escala do dia · ${location.name} · ${date}`, periodStart: date, periodEnd: date,
          status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
        }).returning();
        scale = created!;
        await writeHistoryEvent({ category: "SCALE", action: "escala.criada", title: "Escala do dia criada", narrative: `Escala de ${location.name} para ${date} criada.`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId, afterState: { scale } }, tx as unknown as HistoryExecutor);
      }
      const [anterior] = await tx.select().from(escalaBlocoAjustesTable).where(and(
        eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.sourceKey, sourceKey), eq(escalaBlocoAjustesTable.userId, userId), eq(escalaBlocoAjustesTable.active, true),
      )).limit(1);
      if (anterior?.action === action) return;
      if (anterior) await tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: actor.sub, endedAt: new Date() }).where(eq(escalaBlocoAjustesTable.id, anterior.id));
      const [ajuste] = await tx.insert(escalaBlocoAjustesTable).values({ scaleId: scale.id, sourceKey, userId, action, createdBy: actor.sub }).returning();
      const nextScale = escalaPublicada(scale.status)
        ? (await tx.update(scalesTable).set({ alteradaDesde: scale.alteradaDesde ?? new Date(), updatedAt: new Date(), version: scale.version + 1 }).where(eq(scalesTable.id, scale.id)).returning())[0]!
        : scale;
      scale = nextScale;
      await writeHistoryEvent({
        category: "SCALE", action: action === "ADICIONAR" ? "escala.pessoa_adicionada" : "escala.pessoa_removida", title: action === "ADICIONAR" ? "Pessoa adicionada à Escala" : "Pessoa removida da Escala",
        narrative: `${action === "ADICIONAR" ? "Adicionou" : "Removeu"} ${pessoa.name} no bloco ${bloco.rotulo} de ${date}.`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
        beforeState: { sourceKey, pessoaId: userId, ajuste: anterior?.action ?? null }, afterState: { ajuste },
      }, tx as unknown as HistoryExecutor);
    });
    res.json({ dia: await montarEscalaDoDia(actor.organizationId, locationId, date) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro ao ajustar a Escala" }); }
});

/** Elenco confirma que leu a versão publicada que está vendo. */
router.post("/escalas/:id/confirmar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "MEMBER") { res.status(403).json({ error: "Forbidden", message: "Cada pessoa confirma a própria Escala" }); return; }
  const [scale] = await db.select().from(scalesTable).where(eq(scalesTable.id, req.params.id as string)).limit(1);
  if (!scale || !scale.locationId || !(await locationInOrg(scale.locationId, actor.organizationId))) { res.status(404).json({ error: "Escala não encontrada" }); return; }
  if (!escalaPublicada(scale.status)) { res.status(409).json({ error: "ESCALA_NAO_PUBLICADA", message: "A Escala ainda não foi publicada." }); return; }
  const dia = await montarEscalaDoDia(actor.organizationId, scale.locationId, scale.periodStart);
  if (!dia?.blocos.some((bloco) => bloco.pessoaIds.includes(actor.sub))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(escalaConfirmacoesTable).where(and(eq(escalaConfirmacoesTable.scaleId, scale.id), eq(escalaConfirmacoesTable.userId, actor.sub))).limit(1);
      if (previous?.version === scale.version) return;
      const now = new Date();
      if (previous) await tx.update(escalaConfirmacoesTable).set({ version: scale.version, confirmedAt: now }).where(eq(escalaConfirmacoesTable.id, previous.id));
      else await tx.insert(escalaConfirmacoesTable).values({ scaleId: scale.id, userId: actor.sub, version: scale.version, confirmedAt: now });
      await writeHistoryEvent({ category: "SCALE", action: "escala.confirmada", title: "Escala confirmada", narrative: `Confirmou a leitura da Escala de ${scale.periodStart}.`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId: scale.operationId, orgId: actor.organizationId, beforeState: { version: previous?.version ?? null }, afterState: { version: scale.version } }, tx as unknown as HistoryExecutor);
    });
    res.json({ confirmed: true, version: scale.version });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro ao confirmar a Escala" }); }
});

/** Supervisão marca (ou desmarca) a parte da área dela como pronta. Cria a Escala do dia se ainda não existe. */
router.post("/escalas/dia/pronta", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, areaId, pronta } = req.body ?? {};
  const date = typeof req.body?.date === "string" && DATE.test(req.body.date) ? req.body.date : null;
  if (typeof locationId !== "string" || typeof areaId !== "string" || !date || typeof pronta !== "boolean") { res.status(400).json({ error: "locationId, areaId, date e pronta são obrigatórios" }); return; }
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) { res.status(404).json({ error: "Local não encontrado" }); return; }
  const mine = await supervisedAreas(actor, locationId);
  if (actor.role !== "ADMIN" && !mine.includes(areaId)) { res.status(403).json({ error: "Forbidden", message: "Você marca como pronta só a parte da sua área" }); return; }
  try {
    let scale = await findEscalaDoDia(locationId, date);
    if (scale && scale.status !== "DRAFT") { res.status(409).json({ error: "ESCALA_JA_PUBLICADA", message: "A escala deste dia já foi publicada." }); return; }
    const operationId = scale?.operationId ?? await operationForLocation(locationId);
    if (!operationId) { res.status(409).json({ error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." }); return; }
    const result = await db.transaction(async (tx) => {
      if (!scale) {
        const [created] = await tx.insert(scalesTable).values({
          operationId, locationId, title: `Escala do dia · ${location.name} · ${date}`, periodStart: date, periodEnd: date,
          status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
        }).returning();
        scale = created!;
        await writeHistoryEvent({ category: "SCALE", action: "escala.criada", title: "Escala do dia criada", narrative: `Escala de ${location.name} para ${date} criada.`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId, afterState: { scale } }, tx as unknown as HistoryExecutor);
      }
      const [current] = await tx.select().from(escalaAreasProntasTable).where(and(eq(escalaAreasProntasTable.scaleId, scale.id), eq(escalaAreasProntasTable.areaId, areaId), eq(escalaAreasProntasTable.active, true))).limit(1);
      if (pronta && !current) await tx.insert(escalaAreasProntasTable).values({ scaleId: scale.id, areaId, markedBy: actor.sub });
      if (!pronta && current) await tx.update(escalaAreasProntasTable).set({ active: false, unmarkedBy: actor.sub, unmarkedAt: new Date() }).where(eq(escalaAreasProntasTable.id, current.id));
      if (pronta !== Boolean(current)) {
        await writeHistoryEvent({
          category: "SCALE", action: pronta ? "escala.area_pronta" : "escala.area_desmarcada", title: pronta ? "Área marcada como pronta" : "Área desmarcada",
          narrative: `${pronta ? "Marcou" : "Desmarcou"} a parte da área como pronta na Escala de ${location.name} (${date}).`,
          entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
          beforeState: { areaId, pronta: Boolean(current) }, afterState: { areaId, pronta },
        }, tx as unknown as HistoryExecutor);
      }
      return scale;
    });
    res.json({ dia: await montarEscalaDoDia(actor.organizationId, locationId, date), scaleId: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao marcar a área" });
  }
});

/** Administração publica o dia — só com todas as áreas do local prontas. */
async function publicarOuRepublicar(req: any, res: any, republicar: boolean) {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "Forbidden", message: "Quem publica o dia é a Administração" }); return; }
  const expectedVersion = Number(req.body?.expectedVersion);
  if (!Number.isInteger(expectedVersion)) { res.status(400).json({ error: "expectedVersion é obrigatório" }); return; }
  const [scale] = await db.select().from(scalesTable).where(eq(scalesTable.id, req.params.id)).limit(1);
  if (!scale || !scale.locationId || !(await locationInOrg(scale.locationId, actor.organizationId))) { res.status(404).json({ error: "Escala não encontrada" }); return; }
  if (scale.version !== expectedVersion) { res.status(409).json({ error: "CONCURRENT_MODIFICATION", message: "Alguém alterou esta escala depois que você a abriu.", expectedVersion, currentVersion: scale.version }); return; }
  if (republicar ? !escalaPublicada(scale.status) : scale.status !== "DRAFT") {
    res.status(409).json({ error: republicar ? "ESCALA_NAO_PUBLICADA" : "ESCALA_JA_PUBLICADA", message: republicar ? "Só republica escala já publicada." : "Esta escala já foi publicada." }); return;
  }
  const dia = await montarEscalaDoDia(actor.organizationId, scale.locationId, scale.periodStart);
  if (!republicar) {
    const faltam = (dia?.areas ?? []).filter((a) => !a.pronta).map((a) => a.name);
    if (faltam.length) { res.status(409).json({ error: "AREAS_PENDENTES", message: `Faltam áreas marcarem como pronta: ${faltam.join(", ")}.`, faltam }); return; }
  }
  const now = new Date();
  const convocacao = dia ? convocacaoPorPessoa(dia) : {};
  // Retrato da publicação anterior (se houver) para avisar só quem mudou na republicação.
  const [anterior] = republicar ? await db.select({ afterState: historyEventsTable.afterState }).from(historyEventsTable)
    .where(and(eq(historyEventsTable.entityId, scale.id), inArray(historyEventsTable.action, ["escala.publicada", "escala.republicada"])))
    .orderBy(desc(historyEventsTable.createdAt)).limit(1) : [];
  const antes = (anterior?.afterState as { convocacao?: Record<string, string[]> } | null | undefined)?.convocacao ?? null;
  const avisar = republicar ? pessoasAfetadas(antes, convocacao) : Object.keys(convocacao);
  const updated = await db.transaction(async (tx) => {
    const [next] = await tx.update(scalesTable).set(republicar
      ? { status: "REPUBLISHED", republishedAt: now, republishedBy: actor.sub, alteradaDesde: null, version: scale.version + 1, updatedAt: now }
      : { status: "PUBLISHED", publishedAt: now, publishedBy: actor.sub, version: scale.version + 1, updatedAt: now },
    ).where(and(eq(scalesTable.id, scale.id), eq(scalesTable.version, expectedVersion))).returning();
    if (!next) throw Object.assign(new Error("versão mudou"), { conflict: true });
    await writeHistoryEvent({
      category: "SCALE", action: republicar ? "escala.republicada" : "escala.publicada", title: republicar ? "Escala do dia republicada" : "Escala do dia publicada",
      narrative: `${republicar ? "Republicou" : "Publicou"} a Escala de ${dia?.location.name ?? "local"} para ${scale.periodStart}.`,
      entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId: scale.operationId, orgId: actor.organizationId,
      beforeState: { status: scale.status, version: scale.version, alteradaDesde: scale.alteradaDesde }, afterState: { status: next.status, version: next.version, convocacao, avisados: avisar.length },
    }, tx as unknown as HistoryExecutor);
    // Publicar é o que convoca: cada pessoa recebe o aviso na mesma transação (fila durável, sem duplicar).
    const quando = dataPorExtenso(scale.periodStart);
    for (const userId of avisar) {
      const blocos = convocacao[userId] ?? [];
      const primeiro = blocos[0]?.split("|");
      await enqueueNotification(tx as never, {
        // Troca de última hora (republicar a escala do próprio dia) atravessa o silêncio noturno.
        userId, type: republicar ? "scale.republished" : "scale.published", category: "schedule", priority: republicar ? (scale.periodStart === operationalDate(now) ? "CRITICAL" : "IMPORTANT") : "NORMAL",
        title: republicar ? `Sua escala de ${quando} mudou` : `Sua escala de ${quando} saiu`,
        message: !blocos.length ? `Você não está mais na escala de ${quando} em ${dia?.location.name ?? "seu local"}.`
          : `${dia?.location.name ?? "Seu local"} · ${blocos.length === 1 ? "1 bloco" : `${blocos.length} blocos`}, a partir de ${primeiro?.[0] ?? ""} (${primeiro?.[2] ?? ""}).`,
        entityType: "scale", entityId: scale.id, actionUrl: APP_ROUTES.escalas,
      }, now, { deduplicationKey: `escala:${scale.id}:v${next.version}:${userId}` });
    }
    // O Livro nasce antes, em rascunho, quando a Escala é gerada. Aqui a
    // Administração assina o conjunto: muda todos os Livros vinculados ao dia
    // na mesma transação da Escala. Lacunas e conflitos continuam avisos — não
    // entram nesta condição de bloqueio.
    const candidates = await tx.select().from(dailyBooksTable).where(and(
      eq(dailyBooksTable.scaleId, scale.id),
      republicar ? inArray(dailyBooksTable.status, ["PUBLISHED", "REPUBLISHED"]) : eq(dailyBooksTable.status, "DRAFT"),
    ));
    const livros = [] as typeof candidates;
    for (const book of candidates) {
      const [publishedBook] = await tx.update(dailyBooksTable).set(republicar
        ? { status: "REPUBLISHED", version: book.version + 1, publishedAt: now, publishedBy: actor.sub, updatedAt: now }
        : { status: "PUBLISHED", version: book.version + 1, publishedAt: now, publishedBy: actor.sub, updatedAt: now },
      ).where(and(eq(dailyBooksTable.id, book.id), eq(dailyBooksTable.version, book.version))).returning();
      if (!publishedBook) throw Object.assign(new Error("versão do Livro mudou"), { conflict: true });
      livros.push(publishedBook);
      await writeHistoryEvent({
        category: "DAILY_BOOK", action: republicar ? "republished" : "published",
        title: republicar ? `Livro do Dia republicado (v${publishedBook.version})` : `Livro do Dia publicado (v${publishedBook.version})`,
        narrative: republicar ? "Livro do Dia republicado junto com a Escala." : "Livro do Dia publicado junto com a Escala.",
        entityType: "daily_book", entityId: book.id, actorId: actor.sub, operationId: scale.operationId, orgId: actor.organizationId,
        beforeState: { status: book.status, version: book.version }, afterState: { status: publishedBook.status, version: publishedBook.version, scaleId: scale.id },
        metadata: { publication: "escala_conjunta", scaleId: scale.id },
      }, tx as unknown as HistoryExecutor);
    }
    return { escala: next, livros };
  }).catch((err) => { if ((err as { conflict?: boolean }).conflict) return null; throw err; });
  if (!updated) { res.status(409).json({ error: "CONCURRENT_MODIFICATION", message: "Alguém alterou esta escala depois que você a abriu." }); return; }
  res.json({ escala: updated.escala, livrosPublicados: updated.livros.map((book) => ({ id: book.id, status: book.status, version: book.version })), dia: await montarEscalaDoDia(actor.organizationId, scale.locationId, scale.periodStart) });
}
router.post("/escalas/:id/publicar", requireAuth, requireOrganization, (req, res) => void publicarOuRepublicar(req, res, false).catch((err) => { console.error(err); res.status(500).json({ error: "Erro ao publicar a escala" }); }));
router.post("/escalas/:id/republicar", requireAuth, requireOrganization, (req, res) => void publicarOuRepublicar(req, res, true).catch((err) => { console.error(err); res.status(500).json({ error: "Erro ao republicar a escala" }); }));

// ─── Programação ─────────────────────────────────────────────────────────────

type BlocoInput = { weekday?: unknown; inicio?: unknown; fim?: unknown; rotulo?: unknown; regra?: unknown; showBookId?: unknown; areaIds?: unknown; grupoIds?: unknown; pessoaIds?: unknown; order?: unknown; active?: unknown };
const uuidList = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
/** Valida um bloco. `partial` aceita só os campos enviados (PATCH). */
function parseBloco(body: BlocoInput, partial: boolean): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  if (body.weekday !== undefined || !partial) { const w = Number(body.weekday); if (!Number.isInteger(w) || w < 0 || w > 6) return { ok: false, error: "weekday de 0 (domingo) a 6 (sábado)" }; out.weekday = w; }
  if (body.inicio !== undefined || !partial) { if (typeof body.inicio !== "string" || !TIME.test(body.inicio)) return { ok: false, error: "inicio no formato HH:MM" }; out.inicio = body.inicio; }
  if (body.fim !== undefined) { if (body.fim !== null && (typeof body.fim !== "string" || !TIME.test(body.fim))) return { ok: false, error: "fim no formato HH:MM" }; out.fim = body.fim; }
  if (typeof out.inicio === "string" && typeof out.fim === "string" && out.fim <= out.inicio) return { ok: false, error: "fim precisa ser depois do início" };
  if (body.rotulo !== undefined || !partial) { if (typeof body.rotulo !== "string" || !body.rotulo.trim()) return { ok: false, error: "rotulo é obrigatório" }; out.rotulo = body.rotulo.trim(); }
  if (body.regra !== undefined || !partial) { if (!REGRAS_BLOCO.includes(body.regra as RegraBloco)) return { ok: false, error: `regra: ${REGRAS_BLOCO.join(", ")}` }; out.regra = body.regra; }
  if (body.showBookId !== undefined) out.showBookId = typeof body.showBookId === "string" ? body.showBookId : null;
  if (out.regra === "livro" && !out.showBookId && !partial) return { ok: false, error: "regra livro precisa de showBookId" };
  if (body.areaIds !== undefined) out.areaIds = uuidList(body.areaIds);
  if (body.grupoIds !== undefined) out.grupoIds = uuidList(body.grupoIds);
  if (body.pessoaIds !== undefined) out.pessoaIds = uuidList(body.pessoaIds);
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.active !== undefined) out.active = body.active === true;
  return { ok: true, value: out };
}
async function programacaoInOrg(id: string, organizationId: string) {
  const [row] = await db.select().from(programacoesTable).where(and(eq(programacoesTable.id, id), eq(programacoesTable.organizationId, organizationId))).limit(1);
  return row ?? null;
}

router.get("/programacoes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!locationId || !(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "Local não encontrado" }); return; }
  if (!(await canReadLocal(actor, locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const programacoes = await db.select().from(programacoesTable).where(and(eq(programacoesTable.locationId, locationId), eq(programacoesTable.active, true))).orderBy(asc(programacoesTable.vigenciaInicio));
  const blocos = programacoes.length ? await db.select().from(programacaoBlocosTable).where(and(inArray(programacaoBlocosTable.programacaoId, programacoes.map((p) => p.id)), eq(programacaoBlocosTable.active, true)))
    .orderBy(asc(programacaoBlocosTable.weekday), asc(programacaoBlocosTable.inicio), asc(programacaoBlocosTable.order)) : [];
  res.json({ programacoes: programacoes.map((p) => ({ ...p, blocos: blocos.filter((b) => b.programacaoId === p.id) })), podeEditar: await canManageLocal(actor, locationId) });
});

router.post("/programacoes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, nome, vigenciaInicio, vigenciaFim } = req.body ?? {};
  if (typeof locationId !== "string" || typeof nome !== "string" || !nome.trim() || !DATE.test(String(vigenciaInicio)) || !DATE.test(String(vigenciaFim)) || vigenciaFim < vigenciaInicio) {
    res.status(400).json({ error: "locationId, nome e vigência (início ≤ fim) são obrigatórios" }); return;
  }
  if (!(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "Local não encontrado" }); return; }
  if (!(await canManageLocal(actor, locationId))) { res.status(403).json({ error: "Forbidden", message: "Programação é da Administração e da Supervisão do local" }); return; }
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(programacoesTable).values({ organizationId: actor.organizationId, locationId, nome: nome.trim(), vigenciaInicio, vigenciaFim, createdBy: actor.sub }).returning();
    await writeHistoryEvent({ category: "SCALE", action: "programacao.criada", title: "Programação criada", narrative: `Programação ${row!.nome} criada.`, entityType: "programacao", entityId: row!.id, actorId: actor.sub, orgId: actor.organizationId, afterState: { programacao: row } }, tx as unknown as HistoryExecutor);
    return row!;
  });
  res.status(201).json({ programacao: { ...created, blocos: [] } });
});

router.patch("/programacoes/:id", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const current = await programacaoInOrg(req.params.id as string, actor.organizationId);
  if (!current) { res.status(404).json({ error: "Programação não encontrada" }); return; }
  if (!(await canManageLocal(actor, current.locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { nome, vigenciaInicio, vigenciaFim, active } = req.body ?? {};
  const next = {
    nome: typeof nome === "string" && nome.trim() ? nome.trim() : current.nome,
    vigenciaInicio: DATE.test(String(vigenciaInicio)) ? vigenciaInicio as string : current.vigenciaInicio,
    vigenciaFim: DATE.test(String(vigenciaFim)) ? vigenciaFim as string : current.vigenciaFim,
    active: typeof active === "boolean" ? active : current.active,
  };
  if (next.vigenciaFim < next.vigenciaInicio) { res.status(400).json({ error: "vigência: início ≤ fim" }); return; }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(programacoesTable).set({ ...next, version: current.version + 1, updatedAt: new Date() }).where(eq(programacoesTable.id, current.id)).returning();
    await writeHistoryEvent({ category: "SCALE", action: next.active ? "programacao.alterada" : "programacao.desativada", title: next.active ? "Programação alterada" : "Programação desativada", narrative: `Programação ${row!.nome} ${next.active ? "alterada" : "desativada (sem exclusão)"}.`, entityType: "programacao", entityId: current.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: { programacao: current }, afterState: { programacao: row } }, tx as unknown as HistoryExecutor);
    return row!;
  });
  res.json({ programacao: updated });
});

router.post("/programacoes/:id/blocos", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const programacao = await programacaoInOrg(req.params.id as string, actor.organizationId);
  if (!programacao) { res.status(404).json({ error: "Programação não encontrada" }); return; }
  if (!(await canManageLocal(actor, programacao.locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = parseBloco(req.body ?? {}, false);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  if (typeof parsed.value.showBookId === "string") {
    const [show] = await db.select({ id: showBooksTable.id }).from(showBooksTable).where(eq(showBooksTable.id, parsed.value.showBookId)).limit(1);
    if (!show) { res.status(404).json({ error: "Show não encontrado" }); return; }
  }
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(programacaoBlocosTable).values({ programacaoId: programacao.id, ...(parsed.value as { weekday: number; inicio: string; rotulo: string; regra: RegraBloco }) }).returning();
    await writeHistoryEvent({ category: "SCALE", action: "programacao.bloco_criado", title: "Bloco da Programação criado", narrative: `Bloco ${row!.rotulo} ${row!.inicio.slice(0, 5)} na programação ${programacao.nome}.`, entityType: "programacao", entityId: programacao.id, actorId: actor.sub, orgId: actor.organizationId, afterState: { bloco: row } }, tx as unknown as HistoryExecutor);
    return row!;
  });
  res.status(201).json({ bloco: created });
});

router.patch("/programacoes/:id/blocos/:blocoId", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const programacao = await programacaoInOrg(req.params.id as string, actor.organizationId);
  if (!programacao) { res.status(404).json({ error: "Programação não encontrada" }); return; }
  if (!(await canManageLocal(actor, programacao.locationId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const [current] = await db.select().from(programacaoBlocosTable).where(and(eq(programacaoBlocosTable.id, req.params.blocoId as string), eq(programacaoBlocosTable.programacaoId, programacao.id))).limit(1);
  if (!current) { res.status(404).json({ error: "Bloco não encontrado" }); return; }
  const parsed = parseBloco(req.body ?? {}, true);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  const merged = { ...current, ...parsed.value } as typeof current;
  if (merged.regra === "livro" && !merged.showBookId) { res.status(400).json({ error: "regra livro precisa de showBookId" }); return; }
  if (merged.fim && merged.fim.slice(0, 5) <= merged.inicio.slice(0, 5)) { res.status(400).json({ error: "fim precisa ser depois do início" }); return; }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(programacaoBlocosTable).set({ ...parsed.value, updatedAt: new Date() }).where(eq(programacaoBlocosTable.id, current.id)).returning();
    await writeHistoryEvent({ category: "SCALE", action: row!.active ? "programacao.bloco_alterado" : "programacao.bloco_desativado", title: row!.active ? "Bloco da Programação alterado" : "Bloco da Programação desativado", narrative: `Bloco ${row!.rotulo} ${row!.active ? "alterado" : "desativado (sem exclusão)"} na programação ${programacao.nome}.`, entityType: "programacao", entityId: programacao.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: { bloco: current }, afterState: { bloco: row } }, tx as unknown as HistoryExecutor);
    return row!;
  });
  res.json({ bloco: updated });
});

export default router;
