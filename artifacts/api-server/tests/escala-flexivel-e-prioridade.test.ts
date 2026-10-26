/**
 * Bloco flexível e prioridade na Escala do dia (0085, 26/10/2026).
 *  - Flexível: o almoço do papel é uma janela (11:00–13:00), não um horário fixo. O bloco vem marcado `flexivel`, e a tela o mostra numa linha
 *    só, sem nomes e sem choque. Vale para qualquer bloco da Programação.
 *  - Prioridade: a atividade ESPECÍFICA (ensaio com pessoas escolhidas, Livro do Dia, atividade só de hoje) ganha do bloco GERAL (todos ou
 *    área) no mesmo horário: a pessoa sai do geral em vez de aparecer nos dois.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scaleAllocationsTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { aplicarPrioridade, blocosSeCruzam, type BlocoDia } from "../src/services/escala-dia.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Bloco = { key: string; rotulo: string; flexivel?: boolean; pessoaIds: string[]; vazio: boolean; sinal: string | null; cedeu?: { userId: string; para: string }[] };

/** Os dois lados da regra, sem banco: o que cruza e o que cede. */
function conferirRegraPura() {
  assert(blocosSeCruzam({ inicio: "10:00", fim: "12:00" }, { inicio: "11:00", fim: "11:30" }), "um bloco dentro do outro se cruza");
  assert(!blocosSeCruzam({ inicio: "10:00", fim: "11:00" }, { inicio: "11:00", fim: "12:00" }), "um começa quando o outro termina: não se cruza");
  assert(blocosSeCruzam({ inicio: "10:00", fim: "11:00" }, { inicio: "10:00", fim: "10:30" }), "começar junto, os dois com fim, se cruza");
  assert(!blocosSeCruzam({ inicio: "10:00", fim: null }, { inicio: "10:00", fim: "10:30" }), "começar junto, um sem fim, não conta (mesma regra da tela)");
  const base = { fim: null, origem: "programacao", pessoaIds: [] as string[], vazio: false, sinal: null, showBookId: null, dailyBookId: null, dailyBookStatus: null, blocoId: null, allocationId: null } as const;
  const mk = (key: string, regra: BlocoDia["regra"], inicio: string, fim: string, pessoaIds: string[], extra: Partial<BlocoDia> = {}): BlocoDia => ({ ...base, key, rotulo: key, regra, inicio, fim, pessoaIds, ...extra });
  const geral = mk("GELO", "todos", "10:00", "12:00", ["a", "b", "c"]);
  const grupo = mk("GRUPO", "grupo", "10:00", "12:00", ["a", "b"]);
  const flex = mk("ALMOCO", "todos", "11:00", "13:00", ["a", "b", "c"], { flexivel: true });
  const ensaio = mk("ENSAIO", "pessoas", "11:00", "11:30", ["a"]);
  const livro = mk("SHOW", "livro", "11:30", "12:00", ["b"], { origem: "livro" });
  const outraGeral = mk("AULA", "area", "10:30", "11:30", ["a", "c"]);
  const blocos = [geral, grupo, flex, ensaio, livro, outraGeral];
  aplicarPrioridade(blocos);
  assert(geral.pessoaIds.join() === "c", "o bloco geral perde quem tem ensaio ou show no mesmo horário");
  assert(geral.cedeu?.map((c) => `${c.userId}>${c.para}`).sort().join() === "a>ENSAIO,b>SHOW", "o bloco geral guarda quem saiu e para qual atividade");
  assert(grupo.pessoaIds.join() === "a,b" && !grupo.cedeu, "bloco de grupo não cede nem toma ninguém");
  assert(flex.pessoaIds.join() === "a,b,c" && !flex.cedeu, "bloco flexível não cede");
  assert(ensaio.pessoaIds.join() === "a" && livro.pessoaIds.join() === "b", "a atividade específica não perde ninguém");
  assert(outraGeral.pessoaIds.join() === "c", "dois blocos gerais não se mexem entre si; só as específicas ganham (a sai da aula por causa do ensaio)");
  const sozinha = mk("TREINO", "todos", "10:00", "10:30", ["a"]);
  aplicarPrioridade([sozinha, mk("AULA2", "pessoas", "10:00", "10:30", ["a"])]);
  assert(sozinha.pessoaIds.length === 0 && sozinha.vazio === false && /atividade específica/.test(sozinha.sinal ?? ""), "bloco geral esvaziado pela prioridade não vira alarme de 'vazio': explica o motivo");
}

