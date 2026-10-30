/**
 * Tempo disponível na Escala do dia (0090, pacote G): quem fica 30 minutos ou mais sem nada entre duas atividades do mesmo dia. O dia da pessoa
 * vai da primeira à última atividade; a janela de almoço inteira e a ida entre locais contam como ocupado; folga, "sem local hoje" e equipe de
 * outro local ficam de fora; buraco de 3 horas ou mais vai para "dia dividido"; o buraco que começa em outro local aparece só lá. Só a
 * Administração e a Supervisão recebem o campo (Direção e Elenco nem recebem); só a Administração liga, desliga e escolhe os minutos, com Registro.
 * Regras puras + PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, folgasTable, historyEventsTable, locaisDeslocamentoTable, locationsTable, operationLocationsTable,
  operationsTable, organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { buracosDaPessoa, tempoDisponivelDoDia, trechosDaPessoa } from "../src/services/escala-tempo-disponivel.js";
import { fraseDoTempoDisponivelInvalido } from "../src/lib/tempo-disponivel.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}
const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

/** Um bloco do dia como a regra o recebe (só o que ela lê). */
const bloco = (rotulo: string, inicio: string, fim: string | null, pessoaIds: string[], extra: Record<string, unknown> = {}) =>
  ({ key: `${rotulo}${inicio}`, rotulo, inicio, fim, origem: "programacao", regra: "pessoas", pessoaIds, vazio: false, sinal: null, showBookId: null, dailyBookId: null, dailyBookStatus: null, blocoId: null, allocationId: null, ...extra }) as any;

