/**
 * Testes pequenos e direcionados das decisões do Bloco 1.
 *
 * Rode com:
 *   TEST_FILE=block1-integrity.test.ts pnpm --filter @workspace/api-server test
 */
import {
  and,
  eq,
  sql,
} from "drizzle-orm";
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
  rotationDailyAdvancesTable,
  locationsTable,
  charactersTable,
  characterCastTable,
} from "@workspace/db";
import { advanceRotationCountsFromWinners } from "../src/services/line-resolver.js";
import { normalizeReason, requireReason } from "../src/lib/reason.js";
import { diffSnapshots, respondWithVersionConflict } from "../src/lib/versioning.js";

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

function eqAssert<T>(actual: T, expected: T, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message} (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`);
}

function fakeResponse() {
  const state: { status?: number; body?: unknown } = {};
  return {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
    state,
  } as any;
}

async function cleanupPreviousBlock1Artifacts() {
  await db.execute(sql`DELETE FROM rotation_daily_advances WHERE user_id IN (
    SELECT id FROM users WHERE nome_de_exibicao LIKE 'block1_%_person'
  )`);
  await db.execute(sql`DELETE FROM show_book_lines WHERE position_id IN (
    SELECT r.id
    FROM show_book_roles r
    JOIN show_books b ON b.id = r.show_book_id
    WHERE b.title LIKE 'block1_%'
  )`);
  await db.execute(sql`DELETE FROM show_book_roles WHERE show_book_id IN (
    SELECT id FROM show_books WHERE title LIKE 'block1_%'
  )`);
  await db.execute(sql`DELETE FROM show_book_blocks WHERE show_book_id IN (
    SELECT id FROM show_books WHERE title LIKE 'block1_%'
  )`);
  await db.execute(sql`DELETE FROM show_book_scenes WHERE show_book_id IN (
    SELECT id FROM show_books WHERE title LIKE 'block1_%'
  )`);
  await db.execute(sql`DELETE FROM show_books WHERE title LIKE 'block1_%'`);
  await db.execute(sql`DELETE FROM operations WHERE name LIKE 'block1_%_operation'`);
  await db.execute(sql`DELETE FROM users WHERE nome_de_exibicao LIKE 'block1_%_person'`);
  await db.execute(sql`DELETE FROM organizations WHERE name LIKE 'block1_%_org'`);
}

async function run() {
  await cleanupPreviousBlock1Artifacts();
  const tag = `block1_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({
    organizationId: org!.id,
    name: `${tag}_operation`,
    status: "ACTIVE",
  }).returning();
  const [person] = await db.insert(usersTable).values({
    organizationId: org!.id,
    name: `${tag}_person`,
  }).returning();

  let lineA: string | null = null;
  let lineB: string | null = null;
  let lineC: string | null = null;
  let showBookIds: string[] = [];
  let characterIds: string[] = [];
  let locationId: string | null = null;

  try {
    const [showA] = await db.insert(showBooksTable).values({
      operationId: operation!.id,
      title: `${tag}_show_a`,
      createdBy: person!.id,
    }).returning();
    const [showB] = await db.insert(showBooksTable).values({
      operationId: operation!.id,
      title: `${tag}_show_b`,
      createdBy: person!.id,
    }).returning();
    showBookIds = [showA!.id, showB!.id];

    const [location] = await db.insert(locationsTable).values({
      organizationId: org!.id,
      name: `${tag}_location`,
    }).returning();
    locationId = location!.id;
    const [astrid] = await db.insert(charactersTable).values({
      name: "Astrid",
      locationId: location!.id,
      mode: "rodizio",
    }).returning();
    const [guardiao] = await db.insert(charactersTable).values({
      name: "Guardião",
      locationId: location!.id,
      mode: "rodizio",
    }).returning();
    characterIds = [astrid!.id, guardiao!.id];
    await db.insert(characterCastTable).values([
      { characterId: astrid!.id, personId: person!.id, order: 0 },
      { characterId: guardiao!.id, personId: person!.id, order: 0 },
    ]);

    async function createLine(showBookId: string, label: string, characterId: string) {
      const [scene] = await db.insert(showBookScenesTable).values({
        showBookId,
        name: `${tag}_${label}_scene`,
        order: 0,
      }).returning();
      const [block] = await db.insert(showBookBlocksTable).values({
        showBookId,
        sceneId: scene!.id,
        name: `${tag}_${label}_block`,
        order: 0,
      }).returning();
      const [role] = await db.insert(showBookRolesTable).values({
        showBookId,
        blockId: block!.id,
        name: `${tag}_${label}_character`,
        order: 0,
      }).returning();
      const [line] = await db.insert(showBookLinesTable).values({
        positionId: role!.id,
        characterId,
        type: "ROTATION" as any,
        config: { characterId, memberIds: [person!.id] } as any,
        order: 0,
      }).returning();
      return line!.id;
    }

    lineA = await createLine(showA!.id, "a", characterIds[0]!);
    lineB = await createLine(showB!.id, "b", characterIds[0]!);
    lineC = await createLine(showA!.id, "c", characterIds[1]!);

    const date = "2026-09-15";
    const firstAdvance = await advanceRotationCountsFromWinners(
      { [lineA]: person!.id, [lineB]: person!.id, [lineC]: person!.id },
      date,
    );
    eqAssert(firstAdvance, 2, "rodízio usa personagem+pessoa+data: duas sessões de Astrid valem 1 e Elsa vale 1");

    const repeatedAdvance = await advanceRotationCountsFromWinners(
      { [lineC]: person!.id, [lineB]: person!.id, [lineA]: person!.id },
      date,
    );
    eqAssert(repeatedAdvance, 0, "rodízio é idempotente ao repetir a publicação do mesmo dia");

    const ledger = await db.select().from(rotationDailyAdvancesTable).where(and(
      eq(rotationDailyAdvancesTable.userId, person!.id),
      eq(rotationDailyAdvancesTable.date, date),
    ));
    eqAssert(ledger.length, 2, "ledger guarda uma ocorrência por personagem/pessoa/data");
    assert(new Set(ledger.map((entry) => entry.characterId)).size === 2, "filas de personagens diferentes avançam separadamente");

    const blankReason = normalizeReason("   ");
    assert(blankReason === null, "motivo em branco é normalizado como ausência de motivo");
    const reasonResponse = fakeResponse();
    const missingReason = requireReason(reasonResponse, "  ", "ação de teste");
    assert(missingReason === null && reasonResponse.state.status === 400, "motivo obrigatório rejeita string vazia");
    const validReasonResponse = fakeResponse();
    eqAssert(requireReason(validReasonResponse, "  decisão operacional  ", "ação de teste"), "decisão operacional", "motivo obrigatório preserva texto aparado");

    const changes = diffSnapshots(
      { version: 2, scenes: { A: { userId: "old" } } },
      { version: 3, scenes: { A: { userId: "new" } } },
    );
    assert(!!changes && changes.some((change) => change.path === "$.version"), "conflito inclui a mudança de versão");
    assert(!!changes && changes.some((change) => change.path === "$.scenes.A.userId"), "conflito inclui o campo alterado");
    assert(!!changes && changes.some((change) => change.message.includes("de") && change.message.includes("para") && change.field === "scenes.A.userId"), "diff do conflito é legível campo a campo");
    const conflictResponse = fakeResponse();
    respondWithVersionConflict(
      conflictResponse,
      "Livro do Dia" as any,
      2,
      3,
      { version: 3, scenes: { A: { userId: "new" } } },
      { version: 2, scenes: { A: { userId: "old" } } },
    );
    assert(conflictResponse.state.status === 409, "escrita concorrente responde 409");
    assert((conflictResponse.state.body as any)?.conflict === true, "resposta de conflito é explícita");
    assert(Array.isArray((conflictResponse.state.body as any)?.changes), "resposta de conflito traz o que mudou");
    assert((conflictResponse.state.body as any)?.changes?.some((change: any) => change.message.includes("de") && change.message.includes("para")), "409 descreve a mudança de que para quê");
    eqAssert((conflictResponse.state.body as any)?.submitted?.version, 2, "versão perdedora fica recuperável na resposta");
    eqAssert((conflictResponse.state.body as any)?.current?.version, 3, "versão vencedora fica recuperável na resposta");
  } finally {
    if (lineA || lineB || lineC) {
      const lineIds = [lineA, lineB, lineC].filter((id): id is string => !!id);
      await db.delete(rotationDailyAdvancesTable).where(eq(rotationDailyAdvancesTable.userId, person!.id));
      for (const lineId of lineIds) {
        await db.delete(showBookLinesTable).where(eq(showBookLinesTable.id, lineId));
      }
      for (const showBookId of showBookIds) {
        await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, showBookId));
        await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, showBookId));
        await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, showBookId));
      }
    }
    if (characterIds.length > 0) {
      await db.delete(characterCastTable).where(eq(characterCastTable.personId, person!.id));
      for (const characterId of characterIds) {
        await db.delete(charactersTable).where(eq(charactersTable.id, characterId));
      }
    }
    if (locationId) await db.delete(locationsTable).where(eq(locationsTable.id, locationId));
    await db.delete(showBooksTable).where(eq(showBooksTable.operationId, operation!.id));
    await db.delete(usersTable).where(eq(usersTable.id, person!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
}

run()
  .then(async () => {
    console.log(`block1-integrity: ${passed} asserts passed`);
    if (failures.length > 0) process.exitCode = 1;
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
