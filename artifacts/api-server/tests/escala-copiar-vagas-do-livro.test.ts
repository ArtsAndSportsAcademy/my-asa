/**
 * Copiar de outro dia, parte 2 (H2): quem faz cada vaga do show no Livro do Dia de origem passa a fazer a mesma vaga no Livro do destino.
 * Passa pelas regras (folga vence), não gera Livro (se o do destino não existe, a prévia diz), "juntar" não mexe em vaga trocada à mão,
 * o Registro leva o que mudou e o desfazer devolve só o que ninguém mexeu depois. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable, db,
  escalaAreasProntasTable, escalaBlocoAjustesTable, folgasTable, historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scaleAllocationsTable, scalesTable, showBookBlocksTable, showBookLinesTable, showBookRolesTable,
  showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { trocarVagasNoLivro } from "../src/routes/daily-book.js";
import { VersionConflictError } from "../src/lib/versioning.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Vaga = { assignmentId: string; personagem: string; userId: string | null };
type Bloco = { key: string; rotulo: string; pessoaIds: string[]; vagas?: Vaga[] };
type Dia = { blocos: Bloco[]; escala: { id: string } | null };
type Resumo = { copia: { vagas: number }; jaEstava: number; foraDe: { tipo: string; pessoa?: string; frase: string }[] };

async function run() {
  const tag = `vagas_${Date.now()}`;
  const ORIGEM = "2026-10-05", DEST = "2026-10-12", SEM_LIVRO = "2026-10-19"; // segundas
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Rinque` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [pat] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null, located = true) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: located ? local!.id : null,
  }).returning())[0]!;
  const admin = await mk("admin", null, false), dir = await mk("dir", null, false), supPat = await mk("deborah", pat!.id), julia = await mk("julia", pat!.id), carol = await mk("carol", pat!.id);
  const dana = await mk("dana", pat!.id), edu = await mk("edu", pat!.id);
  const todos = [admin, dir, supPat, julia, carol, dana, edu];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[julia, carol, dana, edu].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }]);
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Abertura", order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
  const roles = await db.insert(showBookRolesTable).values([
    { showBookId: show!.id, blockId: block!.id, name: "BL 01", order: 0 }, { showBookId: show!.id, blockId: block!.id, name: "BL 02", order: 1 },
  ]).returning();
  await db.insert(showBookLinesTable).values([
    { positionId: roles[0]!.id, type: "FIXED_PERSON", config: { userId: julia.id }, order: 0 },
    { positionId: roles[1]!.id, type: "FIXED_PERSON", config: { userId: carol.id }, order: 0 },
  ]);

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
    const asAdmin = as(admin.id, "ADMIN"), asPat = as(supPat.id, "SUPERVISOR_A"), asDir = as(dir.id, "DIR");
    const dia = async (date: string) => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const livro = (d: Dia) => d.blocos.find((b) => b.rotulo === "SHOW")!;
    const nomeDaVaga = (d: Dia, personagem: string) => livro(d).vagas!.find((v) => v.personagem === personagem)?.userId ?? null;

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Teste", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "SHOW", regra: "livro", showBookId: show!.id })).status === 201, "bloco de show na Programação");
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date: ORIGEM })).status === 201, "origem gerada com o Livro do Dia");
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date: DEST })).status === 201, "destino gerado com o Livro do Dia");

    // Origem: a Dana faz BL 01 e o Edu faz BL 02 (troca à mão pela Escala, por personagem).
    let o = await dia(ORIGEM);
    const vaga = (d: Dia, p: string) => livro(d).vagas!.find((v) => v.personagem === p)!;
    const troca = await asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date: ORIGEM, sourceKey: livro(o).key, mudancas: [
      { userId: dana.id, action: "ADICIONAR", assignmentId: vaga(o, "BL 01").assignmentId }, { userId: edu.id, action: "ADICIONAR", assignmentId: vaga(o, "BL 02").assignmentId },
    ] });
    assert(troca.status === 200, "origem: trocas por personagem gravadas");
    o = await dia(ORIGEM);
    assert(nomeDaVaga(o, "BL 01") === dana.id && nomeDaVaga(o, "BL 02") === edu.id, "origem: BL 01 é da Dana e BL 02 do Edu");
    let d = await dia(DEST);
    assert(nomeDaVaga(d, "BL 01") === julia.id && nomeDaVaga(d, "BL 02") === carol.id, "destino antes: os titulares (Julia e Carol)");
    // O Edu está de folga no destino.
    await db.insert(folgasTable).values({ userId: edu.id, operationId: operation!.id, type: "DAY_OFF", startDate: DEST, endDate: DEST, createdBy: admin.id });

    const pedido = (extra: Record<string, unknown> = {}) => ({ locationId: local!.id, origem: ORIGEM, destino: DEST, itens: { atividades: false, ajustes: false, horarios: false, edicoes: false, chamadas: false, livros: true }, ...extra });

    // ── a origem aparece na lista mesmo só com Livros ──
    const origens = (await asPat("GET", `/escalas/copia/origens?locationId=${local!.id}&date=${DEST}`)).body.origens as { date: string; livros: number }[];
    assert(origens.some((x) => x.date === ORIGEM && x.livros === 1), "a lista de origens conta o Livro do Dia de cada dia");

    // ── prévia ──
    const previa = (await asPat("POST", "/escalas/dia/copiar", pedido({ simular: true }))).body.resumo as Resumo;
    assert(previa.copia.vagas === 1, "a prévia conta 1 vaga a copiar (BL 01)");
    assert(previa.foraDe.some((f) => f.tipo === "folga" && f.pessoa?.endsWith("edu") && /BL 02/.test(f.frase)), "o Edu fica de fora pela folga, dizendo em que vaga");
    assert(nomeDaVaga(await dia(DEST), "BL 01") === julia.id, "a prévia não gravou nada");
    const semLivros = (await asPat("POST", "/escalas/dia/copiar", pedido({ simular: true, itens: { livros: false } }))).body.resumo as Resumo;
    assert(semLivros.copia.vagas === 0, "sem marcar 'Livros', nenhuma vaga entra");
    assert((await asDir("POST", "/escalas/dia/copiar", pedido({ simular: true }))).status === 403, "Direção não copia vagas");

    // ── copia, pela Supervisão do local ──
    const copia = await asPat("POST", "/escalas/dia/copiar", pedido());
    assert(copia.status === 201 && copia.body.gravou === true, "a Supervisão do local copia as vagas");
    d = await dia(DEST);
    assert(nomeDaVaga(d, "BL 01") === dana.id, "destino: BL 01 passou a ser da Dana");
    assert(nomeDaVaga(d, "BL 02") === carol.id, "destino: BL 02 seguiu com a Carol (o Edu está de folga)");
    const [livroDest] = await db.select().from(dailyBooksTable).innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id)).where(eq(agendaEventsTable.date, DEST));
    const vagasDest = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, livroDest!.daily_books.id));
    assert(vagasDest.some((v) => v.userId === dana.id && v.manual), "a vaga copiada virou exceção do dia (manual): o motor não a recalcula");
    const evento = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.id, copia.body.eventoId)))[0]!;
    assert(/1 vaga de Livro do Dia/.test(evento.narrative) && ((evento.afterState as { livros?: unknown[] }).livros ?? []).length === 1, "o Registro diz quantas vagas e guarda o que mudou");

    const repete = await asPat("POST", "/escalas/dia/copiar", pedido());
    assert(repete.status === 200 && repete.body.gravou === false && (repete.body.resumo as Resumo).jaEstava >= 1, "copiar de novo não muda nada: a vaga já estava");

    // ── desfazer devolve a vaga ──
    const desfaz = await asPat("POST", "/escalas/dia/copiar/desfazer", { eventoId: copia.body.eventoId });
    assert(desfaz.status === 200 && desfaz.body.ok === true, "desfazer a cópia");
    d = await dia(DEST);
    assert(nomeDaVaga(d, "BL 01") === julia.id, "destino: BL 01 voltou à Julia");
    const [aposDesfazer] = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, vaga(d, "BL 01").assignmentId));
    assert(aposDesfazer?.manual === false, "e voltou a ser calculada pelo motor (não manual)");

    // ── alguém mexeu depois: o desfazer diz o que não dá ──
    const copia2 = await asPat("POST", "/escalas/dia/copiar", pedido());
    assert(copia2.status === 201, "copia de novo");
    d = await dia(DEST);
    assert((await asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date: DEST, sourceKey: livro(d).key, mudancas: [{ userId: julia.id, action: "ADICIONAR", assignmentId: vaga(d, "BL 01").assignmentId }] })).status === 200, "alguém devolve a vaga à Julia à mão");
    const desfaz2 = await asPat("POST", "/escalas/dia/copiar/desfazer", { eventoId: copia2.body.eventoId });
    assert(desfaz2.status === 200 && desfaz2.body.ok === false && (desfaz2.body.naoDesfeitos as string[]).some((f) => /vaga/.test(f)), "desfazer diz que a vaga já foi mexida");

    // ── Livro que não foi gerado no destino ──
    const semLivro = (await asPat("POST", "/escalas/dia/copiar", pedido({ destino: SEM_LIVRO, simular: true }))).body.resumo as Resumo;
    assert(semLivro.copia.vagas === 0 && semLivro.foraDe.some((f) => f.tipo === "livro_nao_gerado" && /ainda não foi gerado/.test(f.frase)), "Livro não gerado no destino: a prévia diz, e nada é copiado");

    // ── conferência de 30/10: a gravação usa a versão do Livro que a conferência leu; se alguém mexeu no meio, nada é gravado ──
    {
      const alvo = vaga(await dia(DEST), "BL 01");
      const [linha] = await db.select({ dailyBookId: dailyBookAssignmentsTable.dailyBookId }).from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, alvo.assignmentId));
      const [livro] = await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, linha!.dailyBookId));
      let recusou = false;
      try {
        await trocarVagasNoLivro({ dailyBookId: livro!.id, actorId: admin.id, trocas: [{ assignmentId: alvo.assignmentId, para: { userId: null, status: "OPEN", manual: false } }], origem: "teste", versaoLida: livro!.version - 1 }, { tx: db, depoisDoCommit: [] });
      } catch (err) { recusou = err instanceof VersionConflictError; }
      const [depoisDaRecusa] = await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, livro!.id));
      assert(recusou && depoisDaRecusa!.version === livro!.version, "versão do Livro diferente da lida na conferência: recusa e não grava nada");
    }

    // ── destino publicado: marca 'alterada depois de publicada' ──
    const escalaDest = (await dia(DEST)).escala!.id;
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, escalaDest));
    const antes = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaDest)))[0]!;
    // devolve a vaga ao titular para haver o que copiar de novo
    d = await dia(DEST);
    await db.update(dailyBookAssignmentsTable).set({ userId: julia.id, manual: false }).where(eq(dailyBookAssignmentsTable.id, vaga(d, "BL 01").assignmentId));
    const pub = await asPat("POST", "/escalas/dia/copiar", pedido());
    const depois = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaDest)))[0]!;
    assert(pub.status === 201 && depois.alteradaDesde !== null && depois.version === antes.version + 1, "destino publicado: marca 'alterada depois de publicada' e sobe a versão");
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
    await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, pat!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-copiar-vagas-do-livro`);
  process.stdout.write(`escala-copiar-vagas-do-livro: ${passed} asserts passed\n`);
}

process.stdout.write("escala-copiar-vagas-do-livro: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
