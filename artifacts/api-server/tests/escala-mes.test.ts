/**
 * Gerar o mês em rascunho: em ordem, em blocos com orçamento de tempo, retomando de onde parou;
 * pula dia fechado, sem Programação e já publicado; a falha de um dia não derruba os outros;
 * nada é publicado e fica no Registro. Contra PostgreSQL real de teste.
 */
import {
  db, pool, organizationsTable, operationsTable, operationLocationsTable, usersTable, locationsTable, programacoesTable, programacaoBlocosTable,
  showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable, scalesTable, scaleAllocationsTable, agendaEventsTable, dailyBooksTable,
  dailyBookScenesTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookAssignmentsTable, userRolesTable, historyEventsTable,
  operationalChangesTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { gerarMes } from "../src/services/escala-mes.js";
import { operationalDate } from "../src/lib/operational-date.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

async function run() {
  const tag = `escmes_${Date.now()}`;
  // Mês que vem: sempre válido (1 à frente) e independente do dia de hoje.
  const [hy, hm] = operationalDate().split("-").map(Number) as [number, number];
  const ano = hm === 12 ? hy + 1 : hy, mes = hm === 12 ? 1 : hm + 1;
  const d = (n: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(n).padStart(2, "0")}`;

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const mk = async (s: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${s}`, username: `${tag}_${s}` }).returning())[0]!;
  const admin = await mk("admin"), membro = await mk("membro");
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: op!.id, role: "ADMIN", active: true },
    { userId: membro.id, operationId: op!.id, role: "MEMBER", active: true },
  ]);
  // O local fecha no dia da semana do dia 3 do mês.
  const diaFechado = weekdayOf(d(3));
  const [loc] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local`, operatingDays: [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== diaFechado) }).returning();
  await db.insert(operationLocationsTable).values({ operationId: op!.id, locationId: loc!.id });
  const [outroLocal] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_outro` }).returning();

  const novoShow = async (titulo: string, locationId: string) => {
    const [sb] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId, title: titulo, createdBy: admin.id }).returning();
    const [sc] = await db.insert(showBookScenesTable).values({ showBookId: sb!.id, name: "Cena", order: 0 }).returning();
    const [bl] = await db.insert(showBookBlocksTable).values({ showBookId: sb!.id, sceneId: sc!.id, name: "Bloco", order: 0 }).returning();
    await db.insert(showBookRolesTable).values({ showBookId: sb!.id, blockId: bl!.id, name: "Papel", order: 0 });
    return sb!.id;
  };
  const showBom = await novoShow(`${tag}_bom`, loc!.id);
  const showRuim = await novoShow(`${tag}_ruim`, outroLocal!.id); // show de OUTRO local: o dia 4 vai falhar
  // Programação só cobre os dias 1 a 4. Dias 1 e 2: show bom. Dia 3: local fechado. Dia 4: show de outro local.
  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: loc!.id, nome: `${tag}_prog`, vigenciaInicio: d(1), vigenciaFim: d(4), createdBy: admin.id }).returning();
  const semana = [...new Set([1, 2, 4].map((n) => weekdayOf(d(n))))];
  for (const w of semana) {
    const ehDia4 = w === weekdayOf(d(4)) && w !== weekdayOf(d(1)) && w !== weekdayOf(d(2));
    await db.insert(programacaoBlocosTable).values({ programacaoId: prog!.id, weekday: w, inicio: "10:00", rotulo: "SHOW", regra: "livro", showBookId: ehDia4 ? showRuim : showBom, order: 0 });
  }

  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const tok = (u: string, role: string) => signAccessToken({ sub: u, jti: `${tag}_${u}`, organizationId: org!.id, role, operationIds: [op!.id] });
  const req = (token: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(120_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
  const asAdmin = req(tok(admin.id, "ADMIN")), asMembro = req(tok(membro.id, "MEMBER"));
  const ator = { sub: admin.id, role: "ADMIN", organizationId: org!.id };

  try {
    // Quem pode e quais meses.
    assert((await asMembro(`/escalas/mes/resumo?locationId=${loc!.id}&year=${ano}&month=${mes}`)).status === 403, "Elenco não vê nem gera o mês (403)");
    const passado = await asAdmin(`/escalas/mes/resumo?locationId=${loc!.id}&year=${hy}&month=${hm - 1 || 12}`);
    assert(passado.status === 400, "mês que já passou: recusado (400)");
    const longe = await asAdmin(`/escalas/mes/resumo?locationId=${loc!.id}&year=${hy + 1}&month=${hm}`);
    assert(longe.status === 400, "mais de 2 meses à frente: recusado (400)");

    // Resumo antes de gerar.
    const r0 = await (await asAdmin(`/escalas/mes/resumo?locationId=${loc!.id}&year=${ano}&month=${mes}`)).json() as { dias: { date: string; estado: string; motivo: string | null }[]; totais: { aGerar: number } };
    const estado = (r: typeof r0, n: number) => r.dias.find((x) => x.date === d(n))?.estado;
    assert(estado(r0, 1) === "a_gerar" && estado(r0, 2) === "a_gerar" && estado(r0, 4) === "a_gerar", "dias da Programação aparecem como a gerar");
    assert(estado(r0, 3) === "fechado", "dia em que o local não abre aparece como fechado");
    assert(estado(r0, 5) === "sem_programacao" && Boolean(r0.dias.find((x) => x.date === d(5))?.motivo), "dia fora da Programação: sem Programação, com o motivo");
    assert(r0.totais.aGerar === 3, "o resumo conta 3 dias a gerar");

    // Bloco 1: orçamento mínimo = um dia só, e diz de onde continuar.
    const b1 = await gerarMes(ator, loc!.id, ano, mes, { orcamentoMs: 1 });
    assert(b1!.gerados.length === 1 && b1!.gerados[0]!.date === d(1), "primeiro bloco gera só o dia 1 (em ordem)");
    assert(b1!.restantes === 2 && b1!.proximoDia === d(2), "diz que faltam 2 e continua do dia 2");

    // Bloco 2: o resto. O dia 4 falha (show de outro local) e NÃO derruba o dia 2.
    const b2 = await gerarMes(ator, loc!.id, ano, mes, { desde: b1!.proximoDia });
    assert(b2!.gerados.map((g) => g.date).join() === d(2) , "o dia 2 gerou apesar de o dia 4 falhar");
    assert(b2!.falhas.length === 1 && b2!.falhas[0]!.date === d(4) && /não pertence a este local/.test(b2!.falhas[0]!.motivo), "o dia 4 falha com o motivo escrito");
    assert(b2!.restantes === 0 && b2!.proximoDia === null, "acabou: nada restante");
    assert(b2!.pulados.some((p) => p.date === d(3) && p.estado === "fechado"), "o resultado lista o dia fechado como pulado, com o motivo");

    // Retomar não repete.
    const b3 = await gerarMes(ator, loc!.id, ano, mes, { desde: d(1) });
    assert(b3!.gerados.length === 0, "rodar de novo não gera nada que já existe (retoma sem repetir)");

    // Nada publicado, Livros em rascunho, Registro gravado.
    const escalas = await db.select().from(scalesTable).where(eq(scalesTable.locationId, loc!.id));
    assert(escalas.length >= 2 && escalas.every((e) => e.status === "DRAFT"), "as Escalas geradas ficam em rascunho");
    const livros = await db.select().from(dailyBooksTable).innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id)).where(eq(showBooksTable.id, showBom));
    assert(livros.length === 2 && livros.every((l) => l.daily_books.status === "DRAFT"), "os Livros do Dia ficam em rascunho (2 dias)");
    const eventos = await db.select().from(historyEventsTable).where(eq(historyEventsTable.action, "escala.mes_gerado"));
    // Um evento por chamada que gerou ou falhou algum dia: bloco 1 (dia 1), bloco 2 (dia 2 + falha do dia 4)
    // e a releitura do bloco 3 (o dia 4 continua pendente e falha de novo). Chamada sem nada a fazer não grava.
    const meus = eventos.filter((e) => e.orgId === org!.id);
    assert(meus.length === 3, "cada chamada que gerou ou falhou algum dia grava um evento no Registro");

    // Dia já publicado não é tocado.
    const escalaDia1 = escalas.find((e) => e.periodStart === d(1))!;
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, escalaDia1.id));
    const r1 = await (await asAdmin(`/escalas/mes/resumo?locationId=${loc!.id}&year=${ano}&month=${mes}`)).json() as typeof r0;
    assert(estado(r1, 1) === "publicado", "dia publicado aparece como publicado");
    const b4 = await gerarMes(ator, loc!.id, ano, mes);
    assert(b4!.gerados.length === 0, "gerar o mês não mexe em dia publicado");

    // ─── Descartar rascunhos do mês, e desfazer ───
    assert((await asMembro("/escalas/mes/descartar", { method: "POST", body: JSON.stringify({ locationId: loc!.id, year: ano, month: mes, motivo: "teste" }) })).status === 403, "Elenco não descarta (403)");
    assert((await asAdmin("/escalas/mes/descartar", { method: "POST", body: JSON.stringify({ locationId: loc!.id, year: ano, month: mes }) })).status === 400, "descartar sem motivo é recusado (400)");

    // O dia 2 recebe um ajuste à mão (atividade só de hoje): ele passa a pedir confirmação.
    const escalaDia2 = (await db.select().from(scalesTable).where(eq(scalesTable.locationId, loc!.id))).find((e) => e.periodStart === d(2))!;
    await db.insert(scaleAllocationsTable).values({ scaleId: escalaDia2.id, manualDate: d(2), manualLabel: "Prova de figurino", startTime: "09:00", userId: membro.id, active: true } as any);
    const vis = await (await asAdmin(`/escalas/mes/descartaveis?locationId=${loc!.id}&year=${ano}&month=${mes}`)).json() as { dias: { date: string; ajustes: { total: number } }[] };
    assert(vis.dias.some((x) => x.date === d(2) && x.ajustes.total === 1), "a lista do que seria perdido mostra o ajuste à mão do dia 2");
    assert(!vis.dias.some((x) => x.date === d(1)), "dia publicado não entra na lista de descartáveis");

    const semConfirmar = await (await asAdmin("/escalas/mes/descartar", { method: "POST", body: JSON.stringify({ locationId: loc!.id, year: ano, month: mes, motivo: "refazer o mês" }) })).json() as { descartados: { date: string }[]; pulados: { date: string; motivo: string }[]; eventoId: string | null };
    assert(semConfirmar.pulados.some((p) => p.date === d(2)) && !semConfirmar.descartados.some((x) => x.date === d(2)), "dia com ajuste à mão fica de fora sem confirmação");
    const escalaDia2Depois = await db.select().from(scalesTable).where(eq(scalesTable.id, escalaDia2.id));
    assert(escalaDia2Depois[0]!.status === "DRAFT", "o dia com ajuste continua intacto");

    const comConfirmar = await (await asAdmin("/escalas/mes/descartar", { method: "POST", body: JSON.stringify({ locationId: loc!.id, year: ano, month: mes, motivo: "refazer o mês", incluirComAjustes: true }) })).json() as { descartados: { date: string; livros: number }[]; eventoId: string | null };
    assert(comConfirmar.descartados.some((x) => x.date === d(2) && x.livros === 1) && Boolean(comConfirmar.eventoId), "com a confirmação o dia 2 é descartado, e o Registro guarda o motivo");
    const arquivada = await db.select().from(scalesTable).where(eq(scalesTable.id, escalaDia2.id));
    const livroDia2 = await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.scaleId, escalaDia2.id));
    assert(arquivada[0]!.status === "ARCHIVED" && livroDia2.every((l) => l.status === "CANCELLED"), "descarte é lógico: Escala arquivada e Livro cancelado (nada apagado)");
    const dia1 = await db.select().from(scalesTable).where(eq(scalesTable.id, escalaDia1.id));
    assert(dia1[0]!.status === "PUBLISHED", "o dia publicado nunca é tocado pelo descarte");
    const evt = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.id, comConfirmar.eventoId!)))[0]!;
    assert((evt.metadata as { motivo?: string } | null)?.motivo === "refazer o mês", "o motivo escrito vai para o Registro");

    // Desfazer.
    const rest = await (await asAdmin("/escalas/mes/restaurar", { method: "POST", body: JSON.stringify({ eventoId: comConfirmar.eventoId }) })).json() as { restauradas: number; livros: number };
    assert(rest.restauradas === 1 && rest.livros === 1, "desfazer devolve a Escala e o Livro do dia 2");
    const voltou = await db.select().from(scalesTable).where(eq(scalesTable.id, escalaDia2.id));
    const livroVoltou = await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.scaleId, escalaDia2.id));
    assert(voltou[0]!.status === "DRAFT" && livroVoltou.every((l) => l.status === "DRAFT"), "depois de desfazer, tudo volta a rascunho");
    const ajusteSobrevive = await db.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, escalaDia2.id));
    assert(ajusteSobrevive.length === 1, "o ajuste à mão não se perde no descarte nem na volta");
    // Local desligado de toda operação (Gestão → Operações): o resumo avisa uma vez e gerar é recusado com a frase.
    await db.update(operationLocationsTable).set({ active: false }).where(eq(operationLocationsTable.locationId, loc!.id));
    const semOp = await (await asAdmin(`/escalas/mes/resumo?locationId=${loc!.id}&year=${ano}&month=${mes}`)).json() as { semOperacao: boolean; totais: { aGerar: number } };
    assert(semOp.semOperacao === true && semOp.totais.aGerar === 0, "local sem operação: o resumo diz isso e não promete dias a gerar");
    const gerarSemOp = await asAdmin("/escalas/mes/gerar", { method: "POST", body: JSON.stringify({ locationId: loc!.id, year: ano, month: mes }) });
    const gerarSemOpCorpo = await gerarSemOp.json() as { error?: string; message?: string };
    assert(gerarSemOp.status === 409 && gerarSemOpCorpo.error === "LOCAL_SEM_OPERACAO" && /Gestão → Operações/.test(gerarSemOpCorpo.message ?? ""), "gerar o mês de local sem operação é recusado com uma frase só (409), em vez de falhar dia a dia");
    await db.update(operationLocationsTable).set({ active: true }).where(eq(operationLocationsTable.locationId, loc!.id));
    const rest2 = await (await asAdmin("/escalas/mes/restaurar", { method: "POST", body: JSON.stringify({ eventoId: comConfirmar.eventoId }) })).json() as { restauradas: number };
    assert(rest2.restauradas === 0, "desfazer duas vezes não faz nada na segunda");
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
    const ids = [showBom, showRuim];
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(inArray(dailyBooksTable.showBookId, ids));
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    await db.delete(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, ids));
    await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, prog!.id));
    await db.delete(programacoesTable).where(eq(programacoesTable.id, prog!.id));
    await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, ids));
    await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, ids));
    await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, ids));
    await db.delete(showBooksTable).where(inArray(showBooksTable.id, ids));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [loc!.id, outroLocal!.id]));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    const atores = [admin.id, membro.id];
    const mos = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, atores));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, atores), inArray(historyEventsTable.moId, mos.map((m) => m.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, atores));
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [atores]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [atores]).catch(() => undefined);
    await db.delete(usersTable).where(inArray(usersTable.id, atores));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em gerar o mês`);
  process.stdout.write(`escala-mes: ${passed} asserts passed\n`);
}

process.stdout.write("escala-mes: starting\n");
try { await run(); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
