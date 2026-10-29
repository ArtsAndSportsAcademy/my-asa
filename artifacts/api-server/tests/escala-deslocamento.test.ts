/**
 * Tempo de ida entre locais e choque entre locais (0088, pacote O, passo O5): a Administração escreve quantos minutos leva de um local a outro; a
 * Escala do dia avisa quando a mesma pessoa está em duas coisas que não cabem (mesmo horário, ou sem o tempo de ida), e o Livro do Dia não
 * escala quem não chega a tempo ao show. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areasTable, characterCastTable, charactersTable, db, historyEventsTable, locaisDeslocamentoTable, locationsTable, operationLocationsTable,
  operationsTable, organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable, showBookBlocksTable, showBookLinesTable,
  showBookRolesTable, showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { montarEscalaDoDia } from "../src/services/escala-dia.js";
import { carregarRegrasDoDia } from "../src/services/regras-de-escala.js";
import { resolveAssignmentsByRole } from "../src/services/line-resolver.js";
import { diferencaDosPares, lerPares, problemaDeIda } from "../src/services/escala-deslocamento.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}
const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

async function run() {
  // ── regras puras ──
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert(problemaDeIda({ rotulo: "x", inicio: "09:00", fim: "11:00" }, { rotulo: "y", inicio: "10:30", fim: "11:30" }, null)?.tipo === "mesmo_horario", "dois horários que se cruzam são 'mesmo horário', mesmo sem tempo de ida cadastrado");
  const semTempo = problemaDeIda({ rotulo: "x", inicio: "09:00", fim: "11:00" }, { rotulo: "y", inicio: "11:15", fim: "12:00" }, 30);
  assert(semTempo?.tipo === "sem_tempo" && semTempo.minutosDeIda === 30 && semTempo.minutosDeFolga === 15, "15 minutos de folga para uma ida de 30 é 'sem tempo', com as duas contas");
  assert(problemaDeIda({ rotulo: "x", inicio: "09:00", fim: "11:00" }, { rotulo: "y", inicio: "11:30", fim: "12:00" }, 30) === null, "folga igual à ida cabe");
  assert(problemaDeIda({ rotulo: "x", inicio: "09:00", fim: "11:00" }, { rotulo: "y", inicio: "11:15", fim: "12:00" }, null) === null, "par sem tempo cadastrado só confere se cruza");
  assert(problemaDeIda({ rotulo: "x", inicio: "11:15", fim: "12:00" }, { rotulo: "y", inicio: "09:00", fim: "11:00" }, 30)?.tipo === "sem_tempo", "a ordem das duas atividades não importa");
  assert(!lerPares("x").ok && !lerPares([{ locationAId: A, locationBId: A, minutos: 10 }]).ok && !lerPares([{ locationAId: A, locationBId: B, minutos: 800 }]).ok && !lerPares([{ locationAId: A, locationBId: B, minutos: 1.5 }]).ok, "lerPares recusa lista inválida, par com o mesmo local, minutos acima de 720 e minutos quebrados");
  const lido = lerPares([{ locationAId: B, locationBId: A, minutos: 20 }, { locationAId: A, locationBId: B, minutos: "30" }]);
  assert(lido.ok && lido.pares.length === 1 && lido.pares[0]!.locationAId === A && lido.pares[0]!.minutos === 30, "lerPares põe o par na ordem de sempre e o último repetido vale");
  const dif = diferencaDosPares([{ id: "1", locationAId: A, locationBId: B, minutos: 30, active: true }], [{ locationAId: A, locationBId: B, minutos: 40 }]);
  assert(dif.atualizar.length === 1 && dif.inserir.length === 0 && dif.remover.length === 0, "diferencaDosPares atualiza o tempo do mesmo par em vez de criar outro");

  // ── com banco ──
  const tag = `deslocamento_${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  let quinta = somarDias(hoje, 2);
  while (new Date(`${quinta}T12:00:00Z`).getUTCDay() !== 4) quinta = somarDias(quinta, 1);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outraOrg] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, acqua] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  const [localDeFora] = await db.insert(locationsTable).values({ organizationId: outraOrg!.id, name: `${tag}_Fora` }).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: snow!.id }, { operationId: operation!.id, locationId: acqua!.id }]);
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id), m1 = await mk("m1", area!.id), m2 = await mk("m2", area!.id), m3 = await mk("m3", area!.id);
  const todos = [admin, dir, sup, m1, m2, m3];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[m1, m2, m3].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  const [personagem] = await db.insert(charactersTable).values({ name: `${tag}_Personagem`, locationId: acqua!.id, mode: "rodizio" }).returning();
  await db.insert(characterCastTable).values([m1, m2, m3].map((p, order) => ({ characterId: personagem!.id, personId: p.id, order })));
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: acqua!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();
  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Cena", order: 0 }).returning();
  const [bloco] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: cena!.id, name: "Palco", order: 0 }).returning();
  const [vaga] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: bloco!.id, name: `${tag}_vaga`, order: 0 }).returning();
  await db.insert(showBookLinesTable).values({ positionId: vaga!.id, type: "CHARACTER", characterId: personagem!.id, config: {}, order: 0 });
  const evento = async (inicio: string, fim: string) => (await db.insert(agendaEventsTable).values({
    operationId: operation!.id, showBookId: show!.id, type: "SHOW", title: `${tag}_evento_${inicio}`, date: quinta, startTime: inicio, endTime: fim,
    status: "CONFIRMED", visibility: "MANAGEMENT", createdBy: admin.id,
  }).returning())[0]!;

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, signal: AbortSignal.timeout(120_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asMem = as(m1, "MEMBER");
    const url = "/locations/deslocamento";
    const [a, b] = snow!.id < acqua!.id ? [snow!.id, acqua!.id] : [acqua!.id, snow!.id];

    // A configuração em Locais.
    const vazio = await asAdmin("GET", url);
    assert(vazio.status === 200 && vazio.body.pares.length === 0 && vazio.body.versao === null && vazio.body.podeEditar === true && vazio.body.locais.length === 2, "a Administração lê o tempo de ida: nada cadastrado, versão vazia, os dois locais da casa, pode editar");
    const daDirecao = await asDir("GET", url);
    assert(daDirecao.status === 200 && daDirecao.body.podeEditar === false && (await asSup("GET", url)).status === 200, "a Direção e a Supervisão leem, mas não editam");
    assert((await asMem("GET", url)).status === 403, "o Elenco não vê o tempo de ida entre locais");
    const dirTenta = await asDir("PUT", url, { baseVersao: null, pares: [{ locationAId: a, locationBId: b, minutos: 30 }] });
    assert(dirTenta.status === 403 && /Direção só lê/.test(dirTenta.body.message ?? ""), "a Direção não grava, e a frase diz que ela só lê");
    assert((await asSup("PUT", url, { baseVersao: null, pares: [] })).status === 403, "a Supervisão não grava");
    assert((await asAdmin("PUT", url, { pares: [] })).status === 400, "gravar sem dizer a versão aberta é recusado com frase");
    assert((await asAdmin("PUT", url, { baseVersao: null, pares: [{ locationAId: a, locationBId: b, minutos: 900 }] })).status === 400, "minutos acima de 720 são recusados");
    assert((await asAdmin("PUT", url, { baseVersao: null, pares: [{ locationAId: a, locationBId: localDeFora!.id, minutos: 20 }] })).status === 400, "local de outra casa é recusado");
    const gravou = await asAdmin("PUT", url, { baseVersao: null, pares: [{ locationAId: acqua!.id, locationBId: snow!.id, minutos: 30 }] });
    assert(gravou.status === 200 && gravou.body.mudou === true && gravou.body.pares.length === 1 && gravou.body.pares[0].minutos === 30 && Boolean(gravou.body.versao), "a Administração grava Snowland ↔ Acqua: 30 min (o par entra na ordem de sempre)");
    const velha = await asAdmin("PUT", url, { baseVersao: null, pares: [] });
    assert(velha.status === 409 && velha.body.error === "VERSAO_MUDOU" && /Outra pessoa alterou/.test(velha.body.message ?? "") && velha.body.pares.length === 1, "salvar sobre a versão velha dá 409 com a frase e o que está valendo agora");
    const igual = await asAdmin("PUT", url, { baseVersao: gravou.body.versao, pares: [{ locationAId: snow!.id, locationBId: acqua!.id, minutos: 30 }] });
    assert(igual.status === 200 && igual.body.mudou === false, "salvar o mesmo conjunto de novo não grava nada");
    const eventos = await db.select().from(historyEventsTable).where(eq(historyEventsTable.action, "locations.deslocamento_alterado"));
    assert(eventos.length === 1 && /30 min \(novo\)/.test(eventos[0]!.narrative ?? ""), "um evento no Registro, dizendo o par e o tempo");

    // O choque na Escala do dia. Equipe: a m1 trabalha nos dois locais na quinta; Snowland tem treino das 09:00 às 11:00.
    const vigencia = { vigenciaInicio: somarDias(hoje, -5), vigenciaFim: somarDias(hoje, 60) };
    const [progS, progA] = await db.insert(programacoesTable).values([
      { organizationId: org!.id, locationId: snow!.id, nome: "Natal", ...vigencia, createdBy: admin.id },
      { organizationId: org!.id, locationId: acqua!.id, nome: "Natal Acqua", ...vigencia, createdBy: admin.id },
    ]).returning();
    await db.insert(programacaoBlocosTable).values([
      { programacaoId: progS!.id, weekday: 4, inicio: "09:00", fim: "11:00", rotulo: "Treino", regra: "pessoas", pessoaIds: [m1.id], createdBy: admin.id },
      { programacaoId: progA!.id, weekday: 4, inicio: "11:15", fim: "12:00", rotulo: "Aula", regra: "pessoas", pessoaIds: [m1.id], createdBy: admin.id },
    ]);
    const choques = async () => (await montarEscalaDoDia(org!.id, snow!.id, quinta, { comOutrosLocais: true }))!.choquesEntreLocais;
    assert(await choques() === undefined, "sem nenhuma marca de equipe a casa não ganha alerta novo (o campo nem vem)");
    await db.insert(programacaoEquipeTable).values([
      { programacaoId: progS!.id, userId: m1.id, weekday: 4, createdBy: admin.id },
      { programacaoId: progA!.id, userId: m2.id, weekday: 4, createdBy: admin.id },
    ]);
    const c1 = (await choques())!;
    assert(c1.length === 1 && c1[0]!.pessoaId === m1.id && c1[0]!.tipo === "sem_tempo" && c1[0]!.minutosDeIda === 30 && c1[0]!.minutosDeFolga === 15, "Treino até 11:00 em Snowland e Aula às 11:15 na Acqua, com ida de 30: choque 'sem tempo' (sobram 15)");
    assert(c1[0]!.la.localNome.endsWith("Acqua") && c1[0]!.la.rotulo === "Aula" && c1[0]!.aqui.rotulo === "Treino", "o choque diz o que é de cada lado e onde");
    // Ida de 10 minutos cabe nos 15 de folga.
    const v1 = (await asAdmin("GET", url)).body.versao;
    assert((await asAdmin("PUT", url, { baseVersao: v1, pares: [{ locationAId: snow!.id, locationBId: acqua!.id, minutos: 10 }] })).body.mudou === true, "a Administração muda o tempo de 30 para 10");
    assert((await choques())!.length === 0, "com ida de 10 minutos, 15 de folga cabem e o alerta some");
    // Outra atividade na Acqua que se cruza com o treino.
    await db.insert(programacaoBlocosTable).values({ programacaoId: progA!.id, weekday: 4, inicio: "10:30", fim: "11:30", rotulo: "Oficina", regra: "pessoas", pessoaIds: [m1.id], createdBy: admin.id });
    const c2 = (await choques())!;
    assert(c2.some((c) => c.tipo === "mesmo_horario" && c.la.rotulo === "Oficina"), "atividade na Acqua que cruza com o treino é 'mesmo horário'");

    // O Livro do Dia: show na Acqua às 11:15. Com ida de 30 a m1 (treino em Snowland até 11:00) não chega a tempo.
    await asAdmin("PUT", url, { baseVersao: (await asAdmin("GET", url)).body.versao, pares: [{ locationAId: snow!.id, locationBId: acqua!.id, minutos: 30 }] });
    await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.rotulo, "Oficina"));
    const show1115 = await evento("11:15", "11:45");
    const regras = await carregarRegrasDoDia({ eventId: show1115.id, userIds: [m1.id, m2.id, m3.id], date: quinta, operationId: operation!.id });
    const frase = regras.bloqueios.get(m1.id) ?? "";
    assert(/não chega a tempo/.test(frase) && /Snowland/.test(frase) && /30 min/.test(frase) && /sobram só 15/.test(frase), `a m1 é barrada com a conta da ida (veio: ${frase})`);
    const { byRole } = await resolveAssignmentsByRole(show!.id, operation!.id, quinta, { dedupPerScene: true, eventId: show1115.id });
    assert((byRole.get(vaga!.id)?.people ?? [])[0]?.name.replace(`${tag}_`, "") !== "m1", "o rodízio pula a m1, que não chega a tempo, e a reserva entra");
    await asAdmin("PUT", url, { baseVersao: (await asAdmin("GET", url)).body.versao, pares: [{ locationAId: snow!.id, locationBId: acqua!.id, minutos: 10 }] });
    assert(!(await carregarRegrasDoDia({ eventId: show1115.id, userIds: [m1.id], date: quinta, operationId: operation!.id })).bloqueios.has(m1.id), "com ida de 10 minutos a m1 chega a tempo e volta a ser opção");

    // Tirar o tempo (par removido): fica inativo, nada é apagado.
    const tirou = await asAdmin("PUT", url, { baseVersao: (await asAdmin("GET", url)).body.versao, pares: [] });
    const linhas = await db.select().from(locaisDeslocamentoTable).where(eq(locaisDeslocamentoTable.organizationId, org!.id));
    assert(tirou.body.pares.length === 0 && linhas.length === 1 && linhas[0]!.active === false, "tirar o tempo deixa o par inativo (não apaga a linha)");
    const volta = await asAdmin("PUT", url, { baseVersao: tirou.body.versao, pares: [{ locationAId: snow!.id, locationBId: acqua!.id, minutos: 25 }] });
    const linhas2 = await db.select().from(locaisDeslocamentoTable).where(eq(locaisDeslocamentoTable.organizationId, org!.id));
    assert(volta.body.pares[0].minutos === 25 && linhas2.length === 1 && linhas2[0]!.active === true, "o par que volta reativa a mesma linha, com o tempo novo");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.operationId, operation!.id));
    await db.delete(locaisDeslocamentoTable).where(eq(locaisDeslocamentoTable.organizationId, org!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    if (progs.length) {
      await db.delete(programacaoEquipeTable).where(inArray(programacaoEquipeTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    }
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, vaga!.id));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(characterCastTable).where(eq(characterCastTable.characterId, personagem!.id));
    await db.delete(charactersTable).where(eq(charactersTable.id, personagem!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id, localDeFora!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-deslocamento`);
  process.stdout.write(`escala-deslocamento: ${passed} asserts passed\n`);
}

process.stdout.write("escala-deslocamento: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
