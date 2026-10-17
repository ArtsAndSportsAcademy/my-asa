/**
 * Sessão separada, restrição de horário e limite de shows por dia (16/10/2026) — contra PostgreSQL real de teste.
 * Cenário: Teatro de Natal (Jingle e Bell em duas sessões) no Snowland, com o elenco real do Natal.
 */
import http from "node:http";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  agendaEventsTable, areaLocalSupervisorsTable, areasTable, characterCastTable, charactersTable, dailyBookAssignmentsTable,
  dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable, db, escalaBlocoAjustesTable,
  historyEventsTable, locationsTable, operationLocationsTable, operationalChangesTable, operationsTable, organizationsTable, pool,
  programacaoBlocosTable, programacoesTable, restricoesHorarioTable, escalaRegrasLocalTable, scaleAllocationsTable, scalesTable, sessionsTable, showBookBlocksTable,
  showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { gerarDiaDoLocal } from "../src/services/escala-mes.js";
import { collectScheduleCommitments } from "../src/services/schedule-conflicts.js";
import { resolveAssignmentsByRole } from "../src/services/line-resolver.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `restrhor_${Date.now()}`;
  const segunda = "2026-10-26"; // segunda-feira → weekday 1
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Teatro` }).returning();
  const mk = async (suffix: string, withArea = true) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId: withArea ? area!.id : null, defaultLocationId: local!.id,
  }).returning())[0]!;
  const admin = await mk("admin", false);
  const admin2 = await mk("admin2", false);
  const dir = await mk("dir", false);
  const [areaOutra] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Outra` }).returning();
  const sup = await mk("sup");
  const supOutra = (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_supoutra`, username: `${tag}_supoutra`, areaId: areaOutra!.id, defaultLocationId: local!.id }).returning())[0]!;
  const [sofia, esther, daia, kaua, julia, bel] = [await mk("sofia"), await mk("esther"), await mk("daia"), await mk("kaua"), await mk("julia"), await mk("bel")] as const;
  const elenco = [sofia, esther, daia, kaua, julia, bel];
  const everyone = [admin, admin2, dir, sup, supOutra, ...elenco];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: admin2.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supOutra.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...elenco.map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);

  // Jingle e Bell: personagens do local, em rodízio, com o elenco do teatro na fila.
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: area!.id, locationId: local!.id, supervisorId: sup.id }, { areaId: areaOutra!.id, locationId: local!.id, supervisorId: supOutra.id },
  ]);
  const [jingle, bell] = await db.insert(charactersTable).values([
    { name: `${tag}_Jingle`, locationId: local!.id, mode: "rodizio" }, { name: `${tag}_Bell`, locationId: local!.id, mode: "rodizio" },
  ]).returning();
  for (const character of [jingle!, bell!]) {
    await db.insert(characterCastTable).values(elenco.map((person, order) => ({ characterId: character.id, personId: person.id, order })));
  }
  /** Um show com as vagas Jingle e Bell ligadas aos personagens compartilhados. */
  async function criarShow(titulo: string, personagens: { id: string }[] = [jingle!, bell!]) {
    const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_${titulo}`, createdBy: admin.id }).returning();
    const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Cena", order: 0 }).returning();
    const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Palco", order: 0 }).returning();
    for (const [order, personagem] of personagens.entries()) {
      const [role] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: block!.id, name: `${tag}_${titulo}_vaga${order}`, order }).returning();
      await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "CHARACTER", characterId: personagem.id, config: {}, order: 0 });
    }
    return show!;
  }
  const teatro = await criarShow("Teatro de Natal");
  const musical = await criarShow("Musical");
  const sozinho = await criarShow("Show de sessão comum");
  const misto = await criarShow("Show misto");
  const [s1130, s1530] = await db.insert(sessionsTable).values([
    { showId: teatro.id, startTime: "11:30", endTime: "12:00", separada: true }, { showId: teatro.id, startTime: "15:30", endTime: "16:00", separada: true },
  ]).returning();
  const [sComum] = await db.insert(sessionsTable).values({ showId: sozinho.id, startTime: "10:00", endTime: "10:30", separada: false }).returning();
  const [mSep, mComum] = await db.insert(sessionsTable).values([
    { showId: misto.id, startTime: "09:00", endTime: "09:30", separada: true }, { showId: misto.id, startTime: "17:00", endTime: "17:30", separada: false },
  ]).returning();
  // Show sem ninguém na fila: o Livro da sessão separada nasce só com vagas abertas.
  const [semFila] = await db.insert(charactersTable).values({ name: `${tag}_SemFila`, locationId: local!.id, mode: "rodizio" }).returning();
  const vazio = await criarShow("Show sem fila", [semFila!]);
  const [sVazia] = await db.insert(sessionsTable).values({ showId: vazio.id, startTime: "13:00", endTime: "13:30", separada: true }).returning();
  // Shows de apoio do motor: vaga única só da Julia (rodízio) e vaga em modo titular (Sofia, depois Esther).
  const [unica, titular] = await db.insert(charactersTable).values([
    { name: `${tag}_Unica`, locationId: local!.id, mode: "rodizio" }, { name: `${tag}_Titular`, locationId: local!.id, mode: "titular" },
  ]).returning();
  await db.insert(characterCastTable).values([{ characterId: unica!.id, personId: julia.id, order: 0 }, { characterId: titular!.id, personId: sofia.id, order: 0 }, { characterId: titular!.id, personId: esther.id, order: 1 }]);
  const unico = await criarShow("Show de vaga única", [unica!]);
  const comTitular = await criarShow("Show com titular", [titular!]);
  // Show com dois blocos na Programação e nenhuma sessão separada: os dois blocos seguem no MESMO Livro do dia.
  const duplo = await criarShow("Show duas vezes");
  await db.insert(sessionsTable).values([{ showId: duplo.id, startTime: "14:00", endTime: "14:30" }, { showId: duplo.id, startTime: "18:00", endTime: "18:30" }]);

  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_Natal`, vigenciaInicio: "2026-10-22", vigenciaFim: "2027-01-17", createdBy: admin.id }).returning();
  await db.insert(programacaoBlocosTable).values([
    { programacaoId: prog!.id, weekday: 1, inicio: "11:30", fim: "12:00", rotulo: "TEATRO 11:30", regra: "livro", showBookId: teatro.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "15:30", fim: "16:00", rotulo: "TEATRO 15:30", regra: "livro", showBookId: teatro.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "10:00", fim: "10:30", rotulo: "SHOW COMUM", regra: "livro", showBookId: sozinho.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "09:00", fim: "09:30", rotulo: "MISTO MANHÃ", regra: "livro", showBookId: misto.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "17:00", fim: "17:30", rotulo: "MISTO TARDE", regra: "livro", showBookId: misto.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "13:00", fim: "13:30", rotulo: "SEM FILA", regra: "livro", showBookId: vazio.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "14:00", fim: "14:30", rotulo: "DUPLO TARDE", regra: "livro", showBookId: duplo.id },
    { programacaoId: prog!.id, weekday: 1, inicio: "18:00", fim: "18:30", rotulo: "DUPLO NOITE", regra: "livro", showBookId: duplo.id },
  ]);

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    };
    const asAdmin = as(admin.id, "ADMIN");
    const asSup = as(sup.id, "SUPERVISOR_A"), asSupOutra = as(supOutra.id, "SUPERVISOR_A"), asDir = as(dir.id, "DIR"), asJulia = as(julia.id, "MEMBER");
    const actor = { sub: admin.id, role: "ADMIN", organizationId: org!.id };

    // ---------- Task 2A: um Livro do Dia por sessão separada ----------
    const livrosDe = async (showId: string) => db.select().from(dailyBooksTable).where(and(eq(dailyBooksTable.showBookId, showId))).then((rows) => rows.filter((row) => row.status !== "CANCELLED"));
    const eventoDe = async (id: string) => (await db.select().from(agendaEventsTable).where(eq(agendaEventsTable.id, id)))[0]!;

    const gerado = await gerarDiaDoLocal(actor, { id: local!.id, name: local!.name }, segunda);
    assert(gerado.ok, "gerar o dia com sessões separadas funciona");
    const teatroLivros = (await livrosDe(teatro.id)).sort((a, b) => String(a.sessionId).localeCompare(String(b.sessionId)));
    assert(teatroLivros.length === 2, "Teatro com duas sessões separadas gera DOIS Livros do Dia");
    assert(new Set(teatroLivros.map((l) => l.sessionId)).size === 2 && teatroLivros.every((l) => [s1130!.id, s1530!.id].includes(l.sessionId ?? "")), "cada Livro guarda a sessão de origem");
    const porSessao = new Map(teatroLivros.map((l) => [l.sessionId, l]));
    const ev1130 = await eventoDe(porSessao.get(s1130!.id)!.agendaEventId);
    const ev1530 = await eventoDe(porSessao.get(s1530!.id)!.agendaEventId);
    assert(ev1130.id !== ev1530.id, "cada sessão separada tem o seu evento da agenda");
    assert((ev1130.startTime ?? "").startsWith("11:30") && (ev1130.endTime ?? "").startsWith("12:00"), "o evento da sessão das 11:30 guarda início e fim da sessão");
    assert((ev1530.startTime ?? "").startsWith("15:30") && ev1530.title.endsWith("· 15:30"), "o evento da sessão das 15:30 leva a hora no título");

    const repetido = await gerarDiaDoLocal(actor, { id: local!.id, name: local!.name }, segunda);
    assert(repetido.ok && (await livrosDe(teatro.id)).length === 2, "gerar o dia de novo não cria um terceiro Livro (idempotente)");

    const comum = await livrosDe(sozinho.id);
    assert(comum.length === 1 && comum[0]!.sessionId === null, "sessão não separada continua num Livro do dia só, sem sessão");
    const comumEvento = await eventoDe(comum[0]!.agendaEventId);
    assert(comumEvento.startTime === null, "o evento do Livro comum continua sem horário, como hoje");

    const mistoLivros = await livrosDe(misto.id);
    assert(mistoLivros.length === 2 && mistoLivros.filter((l) => l.sessionId === mSep!.id).length === 1 && mistoLivros.filter((l) => l.sessionId === null).length === 1,
      "show misto: um Livro para a sessão separada e o Livro do dia para a não separada");
    void mComum; void sComum; void musical;

    // Mudar "separada" numa sessão com Livro que já tem gente é recusado com a frase; sem gente, o rascunho sai de cena.
    const comGente = await asAdmin(`/show-books/${teatro.id}/sessions/${s1130!.id}`, { method: "PATCH", body: JSON.stringify({ separada: false }) });
    const comGenteBody = (await comGente.json()) as { error?: string; message?: string };
    assert(comGente.status === 409 && comGenteBody.error === "SESSAO_COM_LIVRO" && /Cancele o Livro/.test(comGenteBody.message ?? ""), "tirar o 'separada' de sessão com Livro com pessoas responde 409 com a frase");
    await gerarDiaDoLocal(actor, { id: local!.id, name: local!.name }, segunda);
    const vazioLivros = await livrosDe(vazio.id);
    assert(vazioLivros.length === 1 && vazioLivros[0]!.sessionId === sVazia!.id, "show sem fila gera o Livro da sessão separada só com vagas abertas");
    const desmarcar = await asAdmin(`/show-books/${vazio.id}/sessions/${sVazia!.id}`, { method: "PATCH", body: JSON.stringify({ separada: false }) });
    const desmarcarBody = (await desmarcar.json()) as { session?: { separada: boolean } };
    assert(desmarcar.status === 200 && desmarcarBody.session?.separada === false, "tirar o 'separada' de sessão com Livro sem pessoas funciona");
    assert((await livrosDe(vazio.id)).length === 0, "o Livro em rascunho sem pessoas é cancelado de forma lógica");
    const criada = await asAdmin(`/show-books/${musical.id}/sessions`, { method: "POST", body: JSON.stringify({ startTime: "12:30", endTime: "13:00", separada: true }) });
    const criadaBody = (await criada.json()) as { session?: { separada: boolean } };
    assert(criada.status === 201 && criadaBody.session?.separada === true, "criar sessão aceita 'separada'");
    const lista = (await (await asAdmin(`/show-books/${musical.id}/sessions`)).json()) as { sessions: { separada: boolean }[] };
    assert(lista.sessions.length === 1 && lista.sessions[0]!.separada === true, "a lista de sessões devolve 'separada'");

    // ---------- Task 2B: a Escala do dia e o Livro mostram a sessão separada ----------
    type Bloco = { key: string; rotulo: string; inicio: string; dailyBookId: string | null; pessoaIds: string[]; sinal: string | null };
    const diaRes = (await (await asAdmin(`/escalas/dia?locationId=${local!.id}&date=${segunda}`)).json()) as { dia: { blocos: Bloco[] } };
    const bloco = (rotulo: string) => diaRes.dia.blocos.find((b) => b.rotulo === rotulo);
    const livroDaSessao = (sessionId: string) => (teatroLivros.find((l) => l.sessionId === sessionId))!;
    assert(bloco("TEATRO 11:30")?.dailyBookId === livroDaSessao(s1130!.id).id, "o bloco das 11:30 da Escala aponta para o Livro da sessão das 11:30");
    assert(bloco("TEATRO 15:30")?.dailyBookId === livroDaSessao(s1530!.id).id, "o bloco das 15:30 da Escala aponta para o Livro da sessão das 15:30");
    assert((bloco("TEATRO 11:30")?.pessoaIds.length ?? 0) > 0 && !(bloco("TEATRO 11:30")?.sinal ?? "").includes("não gerado"), "cada bloco do teatro mostra as pessoas do Livro dele");
    const mistoDoDia = await livrosDe(misto.id);
    assert(bloco("MISTO MANHÃ")?.dailyBookId === mistoDoDia.find((l) => l.sessionId === mSep!.id)!.id, "show misto: o bloco da sessão separada aponta para o Livro dela");
    assert(bloco("MISTO TARDE")?.dailyBookId === mistoDoDia.find((l) => l.sessionId === null)!.id, "show misto: o bloco da sessão comum aponta para o Livro do dia");
    const duploLivros = await livrosDe(duplo.id);
    assert(duploLivros.length === 1 && duploLivros[0]!.sessionId === null, "show com duas sessões comuns tem um Livro do dia só");
    assert(bloco("DUPLO TARDE")?.dailyBookId === duploLivros[0]!.id && bloco("DUPLO NOITE")?.dailyBookId === duploLivros[0]!.id, "os dois blocos do show com sessões comuns seguem no MESMO Livro do dia");

    const detalhe1130 = (await (await asAdmin(`/daily-book/${livroDaSessao(s1130!.id).id}`)).json()) as { dailyBook: { sessionLabel: string | null; eventTitle: string; sessionBlocks: unknown[] } };
    assert(detalhe1130.dailyBook.sessionLabel === "11:30" && detalhe1130.dailyBook.eventTitle.endsWith("· 11:30"), "o Livro da sessão devolve a hora no cabeçalho e no título");
    assert(detalhe1130.dailyBook.sessionBlocks.length === 0, "o Livro de sessão separada não ganha bloco de sessão (a sessão já é o Livro)");
    const detalheComum = (await (await asAdmin(`/daily-book/${comum[0]!.id}`)).json()) as { dailyBook: { sessionLabel: string | null; sessionBlocks: unknown[] } };
    assert(detalheComum.dailyBook.sessionLabel === null && detalheComum.dailyBook.sessionBlocks.length === 1, "o Livro do dia continua sem hora no cabeçalho e com o bloco da sessão comum");
    const detalheMisto = (await (await asAdmin(`/daily-book/${mistoDoDia.find((l) => l.sessionId === null)!.id}`)).json()) as { dailyBook: { sessionBlocks: { name: string }[] } };
    assert(detalheMisto.dailyBook.sessionBlocks.length === 1 && detalheMisto.dailyBook.sessionBlocks[0]!.name.includes("17:00"), "o Livro do dia do show misto só marca a sessão comum, não a separada");
    const listaLivros = (await (await asAdmin(`/daily-book?date=${segunda}`)).json()) as { dailyBooks?: { id: string; sessionLabel: string | null }[] };
    assert((listaLivros.dailyBooks ?? []).find((l) => l.id === livroDaSessao(s1530!.id).id)?.sessionLabel === "15:30", "a lista de Livros do dia traz a hora da sessão separada");

    const curto = (nome: string) => nome.replace(`${tag}_`, "");
    // Quem está no Livro de uma sessão separada só está comprometido com essa sessão (não com as outras do show).
    const sessoesDoTeatro = new Set([s1130!.id, s1530!.id]);
    const pessoasPorSessao = new Map<string, Set<string>>();
    for (const livro of teatroLivros) {
      const linhas = await db.select({ userId: dailyBookAssignmentsTable.userId }).from(dailyBookAssignmentsTable).where(and(eq(dailyBookAssignmentsTable.dailyBookId, livro.id), isNull(dailyBookAssignmentsTable.supersededAt)));
      pessoasPorSessao.set(livro.sessionId!, new Set(linhas.map((l) => l.userId).filter((id): id is string => Boolean(id))));
    }
    let conferidas = 0;
    for (const pessoa of elenco) {
      const esperadas = new Set([...pessoasPorSessao].filter(([, gente]) => gente.has(pessoa.id)).map(([sessionId]) => sessionId));
      const reais = new Set((await collectScheduleCommitments(pessoa.id, segunda)).filter((c) => c.sourceType === "sessao" && sessoesDoTeatro.has(c.sourceId)).map((c) => c.sourceId));
      if (esperadas.size) conferidas += 1;
      assert(esperadas.size === reais.size && [...esperadas].every((id) => reais.has(id)), `${curto(pessoa.name)}: compromissos de sessão só das sessões separadas em que está escalada`);
    }
    assert(conferidas > 0, "o cenário tem gente escalada nas sessões separadas para conferir");

    // ---------- Task 3: o motor respeita restrição de horário, limite do dia, shows colados e uma sessão por dia ----------
    const rolesDe = (showId: string) => db.select().from(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showId)).orderBy(showBookRolesTable.order);
    const evento = async (showId: string, date: string, start: string | null, end: string | null) => (await db.insert(agendaEventsTable).values({
      operationId: operation!.id, showBookId: showId, type: "SHOW", title: `${tag}_evento_${start ?? "sem-hora"}`, date, startTime: start, endTime: end,
      status: "CONFIRMED", visibility: "MANAGEMENT", createdBy: admin.id,
    }).returning())[0]!;
    /** Um Livro "já gerado" de outro show, só para o motor enxergar quem já tem trabalho no dia. */
    const livroDeApoio = async (showId: string, date: string, start: string, end: string, pessoas: string[]) => {
      const ev = await evento(showId, date, start, end);
      const [livro] = await db.insert(dailyBooksTable).values({ agendaEventId: ev.id, showBookId: showId, status: "DRAFT" }).returning();
      const [posicao] = await db.insert(dailyBookPositionsTable).values({ dailyBookId: livro!.id, name: `${tag}_apoio` }).returning();
      await db.insert(dailyBookAssignmentsTable).values(pessoas.map((userId) => ({ dailyBookId: livro!.id, positionId: posicao!.id, userId, status: "ASSIGNED" as const })));
      return livro!;
    };
    const resolver = async (showId: string, date: string, eventId: string) => {
      const { byRole, result } = await resolveAssignmentsByRole(showId, operation!.id, date, { dedupPerScene: true, eventId });
      const roles = await rolesDe(showId);
      const linhas = result.scenes.flatMap((scene) => scene.blocks.flatMap((block) => block.positions.flatMap((position) => position.lines)));
      return { nomes: roles.map((role) => (byRole.get(role.id)?.people ?? []).map((p) => curto(p.name))), linhas, result };
    };
    const [restricaoSofia] = await db.insert(restricoesHorarioTable).values({
      userId: sofia.id, diasSemana: [1, 2, 3, 4, 5], horaInicio: "15:00", horaFim: "23:59", periodStart: "2026-10-22", periodEnd: "2026-12-18", motivo: "escola", createdBy: admin.id,
    }).returning();
    await db.insert(restricoesHorarioTable).values({
      userId: julia.id, diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: "15:00", horaFim: "23:59", periodStart: "2026-10-22", periodEnd: "2026-12-18", motivo: "outro compromisso", createdBy: admin.id,
    });

    // Restrição de horário (Sofia só à tarde de segunda a sexta).
    const d1 = "2026-11-02"; // segunda
    const m1130 = await evento(teatro.id, d1, "11:30", "12:00");
    const m1530 = await evento(teatro.id, d1, "15:30", "16:00");
    const manhaSeg = await resolver(teatro.id, d1, m1130.id);
    assert(!manhaSeg.nomes.flat().includes("sofia"), "segunda às 11:30 a Sofia nunca é escalada (restrição de horário)");
    assert(manhaSeg.nomes[0]?.[0] === "esther" && manhaSeg.nomes[1]?.[0] === "daia", "sem a Sofia, o rodízio segue a ordem: Esther no Jingle e Daia no Bell");
    const tardeSeg = await resolver(teatro.id, d1, m1530.id);
    assert(tardeSeg.nomes[0]?.[0] === "sofia" && tardeSeg.nomes[1]?.[0] === "esther", "segunda às 15:30 a Sofia volta a ser opção e o rodízio a escolhe primeiro");
    const sabado = await evento(teatro.id, "2026-11-07", "11:30", "12:00");
    assert((await resolver(teatro.id, "2026-11-07", sabado.id)).nomes[0]?.[0] === "sofia", "no sábado a Sofia pode fazer a sessão da manhã");

    // Vaga com titular bloqueado cai no próximo da fila e a nota diz por quê.
    const titularManha = await evento(comTitular.id, d1, "11:30", "12:00");
    const comT = await resolver(comTitular.id, d1, titularManha.id);
    assert(comT.nomes[0]?.[0] === "esther" && (comT.linhas[0]?.note ?? "").includes("restrição de horário"), "titular com restrição de horário cede a vaga ao próximo da fila, com a nota explicando");

    // Vaga única de quem tem restrição fica descoberta, com a frase da regra.
    const unicoManha = await evento(unico.id, d1, "11:30", "12:00");
    const semUnica = await resolver(unico.id, d1, unicoManha.id);
    assert(semUnica.linhas[0]?.status === "UNCOVERED" && (semUnica.linhas[0]?.note ?? "").includes("restrição de horário"), "quando só há quem está restrito, a vaga fica descoberta e diz qual regra impediu");
    // Show sem horário: a restrição não é conferida e a geração termina.
    const domingo = await evento(unico.id, "2026-11-08", null, null);
    const semHora = await resolver(unico.id, "2026-11-08", domingo.id);
    assert(semHora.linhas[0]?.status === "COVERED" && semHora.nomes[0]?.[0] === "julia" && semHora.result.semHorario === true, "evento sem horário: a restrição é ignorada, a vaga é preenchida e o resultado avisa 'sem horário'");

    // Limite de shows por dia, configurável por local.
    const d3 = "2026-11-09";
    const m3 = await evento(teatro.id, d3, "15:30", "16:00");
    for (const [showId, inicio, fim] of [[musical.id, "09:00", "09:30"], [sozinho.id, "12:30", "13:00"], [misto.id, "17:30", "18:00"]] as const) {
      await livroDeApoio(showId, d3, inicio, fim, elenco.map((p) => p.id));
    }
    await db.insert(escalaRegrasLocalTable).values({ locationId: local!.id, limiteShowsDia: 3 });
    const noLimite = await resolver(teatro.id, d3, m3.id);
    assert(noLimite.linhas.every((l) => l.status === "UNCOVERED" && (l.note ?? "").includes("limite")), "com limite 3 e todos já em 3 shows, as vagas ficam descobertas e a nota cita o limite do local");
    await db.update(escalaRegrasLocalTable).set({ limiteShowsDia: 4 }).where(eq(escalaRegrasLocalTable.locationId, local!.id));
    assert((await resolver(teatro.id, d3, m3.id)).linhas.every((l) => l.status === "COVERED"), "com limite 4, quem tem 3 shows ainda pode fazer o quarto");
    await db.delete(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, local!.id));
    assert((await resolver(teatro.id, d3, m3.id)).linhas.every((l) => l.status === "COVERED"), "local sem regra cadastrada não tem limite");

    // Shows colados: evitar, nunca proibir.
    const d4 = "2026-11-16";
    const m4 = await evento(teatro.id, d4, "15:30", "16:00");
    await livroDeApoio(sozinho.id, d4, "15:15", "15:20", [sofia.id, esther.id]);
    await livroDeApoio(musical.id, d4, "09:00", "09:30", [daia.id, kaua.id, julia.id, bel.id]);
    const colados = await resolver(teatro.id, d4, m4.id);
    assert(colados.nomes[0]?.[0] === "daia" && colados.nomes[1]?.[0] === "kaua", "quem está na Montanha às 15:15 fica por último na fila do Teatro das 15:30 (todos têm 1 show no dia)");
    await db.insert(escalaRegrasLocalTable).values({ locationId: local!.id, limiteShowsDia: null, intervaloMinimoMinutos: 5 });
    const folgado = await resolver(teatro.id, d4, m4.id);
    assert(folgado.nomes[0]?.[0] === "sofia" && folgado.nomes[1]?.[0] === "esther", "com intervalo mínimo de 5 minutos, 10 minutos entre os shows já não é colado");
    await db.delete(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, local!.id));
    const d4b = "2026-11-17";
    const m4b = await evento(unico.id, d4b, "15:30", "16:00");
    await livroDeApoio(sozinho.id, d4b, "15:15", "15:20", [julia.id]);
    const colada = await resolver(unico.id, d4b, m4b.id);
    assert(colada.linhas[0]?.status === "COVERED" && colada.nomes[0]?.[0] === "julia", "quem está colada, mas é a única da fila, é escolhida mesmo assim");

    // Uma sessão por dia: a carga do dia enxerga a outra sessão do MESMO show; regenerar não conta o próprio Livro.
    const d7 = "2026-11-23";
    const t1130 = await evento(teatro.id, d7, "11:30", "12:00");
    const t1530 = await evento(teatro.id, d7, "15:30", "16:00");
    const livro1130 = (await db.insert(dailyBooksTable).values({ agendaEventId: t1130.id, showBookId: teatro.id, sessionId: s1130!.id, status: "DRAFT" }).returning())[0]!;
    const posicao1130 = (await db.insert(dailyBookPositionsTable).values({ dailyBookId: livro1130.id, name: `${tag}_apoio` }).returning())[0]!;
    await db.insert(dailyBookAssignmentsTable).values([sofia, esther].map((p) => ({ dailyBookId: livro1130.id, positionId: posicao1130.id, userId: p.id, status: "ASSIGNED" as const })));
    // Restrição encerrada volta a valer como "livre" na próxima leitura, sem regenerar nada (dezembro: sem carga de outros cenários).
    const dez = "2026-12-07"; // segunda
    const dez1130 = await evento(teatro.id, dez, "11:30", "12:00");
    assert(!(await resolver(teatro.id, dez, dez1130.id)).nomes.flat().includes("sofia"), "restrição ativa: a Sofia não entra às 11:30");
    await db.update(restricoesHorarioTable).set({ status: "ENDED", endedBy: admin.id, endedAt: new Date() }).where(eq(restricoesHorarioTable.id, restricaoSofia!.id));
    assert((await resolver(teatro.id, dez, dez1130.id)).nomes[0]?.[0] === "sofia", "restrição encerrada: na próxima leitura a Sofia volta a ser opção às 11:30, sem regenerar nada");
    const tarde7 = await resolver(teatro.id, d7, t1530.id);
    assert(tarde7.nomes[0]?.[0] === "daia" && tarde7.nomes[1]?.[0] === "kaua", "quem fez a sessão das 11:30 só entra na das 15:30 se não houver mais ninguém (Daia e Kauã passam à frente)");
    const manha7 = await resolver(teatro.id, d7, t1130.id);
    assert(manha7.nomes[0]?.[0] === "sofia" && manha7.nomes[1]?.[0] === "esther", "regenerar a sessão das 11:30 não conta o próprio Livro contra quem já está nele");

    // ---------- Task 4: exceção à mão, com motivo escrito e aviso à Administração ----------
    const noLivro1130 = pessoasPorSessao.get(s1130!.id)!, noLivro1530 = pessoasPorSessao.get(s1530!.id)!;
    const alvoRestrito = bel; // fora dos dois Livros; restrição de segunda a sexta só a partir das 15:00
    // Para o limite: alguém sem restrição de horário que já está em OUTRO Livro do dia (qualquer show) e não no das 11:30.
    // (Todos os shows do cenário dividem o mesmo elenco, então quem está em quê depende do rodízio; o teste lê o que foi gerado.)
    const livrosDoDia = await pool.query(
      `select distinct a.user_id as "userId" from daily_book_assignments a join daily_books b on b.id = a.daily_book_id join agenda_events e on e.id = b.agenda_event_id
        where e.operation_id = $1 and e.date = $2 and b.status <> 'CANCELLED' and b.id <> $3 and a.superseded_at is null and a.status in ('ASSIGNED','AT_RISK') and a.user_id is not null`,
      [operation!.id, segunda, livroDaSessao(s1130!.id).id]);
    const emOutroLivro = new Set((livrosDoDia.rows as { userId: string }[]).map((r) => r.userId));
    const alvoLimite = elenco.find((p) => emOutroLivro.has(p.id) && !noLivro1130.has(p.id) && p.id !== julia.id && p.id !== bel.id);
    assert(!noLivro1130.has(alvoRestrito.id) && Boolean(alvoLimite), "o cenário tem quem está fora do Livro das 11:30 para a exceção");
    await db.insert(restricoesHorarioTable).values({ userId: alvoRestrito.id, diasSemana: [1, 2, 3, 4, 5], horaInicio: "15:00", horaFim: "23:59", periodStart: "2026-10-22", periodEnd: "2026-12-18", motivo: "faculdade", createdBy: admin.id });
    const bloco1130 = bloco("TEATRO 11:30")!;
    const ajustar = (fn: typeof asAdmin, userId: string, motivo?: string) => fn("/escalas/dia/ajustes", { method: "POST", body: JSON.stringify({ locationId: local!.id, date: segunda, sourceKey: bloco1130.key, userId, action: "ADICIONAR", ...(motivo ? { motivo } : {}) }) });
    const avisosDe = async (userId: string, tipo: string) => (await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = $2`, [userId, tipo])).rows[0].n as number;

    const semMotivo = await ajustar(asAdmin, alvoRestrito.id);
    const semMotivoBody = (await semMotivo.json()) as { error?: string; message?: string };
    assert(semMotivo.status === 409 && semMotivoBody.error === "PESSOA_COM_RESTRICAO_DE_HORARIO", "escalar quem tem restrição de horário sem motivo responde 409 PESSOA_COM_RESTRICAO_DE_HORARIO");
    assert(/restrição de horário/.test(semMotivoBody.message ?? "") && /escreva o motivo/.test(semMotivoBody.message ?? ""), "a recusa explica a regra e pede o motivo");
    assert((await ajustar(asSupOutra, alvoRestrito.id, "sem aula hoje")).status === 403, "Supervisão de outra área não libera a exceção");
    assert((await ajustar(asDir, alvoRestrito.id, "sem aula hoje")).status === 403 && (await ajustar(asJulia, alvoRestrito.id, "sem aula hoje")).status === 403, "Direção e Elenco não liberam a exceção");
    const liberada = await ajustar(asSup, alvoRestrito.id, "sem aula hoje");
    assert(liberada.status === 200, "Supervisão da área da pessoa libera a exceção com motivo");
    const eventos = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.action, "escala.pessoa_adicionada")));
    const comRegra = eventos.find((e) => ((e.metadata ?? {}) as { regras?: string[] }).regras?.includes("RESTRICAO_HORARIO"));
    assert(Boolean(comRegra) && JSON.stringify(comRegra!.metadata).includes("sem aula hoje"), "o Registro grava a regra passada e o motivo escrito");
    assert((await avisosDe(admin.id, "escala.excecao_de_regra")) === 1 && (await avisosDe(admin2.id, "escala.excecao_de_regra")) === 1, "a Administração é avisada no sino, um aviso por acontecimento");
    assert((await avisosDe(sup.id, "escala.excecao_de_regra")) === 0, "quem liberou a exceção não recebe aviso de si mesmo");

    // Limite do dia: acima do limite só com motivo; quem libera avisa a Administração.
    await db.insert(escalaRegrasLocalTable).values({ locationId: local!.id, limiteShowsDia: 1 });
    const acima = await ajustar(asAdmin, alvoLimite!.id);
    const acimaBody = (await acima.json()) as { error?: string; message?: string };
    assert(acima.status === 409 && acimaBody.error === "ACIMA_DO_LIMITE_DO_DIA" && /limite do local: 1/.test(acimaBody.message ?? ""), `passar do limite do local sem motivo responde 409 ACIMA_DO_LIMITE_DO_DIA com a frase (veio ${acima.status} ${acimaBody.error} ${acimaBody.message})`);
    const acimaLiberado = await ajustar(asAdmin, alvoLimite!.id, "alguém ficou mal de última hora");
    assert(acimaLiberado.status === 200, "a Administração passa do limite à mão, com motivo");
    assert((await avisosDe(admin2.id, "escala.excecao_de_regra")) === 2 && (await avisosDe(admin.id, "escala.excecao_de_regra")) === 1, "passar do limite avisa as outras pessoas da Administração, não quem fez");
    await db.delete(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, local!.id));

    // Troca direta no Livro do Dia: mesma regra.
    const livro1130Agora = (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, livroDaSessao(s1130!.id).id)))[0]!;
    const vaga = (await db.select().from(dailyBookAssignmentsTable).where(and(eq(dailyBookAssignmentsTable.dailyBookId, livro1130Agora.id), isNull(dailyBookAssignmentsTable.supersededAt))))
      .find((a) => a.userId && a.userId !== alvoRestrito.id && !a.manual)!;
    const trocar = (userId: string, motivo?: string, versao = livro1130Agora.version) => asAdmin(`/daily-book/${livro1130Agora.id}/assignments/${vaga.id}`, { method: "PATCH", body: JSON.stringify({ userId, expectedVersion: versao, ...(motivo ? { motivo } : {}) }) });
    const trocaSemMotivo = await trocar(alvoRestrito.id);
    assert(trocaSemMotivo.status === 409 && ((await trocaSemMotivo.json()) as { error?: string }).error === "PESSOA_COM_RESTRICAO_DE_HORARIO", "troca direta no Livro para quem tem restrição de horário, sem motivo, é recusada");
    const trocaComMotivo = await trocar(alvoRestrito.id, "sem aula hoje");
    assert(trocaComMotivo.status === 200, "troca direta no Livro com motivo funciona");
    const vagaDepois = (await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.id, vaga.id)))[0]!;
    assert(vagaDepois.userId === alvoRestrito.id && vagaDepois.manual === true, "a troca vira exceção do dia (vaga manual) e o motor não a refaz sozinho");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const ids = everyone.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (scales.length) {
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, scales.map((s) => s.id)));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, scales.map((s) => s.id)));
    }
    const shows = await db.select({ id: showBooksTable.id }).from(showBooksTable).where(eq(showBooksTable.operationId, operation!.id));
    const showIds = shows.map((s) => s.id);
    const books = showIds.length ? await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(inArray(dailyBooksTable.showBookId, showIds)) : [];
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
    if (showIds.length) {
      await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, showIds));
      const roles = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      if (roles.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, roles.map((r) => r.id)));
      await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, showIds));
      await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, showIds));
      await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, showIds));
      await db.delete(sessionsTable).where(inArray(sessionsTable.showId, showIds));
      await db.delete(showBooksTable).where(inArray(showBooksTable.id, showIds));
    }
    const characters = await db.select({ id: charactersTable.id }).from(charactersTable).where(eq(charactersTable.locationId, local!.id));
    if (characters.length) {
      await db.delete(characterCastTable).where(inArray(characterCastTable.characterId, characters.map((c) => c.id)));
      await db.delete(charactersTable).where(inArray(charactersTable.id, characters.map((c) => c.id)));
    }
    await db.delete(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, local!.id));
    await db.delete(restricoesHorarioTable).where(inArray(restricoesHorarioTable.userId, ids));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [area!.id, areaOutra!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em restrição de horário`);
  process.stdout.write(`restricao-horario: ${passed} asserts passed\n`);
}

process.stdout.write("restricao-horario: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
