/**
 * Análise do pedido de folga (Etapa 3, tarefa 1): para cada dia pedido, quem já está de folga, quem
 * trabalha, a vaga da pessoa e quem pode cobrir. Só leitura. "Pode cobrir" = quem está na lista do
 * Livro do Show daquela vaga (titular, substitutos, rodízio), trabalha nesse dia e não está de folga.
 *
 * Contra PostgreSQL real de teste, via HTTP.
 */
import {
  db, pool, organizationsTable, operationsTable, usersTable, locationsTable, areasTable, areaLocalSupervisorsTable,
  showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable, showBookLinesTable,
  folgasTable, agendaEventsTable, historyEventsTable, operationalChangesTable,
  dailyBooksTable, dailyBookScenesTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookAssignmentsTable,
  userRolesTable, leaveRequestsTable,
} from "@workspace/db";
import { count, eq, inArray, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

type Dia = {
  date: string; deFolga: { id: string; name: string }[]; trabalham: { id: string; name: string }[];
  vagas: { personagem: string; pessoa: string; podeCobrir: { id: string; name: string }[] }[];
  resultado: { da: boolean; frase: string }; aviso: string | null; semEscala: boolean;
};

async function run() {
  const tag = `analise_${Date.now()}`;
  const d1 = "2026-11-10", d2 = "2026-11-11", d3 = "2026-11-12";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [outraOp] = await db.insert(operationsTable).values({ organizationId: outraOrg!.id, name: `${tag}_outraop`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_pat` }, { organizationId: org!.id, name: `${tag}_bai` }]).returning();
  const mk = async (key: string, areaId: string | null, role: string, organizationId = org!.id) => {
    const [u] = await db.insert(usersTable).values({ organizationId, name: `${tag}_${key}`, username: `${tag}_${key}`, areaId, defaultLocationId: local!.id }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: organizationId === org!.id ? operation!.id : outraOp!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, "ADMIN");
  const dir = await mk("dir", null, "DIR");
  const sup = await mk("sup", pat!.id, "SUPERVISOR_A");
  const supBai = await mk("supbai", bai!.id, "SUPERVISOR_A");
  const ana = await mk("ana", pat!.id, "MEMBER");
  const carol = await mk("carol", pat!.id, "MEMBER");
  const isa = await mk("isa", pat!.id, "MEMBER");
  const dani = await mk("dani", pat!.id, "MEMBER");   // na lista da Astrid, mas de folga
  const luz = await mk("luz", pat!.id, "MEMBER");     // na lista da Astrid, mas não trabalha neste dia
  const estranha = await mk("estranha", null, "ADMIN", outraOrg!.id);
  const ids = [admin, dir, sup, supBai, ana, carol, isa, dani, luz, estranha].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: local!.id, supervisorId: sup.id, active: true },
    { areaId: bai!.id, locationId: local!.id, supervisorId: supBai.id, active: true },
  ]);

  const bookIds: string[] = [];
  const showIds: string[] = [];
  let server: ReturnType<typeof app.listen> | null = null;
  try {
    // Show A: Astrid (Ana titular; Carol, Isa, Dani e Luz na lista de substitutos), Yeti (Carol) e Musical (Isa).
    const mkShow = async (title: string, roles: { name: string; config: Record<string, unknown>; type: string }[]) => {
      const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_${title}`, createdBy: admin.id }).returning();
      showIds.push(show!.id);
      const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Cena", order: 0 }).returning();
      const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Bloco", order: 0 }).returning();
      for (const [i, r] of roles.entries()) {
        const [role] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: block!.id, name: r.name, order: i }).returning();
        await db.insert(showBookLinesTable).values({ positionId: role!.id, type: r.type as never, config: r.config as never, order: 0 });
      }
      return show!;
    };
    const showA = await mkShow("showA", [
      { name: "Astrid", type: "TITULAR_SUBSTITUTE", config: { titularId: ana.id, substituteIds: [carol.id, isa.id, dani.id, luz.id] } },
      { name: "Yeti", type: "FIXED_PERSON", config: { userId: carol.id } },
      { name: "Musical", type: "FIXED_PERSON", config: { userId: isa.id } },
    ]);
    // Show B: Solo, só a Ana, sem nenhum substituto.
    const showB = await mkShow("showB", [{ name: "Solo", type: "TITULAR_SUBSTITUTE", config: { titularId: ana.id, substituteIds: [] } }]);

    await db.insert(folgasTable).values({ userId: dani.id, operationId: operation!.id, type: "DAY_OFF", startDate: d1, endDate: d1, status: "ACTIVE", createdBy: admin.id });

    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const base = `http://127.0.0.1:${(server!.address() as { port: number }).port}/api`;
    const tokenFor = (u: { id: string }, role: string, organizationId = org!.id) => signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId, role, operationIds: [organizationId === org!.id ? operation!.id : outraOp!.id] });
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      let resposta: Record<string, any> = {};
      try { resposta = text ? JSON.parse(text) : {}; } catch { /* resposta que não é JSON (rota inexistente) vira corpo vazio */ }
      return { status: r.status, body: resposta };
    };
    const asAdmin = tokenFor(admin, "ADMIN"), asSup = tokenFor(sup, "SUPERVISOR_A"), asSupBai = tokenFor(supBai, "SUPERVISOR_A");
    const asDir = tokenFor(dir, "DIR"), asAna = tokenFor(ana, "MEMBER"), asEstranha = tokenFor(estranha, "ADMIN", outraOrg!.id);

    // Pedido só espera decisão quando o mapa do mês já foi publicado (senão entra como prioridade): publica os meses usados.
    for (const [year, month] of [[2026, 11], [2026, 12]]) {
      assert((await call("POST", "/folgas/grid/publicar", asAdmin, { operationId: operation!.id, year, month })).status === 200, `preparo: publicar o mapa de ${month}/${year}`);
    }
    for (const [show, date] of [[showA, d1], [showB, d3]] as const) {
      const gen = await call("POST", "/daily-book/generate", asAdmin, { showBookId: show.id, date });
      assert(gen.status === 201, `preparo: gerar o Livro do Dia de ${date}`);
      if (gen.body.dailyBook?.id) bookIds.push(gen.body.dailyBook.id);
    }
    const pedir = async (startDate: string, endDate: string) => {
      const r = await call("POST", "/leave-requests", asAna, { startDate, endDate, reason: "teste da análise" });
      assert(r.status === 201, `preparo: Ana pede folga de ${startDate} a ${endDate}`);
      return r.body.request?.id as string;
    };
    const pedido1 = await pedir(d1, d1), pedido2 = await pedir(d2, d2), pedido3 = await pedir(d3, d3), pedidoLongo = await pedir("2026-11-14", "2026-12-03");

    // 1 · Dia com a Astrid.
    const a1 = await call("GET", `/leave-requests/${pedido1}/analise`, asSup);
    const dia1: Dia | undefined = a1.body.dias?.[0];
    assert(a1.status === 200 && a1.body.dias?.length === 1 && a1.body.cortado === false, "a Supervisão da área lê a análise de um dia");
    assert(!!dia1 && dia1.deFolga.some((p) => p.id === dani.id) && !dia1.deFolga.some((p) => p.id === carol.id), "lista quem já está de folga no dia (a Dani sim, a Carol não)");
    assert(!!dia1 && [carol.id, isa.id].every((id) => dia1.trabalham.some((p) => p.id === id)), "lista quem trabalha no dia (Carol e Isa estão em vagas)");
    const astrid = dia1?.vagas.find((v) => v.personagem === "Astrid");
    assert(!!astrid && astrid.pessoa === ana.name, "a vaga da Ana aparece como personagem · pessoa");
    const cobrem = new Set(astrid?.podeCobrir.map((p) => p.id));
    assert(cobrem.has(carol.id) && cobrem.has(isa.id), "podem cobrir a Astrid: quem está na lista e trabalha nesse dia");
    assert(!cobrem.has(dani.id), "quem está na lista mas está de folga não cobre");
    assert(!cobrem.has(luz.id), "quem está na lista mas não trabalha nesse dia não cobre");
    assert(dia1?.resultado.da === true && /Astrid/.test(dia1.resultado.frase), "resultado: dá, e a frase nomeia a vaga");
    assert(dia1?.semEscala === false, "dia com Livro gerado tem escala");

    // 1b · Troca possível: a Dani (na lista da Astrid) está de folga neste dia, então pode receber uma folga da Ana.
    const folgaDaAna = "2026-11-15";
    await db.insert(folgasTable).values({ userId: ana.id, operationId: operation!.id, type: "DAY_OFF", startDate: folgaDaAna, endDate: folgaDaAna, status: "ACTIVE", createdBy: admin.id });
    const comTroca = await call("GET", `/leave-requests/${pedido1}/analise`, asSup);
    const colegaTroca = (comTroca.body.troca?.colegas as { id: string; dias: string[] }[] | undefined)?.find((c) => c.id === dani.id);
    assert(!!colegaTroca && colegaTroca.dias.includes(folgaDaAna), "pedido de um dia: oferece a troca com quem está de folga e na lista da vaga, com os dias que ele poderia receber");
    assert(!(comTroca.body.troca?.colegas as { id: string }[] | undefined)?.some((c) => c.id === carol.id), "quem trabalha nesse dia não aparece como troca (é cobertura)");
    assert((await call("GET", `/leave-requests/${pedidoLongo}/analise`, asSup)).body.troca === null, "pedido de vários dias não oferece troca");

    // 2 · Dia sem Escala nem Livro: a tela precisa dizer, não ficar em branco.
    const a2 = await call("GET", `/leave-requests/${pedido2}/analise`, asSup);
    assert(a2.body.dias?.[0]?.semEscala === true && a2.body.dias[0].resultado.da === true && /ainda não tem Escala/.test(a2.body.dias[0].resultado.frase), "dia sem Escala: diz que falta gerar e o pedido entra");

    // 3 · Vaga sem nenhum substituto: não dá, e a frase diz por quê.
    const a3 = await call("GET", `/leave-requests/${pedido3}/analise`, asSup);
    const dia3: Dia | undefined = a3.body.dias?.[0];
    assert(dia3?.resultado.da === false && /substituto/.test(dia3.resultado.frase) && /Solo/.test(dia3.resultado.frase), "vaga sem substituto: não dá, e a frase cita a vaga e o substituto");

    // 3b · Quem já está de folga no dia pedido: não é "não dá", é "já está de folga".
    await db.insert(folgasTable).values({ userId: ana.id, operationId: operation!.id, type: "DAY_OFF", startDate: d3, endDate: d3, status: "ACTIVE", createdBy: admin.id });
    const a3b = await call("GET", `/leave-requests/${pedido3}/analise`, asSup);
    assert(a3b.body.dias?.[0]?.resultado.da === true && /já está de folga/.test(a3b.body.dias[0].resultado.frase), "quem já está de folga nesse dia: a análise diz isso em vez de \"não dá\"");

    // 4 · Pedido longo: corta em 14 dias.
    const aLongo = await call("GET", `/leave-requests/${pedidoLongo}/analise`, asSup);
    assert(aLongo.body.dias?.length === 14 && aLongo.body.cortado === true, "pedido de 20 dias: mostra os 14 primeiros e avisa que cortou");

    // 5 · Quem pode ler.
    assert((await call("GET", `/leave-requests/${pedido1}/analise`, asAdmin)).status === 200, "Administração lê a análise");
    assert((await call("GET", `/leave-requests/${pedido1}/analise`, asDir)).status === 200, "Direção lê a análise");
    const elenco = await call("GET", `/leave-requests/${pedido1}/analise`, asAna);
    assert(elenco.status === 403 && /só é para quem decide/.test(elenco.body.message ?? ""), "Elenco recebe 403 com uma frase que explica");
    assert((await call("GET", `/leave-requests/${pedido1}/analise`, asSupBai)).status === 403, "Supervisão de outra área recebe 403");
    assert((await call("GET", `/leave-requests/${pedido1}/analise`, asEstranha)).status === 404, "outra organização recebe 404");

    // 6 · Só leitura: nada é gravado.
    const contar = async () => ({
      historico: (await db.select({ n: count() }).from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id)))[0]!.n,
      folgas: (await db.select({ n: count() }).from(folgasTable).where(eq(folgasTable.operationId, operation!.id)))[0]!.n,
    });
    const antes = await contar();
    await call("GET", `/leave-requests/${pedido1}/analise`, asSup);
    const depois = await contar();
    assert(antes.historico === depois.historico && antes.folgas === depois.folgas, "a análise não grava nada (Registro e folgas iguais)");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    for (const id of bookIds) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    if (showIds.length) {
      await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, showIds));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
      await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, showIds));
      await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, showIds));
      await db.delete(showBooksTable).where(inArray(showBooksTable.id, showIds));
    }
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.operationId, [operation!.id, outraOp!.id]));
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [operation!.id, outraOp!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na análise do pedido de folga`);
  process.stdout.write(`folga-analise: ${passed} asserts passed\n`);
}

process.stdout.write("folga-analise: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