async function run() {
  conferirRegraPura();

  const tag = `flex_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: local!.id }]);
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id);
  const ana = await mk("ana", area!.id), beto = await mk("beto", area!.id), carol = await mk("carol", area!.id);
  const todos = [admin, dir, sup, ana, beto, carol];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: ana.id, operationId: operation!.id, role: "MEMBER", active: true },
    { userId: beto.id, operationId: operation!.id, role: "MEMBER", active: true },
    { userId: carol.id, operationId: operation!.id, role: "MEMBER", active: true },
  ]);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: local!.id, supervisorId: sup.id });

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
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asAna = as(ana, "MEMBER");

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    const criaBloco = (corpo: Record<string, unknown>, fn = asAdmin) => fn("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, regra: "todos", ...corpo });

    // ── quem pode marcar, e a recusa que explica ──
    const semFim = await criaBloco({ rotulo: "ALMOÇO", inicio: "11:00", flexivel: true });
    assert(semFim.status === 400 && /janela/.test(semFim.text) && /termina/.test(semFim.text), "bloco flexível sem horário de fim é recusado com frase (precisa da janela)");
    const dirTenta = await criaBloco({ rotulo: "ALMOÇO", inicio: "11:00", fim: "13:00", flexivel: true }, asDir);
    assert(dirTenta.status === 403 && /Direção/.test(dirTenta.text), "a Direção só lê: não cria bloco flexível, e a recusa diz o perfil");
    assert((await criaBloco({ rotulo: "ALMOÇO", inicio: "11:00", fim: "13:00", flexivel: true }, asAna)).status === 403, "o Elenco não cria bloco flexível");

    // ── a Programação do local: gelo para todos, ensaio de duas pessoas, almoço flexível ──
    const gelo = await criaBloco({ rotulo: "TREINO DE GELO", inicio: "10:00", fim: "12:00" });
    const ensaio = await criaBloco({ rotulo: "ENSAIO", inicio: "10:30", fim: "11:30", regra: "pessoas", pessoaIds: [ana.id, beto.id] });
    const almoco = await criaBloco({ rotulo: "ALMOÇO", inicio: "11:00", fim: "13:00", flexivel: true }, asSup);
    const aula = await criaBloco({ rotulo: "AULA", inicio: "14:00", fim: "15:00" });
    assert([gelo, ensaio, almoco, aula].every((r) => r.status === 201), "a Administração e a Supervisão do local criam os blocos");
    assert(almoco.body.bloco.flexivel === true && gelo.body.bloco.flexivel === false, "o bloco guarda a marca flexível; os outros nascem fixos");

    const dia = async (fn = asAdmin) => (await fn("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as { blocos: Bloco[]; escala: { id: string; version: number } | null };
    const por = (d: { blocos: Bloco[] }, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo)!;
    let d = await dia();
    const equipe = [sup.id, ana.id, beto.id, carol.id].sort().join();
    assert(por(d, "ALMOÇO").flexivel === true && por(d, "ALMOÇO").pessoaIds.slice().sort().join() === equipe, "o almoço vem marcado flexível e convoca todo mundo da regra (os nomes ficam no dado; a tela não os mostra)");
    assert(por(d, "TREINO DE GELO").pessoaIds.slice().sort().join() === [sup.id, carol.id].sort().join(), "prioridade: quem tem ensaio no mesmo horário sai do treino de gelo");
    assert(por(d, "TREINO DE GELO").cedeu?.length === 2 && por(d, "TREINO DE GELO").cedeu!.every((c) => c.para === "ENSAIO"), "o gelo guarda quem saiu e para qual atividade");
    assert(por(d, "ENSAIO").pessoaIds.slice().sort().join() === [ana.id, beto.id].sort().join(), "o ensaio fica com as duas pessoas");
    assert(por(d, "AULA").pessoaIds.length === 4 && !por(d, "AULA").cedeu, "bloco geral fora do horário do ensaio não muda");
    assert(por(d, "ALMOÇO").pessoaIds.includes(ana.id), "o almoço flexível não tira quem tem ensaio (não cede nem toma ninguém)");

    // ── atividade só de hoje também ganha do geral; ajuste do dia vence a prioridade ──
    const gerada = await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date });
    assert(gerada.status === 201, "a Escala do dia nasce");
    const escalaId = gerada.body.escala.id as string;
    const versao = async () => (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!.version;
    const manual = await asAdmin("POST", `/scales/${escalaId}/entries`, { memberIds: [carol.id], date, label: "FOTO DO ELENCO", startTime: "10:00", endTime: "10:30", expectedVersion: await versao() });
    assert(manual.status === 201 || manual.status === 200, `a atividade só de hoje grava (recebi ${manual.status})`);
    d = await dia();
    assert(!por(d, "TREINO DE GELO").pessoaIds.includes(carol.id) && por(d, "TREINO DE GELO").pessoaIds.join() === sup.id, "quem tem atividade só de hoje no horário também sai do treino de gelo");

    const volta = await asSup("POST", "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: por(d, "TREINO DE GELO").key, userId: ana.id, action: "ADICIONAR" });
    assert(volta.status === 200, `a Supervisão põe a pessoa de volta no gelo de propósito (recebi ${volta.status}: ${volta.text.slice(0, 120)})`);
    d = await dia();
    assert(por(d, "TREINO DE GELO").pessoaIds.includes(ana.id), "o ajuste do dia vence a prioridade: o que a Supervisão decidiu vale (e aí o choque volta a aparecer, como aviso)");

    // ── publicar: o Elenco recebe o almoço como janela, e a versão publicada guarda a prioridade ──
    await asSup("POST", "/escalas/dia/pronta", { locationId: local!.id, date, areaId: area!.id, pronta: true });
    const pub = await asAdmin("POST", `/escalas/${escalaId}/publicar`, { expectedVersion: await versao() });
    assert(pub.status === 200, `a Administração publica o dia (recebi ${pub.status}: ${pub.text.slice(0, 200)})`);
    const minha = (await asAna("GET", `/escalas/minha?date=${date}`)).body as { blocos: Bloco[] };
    const meuAlmoco = minha.blocos.find((b) => b.rotulo === "ALMOÇO");
    assert(meuAlmoco?.flexivel === true && !("pessoaIds" in meuAlmoco), "Minha escala traz o almoço marcado como janela, sem a lista de pessoas");
    assert(minha.blocos.some((b) => b.rotulo === "ENSAIO"), "Minha escala traz o ensaio");

    // ── desfazer: tirar a marca devolve o horário fixo; entra no Registro ──
    const bloco = (await asAdmin("GET", `/programacoes?locationId=${local!.id}`)).body.programacoes[0].blocos.find((b: { rotulo: string }) => b.rotulo === "ALMOÇO") as { id: string; updatedAt: string };
    const tira = await asAdmin("PATCH", `/programacoes/${prog.id}/blocos/${bloco.id}`, { flexivel: false, baseUpdatedAt: bloco.updatedAt });
    assert(tira.status === 200 && tira.body.bloco.flexivel === false, "a Administração tira a marca flexível");
    const evento = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id))).filter((e) => e.action === "programacao.bloco_alterado").pop();
    assert(/Deixou de ser flexível/.test(evento?.narrative ?? ""), "o Registro conta que o bloco deixou de ser flexível");
    const naoMudou = await asAdmin("PATCH", `/programacoes/${prog.id}/blocos/${bloco.id}`, { flexivel: true, fim: null, baseUpdatedAt: tira.body.bloco.updatedAt });
    assert(naoMudou.status === 400 && /janela/.test(naoMudou.text), "tirar o horário de fim de um bloco flexível é recusado com a mesma frase");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) {
      const sids = escalas.map((s) => s.id);
      await pool.query(`delete from escala_bloco_ajustes where scale_id = any($1::uuid[])`, [sids]);
      await pool.query(`delete from escala_areas_prontas where scale_id = any($1::uuid[])`, [sids]);
      await pool.query(`delete from escala_confirmacoes where scale_id = any($1::uuid[])`, [sids]);
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, sids));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-flexivel-e-prioridade`);
  process.stdout.write(`escala-flexivel-e-prioridade: ${passed} asserts passed\n`);
}

process.stdout.write("escala-flexivel-e-prioridade: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
