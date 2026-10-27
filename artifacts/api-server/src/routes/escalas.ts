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
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  db,
  dailyBookAssignmentsTable,
  dailyBooksTable,
  historyEventsTable,
  escalaAreasProntasTable,
  escalaBlocoAjustesTable,
  escalaConfirmacoesTable,
  escalaTiposTable,
  CORES_DE_TIPO,
  type CorDeTipo,
  locationsTable,
  programacaoBlocosTable,
  programacoesTable,
  REGRAS_BLOCO,
  scalesTable,
  showBooksTable,
  usersTable,
  type RegraBloco,
} from "@workspace/db";
import { fraseDeRecusaPorPerfil, requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { avisarRepublicacaoPendente, avisarTodasAsAreasEnviaram, comoPublicada, convocacaoPorPessoa, escalaPublicada, findEscalaDoDia, montarEscalaDoDia, operationForLocation, pessoasAfetadas, tiposDoLocal } from "../services/escala-dia.js";
import { FRASE_NOME_DE_TIPO, TIPOS_PRONTOS, nomeDeTipoEmUso, nomeDeTipoValido, recusaDoTipo } from "../services/escala-tipos.js";
import { ultimoRetratoFolgas } from "../services/folgas-publicadas.js";
import { FRASE_LOCAL_SEM_OPERACAO, descartarMes, descartaveisDoMes, gerarDiaDoLocal, gerarMes, restaurarDescarte, resumoDoMes, validarMes } from "../services/escala-mes.js";
import { enqueueNotification } from "../services/undo.js";
import { avisarExcecaoDeRegra, codigoDaExcecao, frasesDasRegras, verificarRegrasDeEscala } from "../services/regras-de-escala.js";
import { APP_ROUTES } from "../lib/app-routes.js";
import { VersionConflictError } from "../lib/versioning.js";
import { viradaDoLocal } from "../lib/virada-do-dia.js";
import { mexidasDoDia, novaColeta } from "../services/escala-mexidas.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dataPorExtenso = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m! - 1]}`; };
import { ajustarPessoaNoLivro, generateDailyBookDraftForScale } from "./daily-book.js";

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
/** A Escala do dia como a tela a recebe: a montada na leitura mais `mexidas`, quem da Supervisão mexeu em pessoa de OUTRA área (ver escala-mexidas.ts). */
async function diaParaTela(organizationId: string, locationId: string, date: string) {
  const dia = await montarEscalaDoDia(organizationId, locationId, date);
  return dia ? { ...dia, mexidas: await mexidasDoDia(dia.escala?.id) } : dia;
}
/** Vê a grade inteira do local: Administração e Direção em qualquer local;
 * Supervisão apenas no local no qual responde por alguma área. */
async function canReadLocal(actor: Actor, locationId: string) {
  if (actor.role === "ADMIN" || actor.role === "DIR") return true;
  if (!SUPERVISOR.includes(actor.role)) return false;
  return (await supervisedAreas(actor, locationId)).length > 0;
}
/** Edita a Programação do local: Administração, ou Supervisão de alguma área do local. */
async function canManageLocal(actor: Actor, locationId: string) { // mexer na escala de QUALQUER pessoa do local (25/10/2026): Supervisão com ao menos uma área aqui
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
  const all = await db.select({ id: locationsTable.id, name: locationsTable.name, escalaAbreAmanhaAPartir: locationsTable.escalaAbreAmanhaAPartir, escalaVoltaAHojeAPartir: locationsTable.escalaVoltaAHojeAPartir }).from(locationsTable)
    .where(and(eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false))).orderBy(asc(locationsTable.name));
  const visible = [];
  // `viradaDoDia`: a hora em que a Escala deste local passa a abrir no dia seguinte e a hora em que volta a abrir em hoje.
  for (const { escalaAbreAmanhaAPartir, escalaVoltaAHojeAPartir, ...location } of all) if (await canReadLocal(actor, location.id)) visible.push({ ...location, viradaDoDia: viradaDoLocal({ escalaAbreAmanhaAPartir, escalaVoltaAHojeAPartir }), podeEditar: await canManageLocal(actor, location.id), areasSupervisionadas: await supervisedAreas(actor, location.id) });
  res.json({ locais: visible });
});

router.get("/escalas/dia", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  const date = dateParam(req.query.date);
  if (!locationId || !(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  if (!(await canReadLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: "A escala deste local não está no seu acesso" }); return; }
  try {
    const dia = await montarEscalaDoDia(actor.organizationId, locationId, date);
    // Mudança que não passou por ajuste nem pelo Livro (ex.: bloco novo na Programação) também pede republicação.
    if (dia?.escala && escalaPublicada(dia.escala.status) && !dia.escala.alteradaDesde && (await comoPublicada(dia)).mudouDesdeAPublicacao) {
      dia.escala = { ...dia.escala, alteradaDesde: dia.escala.publishedAt ?? new Date() };
    }
    res.json({ dia: dia ? { ...dia, mexidas: await mexidasDoDia(dia.escala?.id) } : dia, areasSupervisionadas: await supervisedAreas(actor, locationId), podePublicar: actor.role === "ADMIN" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível montar a Escala. Tente de novo." });
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
    // Um local por vez somava o tempo de todos (10 s ou mais com 5 locais, na tela que o Elenco mais abre).
    // Os locais não dependem um do outro: monta todos juntos e mantém a ordem da lista.
    const porLocal = await Promise.all(locations.map(async (location) => {
      const aoVivo = await montarEscalaDoDia(actor.organizationId, location.id, date);
      if (!aoVivo || !escalaPublicada(aoVivo.escala?.status)) return null;
      // O Elenco vê a versão publicada; o que mudou depois só chega com a republicação.
      const dia = await comoPublicada(aoVivo);
      const me = dia.pessoas.find((p) => p.id === actor.sub) ?? null;
      const operationId = await operationForLocation(location.id);
      const retrato = operationId ? await ultimoRetratoFolgas(operationId, Number(date.slice(0, 4)), Number(date.slice(5, 7))) : null;
      const folga = retrato?.folgas?.find((item) => item.userId === actor.sub && item.startDate <= date && item.endDate >= date)?.type ?? null;
      const blocos = dia.blocos.filter((b) => b.pessoaIds.includes(actor.sub) && (!folga || me?.chamadaNaFolga?.motivo)).map(({ pessoaIds: _p, ...b }) => b);
      if (!blocos.length && !folga) return null;
      const [confirmacao] = await db.select().from(escalaConfirmacoesTable).where(and(
        eq(escalaConfirmacoesTable.scaleId, dia.escala!.id), eq(escalaConfirmacoesTable.userId, actor.sub),
      )).limit(1);
      return {
        location: dia.location, publishedAt: dia.escala!.publishedAt ?? null, folga,
        escalaId: dia.escala!.id, escalaVersion: dia.escala!.version,
        confirmada: confirmacao?.version === dia.escala!.version, confirmedAt: confirmacao?.confirmedAt ?? null, blocos,
        // Os tipos do local pintam e nomeiam cada bloco, igual à Escala de quem monta.
        tipos: dia.tipos ?? [],
      };
    }));
    const escalas = porLocal.filter((e): e is NonNullable<typeof e> => e !== null);
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
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível montar a escala. Tente de novo." });
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
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "A Administração gera o dia operacional" }); return; }
  if (typeof locationId !== "string" || !date) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId e date são obrigatórios." }); return; }
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  try {
    const r = await gerarDiaDoLocal(actor, location, date);
    if (!r.ok) { res.status(r.status).json({ error: r.error, message: r.message }); return; }
    res.status(201).json({ escala: r.scale, livros: r.livros.map((book) => ({ id: book.dailyBook.id, showBookId: book.dailyBook.showBookId, generated: book.generated, conflicts: book.conflicts })), dia: await diaParaTela(actor.organizationId, locationId, date) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível gerar a Escala. Tente de novo." });
  }
});

/**
 * O mês de um local, dia a dia, só leitura: o que já está gerado, o que falta e o que não entra (e
 * por quê). É o que a tela mostra antes de a Administração confirmar "Gerar o mês".
 */
router.get("/escalas/mes/resumo", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "A Administração gera o mês." }); return; }
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  const mes = validarMes(req.query.year, req.query.month);
  if (!locationId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId é obrigatório." }); return; }
  if ("erro" in mes) { res.status(400).json({ error: "MES_INVALIDO", message: mes.erro }); return; }
  try {
    const resumo = await resumoDoMes(actor.organizationId, locationId, mes.year, mes.month);
    if (!resumo) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
    const conta = (...estados: string[]) => resumo.dias.filter((d) => estados.includes(d.estado)).length;
    res.json({ ...resumo, year: mes.year, month: mes.month, totais: { aGerar: resumo.semOperacao ? 0 : conta("a_gerar", "faltam_livros"), completos: conta("completo"), publicados: conta("publicado"), naoEntram: conta("passou", "fechado", "sem_programacao", "sem_atividades") } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao montar o resumo do mês. Tente de novo." });
  }
});

/**
 * Gera o mês em rascunho, em ordem, até acabar o orçamento de tempo da chamada (a Vercel mata a
 * função em 60 s). Devolve o que gerou, o que falhou e de onde continuar (`proximoDia`); a tela
 * chama de novo com `desde`. Dia já gerado é pulado, então refazer a chamada retoma sem repetir.
 */
router.post("/escalas/mes/gerar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "A Administração gera o mês." }); return; }
  const { locationId, year, month, desde } = req.body ?? {};
  const mes = validarMes(year, month);
  if (typeof locationId !== "string" || !locationId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId é obrigatório." }); return; }
  if ("erro" in mes) { res.status(400).json({ error: "MES_INVALIDO", message: mes.erro }); return; }
  try {
    if (!(await operationForLocation(locationId))) { res.status(409).json({ error: "LOCAL_SEM_OPERACAO", message: FRASE_LOCAL_SEM_OPERACAO }); return; }
    const r = await gerarMes(actor, locationId, mes.year, mes.month, { desde: typeof desde === "string" && DATE.test(desde) ? desde : null });
    if (!r) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao gerar o mês. Tente de novo." });
  }
});

/** O que o "Descartar rascunhos do mês" levaria, dia a dia, e o que a gerência mexeu à mão em cada um. */
router.get("/escalas/mes/descartaveis", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "A Administração descarta rascunhos do mês." }); return; }
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  const mes = validarMes(req.query.year, req.query.month);
  if (!locationId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId é obrigatório." }); return; }
  if ("erro" in mes) { res.status(400).json({ error: "MES_INVALIDO", message: mes.erro }); return; }
  try {
    const r = await descartaveisDoMes(actor.organizationId, locationId, mes.year, mes.month);
    if (!r) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
    res.json({ ...r, year: mes.year, month: mes.month });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível verificar o descarte. Tente de novo." });
  }
});

