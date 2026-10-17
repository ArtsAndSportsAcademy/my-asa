/** Cadastro da restrição de horário (16/10/2026): quem cadastra, lote, encerrar e reabrir, avisos e Registro — contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable,
  operationsTable, organizationsTable, pool, restricoesHorarioTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Restricao = { id: string; userId: string; status: string; diasSemana: number[]; horaInicio: string; horaFim: string; motivo: string };

async function run() {
  const tag = `restrhttp_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_A` }, { organizationId: org!.id, name: `${tag}_B` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: local!.id,
  }).returning())[0]!;
  const admin = await mk("admin", null), admin2 = await mk("admin2", null), dir = await mk("dir", null);
  const supA = await mk("supa", areaA!.id), supB = await mk("supb", areaB!.id);
  const pa1 = await mk("pa1", areaA!.id), pa2 = await mk("pa2", areaA!.id), pb = await mk("pb", areaB!.id);
  const everyone = [admin, admin2, dir, supA, supB, pa1, pa2, pb];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true }, { userId: admin2.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supA.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true }, { userId: supB.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[pa1, pa2, pb].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: areaA!.id, locationId: local!.id, supervisorId: supA.id }, { areaId: areaB!.id, locationId: local!.id, supervisorId: supB.id },
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
      return (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    };
    const asAdmin = as(admin.id, "ADMIN"), asDir = as(dir.id, "DIR"), asSupA = as(supA.id, "SUPERVISOR_A"), asSupB = as(supB.id, "SUPERVISOR_A"), asPa1 = as(pa1.id, "MEMBER");
    const post = (fn: typeof asAdmin, path: string, body: unknown) => fn(path, { method: "POST", body: JSON.stringify(body) });
    const corpo = (userIds: string[], extra: Record<string, unknown> = {}) => ({
      userIds, diasSemana: [1, 2, 3, 4, 5], horaInicio: "15:00", horaFim: "23:59", periodStart: "2026-10-22", periodEnd: "2026-12-18", motivo: "escola", ...extra,
    });
    const lista = async (fn: typeof asAdmin, query = "") => ((await (await fn(`/restricoes-horario${query}`)).json()) as { restricoes: Restricao[]; podeEditar: boolean });
    const avisos = async (userId: string) => (await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'restricao_horario.criada'`, [userId])).rows[0].n as number;

    // Quem cadastra, e recusas que explicam.
    assert((await post(asDir, "/restricoes-horario", corpo([pa1.id]))).status === 403, "Direção só lê: não cadastra restrição");
    assert((await post(asPa1, "/restricoes-horario", corpo([pa1.id]))).status === 403, "Elenco não cadastra restrição, nem a própria");
    const outraArea = await post(asSupA, "/restricoes-horario", corpo([pb.id]));
    const outraAreaBody = (await outraArea.json()) as { message?: string };
    assert(outraArea.status === 403 && /só cadastra restrição de pessoas da sua área/.test(outraAreaBody.message ?? ""), "Supervisão de outra área recebe 403 com a frase de por quê");
    assert((await post(asSupA, "/restricoes-horario", corpo([pa1.id, pb.id]))).status === 403 && (await lista(asAdmin)).restricoes.length === 0, "lote com uma pessoa de outra área é recusado inteiro: nada é criado");

    // Validação com frase.
    assert((await post(asAdmin, "/restricoes-horario", corpo([pa1.id], { motivo: "  " }))).status === 400, "motivo vazio é recusado");
    assert((await post(asAdmin, "/restricoes-horario", corpo([pa1.id], { horaInicio: "16:00", horaFim: "15:00" }))).status === 400, "hora final antes da inicial é recusada");
    assert((await post(asAdmin, "/restricoes-horario", corpo([pa1.id], { diasSemana: [] }))).status === 400 && (await post(asAdmin, "/restricoes-horario", corpo([pa1.id], { diasSemana: [7] }))).status === 400, "dias da semana vazios ou fora de 0 a 6 são recusados");
    assert((await post(asAdmin, "/restricoes-horario", corpo([pa1.id], { periodStart: "2026-12-18", periodEnd: "2026-10-22" }))).status === 400, "período com fim antes do início é recusado");
    assert((await post(asAdmin, "/restricoes-horario", corpo([]))).status === 400, "sem nenhuma pessoa é recusado");

    // Cadastro em lote pela Administração: uma restrição por pessoa, tudo na mesma transação.
    const lote = await post(asAdmin, "/restricoes-horario", corpo([pa1.id, pa2.id, pb.id]));
    const loteBody = (await lote.json()) as { restricoes: Restricao[] };
    assert(lote.status === 201 && loteBody.restricoes.length === 3, "a Administração cadastra a mesma restrição para três pessoas de uma vez");
    const criadas = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "restricao_horario.criada")));
    assert(criadas.length === 3, "cada restrição criada grava Registro");

    // Avisos: um por acontecimento (o lote é um acontecimento só), para a pessoa, a Supervisão dela e a Administração.
    assert((await avisos(pa1.id)) === 1 && (await avisos(pa2.id)) === 1 && (await avisos(pb.id)) === 1, "cada pessoa recebe um aviso da própria restrição");
    assert((await avisos(supA.id)) === 1 && (await avisos(supB.id)) === 1, "cada Supervisão recebe um aviso do lote, não um por pessoa");
    assert((await avisos(admin2.id)) === 1 && (await avisos(admin.id)) === 0 && (await avisos(dir.id)) === 0, "a outra Administração é avisada; quem cadastrou e a Direção não");

    // Supervisão da própria área cadastra.
    const supCria = await post(asSupA, "/restricoes-horario", corpo([pa1.id], { diasSemana: [6, 0], horaInicio: "10:00", horaFim: "20:00", motivo: "curso" }));
    assert(supCria.status === 201, "Supervisão cadastra restrição de gente da própria área");

    // Leitura por perfil.
    const todas = await lista(asAdmin);
    assert(todas.restricoes.length === 4 && todas.podeEditar === true, "a Administração vê todas e pode editar");
    const daDirecao = await lista(asDir);
    assert(daDirecao.restricoes.length === 4 && daDirecao.podeEditar === false, "a Direção vê todas, sem editar");
    const daSupA = await lista(asSupA);
    assert(daSupA.restricoes.length === 3 && daSupA.restricoes.every((r) => [pa1.id, pa2.id].includes(r.userId)), "a Supervisão vê só as restrições de gente da própria área");
    const doElenco = await lista(asPa1, `?userId=${pb.id}`);
    assert(doElenco.restricoes.length === 2 && doElenco.restricoes.every((r) => r.userId === pa1.id) && doElenco.podeEditar === false, "o Elenco só vê as próprias restrições, mesmo pedindo outra pessoa");
    assert((await lista(asAdmin, `?userId=${pa2.id}`)).restricoes.length === 1, "filtro por pessoa");
    assert((await asSupA(`/restricoes-horario?userId=${pb.id}`)).status === 403, "Supervisão não consulta restrição de pessoa de outra área");

    // Encerrar e reabrir: nunca apaga, sempre com motivo na ida.
    const alvo = todas.restricoes.find((r) => r.userId === pb.id)!;
    assert((await post(asAdmin, `/restricoes-horario/${alvo.id}/encerrar`, {})).status === 400, "encerrar sem motivo é recusado");
    assert((await post(asSupA, `/restricoes-horario/${alvo.id}/encerrar`, { motivo: "acabou a aula" })).status === 403, "Supervisão de outra área não encerra");
    const encerrou = await post(asSupB, `/restricoes-horario/${alvo.id}/encerrar`, { motivo: "acabou a aula" });
    assert(encerrou.status === 200 && ((await encerrou.json()) as { restricao: Restricao }).restricao.status === "ENDED", "Supervisão da área encerra com motivo");
    assert((await post(asSupB, `/restricoes-horario/${alvo.id}/encerrar`, { motivo: "de novo" })).status === 409, "encerrar o que já está encerrado responde 409");
    const [guardada] = await db.select().from(restricoesHorarioTable).where(eq(restricoesHorarioTable.id, alvo.id));
    assert(Boolean(guardada) && guardada!.status === "ENDED" && guardada!.endedBy === supB.id, "a restrição encerrada continua no banco, com quem encerrou");
    const reabriu = await post(asSupB, `/restricoes-horario/${alvo.id}/reabrir`, {});
    assert(reabriu.status === 200 && ((await reabriu.json()) as { restricao: Restricao }).restricao.status === "ACTIVE", "reabrir devolve a restrição a ativa");
    assert((await post(asSupB, `/restricoes-horario/${alvo.id}/reabrir`, {})).status === 409, "reabrir o que já está ativo responde 409");
    const eventos = await db.select({ action: historyEventsTable.action }).from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.action, ["restricao_horario.encerrada", "restricao_horario.reaberta"])));
    assert(eventos.length === 2, "encerrar e reabrir gravam Registro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const ids = everyone.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(restricoesHorarioTable).where(inArray(restricoesHorarioTable.userId, ids));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [areaA!.id, areaB!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no cadastro de restrição de horário`);
  process.stdout.write(`restricoes-horario-http: ${passed} asserts passed\n`);
}

process.stdout.write("restricoes-horario-http: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
