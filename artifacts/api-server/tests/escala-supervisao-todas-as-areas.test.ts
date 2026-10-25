/**
 * Decisão de 25/10/2026: por ora a Supervisão que tem acesso ao local mexe na escala de pessoa de QUALQUER área. Quem mexe em pessoa de outra área
 * fica visível para a Supervisão daquela pessoa (Registro, `dia.mexidas` e UM aviso por acontecimento), sem motivo obrigatório. Publicar continua
 * da Administração; Direção e Elenco continuam recusados; Supervisão sem nenhuma área neste local é recusada. PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaBlocoAjustesTable, historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable,
  operationsTable, organizationsTable, pool, programacaoBlocosTable, programacoesTable, scaleAllocationsTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Bloco = { key: string; rotulo: string; pessoaIds: string[] };
type Mexida = { pessoaId: string; pessoaNome: string; pessoaAreaNome: string | null; porId: string; porNome: string; porAreaNome: string | null; texto: string };
type Dia = { escala: { id: string; status: string; version: number } | null; blocos: Bloco[]; mexidas: Mexida[] };

async function run() {
  const tag = `tda_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  const [outroLocal] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Acqua` }).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: local!.id }, { operationId: operation!.id, locationId: outroLocal!.id }]);
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), supPat = await mk("deborah", pat!.id), supBai = await mk("victor", bai!.id), supFora = await mk("fora", bai!.id);
  const jeff = await mk("jeff", pat!.id), carol = await mk("carol", pat!.id), bia = await mk("bia", bai!.id);
  const todos = [admin, dir, supPat, supBai, supFora, jeff, carol, bia];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supBai.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supFora.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[jeff, carol, bia].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  // supFora supervisiona Bailarinos, mas só no OUTRO local: neste aqui não tem acesso nenhum.
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }, { areaId: bai!.id, locationId: local!.id, supervisorId: supBai.id },
    { areaId: bai!.id, locationId: outroLocal!.id, supervisorId: supFora.id },
  ]);

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(90_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asPat = as(supPat, "SUPERVISOR_A"), asBai = as(supBai, "SUPERVISOR_A"), asFora = as(supFora, "SUPERVISOR_A"), asJeff = as(jeff, "MEMBER");

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    for (const b of [
      { weekday: 1, inicio: "09:00", fim: "10:00", rotulo: "ENSAIO", regra: "pessoas", pessoaIds: [jeff.id] },
      { weekday: 1, inicio: "10:00", fim: "11:30", rotulo: "TREINO", regra: "pessoas", pessoaIds: [bia.id] },
    ]) assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, b)).status === 201, `bloco ${b.rotulo} criado`);
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date })).status === 201, "a Escala do dia nasceu");

    const dia = async () => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const avisos = async (userId: string) => ((await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'escala.mexeram_na_sua_area'`, [userId])).rows[0].n as number);
    const eventosDaEscala = async (escalaId: string) => db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, escalaId));
    let d = await dia();
    const ensaio = d.blocos.find((b) => b.rotulo === "ENSAIO")!;
    const treino = d.blocos.find((b) => b.rotulo === "TREINO")!;
    const escalaId = d.escala!.id;
    assert(Array.isArray(d.mexidas) && d.mexidas.length === 0, "dia.mexidas começa vazio");
    const ajuste = (fn: typeof asAdmin, sourceKey: string, userId: string, action: string) => fn("POST", "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey, userId, action });

    // ── Supervisão de OUTRA área mexe, sem motivo ──
    const cruzado = await ajuste(asBai, ensaio.key, carol.id, "ADICIONAR");
    assert(cruzado.status < 300, `Supervisão de Bailarinos coloca uma patinadora no ensaio, sem motivo (veio ${cruzado.status}: ${cruzado.text.slice(0, 160)})`);
    d = await dia();
    assert(d.blocos.find((b) => b.rotulo === "ENSAIO")!.pessoaIds.includes(carol.id), "a mexida vale na escala do dia");
    assert(d.mexidas.length === 1 && d.mexidas[0]!.pessoaId === carol.id && d.mexidas[0]!.porId === supBai.id && d.mexidas[0]!.porNome === supBai.name
      && d.mexidas[0]!.pessoaAreaNome === pat!.name && d.mexidas[0]!.porAreaNome === bai!.name && d.mexidas[0]!.texto.length > 0, "dia.mexidas diz quem mexeu, a área dele, a pessoa, a área dela e o que fez");
    const comMeta = (await eventosDaEscala(escalaId)).filter((e) => (e.metadata as Record<string, unknown> | null)?.["mexidaDeOutraArea"] === true);
    assert(comMeta.length === 1, "o Registro leva a marca de mexida de outra área em um só evento");
    assert(await avisos(supPat.id) === 1, "a Supervisão da área da pessoa recebe UM aviso");
    assert(await avisos(supBai.id) === 0 && await avisos(admin.id) === 0, "quem mexeu e a Administração não recebem o aviso de mexida");

    // ── mexida na própria área e a da Administração não aparecem como "de outra área" ──
    assert((await ajuste(asBai, treino.key, bia.id, "REMOVER")).status < 300, "Supervisão mexe na própria área");
    assert((await ajuste(asAdmin, ensaio.key, jeff.id, "REMOVER")).status < 300, "Administração mexe em qualquer área");
    d = await dia();
    assert(d.mexidas.length === 1 && await avisos(supPat.id) === 1, "mexida na própria área e a da Administração não entram em quem-mexeu nem geram aviso");

    // ── segunda mexida cruzada = aviso para a outra Supervisão ──
    assert((await ajuste(asPat, treino.key, bia.id, "ADICIONAR")).status < 300, "a outra Supervisão também mexe em pessoa de fora da área");
    d = await dia();
    assert(d.mexidas.length === 2 && await avisos(supBai.id) === 1 && await avisos(supPat.id) === 1, "um aviso por acontecimento, para a Supervisão da área da pessoa");

    // ── lote de atividade (Etapa 4): um só evento e um só aviso, e dá para desfazer ──
    const antes = await avisos(supPat.id);
    const eventosAntes = (await eventosDaEscala(escalaId)).length;
    const lote = await asBai("POST", `/scales/${escalaId}/entries`, { memberIds: [jeff.id, carol.id], date, label: "REUNIÃO", startTime: "15:00", endTime: "15:30", expectedVersion: (await dia()).escala!.version });
    assert(lote.status === 201 && Array.isArray(lote.body.entries) && lote.body.entries.length === 2 && typeof lote.body.version === "number", `Supervisão cria atividade para várias pessoas de outra área (veio ${lote.status}: ${lote.text.slice(0, 160)})`);
    assert((await eventosDaEscala(escalaId)).length - eventosAntes === 1, "o lote grava UM evento no Registro");
    assert(await avisos(supPat.id) - antes === 1, "o lote gera UM aviso para a Supervisão das duas pessoas");
    const entradas = (lote.body.entries ?? []) as { id: string }[];
    const desfaz = await asBai("DELETE", `/scales/${escalaId}/entries/${entradas[0]?.id}`, { entryIds: entradas.map((e) => e.id), expectedVersion: lote.body.version });
    assert(desfaz.status === 200 && desfaz.body.ok === true, `DELETE serve de desfazer do lote (veio ${desfaz.status}: ${desfaz.text.slice(0, 160)})`);

    // ── quem continua recusado, com frase ──
    const dirR = await ajuste(asDir, ensaio.key, carol.id, "ADICIONAR");
    assert(dirR.status === 403 && /Direção/.test(dirR.text) && /Administração/.test(dirR.text) && !/Role .* is not authorized/.test(dirR.text), "Direção é recusada com a frase de quem pode e do perfil de quem tentou");
    assert((await ajuste(asJeff, ensaio.key, carol.id, "ADICIONAR")).status === 403, "Elenco é recusado");
    const fora = await ajuste(asFora, ensaio.key, carol.id, "ADICIONAR");
    assert(fora.status === 403 && /Supervisão/.test(fora.text), "Supervisão sem nenhuma área neste local é recusada com frase");
    const corpoLote = { memberIds: [carol.id], date, label: "X", startTime: "16:00", endTime: "16:30" };
    assert((await asFora("POST", `/scales/${escalaId}/entries`, corpoLote)).status === 403, "Supervisão sem acesso ao local não cria atividade");
    assert((await asDir("POST", `/scales/${escalaId}/entries`, corpoLote)).status === 403, "Direção não cria atividade");

    // ── publicar continua só da Administração; "pronta" só da própria área ──
    assert((await asBai("POST", `/escalas/${escalaId}/publicar`, { expectedVersion: d.escala!.version })).status === 403, "Supervisão não publica");
    assert((await asBai("POST", "/escalas/dia/pronta", { locationId: local!.id, areaId: pat!.id, date, pronta: true })).status === 403, "Supervisão não marca como pronta a área dos outros");
    assert((await asBai("POST", "/escalas/dia/pronta", { locationId: local!.id, areaId: bai!.id, date, pronta: true })).status < 300, "Supervisão marca como pronta a própria área");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    const mudancas = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), ...(mudancas.length ? [inArray(historyEventsTable.moId, mudancas.map((m) => m.id))] : [])));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) {
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, escalas.map((s) => s.id)));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, escalas.map((s) => s.id)));
    }
    if (escalas.length) await pool.query(`delete from escala_areas_prontas where scale_id = any($1::uuid[])`, [escalas.map((s) => s.id)]);
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [local!.id, outroLocal!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-supervisao-todas-as-areas`);
  process.stdout.write(`escala-supervisao-todas-as-areas: ${passed} asserts passed\n`);
}

process.stdout.write("escala-supervisao-todas-as-areas: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