/** Descarta (de forma lógica e restaurável) os rascunhos do mês. Motivo obrigatório; nunca toca em dia publicado. */
router.post("/escalas/mes/descartar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "A Administração descarta rascunhos do mês." }); return; }
  const { locationId, year, month, motivo, incluirComAjustes } = req.body ?? {};
  const mes = validarMes(year, month);
  if (typeof locationId !== "string" || !locationId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId é obrigatório." }); return; }
  if ("erro" in mes) { res.status(400).json({ error: "MES_INVALIDO", message: mes.erro }); return; }
  const porque = typeof motivo === "string" ? motivo.trim() : "";
  if (porque.length < 3) { res.status(400).json({ error: "MOTIVO_OBRIGATORIO", message: "Escreva o motivo do descarte." }); return; }
  try {
    const r = await descartarMes(actor, locationId, mes.year, mes.month, porque, incluirComAjustes === true);
    if (!r) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao descartar os rascunhos do mês. Tente de novo." });
  }
});

/** Desfaz um descarte (pelo evento do Registro que ele gerou). */
router.post("/escalas/mes/restaurar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "A Administração restaura rascunhos do mês." }); return; }
  const { eventoId } = req.body ?? {};
  if (typeof eventoId !== "string" || !eventoId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "eventoId é obrigatório." }); return; }
  try {
    const r = await restaurarDescarte(actor, eventoId);
    if (!r) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Descarte não encontrado." }); return; }
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao restaurar os rascunhos do mês. Tente de novo." });
  }
});

/**
 * Ajusta uma célula só neste dia; não muda a Programação. Aceita uma pessoa (`userId` + `action`)
 * ou várias de uma vez (`mudancas: [{ userId, action }]`), para a tela aplicar tudo num pedido só.
 */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Horário só da pessoa (0080). Quando alguém cai em duas atividades ao mesmo tempo, além de tirar dá para mudar o horário de UMA
 * delas só para essa pessoa (treino de gelo às 10:20 para quem tem boas-vindas às 10:00). Show não muda de horário aqui: horário de show
 * é exceção, resolvida no Livro do Dia. Quem pode: a Administração, ou a Supervisão do local (de qualquer área, por ora); se for pessoa de outra área, fica visível quem mexeu.
 * Com "voltar" o horário normal da atividade volta para ela. Entra no Registro; escala já publicada pede republicação e avisa.
 */
