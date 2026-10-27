/**
 * Folga vence também na vaga do show: quem está de folga e foi fixado como titular antes da folga não aparece ocupando a vaga na Escala do dia
 * (nem entra na lista de convocados do bloco); a vaga sai "sem ninguém". Quem foi chamado de propósito, com motivo escrito, continua aparecendo.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable,
  areaLocalSupervisorsTable,
  areasTable,
  dailyBookAssignmentsTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookScenesTable,
  dailyBooksTable,
  db,
  escalaAreasProntasTable,
  escalaBlocoAjustesTable,
  folgasTable,
  historyEventsTable,
  locationsTable,
  operationLocationsTable,
  operationalChangesTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  scaleAllocationsTable,
  scalesTable,
  showBookBlocksTable,
  showBookLinesTable,
  showBookRolesTable,
  showBookScenesTable,
  showBooksTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Vaga = { assignmentId: string; personagem: string; userId: string | null };
type Bloco = { key: string; rotulo: string; pessoaIds: string[]; vagas?: Vaga[] };
type Dia = { blocos: Bloco[] };

async function run() {
  const tag = `folgavaga_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira → weekday 1
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Rinque` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [patinadores] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null, located = true) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: located ? local!.id : null,
  }).returning())[0]!;
  const admin = await mk("admin", null, false);
  const supPat = await mk("deborah", patinadores!.id);
  const presente = await mk("julia", patinadores!.id);
  const deFolga = await mk("carol", patinadores!.id);
  const everyone = [admin, supPat, presente, deFolga];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[presente, deFolga].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: patinadores!.id, locationId: local!.id, supervisorId: supPat.id }]);

  // Show com duas posições fixas: Julia e Carol. A folga da Carol só nasce depois de o Livro do Dia estar gerado.
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Abertura", order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
  const roles = await db.insert(showBookRolesTable).values([
    { showBookId: show!.id, blockId: block!.id, name: "BL 01", order: 0 },
    { showBookId: show!.id, blockId: block!.id, name: "BL 02", order: 1 },
  ]).returning();
  await db.insert(showBookLinesTable).values([
    { positionId: roles[0]!.id, type: "FIXED_PERSON", config: { userId: presente.id }, order: 0 },
    { positionId: roles[1]!.id, type: "FIXED_PERSON", config: { userId: deFolga.id }, order: 0 },
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
    const asAdmin = as(admin.id, "ADMIN");
    const post = (path: string, body: unknown) => asAdmin(path, { method: "POST", body: JSON.stringify(body) });
    const dia = async () => ((await (await asAdmin(`/escalas/dia?locationId=${local!.id}&date=${date}`)).json()) as { dia: Dia }).dia;
    const show1 = (d: Dia) => d.blocos.find((b) => b.rotulo === "SHOW");

    const prog = ((await (await post("/programacoes", { locationId: local!.id, nome: "Teste", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).json()) as { programacao: { id: string } }).programacao;
    const criou = await post(`/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "SHOW", regra: "livro", showBookId: show!.id });
    assert(criou.status === 201, "bloco de show criado na Programação");
    assert((await post("/escalas/dia/gerar", { locationId: local!.id, date })).status === 201, "dia gerado com o Livro do Dia do show");

    const antes = show1(await dia());
    assert(Boolean(antes) && antes!.pessoaIds.length === 2 && antes!.pessoaIds.includes(deFolga.id), "sem folga, as duas pessoas fixas são convocadas");
    assert((antes?.vagas ?? []).length === 2 && (antes?.vagas ?? []).every((v) => v.userId), "sem folga, as duas vagas têm nome");

    // A folga nasce depois de o titular estar fixado no Livro do Dia.
    await db.insert(folgasTable).values({ userId: deFolga.id, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, createdBy: admin.id });
    const comFolga = show1(await dia());
    assert(Boolean(comFolga) && comFolga!.pessoaIds.length === 1 && comFolga!.pessoaIds[0] === presente.id, "de folga, a pessoa não é convocada para o show");
    assert((comFolga?.vagas ?? []).filter((v) => v.userId === deFolga.id).length === 0, "de folga, a pessoa não ocupa vaga do show na Escala");
    assert((comFolga?.vagas ?? []).filter((v) => !v.userId).length === 1 && (comFolga?.vagas ?? []).filter((v) => v.userId === presente.id).length === 1, "a vaga dela sai sem ninguém e a da pessoa presente segue com nome");
    assert((comFolga?.vagas ?? []).length === 2, "a vaga continua na lista (não some): quem coordena precisa ver que está aberta");

    // Chamada de propósito, com motivo escrito: continua valendo e a vaga volta a ter o nome.
    const chamada = await post("/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: show1(await dia())!.key, userId: deFolga.id, action: "ADICIONAR", motivo: "Faltou gente no show" });
    const chamado = show1(await dia());
    assert(chamada.status === 200 && chamado!.pessoaIds.includes(deFolga.id), "chamada de propósito na folga, com motivo, continua convocando");
    assert((chamado?.vagas ?? []).some((v) => v.userId === deFolga.id), "chamada de propósito na folga: a vaga mostra o nome dela");

    // Tirada do bloco, ela volta a ficar de folga e a vaga volta a ficar aberta.
    await post("/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: show1(await dia())!.key, userId: deFolga.id, action: "REMOVER" });
    const depois = show1(await dia());
    assert(!depois!.pessoaIds.includes(deFolga.id) && !(depois?.vagas ?? []).some((v) => v.userId === deFolga.id), "tirada a chamada, a vaga volta a ficar sem ninguém");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const ids = everyone.map((u) => u.id);
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
    await db.delete(areasTable).where(eq(areasTable.id, patinadores!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em folga na vaga do show`);
  process.stdout.write(`escala-folga-na-vaga-do-show: ${passed} asserts passed\n`);
}

process.stdout.write("escala-folga-na-vaga-do-show: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
