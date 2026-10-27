/**
 * Chamadas da Escala (0086, 27/10/2026), etapa F1: dados e leitura.
 *  - A janela de uma chamada: hora fixa ou "X minutos antes" do início; termina, no máximo, quando a atividade começa.
 *  - Quem cria e mexe (Administração, Supervisão do local; a Direção só lê; o Elenco não); a recusa diz o perfil.
 *  - A Escala do dia traz as chamadas, com as pessoas da atividade (no show, as do Livro do Dia); folga vence.
 *  - Copiar para as outras sessões do show (hora fixa mantém a distância do início); não duplica.
 *  - Tirar não apaga; conferência de versão ao salvar; uma casa não enxerga a outra; Registro.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable,
  dailyBooksTable, db, escalaAreasProntasTable, escalaBlocoAjustesTable, escalaChamadasTable, folgasTable, historyEventsTable, locationsTable,
  operationLocationsTable, operationalChangesTable, operationsTable, organizationsTable, pool, programacaoBlocosTable, programacoesTable,
  scaleAllocationsTable, scalesTable, sessionsTable, showBookBlocksTable, showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable,
  userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { janelaDaChamada, lerChamada } from "../src/services/escala-chamadas.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Chamada = { id: string; nome: string; inicio: string; fim: string; ocupaTempo: boolean; avisar: boolean; dona: string; atividade: { key: string; rotulo: string; inicio: string }; pessoaIds: string[] };
type Dia = { blocos: { key: string; rotulo: string; pessoaIds: string[] }[]; chamadas: Chamada[] };

/** As regras puras, sem banco. */
function conferirRegraPura() {
  const j = (c: Partial<Parameters<typeof janelaDaChamada>[0]>, inicio: string) => janelaDaChamada({ modo: "fixo", horaFixa: null, minutosAntes: null, duracaoMin: 15, ...c }, inicio);
  assert(JSON.stringify(j({ modo: "fixo", horaFixa: "13:00", duracaoMin: 30 }, "14:00")) === JSON.stringify({ inicio: "13:00", fim: "13:30" }), "hora fixa 13:00 por 30 min, show às 14:00: das 13:00 às 13:30");
  assert(JSON.stringify(j({ modo: "antes", minutosAntes: 15 }, "14:00")) === JSON.stringify({ inicio: "13:45", fim: "14:00" }), "15 min antes do show das 14:00: das 13:45 às 14:00");
  assert(JSON.stringify(j({ modo: "antes", minutosAntes: 15 }, "14:30")) === JSON.stringify({ inicio: "14:15", fim: "14:30" }), "'X minutos antes' acompanha o horário: o show foi para 14:30, a chamada para 14:15");
  assert(JSON.stringify(j({ modo: "fixo", horaFixa: "13:00" }, "14:30")) === JSON.stringify({ inicio: "13:00", fim: "13:15" }), "hora fixa não acompanha o horário do show");
  assert(JSON.stringify(j({ modo: "antes", minutosAntes: 10, duracaoMin: 60 }, "14:00")) === JSON.stringify({ inicio: "13:50", fim: "14:00" }), "a chamada termina, no máximo, quando a atividade começa (não invade a atividade)");
  assert(j({ modo: "fixo", horaFixa: "14:00" }, "14:00") === null && j({ modo: "fixo", horaFixa: "14:30" }, "14:00") === null, "chamada que começa na hora da atividade ou depois dela não se aplica");
  assert(j({ modo: "antes", minutosAntes: 600 }, "09:00") === null, "'X minutos antes' que passa da meia-noite não se aplica");

  const ok = (corpo: Record<string, unknown>) => lerChamada(corpo, false);
  assert(ok({ nome: "Aquecimento", modo: "fixo", horaFixa: "13:00" }).ok, "chamada mínima (nome, modo e hora) é aceita");
  const padrao = ok({ nome: "Aquecimento", modo: "fixo", horaFixa: "13:00" });
  assert(padrao.ok && padrao.valor.duracaoMin === 15 && padrao.valor.ocupaTempo === true && padrao.valor.avisar === true, "padrões: 15 min, ocupa tempo, avisa");
  assert(!ok({ nome: "A", modo: "fixo", horaFixa: "13:00" }).ok, "nome de uma letra é recusado");
  assert(!ok({ nome: "Aquecimento", modo: "fixo" }).ok && !ok({ nome: "Aquecimento", modo: "fixo", horaFixa: "25:00" }).ok, "modo fixo exige uma hora válida");
  assert(!ok({ nome: "Aquecimento", modo: "antes" }).ok && !ok({ nome: "Aquecimento", modo: "antes", minutosAntes: 0 }).ok && !ok({ nome: "Aquecimento", modo: "antes", minutosAntes: 601 }).ok, "modo antes exige de 1 a 600 minutos");
  assert(!ok({ nome: "Aquecimento", modo: "fixo", horaFixa: "13:00", duracaoMin: 4 }).ok && !ok({ nome: "Aquecimento", modo: "fixo", horaFixa: "13:00", duracaoMin: 241 }).ok, "duração fora de 5 a 240 é recusada");
  const so = lerChamada({ modo: "antes", minutosAntes: 20 }, false);
  assert(!so.ok, "sem nome não passa, mesmo com horário");
}