router.post("/escalas/dia/horario", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date, sourceKey, userId, inicio, fim, voltar, motivo } = req.body ?? {};
  if (typeof locationId !== "string" || typeof date !== "string" || !DATE.test(date) || typeof sourceKey !== "string" || !sourceKey || typeof userId !== "string") {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, date, sourceKey e userId são obrigatórios." }); return;
  }
  const desfazer = voltar === true;
  if (!desfazer) {
    if (typeof inicio !== "string" || !HORA.test(inicio)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Escolha a hora de início (formato 08:30)." }); return; }
    if (fim !== undefined && fim !== null && (typeof fim !== "string" || !HORA.test(fim))) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "A hora de fim não é válida (formato 08:30)." }); return; }
    if (typeof fim === "string" && fim <= inicio) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "O fim precisa ser depois do início." }); return; }
  }
  const porque = typeof motivo === "string" && motivo.trim() ? motivo.trim() : null;
  try {
    const location = await locationInOrg(locationId, actor.organizationId);
    if (!location) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
    if (!(await canManageLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Ajustar a Escala é da Administração e da Supervisão do local.` }); return; }
    const dia = await montarEscalaDoDia(actor.organizationId, locationId, date);
    const original = dia?.blocos.find((b) => b.key === sourceKey);
    const bloco = original ?? dia?.blocos.find((b) => b.horarioDela?.chaveOriginal === sourceKey && b.pessoaIds.includes(userId));
    if (!original && !(desfazer && bloco)) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Esta atividade não está mais na Escala do dia. Atualize a tela." }); return; }
    const alvo = original ?? bloco!;
    if (!desfazer && (alvo.origem === "livro" || alvo.regra === "livro")) {
      res.status(409).json({ error: "HORARIO_DE_SHOW", message: "Horário de show não muda aqui: o show tem hora marcada. Se for exceção, a pessoa sai do show pelo Livro do Dia." }); return;
    }
    if (!desfazer && alvo.origem === "solicitacao") {
      res.status(409).json({ error: "HORARIO_PEDIDO", message: "Este horário foi pedido pela própria pessoa e aprovado em Solicitações. Para mudar, resolva por lá." }); return;
    }
    const jaComHorario = Boolean(dia?.blocos.some((b) => b.horarioDela?.chaveOriginal === sourceKey && b.pessoaIds.includes(userId)));
    if (!desfazer && !alvo.pessoaIds.includes(userId) && !jaComHorario) {
      res.status(409).json({ error: "PESSOA_FORA_DA_ATIVIDADE", message: "Esta pessoa não está nesta atividade. Atualize a tela." }); return;
    }
    const [pessoa] = await db.select({ id: usersTable.id, areaId: usersTable.areaId, name: usersTable.name }).from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId))).limit(1);
    if (!pessoa) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Pessoa não encontrada." }); return; }
    const scaleAntes = await findEscalaDoDia(locationId, date);
    const operationId = scaleAntes?.operationId ?? await operationForLocation(locationId);
    if (!operationId) { res.status(409).json({ error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." }); return; }
    const coleta = await novaColeta(actor, locationId, date);
    const chave = `h:${sourceKey}`;
    const rotulo = alvo.rotulo;
    const resultado = await db.transaction(async (tx) => {
      let scale = scaleAntes ?? null;
      if (!scale) {
        const [created] = await tx.insert(scalesTable).values({
          operationId, locationId, title: `Escala do dia · ${location.name} · ${date}`, periodStart: date, periodEnd: date,
          status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
        }).returning();
        scale = created!;
        await writeHistoryEvent({ category: "SCALE", action: "escala.criada", title: "Escala do dia criada", narrative: `Escala de ${location.name} para ${date} criada.`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId, afterState: { scale } }, tx as unknown as HistoryExecutor);
      }
      const [anterior] = await tx.select().from(escalaBlocoAjustesTable).where(and(
        eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.sourceKey, chave), eq(escalaBlocoAjustesTable.userId, userId), eq(escalaBlocoAjustesTable.active, true),
      )).limit(1);
      if (desfazer && !anterior) return { mudou: false as const, scale };
      if (!desfazer && anterior && anterior.newStart === inicio && (anterior.newEnd ?? null) === (typeof fim === "string" ? fim : null)) return { mudou: false as const, scale };
      if (anterior) await tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: actor.sub, endedAt: new Date() }).where(eq(escalaBlocoAjustesTable.id, anterior.id));
      if (!desfazer) {
        await tx.insert(escalaBlocoAjustesTable).values({
          scaleId: scale.id, sourceKey: chave, userId, action: "HORARIO", newStart: inicio, newEnd: typeof fim === "string" ? fim : null, createdBy: actor.sub, motivo: porque,
        });
      }
      const faixa = (a: string, b: string | null | undefined) => (b ? `${a}–${b}` : a);
      const doOriginal = original ? faixa(original.inicio, original.fim) : bloco?.horarioDela ? faixa(bloco.horarioDela.inicio, bloco.horarioDela.fim) : "";
      const mex = await coleta.registrar(scale.id, [{ pessoa, texto: desfazer ? `voltou ao horário normal de ${rotulo}` : `mudou o horário de ${rotulo} só para ${pessoa.name}` }]);
      await writeHistoryEvent({
        category: "SCALE", action: desfazer ? "escala.horario_restaurado" : "escala.horario_ajustado", title: desfazer ? "Horário da pessoa voltou ao normal" : "Horário só de uma pessoa mudado",
        narrative: desfazer
          ? `${pessoa.name} voltou ao horário normal de ${rotulo} (${doOriginal}) em ${date}.`
          : `${pessoa.name}: ${rotulo} de ${doOriginal} passou a ${faixa(inicio, typeof fim === "string" ? fim : null)} em ${date}, só para essa pessoa.${porque ? ` Motivo: ${porque}` : ""}`,
        entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
        beforeState: { sourceKey, pessoaId: userId, horario: anterior ? { inicio: anterior.newStart, fim: anterior.newEnd } : null },
        afterState: { sourceKey, pessoaId: userId, horario: desfazer ? null : { inicio, fim: typeof fim === "string" ? fim : null } },
        ...(porque || Object.keys(mex).length ? { metadata: { ...(porque ? { reason: porque } : {}), ...mex } } : {}),
      }, tx as unknown as HistoryExecutor);
      if (escalaPublicada(scale.status)) {
        scale = (await tx.update(scalesTable).set({ alteradaDesde: scale.alteradaDesde ?? new Date(), updatedAt: new Date(), version: scale.version + 1 }).where(eq(scalesTable.id, scale.id)).returning())[0]!;
        await avisarRepublicacaoPendente(tx as unknown as Parameters<typeof avisarRepublicacaoPendente>[0], scale,
          desfazer ? `${pessoa.name} voltou ao horário normal de ${rotulo}` : `${pessoa.name} mudou o horário de ${rotulo} para ${faixa(inicio, typeof fim === "string" ? fim : null)}`, { areaIds: [pessoa.areaId], ...coleta.paraARepublicacao() });
      }
      await coleta.avisar(tx as unknown as typeof db, scale);
      return { mudou: true as const, scale };
    });
    res.json({ mudou: resultado.mudou, dia: await diaParaTela(actor.organizationId, locationId, date) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Não consegui mudar o horário agora. Nada foi alterado; tente de novo." });
  }
});

/**
 * "Saiu / não vem a partir de HH:MM" (Etapa 2, 24/10/2026): alguém passa mal ou precisa ir embora no meio do dia. Em vez de tirar a pessoa bloco por
 * bloco, uma ação só tira dela o resto do dia: o que começa a partir da hora sai; o que está em andamento (e não é show) termina mais cedo só para
 * ela; show sai pelo Livro do Dia (a vaga dela abre e aparece como "sem ninguém", quem confere decide quem cobre). Com `simular: true` só devolve a
 * prévia. Gravando, é UMA transação, UM evento no Registro (`escala.saiu_no_dia`, com o motivo) e UM aviso por acontecimento (quando a escala já foi
 * publicada, o mesmo aviso de "há o que republicar"). Dá para desfazer logo depois (`/escalas/dia/saiu/desfazer`).
 */
type BlocoDoDia = NonNullable<Awaited<ReturnType<typeof montarEscalaDoDia>>>["blocos"][number];
const emMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const TIPOS_DE_SAIDA = ["DOENCA", "EMERGENCIA", "OUTRO"] as const;
type PassoDaSaida = { acao: "SAI" | "TERMINA_MAIS_CEDO" | "SAI_DO_SHOW"; bloco: BlocoDoDia; sourceKey: string };
type ErroDaSaida = { ok: false; status: number; body: Record<string, unknown> };

async function planejarSaida(actor: Actor, { locationId, date, userId, corte }: { locationId: string; date: string; userId: string; corte: string }) {
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) return { ok: false, status: 404, body: { error: "NAO_ENCONTRADO", message: "Local não encontrado." } } satisfies ErroDaSaida;
  if (!(await canManageLocal(actor, locationId))) {
    return { ok: false, status: 403, body: { error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Tirar alguém do resto do dia é da Administração ou da Supervisão do local.` } } satisfies ErroDaSaida;
  }
  const [pessoa] = await db.select({ id: usersTable.id, areaId: usersTable.areaId, name: usersTable.name }).from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId))).limit(1);
  if (!pessoa) return { ok: false, status: 404, body: { error: "NAO_ENCONTRADO", message: "Pessoa não encontrada." } } satisfies ErroDaSaida;
  const dia = await montarEscalaDoDia(actor.organizationId, locationId, date);
  const naEscala = dia?.pessoas.find((p) => p.id === userId);
  if (!dia || !naEscala) return { ok: false, status: 409, body: { error: "PESSOA_FORA_DO_DIA", message: `${pessoa.name} não faz parte da escala deste dia neste local.` } } satisfies ErroDaSaida;
  if (naEscala.folga && !naEscala.chamadaNaFolga) {
    return { ok: false, status: 409, body: { error: "PESSOA_DE_FOLGA", message: `${pessoa.name} está de folga neste dia e não está na escala; não há o que tirar.` } } satisfies ErroDaSaida;
  }
  const limite = emMinutos(corte);
  const passos: PassoDaSaida[] = [];
  for (const bloco of dia.blocos) {
    if (!bloco.pessoaIds.includes(userId)) continue;
    const inicio = emMinutos(bloco.inicio), fim = bloco.fim ? emMinutos(bloco.fim) : inicio + 30;
    if (fim <= limite) continue; // já terminou antes da hora: não muda
    const sourceKey = bloco.horarioDela?.chaveOriginal ?? bloco.key;
    const ehShow = bloco.regra === "livro" || bloco.origem === "livro" || Boolean(bloco.dailyBookId);
    if (ehShow) passos.push({ acao: "SAI_DO_SHOW", bloco, sourceKey });
    else if (inicio >= limite) passos.push({ acao: "SAI", bloco, sourceKey });
    else if (bloco.origem === "programacao") passos.push({ acao: "TERMINA_MAIS_CEDO", bloco, sourceKey });
    else passos.push({ acao: "SAI", bloco, sourceKey });
  }
  if (!passos.length) {
    return { ok: false, status: 409, body: { error: "NADA_A_TIRAR", message: `${pessoa.name} não tem nada marcado a partir das ${corte}: o que ela faz hoje já termina antes dessa hora.` } } satisfies ErroDaSaida;
  }
  const scaleAntes = await findEscalaDoDia(locationId, date);
  const operationId = scaleAntes?.operationId ?? await operationForLocation(locationId);
  if (!operationId) return { ok: false, status: 409, body: { error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." } } satisfies ErroDaSaida;
  return { ok: true as const, location, pessoa, dia, passos, scaleAntes, operationId };
}

/** O que a prévia (e a resposta) mostram: quais atividades saem e quais posições de show ficam abertas. */
function resumoDaSaida(passos: PassoDaSaida[], userId: string, corte: string) {
  const shows = passos.filter((p) => p.acao === "SAI_DO_SHOW").map((p) => ({
    rotulo: p.bloco.rotulo, dailyBookId: p.bloco.dailyBookId,
    cobertura: (p.bloco.vagas ?? []).filter((v) => v.userId === userId).map((v) => ({ assignmentId: v.assignmentId, personagem: v.personagem, cobertoPor: null as string | null })),
  }));
  return {
    aPartirDe: corte,
    atividades: passos.map((p) => ({ key: p.bloco.key, rotulo: p.bloco.rotulo, inicio: p.bloco.inicio, fim: p.bloco.fim, acao: p.acao, ...(p.acao === "TERMINA_MAIS_CEDO" ? { novoFim: corte } : {}) })),
    shows,
    semNinguem: shows.reduce((n, s) => n + s.cobertura.length, 0),
  };
}

router.post("/escalas/dia/saiu", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date, userId, aPartirDe, motivo, tipo, simular } = req.body ?? {};
  if (typeof locationId !== "string" || typeof date !== "string" || !DATE.test(date) || typeof userId !== "string" || !userId) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, date e userId são obrigatórios." }); return;
  }
  if (typeof aPartirDe !== "string" || !HORA.test(aPartirDe)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Escolha a partir de que horas a pessoa sai (formato 14:30)." }); return; }
  const previa = simular === true;
  const porque = typeof motivo === "string" ? motivo.trim() : "";
  if (!previa && porque.length < 3) { res.status(400).json({ error: "MOTIVO_OBRIGATORIO", message: "Escreva o motivo (por exemplo: passou mal). Ele fica no Registro e vai no aviso." }); return; }
  if (tipo !== undefined && tipo !== null && !TIPOS_DE_SAIDA.includes(tipo)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "O tipo precisa ser DOENCA, EMERGENCIA ou OUTRO." }); return; }
  try {
    const plano = await planejarSaida(actor, { locationId, date, userId, corte: aPartirDe });
    if (!plano.ok) { res.status(plano.status).json(plano.body); return; }
    const { location, pessoa, passos, scaleAntes, operationId } = plano;
    const resumo = resumoDaSaida(passos, userId, aPartirDe);
    if (previa) { res.json({ simulado: true, pessoa: { id: pessoa.id, name: pessoa.name }, ...resumo }); return; }

    const coleta = await novaColeta(actor, locationId, date);
    const depoisDoCommit: (() => void)[] = [];
    type Registro = { tipo: "REMOVER" | "HORARIO"; ajusteId: string; sourceKey: string; anteriorId: string | null; horarioAnteriorId?: string | null } | { tipo: "VAGA"; dailyBookId: string; assignmentId: string; sourceKey: string };
    const registros: Registro[] = [];
    const resultado = await db.transaction(async (tx) => {
      let scale = scaleAntes ?? null;
      if (!scale) {
        const [created] = await tx.insert(scalesTable).values({
          operationId, locationId, title: `Escala do dia · ${location.name} · ${date}`, periodStart: date, periodEnd: date,
          status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
        }).returning();
        scale = created!;
        await writeHistoryEvent({ category: "SCALE", action: "escala.criada", title: "Escala do dia criada", narrative: `Escala de ${location.name} para ${date} criada.`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId, afterState: { scale } }, tx as unknown as HistoryExecutor);
      }
      const ativo = (sourceKey: string) => tx.select().from(escalaBlocoAjustesTable).where(and(
        eq(escalaBlocoAjustesTable.scaleId, scale!.id), eq(escalaBlocoAjustesTable.sourceKey, sourceKey), eq(escalaBlocoAjustesTable.userId, userId), eq(escalaBlocoAjustesTable.active, true),
      )).limit(1).then((r) => r[0] ?? null);
      const encerrar = (id: string) => tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: actor.sub, endedAt: new Date() }).where(eq(escalaBlocoAjustesTable.id, id));
      for (const passo of passos) {
        const { bloco, sourceKey } = passo;
        if (passo.acao === "TERMINA_MAIS_CEDO") {
          const chave = `h:${sourceKey}`;
          const anterior = await ativo(chave);
          if (anterior) await encerrar(anterior.id);
          const [novo] = await tx.insert(escalaBlocoAjustesTable).values({ scaleId: scale.id, sourceKey: chave, userId, action: "HORARIO", newStart: bloco.inicio, newEnd: aPartirDe, createdBy: actor.sub, motivo: porque }).returning();
          registros.push({ tipo: "HORARIO", ajusteId: novo!.id, sourceKey: chave, anteriorId: anterior?.id ?? null });
          continue;
        }
        let viaLivro = false;
        if (bloco.dailyBookId) {
          const vagasDela = (bloco.vagas ?? []).filter((v) => v.userId === userId);
          if (vagasDela.length) {
            for (const vaga of vagasDela) {
              if (await ajustarPessoaNoLivro({ dailyBookId: bloco.dailyBookId, userId, action: "REMOVER", actorId: actor.sub, assignmentId: vaga.assignmentId }, { tx: tx as unknown as typeof db, depoisDoCommit })) {
                viaLivro = true;
                registros.push({ tipo: "VAGA", dailyBookId: bloco.dailyBookId, assignmentId: vaga.assignmentId, sourceKey });
              }
            }
          } else viaLivro = await ajustarPessoaNoLivro({ dailyBookId: bloco.dailyBookId, userId, action: "REMOVER", actorId: actor.sub }, { tx: tx as unknown as typeof db, depoisDoCommit });
        }
        if (viaLivro) continue;
        const anterior = await ativo(sourceKey);
        if (anterior?.action === "REMOVER") continue;
        if (anterior) await encerrar(anterior.id);
        let horarioAnteriorId: string | null = null;
        if (bloco.horarioDela) { const h = await ativo(`h:${sourceKey}`); if (h) { await encerrar(h.id); horarioAnteriorId = h.id; } }
        const [novo] = await tx.insert(escalaBlocoAjustesTable).values({ scaleId: scale.id, sourceKey, userId, action: "REMOVER", createdBy: actor.sub, motivo: porque }).returning();
        registros.push({ tipo: "REMOVER", ajusteId: novo!.id, sourceKey, anteriorId: anterior?.id ?? null, horarioAnteriorId });
      }
      const publicada = escalaPublicada(scale.status);
      if (publicada) scale = (await tx.update(scalesTable).set({ alteradaDesde: scale.alteradaDesde ?? new Date(), updatedAt: new Date(), version: scale.version + 1 }).where(eq(scalesTable.id, scale.id)).returning())[0]!;
      const quantas = resumo.atividades.length;
      const mex = await coleta.registrar(scale.id, [{ pessoa, texto: `tirou ${pessoa.name} do resto do dia a partir das ${aPartirDe}` }]);
      const saiuId = await writeHistoryEvent({
        category: "SCALE", action: "escala.saiu_no_dia", title: "Pessoa saiu no meio do dia",
        narrative: `${pessoa.name} saiu ou não vem a partir das ${aPartirDe} em ${date}: ${quantas} ${quantas === 1 ? "atividade" : "atividades"} tirada${quantas === 1 ? "" : "s"} dela${resumo.semNinguem ? `, ${resumo.semNinguem} ${resumo.semNinguem === 1 ? "posição de show ficou sem ninguém" : "posições de show ficaram sem ninguém"}` : ""}. Motivo: ${porque}.`,
        entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
        beforeState: { pessoaId: userId, atividades: resumo.atividades.map((a) => ({ key: a.key, rotulo: a.rotulo, inicio: a.inicio, fim: a.fim })) },
        afterState: { pessoaId: userId, aPartirDe, acoes: resumo.atividades, shows: resumo.shows, registros },
        metadata: { reason: porque, tipo: tipo ?? "OUTRO", aPartirDe, pessoaId: userId, ...mex },
      }, tx as unknown as HistoryExecutor);
      if (publicada) {
        await avisarRepublicacaoPendente(tx as unknown as Parameters<typeof avisarRepublicacaoPendente>[0], scale,
          `${pessoa.name} saiu ou não vem a partir das ${aPartirDe} (${porque})`, { areaIds: [pessoa.areaId], ...coleta.paraARepublicacao() });
      }
      await coleta.avisar(tx as unknown as typeof db, scale);
      return { saiuId, scale };
    });
    for (const emitir of depoisDoCommit) { try { emitir(); } catch (err) { console.error(err); } }
    res.json({ saiuId: resultado.saiuId, pessoa: { id: pessoa.id, name: pessoa.name }, ...resumo, dia: await diaParaTela(actor.organizationId, locationId, date) });
  } catch (err) {
    console.error(err);
    const conflito = err instanceof VersionConflictError;
    res.status(conflito ? 409 : 500).json({
      error: conflito ? "LIVRO_MUDOU" : "ERRO_INTERNO",
      message: conflito ? "O Livro do Dia mudou enquanto você ajustava. Nada foi gravado; confira a tela e tente de novo." : "Não consegui tirar a pessoa do resto do dia. Nada foi gravado; tente de novo.",
      nadaFoiGravado: true,
    });
  }
});

