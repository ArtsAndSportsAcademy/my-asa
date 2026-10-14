/**
 * SONDAGEM (não é teste de regressão; fora da suíte padrão): com o mês todo gerado em rascunho,
 * a leitura ao vivo de cada dia mantém a pessoa que foi gravada na geração? E, marcando UMA folga
 * no meio do mês, quantos dias mudam? Mede o risco descrito no plano "gerar o mês em rascunho".
 *
 * Rode com: TEST_FILE=sondagem-mes-rodizio.test.ts (banco de TESTE). Demora: gera ~2 Livros por dia.
 * Variáveis: SONDAGEM_DIAS (padrão 14).
 */
import {
  db, pool, organizationsTable, operationsTable, usersTable, locationsTable, charactersTable, characterCastTable,
  rotationDailyAdvancesTable, showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable, showBookLinesTable,
  folgasTable, scalesTable, agendaEventsTable, dailyBooksTable, dailyBookScenesTable, dailyBookBlocksTable,
  dailyBookPositionsTable, dailyBookAssignmentsTable, userRolesTable, historyEventsTable, operationalChangesTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { generateDailyBookDraftForScale } from "../src/routes/daily-book.js";

const DIAS = Number(process.env.SONDAGEM_DIAS ?? 14);
const iso = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10); // a partir de 01/11/2026

type Pos = { name: string; isRemoved: boolean; assignments: { userId: string | null; userName: string | null; status: string }[] };
type Cena = { blocks: { positions: Pos[] }[] };

