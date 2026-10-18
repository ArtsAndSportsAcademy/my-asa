/**
 * Medição e prova de equivalência de "Gerar o mês" — NÃO faz parte da suíte (é uma ferramenta).
 *
 * Monta uma casa de teste fixa (nomes determinísticos), gera N dias do mês que vem com `gerarMes`, conta as idas
 * ao banco por etapa e grava uma "assinatura" do que foi gerado (quem está em qual vaga, em cada Livro). Rodando
 * antes e depois de uma mudança e comparando as assinaturas, prova que o resultado é idêntico.
 *
 *   MYASA_MEDIDA_DIAS=7            quantos dias gerar (padrão 7)
 *   MYASA_MEDIDA_SAIDA=arq.json    onde gravar a assinatura e os números
 *   MYASA_MEDIDA_COMPARAR=arq.json assinatura anterior, para comparar
 *
 * Só roda contra o banco de teste (o executor de testes já recusa qualquer outro).
 */
import { writeFileSync, readFileSync } from "node:fs";
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  db, pool, organizationsTable, operationsTable, operationLocationsTable, usersTable, locationsTable, programacoesTable, programacaoBlocosTable,
  showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable, showBookLinesTable, sessionsTable, scalesTable, scaleAllocationsTable,
  agendaEventsTable, dailyBooksTable, dailyBookScenesTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookAssignmentsTable, userRolesTable,
  historyEventsTable, operationalChangesTable,
} from "@workspace/db";
import { eq, inArray, or, and } from "drizzle-orm";
import { gerarMes } from "../src/services/escala-mes.js";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { existsSync } from "node:fs";
import { operationalDate } from "../src/lib/operational-date.js";

// ─── Instrumentação: conta e cronometra cada ida ao banco, com a etapa de quem pediu ───
const ETAPAS = [
  "resumoDoMes", "findEscalaDoDia", "operationForLocation", "programacaoDoDia", "eligibleSessions", "gerarDiaDoLocal",
  "generateDailyBookDraftForScale", "resolveAssignmentsByRole", "resolveShowBookCast", "buildShowBookTree", "workloadBalance", "carregarRegrasDoDia",
  "horariosDosLivros", "getUnavailableUserIds", "syncSessionBlocks", "createAssignmentsForRole", "buildDailyBookTree", "detectDailyBookConflicts",
  "writeHistoryEvent", "gerarMes",
];
Error.stackTraceLimit = 200;
const stats = new Map<string, { n: number; ms: number }>();
let totalN = 0;
let ligado = false;
const als = new AsyncLocalStorage<{ viaPool: boolean }>();
const etapaDoStack = (args: unknown[] = []) => {
  const q = args[0] as unknown;
  const texto = String(typeof q === "string" ? q : (q as { text?: string } | undefined)?.text ?? "").replace(/\s+/g, " ").trim();
  const verbo = /^(begin|commit|rollback)/i.exec(texto)?.[1]?.toUpperCase();
  if (verbo) return verbo;
  const m = /^(insert into|update|delete from)\s+"?(\w+)"?/i.exec(texto);
  if (m) return m[1]!.split(" ")[0]!.toUpperCase() + " " + m[2];
  return "SELECT " + (/from "?(\w+)"?/i.exec(texto)?.[1] ?? texto.slice(0, 40));
};
const medir = (etapa: string, executa: () => any) => {
  const t0 = performance.now();
  const r = executa();
  const fim = () => { const s = stats.get(etapa) ?? { n: 0, ms: 0 }; s.n += 1; s.ms += performance.now() - t0; stats.set(etapa, s); totalN += 1; };
  if (r && typeof r.then === 'function') return r.then((v: unknown) => { fim(); return v; }, (e: unknown) => { fim(); throw e; });
  fim(); return r;
};
const originalPool = (pg.Pool.prototype as any).query;
(pg.Pool.prototype as any).query = function (...args: unknown[]) {
  if (!ligado) return originalPool.apply(this, args);
  return medir(etapaDoStack(args), () => als.run({ viaPool: true }, () => originalPool.apply(this, args)));
};
const originalClient = (pg.Client.prototype as any).query;
(pg.Client.prototype as any).query = function (...args: unknown[]) {
  if (!ligado || als.getStore()?.viaPool) return originalClient.apply(this, args);
  return medir(etapaDoStack(args), () => originalClient.apply(this, args));
};

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