async function run() {
  conferirRegraPura();

  const tag = `chamadas_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira → weekday 1
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [outraOp] = await db.insert(operationsTable).values({ organizationId: outraOrg!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Rinque` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [patinadores] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null, organizationId = org!.id) => (await db.insert(usersTable).values({
    organizationId, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: organizationId === org!.id ? local!.id : null,
  }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", patinadores!.id);
  const julia = await mk("julia", patinadores!.id), carol = await mk("carol", patinadores!.id), admin2 = await mk("admin2", null, outraOrg!.id);
  const everyone = [admin, dir, sup, julia, carol, admin2];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[julia, carol].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    { userId: admin2.id, operationId: outraOp!.id, role: "ADMIN", active: true },
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: patinadores!.id, locationId: local!.id, supervisorId: sup.id }]);

  // Um show com duas posições fixas e duas sessões (14:00 e 17:00).
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Abertura", order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
  const roles = await db.insert(showBookRolesTable).values([
    { showBookId: show!.id, blockId: block!.id, name: "BL 01", order: 0 },
    { showBookId: show!.id, blockId: block!.id, name: "BL 02", order: 1 },
  ]).returning();
  await db.insert(showBookLinesTable).values([
    { positionId: roles[0]!.id, type: "FIXED_PERSON", config: { userId: julia.id }, order: 0 },
    { positionId: roles[1]!.id, type: "FIXED_PERSON", config: { userId: carol.id }, order: 0 },
  ]);
  const [sessao1, sessao2] = await db.insert(sessionsTable).values([
    { showId: show!.id, startTime: "14:00", endTime: "14:45", separada: false, active: true },
    { showId: show!.id, startTime: "17:00", endTime: "17:45", separada: false, active: true },
  ]).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string, organizationId = org!.id, operationId = operation!.id) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId, role, operationIds: [operationId] });
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asJulia = as(julia, "MEMBER"), asOutra = as(admin2, "ADMIN", outraOrg!.id, outraOp!.id);
    const cria = (corpo: Record<string, unknown>, fn = asAdmin) => fn("POST", "/escalas/chamadas", { sessionId: sessao1!.id, ...corpo });

    // ── quem pode, e a recusa que explica ──
    const aquecimento = await cria({ nome: "Aquecimento", modo: "fixo", horaFixa: "13:00", duracaoMin: 30 });
    assert(aquecimento.status === 201 && aquecimento.body.chamada.janela?.inicio === "13:00" && aquecimento.body.chamada.janela?.fim === "13:30", "a Administração cria a chamada e a resposta já traz a janela (13:00–13:30)");
    const dirTenta = await cria({ nome: "Teste", modo: "antes", minutosAntes: 10 }, asDir);
    assert(dirTenta.status === 403 && /Direção/.test(dirTenta.text), "a Direção só lê: não cria chamada, e a recusa diz o perfil");
    assert((await cria({ nome: "Teste", modo: "antes", minutosAntes: 10 }, asJulia)).status === 403, "o Elenco não cria chamada");
    const dirLe = await asDir("GET", `/escalas/chamadas?sessionId=${sessao1!.id}`);
    assert(dirLe.status === 200 && dirLe.body.podeEditar === false && dirLe.body.chamadas.length === 1, "a Direção lê as chamadas, e a tela sabe que ela não edita");
    const call = await cria({ nome: "Call do show", modo: "antes", minutosAntes: 15, duracaoMin: 15, ocupaTempo: false }, asSup);
    assert(call.status === 201 && call.body.chamada.ocupaTempo === false && call.body.chamada.janela?.inicio === "13:45", "a Supervisão do local também cria (a do show é 'só informa', 15 min antes = 13:45)");

    // ── o que é recusado, com frase ──
    const tarde = await cria({ nome: "Tarde demais", modo: "fixo", horaFixa: "14:10" });
    assert(tarde.status === 400 && /antes do início/.test(tarde.text) && /14:00/.test(tarde.text), "chamada depois do início do show é recusada, citando a hora do show");
    assert((await cria({ nome: "", modo: "fixo", horaFixa: "13:00" })).status === 400, "chamada sem nome é recusada");
    assert((await asAdmin("POST", "/escalas/chamadas", { nome: "Solta", modo: "fixo", horaFixa: "13:00" })).status === 400, "chamada sem dona (sessão ou bloco) é recusada com frase");
    assert((await asAdmin("POST", "/escalas/chamadas", { sessionId: "nao-e-uuid", nome: "Solta", modo: "fixo", horaFixa: "13:00" })).status === 404, "id quebrado dá 404, não 500");

    // ── a Programação do local: o show nas duas sessões e uma aula com chamada própria ──
    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    const bloco = async (corpo: Record<string, unknown>) => (await asAdmin("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, ...corpo })).body.bloco as { id: string; updatedAt: string };
    const showManha = await bloco({ rotulo: "SHOW", inicio: "14:00", fim: "14:45", regra: "livro", showBookId: show!.id });
    await bloco({ rotulo: "SHOW TARDE", inicio: "17:00", fim: "17:45", regra: "livro", showBookId: show!.id });
    const aula = await bloco({ rotulo: "AULA", inicio: "09:00", fim: "10:00", regra: "todos" });
    const chegada = await asSup("POST", "/escalas/chamadas", { programacaoBlocoId: aula.id, nome: "Chegada", modo: "antes", minutosAntes: 10 });
    assert(chegada.status === 201 && chegada.body.chamada.janela?.inicio === "08:50", "a Supervisão cria chamada de um bloco da Programação (a aula das 09:00, 10 min antes = 08:50)");
    assert((await asDir("POST", "/escalas/chamadas", { programacaoBlocoId: aula.id, nome: "Chegada", modo: "antes", minutosAntes: 10 })).status === 403, "a Direção não cria chamada de bloco da Programação");

    // ── a Escala do dia traz as chamadas, com as pessoas da atividade ──
    assert((await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date })).status === 201, "dia gerado com o Livro do Dia do show");
    const dia = async (fn = asAdmin) => (await fn("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia;
    let d = await dia();
    const doShow = d.chamadas.filter((c) => c.atividade.rotulo === "SHOW");
    assert(doShow.map((c) => `${c.nome} ${c.inicio}-${c.fim}`).join("|") === "Aquecimento 13:00-13:30|Call do show 13:45-14:00", "o dia traz as duas chamadas do show, em ordem de horário, com a janela calculada");
    assert(doShow.every((c) => c.dona === "sessao" && c.pessoaIds.slice().sort().join() === [julia.id, carol.id].sort().join()), "no show, quem vai na chamada é quem está no Livro do Dia");
    assert(doShow[0]!.ocupaTempo === true && doShow[1]!.ocupaTempo === false && doShow.every((c) => c.avisar), "a chamada leva 'ocupa tempo' e 'avisar' como foram configurados");
    assert(d.chamadas.filter((c) => c.atividade.rotulo === "SHOW TARDE").length === 0, "a sessão das 17:00 ainda não tem chamada: o dia não inventa");
    const daAula = d.chamadas.filter((c) => c.atividade.rotulo === "AULA");
    assert(daAula.length === 1 && daAula[0]!.dona === "bloco" && daAula[0]!.inicio === "08:50" && daAula[0]!.fim === "09:00" && daAula[0]!.pessoaIds.slice().sort().join() === [sup.id, julia.id, carol.id].sort().join(), "a chamada da aula (bloco da Programação) vai a quem a aula convoca (as três pessoas com área)");
    assert((await dia(asDir)).chamadas.length === 3, "a Direção vê as chamadas do dia");

    // ── folga vence: quem está de folga não recebe a chamada ──
    await db.insert(folgasTable).values({ userId: carol.id, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, createdBy: admin.id });
    d = await dia();
    assert(d.chamadas.filter((c) => c.atividade.rotulo === "SHOW").every((c) => c.pessoaIds.length === 1 && c.pessoaIds[0] === julia.id), "de folga, a pessoa não entra na chamada do show");
    assert(d.chamadas.find((c) => c.atividade.rotulo === "AULA")!.pessoaIds.includes(carol.id) === false, "de folga, a pessoa não entra na chamada da aula");
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));

    // ── copiar para as outras sessões ──
    const copia = await asAdmin("POST", "/escalas/chamadas/copiar", { deSessionId: sessao1!.id });
    assert(copia.status === 200 && copia.body.copiadas === 2 && copia.body.resultado.length === 1 && copia.body.resultado[0].sessionId === sessao2!.id, "copiar leva as duas chamadas para a outra sessão do show");
    d = await dia();
    const tardeChamadas = d.chamadas.filter((c) => c.atividade.rotulo === "SHOW TARDE").map((c) => `${c.nome} ${c.inicio}-${c.fim}`).join("|");
    assert(tardeChamadas === "Aquecimento 16:00-16:30|Call do show 16:45-17:00", "a hora fixa mantém a distância do início (13:00 numa sessão das 14:00 vira 16:00 na das 17:00); 'X minutos antes' vai igual");
    const denovo = await asAdmin("POST", "/escalas/chamadas/copiar", { deSessionId: sessao1!.id });
    assert(denovo.status === 200 && denovo.body.copiadas === 0 && /já tem chamadas/.test(denovo.text), "copiar de novo não duplica: a sessão que já tem chamadas é pulada, com o motivo");
    assert((await asDir("POST", "/escalas/chamadas/copiar", { deSessionId: sessao1!.id })).status === 403, "a Direção não copia chamadas");
    assert((await asAdmin("POST", "/escalas/chamadas/copiar", { deSessionId: sessao2!.id, paraSessionIds: [sessao1!.id] })).status === 200, "dá para escolher para quais sessões copiar");

    // ── "X minutos antes" acompanha o horário; hora fixa não ──
    await db.update(sessionsTable).set({ startTime: "14:30", endTime: "15:15" }).where(eq(sessionsTable.id, sessao1!.id));
    await asAdmin("PATCH", `/programacoes/${prog.id}/blocos/${showManha.id}`, { inicio: "14:30", fim: "15:15", baseUpdatedAt: showManha.updatedAt });
    d = await dia();
    assert(d.chamadas.filter((c) => c.atividade.rotulo === "SHOW").map((c) => `${c.nome} ${c.inicio}-${c.fim}`).join("|") === "Aquecimento 13:00-13:30|Call do show 14:15-14:30", "o show foi para 14:30: a chamada '15 min antes' foi para 14:15 e a de hora fixa ficou em 13:00");

    // ── mudar, versão e tirar sem apagar ──
    const lista = (await asAdmin("GET", `/escalas/chamadas?sessionId=${sessao1!.id}`)).body.chamadas as { id: string; nome: string; updatedAt: string }[];
    const alvo = lista.find((c) => c.nome === "Aquecimento")!;
    const muda = await asAdmin("PATCH", `/escalas/chamadas/${alvo.id}`, { nome: "Aquecimento geral", baseUpdatedAt: alvo.updatedAt });
    assert(muda.status === 200 && muda.body.chamada.nome === "Aquecimento geral", "mudar o nome da chamada");
    const velha = await asAdmin("PATCH", `/escalas/chamadas/${alvo.id}`, { nome: "Outro nome", baseUpdatedAt: alvo.updatedAt });
    assert(velha.status === 409 && /Outra pessoa alterou/.test(velha.text), "salvar sobre uma versão velha é recusado com a frase de verdade (409)");
    assert((await asDir("PATCH", `/escalas/chamadas/${alvo.id}`, { nome: "Direção" })).status === 403, "a Direção não muda chamada");
    assert((await asAdmin("PATCH", `/escalas/chamadas/${alvo.id}`, { modo: "fixo", horaFixa: "15:00" })).status === 400, "mudar a hora para depois do início do show é recusado");
    const tira = await asAdmin("DELETE", `/escalas/chamadas/${alvo.id}`);
    assert(tira.status === 200 && !tira.body.chamadas.some((c: { id: string }) => c.id === alvo.id), "tirar a chamada a esconde da lista");
    const nasce = await db.select().from(escalaChamadasTable).where(eq(escalaChamadasTable.id, alvo.id));
    assert(nasce.length === 1 && nasce[0]!.active === false, "tirar não apaga: a chamada fica inativa no banco");
    assert(!(await dia()).chamadas.some((c) => c.chamadaId === alvo.id), "chamada tirada sai do dia");
    const volta = await asAdmin("PATCH", `/escalas/chamadas/${alvo.id}`, { active: true });
    assert(volta.status === 200 && (await dia()).chamadas.some((c) => c.chamadaId === alvo.id), "restaurar a chamada a devolve ao dia");

    // ── limite ──
    for (let i = 0; i < 8; i += 1) await db.insert(escalaChamadasTable).values({ organizationId: org!.id, sessionId: sessao2!.id, nome: `Extra ${i}`, modo: "antes", minutosAntes: 5 + i, duracaoMin: 5, createdBy: admin.id });
    assert((await asAdmin("POST", "/escalas/chamadas", { sessionId: sessao2!.id, nome: "Uma a mais", modo: "antes", minutosAntes: 3 })).status === 409, "passar do máximo de chamadas por atividade é recusado com frase");

    // ── uma casa não enxerga a outra ──
    assert((await asOutra("GET", `/escalas/chamadas?sessionId=${sessao1!.id}`)).status === 404, "outra organização não lê as chamadas desta (404)");
    assert((await asOutra("PATCH", `/escalas/chamadas/${alvo.id}`, { nome: "Invasão" })).status === 404, "outra organização não muda chamada desta (404)");
    assert((await asOutra("POST", "/escalas/chamadas", { sessionId: sessao1!.id, nome: "Invasão", modo: "fixo", horaFixa: "13:00" })).status === 404, "outra organização não cria chamada numa sessão desta (404)");

    // ── Registro ──
    const eventos = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id))).map((e) => e.action);
    assert(["chamada.criada", "chamada.alterada", "chamada.removida", "chamada.restaurada", "chamada.copiada"].every((a) => eventos.includes(a)), "criar, mudar, tirar, restaurar e copiar entram no Registro");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const ids = everyone.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.orgId, outraOrg!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(escalaChamadasTable).where(or(eq(escalaChamadasTable.organizationId, org!.id), eq(escalaChamadasTable.organizationId, outraOrg!.id)));
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
    await db.delete(sessionsTable).where(eq(sessionsTable.showId, show!.id));
    await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(or(eq(userRolesTable.operationId, operation!.id), eq(userRolesTable.operationId, outraOp!.id)));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, patinadores!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(or(eq(operationsTable.id, operation!.id), eq(operationsTable.id, outraOp!.id)));
    await db.delete(organizationsTable).where(or(eq(organizationsTable.id, org!.id), eq(organizationsTable.id, outraOrg!.id)));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-chamadas`);
  process.stdout.write(`escala-chamadas: ${passed} asserts passed\n`);
}

process.stdout.write("escala-chamadas: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
