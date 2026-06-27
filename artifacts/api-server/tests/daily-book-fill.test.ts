/**
 * Testes de chamada direta para o preenchimento automático do Livro do Dia.
 *
 * Cobre os casos de borda do resolvedor por data (`line-resolver.ts`) e da decisão
 * de assignments por papel (`planRoleAssignments` em `daily-book.ts`):
 *   (a) linha DAY_OF_WEEK num dia em que o papel NÃO atua não vira buraco;
 *   (b) papéis SEM linhas caem no fallback da escala (alocação manual / OPEN);
 *   (c) o vencedor capturado na geração é estável mesmo que a disponibilidade mude
 *       antes da publicação ("gerar → publicar" não re-resolve o preenchimento);
 *   (d) o rodízio escolhe o de MENOR contador entre os disponíveis;
 *   (e) PESSOA FIXA (FIXED_PERSON): disponível → COBERTO; indisponível e sem
 *       substituto → buraco (OPEN);
 *   (f) TITULAR/SUBSTITUTO (TITULAR_SUBSTITUTE): titular disponível → titular;
 *       titular de folga → primeiro substituto disponível; todos indisponíveis → buraco.
 *
 * Segue o padrão de testes por chamada direta do api-server (sem framework): semeia
 * o banco de dev, chama as funções reais, faz asserts e limpa tudo no final.
 * Rode com: `pnpm --filter @workspace/api-server test`.
 */
import http from "node:http";
import {
  db,
  pool,
  organizationsTable,
  operationsTable,
  usersTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  folgasTable,
  agendaEventsTable,
  dailyBooksTable,
  dailyBookScenesTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  resolveAssignmentsByRole,
  collectRotationWinners,
} from "../src/services/line-resolver.js";
import { planRoleAssignments } from "../src/routes/daily-book.js";
import app from "../src/app.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