/** Desfaz o último "saiu" apontado por `saiuId` (o id devolvido ao gravar): devolve a pessoa às atividades e horários de antes. Vaga de show que outra pessoa já ocupou não é tomada de volta. */
router.post("/escalas/dia/saiu/desfazer", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date, saiuId } = req.body ?? {};
  if (typeof locationId !== "string" || typeof date !== "string" || !DATE.test(date) || typeof saiuId !== "string" || !saiuId) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, date e saiuId são obrigatórios." }); return;
  }
  try {
    const location = await locationInOrg(locationId, actor.organizationId);
    if (!location) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
    if (!(await canManageLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Desfazer a saída de alguém é da Administração ou da Supervisão do local.` }); return; }
    const scale = await findEscalaDoDia(locationId, date);
    const [evento] = scale ? await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.id, saiuId), eq(historyEventsTable.entityId, scale.id), eq(historyEventsTable.action, "escala.saiu_no_dia"))).limit(1) : [];
    if (!scale || !evento) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Não achei essa saída neste dia. Atualize a tela." }); return; }
    const estado = (evento.afterState ?? {}) as { pessoaId?: string; aPartirDe?: string; registros?: { tipo: string; ajusteId?: string; anteriorId?: string | null; horarioAnteriorId?: string | null; dailyBookId?: string; assignmentId?: string }[] };
    const userId = estado.pessoaId ?? "";
    const [pessoa] = await db.select({ id: usersTable.id, areaId: usersTable.areaId, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!pessoa) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Pessoa não encontrada." }); return; }
    const [jaDesfeito] = await db.select({ id: historyEventsTable.id }).from(historyEventsTable).where(and(
      eq(historyEventsTable.entityId, scale.id), eq(historyEventsTable.action, "escala.saiu_desfeito"), sql`${historyEventsTable.metadata}->>'saiuId' = ${saiuId}`,
    )).limit(1);
    if (jaDesfeito) { res.status(409).json({ error: "JA_DESFEITO", message: `A saída de ${pessoa.name} já foi desfeita.` }); return; }

    const coleta = await novaColeta(actor, locationId, date);
    const depoisDoCommit: (() => void)[] = [];
    const naoDevolvidas: string[] = [];
    const operationId = scale.operationId;
    const resultado = await db.transaction(async (tx) => {
      for (const r of estado.registros ?? []) {
        if ((r.tipo === "REMOVER" || r.tipo === "HORARIO") && r.ajusteId) {
          await tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: actor.sub, endedAt: new Date() }).where(and(eq(escalaBlocoAjustesTable.id, r.ajusteId), eq(escalaBlocoAjustesTable.active, true)));
          for (const volta of [r.anteriorId, r.horarioAnteriorId]) {
            if (volta) await tx.update(escalaBlocoAjustesTable).set({ active: true, endedBy: null, endedAt: null }).where(eq(escalaBlocoAjustesTable.id, volta));
          }
        } else if (r.tipo === "VAGA" && r.dailyBookId && r.assignmentId) {
          const [vaga] = await tx.select({ userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, r.assignmentId)).limit(1);
          if (vaga && vaga.userId === null) {
            if (!(await ajustarPessoaNoLivro({ dailyBookId: r.dailyBookId, userId, action: "ADICIONAR", actorId: actor.sub, assignmentId: r.assignmentId }, { tx: tx as unknown as typeof db, depoisDoCommit }))) naoDevolvidas.push(r.assignmentId);
          } else naoDevolvidas.push(r.assignmentId);
        }
      }
      let atual = scale;
      const publicada = escalaPublicada(atual.status);
      if (publicada) atual = (await tx.update(scalesTable).set({ alteradaDesde: atual.alteradaDesde ?? new Date(), updatedAt: new Date(), version: atual.version + 1 }).where(eq(scalesTable.id, atual.id)).returning())[0]!;
      const mex = await coleta.registrar(atual.id, [{ pessoa, texto: `desfez a saída de ${pessoa.name}: ela volta ao dia` }]);
      await writeHistoryEvent({
        category: "SCALE", action: "escala.saiu_desfeito", title: "Saída no meio do dia desfeita",
        narrative: `A saída de ${pessoa.name} a partir das ${estado.aPartirDe ?? "?"} em ${date} foi desfeita.${naoDevolvidas.length ? ` ${naoDevolvidas.length === 1 ? "Uma posição de show já tinha outra pessoa e continuou como estava" : `${naoDevolvidas.length} posições de show já tinham outra pessoa e continuaram como estavam`}.` : ""}`,
        entityType: "scale", entityId: atual.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
        beforeState: { saiuId }, afterState: { pessoaId: userId, naoDevolvidas }, metadata: { saiuId, pessoaId: userId, ...mex },
      }, tx as unknown as HistoryExecutor);
      if (publicada) {
        await avisarRepublicacaoPendente(tx as unknown as Parameters<typeof avisarRepublicacaoPendente>[0], atual, `${pessoa.name} voltou ao dia (a saída foi desfeita)`, { areaIds: [pessoa.areaId], ...coleta.paraARepublicacao() });
      }
      await coleta.avisar(tx as unknown as typeof db, atual);
      return atual;
    });
    void resultado;
    for (const emitir of depoisDoCommit) { try { emitir(); } catch (err) { console.error(err); } }
    res.json({ desfeito: true, naoDevolvidas, dia: await diaParaTela(actor.organizationId, locationId, date) });
  } catch (err) {
    console.error(err);
    const conflito = err instanceof VersionConflictError;
    res.status(conflito ? 409 : 500).json({ error: conflito ? "LIVRO_MUDOU" : "ERRO_INTERNO", message: conflito ? "O Livro do Dia mudou enquanto você desfazia. Nada foi gravado; tente de novo." : "Não consegui desfazer a saída. Nada foi gravado; tente de novo.", nadaFoiGravado: true });
  }
});

router.post("/escalas/dia/ajustes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date, sourceKey, userId, action, mudancas, motivo } = req.body ?? {};
  const lote: { userId: string; action: "ADICIONAR" | "REMOVER"; assignmentId?: string | null }[] = Array.isArray(mudancas)
    ? mudancas.filter((m): m is { userId: string; action: "ADICIONAR" | "REMOVER"; assignmentId?: string | null } =>
      Boolean(m) && typeof (m as { userId?: unknown }).userId === "string" && ["ADICIONAR", "REMOVER"].includes((m as { action?: string }).action ?? ""))
    : [];
  if (typeof locationId !== "string" || typeof date !== "string" || !DATE.test(date) || typeof sourceKey !== "string" || !sourceKey
    || (!lote.length && (typeof userId !== "string" || !["ADICIONAR", "REMOVER"].includes(action)))) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, date, sourceKey e userId+action (ou mudancas) são obrigatórios." }); return;
  }
  const pedidos = lote.length ? lote : [{ userId: userId as string, action: action as "ADICIONAR" | "REMOVER" }];
  const porque = typeof motivo === "string" ? motivo.trim() : null;
  try {
    // Primeiro confere TODAS as pessoas sem gravar nada (folga sem motivo, regra de horário, área alheia…).
    const conferidos: AjusteConferido[] = [];
    for (const m of pedidos) {
      const r = await conferirAjuste(actor, { locationId, date, sourceKey, userId: m.userId, action: m.action, motivo: porque, assignmentId: typeof m.assignmentId === "string" ? m.assignmentId : null });
      if (!r.ok) { res.status(r.status).json({ ...r.body, ...(pedidos.length > 1 ? { nadaFoiGravado: true } : {}) }); return; }
      conferidos.push(r);
    }
    // Depois grava o lote inteiro numa transação só: se qualquer passo falhar, nada fica gravado.
    // Os avisos do Livro do Dia só saem depois que a transação fecha.
    const depoisDoCommit: (() => void)[] = [];
    const coleta = await novaColeta(actor, locationId, date);
    await db.transaction(async (tx) => {
      const estado = { scale: await findEscalaDoDia(locationId, date) };
      for (const c of conferidos) await gravarAjuste(actor, tx as unknown as typeof db, estado, c, depoisDoCommit, coleta);
      // UM aviso por acontecimento (o pedido todo), para a Supervisão de cada área de outra pessoa que foi mexida.
      if (estado.scale) await coleta.avisar(tx as unknown as typeof db, estado.scale);
    });
    for (const emitir of depoisDoCommit) { try { emitir(); } catch (err) { console.error(err); } }
    res.json({ dia: await diaParaTela(actor.organizationId, locationId, date) });
  } catch (err) {
    console.error(err);
    const conflito = err instanceof VersionConflictError;
    res.status(conflito ? 409 : 500).json({
      error: conflito ? "LIVRO_MUDOU" : "ERRO_INTERNO",
      message: conflito
        ? "O Livro do Dia mudou enquanto você ajustava. Nada foi gravado; confira a grade e tente de novo."
        : "Não foi possível gravar o ajuste. Nada foi gravado; confira a grade e tente de novo.",
      nadaFoiGravado: true,
      dia: await diaParaTela(actor.organizationId, locationId, date).catch(() => null),
    });
  }
});

type AjusteErro = { ok: false; status: number; body: Record<string, unknown> };
type AjusteConferido = {
  ok: true; locationId: string; date: string; sourceKey: string; userId: string; action: "ADICIONAR" | "REMOVER"; motivo?: string | null; assignmentId?: string | null;
  locationName: string; bloco: NonNullable<Awaited<ReturnType<typeof montarEscalaDoDia>>>["blocos"][number];
  pessoa: { id: string; areaId: string | null; name: string }; deFolga: boolean; operationId: string;
  regrasPassadas: Awaited<ReturnType<typeof verificarRegrasDeEscala>>;
};

/** Confere se uma pessoa pode entrar ou sair de um bloco neste dia, sem gravar nada; devolve o erro em vez de responder, para o lote reaproveitar. */
async function conferirAjuste(
  actor: Actor,
  { locationId, date, sourceKey, userId, action, motivo, assignmentId }: { locationId: string; date: string; sourceKey: string; userId: string; action: "ADICIONAR" | "REMOVER"; motivo?: string | null; assignmentId?: string | null },
): Promise<AjusteConferido | AjusteErro> {
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) return { ok: false, status: 404, body: { error: "Local não encontrado" } };
  if (!(await canManageLocal(actor, locationId))) return { ok: false, status: 403, body: { error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Ajustar a Escala é da Administração e da Supervisão do local.` } };
  const diaAntes = await montarEscalaDoDia(actor.organizationId, locationId, date);
  const bloco = diaAntes?.blocos.find((b) => b.key === sourceKey);
  if (!bloco) return { ok: false, status: 404, body: { error: "Bloco não encontrado nesta Escala" } };
  const [pessoa] = await db.select({ id: usersTable.id, areaId: usersTable.areaId, name: usersTable.name }).from(usersTable).where(and(
    eq(usersTable.id, userId), eq(usersTable.organizationId, actor.organizationId),
  )).limit(1);
  if (!pessoa) return { ok: false, status: 404, body: { error: "Pessoa não encontrada neste local" } };
  // Folga vence por padrão. Chamar alguém na folga é exceção: pede motivo escrito, e a folga
  // perdida fica pendente de decisão (remarcar para outro dia ou deixar como está).
  const deFolga = (diaAntes?.pessoas.find((p) => p.id === userId)?.folga ?? null) !== null;
  if (deFolga && action === "ADICIONAR" && !(motivo && motivo.trim().length >= 3)) {
    return { ok: false, status: 409, body: { error: "PESSOA_DE_FOLGA", message: `${pessoa.name} está de folga neste dia. Para chamar mesmo assim, escreva o motivo.`, pessoa: pessoa.name } };
  }
  const scale = await findEscalaDoDia(locationId, date);
  const operationId = scale?.operationId ?? await operationForLocation(locationId);
  if (!operationId) return { ok: false, status: 409, body: { error: "LOCAL_SEM_OPERACAO", message: "Este local ainda não está ligado a uma operação." } };
  // Restrição de horário e limite de shows do dia são proibição; passar delas é exceção à mão e pede motivo escrito.
  let regrasPassadas: Awaited<ReturnType<typeof verificarRegrasDeEscala>> = [];
  if (action === "ADICIONAR" && bloco.dailyBookId) {
    const [livro] = await db.select({ agendaEventId: dailyBooksTable.agendaEventId }).from(dailyBooksTable).where(eq(dailyBooksTable.id, bloco.dailyBookId)).limit(1);
    if (livro) regrasPassadas = await verificarRegrasDeEscala({ eventId: livro.agendaEventId, userId, date, operationId });
    if (regrasPassadas.length && !(motivo && motivo.trim().length >= 3)) {
      return { ok: false, status: 409, body: { error: codigoDaExcecao(regrasPassadas), message: `${pessoa.name} ${frasesDasRegras(regrasPassadas)}. Para escalar mesmo assim, escreva o motivo.`, pessoa: pessoa.name } };
    }
  }
  return { ok: true, locationId, date, sourceKey, userId, action, motivo, assignmentId, locationName: location.name, bloco, pessoa, deFolga, operationId, regrasPassadas };
}

