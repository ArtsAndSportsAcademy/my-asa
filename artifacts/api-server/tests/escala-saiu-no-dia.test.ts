/**
 * "Saiu / não vem a partir de HH:MM" (Etapa 2, 24/10/2026): alguém passa mal no meio do dia e a Administração (ou a Supervisão da área da pessoa) tira
 * dela o resto do dia de uma vez. O que começa a partir da hora sai; o que está em andamento (e não é show) termina mais cedo só para ela; show sai pelo
 * Livro do Dia e a vaga abre. A prévia não grava nada. Gravando: um só evento no Registro, um só aviso por acontecimento, a escala publicada fica
 * "alterada depois de publicada". Dá para desfazer. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable,
  db, escalaBlocoAjustesTable, historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable, operationsTable, organizationsTable, pool, programacaoBlocosTable,
  programacoesTable, scaleAllocationsTable, scalesTable, showBookBlocksTable, showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; pessoaIds: string[]; vazio: boolean; dailyBookId: string | null; vagas?: { assignmentId: string; userId: string | null }[]; horarioDela?: { chaveOriginal: string; inicio: string; fim: string | null } };
type Dia = { escala: { id: string; status: string; version: number; alteradaDesde: string | null } | null; blocos: Bloco[] };

async function run() {
  const tag = `sai_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), supPat = await mk("deborah", pat!.id), supBai = await mk("victor", bai!.id), supFora = await mk("fora", bai!.id);
  const jeff = await mk("jeff", pat!.id), carol = await mk("carol", pat!.id);
  const todos = [admin, dir, supPat, supBai, supFora, jeff, carol];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supBai.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supFora.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[jeff, carol].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }, { areaId: bai!.id, locationId: local!.id, supervisorId: supBai.id }]);
  // Um show com uma posição fixa no Jeff: o Livro do Dia dele convoca o Jeff.
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show Teatro`, createdBy: admin.id }).returning();
  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Abertura", order: 0 }).returning();
  const [bloco0] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: cena!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
  const [papel] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: bloco0!.id, name: "BL 01", order: 0 }).returning();
  await db.insert(showBookLinesTable).values({ positionId: papel!.id, type: "FIXED_PERSON", config: { userId: jeff.id }, order: 0 });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(90_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asPat = as(supPat, "SUPERVISOR_A"), asBai = as(supBai, "SUPERVISOR_A"), asFora = as(supFora, "SUPERVISOR_A"), asJeff = as(jeff, "MEMBER");

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    for (const b of [
      { weekday: 1, inicio: "09:00", fim: "10:00", rotulo: "ENSAIO", regra: "pessoas", pessoaIds: [jeff.id] },
      { weekday: 1, inicio: "10:00", fim: "11:30", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [jeff.id, carol.id, supPat.id] }, // pessoas escolhidas (e não "área"): duas atividades específicas no mesmo horário continuam em choque; com bloco geral a específica ganha (pacote E)
      { weekday: 1, inicio: "11:00", fim: "12:00", rotulo: "AULA", regra: "pessoas", pessoaIds: [jeff.id, carol.id] },
      { weekday: 1, inicio: "14:00", rotulo: "SHOW TEATRO", regra: "livro", showBookId: show!.id },
    ]) assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, b)).status === 201, `bloco ${b.rotulo} criado na Programação`);
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date })).status === 201, "a Escala e o Livro do Dia nasceram");

    const dia = async () => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const achar = (d: Dia, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo && !b.horarioDela);
    const saiu = (fn: typeof asAdmin, body: Record<string, unknown>) => fn("POST", "/escalas/dia/saiu", { locationId: local!.id, date, userId: jeff.id, aPartirDe: "10:30", motivo: "Passou mal", ...body });
    const eventos = async (acao: string, escalaId: string) => (await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, escalaId), eq(historyEventsTable.action, acao))));
    const avisosDaAdmin = async () => ((await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'scale.needs_republish'`, [admin.id])).rows[0].n as number);

    let d = await dia();
    const ensaio = achar(d, "ENSAIO")!, treino = achar(d, "TREINO GELO")!, aula = achar(d, "AULA")!, teatro = achar(d, "SHOW TEATRO")!;
    assert([ensaio, treino, aula, teatro].every((b) => b.pessoaIds.includes(jeff.id)) && Boolean(teatro.dailyBookId), "ponto de partida: o Jeff está no ensaio, no treino, na aula e no show do Livro");
    const escalaId = d.escala!.id;

    // ── quem pode, e as recusas com frase; erros de quem digitou são 400 ──
    const dirR = await saiu(asDir, {});
    assert(dirR.status === 403 && /Direção/.test(dirR.text) && /Administração/.test(dirR.text) && !/Role .* is not authorized/.test(dirR.text), "Direção é recusada com a frase de quem pode e do perfil de quem tentou");
    assert((await saiu(asJeff, {})).status === 403, "Elenco não tira ninguém do dia");
    const outra = await saiu(asFora, {});
    assert(outra.status === 403 && /Supervisão do local/.test(outra.text), "Supervisão que não supervisiona nenhuma área deste local é recusada com frase");
    assert((await saiu(asAdmin, { motivo: "" })).status === 400 && /motivo/i.test((await saiu(asAdmin, { motivo: "ab" })).text), "motivo é obrigatório (mínimo 3 letras)");
    assert((await saiu(asAdmin, { aPartirDe: "25:99" })).status === 400 && /formato 14:30/.test((await saiu(asAdmin, { aPartirDe: "abc" })).text), "hora que não existe é 400 com frase");
    assert((await saiu(asAdmin, { tipo: "OUTRA_COISA" })).status === 400, "tipo fora da lista é 400");
    const tarde = await saiu(asAdmin, { aPartirDe: "18:00" });
    assert(tarde.status === 409 && /nada marcado a partir das 18:00/.test(tarde.text), "hora depois de tudo: 409 com frase de que não há o que tirar");
    assert((await saiu(asAdmin, { userId: "00000000-0000-0000-0000-000000000000" })).status === 404, "pessoa que não existe é 404");
    assert((await db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.scaleId, escalaId))).length === 0 && (await eventos("escala.saiu_no_dia", escalaId)).length === 0, "as recusas não gravaram nada");

    // ── prévia: diz o que acontece e não grava nada ──
    const previa = await saiu(asPat, { simular: true, motivo: undefined });
    const acoes = Object.fromEntries(((previa.body.atividades ?? []) as { rotulo: string; acao: string; novoFim?: string }[]).map((a) => [a.rotulo, a]));
    assert(previa.status === 200 && previa.body.simulado === true && !acoes["ENSAIO"], "a prévia não inclui o ensaio, que termina antes da hora");
    assert(acoes["TREINO GELO"]?.acao === "TERMINA_MAIS_CEDO" && acoes["TREINO GELO"]?.novoFim === "10:30", "treino em andamento termina mais cedo só para ela (10:30)");
    assert(acoes["AULA"]?.acao === "SAI" && acoes["SHOW TEATRO"]?.acao === "SAI_DO_SHOW", "o que começa depois sai; show sai pelo Livro");
    assert(previa.body.semNinguem === 1 && previa.body.shows?.[0]?.dailyBookId === teatro.dailyBookId, "a prévia conta a posição do show que fica sem ninguém");
    assert((await db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.scaleId, escalaId))).length === 0 && (await eventos("escala.saiu_no_dia", escalaId)).length === 0, "a prévia não gravou nada no banco nem no Registro");

    // ── a escala está publicada: a saída pede republicação e avisa uma vez ──
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, escalaId));
    const antes = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!;
    const avisosAntes = await avisosDaAdmin();
    const ok = await saiu(asPat, { tipo: "DOENCA" });
    assert(ok.status === 200 && Boolean(ok.body.saiuId), "a Supervisão da área tira o Jeff do resto do dia");
    d = ok.body.dia as Dia;
    assert(!achar(d, "AULA")!.pessoaIds.includes(jeff.id) && achar(d, "AULA")!.pessoaIds.includes(carol.id), "saiu da aula (a Carol continua)");
    const treinoDele = d.blocos.find((b) => b.rotulo === "TREINO GELO" && b.horarioDela && b.pessoaIds.includes(jeff.id));
    assert(Boolean(treinoDele) && treinoDele!.inicio === "10:00" && treinoDele!.fim === "10:30" && achar(d, "TREINO GELO")!.pessoaIds.includes(carol.id) && !achar(d, "TREINO GELO")!.pessoaIds.includes(jeff.id), "o treino dele termina às 10:30; o da Carol não mudou");
    const showDepois = achar(d, "SHOW TEATRO")!;
    assert(!showDepois.pessoaIds.includes(jeff.id) && (showDepois.vagas ?? []).some((v) => v.userId === null), "saiu do show: a vaga dele no Livro abriu e aparece sem ninguém");
    assert(achar(d, "ENSAIO")!.pessoaIds.includes(jeff.id), "o que já tinha terminado continua como estava");
    const depois = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!;
    assert(depois.alteradaDesde !== null && depois.version === antes.version + 1, "escala publicada: marcou \"alterada depois de publicada\" e subiu a versão uma vez só");
    const registro = await eventos("escala.saiu_no_dia", escalaId);
    assert(registro.length === 1 && /Passou mal/.test(registro[0]?.narrative ?? "") && (registro[0]?.metadata as { tipo?: string })?.tipo === "DOENCA", "um só evento no Registro, com o motivo e o tipo");
    assert((await avisosDaAdmin()) === avisosAntes + 1, "um só aviso de republicação para a Administração (não um por atividade)");
    const repete = await saiu(asPat, {});
    assert(repete.status === 409 && /nada marcado/.test(repete.text) && (await eventos("escala.saiu_no_dia", escalaId)).length === 1, "repetir o mesmo pedido não grava de novo");

    // ── desfazer ──
    assert((await asFora("POST", "/escalas/dia/saiu/desfazer", { locationId: local!.id, date, saiuId: ok.body.saiuId })).status === 403, "Supervisão sem área neste local não desfaz");
    assert((await asAdmin("POST", "/escalas/dia/saiu/desfazer", { locationId: local!.id, date, saiuId: "00000000-0000-0000-0000-000000000000" })).status === 404, "saída que não existe: 404 com frase");
    const volta = await asPat("POST", "/escalas/dia/saiu/desfazer", { locationId: local!.id, date, saiuId: ok.body.saiuId });
    assert(volta.status === 200 && volta.body.desfeito === true && (volta.body.naoDevolvidas ?? []).length === 0, "a Supervisão da área desfaz a saída");
    d = volta.body.dia as Dia;
    assert(achar(d, "AULA")!.pessoaIds.includes(jeff.id) && achar(d, "TREINO GELO")!.pessoaIds.includes(jeff.id) && !d.blocos.some((b) => b.horarioDela) && achar(d, "SHOW TEATRO")!.pessoaIds.includes(jeff.id), "o Jeff volta à aula, ao treino inteiro e ao show");
    assert((await eventos("escala.saiu_desfeito", escalaId)).length === 1, "desfazer também entra no Registro, uma vez");
    const jaFoi = await asAdmin("POST", "/escalas/dia/saiu/desfazer", { locationId: local!.id, date, saiuId: ok.body.saiuId });
    assert(jaFoi.status === 409 && /já foi desfeita/.test(jaFoi.text), "desfazer duas vezes: 409 com frase");

    // ── escala em rascunho: grava sem aviso de republicação, e quem já ocupou a vaga não é tirado ao desfazer ──
    await db.update(scalesTable).set({ status: "DRAFT", publishedAt: null, alteradaDesde: null }).where(eq(scalesTable.id, escalaId));
    const segundo = await saiu(asAdmin, { aPartirDe: "13:00", motivo: "Emergência em casa", tipo: "EMERGENCIA" });
    assert(segundo.status === 200 && !achar(segundo.body.dia as Dia, "SHOW TEATRO")!.pessoaIds.includes(jeff.id), "Administração tira o Jeff só do show da tarde (a partir das 13:00)");
    const vaga = (achar(segundo.body.dia as Dia, "SHOW TEATRO")!.vagas ?? []).find((v) => v.userId === null);
    if (vaga) await db.update(dailyBookAssignmentsTable).set({ userId: carol.id, status: "ASSIGNED", manual: true }).where(eq(dailyBookAssignmentsTable.id, vaga.assignmentId));
    const volta2 = await asAdmin("POST", "/escalas/dia/saiu/desfazer", { locationId: local!.id, date, saiuId: segundo.body.saiuId });
    assert(volta2.status === 200 && (volta2.body.naoDevolvidas ?? []).length === 1 && !achar(volta2.body.dia as Dia, "SHOW TEATRO")!.pessoaIds.includes(jeff.id) && achar(volta2.body.dia as Dia, "SHOW TEATRO")!.pessoaIds.includes(carol.id), "se outra pessoa já ocupou a vaga do show, desfazer não a toma de volta e diz isso");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    const mudancas = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), ...(mudancas.length ? [inArray(historyEventsTable.moId, mudancas.map((c) => c.id))] : [])));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) {
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, escalas.map((s) => s.id)));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, escalas.map((s) => s.id)));
    }
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, show!.id));
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, show!.id));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, papel!.id));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-saiu-no-dia`);
  process.stdout.write(`escala-saiu-no-dia: ${passed} asserts passed\n`);
}

process.stdout.write("escala-saiu-no-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
