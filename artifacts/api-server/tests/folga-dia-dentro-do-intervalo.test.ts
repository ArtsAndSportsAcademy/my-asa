/**
 * Marcar ou limpar UM dia dentro de uma folga de vários dias parte o intervalo em pedaços certos. Antes, "dia seguinte" voltava o
 * mesmo dia e "dia anterior" voltava dois dias antes (a data era convertida para o horário de Brasília e caía na véspera):
 * ficavam pedaços sobrepostos e folgas com o fim antes do começo. Também confere data e tipo inválidos (eram erro 500), os dias
 * repetidos e a leitura do Mapa do mês pela Direção. Contra PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  db, folgasTable, historyEventsTable, notificationOutboxTable, operationalChangesTable, operationsTable, organizationsTable, pool,
  userNotificationsTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `folgadia_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const pessoa = async (nome: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}` }).returning())[0]!;
  const admin = await pessoa("admin"), direcao = await pessoa("direcao"), membro = await pessoa("membro");
  const todos = [admin.id, direcao.id, membro.id];

  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: direcao.id, operationId: operation!.id, role: "DIR", active: true },
      { userId: membro.id, operationId: operation!.id, role: "MEMBER", active: true },
    ]);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role: role as "ADMIN", operationIds: [operation!.id] });
    const requestAs = (tk: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${tk}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const asAdmin = requestAs(token(admin, "ADMIN")), asDirecao = requestAs(token(direcao, "DIR")), asMembro = requestAs(token(membro, "MEMBER"));
    const ativas = async () => (await db.select().from(folgasTable).where(and(eq(folgasTable.userId, membro.id), eq(folgasTable.status, "ACTIVE")))).map((f) => `${f.startDate}..${f.endDate}`).sort();
    const marcar = (corpo: object) => asAdmin("/folgas/grid/bulk", { method: "POST", body: JSON.stringify({ operationId: operation!.id, userIds: [membro.id], ...corpo }) });

    // 1 · Marcar um dia no meio de um intervalo de três.
    await asAdmin("/folgas", { method: "POST", body: JSON.stringify({ userId: membro.id, operationId: operation!.id, type: "DAY_OFF", startDate: "2026-12-21", endDate: "2026-12-23" }) });
    assert((await ativas()).join("|") === "2026-12-21..2026-12-23", "o intervalo de 21 a 23 nasce inteiro");
    const meio = await marcar({ type: "RECESSO", dates: ["2026-12-22"] });
    assert(meio.status === 200, "marcar um dia no meio do intervalo funciona");
    assert((await ativas()).join("|") === "2026-12-21..2026-12-21|2026-12-22..2026-12-22|2026-12-23..2026-12-23", "o intervalo vira três dias certos, sem sobra, sem sobreposição e sem fim antes do começo");

    // 2 · Limpar o dia do meio deixa os dois lados.
    await marcar({ type: null, dates: ["2026-12-22"] });
    assert((await ativas()).join("|") === "2026-12-21..2026-12-21|2026-12-23..2026-12-23", "limpar o dia 22 deixa só o 21 e o 23");

    // 3 · Dias repetidos valem uma vez só.
    await marcar({ type: "DAY_OFF", dates: ["2026-12-28", "2026-12-28", "2026-12-28"] });
    assert((await ativas()).filter((a) => a === "2026-12-28..2026-12-28").length === 1, "dia repetido na lista vira uma folga só");
    assert((await db.select().from(folgasTable).where(and(eq(folgasTable.userId, membro.id), eq(folgasTable.status, "ACTIVE")))).every((f) => f.endDate >= f.startDate), "nenhuma folga ativa termina antes de começar");

    // 4 · Data e tipo inválidos recusam com frase (antes: erro 500).
    const dataRuim = await marcar({ type: "DAY_OFF", dates: ["2026-02-30"] });
    assert(dataRuim.status === 400 && /não existe/.test(((await dataRuim.json()) as { message?: string }).message ?? ""), "data que não existe é recusada com frase");
    const tipoRuim = await marcar({ type: "VOANDO", dates: ["2026-12-30"] });
    assert(tipoRuim.status === 400, "tipo inventado é recusado");
    const muitos = await marcar({ type: "DAY_OFF", dates: Array.from({ length: 100 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)) });
    assert(muitos.status === 400, "mais de 93 dias de uma vez é recusado");
    const toggleRuim = await asAdmin("/folgas/grid/toggle", { method: "POST", body: JSON.stringify({ userId: membro.id, operationId: operation!.id, date: "2026-13-45", type: "DAY_OFF" }) });
    assert(toggleRuim.status === 400, "mês 13 na grade é recusado, não vira erro interno");

    // 5 · A Direção lê o Mapa do mês e os Grupos, e não escreve; o Elenco não lê.
    const q = `operationId=${operation!.id}&year=2026&month=12`;
    const lerDirecao = await asDirecao(`/folgas/grid?${q}`);
    const corpoDirecao = await lerDirecao.json() as { members?: { editable?: boolean }[] };
    assert(lerDirecao.status === 200 && (corpoDirecao.members ?? []).length > 0 && !(corpoDirecao.members ?? []).some((m) => m.editable), "a Direção lê o Mapa do mês, sem poder editar nenhuma linha");
    assert((await asDirecao(`/folgas/grupos?operationId=${operation!.id}`)).status === 200, "a Direção lê os Grupos de folga");
    const escreverDirecao = await asDirecao("/folgas/grid/toggle", { method: "POST", body: JSON.stringify({ userId: membro.id, operationId: operation!.id, date: "2026-12-29", type: "DAY_OFF" }) });
    assert(escreverDirecao.status === 403 && /Supervisão/.test(((await escreverDirecao.json()) as { message?: string }).message ?? ""), "a Direção não marca folga, e a recusa diz quem marca");
    assert((await asMembro(`/folgas/grid?${q}`)).status === 403, "o Elenco não lê o Mapa do mês");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos), inArray(historyEventsTable.moId, changes.map((change) => change.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, todos));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em folga dentro do intervalo`);
  process.stdout.write(`folga-dia-dentro-do-intervalo: ${passed} asserts passed\n`);
}

process.stdout.write("folga-dia-dentro-do-intervalo: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
