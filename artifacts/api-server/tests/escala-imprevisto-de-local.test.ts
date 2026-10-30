/**
 * Imprevisto de local do dia (0088, pacote O, passo O7): "trazer o Fulano para cá hoje" / "mandar para a Acqua hoje". Vale só naquela data (e, se
 * quiser, só de uma hora a outra), não mexe na Programação, entra no Registro, avisa a Supervisão do OUTRO local, marca a Escala já publicada que deixar
 * de bater e desfaz. Folga vence. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaLocalDoDiaTable, folgasTable, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { writeHistoryEvent } from "../src/lib/history-helper.js";
import { convocacaoPorPessoa, montarEscalaDoDia } from "../src/services/escala-dia.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}
const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

async function run() {
  const tag = `imprevisto_${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  let quinta = somarDias(hoje, 2);
  while (new Date(`${quinta}T12:00:00Z`).getUTCDay() !== 4) quinta = somarDias(quinta, 1);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, acqua] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: snow!.id }, { operationId: operation!.id, locationId: acqua!.id }]);
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), supSnow = await mk("supsnow", area!.id), supAcqua = await mk("supacqua", area!.id);
  const m1 = await mk("m1", area!.id), m2 = await mk("m2", area!.id), m3 = await mk("m3", area!.id);
  const todos = [admin, dir, supSnow, supAcqua, m1, m2, m3];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supSnow.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supAcqua.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[m1, m2, m3].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: area!.id, locationId: snow!.id, supervisorId: supSnow.id }, { areaId: area!.id, locationId: acqua!.id, supervisorId: supAcqua.id }]);

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
        { programacaoId: p.id, weekday: 4, inicio: "10:00", fim: "11:00", rotulo: "Treino", regra: "area", areaIds: [area!.id], createdBy: admin.id },
      ]);
    }
    // Equipe: a m1, a m2 e a m3 trabalham na Acqua na quinta; a m2 está de folga nesse dia.
    await db.insert(programacaoEquipeTable).values([m1, m2, m3].map((u) => ({ programacaoId: progA!.id, userId: u.id, weekday: 4, createdBy: admin.id })));
    await db.insert(folgasTable).values({ operationId: operation!.id, userId: m2.id, type: "DAY_OFF", status: "ACTIVE", startDate: quinta, endDate: quinta, createdBy: admin.id });
    const nomes = async (localId: string, rotulo: string) => new Set((await montarEscalaDoDia(org!.id, localId, quinta))!.blocos.find((b) => b.rotulo === rotulo)!.pessoaIds);

    // Escala de Snowland já publicada na quinta, com a foto de antes do imprevisto.
    const [escala] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: snow!.id, title: `${tag}_${quinta}`, periodStart: quinta, periodEnd: quinta, status: "PUBLISHED", publishedAt: new Date(), createdBy: admin.id }).returning();
    await writeHistoryEvent({ category: "SCALE", action: "escala.publicada", title: "Escala do dia publicada", narrative: "teste", entityType: "escala", entityId: escala!.id, actorId: admin.id, orgId: org!.id, afterState: { convocacao: convocacaoPorPessoa((await montarEscalaDoDia(org!.id, snow!.id, quinta))!) } });
    assert(!(await nomes(snow!.id, "Boas-vindas")).has(m1.id) && (await nomes(acqua!.id, "Boas-vindas")).has(m1.id), "antes do imprevisto: a m1 está na Acqua e não em Snowland");

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, signal: AbortSignal.timeout(120_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSupSnow = as(supSnow, "SUPERVISOR_A"), asSupAcqua = as(supAcqua, "SUPERVISOR_A"), asMem = as(m1, "MEMBER");
    const avisosDe = async (userId: string, tipo: string) => (await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = $2`, [userId, tipo])).rows[0].n as number;
    const url = "/escalas/dia/local-do-dia";
    const trazer = (extra: Record<string, unknown> = {}) => ({ locationId: snow!.id, date: quinta, userId: m1.id, destinoId: snow!.id, origemId: acqua!.id, ...extra });

    // Quem pode e quem não pode, com frase.
    const daDirecao = await asDir("POST", url, trazer());
    assert(daDirecao.status === 403 && /Administração e da Supervisão/.test(daDirecao.body.message ?? ""), "a Direção não muda ninguém de local, e a frase diz quem pode");
    assert((await asMem("POST", url, trazer())).status === 403, "o Elenco não muda ninguém de local");
    assert((await asSupAcqua("POST", url, { locationId: snow!.id, date: quinta, userId: m1.id, destinoId: snow!.id })).status === 403, "a Supervisão da Acqua, sem a Acqua como origem, não manda ninguém para Snowland");
    assert((await asAdmin("POST", url, trazer({ date: "30/10" }))).status === 400 && (await asAdmin("POST", url, trazer({ inicio: "15:00", fim: "14:00" }))).status === 400 && (await asAdmin("POST", url, trazer({ destinoId: acqua!.id }))).status === 400, "data fora do formato, fim antes do início e destino igual à origem são recusados com frase");
    const deFolga = await asAdmin("POST", url, trazer({ userId: m2.id }));
    assert(deFolga.status === 409 && deFolga.body.error === "PESSOA_DE_FOLGA" && /Folga vence a escala/.test(deFolga.body.message ?? ""), "quem está de folga não é movida por aqui: 409 com a frase");

    // A Supervisão de Snowland traz a m1 para cá, o dia inteiro.
    const trouxe = await asSupSnow("POST", url, trazer({ motivo: "faltou gente no treino" }));
    assert(trouxe.status === 200 && trouxe.body.mudou === true && Boolean(trouxe.body.imprevistoId), "a Supervisão de Snowland traz a m1 para cá hoje");
    const dia = trouxe.body.dia as { imprevistos?: { id: string; pessoaId: string; localNome: string; motivo: string | null }[]; blocos: { rotulo: string; pessoaIds: string[] }[] };
    assert(dia.imprevistos?.length === 1 && dia.imprevistos[0]!.pessoaId === m1.id && dia.imprevistos[0]!.motivo === "faltou gente no treino", "a resposta já traz o imprevisto do dia, com o motivo");
    assert(dia.blocos.find((b) => b.rotulo === "Boas-vindas")!.pessoaIds.includes(m1.id) && !(await nomes(acqua!.id, "Boas-vindas")).has(m1.id), "a m1 entra em Snowland e sai dos blocos gerais da Acqua só naquele dia");
    const eventos = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.action, "escala.local_do_dia_criado"), eq(historyEventsTable.orgId, org!.id)));
    assert(eventos.length === 1 && /em vez de/.test(eventos[0]!.narrative ?? "") && JSON.stringify(eventos[0]!.metadata ?? {}).includes("faltou gente no treino"), "um evento no Registro, com a origem e o motivo escrito");
    assert((await avisosDe(supAcqua.id, "escala.local_do_dia")) === 1 && (await avisosDe(supSnow.id, "escala.local_do_dia")) === 0, "a Supervisão da Acqua (o outro local) é avisada, e quem fez não recebe o próprio aviso");
    const repetida = await asSupSnow("POST", url, trazer({ motivo: "faltou gente no treino" }));
    assert(repetida.body.mudou === false && (await avisosDe(supAcqua.id, "escala.local_do_dia")) === 1, "repetir o mesmo imprevisto não grava de novo nem avisa de novo");

    // A Escala publicada deixou de bater: pede republicação, sem sair de "publicada", e a Administração é avisada.
    const [depois] = await db.select().from(scalesTable).where(eq(scalesTable.id, escala!.id));
    assert(depois!.status === "PUBLISHED" && depois!.alteradaDesde !== null, "a Escala publicada de Snowland passou a pedir republicação");
    assert((await avisosDe(admin.id, "scale.needs_republish")) === 1, "a Administração recebeu um aviso de que há o que republicar");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.action, "escala.alterada_pelo_imprevisto"), eq(historyEventsTable.orgId, org!.id)))).length >= 1, "o Registro conta que o imprevisto alterou a Escala publicada");

    // Com horário: a m3 vem para Snowland só a partir das 10:00 (entra no treino, não nas boas-vindas das 8).
    const comHora = await asAdmin("POST", url, trazer({ userId: m3.id, inicio: "10:00" }));
    assert(comHora.status === 200 && (await nomes(snow!.id, "Treino")).has(m3.id) && !(await nomes(snow!.id, "Boas-vindas")).has(m3.id), "imprevisto 'a partir das 10:00': a m3 entra no treino e não nas boas-vindas");
    assert((await avisosDe(supAcqua.id, "escala.local_do_dia")) === 2 && (await avisosDe(supSnow.id, "escala.local_do_dia")) === 1, "quando a Administração mexe, a Supervisão dos dois locais é avisada");

    // Desfazer: quem não pode não desfaz; quem pode devolve a m1 à Acqua.
    const id = trouxe.body.imprevistoId as string;
    assert((await asDir("POST", `${url}/desfazer`, { id, locationId: snow!.id })).status === 403 && (await asMem("POST", `${url}/desfazer`, { id, locationId: snow!.id })).status === 403, "a Direção e o Elenco não desfazem");
    assert((await asAdmin("POST", `${url}/desfazer`, { id: "x", locationId: snow!.id })).status === 404, "id quebrado dá 404 com frase");
    const desfez = await asSupSnow("POST", `${url}/desfazer`, { id, locationId: snow!.id });
    assert(desfez.status === 200 && desfez.body.mudou === true && !((desfez.body.dia as { imprevistos?: { id: string }[] }).imprevistos ?? []).some((i) => i.id === id), "a Supervisão do destino desfaz e o imprevisto sai da lista do dia");
    const linhas = await db.select().from(escalaLocalDoDiaTable).where(eq(escalaLocalDoDiaTable.organizationId, org!.id));
    assert(linhas.length === 2 && linhas.find((l) => l.id === id)!.active === false, "desfazer deixa a linha inativa (nada é apagado)");
    assert(!(await nomes(snow!.id, "Boas-vindas")).has(m1.id) && (await nomes(acqua!.id, "Boas-vindas")).has(m1.id), "a m1 volta à Acqua, como a Programação manda");
    assert((await asSupSnow("POST", `${url}/desfazer`, { id, locationId: snow!.id })).body.mudou === false, "desfazer de novo não muda nada");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.action, "escala.local_do_dia_desfeito"), eq(historyEventsTable.orgId, org!.id)))).length === 1, "o desfazer entra no Registro uma vez");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(escalaLocalDoDiaTable).where(eq(escalaLocalDoDiaTable.organizationId, org!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
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
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-imprevisto-de-local`);
  process.stdout.write(`escala-imprevisto-de-local: ${passed} asserts passed\n`);
}

process.stdout.write("escala-imprevisto-de-local: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
