/**
 * Dois defeitos vistos na conta real em 27/10/2026, na Escala do dia:
 *  1. Local que não abre num dia da semana (Snowland fecha às quartas) aparecia como aberto: a Programação virava atividade, o botão
 *     "Gerar" valia e dava para escalar gente. Agora: sem Escala feita, a leitura devolve `fechado` com a frase, sem projetar a
 *     Programação, e gerar o dia responde 409 LOCAL_FECHADO. O "Gerar o mês" já respeitava isso.
 *  2. A Escala de um local listava as pessoas escaladas em OUTRO local como se estivessem sem nada. Agora cada pessoa traz
 *     `noutroLocal` (onde, e de que hora a que hora); almoço e blocos de "todos" não contam. Só a leitura da tela pede isso.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areasTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationsTable, organizationsTable, pool,
  programacaoBlocosTable, programacoesTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Pessoa = { id: string; name: string; noutroLocal?: { localId: string; localNome: string; inicio: string; fim: string | null; atividades: number }[] };
type Dia = { fechado?: { motivo: string }; escala: { id: string } | null; pessoas: Pessoa[]; blocos: { rotulo: string; pessoaIds: string[] }[] };

async function run() {
  const tag = `fec_${Date.now()}`;
  const segunda = "2026-10-05", quarta = "2026-10-07";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  // Snowland não abre às quartas (3); Acqua abre todos os dias.
  const [snow, acqua] = await db.insert(locationsTable).values([
    { organizationId: org!.id, name: `${tag}_Snowland`, operatingDays: [1, 2, 4, 5, 6, 0] },
    { organizationId: org!.id, name: `${tag}_Acqua` },
  ]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: snow!.id }, { operationId: operation!.id, locationId: acqua!.id }]);
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Bailarinos` }).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), jeff = await mk("jeff", area!.id), carol = await mk("carol", area!.id), kim = await mk("kim", area!.id);
  const todos = [admin, jeff, carol, kim];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    ...[jeff, carol, kim].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = signAccessToken({ sub: admin.id, jti: `${tag}_admin`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const asAdmin = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
    };

    const progSnow = (await asAdmin("POST", "/programacoes", { locationId: snow!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    const progAcqua = (await asAdmin("POST", "/programacoes", { locationId: acqua!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    for (const [prog, b] of [
      [progSnow, { weekday: 1, inicio: "09:00", fim: "10:00", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [carol.id] }],
      [progSnow, { weekday: 3, inicio: "09:00", fim: "10:00", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [carol.id] }],
      [progAcqua, { weekday: 1, inicio: "08:40", fim: "09:40", rotulo: "ENSAIO POOL", regra: "pessoas", pessoaIds: [jeff.id] }],
      [progAcqua, { weekday: 1, inicio: "14:00", fim: "15:00", rotulo: "FISIOTERAPIA", regra: "pessoas", pessoaIds: [jeff.id] }],
      [progAcqua, { weekday: 1, inicio: "12:00", fim: "12:30", rotulo: "REUNIÃO DE TODOS", regra: "todos" }],
      [progAcqua, { weekday: 3, inicio: "08:40", fim: "09:40", rotulo: "ENSAIO POOL", regra: "pessoas", pessoaIds: [jeff.id] }],
    ] as [{ id: string }, Record<string, unknown>][]) assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, b)).status === 201, `bloco ${String(b.rotulo)} criado`);

    const dia = async (locationId: string, date: string) => ((await asAdmin("GET", `/escalas/dia?locationId=${locationId}&date=${date}`)).body.dia as Dia);

    // ── 1. dia fechado ──
    const fechado = await dia(snow!.id, quarta);
    assert(Boolean(fechado.fechado) && /não abre quartas/.test(fechado.fechado!.motivo) && new RegExp(`${tag}_Snowland`).test(fechado.fechado!.motivo), "Snowland na quarta devolve `fechado` com a frase de quem não abre e em que dia");
    assert(fechado.blocos.length === 0, "dia fechado sem Escala feita não projeta a Programação (o TREINO GELO de quarta não vira atividade)");
    const gerar = await asAdmin("POST", "/escalas/dia/gerar", { locationId: snow!.id, date: quarta });
    assert(gerar.status === 409 && gerar.body.error === "LOCAL_FECHADO" && /não abre quartas/.test(gerar.text), "gerar o dia de um local fechado: 409 LOCAL_FECHADO com a frase");
    const nenhumaEscala = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.locationId, snow!.id));
    assert(nenhumaEscala.length === 0, "a recusa não deixou Escala criada pelo caminho");
    const abertoOutroDia = await dia(snow!.id, segunda);
    assert(!abertoOutroDia.fechado && abertoOutroDia.blocos.some((b) => b.rotulo === "TREINO GELO"), "Snowland na segunda abre normalmente, com a Programação");
    const acquaQuarta = await dia(acqua!.id, quarta);
    assert(!acquaQuarta.fechado && acquaQuarta.blocos.some((b) => b.rotulo === "ENSAIO POOL"), "Acqua abre todos os dias: a quarta dela não é afetada");

    // ── 2. pessoa escalada em outro local ──
    const snowSegunda = await dia(snow!.id, segunda);
    const jeffNaSnow = snowSegunda.pessoas.find((p) => p.id === jeff.id)!;
    assert(Boolean(jeffNaSnow.noutroLocal) && jeffNaSnow.noutroLocal![0]!.localNome === `${tag}_Acqua`, "na Escala da Snowland, o Jeff (escalado na Acqua) vem com `noutroLocal` dizendo a Acqua");
    assert(jeffNaSnow.noutroLocal![0]!.inicio === "08:40" && jeffNaSnow.noutroLocal![0]!.fim === "15:00" && jeffNaSnow.noutroLocal![0]!.atividades === 2, "de 08:40 a 15:00, duas atividades (a reunião de todos não conta)");
    assert(!snowSegunda.pessoas.find((p) => p.id === carol.id)!.noutroLocal, "a Carol, que só tem atividade na Snowland, não vem marcada");
    assert(!snowSegunda.pessoas.find((p) => p.id === kim.id)!.noutroLocal, "a Kim, que só tem o bloco de todos da Acqua, não vem marcada");
    const acquaSegunda = await dia(acqua!.id, segunda);
    assert(acquaSegunda.pessoas.find((p) => p.id === carol.id)?.noutroLocal?.[0]?.localNome === `${tag}_Snowland`, "e o contrário: na Acqua, a Carol vem marcada com a Snowland");
    assert(!acquaSegunda.pessoas.find((p) => p.id === jeff.id)!.noutroLocal, "o Jeff, na Acqua, não é \"de outro local\"");
    const quartaSnow = await dia(snow!.id, quarta);
    assert(!quartaSnow.pessoas.some((p) => p.noutroLocal?.some((o) => o.localNome === `${tag}_Snowland`)), "local fechado não conta como lugar onde a pessoa está");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    for (const l of [snow!, acqua!]) {
      const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, l.id));
      if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacoesTable).where(eq(programacoesTable.locationId, l.id));
    }
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, operation!.id));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-local-fechado-e-outro-local`);
  process.stdout.write(`escala-local-fechado-e-outro-local: ${passed} asserts passed\n`);
}

process.stdout.write("escala-local-fechado-e-outro-local: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
