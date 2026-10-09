/** Fase C (C1) — Meu Dia nos quatro perfis, montado da Escala do dia, check-in, tarefas, folgas, ocorrências e Mural. PostgreSQL real de teste. */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  announcementsTable,
  areaLocalSupervisorsTable,
  areasTable,
  dayCheckInsTable,
  db,
  folgasTable,
  historyEventsTable,
  leaveRequestsTable,
  locationsTable,
  occurrencesTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  scalesTable,
  tasksTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { montarMeuDia } from "../src/services/meu-dia.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `meudia_${Date.now()}`;
  const date = "2026-10-14"; // quarta
  const tomorrow = "2026-10-15";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mk = async (name: string, role: "ADMIN" | "DIR" | "SUPERVISOR_A" | "MEMBER", located = true, semLocalPadrao = false) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name, username: `${tag}_${name}`.toLowerCase(), areaId: located ? area!.id : null, defaultLocationId: located && !semLocalPadrao ? local!.id : null }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN", false);
  const cris = await mk("Cris", "DIR", false);
  const deborah = await mk("Deborah", "SUPERVISOR_A");
  // Julia não tem local padrão (como hoje em produção): o Meu Dia acha o local pela escala publicada.
  const julia = await mk("Julia", "MEMBER", true, true);
  const carol = await mk("Carolzinha", "MEMBER");
  const dani = await mk("Dani", "MEMBER");
  const everyone = [barbara, cris, deborah, julia, carol, dani].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: local!.id, supervisorId: deborah.id });
  await db.insert(folgasTable).values({ userId: dani.id, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, createdBy: barbara.id });
  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_molde`, vigenciaInicio: date, vigenciaFim: tomorrow, createdBy: barbara.id }).returning();
  const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
  await db.insert(programacaoBlocosTable).values([date, tomorrow].flatMap((d) => [
    { programacaoId: prog!.id, weekday: wd(d), inicio: "09:40", fim: "11:00", rotulo: "TREINO GELO", regra: "area" as const, areaIds: [area!.id] },
    { programacaoId: prog!.id, weekday: wd(d), inicio: "12:00", fim: "13:00", rotulo: "ALMOÇO", regra: "todos" as const },
  ]));
  const [escala] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_escala`, periodStart: date, periodEnd: date, status: "PUBLISHED", publishedAt: new Date(), createdBy: barbara.id }).returning();
  await db.insert(tasksTable).values({ organizationId: org!.id, operationId: operation!.id, title: `${tag}_passar figurino`, creatorId: barbara.id, assigneeId: julia.id, dueDate: date, mandatoryEvidences: [{ id: "e1", type: "PHOTO", description: "foto" }] as never });
  await db.insert(leaveRequestsTable).values({ organizationId: org!.id, userId: carol.id, areaId: area!.id, startDate: "2026-10-20", endDate: "2026-10-21", reason: "compromisso" });
  await db.insert(occurrencesTable).values({ personId: carol.id, date, type: "atraso recorrente", description: "chegou 20 min depois", registeredBy: deborah.id, reason: "registro da supervisão" });
  await db.insert(announcementsTable).values({ orgId: org!.id, authorId: barbara.id, type: "NOTICE", scope: "HOUSE", title: `${tag} Ensaio geral sexta às 19h`, body: "Todos no palco principal." } as never);

  const as = (p: "adm" | "dir" | "sup" | "mem", user: { id: string }, role: string, hhmm: string) => montarMeuDia({ sub: user.id, organizationId: org!.id, role }, p, new Date(`${date}T${hhmm}:00-03:00`));
  let server: http.Server | null = null;
  try {
    // ---------- Elenco ----------
    const j1 = await as("mem", julia, "MEMBER", "09:20");
    assert(j1.data === date && j1.hora === "09:20", "o Meu Dia é do dia e da hora da operação");
    assert(j1.saudacao.titulo === "Bom dia, Julia!" && j1.saudacao.texto.includes("09:40"), "Elenco: a saudação diz a que horas ela entra");
    const acao = j1.saudacao.acao as { label: string; checkIn?: { scaleId: string; sourceKey: string } } | null;
    assert(acao?.label === "Fazer check-in" && acao.checkIn?.scaleId === escala!.id, "Elenco: o botão principal é o check-in, já com a escala e o bloco certos");
    assert(j1.proximo?.time === "09:40" && j1.proximo.rel === "em 20 min" && j1.proximo.title === "TREINO GELO", "Elenco: a próxima atividade é o TREINO GELO, em 20 min");
    assert(j1.linhaDoTempo.itens.length === 2 && j1.linhaDoTempo.itens.map((i) => i.title).join(",") === "TREINO GELO,ALMOÇO", "Elenco: a linha do tempo tem só os blocos dela, em ordem");
    const tarefa = j1.pendencias.itens.find((p) => p.title.startsWith("Tarefa"));
    assert(Boolean(tarefa) && tarefa!.count === 1 && tarefa!.sub.includes("evidência"), "Elenco: a tarefa de hoje aparece, avisando que pede evidência");
    assert(j1.mural.length >= 1 && j1.mural[0]!.texto.includes("Ensaio geral"), "Elenco: o Mural traz a publicação mais recente");
    await db.insert(dayCheckInsTable).values({ scaleId: escala!.id, sourceKey: acao!.checkIn!.sourceKey, userId: julia.id, status: "CHECKED_IN", checkedInAt: new Date(`${date}T09:25:00-03:00`), registeredBy: julia.id });
    const j2 = await as("mem", julia, "MEMBER", "09:30");
    assert(j2.saudacao.titulo === "Tudo certo por aqui!" && j2.saudacao.texto.includes("09:25") && j2.saudacao.mascote === "tarefa-concluida", "Elenco: depois do check-in, a saudação confirma o horário");
    const d1 = await as("mem", dani, "MEMBER", "09:20");
    assert(d1.saudacao.texto.includes("folga") && d1.linhaDoTempo.itens.length === 0, "Elenco de folga: a tela diz que é dia de folga, sem blocos");

    // ---------- Supervisão ----------
    const s1 = await as("sup", deborah, "SUPERVISOR_A", "10:00");
    const ocorr = s1.pendencias.itens.find((p) => p.title.startsWith("Ocorrência"));
    const folga = s1.pendencias.itens.find((p) => p.title.startsWith("Folga"));
    const faltas = s1.pendencias.itens.find((p) => p.title.startsWith("Check-in"));
    const amanha = s1.pendencias.itens.find((p) => p.title.startsWith("Escala de amanhã"));
    assert(Boolean(ocorr) && ocorr!.sub.includes("Carolzinha"), "Supervisão: a ocorrência da área aparece com o nome da pessoa");
    assert(Boolean(folga) && folga!.sub.includes("Carolzinha") && folga!.href === "/folgas", "Supervisão: a folga a decidir aparece e leva para Folgas");
    assert(Boolean(faltas) && faltas!.count === 2, "Supervisão: check-ins em falta = quem já devia ter chegado (Carol e a própria Deborah), sem Julia e sem quem está de folga");
    assert(Boolean(amanha) && amanha!.sub.includes("Patinadores"), "Supervisão: lembra de marcar a área dela pronta na escala de amanhã");
    assert(!s1.pendencias.itens.some((p) => p.title.startsWith("Escala de hoje")) && !s1.saudacao.texto.includes("espera você"), "Supervisão: escala de hoje já publicada não vira pendência nem cobrança na saudação");
    assert(s1.saudacao.acao !== null && "href" in s1.saudacao.acao! && s1.saudacao.texto.includes("decis"), "Supervisão: a saudação aponta as decisões");
    assert(s1.linhaDoTempo.itens.some((i) => i.title === "TREINO GELO" && i.tag.includes("sem check-in")), "Supervisão: o bloco em curso mostra quantos faltam fazer check-in");

    // ---------- Direção: número, nunca nome ----------
    const c1 = await as("dir", cris, "DIR", "10:00");
    const dirOcorr = c1.pendencias.itens.find((p) => p.title.startsWith("Ocorrência"));
    assert(Boolean(dirOcorr) && dirOcorr!.count === 1, "Direção: vê quantas ocorrências estão abertas");
    const dirJson = JSON.stringify({ ...c1, mural: [] });
    assert(!dirJson.includes("Carolzinha") && !dirJson.includes("atraso recorrente"), "Direção: nem o nome nem o motivo da ocorrência aparecem (doc 12)");
    assert(c1.linhaDoTempo.itens.some((i) => i.title === local!.name && i.time === "33%"), "Direção: cobertura por local (1 de 3 esperados com check-in — Julia, Carol e a própria Deborah)");

    // ---------- Administração ----------
    const b1 = await as("adm", barbara, "ADMIN", "10:00");
    assert(b1.pendencias.itens.some((p) => p.title === `Escala de amanhã · ${local!.name}`), "Administração: a escala de amanhã não publicada aparece nas pendências");
    assert(b1.pendencias.itens.some((p) => p.title.startsWith("Ocorrência")) && b1.pendencias.itens.some((p) => p.title.startsWith("Folga")), "Administração: ocorrências e folgas a decidir da organização");

    // ---------- HTTP ----------
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const get = async (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}_${Math.random()}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      const r = await fetch(`http://127.0.0.1:${address.port}/api/meu-dia`, { signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}` } });
      return { status: r.status, body: (await r.json()) as { perfil?: string } };
    };
    const perfis = await Promise.all([get(julia.id, "MEMBER"), get(deborah.id, "SUPERVISOR_A"), get(cris.id, "DIR"), get(barbara.id, "ADMIN")]);
    assert(perfis.map((p) => `${p.status}:${p.body.perfil}`).join(",") === "200:mem,200:sup,200:dir,200:adm", "GET /api/meu-dia responde para os quatro perfis, cada um no seu recorte");
    const anon = await fetch(`http://127.0.0.1:${address.port}/api/meu-dia`);
    assert(anon.status === 401, "sem sessão, /api/meu-dia responde 401");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(dayCheckInsTable).where(eq(dayCheckInsTable.scaleId, escala!.id));
    await db.delete(scalesTable).where(eq(scalesTable.id, escala!.id));
    await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, prog!.id));
    await db.delete(programacoesTable).where(eq(programacoesTable.id, prog!.id));
    await db.delete(announcementsTable).where(eq(announcementsTable.orgId, org!.id));
    await db.delete(occurrencesTable).where(inArray(occurrencesTable.personId, everyone));
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, org!.id));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) no Meu Dia`);
  process.stdout.write(`fase-c-meu-dia: ${passed} asserts passed\n`);
}

process.stdout.write("fase-c-meu-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
