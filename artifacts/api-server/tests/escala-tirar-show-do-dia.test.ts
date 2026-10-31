/**
 * "Tirar este show do dia" na Escala (30/10/2026) e "Refazer os Livros deste dia".
 * O show normal sai do dia sem motivo obrigatório; o Livro fica cancelado COM a marca de "tirado do dia", por isso gerar o dia não o recria
 * (o cancelamento comum, sem a marca, continua podendo ser regerado); a Escala lista o show em "tirado deste dia"; dia publicado fica
 * "alterado depois de publicado" e a Administração é avisada; dá para desfazer e o Livro volta como estava. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable, db,
  escalaAreasProntasTable, escalaBlocoAjustesTable, historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scaleAllocationsTable, scalesTable, showBookBlocksTable, showBookLinesTable, showBookRolesTable,
  showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { resumoDoMes } from "../src/services/escala-mes.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Vaga = { assignmentId: string; personagem: string; userId: string | null };
type Bloco = { key: string; rotulo: string; pessoaIds: string[]; dailyBookId: string | null; vagas?: Vaga[]; sinal: string | null };
type Dia = { blocos: Bloco[]; escala: { id: string; status: string; version: number; alteradaDesde: string | null } | null; showsTirados?: { dailyBookId: string; rotulo: string; inicio: string | null; porNome: string | null; motivo: string | null }[] };

async function run() {
  const tag = `tirar_${Date.now()}`;
  const DIA = "2026-11-02"; // segunda
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Acqua` }).returning();
  const [outroLocal] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snow` }).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: local!.id }, { operationId: operation!.id, locationId: outroLocal!.id }]);
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Mergulhadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: local!.id,
  }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id), supDeFora = await mk("supfora", area!.id), julia = await mk("julia", area!.id), carol = await mk("carol", area!.id), membro = await mk("membro", area!.id);
  const todos = [admin, dir, sup, supDeFora, julia, carol, membro];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supDeFora.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[julia, carol, membro].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  // A Supervisão "sup" cuida de uma área neste local; a "supfora" cuida só do outro local.
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: area!.id, locationId: local!.id, supervisorId: sup.id }, { areaId: area!.id, locationId: outroLocal!.id, supervisorId: supDeFora.id }]);

  const showsCriados: { id: string; roles: { id: string }[] }[] = [];
  const novoShow = async (titulo: string, titular: { id: string }) => {
    const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_${titulo}`, createdBy: admin.id }).returning();
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Abertura", order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
    const roles = await db.insert(showBookRolesTable).values([{ showBookId: show!.id, blockId: block!.id, name: "BL 01", order: 0 }]).returning();
    await db.insert(showBookLinesTable).values([{ positionId: roles[0]!.id, type: "FIXED_PERSON", config: { userId: titular.id }, order: 0 }]);
    showsCriados.push({ id: show!.id, roles });
    return show!;
  };
  const opening = await novoShow("OPENING", julia), boasVindas = await novoShow("BOAS", carol);
  const R_OPENING = "OPENING", R_BOAS = "BOAS";

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin.id, "ADMIN"), asSup = as(sup.id, "SUPERVISOR_A"), asForaDoLocal = as(supDeFora.id, "SUPERVISOR_A"), asDir = as(dir.id, "DIR"), asMembro = as(membro.id, "MEMBER");
    const dia = async () => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${DIA}`)).body.dia as Dia);
    const achar = (d: Dia, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo);
    const livrosDoShow = (showId: string) => db.select().from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, showId));
    const tirar = (as_: ReturnType<typeof as>, dailyBookId: string, extra: Record<string, unknown> = {}) => as_("POST", "/escalas/dia/tirar-show", { locationId: local!.id, date: DIA, dailyBookId, ...extra });
    const desfazer = (as_: ReturnType<typeof as>, dailyBookId: string) => as_("POST", "/escalas/dia/tirar-show/desfazer", { locationId: local!.id, date: DIA, dailyBookId });

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Teste", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-11-30" })).body.programacao as { id: string };
    assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "10:00", fim: "10:30", rotulo: "OPENING", regra: "livro", showBookId: opening.id })).status === 201, "bloco do OPENING na Programação");
    assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "11:00", fim: "11:30", rotulo: "BOAS", regra: "livro", showBookId: boasVindas.id })).status === 201, "bloco do BOAS VINDAS na Programação");
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date: DIA })).status === 201, "dia gerado com os dois Livros");
    let d = await dia();
    const bOpening = achar(d, R_OPENING), bBoas = achar(d, R_BOAS);
    assert(Boolean(bOpening?.dailyBookId) && Boolean(bBoas?.dailyBookId), "os dois shows aparecem na Escala com o Livro do Dia");
    assert(!d.showsTirados, "sem nada tirado, a Escala não traz a lista de tirados");
    const livroOpening = bOpening!.dailyBookId!, livroBoas = bBoas!.dailyBookId!;

    // ── quem pode, e a frase da recusa ──
    const nega = async (quem: ReturnType<typeof as>, nome: string) => {
      const r = await tirar(quem, livroOpening);
      assert(r.status === 403 && /Administração ou da Supervisão do local/.test(r.text) && !/is not authorized/i.test(r.text), `${nome}: 403 com a frase em português que diz quem pode`);
      const u = await desfazer(quem, livroOpening);
      assert(u.status === 403, `${nome}: também não devolve show ao dia`);
    };
    await nega(asMembro, "Elenco"); await nega(asDir, "Direção"); await nega(asForaDoLocal, "Supervisão de outro local");
    assert((await livrosDoShow(opening.id))[0]!.status === "DRAFT", "as recusas não mexeram no Livro");
    assert((await asSup("POST", "/escalas/dia/tirar-show", { locationId: local!.id, date: DIA })).status === 400, "sem dailyBookId: 400 com a lista do que falta");
    assert((await tirar(asSup, "isto-nao-e-um-id")).status === 404, "id quebrado: 404 com frase, nunca 500");
    assert((await tirar(asSup, "00000000-0000-4000-8000-000000000000")).status === 404, "Livro que não existe neste dia: 404");
    assert((await asSup("POST", "/escalas/dia/tirar-show", { locationId: local!.id, date: DIA, dailyBookId: livroOpening, motivo: 12 })).status === 400, "motivo que não é texto: 400");

    // ── Supervisão do local tira o OPENING sem motivo ──
    const t = await tirar(asSup, livroOpening);
    assert(t.status === 200 && t.body.tirado?.dailyBookId === livroOpening, "Supervisão do local tira o show sem escrever motivo");
    d = await dia();
    assert(!achar(d, R_OPENING), "o show tirado sai da grade (não vira 'Livro ainda não gerado')");
    assert(Boolean(achar(d, R_BOAS)?.dailyBookId), "o outro show do dia segue na Escala");
    assert(d.showsTirados?.length === 1 && d.showsTirados[0]!.dailyBookId === livroOpening && d.showsTirados[0]!.porNome === sup.name && d.showsTirados[0]!.motivo === null, "a Escala lista o show em 'tirado deste dia', com quem tirou e sem motivo");
    assert(d.showsTirados?.[0]?.rotulo === R_OPENING && d.showsTirados[0]!.inicio === "10:00", "a lista usa o nome e a hora do bloco da Programação, para dois shows parecidos não ficarem iguais");
    const [cancelado] = await livrosDoShow(opening.id);
    assert(cancelado!.status === "CANCELLED" && Boolean((cancelado!.snapshotJson as { tiradoDoDia?: unknown }).tiradoDoDia), "o Livro ficou cancelado com a marca de tirado do dia");
    const registro = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "escala.show_tirado_do_dia")));
    assert(registro.length === 1 && /Sem motivo informado/.test(registro[0]!.narrative ?? ""), "um evento no Registro, dizendo que não houve motivo");
    assert((await tirar(asAdmin, livroOpening)).status === 409, "tirar de novo o mesmo show: 409 com frase");

    // ── gerar o dia NÃO recria o Livro tirado ──
    assert([200, 201].includes((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date: DIA })).status), "gerar o dia de novo funciona");
    const depoisDeGerar = await livrosDoShow(opening.id);
    assert(depoisDeGerar.length === 1 && depoisDeGerar[0]!.status === "CANCELLED", "gerar o dia não recriou o Livro do show tirado");
    d = await dia();
    assert(!achar(d, R_OPENING) && d.showsTirados?.length === 1, "o show segue tirado depois de gerar o dia");

    // ── o resumo do mês conta o show tirado como resolvido, não como Livro que falta ──
    const mes = await resumoDoMes(org!.id, local!.id, 2026, 11, "2026-10-01");
    const doDia = mes?.dias.find((x) => x.date === DIA);
    assert(Boolean(doDia) && doDia!.estado === "completo" && doDia!.livrosGerados === 2, "o resumo do mês não pede o Livro do show tirado");

    // ── contraste: cancelar o Livro pelo cancelamento comum (sem a marca) continua podendo ser regerado ──
    const [livroBoasLinha] = await livrosDoShow(boasVindas.id);
    const cancelaComum = await asAdmin("POST", `/daily-book/${livroBoas}/cancel`, { reason: "teste", expectedVersion: livroBoasLinha!.version });
    assert(cancelaComum.status === 200, "cancelamento comum do Livro funciona como sempre");
    assert([200, 201].includes((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date: DIA })).status), "gerar o dia depois do cancelamento comum");
    const boasDepois = await livrosDoShow(boasVindas.id);
    assert(boasDepois.length === 2 && boasDepois.filter((l) => l.status === "DRAFT").length === 1, "o cancelamento comum (sem marca) é regerado, como sempre foi");

    // ── desfazer ──
    assert((await desfazer(asMembro, livroOpening)).status === 403, "Elenco não desfaz");
    assert((await desfazer(asSup, livroBoas)).status === 409, "desfazer um Livro que não foi tirado pela Escala: 409, sem virar 'reabrir' geral");
    const volta = await desfazer(asSup, livroOpening);
    assert(volta.status === 200 && volta.body.desfeito === true, "Supervisão do local devolve o show ao dia sem motivo");
    d = await dia();
    assert(Boolean(achar(d, R_OPENING)?.dailyBookId) && !d.showsTirados, "o show voltou à Escala e a lista de tirados sumiu");
    const [devolvido] = await livrosDoShow(opening.id);
    assert(devolvido!.status === "DRAFT" && !(devolvido!.snapshotJson as { tiradoDoDia?: unknown }).tiradoDoDia && devolvido!.cancelledAt === null, "o Livro voltou a rascunho, sem a marca");
    assert((await desfazer(asSup, livroOpening)).status === 409, "desfazer duas vezes: 409");
    const doisEventos = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.action, ["escala.show_tirado_do_dia", "escala.show_devolvido_ao_dia"])));
    assert(doisEventos.length === 2, "tirar e devolver ficam os dois no Registro");

    // ── dia publicado: marca 'alterada depois de publicada' e avisa a Administração ──
    const escalaId = d.escala!.id;
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date(), publishedBy: admin.id }).where(eq(scalesTable.id, escalaId));
    await db.update(dailyBooksTable).set({ status: "PUBLISHED" }).where(eq(dailyBooksTable.id, livroOpening));
    const versaoAntes = d.escala!.version;
    const publicado = await tirar(asAdmin, livroOpening, { motivo: "Entrou o Mergulhadores de Halloween" });
    assert(publicado.status === 200 && publicado.body.publicada === true, "tirar show de dia publicado funciona");
    d = await dia();
    assert(d.escala!.alteradaDesde !== null && d.escala!.version === versaoAntes + 1, "o dia fica 'alterado depois de publicado' e a versão sobe");
    assert(d.showsTirados?.[0]?.motivo === "Entrou o Mergulhadores de Halloween", "o motivo escrito aparece na lista de tirados");
    const avisos = await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1`, [admin.id]);
    assert((avisos.rows[0].n as number) >= 1, "a Administração recebe o aviso de que há o que republicar");
    const volta2 = await desfazer(asAdmin, livroOpening);
    const [republicadoLivro] = await livrosDoShow(opening.id);
    assert(volta2.status === 200 && republicadoLivro!.status === "PUBLISHED", "devolver ao dia restaura o Livro publicado como estava");

    // ── Livro executado não sai do dia ──
    await db.update(dailyBooksTable).set({ status: "EXECUTED" }).where(eq(dailyBooksTable.id, livroOpening));
    const executado = await tirar(asAdmin, livroOpening);
    assert(executado.status === 409 && /executado/.test(executado.text), "show executado não sai: 409 com a frase");
    await db.update(dailyBooksTable).set({ status: "DRAFT" }).where(eq(dailyBooksTable.id, livroOpening));

    // ── Refazer os Livros deste dia: a prévia ──
    for (const quem of [["Elenco", asMembro], ["Direção", asDir], ["Supervisão de outro local", asForaDoLocal]] as const) {
      assert((await quem[1]("GET", `/escalas/dia/refazer?locationId=${local!.id}&date=${DIA}`)).status === 403, `prévia do refazer: ${quem[0]} recebe 403`);
    }
    assert((await asSup("GET", `/escalas/dia/refazer?locationId=${local!.id}`)).status === 400, "prévia do refazer sem a data: 400");
    // Uma vaga mexida à mão no OPENING conta como o que se perde.
    d = await dia();
    const vagaOpening = achar(d, R_OPENING)!.vagas![0]!;
    assert((await asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date: DIA, sourceKey: achar(d, R_OPENING)!.key, mudancas: [{ userId: membro.id, action: "ADICIONAR", assignmentId: vagaOpening.assignmentId }] })).status === 200, "uma vaga trocada à mão");
    const previa = (await asSup("GET", `/escalas/dia/refazer?locationId=${local!.id}&date=${DIA}`)).body as { publicada: boolean; livros: { dailyBookId: string; rotulo: string; refaz: boolean; version: number; vagasMexidas: number; motivoDeNao?: string }[] };
    const pOpening = previa.livros.find((l) => l.dailyBookId === livroOpening);
    assert(previa.livros.length === 2 && pOpening?.refaz === true && pOpening.vagasMexidas === 1, "a prévia lista os dois Livros em rascunho e conta 1 vaga mexida no OPENING");
    assert(previa.publicada === true, "a prévia diz que o dia está publicado (precisa republicar depois)");
    assert(!previa.livros.some((l) => l.dailyBookId === livroBoas), "o Livro cancelado pelo cancelamento comum não entra na prévia");
    // Refazer pela mesma rota do Livro do Dia, com a versão da prévia.
    const refeito = await asSup("POST", `/daily-book/${livroOpening}/regenerate`, { reason: "refazer o dia", expectedVersion: pOpening!.version });
    assert(refeito.status === 200, "a Supervisão refaz o Livro pela rota do Livro do Dia");
    d = await dia();
    assert(achar(d, R_OPENING)!.vagas![0]!.userId === julia.id, "refeito: a vaga volta ao titular do Livro do Show (a troca à mão se perdeu, como a prévia avisou)");
    // Livro publicado fica de fora da prévia como 'só rascunho'.
    await db.update(dailyBooksTable).set({ status: "PUBLISHED" }).where(eq(dailyBooksTable.id, livroOpening));
    const previa2 = (await asAdmin("GET", `/escalas/dia/refazer?locationId=${local!.id}&date=${DIA}`)).body as typeof previa;
    const pub = previa2.livros.find((l) => l.dailyBookId === livroOpening);
    assert(pub?.refaz === false && /publicado/.test(pub.motivoDeNao ?? ""), "Livro publicado não se refaz, e a prévia diz o porquê");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (scales.length) {
      await db.delete(escalaAreasProntasTable).where(inArray(escalaAreasProntasTable.scaleId, scales.map((s) => s.id)));
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, scales.map((s) => s.id)));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, scales.map((s) => s.id)));
    }
    const showIds = showsCriados.map((s) => s.id);
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(inArray(dailyBooksTable.showBookId, showIds));
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
    await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, showIds));
    for (const s of showsCriados) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, s.roles.map((r) => r.id)));
    await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
    await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, showIds));
    await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, showIds));
    await db.delete(showBooksTable).where(inArray(showBooksTable.id, showIds));
    await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [local!.id, outroLocal!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-tirar-show-do-dia`);
  process.stdout.write(`escala-tirar-show-do-dia: ${passed} asserts passed\n`);
}

process.stdout.write("escala-tirar-show-do-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