/**
 * Grava um ajuste já conferido dentro da transação do lote. `estado.scale` é compartilhado entre as
 * pessoas do lote: a Escala criada pela primeira vale para as seguintes. O Registro, os avisos e a
 * mudança no Livro do Dia entram na mesma transação; só o evento do Livro espera o commit.
 */
async function gravarAjuste(
  actor: Actor, tx: typeof db, estado: { scale: Awaited<ReturnType<typeof findEscalaDoDia>> }, c: AjusteConferido, depoisDoCommit: (() => void)[], coleta: Awaited<ReturnType<typeof novaColeta>>,
): Promise<void> {
  const { locationId, date, sourceKey, userId, action, motivo, assignmentId, locationName, bloco, pessoa, deFolga, operationId, regrasPassadas } = c;
  // 09/10: bloco que vem de Livro do Dia muda o próprio Livro (vaga aberta / preenchida), para a
  // Escala e o Livro dizerem a mesma coisa. Sem vaga a mexer, o ajuste fica só na Escala.
  const viaLivro = bloco.dailyBookId ? await ajustarPessoaNoLivro({ dailyBookId: bloco.dailyBookId, userId, action, actorId: actor.sub, assignmentId }, { tx, depoisDoCommit }) : false;
  if (!estado.scale) {
    const [created] = await tx.insert(scalesTable).values({
      operationId, locationId, title: `Escala do dia · ${locationName} · ${date}`, periodStart: date, periodEnd: date,
      status: "DRAFT", generatedAt: new Date(), generatedBy: actor.sub, createdBy: actor.sub,
    }).returning();
    estado.scale = created!;
    await writeHistoryEvent({ category: "SCALE", action: "escala.criada", title: "Escala do dia criada", narrative: `Escala de ${locationName} para ${date} criada.`, entityType: "scale", entityId: created!.id, actorId: actor.sub, operationId, orgId: actor.organizationId, afterState: { scale: created } }, tx as unknown as HistoryExecutor);
  }
  let scale = estado.scale!;
  const [anterior] = await tx.select().from(escalaBlocoAjustesTable).where(and(
    eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.sourceKey, sourceKey), eq(escalaBlocoAjustesTable.userId, userId), eq(escalaBlocoAjustesTable.active, true),
  )).limit(1);
  if (!viaLivro && anterior?.action === action) return;
  if (anterior) await tx.update(escalaBlocoAjustesTable).set({ active: false, endedBy: actor.sub, endedAt: new Date() }).where(eq(escalaBlocoAjustesTable.id, anterior.id));
  // Chamada na folga numa vaga de show também grava o ajuste: é ele que diz à Escala que a pessoa foi chamada de propósito (com motivo);
  // sem ele, a folga vence e a pessoa que acabou de ser posta na vaga some do bloco.
  const [ajuste] = viaLivro && !(deFolga && action === "ADICIONAR") ? [null] : await tx.insert(escalaBlocoAjustesTable).values({
    scaleId: scale.id, sourceKey, userId, action, createdBy: actor.sub,
    motivo: motivo?.trim() || null, mesmoDeFolga: deFolga && action === "ADICIONAR",
  }).returning();
  if (escalaPublicada(scale.status)) {
    scale = (await tx.update(scalesTable).set({ alteradaDesde: scale.alteradaDesde ?? new Date(), updatedAt: new Date(), version: scale.version + 1 }).where(eq(scalesTable.id, scale.id)).returning())[0]!;
  }
  estado.scale = scale;
  const mex = await coleta.registrar(scale.id, [{ pessoa, texto: `${action === "ADICIONAR" ? `pôs ${pessoa.name} em` : `tirou ${pessoa.name} de`} ${bloco.rotulo}` }]);
  await writeHistoryEvent({
    category: "SCALE", action: action === "ADICIONAR" ? "escala.pessoa_adicionada" : "escala.pessoa_removida", title: action === "ADICIONAR" ? "Pessoa adicionada à Escala" : "Pessoa removida da Escala",
    narrative: `${action === "ADICIONAR" ? "Adicionou" : "Removeu"} ${pessoa.name} no bloco ${bloco.rotulo} de ${date}.${deFolga && action === "ADICIONAR" ? ` Estava de folga; chamada mesmo assim: ${motivo?.trim()}` : ""}${regrasPassadas.length ? ` Passou da regra (${frasesDasRegras(regrasPassadas)}); motivo: ${motivo?.trim()}` : ""}`, entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
    beforeState: { sourceKey, pessoaId: userId, ajuste: anterior?.action ?? null }, afterState: { ajuste, noLivroDoDia: viaLivro ? bloco.dailyBookId : null },
    ...(regrasPassadas.length || Object.keys(mex).length ? { metadata: { ...(regrasPassadas.length ? { regras: regrasPassadas.map((r) => r.regra), frases: regrasPassadas.map((r) => r.frase), motivo: motivo?.trim() ?? null } : {}), ...mex } } : {}),
  }, tx as unknown as HistoryExecutor);
  if (regrasPassadas.length) {
    await avisarExcecaoDeRegra(tx as never, {
      operationId, actorId: actor.sub, pessoaId: userId, pessoa: pessoa.name, areaId: pessoa.areaId, onde: `${locationName} · ${bloco.rotulo} às ${bloco.inicio} de ${dataPorExtenso(date)}`,
      regras: regrasPassadas, motivo: motivo?.trim() ?? "", entityType: "scale", entityId: scale.id, dedupe: `${scale.id}:${sourceKey}`,
    });
  }
  // Quem é chamado na folga precisa saber na hora: o aviso sai junto com o ajuste.
  if (deFolga && action === "ADICIONAR") {
    await enqueueNotification(tx as never, {
      userId, type: "escala.chamada_na_folga", category: "schedule",
      priority: date === operationalDate() ? "CRITICAL" : "IMPORTANT",
      title: `Você foi chamada na sua folga de ${dataPorExtenso(date)}`,
      message: `${locationName} · ${bloco.rotulo} às ${bloco.inicio}. Motivo: ${motivo?.trim()}. Fale com a supervisão se não puder.`,
      entityType: "scale", entityId: scale.id, actionUrl: APP_ROUTES.escalas,
    }, new Date(), { deduplicationKey: `folga-chamada:${scale.id}:${sourceKey}:${userId}` });
  }
  if (escalaPublicada(scale.status)) {
    await avisarRepublicacaoPendente(tx as unknown as Parameters<typeof avisarRepublicacaoPendente>[0], scale,
      `${pessoa.name} ${action === "ADICIONAR" ? "entrou em" : "saiu de"} ${bloco.rotulo}`, { areaIds: [pessoa.areaId], ...coleta.paraARepublicacao() });
  }
}