// ─── Mini harness ──────────────────────────────────────────────────────────────
let passed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
  } else {
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}
function eqAssert<T>(actual: T, expected: T, msg: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${msg} (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`,
  );
}

// ─── Helpers de data ────────────────────────────────────────────────────────────
function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}
function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TAG = `dbfilltest_${Date.now()}`;

async function run() {
  // ─── Seed base ────────────────────────────────────────────────────────────────
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: `${TAG}_org` })
    .returning();
  const orgId = org!.id;

  const [op] = await db
    .insert(operationsTable)
    .values({ organizationId: orgId, name: `${TAG}_op` })
    .returning();
  const operationId = op!.id;

  async function mkUser(label: string): Promise<string> {
    const [u] = await db
      .insert(usersTable)
      .values({ organizationId: orgId, name: `${TAG}_${label}` })
      .returning();
    return u!.id;
  }

  const uDow = await mkUser("dow");
  const uManual = await mkUser("manual");
  const uRotA = await mkUser("rotA");
  const uRotB = await mkUser("rotB");
  const u2A = await mkUser("r2A");
  const u2B = await mkUser("r2B");
  const u2C = await mkUser("r2C");
  const uFixed = await mkUser("fixed");
  const uTit = await mkUser("titular");
  const uSub1 = await mkUser("sub1");
  const uSub2 = await mkUser("sub2");

  const [showBook] = await db
    .insert(showBooksTable)
    .values({ operationId, title: `${TAG}_sb`, createdBy: uDow })
    .returning();
  const showBookId = showBook!.id;

  const [scene] = await db
    .insert(showBookScenesTable)
    .values({ showBookId, name: "Cena 1", order: 0 })
    .returning();
  const [block] = await db
    .insert(showBookBlocksTable)
    .values({ showBookId, sceneId: scene!.id, name: "Bloco 1", order: 0 })
    .returning();
  const blockId = block!.id;

  async function mkRole(name: string, order: number): Promise<string> {
    const [r] = await db
      .insert(showBookRolesTable)
      .values({ showBookId, blockId, name, order })
      .returning();
    return r!.id;
  }
  async function mkLine(positionId: string, type: string, config: unknown): Promise<string> {
    const [l] = await db
      .insert(showBookLinesTable)
      .values({ positionId, type: type as any, config: config as any, order: 0 })
      .returning();
    return l!.id;
  }

  // Data base e seu dia da semana.
  const baseDate = "2026-06-22"; // segunda-feira (UTC)
  const baseWd = weekdayOf(baseDate);
  const otherWd = (baseWd + 3) % 7;
  const activeDate = addDays(baseDate, 3); // mesmo weekday que otherWd

  // Papel (a): DAY_OF_WEEK — só atua em otherWd, com uDow.
  const roleDow = await mkRole("PapelDiaSemana", 0);
  await mkLine(roleDow, "DAY_OF_WEEK", { dayAssignments: { [String(otherWd)]: uDow } });

  // Papel (b): sem linhas.
  const roleNoLines = await mkRole("PapelSemLinhas", 1);

  // Papel (c): ROTATION com [uRotA, uRotB], contadores iguais (0).
  const roleRotC = await mkRole("PapelRodizioC", 2);
  const lineRotC = await mkLine(roleRotC, "ROTATION", { memberIds: [uRotA, uRotB] });

  // Papel (d): ROTATION com [u2A, u2B, u2C], contadores A:2 B:0 C:1.
  const roleRotD = await mkRole("PapelRodizioD", 3);
  await mkLine(roleRotD, "ROTATION", {
    memberIds: [u2A, u2B, u2C],
    executionCounts: { [u2A]: 2, [u2B]: 0, [u2C]: 1 },
  });

  // Papel (e): FIXED_PERSON com uFixed (sem substituto).
  const roleFixed = await mkRole("PapelPessoaFixa", 4);
  await mkLine(roleFixed, "FIXED_PERSON", { userId: uFixed });

  // Papel (f): TITULAR_SUBSTITUTE com titular uTit e substitutos [uSub1, uSub2].
  const roleTitSub = await mkRole("PapelTitularSubstituto", 5);
  await mkLine(roleTitSub, "TITULAR_SUBSTITUTE", {
    titularId: uTit,
    substituteIds: [uSub1, uSub2],
  });

  const createdFolgaIds: string[] = [];
  async function addFolga(userId: string, dateISO: string) {
    const [f] = await db
      .insert(folgasTable)
      .values({
        userId,
        operationId,
        type: "DAY_OFF",
        startDate: dateISO,
        endDate: dateISO,
        status: "ACTIVE",
        createdBy: userId,
      })
      .returning();
    createdFolgaIds.push(f!.id);
  }
  async function clearFolgas() {
    for (const id of createdFolgaIds.splice(0)) {
      await db.delete(folgasTable).where(eq(folgasTable.id, id));
    }
  }

  try {
    // ─── (a) DAY_OF_WEEK num dia que NÃO atua não vira buraco ─────────────────────
    console.log("(a) DAY_OF_WEEK fora do dia → INATIVO, sem buraco");
    {
      const { byRole } = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr = byRole.get(roleDow);
      assert(!!rr, "(a) papel deve estar na resolução");
      eqAssert(rr!.hasLines, true, "(a) hasLines");
      eqAssert(rr!.hasActiveLine, false, "(a) hasActiveLine (não atua hoje)");
      eqAssert(rr!.hasUncoveredLine, false, "(a) hasUncoveredLine");
      eqAssert(rr!.people.length, 0, "(a) sem pessoas");
      // Sem alocação manual → nenhum assignment (não vira buraco).
      eqAssert(planRoleAssignments(rr, roleDow, {}), [], "(a) sem buraco sem alocação");
      // Com alocação manual da escala → honra a alocação.
      eqAssert(
        planRoleAssignments(rr, roleDow, { [roleDow]: uManual }),
        [{ userId: uManual, status: "ASSIGNED" }],
        "(a) honra alocação manual no dia inativo",
      );
    }

    // Sanidade: no dia em que ATUA, o papel fica COBERTO com a pessoa do dia.
    {
      const { byRole } = await resolveAssignmentsByRole(showBookId, operationId, activeDate);
      const rr = byRole.get(roleDow);
      eqAssert(rr!.hasActiveLine, true, "(a) atua no dia certo");
      eqAssert(rr!.people.map((p) => p.userId), [uDow], "(a) pessoa do dia coberta");
      eqAssert(
        planRoleAssignments(rr, roleDow, {}),
        [{ userId: uDow, status: "ASSIGNED" }],
        "(a) assignment da pessoa do dia",
      );
    }

    // ─── (b) Papel SEM linhas cai no fallback da escala ───────────────────────────
    console.log("(b) papel sem linhas → fallback da escala");
    {
      const { byRole } = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr = byRole.get(roleNoLines);
      assert(!!rr, "(b) papel sem linhas deve estar na resolução");
      eqAssert(rr!.hasLines, false, "(b) hasLines false");
      // Com alocação manual → ASSIGNED dela.
      eqAssert(
        planRoleAssignments(rr, roleNoLines, { [roleNoLines]: uManual }),
        [{ userId: uManual, status: "ASSIGNED" }],
        "(b) fallback usa alocação da escala",
      );
      // Sem alocação → buraco OPEN (papel legado sem escala).
      eqAssert(
        planRoleAssignments(rr, roleNoLines, {}),
        [{ userId: null, status: "OPEN" }],
        "(b) sem escala → OPEN",
      );
    }

    // ─── (c) Vencedor da geração é estável apesar de mudança de disponibilidade ────
    console.log("(c) gerar → publicar com mudança de disponibilidade no meio");
    {
      // Geração: ambos disponíveis, contadores iguais → escolhe o primeiro (uRotA).
      const gen = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const winners = collectRotationWinners(gen.result);
      eqAssert(winners[lineRotC], uRotA, "(c) vencedor capturado na geração = uRotA");
      const rrGen = gen.byRole.get(roleRotC);
      eqAssert(rrGen!.people.map((p) => p.userId), [uRotA], "(c) preenchido com uRotA");

      // Disponibilidade muda DEPOIS da geração: uRotA entra de folga na data.
      await addFolga(uRotA, baseDate);

      // Uma RE-resolução agora escolheria uRotB (prova de que a mudança importa)...
      const reresolve = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      eqAssert(
        reresolve.byRole.get(roleRotC)!.people.map((p) => p.userId),
        [uRotB],
        "(c) re-resolução após folga escolheria uRotB",
      );
      // ...mas o vencedor PERSISTIDO na geração continua uRotA (preenchimento estável).
      eqAssert(winners[lineRotC], uRotA, "(c) vencedor da geração permanece uRotA");
      await clearFolgas();
    }

    // ─── (d) Rodízio escolhe o de MENOR contador entre os disponíveis ─────────────
    console.log("(d) rodízio escolhe o de menor contador entre disponíveis");
    {
      // Contadores A:2 B:0 C:1, todos disponíveis → escolhe B (menor).
      const r1 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      eqAssert(
        r1.byRole.get(roleRotD)!.people.map((p) => p.userId),
        [u2B],
        "(d) escolhe o de menor contador (u2B)",
      );

      // u2B fica indisponível → escolhe o próximo menor disponível (u2C, contador 1).
      await addFolga(u2B, baseDate);
      const r2 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      eqAssert(
        r2.byRole.get(roleRotD)!.people.map((p) => p.userId),
        [u2C],
        "(d) pula indisponível e escolhe próximo menor (u2C)",
      );
      await clearFolgas();
    }

    // ─── (e) FIXED_PERSON: pessoa disponível → COBERTO; indisponível → buraco ──────
    console.log("(e) pessoa fixa disponível → coberta; indisponível → buraco");
    {
      // Pessoa disponível → COBERTO com ela.
      const r1 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr1 = r1.byRole.get(roleFixed);
      assert(!!rr1, "(e) papel pessoa fixa deve estar na resolução");
      eqAssert(rr1!.hasLines, true, "(e) hasLines");
      eqAssert(rr1!.hasActiveLine, true, "(e) hasActiveLine (atua hoje)");
      eqAssert(rr1!.hasUncoveredLine, false, "(e) sem buraco com pessoa disponível");
      eqAssert(rr1!.people.map((p) => p.userId), [uFixed], "(e) pessoa fixa coberta");
      eqAssert(
        planRoleAssignments(rr1, roleFixed, {}),
        [{ userId: uFixed, status: "ASSIGNED" }],
        "(e) assignment da pessoa fixa",
      );

      // Pessoa fixa indisponível e sem substituto → buraco (UNCOVERED → OPEN).
      await addFolga(uFixed, baseDate);
      const r2 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr2 = r2.byRole.get(roleFixed);
      eqAssert(rr2!.hasActiveLine, true, "(e) ainda ativa hoje mesmo indisponível");
      eqAssert(rr2!.hasUncoveredLine, true, "(e) buraco real (pessoa indisponível)");
      eqAssert(rr2!.people.length, 0, "(e) sem pessoas quando indisponível");
      eqAssert(
        planRoleAssignments(rr2, roleFixed, {}),
        [{ userId: null, status: "OPEN" }],
        "(e) indisponível sem substituto → OPEN",
      );
      await clearFolgas();
    }

    // ─── (f) TITULAR_SUBSTITUTE: cai para o substituto quando o titular falta ──────
    console.log("(f) titular/substituto → titular; folga do titular cai no substituto");
    {
      // Titular disponível → escolhe o titular.
      const r1 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr1 = r1.byRole.get(roleTitSub);
      assert(!!rr1, "(f) papel titular/substituto deve estar na resolução");
      eqAssert(rr1!.hasLines, true, "(f) hasLines");
      eqAssert(rr1!.hasUncoveredLine, false, "(f) sem buraco com titular disponível");
      eqAssert(rr1!.people.map((p) => p.userId), [uTit], "(f) escolhe o titular");
      eqAssert(
        planRoleAssignments(rr1, roleTitSub, {}),
        [{ userId: uTit, status: "ASSIGNED" }],
        "(f) assignment do titular",
      );

      // Titular de folga → cai no primeiro substituto disponível (uSub1).
      await addFolga(uTit, baseDate);
      const r2 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr2 = r2.byRole.get(roleTitSub);
      eqAssert(rr2!.hasUncoveredLine, false, "(f) sem buraco: há substituto");
      eqAssert(rr2!.people.map((p) => p.userId), [uSub1], "(f) cai no primeiro substituto");
      eqAssert(
        planRoleAssignments(rr2, roleTitSub, {}),
        [{ userId: uSub1, status: "ASSIGNED" }],
        "(f) assignment do primeiro substituto",
      );

      // Titular e primeiro substituto de folga → cai no segundo substituto (uSub2).
      await addFolga(uSub1, baseDate);
      const r3 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr3 = r3.byRole.get(roleTitSub);
      eqAssert(rr3!.people.map((p) => p.userId), [uSub2], "(f) cai no segundo substituto");

      // Todos indisponíveis → buraco (UNCOVERED → OPEN).
      await addFolga(uSub2, baseDate);
      const r4 = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rr4 = r4.byRole.get(roleTitSub);
      eqAssert(rr4!.hasActiveLine, true, "(f) ativa hoje mesmo todos indisponíveis");
      eqAssert(rr4!.hasUncoveredLine, true, "(f) buraco real (todos indisponíveis)");
      eqAssert(rr4!.people.length, 0, "(f) sem pessoas quando todos indisponíveis");
      eqAssert(
        planRoleAssignments(rr4, roleTitSub, {}),
        [{ userId: null, status: "OPEN" }],
        "(f) titular e substitutos indisponíveis → OPEN",
      );
      await clearFolgas();
    }
  } finally {
    // ─── Cleanup (ordem respeita FKs) ──────────────────────────────────────────────
    await clearFolgas();
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, roleDow));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, roleRotC));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, roleRotD));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, roleFixed));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, roleTitSub));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showBookId));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showBookId));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, showBookId));
    for (const id of [uDow, uManual, uRotA, uRotB, u2A, u2B, u2C, uFixed, uTit, uSub1, uSub2]) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
    await db.delete(operationsTable).where(eq(operationsTable.id, operationId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
  }
}

// ─── (c) Integração HTTP: gerar → publicar pela ROTA real ──────────────────────
// Exercita o caminho real (handlers /daily-book/generate e /daily-book/:id/publish):
// a geração persiste snapshotJson.rotationWinners; entre gerar e publicar, a pessoa
// escolhida entra de folga; a publicação deve avançar o contador do vencedor
// PERSISTIDO na geração (e não re-resolver e avançar para outra pessoa).
function httpJson(
  port: number,
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json: any = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runIntegrationC() {
  console.log("(c) integração HTTP: gerar → folga → publicar avança o vencedor da geração");
  const TAG2 = `dbfillint_${Date.now()}`;
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const [org] = await db.insert(organizationsTable).values({ name: `${TAG2}_org` }).returning();
  const orgId = org!.id;
  const [op] = await db.insert(operationsTable).values({ organizationId: orgId, name: `${TAG2}_op` }).returning();
  const operationId = op!.id;
  const mk = async (label: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name: `${TAG2}_${label}` }).returning();
    return u!.id;
  };
  const admin = await mk("admin");
  const mRotA = await mk("A");
  const mRotB = await mk("B");

  const [showBook] = await db.insert(showBooksTable).values({ operationId, title: `${TAG2}_sb`, createdBy: admin }).returning();
  const showBookId = showBook!.id;
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId, name: "Cena", order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId, sceneId: scene!.id, name: "Bloco", order: 0 }).returning();
  const [role] = await db.insert(showBookRolesTable).values({ showBookId, blockId: block!.id, name: "Rodizio", order: 0 }).returning();
  const roleId = role!.id;
  // Contadores iguais (vazio) → vencedor = primeiro membro (mRotA).
  const [line] = await db.insert(showBookLinesTable).values({ positionId: roleId, type: "ROTATION" as any, config: { memberIds: [mRotA, mRotB] } as any, order: 0 }).returning();
  const lineId = line!.id;

  const eventDate = "2026-07-06";
  const [event] = await db.insert(agendaEventsTable).values({
    operationId, showBookId, type: "SHOW", title: `${TAG2}_show`, date: eventDate, createdBy: admin,
  }).returning();
  const agendaEventId = event!.id;

  const token = signAccessToken({ sub: admin, jti: "test", organizationId: orgId, role: "ADMIN", operationIds: [operationId] });

  let dailyBookId: string | null = null;
  try {
    // 1) GERAR pela rota real.
    const gen = await httpJson(port, "POST", "/api/daily-book/generate", token, { agendaEventId });
    eqAssert(gen.status, 201, "(c) generate retorna 201");
    dailyBookId = gen.json?.dailyBook?.id ?? null;
    assert(!!dailyBookId, "(c) generate devolve dailyBook.id");

    // 2) Vencedor PERSISTIDO no snapshot da geração = mRotA.
    const [persisted] = await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, dailyBookId!)).limit(1);
    const snap = (persisted!.snapshotJson as any) ?? {};
    eqAssert(snap?.rotationWinners?.[lineId], mRotA, "(c) snapshotJson.rotationWinners persiste mRotA");

    // 3) Disponibilidade muda ENTRE gerar e publicar: mRotA entra de folga.
    await db.insert(folgasTable).values({ userId: mRotA, operationId, type: "DAY_OFF", startDate: eventDate, endDate: eventDate, status: "ACTIVE", createdBy: admin });

    // 4) PUBLICAR pela rota real.
    const pub = await httpJson(port, "POST", `/api/daily-book/${dailyBookId}/publish`, token, {});
    eqAssert(pub.status, 200, "(c) publish retorna 200");
    eqAssert(pub.json?.dailyBook?.status, "PUBLISHED", "(c) publish marca PUBLISHED");

    // 5) O avanço do contador é best-effort (não-aguardado no handler) → poll curto.
    let counts: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      const [l] = await db.select().from(showBookLinesTable).where(eq(showBookLinesTable.id, lineId)).limit(1);
      counts = ((l!.config as any)?.executionCounts ?? {}) as Record<string, number>;
      if (counts[mRotA]) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // O contador avança para o vencedor da GERAÇÃO (mRotA), mesmo ele tendo entrado de folga,
    // e NÃO para mRotB (que uma re-resolução na publicação escolheria).
    eqAssert(counts[mRotA] ?? 0, 1, "(c) publish avança o contador do vencedor da geração (mRotA)");
    eqAssert(counts[mRotB] ?? 0, 0, "(c) publish NÃO avança o contador de mRotB");
  } finally {
    if (dailyBookId) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, dailyBookId));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, dailyBookId));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, dailyBookId));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, dailyBookId));
    }
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operationId));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, agendaEventId));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, roleId));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showBookId));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showBookId));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, showBookId));
    // history events (generate/publish) referenciam o ator → limpar antes dos usuários
    await pool.query(
      `delete from history_events where actor_id = any($1::uuid[]) or mo_id in (select id from operational_changes where actor_id = any($1::uuid[]))`,
      [[admin, mRotA, mRotB]],
    );
    await pool.query(`delete from operational_changes where actor_id = any($1::uuid[])`, [[admin, mRotA, mRotB]]);
    // notificações (sino in-app + push) geradas na publicação referenciam o usuário
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [[admin, mRotA, mRotB]]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [[admin, mRotA, mRotB]]);
    for (const id of [admin, mRotA, mRotB]) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
    await db.delete(operationsTable).where(eq(operationsTable.id, operationId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
    await new Promise<void>((r) => server.close(() => r()));
  }
}

// ─── (d) integração HTTP: escopo de LEITURA do Livro do Show ─────────────────────
// Garante que um não-admin não lê, via API direta, shows fora do seu escopo:
//  - supervisor A NÃO vê (nem resolve por data) o show de que B é responsável (403),
//    mas vê o seu; a listagem é filtrada no servidor (A só recebe o seu show);
//  - membro da operação vê os shows da operação (qualquer responsável);
//  - utilizador de OUTRA operação não vê o show (403, cross-operation).
async function runIntegrationD() {
  console.log("(d) integração HTTP: escopo de leitura do Livro do Show por operação/responsabilidade");
  const TAG = `sbview_${Date.now()}`;
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const [org] = await db.insert(organizationsTable).values({ name: `${TAG}_org` }).returning();
  const orgId = org!.id;
  const [op1] = await db.insert(operationsTable).values({ organizationId: orgId, name: `${TAG}_op1` }).returning();
  const [op2] = await db.insert(operationsTable).values({ organizationId: orgId, name: `${TAG}_op2` }).returning();
  const operationId = op1!.id;
  const operation2Id = op2!.id;
  const mk = async (label: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name: `${TAG}_${label}` }).returning();
    return u!.id;
  };
  const supA = await mk("supA");
  const supB = await mk("supB");
  const memC = await mk("memC");
  const memD = await mk("memD");

  const [sbA] = await db.insert(showBooksTable).values({ operationId, title: `${TAG}_showA`, createdBy: supA, responsibleId: supA }).returning();
  const [sbB] = await db.insert(showBooksTable).values({ operationId, title: `${TAG}_showB`, createdBy: supB, responsibleId: supB }).returning();
  const showAId = sbA!.id;
  const showBId = sbB!.id;

  const tokenSupA = signAccessToken({ sub: supA, jti: "t", organizationId: orgId, role: "SUPERVISOR_A", operationIds: [operationId] });
  const tokenMemC = signAccessToken({ sub: memC, jti: "t", organizationId: orgId, role: "MEMBER", operationIds: [operationId] });
  const tokenMemD = signAccessToken({ sub: memD, jti: "t", organizationId: orgId, role: "MEMBER", operationIds: [operation2Id] });

  // Admin de OUTRA organização (isolamento multi-tenant).
  const [org2] = await db.insert(organizationsTable).values({ name: `${TAG}_org2` }).returning();
  const org2Id = org2!.id;
  const [adminE0] = await db.insert(usersTable).values({ organizationId: org2Id, name: `${TAG}_adminE` }).returning();
  const adminE = adminE0!.id;
  const tokenAdminE = signAccessToken({ sub: adminE, jti: "t", organizationId: org2Id, role: "ADMIN", operationIds: [] });

  try {
    // Supervisor A vê o SEU show, mas não o show de que B é responsável.
    const aOwn = await httpJson(port, "GET", `/api/show-books/${showAId}`, tokenSupA);
    eqAssert(aOwn.status, 200, "(d) supervisor A vê o seu próprio show (200)");
    const aOther = await httpJson(port, "GET", `/api/show-books/${showBId}`, tokenSupA);
    eqAssert(aOther.status, 403, "(d) supervisor A NÃO vê o show de que B é responsável (403)");
    const aResolve = await httpJson(port, "GET", `/api/show-books/${showBId}/resolve?date=2026-07-06`, tokenSupA);
    eqAssert(aResolve.status, 403, "(d) supervisor A NÃO resolve por data o show de B (403)");

    // Listagem filtrada no servidor: A só recebe o seu show.
    const aList = await httpJson(port, "GET", `/api/show-books`, tokenSupA);
    eqAssert(aList.status, 200, "(d) listagem responde 200");
    const aIds = ((aList.json?.showBooks ?? []) as any[]).map((b) => b.id);
    assert(aIds.includes(showAId), "(d) listagem de A inclui o seu show");
    assert(!aIds.includes(showBId), "(d) listagem de A NÃO inclui o show de B");

    // Membro da operação vê os shows da operação (independente do responsável).
    const cOnA = await httpJson(port, "GET", `/api/show-books/${showAId}`, tokenMemC);
    eqAssert(cOnA.status, 200, "(d) membro da operação vê show A (200)");
    const cOnB = await httpJson(port, "GET", `/api/show-books/${showBId}`, tokenMemC);
    eqAssert(cOnB.status, 200, "(d) membro da operação vê show B (200)");

    // Utilizador de OUTRA operação não vê o show (cross-operation).
    const dOnA = await httpJson(port, "GET", `/api/show-books/${showAId}`, tokenMemD);
    eqAssert(dOnA.status, 403, "(d) utilizador de outra operação NÃO vê o show (403)");

    // Admin de OUTRA organização não vê nem lista o show (isolamento multi-tenant).
    const eOnA = await httpJson(port, "GET", `/api/show-books/${showAId}`, tokenAdminE);
    eqAssert(eOnA.status, 404, "(d) admin de outra org NÃO vê o show (404)");
    const eList = await httpJson(port, "GET", `/api/show-books`, tokenAdminE);
    const eIds = ((eList.json?.showBooks ?? []) as any[]).map((b) => b.id);
    assert(!eIds.includes(showAId) && !eIds.includes(showBId), "(d) listagem do admin de outra org NÃO inclui shows alheios");

    // Mutação de referências restrita ao RESPONSÁVEL do show (canManageShowBook),
    // não apenas ao papel: supervisor não-responsável da mesma operação é barrado.
    const tokenSupB = signAccessToken({ sub: supB, jti: "t", organizationId: orgId, role: "SUPERVISOR_A", operationIds: [operationId] });
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const bRefAdd = await httpJson(port, "POST", `/api/show-books/${showAId}/positions/${fakeId}/refs`, tokenSupB, { documentId: fakeId });
    eqAssert(bRefAdd.status, 403, "(d) supervisor não-responsável NÃO adiciona referência no show de outro (403)");
    const bRefDel = await httpJson(port, "DELETE", `/api/show-books/${showAId}/positions/${fakeId}/refs/${fakeId}`, tokenSupB);
    eqAssert(bRefDel.status, 403, "(d) supervisor não-responsável NÃO remove referência no show de outro (403)");
    // O responsável passa o guard de gestão (falha depois por posição inexistente: 404, não 403).
    const aRefAdd = await httpJson(port, "POST", `/api/show-books/${showAId}/positions/${fakeId}/refs`, tokenSupA, { documentId: fakeId });
    eqAssert(aRefAdd.status, 404, "(d) responsável passa o guard de gestão de referências (404 posição, não 403)");
  } finally {
    await db.delete(showBooksTable).where(eq(showBooksTable.id, showAId));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, showBId));
    for (const id of [supA, supB, memC, memD, adminE]) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
    await db.delete(operationsTable).where(eq(operationsTable.id, operationId));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation2Id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org2Id));
    await new Promise<void>((r) => server.close(() => r()));
  }
}

(async () => {
  try {
    await run();
    await runIntegrationC();
    await runIntegrationD();
  } catch (err) {
    console.error("Erro inesperado nos testes:", err);
    failures.push(`erro inesperado: ${(err as Error)?.message ?? err}`);
  } finally {
    try {
      await pool.end();
    } catch {}
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length > 0) {
    console.error("FALHAS:\n - " + failures.join("\n - "));
    process.exit(1);
  }
  console.log("✓ Todos os testes do preenchimento do Livro do Dia passaram.");
  process.exit(0);
})();
