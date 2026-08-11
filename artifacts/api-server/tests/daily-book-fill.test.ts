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
  userRolesTable,
  delegationsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  resolveAssignmentsByRole,
  collectRotationWinners,
} from "../src/services/line-resolver.js";
import { planRoleAssignments } from "../src/routes/daily-book.js";
import app from "../src/application.js";
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

    // ─── (g) minimumCoverage: padding de vagas OPEN até o mínimo ──────────────────
    console.log("(g) minimumCoverage — padding de vagas OPEN até o mínimo declarado");
    {
      // (g1) Papel com 1 linha FIXED_PERSON coberta + minimumCoverage=2 → [ASSIGNED, OPEN]
      const { byRole: br1 } = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rrFixed = br1.get(roleFixed);
      eqAssert(
        planRoleAssignments(rrFixed, roleFixed, {}, 2),
        [{ userId: uFixed, status: "ASSIGNED" }, { userId: null, status: "OPEN" }],
        "(g1) 1 linha coberta + minimumCoverage=2 → ASSIGNED + OPEN",
      );

      // (g2) Mesmo papel, minimumCoverage=1 → apenas ASSIGNED (sem padding).
      eqAssert(
        planRoleAssignments(rrFixed, roleFixed, {}, 1),
        [{ userId: uFixed, status: "ASSIGNED" }],
        "(g2) minimumCoverage=1 → sem padding",
      );

      // (g3) Papel sem linhas (legado) + minimumCoverage=2, sem escala → [OPEN, OPEN].
      const rrNone = br1.get(roleNoLines);
      eqAssert(
        planRoleAssignments(rrNone, roleNoLines, {}, 2),
        [{ userId: null, status: "OPEN" }, { userId: null, status: "OPEN" }],
        "(g3) sem linhas + minimumCoverage=2 → 2×OPEN",
      );

      // (g4) Papel sem linhas (legado) + escala manual + minimumCoverage=2 → [ASSIGNED, OPEN].
      eqAssert(
        planRoleAssignments(rrNone, roleNoLines, { [roleNoLines]: uManual }, 2),
        [{ userId: uManual, status: "ASSIGNED" }, { userId: null, status: "OPEN" }],
        "(g4) sem linhas + escala + minimumCoverage=2 → ASSIGNED + OPEN",
      );

      // (g5) Papel com linha UNCOVERED + minimumCoverage=2 → [OPEN, OPEN].
      await addFolga(uFixed, baseDate);
      const { byRole: br2 } = await resolveAssignmentsByRole(showBookId, operationId, baseDate);
      const rrUncov = br2.get(roleFixed);
      eqAssert(
        planRoleAssignments(rrUncov, roleFixed, {}, 2),
        [{ userId: null, status: "OPEN" }, { userId: null, status: "OPEN" }],
        "(g5) 1 linha UNCOVERED + minimumCoverage=2 → 2×OPEN",
      );
      await clearFolgas();

      // (g6) minimumCoverage=3, 2 linhas com ROTATION ambas cobertas → 2×ASSIGNED + 1×OPEN.
      // Usa roleRotC (1 linha) como base de rr, mas chama planRoleAssignments com um rr
      // construído manualmente para simular "2 linhas cobertas".
      const mockRr2People: import("../src/services/line-resolver.js").RoleResolution = {
        people: [{ userId: uRotA, name: "A" }, { userId: uRotB, name: "B" }],
        rotationAdvanceUserIds: [],
        hasLines: true,
        hasUncoveredLine: false,
        hasActiveLine: true,
      };
      eqAssert(
        planRoleAssignments(mockRr2People, "mock", {}, 3),
        [
          { userId: uRotA, status: "ASSIGNED" },
          { userId: uRotB, status: "ASSIGNED" },
          { userId: null, status: "OPEN" },
        ],
        "(g6) 2 linhas cobertas + minimumCoverage=3 → 2×ASSIGNED + 1×OPEN",
      );
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

// ─── (e) Autoridade de supervisor por OPERAÇÃO (sem escalada cross-operation) ──
// Regressão do bug: ter a operação no token só prova PERTENÇA. Um supervisor da
// operação A que também é MEMBER da operação B não pode gerir/delegar na op B.
async function runIntegrationE() {
  console.log("(e) integração HTTP: autoridade de supervisor por operação (sem escalada cross-operation)");
  const TAG = `xop_${Date.now()}`;
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const [org] = await db.insert(organizationsTable).values({ name: `${TAG}_org` }).returning();
  const orgId = org!.id;
  const [op1] = await db.insert(operationsTable).values({ organizationId: orgId, name: `${TAG}_opA` }).returning();
  const [op2] = await db.insert(operationsTable).values({ organizationId: orgId, name: `${TAG}_opB` }).returning();
  const opAId = op1!.id;
  const opBId = op2!.id;

  const mk = async (label: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name: `${TAG}_${label}` }).returning();
    return u!.id;
  };
  // supX é supervisor ATIVO na op A, mas apenas MEMBER na op B.
  const supX = await mk("supX");
  const other = await mk("other"); // alvo da delegação
  await db.insert(userRolesTable).values([
    { userId: supX, operationId: opAId, role: "SUPERVISOR_A", active: true },
    { userId: supX, operationId: opBId, role: "MEMBER", active: true },
  ]);

  // Shows SEM responsável (caminho legado, onde a autoridade vem do papel-na-op).
  const [sbA] = await db.insert(showBooksTable).values({ operationId: opAId, title: `${TAG}_showA`, createdBy: supX }).returning();
  const [sbB] = await db.insert(showBooksTable).values({ operationId: opBId, title: `${TAG}_showB`, createdBy: supX }).returning();
  const showAId = sbA!.id;
  const showBId = sbB!.id;

  // O token agrega TODAS as operações dos papéis ativos (A e B) + papel primário.
  const tokenSupX = signAccessToken({ sub: supX, jti: "t", organizationId: orgId, role: "SUPERVISOR_A", operationIds: [opAId, opBId] });
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const window = { startDate: "2026-07-01", endDate: "2026-07-31", responsibilities: ["DAILY_BOOK"] };

  // Livro do Dia mínimo (evento+livro+cena+bloco+posição+alocação) por operação,
  // ligado ao show SEM responsável, para exercitar os guards de mutação.
  const seedDailyBook = async (opId: string, sbId: string, tag: string) => {
    const [ev] = await db.insert(agendaEventsTable).values({ operationId: opId, showBookId: sbId, type: "SHOW", title: `${TAG}_${tag}_ev`, date: "2026-07-10", createdBy: supX }).returning();
    const [dbk] = await db.insert(dailyBooksTable).values({ agendaEventId: ev!.id, showBookId: sbId, status: "DRAFT" }).returning();
    const [sc] = await db.insert(dailyBookScenesTable).values({ dailyBookId: dbk!.id, name: "Cena 1", order: 1 }).returning();
    const [bl] = await db.insert(dailyBookBlocksTable).values({ dailyBookId: dbk!.id, sceneId: sc!.id, name: "Bloco 1", order: 1 }).returning();
    const [po] = await db.insert(dailyBookPositionsTable).values({ dailyBookId: dbk!.id, blockId: bl!.id, name: "Posição 1" }).returning();
    const [asg] = await db.insert(dailyBookAssignmentsTable).values({ dailyBookId: dbk!.id, positionId: po!.id, status: "OPEN" }).returning();
    return { eventId: ev!.id, bookId: dbk!.id, sceneId: sc!.id, blockId: bl!.id, positionId: po!.id, assignmentId: asg!.id };
  };
  const dbkB = await seedDailyBook(opBId, showBId, "B");
  const dbkA = await seedDailyBook(opAId, showAId, "A");
  let createdShowAId: string | null = null;

  try {
    // Delegação por operação inteira (showBookId null) na op B → 403.
    const delBNull = await httpJson(port, "POST", `/api/delegations`, tokenSupX, { ...window, delegateId: other, operationId: opBId, showBookId: null });
    eqAssert(delBNull.status, 403, "(e) supervisor de A NÃO delega por operação inteira na op B (403)");

    // Delegação com escopo de show num show da op B → 403 (mesma autoridade em falta).
    const delBShow = await httpJson(port, "POST", `/api/delegations`, tokenSupX, { ...window, delegateId: other, operationId: opBId, showBookId: showBId });
    eqAssert(delBShow.status, 403, "(e) supervisor de A NÃO delega show da op B (403)");

    // (O controlo positivo de autoridade na op A é coberto pelo `mngA` abaixo, que
    // não persiste linhas — evita-se delegar de facto, cujos avisos/recipients
    // automáticos complicariam a limpeza.)

    // Gestão do Livro do Show: editar referências num show SEM responsável da op B → 403.
    const mngB = await httpJson(port, "POST", `/api/show-books/${showBId}/positions/${fakeId}/refs`, tokenSupX, { documentId: fakeId });
    eqAssert(mngB.status, 403, "(e) supervisor de A NÃO gere show sem responsável da op B (403)");

    // Controlo positivo: gerir show SEM responsável da op A passa o guard (404 por posição inexistente, não 403).
    const mngA = await httpJson(port, "POST", `/api/show-books/${showAId}/positions/${fakeId}/refs`, tokenSupX, { documentId: fakeId });
    eqAssert(mngA.status, 404, "(e) supervisor de A gere show sem responsável da op A (404 posição, não 403)");

    // Mutações do Livro do Dia da op B (supX não supervisiona) → 403 em TODAS as rotas.
    const mAssign = await httpJson(port, "PATCH", `/api/daily-book/${dbkB.bookId}/assignments/${dbkB.assignmentId}`, tokenSupX, { userId: null });
    eqAssert(mAssign.status, 403, "(e) supX NÃO altera alocação do Livro do Dia da op B (403)");
    const mPos = await httpJson(port, "DELETE", `/api/daily-book/${dbkB.bookId}/positions/${dbkB.positionId}`, tokenSupX);
    eqAssert(mPos.status, 403, "(e) supX NÃO remove posição do Livro do Dia da op B (403)");
    const mScene = await httpJson(port, "DELETE", `/api/daily-book/${dbkB.bookId}/scenes/${dbkB.sceneId}`, tokenSupX);
    eqAssert(mScene.status, 403, "(e) supX NÃO remove cena do Livro do Dia da op B (403)");
    const mBlock = await httpJson(port, "DELETE", `/api/daily-book/${dbkB.bookId}/blocks/${dbkB.blockId}`, tokenSupX);
    eqAssert(mBlock.status, 403, "(e) supX NÃO remove bloco do Livro do Dia da op B (403)");
    const mReorder = await httpJson(port, "PATCH", `/api/daily-book/${dbkB.bookId}/scenes/reorder`, tokenSupX, { scenes: [{ id: dbkB.sceneId, order: 2 }] });
    eqAssert(mReorder.status, 403, "(e) supX NÃO reordena cenas do Livro do Dia da op B (403)");
    const mExec = await httpJson(port, "POST", `/api/daily-book/${dbkB.bookId}/execute`, tokenSupX, {});
    eqAssert(mExec.status, 403, "(e) supX NÃO executa Livro do Dia da op B (403)");
    const mCancel = await httpJson(port, "POST", `/api/daily-book/${dbkB.bookId}/cancel`, tokenSupX, {});
    eqAssert(mCancel.status, 403, "(e) supX NÃO cancela Livro do Dia da op B (403)");

    // Criar Livro do Show: na op B (supX não gere) → 403; na op A (supervisiona) → 201.
    const sbCreateB = await httpJson(port, "POST", `/api/show-books`, tokenSupX, { operationId: opBId, title: `${TAG}_negB` });
    eqAssert(sbCreateB.status, 403, "(e) supX NÃO cria Livro do Show na op B (403)");
    const sbCreateA = await httpJson(port, "POST", `/api/show-books`, tokenSupX, { operationId: opAId, title: `${TAG}_posA` });
    eqAssert(sbCreateA.status, 201, "(e) supX cria Livro do Show na op A (201)");
    createdShowAId = sbCreateA.json?.showBook?.id ?? null;

    // Controlo positivo: na op A (que supervisiona) o guard passa; alocação inexistente
    // devolve 404 (não 403) sem persistir auditoria.
    const mAssignA = await httpJson(port, "PATCH", `/api/daily-book/${dbkA.bookId}/assignments/${fakeId}`, tokenSupX, { userId: null });
    eqAssert(mAssignA.status, 404, "(e) supX passa o guard do Livro do Dia da op A (404 alocação, não 403)");
  } finally {
    if (createdShowAId) await db.delete(showBooksTable).where(eq(showBooksTable.id, createdShowAId));
    await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, dbkA.bookId));
    await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, dbkB.bookId));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, dbkA.eventId));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, dbkB.eventId));
    await db.delete(delegationsTable).where(eq(delegationsTable.operationId, opAId));
    await db.delete(delegationsTable).where(eq(delegationsTable.operationId, opBId));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, showAId));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, showBId));
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, supX));
    for (const id of [supX, other]) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
    await db.delete(operationsTable).where(eq(operationsTable.id, opAId));
    await db.delete(operationsTable).where(eq(operationsTable.id, opBId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
    await new Promise<void>((r) => server.close(() => r()));
  }
}

(async () => {
  try {
    await run();
    await runIntegrationC();
    await runIntegrationD();
    await runIntegrationE();
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