async function run() {
  const tag = `sond_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (s: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${s}`, username: `${tag}_${s}` }).returning())[0]!;
  const admin = await mk("admin");
  const gente = await Promise.all(["p1", "p2", "p3", "p4", "p5", "p6"].map(mk));
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: op!.id, role: "ADMIN", active: true },
    ...gente.map((g) => ({ userId: g.id, operationId: op!.id, role: "MEMBER" as const, active: true })),
  ]);
  const nome = new Map(gente.map((g) => [g.id, g.name.replace(`${tag}_`, "")]));
  const [loc] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  // 2 personagens em rodízio compartilhados por 2 shows (como Astrid/Yeti entre shows do mesmo local).
  const [c1] = await db.insert(charactersTable).values({ name: `${tag}_c1`, locationId: loc!.id, mode: "rodizio" }).returning();
  const [c2] = await db.insert(charactersTable).values({ name: `${tag}_c2`, locationId: loc!.id, mode: "rodizio" }).returning();
  await db.insert(characterCastTable).values([
    ...gente.slice(0, 4).map((g, i) => ({ characterId: c1!.id, personId: g.id, order: i, timesDone: 0 })),
    ...gente.slice(2, 6).map((g, i) => ({ characterId: c2!.id, personId: g.id, order: i, timesDone: 0 })),
  ]);
  const shows: string[] = [];
  for (const s of ["A", "B"]) {
    const [sb] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId: loc!.id, title: `${tag}_show${s}`, createdBy: admin.id }).returning();
    shows.push(sb!.id);
    const [sc] = await db.insert(showBookScenesTable).values({ showBookId: sb!.id, name: "Cena", order: 0 }).returning();
    const [bl] = await db.insert(showBookBlocksTable).values({ showBookId: sb!.id, sceneId: sc!.id, name: "Bloco", order: 0 }).returning();
    for (const [i, c] of [c1!, c2!].entries()) {
      const [role] = await db.insert(showBookRolesTable).values({ showBookId: sb!.id, blockId: bl!.id, name: `Papel${i + 1}`, order: i }).returning();
      await db.insert(showBookLinesTable).values({ positionId: role!.id, characterId: c.id, type: "ROTATION" as any, config: { characterId: c.id, memberIds: [] } as any, order: 0 });
    }
  }

  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const token = signAccessToken({ sub: admin.id, jti: `${tag}_a`, organizationId: org!.id, role: "ADMIN", operationIds: [op!.id] });
  const get = async (id: string) => ((await (await fetch(`${base}/daily-book/${id}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) })).json()) as { dailyBook: { scenes: Cena[] } }).dailyBook.scenes;

  const folgaIds: string[] = [];
  try {
    // 1 · Gera o mês EM ORDEM, como o botão vai fazer.
    const livros: { dia: number; showIdx: number; id: string }[] = [];
    const tempos: number[] = [];
    for (let d = 0; d < DIAS; d++) {
      const [scale] = await db.insert(scalesTable).values({ operationId: op!.id, locationId: loc!.id, title: `${tag}_${d}`, periodStart: iso(d), periodEnd: iso(d), status: "DRAFT", generatedAt: new Date(), generatedBy: admin.id, createdBy: admin.id }).returning();
      for (const [si, showId] of shows.entries()) {
        const t0 = Date.now();
        const r = await generateDailyBookDraftForScale({ showBookId: showId, date: iso(d), scaleId: scale!.id, actorId: admin.id, organizationId: org!.id, reason: "sondagem" });
        tempos.push(Date.now() - t0);
        livros.push({ dia: d, showIdx: si, id: r.dailyBook.id });
      }
    }
    console.log(`\nGerou ${livros.length} Livros (${DIAS} dias × 2 shows). Tempo por Livro: média ${Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)} ms, máx ${Math.max(...tempos)} ms.`);

    // 2 · O que foi gravado × o que a leitura ao vivo mostra, sem ninguém ter mexido em nada.
    const quem = (cenas: Cena[], papel: string) => {
      const p = cenas.flatMap((c) => c.blocks.flatMap((b) => b.positions)).find((x) => x.name === papel && !x.isRemoved);
      return p?.assignments.find((a) => a.status !== "REMOVED")?.userId ?? null;
    };
    const gravado = new Map<string, string | null>();
    // Leitura direta do que está gravado, por Livro e papel:
    const posGravadas = await db.select({ livro: dailyBookPositionsTable.dailyBookId, papel: dailyBookPositionsTable.name, u: dailyBookAssignmentsTable.userId })
      .from(dailyBookAssignmentsTable).innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
      .where(inArray(dailyBookPositionsTable.dailyBookId, livros.map((l) => l.id)));
    for (const g of posGravadas) gravado.set(`${g.livro}|${g.papel}`, g.u);

    const vivoBase = new Map<string, string | null>();
    let divergem = 0, total = 0;
    for (const l of livros) {
      const cenas = await get(l.id);
      for (const papel of ["Papel1", "Papel2"]) {
        const v = quem(cenas, papel), g = gravado.get(`${l.id}|${papel}`) ?? null;
        vivoBase.set(`${l.id}|${papel}`, v);
        total += 1; if (v !== g) divergem += 1;
      }
    }
    console.log(`\n[ESTABILIDADE] vagas em que a leitura ao vivo difere do que foi gravado na geração: ${divergem} de ${total}`);

    // Distribuição de quem faz o quê (leitura ao vivo)
    const cont = new Map<string, number>();
    for (const [k, v] of vivoBase) if (v) cont.set(`${k.split("|")[1]}:${nome.get(v)}`, (cont.get(`${k.split("|")[1]}:${nome.get(v)}`) ?? 0) + 1);
    console.log("[DISTRIBUIÇÃO ao vivo] vezes por pessoa e papel:", Object.fromEntries([...cont].sort()));

    // 3 · Uma folga no meio do mês: quantos dias mudam?
    const meio = Math.floor(DIAS / 2);
    const quemTrabalhaNoMeio = vivoBase.get(`${livros.find((l) => l.dia === meio && l.showIdx === 0)!.id}|Papel1`)!;
    const [f] = await db.insert(folgasTable).values({ userId: quemTrabalhaNoMeio, operationId: op!.id, type: "DAY_OFF", startDate: iso(meio), endDate: iso(meio), status: "ACTIVE", createdBy: admin.id }).returning();
    folgaIds.push(f!.id);
    const mudaram = new Set<number>();
    let vagasMudaram = 0;
    for (const l of livros) {
      const cenas = await get(l.id);
      for (const papel of ["Papel1", "Papel2"]) {
        if (quem(cenas, papel) !== vivoBase.get(`${l.id}|${papel}`)) { vagasMudaram += 1; mudaram.add(l.dia); }
      }
    }
    console.log(`\n[REAÇÃO A UMA FOLGA] ${nome.get(quemTrabalhaNoMeio)} de folga no dia ${meio + 1}: mudaram ${vagasMudaram} vagas em ${mudaram.size} dia(s): ${[...mudaram].map((d) => d + 1).join(", ")}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
    const chars = [c1!.id, c2!.id];
    await db.delete(rotationDailyAdvancesTable).where(inArray(rotationDailyAdvancesTable.characterId, chars));
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(inArray(dailyBooksTable.showBookId, shows));
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, shows));
    const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, shows));
    if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
    await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, shows));
    await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, shows));
    await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, shows));
    await db.delete(showBooksTable).where(inArray(showBooksTable.id, shows));
    for (const id of folgaIds) await db.delete(folgasTable).where(eq(folgasTable.id, id));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    await db.delete(characterCastTable).where(inArray(characterCastTable.characterId, chars));
    await db.delete(charactersTable).where(inArray(charactersTable.id, chars));
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

try { await run(); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
