/**
 * Rodízio e dias gerados em rascunho. O contador só avança quando o Livro do Dia é PUBLICADO; por isso o dia seguinte
 * (ou o mês gerado de uma vez) não enxergava quem já tinha sido escolhido no dia anterior ainda em rascunho, e a
 * geração repetia a mesma pessoa quando a carga de trabalho não desempatava (por exemplo, na virada do mês).
 *
 * Confere: (1) o dia 2 não repete quem entrou no dia 1 por rodízio; (2) dia 1 cancelado/descartado não pesa;
 * (3) restaurar o dia 1 volta a pesar; (4) publicar o dia 1 não conta duas vezes (rascunho + avanço gravado);
 * (5) a leitura ao vivo do dia 2 em rascunho mantém o que foi gravado na geração. Contra PostgreSQL real de teste.
 */
import {
  db, pool, organizationsTable, operationsTable, usersTable, locationsTable, charactersTable, characterCastTable,
  rotationDailyAdvancesTable, showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable, showBookLinesTable,
  scalesTable, agendaEventsTable, dailyBooksTable, dailyBookScenesTable, dailyBookBlocksTable, dailyBookPositionsTable,
  dailyBookAssignmentsTable, userRolesTable, historyEventsTable, operationalChangesTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { generateDailyBookDraftForScale } from "../src/routes/daily-book.js";
import { advanceRotationCountsFromWinners, type RotationWinners } from "../src/services/line-resolver.js";
import { operationalDate } from "../src/lib/operational-date.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

/** Datas de meses diferentes (e semanas diferentes), para que a carga de trabalho não desempate: só o contador do rodízio decide. */
function datasEmMesesDiferentes(n: number): string[] {
  const [hy, hm] = operationalDate().split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const total = hy * 12 + (hm - 1) + 1 + i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-15`;
  });
}

async function run() {
  const tag = `rodrasc_${Date.now()}`;
  const [d1, d2, d3, d4] = datasEmMesesDiferentes(4) as [string, string, string, string];

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (s: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${s}`, username: `${tag}_${s}` }).returning())[0]!;
  const admin = await mk("admin");
  const gente = await Promise.all(["p1", "p2", "p3"].map(mk));
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: op!.id, role: "ADMIN", active: true },
    ...gente.map((g) => ({ userId: g.id, operationId: op!.id, role: "MEMBER" as const, active: true })),
  ]);
  const [p1, p2, p3] = gente as [typeof admin, typeof admin, typeof admin];
  const [loc] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [personagem] = await db.insert(charactersTable).values({ name: `${tag}_pers`, locationId: loc!.id, mode: "rodizio" }).returning();
  await db.insert(characterCastTable).values(gente.map((g, i) => ({ characterId: personagem!.id, personId: g.id, order: i, timesDone: 0 })));
  const [show] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId: loc!.id, title: `${tag}_show`, createdBy: admin.id }).returning();
  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Cena", order: 0 }).returning();
  const [bloco] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: cena!.id, name: "Bloco", order: 0 }).returning();
  const [papel] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: bloco!.id, name: "Papel", order: 0 }).returning();
  const [linha] = await db.insert(showBookLinesTable).values({ positionId: papel!.id, characterId: personagem!.id, type: "ROTATION" as any, config: { characterId: personagem!.id, memberIds: [] } as any, order: 0 }).returning();

  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const token = signAccessToken({ sub: admin.id, jti: `${tag}_a`, organizationId: org!.id, role: "ADMIN", operationIds: [op!.id] });

  const nome = new Map(gente.map((g, i) => [g.id, `p${i + 1}`]));
  /** Gera o Livro do dia e devolve (id do Livro, quem o motor pôs na vaga). */
  const gerar = async (date: string) => {
    const [scale] = await db.insert(scalesTable).values({ operationId: op!.id, locationId: loc!.id, title: `${tag}_${date}`, periodStart: date, periodEnd: date, status: "DRAFT", generatedAt: new Date(), generatedBy: admin.id, createdBy: admin.id }).returning();
    const r = await generateDailyBookDraftForScale({ showBookId: show!.id, date, scaleId: scale!.id, actorId: admin.id, organizationId: org!.id, reason: "teste do rodízio" });
    const [a] = await db.select({ userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable)
      .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
      .where(eq(dailyBookPositionsTable.dailyBookId, r.dailyBook.id));
    return { id: r.dailyBook.id, quem: a?.userId ?? null, snapshot: r.dailyBook.snapshotJson as { rotationWinners?: RotationWinners } };
  };
  const vivo = async (id: string) => {
    const res = await fetch(`${base}/daily-book/${id}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) });
    const corpo = (await res.json()) as { dailyBook: { scenes: { blocks: { positions: { assignments: { userId: string | null; status: string }[] }[] }[] }[] } };
    return corpo.dailyBook.scenes.flatMap((c) => c.blocks.flatMap((b) => b.positions.flatMap((p) => p.assignments))).find((a) => a.status !== "REMOVED")?.userId ?? null;
  };
  const avancos = async () => (await db.select().from(rotationDailyAdvancesTable).where(eq(rotationDailyAdvancesTable.characterId, personagem!.id))).length;

  try {
    // 1 · Dia 1 e dia 2 em rascunho: o segundo não repete o primeiro.
    const l1 = await gerar(d1);
    assert(l1.quem === p1.id, `dia 1: o primeiro da fila (p1) entra; veio ${l1.quem ? nome.get(l1.quem) : "ninguém"}`);
    assert(Object.values(l1.snapshot.rotationWinners ?? {})[0] === p1.id, "dia 1: o vencedor do rodízio fica guardado na geração");
    const l2 = await gerar(d2);
    assert(l2.quem === p2.id, `dia 2 (rascunho do dia 1 ainda sem publicar): entra p2, não repete p1; veio ${l2.quem ? nome.get(l2.quem) : "ninguém"}`);
    assert(await vivo(l2.id) === p2.id, "dia 2: a leitura ao vivo mantém p2 (não volta para p1)");
    assert(await vivo(l1.id) === p1.id, "dia 1: a leitura ao vivo continua p1 (o dia 2 não pesa para trás)");
    assert(await avancos() === 0, "nada foi publicado: nenhum avanço gravado");

    // 2 · Dia 1 descartado (cancelado): deixa de pesar.
    await db.update(dailyBooksTable).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(dailyBooksTable.id, l1.id));
    await db.update(dailyBooksTable).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(dailyBooksTable.id, l2.id));
    const l3 = await gerar(d3);
    assert(l3.quem === p1.id, `dias 1 e 2 cancelados: o dia 3 volta ao primeiro da fila (p1); veio ${l3.quem ? nome.get(l3.quem) : "ninguém"}`);

    // 3 · Restaurar o dia 1 (desfazer o descarte): volta a pesar.
    await db.update(dailyBooksTable).set({ status: "DRAFT", cancelledAt: null }).where(eq(dailyBooksTable.id, l1.id));
    await db.update(dailyBooksTable).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(dailyBooksTable.id, l3.id));
    const l3b = await gerar(d3 === d4 ? d3 : d4);
    assert(l3b.quem === p2.id, `dia 1 restaurado em rascunho: o dia seguinte não repete p1; veio ${l3b.quem ? nome.get(l3b.quem) : "ninguém"}`);

    // 4 · Publicar o dia 1: o avanço gravado substitui o rascunho, sem contar duas vezes.
    await db.update(dailyBooksTable).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(dailyBooksTable.id, l3b.id));
    await db.update(dailyBooksTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(dailyBooksTable.id, l1.id));
    await advanceRotationCountsFromWinners(l1.snapshot.rotationWinners ?? {}, d1);
    assert(await avancos() === 1, "publicar o dia 1 grava um avanço");
    const l5 = await gerar(`${d2.slice(0, 8)}20`);
    assert(l5.quem === p2.id, `dia 1 publicado: o dia seguinte entra p2; veio ${l5.quem ? nome.get(l5.quem) : "ninguém"}`);
    // Com p1 e p2 já feitos uma vez cada (dia 1 publicado e dia 5 em rascunho), o próximo é p3; e só depois a fila recomeça por p1.
    // Se o dia 1 contasse duas vezes (avanço + rascunho), p1 pesaria 2 e a volta da fila sairia errada.
    const l6 = await gerar(`${d3.slice(0, 8)}20`);
    assert(l6.quem === p3.id, `p1 (publicado) e p2 (rascunho) já fizeram: entra p3; veio ${l6.quem ? nome.get(l6.quem) : "ninguém"}`);
    const l7 = await gerar(`${d4.slice(0, 8)}20`);
    assert(l7.quem === p1.id, `todos fizeram uma vez: a fila recomeça em p1 (o dia 1 contou uma vez só); veio ${l7.quem ? nome.get(l7.quem) : "ninguém"}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
    await db.delete(rotationDailyAdvancesTable).where(eq(rotationDailyAdvancesTable.characterId, personagem!.id));
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, show!.id));
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, show!.id));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.id, linha!.id));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    await db.delete(characterCastTable).where(eq(characterCastTable.characterId, personagem!.id));
    await db.delete(charactersTable).where(eq(charactersTable.id, personagem!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, loc!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    const atores = [admin.id, ...gente.map((g) => g.id)];
    const mos = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, atores));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, atores), inArray(historyEventsTable.moId, mos.map((m) => m.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, atores));
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [atores]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [atores]).catch(() => undefined);
    await db.delete(usersTable).where(inArray(usersTable.id, atores));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
}

try { await run(); } catch (e) { console.error(e); failures.push(`exceção: ${(e as Error).message}`); } finally { await pool.end(); }
console.log(`\nrodizio-conta-rascunhos: ${passed} verificações ok, ${failures.length} falha(s)`);
if (failures.length) { failures.forEach((f) => console.log(` - ${f}`)); process.exit(1); }
