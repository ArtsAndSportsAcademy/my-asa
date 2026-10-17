/**
 * Cenário real do Teatro de Natal, de 22 a 31/10/2026 (16/10/2026): Jingle e Bell em duas sessões separadas (11:30 e
 * 15:30), as folgas que estão no app, a Sofia só à tarde de segunda a sexta (escola) e limite de 3 shows por dia.
 * Gera os nove dias em ordem e confere as REGRAS (não a tabela palavra por palavra: o rodízio escolhe por quem fez menos).
 */
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  agendaEventsTable, areasTable, characterCastTable, charactersTable, dailyBookAssignmentsTable, dailyBookBlocksTable,
  dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable, db, escalaBlocoAjustesTable, escalaRegrasLocalTable, folgasTable,
  historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable, operationsTable, organizationsTable, pool,
  programacaoBlocosTable, programacoesTable, restricoesHorarioTable, scaleAllocationsTable, scalesTable, sessionsTable, showBookBlocksTable,
  showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import { gerarDiaDoLocal } from "../src/services/escala-mes.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `natal_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Teatro` }).returning();
  const mk = async (suffix: string, comArea = true) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId: comArea ? area!.id : null, defaultLocationId: local!.id,
  }).returning())[0]!;
  const admin = await mk("admin", false);
  const pessoas = { sofia: await mk("sofia"), esther: await mk("esther"), daia: await mk("daia"), kaua: await mk("kaua"), julia: await mk("julia"), bel: await mk("bel") };
  const elenco = Object.values(pessoas);
  const nomeDe = new Map(Object.entries(pessoas).map(([nome, u]) => [u.id, nome]));
  const everyone = [admin, ...elenco];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    ...elenco.map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  const [jingle, bell] = await db.insert(charactersTable).values([
    { name: `${tag}_Jingle`, locationId: local!.id, mode: "rodizio" }, { name: `${tag}_Bell`, locationId: local!.id, mode: "rodizio" },
  ]).returning();
  // Ordem da fila: os quatro fixos do teatro primeiro; Julia e Bel completam (também fazem a montanha).
  for (const personagem of [jingle!, bell!]) {
    await db.insert(characterCastTable).values(elenco.map((p, order) => ({ characterId: personagem.id, personId: p.id, order })));
  }
  const [teatro] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Teatro de Natal`, createdBy: admin.id }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId: teatro!.id, name: "Palco", order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId: teatro!.id, sceneId: scene!.id, name: "Palco", order: 0 }).returning();
  for (const [order, personagem] of [jingle!, bell!].entries()) {
    const [role] = await db.insert(showBookRolesTable).values({ showBookId: teatro!.id, blockId: block!.id, name: `${tag}_vaga${order}`, order }).returning();
    await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "CHARACTER", characterId: personagem.id, config: {}, order: 0 });
  }
  const [s1130, s1530] = await db.insert(sessionsTable).values([
    { showId: teatro!.id, startTime: "11:30", endTime: "12:00", separada: true }, { showId: teatro!.id, startTime: "15:30", endTime: "16:00", separada: true },
  ]).returning();
  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_Natal`, vigenciaInicio: "2026-10-22", vigenciaFim: "2027-01-17", createdBy: admin.id }).returning();
  // Todos os dias da semana, menos a quarta: em outubro o parque fecha às quartas.
  await db.insert(programacaoBlocosTable).values([0, 1, 2, 4, 5, 6].flatMap((weekday) => [
    { programacaoId: prog!.id, weekday, inicio: "11:30", fim: "12:00", rotulo: "TEATRO 11:30", regra: "livro" as const, showBookId: teatro!.id },
    { programacaoId: prog!.id, weekday, inicio: "15:30", fim: "16:00", rotulo: "TEATRO 15:30", regra: "livro" as const, showBookId: teatro!.id },
  ]));
  // As folgas de outubro que estão no app (22 a 31).
  const folgas: [keyof typeof pessoas, string][] = [["bel", "2026-10-23"], ["esther", "2026-10-24"], ["sofia", "2026-10-25"], ["kaua", "2026-10-25"], ["daia", "2026-10-27"], ["julia", "2026-10-31"]];
  await db.insert(folgasTable).values(folgas.map(([nome, data]) => ({ userId: pessoas[nome].id, operationId: operation!.id, type: "DAY_OFF" as const, startDate: data, endDate: data, createdBy: admin.id })));
  // Sofia: escola. De segunda a sexta só pode a partir das 15:00. E o limite do Snowland é de 3 shows por dia.
  await db.insert(restricoesHorarioTable).values({ userId: pessoas.sofia.id, diasSemana: [1, 2, 3, 4, 5], horaInicio: "15:00", horaFim: "23:59", periodStart: "2026-10-22", periodEnd: "2026-12-18", motivo: "escola", createdBy: admin.id });
  await db.insert(escalaRegrasLocalTable).values({ locationId: local!.id, limiteShowsDia: 3 });

  try {
    const actor = { sub: admin.id, role: "ADMIN", organizationId: org!.id };
    const dias = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-29", "2026-10-30", "2026-10-31"];
    const folgaDe = (data: string) => new Set(folgas.filter(([, d]) => d === data).map(([nome]) => pessoas[nome].id));
    const ehDiaDeSemana = (data: string) => { const d = new Date(`${data}T12:00:00Z`).getUTCDay(); return d >= 1 && d <= 5; };
    const sessoes = new Map<string, number>();

    for (const data of dias) {
      const gerado = await gerarDiaDoLocal(actor, { id: local!.id, name: local!.name }, data);
      assert(gerado.ok, `${data}: o dia é gerado`);
      const livros = (await db.select({ id: dailyBooksTable.id, sessionId: dailyBooksTable.sessionId }).from(dailyBooksTable)
        .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
        .where(and(eq(agendaEventsTable.date, data), eq(dailyBooksTable.showBookId, teatro!.id)))).filter((l) => l.sessionId);
      assert(livros.length === 2, `${data}: dois Livros, um por sessão`);
      const gente = new Map<string, string[]>();
      for (const livro of livros) {
        const linhas = await db.select({ userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable).where(and(eq(dailyBookAssignmentsTable.dailyBookId, livro.id), isNull(dailyBookAssignmentsTable.supersededAt)));
        gente.set(livro.sessionId!, linhas.map((l) => l.userId).filter((id): id is string => Boolean(id)));
      }
      const manha = gente.get(s1130!.id) ?? [], tarde = gente.get(s1530!.id) ?? [];
      assert(manha.length === 2 && tarde.length === 2, `${data}: Jingle e Bell preenchidos nas duas sessões`);
      assert([...manha, ...tarde].every((id) => !folgaDe(data).has(id)), `${data}: ninguém é escalado na própria folga`);
      assert(manha.filter((id) => tarde.includes(id)).length === 0, `${data}: ninguém faz as duas sessões (há gente de sobra)`);
      if (ehDiaDeSemana(data)) assert(!manha.includes(pessoas.sofia.id), `${data}: a Sofia nunca faz a sessão da manhã em dia de semana`);
      for (const id of [...manha, ...tarde]) sessoes.set(id, (sessoes.get(id) ?? 0) + 1);
    }
    const total = [...sessoes.values()].reduce((a, b) => a + b, 0);
    assert(total === dias.length * 4, "as 36 vagas do período estão preenchidas");
    const fixos = [pessoas.sofia, pessoas.esther, pessoas.daia, pessoas.kaua].map((p) => sessoes.get(p.id) ?? 0);
    assert(Math.max(...fixos) - Math.min(...fixos) <= 3, `o rodízio não deixa um fixo com muito mais sessões que outro (${[...sessoes].map(([id, n]) => `${nomeDe.get(id)}=${n}`).join(", ")})`);
  } finally {
    const ids = everyone.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (scales.length) {
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, scales.map((s) => s.id)));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, scales.map((s) => s.id)));
    }
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, teatro!.id));
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, prog!.id));
    await db.delete(programacoesTable).where(eq(programacoesTable.id, prog!.id));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, teatro!.id));
    const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, teatro!.id));
    if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, teatro!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, teatro!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, teatro!.id));
    await db.delete(sessionsTable).where(eq(sessionsTable.showId, teatro!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, teatro!.id));
    await db.delete(characterCastTable).where(inArray(characterCastTable.characterId, [jingle!.id, bell!.id]));
    await db.delete(charactersTable).where(inArray(charactersTable.id, [jingle!.id, bell!.id]));
    await db.delete(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, local!.id));
    await db.delete(restricoesHorarioTable).where(inArray(restricoesHorarioTable.userId, ids));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no cenário do Teatro de Natal`);
  process.stdout.write(`teatro-natal-outubro: ${passed} asserts passed\n`);
}

process.stdout.write("teatro-natal-outubro: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
