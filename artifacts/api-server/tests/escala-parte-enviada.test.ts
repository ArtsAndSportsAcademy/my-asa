/**
 * "Enviar minha parte" (Etapa 7, 25/10/2026): cada Supervisão envia a parte da própria área (marca de pronta); a Administração é avisada quando
 * a última área envia. Se OUTRA pessoa mexe numa pessoa da área depois (enquanto a Escala é rascunho), a marca cai sozinha, entra no Registro e
 * a Supervisão da área é avisada; se quem mexeu é a própria Supervisão da área, a marca continua. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaAreasProntasTable, escalaBlocoAjustesTable, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Area = { id: string; name: string; pronta: { por: string | null } | null; prontaTirada?: { por: string | null } | null };
type Dia = { escala: { id: string; status: string } | null; areas: Area[]; blocos: { key: string; rotulo: string; pessoaIds: string[] }[] };

async function run() {
  const tag = `enviada_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), supPat = await mk("deborah", pat!.id), supBai = await mk("victor", bai!.id), jeff = await mk("jeff", pat!.id), ana = await mk("ana", bai!.id);
  const todos = [admin, supPat, supBai, jeff, ana];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supBai.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[jeff, ana].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }, { areaId: bai!.id, locationId: local!.id, supervisorId: supBai.id },
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
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asPat = as(supPat, "SUPERVISOR_A"), asBai = as(supBai, "SUPERVISOR_A");
    const notificacoes = async (userId: string, tipo: string) => (await pool.query(`select payload::text as p from notification_outbox where user_id = $1 and payload->>'type' = $2`, [userId, tipo])).rows as { p: string }[];

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [jeff.id] })).status === 201, "bloco do treino criado");
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date })).status === 201, "a Escala do dia nasce em rascunho");
    const dia = async () => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const area = (d: Dia, id: string) => d.areas.find((a) => a.id === id)!;
    const treino = (await dia()).blocos.find((b) => b.rotulo === "TREINO GELO")!;
    const mexer = (fn: typeof asAdmin, userId: string, action: "ADICIONAR" | "REMOVER") => fn("POST", "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treino.key, userId, action });
    const enviar = (fn: typeof asAdmin, areaId: string, pronta = true) => fn("POST", "/escalas/dia/pronta", { locationId: local!.id, areaId, date, pronta });

    // ── cada Supervisão envia a parte da sua área; a Administração é avisada quando a última envia ──
    assert((await enviar(asPat, pat!.id)).status === 200, "a Supervisão envia a parte da própria área");
    assert((await notificacoes(admin.id, "escala.todas_as_areas_enviaram")).length === 0, "com uma área ainda faltando, a Administração não é avisada");
    assert((await enviar(asBai, bai!.id)).status === 200, "a outra Supervisão envia a parte dela");
    assert((await notificacoes(admin.id, "escala.todas_as_areas_enviaram")).length === 1, "quando a última área envia, a Administração recebe um aviso de que dá para publicar");
    assert((await notificacoes(supBai.id, "escala.todas_as_areas_enviaram")).length === 0, "quem enviou não recebe aviso (só a Administração)");
    let d = await dia();
    assert(!!area(d, pat!.id).pronta && !!area(d, bai!.id).pronta, "as duas áreas aparecem como enviadas");

    // ── a Administração mexe numa pessoa da área: a marca dela cai, a outra fica ──
    assert((await mexer(asAdmin, jeff.id, "REMOVER")).status === 200, "a Administração tira o Jeff do treino");
    d = await dia();
    assert(!area(d, pat!.id).pronta && !!area(d, bai!.id).pronta, "a marca da área do Jeff caiu; a da outra área continua");
    assert((area(d, pat!.id).prontaTirada?.por ?? "").includes("admin"), "a Escala diz quem tirou a marca");
    const caiu1 = await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id));
    assert(caiu1.filter((e) => e.action === "escala.area_pronta_caiu").length === 1 && /mexeu na escala depois/.test(caiu1.find((e) => e.action === "escala.area_pronta_caiu")?.narrative ?? ""), "a queda da marca entrou no Registro dizendo quem mexeu");
    const avisoCaiu = await notificacoes(supPat.id, "escala.parte_voltou_a_editar");
    assert(avisoCaiu.length === 1 && /voltou a ser editada|Confira e envie/.test(avisoCaiu[0]!.p), "a Supervisão da área recebe o aviso de que a parte voltou a ser editada");
    assert((await notificacoes(admin.id, "escala.parte_voltou_a_editar")).length === 0, "quem mexeu (a Administração) não recebe o aviso");

    // ── mexer de novo na área sem marca não repete aviso nem evento ──
    assert((await mexer(asAdmin, jeff.id, "ADICIONAR")).status === 200, "a Administração põe o Jeff de volta");
    assert((await notificacoes(supPat.id, "escala.parte_voltou_a_editar")).length === 1, "sem marca para derrubar, não há segundo aviso");

    // ── quem supervisiona a área e mexe nela mesmo continua com a parte enviada ──
    assert((await enviar(asPat, pat!.id)).status === 200, "a Supervisão envia a parte de novo");
    assert((await mexer(asPat, jeff.id, "REMOVER")).status === 200, "a própria Supervisão da área tira o Jeff");
    d = await dia();
    assert(!!area(d, pat!.id).pronta, "quem enviou e mexeu na própria área continua com a parte enviada");
    assert((await mexer(asPat, jeff.id, "ADICIONAR")).status === 200, "a própria Supervisão põe o Jeff de volta");

    // ── outra Supervisão mexe na área: a marca cai e a Supervisão da área recebe UM aviso só (não dois) ──
    const antes = (await notificacoes(supPat.id, "escala.mexeram_na_sua_area")).length;
    assert((await mexer(asBai, jeff.id, "REMOVER")).status === 200, "a Supervisão de outra área tira o Jeff");
    d = await dia();
    assert(!area(d, pat!.id).pronta && !!area(d, bai!.id).pronta, "a marca da área do Jeff caiu; a da área de quem mexeu continua");
    const juntos = await notificacoes(supPat.id, "escala.mexeram_na_sua_area");
    assert(juntos.length === antes + 1 && /voltou a ser editada/.test(juntos[juntos.length - 1]!.p), "o aviso de 'quem mexeu' já diz que a parte voltou a ser editada");
    assert((await notificacoes(supPat.id, "escala.parte_voltou_a_editar")).length === 1, "e não chega um segundo aviso separado para o mesmo acontecimento");

    // ── escala já publicada: as marcas não são mexidas (publicar já fechou a conversa) ──
    await enviar(asPat, pat!.id);
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, d.escala!.id));
    const quedasAntes = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).filter((e) => e.action === "escala.area_pronta_caiu").length;
    const depoisDePublicar = await mexer(asBai, jeff.id, "ADICIONAR");
    assert(depoisDePublicar.status === 200, "mexida depois de publicada segue o caminho de sempre");
    const quedasDepois = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).filter((e) => e.action === "escala.area_pronta_caiu").length;
    assert(quedasDepois === quedasAntes, "depois de publicada, nenhuma marca de pronta é derrubada");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) {
      await db.delete(escalaAreasProntasTable).where(inArray(escalaAreasProntasTable.scaleId, escalas.map((s) => s.id)));
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, escalas.map((s) => s.id)));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-parte-enviada`);
  process.stdout.write(`escala-parte-enviada: ${passed} asserts passed\n`);
}

process.stdout.write("escala-parte-enviada: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
