/**
 * A equipe por local passa a valer na Escala do dia (0088, pacote O, passo O3): só os blocos gerais ("todo mundo", "a área" e a janela de
 * almoço) olham a equipe; grupo e pessoas escolhidas pelo nome não filtram. A regra é por pessoa (sem marca nenhuma = como antes; com marca,
 * só entra onde e quando a marca manda; sem marca no dia = "sem local hoje"), e o imprevisto do dia, com horário ou não, vale por cima.
 * Escala já publicada não muda para quem faz: a Administração é avisada de que há o que republicar. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaLocalDoDiaTable, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { writeHistoryEvent } from "../src/lib/history-helper.js";
import { convocacaoPorPessoa, montarEscalaDoDia } from "../src/services/escala-dia.js";
import { janelasSeCruzam, montarRegraDaEquipe } from "../src/services/escala-equipe-regra.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}
const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

async function run() {
  // ── regras puras ──
  assert(janelasSeCruzam({ inicio: null, fim: "13:00" }, { inicio: "11:00", fim: "13:00" }), "janela 'até 13:00' cruza o almoço das 11 às 13");
  assert(!janelasSeCruzam({ inicio: "14:00", fim: null }, { inicio: "11:00", fim: "13:00" }), "janela 'a partir de 14:00' não cruza o almoço das 11 às 13");
  assert(!janelasSeCruzam({ inicio: null, fim: "09:00" }, { inicio: "09:00", fim: "10:00" }), "janelas que só se encostam (fim 09:00, início 09:00) não se cruzam");
  assert(janelasSeCruzam({ inicio: null, fim: null }, { inicio: "08:00", fim: null }), "marca do dia inteiro cruza bloco sem fim");
  assert(janelasSeCruzam({ inicio: "08:00", fim: "13:00" }, { inicio: "09:00", fim: null }) && !janelasSeCruzam({ inicio: "08:00", fim: "13:00" }, { inicio: "13:00", fim: null }), "bloco sem fim conta como um ponto dentro ou fora da marca");
  const L1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", L2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const P = "11111111-1111-4111-8111-111111111111", Q = "22222222-2222-4222-8222-222222222222";
  const vazia = montarRegraDaEquipe([], [], 4);
  assert(!vazia.ativa && vazia.entra(P, L1, "08:00", "09:00") && !vazia.semLocalHoje(P), "sem nenhuma marca a regra fica desligada: todo mundo entra e ninguém é 'sem local'");
  const r = montarRegraDaEquipe([{ userId: P, locationId: L1, weekday: 4, inicio: null, fim: null }], [], 4);
  assert(r.entra(P, L1, "08:00", "09:00") && !r.entra(P, L2, "08:00", "09:00") && r.entra(Q, L2, "08:00", "09:00"), "com marca só entra no local marcado; quem não tem marca segue entrando");

  // ── com banco ──
  const tag = `equipereg_${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  let quinta = somarDias(hoje, 2);
  while (new Date(`${quinta}T12:00:00Z`).getUTCDay() !== 4) quinta = somarDias(quinta, 1);
  const sexta = somarDias(quinta, 1);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, acqua] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: snow!.id }, { operationId: operation!.id, locationId: acqua!.id }]);
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), carol = await mk("carol", area!.id), m1 = await mk("m1", area!.id), m2 = await mk("m2", area!.id), m3 = await mk("m3", area!.id), m4 = await mk("m4", area!.id);
  const todos = [admin, carol, m1, m2, m3, m4];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    ...[carol, m1, m2, m3, m4].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);

  let server: http.Server | null = null;
  try {
    const vigencia = { vigenciaInicio: somarDias(hoje, -5), vigenciaFim: somarDias(hoje, 60) };
    const [progS, progA] = await db.insert(programacoesTable).values([
      { organizationId: org!.id, locationId: snow!.id, nome: "Natal", ...vigencia, createdBy: admin.id },
      { organizationId: org!.id, locationId: acqua!.id, nome: "Natal Acqua", ...vigencia, createdBy: admin.id },
    ]).returning();
    for (const p of [progS!, progA!]) {
      await db.insert(programacaoBlocosTable).values([
        { programacaoId: p.id, weekday: 4, inicio: "08:00", fim: "09:00", rotulo: "Boas-vindas", regra: "todos", createdBy: admin.id },
        { programacaoId: p.id, weekday: 4, inicio: "09:00", fim: "10:00", rotulo: "Briefing", regra: "pessoas", pessoaIds: [m4.id], createdBy: admin.id },
        { programacaoId: p.id, weekday: 4, inicio: "10:00", fim: "11:00", rotulo: "Treino", regra: "area", areaIds: [area!.id], createdBy: admin.id },
        { programacaoId: p.id, weekday: 4, inicio: "11:00", fim: "13:00", rotulo: "Almoço", regra: "todos", flexivel: true, createdBy: admin.id },
      ]);
    }
    const marca = (programacaoId: string, userId: string, weekday: number, inicio: string | null = null, fim: string | null = null) => ({ programacaoId, userId, weekday, inicio, fim, createdBy: admin.id });
    await db.insert(programacaoEquipeTable).values([
      marca(progS!.id, carol.id, 4),
      marca(progS!.id, m1.id, 4, null, "13:00"), marca(progA!.id, m1.id, 4, "14:00", null),
      marca(progS!.id, m2.id, 1), // m2 só trabalha na segunda: na quinta está sem local
      marca(progA!.id, m4.id, 4),
    ]);

    const nomes = (dia: Awaited<ReturnType<typeof montarEscalaDoDia>>, rotulo: string) => {
      const b = dia!.blocos.find((x) => x.rotulo === rotulo)!;
      return new Set(b.pessoaIds);
    };
    const dS = await montarEscalaDoDia(org!.id, snow!.id, quinta);
    const dA = await montarEscalaDoDia(org!.id, acqua!.id, quinta);
    assert(nomes(dS, "Boas-vindas").has(carol.id) && nomes(dS, "Boas-vindas").has(m1.id) && nomes(dS, "Boas-vindas").has(m3.id), "Snowland, bloco de todo mundo: entram a Carol (marcada), a m1 (até 13:00) e a m3 (sem marca nenhuma)");
    assert(!nomes(dS, "Boas-vindas").has(m2.id) && !nomes(dS, "Boas-vindas").has(m4.id), "Snowland, bloco de todo mundo: não entram a m2 (sem marca na quinta) nem a m4 (marcada só na Acqua)");
    assert(nomes(dA, "Boas-vindas").has(m4.id) && nomes(dA, "Boas-vindas").has(m3.id) && !nomes(dA, "Boas-vindas").has(carol.id) && !nomes(dA, "Boas-vindas").has(m1.id), "Acqua, bloco de todo mundo: entram a m4 e a m3; a Carol e a m1 (só a partir das 14:00) ficam de fora");
    assert(nomes(dS, "Almoço").has(m1.id) && !nomes(dS, "Almoço").has(m4.id) && !nomes(dA, "Almoço").has(m1.id) && !nomes(dA, "Almoço").has(carol.id), "o almoço de Snowland não puxa o pessoal da Acqua, e a m1 almoça onde a marca dela cobre o horário");
    assert(nomes(dS, "Treino").has(carol.id) && !nomes(dS, "Treino").has(m4.id), "bloco de área também usa a equipe do local");
    assert(nomes(dS, "Briefing").has(m4.id) && nomes(dA, "Briefing").has(m4.id), "bloco de pessoas escolhidas pelo nome não filtra: a m4 fica mesmo sem marca em Snowland");
    assert((dS!.semLocalHoje ?? []).join() === m2.id && (dA!.semLocalHoje ?? []).join() === m2.id, "a m2 aparece em 'sem local hoje' nos dois locais; quem não tem marca nenhuma não aparece");

    // Imprevisto do dia: a Carol vai para a Acqua o dia inteiro; a m2 vem para Snowland só a partir das 10:00.
    const [impCarol] = await db.insert(escalaLocalDoDiaTable).values({ organizationId: org!.id, userId: carol.id, data: quinta, locationId: acqua!.id, createdBy: admin.id }).returning();
    await db.insert(escalaLocalDoDiaTable).values({ organizationId: org!.id, userId: m2.id, data: quinta, locationId: snow!.id, inicio: "10:00", createdBy: admin.id });
    const iS = await montarEscalaDoDia(org!.id, snow!.id, quinta);
    const iA = await montarEscalaDoDia(org!.id, acqua!.id, quinta);
    assert(!nomes(iS, "Boas-vindas").has(carol.id) && nomes(iA, "Boas-vindas").has(carol.id), "imprevisto sem horário: a Carol sai de Snowland e entra na Acqua naquele dia");
    assert(nomes(iS, "Treino").has(m2.id) && !nomes(iS, "Boas-vindas").has(m2.id) && nomes(iS, "Almoço").has(m2.id),"imprevisto 'a partir das 10:00': a m2 entra no treino e no almoço, mas não nas boas-vindas das 8");
    assert((iS!.semLocalHoje ?? []).length === 0, "quem tem imprevisto no dia deixa de ser 'sem local hoje'");
    await db.update(escalaLocalDoDiaTable).set({ active: false }).where(eq(escalaLocalDoDiaTable.id, impCarol!.id));
    const dS2 = await montarEscalaDoDia(org!.id, snow!.id, quinta);
    assert(nomes(dS2, "Boas-vindas").has(carol.id), "desfazer o imprevisto (active=false) devolve a Carol a Snowland");
    await db.delete(escalaLocalDoDiaTable).where(eq(escalaLocalDoDiaTable.organizationId, org!.id));

    // Escala já publicada não muda para quem faz: a equipe mexe, a Administração é avisada de que há o que republicar.
    const publicar = async (data: string, locationId: string) => {
      const [escala] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId, title: `${tag}_${data}`, periodStart: data, periodEnd: data, status: "PUBLISHED", publishedAt: new Date(), createdBy: admin.id }).returning();
      const dia = await montarEscalaDoDia(org!.id, locationId, data);
      await writeHistoryEvent({ category: "SCALE", action: "escala.publicada", title: "Escala do dia publicada", narrative: "teste", entityType: "escala", entityId: escala!.id, actorId: admin.id, orgId: org!.id, afterState: { convocacao: convocacaoPorPessoa(dia!) } });
      return escala!;
    };
    const escQuinta = await publicar(quinta, snow!.id), escSexta = await publicar(sexta, snow!.id);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const token = signAccessToken({ sub: admin.id, jti: `${tag}_admin`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const chamar = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, signal: AbortSignal.timeout(120_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
    };
    const url = `/programacoes/${progS!.id}/equipe`;
    const lido = (await chamar("GET", url)).body;
    const semM1 = (lido.equipe as { userId: string; weekday: number; inicio: string | null; fim: string | null }[]).filter((l) => !(l.userId === m1.id && l.weekday === 4 && l.inicio === null)).map(({ userId, weekday, inicio, fim }) => ({ userId, weekday, inicio, fim }));
    const gravou = await chamar("PUT", url, { baseVersao: lido.versao, linhas: semM1 });
    assert(gravou.status === 200 && gravou.body.mudou === true, "a equipe sem a marca da m1 em Snowland foi gravada");
    const [depoisQuinta] = await db.select().from(scalesTable).where(eq(scalesTable.id, escQuinta.id));
    const [depoisSexta] = await db.select().from(scalesTable).where(eq(scalesTable.id, escSexta.id));
    assert(depoisQuinta!.alteradaDesde !== null && depoisQuinta!.status === "PUBLISHED", "a Escala publicada da quinta passou a pedir republicação, sem sair de 'publicada'");
    assert(depoisSexta!.alteradaDesde === null, "a Escala publicada da sexta, que a equipe não muda, ficou como estava");
    const eventos = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.action, "escala.alterada_pela_equipe"), eq(historyEventsTable.orgId, org!.id)));
    assert(eventos.filter((e) => e.entityId === escQuinta.id).length === 1 && eventos.every((e) => e.entityId !== escSexta.id), "um evento no Registro, só da quinta");
    const avisos = await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'scale.needs_republish'`, [admin.id]);
    assert(avisos.rows[0].n === 1, "a Administração recebeu um aviso só ('a escala mudou depois de publicada')");
    const lidoDeNovo = (await chamar("GET", url)).body;
    const mesma = await chamar("PUT", url, { baseVersao: lidoDeNovo.versao, linhas: semM1 });
    assert(mesma.status === 200 && mesma.body.mudou === false, "salvar o mesmo conjunto de novo não grava nada");
    const eventos2 = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.action, "escala.alterada_pela_equipe"), eq(historyEventsTable.orgId, org!.id)));
    assert(eventos2.length === eventos.length, "salvar sem mudança não conta de novo no Registro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(escalaLocalDoDiaTable).where(eq(escalaLocalDoDiaTable.organizationId, org!.id));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    if (progs.length) {
      await db.delete(programacaoEquipeTable).where(inArray(programacaoEquipeTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    }
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-equipe-regra`);
  process.stdout.write(`escala-equipe-regra: ${passed} asserts passed\n`);
}

process.stdout.write("escala-equipe-regra: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