async function run() {
  const dias = Number(process.env.MYASA_MEDIDA_DIAS ?? 7);
  const tag = `medida_${Date.now()}`;
  const [hy, hm] = operationalDate().split("-").map(Number) as [number, number];
  const ano = hm === 12 ? hy + 1 : hy, mes = hm === 12 ? 1 : hm + 1;
  const d = (n: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(n).padStart(2, "0")}`;

  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const nomes = Array.from({ length: 24 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
  const pessoas = await db.insert(usersTable).values(nomes.map((n) => ({ organizationId: org!.id, name: n, username: `${tag}_${n}` }))).returning();
  const admin = (await db.insert(usersTable).values({ organizationId: org!.id, name: "Adm", username: `${tag}_adm` }).returning())[0]!;
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: op!.id, role: "ADMIN", active: true },
    ...pessoas.map((p) => ({ userId: p.id, operationId: op!.id, role: "MEMBER" as const, active: true })),
  ]);
  const idDe = (n: string) => pessoas.find((p) => p.name === n)!.id;
  const [loc] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local`, operatingDays: [0, 1, 2, 3, 4, 5, 6] }).returning();
  await db.insert(operationLocationsTable).values({ operationId: op!.id, locationId: loc!.id });

  // Um show grande (3 cenas × 2 blocos × 5 papéis) com duas sessões comuns, e um menor (2 cenas × 2 blocos × 3 papéis).
  const novoShow = async (titulo: string, cenas: number, papeisPorBloco: number, desloc: number) => {
    const [sb] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId: loc!.id, title: titulo, createdBy: admin.id }).returning();
    let k = 0;
    for (let c = 0; c < cenas; c++) {
      const [sc] = await db.insert(showBookScenesTable).values({ showBookId: sb!.id, name: `Cena ${c + 1}`, order: c }).returning();
      for (let b = 0; b < 2; b++) {
        const [bl] = await db.insert(showBookBlocksTable).values({ showBookId: sb!.id, sceneId: sc!.id, name: `Bloco ${c + 1}.${b + 1}`, order: b, startTime: "10:00", endTime: "10:30" }).returning();
        for (let r = 0; r < papeisPorBloco; r++) {
          const [papel] = await db.insert(showBookRolesTable).values({ showBookId: sb!.id, blockId: bl!.id, name: `Papel ${k + 1}`, order: k }).returning();
          const base = (desloc + k * 3) % 24;
          const tipo = k % 4;
          if (tipo === 0) await db.insert(showBookLinesTable).values({ positionId: papel!.id, type: "ROTATION", order: 0, config: { memberIds: [0, 1, 2, 3, 4].map((i) => pessoas[(base + i) % 24]!.id) } });
          else if (tipo === 1) await db.insert(showBookLinesTable).values({ positionId: papel!.id, type: "TITULAR_SUBSTITUTE", order: 0, config: { titularId: pessoas[base]!.id, substituteIds: [pessoas[(base + 1) % 24]!.id, pessoas[(base + 2) % 24]!.id] } });
          else if (tipo === 2) await db.insert(showBookLinesTable).values({ positionId: papel!.id, type: "FIXED_PERSON", order: 0, config: { userId: pessoas[base]!.id } });
          // tipo 3: papel sem linha (caminho legado), fica OPEN
          k++;
        }
      }
    }
    return sb!.id;
  };
  const showA = await novoShow(`${tag}_A`, 3, 5, 0);
  const showB = await novoShow(`${tag}_B`, 2, 3, 7);
  await db.insert(sessionsTable).values([
    { showId: showA, startTime: "10:00", endTime: "10:40" },
    { showId: showA, startTime: "15:00", endTime: "15:40" },
  ]);
  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: loc!.id, nome: `${tag}_prog`, vigenciaInicio: d(1), vigenciaFim: d(dias), createdBy: admin.id }).returning();
  for (let w = 0; w < 7; w++) {
    await db.insert(programacaoBlocosTable).values([
      { programacaoId: prog!.id, weekday: w, inicio: "10:00", rotulo: "SHOW A", regra: "livro", showBookId: showA, order: 0 },
      { programacaoId: prog!.id, weekday: w, inicio: "14:00", rotulo: "SHOW B", regra: "livro", showBookId: showB, order: 1 },
    ]);
  }
  void idDe;
  const ator = { sub: admin.id, role: "ADMIN", organizationId: org!.id };

  let assinatura: unknown = null;
  let tempoMs = 0;
  let resultado: Awaited<ReturnType<typeof gerarMes>> = null;
  try {
    // Modo "servir": deixa a casa de teste de pé, com a API na porta 3001 e um token de Administração gravado no arquivo,
    // para conferir a tela de verdade. Termina quando o arquivo MYASA_MEDIDA_SERVIR_PARAR aparece.
    if (process.env.MYASA_MEDIDA_SERVIR) {
      if (process.env.MYASA_MEDIDA_SEM_OPERACAO) await db.update(operationLocationsTable).set({ active: false }).where(eq(operationLocationsTable.locationId, loc!.id));
      const server = app.listen(3001);
      await new Promise<void>((r) => server.once("listening", r));
      const token = signAccessToken({ sub: admin.id, jti: `${tag}_ui`, organizationId: org!.id, role: "ADMIN", operationIds: [op!.id] });
      writeFileSync(process.env.MYASA_MEDIDA_SERVIR, JSON.stringify({ token, locationId: loc!.id, year: ano, month: mes }));
      while (!existsSync(process.env.MYASA_MEDIDA_SERVIR_PARAR!)) await new Promise((r) => setTimeout(r, 1000));
      server.closeAllConnections?.();
      await new Promise<void>((r) => server.close(() => r()));
      return;
    }
    stats.clear(); totalN = 0; ligado = true;
    const t0 = performance.now();
    resultado = await gerarMes(ator, loc!.id, ano, mes, { orcamentoMs: 3_600_000 });
    tempoMs = performance.now() - t0;
    ligado = false;

    // Assinatura: por dia, a Escala e cada Livro com cenas, blocos, posições e quem está em cada vaga (por nome).
    const nomeDe = new Map(pessoas.map((p) => [p.id, p.name]));
    const escalas = await db.select().from(scalesTable).where(eq(scalesTable.locationId, loc!.id));
    const eventos = await db.select().from(agendaEventsTable).where(inArray(agendaEventsTable.showBookId, [showA, showB]));
    const livros = await db.select().from(dailyBooksTable).where(inArray(dailyBooksTable.showBookId, [showA, showB]));
    // O retrato (snapshot) do Livro, sem ids nem horas de gravação: a árvore de nomes e o formato das linhas.
    type No = Record<string, unknown>;
    const chaves = (o: No | undefined) => Object.keys(o ?? {}).sort().join(",");
    const retrato = (snap: unknown) => {
      const cenas = ((snap as { scenes?: No[] } | null)?.scenes ?? []);
      const primeiraVaga = ((((cenas[0]?.blocks as No[] | undefined)?.[0]?.positions as No[] | undefined)?.[0]?.assignments as No[] | undefined)?.[0]);
      const primeiraPosicao = (((cenas[0]?.blocks as No[] | undefined)?.[0]?.positions as No[] | undefined)?.[0]);
      return {
        formato: { cena: chaves(cenas[0]), bloco: chaves((cenas[0]?.blocks as No[] | undefined)?.[0]), posicao: chaves(primeiraPosicao), vaga: chaves(primeiraVaga) },
        arvore: cenas.map((c) => ({ n: c.name, o: c.order, blocos: (c.blocks as No[]).map((b) => ({ n: b.name, o: b.order, i: b.startTime, f: b.endTime, posicoes: (b.positions as No[]).map((p) => ({ n: p.name, m: p.minimumCoverage, vagas: (p.assignments as No[]).map((a) => String(a.userName) + ":" + String(a.status) + ":" + String(a.manual)) })) })) })),
      };
    };
    const porDia: Record<string, unknown> = {};
    for (const e of escalas.sort((a, b) => a.periodStart.localeCompare(b.periodStart))) {
      const doDia = [];
      for (const l of livros.filter((x) => x.scaleId === e.id)) {
        const ev = eventos.find((x) => x.id === l.agendaEventId)!;
        const cenas = await db.select().from(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, l.id));
        const blocos = await db.select().from(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, l.id));
        const posicoes = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, l.id));
        const vagas = await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, l.id));
        const blocoNome = new Map(blocos.map((b) => [b.id, b.name]));
        const cenaNome = new Map(cenas.map((c) => [c.id, c.name]));
        const posNome = new Map(posicoes.map((p) => [p.id, p.name]));
        const snap = l.snapshotJson as { rotationWinners?: Record<string, string> } | null;
        doDia.push({
          show: l.showBookId === showA ? "A" : "B", status: l.status, versao: l.version, evento: { titulo: ev.title.split(tag).join("T"), inicio: ev.startTime, fim: ev.endTime, tipo: ev.type, visibilidade: ev.visibility },
          cenas: cenas.map((c) => `${c.order}:${c.name}`).sort(),
          blocos: blocos.map((b) => `${b.order}:${b.name}:${b.startTime}:${b.endTime}:${b.sceneId ? cenaNome.get(b.sceneId) : "-"}`).sort(),
          posicoes: posicoes.map((p) => `${p.name}:${p.minimumCoverage}:${p.blockId ? blocoNome.get(p.blockId) : "-"}`).sort(),
          vagas: vagas.map((v) => `${posNome.get(v.positionId)}:${v.userId ? nomeDe.get(v.userId) : "-"}:${v.status}:${v.manual}:${v.sceneId ? cenaNome.get(v.sceneId) : "-"}`).sort(),
          vencedoresDoRodizio: Object.keys(snap?.rotationWinners ?? {}).length,
          retrato: retrato(snap),
          nomesNoRodizio: Object.values(snap?.rotationWinners ?? {}).map((u) => nomeDe.get(u)).sort(),
        });
      }
      doDia.sort((a, b) => a.show.localeCompare(b.show));
      porDia[e.periodStart] = { status: e.status, titulo: e.title.split(tag).join("T"), livros: doDia };
    }
    const registro = await db.select({ action: historyEventsTable.action, entityType: historyEventsTable.entityType }).from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    const contagem: Record<string, number> = {};
    for (const r of registro) contagem[`${r.entityType}/${r.action}`] = (contagem[`${r.entityType}/${r.action}`] ?? 0) + 1;
    const contagemOrdenada = Object.fromEntries(Object.entries(contagem).sort(([a], [b]) => a.localeCompare(b)));
    assinatura = { porDia, registro: contagemOrdenada, gerados: resultado?.gerados.map((g) => `${g.date}:${g.livros}`), falhas: resultado?.falhas };
  } finally {
    ligado = false;
    const ids = [showA, showB];
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
    const papeis = await db.select({ id: showBookRolesTable.id }).from(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, ids));
    if (papeis.length) await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, papeis.map((p) => p.id)));
    await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.showBookId, ids));
    await db.delete(showBookBlocksTable).where(inArray(showBookBlocksTable.showBookId, ids));
    await db.delete(showBookScenesTable).where(inArray(showBookScenesTable.showBookId, ids));
    await db.delete(sessionsTable).where(inArray(sessionsTable.showId, ids));
    await db.delete(showBooksTable).where(inArray(showBooksTable.id, ids));
    await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, (await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, op!.id))).map((s) => s.id)));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, loc!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    const atores = [admin.id, ...pessoas.map((p) => p.id)];
    const mos = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, atores));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, atores), inArray(historyEventsTable.moId, mos.map((m) => m.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, atores));
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [atores]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [atores]).catch(() => undefined);
    await db.delete(usersTable).where(inArray(usersTable.id, atores));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    void and;
  }

  const nLivros = (resultado?.gerados ?? []).reduce((s, g) => s + g.livros, 0);
  const porEtapa = [...stats.entries()].sort((a, b) => b[1].ms - a[1].ms).map(([etapa, s]) => ({ etapa, consultas: s.n, segundos: Number((s.ms / 1000).toFixed(2)) }));
  const numeros = { dias: resultado?.gerados.length ?? 0, livros: nLivros, consultasNoTotal: totalN, consultasPorDia: Number((totalN / Math.max(1, resultado?.gerados.length ?? 1)).toFixed(1)), consultasPorLivro: Number((totalN / Math.max(1, nLivros)).toFixed(1)), segundosNoTotal: Number((tempoMs / 1000).toFixed(1)), segundosPorDia: Number((tempoMs / 1000 / Math.max(1, resultado?.gerados.length ?? 1)).toFixed(1)), porEtapa };
  console.log(JSON.stringify(numeros, null, 2));

  const comparar = process.env.MYASA_MEDIDA_COMPARAR;
  if (comparar) {
    const antes = JSON.parse(readFileSync(comparar, "utf8")) as { assinatura: unknown };
    const igual = JSON.stringify(antes.assinatura) === JSON.stringify(assinatura);
    console.log(igual ? "ASSINATURA IDÊNTICA à anterior." : "ASSINATURA DIFERENTE da anterior!");
    if (!igual) {
      const a = antes.assinatura as { porDia: Record<string, unknown> }, b = assinatura as { porDia: Record<string, unknown> };
      for (const dia of Object.keys({ ...a.porDia, ...b.porDia })) if (JSON.stringify(a.porDia[dia]) !== JSON.stringify(b.porDia[dia])) console.log("  difere em", dia);
      if (JSON.stringify((antes.assinatura as any).registro) !== JSON.stringify((assinatura as any).registro)) console.log("  Registro difere:", JSON.stringify((antes.assinatura as any).registro), "→", JSON.stringify((assinatura as any).registro));
      process.exitCode = 1;
    }
  }
  const saida = process.env.MYASA_MEDIDA_SAIDA;
  if (saida) writeFileSync(saida, JSON.stringify({ numeros, assinatura }, null, 1));
}

try { await run(); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