async function run() {
  // ── regras puras ──
  const L1 = "11111111-1111-4111-8111-111111111111", L2 = "22222222-2222-4222-8222-222222222222";
  const semIda = () => null;
  const t = (inicio: number, fim: number, localId = L1, rotulo = "x") => ({ inicio, fim, localId, localNome: localId === L1 ? "Snowland" : "Acqua", rotulo });
  const h = (hh: number, mm = 0) => hh * 60 + mm;

  const b1 = buracosDaPessoa("p", [t(h(9), h(10), L1, "Treino"), t(h(10, 45), h(11, 30), L1, "Aula")], L1, 30, semIda);
  assert(b1.length === 1 && b1[0]!.de === "10:00" && b1[0]!.ate === "10:45" && b1[0]!.minutos === 45 && b1[0]!.antes.rotulo === "Treino" && b1[0]!.depois.rotulo === "Aula", "45 minutos entre o Treino e a Aula: um buraco, com de/até e o que vem antes e depois");
  assert(buracosDaPessoa("p", [t(h(9), h(10)), t(h(10, 30), h(11))], L1, 30, semIda).length === 1, "exatamente o limite (30 min) já avisa");
  assert(buracosDaPessoa("p", [t(h(9), h(10)), t(h(10, 29), h(11))], L1, 30, semIda).length === 0, "29 minutos não avisa com limite de 30");
  assert(buracosDaPessoa("p", [t(h(9), h(10)), t(h(11), h(12))], L1, 90, semIda).length === 0, "limite de 90: um buraco de 60 não avisa");
  assert(buracosDaPessoa("p", [t(h(9), h(10))], L1, 30, semIda).length === 0 && buracosDaPessoa("p", [], L1, 30, semIda).length === 0, "uma atividade só (ou nenhuma) não tem buraco: o dia vai da primeira à última");
  const fundido = buracosDaPessoa("p", [t(h(9), h(11)), t(h(10), h(10, 30)), t(h(11, 40), h(12))], L1, 30, semIda);
  assert(fundido.length === 1 && fundido[0]!.de === "11:00" && fundido[0]!.minutos === 40, "o buraco conta a partir do fim mais tarde entre as que se cruzam (11:00 → 11:40)");
  assert(buracosDaPessoa("p", [t(h(9), h(10)), t(h(10), h(11))], L1, 5, semIda).length === 0, "uma atividade que começa quando a outra termina não deixa buraco");

  // Ida entre locais: desconta do buraco, e o buraco aparece só no local onde começa.
  const ida30 = (x: string, y: string) => (x !== y ? 30 : null);
  const cruzado = [t(h(9), h(10), L1, "Treino"), t(h(11), h(12), L2, "Aula")];
  const noPrimeiro = buracosDaPessoa("p", cruzado, L1, 30, ida30);
  assert(noPrimeiro.length === 1 && noPrimeiro[0]!.minutos === 30 && noPrimeiro[0]!.de === "10:00" && noPrimeiro[0]!.ate === "10:30" && noPrimeiro[0]!.minutosDeIda === 30 && noPrimeiro[0]!.depois.localNome === "Acqua", "60 minutos entre dois locais com ida de 30: sobram 30 (10:00–10:30), dizendo que a ida já saiu e para onde ela vai");
  assert(buracosDaPessoa("p", cruzado, L2, 30, ida30).length === 0, "o mesmo buraco NÃO aparece no local onde a próxima atividade acontece (só onde começa)");
  assert(buracosDaPessoa("p", cruzado, L1, 31, ida30).length === 0, "com limite de 31, os 30 que sobram depois da ida não avisam (vale o limite do local onde começa)");
  assert(buracosDaPessoa("p", [t(h(9), h(10), L1), t(h(10, 20), h(11), L2)], L1, 5, ida30).length === 0, "ida maior que o buraco: não sobra nada, não avisa");
  assert(buracosDaPessoa("p", cruzado, L1, 30, semIda)[0]!.minutos === 60, "sem tempo de ida cadastrado, vale 0");

  // O que ocupa: almoço (janela inteira) e chamada.
  const casa = { ativa: false, temMarca: () => false };
  const locais = (blocos: any[]) => [{ id: L1, name: "Snowland", blocos }];
  const almoco = bloco("Almoço", "10:00", "12:00", ["p"], { flexivel: true, regra: "todos" });
  const comAlmoco = trechosDaPessoa("p", L1, locais([bloco("Treino", "09:00", "10:00", ["p"]), almoco, bloco("Aula", "12:30", "13:30", ["p"])]), casa);
  const buracosAlmoco = buracosDaPessoa("p", comAlmoco, L1, 30, semIda);
  assert(comAlmoco.length === 3 && buracosAlmoco.length === 1 && buracosAlmoco[0]!.de === "12:00" && buracosAlmoco[0]!.minutos === 30, "a janela de almoço inteira conta como ocupada: o buraco só vem depois dela (12:00–12:30)");
  assert(trechosDaPessoa("p", L1, locais([bloco("Almoço", "11:00", null, ["p"], { flexivel: true })]), casa).length === 0, "janela sem fim não conta");
  const chamadaInfo = bloco("Chamada · Show", "09:30", "10:00", ["p"], { chamada: { ocupaTempo: false } });
  const chamadaOcupa = bloco("Chamada · Show", "09:30", "10:00", ["p"], { chamada: { ocupaTempo: true } });
  assert(trechosDaPessoa("p", L1, locais([chamadaInfo]), casa).length === 0 && trechosDaPessoa("p", L1, locais([chamadaOcupa]), casa).length === 1, "a chamada só informativa não ocupa; a que ocupa tempo conta");
  assert(trechosDaPessoa("p", L1, locais([bloco("Sem ninguém", "09:00", "10:00", ["p"], { regra: "ninguem" })]), casa).length === 0, "bloco 'ninguém' não conta");
  assert(trechosDaPessoa("p", L1, locais([bloco("Reunião", "09:00", null, ["p"])]), casa)[0]!.fim === h(9, 30), "atividade sem fim dura 30 minutos");
  assert(trechosDaPessoa("p", L1, locais([bloco("Reunião", "09:00", "10:00", ["outra"])]), casa).length === 0, "bloco de outra pessoa não conta");

  // Equipe: outros locais só entram quando a casa usa equipe; "todos"/"área" de outro local só contam para quem tem marca.
  const outros = [{ id: L1, name: "Snowland", blocos: [bloco("Treino", "09:00", "10:00", ["p"])] }, { id: L2, name: "Acqua", blocos: [bloco("Aula", "11:00", "12:00", ["p"]), bloco("Geral", "14:00", "15:00", ["p"], { regra: "todos" })] }];
  assert(trechosDaPessoa("p", L1, outros, { ativa: false, temMarca: () => true }).length === 1, "sem equipe na casa, só o local da Escala conta");
  assert(trechosDaPessoa("p", L1, outros, { ativa: true, temMarca: () => false }).length === 2, "com equipe, a atividade de outro local conta; o 'todo mundo' de outro local não conta para quem não tem marca");
  assert(trechosDaPessoa("p", L1, outros, { ativa: true, temMarca: () => true }).length === 3, "quem tem marca de equipe conta o 'todo mundo' do outro local");

  // Dia dividido e ordem.
  const grandes = tempoDisponivelDoDia({
    localId: L1, limite: 30, pessoaIds: ["a", "b", "c", "d"], equipe: casa, tempoDeIda: semIda,
    locais: locais([
      bloco("A1", "09:00", "10:00", ["a"]), bloco("A2", "11:00", "12:00", ["a"]),
      bloco("B1", "09:00", "10:00", ["b"]), bloco("B2", "11:30", "12:00", ["b"]),
      bloco("C1", "08:00", "09:00", ["c"]), bloco("C2", "12:00", "13:00", ["c"]),
      bloco("D1", "08:00", "09:00", ["d"]), bloco("D2", "11:59", "13:00", ["d"]),
    ]),
  });
  assert(grandes.avisos.map((b) => b.pessoaId).join() === "d,b,a", `os buracos comuns saem do MAIOR para o menor (veio ${grandes.avisos.map((b) => `${b.pessoaId}:${b.minutos}`).join()})`);
  assert(grandes.diaDividido.length === 1 && grandes.diaDividido[0]!.pessoaId === "c" && grandes.diaDividido[0]!.minutos === 180, "3 horas exatas já são dia dividido e saem da lista principal");
  assert(!grandes.avisos.some((b) => b.pessoaId === "c") && grandes.limite === 30, "o dia dividido não aparece na lista principal, e o limite do local vai junto");

  assert(fraseDoTempoDisponivelInvalido(true, 30) === null && fraseDoTempoDisponivelInvalido(false, 5) === null && fraseDoTempoDisponivelInvalido(true, 240) === null, "ligado/desligado e minutos de 5 a 240 valem");
  assert(Boolean(fraseDoTempoDisponivelInvalido("sim", 30)) && Boolean(fraseDoTempoDisponivelInvalido(true, 4)) && Boolean(fraseDoTempoDisponivelInvalido(true, 241)) && Boolean(fraseDoTempoDisponivelInvalido(true, 30.5)) && Boolean(fraseDoTempoDisponivelInvalido(true, "30")), "valor que não serve é recusado com frase");

  // ── com banco ──
  const tag = `tempodisp_${Date.now()}`;
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
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id);
  const m1 = await mk("m1", area!.id), m2 = await mk("m2", area!.id), m3 = await mk("m3", area!.id), m4 = await mk("m4", area!.id), m5 = await mk("m5", area!.id), m6 = await mk("m6", area!.id);
  const todos = [admin, dir, sup, m1, m2, m3, m4, m5, m6];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[m1, m2, m3, m4, m5, m6].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: area!.id, locationId: snow!.id, supervisorId: sup.id }]);
  const vigencia = { vigenciaInicio: somarDias(hoje, -5), vigenciaFim: somarDias(hoje, 60) };
  const [progS, progA] = await db.insert(programacoesTable).values([
    { organizationId: org!.id, locationId: snow!.id, nome: "Natal", ...vigencia, createdBy: admin.id },
    { organizationId: org!.id, locationId: acqua!.id, nome: "Natal Acqua", ...vigencia, createdBy: admin.id },
  ]).returning();
  const bl = (programacaoId: string, rotulo: string, inicio: string, fim: string, pessoas: string[]) => ({ programacaoId, weekday: 4, inicio, fim, rotulo, regra: "pessoas" as const, pessoaIds: pessoas, createdBy: admin.id });
  await db.insert(programacaoBlocosTable).values([
    bl(progS!.id, "Treino", "09:00", "10:00", [m1.id, m2.id, m3.id]),
    bl(progS!.id, "Aula", "11:00", "12:00", [m1.id, m2.id, m3.id]),          // m1, m2, m3: buraco de 60 min (10:00–11:00)
    bl(progS!.id, "Manhã", "08:00", "08:30", [m4.id]),
    bl(progS!.id, "Noite", "18:00", "19:00", [m4.id]),                         // m4: dia dividido (08:30–18:00)
    bl(progS!.id, "Treino 2", "09:00", "10:00", [m5.id, m6.id]),                // m5: uma atividade só aqui
    bl(progS!.id, "Aula 2", "11:30", "12:30", [m6.id]),                        // m6: buraco de 90 min (10:00–11:30)
  ]);
  await db.insert(folgasTable).values({ userId: m2.id, operationId: operation!.id, type: "DAY_OFF", startDate: quinta, endDate: quinta, status: "ACTIVE", createdBy: admin.id });

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
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {} as Record<string, any>; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asMem = as(m1, "MEMBER");
    type Aviso = { pessoaId: string; minutos: number; de: string; ate: string; minutosDeIda?: number; depois: { localNome: string } };
    const dia = async (fn: typeof asAdmin, localId = snow!.id) => (await fn("GET", `/escalas/dia?locationId=${localId}&date=${quinta}`));
    const tempo = async (fn: typeof asAdmin, localId = snow!.id) => (await dia(fn, localId)).body.dia?.tempoDisponivel as { limite: number; avisos: Aviso[]; diaDividido: Aviso[] } | undefined;
    const caminho = `/locations/${snow!.id}/tempo-disponivel`;

    // O padrão: ligado, 30 minutos, para todo local (inclusive os que já existiam).
    const lista = (await asAdmin("GET", "/locations")).body.locations as { id: string; tempoDisponivel?: { ligado: boolean; minutos: number } }[];
    assert(lista.find((l) => l.id === snow!.id)?.tempoDisponivel?.ligado === true && lista.find((l) => l.id === snow!.id)?.tempoDisponivel?.minutos === 30, "o local nasce com o aviso ligado, a partir de 30 minutos");
    assert((await asDir("GET", "/locations")).body.locations.find((l: { id: string }) => l.id === snow!.id)?.tempoDisponivel?.minutos === 30, "a Direção lê o valor em Locais");

    // Quem recebe o campo.
    const doAdmin = await tempo(asAdmin);
    assert(Boolean(doAdmin) && doAdmin!.limite === 30, "a Administração recebe o tempo disponível, com o limite do local");
    assert(Boolean(await tempo(asSup)), "a Supervisão do local também recebe");
    const daDirecao = await dia(asDir);
    assert(daDirecao.status === 200 && daDirecao.body.dia && !("tempoDisponivel" in daDirecao.body.dia) && !/tempoDisponivel/.test(daDirecao.text), "a Direção lê a Escala, mas o servidor nem envia o tempo disponível");
    const doElenco = await dia(asMem);
    assert(doElenco.status === 403 && !/tempoDisponivel/.test(doElenco.text), "o Elenco não lê a Escala do local, e nada de tempo disponível escapa");
    assert(!/tempoDisponivel/.test((await asMem("GET", `/escalas/minha?date=${quinta}`)).text), "Minha escala (Elenco) não leva o tempo disponível");

    // A conta, no dia de verdade (sem equipe: só este local conta).
    const avisos = doAdmin!.avisos;
    const por = (id: string) => avisos.filter((a) => a.pessoaId === id);
    assert(por(m1.id).length === 1 && por(m1.id)[0]!.minutos === 60 && por(m1.id)[0]!.de === "10:00" && por(m1.id)[0]!.ate === "11:00", "m1 fica livre das 10:00 às 11:00 (60 min) entre o Treino e a Aula");
    assert(por(m6.id).length === 1 && por(m6.id)[0]!.minutos === 90, "m6 fica livre 90 minutos (10:00–11:30)");
    assert(por(m2.id).length === 0 && !doAdmin!.diaDividido.some((a) => a.pessoaId === m2.id), "quem está de folga fica de fora");
    assert(por(m5.id).length === 0, "quem tem uma atividade só não tem buraco");
    assert(doAdmin!.diaDividido.length === 1 && doAdmin!.diaDividido[0]!.pessoaId === m4.id && doAdmin!.diaDividido[0]!.minutos === 570 && !avisos.some((a) => a.pessoaId === m4.id), "m4 (manhã e noite) vai para o dia dividido, não para a lista principal");
    assert(avisos[0]!.pessoaId === m6.id && avisos[0]!.minutos >= avisos[avisos.length - 1]!.minutos, "a lista vem do maior buraco para o menor");
    const antesDaEquipe = por(m3.id).length;
    assert(antesDaEquipe === 1, "m3 aparece enquanto ninguém marcou equipe");

    // Equipe na casa: quem está "sem local hoje" sai; e o buraco entre dois locais aparece só onde começa, com a ida descontada.
    await db.insert(programacaoEquipeTable).values({ programacaoId: progS!.id, userId: m3.id, weekday: 3, createdBy: admin.id });
    assert((await tempo(asAdmin))!.avisos.every((a) => a.pessoaId !== m3.id), "quem tem equipe marcada e está 'sem local hoje' fica de fora");
    await db.insert(programacaoBlocosTable).values(bl(progA!.id, "Aula Acqua", "11:00", "12:00", [m5.id]));
    await asAdmin("PUT", "/locations/deslocamento", { baseVersao: null, pares: [{ locationAId: snow!.id, locationBId: acqua!.id, minutos: 30 }] });
    const cruz = (await tempo(asAdmin))!.avisos.filter((a) => a.pessoaId === m5.id);
    assert(cruz.length === 1 && cruz[0]!.minutos === 30 && cruz[0]!.ate === "10:30" && cruz[0]!.minutosDeIda === 30 && cruz[0]!.depois.localNome.endsWith("Acqua"), "m5: Treino 2 em Snowland (até 10:00) e Aula em Acqua (11:00), ida de 30: aparece em Snowland com 30 min livres");
    assert(!(await tempo(asAdmin, acqua!.id))?.avisos.some((a) => a.pessoaId === m5.id), "o mesmo buraco NÃO aparece na Escala da Acqua (começa em Snowland)");

    // Configurar: só a Administração, com frase, Registro e sem apagar nada.
    for (const [nome, fn, perfil] of [["Supervisão", asSup, /Seu perfil/], ["Direção", asDir, /Direção só lê/], ["Elenco", asMem, /Seu perfil/]] as const) {
      const r = await fn("PUT", caminho, { ligado: false, minutos: 45 });
      assert(r.status === 403 && /Administração/.test(r.text) && perfil.test(r.text) && !/Role .* is not authorized/.test(r.text), `${nome} é recusada com a frase de quem pode`);
    }
    const eventos = async () => db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, snow!.id), eq(historyEventsTable.action, "location.tempo_disponivel_alterado")));
    assert((await eventos()).length === 0 && (await tempo(asAdmin))!.limite === 30, "as recusas não gravaram nada nem entraram no Registro");
    for (const corpo of [{ ligado: true, minutos: 3 }, { ligado: true, minutos: 500 }, { ligado: true, minutos: "30" }, { ligado: "sim", minutos: 30 }, { minutos: 30 }, { ligado: true }]) {
      const r = await asAdmin("PUT", caminho, corpo);
      assert(r.status === 400 && /minutos|ligado|desligado/.test(r.text), `valor fora da lista é 400 com a frase (${JSON.stringify(corpo)})`);
    }
    // Conferência de 30/10: duas pessoas com a janela aberta. Quem abriu com um valor que já mudou recebe 409 com a frase e o que vale; nada muda.
    const valeAgora = ((await asAdmin("GET", "/locations")).body.locations as { id: string; tempoDisponivel: { ligado: boolean; minutos: number } }[]).find((l) => l.id === snow!.id)!.tempoDisponivel;
    const velho = await asAdmin("PUT", caminho, { ligado: true, minutos: 55, antes: { ligado: valeAgora.ligado, minutos: valeAgora.minutos + 5 } });
    assert(velho.status === 409 && velho.body.error === "VERSAO_MUDOU" && /Outra pessoa/.test(velho.text) && velho.body.tempoDisponivel?.minutos === valeAgora.minutos, "salvar sobre um valor que outra pessoa mudou: 409 com a frase e o valor de agora");
    const naoMudou = ((await asAdmin("GET", "/locations")).body.locations as { id: string; tempoDisponivel: { minutos: number } }[]).find((l) => l.id === snow!.id)!.tempoDisponivel;
    assert(naoMudou.minutos === valeAgora.minutos, "a recusa não gravou nada");
    assert((await asAdmin("PUT", caminho, { ligado: valeAgora.ligado, minutos: valeAgora.minutos, antes: valeAgora })).status === 200, "com o valor certo de quando abriu, o pedido passa");
    assert((await asAdmin("PUT", "/locations/nao-e-um-id/tempo-disponivel", { ligado: true, minutos: 30 })).status === 404, "id quebrado na URL é 404 com frase");
    assert((await asAdmin("PUT", `/locations/${localDeFora!.id}/tempo-disponivel`, { ligado: true, minutos: 30 })).status === 404, "local de outra casa não é encontrado");
    const igual = await asAdmin("PUT", caminho, { ligado: true, minutos: 30 });
    assert(igual.status === 200 && igual.body.alterado === false && (await eventos()).length === 0, "salvar o mesmo valor não grava nem entra no Registro");

    const mudou = await asAdmin("PUT", caminho, { ligado: true, minutos: 75 });
    assert(mudou.status === 200 && mudou.body.alterado === true && mudou.body.tempoDisponivel.minutos === 75, "a Administração muda o limite para 75 minutos");
    const com75 = (await tempo(asAdmin))!;
    assert(com75.limite === 75 && com75.avisos.every((a) => a.minutos >= 75) && com75.avisos.some((a) => a.pessoaId === m6.id) && !com75.avisos.some((a) => a.pessoaId === m1.id), "com 75 minutos, o buraco de 60 (m1) some e o de 90 (m6) continua");
    const ev = await eventos();
    assert(ev.length === 1 && /de 30 min/.test(ev[0]!.narrative ?? "") && /75 min/.test(ev[0]!.narrative ?? ""), "o Registro diz o valor antigo e o novo");
    const desligou = await asAdmin("PUT", caminho, { ligado: false, minutos: 75 });
    assert(desligou.status === 200 && desligou.body.tempoDisponivel.ligado === false, "a Administração desliga o aviso");
    const desligado = await dia(asAdmin);
    assert(desligado.status === 200 && !/tempoDisponivel/.test(desligado.text), "com o aviso desligado o campo nem vem");
    assert((await tempo(asAdmin, acqua!.id)) !== undefined, "desligar em um local não desliga o outro");
    const linhas = await db.select().from(locationsTable).where(eq(locationsTable.id, snow!.id));
    assert(linhas.length === 1 && linhas[0]!.tempoDisponivelMinutos === 75 && linhas[0]!.tempoDisponivelLigado === false, "o valor fica guardado no local (nada é apagado)");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await db.delete(folgasTable).where(inArray(folgasTable.userId, ids));
    await db.delete(locaisDeslocamentoTable).where(eq(locaisDeslocamentoTable.organizationId, org!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    if (progs.length) {
      await db.delete(programacaoEquipeTable).where(inArray(programacaoEquipeTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    }
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.areaId, area!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id, localDeFora!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outraOrg!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-tempo-disponivel`);
  process.stdout.write(`escala-tempo-disponivel: ${passed} asserts passed\n`);
}

process.stdout.write("escala-tempo-disponivel: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