/**
 * A folga perdida foi resolvida (remarcada em Folgas, ou a pessoa preferiu deixar como está).
 * Só tira a pendência: a remarcação em si é feita na tela de Folgas, que é quem manda nelas.
 */
router.post("/escalas/dia/folga-resolvida", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, date, userId } = req.body ?? {};
  if (typeof locationId !== "string" || typeof date !== "string" || !DATE.test(date) || typeof userId !== "string") {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, date e userId são obrigatórios." }); return;
  }
  if (!(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  if (!(await canManageLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Você não decide folgas deste local" }); return; }
  const scale = await findEscalaDoDia(locationId, date);
  if (!scale) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Escala do dia não encontrada." }); return; }
  try {
    const resolvidos = await db.transaction(async (tx) => {
      const rows = await tx.update(escalaBlocoAjustesTable).set({ folgaDecididaEm: new Date() }).where(and(
        eq(escalaBlocoAjustesTable.scaleId, scale.id), eq(escalaBlocoAjustesTable.userId, userId),
        eq(escalaBlocoAjustesTable.active, true), eq(escalaBlocoAjustesTable.mesmoDeFolga, true),
      )).returning();
      if (rows.length) {
        const [pessoa] = await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        await writeHistoryEvent({
          category: "SCALE", action: "escala.folga_resolvida", title: "Folga chamada no dia resolvida",
          narrative: `A folga de ${pessoa?.name ?? "alguém"} em ${date} foi resolvida (remarcada ou mantida).`,
          entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId: scale.operationId, orgId: actor.organizationId,
          afterState: { userId, ajustes: rows.length },
        }, tx as unknown as HistoryExecutor);
      }
      return rows.length;
    });
    if (!resolvidos) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Esta pessoa não foi chamada na folga neste dia." }); return; }
    res.json({ dia: await diaParaTela(actor.organizationId, locationId, date) });
  } catch (err) { console.error(err); res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível resolver a folga. Tente de novo." }); }
});

/** Elenco confirma que leu a versão publicada que está vendo. */
router.post("/escalas/:id/confirmar", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  if (actor.role !== "MEMBER") { res.status(403).json({ error: "ACESSO_NEGADO", message: "Cada pessoa confirma a própria Escala" }); return; }
  const [scale] = await db.select().from(scalesTable).where(eq(scalesTable.id, req.params.id as string)).limit(1);
  if (!scale || !scale.locationId || !(await locationInOrg(scale.locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Escala não encontrada." }); return; }
  if (!escalaPublicada(scale.status)) { res.status(409).json({ error: "ESCALA_NAO_PUBLICADA", message: "A Escala ainda não foi publicada." }); return; }
  const dia = await montarEscalaDoDia(actor.organizationId, scale.locationId, scale.periodStart);
  if (!dia?.blocos.some((bloco) => bloco.pessoaIds.includes(actor.sub))) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Você só confirma uma escala em que está escalada." }); return; }
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
  } catch (err) { console.error(err); res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível confirmar a Escala. Tente de novo." }); }
});

/** Supervisão marca (ou desmarca) a parte da área dela como pronta. Cria a Escala do dia se ainda não existe. */
router.post("/escalas/dia/pronta", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, areaId, pronta } = req.body ?? {};
  const date = typeof req.body?.date === "string" && DATE.test(req.body.date) ? req.body.date : null;
  if (typeof locationId !== "string" || typeof areaId !== "string" || !date || typeof pronta !== "boolean") { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, areaId, date e pronta são obrigatórios." }); return; }
  const location = await locationInOrg(locationId, actor.organizationId);
  if (!location) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  const mine = await supervisedAreas(actor, locationId);
  if (actor.role !== "ADMIN" && !mine.includes(areaId)) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Você envia só a parte da sua área" }); return; }
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
          category: "SCALE", action: pronta ? "escala.area_pronta" : "escala.area_desmarcada", title: pronta ? "Parte da área enviada" : "Parte da área voltou a ser editada",
          narrative: `${pronta ? "Enviou" : "Voltou a editar"} a parte da área na Escala de ${location.name} (${date}).`,
          entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId, orgId: actor.organizationId,
          beforeState: { areaId, pronta: Boolean(current) }, afterState: { areaId, pronta },
        }, tx as unknown as HistoryExecutor);
      }
      return scale;
    });
    const diaDepois = await diaParaTela(actor.organizationId, locationId, date);
    // A última área enviou a parte: a Administração é avisada de que a escala está pronta para publicar.
    if (pronta && diaDepois && diaDepois.areas.length > 0 && diaDepois.areas.every((area) => area.pronta)) {
      const desde = diaDepois.areas.reduce((m, area) => (area.pronta && area.pronta.em > m ? area.pronta.em : m), new Date(0));
      await avisarTodasAsAreasEnviaram(db, result, location.name, desde, actor.sub);
    }
    res.json({ dia: diaDepois, scaleId: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro ao marcar a área. Tente de novo." });
  }
});

