/** Fase C (C2, C3) — publicar a Escala avisa quem foi convocado; republicar avisa só quem mudou; lembrete de check-in do dia. PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, like, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  dayCheckInsTable,
  db,
  escalaAreasProntasTable,
  folgasTable,
  historyEventsTable,
  locationsTable,
  notificationOutboxTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  scalesTable,
  userNotificationsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { enqueueEscalaReminders } from "../src/services/operational-jobs.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `fasec_${Date.now()}`;
  const date = "2026-10-14"; // quarta-feira
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mk = async (suffix: string, role: "ADMIN" | "SUPERVISOR_A" | "MEMBER", located = true) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId: located ? area!.id : null, defaultLocationId: located ? local!.id : null }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const admin = await mk("barbara", "ADMIN", false);
  const deborah = await mk("deborah", "SUPERVISOR_A");
  const julia = await mk("julia", "MEMBER");
  const carol = await mk("carol", "MEMBER");
  const dani = await mk("dani", "MEMBER");
  const everyone = [admin, deborah, julia, carol, dani].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: local!.id, supervisorId: deborah.id });
  await db.insert(folgasTable).values({ userId: dani.id, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, createdBy: admin.id });
  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_molde`, vigenciaInicio: date, vigenciaFim: date, createdBy: admin.id }).returning();
  const [, almoco] = await db.insert(programacaoBlocosTable).values([
    { programacaoId: prog!.id, weekday, inicio: "09:40", fim: "11:00", rotulo: "TREINO GELO", regra: "area", areaIds: [area!.id] },
    { programacaoId: prog!.id, weekday, inicio: "12:00", fim: "13:00", rotulo: "ALMOÇO", regra: "todos" },
  ]).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}_${Math.random()}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    };
    const asAdmin = as(admin.id, "ADMIN"), asDeborah = as(deborah.id, "SUPERVISOR_A");
    const outbox = async (type: string) => (await db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, everyone)))
      .filter((row) => (row.payload as { type: string }).type === type);

    // ---------- C2 · publicar avisa quem foi convocado ----------
    const ready = await asDeborah("/escalas/dia/pronta", { method: "POST", body: JSON.stringify({ locationId: local!.id, date, areaId: area!.id, pronta: true }) });
    const scaleId = ((await ready.json()) as { scaleId: string }).scaleId;
    const v1 = (await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId)))[0]!.version;
    const pub = await asAdmin(`/escalas/${scaleId}/publicar`, { method: "POST", body: JSON.stringify({ expectedVersion: v1 }) });
    assert(pub.status === 200, "Administração publica a Escala do dia");
    const published = await outbox("scale.published");
    const avisados = new Set(published.map((row) => row.userId));
    assert(avisados.has(julia.id) && avisados.has(carol.id) && avisados.has(deborah.id), "publicar avisa cada pessoa convocada (a supervisora também patina)");
    assert(!avisados.has(dani.id), "quem está de folga o dia todo não recebe aviso");
    assert(!avisados.has(admin.id), "quem não está em bloco nenhum não recebe aviso");
    assert(published.length === avisados.size, "um aviso por pessoa, sem duplicar");
    const juliaPayload = published.find((row) => row.userId === julia.id)!.payload as { title: string; message: string; actionUrl: string };
    assert(juliaPayload.actionUrl === "/escalas" && juliaPayload.title.includes("14 de outubro") && juliaPayload.message.includes("09:40"), "o aviso diz o dia, o primeiro horário e leva para Escalas");
    const [event] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), eq(historyEventsTable.action, "escala.publicada")));
    const convocacao = (event?.afterState as { convocacao?: Record<string, string[]> } | null)?.convocacao ?? {};
    assert((convocacao[julia.id] ?? []).length === 2, "o Registro guarda o retrato de quem foi convocado em quê");

    // ---------- C2 · republicar avisa só quem mudou ----------
    // ALMOÇO passa a ser só da Julia: Carol e Deborah perdem um bloco; Julia fica igual.
    const patch = await asAdmin(`/programacoes/${prog!.id}/blocos/${almoco!.id}`, { method: "PATCH", body: JSON.stringify({ regra: "pessoas", pessoaIds: [julia.id] }) });
    assert(patch.status === 200, "a Administração muda a regra do ALMOÇO");
    const v2 = (await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId)))[0]!.version;
    const rep = await asAdmin(`/escalas/${scaleId}/republicar`, { method: "POST", body: JSON.stringify({ expectedVersion: v2 }) });
    assert(rep.status === 200, "Administração republica");
    const republished = new Set((await outbox("scale.republished")).map((row) => row.userId));
    assert(republished.has(carol.id) && republished.has(deborah.id), "quem perdeu o ALMOÇO recebe o aviso de mudança");
    assert(!republished.has(julia.id), "quem não mudou não recebe aviso na republicação");

    // ---------- C3 · lembrete de check-in do dia ----------
    const cedo = await enqueueEscalaReminders(new Date(`${date}T08:30:00-03:00`), org!.id);
    assert(cedo.date === date && cedo.enqueued === 0, "às 08:30 ainda não há lembrete (primeiro bloco às 09:40)");
    await db.insert(dayCheckInsTable).values({ scaleId, sourceKey: "manual-teste", userId: carol.id, status: "CHECKED_IN", checkedInAt: new Date(), registeredBy: carol.id });
    const hora = await enqueueEscalaReminders(new Date(`${date}T09:15:00-03:00`), org!.id);
    const lembretes = await outbox("checkin.shift_reminder");
    const lembrados = new Set(lembretes.map((row) => row.userId));
    assert(lembrados.has(julia.id) && lembrados.has(deborah.id), "25 min antes do primeiro bloco, quem ainda não fez check-in recebe o lembrete");
    assert(!lembrados.has(carol.id), "quem já fez check-in não recebe lembrete");
    assert(!lembrados.has(dani.id), "quem está de folga não recebe lembrete");
    assert((lembretes.find((row) => row.userId === julia.id)!.payload as { actionUrl: string }).actionUrl === "/check-in", "o lembrete leva para o Check-in");
    await enqueueEscalaReminders(new Date(`${date}T09:30:00-03:00`), org!.id);
    assert((await outbox("checkin.shift_reminder")).length === lembretes.length && hora.enqueued >= 2, "o lembrete sai uma vez por pessoa por dia, sem repetir a cada minuto");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, everyone));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, everyone));
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (scales.length) {
      await db.delete(dayCheckInsTable).where(inArray(dayCheckInsTable.scaleId, scales.map((s) => s.id)));
      await db.delete(escalaAreasProntasTable).where(inArray(escalaAreasProntasTable.scaleId, scales.map((s) => s.id)));
    }
    await pool.query(`delete from escala_confirmacoes where scale_id = any($1::uuid[])`, [scales.map((s) => s.id)]).catch(() => undefined);
    await pool.query(`delete from escala_bloco_ajustes where scale_id = any($1::uuid[])`, [scales.map((s) => s.id)]).catch(() => undefined);
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, prog!.id));
    await db.delete(programacoesTable).where(eq(programacoesTable.id, prog!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    void like;
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na Fase C (avisos da Escala)`);
  process.stdout.write(`fase-c-escala-avisos: ${passed} asserts passed\n`);
}

process.stdout.write("fase-c-escala-avisos: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
