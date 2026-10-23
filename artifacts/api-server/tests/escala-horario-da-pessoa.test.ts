/**
 * Horário só de uma pessoa na Escala do dia (0080, 23/10/2026): quem cai em duas atividades ao mesmo tempo pode ter o horário de UMA
 * delas mudado só para ela (treino de gelo às 10:20 para quem tem boas-vindas às 10:00), sem mexer nos outros nem na Programação.
 * Show não muda de horário aqui. Quem pode: Administração e a Supervisão da área da pessoa. Entra no Registro; escala publicada pede
 * republicação. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaBlocoAjustesTable, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scalesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; pessoaIds: string[]; vazio: boolean; sinal: string | null; horarioDela?: { chaveOriginal: string; inicio: string; fim: string | null } };
type Dia = { escala: { id: string; status: string; version: number; alteradaDesde: string | null } | null; blocos: Bloco[] };

async function run() {
  const tag = `hor_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), supPat = await mk("deborah", pat!.id), supBai = await mk("victor", bai!.id);
  const jeff = await mk("jeff", pat!.id), carol = await mk("carol", pat!.id);
  const todos = [admin, supPat, supBai, jeff, carol];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supBai.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[jeff, carol].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }, { areaId: bai!.id, locationId: local!.id, supervisorId: supBai.id },
  ]);
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();

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
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asPat = as(supPat, "SUPERVISOR_A"), asBai = as(supBai, "SUPERVISOR_A"), asJeff = as(jeff, "MEMBER");

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    for (const b of [
      { weekday: 1, inicio: "10:00", fim: "10:15", rotulo: "BOAS-VINDAS", regra: "pessoas", pessoaIds: [jeff.id] },
      { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "TREINO GELO", regra: "area", areaIds: [pat!.id] },
      { weekday: 1, inicio: "11:30", fim: "12:00", rotulo: "SHOW TEATRO", regra: "livro", showBookId: show!.id },
    ]) assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, b)).status === 201, `bloco ${b.rotulo} criado na Programação`);

    const dia = async () => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const bloco = (d: Dia, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo && !b.horarioDela);
    const horario = (fn: typeof asAdmin, body: Record<string, unknown>) => fn("POST", "/escalas/dia/horario", { locationId: local!.id, date, ...body });

    let d = await dia();
    const treino = bloco(d, "TREINO GELO")!, boas = bloco(d, "BOAS-VINDAS")!, teatro = bloco(d, "SHOW TEATRO")!;
    assert(treino.pessoaIds.includes(jeff.id) && boas.pessoaIds.includes(jeff.id) && treino.pessoaIds.includes(carol.id), "ponto de partida: o Jeff está em boas-vindas e treino ao mesmo tempo; a Carol só no treino");

    // ── quem pode, e as recusas com frase ──
    assert((await horario(asJeff, { sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00" })).status === 403, "Elenco não muda horário de ninguém");
    const outraArea = await horario(asBai, { sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00" });
    assert(outraArea.status === 403 && /própria área/.test(outraArea.text), "Supervisão de outra área é recusada com frase");
    const show1 = await horario(asAdmin, { sourceKey: teatro.key, userId: jeff.id, inicio: "11:40", fim: "12:10" });
    assert(show1.status === 409 && /Horário de show não muda aqui/.test(show1.text), "horário de show não muda: 409 com a frase do porquê");
    const feio = await horario(asAdmin, { sourceKey: treino.key, userId: jeff.id, inicio: "25:99" });
    assert(feio.status === 400 && /hora de início/.test(feio.text), "hora que não existe é 400 com frase");
    const invertido = await horario(asAdmin, { sourceKey: treino.key, userId: jeff.id, inicio: "10:30", fim: "10:10" });
    assert(invertido.status === 400 && /depois do início/.test(invertido.text), "fim antes do início é 400 com frase");
    assert((await dia()).escala === null || (await db.select().from(escalaBlocoAjustesTable)).filter((a) => a.userId === jeff.id).length === 0, "as recusas não gravaram nada");

    // ── a Supervisão da área muda o horário só do Jeff ──
    const ok = await horario(asPat, { sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00", motivo: "Tem boas-vindas às 10:00" });
    assert(ok.status === 200 && ok.body.mudou === true, "Supervisão da área muda o horário só da pessoa");
    d = ok.body.dia as Dia;
    const doJeff = d.blocos.find((b) => b.horarioDela?.chaveOriginal === treino.key && b.pessoaIds.includes(jeff.id));
    assert(Boolean(doJeff) && doJeff!.rotulo === "TREINO GELO" && doJeff!.inicio === "10:20" && doJeff!.fim === "11:00" && doJeff!.pessoaIds.length === 1, "aparece um bloco só dele, com o mesmo nome e o horário novo");
    assert(/era 10:00–11:00/.test(doJeff?.sinal ?? ""), "o bloco diz qual era o horário normal");
    const treinoDepois = bloco(d, "TREINO GELO")!;
    assert(!treinoDepois.pessoaIds.includes(jeff.id) && treinoDepois.pessoaIds.includes(carol.id) && treinoDepois.inicio === "10:00", "o treino dos outros não mudou: a Carol segue às 10:00");
    assert(!!d.escala, "a Escala do dia nasceu para guardar o ajuste");

    const eventos = async () => (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).filter((e) => e.action === "escala.horario_ajustado");
    assert((await eventos()).length === 1 && /10:00–11:00 passou a 10:20–11:00/.test((await eventos())[0]?.narrative ?? "") && /boas-vindas/i.test((await eventos())[0]?.narrative ?? ""), "entrou no Registro dizendo antes, depois e o motivo");
    const repete = await horario(asPat, { sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00" });
    assert(repete.status === 200 && repete.body.mudou === false && (await eventos()).length === 1, "repetir o mesmo horário não muda nem grava outro evento");

    // mudar de novo substitui o horário anterior
    const novo = await horario(asAdmin, { sourceKey: treino.key, userId: jeff.id, inicio: "10:30", fim: "11:00" });
    d = novo.body.dia as Dia;
    assert(d.blocos.filter((b) => b.horarioDela && b.pessoaIds.includes(jeff.id)).length === 1 && d.blocos.find((b) => b.horarioDela)?.inicio === "10:30", "mudar de novo troca o horário dele, sem ficar dois blocos");

    // ── voltar ao normal ──
    const volta = await horario(asPat, { sourceKey: treino.key, userId: jeff.id, voltar: true });
    d = volta.body.dia as Dia;
    assert(volta.status === 200 && !d.blocos.some((b) => b.horarioDela) && bloco(d, "TREINO GELO")!.pessoaIds.includes(jeff.id), "voltar ao normal devolve o Jeff ao treino das 10:00");
    const restaurado = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).filter((e) => e.action === "escala.horario_restaurado");
    assert(restaurado.length === 1, "voltar ao normal também entrou no Registro");

    // ── quem já saiu da atividade não tem horário para mudar ──
    assert((await asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treino.key, userId: jeff.id, action: "REMOVER" })).status === 200, "tirar o Jeff do treino (ajuste que já existia) continua funcionando");
    const fora = await horario(asAdmin, { sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00" });
    assert(fora.status === 409 && /não está nesta atividade/.test(fora.text), "quem já saiu da atividade recebe 409 com frase, em vez de um horário solto");
    await asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treino.key, userId: jeff.id, action: "ADICIONAR" });

    // ── escala já publicada: pede republicação ──
    const escalaId = d.escala!.id;
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, escalaId));
    const antes = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!;
    const pub = await horario(asPat, { sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00" });
    const depois = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!;
    assert(pub.status === 200 && depois.alteradaDesde !== null && depois.version === antes.version + 1, "com a escala publicada, a mudança marca \"alterada depois de publicada\" e sobe a versão");
    const avisos = await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'scale.needs_republish'`, [admin.id]);
    assert(avisos.rows[0].n >= 1, "a Administração recebe o aviso de que há o que republicar");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, escalas.map((s) => s.id)));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
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
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-horario-da-pessoa`);
  process.stdout.write(`escala-horario-da-pessoa: ${passed} asserts passed\n`);
}

process.stdout.write("escala-horario-da-pessoa: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