/** Administração publica o dia — só com todas as áreas do local prontas. */
export async function publicarOuRepublicar(req: any, res: any, republicar: boolean) {
  const actor = req.user! as Actor;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: "Quem publica o dia é a Administração" }); return; }
  const expectedVersion = Number(req.body?.expectedVersion);
  if (!Number.isInteger(expectedVersion)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "expectedVersion é obrigatório." }); return; }
  const [scale] = await db.select().from(scalesTable).where(eq(scalesTable.id, req.params.id)).limit(1);
  if (!scale || !scale.locationId || !(await locationInOrg(scale.locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Escala não encontrada." }); return; }
  if (scale.version !== expectedVersion) { res.status(409).json({ error: "CONCURRENT_MODIFICATION", message: "Alguém alterou esta escala depois que você a abriu.", expectedVersion, currentVersion: scale.version }); return; }
  if (republicar ? !escalaPublicada(scale.status) : scale.status !== "DRAFT") {
    res.status(409).json({ error: republicar ? "ESCALA_NAO_PUBLICADA" : "ESCALA_JA_PUBLICADA", message: republicar ? "Só republica escala já publicada." : "Esta escala já foi publicada." }); return;
  }
  const dia = await montarEscalaDoDia(actor.organizationId, scale.locationId, scale.periodStart);
  if (!republicar) {
    const faltam = (dia?.areas ?? []).filter((a) => !a.pronta).map((a) => a.name);
    if (faltam.length) { res.status(409).json({ error: "AREAS_PENDENTES", message: `Faltam enviar a parte: ${faltam.join(", ")}.`, faltam }); return; }
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
/** Republica a Escala a partir de outra rota (o Livro do Dia), com a mesma regra e o mesmo aviso da tela Escalas. */
export async function republicarEscalaPorChamada(actor: Actor, scaleId: string, expectedVersion: number) {
  const saida: { status: number; body: unknown } = { status: 200, body: null };
  const res = { status(c: number) { saida.status = c; return res; }, json(b: unknown) { saida.body = b; return res; } };
  await publicarOuRepublicar({ user: actor, body: { expectedVersion }, params: { id: scaleId } }, res, true);
  return saida;
}
router.post("/escalas/:id/publicar", requireAuth, requireOrganization, (req, res) => void publicarOuRepublicar(req, res, false).catch((err) => { console.error(err); res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível publicar a escala. Tente de novo." }); }));
router.post("/escalas/:id/republicar", requireAuth, requireOrganization, (req, res) => void publicarOuRepublicar(req, res, true).catch((err) => { console.error(err); res.status(500).json({ error: "ERRO_INTERNO", message: "Não foi possível republicar a escala. Tente de novo." }); }));

// ─── Tipos de atividade (0084) ───────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fraseSoAdministracao = (role: string) => `${fraseDeRecusaPorPerfil(["ADMIN"], role)} A lista de tipos de atividade é da Administração.`;
const FRASE_TIPO_JA_EXISTE = "Já existe um tipo com este nome neste local. Escolha outro nome ou desarquive o que já existe.";

/** Quem lê a lista de tipos do local: quem lê a Escala dele (a Supervisão escolhe tipo na Programação, mas só a Administração mexe na lista). */
router.get("/escalas/tipos", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!UUID.test(locationId) || !(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  if (!(await canReadLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Os tipos de atividade deste local não estão no seu acesso." }); return; }
  res.json({ tipos: await tiposDoLocal(locationId), podeEditar: actor.role === "ADMIN" });
});

/** Cria um tipo novo, ou (com `padrao: true`) os sete tipos prontos que o local ainda não tem. Só a Administração. */
router.post("/escalas/tipos", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, nome, cor, padrao } = (req.body ?? {}) as { locationId?: unknown; nome?: unknown; cor?: unknown; padrao?: unknown };
  if (typeof locationId !== "string" || !UUID.test(locationId) || !(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: fraseSoAdministracao(actor.role) }); return; }
  const local = await locationInOrg(locationId, actor.organizationId);
  if (padrao === true) {
    const existentes = await tiposDoLocal(locationId);
    const faltam = TIPOS_PRONTOS.filter((t) => !existentes.some((e) => e.chave === t.chave));
    if (!faltam.length) { res.status(409).json({ error: "JA_EXISTE", message: "Este local já tem os sete tipos prontos." }); return; }
    // Nome que já foi tomado por outro tipo ativo ganha "(pronto)" para não bater; a Administração renomeia depois.
    const nomes: string[] = [];
    for (const t of faltam) nomes.push((await nomeDeTipoEmUso(locationId, t.nome)) ? `${t.nome} (pronto)` : t.nome);
    const maiorOrdem = existentes.reduce((m, e) => Math.max(m, e.ordem), 0);
    const criados = await db.transaction(async (tx) => {
      const rows = await tx.insert(escalaTiposTable).values(faltam.map((t, i) => ({ organizationId: actor.organizationId, locationId, nome: nomes[i]!, cor: t.chave, chave: t.chave, ordem: maiorOrdem + i + 1 }))).returning();
      await writeHistoryEvent({ category: "SCALE", action: "tipo.padrao_criado", title: "Tipos de atividade prontos criados", narrative: `${rows.length} ${rows.length === 1 ? "tipo pronto criado" : "tipos prontos criados"} em ${local?.name ?? "um local"}.`, entityType: "local", entityId: locationId, actorId: actor.sub, orgId: actor.organizationId, afterState: { tipos: rows } }, tx as unknown as HistoryExecutor);
      return rows;
    });
    res.status(201).json({ tipos: await tiposDoLocal(locationId), criados: criados.length });
    return;
  }
  const nomeLimpo = nomeDeTipoValido(nome);
  if (!nomeLimpo) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_NOME_DE_TIPO }); return; }
  if (!CORES_DE_TIPO.includes(cor as CorDeTipo)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: `Escolha uma das cores da lista: ${CORES_DE_TIPO.join(", ")}.` }); return; }
  if (await nomeDeTipoEmUso(locationId, nomeLimpo)) { res.status(409).json({ error: "NOME_EM_USO", message: FRASE_TIPO_JA_EXISTE }); return; }
  const existentes = await tiposDoLocal(locationId);
  const criado = await db.transaction(async (tx) => {
    const [row] = await tx.insert(escalaTiposTable).values({ organizationId: actor.organizationId, locationId, nome: nomeLimpo, cor: cor as CorDeTipo, chave: null, ordem: existentes.reduce((m, e) => Math.max(m, e.ordem), 0) + 1 }).returning();
    await writeHistoryEvent({ category: "SCALE", action: "tipo.criado", title: "Tipo de atividade criado", narrative: `Tipo "${row!.nome}" criado em ${local?.name ?? "um local"} (cor ${row!.cor}).`, entityType: "escala_tipo", entityId: row!.id, actorId: actor.sub, orgId: actor.organizationId, afterState: { tipo: row } }, tx as unknown as HistoryExecutor);
    return row!;
  });
  res.status(201).json({ tipo: criado, tipos: await tiposDoLocal(locationId) });
});

/** Renomeia, muda a cor, arquiva ou desarquiva um tipo. Nada é apagado: o que já usa o tipo continua mostrando. Só a Administração. */
router.patch("/escalas/tipos/:id", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const id = req.params.id as string;
  const [atual] = UUID.test(id) ? await db.select().from(escalaTiposTable).where(and(eq(escalaTiposTable.id, id), eq(escalaTiposTable.organizationId, actor.organizationId))).limit(1) : [];
  if (!atual) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Tipo de atividade não encontrado." }); return; }
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: fraseSoAdministracao(actor.role) }); return; }
  const { nome, cor, active } = (req.body ?? {}) as { nome?: unknown; cor?: unknown; active?: unknown };
  const proximo = { nome: atual.nome, cor: atual.cor as string, active: atual.active };
  if (nome !== undefined) { const limpo = nomeDeTipoValido(nome); if (!limpo) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_NOME_DE_TIPO }); return; } proximo.nome = limpo; }
  if (cor !== undefined) { if (!CORES_DE_TIPO.includes(cor as CorDeTipo)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: `Escolha uma das cores da lista: ${CORES_DE_TIPO.join(", ")}.` }); return; } proximo.cor = cor as string; }
  if (active !== undefined) { if (typeof active !== "boolean") { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "active precisa ser verdadeiro ou falso." }); return; } proximo.active = active; }
  if (proximo.nome === atual.nome && proximo.cor === atual.cor && proximo.active === atual.active) { res.json({ tipo: atual, tipos: await tiposDoLocal(atual.locationId) }); return; }
  // Nome único entre os ativos do local: vale ao renomear e também ao desarquivar (o nome pode ter sido tomado enquanto estava arquivado).
  if (proximo.active && (await nomeDeTipoEmUso(atual.locationId, proximo.nome, atual.id))) { res.status(409).json({ error: "NOME_EM_USO", message: FRASE_TIPO_JA_EXISTE }); return; }
  const arquivou = atual.active && !proximo.active, desarquivou = !atual.active && proximo.active;
  const row = await db.transaction(async (tx) => {
    const [novo] = await tx.update(escalaTiposTable).set({ nome: proximo.nome, cor: proximo.cor as CorDeTipo, active: proximo.active, updatedAt: new Date() }).where(eq(escalaTiposTable.id, atual.id)).returning();
    const mudou = [proximo.nome !== atual.nome ? `nome de "${atual.nome}" para "${proximo.nome}"` : "", proximo.cor !== atual.cor ? `cor de ${atual.cor} para ${proximo.cor}` : ""].filter(Boolean).join("; ");
    await writeHistoryEvent({
      category: "SCALE", action: arquivou ? "tipo.arquivado" : desarquivou ? "tipo.desarquivado" : "tipo.alterado",
      title: arquivou ? "Tipo de atividade arquivado" : desarquivou ? "Tipo de atividade desarquivado" : "Tipo de atividade alterado",
      narrative: arquivou ? `Tipo "${atual.nome}" arquivado (sem exclusão).${mudou ? ` Também mudou: ${mudou}.` : ""}` : desarquivou ? `Tipo "${proximo.nome}" desarquivado.${mudou ? ` Também mudou: ${mudou}.` : ""}` : `Tipo "${atual.nome}": ${mudou}.`,
      entityType: "escala_tipo", entityId: atual.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: { tipo: atual }, afterState: { tipo: novo },
    }, tx as unknown as HistoryExecutor);
    return novo!;
  });
  res.json({ tipo: row, tipos: await tiposDoLocal(atual.locationId) });
});

// ─── Programação ─────────────────────────────────────────────────────────────

