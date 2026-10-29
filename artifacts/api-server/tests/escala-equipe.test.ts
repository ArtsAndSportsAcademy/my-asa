/**
 * Equipe por local na Programação (0088, pacote O, passo O2): quem trabalha em cada local, em que dia da semana e, se a pessoa divide o dia,
 * de que hora a que hora. A tela manda a grade inteira; o servidor guarda só a diferença (nada é apagado), confere a versão que a pessoa
 * abriu, escreve no Registro e avisa com frase quem não pode. "Duplicar molde" leva a equipe junto, e a sugestão olha as Escalas publicadas.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable, scaleAllocationsTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { writeHistoryEvent } from "../src/lib/history-helper.js";
import { diferencaDaEquipe, lerLinhas, textoDaLinha, type LinhaGuardada } from "../src/services/escala-equipe.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Marca = { id: string; userId: string; weekday: number; inicio: string | null; fim: string | null };
const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

async function run() {
  // ── regras puras (sem banco): ler o que a tela mandou e achar a diferença ──
  const u1 = "11111111-1111-4111-8111-111111111111", u2 = "22222222-2222-4222-8222-222222222222";
  assert(!lerLinhas("não é lista").ok, "lerLinhas recusa o que não é uma lista");
  assert(!lerLinhas([{ userId: "x", weekday: 1 }]).ok, "lerLinhas recusa pessoa que não é um id");
  assert(!lerLinhas([{ userId: u1, weekday: 7 }]).ok && !lerLinhas([{ userId: u1, weekday: "" }]).ok, "lerLinhas recusa dia fora de 0 a 6 e dia vazio");
  assert(!lerLinhas([{ userId: u1, weekday: 1, inicio: "9:00" }]).ok, "lerLinhas recusa horário fora de HH:MM");
  const fimAntes = lerLinhas([{ userId: u1, weekday: 1, inicio: "13:00", fim: "09:00" }]);
  assert(!fimAntes.ok && /depois do início/.test(fimAntes.ok ? "" : fimAntes.erro), "lerLinhas recusa fim antes do início, com frase");
  const repetidas = lerLinhas([{ userId: u1, weekday: 1 }, { userId: u1.toUpperCase(), weekday: 1, inicio: null, fim: "" }]);
  assert(repetidas.ok && repetidas.linhas.length === 1, "lerLinhas junta a mesma marcação repetida (mesmo com o id em maiúsculas e horário vazio)");
  assert(textoDaLinha({ weekday: 1, inicio: null, fim: "13:00" }) === "segunda até 13:00" && textoDaLinha({ weekday: 2, inicio: "14:00", fim: null }) === "terça a partir de 14:00" && textoDaLinha({ weekday: 4, inicio: null, fim: null }) === "quinta", "textoDaLinha escreve a janela como gente fala");
  const guardadas: LinhaGuardada[] = [
    { id: "a", userId: u1, weekday: 1, inicio: "08:00:00", fim: null, active: true },
    { id: "b", userId: u1, weekday: 2, inicio: null, fim: null, active: false },
    { id: "c", userId: u2, weekday: 3, inicio: null, fim: null, active: true },
  ];
  const dif = diferencaDaEquipe(guardadas, [{ userId: u1, weekday: 1, inicio: "08:00", fim: null }, { userId: u1, weekday: 2, inicio: null, fim: null }, { userId: u2, weekday: 5, inicio: null, fim: null }]);
  assert(dif.reativar.length === 1 && dif.reativar[0]!.id === "b", "diferencaDaEquipe reativa a linha que tinha saído, em vez de criar outra");
  assert(dif.inserir.length === 1 && dif.inserir[0]!.weekday === 5 && dif.remover.length === 1 && dif.remover[0]!.id === "c", "diferencaDaEquipe insere só o novo e tira só o que sumiu");
  assert(!diferencaDaEquipe(guardadas, [{ userId: u1, weekday: 1, inicio: "08:00", fim: null }, { userId: u2, weekday: 3, inicio: null, fim: null }]).mudou, "diferencaDaEquipe não vê mudança quando o conjunto é o mesmo (horário 08:00:00 do banco = 08:00 da tela)");

  // ── com banco ──
  const tag = `equipe_${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local, outroLocal] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: local!.id }, { operationId: operation!.id, locationId: outroLocal!.id }]);
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id), supOutro = await mk("supoutro", area!.id), carol = await mk("carol", area!.id);
  const m1 = await mk("m1", area!.id), m2 = await mk("m2", area!.id), m3 = await mk("m3", area!.id), m4 = await mk("m4", area!.id);
  const todos = [admin, dir, sup, supOutro, carol, m1, m2, m3, m4];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supOutro.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[carol, m1, m2, m3, m4].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: area!.id, locationId: local!.id, supervisorId: sup.id }, { areaId: area!.id, locationId: outroLocal!.id, supervisorId: supOutro.id }]);

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
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(90_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asSupOutro = as(supOutro, "SUPERVISOR_A"), asCarol = as(carol, "MEMBER");

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-12-31" })).body.programacao as { id: string };
    const progOutra = (await asAdmin("POST", "/programacoes", { locationId: outroLocal!.id, nome: "Natal Acqua", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-12-31" })).body.programacao as { id: string };
    const eq0 = `/programacoes/${prog.id}/equipe`;

    // ── ler: quem vê, quem não vê, e o que vem junto ──
    const vazio = await asAdmin("GET", eq0);
    assert(vazio.status === 200 && Array.isArray(vazio.body.equipe) && vazio.body.equipe.length === 0 && vazio.body.versao === null && vazio.body.podeEditar === true, "equipe nova: lista vazia, versão nula e a Administração pode editar");
    const ids = (vazio.body.pessoas as { id: string }[]).map((p) => p.id);
    assert(ids.includes(carol.id) && ids.includes(sup.id) && !ids.includes(admin.id) && !ids.includes(dir.id), "as pessoas oferecidas são o elenco (com área); Administração e Direção não entram");
    const lePelaDirecao = await asDir("GET", eq0);
    assert(lePelaDirecao.status === 200 && lePelaDirecao.body.podeEditar === false, "a Direção lê a equipe, mas não edita");
    assert((await asSup("GET", eq0)).body.podeEditar === true, "a Supervisão do local lê e edita");
    const elencoLe = await asCarol("GET", eq0);
    assert(elencoLe.status === 403 && /Elenco/.test(elencoLe.text) && /Administração/.test(elencoLe.text), "o Elenco é recusado com a frase de quem pode e do perfil de quem tentou");
    const supDeFora = await asSupOutro("GET", eq0);
    assert(supDeFora.status === 403 && /outro local|não de/.test(supDeFora.text) && /Snowland/.test(supDeFora.text), "a Supervisão de outro local é recusada com frase que diz de qual local é a equipe");
    assert((await asAdmin("GET", "/programacoes/nao-e-id/equipe")).status === 404, "id quebrado na URL é 404 com frase");

    // ── gravar: pedir a versão, validar, recusar quem não pode ──
    const linhas1 = [
      { userId: carol.id, weekday: 1 }, { userId: carol.id, weekday: 3 },
      { userId: sup.id, weekday: 1, fim: "13:00" }, { userId: m1.id, weekday: 1, inicio: "14:00" },
    ];
    const semVersao = await asAdmin("PUT", eq0, { linhas: linhas1 });
    assert(semVersao.status === 400 && /versão/.test(semVersao.text), "sem a versão que a pessoa abriu, é 400 com frase");
    assert((await asAdmin("PUT", eq0, { baseVersao: null, linhas: [{ userId: carol.id, weekday: 9 }] })).status === 400, "dia da semana inválido é 400");
    const foraDoElenco = await asAdmin("PUT", eq0, { baseVersao: null, linhas: [{ userId: admin.id, weekday: 1 }] });
    assert(foraDoElenco.status === 400 && foraDoElenco.body.error === "PESSOA_FORA_DO_ELENCO" && /Nada foi salvo/.test(foraDoElenco.text), "quem não é do elenco (Administração) não entra na equipe, e nada é salvo");
    const dirTenta = await asDir("PUT", eq0, { baseVersao: null, linhas: linhas1 });
    assert(dirTenta.status === 403 && /Direção/.test(dirTenta.text) && /só lê/.test(dirTenta.text), "a Direção não grava a equipe e a frase diz que ela só lê");
    assert((await asCarol("PUT", eq0, { baseVersao: null, linhas: linhas1 })).status === 403, "o Elenco não grava a equipe");
    assert((await asSupOutro("PUT", eq0, { baseVersao: null, linhas: linhas1 })).status === 403, "a Supervisão de outro local não grava a equipe deste");
    assert((await asAdmin("GET", eq0)).body.equipe.length === 0, "as tentativas recusadas não gravaram nada");

    // ── gravar de verdade, em lote ──
    const grava = await asAdmin("PUT", eq0, { baseVersao: null, linhas: linhas1 });
    assert(grava.status === 200 && grava.body.mudou === true && grava.body.entraram === 4 && grava.body.equipe.length === 4 && typeof grava.body.versao === "string", "a Administração grava a grade de uma vez (4 marcações) e recebe a versão nova");
    const janela = (grava.body.equipe as Marca[]).find((l) => l.userId === sup.id);
    assert(janela?.fim === "13:00" && janela?.inicio === null, "a janela 'até 13:00' volta como HH:MM, sem segundos");
    const eventos = await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, prog.id));
    const daEquipe = eventos.filter((e) => e.action === "programacao.equipe_alterada");
    assert(daEquipe.length === 1 && /segunda até 13:00/.test(daEquipe[0]!.narrative) && /a partir de 14:00/.test(daEquipe[0]!.narrative), "entra UM evento no Registro, que conta quem entrou e em que janela");
    const versao1 = grava.body.versao as string;

    // ── gravar o mesmo conjunto de novo não faz nada ──
    const igual = await asAdmin("PUT", eq0, { baseVersao: versao1, linhas: linhas1 });
    assert(igual.status === 200 && igual.body.mudou === false && igual.body.versao === versao1, "mandar o mesmo conjunto não muda nada e não muda a versão");
    assert((await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, prog.id))).filter((e) => e.action === "programacao.equipe_alterada").length === 1, "e não entra evento novo no Registro (um por acontecimento)");

    // ── duas pessoas ao mesmo tempo: a que salva por cima de versão velha é barrada ──
    const velha = await asSup("PUT", eq0, { baseVersao: null, linhas: [{ userId: carol.id, weekday: 5 }] });
    assert(velha.status === 409 && velha.body.error === "VERSAO_MUDOU" && /Outra pessoa alterou a equipe/.test(velha.text) && velha.body.equipe.length === 4, "salvar sobre versão velha é 409, a frase diz o motivo de verdade e a resposta já traz a equipe nova");

    // ── tirar e voltar: remoção é lógica, a mesma linha reativa ──
    const sem = await asSup("PUT", eq0, { baseVersao: versao1, linhas: [{ userId: carol.id, weekday: 1 }] });
    assert(sem.status === 200 && sem.body.sairam === 3 && sem.body.equipe.length === 1, "a Supervisão do local grava (tirou 3 marcações)");
    const todasAsLinhas = await db.select().from(programacaoEquipeTable).where(eq(programacaoEquipeTable.programacaoId, prog.id));
    assert(todasAsLinhas.length === 4 && todasAsLinhas.filter((l) => l.active).length === 1, "o que saiu NÃO foi apagado: as 4 linhas seguem no banco, 3 inativas");
    const volta = await asAdmin("PUT", eq0, { baseVersao: sem.body.versao, linhas: linhas1 });
    assert(volta.status === 200 && volta.body.entraram === 3 && volta.body.equipe.length === 4, "desfazer é mandar o conjunto anterior de volta");
    assert((await db.select().from(programacaoEquipeTable).where(eq(programacaoEquipeTable.programacaoId, prog.id))).length === 4, "e voltar REATIVA as mesmas linhas, sem criar cópias");

    // ── Duplicar molde leva a equipe ──
    const copia = await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal 2", vigenciaInicio: "2027-01-01", vigenciaFim: "2027-02-28", copiarDeId: prog.id });
    assert(copia.status === 201 && copia.body.equipe === 4, "Duplicar molde leva as 4 marcações da equipe junto");
    const copiaId = (copia.body.programacao as { id: string }).id;
    const equipeCopia = (await asAdmin("GET", `/programacoes/${copiaId}/equipe`)).body.equipe as Marca[];
    assert(equipeCopia.length === 4 && equipeCopia.some((l) => l.userId === sup.id && l.fim === "13:00"), "a equipe da cópia tem as mesmas pessoas e janelas");
    const evCopia = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, copiaId))).find((e) => e.action === "programacao.criada");
    assert(/4 marcações de equipe/.test(evCopia?.narrative ?? ""), "o Registro da cópia diz quantas marcações de equipe vieram");
    assert((await asAdmin("GET", `/programacoes/${prog.id}/equipe`)).body.equipe.length === 4, "a equipe do molde original não mudou");

    // ── sugestão pelas Escalas já feitas ──
    const semHistorico = (await asAdmin("GET", `/programacoes/${progOutra.id}/equipe/sugestao`)).body;
    assert(semHistorico.semHistorico === true && semHistorico.sugestoes.length === 0 && semHistorico.escalasLidas === 0, "sem Escala publicada no período, a sugestão diz que não há histórico (vazio explicado)");
    const datas = [somarDias(hoje, -7), somarDias(hoje, -14), somarDias(hoje, -21)];
    const geral = "08:00|09:00|Boas-vindas", treino = "10:00|11:00|Treino";
    for (const [i, data] of datas.entries()) {
      const [escala] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_${data}`, periodStart: data, periodEnd: data, status: "PUBLISHED", createdBy: admin.id }).returning();
      const convocacao: Record<string, string[]> = {};
      for (const u of [sup, carol, m1, m2, m3, m4]) convocacao[u.id] = [geral];
      convocacao[carol.id] = [geral, treino];
      if (i === 0) convocacao[m1.id] = [geral, treino];
      await writeHistoryEvent({ category: "SCALE", action: "escala.publicada", title: "Escala do dia publicada", narrative: "teste", entityType: "escala", entityId: escala!.id, actorId: admin.id, orgId: org!.id, afterState: { convocacao } });
    }
    const sug = (await asAdmin("GET", `/programacoes/${prog.id}/equipe/sugestao`)).body;
    const diaDaSemana = new Date(`${datas[0]}T12:00:00Z`).getUTCDay();
    assert(sug.escalasLidas === 3 && sug.semHistorico === false, "a sugestão leu as 3 Escalas publicadas");
    assert(sug.sugestoes.length === 1 && sug.sugestoes[0].userId === carol.id, "só a Carol é sugerida: bloco de todo mundo não prova nada, e quem teve atividade em 1 de 3 dias fica de fora");
    const diaSug = sug.sugestoes[0].dias[0];
    assert(diaSug.weekday === diaDaSemana && diaSug.vezes === 3 && diaSug.de === 3 && /Carol|carol/.test(sug.sugestoes[0].frase) && /3 de 3/.test(sug.sugestoes[0].frase), "a sugestão diz o dia da semana e a conta (3 de 3), em frase de gente");
    assert((await asCarol("GET", `/programacoes/${prog.id}/equipe/sugestao`)).status === 403, "o Elenco não pede a sugestão");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, escalas.map((s) => s.id)));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [local!.id, outroLocal!.id]));
    if (progs.length) {
      await db.delete(programacaoEquipeTable).where(inArray(programacaoEquipeTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    }
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [local!.id, outroLocal!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-equipe`);
  process.stdout.write(`escala-equipe: ${passed} asserts passed\n`);
}

process.stdout.write("escala-equipe: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