type BlocoInput = { weekday?: unknown; inicio?: unknown; fim?: unknown; rotulo?: unknown; regra?: unknown; showBookId?: unknown; tipoId?: unknown; flexivel?: unknown; areaIds?: unknown; grupoIds?: unknown; pessoaIds?: unknown; order?: unknown; active?: unknown };
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
  // Tipo de atividade (0084): vazio ou nulo tira o tipo escolhido e o app volta a adivinhar pelo nome. Quem confere se vale no local é a rota.
  if (body.tipoId !== undefined) out.tipoId = typeof body.tipoId === "string" && body.tipoId ? body.tipoId : null;
  // Bloco flexível (0085): janela em que cada pessoa cumpre quando der. Precisa ter fim (a janela) e não vale para show do Livro.
  if (body.flexivel !== undefined) out.flexivel = body.flexivel === true;
  if (out.regra === "livro" && !out.showBookId && !partial) return { ok: false, error: "Escolha de qual show é este bloco do Livro." };
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
  if (!locationId || !(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  if (!(await canReadLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Você não vê a Programação deste local." }); return; }
  // Molde arquivado continua na resposta (active: false) para poder ser reativado ou consultado.
  const programacoes = await db.select().from(programacoesTable).where(eq(programacoesTable.locationId, locationId)).orderBy(asc(programacoesTable.vigenciaInicio));
  // Blocos tirados do molde continuam na resposta (active: false) para a tela poder devolvê-los.
  const blocos = programacoes.length ? await db.select().from(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, programacoes.map((p) => p.id)))
    .orderBy(asc(programacaoBlocosTable.weekday), asc(programacaoBlocosTable.inicio), asc(programacaoBlocosTable.order)) : [];
  res.json({ programacoes: programacoes.map((p) => ({ ...p, blocos: blocos.filter((b) => b.programacaoId === p.id) })), podeEditar: await canManageLocal(actor, locationId), tipos: await tiposDoLocal(locationId), podeEditarTipos: actor.role === "ADMIN" });
});

router.post("/programacoes", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const { locationId, nome, vigenciaInicio, vigenciaFim } = req.body ?? {};
  if (typeof locationId !== "string" || typeof nome !== "string" || !nome.trim() || !DATE.test(String(vigenciaInicio)) || !DATE.test(String(vigenciaFim)) || vigenciaFim < vigenciaInicio) {
    res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationId, nome e vigência (início ≤ fim) são obrigatórios." }); return;
  }
  if (!(await locationInOrg(locationId, actor.organizationId))) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  if (!(await canManageLocal(actor, locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Programação é da Administração e da Supervisão do local" }); return; }
  // Temporada nova costuma repetir o molde da anterior: `copiarDeId` traz os blocos junto.
  const copiarDeId = typeof (req.body as { copiarDeId?: unknown })?.copiarDeId === "string" ? (req.body as { copiarDeId: string }).copiarDeId : null;
  const origem = copiarDeId ? await programacaoInOrg(copiarDeId, actor.organizationId) : null;
  if (copiarDeId && (!origem || origem.locationId !== locationId)) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Molde de origem não encontrado neste local." }); return; }
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(programacoesTable).values({ organizationId: actor.organizationId, locationId, nome: nome.trim(), vigenciaInicio, vigenciaFim, createdBy: actor.sub }).returning();
    let copiados: (typeof programacaoBlocosTable.$inferSelect)[] = [];
    if (origem) {
      const blocos = await tx.select().from(programacaoBlocosTable).where(and(eq(programacaoBlocosTable.programacaoId, origem.id), eq(programacaoBlocosTable.active, true)));
      if (blocos.length) {
        copiados = await tx.insert(programacaoBlocosTable).values(blocos.map(({ id: _id, programacaoId: _p, createdAt: _c, updatedAt: _u, ...bloco }) => ({ ...bloco, programacaoId: row!.id }))).returning();
      }
    }
    await writeHistoryEvent({ category: "SCALE", action: "programacao.criada", title: "Programação criada", narrative: origem ? `Programação ${row!.nome} criada a partir de ${origem.nome}, com ${copiados.length} blocos.` : `Programação ${row!.nome} criada.`, entityType: "programacao", entityId: row!.id, actorId: actor.sub, orgId: actor.organizationId, afterState: { programacao: row, copiadaDe: origem?.id ?? null, blocos: copiados.length } }, tx as unknown as HistoryExecutor);
    return { row: row!, copiados };
  });
  res.status(201).json({ programacao: { ...created.row, blocos: created.copiados } });
});

router.patch("/programacoes/:id", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const current = await programacaoInOrg(req.params.id as string, actor.organizationId);
  if (!current) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Programação não encontrada." }); return; }
  if (!(await canManageLocal(actor, current.locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Alterar a Programação é da Administração ou da Supervisão do local.` }); return; }
  const { nome, vigenciaInicio, vigenciaFim, active } = req.body ?? {};
  const next = {
    nome: typeof nome === "string" && nome.trim() ? nome.trim() : current.nome,
    vigenciaInicio: DATE.test(String(vigenciaInicio)) ? vigenciaInicio as string : current.vigenciaInicio,
    vigenciaFim: DATE.test(String(vigenciaFim)) ? vigenciaFim as string : current.vigenciaFim,
    active: typeof active === "boolean" ? active : current.active,
  };
  if (next.vigenciaFim < next.vigenciaInicio) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "vigência: início ≤ fim." }); return; }
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
  if (!programacao) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Programação não encontrada." }); return; }
  if (!(await canManageLocal(actor, programacao.locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Alterar a Programação é da Administração ou da Supervisão do local.` }); return; }
  // A mesma atividade costuma repetir em vários dias da semana (treino de segunda a sexta):
  // `weekdays` cria um bloco por dia de uma vez; `weekday` sozinho continua valendo.
  const dias = Array.isArray((req.body as { weekdays?: unknown })?.weekdays)
    ? [...new Set(((req.body as { weekdays: unknown[] }).weekdays).map(Number))]
    : [];
  if (dias.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "weekdays: dias de 0 (domingo) a 6 (sábado)." }); return; }
  const parsed = parseBloco({ ...(req.body ?? {}), weekday: dias.length ? dias[0] : (req.body as BlocoInput)?.weekday }, false);
  if (!parsed.ok) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: parsed.error }); return; }
  if (parsed.value.flexivel === true && !parsed.value.fim) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_FLEXIVEL_SEM_FIM }); return; }
  if (parsed.value.flexivel === true && parsed.value.regra === "livro") { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_FLEXIVEL_LIVRO }); return; }
  if (typeof parsed.value.showBookId === "string") {
    const [show] = await db.select({ id: showBooksTable.id }).from(showBooksTable).where(eq(showBooksTable.id, parsed.value.showBookId)).limit(1);
    if (!show) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Show não encontrado." }); return; }
  }
  if (typeof parsed.value.tipoId === "string") {
    const recusaTipo = await recusaDoTipo(parsed.value.tipoId, programacao.locationId);
    if (recusaTipo) { res.status(400).json({ error: "TIPO_INVALIDO", message: recusaTipo }); return; }
  }
  const alvos = dias.length ? dias.sort((a, b) => a - b) : [parsed.value.weekday as number];
  const created = await db.transaction(async (tx) => {
    const rows = await tx.insert(programacaoBlocosTable).values(alvos.map((weekday) => ({
      programacaoId: programacao.id, ...(parsed.value as { weekday: number; inicio: string; rotulo: string; regra: RegraBloco }), weekday,
    }))).returning();
    for (const row of rows) {
      await writeHistoryEvent({ category: "SCALE", action: "programacao.bloco_criado", title: "Bloco da Programação criado", narrative: `Bloco ${row.rotulo} ${row.inicio.slice(0, 5)} em ${DIAS_DA_SEMANA[row.weekday]} na programação ${programacao.nome}.`, entityType: "programacao", entityId: programacao.id, actorId: actor.sub, orgId: actor.organizationId, afterState: { bloco: row } }, tx as unknown as HistoryExecutor);
    }
    return rows;
  });
  res.status(201).json({ bloco: created[0], blocos: created });
});

const FRASE_FLEXIVEL_SEM_FIM = "Um bloco flexível é uma janela (por exemplo, almoço entre 11:00 e 13:00): informe também o horário em que ela termina.";
const FRASE_FLEXIVEL_LIVRO = "Bloco de show do Livro do Dia não pode ser flexível: o show tem hora marcada. Desligue a opção \"flexível\" ou escolha outra regra de quem entra.";
const MENSAGEM_BLOCO_MUDOU = "Outra pessoa alterou este bloco depois que você abriu. Nada foi salvo: a tela foi atualizada, confira a versão nova e refaça a mudança se ainda for preciso.";
router.patch("/programacoes/:id/blocos/:blocoId", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user! as Actor;
  const programacao = await programacaoInOrg(req.params.id as string, actor.organizationId);
  if (!programacao) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Programação não encontrada." }); return; }
  if (!(await canManageLocal(actor, programacao.locationId))) { res.status(403).json({ error: "ACESSO_NEGADO", message: `${fraseDeRecusaPorPerfil(["ADMIN", "SUPERVISOR_A"], actor.role)} Alterar a Programação é da Administração ou da Supervisão do local.` }); return; }
  const [current] = await db.select().from(programacaoBlocosTable).where(and(eq(programacaoBlocosTable.id, req.params.blocoId as string), eq(programacaoBlocosTable.programacaoId, programacao.id))).limit(1);
  if (!current) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Bloco não encontrado." }); return; }
  // Versão que a pessoa tinha aberta (o "atualizado em" do bloco). Se outra pessoa salvou antes, nada é gravado: quem salva por
  // cima apagaria, em silêncio, a mudança que já estava feita. Quem não manda a versão segue como antes.
  const baseUpdatedAt = (req.body as { baseUpdatedAt?: unknown } | undefined)?.baseUpdatedAt;
  const versaoAberta = baseUpdatedAt === undefined ? undefined : (typeof baseUpdatedAt === "string" && !Number.isNaN(Date.parse(baseUpdatedAt)) ? new Date(baseUpdatedAt).getTime() : null);
  if (versaoAberta !== undefined && versaoAberta !== current.updatedAt.getTime()) { res.status(409).json({ error: "VERSAO_MUDOU", message: MENSAGEM_BLOCO_MUDOU }); return; }
  const parsed = parseBloco(req.body ?? {}, true);
  if (!parsed.ok) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: parsed.error }); return; }
  // Tipo arquivado só passa quando é o que o bloco já tinha: mexer no horário de um bloco antigo não pode esbarrar num tipo arquivado depois.
  if (typeof parsed.value.tipoId === "string") {
    const recusaTipo = await recusaDoTipo(parsed.value.tipoId, programacao.locationId, current.tipoId);
    if (recusaTipo) { res.status(400).json({ error: "TIPO_INVALIDO", message: recusaTipo }); return; }
  }
  const merged = { ...current, ...parsed.value } as typeof current;
  if (merged.regra === "livro" && !merged.showBookId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "Escolha de qual show é este bloco do Livro.." }); return; }
  if (merged.flexivel && !merged.fim) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_FLEXIVEL_SEM_FIM }); return; }
  if (merged.flexivel && merged.regra === "livro") { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_FLEXIVEL_LIVRO }); return; }
  if (merged.fim && merged.fim.slice(0, 5) <= merged.inicio.slice(0, 5)) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "fim precisa ser depois do início." }); return; }
  const updated = await db.transaction(async (tx) => {
    // A conferência vale também na gravação (duas pessoas salvando ao mesmo tempo): só grava se o bloco ainda é o que foi lido.
    const [row] = await tx.update(programacaoBlocosTable).set({ ...parsed.value, updatedAt: new Date() })
      .where(and(eq(programacaoBlocosTable.id, current.id), sql`date_trunc('milliseconds', ${programacaoBlocosTable.updatedAt}) = ${current.updatedAt}`)).returning();
    if (!row) return null;
    await writeHistoryEvent({ category: "SCALE", action: row!.active ? "programacao.bloco_alterado" : "programacao.bloco_desativado", title: row!.active ? "Bloco da Programação alterado" : "Bloco da Programação desativado", narrative: `Bloco ${row!.rotulo} ${row!.active ? "alterado" : "desativado (sem exclusão)"} na programação ${programacao.nome}.${row!.flexivel !== current.flexivel ? (row!.flexivel ? " Passou a ser flexível: uma janela, sem choque e sem nomes na escala." : " Deixou de ser flexível: voltou a ter horário fixo.") : ""}`, entityType: "programacao", entityId: programacao.id, actorId: actor.sub, orgId: actor.organizationId, beforeState: { bloco: current }, afterState: { bloco: row } }, tx as unknown as HistoryExecutor);
    return row!;
  });
  if (!updated) { res.status(409).json({ error: "VERSAO_MUDOU", message: MENSAGEM_BLOCO_MUDOU }); return; }
  res.json({ bloco: updated });
});

export default router;
